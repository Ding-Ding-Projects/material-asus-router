// The weekly grid as data. A grid is 7 days (0 = Sunday) of 48 half-hour cells.
// A schedule is the same text the router's own schedule control uses:
// "12345@08:00-17:00,6@10:00-12:00". Painted blocks wake the device at their start.

export const CELLS = 48;
export const DAYS = 7;
export const emptyGrid = () => Array.from({ length: DAYS }, () => new Array(CELLS).fill(false));

const clock = (cells) => {
  const minutes = Math.min(cells * 30, 24 * 60 - 1); // the last cell of the day ends at 23:59
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};
const cellOf = (time, up) => {
  const m = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  return up ? Math.min(CELLS, Math.ceil(m / 30)) : Math.floor(m / 30);
};

// The runs of painted cells in one day: [[firstCell, endCell], ...] with endCell exclusive.
export function runsOf(day) {
  const runs = [];
  let start = -1;
  day.forEach((on, i) => {
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      runs.push([start, i]);
      start = -1;
    }
  });
  if (start >= 0) runs.push([start, day.length]);
  return runs;
}

// Days with identical runs share one slot, so "Monday to Friday 08:00-17:00" is one block of text.
export function gridToSpec(grid) {
  const groups = new Map();
  grid.forEach((day, d) => {
    for (const [a, b] of runsOf(day)) {
      const key = `${clock(a)}-${clock(b)}`;
      groups.set(key, [...(groups.get(key) ?? []), d]);
    }
  });
  return [...groups].map(([key, days]) => `${days.join("")}@${key}`).join(",");
}

export function specToGrid(spec) {
  const grid = emptyGrid();
  for (const slot of String(spec ?? "").split(",").filter(Boolean)) {
    const m = slot.match(/^([0-6]+)@(\d\d:\d\d)-(\d\d:\d\d)$/);
    if (!m) continue;
    const from = cellOf(m[2], false);
    const to = cellOf(m[3], true);
    for (const d of m[1]) for (let c = from; c < to; c += 1) grid[Number(d)][c] = true;
  }
  return grid;
}

export const slotCount = (spec) => (spec ? spec.split(",").length : 0);

// "Mon to Fri 08:00" style text for the list, built from the grid's own blocks.
const NAMES = [["Sun", "日"], ["Mon", "一"], ["Tue", "二"], ["Wed", "三"], ["Thu", "四"], ["Fri", "五"], ["Sat", "六"]];
export function describe(spec, t) {
  return String(spec ?? "").split(",").filter(Boolean).map((slot) => {
    const m = slot.match(/^([0-6]+)@(\d\d:\d\d)-(\d\d:\d\d)$/);
    if (!m) return slot;
    const days = [...m[1]].map(Number);
    return `${days.map((d) => t(NAMES[d][0], NAMES[d][1])).join(" ")} ${m[2]}`;
  }).join(" · ");
}

export const PRESETS = [
  { id: "weekdays", label: { en: "Weekdays 08:00 to 17:00", yue: "平日 08:00 至 17:00" }, spec: "12345@08:00-17:00" },
  { id: "every-day", label: { en: "Every day 07:00 to 23:00", yue: "每日 07:00 至 23:00" }, spec: "0123456@07:00-23:00" },
  { id: "weekend", label: { en: "Weekends 09:00 to 22:00", yue: "週末 09:00 至 22:00" }, spec: "06@09:00-22:00" },
];
