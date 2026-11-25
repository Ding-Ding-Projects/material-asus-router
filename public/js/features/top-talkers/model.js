// Pure helpers for the "who is using the most" screen. Rates are bytes per second.

export const METRICS = ["down", "up", "both"];

export const valueOf = (row, metric) => (metric === "both" ? row.up + row.down : row[metric]);

// The busiest devices first for one metric: idle devices left out when asked, ties broken by name,
// and only the first `top` kept. Each row gets its rank, its value and its share of everyone's total.
export function rank(devices, metric, { hideIdle = true, top = 20 } = {}) {
  const total = devices.reduce((sum, d) => sum + valueOf(d, metric), 0);
  return devices
    .filter((d) => !hideIdle || valueOf(d, metric) > 0)
    .sort((a, b) => valueOf(b, metric) - valueOf(a, metric) || String(a.name).localeCompare(String(b.name)))
    .slice(0, top)
    .map((d, i) => ({ ...d, rank: i + 1, value: valueOf(d, metric), share: total > 0 ? valueOf(d, metric) / total : 0 }));
}

// A rate as text: Mbit/s like an internet plan, or MB/s like a file copy.
export function rateText(bytesPerSecond, unit = "bits") {
  if (unit === "bytes") {
    const mb = bytesPerSecond / 1e6;
    return mb >= 1 ? `${mb.toFixed(mb >= 10 ? 0 : 1)} MB/s` : `${Math.round(bytesPerSecond / 1000)} kB/s`;
  }
  const mbit = (bytesPerSecond * 8) / 1e6;
  return mbit >= 1 ? `${mbit.toFixed(mbit >= 10 ? 0 : 1)} Mbit/s` : `${Math.round((bytesPerSecond * 8) / 1000)} kbit/s`;
}

// A byte count as text: 1.2 GB, 340 MB, 12 kB.
export function bytesText(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(bytes >= 1e7 ? 0 : 1)} MB`;
  return `${Math.round(bytes / 1000)} kB`;
}

// Adds what each device moved during the last `seconds` to the running totals kept since the page opened.
export function accumulate(totals, devices, seconds) {
  const next = { ...totals };
  if (!(seconds > 0)) return next;
  for (const d of devices) {
    const before = next[d.ip] ?? { up: 0, down: 0 };
    next[d.ip] = { up: before.up + d.up * seconds, down: before.down + d.down * seconds };
  }
  return next;
}

// The points of a small line chart for one device and one metric, from the router's history of readings.
export function sparkline(history, ip, metric, width, height) {
  const values = history.map((h) => valueOf(h.devices[ip] ?? { up: 0, down: 0 }, metric));
  if (values.length < 2) return "";
  const top = Math.max(...values, 1);
  return values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - (v / top) * (height - 2) - 1).toFixed(1)}`).join(" ");
}
