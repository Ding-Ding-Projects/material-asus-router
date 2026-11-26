// The safety service: everything between "a person pressed a control" and the
// change engine writing to the router.
//
//   live mode      each committed control change is applied at once (preview and
//                  apply in one step); review mode keeps the preview dock
//   impact         every change and action has a household impact from 0 to 3
//   four keys      a change above the level the household chose, or above what it allows
//                  right now, needs the four-key confirmation (server side)
//   allowance      a change above what the household allows right now is refused;
//                  the owner can override, and the override is written in the history
//   history        every applied change, undo and restore becomes a version in a
//                  local version-control repository
//   undo / redo    a stack per person over that history
//   quiet apply    a change can wait for a time, or for "nobody is on the Wi-Fi"
//   reboot         only through the launch sequence
//   progress       live steps for anything that takes time
import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { Confirmations, LaunchSequences } from "./confirm.mjs";
import { ConfigHistory } from "./history-repo.mjs";
import { Household } from "./household.mjs";
import { impactOfAction, levelInfo } from "./impact.mjs";
import { ProgressHub, step } from "./progress.mjs";
import { buildSnapshot, fingerprinter } from "./snapshot.mjs";

const SALT_KEY = "history.salt";
const STACK_LIMIT = 100;
const PENDING_LIMIT = 50;
const DEFAULT_QUIET_WINDOW_MS = 24 * 3600 * 1000;

export const refuse = (en, yue, code, status = 403, detail = undefined) => Object.assign(new Error(en), { status, code, yue, detail });
const slug = (text) => String(text ?? "person").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 32) || "person";
const clip = (value, n = 160) => {
  const t = String(value ?? "");
  return t.length > n ? `${t.slice(0, n)}...` : t;
};
const SOURCE_PREFIX = { undo: "Undo", redo: "Redo", restore: "Restore", quiet: "Quiet apply" };

export class SafetyService {
  constructor({ store, vault, session, engine, dataDir, options = {}, areaLabel, readDevices, actionInfo }) {
    this.store = store;
    this.vault = vault;
    this.session = session;
    this.engine = engine;
    this.options = { fourKey: true, launch: true, ...(options.safety ?? {}) };
    const now = this.options.now ?? (() => Date.now());
    this.now = now;
    this.areaLabel = areaLabel ?? ((a) => ({ en: a, yue: a }));
    this.readDevices = readDevices;
    this.actionInfo = actionInfo ?? (() => null);
    this.pollMs = options.pollMs ?? 3000;
    this.progress = new ProgressHub({ now });
    this.confirm = new Confirmations({ now, holdMs: this.options.holdMs });
    this.launch = new LaunchSequences({ now, countdownMs: this.options.countdownMs ?? 10000, keysTogetherMs: this.options.keysTogetherMs });
    this.household = new Household({ store, vault, fetchImpl: this.options.fetch ?? fetch, now: () => new Date(now()) });
    this.history = new ConfigHistory({ dir: path.join(dataDir, "history", "router-config"), now });
    this.ticking = false;
    engine.observer = {
      step: (runId, key, label, state, detail) => this.progress.step(runId, key, label, state, detail),
      finish: (runId, status, note) => this.progress.finish(runId, status, note),
      applied: (record, info) => this.#onApplied(record, info),
    };
    this.timer = null;
    this.recoverPending();
    const every = this.options.quietPollMs ?? 30000;
    if (every > 0) {
      this.timer = setInterval(() => void this.tick().catch(() => {}), every);
      this.timer.unref?.();
    }
  }

  close() {
    clearInterval(this.timer);
  }

  // ---- settings ---------------------------------------------------------------

  get liveMode() {
    return this.store.read().settings.liveMode !== false;
  }

  async setLiveMode(value) {
    await this.store.update((s) => void (s.settings.liveMode = Boolean(value)));
    return this.liveMode;
  }

