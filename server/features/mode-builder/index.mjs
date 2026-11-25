// The mode builder: compose your own mode out of any setting in the catalogue.
//
// A custom mode is a name, an icon and a list of "this setting gets this value"
// items, saved in the app's own state. It never writes to the router by itself:
// the modes feature reads these saved modes and previews, applies and undoes
// them through the change engine exactly like the ready-made ones.
//
// Every item has to be a real setting of this router: it must exist in the
// catalogue, be writable, hold no password or key, and be present in the
// router's own settings list. A mode that contradicts itself (a radio off and a
// guest network on that same radio) is refused with the reason.
import { L } from "../kit.mjs";
import { featureState } from "./state.mjs";

const store = featureState("mode-builder", { modes: [] });
const MAX_MODES = 24;
const MAX_ITEMS = 60;
const NAME_LIMIT = 40;

export const ICONS = ["tv", "nightlight", "star", "favorite", "movie", "sports_esports", "bedtime", "celebration", "work", "lock", "flight_takeoff", "shield", "bolt", "home", "music_note", "school", "family_restroom", "wifi"];

const isSecretEntry = (entry) => entry.secret === true || entry.control === "password";

// The entry as the mode can use it, or the reason it cannot be used.
function usableEntry(entry, ctx) {
  if (!entry) return L("This router does not have that setting.", "呢部路由器冇呢個設定。");
  if (entry.disabled) return entry.disabled;
  if (entry.readOnly) return L("This setting is read only.", "呢個設定淨係可以睇。");
  if (isSecretEntry(entry)) return L("Passwords and keys are never part of a mode.", "密碼同金鑰唔會放入模式。");
  if (!ctx.nvram.has(entry.key)) return L(`This router does not have the setting ${entry.key}`, `呢部路由器冇「${entry.key}」呢個設定`);
  return null;
}

// A quick check of the simple controls. Every other kind is checked in full by the change engine when the mode is previewed.
function badValue(entry, value) {
  const text = String(value);
  switch (entry.control) {
    case "switch":
      return [entry.values?.on, entry.values?.off].includes(text) ? null : "choose on or off.";
    case "select":
    case "segmented":
      return (entry.options ?? []).some(([v]) => v === text) ? null : "choose one of the listed options.";
    case "number":
    case "slider":
    case "stepper": {
      const n = Number(text);
      return Number.isInteger(n) && n >= entry.min && n <= entry.max ? null : `enter a whole number from ${entry.min} to ${entry.max}.`;
    }
    default:
      return text.length > 4096 ? "the value is too long." : null;
  }
}

// Settings that cannot all hold at once.
export function contradictions(items, byId) {
  const values = new Map();
  for (const item of items) {
    const entry = byId.get(item.id);
    if (entry) values.set(entry.key, String(item.value));
  }
  const found = [];
  for (const [key, value] of values) {
    const radio = key.match(/^wl(\d+)_radio$/);
    if (radio && value === "0") {
      for (const [other, otherValue] of values) {
        if (new RegExp(`^wl${radio[1]}\\.\\d+_bss_enabled$`).test(other) && otherValue === "1")
          found.push({ keys: [key, other], en: `It turns radio ${radio[1]} off and also turns on a guest network on that radio. Remove one of the two.`, yue: `佢閂咗無線電 ${radio[1]}，但又要開同一個無線電嘅訪客網絡。兩樣要刪一樣。` });
      }
    }
    if (key === "wps_enable" && value === "0") {
      for (const [other, otherValue] of values)
        if (/^wl\d+_wps_mode$/.test(other) && otherValue === "enabled") found.push({ keys: [key, other], en: "It turns WPS off for the whole router and on for one band. Remove one of the two.", yue: "佢整部路由器閂咗 WPS，但又要開其中一個頻段嘅 WPS。兩樣要刪一樣。" });
    }
    if (key === "qos_enable" && value === "0") {
      for (const other of ["qos_type", "qos_rulelist", "qos_bw_rulelist"])
        if (values.has(other)) found.push({ keys: [key, other], en: "It turns traffic priority off and also sets how traffic priority works. Remove one of the two.", yue: "佢閂咗流量優先，但又要設定流量優先點運作。兩樣要刪一樣。" });
    }
    if (key === "dnspriv_enable" && value === "0") {
      for (const other of ["dnspriv_profile", "dnspriv_rulelist"])
        if (values.has(other)) found.push({ keys: [key, other], en: "It turns encrypted DNS off and also sets its servers. Remove one of the two.", yue: "佢閂咗加密 DNS，但又要設定佢嘅伺服器。兩樣要刪一樣。" });
    }
  }
  return found;
}

