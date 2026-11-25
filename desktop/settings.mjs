// Small desktop-only preferences (not router settings) kept in the app data folder.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULTS = { keepInTray: false, windowBounds: null, maximized: false };

export class DesktopSettings {
  constructor(file) {
    this.file = file;
    this.values = { ...DEFAULTS };
  }

  async load() {
    try {
      const saved = JSON.parse(await readFile(this.file, "utf8"));
      this.values = { ...DEFAULTS, ...pick(saved) };
    } catch {
      this.values = { ...DEFAULTS };
    }
    return this;
  }

  get(key) {
    return this.values[key];
  }

  async set(key, value) {
    if (!(key in DEFAULTS)) throw new Error(`Unknown desktop setting: ${key}`);
    this.values[key] = value;
    await mkdir(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    await writeFile(temp, JSON.stringify(this.values, null, 2));
    await rename(temp, this.file);
  }
}

function pick(saved) {
  const out = {};
  if (typeof saved.keepInTray === "boolean") out.keepInTray = saved.keepInTray;
  if (typeof saved.maximized === "boolean") out.maximized = saved.maximized;
  const b = saved.windowBounds;
  if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width >= 360 && b.height >= 400) out.windowBounds = { x: b.x, y: b.y, width: b.width, height: b.height };
  return out;
}
