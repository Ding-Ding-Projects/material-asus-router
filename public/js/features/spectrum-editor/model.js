// Pure helpers for the Wi-Fi spectrum editor. Channel numbers on 2.4 GHz and
// 5 GHz are both 5 MHz apart, so a network `width` MHz wide reaches
// width / 10 channel numbers either side of its centre.

export const halfSpan = (widthMhz) => widthMhz / 10;

// The channel the router offers that is closest to a position on the axis. Automatic (0) is never a position.
export function nearestChannel(candidates, position) {
  const real = candidates.filter((c) => c > 0);
  if (!real.length) return null;
  return real.reduce((best, c) => (Math.abs(c - position) < Math.abs(best - position) ? c : best));
}

// "20 MHz" in an option label to 20; Automatic and anything else to 0.
export const mhzOf = (text) => Number((String(text).match(/^(\d+)\s*MHz/) ?? [])[1]) || 0;

// The widths a band offers, from its width entry: [{ value, mhz }], automatic first with mhz 0.
export const widthChoices = (entry) => (entry?.options ?? []).map(([value, label]) => ({ value, mhz: mhzOf(label?.en ?? "") }));

// The offered width closest to a wanted width in MHz, among the fixed widths.
export function nearestWidth(choices, mhz) {
  const fixed = choices.filter((c) => c.mhz > 0);
  if (!fixed.length) return null;
  return fixed.reduce((best, c) => (Math.abs(c.mhz - mhz) < Math.abs(best.mhz - mhz) ? c : best));
}

// Stepping with the keyboard: the channel before or after `current` in the offered list (it stops at the ends).
export function stepChannel(candidates, current, direction) {
  const real = [...candidates].filter((c) => c > 0).sort((a, b) => a - b);
  if (!real.length) return null;
  const at = real.indexOf(current);
  if (at === -1) return nearestChannel(real, current ?? real[0]);
  return real[Math.min(real.length - 1, Math.max(0, at + direction))];
}

export function stepWidth(choices, currentValue, direction) {
  const fixed = choices.filter((c) => c.mhz > 0).sort((a, b) => a.mhz - b.mhz);
  if (!fixed.length) return null;
  const at = fixed.findIndex((c) => c.value === currentValue);
  if (at === -1) return fixed[0];
  return fixed[Math.min(fixed.length - 1, Math.max(0, at + direction))];
}

// The axis the chart covers: every channel that matters, with a little room either side.
export function axisRange(band, candidates, networks, own) {
  const all = [...candidates.filter((c) => c > 0), ...networks.map((n) => n.channel), ...(own ? [own] : [])];
  if (!all.length) return band === "2.4" ? [-1, 15] : [30, 170];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  return band === "2.4" ? [Math.min(lo, 1) - 3, Math.max(hi, 11) + 3] : [lo - 8, hi + 8];
}

// A bell-shaped path for one network: from its left edge up to the peak and down to its right edge.
// x(channel) and y(rssi) map into the picture; `base` is the bottom of the plot.
export function curvePath({ centre, width, rssi }, x, y, base) {
  const half = halfSpan(width);
  const peak = y(rssi);
  const left = x(centre - half);
  const right = x(centre + half);
  const mid = x(centre);
  return `M${left} ${base} C${left} ${peak} ${mid - (mid - left) * 0.45} ${peak} ${mid} ${peak} C${mid + (right - mid) * 0.45} ${peak} ${right} ${peak} ${right} ${base} Z`;
}

// The interference score of a channel, taken from the scan summary, as 0 to 1 against the busiest candidate.
export function crowding(summary, candidates) {
  const scores = candidates.filter((c) => c > 0).map((c) => summary.find((s) => s.channel === c)?.interference ?? 0);
  const top = Math.max(0, ...scores);
  return new Map(candidates.filter((c) => c > 0).map((c, i) => [c, top > 0 ? scores[i] / top : 0]));
}
