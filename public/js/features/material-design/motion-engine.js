// The motion model behind the animation and transition editor. Pure functions,
// no DOM: kinds, easing, profiles, reduced motion and the CSS variables the
// stylesheet reads. "Reduced motion always wins": resolveMotion() returns zero
// durations and zero travel whenever it is on, whatever the editor says.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : fallback);

// Every kind of animated element. `base` is the Standard profile value.
export const KINDS = [
  { id: "page-entry", label: { en: "Page entry", yue: "頁面進場" }, base: { duration: 500, delay: 0, stagger: 0, easing: "emphasized-decelerate", distance: 14, scale: 0.98 } },
  { id: "list-stagger", label: { en: "List and card stagger", yue: "清單同卡片依次進場" }, base: { duration: 450, delay: 0, stagger: 50, easing: "spring", distance: 12, scale: 0.98 } },
  { id: "cards", label: { en: "Cards", yue: "卡片" }, base: { duration: 220, delay: 0, stagger: 0, easing: "standard", distance: 0, scale: 1 } },
  { id: "dialog", label: { en: "Dialogs", yue: "對話框" }, base: { duration: 320, delay: 0, stagger: 0, easing: "emphasized-decelerate", distance: 20, scale: 0.97 } },
  { id: "menu", label: { en: "Menus and results", yue: "選單同結果" }, base: { duration: 200, delay: 0, stagger: 0, easing: "standard", distance: 8, scale: 0.98 } },
  { id: "sheet", label: { en: "Sheets and floating panels", yue: "面板同浮動面板" }, base: { duration: 300, delay: 0, stagger: 0, easing: "emphasized-decelerate", distance: 24, scale: 0.98 } },
  { id: "tooltip", label: { en: "Tooltips", yue: "提示" }, base: { duration: 150, delay: 300, stagger: 0, easing: "standard", distance: 4, scale: 0.96 } },
  { id: "toast", label: { en: "Toasts", yue: "短訊息" }, base: { duration: 300, delay: 0, stagger: 0, easing: "spring", distance: 16, scale: 0.96 } },
  { id: "switch", label: { en: "Switches and controls", yue: "開關同控制項" }, base: { duration: 250, delay: 0, stagger: 0, easing: "spring", distance: 0, scale: 1 } },
  { id: "chart", label: { en: "Charts drawing in", yue: "圖表繪製" }, base: { duration: 700, delay: 0, stagger: 0, easing: "emphasized-decelerate", distance: 0, scale: 1 } },
  { id: "progress", label: { en: "Progress and meters", yue: "進度同量表" }, base: { duration: 500, delay: 0, stagger: 0, easing: "standard", distance: 0, scale: 1 } },
  { id: "live-pulse", label: { en: "Live pulses", yue: "即時脈動" }, base: { duration: 2400, delay: 0, stagger: 0, easing: "ease-in-out", distance: 0, scale: 0.85 } },
  { id: "tab-change", label: { en: "Tab and rail changes", yue: "分頁同側欄切換" }, base: { duration: 200, delay: 0, stagger: 0, easing: "standard", distance: 0, scale: 1 } },
  { id: "hover-lift", label: { en: "Hover lift", yue: "懸停浮起" }, base: { duration: 180, delay: 0, stagger: 0, easing: "standard", distance: 2, scale: 1 } },
];
export const KIND_IDS = KINDS.map((k) => k.id);

// Material 3 easing curves, plus two that are not cubic Beziers.
export const EASINGS = {
  standard: { label: { en: "Standard", yue: "標準" }, bezier: [0.2, 0, 0, 1] },
  "standard-decelerate": { label: { en: "Standard decelerate", yue: "標準減速" }, bezier: [0, 0, 0, 1] },
  "standard-accelerate": { label: { en: "Standard accelerate", yue: "標準加速" }, bezier: [0.3, 0, 1, 1] },
  emphasized: { label: { en: "Emphasized", yue: "強調" }, bezier: [0.3, 0, 0.8, 0.15] },
  "emphasized-decelerate": { label: { en: "Emphasized decelerate", yue: "強調減速" }, bezier: [0.05, 0.7, 0.1, 1] },
  "ease-in-out": { label: { en: "Ease in and out", yue: "緩入緩出" }, bezier: [0.45, 0, 0.55, 1] },
  spring: { label: { en: "Spring", yue: "彈簧" }, spring: { stiffness: 170, damping: 14 } },
  linear: { label: { en: "Linear", yue: "線性" }, linear: true },
};

