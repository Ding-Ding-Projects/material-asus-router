// The app's own appearance settings. They are not router settings, so they are
// kept by this app in the browser (localStorage), survive restarts, and are
// checked and cleaned every time they are read, written or imported. Nothing
// here touches the router and nothing leaves the machine.
import { DEFAULT_MOTION, sanitizeMotion } from "./motion-engine.js";
import { parseColor } from "./color.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);

export const THEMES = ["auto", "light", "dark"];
export const DENSITIES = ["compact", "comfortable", "spacious"];
export const FONTS = ["default", "system", "serif", "mono"];
export const DEFAULT_ACCENT = "#4f5bd5";
// A fixed palette of seed colours. "rainbow" is deliberately NOT in this list:
// it is a sentinel (an animated hue), never a stored palette colour.
export const PALETTE = ["#4f5bd5", "#0b6bcb", "#00796b", "#2e7d32", "#9a6700", "#c2410c", "#b3261e", "#a8196a", "#6750a4", "#475569"];
export const RAINBOW = "rainbow";
export const RAINBOW_SETTLED_HUE = 265;

export const DEFAULTS = Object.freeze({
  theme: "auto",
  accent: DEFAULT_ACCENT,
  dynamic: false,
  shape: 1,
  density: "comfortable",
  font: "default",
  textSize: 100,
  contrast: "standard",
  focus: "standard",
  largeTargets: false,
  a11yMenu: true,
  motion: DEFAULT_MOTION,
  panels: {},
  collapsed: {},
});

const id = /^[a-z][a-z0-9.-]{0,63}$/;

export function sanitizePrefs(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const accent = r.accent === RAINBOW ? RAINBOW : (() => { const p = parseColor(r.accent); return p.ok ? `#${[p.color.r, p.color.g, p.color.b].map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0")).join("")}` : DEFAULT_ACCENT; })();
  const panels = {};
  for (const [key, v] of Object.entries(r.panels && typeof r.panels === "object" ? r.panels : {})) {
    if (!id.test(key) || !v || typeof v !== "object") continue;
    const n = (x, lo, hi) => (Number.isFinite(Number(x)) ? clamp(Math.round(Number(x)), lo, hi) : null);
    const rect = { x: n(v.x, -2000, 20000), y: n(v.y, -2000, 20000), w: n(v.w, 200, 4000), h: n(v.h, 120, 4000) };
    if (Object.values(rect).every((x) => x !== null)) panels[key] = rect;
  }
  const collapsed = {};
  for (const [key, v] of Object.entries(r.collapsed && typeof r.collapsed === "object" ? r.collapsed : {})) if (id.test(key) && typeof v === "boolean") collapsed[key] = v;
  return {
    theme: pick(r.theme, THEMES, DEFAULTS.theme),
    accent,
    dynamic: r.dynamic === true,
    shape: Number.isFinite(Number(r.shape)) ? clamp(Number(Number(r.shape).toFixed(2)), 0, 2) : 1,
    density: pick(r.density, DENSITIES, DEFAULTS.density),
    font: pick(r.font, FONTS, DEFAULTS.font),
    textSize: Number.isFinite(Number(r.textSize)) ? clamp(Math.round(Number(r.textSize)), 80, 160) : 100,
    contrast: pick(r.contrast, ["standard", "high"], "standard"),
    focus: pick(r.focus, ["standard", "thick"], "standard"),
    largeTargets: r.largeTargets === true,
    a11yMenu: r.a11yMenu !== false,
    motion: sanitizeMotion(r.motion),
    panels,
    collapsed,
  };
}

// A small JSON store over any storage with getItem/setItem/removeItem. It never
// throws: a blocked or full storage just means the value is not remembered.
export function createJsonStore(storage, key, sanitize, fallback) {
  const listeners = new Set();
  let value = null;
  const load = () => {
    try {
      const text = storage?.getItem(key);
      return sanitize(text ? JSON.parse(text) : fallback());
    } catch {
      return sanitize(fallback());
    }
  };
  const save = () => {
    try { storage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  };
  const store = {
    key,
    get() { return (value ??= load()); },
    // update(draft => { ... }) changes a copy, cleans it, saves it and tells listeners.
    update(fn) {
      const draft = structuredClone(store.get());
      const result = fn(draft);
      // Only an object counts as a replacement; a function that returns true or false just edited the draft.
      value = sanitize(result !== null && typeof result === "object" ? result : draft);
      const saved = save();
      for (const l of [...listeners]) l(value);
      return saved;
    },
    replace(next) { return store.update(() => next); },
    reset() { try { storage?.removeItem(key); } catch {} value = sanitize(fallback()); for (const l of [...listeners]) l(value); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    reload() { value = null; return store.get(); },
  };
  return store;
}

export const safeStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
export const createPrefs = (storage = safeStorage()) => createJsonStore(storage, "mar.appearance.v1", sanitizePrefs, () => ({}));
// The one the running app uses.
export const prefs = createPrefs();

export function exportPrefs(p = prefs.get()) {
  return JSON.stringify({ kind: "material-asus-router-appearance", version: 1, prefs: p }, null, 2);
}
export function importPrefs(text) {
  if (typeof text !== "string" || text.length > 200000) return { ok: false, error: "That file is too large to be an appearance file." };
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: "That is not valid JSON." }; }
  if (data?.kind !== "material-asus-router-appearance" || data.version !== 1 || typeof data.prefs !== "object") return { ok: false, error: "That file is not an appearance file from this app." };
  return { ok: true, prefs: sanitizePrefs(data.prefs) };
}
