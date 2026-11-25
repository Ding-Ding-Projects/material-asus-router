// Editors for the router's list-shaped settings (device names, address
// reservations, internet blocks, port forwarding). Each operation edits a
// working copy of the settings and the change engine diffs the result, so
// several operations on the same list combine correctly.
import { isIpv4, macAddress } from "./shell.mjs";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};

// "<a>b>c<d>e>f" <-> [["a","b","c"],["d","e","f"]]
export const parseRows = (value) =>
  String(value ?? "")
    .split("<")
    .filter((row) => row !== "")
    .map((row) => row.split(">"));
export const formatRows = (rows) => rows.map((row) => `<${row.join(">")}`).join("");

// "a>b>c" <-> ["a","b","c"] (empty string means an empty list)
const parseColumn = (value) => (value === "" || value === undefined ? [] : String(value).split(">"));
const formatColumn = (items) => items.join(">");

export function cleanText(value, label, { max = 32, allowEmpty = false } = {}) {
  const text = String(value ?? "").trim();
  if (!text && !allowEmpty) fail(`${label}: enter a value.`);
  if (text.length > max) fail(`${label}: use ${max} characters or fewer.`);
  if (/[\x00-\x1f<>]/.test(text)) fail(`${label}: remove line breaks and the < and > characters.`);
  return text;
}

function toNumber(ip) {
  return ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);
}

function sameNetwork(ip, lanIp, mask) {
  if (!isIpv4(lanIp) || !isIpv4(mask)) return true;
  const m = toNumber(mask);
  return (toNumber(ip) & m) === (toNumber(lanIp) & m);
}

function port(value, label) {
  const text = String(value ?? "").trim();
  const m = text.match(/^(\d{1,5})(?::(\d{1,5}))?$/);
  if (!m) fail(`${label}: enter a port such as 8080 or a range such as 8000:8010.`);
  const lo = Number(m[1]);
  const hi = m[2] === undefined ? lo : Number(m[2]);
  if (lo < 1 || hi > 65535 || lo > hi) fail(`${label}: ports run from 1 to 65535.`);
  return text;
}

// Friendly names for the list settings these edits touch, shown in previews.
export const LIST_LABELS = {
  custom_clientlist: { en: "Device names", yue: "裝置名稱" },
  dhcp_staticlist: { en: "Reserved addresses", yue: "留住嘅地址" },
  vts_rulelist: { en: "Port forwarding rules", yue: "端口轉發規則" },
  MULTIFILTER_ENABLE: { en: "Internet blocks: mode", yue: "封鎖上網：模式" },
  MULTIFILTER_MAC: { en: "Internet blocks: devices", yue: "封鎖上網：裝置" },
  MULTIFILTER_DEVICENAME: { en: "Internet blocks: names", yue: "封鎖上網：名稱" },
  MULTIFILTER_MACFILTER_DAYTIME: { en: "Internet blocks: schedule", yue: "封鎖上網：時間表" },
};

const set = (work, key, value) => work.set(key, value);

