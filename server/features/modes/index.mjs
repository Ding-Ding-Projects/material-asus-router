// One-click modes: a mode is a bundle of real router changes (Gaming, Bedtime,
// Guest party, Work from home, Privacy DNS, Lock it down, Away, and any mode
// the owner builds in the mode builder).
//
// Nothing here writes to the router. A mode is turned into catalogue changes
// and handed to the change engine, which previews them (old and new value of
// every setting), applies them under the connection-loss guard when they are
// risky, reads them back, and keeps the undo record. This feature only
// remembers, in the app's own state, which values each mode replaced so the
// whole mode can be undone in one step, and which choices (a console, the kids'
// devices) the person made.
//
// Custom modes are saved by the mode-builder feature in its own state file. This
// folder reads that file (it never writes it), so a custom mode appears here with
// the same preview, apply, undo and "is it on" checks as the seven presets.
import { L } from "../kit.mjs";
import { PRESETS, cleanParams, needsChoice, presetById } from "./presets.mjs";
import { blocker, changesFor, isActive, publicItem, resolveItems, showValue, usable } from "./resolve.mjs";
import { featureState } from "./state.mjs";

const store = featureState("modes", { applied: {}, params: {} });
const customStore = featureState("mode-builder", { modes: [] });
const PENDING_MS = 15 * 60 * 1000;
const pendings = new Map(); // preview id -> what the preview was for

const sweep = () => {
  const now = Date.now();
  for (const [id, p] of pendings) if (p.expiresAt < now) pendings.delete(id);
};

const customName = (mode) => ({ en: mode.name, yue: mode.name });

// What a mode is made of right now, for one preset or one custom mode.
async function describe(source, ctx, saved, bad) {
  if (source.preset) {
    const preset = source.preset;
    let params;
    try {
      params = cleanParams(preset.params, saved.params[preset.id], bad);
    } catch {
      params = cleanParams(preset.params, {}, bad);
    }
    let items = [];
    let error = null;
    try {
      items = resolveItems(preset.items(ctx.info, ctx.nvram, params, bad), ctx);
    } catch (e) {
      error = e.message;
    }
    return { id: preset.id, custom: false, name: preset.name, about: preset.about, icon: preset.icon, hue: preset.hue, schema: preset.params, params, items, error, needsChoice: needsChoice(preset, params) };
  }
  const mode = source.custom;
  const items = resolveItems(mode.items.map((i) => ({ id: i.id, value: i.value })), ctx);
  return { id: mode.id, custom: true, name: customName(mode), about: L("A mode you built.", "你自己砌嘅模式。"), icon: mode.icon, hue: mode.hue ?? 250, schema: [], params: {}, items, error: null, needsChoice: false };
}

const summary = (d, saved) => {
  const applied = saved.applied[d.id] ?? null;
  const active = !d.error && isActive(d.items);
  return {
    id: d.id,
    custom: d.custom,
    name: d.name,
    about: d.about,
    icon: d.icon,
    hue: d.hue,
    schema: d.schema,
    params: d.params,
    items: d.items.map(publicItem),
    active,
    usable: blocker(d.items) ? 0 : usable(d.items).length,
    unavailable: d.items.length - usable(d.items).length,
    blockedBy: blocker(d.items),
    needsChoice: d.needsChoice,
    error: d.error,
    applied: applied ? { at: applied.at, count: Object.keys(applied.before).length } : null,
    canUndo: Boolean(applied),
  };
};

async function sources(bad) {
  const { modes } = await customStore.read();
  return [...PRESETS.map((preset) => ({ preset })), ...modes.map((custom) => ({ custom }))];
}

async function find(id, bad) {
  const preset = presetById(id);
  if (preset) return { preset };
  const custom = (await customStore.read()).modes.find((m) => m.id === id);
  if (!custom) throw bad("That mode does not exist.", 404);
  return { custom };
}

// A mode that was just applied and previewed by this app is remembered even when the browser
// never reports back (the tab closed, the connection dropped): if its values are in place with the
// choices it was previewed with, and no record exists yet, the record from the preview is adopted.
async function adopt(all, ctx, saved, bad) {
  sweep();
  const found = [];
  for (const [previewId, p] of pendings) {
    if (p.action !== "apply" || saved.applied[p.modeId]) continue;
    const source = all.find((x) => (x.preset?.id ?? x.custom.id) === p.modeId);
    if (!source) continue;
    const d = await describe(source, ctx, { ...saved, params: { ...saved.params, [p.modeId]: p.params } }, bad);
    if (!d.error && isActive(d.items)) found.push([previewId, p]);
  }
  if (!found.length) return saved;
  await store.update((s) => {
    for (const [, p] of found) {
      s.applied[p.modeId] = { at: new Date().toISOString(), before: p.before };
      s.params[p.modeId] = p.params;
    }
  });
  for (const [previewId] of found) pendings.delete(previewId);
  return store.read();
}

