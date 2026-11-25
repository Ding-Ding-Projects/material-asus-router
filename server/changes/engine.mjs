// Every router change goes through here: preview (show what would change),
// apply (write it, with a safety net for risky changes) and undo.
//
// Secrets (Wi-Fi passwords, keys) are masked in every preview and history
// view. Their real old and new values live only in the encrypted vault so a
// change can still be undone.
import { randomUUID } from "node:crypto";
import { findByKey, validate } from "../router/catalog.mjs";
import { LIST_LABELS, applyOps } from "../router/editors.mjs";
import { parseNvram } from "../router/detect.mjs";
import { MASK, isSecret } from "../router/secrets.mjs";
import { MULTILINE_KEYS, NVRAM_KEY, SERVICE, hostTarget, nvramSet, nvramUnset, service } from "../router/shell.mjs";
import { buildGuardCommand, buildRevertScript, cancelCommands, parsePid } from "./guard.mjs";

const RISK_ORDER = { low: 0, network: 1, destructive: 2 };
const PREVIEW_MS = 10 * 60 * 1000;
const HISTORY_LIMIT = 200;
const MAX_ITEMS = 500;
const DENIED_RAW = /^(productid|odmpid|lan_hwaddr|wan\d*_hwaddr|et\d+macaddr|\d+:.*|secret_code|nvram_.*|serial_no|asus_.*)$/;
const FINAL = new Set(["applied", "reverted-by-guard", "failed", "unreachable"]);

const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function validateRaw(key, value) {
  if (!NVRAM_KEY.test(key)) throw bad(`"${key}" is not a valid setting name.`);
  if (DENIED_RAW.test(key)) throw bad(`"${key}" is protected and cannot be edited here.`);
  if (value === null) return null;
  const text = String(value ?? "");
  if (text.length > 4096) throw bad(`${key}: the value is longer than 4096 characters.`);
  if (/[\x00\r]/.test(text) || (!MULTILINE_KEYS.has(key) && text.includes("\n"))) throw bad(`${key}: remove line breaks.`);
  return text;
}

const maskIf = (secret, value) => (secret ? (value === null || value === "" ? "" : MASK) : value);

export class ChangeEngine {
  constructor({ session, store, vault, guardSeconds = 90, pollMs = 3000, watchDeadlineMs = null }) {
    this.session = session;
    this.store = store;
    this.vault = vault;
    this.defaults = { guardSeconds, pollMs, watchDeadlineMs };
    this.previews = new Map();
    this.applying = false;
    this.closed = false;
  }

  close() {
    this.closed = true;
  }

  get guardSeconds() {
    const configured = Number(this.store.read().settings.guardSeconds);
    const seconds = Number.isFinite(configured) && configured > 0 ? configured : this.defaults.guardSeconds;
    return Math.min(Math.max(Math.round(seconds), 5), 900);
  }

  // ---- preview ---------------------------------------------------------

