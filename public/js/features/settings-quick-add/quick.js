// Quick add beside a Settings pointer, as plain data. No imports.
//
// A pointer is a place where the app tells a person to turn something on or
// fill something in on the Settings screen. This is the hand-written list of
// them: each names the setting that must be on (the enable switch) and the
// settings that only matter once it is. The quick box writes the very same
// pending change the Settings row writes (same entry id), so there is one
// stored value and the two can never disagree.

const pair = (en, yue) => ({ en, yue });

export const POINTERS = [
  { id: "guest-2g", enable: "wl0.1.enabled", dependents: ["wl0.1.ssid", "wl0.1.password", "wl0.1.lan"], note: pair("This only applies once the 2.4 GHz guest network is turned on.", "2.4 GHz 訪客網絡開咗之後，呢項先會生效。") },
  { id: "guest-5g", enable: "wl1.1.enabled", dependents: ["wl1.1.ssid", "wl1.1.password", "wl1.1.lan"], note: pair("This only applies once the 5 GHz guest network is turned on.", "5 GHz 訪客網絡開咗之後，呢項先會生效。") },
];

// Pointers whose entries all exist on this router.
export const pointersFor = (entries) => {
  const ids = new Set(entries.map((e) => e.id));
  return POINTERS.filter((p) => ids.has(p.enable) && p.dependents.some((d) => ids.has(d))).map((p) => ({ ...p, dependents: p.dependents.filter((d) => ids.has(d)) }));
};

// The value an entry currently has, counting an edit waiting in the dock.
export const valueOf = (dock, entry) => (dock.has(entry.id) ? dock.value(entry.id) : entry.value);

// Is the pointer's enable switch off right now?
export const needsEnable = (pointer, entries, dock) => {
  const enable = entries.find((e) => e.id === pointer.enable);
  return Boolean(enable) && valueOf(dock, enable) === enable.values.off;
};

// A secret (a password) that has never been set.
export const needsSecret = (entry) => entry.secret === true && entry.control === "password" && !entry.hasValue;

// Validates and queues one value in the changes bar, the same call the Settings row makes.
export function quickSet(dock, entry, raw, validate) {
  const r = validate(entry, raw);
  if (!r.ok) return { ok: false, reason: r.reason };
  dock.setEntry(entry, r.value);
  return { ok: true, value: r.value };
}
