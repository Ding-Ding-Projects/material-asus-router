// Small stand-ins the appearance feature tests share: a storage that behaves
// like localStorage, one that always fails, a stylesheet reader, and the list
// of the appearance feature folders.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FEATURES = path.join(ROOT, "public", "js", "features");

export class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
export const BrokenStorage = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("full"); },
  removeItem() { throw new Error("blocked"); },
};

export const APPEARANCE_FOLDERS = ["material-design", "motion", "live-charts", "appearance-editor", "color-picker", "logo-customization", "overlay-panels", "collapse-filters", "accessibility-sizing", "functional-ui", "vendored-fonts"];

export async function readAllCss() {
  const parts = [await readFile(path.join(ROOT, "public", "style.css"), "utf8")];
  for (const name of APPEARANCE_FOLDERS) parts.push(await readFile(path.join(FEATURES, name, "style.css"), "utf8").catch(() => ""));
  return parts.join("\n");
}
export async function readSources(folder) {
  const out = {};
  for (const entry of await readdir(path.join(FEATURES, folder))) if (entry.endsWith(".js")) out[entry] = await readFile(path.join(FEATURES, folder, entry), "utf8");
  return out;
}

// A minimal bus and ctx for logic that only needs events, a dock and strings.
export function fakeBus() {
  const map = new Map();
  return { on(n, f) { if (!map.has(n)) map.set(n, new Set()); map.get(n).add(f); return () => map.get(n).delete(f); }, emit(n, d) { for (const f of [...(map.get(n) ?? [])]) f(d); } };
}
