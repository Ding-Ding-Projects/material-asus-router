// Settings snapshots: save the router's settings under a name, compare two
// snapshots (or a snapshot and the router right now) with friendly labels, and
// put chosen settings back through the change engine, so a restore gets the
// same preview, safety net and undo as any other edit.
//
// Snapshots are kept in the app's own state (the data folder), never on the
// router. They hold the settings the app knows by name. Secrets (passwords and
// keys) are never copied into a snapshot, so a restore never touches them.
import { featureState } from "./state.mjs";

const store = featureState("settings-snapshots", { snapshots: [], settings: { autoBeforeRestore: true, keep: 30 } });
const NAME_LIMIT = 60;
const NOTE_LIMIT = 200;

const isSecretEntry = (entry) => entry.secret === true || entry.control === "password";
// Settings a snapshot can hold and a restore can write back.
const storable = (entry) => !entry.disabled && !isSecretEntry(entry);
const writable = (entry) => storable(entry) && !entry.readOnly;

const clean = (value, limit, label, { required = false } = {}) => {
  const text = String(value ?? "").trim();
  if (required && !text) throw Object.assign(new Error(`${label} is required.`), { status: 400 });
  if (text.length > limit || /[\x00-\x1f<>]/.test(text)) throw Object.assign(new Error(`${label}: use at most ${limit} characters, without line breaks or < >.`), { status: 400 });
  return text;
};

export function capture(ctx) {
  const values = {};
  let skippedSecrets = 0;
  for (const entry of ctx.catalog) {
    if (entry.disabled) continue;
    if (isSecretEntry(entry)) {
      skippedSecrets += 1;
      continue;
    }
    const value = ctx.nvram.get(entry.key);
    if (value !== undefined) values[entry.id] = value;
  }
  return { values, skippedSecrets };
}

const meta = (s) => ({ id: s.id, name: s.name, note: s.note, at: s.at, count: Object.keys(s.values).length, skippedSecrets: s.skippedSecrets, model: s.model, auto: Boolean(s.auto) });

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function save(ctx, { name, note, auto = false }) {
  const { values, skippedSecrets } = capture(ctx);
  const snapshot = { id: newId(), name, note, at: new Date().toISOString(), model: ctx.info.model, values, skippedSecrets, auto };
  await store.update((s) => {
    s.snapshots.push(snapshot);
    // Keep the newest ones; a manual snapshot is dropped only after every automatic one.
    while (s.snapshots.length > s.settings.keep) {
      const index = s.snapshots.findIndex((x) => x.auto);
      s.snapshots.splice(index === -1 ? 0 : index, 1);
    }
  });
  return snapshot;
}

// What differs between two value maps, with the entry's friendly label.
export function diff(catalog, a, b) {
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const ids = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const rows = [];
  for (const id of ids) {
    if (a[id] === b[id]) continue;
    const entry = byId.get(id);
    rows.push({
      id,
      label: entry?.label ?? { en: id, yue: id },
      group: entry?.groupLabel ?? { en: "Other", yue: "其他" },
      key: entry?.key ?? id,
      a: a[id] ?? null,
      b: b[id] ?? null,
      // A setting that is not known to this router any more cannot be written back.
      restorable: Boolean(entry && writable(entry)) && a[id] !== undefined,
    });
  }
  return rows.sort((x, y) => tt(x.group).localeCompare(tt(y.group)) || tt(x.label).localeCompare(tt(y.label)));
}
const tt = (pair) => pair?.en ?? "";

async function find(id, bad) {
  const snapshot = (await store.read()).snapshots.find((s) => s.id === id);
  if (!snapshot) throw bad("That snapshot does not exist.", 404);
  return snapshot;
}

export default {
  id: "settings-snapshots",

  routes(api) {
    api.get("/snapshots", async () => {
      const { snapshots, settings } = await store.read();
      return { snapshots: snapshots.map(meta).reverse(), settings };
    });
    api.post("/snapshots", async ({ live, body }) => {
      const ctx = await live();
      const snapshot = await save(ctx, { name: clean(body.name, NAME_LIMIT, "Name", { required: true }), note: clean(body.note, NOTE_LIMIT, "Note") });
      return meta(snapshot);
    });
    api.delete("/snapshots/:id", async ({ params, bad }) => {
      await find(params.id, bad);
      await store.update((s) => void (s.snapshots = s.snapshots.filter((x) => x.id !== params.id)));
      return { ok: true };
    });

    // GET /diff?a=<id>&b=<id|current> : the settings that differ, A being the older side.
    api.get("/diff", async ({ live, query, bad }) => {
      const ctx = await live();
      const left = await find(String(query.a ?? ""), bad);
      const right = query.b === undefined || query.b === "current" ? { id: "current", name: "Right now", at: new Date().toISOString(), values: capture(ctx).values } : await find(String(query.b), bad);
      const rows = diff(ctx.catalog, left.values, right.values);
      return { a: meta({ ...left, skippedSecrets: left.skippedSecrets }), b: right.id === "current" ? { id: "current", name: right.name, at: right.at } : meta(right), rows, same: rows.length === 0 };
    });

    // POST /restore { from, ids } : checks that every chosen setting can go back, saves a safety copy
    // of the router as it is now (unless switched off) and returns the changes to review and apply.
    api.post("/restore", async ({ live, body, preview, bad }) => {
      const ctx = await live();
      const snapshot = await find(String(body.from ?? ""), bad);
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      if (!ids.length || ids.length > 200) throw bad("Choose between 1 and 200 settings to put back.");
      const byId = new Map(ctx.catalog.map((e) => [e.id, e]));
      const changes = [];
      const skipped = [];
      for (const id of ids) {
        const entry = byId.get(id);
        if (!entry) skipped.push({ id, reason: "This router does not have that setting." });
        else if (!writable(entry)) skipped.push({ id, reason: entry.disabled ? "This router does not support it." : "This setting cannot be changed from here." });
        else if (snapshot.values[id] === undefined) skipped.push({ id, reason: "The snapshot does not contain it." });
        else if (ctx.nvram.get(entry.key) === snapshot.values[id]) skipped.push({ id, reason: "It already has that value." });
        else changes.push({ id, value: snapshot.values[id] });
      }
      if (!changes.length) throw bad("Nothing to put back: " + (skipped[0]?.reason ?? "no changes."), 409);
      // The change engine validates every value now, so a bad value is reported before anything is saved.
      const reviewed = await preview({ changes });
      const settings = (await store.read()).settings;
      const safety = settings.autoBeforeRestore ? meta(await save(ctx, { name: `Before restoring "${snapshot.name}"`, note: "Saved automatically before a restore.", auto: true })) : null;
      return { changes, skipped, items: reviewed.items, safetySnapshot: safety };
    });

    api.get("/settings", async () => (await store.read()).settings);
    api.put("/settings", async ({ body, bad }) => {
      const keep = Number(body.keep);
      if (typeof body.autoBeforeRestore !== "boolean" || !Number.isInteger(keep) || keep < 5 || keep > 100) throw bad("Choose whether to save a safety copy, and keep between 5 and 100 snapshots.");
      await store.update((s) => void (s.settings = { autoBeforeRestore: body.autoBeforeRestore, keep }));
      return { autoBeforeRestore: body.autoBeforeRestore, keep };
    });
  },
};

