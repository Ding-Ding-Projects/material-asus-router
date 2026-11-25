// One table of keyboard shortcuts. The same table registers the key handler and
// is read by the context menus to show each item's shortcut, so what a menu
// displays can never differ from what the keyboard does. No imports.

const MODS = ["Mod", "Ctrl", "Alt", "Shift"];

// "Mod+Shift+F" -> { mod, alt, shift, key }. Mod is Ctrl, or Command on a Mac.
export function parseKeys(keys) {
  if (/\+\s*$/.test(String(keys))) throw new Error(`"${keys}" has no key`);
  const parts = String(keys).split("+").map((p) => p.trim()).filter(Boolean);
  const key = parts.pop() ?? "";
  const spec = { mod: false, ctrl: false, alt: false, shift: false, key };
  for (const p of parts) {
    if (!MODS.includes(p)) throw new Error(`Unknown modifier "${p}" in "${keys}"`);
    spec[p.toLowerCase()] = true;
  }
  if (!key) throw new Error(`"${keys}" has no key`);
  return spec;
}

export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent ?? "");

const KEY_NAMES = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Escape: "Esc", Delete: "Del" };

// Platform notation: "Ctrl+Shift+F" on most systems, "⌘⇧F" on a Mac.
export function display(keys, mac = isMac()) {
  if (!keys) return "";
  const s = parseKeys(keys);
  const key = KEY_NAMES[s.key] ?? (s.key.length === 1 ? s.key.toUpperCase() : s.key);
  if (mac) return `${s.ctrl ? "⌃" : ""}${s.alt ? "⌥" : ""}${s.shift ? "⇧" : ""}${s.mod ? "⌘" : ""}${key}`;
  return [s.mod || s.ctrl ? "Ctrl" : null, s.alt ? "Alt" : null, s.shift ? "Shift" : null, key].filter(Boolean).join("+");
}

// Does a keyboard event press exactly these keys?
export function matches(keys, event, mac = isMac()) {
  const s = parseKeys(keys);
  const wantCtrl = s.ctrl || (s.mod && !mac);
  const wantMeta = s.mod && mac;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return key === (s.key.length === 1 ? s.key.toLowerCase() : s.key)
    && Boolean(event.ctrlKey) === wantCtrl && Boolean(event.metaKey) === wantMeta
    && Boolean(event.altKey) === s.alt && Boolean(event.shiftKey) === s.shift;
}

export function createRegistry() {
  const defs = new Map();
  const registry = {
    register(def) {
      if (!def?.id || !def.keys) throw new Error("A shortcut needs an id and keys");
      parseKeys(def.keys);
      defs.set(def.id, def);
      return () => defs.delete(def.id);
    },
    find: (id) => defs.get(id) ?? null,
    list: () => [...defs.values()],
    displayFor: (id, mac) => (defs.has(id) ? display(defs.get(id).keys, mac) : ""),
    // The conflicts: two shortcuts that press the same keys.
    conflicts() {
      const seen = new Map();
      const out = [];
      for (const d of defs.values()) {
        const s = parseKeys(d.keys);
        const k = `${s.mod || s.ctrl}|${s.alt}|${s.shift}|${s.key.toLowerCase()}`;
        if (seen.has(k) && !d.alias && !seen.get(k).alias) out.push([seen.get(k).id, d.id]);
        else seen.set(k, d);
      }
      return out;
    },
    // The first shortcut whose keys an event presses.
    find_event: (event, mac) => [...defs.values()].find((d) => matches(d.keys, event, mac)) ?? null,
  };
  return registry;
}