const OPS = {
  // Give a device a friendly name that shows in the router's own client list.
  rename(work, { mac, name }, out) {
    const address = macAddress(mac);
    const rows = parseRows(work.get("custom_clientlist")).filter((row) => row[1]?.toUpperCase() !== address);
    const text = cleanText(name, "Device name", { allowEmpty: true });
    if (text) rows.push([text, address, "0", "0", "", ""]);
    if (rows.length > 64) fail("The router can keep at most 64 device names.");
    set(work, "custom_clientlist", formatRows(rows));
    out.touched.add("custom_clientlist");
  },

  // Always hand this device the same address.
  reserve(work, { mac, ip, hostname }, out) {
    const address = macAddress(mac);
    if (!isIpv4(ip)) fail("Reserved address: enter an IPv4 address.");
    if (!sameNetwork(ip, work.get("lan_ipaddr"), work.get("lan_netmask"))) fail("Reserved address: it must be on the router's own network.");
    if (ip === work.get("lan_ipaddr")) fail("Reserved address: that is the router itself.");
    const rows = parseRows(work.get("dhcp_staticlist"));
    const clash = rows.find((row) => row[1] === ip && row[0].toUpperCase() !== address);
    if (clash) fail(`Reserved address: ${ip} already belongs to another device.`, 409);
    const kept = rows.filter((row) => row[0].toUpperCase() !== address);
    const host = cleanText(hostname ?? "", "Host name", { allowEmpty: true, max: 63 });
    kept.push([address, ip, "", host]);
    if (kept.length > 128) fail("The router can keep at most 128 reservations.");
    set(work, "dhcp_staticlist", formatRows(kept));
    out.touched.add("dhcp_staticlist");
    out.restarts.add("restart_dnsmasq");
  },

  unreserve(work, { mac }, out) {
    const address = macAddress(mac);
    const rows = parseRows(work.get("dhcp_staticlist"));
    const kept = rows.filter((row) => row[0].toUpperCase() !== address);
    if (kept.length === rows.length) fail("That device has no reserved address.", 404);
    set(work, "dhcp_staticlist", formatRows(kept));
    out.touched.add("dhcp_staticlist");
    out.restarts.add("restart_dnsmasq");
  },

  // Cut a device off from the internet (or let it back on).
  block(work, { mac, name, blocked }, out) {
    const address = macAddress(mac);
    const columns = {
      MULTIFILTER_ENABLE: parseColumn(work.get("MULTIFILTER_ENABLE")),
      MULTIFILTER_MAC: parseColumn(work.get("MULTIFILTER_MAC")),
      MULTIFILTER_DEVICENAME: parseColumn(work.get("MULTIFILTER_DEVICENAME")),
      MULTIFILTER_MACFILTER_DAYTIME: parseColumn(work.get("MULTIFILTER_MACFILTER_DAYTIME")),
    };
    const count = columns.MULTIFILTER_MAC.length;
    for (const key of Object.keys(columns)) while (columns[key].length < count) columns[key].push("");
    const at = columns.MULTIFILTER_MAC.findIndex((m) => m.toUpperCase() === address);
    if (blocked) {
      const label = cleanText(name || address, "Device name", { max: 32 });
      if (at === -1) {
        columns.MULTIFILTER_ENABLE.push("2");
        columns.MULTIFILTER_MAC.push(address);
        columns.MULTIFILTER_DEVICENAME.push(label);
        columns.MULTIFILTER_MACFILTER_DAYTIME.push("");
      } else columns.MULTIFILTER_ENABLE[at] = "2";
    } else if (at !== -1) {
      for (const key of Object.keys(columns)) columns[key].splice(at, 1);
    } else fail("That device is not blocked.", 404);
    if (columns.MULTIFILTER_MAC.length > 64) fail("The router can block at most 64 devices.");
    for (const [key, items] of Object.entries(columns)) {
      // A list of one empty item would read back as an empty list, so keep ">" shape.
      set(work, key, formatColumn(items));
      out.touched.add(key);
    }
    out.restarts.add("restart_firewall");
  },

  "forward-add"(work, rule, out) {
    const rows = parseRows(work.get("vts_rulelist"));
    rows.push(forwardRow(rule, work));
    saveForwarding(work, rows, out);
  },

  "forward-update"(work, rule, out) {
    const rows = parseRows(work.get("vts_rulelist"));
    const index = Number(rule.index);
    if (!Number.isInteger(index) || !rows[index]) fail("That forwarding rule no longer exists.", 404);
    rows[index] = forwardRow(rule, work);
    saveForwarding(work, rows, out);
  },

  "forward-remove"(work, { index }, out) {
    const rows = parseRows(work.get("vts_rulelist"));
    const at = Number(index);
    if (!Number.isInteger(at) || !rows[at]) fail("That forwarding rule no longer exists.", 404);
    rows.splice(at, 1);
    saveForwarding(work, rows, out);
  },
};

function forwardRow(rule, work) {
  const name = cleanText(rule.name, "Rule name");
  if (!isIpv4(rule.ip)) fail("Forward to: enter the device's IPv4 address.");
  if (!sameNetwork(rule.ip, work.get("lan_ipaddr"), work.get("lan_netmask"))) fail("Forward to: the device must be on the router's own network.");
  const proto = String(rule.proto ?? "TCP").toUpperCase();
  if (!["TCP", "UDP", "BOTH"].includes(proto)) fail("Protocol: choose TCP, UDP or both.");
  const srcIp = String(rule.srcIp ?? "").trim();
  if (srcIp && !isIpv4(srcIp)) fail("Allowed source: leave empty for anyone, or enter an IPv4 address.");
  return [name, port(rule.extPort, "Outside port"), rule.ip, port(rule.intPort ?? rule.extPort, "Device port"), proto, srcIp];
}

function saveForwarding(work, rows, out) {
  if (rows.length > 64) fail("The router can keep at most 64 forwarding rules.");
  set(work, "vts_rulelist", formatRows(rows));
  out.touched.add("vts_rulelist");
  out.restarts.add("restart_firewall");
}

export const OP_NAMES = Object.keys(OPS);

// Applies each operation, in order, to the working copy `work` (a Map).
export function applyOps(work, ops) {
  const out = { touched: new Set(), restarts: new Set() };
  for (const op of ops ?? []) {
    const handler = OPS[op?.op];
    if (!handler) fail(`"${op?.op}" is not a known edit.`);
    handler(work, op, out);
  }
  return out;
}