export const PROFILES = {
  calm: { label: { en: "Calm", yue: "平靜" }, duration: 0.7, distance: 0.5, stagger: 0.6, scaleTravel: 0.5, easing: null },
  standard: { label: { en: "Standard", yue: "標準" }, duration: 1, distance: 1, stagger: 1, scaleTravel: 1, easing: null },
  expressive: { label: { en: "Expressive", yue: "有表情" }, duration: 1.25, distance: 1.5, stagger: 1.4, scaleTravel: 1.6, easing: null },
  playful: { label: { en: "Playful", yue: "活潑" }, duration: 1.4, distance: 2, stagger: 1.8, scaleTravel: 2.4, easing: "spring" },
};

// A damped spring sampled into a CSS linear() easing, so no script runs per frame.
export function springSamples({ stiffness = 170, damping = 14, mass = 1 }, count = 28) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const at = (t) => {
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };
  // Run until the spring has settled, then spread the samples over that time.
  let end = 0.2;
  while (end < 6 && Math.abs(1 - at(end)) > 0.002) end += 0.05;
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? 1 : at((i / (count - 1)) * end)));
}

export const bezierCss = (b) => `cubic-bezier(${b.map((v) => Number(v.toFixed(3))).join(", ")})`;
// easing is a preset id, or the text "bezier(x1,y1,x2,y2)" written by the curve editor.
export function parseBezier(text) {
  const m = /^bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/.exec(String(text));
  if (!m) return null;
  const v = m.slice(1).map(Number);
  if (v.some((x) => !Number.isFinite(x)) || v[0] < 0 || v[0] > 1 || v[2] < 0 || v[2] > 1 || v.some((x) => x < -2 || x > 3)) return null;
  return v;
}
export const isEasing = (id) => id in EASINGS || parseBezier(id) !== null;
export function easingCss(id) {
  const bez = parseBezier(id);
  if (bez) return bezierCss(bez);
  const e = EASINGS[id] ?? EASINGS.standard;
  if (e.bezier) return bezierCss(e.bezier);
  if (e.linear) return "linear";
  return `linear(${springSamples(e.spring).map((v) => Number(v.toFixed(3))).join(", ")})`;
}
// The curve as points for drawing, whatever kind it is.
export function easingPoints(id, steps = 40) {
  const bez = parseBezier(id) ?? EASINGS[id]?.bezier;
  if (bez) {
    const [x1, y1, x2, y2] = bez;
    const cub = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
    return Array.from({ length: steps + 1 }, (_, i) => { const t = i / steps; return [cub(t, x1, x2), cub(t, y1, y2)]; });
  }
  if (EASINGS[id]?.spring) return springSamples(EASINGS[id].spring, steps + 1).map((y, i) => [i / steps, y]);
  return [[0, 0], [1, 1]];
}

// ---- settings ---------------------------------------------------------------
export const DEFAULT_MOTION = { reduced: "system", low: false, master: true, profile: "standard", speed: 1, kinds: {} };

