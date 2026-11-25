// The drawing model: seven pens that each shape their stroke differently, the
// partial eraser, shift-locked straight lines, undo and redo, and the SVG
// export. A stroke is turned into one closed outline; the canvas fills that
// outline and the SVG file contains the very same outline, so an export is
// exactly what is on screen. No browser-only calls, so it is tested from Node.

export const PENS = [
  { id: "ballpoint", key: "1", name: { en: "Ballpoint", yue: "原子筆" }, about: { en: "Even line", yue: "粗幼一致" }, alpha: 1, blend: "normal", cap: "round" },
  { id: "fountain", key: "2", name: { en: "Fountain pen", yue: "鋼筆" }, about: { en: "Thinner when you move fast", yue: "快手就幼啲" }, alpha: 1, blend: "normal", cap: "round" },
  { id: "marker", key: "3", name: { en: "Marker", yue: "麥克筆" }, about: { en: "Wide, slightly see-through", yue: "闊啲，微微透明" }, alpha: 0.78, blend: "normal", cap: "round" },
  { id: "highlighter", key: "4", name: { en: "Highlighter", yue: "螢光筆" }, about: { en: "Very wide, flat ends, tints what is under it", yue: "好闊，平頭，會染色底下嘅嘢" }, alpha: 0.38, blend: "multiply", cap: "flat" },
  { id: "brush", key: "5", name: { en: "Brush", yue: "毛筆" }, about: { en: "Tapers at the ends, thick when slow", yue: "兩端變幼，慢手就粗" }, alpha: 1, blend: "normal", cap: "round" },
  { id: "pencil", key: "6", name: { en: "Pencil", yue: "鉛筆" }, about: { en: "Thin and slightly uneven", yue: "幼而略有起伏" }, alpha: 0.88, blend: "normal", cap: "round" },
  { id: "calligraphy", key: "7", name: { en: "Calligraphy", yue: "書法筆" }, about: { en: "Width follows the angle of a slanted nib", yue: "闊度跟筆嘴斜度變化" }, alpha: 1, blend: "normal", cap: "flat" },
];
export const pen = (id) => PENS.find((p) => p.id === id) ?? PENS[0];

export const MIN_SIZE = 1;
export const MAX_SIZE = 60;
export const COLOR = /^#[0-9a-fA-F]{6}$/;
const NIB_ANGLE = Math.PI / 4;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (n) => Math.round(n * 100) / 100;

// A steady pseudo-random number from 0 to 1 for each position, so a pencil
// line looks the same every time it is drawn or exported.
const jitter = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };

// Speed in pixels per millisecond at each point, smoothed a little.
function speeds(points) {
  const raw = points.map((p, i) => {
    if (i === 0) return 0;
    const q = points[i - 1];
    const dt = Math.max(1, (p.t ?? i * 8) - (q.t ?? (i - 1) * 8));
    return Math.hypot(p.x - q.x, p.y - q.y) / dt;
  });
  return raw.map((v, i) => (v + (raw[i - 1] ?? v) + (raw[i + 1] ?? v)) / 3);
}

// The width of the line at each point, which is the whole difference between pens.
export function widths(stroke) {
  const { points, size } = stroke;
  const v = speeds(points);
  const n = points.length;
  return points.map((p, i) => {
    const slow = 1 - clamp(v[i] / 2.5, 0, 1); // 1 when still, 0 when fast
    switch (stroke.pen) {
      case "fountain": return size * (0.45 + 0.85 * slow);
      case "marker": return size * 2;
      case "highlighter": return size * 4;
      case "brush": {
        const edge = Math.min(i, n - 1 - i) / Math.max(1, Math.min(8, (n - 1) / 2));
        return size * clamp(edge, 0.12, 1) * (0.7 + 0.7 * slow);
      }
      case "pencil": return size * 0.7 * (0.85 + 0.3 * jitter(i));
      case "calligraphy": {
        const a = points[Math.min(n - 1, i + 1)];
        const b = points[Math.max(0, i - 1)];
        const dir = Math.atan2(a.y - b.y, a.x - b.x);
        return size * (0.18 + 1.6 * Math.abs(Math.sin(dir - NIB_ANGLE)));
      }
      default: return size;
    }
  });
}

