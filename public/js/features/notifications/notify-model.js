// The notification history as plain data: shaping, limits, filtering and the
// rule for how long a toast stays. No imports, so the tests use it directly.

export const KINDS = ["good", "warn", "bad", "info"];
export const MAX_HISTORY = 200;
export const MAX_TEXT = 400;

// Errors and warnings stay until dismissed; everything else leaves by itself.
export const toastTtl = (kind) => (kind === "bad" || kind === "warn" ? 0 : 5000);

let counter = 0;
export function makeEntry({ kind = "info", text, route = "", source = "app", action = null, id } = {}, now = Date.now()) {
  const k = KINDS.includes(kind) ? kind : kind === "" ? "good" : "info";
  return { id: id ?? `n${now.toString(36)}${(counter++).toString(36)}`, kind: k, text: String(text ?? "").slice(0, MAX_TEXT), at: new Date(now).toISOString(), route: String(route), read: false, source, action: action ? String(action) : "" };
}

export function addEntry(history, entry) {
  return [entry, ...history.filter((h) => h.id !== entry.id)].slice(0, MAX_HISTORY);
}

// kind: "all" or one of KINDS; read: "all", "unread" or "read"; test: string -> boolean
export function filterHistory(history, { kind = "all", read = "all", test = () => true } = {}) {
  return history.filter((n) => (kind === "all" || n.kind === kind) && (read === "all" || (read === "unread" ? !n.read : n.read)) && test(n.text));
}

export const unreadCount = (history) => history.filter((n) => !n.read).length;

export function markRead(history, ids, read = true) {
  const set = new Set(ids);
  return history.map((n) => (set.has(n.id) ? { ...n, read } : n));
}
export const removeEntries = (history, ids) => history.filter((n) => !new Set(ids).has(n.id));

// Only well-formed entries survive loading from storage.
export function sanitize(list) {
  return (Array.isArray(list) ? list : []).filter((n) => n && typeof n.id === "string" && KINDS.includes(n.kind) && typeof n.text === "string").slice(0, MAX_HISTORY);
}
