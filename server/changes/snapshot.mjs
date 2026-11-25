// Turns the router's settings into small readable JSON files, one per area of
// the router (Wi-Fi, Internet, Local network and so on). Each setting carries
// its friendly label and its raw key. Secret values never appear: they are
// replaced by a marker that includes a salted fingerprint, so a diff can still
// show "the password changed" without the password (or a guessable hash of it)
// being stored.
import { createHmac } from "node:crypto";
import { isSecretKey } from "../router/secrets.mjs";

export const RAW_FILE = "areas/raw.json";
export const areaFile = (area) => `areas/${String(area).replace(/[^a-z0-9-]/gi, "-")}.json`;
export const SECRET_MARK = /^•{4} secret( #[0-9a-f]{8})?$/;

export function fingerprinter(salt) {
  return (value) => {
    const text = String(value ?? "");
    if (text === "") return "";
    return `•••• secret #${createHmac("sha256", salt).update(text).digest("hex").slice(0, 8)}`;
  };
}

const stable = (value) => `${JSON.stringify(value, null, 2)}\n`;

// catalog: the router's catalogue entries; nvram: Map of settings; rawKeys: keys
// outside the catalogue to keep; areaLabel(area) names an area.
export function buildSnapshot({ catalog, nvram, rawKeys = [], mark, areaLabel = (a) => ({ en: a, yue: a }) }) {
  const areas = new Map();
  const entries = new Map(); // key -> flat record
  const add = (area, record) => {
    if (!areas.has(area)) areas.set(area, []);
    areas.get(area).push(record);
    entries.set(record.key, { ...record, area });
  };
  for (const entry of catalog) {
    const has = nvram.has(entry.key);
    const raw = has ? nvram.get(entry.key) : null;
    const secret = Boolean(entry.secret) || isSecretKey(entry.key);
    add(entry.domain ?? "other", { id: entry.id, key: entry.key, label: entry.label, secret, value: raw === null ? null : secret ? mark(raw) : raw });
  }
  for (const key of [...new Set(rawKeys)].sort()) {
    if (entries.has(key)) continue;
    const has = nvram.has(key);
    const raw = has ? nvram.get(key) : null;
    const secret = isSecretKey(key);
    add("raw", { id: null, key, label: { en: key, yue: key }, secret, value: raw === null ? null : secret ? mark(raw) : raw });
  }
  const files = new Map();
  for (const [area, list] of areas) {
    list.sort((a, b) => String(a.id ?? a.key).localeCompare(String(b.id ?? b.key)));
    const label = area === "raw" ? { en: "Other settings", yue: "其他設定" } : areaLabel(area);
    files.set(area === "raw" ? RAW_FILE : areaFile(area), stable({ area, label, settings: list }));
  }
  return { files, entries };
}

// Reads a snapshot's files back into a Map of key -> record.
export function parseSnapshotFiles(texts) {
  const out = new Map();
  for (const [file, text] of texts) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }
    for (const record of data.settings ?? []) out.set(record.key, { ...record, area: data.area ?? file });
  }
  return out;
}
