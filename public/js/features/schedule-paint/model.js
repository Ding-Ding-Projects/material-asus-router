// The data model of the schedule painter. It imports nothing, so the screen and
// the Node tests use the same code.
//
// A schedule is a 7 by 24 grid of hours, Sunday first. For parental controls a
// painted hour is a blocked hour; for a Wi-Fi band it is an hour the radio is on.

export const DAYS = [["Sun", "日"], ["Mon", "一"], ["Tue", "二"], ["Wed", "三"], ["Thu", "四"], ["Fri", "五"], ["Sat", "六"]];

export const emptyGrid = () => Array.from({ length: 7 }, () => new Array(24).fill(false));
export const fullGrid = () => Array.from({ length: 7 }, () => new Array(24).fill(true));
export const cloneGrid = (grid) => grid.map((row) => [...row]);
export const countOn = (grid) => grid.flat().filter(Boolean).length;

// Ready-made starting points.
export const PRESETS = {
  nights: { label: { en: "Every night 22:00 to 07:00", yue: "每晚 22:00 至 07:00" }, build: () => rows((d, h) => h >= 22 || h < 7) },
  schoolNights: { label: { en: "School nights 21:00 to 07:00", yue: "上學日晚 21:00 至 07:00" }, build: () => rows((d, h) => (d >= 0 && d <= 4 && h >= 21) || (d >= 1 && d <= 5 && h < 7)) },
  daytime: { label: { en: "Weekdays 08:00 to 17:00", yue: "平日 08:00 至 17:00" }, build: () => rows((d, h) => d >= 1 && d <= 5 && h >= 8 && h < 17) },
  always: { label: { en: "All the time", yue: "全日" }, build: fullGrid },
  never: { label: { en: "Clear", yue: "清空" }, build: emptyGrid },
};
function rows(on) {
  return Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => on(d, h)));
}

// ---- parental controls ---------------------------------------------------
// The router keeps one record per device in four parallel ">"-joined lists.
// A blocked-time slot is "W" + three hex day digits (bit 0 is Sunday) + a start
// and an end as HHMM; an end before the start runs overnight into the next morning.

export const COLUMN_KEYS = { mac: "MULTIFILTER_MAC", mode: "MULTIFILTER_ENABLE", name: "MULTIFILTER_DEVICENAME", daytime: "MULTIFILTER_MACFILTER_DAYTIME" };
export const ENTRY_IDS = { mac: "parental-pro.macs", mode: "parental-pro.modes", name: "parental-pro.names", daytime: "parental-pro.daytime" };

const TIME = /^([01]\d|2[0-3])[0-5]\d$/;
const SLOT = /^W([0-9A-F]{3})(\d{4})(\d{4})$/;
export const splitColumn = (value) => (value === "" || value === undefined || value === null ? [] : String(value).split(">"));

export function parseSlot(text) {
  const m = String(text).match(SLOT);
  if (!m) return null;
  const mask = parseInt(m[1], 16);
  if (mask < 1 || mask > 127 || !TIME.test(m[2]) || !TIME.test(m[3]) || m[2] === m[3]) return null;
  return { days: [0, 1, 2, 3, 4, 5, 6].filter((d) => mask & (1 << d)), start: m[2], end: m[3] };
}
export function formatSlot({ days, start, end }) {
  const mask = days.reduce((m, d) => m | (1 << d), 0);
  return `W${mask.toString(16).toUpperCase().padStart(3, "0")}${start}${end}`;
}
export const parseSlots = (item) => (item === "" ? [] : String(item).split("<").map(parseSlot).filter(Boolean));

// get(key) returns the list text for one MULTIFILTER_* key.
export function readDevices(get) {
  const lists = Object.fromEntries(Object.entries(COLUMN_KEYS).map(([name, key]) => [name, splitColumn(get(key))]));
  return lists.mac.map((mac, i) => ({ mac: mac.toUpperCase(), mode: lists.mode[i] || "0", name: lists.name[i] ?? "", slots: parseSlots(lists.daytime[i] ?? "") }));
}

// The four list values (by key). Devices whose mode is "0" are left out.
export function writeDevices(devices) {
  const kept = devices.filter((d) => d.mode !== "0");
  return {
    [COLUMN_KEYS.mac]: kept.map((d) => d.mac).join(">"),
    [COLUMN_KEYS.mode]: kept.map((d) => d.mode).join(">"),
    [COLUMN_KEYS.name]: kept.map((d) => d.name).join(">"),
    [COLUMN_KEYS.daytime]: kept.map((d) => d.slots.map(formatSlot).join("<")).join(">"),
  };
}

const minutes = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(2));

