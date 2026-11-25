// The voice feature's local record. Everything the person chooses here (tone,
// sounds, narration, schedule, name, comfort modes, School mode) lives in this
// browser's storage under a few keys, so it survives restarts and reloads and is
// shared by every tab of the app. Nothing here is sent to the server, and the
// personal wording and access tokens are kept under their own keys so they can
// never leak into an export or the history.
//
// The module imports nothing and touches no browser global at load time, so the
// same file is exercised from Node tests with a fake storage.

export const KEYS = Object.freeze({
  record: "mar.voice.v1",
  vocab: "mar.voice.vocab.v1",
  history: "mar.voice.history.v1",
  secrets: "mar.voice.secrets.v1",
});
export const HISTORY_LIMIT = 1000;

const HEX = /^#[0-9a-fA-F]{6}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const clampInt = (v, min, max, fallback) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : fallback);
const clampNum = (v, min, max, fallback) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
const text = (v, max, fallback = "") => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : fallback);

export const DEFAULT_SCHOOL_LABEL = "School mode";
export const SHIPPED_NAME = "Material Asus Router";

export function defaults() {
  return {
    v: 1,
    tone: { en: 5, yue: 5, emoji: false, disclosed: false },
    sound: { on: true, volume: 60, muted: false, reduced: false, quiet: { on: false, from: "22:00", to: "07:00" } },
    narration: { on: false, rate: 1, pitch: 1, voices: { en: null, yue: null }, screenReader: false },
    look: { density: "comfortable", font: "default", accent: "", motion: "full" },
    schedule: { rules: [], api: { url: "", refreshMinutes: 15 }, ha: { url: "", entity: "", refreshMinutes: 5 } },
    base: null,
    name: "",
    adhd: { focus: false, low: false, time: false, one: false, momentum: false },
    school: { on: false, label: DEFAULT_SCHOOL_LABEL, lock: null, prevLang: null },
    dimsum: { allow: true, launches: 0 },
  };
}

const voicePref = (v) => (v && typeof v === "object" ? { uri: text(v.uri, 300), name: text(v.name, 200), lang: text(v.lang, 40) } : null);
const lockOf = (v) =>
  v && typeof v === "object" && ["pin", "password"].includes(v.kind) && typeof v.salt === "string" && typeof v.hash === "string" && Number.isInteger(v.iter)
    ? { kind: v.kind, salt: v.salt.slice(0, 64), hash: v.hash.slice(0, 128), iter: clampInt(v.iter, 1000, 2000000, 150000) }
    : null;

// Turns whatever was stored into a complete, valid record. Unknown fields are
// dropped and every value is clamped, so a damaged or edited record can never
// put the app into an impossible state.
export function sanitize(raw) {
  const d = defaults();
  const r = raw && typeof raw === "object" ? raw : {};
  const t = r.tone ?? {};
  const s = r.sound ?? {};
  const n = r.narration ?? {};
  const l = r.look ?? {};
  const a = r.adhd ?? {};
  const sc = r.school ?? {};
  const sch = r.schedule ?? {};
  return {
    v: 1,
    tone: { en: clampInt(t.en, 1, 5, d.tone.en), yue: clampInt(t.yue, 1, 5, d.tone.yue), emoji: bool(t.emoji, false), disclosed: bool(t.disclosed, false) },
    sound: {
      on: bool(s.on, true),
      volume: clampInt(s.volume, 0, 100, 60),
      muted: bool(s.muted, false),
      reduced: bool(s.reduced, false),
      quiet: { on: bool(s.quiet?.on, false), from: TIME.test(s.quiet?.from) ? s.quiet.from : "22:00", to: TIME.test(s.quiet?.to) ? s.quiet.to : "07:00" },
    },
    narration: {
      on: bool(n.on, false),
      rate: clampNum(n.rate, 0.5, 2, 1),
      pitch: clampNum(n.pitch, 0, 2, 1),
      voices: { en: voicePref(n.voices?.en), yue: voicePref(n.voices?.yue) },
      screenReader: bool(n.screenReader, false),
    },
    look: {
      density: oneOf(l.density, ["comfortable", "compact"], "comfortable"),
      font: oneOf(l.font, ["default", "large", "system"], "default"),
      accent: HEX.test(l.accent) ? l.accent.toLowerCase() : "",
      motion: oneOf(l.motion, ["full", "reduced"], "full"),
    },
    schedule: {
      rules: Array.isArray(sch.rules) ? sch.rules.filter((x) => x && typeof x === "object" && typeof x.id === "string").slice(0, 40) : [],
      api: { url: text(sch.api?.url, 400), refreshMinutes: clampInt(sch.api?.refreshMinutes, 5, 1440, 15) },
      ha: { url: text(sch.ha?.url, 400), entity: text(sch.ha?.entity, 120), refreshMinutes: clampInt(sch.ha?.refreshMinutes, 1, 1440, 5) },
    },
    base: r.base && typeof r.base === "object" ? r.base : null,
    name: text(r.name, 60),
    adhd: { focus: bool(a.focus, false), low: bool(a.low, false), time: bool(a.time, false), one: bool(a.one, false), momentum: bool(a.momentum, false) },
    school: { on: bool(sc.on, false), label: text(sc.label, 40) || DEFAULT_SCHOOL_LABEL, lock: lockOf(sc.lock), prevLang: oneOf(sc.prevLang, ["en", "yue", "both"], null) },
    dimsum: { allow: true, launches: clampInt(r.dimsum?.launches, 0, 1000000, 0) },
  };
}

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// A storage that never throws and falls back to memory when the browser
// refuses (private windows, blocked storage, full disk).
function safeStorage(storage) {
  const memory = new Map();
  let broken = !storage;
  return {
    get memoryOnly() {
      return broken;
    },
    read(key) {
      if (!broken) {
        try {
          return storage.getItem(key);
        } catch {
          broken = true;
        }
      }
      return memory.get(key) ?? null;
    },
    write(key, value) {
      memory.set(key, value);
      if (broken) return false;
      try {
        storage.setItem(key, value);
        return true;
      } catch {
        broken = true;
        return false;
      }
    },
    remove(key) {
      memory.delete(key);
      try {
        storage?.removeItem(key);
      } catch {}
    },
  };
}