export function sanitizeMotion(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const out = {
    reduced: ["system", "on", "off"].includes(r.reduced) ? r.reduced : "system",
    low: r.low === true,
    master: r.master !== false,
    profile: r.profile in PROFILES ? r.profile : "standard",
    speed: clamp(num(r.speed, 1), 0.25, 3),
    kinds: {},
  };
  for (const id of KIND_IDS) {
    const k = r.kinds?.[id];
    if (!k || typeof k !== "object") continue;
    const clean = {};
    if (typeof k.enabled === "boolean") clean.enabled = k.enabled;
    if (k.duration !== undefined) clean.duration = clamp(Math.round(num(k.duration, 0)), 0, 5000);
    if (k.delay !== undefined) clean.delay = clamp(Math.round(num(k.delay, 0)), 0, 2000);
    if (k.stagger !== undefined) clean.stagger = clamp(Math.round(num(k.stagger, 0)), 0, 400);
    if (k.distance !== undefined) clean.distance = clamp(Math.round(num(k.distance, 0)), 0, 120);
    if (k.scale !== undefined) clean.scale = clamp(Number(num(k.scale, 1).toFixed(2)), 0.5, 1.5);
    if (typeof k.easing === "string" && isEasing(k.easing)) clean.easing = k.easing;
    if (Object.keys(clean).length) out.kinds[id] = clean;
  }
  return out;
}

// Reduced motion is on when the person asked for it, when Low stimulation is
// on, or when "follow the system" is chosen and the system asks for it.
export const isReduced = (motion, systemReduced = false) => motion.low || motion.reduced === "on" || (motion.reduced === "system" && systemReduced);

// The value a kind really uses: base, shaped by the profile, then the person's own edits.
export function effectiveKind(motion, id) {
  const def = KINDS.find((k) => k.id === id);
  const p = PROFILES[motion.profile] ?? PROFILES.standard;
  const own = motion.kinds[id] ?? {};
  const base = def.base;
  const shaped = {
    enabled: true,
    duration: id === "live-pulse" ? base.duration : Math.round(base.duration * p.duration),
    delay: base.delay,
    stagger: Math.round(base.stagger * p.stagger),
    easing: p.easing && base.easing !== "linear" && id !== "live-pulse" && id !== "progress" ? p.easing : base.easing,
    distance: Math.round(base.distance * p.distance),
    scale: Number((1 - (1 - base.scale) * p.scaleTravel).toFixed(2)),
  };
  shaped.scale = clamp(shaped.scale, 0.5, 1.5);
  return { ...shaped, ...own };
}

// What the page uses right now.
export function resolveMotion(motion, systemReduced = false) {
  const reduced = isReduced(motion, systemReduced);
  const out = {};
  for (const id of KIND_IDS) {
    const k = effectiveKind(motion, id);
    const off = reduced || !motion.master || !k.enabled;
    out[id] = off
      ? { enabled: false, duration: 0, delay: 0, stagger: 0, easing: "linear", distance: 0, scale: 1 }
      : { ...k, duration: Math.round(k.duration / motion.speed), delay: Math.round(k.delay / motion.speed), stagger: Math.round(k.stagger / motion.speed) };
  }
  return { reduced, kinds: out };
}

// Custom properties for the stylesheet: --mo-<kind>-d, -delay, -stagger, -ease, -dist, -scale.
export function cssVars(resolved) {
  const vars = {};
  for (const [id, k] of Object.entries(resolved.kinds)) {
    vars[`--mo-${id}-d`] = `${k.duration}ms`;
    vars[`--mo-${id}-delay`] = `${k.delay}ms`;
    vars[`--mo-${id}-stagger`] = `${k.stagger}ms`;
    vars[`--mo-${id}-ease`] = easingCss(k.easing);
    vars[`--mo-${id}-dist`] = `${k.distance}px`;
    vars[`--mo-${id}-scale`] = String(k.scale);
  }
  return vars;
}

export const exportMotion = (motion) => JSON.stringify({ kind: "material-asus-router-motion", version: 1, motion }, null, 2);
export function importMotion(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: "That is not valid JSON." }; }
  if (data?.kind !== "material-asus-router-motion" || data.version !== 1 || typeof data.motion !== "object") return { ok: false, error: "That file is not a motion profile from this app." };
  return { ok: true, motion: sanitizeMotion(data.motion) };
}
