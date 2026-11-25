// The parental-controls data model, shared by the screen and by the tests. It
// imports nothing, so a Node test can import it and compare it with the
// server's own copy (server/features/parental-pro/columns.mjs).
//
// The router keeps one record per device in four parallel ">"-joined lists.
// A blocked-time slot is "W" + three hex day digits (bit 0 is Sunday) + a start
// and an end as HHMM; an end before the start runs overnight into the next
// morning. The screen edits whole hours, as a 7 by 24 grid of blocked cells.

export const COLUMN_KEYS = { mac: "MULTIFILTER_MAC", mode: "MULTIFILTER_ENABLE", name: "MULTIFILTER_DEVICENAME", daytime: "MULTIFILTER_MACFILTER_DAYTIME" };
export const ENTRY_IDS = { mac: "parental-pro.macs", mode: "parental-pro.modes", name: "parental-pro.names", daytime: "parental-pro.daytime" };

const TIME = /^([01]\d|2[0-3])[0-5]\d$/;
const SLOT = /^W([0-9A-F]{3})(\d{4})(\d{4})$/;

export const splitColumn = (value) => (value === "" || value === undefined || value === null ? [] : String(value).split(">"));
export const joinColumn = (items) => items.join(">");

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

// Four list values (by key) for a set of devices; devices with mode "0" are left out.
export function writeDevices(devices) {
  const kept = devices.filter((d) => d.mode !== "0");
  return {
    [COLUMN_KEYS.mac]: joinColumn(kept.map((d) => d.mac)),
    [COLUMN_KEYS.mode]: joinColumn(kept.map((d) => d.mode)),
    [COLUMN_KEYS.name]: joinColumn(kept.map((d) => d.name)),
    [COLUMN_KEYS.daytime]: joinColumn(kept.map((d) => d.slots.map(formatSlot).join("<"))),
  };
}

const minutes = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(2));

// Slots to a 7 by 24 grid of blocked hours (Sunday first). `exact` is false when
// a window does not start and end on the hour, so the grid is only an estimate.
export function slotsToGrid(slots) {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(false));
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

export const blockedHours = (grid) => grid.flat().filter(Boolean).length;

// A short readable summary of a slot, for lists: "Mon, Tue 21:00-07:00".
export function describeSlot(slot, names) {
  const time = (text) => `${text.slice(0, 2)}:${text.slice(2)}`;
  return `${slot.days.map((d) => names[d]).join(", ")} ${time(slot.start)}-${time(slot.end)}`;
}

// A good starting schedule when a device first gets a time-based rule: every night.
export const NIGHTLY = [{ days: [0, 1, 2, 3, 4, 5, 6], start: "2200", end: "0700" }];
