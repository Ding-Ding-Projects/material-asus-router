// Checks and examples for list settings stored as "<a>b>c<d>e>f": each row
// starts with "<" and its cells are separated by ">". The columns come from
// the entry's `columns` list, so one checker serves every table in a feature.
// (Each feature folder keeps its own copy because a feature may import only
// the kit and its own files.)
import { isIpv4, isMac } from "../kit.mjs";

const HOST = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?)*$/;

// Checks one cell and returns the text to store.
function cell(column, value, fail, where) {
  const text = String(value);
  const name = `${where}, ${column.label.en}`;
  if (text === "") {
    if (column.optional) return "";
    fail(`${name}: enter a value.`);
  }
  switch (column.kind) {
    case "ipv4":
      if (!isIpv4(text)) fail(`${name}: enter an IPv4 address such as 198.51.100.20.`);
      return text;
    case "mac":
      if (!isMac(text.toUpperCase())) fail(`${name}: enter a MAC address such as AA:BB:CC:DD:EE:FF.`);
      return text.toUpperCase();
    case "port": {
      const m = text.match(/^(\d{1,5})(?::(\d{1,5}))?$/);
      const lo = m ? Number(m[1]) : 0;
      const hi = m ? Number(m[2] ?? m[1]) : 0;
      if (!m || (m[2] && !column.allowRange) || lo < 1 || hi > 65535 || lo > hi) fail(`${name}: enter a port from 1 to 65535${column.allowRange ? " or a range such as 8000:8010" : ""}.`);
      return text;
    }
    case "number": {
      const n = Number(text);
      if (!/^\d{1,6}$/.test(text) || n < (column.min ?? 0) || n > (column.max ?? 65535)) fail(`${name}: enter a whole number from ${column.min ?? 0} to ${column.max ?? 65535}.`);
      return String(n);
    }
    case "select":
      if (!column.options.some(([v]) => v === text)) fail(`${name}: choose one of the listed options.`);
      return text;
    case "hostname":
      if (!HOST.test(text)) fail(`${name}: enter a host name such as nas.home.lan.`);
      return text;
    default:
      if (text.length > (column.maxLength ?? 32) || /[\x00-\x1f<>]/.test(text)) fail(`${name}: use up to ${column.maxLength ?? 32} characters, without line breaks or the < and > characters.`);
      return text;
  }
}

// An example cell for column `column`, row number `n` (1, 2, ...).
function example(column, n) {
  switch (column.kind) {
    case "ipv4":
      return `198.51.100.${40 + n}`;
    case "mac":
      return `02:00:00:00:00:0${n}`;
    case "port":
      return String(8080 + n);
    case "number":
      return String(Math.min(column.max ?? 65535, (column.min ?? 0) + n));
    case "select":
      return column.options[(n - 1) % column.options.length][0];
    case "hostname":
      return `host-${n}.example.test`;
    default:
      return `item-${n}`;
  }
}

export function tableControl() {
  const build = (entry, count) =>
    Array.from({ length: count }, (_, i) => `<${entry.columns.map((c) => (c.optional && i === 1 ? "" : example(c, i + 1))).join(">")}`).join("");
  return {
    validate(entry, text, fail) {
      if (text === "") {
        if (entry.optional) return "";
        fail("add at least one row.");
      }
      if (!text.startsWith("<")) fail("the list is not in the router's format.");
      const rows = text.slice(1).split("<");
      if (rows.length > (entry.maxItems ?? 64)) fail(`use at most ${entry.maxItems ?? 64} rows.`);
      const cleaned = rows.map((row, i) => {
        const cells = row.split(">");
        if (cells.length !== entry.columns.length) fail(`row ${i + 1} needs ${entry.columns.length} columns.`);
        return entry.columns.map((column, j) => cell(column, cells[j], fail, `row ${i + 1}`));
      });
      entry.columns.forEach((column, j) => {
        if (!column.unique) return;
        const seen = new Set();
        for (const row of cleaned) {
          const key = row[j].toLowerCase();
          if (key !== "" && seen.has(key)) fail(`${column.label.en} "${row[j]}" is used twice.`);
          seen.add(key);
        }
      });
      return cleaned.map((row) => `<${row.join(">")}`).join("");
    },
    sample: (entry, current) => [build(entry, 1), build(entry, 2)].find((v) => v !== current) ?? build(entry, 2),
    invalid: () => "<broken",
  };
}