// Slots to a grid of blocked hours. `exact` is false when a window does not
// start and end on the hour, so the grid is only an estimate of it.
export function slotsToGrid(slots) {
  const grid = emptyGrid();
  let exact = true;
  const fill = (day, from, to) => {
    for (let h = 0; h < 24; h += 1) if (h * 60 < to && h * 60 + 60 > from) grid[day][h] = true;
  };
  for (const slot of slots) {
    const [start, end] = [minutes(slot.start), minutes(slot.end)];
    if (start % 60 !== 0 || (end % 60 !== 0 && end !== 1439)) exact = false;
    for (const day of slot.days) {
      if (start < end) fill(day, start, end);
      else {
        fill(day, start, 1440);
        fill((day + 1) % 7, 0, end);
      }
    }
  }
  return { grid, exact };
}

const hh = (hour) => `${String(hour).padStart(2, "0")}00`;

// A grid back to slots: each day's runs of blocked hours, with days that share
// a run joined into one slot. A run that reaches midnight ends at 23:59.
export function gridToSlots(grid) {
  const byRange = new Map();
  grid.forEach((row, day) => {
    for (let h = 0; h < 24; h += 1) {
      if (!row[h]) continue;
      let end = h;
      while (end + 1 < 24 && row[end + 1]) end += 1;
      const key = `${hh(h)}-${end === 23 ? "2359" : hh(end + 1)}`;
      byRange.set(key, [...(byRange.get(key) ?? []), day]);
      h = end;
    }
  });
  return [...byRange].map(([range, days]) => ({ days, start: range.slice(0, 4), end: range.slice(5) }));
}

// ---- Wi-Fi schedule text -------------------------------------------------
// "12345@08:00-17:00,06@10:00-12:00": days 0 (Sunday) to 6, then one time range
// within a day. At most 28 slots, and each must end after it starts.

export const MAX_WIFI_SLOTS = 28;
const WIFI_SLOT = /^([0-6]+)@([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;

export function scheduleToGrid(text) {
  const grid = emptyGrid();
  let exact = true;
  for (const slot of String(text ?? "").split(",").filter(Boolean)) {
    const m = slot.match(WIFI_SLOT);
    if (!m) {
      exact = false;
      continue;
    }
    const start = Number(m[2]) * 60 + Number(m[3]);
    const end = Number(m[4]) * 60 + Number(m[5]);
    if (start % 60 !== 0 || (end % 60 !== 0 && end !== 1439)) exact = false;
    for (const d of m[1]) for (let h = 0; h < 24; h += 1) if (h * 60 < end && h * 60 + 60 > start) grid[Number(d)][h] = true;
  }
  return { grid, exact };
}

// A grid to the schedule text, or "" when nothing is painted.
export function gridToSchedule(grid) {
  const byRange = new Map();
  grid.forEach((row, day) => {
    for (let h = 0; h < 24; h += 1) {
      if (!row[h]) continue;
      let end = h;
      while (end + 1 < 24 && row[end + 1]) end += 1;
      const key = `${String(h).padStart(2, "0")}:00-${end === 23 ? "23:59" : `${String(end + 1).padStart(2, "0")}:00`}`;
      byRange.set(key, [...(byRange.get(key) ?? []), day]);
      h = end;
    }
  });
  return [...byRange].map(([range, days]) => `${days.join("")}@${range}`).join(",");
}

// Painting. `paint(grid, cells, on)` sets a list of [day, hour] cells; `toggleDay` and `toggleHour`
// fill a whole row or column, or clear it when it is already full.
export function paint(grid, cells, on) {
  const next = cloneGrid(grid);
  for (const [d, h] of cells) if (next[d]?.[h] !== undefined) next[d][h] = on;
  return next;
}
export function toggleDay(grid, day) {
  const on = !grid[day].every(Boolean);
  return paint(grid, grid[day].map((_, h) => [day, h]), on);
}
export function toggleHour(grid, hour) {
  const on = !grid.every((row) => row[hour]);
  return paint(grid, grid.map((_, d) => [d, hour]), on);
}

// The cells from one corner to another, as a rectangle (for shift-extend with the keyboard).
export function rectangle([d1, h1], [d2, h2]) {
  const out = [];
  for (let d = Math.min(d1, d2); d <= Math.max(d1, d2); d += 1) for (let h = Math.min(h1, h2); h <= Math.max(h1, h2); h += 1) out.push([d, h]);
  return out;
}

// Moving the focus with the arrow keys, wrapping within the grid.
export function moveFocus([d, h], key) {
  if (key === "ArrowRight") return [d, (h + 1) % 24];
  if (key === "ArrowLeft") return [d, (h + 23) % 24];
  if (key === "ArrowDown") return [(d + 1) % 7, h];
  if (key === "ArrowUp") return [(d + 6) % 7, h];
  if (key === "Home") return [d, 0];
  if (key === "End") return [d, 23];
  return [d, h];
}
