// Small live charts for the leaderboard, built with createElementNS (no innerHTML, no inline styles).
// Colours come from classes in style.css so light and dark both work.
const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== null && value !== undefined) node.setAttribute(key, String(value));
  return node;
}

// series: [{ values: number[], cls }]; every series is drawn on the same scale. `grid` adds a few guide lines
// and `unitText(value)` labels the top one. Returns an <svg>.
export function sparkline({ series, width = 140, height = 36, grid = false, unitText = (v) => String(v), label = "" }) {
  const pad = grid ? { l: 52, r: 8, t: 8, b: 8 } : { l: 2, r: 2, t: 3, b: 3 };
  const n = Math.max(2, ...series.map((s) => s.values.length));
  const peak = Math.max(1e-9, ...series.flatMap((s) => s.values));
  const w = width - pad.l - pad.r;
  const ht = height - pad.t - pad.b;
  const x = (i, len) => pad.l + (w * (i + n - len)) / (n - 1);
  const y = (v) => pad.t + ht - (ht * Math.min(v, peak)) / peak;
  const root = el("svg", { class: grid ? "tt-chart" : "tt-spark", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": label, preserveAspectRatio: "none" });
  if (grid) {
    for (let i = 0; i <= 2; i += 1) {
      const yy = pad.t + (ht * i) / 2;
      root.append(el("line", { class: "grid", x1: pad.l, x2: width - pad.r, y1: yy, y2: yy }));
      const text = el("text", { class: "axis", x: pad.l - 6, y: yy + 4, "text-anchor": "end" });
      text.textContent = unitText(peak * (1 - i / 2));
      root.append(text);
    }
  }
  for (const s of series) {
    if (!s.values.length) continue;
    const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i, s.values.length).toFixed(1)} ${y(v).toFixed(1)}`).join("");
    root.append(el("path", { class: `area ${s.cls}`, d: `${d}L${x(s.values.length - 1, s.values.length).toFixed(1)} ${pad.t + ht}L${x(0, s.values.length).toFixed(1)} ${pad.t + ht}Z` }));
    root.append(el("path", { class: `line ${s.cls}`, d, "vector-effect": "non-scaling-stroke" }));
  }
  return root;
}

// A flat percentage bar. `fill` animates its width through the stylesheet.
export function meterBar(percent, cls = "") {
  const root = el("svg", { class: `tt-bar ${cls}`, viewBox: "0 0 100 6", preserveAspectRatio: "none", role: "img", "aria-label": `${Math.round(percent)}%` });
  root.append(el("rect", { class: "track", x: 0, y: 0, width: 100, height: 6, rx: 3 }), el("rect", { class: "fill", x: 0, y: 0, width: Math.max(1.5, Math.min(100, percent)), height: 6, rx: 3 }));
  return root;
}
