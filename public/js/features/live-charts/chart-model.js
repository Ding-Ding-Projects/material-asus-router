// The numbers behind the live chart. Pure functions, no DOM, so they can be
// tested on their own. A chart only ever shows samples it was given: gaps stay
// gaps (the line is broken there) and nothing is ever filled in.

// A tidy axis ceiling: 1, 2, 2.5, 5 or 10 times a power of ten, at or above the value.
export function niceMax(v) {
  if (!(v > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * pow) return m * pow;
  return 10 * pow;
}

export function formatRate(bits) {
  const v = Math.max(0, Number(bits) || 0);
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} Gbit/s`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} Mbit/s`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} kbit/s`;
  return `${Math.round(v)} bit/s`;
}

// Splits samples into runs wherever two neighbours are further apart than `gapMs`.
export function segments(points, gapMs) {
  const out = [];
  let run = [];
  for (const p of points) {
    if (run.length && p.t - run[run.length - 1].t > gapMs) { out.push(run); run = []; }
    run.push(p);
  }
  if (run.length) out.push(run);
  return out;
}

// A smooth path through one run, using a monotone cubic so the line never overshoots the data.
export function smoothPath(xy) {
  if (xy.length === 0) return "";
  if (xy.length === 1) return `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`;
  const n = xy.length;
  const dx = [];
  const m = [];
  for (let i = 0; i < n - 1; i += 1) { dx.push(xy[i + 1][0] - xy[i][0] || 1e-6); m.push((xy[i + 1][1] - xy[i][1]) / dx[i]); }
  const tan = [m[0]];
  for (let i = 1; i < n - 1; i += 1) tan.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  tan.push(m[n - 2]);
  for (let i = 0; i < n - 1; i += 1) {
    if (m[i] === 0) { tan[i] = 0; tan[i + 1] = 0; continue; }
    const a = tan[i] / m[i];
    const b = tan[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); tan[i] = k * a * m[i]; tan[i + 1] = k * b * m[i]; }
  }
  let d = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    d += `C${(xy[i][0] + h).toFixed(1)},${(xy[i][1] + tan[i] * h).toFixed(1)} ${(xy[i + 1][0] - h).toFixed(1)},${(xy[i + 1][1] - tan[i + 1] * h).toFixed(1)} ${xy[i + 1][0].toFixed(1)},${xy[i + 1][1].toFixed(1)}`;
  }
  return d;
}

// Maps samples to chart coordinates for a time window ending at `end`.
export function layout(points, { end, windowMs, width, height, pad, max }) {
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  return points.filter((p) => p.t >= end - windowMs - 1000).map((p) => ({ ...p, x: pad.l + ((p.t - (end - windowMs)) / windowMs) * iw, y: pad.t + ih - (Math.min(p.v, max) / max) * ih }));
}

export const nearestIndex = (laid, x) => {
  let best = -1;
  let bestD = Infinity;
  laid.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bestD) { best = i; bestD = d; } });
  return best;
};

// One honest sentence for screen readers and the text under the chart.
export function summary(points, { format = String, label = "", state = "live", windowMs = 120000 } = {}) {
  if (!points.length) return `${label}: ${state === "loading" ? "loading, no samples yet" : "no samples yet"}.`;
  const vals = points.map((p) => p.v);
  const last = points[points.length - 1];
  const note = state === "paused" ? " Updates are paused." : state === "stale" ? " The data is out of date." : "";
  return `${label}: now ${format(last.v)}, lowest ${format(Math.min(...vals))}, highest ${format(Math.max(...vals))}, from ${points.length} samples over the last ${Math.round(windowMs / 1000)} seconds.${note}`;
}
