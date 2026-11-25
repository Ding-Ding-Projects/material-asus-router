// Scheduled settings. A rule says "between these times, on these days, use this
// language, theme, density, colour, font or motion". Rules are checked in the
// rule's own time zone with the browser's calendar data, so daylight saving
// changes and windows that run past midnight behave the way a clock does.
// Precedence is plain and deterministic: the rule nearest the top of the list
// wins for each setting it sets.
//
// Rule schema (version 1), at most 40 rules:
//   { id, name, enabled, source: "local" | "api" | "ha",
//     days: [0..6] (0 = Sunday; empty means every day),
//     allDay: false, start: "HH:MM", end: "HH:MM",
//     tz: "local" or an IANA zone such as "Asia/Hong_Kong",
//     from: "YYYY-MM-DD" or "", to: "YYYY-MM-DD" or "",
//     apply: { language?, theme?, density?, accent?, font?, motion? } }
// A rule from "api" or "ha" is active while its external source says so; an API
// answer may also carry the settings to use.

export const SETTINGS = Object.freeze({
  language: ["en", "yue", "both"],
  theme: ["auto", "light", "dark"],
  density: ["comfortable", "compact"],
  font: ["default", "large", "system"],
  motion: ["full", "reduced"],
});
export const SETTING_KEYS = [...Object.keys(SETTINGS), "accent"];
export const MAX_RULES = 40;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

export const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function validZone(tz) {
  if (tz === "local" || tz === "" || tz === undefined) return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateRule(input) {
  const errors = [];
  const r = input && typeof input === "object" ? input : {};
  const name = typeof r.name === "string" ? r.name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60) : "";
  if (!name) errors.push("name");
  const source = ["local", "api", "ha"].includes(r.source) ? r.source : "local";
  const days = Array.isArray(r.days) ? [...new Set(r.days.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort() : [];
  if (Array.isArray(r.days) && days.length !== new Set(r.days.map(Number)).size) errors.push("days");
  const allDay = r.allDay === true;
  if (source === "local" && !allDay) {
    if (!TIME.test(r.start ?? "") || !TIME.test(r.end ?? "")) errors.push("time");
    else if (r.start === r.end) errors.push("same-time");
  }
  const tz = !r.tz || r.tz === "local" ? "local" : String(r.tz);
  if (!validZone(tz)) errors.push("tz");
  const from = r.from ? String(r.from) : "";
  const to = r.to ? String(r.to) : "";
  for (const d of [from, to]) if (d && (!DATE.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`)))) errors.push("date");
  if (from && to && from > to) errors.push("date-order");
  const apply = {};
  for (const [key, value] of Object.entries(r.apply ?? {})) {
    if (key === "accent") {
      if (!HEX.test(value)) errors.push("accent");
      else apply.accent = value.toLowerCase();
    } else if (SETTINGS[key]) {
      if (!SETTINGS[key].includes(value)) errors.push(key);
      else apply[key] = value;
    } else errors.push(`unknown:${key}`);
  }
  if (!Object.keys(apply).length && source === "local") errors.push("apply");
  const id = typeof r.id === "string" && /^[a-z0-9-]{1,40}$/.test(r.id) ? r.id : "";
  if (!id) errors.push("id");
  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    rule: { id, name, enabled: r.enabled !== false, source, days, allDay, start: TIME.test(r.start ?? "") ? r.start : "08:00", end: TIME.test(r.end ?? "") ? r.end : "17:00", tz, from, to, apply },
  };
}

export function newRuleId(existing, random = Math.random) {
  for (;;) {
    const id = `r-${Math.floor(random() * 36 ** 6).toString(36).padStart(6, "0")}`;
    if (!existing.some((r) => r.id === id)) return id;
  }
}

const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
// The wall-clock reading in a zone: date text, weekday and minutes since midnight.
export function zoned(date, tz) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: !tz || tz === "local" ? undefined : tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday: WEEKDAY[get("weekday")], minutes: hour * 60 + Number(get("minute")) };
}
const previousDate = (ymd) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
const inRange = (rule, ymd) => (!rule.from || ymd >= rule.from) && (!rule.to || ymd <= rule.to);
const dayOk = (rule, weekday) => rule.days.length === 0 || rule.days.includes(weekday);

// Is the clock window of a rule open at this instant? A window that ends before
// it starts runs past midnight and belongs to the day it started on.
export function windowOpen(rule, date) {
  const z = zoned(date, rule.tz);
  if (rule.allDay) return dayOk(rule, z.weekday) && inRange(rule, z.date);
  const start = minutesOf(rule.start);
  const end = minutesOf(rule.end);
  if (start < end) return dayOk(rule, z.weekday) && inRange(rule, z.date) && z.minutes >= start && z.minutes < end;
  if (z.minutes >= start) return dayOk(rule, z.weekday) && inRange(rule, z.date);
  if (z.minutes < end) return dayOk(rule, (z.weekday + 6) % 7) && inRange(rule, previousDate(z.date));
  return false;
}

// ext: { api: { active, settings, validUntil, stale }, ha: { active, stale } } from the last good answers.
export function ruleActive(rule, date, ext = {}) {
  if (!rule.enabled) return false;
  if (rule.source === "local") return windowOpen(rule, date);
  const answer = ext[rule.source];
  if (!answer || answer.active !== true) return false;
  if (answer.validUntil && Date.parse(answer.validUntil) <= date.getTime()) return false;
  return true;
}

// Which rules are active and which value each setting should have.
export function resolve(rules, date, ext = {}) {
  const active = [];
  const values = {};
  for (const rule of rules) {
    if (!ruleActive(rule, date, ext)) continue;
    active.push(rule.id);
    const fromApi = rule.source === "api" ? ext.api?.settings ?? {} : {};
    for (const [key, value] of Object.entries({ ...rule.apply, ...fromApi })) if (!(key in values)) values[key] = { value, rule: rule.id };
  }
  return { active, values };
}

// Compares the settings now in force with the ones the rules ask for and returns
// what to apply and what to restore, so a rule never becomes the permanent base:
// when it stops being active the person's own value comes back.
// "previous" holds the values the last check asked for: a rule is applied when
// it switches on or changes, never re-forced against a change the person makes
// while it is active.
export function plan({ values, base, current, previous = {} }) {
  const apply = {};
  const restore = {};
  const nextBase = { ...(base ?? {}) };
  for (const [key, { value }] of Object.entries(values)) {
    if (!(key in nextBase)) nextBase[key] = current[key];
    if (current[key] !== value && previous[key] !== value) apply[key] = value;
  }
  for (const key of Object.keys(nextBase)) {
    if (!(key in values)) {
      restore[key] = nextBase[key];
      delete nextBase[key];
    }
  }
  for (const key of Object.keys(restore)) if (current[key] === restore[key]) delete restore[key];
  return { apply, restore, base: Object.keys(nextBase).length ? nextBase : null };
}

// How long until the next clock boundary of any local rule, so the page can
// re-check on time without polling fast. Capped at a minute.
export const CHECK_MS = 30000;

export const timeZones = () => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC", "Asia/Hong_Kong", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney"];
  }
};
