// Turns the saved appearance settings into what the page shows: custom
// properties and data attributes on <html>, read by material-design/style.css.
// Everything uses CSSOM (style.setProperty), so the strict CSP stays happy.
import { prefs, RAINBOW, RAINBOW_SETTLED_HUE } from "./prefs.js";
import { cssVars, resolveMotion } from "./motion-engine.js";

const FONT_STACKS = {
  system: "system-ui,-apple-system,'Segoe UI','Noto Sans HK','PingFang HK','Microsoft JhengHei',sans-serif",
  serif: "Georgia,'Noto Serif HK','PMingLiU',serif",
  mono: "ui-monospace,'Cascadia Code',Consolas,'Noto Sans Mono CJK HK',monospace",
};

let dynamicSeed = null;
let rainbowTimer = null;
let started = false;
let media = null;
const listeners = new Set();

const root = () => (typeof document === "undefined" ? null : document.documentElement);
const systemReduced = () => {
  try { return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches); } catch { return false; }
};

// What the page is doing about motion right now.
export const motionState = () => resolveMotion(prefs.get().motion, systemReduced());
export const reducedNow = () => motionState().reduced;
export const onAppearanceChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

// The logo feature tells us the colour of the current custom logo; "Dynamic colour" follows it.
export const hasDynamicSeed = () => dynamicSeed !== null;
export function setDynamicSeed(hex) {
  dynamicSeed = hex || null;
  if (started) applyAppearance();
}

function setTheme(theme) {
  const el = root();
  if (theme === "auto") delete el.dataset.theme;
  else el.dataset.theme = theme;
  try { localStorage.setItem("mar.theme", theme); } catch {}
}

function stopRainbow() {
  clearInterval(rainbowTimer);
  rainbowTimer = null;
}
const hueAccent = (hue) => `oklch(0.55 0.17 ${hue})`;

export function applyAppearance() {
  const el = root();
  if (!el) return;
  const p = prefs.get();
  const motion = resolveMotion(p.motion, systemReduced());
  const set = (k, v) => el.style.setProperty(k, v);

  setTheme(p.theme);

  // Accent: a stored colour, the logo's colour (Dynamic), or the rainbow sentinel.
  stopRainbow();
  const seed = p.dynamic && dynamicSeed ? dynamicSeed : p.accent;
  if (seed === RAINBOW) {
    if (motion.reduced) set("--accent", hueAccent(RAINBOW_SETTLED_HUE));
    else {
      let hue = RAINBOW_SETTLED_HUE;
      rainbowTimer = setInterval(() => { hue = (hue + 3) % 360; set("--accent", hueAccent(hue)); }, 120);
    }
    el.dataset.accent = "rainbow";
  } else {
    set("--accent", seed);
    delete el.dataset.accent;
  }

  set("--shape", String(p.shape));
  set("--ts", String(p.textSize / 100));
  if (p.font === "default") el.style.removeProperty("--font");
  else set("--font", FONT_STACKS[p.font]);
  el.dataset.density = p.density;
  el.dataset.contrast = p.contrast;
  el.dataset.focus = p.focus;
  el.dataset.targets = p.largeTargets ? "large" : "normal";
  el.dataset.motion = motion.reduced ? "reduced" : "full";
  el.classList.toggle("calm", motion.reduced);
  for (const [k, v] of Object.entries(cssVars(motion))) set(k, v);
  for (const fn of [...listeners]) fn(p, motion);
}

// Start once: apply now, re-apply on every change and when the system's motion setting changes.
export function startAppearance() {
  if (started) return applyAppearance();
  started = true;
  // The stock shell keeps the theme in "mar.theme"; that is the source of truth at start.
  try {
    const stock = localStorage.getItem("mar.theme");
    if (["auto", "light", "dark"].includes(stock) && stock !== prefs.get().theme) prefs.update((d) => { d.theme = stock; });
  } catch {}
  prefs.subscribe(() => applyAppearance());
  // The stock theme button changes data-theme itself; follow it so the two never disagree.
  try {
    new MutationObserver(() => {
      const now = root().dataset.theme ?? "auto";
      if (now !== prefs.get().theme) prefs.update((d) => { d.theme = now; });
    }).observe(root(), { attributes: true, attributeFilter: ["data-theme"] });
  } catch {}
  try {
    media = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    media?.addEventListener?.("change", () => applyAppearance());
  } catch {}
  applyAppearance();
}