// The outline of a stroke as a list of points; closed and ready to fill.
export function outline(stroke) {
  const points = stroke.points;
  if (!points.length) return [];
  const w = widths(stroke);
  const round_ = pen(stroke.pen).cap === "round";
  const circle = (c, r) => Array.from({ length: 12 }, (_, k) => ({ x: c.x + Math.cos((k / 12) * 2 * Math.PI) * r, y: c.y + Math.sin((k / 12) * 2 * Math.PI) * r }));
  if (points.length === 1) return circle(points[0], Math.max(0.5, w[0] / 2));
  const left = [];
  const right = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const r = Math.max(0.25, w[i] / 2);
    left.push({ x: p.x - dy * r, y: p.y + dx * r });
    right.push({ x: p.x + dy * r, y: p.y - dx * r });
  });
  const cap = (end, toward) => {
    if (!round_) return [];
    const p = points[end];
    const r = Math.max(0.25, w[end] / 2);
    const base = Math.atan2(toward.y - p.y, toward.x - p.x);
    return Array.from({ length: 5 }, (_, k) => ({ x: p.x + Math.cos(base + Math.PI / 2 + ((k + 1) / 6) * Math.PI) * r, y: p.y + Math.sin(base + Math.PI / 2 + ((k + 1) / 6) * Math.PI) * r }));
  };
  const last = points.length - 1;
  return [...left, ...cap(last, points[last - 1]).reverse(), ...right.reverse(), ...cap(0, points[1]).reverse()];
}

export function strokePath(stroke) {
  const poly = outline(stroke);
  if (!poly.length) return "";
  return `M${poly.map((p) => `${round(p.x)} ${round(p.y)}`).join("L")}Z`;
}

// ---- the straight-line lock ------------------------------------------------------

// With Shift held, a stroke becomes a straight line from where it began to
// where it is now, snapped to the nearest 45 degrees.
export function lockPoints(points) {
  if (points.length < 2) return points;
  const a = points[0];
  const b = points[points.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const snap = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const end = { x: a.x + Math.cos(snap) * len, y: a.y + Math.sin(snap) * len, t: b.t };
  const steps = Math.max(2, Math.ceil(len / 6));
  return Array.from({ length: steps + 1 }, (_, i) => ({ x: a.x + ((end.x - a.x) * i) / steps, y: a.y + ((end.y - a.y) * i) / steps, t: (a.t ?? 0) + (((b.t ?? steps * 8) - (a.t ?? 0)) * i) / steps }));
}

// ---- the partial eraser ------------------------------------------------------------

function densify(points, gap) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / gap);
    for (let k = 1; k <= n; k += 1) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n, t: (a.t ?? 0) + (((b.t ?? 0) - (a.t ?? 0)) * k) / n });
  }
  return out;
}

// Removes only the part of each stroke inside the circle. A stroke cut in the
// middle becomes two strokes; one that is wholly inside disappears.
export function eraseAt(strokes, { x, y, r }) {
  const out = [];
  let counter = 0;
  for (const stroke of strokes) {
    const near = stroke.points.some((p) => Math.hypot(p.x - x, p.y - y) <= r + stroke.size * 2.5);
    if (!near) { out.push(stroke); continue; }
    const dense = densify(stroke.points, Math.max(1, r / 3));
    let run = [];
    const flush = () => {
      if (run.length) out.push({ ...stroke, id: `${stroke.id}.${counter++}`, points: run });
      run = [];
    };
    let touched = false;
    for (const p of dense) {
      if (Math.hypot(p.x - x, p.y - y) <= r) { touched = true; flush(); } else run.push(p);
    }
    flush();
    if (!touched) out.push(stroke); // close, but not actually touched
  }
  // A stroke that was not cut must not appear twice.
  return out.filter((s, i, all) => all.findIndex((o) => o.id === s.id) === i);
}

