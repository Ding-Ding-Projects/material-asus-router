// Pure ranking and wording for the Top talkers screen. It imports nothing, so
// the browser and the Node tests use the same code.

export const MODES = ["down", "up", "both"];
export const WINDOWS = ["now", "since"];

// The amount a device counts for in the chosen measure: its speed (bytes per second) or its total (bytes).
export function amounts(row, window) {
  return window === "since" ? { up: row.totalUp, down: row.totalDown } : { up: row.rateUp, down: row.rateDown };
}

export function rankDevices(rows, { mode = "down", window = "now", count = 8, hideIdle = true } = {}) {
  const scored = rows.map((row) => {
    const a = amounts(row, window);
    return { ...row, up: a.up, down: a.down, value: mode === "down" ? a.down : mode === "up" ? a.up : a.up + a.down };
  });
  const everyone = scored.reduce((n, r) => n + r.value, 0);
  const sorted = scored
    .filter((r) => !hideIdle || r.value > 0)
    .sort((a, b) => b.value - a.value || a.ip.localeCompare(b.ip, undefined, { numeric: true }));
  const leader = sorted[0]?.value ?? 0;
  return sorted.slice(0, count).map((r, i) => ({ ...r, position: i + 1, share: everyone > 0 ? r.value / everyone : 0, rel: leader > 0 ? r.value / leader : 0 }));
}

export function speedText(bytesPerSecond, unit) {
  const value = unit === "bytes" ? bytesPerSecond / 1e6 : (bytesPerSecond * 8) / 1e6;
  const shown = value >= 100 ? Math.round(value) : value >= 10 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
  return `${shown} ${unit === "bytes" ? "MB/s" : "Mbit/s"}`;
}
export const sizeText = (bytes) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} kB`);
export const valueText = (value, window, unit) => (window === "since" ? sizeText(value) : speedText(value, unit));
export const percentText = (share) => `${Math.round(share * 100)}%`;
