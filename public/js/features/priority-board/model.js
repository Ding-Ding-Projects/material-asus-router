// Pure helpers for the priority board: the Adaptive QoS group order, the
// traditional QoS rules grouped by priority, and the per-device limits.

export const parseRows = (text) => String(text ?? "").split("<").filter((r) => r !== "").map((r) => r.split(">"));
export const formatRows = (rows) => rows.map((r) => `<${r.join(">")}`).join("");

// ---- Adaptive QoS groups: "9,20<4<0,5,6,15,17" from most to least important ----
export const parseOrder = (text) => (text ? String(text).split("<").map((g) => g.split(",")) : []);
export const formatOrder = (groups) => groups.map((g) => g.join(",")).join("<");

// Moves one group so it ends up at position `to` (0 is the top).
export function moveGroup(groups, from, to) {
  if (from === to || from < 0 || to < 0 || from >= groups.length || to >= groups.length) return groups;
  const next = [...groups];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ---- traditional QoS rules: <name>source>port>proto>size>priority ----
export const PRIORITIES = [["0", { en: "Highest", yue: "最高" }], ["1", { en: "High", yue: "高" }], ["2", { en: "Medium", yue: "中" }], ["3", { en: "Low", yue: "低" }], ["4", { en: "Lowest", yue: "最低" }]];

export function readRules(text) {
  return parseRows(text).map((r, index) => ({ index, name: r[0] ?? "", source: r[1] ?? "", port: r[2] ?? "", proto: r[3] ?? "tcp", size: r[4] ?? "", priority: PRIORITIES.some(([v]) => v === r[5]) ? r[5] : "2" }));
}
export const writeRules = (rules) => formatRows(rules.map((r) => [r.name, r.source, r.port, r.proto, r.size, r.priority]));

// The rules in each priority lane, in the order the router checks them.
export function lanes(rules) {
  return PRIORITIES.map(([value]) => ({ value, rules: rules.filter((r) => r.priority === value) }));
}

// Sets one rule's priority (a new list; the rule keeps its place in the checking order).
export const setPriority = (rules, index, priority) => rules.map((r) => (r.index === index ? { ...r, priority } : r));

// ---- per-device limits: <on>device>down>up in kbit/s, 0 means no limit ----
export function readLimits(text) {
  return parseRows(text).map((r, index) => ({ index, on: r[0] === "1", device: r[1] ?? "", down: Number(r[2]) || 0, up: Number(r[3]) || 0 }));
}
export const writeLimits = (limits) => formatRows(limits.map((l) => [l.on ? "1" : "0", l.device, String(l.down), String(l.up)]));

// 20000 kbit/s as "20 Mbit/s", 800 as "800 kbit/s", 0 as "no limit".
export function speedText(kbps, none) {
  if (!kbps) return none;
  return kbps >= 1000 ? `${Math.round((kbps / 1000) * 10) / 10} Mbit/s` : `${kbps} kbit/s`;
}

// The share of the line a limit uses, 0 to 1 (0 when there is no line speed or no limit).
export const share = (kbps, line) => (line > 0 && kbps > 0 ? Math.min(1, kbps / line) : 0);
