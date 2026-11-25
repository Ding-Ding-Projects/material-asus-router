// Plain number formatting for the diagnostics screen. No DOM, so the tests can
// call these from Node.
export function speed(bytesPerSecond) {
  if (bytesPerSecond === null || bytesPerSecond === undefined || !Number.isFinite(bytesPerSecond)) return "…";
  const v = bytesPerSecond;
  if (v >= 1e6) return `${v >= 1e7 ? Math.round(v / 1e6) : Math.round(v / 1e5) / 10} MB/s`;
  if (v >= 1e3) return `${Math.round(v / 1e3)} kB/s`;
  return `${Math.round(v)} B/s`;
}

export function size(bytes) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "…";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.round(bytes / 1e3)} kB`;
}

export function duration(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "…";
  const s = Math.round(seconds);
  if (s >= 86400) return `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h`;
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  if (s >= 60) return `${Math.floor(s / 60)} min`;
  return `${s} s`;
}

// good, warn or bad for a gauge. "lowIsGood" gauges (busy air, noise, heat) turn red as they climb.
export function tone(kind, value) {
  if (value === null || value === undefined) return "off";
  const bands = { air: [40, 70], noise: [-85, -75], heat: [70, 85] }[kind];
  if (!bands) return "good";
  return value <= bands[0] ? "good" : value <= bands[1] ? "warn" : "bad";
}

// 0 to 100 for the arc of a gauge, clamped.
export const fraction = (value, min, max) => (value === null || value === undefined ? 0 : Math.max(0, Math.min(100, Math.round(((value - min) / (max - min)) * 100))));

// Sort the client table by what the person picked. Unknown numbers go last.
export function sortClients(rows, by) {
  const nameOf = (r) => (r.name || r.mac).toLowerCase();
  const key = { name: (r) => nameOf(r), signal: (r) => -(r.rssi ?? -999), speed: (r) => -((r.downBps ?? 0) + (r.upBps ?? 0)) }[by] ?? ((r) => nameOf(r));
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return (x < y ? -1 : x > y ? 1 : 0) || nameOf(a).localeCompare(nameOf(b));
  });
}