// ---- undo and redo --------------------------------------------------------------------

export class DrawHistory {
  constructor(strokes = []) {
    this.past = [];
    this.future = [];
    this.strokes = strokes;
  }

  commit(next) {
    this.past.push(this.strokes);
    if (this.past.length > 300) this.past.shift();
    this.strokes = next;
    this.future = [];
  }

  undo() { if (this.past.length) { this.future.push(this.strokes); this.strokes = this.past.pop(); } return this.strokes; }
  redo() { if (this.future.length) { this.past.push(this.strokes); this.strokes = this.future.pop(); } return this.strokes; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  // Clearing is itself an undoable step, so nothing is ever lost for good.
  clear() { if (this.strokes.length) this.commit([]); }
}

// ---- export -------------------------------------------------------------------------------

const attr = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

// Exactly the shapes on screen: one path per stroke, in order, with the
// pen's own opacity and blending.
export function toSvg(strokes, width, height, { background = null, image = null } = {}) {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`];
  if (background) parts.push(`<rect width="${width}" height="${height}" fill="${COLOR.test(background) ? background : "#ffffff"}"/>`);
  if (image?.startsWith("data:image/")) parts.push(`<image href="${attr(image)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`);
  for (const s of strokes) {
    const p = pen(s.pen);
    const color = COLOR.test(s.color) ? s.color : "#000000";
    const blend = p.blend === "multiply" ? ' style="mix-blend-mode:multiply"' : "";
    parts.push(`<path d="${strokePath(s)}" fill="${color}" fill-opacity="${p.alpha}"${blend}/>`);
  }
  parts.push("</svg>");
  return `${parts.join("\n")}\n`;
}

export const EXPORT_SCALES = [1, 2, 3];

// The shortcuts, in one list so the tooltips, the menu and the test agree.
export const SHORTCUTS = [
  ...PENS.map((p) => ({ keys: p.key, action: `pen:${p.id}`, label: p.name })),
  { keys: "E", action: "eraser", label: { en: "Eraser", yue: "擦膠" } },
  { keys: "[", action: "smaller", label: { en: "Thinner", yue: "幼啲" } },
  { keys: "]", action: "larger", label: { en: "Thicker", yue: "粗啲" } },
  { keys: "Shift (hold)", action: "lock", label: { en: "Straight line", yue: "直線" } },
  { keys: "Ctrl+Z", action: "undo", label: { en: "Undo", yue: "還原" } },
  { keys: "Ctrl+Shift+Z", action: "redo", label: { en: "Redo", yue: "重做" } },
  { keys: "Ctrl+Y", action: "redo", label: { en: "Redo", yue: "重做" } },
  { keys: "Delete", action: "clear", label: { en: "Clear (asks first)", yue: "清除（會先問）" } },
  { keys: "T", action: "toolbar", label: { en: "Change the toolbar shape", yue: "轉換工具列形狀" } },
];

// What to keep in storage: rounded points and no more than the limit.
export const STORAGE_LIMIT = 2_000_000;
export function packStrokes(strokes) {
  return JSON.stringify(strokes.map((s) => ({ ...s, points: s.points.map((p) => [round(p.x), round(p.y), Math.round(p.t ?? 0)]) })));
}
export function unpackStrokes(text) {
  const list = JSON.parse(text);
  if (!Array.isArray(list)) throw new Error("Saved drawing is not a list.");
  return list.filter((s) => PENS.some((p) => p.id === s.pen) && COLOR.test(s.color) && Array.isArray(s.points)).map((s) => ({ id: String(s.id), pen: s.pen, color: s.color, size: clamp(Number(s.size) || 4, MIN_SIZE, MAX_SIZE), points: s.points.map(([x, y, t]) => ({ x, y, t })) }));
}
