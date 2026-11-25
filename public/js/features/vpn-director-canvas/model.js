// Pure helpers for the VPN Director canvas. A rule is a row "<on>name>device>destination>interface".

export const parseRows = (text) => String(text ?? "").split("<").filter((r) => r !== "").map((r) => r.split(">"));
export const formatRows = (rows) => rows.map((r) => `<${r.join(">")}`).join("");

export const readRules = (text) => parseRows(text).map((r, index) => ({ index, enabled: r[0] === "1", desc: r[1] ?? "", local: r[2] ?? "", remote: r[3] ?? "", iface: r[4] ?? "" }));
export const writeRules = (rules) => formatRows(rules.map((r) => [r.enabled ? "1" : "0", r.desc, r.local, r.remote, r.iface]));

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
// An address or a network: 198.51.100.102 or 198.51.100.0/24.
export function isTarget(text) {
  const [ip, prefix, extra] = String(text).split("/");
  if (extra !== undefined || !IPV4.test(ip)) return false;
  return prefix === undefined || (/^\d{1,2}$/.test(prefix) && Number(prefix) <= 32);
}

// A rule name that fits the router's 32 characters and holds no < or >.
export function ruleName(deviceName, iface) {
  const clean = String(deviceName).replace(/[<>\x00-\x1f]/g, "").trim() || "Device";
  const tail = ` → ${iface}`;
  const text = `${clean}${tail}`;
  return [...text].length <= 32 ? text : `${[...clean].slice(0, 32 - [...tail].length).join("")}${tail}`;
}

// Send a device to a lane. A device that already has an everywhere rule changes its interface; any other
// gets a new rule. An empty interface removes the everywhere rule (rules limited to a destination stay).
export function route(rules, device, iface) {
  const at = rules.findIndex((r) => r.local === device.ip && r.remote === "");
  const next = rules.map((r) => ({ ...r }));
  if (iface === "") return at === -1 ? next : next.filter((_, i) => i !== at);
  if (at !== -1) {
    next[at].iface = iface;
    next[at].desc = ruleName(device.name, iface);
    next[at].enabled = true;
    return next;
  }
  return [...next, { index: next.length, enabled: true, desc: ruleName(device.name, iface), local: device.ip, remote: "", iface }];
}

// Where each device goes: the lane of its everywhere rule, or "" when it has none.
export const laneOf = (rules, ip) => rules.find((r) => r.local === ip && r.remote === "")?.iface ?? "";

// A lane can take new devices when its tunnel is set up (or already used by a rule).
export const canDropOn = (tunnel, rules) => tunnel.configured || rules.some((r) => r.iface === tunnel.id);
