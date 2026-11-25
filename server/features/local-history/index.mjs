// Local version history of the app's own settings and records. Every change
// the app makes to its saved state is recorded as a new revision in an isolated
// append-only file (history/revisions.jsonl) beside the app data, never a .git
// folder inside anything the person owns. A restore is a new revision, never a
// rewrite. History trouble never fails the operation that caused it.
//
// What is recorded: settings and feature state (restorable), the account
// roster, the router connection and a fingerprint of the credentials (shown in
// diffs, never restorable and never stored as secrets). The encrypted vault is
// represented only by its fingerprint, so ciphertext stays ciphertext.
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const ID = "local-history";
const SECRETISH = /secret|password|passwd|hash|salt|token|private|psk|\bkey\b/i;
const MAX_LIST = 2000;
const hooks = new WeakMap(); // app -> { raw, last, queue }

const dirOf = (app) => path.join(app.store.dir, "history");
const fileOf = (app) => path.join(dirOf(app), "revisions.jsonl");
const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);

export function snapshotOf(state, vault) {
  const features = { ...(state.features ?? {}) };
  delete features[ID];
  return {
    settings: state.settings ?? {},
    features,
    accounts: [state.owner ? { id: state.owner.id, username: state.owner.username, name: state.owner.name, role: "owner" } : null, ...(state.users ?? []).map((u) => ({ id: u.id, username: u.username, name: u.name, role: u.role }))].filter(Boolean),
    router: state.router ? { host: state.router.host, port: state.router.port, username: state.router.username, authType: state.router.authType, hostKey: state.router.hostKey } : null,
    credentials: sha(JSON.stringify([state.owner?.hash, ...(state.users ?? []).map((u) => u.hash)])),
    vault: vault ? sha(JSON.stringify(Object.keys(vault.entries ?? {}).sort().map((k) => [k, vault.entries[k].tag]))) : null,
  };
}

function flatten(value, prefix = "", out = {}) {
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length && prefix) out[prefix] = Array.isArray(value) ? "[]" : "{}";
    for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else out[prefix] = value;
  return out;
}
const mask = (path, value) => (SECRETISH.test(path.split(".").at(-1)) && value !== "" && value !== null ? "(hidden)" : value);

export function diffSnapshots(a, b) {
  const x = flatten(a);
  const y = flatten(b);
  const out = [];
  for (const key of new Set([...Object.keys(x), ...Object.keys(y)]).values()) {
    if (JSON.stringify(x[key]) !== JSON.stringify(y[key])) out.push({ path: key, before: key in x ? mask(key, x[key]) : undefined, after: key in y ? mask(key, y[key]) : undefined });
  }
  // An empty container that gained or lost entries is already described by those entries.
  return out.filter((d) => !out.some((o) => o.path.startsWith(`${d.path}.`))).sort((p, q) => p.path.localeCompare(q.path));
}

// Which kind of change happened, derived from what differs.
function actionOf(diff) {
  const tops = new Set(diff.map((d) => d.path.split(".")[0]));
  if (tops.has("credentials")) return "credential-change";
  if (tops.has("accounts")) return diff.some((d) => /\.name$/.test(d.path)) && !diff.some((d) => /\.(role|username)$/.test(d.path)) ? "display-name-change" : "account-change";
  if (tops.has("router")) return "router-connection";
  if (tops.has("vault")) return "vault-change";
  if (tops.has("features")) return "feature-state";
  if (tops.has("settings")) return "settings";
  return "change";
}

async function readAll(app) {
  let text = "";
  try {
    text = await readFile(fileOf(app), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const revisions = [];
  let damaged = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      revisions.push(JSON.parse(line));
    } catch {
      damaged++; // a half-written last line from an interrupted write is skipped
    }
  }
  return { revisions, damaged, endsClean: text === "" || text.endsWith("\n") };
}

// Everything that writes runs through one queue, so revisions stay in order.
function enqueue(app, job) {
  const hook = hooks.get(app);
  const run = hook.queue.then(job);
  hook.queue = run.catch(() => {});
  return run.catch(() => null);
}

