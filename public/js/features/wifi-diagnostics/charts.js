// A semicircle gauge and a tiny sparkline, built element by element with createElementNS.
// No markup strings and no inline style. Colours come from the classes in style.css.
const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}, ...kids) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) node.setAttribute(k, String(v));
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined) node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return node;
}

// The arc is one path with pathLength 100, so "fill" is simply a dash length.
// Setting it a moment after mounting lets the CSS transition sweep it round.
export function gauge({ label, unit = "" }) {
  const fill = el("path", { class: "wd-fill", d: "M12 62 A48 48 0 0 1 108 62", pathLength: 100, "stroke-dasharray": "100", "stroke-dashoffset": "100", fill: "none" });
  const text = el("text", { class: "wd-val", x: 60, y: 54, "text-anchor": "middle" }, "…");
  const sub = el("text", { class: "wd-unit", x: 60, y: 70, "text-anchor": "middle" }, unit);
  const root = el("svg", { class: "wd-gauge off", viewBox: "0 0 120 76", role: "img", "aria-label": label, preserveAspectRatio: "xMidYMid meet" },
    el("path", { class: "wd-track", d: "M12 62 A48 48 0 0 1 108 62", pathLength: 100, fill: "none" }), fill, text, sub);
  const set = ({ percent, shown, tone }) => {
    root.setAttribute("class", `wd-gauge ${tone}`);
    text.textContent = shown;
    root.setAttribute("aria-label", `${label}: ${shown} ${unit}`.trim());
    fill.setAttribute("stroke-dashoffset", String(100 - percent));
  };
  return { el: root, set };
}

// values: [down, up] pairs, null for a gap. Draws the sum so the shape of the traffic shows.
export function sparkline(trail, { width = 96, height = 28 } = {}) {
  const sums = trail.map(([d, u]) => (d ?? 0) + (u ?? 0));
  const root = el("svg", { class: "wd-spark", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Recent activity", preserveAspectRatio: "none" });
  if (sums.length < 2) return root;
  const peak = Math.max(1, ...sums);
  const x = (i) => (width * i) / (sums.length - 1);
  const y = (v) => height - 2 - ((height - 4) * v) / peak;
  root.append(el("path", { class: "wd-spark-line", d: sums.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(""), fill: "none" }));
  return root;
}
