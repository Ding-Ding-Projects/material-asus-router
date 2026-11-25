// What every control type means on the server: how a value is checked, a
// valid example value and a refused one. The change engine uses validate()
// (through catalog.mjs); tests/real-controls.test.mjs uses sample() and
// invalid() to prove each catalogue entry can really be read, changed, applied
// and undone.
//
// The stock types (switch, select, number, slider, ipv4, hostname, text,
// password) are checked by validate() in catalog.mjs; this file adds their
// examples plus the richer types below. A feature adds a brand new type with
// `controls: { name: { validate, sample, invalid } }` in its own folder.
import { featureControl } from "../features/registry.mjs";
import { isIpv4, isMac } from "./shell.mjs";

export const ipToNumber = (ip) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);
export const numberToIp = (n) => [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join(".");

const other = (candidates, current) => candidates.find((c) => String(c) !== String(current)) ?? candidates[0];
const sized = (entry, base, fill = "x") => {
  let text = base.slice(0, entry.maxLength ?? 256);
  while (text.length < (entry.minLength ?? 0)) text += fill;
  return text;
};

const CHIP_TOKEN = /^[A-Za-z0-9._-]{1,32}$/;
const TIME = "([01]\\d|2[0-3]):[0-5]\\d";
const SLOT = new RegExp(`^([0-6]+)@(${TIME})-(${TIME})$`);

function minutes(text) {
  const [h, m] = text.split(":").map(Number);
  return h * 60 + m;
}

// ---- the richer types ------------------------------------------------------

const RICH = {
  stepper: {
    validate(entry, text, fail) {
      const n = Number(text);
      if (!Number.isInteger(n) || n < entry.min || n > entry.max) fail(`enter a whole number from ${entry.min} to ${entry.max}.`);
      return String(n);
    },
  },
  cidr: {
    validate(entry, text, fail) {
      if (entry.optional && text === "") return "";
      const m = text.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
      const prefix = m ? Number(m[2]) : -1;
      if (!m || !isIpv4(m[1]) || prefix < (entry.minPrefix ?? 0) || prefix > (entry.maxPrefix ?? 32)) fail(`enter an address with a prefix such as 198.51.100.0/24 (prefix ${entry.minPrefix ?? 0} to ${entry.maxPrefix ?? 32}).`);
      if (entry.network) {
        const host = prefix === 32 ? 0 : ipToNumber(m[1]) & (2 ** (32 - prefix) - 1);
        if (host !== 0) fail("the address must be the first address of its network, such as 198.51.100.0/24.");
      }
      return text;
    },
    sample: (entry, current) => other(["198.51.100.0/24", "198.51.100.0/25", "203.0.113.0/24"].filter((v) => (entry.minPrefix ?? 0) <= Number(v.split("/")[1]) && Number(v.split("/")[1]) <= (entry.maxPrefix ?? 32)), current),
    invalid: () => "300.1.1.1/40",
  },
  port: {
    validate(entry, text, fail) {
      if (entry.optional && text === "") return "";
      const single = text.match(/^\d{1,5}$/);
      const range = entry.allowRange ? text.match(/^(\d{1,5}):(\d{1,5})$/) : null;
      const [lo, hi] = single ? [Number(text), Number(text)] : range ? [Number(range[1]), Number(range[2])] : [0, 0];
      const min = entry.min ?? 1;
      const max = entry.max ?? 65535;
      if ((!single && !range) || lo < min || hi > max || lo > hi) fail(`enter a port from ${min} to ${max}${entry.allowRange ? ", or a range such as 8000:8010" : ""}.`);
      return text;
    },
    sample: (entry, current) => other([entry.presets?.[0]?.[0] ?? "8080", "8443", "3000", String(entry.min ?? 1)].map(String), current),
    invalid: () => "70000",
  },
  mac: {
    validate(entry, text, fail) {
      if (entry.optional && text === "") return "";
      const value = text.toUpperCase();
      if (!isMac(value)) fail("enter a MAC address such as AA:BB:CC:DD:EE:FF.");
      return value;
    },
    sample: (_entry, current) => other(["02:00:00:00:00:01", "02:00:00:00:00:02"], String(current).toUpperCase()),
    invalid: () => "not-a-mac",
  },
  schedule: {
    // Days 0 (Sunday) to 6, an @, then a start and end time: "12345@08:00-17:00,06@10:00-12:00".
    validate(entry, text, fail) {
      if (entry.optional && text === "") return "";
      const slots = text.split(",");
      if (!text || slots.length > 28) fail("enter between 1 and 28 time slots such as 12345@08:00-17:00.");
      for (const slot of slots) {
        const m = slot.match(SLOT);
        if (!m) fail(`"${slot}" is not a time slot. Use days 0 to 6, then @ and a time range, such as 12345@08:00-17:00.`);
        if (new Set(m[1]).size !== m[1].length) fail(`"${slot}" repeats a day.`);
        if (minutes(m[2]) >= minutes(m[4])) fail(`"${slot}" must end after it starts.`);
      }
      return text;
    },
    sample: (_entry, current) => other(["12345@08:00-17:00", "06@10:00-12:00,12345@18:00-22:00"], current),
    invalid: () => "9@25:00-26:00",
  },
  range: {
    // Two IPv4 addresses with a dash: "198.51.100.100-198.51.100.199".
    validate(entry, text, fail) {
      if (entry.optional && text === "") return "";
      const parts = text.split("-");
      if (parts.length !== 2 || !parts.every(isIpv4)) fail("enter two IPv4 addresses with a dash, such as 198.51.100.100-198.51.100.199.");
      const [lo, hi] = parts.map(ipToNumber);
      if (lo > hi) fail("the first address must not be after the last address.");
      if (entry.within) {
        const [base, prefix] = entry.within.split("/");
        const size = 2 ** (32 - Number(prefix));
        const start = ipToNumber(base) - (ipToNumber(base) % size);
        if (lo < start || hi >= start + size) fail(`both addresses must be inside ${entry.within}.`);
      }
      return text;
    },
    sample: (entry, current) => {
      const base = entry.within ? entry.within.split("/")[0].split(".").slice(0, 3).join(".") : "198.51.100";
      return other([`${base}.50-${base}.99`, `${base}.60-${base}.120`], current);
    },
    invalid: () => "198.51.100.200-198.51.100.100",
  },
  chips: {
    validate(entry, text, fail) {
      if (entry.optional && text === "") return "";
      const delimiter = entry.delimiter ?? ",";
      const items = text === "" ? [] : text.split(delimiter);
      if (!items.length && !entry.optional) fail("add at least one item.");
      if (items.length > (entry.maxItems ?? 20)) fail(`use at most ${entry.maxItems ?? 20} items.`);
      if (new Set(items).size !== items.length) fail("remove the repeated item.");
      const pattern = entry.pattern ? new RegExp(entry.pattern) : CHIP_TOKEN;
      const allowed = entry.options ? new Set(entry.options.map(([v]) => v)) : null;
      for (const item of items) if (allowed ? !allowed.has(item) : !pattern.test(item)) fail(`"${item}" is not an allowed item.`);
      return text;
    },
    sample: (entry, current) => {
      const delimiter = entry.delimiter ?? ",";
      const pool = entry.options ? entry.options.map(([v]) => v) : ["alpha", "beta"];
      return other([pool.slice(0, 1).join(delimiter), pool.slice(0, 2).join(delimiter)], current);
    },
    invalid: (entry) => (entry.options ? "__not-an-option__" : "bad item!"),
  },
  color: {
    validate(entry, text, fail) {
      if (entry.optional && text === "") return "";
      if (!/^#[0-9a-fA-F]{6}$/.test(text)) fail("choose a colour, written like #3366cc.");
      return text.toLowerCase();
    },
    sample: (_entry, current) => other(["#3366cc", "#cc6633"], String(current).toLowerCase()),
    invalid: () => "blue",
  },
  file: {
    // A dropped file arrives as one line of text (for example base64).
    validate(entry, text, fail) {
      if (entry.optional && text === "") return "";
      const max = entry.maxLength ?? 8192;
      if (!text || text.length > max) fail(`the file content must be 1 to ${max} characters.`);
      if (/[\x00-\x1f]/.test(text)) fail("the file content cannot contain line breaks or control characters.");
      if (entry.encoding === "base64" && !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) fail("the file content is not valid base64.");
      return text;
    },
    sample: (entry, current) => other(entry.encoding === "base64" ? ["c2FtcGxlLWE=", "c2FtcGxlLWI="] : ["sample-a", "sample-b"], current),
    invalid: () => "bad\x01content",
  },
};
RICH.device = { ...RICH.mac };

// ---- examples for the stock types -----------------------------------------

const STOCK = {
  switch: { sample: (e, current) => (current === e.values.on ? e.values.off : e.values.on), invalid: () => "maybe" },
  select: { sample: (e, current) => other(e.options.map(([v]) => v), current), invalid: () => "__not-an-option__" },
  number: { sample: (e, current) => other([e.min, e.max, Math.round((e.min + e.max) / 2)], current), invalid: (e) => String(e.max + 1) },
  slider: { sample: (e, current) => other([e.min, e.max, Math.round((e.min + e.max) / 2)], current), invalid: (e) => String(e.max + 1) },
  ipv4: { sample: (_e, current) => other(["198.51.100.77", "198.51.100.78"], current), invalid: () => "999.1.1.1" },
  hostname: { sample: (_e, current) => other(["example-host.test", "example-two.test"], current), invalid: () => "not a host!" },
  text: { sample: (e, current) => other([sized(e, "Sample A"), sized(e, "Sample B")], current), invalid: () => "<bad>" },
  password: { sample: (e, current) => other([sized(e, "sample-pass-1234"), sized(e, "sample-pass-5678")], current), invalid: (e) => ((e.minLength ?? 0) > 0 ? "x".repeat(e.minLength - 1) : "<bad>") },
};
STOCK.segmented = STOCK.select;
STOCK.stepper = STOCK.number;

// The definition of a control type: stock examples, rich checks and anything a
// feature provides, merged (a feature's own functions win).
export function controlFor(type) {
  const parts = [STOCK[type], RICH[type], featureControl(type)].filter(Boolean);
  return parts.length ? Object.assign({}, ...parts) : null;
}

// Validates a value with a rich or feature-provided control type. Returns
// undefined for a type it does not know, so the caller can refuse it.
export function validateExtra(entry, text, fail) {
  const control = featureControl(entry.control) ?? RICH[entry.control];
  if (!control?.validate) return undefined;
  return control.validate(entry, text, fail);
}

export const knownControlTypes = () => [...new Set([...Object.keys(STOCK), ...Object.keys(RICH)])];
export const sampleValue = (entry, current) => String(controlFor(entry.control).sample(entry, current ?? ""));
export const invalidValue = (entry) => controlFor(entry.control)?.invalid?.(entry) ?? null;
