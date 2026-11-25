// Pure helpers for the "who is uploading or downloading the most" tab. The
// readings come from the Device traffic feature (bytes per second per device,
// plus the bytes of the connections the router is tracking now).

export const MODES = ["down", "up", "both"];

const amount = (row, mode) => (mode === "both" ? row.down + row.up : row[mode]);

// The devices ranked for one tab: the biggest first, ties broken by the larger
// tracked total and then by name so the order never jumps about.
export function rank(devices, mode, limit = 10) {
  const total = (row) => (mode === "both" ? row.totalDown + row.totalUp : mode === "down" ? row.totalDown : row.totalUp);
  const sorted = [...devices].sort((a, b) => amount(b, mode) - amount(a, mode) || total(b) - total(a) || a.name.localeCompare(b.name));
  const sum = sorted.reduce((s, r) => s + amount(r, mode), 0);
  return sorted.slice(0, limit).map((row, i) => ({ ...row, place: i + 1, rate: amount(row, mode), tracked: total(row), share: sum > 0 ? amount(row, mode) / sum : 0 }));
}

// Adds what each device moved during the last reading to the running total for
// this visit: rate times the seconds since the previous reading.
export function accumulate(totals, devices, seconds) {
  const next = new Map(totals);
  if (!(seconds > 0 && seconds < 60)) return next;
  for (const row of devices) {
    const before = next.get(row.ip) ?? { name: row.name, down: 0, up: 0 };
    next.set(row.ip, { name: row.name, down: before.down + row.down * seconds, up: before.up + row.up * seconds });
  }
  return next;
}

export function visitRank(totals, mode, limit = 10) {
  const rows = [...totals].map(([ip, v]) => ({ ip, name: v.name, down: v.down, up: v.up }));
  const sorted = rows.sort((a, b) => amount(b, mode) - amount(a, mode) || a.name.localeCompare(b.name));
  return sorted.filter((r) => amount(r, mode) > 0).slice(0, limit);
}

export const percent = (share) => `${Math.round(share * 100)}%`;