function cleanItems(raw, ctx, bad) {
  if (!Array.isArray(raw) || !raw.length) throw bad("A mode needs at least one setting.");
  if (raw.length > MAX_ITEMS) throw bad(`A mode can hold at most ${MAX_ITEMS} settings.`);
  const byId = new Map(ctx.catalog.map((e) => [e.id, e]));
  const seen = new Set();
  const items = raw.map((item) => {
    const id = String(item?.id ?? "");
    const entry = byId.get(id);
    const why = usableEntry(entry, ctx);
    if (why) throw bad(`${id || "A setting"}: ${why.en}`);
    if (seen.has(entry.key)) throw bad(`${entry.label.en} is in the mode twice.`);
    seen.add(entry.key);
    if (typeof item.value !== "string") throw bad(`${entry.label.en}: choose a value.`);
    const problem = badValue(entry, item.value);
    if (problem) throw bad(`${entry.label.en}: ${problem}`);
    return { id, value: item.value };
  });
  const clash = contradictions(items, byId);
  if (clash.length) throw bad(`This mode contradicts itself. ${clash[0].en}`, 409);
  return items;
}

const hueOf = (id) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const newId = () => `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default {
  id: "mode-builder",

  routes(api) {
    api.get("/modes", async () => ({ modes: (await store.read()).modes, icons: ICONS, max: MAX_MODES }));

    // GET /palette : which catalogue settings this router really has, so the picker can disable the rest.
    api.get("/palette", async ({ live }) => {
      const ctx = await live();
      const present = [];
      const refused = {};
      for (const entry of ctx.catalog) {
        const why = usableEntry(entry, ctx);
        if (why) refused[entry.id] = why;
        else present.push(entry.id);
      }
      return { present, refused };
    });

    // POST /check { items } : the same checks as saving, without saving.
    api.post("/check", async ({ body, live, bad }) => {
      const ctx = await live();
      try {
        const items = cleanItems(body.items, ctx, bad);
        return { ok: true, count: items.length, problems: [] };
      } catch (error) {
        return { ok: false, count: 0, problems: [{ en: error.message, yue: error.message }] };
      }
    });

    // POST /modes { id?, name, icon, items } : saves a new mode, or replaces the mode with that id.
    api.post("/modes", async ({ body, live, bad }) => {
      const ctx = await live();
      const name = String(body.name ?? "").trim();
      if (!name) throw bad("Give the mode a name.");
      if (name.length > NAME_LIMIT || /[\x00-\x1f<>]/.test(name)) throw bad(`Use at most ${NAME_LIMIT} characters for the name, without line breaks or < >.`);
      const icon = String(body.icon ?? "bolt");
      if (!ICONS.includes(icon)) throw bad("Choose one of the listed icons.");
      const items = cleanItems(body.items, ctx, bad);
      const existing = body.id === undefined ? null : String(body.id);
      return store.update((s) => {
        if (existing !== null && !s.modes.some((m) => m.id === existing)) throw bad("That mode does not exist.", 404);
        if (existing === null && s.modes.length >= MAX_MODES) throw bad(`You can keep at most ${MAX_MODES} modes of your own. Delete one first.`, 409);
        if (s.modes.some((m) => m.id !== existing && m.name.toLowerCase() === name.toLowerCase())) throw bad("Another mode of yours already has that name.", 409);
        const id = existing ?? newId();
        const mode = { id, name, icon, hue: hueOf(id), items, savedAt: new Date().toISOString() };
        s.modes = existing === null ? [...s.modes, mode] : s.modes.map((m) => (m.id === existing ? mode : m));
        return mode;
      });
    });

    api.delete("/modes/:id", async ({ params, bad }) => {
      return store.update((s) => {
        if (!s.modes.some((m) => m.id === params.id)) throw bad("That mode does not exist.", 404);
        s.modes = s.modes.filter((m) => m.id !== params.id);
        return { ok: true };
      });
    });
  },
};