export default {
  id: "modes",

  routes(api) {
    // GET /list : every mode with its exact items, whether it is on, and what the person chose last time.
    api.get("/list", async ({ live, bad }) => {
      const ctx = await live();
      let saved = await store.read();
      const all = await sources(bad);
      saved = await adopt(all, ctx, saved, bad);
      const described = [];
      for (const source of all) described.push(await describe(source, ctx, saved, bad));
      const modes = described.map((d) => summary(d, saved));
      return { modes, active: modes.filter((m) => m.active).length, bands: ctx.info.bands.length };
    });

    // POST /preview { id, action: "apply" | "undo", params? } : the exact old and new values, from the change engine.
    api.post("/preview", async ({ body, live, preview, bad }) => {
      const ctx = await live();
      const source = await find(String(body.id ?? ""), bad);
      const saved = await store.read();
      const action = body.action === "undo" ? "undo" : body.action === "apply" ? "apply" : null;
      if (!action) throw bad("Say whether to apply or undo the mode.");
      const id = source.preset?.id ?? source.custom.id;
      let changes;
      let params = {};
      let items = [];
      if (action === "apply") {
        if (source.preset) params = cleanParams(source.preset.params, body.params === undefined ? saved.params[id] : body.params, bad);
        const d = await describe(source, ctx, { ...saved, params: { ...saved.params, [id]: params } }, bad);
        if (d.needsChoice) throw bad("Choose the devices first.", 409);
        if (d.error) throw bad(d.error);
        items = d.items;
        const blocked = blocker(items);
        if (blocked) throw bad(`${d.name.en} cannot be used on this router. ${blocked.en}`, 409);
        if (!usable(items).length) throw bad(`Nothing in ${d.name.en} can be set on this router.`, 409);
        changes = changesFor(items);
        if (!changes.length) throw bad(`${d.name.en} is already on.`, 409);
      } else {
        const record = saved.applied[id];
        if (!record) throw bad("This app did not apply that mode, so it does not know the old values. Nothing to undo.", 409);
        const byId = new Map(ctx.catalog.map((e) => [e.id, e]));
        changes = Object.entries(record.before)
          .filter(([entryId, value]) => byId.has(entryId) && ctx.nvram.get(byId.get(entryId).key) !== value)
          .map(([entryId, value]) => ({ id: entryId, value }));
        if (!changes.length) {
          await store.update((s) => void delete s.applied[id]);
          throw bad("The settings already have their old values. The mode is off.", 409);
        }
      }
      const reviewed = await preview({ changes });
      const byId = new Map(ctx.catalog.map((e) => [e.id, e]));
      const override = new Map(items.map((i) => [i.id, i.shownNew]));
      sweep();
      pendings.set(reviewed.id, {
        modeId: id,
        action,
        params,
        before: Object.fromEntries(reviewed.items.filter((i) => i.entryId && !i.secret && i.old !== null).map((i) => [i.entryId, i.old])),
        expiresAt: Date.now() + PENDING_MS,
      });
      const display = reviewed.items.map((i) => {
        const entry = byId.get(i.entryId) ?? null;
        return { key: i.key, entryId: i.entryId, old: showValue(entry, i.old), new: override.get(i.entryId) ?? showValue(entry, i.new) };
      });
      return { preview: reviewed, display, action };
    });

    // POST /confirm { previewId } : after the browser applied a preview, check the router really has the
    // values and only then remember (or forget) the old values. A guard that put everything back records nothing.
    api.post("/confirm", async ({ body, live, bad }) => {
      sweep();
      const pending = pendings.get(String(body.previewId ?? ""));
      if (!pending) throw bad("That preview is not waiting to be confirmed. Preview the mode again.", 404);
      const ctx = await live();
      const source = await find(pending.modeId, bad);
      const saved = await store.read();
      const described = await describe(source, ctx, { ...saved, params: { ...saved.params, [pending.modeId]: pending.params } }, bad);
      if (pending.action === "apply") {
        const on = !described.error && isActive(described.items);
        if (on) {
          await store.update((s) => {
            s.applied[pending.modeId] = { at: new Date().toISOString(), before: pending.before };
            s.params[pending.modeId] = pending.params;
          });
          pendings.delete(String(body.previewId));
        }
        return { active: on, recorded: on };
      }
      const byId = new Map(ctx.catalog.map((e) => [e.id, e]));
      const record = saved.applied[pending.modeId];
      const restored = record && Object.entries(record.before).every(([entryId, value]) => !byId.has(entryId) || ctx.nvram.get(byId.get(entryId).key) === value);
      if (restored) {
        await store.update((s) => void delete s.applied[pending.modeId]);
        pendings.delete(String(body.previewId));
      }
      return { active: !described.error && isActive(described.items), recorded: Boolean(restored) };
    });

    // POST /params/:id { params } : remembers a choice (the console, the kids' devices) without applying anything.
    api.post("/params/:id", async ({ params, body, bad }) => {
      const preset = presetById(params.id);
      if (!preset) throw bad("Only the ready-made modes have choices.", 404);
      const clean = cleanParams(preset.params, body.params, bad);
      await store.update((s) => void (s.params[preset.id] = clean));
      return { params: clean };
    });
  },
};
