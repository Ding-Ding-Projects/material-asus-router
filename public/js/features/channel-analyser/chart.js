// Tiny SVG charts built with createElementNS (no innerHTML, no inline styles).
// Colours come from the classes in style.css, so light and dark both work.
const NS = "http://www.w3.org/2000/svg";

export function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== null && value !== undefined && value !== false) el.setAttribute(key, String(value));
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}

const nice = (max) => {
  if (!(max > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const f = max / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
};

// series: [{ name, cls, values: number|null[] }]; every series shares the x positions 0..n-1.
export function lineChart({ series, width = 640, height = 220, unit = "", label = "", fixedMax = null }) {
  const pad = { l: 46, r: 12, t: 10, b: 22 };
  const w = width - pad.l - pad.r;
  const ht = height - pad.t - pad.b;
  const n = Math.max(2, ...series.map((s) => s.values.length));
  const peak = Math.max(0, ...series.flatMap((s) => s.values.filter((v) => v !== null && Number.isFinite(v))));
  const max = fixedMax ?? nice(peak * 1.1);
  const x = (i) => pad.l + (w * i) / (n - 1);
  const y = (v) => pad.t + ht - (ht * Math.min(v, max)) / max;
  const root = svg("svg", { class: "mchart", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": label, preserveAspectRatio: "xMidYMid meet" });
  for (let i = 0; i <= 4; i += 1) {
    const value = (max * i) / 4;
    root.append(svg("line", { class: "grid", x1: pad.l, x2: width - pad.r, y1: y(value), y2: y(value) }), svg("text", { class: "axis", x: pad.l - 6, y: y(value) + 4, "text-anchor": "end" }, `${Math.round(value * 10) / 10}${i === 4 ? unit : ""}`));
  }
  for (const s of series) {
    let d = "";
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) return void (pen = false);
      d += `${pen ? "L" : "M"}${x(i + n - s.values.length).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    });
    if (d) root.append(svg("path", { class: `line ${s.cls}`, d }));
    s.values.forEach((v, i) => {
      if (v === null) root.append(svg("circle", { class: `gap ${s.cls}`, cx: x(i + n - s.values.length), cy: pad.t + ht, r: 3 }, svg("title", {}, `${s.name}: lost`)));
    });
  }
  return root;
}

// bars: [{ label, value, cls, title }]; horizontal bars with the value at the end.
export function barChart({ bars, width = 640, rowHeight = 30, unit = "", label = "", max = null }) {
  const pad = { l: 130, r: 70, t: 4, b: 4 };
  const height = pad.t + pad.b + bars.length * rowHeight;
  const top = max ?? Math.max(1e-9, ...bars.map((b) => b.value));
  const root = svg("svg", { class: "mchart", viewBox: `0 0 ${width} ${Math.max(height, 40)}`, role: "img", "aria-label": label, preserveAspectRatio: "xMidYMid meet" });
  bars.forEach((b, i) => {
    const y = pad.t + i * rowHeight;
    const len = Math.max(2, ((width - pad.l - pad.r) * Math.max(0, b.value)) / top);
    root.append(
      svg("text", { class: "axis", x: pad.l - 8, y: y + rowHeight / 2 + 4, "text-anchor": "end" }, b.label),
      svg("rect", { class: `bar ${b.cls ?? "s0"}`, x: pad.l, y: y + 4, width: len, height: rowHeight - 8, rx: 6 }, svg("title", {}, b.title ?? `${b.label}: ${b.value}${unit}`)),
      svg("text", { class: "val", x: pad.l + len + 6, y: y + rowHeight / 2 + 4 }, `${Math.round(b.value * 10) / 10}${unit}`),
    );
  });
  return root;
}
