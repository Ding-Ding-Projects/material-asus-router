// A drawing of a stack of bamboo dim sum baskets with a lid that lifts and
// settles, steam that rises and two dumplings peeking out. Everything is
// drawn here with plain shapes, nothing is loaded. The moving parts carry
// classes; the style sheet animates them, and the app's reduced-motion rule
// (or the person's own motion setting) leaves a still picture.
const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}, ...kids) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  node.append(...kids);
  return node;
}

function basket(y, tone) {
  const g = el("g", { class: "fw-basket" });
  g.append(el("rect", { x: 70, y, width: 180, height: 44, rx: 12, class: `fw-bamboo fw-bamboo-${tone}` }));
  for (let x = 88; x < 240; x += 22) g.append(el("line", { x1: x, y1: y + 6, x2: x, y2: y + 38, class: "fw-slat" }));
  g.append(el("rect", { x: 66, y: y + 12, width: 188, height: 6, rx: 3, class: "fw-band" }), el("rect", { x: 66, y: y + 28, width: 188, height: 6, rx: 3, class: "fw-band" }));
  return g;
}

const dumpling = (cx, cy) => {
  const g = el("g", { class: "fw-dumpling" });
  g.append(el("path", { d: `M${cx - 22} ${cy} Q${cx} ${cy - 30} ${cx + 22} ${cy} Q${cx} ${cy + 10} ${cx - 22} ${cy}Z`, class: "fw-skin" }));
  for (let i = -14; i <= 14; i += 7) g.append(el("path", { d: `M${cx + i} ${cy - 11 + Math.abs(i) / 3} l2 -7`, class: "fw-pleat" }));
  return g;
};

export function drawBasket(label) {
  const svg = el("svg", { class: "fw-svg", viewBox: "0 -20 320 280", role: "img", "aria-label": label, focusable: "false" });
  svg.append(el("ellipse", { cx: 160, cy: 236, rx: 118, ry: 14, class: "fw-shadow" }));
  svg.append(basket(176, "a"), basket(130, "b"));
  const inside = el("g", { class: "fw-inside" }, dumpling(122, 128), dumpling(196, 128));
  const lid = el("g", { class: "fw-lid" },
    el("path", { d: "M62 124 Q160 40 258 124 Z", class: "fw-bamboo fw-bamboo-c" }),
    el("path", { d: "M82 112 Q160 58 238 112", class: "fw-slat", fill: "none" }),
    el("path", { d: "M104 118 Q160 78 216 118", class: "fw-slat", fill: "none" }),
    el("rect", { x: 62, y: 120, width: 196, height: 8, rx: 4, class: "fw-band" }),
    el("circle", { cx: 160, cy: 62, r: 9, class: "fw-knob" }));
  svg.append(inside, lid);
  for (const [i, x] of [[0, 120], [1, 160], [2, 200]]) svg.append(el("path", { d: `M${x} 54 q-12 -16 0 -30 q12 -14 0 -26`, class: `fw-steam fw-steam-${i}`, fill: "none" }));
  return svg;
}