async function append(app, record) {
  const hook = hooks.get(app);
  await mkdir(dirOf(app), { recursive: true });
  const { revisions, endsClean } = await readAll(app);
  const rev = (revisions.at(-1)?.rev ?? 0) + 1;
  const full = { rev, parent: revisions.at(-1)?.rev ?? null, at: new Date().toISOString(), ...record };
  await appendFile(fileOf(app), `${endsClean ? "" : "\n"}${JSON.stringify(full)}\n`, { mode: 0o600 });
  hook.last = JSON.stringify(full.snapshot);
  return full;
}

// Records the present state when it differs from the last revision. Never throws.
const record = (app, extra = {}) => enqueue(app, () => recordNow(app, extra));
async function recordNow(app, extra = {}) {
  try {
    const hook = hooks.get(app);
    const snapshot = snapshotOf(app.store.read(), app.vault);
    const text = JSON.stringify(snapshot);
    if (text === hook.last && !extra.force) return null;
    let before = null;
    if (hook.last) before = JSON.parse(hook.last);
    const diff = before ? diffSnapshots(before, snapshot) : [];
    return await append(app, { kind: extra.kind ?? (before ? "change" : "baseline"), action: extra.action ?? (before ? actionOf(diff) : "baseline"), user: extra.user ?? null, label: extra.label ?? "", restoredFrom: extra.restoredFrom ?? null, changed: diff.slice(0, 40).map((d) => d.path), snapshot });
  } catch {
    return null;
  }
}

async function install(app) {
  if (hooks.has(app)) return hooks.get(app);
  const hook = { raw: app.store.update.bind(app.store), last: null, queue: Promise.resolve() };
  hooks.set(app, hook);
  const { revisions } = await readAll(app);
  hook.last = revisions.length ? JSON.stringify(revisions.at(-1).snapshot) : null;
  app.store.update = async (fn) => {
    const result = await hook.raw(fn);
    record(app);
    return result;
  };
  await record(app);
  return hook;
}