  async preview(input = {}, { user = "", restoring = false, undoOf = null } = {}) {
    const ctx = await this.session.context({ fresh: true });
    const nvram = ctx.nvram;
    const work = new Map(nvram);
    const ops = applyOps(work, input.ops);
    const touched = new Map(); // key -> { entry, risk, restart, raw }
    for (const key of ops.touched) touched.set(key, { entry: null, risk: "low", restart: "", raw: false, fromOps: true });
    const restarts = [...ops.restarts];
    for (const change of input.changes ?? []) {
      if (!change || typeof change !== "object") throw bad("A change is missing its details.");
      const entry = change.id ? ctx.catalog.find((e) => e.id === change.id) : findByKey(ctx.catalog, change.key);
      if (change.id && !entry) throw bad(`"${change.id}" is not a known setting.`, 404);
      const key = entry?.key ?? String(change.key ?? "");
      if (touched.get(key)?.fromOps) throw bad(`${key} is already being changed by another edit.`);
      let value;
      if (entry) {
        if (change.value === null && !restoring) throw bad(`${entry.label.en}: this setting cannot be removed.`);
        value = change.value === null ? null : restoring ? String(change.value) : validate(entry, change.value);
        touched.set(key, { entry, risk: entry.risk, restart: entry.restart, raw: false });
        if (entry.restart) restarts.push(entry.restart);
      } else {
        value = validateRaw(key, change.value);
        touched.set(key, { entry: null, risk: change.risk && change.risk in RISK_ORDER ? change.risk : "network", restart: "", raw: true });
      }
      if (value === null) work.delete(key);
      else work.set(key, value);
    }
    for (const name of input.restart ?? []) {
      if (!SERVICE.test(String(name))) throw bad(`"${name}" is not a known router service.`);
      restarts.push(String(name));
    }
    const items = [];
    for (const [key, meta] of touched) {
      const oldValue = nvram.has(key) ? nvram.get(key) : null;
      const newValue = work.has(key) ? work.get(key) : null;
      if (oldValue === newValue) continue;
      const secret = isSecret(key, meta.entry);
      items.push({
        key,
        entryId: meta.entry?.id ?? null,
        label: meta.entry?.label ?? LIST_LABELS[key] ?? { en: key, yue: key },
        old: oldValue,
        new: newValue,
        secret,
        risk: meta.risk,
      });
    }
    if (!items.length) throw bad("Nothing would change.", 400);
    if (items.length > MAX_ITEMS) throw bad(`That is ${items.length} changes at once. Limit: ${MAX_ITEMS}.`);
    const maxRisk = items.reduce((max, item) => (RISK_ORDER[item.risk] > RISK_ORDER[max] ? item.risk : max), "low");
    const services = [...new Set(restarts.filter(Boolean))];
    const guardArmed = RISK_ORDER[maxRisk] >= RISK_ORDER.network;
    const id = randomUUID();
    const now = Date.now();
    this.#sweep(now);
    this.previews.set(id, { items, services, maxRisk, expiresAt: now + PREVIEW_MS, user, restoring, undoOf, guardSeconds: this.guardSeconds });
    return this.#previewView(id, this.previews.get(id), guardArmed);
  }