  settings() {
    return { liveMode: this.liveMode, enforcement: { fourKey: this.options.fourKey, launch: this.options.launch }, holdMs: this.confirm.holdMs, countdownMs: this.launch.countdownMs };
  }

  // ---- previews and the gate --------------------------------------------------

  #who(who) {
    return { name: who.name, userId: who.userId ?? who.name, role: who.role ?? "operator" };
  }

  async previewChange(input, who, { mode = "review", source = "change", restoring = false } = {}) {
    const w = this.#who(who);
    const view = await this.engine.preview(input, { user: w.name, restoring, meta: { mode, source, userId: w.userId } });
    return this.decorate(view);
  }

  // Adds what the person needs to know before pressing apply.
  async decorate(view) {
    const level = view.impact.level;
    const out = { ...view, impact: { ...view.impact, ...levelInfo(level) }, confirmation: { required: false, target: `preview:${view.id}` } };
    if (level >= 1) {
      let allowance = null;
      try {
        const ctx = await this.session.context();
        allowance = await this.household.allowance(ctx);
        out.allowance = { allowed: allowance.allowed, ok: level <= allowance.allowed, madness: allowance.madness, people: allowance.people, configured: allowance.configured };
      } catch {
        out.allowance = null;
      }
      out.confirmation.required = await this.keysNeeded(level, allowance);
    }
    return out;
  }

  async #allowanceCheck(level, who, override, { source = "change" } = {}) {
    if (level < 1) return { note: null, allowance: null };
    const ctx = await this.session.context({ fresh: true });
    const allowance = await this.household.allowance(ctx);
    if (level <= allowance.allowed) return { note: null, allowance };
    const why = allowance.people.filter((p) => p.allowed < level);
    const detail = { impact: level, allowed: allowance.allowed, limitedBy: allowance.limitedBy, people: why.map((p) => ({ id: p.id, name: p.name, nameYue: p.nameYue, presence: p.presence, allowed: p.allowed, reason: p.reason })) };
    if (!override) throw refuse(`This change would disturb the household more than allowed right now (level ${level}, allowed ${allowance.allowed}). ${why[0]?.reason.en ?? ""}`.trim(), `呢個改動會比家人而家容許嘅更擾人（影響級數 ${level}，容許 ${allowance.allowed}）。${why[0]?.reason.yue ?? ""}`.trim(), "ALLOWANCE", 403, detail);
    if (who.role !== "owner") throw refuse("Only the owner can override the household allowance.", "只有擁有人先可以越過家人容許嘅程度。", "OVERRIDE_OWNER", 403, detail);
    return { note: `allowance: level ${level} above ${allowance.allowed}${source === "quiet" ? " (set when scheduled)" : ""}`, allowance };
  }

  // The four keys guard a change that disturbs the household more than the level it chose
  // ("most brother madness allowed") or more than it allows right now. A change at or below
  // both needs no keys. When the router cannot be read, the careful answer is to ask.
  async keysNeeded(level, allowance = null) {
    if (level < 1 || !this.options.fourKey) return false;
    if (level > this.household.state().madness) return true;
    try {
      allowance ??= await this.household.allowance(await this.session.context());
      return level > allowance.allowed;
    } catch {
      return true;
    }
  }

  async #requireConfirmation({ who, target, level, proof, begin, allowance = null }) {
    if (!(await this.keysNeeded(level, allowance))) return;
    this.#demandKeys({ who, target, proof, begin });
  }

  #demandKeys({ who, target, proof, begin }) {
    if (!proof) throw refuse("This change needs the four-key confirmation.", "呢個改動要四重確認。", "CONFIRM_REQUIRED", 428, { confirmation: begin() });
    this.confirm.verify({ userId: who.userId, target, proof });
  }

  beginConfirmation({ who, target, impact, shortName }) {
    const w = this.#who(who);
    return this.confirm.begin({ userId: w.userId, target, impact, shortName, people: this.household.affectedPeople() });
  }

  // Applies a preview after the allowance and the four keys have said yes.
  async commit(previewId, { who, confirmation, override = false, verifyHost = null, title = null } = {}) {
    const w = this.#who(who);
    const p = this.engine.peek(previewId);
    if (!p) return this.engine.apply(previewId, { user: w.name, verifyHost }); // throws the usual "expired"
    const level = p.impact.level;
    const target = `preview:${previewId}`;
    let overrideNote;
    try {
      const checked = await this.#allowanceCheck(level, w, override, { source: p.meta.source });
      overrideNote = checked.note;
      await this.#requireConfirmation({ who: w, target, level, proof: confirmation, allowance: checked.allowance, begin: () => this.beginConfirmation({ who: w, target, impact: level, shortName: p.shortName }) });
    } catch (error) {
      // The person can carry on with this very preview (more keys, or an owner override).
      if (error.detail && typeof error.detail === "object") error.detail.previewId = previewId;
      throw error;
    }
    const runId = this.progress.start({ kind: p.meta.source, title: title ?? this.#title(p), user: w.name, meta: { impact: level, previewId } });
    const record = await this.engine.apply(previewId, { user: w.name, verifyHost, runId, meta: { userId: w.userId, ...(overrideNote ? { override: overrideNote } : {}) } });
    return { ...record, runId };
  }

  #title(p) {
    const names = p.items.map((i) => i.label.en);
    const text = names.length > 2 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : names.join(", ");
    const prefix = SOURCE_PREFIX[p.meta.source];
    return { en: `${prefix ? `${prefix}: ` : ""}${text}`, yue: `${prefix ? `${prefix}：` : ""}${p.items.map((i) => i.label.yue).slice(0, 2).join("、")}${names.length > 2 ? ` 等 ${names.length} 項` : ""}` };
  }

  // Live mode: preview and apply in one step. Without the keys, the answer says which keys are needed.
  async applyLive(body, who) {
    if (!this.liveMode) throw refuse("Live mode is off. Preview the change, then apply it.", "即時模式已經關閉。請先預覽，再套用。", "LIVE_MODE_OFF", 409);
    const w = this.#who(who);
    let previewId = body.previewId ? String(body.previewId) : null;
    if (!previewId) previewId = (await this.previewChange({ changes: body.changes, ops: body.ops, restart: body.restart }, w, { mode: "live" })).id;
    return this.commit(previewId, { who: w, confirmation: body.confirmation, override: body.override === true, verifyHost: body.verifyHost || null });
  }

  // ---- actions -----------------------------------------------------------------

  actionImpact(name, body = {}) {
    const info = this.actionInfo(name);
    return impactOfAction(name, { risk: info?.risk ?? null, body });
  }

  actionShortName(name, body = {}) {
    if (name === "restart-service") return `Restart ${String(body.service ?? "service").replace(/^restart_/, "")}`;
    const base = String(name).replace(/^[a-z0-9-]+\./, "").replace(/-/g, " ");
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  // Run before an action does anything: allowance, four keys, and the launch rule for reboot.
  async gateAction(name, body, who) {
    const w = this.#who(who);
    const { level } = this.actionImpact(name, body);
    if (name === "reboot" && this.options.launch) throw refuse("A reboot can only be sent through the launch sequence.", "重啟要經發射程序先可以送出。", "LAUNCH_REQUIRED", 403);
    if (level < 1) return { level, override: null };
    const { note: override, allowance } = await this.#allowanceCheck(level, w, body.override === true);
    const target = `action:${name}`;
    await this.#requireConfirmation({ who: w, target, level, proof: body.confirmation, allowance, begin: () => this.beginConfirmation({ who: w, target, impact: level, shortName: this.actionShortName(name, body) }) });
    return { level, override };
  }

  // ---- reboot launch -------------------------------------------------------------

  beginLaunch(who, confirmation) {
    const w = this.#who(who);
    const level = 3;
    const target = "action:reboot";
    // A reboot always takes the keys, whatever the household allows.
    if (this.options.fourKey) this.#demandKeys({ who: w, target, proof: confirmation, begin: () => this.beginConfirmation({ who: w, target, impact: level, shortName: "Reboot" }) });
    return this.launch.begin({ userId: w.userId });
  }

  async fireLaunch(id, who) {
    const w = this.#who(who);
    const sequence = this.launch.launch(id, w.userId);
    const runId = this.progress.start({ kind: "reboot", title: step("Reboot the router", "重啟路由器"), user: w.name, meta: { impact: 3 } });
    this.launch.attachRun(sequence, runId);
    void this.#reboot(runId).catch((error) => {
      this.progress.step(runId, "error", step("The reboot watcher stopped", "重啟監察停止咗"), "failed", error.message);
      this.progress.finish(runId, "failed", error.message);
    });
    return { ...this.launch.view(sequence), runId };
  }

  async #uptime(exec) {
    const out = await exec("head -n 100000 /proc/uptime");
    const seconds = Number.parseFloat(String(out.stdout).split(" ")[0]);
    return Number.isFinite(seconds) ? seconds : null;
  }

  async #reboot(runId) {
    const { progress } = this;
    const poll = this.options.rebootPollMs ?? this.pollMs;
    const downWait = this.options.rebootDownWaitMs ?? 90000;
    const deadline = this.now() + (this.options.rebootDeadlineMs ?? 15 * 60 * 1000);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const S = {
      send: step("Sending the reboot command", "送出重啟指令"),
      down: step("Waiting for the router to go down", "等路由器關機"),
      up: step("Waiting for the router to answer again", "等路由器重新回應"),
      back: step("Reading the settings back", "讀返設定確認"),
    };
    progress.step(runId, "send", S.send, "running");
    let before = null;
    let uptime0 = null;
    try {
      const ctx = await this.session.context({ fresh: true });
      before = new Map(ctx.catalog.filter((e) => !e.secret).map((e) => [e.key, ctx.nvram.get(e.key) ?? null]));
      uptime0 = await this.#uptime((c) => this.session.exec(c));
    } catch {
      /* the reboot still goes ahead; we just have less to compare with */
    }
    await this.session.exec("reboot").catch(() => {});
    this.session.close();
    this.session.invalidate();
    progress.step(runId, "send", S.send, "done");
    progress.step(runId, "down", S.down, "waiting");
    let wentDown = false;
    const downUntil = this.now() + downWait;
    let answeredEarly = false;
    while (!wentDown && !answeredEarly) {
      if (this.now() > downUntil) {
        progress.step(runId, "down", S.down, "failed", "The router never went away, so the reboot may not have started.");
        progress.finish(runId, "failed", "The router never went away, so the reboot may not have started.");
        return;
      }
      let fresh = null;
      try {
        fresh = await this.session.openFresh();
        const up = await this.#uptime((c) => fresh.exec(c));
        if (uptime0 !== null && up !== null && up < uptime0) answeredEarly = true;
        else await sleep(poll);
      } catch {
        wentDown = true;
      } finally {
        fresh?.close();
      }
    }
    progress.step(runId, "down", S.down, "done", answeredEarly ? "The router restarted quickly." : "");
    progress.step(runId, "up", S.up, "waiting");
    let tries = 0;
    for (;;) {
      if (this.now() > deadline) {
        progress.step(runId, "up", S.up, "failed", "The router did not answer in time.");
        progress.finish(runId, "timeout", "The router did not answer in time.");
        return;
      }
      tries += 1;
      let fresh = null;
      try {
        fresh = await this.session.openFresh();
        await fresh.exec("nvram show");
        break;
      } catch {
        progress.step(runId, "up", S.up, "waiting", `Still no answer (try ${tries}).`);
        await sleep(poll);
      } finally {
        fresh?.close();
      }
    }
    progress.step(runId, "up", S.up, "done", `After ${tries} ${tries === 1 ? "try" : "tries"}.`);
    progress.step(runId, "back", S.back, "running");
    try {
      await this.session.reconnect();
      const ctx = await this.session.context({ fresh: true });
      let differ = 0;
      if (before) for (const [key, value] of before) if ((ctx.nvram.get(key) ?? null) !== value) differ += 1;
      progress.step(runId, "back", S.back, "done", before ? `${before.size} settings read back, ${differ} different from before.` : `${ctx.nvram.size} settings read back.`);
      progress.finish(runId, "done", differ ? `${differ} settings are different after the reboot.` : "");
    } catch (error) {
      progress.step(runId, "back", S.back, "failed", error.message);
      progress.finish(runId, "failed", error.message);
    }
  }

  // ---- history ---------------------------------------------------------------------

  async #salt() {
    let salt = this.vault.get(SALT_KEY);
    if (!salt) {
      salt = randomBytes(24).toString("base64");
      await this.vault.set(SALT_KEY, salt);
    }
    return salt;
  }

  async #currentSnapshot(extraRaw = [], nvramOverride = null) {
    const ctx = await this.session.context({ fresh: true });
    const mark = fingerprinter(await this.#salt());
    const rawKeys = [...(await this.history.rawKeys()), ...extraRaw];
    return buildSnapshot({ catalog: ctx.catalog, nvram: nvramOverride ? nvramOverride(ctx.nvram) : ctx.nvram, rawKeys, mark, areaLabel: this.areaLabel });
  }

  async currentMap() {
    return (await this.#currentSnapshot()).entries;
  }

  async #onApplied(record, { meta, items }) {
    // history: false is for checks that apply hundreds of changes and are not about the history.
    if (this.options.history === false) return;
    const ctx = await this.session.context({ fresh: true });
    const inCatalog = new Set(ctx.catalog.map((e) => e.key));
    const extraRaw = items.filter((i) => !inCatalog.has(i.key)).map((i) => i.key);
    const author = { name: record.user || "Someone", email: `${slug(record.user)}@history.local` };
    if (await this.history.isEmpty()) {
      const baseline = await this.#currentSnapshot(extraRaw, (nvram) => {
        const copy = new Map(nvram);
        for (const item of items) {
          if (item.old === null) copy.delete(item.key);
          else copy.set(item.key, item.old);
        }
        return copy;
      });
      await this.history.record({ files: baseline.files, subject: "Baseline: the settings before the first recorded change", body: "", trailers: { Mode: "baseline", Source: "baseline", Impact: 0, Guard: "none", Keys: "", Areas: "" }, author: { name: "Router Manager", email: "history@history.local" } });
    }
    const snapshot = await this.#currentSnapshot(extraRaw);
    const keys = items.map((i) => i.key);
    const areas = [...new Set(items.map((i) => snapshot.entries.get(i.key)?.area ?? "raw"))];
    const prefix = SOURCE_PREFIX[meta.source];
    const names = items.map((i) => i.label.en);
    const subject = `${prefix ? `${prefix}: ` : ""}${items.length === 1 ? this.#line(items[0]) : `${items.length} settings changed (${names.slice(0, 3).join(", ")}${names.length > 3 ? ", ..." : ""})`}`;
    const body = items.map((i) => `- ${this.#line(i)} [${i.key}]`).join("\n");
    await this.history.record({
      files: snapshot.files,
      subject,
      body,
      author,
      trailers: { Mode: meta.mode ?? "review", Source: meta.source ?? "change", Impact: record.impact ?? 0, Guard: record.guardResult ?? "none", Keys: keys.join(","), Areas: areas.join(","), "Change-Id": record.id, Run: record.runId ?? "", Override: meta.override ?? "" },
    });
    await this.#stackAfter(record, meta);
  }

  #line(item) {
    if (item.secret) return `${item.label.en}: changed (secret value not kept)`;
    const show = (v) => (v === null ? "(not set)" : v === "" ? "(empty)" : clip(v));
    return `${item.label.en}: ${show(item.old)} -> ${show(item.new)}`;
  }

  // ---- undo and redo -------------------------------------------------------------------

  async #stackAfter(record, meta) {
    const userId = meta.userId ?? record.userId;
    if (!userId) return;
    await this.store.update((s) => {
      s.safety ??= { stacks: {}, pending: [] };
      const stack = (s.safety.stacks[userId] ??= { undo: [], redo: [] });
      const drop = (list, id) => void (list.splice(0, list.length, ...list.filter((x) => x !== id)));
      if (meta.source === "undo" && record.undoOf) {
        drop(stack.undo, record.undoOf);
        stack.redo.push(record.undoOf);
      } else if (meta.source === "redo" && meta.redoOf) {
        drop(stack.redo, meta.redoOf);
        stack.undo.push(record.id);
      } else {
        stack.undo.push(record.id);
        stack.redo = [];
      }
      stack.undo = stack.undo.slice(-STACK_LIMIT);
      stack.redo = stack.redo.slice(-STACK_LIMIT);
    });
  }

  undoState(who) {
    const w = this.#who(who);
    const stack = this.store.read().safety?.stacks?.[w.userId] ?? { undo: [], redo: [] };
    const records = new Map(this.engine.history().map((h) => [h.id, h]));
    const describe = (id) => {
      const r = records.get(id);
      return r ? { id, at: r.at, impact: r.impact ?? 0, items: r.items.map((i) => ({ key: i.key, label: i.label })) } : null;
    };
    return { undo: stack.undo.map(describe).filter(Boolean).reverse(), redo: stack.redo.map(describe).filter(Boolean).reverse() };
  }

  // Previews the undo (or redo) of the person's latest change. Applies it too when asked.
  async stackStep(kind, who, body = {}) {
    const w = this.#who(who);
    const mode = this.liveMode ? "live" : "review";
    if (body.previewId) return this.commit(String(body.previewId), { who: w, confirmation: body.confirmation, override: body.override === true });
    const state = this.undoState(w);
    const list = kind === "undo" ? state.undo : state.redo;
    if (!list.length) throw refuse(kind === "undo" ? "There is nothing to undo." : "There is nothing to redo.", kind === "undo" ? "冇嘢可以還原。" : "冇嘢可以重做。", "STACK_EMPTY", 409);
    const target = list[0].id;
    const meta = { mode, userId: w.userId };
    const view = kind === "undo" ? await this.engine.undo(target, { user: w.name, meta }) : await this.engine.redo(target, { user: w.name, meta });
    const decorated = await this.decorate(view);
    if (body.apply === false || (body.apply === undefined && !this.liveMode)) return decorated;
    return this.commit(view.id, { who: w, confirmation: body.confirmation, override: body.override === true });
  }

  // ---- restore from a version ----------------------------------------------------------

  async restore(body, who) {
    const w = this.#who(who);
    const oid = (await this.history.resolve(body.oid)).oid;
    let scope = {};
    if (body.id) scope = { id: String(body.id) };
    else if (body.key) scope = { key: String(body.key) };
    else if (body.all !== true) throw refuse("Say which setting to restore, or ask for everything.", "請指明要還原邊項設定，或者揀全部。", "RESTORE_SCOPE", 400);
    const plan = await this.history.restorePlan(oid, await this.currentMap(), scope);
    if (!plan.changes.length) throw refuse("Nothing in that version differs from the router now.", "嗰個版本同路由器而家冇分別。", "RESTORE_NOTHING", 400, { skipped: plan.skipped });
    const mode = this.liveMode ? "live" : "review";
    const view = await this.previewChange({ changes: plan.changes }, w, { mode, source: "restore", restoring: true });
    const out = { preview: view, skipped: plan.skipped };
    if (body.apply === true) {
      if (!this.liveMode) throw refuse("Live mode is off. Apply the preview yourself.", "即時模式已經關閉，請自己套用預覽。", "LIVE_MODE_OFF", 409);
      out.applied = await this.commit(view.id, { who: w, confirmation: body.confirmation, override: body.override === true });
    }
    return out;
  }

  // ---- pending (later / quiet) ------------------------------------------------------------

  hash(input) {
    return createHash("sha256").update(JSON.stringify({ c: input.changes ?? [], o: input.ops ?? [], r: input.restart ?? [] })).digest("hex").slice(0, 24);
  }

  pendingList() {
    return (this.store.read().safety?.pending ?? []).slice().reverse();
  }

  async schedule(body, who) {
    const w = this.#who(who);
    const input = { changes: body.changes, ops: body.ops, restart: body.restart };
    const when = this.#cleanWhen(body.when);
    const preview = await this.engine.preview(input, { user: w.name, meta: { mode: "quiet", source: "quiet", userId: w.userId } });
    const level = preview.impact.level;
    const target = `schedule:${this.hash(input)}`;
    await this.#requireConfirmation({ who: w, target, level, proof: body.confirmation, begin: () => this.beginConfirmation({ who: w, target, impact: level, shortName: preview.shortName }) });
    const overrideNote = body.override === true && level >= 1 && w.role === "owner" ? "allowance: override approved when scheduled" : null;
    const item = { id: randomUUID(), userId: w.userId, user: w.name, role: w.role, createdAt: new Date(this.now()).toISOString(), input, when, status: "pending", note: "", impact: level, shortName: preview.shortName, summary: preview.items.map((i) => ({ key: i.key, label: i.label })), override: overrideNote, runId: null, historyId: null };
    await this.store.update((s) => {
      s.safety ??= { stacks: {}, pending: [] };
      if (s.safety.pending.filter((p) => p.status === "pending").length >= PENDING_LIMIT) throw refuse(`There can be up to ${PENDING_LIMIT} waiting changes.`, `最多可以有 ${PENDING_LIMIT} 個等待中嘅改動。`, "PENDING_LIMIT", 409);
      s.safety.pending.push(item);
    });
    return this.#pendingView(item);
  }

  #cleanWhen(raw) {
    if (raw?.quiet === true) {
      const notAfter = raw.notAfter ? Date.parse(raw.notAfter) : this.now() + DEFAULT_QUIET_WINDOW_MS;
      const notBefore = raw.notBefore ? Date.parse(raw.notBefore) : null;
      if (Number.isNaN(notAfter) || (raw.notBefore && Number.isNaN(notBefore))) throw refuse("Dates must look like 2026-11-25T23:00:00Z.", "日期格式要似 2026-11-25T23:00:00Z。", "WHEN", 400);
      if (notAfter <= this.now()) throw refuse("The deadline is already past.", "限期已經過咗。", "WHEN", 400);
      return { type: "quiet", notBefore: notBefore ? new Date(notBefore).toISOString() : null, notAfter: new Date(notAfter).toISOString() };
    }
    const at = Date.parse(raw?.at);
    if (!raw?.at || Number.isNaN(at)) throw refuse("Say when to apply it: a time, or when the house is quiet.", "請指明幾時套用：一個時間，或者屋企靜落嚟嗰陣。", "WHEN", 400);
    if (at <= this.now()) throw refuse("That time has already passed.", "嗰個時間已經過咗。", "WHEN", 400);
    return { type: "at", at: new Date(at).toISOString() };
  }

  #pendingView(p) {
    return { id: p.id, user: p.user, createdAt: p.createdAt, when: p.when, status: p.status, note: p.note, impact: p.impact, shortName: p.shortName, summary: p.summary, runId: p.runId, historyId: p.historyId };
  }

  async cancelPending(id, who) {
    const w = this.#who(who);
    let out;
    await this.store.update((s) => {
      const item = s.safety?.pending?.find((p) => p.id === id);
      if (!item) throw refuse("That waiting change does not exist.", "呢個等待中嘅改動唔存在。", "PENDING_GONE", 404);
      if (item.status !== "pending") throw refuse("That change is no longer waiting.", "呢個改動已經唔係等待中。", "PENDING_STATE", 409);
      if (item.userId !== w.userId && w.role !== "owner") throw refuse("Only the person who scheduled it, or the owner, can cancel it.", "只有排程嘅人或者擁有人先可以取消。", "PENDING_OWNER", 403);
      item.status = "cancelled";
      item.note = "Cancelled.";
      out = this.#pendingView(item);
    });
    return out;
  }

  recoverPending() {
    this.store.update((s) => {
      for (const p of s.safety?.pending ?? []) if (p.status === "running") Object.assign(p, { status: "failed", note: "The app stopped while this was being applied." });
    }).catch(() => {});
  }

  async #setPending(id, fields) {
    await this.store.update((s) => {
      const item = s.safety?.pending?.find((p) => p.id === id);
      if (item) Object.assign(item, fields);
    });
  }

  // Looks at every waiting change and applies the ones whose time has come.
  async tick() {
    if (this.ticking) return { checked: 0 };
    this.ticking = true;
    let checked = 0;
    try {
      const waiting = (this.store.read().safety?.pending ?? []).filter((p) => p.status === "pending");
      if (!waiting.length) return { checked };
      let quiet = null;
      for (const p of waiting) {
        checked += 1;
        const nowMs = this.now();
        if (p.when.type === "at") {
          if (nowMs < Date.parse(p.when.at)) continue;
        } else {
          if (nowMs > Date.parse(p.when.notAfter)) {
            await this.#setPending(p.id, { status: "expired", note: "The house was not quiet before the deadline, so nothing was changed." });
            continue;
          }
          if (p.when.notBefore && nowMs < Date.parse(p.when.notBefore)) continue;
          if (!quiet) {
            try {
              quiet = await this.household.isQuiet(await this.session.context({ fresh: true }));
            } catch {
              quiet = { quiet: false, known: false };
            }
          }
          if (!quiet.quiet) continue;
        }
        await this.#runPending(p);
      }
    } finally {
      this.ticking = false;
    }
    return { checked };
  }

  async #runPending(p) {
    const who = { name: p.user, userId: p.userId, role: p.role };
    try {
      const view = await this.engine.preview(p.input, { user: p.user, meta: { mode: "quiet", source: "quiet", userId: p.userId } });
      const level = view.impact.level;
      let overrideNote = null;
      try {
        overrideNote = (await this.#allowanceCheck(level, who, Boolean(p.override), { source: "quiet" })).note;
      } catch (error) {
        if (error.code === "ALLOWANCE") {
          this.engine.previews.delete(view.id);
          await this.#setPending(p.id, { note: "Waiting: the household does not allow this much disturbance right now." });
          return;
        }
        throw error;
      }
      await this.#setPending(p.id, { status: "running", note: "" });
      const runId = this.progress.start({ kind: "quiet", title: this.#title({ items: view.items, meta: { source: "quiet" } }), user: p.user, meta: { impact: level, pendingId: p.id } });
      const record = await this.engine.apply(view.id, { user: p.user, runId, meta: { userId: p.userId, ...(overrideNote ? { override: overrideNote } : p.override ? { override: p.override } : {}) } });
      await this.#setPending(p.id, { status: record.status === "applied" ? "applied" : record.status === "guarded" ? "guarded" : "failed", note: record.note ?? "", runId, historyId: record.id });
    } catch (error) {
      await this.#setPending(p.id, { status: "failed", note: error.message });
    }
  }
}
