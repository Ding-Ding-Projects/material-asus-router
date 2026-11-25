// The router keeps per-device parental controls as four parallel lists, one
// item per device, joined with ">":
//   MULTIFILTER_MAC                 the device's MAC address
//   MULTIFILTER_ENABLE              0 off, 1 blocked on a schedule, 2 blocked always
//   MULTIFILTER_DEVICENAME          a name to show
//   MULTIFILTER_MACFILTER_DAYTIME   the blocked time windows ("slots")
//
// A slot is "W" + the days as three hex digits (bit 0 is Sunday, bit 6 is
// Saturday) + the start as HHMM + the end as HHMM. A start after the end means
// the window runs overnight into the next morning, so "W03E21000700" is
// Monday to Friday, 21:00 to 07:00. Several slots in one device's item are
// joined with "<".
//
// The slot form was reconstructed from router output, not from the firmware
// source, and has not been checked on hardware; the entry says so.
import { isMac } from "../kit.mjs";

export const COLUMN_KEYS = { mac: "MULTIFILTER_MAC", mode: "MULTIFILTER_ENABLE", name: "MULTIFILTER_DEVICENAME", daytime: "MULTIFILTER_MACFILTER_DAYTIME" };
export const MAX_DEVICES = 64;

const TIME = /^([01]\d|2[0-3])[0-5]\d$/;
const SLOT = /^W([0-9A-F]{3})(\d{4})(\d{4})$/;
export const MODES = ["0", "1", "2"];

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

export const parseSlots = (item) => (item === "" ? [] : String(item).split("<").map(parseSlot));

const ITEM = {
  mac: {
    check: (v, fail) => (isMac(v) ? v.toUpperCase() : fail(`"${v}" is not a MAC address such as AA:BB:CC:DD:EE:FF.`)),
    sample: (n) => `02:00:00:00:00:${(n + 1).toString(16).padStart(2, "0").toUpperCase()}`,
    invalid: "not-a-mac",
    unique: true,
  },
  mode: {
    check: (v, fail) => (MODES.includes(v) ? v : fail(`"${v}" is not a mode. Use 0, 1 or 2.`)),
    sample: (n) => ["2", "1"][n % 2],
    invalid: "7",
  },
  name: {
    check: (v, fail) => (v.length > 32 || /[\x00-\x1f<>]/.test(v) ? fail("a device name is 32 characters or fewer, with no < or > characters.") : v),
    sample: (n) => `Device ${n + 1}`,
    invalid: "<bad>",
  },
  daytime: {
    check(v, fail) {
      if (v === "") return "";
      const slots = parseSlots(v);
      if (slots.length > 8 || slots.includes(null)) return fail(`"${v}" is not a list of time windows. Each is W, three hex day digits, a start and an end (HHMM), such as W03E21000700.`);
      return slots.map(formatSlot).join("<");
    },
    sample: (n) => ["W03E21000700", "W04122000800"][n % 2],
    invalid: "W9999999999",
  },
};

export const columnList = {
  validate(entry, text, fail) {
    const item = ITEM[entry.item];
    if (text === "") return "";
    const items = splitColumn(text);
    if (items.length > MAX_DEVICES) fail(`use at most ${MAX_DEVICES} devices.`);
    const out = items.map((v) => item.check(v, fail));
    if (item.unique && new Set(out).size !== out.length) fail("remove the repeated device.");
    return joinColumn(out);
  },
  sample(entry, current) {
    const item = ITEM[entry.item];
    const items = splitColumn(current);
    if (items.length < MAX_DEVICES) items.push(item.sample(items.length));
    else items.pop();
    return joinColumn(items);
  },
  invalid: (entry) => ITEM[entry.item].invalid,
};

// Reads the four lists into one record per device. A short list is padded with
// empty items, the way the router's own page tolerates it.
export function readDevices(get) {
  const lists = Object.fromEntries(Object.entries(COLUMN_KEYS).map(([name, key]) => [name, splitColumn(get(key))]));
  return lists.mac.map((mac, i) => ({
    mac: mac.toUpperCase(),
    mode: lists.mode[i] || "0",
    name: lists.name[i] ?? "",
    slots: parseSlots(lists.daytime[i] ?? "").filter(Boolean),
  }));
}

// Builds the four list values for a set of devices.
export function writeDevices(devices) {
  return {
    [COLUMN_KEYS.mac]: joinColumn(devices.map((d) => d.mac)),
    [COLUMN_KEYS.mode]: joinColumn(devices.map((d) => d.mode)),
    [COLUMN_KEYS.name]: joinColumn(devices.map((d) => d.name)),
    [COLUMN_KEYS.daytime]: joinColumn(devices.map((d) => d.slots.map(formatSlot).join("<"))),
  };
}
