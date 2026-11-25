// The tab strip as plain data and pure functions: which tabs are open, their
// order, which are pinned or grouped, which the person closed, and which the
// app has ever offered. No imports and no DOM, so the tests drive it directly.
//
// State shape:
//   { v: 2, dock: "left", tabs: [{ id, pinned, group }], closed: [id], offered: [id],
//     groups: [{ id, name, color, icon, collapsed }] }

export const DOCKS = ["left", "top", "right", "bottom"];
export const GROUP_COLORS = ["#4f5bd5", "#2e8b57", "#c77d00", "#c0392b", "#8e44ad", "#00838f"];
export const GROUP_ICONS = ["folder", "star", "build", "shield", "wifi", "hub"];

export const emptyState = () => ({ v: 2, dock: "left", tabs: [], closed: [], offered: [], groups: [] });

export function sanitize(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== "object" || raw.v !== 2) return s;
  if (DOCKS.includes(raw.dock)) s.dock = raw.dock;
  const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  s.closed = [...new Set(ids(raw.closed))];
  s.offered = [...new Set(ids(raw.offered))];
  s.groups = (Array.isArray(raw.groups) ? raw.groups : []).filter((g) => g && typeof g.id === "string" && typeof g.name === "string").map((g) => ({ id: g.id, name: g.name.slice(0, 40), color: GROUP_COLORS.includes(g.color) ? g.color : GROUP_COLORS[0], icon: GROUP_ICONS.includes(g.icon) ? g.icon : "folder", collapsed: Boolean(g.collapsed) }));
  const groupIds = new Set(s.groups.map((g) => g.id));
  const seen = new Set();
  for (const t of Array.isArray(raw.tabs) ? raw.tabs : []) {
    if (!t || typeof t.id !== "string" || seen.has(t.id)) continue;
    seen.add(t.id);
    s.tabs.push({ id: t.id, pinned: Boolean(t.pinned), group: groupIds.has(t.group) ? t.group : null });
  }
  return normalise(s);
}

// Pinned tabs always come first, in their own order.
function normalise(s) {
  s.tabs = [...s.tabs.filter((t) => t.pinned), ...s.tabs.filter((t) => !t.pinned)];
  return s;
}

// Brings the state in line with the destinations that exist now.
//  - a fresh install opens every destination
//  - an update opens only destinations never offered before
//  - a destination the person closed stays closed
//  - a destination that no longer exists disappears
export function reconcile(state, destinations) {
  const ids = new Set(destinations.map((d) => d.id));
  const s = { ...state, tabs: state.tabs.filter((t) => ids.has(t.id)), closed: state.closed.filter((id) => ids.has(id)), offered: [...state.offered] };
  const has = new Set(s.tabs.map((t) => t.id));
  for (const d of destinations) {
    if (s.offered.includes(d.id)) continue;
    s.offered.push(d.id);
    if (!has.has(d.id) && !s.closed.includes(d.id)) { s.tabs.push({ id: d.id, pinned: false, group: null }); has.add(d.id); }
  }
  return normalise(s);
}

export function openTab(state, id) {
  const closed = state.closed.filter((x) => x !== id);
  if (state.tabs.some((t) => t.id === id)) return { ...state, closed };
  return normalise({ ...state, closed, tabs: [...state.tabs, { id, pinned: false, group: null }] });
}
export const openEvery = (state, destinations) => {
  let s = { ...state, closed: [] };
  for (const d of destinations) s = openTab(s, d.id);
  return { ...s, offered: [...new Set([...s.offered, ...destinations.map((d) => d.id)])] };
};
export function closeTab(state, id) {
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab || tab.pinned) return state;
  return { ...state, tabs: state.tabs.filter((t) => t.id !== id), closed: [...new Set([...state.closed, id])] };
}
export function setPinned(state, id, pinned) {
  return normalise({ ...state, tabs: state.tabs.map((t) => (t.id === id ? { ...t, pinned } : t)) });
}
// Moves a tab to a new position among the tabs of its own kind (pinned stay in front).
export function moveTab(state, id, toIndex) {
  const from = state.tabs.findIndex((t) => t.id === id);
  if (from < 0) return state;
  const tabs = [...state.tabs];
  const [tab] = tabs.splice(from, 1);
  const lo = tab.pinned ? 0 : tabs.filter((t) => t.pinned).length;
  const hi = tab.pinned ? tabs.filter((t) => t.pinned).length : tabs.length;
  tabs.splice(Math.max(lo, Math.min(hi, toIndex)), 0, tab);
  return { ...state, tabs };
}
export const shiftTab = (state, id, delta) => moveTab(state, id, state.tabs.findIndex((t) => t.id === id) + delta);