export function createStore({ storage = browserStorage(), now = () => new Date() } = {}) {
  const disk = safeStorage(storage);
  const listeners = new Set();
  let state = defaults();
  let readable = true;
  let problem = "";

  function load() {
    const raw = disk.read(KEYS.record);
    if (raw === null) {
      state = defaults();
      readable = true;
      problem = "";
      return state;
    }
    try {
      state = sanitize(JSON.parse(raw));
      readable = true;
      problem = "";
    } catch {
      state = defaults();
      readable = false;
      problem = "The saved record could not be read.";
    }
    return state;
  }
  load();

  const emit = (why) => listeners.forEach((fn) => fn(state, why));

  const api = {
    get: () => state,
    // true while the saved record is damaged and the defaults are being shown.
    get readable() {
      return readable;
    },
    get problem() {
      return problem;
    },
    get persistent() {
      return !disk.memoryOnly;
    },
    // update((draft) => { draft.tone.en = 3 }) clamps and saves the result.
    update(fn, why = "update") {
      const draft = structuredClone(state);
      fn(draft);
      state = sanitize(draft);
      readable = true;
      problem = "";
      disk.write(KEYS.record, JSON.stringify(state));
      emit(why);
      return state;
    },
    reload(why = "reload") {
      load();
      emit(why);
      return state;
    },
    reset(why = "reset") {
      disk.remove(KEYS.record);
      load();
      emit(why);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    // ---- append-only history ----
    // Entries are never edited or removed one by one; only the oldest fall off
    // once the limit is passed. Entries hold facts about a change, never the
    // personal wording, a token or a PIN.
    history() {
      try {
        const list = JSON.parse(disk.read(KEYS.history) ?? "[]");
        return Array.isArray(list) ? list.filter((e) => e && typeof e.kind === "string" && typeof e.at === "string") : [];
      } catch {
        return [];
      }
    },
    append(kind, data = {}) {
      const list = api.history();
      const entry = { at: now().toISOString(), kind: text(kind, 60), data: safeData(data) };
      list.push(entry);
      disk.write(KEYS.history, JSON.stringify(list.slice(-HISTORY_LIMIT)));
      listeners.forEach((fn) => fn(state, "history"));
      return entry;
    },

    // ---- personal wording (its own key, never in history or exports) ----
    vocabulary: {
      read: () => disk.read(KEYS.vocab),
      write: (value) => disk.write(KEYS.vocab, value),
      clear: () => disk.remove(KEYS.vocab),
    },

    // ---- access tokens for schedule sources (never in history or exports) ----
    secrets: {
      read() {
        try {
          const v = JSON.parse(disk.read(KEYS.secrets) ?? "{}");
          return { api: text(v.api, 2048), ha: text(v.ha, 2048) };
        } catch {
          return { api: "", ha: "" };
        }
      },
      write(patch) {
        const next = { ...api.secrets.read(), ...patch };
        disk.write(KEYS.secrets, JSON.stringify(next));
      },
      clear: () => disk.remove(KEYS.secrets),
    },

    // What an export may contain: the record without the School lock hash or any token.
    exportable() {
      const copy = structuredClone(state);
      if (copy.school.lock) copy.school.lock = { kind: copy.school.lock.kind };
      return { format: "material-asus-router-voice", version: 1, record: copy };
    },
    keysOwned: () => Object.values(KEYS),
  };
  return api;
}

// History data may hold only short plain values.
function safeData(data) {
  const out = {};
  for (const [k, v] of Object.entries(data ?? {}).slice(0, 12)) {
    if (/token|secret|pin|password|hash|salt/i.test(k)) continue;
    out[k.slice(0, 40)] = typeof v === "string" ? v.slice(0, 120) : typeof v === "number" || typeof v === "boolean" || v === null ? v : String(v).slice(0, 120);
  }
  return out;
}