const strip = (r) => ({ rev: r.rev, parent: r.parent, at: r.at, kind: r.kind, action: r.action, user: r.user, label: r.label, restoredFrom: r.restoredFrom, changed: r.changed ?? [] });
const useToken = (app, token, action, userId) => {
  const rec = app.superTokens?.get(String(token ?? ""));
  if (!rec || rec.exp < Date.now() || rec.action !== action || rec.userId !== userId) return false;
  app.superTokens.delete(String(token));
  return true;
};
const dateStart = (text) => (/^\d{4}-\d{2}-\d{2}$/.test(text ?? "") ? `${text}T00:00:00.000Z` : null);
const dateEnd = (text) => (/^\d{4}-\d{2}-\d{2}$/.test(text ?? "") ? `${text}T23:59:59.999Z` : null);

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.get("/status", async ({ app }) => {
      await install(app);
      await hooks.get(app).queue;
      const { revisions, damaged } = await readAll(app);
      return { count: revisions.length, first: revisions[0]?.at ?? null, last: revisions.at(-1)?.at ?? null, damagedLines: damaged, folder: dirOf(app), restorable: ["settings"], recordedOnly: ["feature state", "accounts", "router connection", "credential fingerprint", "vault fingerprint"], gitFolderUsed: false };
    });

    api.get("/revisions", async ({ app, query }) => {
      await install(app);
      await hooks.get(app).queue;
      const { revisions } = await readAll(app);
      const from = dateStart(query.from);
      const to = dateEnd(query.to);
      const inRange = revisions.filter((r) => (!from || r.at >= from) && (!to || r.at <= to));
      const counts = {};
      for (const r of inRange) counts[r.action] = (counts[r.action] ?? 0) + 1;
      const wanted = query.action ? String(query.action).split(",") : null;
      const rows = inRange.filter((r) => !wanted || wanted.includes(r.action)).reverse();
      return { revisions: rows.slice(0, MAX_LIST).map(strip), total: revisions.length, matching: rows.length, counts, truncated: rows.length > MAX_LIST };
    });

    api.get("/revisions/:rev", async ({ app, params, bad }) => {
      await install(app);
      const { revisions } = await readAll(app);
      const r = revisions.find((x) => x.rev === Number(params.rev));
      if (!r) throw bad("That revision does not exist.", 404);
      const parent = revisions.find((x) => x.rev === r.parent);
      return { ...strip(r), diff: parent ? diffSnapshots(parent.snapshot, r.snapshot) : [], snapshot: Object.fromEntries(Object.entries(flatten(r.snapshot)).map(([k, v]) => [k, mask(k, v)])) };
    });

    api.get("/diff", async ({ app, query, bad }) => {
      await install(app);
      const { revisions } = await readAll(app);
      const a = revisions.find((x) => x.rev === Number(query.a));
      const b = revisions.find((x) => x.rev === Number(query.b));
      if (!a || !b) throw bad("Pick two revisions that exist.", 404);
      return { a: a.rev, b: b.rev, diff: diffSnapshots(a.snapshot, b.snapshot) };
    });

    // A restore writes the old settings back and records one NEW revision. Nothing is rewritten.
    api.post("/restore", async ({ app, who, body, bad }) => {
      if (who.role !== "owner") throw bad("Only the owner can restore a version.", 403);
      const hook = await install(app);
      const { revisions } = await readAll(app);
      const target = revisions.find((x) => x.rev === Number(body.rev));
      if (!target) throw bad("That revision does not exist.", 404);
      await hook.raw((s) => void (s.settings = structuredClone(target.snapshot.settings ?? {})));
      const made = await record(app, { kind: "restore", action: "restore", user: who.name, restoredFrom: target.rev, label: `Restored revision ${target.rev}`, force: true });
      return { restored: target.rev, revision: made ? strip(made) : null, note: "App settings were restored. Feature state, accounts, the router connection and credentials are recorded for comparison but are never changed by a restore, because they point at the encrypted vault." };
    });

    api.post("/label", async ({ app, who, body, bad }) => {
      const hook = await install(app);
      const { revisions } = await readAll(app);
      const target = revisions.find((x) => x.rev === Number(body.rev));
      if (!target) throw bad("That revision does not exist.", 404);
      const text = String(body.label ?? "").trim().slice(0, 80);
      if (!text) throw bad("Write a short label.");
      const made = await enqueue(app, async () => {
        const out = await append(app, { kind: "label", action: "label", user: who.name, label: text, restoredFrom: null, labels: target.rev, changed: [], snapshot: JSON.parse(hook.last ?? JSON.stringify(target.snapshot)) });
        return out;
      });
      return strip(made);
    });

    // Prune keeps the newest revisions and the baseline. It needs the two-key confirmation.
    api.post("/prune", async ({ app, who, body, bad }) => {
      if (who.role !== "owner") throw bad("Only the owner can prune history.", 403);
      const keep = Number(body.keep);
      if (!Number.isInteger(keep) || keep < 10 || keep > 5000) throw bad("Keep between 10 and 5000 revisions.");
      if (!useToken(app, body.token, "local-history.prune", who.userId)) throw bad("Pruning history needs the two-key confirmation.", 403, { code: "NEEDS_SUPER" });
      const hook = await install(app);
      await hook.queue;
      const { revisions } = await readAll(app);
      if (revisions.length <= keep) return { removed: 0, kept: revisions.length };
      const kept = [revisions[0], ...revisions.slice(-(keep - 1))];
      const removed = revisions.length - kept.length;
      const tmp = `${fileOf(app)}.tmp`;
      await writeFile(tmp, `${kept.map((r) => JSON.stringify(r)).join("\n")}\n`, { mode: 0o600 });
      await rename(tmp, fileOf(app));
      return { removed, kept: kept.length };
    });

    api.get("/export", async ({ app, query, bad }) => {
      await install(app);
      const { revisions } = await readAll(app);
      const format = query.format ?? "json";
      if (!["json", "jsonl"].includes(format)) throw bad("Choose json or jsonl.");
      const items = revisions.map((r) => ({ ...strip(r), snapshot: Object.fromEntries(Object.entries(flatten(r.snapshot)).map(([k, v]) => [k, mask(k, v)])) }));
      if (format === "jsonl") return { format, encoding: "UTF-8", lineEndings: "LF", text: items.map((i) => JSON.stringify(i)).join("\n") };
      return { format: "material-asus-router-history", version: 1, encoding: "UTF-8", secretsIncluded: false, revisions: items };
    });
  },
};
