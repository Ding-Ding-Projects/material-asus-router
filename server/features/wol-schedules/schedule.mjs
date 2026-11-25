// Wake-on-LAN schedules: parsing, checking and deciding what is due. Pure
// functions, so the timing logic can be tested with any clock.

const TIME = "([01]\\d|2[0-3]):[0-5]\\d";
const SLOT = new RegExp(`^([0-6]+)@(${TIME})-(${TIME})$`);
const minutes = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));

// "12345@08:00-17:00,06@10:00-12:00": days 0 (Sunday) to 6, then the time range. A device is woken
// at the start of each range.
export function parseSpec(spec) {
  const text = String(spec ?? "").trim();
  const slots = text.split(",");
  if (!text || slots.length > 28) throw Object.assign(new Error("Paint between 1 and 28 time blocks in the week."), { status: 400 });
  return slots.map((slot) => {
    const m = slot.match(SLOT);
    if (!m) throw Object.assign(new Error(`"${slot}" is not a time block. Use days 0 to 6, then @ and a range, such as 12345@08:00-17:00.`), { status: 400 });
    if (new Set(m[1]).size !== m[1].length) throw Object.assign(new Error(`"${slot}" repeats a day.`), { status: 400 });
    if (minutes(m[2]) >= minutes(m[4])) throw Object.assign(new Error(`"${slot}" must end after it starts.`), { status: 400 });
    return { days: [...m[1]].map(Number), start: m[2], end: m[4] };
  });
}

export const pad = (n) => String(n).padStart(2, "0");
export const clock = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Every enabled schedule with a block that starts at this very minute. The key makes a block fire once
// per day even when the timer ticks several times within the minute.
export function dueAt(schedules, date) {
  const now = clock(date);
  const day = date.getDay();
  const due = [];
  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    let slots;
    try {
      slots = parseSpec(schedule.spec);
    } catch {
      continue;
    }
    if (slots.some((s) => s.days.includes(day) && s.start === now)) due.push({ schedule, key: `${schedule.id}:${dayKey(date)}:${now}` });
  }
  return due;
}

// The next time any block of this schedule starts, within a week, or null.
export function nextWake(spec, from) {
  let slots;
  try {
    slots = parseSpec(spec);
  } catch {
    return null;
  }
  for (let ahead = 0; ahead <= 7; ahead += 1) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + ahead);
    const starts = slots.filter((s) => s.days.includes(day.getDay())).map((s) => s.start).sort();
    for (const start of starts) {
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(start.slice(0, 2)), Number(start.slice(3, 5)));
      if (at > from) return at;
    }
  }
  return null;
}