  #previewView(id, p, guardArmed = RISK_ORDER[p.maxRisk] >= RISK_ORDER.network) {
    return {
      id,
      expiresAt: new Date(p.expiresAt).toISOString(),
      maxRisk: p.maxRisk,
      restarts: p.services,
      guard: { armed: guardArmed, seconds: p.guardSeconds },
      items: p.items.map((item) => ({
        key: item.key,
        entryId: item.entryId,
        label: item.label,
        old: maskIf(item.secret, item.old),
        new: maskIf(item.secret, item.new),
        secret: item.secret,
        risk: item.risk,
        added: item.old === null,
        removed: item.new === null,
      })),
    };
  }

  #sweep(now) {
    for (const [id, p] of this.previews) if (p.expiresAt < now) this.previews.delete(id);
  }

  // ---- apply -----------------------------------------------------------

  async apply(previewId, { user = "", verifyHost = null } = {}) {
    this.#sweep(Date.now());
    const preview = this.previews.get(previewId);
    if (!preview) throw bad("That preview expired. Preview the changes again.", 410);
    if (this.applying) throw bad("Another change is being applied. Wait for it to finish.", 409);
    this.applying = true;
    try {
      this.previews.delete(previewId);
      if (verifyHost) hostTarget(verifyHost);
      const current = await this.session.nvram({ fresh: true });
      for (const item of preview.items) {
        const now = current.has(item.key) ? current.get(item.key) : null;
        if (now !== item.old) throw bad(`${item.label.en} changed on the router since the preview. Preview again.`, 409);
      }
      const id = randomUUID();
      const guarded = RISK_ORDER[preview.maxRisk] >= RISK_ORDER.network;
      const record = await this.#saveHistory(id, preview, user, guarded, preview.undoOf ?? null);
      let pid = null;
      if (guarded) {
        const script = buildRevertScript(id, preview.items, preview.services);
        const out = await this.session.exec(buildGuardCommand(id, preview.guardSeconds, script));
        if (out.code !== 0) throw bad("The router would not start its safety timer, so nothing was changed.", 502);
        pid = parsePid(out.stdout);
        await this.#patch(id, { guard: { ...record.guard, pid, armedAt: new Date().toISOString() } });
      }
      let writeFailed = false;
      try {
        for (const item of preview.items) await this.session.run(item.new === null ? nvramUnset(item.key) : nvramSet(item.key, item.new));
        await this.session.run("nvram commit");
        for (const name of preview.services) await this.session.run(service(name));
      } catch (error) {
        writeFailed = true;
        if (!guarded) {
          await this.#patch(id, { status: "failed", note: `The router stopped accepting changes: ${error.message}` });
          this.session.invalidate();
          return this.#view(id);
        }
      }
      this.session.invalidate();
      if (!guarded) return this.#verifyDirect(id, preview);
      return this.#verifyGuarded(id, preview, pid, verifyHost, writeFailed);
    } finally {
      this.applying = false;
    }
  }

  async #verifyDirect(id, preview) {
    let verdict;
    try {
      verdict = this.#judge(preview.items, await this.session.nvram({ fresh: true }));
    } catch (error) {
      await this.#patch(id, { status: "failed", note: `Could not read the settings back: ${error.message}` });
      return this.#view(id);
    }
    await this.#patch(id, verdict.state === "new" ? { status: "applied", differs: verdict.differs } : { status: "failed", note: "The router did not keep every change." });
    return this.#view(id);
  }

  async #verifyGuarded(id, preview, pid, verifyHost, writeFailed) {
    const result = await this.#probe(id, preview, pid, verifyHost);
    if (result && result.status !== "guarded") return this.#finish(id, result, verifyHost, writeFailed);
    await this.#patch(id, { status: "guarded", note: result?.note ?? "The router cannot be reached. Its safety timer will put the old settings back." });
    this.#watch(id, preview, pid, verifyHost);
    return this.#view(id);
  }

  // Opens a new connection and decides what happened, or returns null when
  // the router cannot be reached.
  async #probe(id, preview, pid, verifyHost) {
    let fresh;
    try {
      fresh = await this.session.openFresh(verifyHost ? { host: verifyHost } : {});
    } catch {
      return null;
    }
    try {
      const shown = await fresh.exec("nvram show");
      const verdict = this.#judge(preview.items, parseNvram(shown.stdout));
      if (verdict.state === "new") {
        for (const command of cancelCommands(id, pid)) await fresh.exec(command);
        return { status: "applied", differs: verdict.differs };
      }
      if (verdict.state === "old") return { status: "reverted-by-guard" };
      return { status: "guarded", note: "The router answered but only some changes are in place. The safety timer will finish putting them back." };
    } catch {
      return null;
    } finally {
      fresh.close();
    }
  }

  async #finish(id, result, verifyHost, writeFailed) {
    const note = result.status === "reverted-by-guard" ? "The router safety timer restored the old settings." : writeFailed ? "Some commands were interrupted, but every change is in place." : undefined;
    await this.#patch(id, { status: result.status, differs: result.differs, note });
    if (result.status === "applied" && verifyHost && verifyHost !== this.session.config.host) {
      await this.store.update((s) => void (s.router.host = verifyHost));
    }
    await this.session.reconnect().catch(() => {});
    return this.#view(id);
  }

  // Looks at the router's values and says whether the change is fully in
  // place ("new"), fully undone ("old"), or somewhere in between ("mixed").
  #judge(items, values) {
    let inNew = 0;
    let inOld = 0;
    let other = 0;
    for (const item of items) {
      const value = values.has(item.key) ? values.get(item.key) : null;
      if (value === item.new) inNew += 1;
      else if (value === item.old) inOld += 1;
      else other += 1;
    }
    if (inOld === items.length) return { state: "old" };
    if (inNew + other === items.length) return { state: "new", differs: other > 0 };
    return { state: "mixed" };
  }

  // Polls until the router comes back, then reports what the guard did.
  #watch(id, preview, pid, verifyHost) {
    const seconds = this.#record(id).guard?.seconds ?? this.guardSeconds;
    const deadline = Date.now() + (this.defaults.watchDeadlineMs ?? seconds * 1500 + 60000);
    (async () => {
      while (!this.closed && Date.now() < deadline) {
        await sleep(this.defaults.pollMs);
        if (this.closed) return;
        const result = await this.#probe(id, preview, pid, verifyHost);
        if (!result) continue;
        if (result.status === "guarded") continue;
        await this.#patch(id, { status: result.status, differs: result.differs, note: result.status === "applied" ? undefined : "The router safety timer restored the old settings." });
        this.session.invalidate();
        await this.session.reconnect().catch(() => {});
        return;
      }
      if (!this.closed) await this.#patch(id, { status: "unreachable", note: "The router did not come back in time. Check it, then press Refresh." });
    })().catch(() => {});
  }

  // ---- history ---------------------------------------------------------

  async #saveHistory(id, preview, user, guarded, undoOf) {
    const items = [];
    for (const [index, item] of preview.items.entries()) {
      if (item.secret) {
        if (item.old !== null) await this.vault.set(`hist:${id}:${index}:old`, item.old);
        if (item.new !== null) await this.vault.set(`hist:${id}:${index}:new`, item.new);
      }
      items.push({
        key: item.key,
        entryId: item.entryId,
        label: item.label,
        secret: item.secret,
        risk: item.risk,
        old: item.secret ? (item.old === null ? null : MASK) : item.old,
        new: item.secret ? (item.new === null ? null : MASK) : item.new,
      });
    }
    const record = {
      id,
      at: new Date().toISOString(),
      user,
      status: "applying",
      risk: preview.maxRisk,
      restarts: preview.services,
      guard: guarded ? { seconds: preview.guardSeconds } : null,
      undoOf,
      items,
    };
    const dropped = [];
    await this.store.update((s) => {
      s.history.unshift(record);
      while (s.history.length > HISTORY_LIMIT) dropped.push(s.history.pop());
    });
    for (const old of dropped) {
      for (const [index, item] of old.items.entries()) if (item.secret) await Promise.all([this.vault.delete(`hist:${old.id}:${index}:old`), this.vault.delete(`hist:${old.id}:${index}:new`)]);
    }
    return record;
  }

  #record(id) {
    return this.store.read().history.find((h) => h.id === id);
  }

  #withSecrets(id, item, index) {
    if (!item.secret) return item;
    return { ...item, old: item.old === null ? null : this.vault.get(`hist:${id}:${index}:old`), new: item.new === null ? null : this.vault.get(`hist:${id}:${index}:new`) };
  }

  async #patch(id, fields) {
    await this.store.update((s) => {
      const record = s.history.find((h) => h.id === id);
      if (!record) return;
      for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) delete record[key];
        else record[key] = value;
      }
      if (FINAL.has(record.status)) record.finishedAt = new Date().toISOString();
    });
  }

  #view(id) {
    return this.view(this.#record(id));
  }

  view(record) {
    if (!record) return null;
    const undone = this.store.read().history.some((h) => h.undoOf === record.id && h.status === "applied");
    return { ...record, canUndo: record.status === "applied" && !undone && !record.undoOf, undone, items: record.items };
  }

  history() {
    return this.store.read().history.map((h) => this.view(h));
  }

  get(id) {
    return this.view(this.#record(id));
  }

  // ---- undo ------------------------------------------------------------

  async undo(historyId, { user = "" } = {}) {
    const record = this.#record(historyId);
    if (!record) throw bad("That change is not in the history.", 404);
    if (record.status !== "applied") throw bad("Only a change that was applied can be undone.", 409);
    if (this.view(record).undone) throw bad("That change was already undone.", 409);
    const changes = record.items.map((item, index) => {
      const full = this.#withSecrets(record.id, item, index);
      const entry = full.entryId ? { id: full.entryId } : { key: full.key, risk: full.risk };
      return { ...entry, value: full.old };
    });
    return this.preview({ changes, restart: record.restarts }, { user, restoring: true, undoOf: record.id });
  }
}
