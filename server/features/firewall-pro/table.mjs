// The "rule-table" control: a list of rules the router keeps in one setting as
// "<a>b>c<d>e>f" (one "<" per rule, one ">" between its fields). The entry
// describes its fields in `columns`; this file checks a value against them and
// can make a valid example, so the control check can prove it.
//
// Column fields: id, label, cell (text, select, switch, number, kbps, port,
// ipv4, ipv6, device), optional, max (text length or number maximum), min,
// unit, options, pattern, patternHint, example (a text with {n} in it).
//
// qos-pro uses this same control type too; it is provided here once.
import { formatRows, isIpv4, isMac, parseRows } from "../kit.mjs";

export function validIpv6(text, { prefix = true } = {}) {
  const m = String(text).match(/^([0-9A-Fa-f:]+)(?:\/(\d{1,3}))?$/);
  if (!m) return false;
  if (m[2] !== undefined && (!prefix || Number(m[2]) > 128)) return false;
  const address = m[1];
  if (!address.includes(":") || address.includes(":::")) return false;
  const group = (g) => /^[0-9A-Fa-f]{1,4}$/.test(g);
  const halves = address.split("::");
  if (halves.length > 2) return false;
  if (halves.length === 1) {
    const groups = address.split(":");
    return groups.length === 8 && groups.every(group);
  }
  const parts = halves.flatMap((half) => (half === "" ? [] : half.split(":")));
  return parts.length <= 7 && parts.every(group);
}

const PORT = /^(\d{1,5})(?::(\d{1,5}))?$/;

function checkCell(column, raw, fail, row) {
  const label = column.label?.en ?? column.id;
  const where = `rule ${row + 1}, ${label}`;
  const value = String(raw ?? "");
  if (value === "") {
    if (column.optional) return "";
    fail(`${where}: fill this in.`);
  }
  switch (column.cell) {
    case "select":
      if (!column.options.some(([v]) => v === value)) fail(`${where}: choose one of the listed options.`);
      return value;
    case "switch":
      if (value !== "0" && value !== "1") fail(`${where}: choose on or off.`);
      return value;
    case "number":
    case "kbps": {
      const n = Number(value);
      const [lo, hi] = [column.min ?? 0, column.max ?? 10000000];
      if (!/^\d{1,9}$/.test(value) || n < lo || n > hi) fail(`${where}: enter a whole number from ${lo} to ${hi}.`);
      return String(n);
    }
    case "port": {
      const m = value.match(PORT);
      const lo = m ? Number(m[1]) : 0;
      const hi = m ? Number(m[2] ?? m[1]) : 0;
      if (!m || lo < 1 || hi > 65535 || lo > hi) fail(`${where}: enter a port from 1 to 65535, or a range such as 8000:8010.`);
      return value;
    }
    case "ipv4":
      if (!isIpv4(value)) fail(`${where}: enter an IPv4 address such as 198.51.100.20.`);
      return value;
    case "ipv6":
      if (!validIpv6(value)) fail(`${where}: enter an IPv6 address such as 2001:db8::10, optionally with a /prefix.`);
      return value;
    case "device": {
      if (isIpv4(value)) return value;
      if (isMac(value)) return value.toUpperCase();
      return fail(`${where}: enter a device's IPv4 address or MAC address.`);
    }
    default: {
      // text
      if (value.length > (column.max ?? 32)) fail(`${where}: use ${column.max ?? 32} characters or fewer.`);
      if (/[\x00-\x1f<>]/.test(value)) fail(`${where}: remove line breaks and the < and > characters.`);
      if (column.pattern && !new RegExp(column.pattern).test(value)) fail(`${where}: ${column.patternHint ?? "that is not an allowed value."}`);
      return value;
    }
  }
}

function exampleCell(column, n) {
  const fill = (text) => text.replaceAll("{n}", String(n + 1));
  switch (column.cell) {
    case "select":
      return column.options[n % column.options.length][0];
    case "switch":
      return n % 2 ? "0" : "1";
    case "number":
    case "kbps":
      return String(Math.min(column.max ?? 10000000, (column.min ?? 0) + 1000 * (n + 1)));
    case "port":
      return String([8080, 8443, 3000, 5000][n % 4]);
    case "ipv4":
      return `198.51.100.${150 + n}`;
    case "ipv6":
      return fill(column.example ?? "2001:db8::{n}");
    case "device":
      return `198.51.100.${120 + n}`;
    default:
      return fill(column.example ?? "sample{n}");
  }
}

export const sampleRow = (columns, n) => columns.map((column) => (column.optional && column.example === "" ? "" : exampleCell(column, n)));

export const ruleTable = {
  validate(entry, text, fail) {
    if (text === "") return "";
    if (!text.startsWith("<")) fail("the list is not in the router's format. Use the rule editor instead of typing it.");
    const rows = parseRows(text);
    const max = entry.maxItems ?? 32;
    if (rows.length > max) fail(`use at most ${max} rules.`);
    const out = rows.map((cells, row) => {
      if (cells.length !== entry.columns.length) fail(`rule ${row + 1} has ${cells.length} fields but needs ${entry.columns.length}.`);
      return entry.columns.map((column, i) => checkCell(column, cells[i], fail, row));
    });
    if (entry.unique) {
      const seen = new Set(out.map((cells) => cells[0].toLowerCase()));
      if (seen.size !== out.length) fail("remove the repeated entry.");
    }
    return formatRows(out);
  },
  sample(entry, current) {
    const rows = parseRows(current);
    if (rows.length < (entry.maxItems ?? 32)) rows.push(sampleRow(entry.columns, rows.length));
    else rows.shift();
    return formatRows(rows);
  },
  invalid: () => "not-a-rule-list",
};
