// Ranking for the Top talkers screen. Pure functions, so they are checked from Node.

// The four tabs. A "rate" is the speed right now, worked out from two readings of the router's connection table.
// A "total" is the bytes of the connections the router is tracking now.
export const TABS = [
  { id: "down", key: "down", kind: "rate", label: { en: "Downloading now", yue: "而家下載最多" }, icon: "arrow_downward" },
  { id: "up", key: "up", kind: "rate", label: { en: "Uploading now", yue: "而家上傳最多" }, icon: "arrow_upward" },
  { id: "totalDown", key: "totalDown", kind: "total", label: { en: "Downloaded most", yue: "累計下載最多" }, icon: "cloud_download" },
  { id: "totalUp", key: "totalUp", kind: "total", label: { en: "Uploaded most", yue: "累計上傳最多" }, icon: "cloud_upload" },
];

// The devices that moved the most data for one key, biggest first. share is the part of everyone's total,
// fraction is the part of the biggest device (it sizes the bar).
export function rank(devices, key, limit = 10) {
  const rows = devices.filter((d) => Number(d[key]) > 0).sort((a, b) => b[key] - a[key] || a.ip.localeCompare(b.ip, undefined, { numeric: true }));
  const sum = rows.reduce((s, d) => s + d[key], 0);
  const max = rows[0]?.[key] ?? 0;
  return { sum, rows: rows.slice(0, Math.max(1, limit)).map((d, i) => ({ rank: i + 1, ip: d.ip, mac: d.mac ?? "", name: d.name || d.ip, value: d[key], share: sum ? d[key] / sum : 0, fraction: max ? d[key] / max : 0 })), others: Math.max(0, rows.length - limit) };
}

export function rateText(bytesPerSecond, unit) {
  const value = unit === "bytes" ? bytesPerSecond / 1e6 : (bytesPerSecond * 8) / 1e6;
  const shown = value >= 100 ? Math.round(value) : value >= 10 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
  return `${shown} ${unit === "bytes" ? "MB/s" : "Mbit/s"}`;
}

export const sizeText = (bytes) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} kB`);
export const percent = (fraction) => `${Math.round(fraction * 100)}%`;