let groupCounter = 0;
export function addGroup(state, name, { color, icon } = {}, id = `g${Date.now().toString(36)}${groupCounter++}`) {
  const clean = String(name ?? "").trim().slice(0, 40);
  if (!clean) return { state, group: null };
  const group = { id, name: clean, color: GROUP_COLORS.includes(color) ? color : GROUP_COLORS[state.groups.length % GROUP_COLORS.length], icon: GROUP_ICONS.includes(icon) ? icon : "folder", collapsed: false };
  return { state: { ...state, groups: [...state.groups, group] }, group };
}
export const decorateGroup = (state, id, patch) => ({ ...state, groups: state.groups.map((g) => (g.id === id ? { ...g, ...(patch.name !== undefined ? { name: String(patch.name).trim().slice(0, 40) || g.name } : {}), ...(GROUP_COLORS.includes(patch.color) ? { color: patch.color } : {}), ...(GROUP_ICONS.includes(patch.icon) ? { icon: patch.icon } : {}), ...(patch.collapsed !== undefined ? { collapsed: Boolean(patch.collapsed) } : {}) } : g)) });
export const deleteGroup = (state, id) => ({ ...state, groups: state.groups.filter((g) => g.id !== id), tabs: state.tabs.map((t) => (t.group === id ? { ...t, group: null } : t)) });
export const moveIntoGroup = (state, ids, groupId) => ({ ...state, tabs: state.tabs.map((t) => (ids.includes(t.id) ? { ...t, group: groupId } : t)) });
export const setDock = (state, dock) => (DOCKS.includes(dock) ? { ...state, dock } : state);

// Close every open tab whose label contains (or does not contain) the text.
// Pinned tabs are never included. Returns the preview and a function to apply it.
export function closeMatching(state, test, { contains = true, labelOf }) {
  const targets = state.tabs.filter((t) => !t.pinned && (contains ? test(labelOf(t.id)) : !test(labelOf(t.id)))).map((t) => t.id);
  const pinnedSkipped = state.tabs.filter((t) => t.pinned && (contains ? test(labelOf(t.id)) : !test(labelOf(t.id)))).map((t) => t.id);
  return {
    targets,
    pinnedSkipped,
    apply: () => ({ ...state, tabs: state.tabs.filter((t) => !targets.includes(t.id)), closed: [...new Set([...state.closed, ...targets])] }),
  };
}

// The four searches, each driven by its own test function.
export const searchOpen = (state, test, labelOf) => state.tabs.filter((t) => test(labelOf(t.id))).map((t) => t.id);
export const searchClosed = (state, test, labelOf) => state.closed.filter((id) => test(labelOf(id)));
export const searchGroups = (state, test) => state.groups.filter((g) => test(g.name));
export const searchCatalog = (destinations, test, labelOf) => destinations.filter((d) => test(`${labelOf(d.id)} ${d.id}`)).map((d) => d.id);

// What the strip shows: ungrouped tabs, then groups in order, each with its tabs.
export function layout(state) {
  const loose = state.tabs.filter((t) => !t.group);
  return { loose, groups: state.groups.map((g) => ({ group: g, tabs: state.tabs.filter((t) => t.group === g.id) })) };
}
