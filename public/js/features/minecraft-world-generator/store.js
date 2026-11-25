// Per-browser storage for this feature, under the app's own "mar." prefix.
// Storage can be blocked or full, so every call is wrapped and the feature
// still works without it.
const PREFIX = "mar.minecraft-world-generator.";
export function load(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
export function save(key, value) {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
