// Read side of the app: one function per screen. Each returns plain data the
// browser renders. Nothing here writes to the router, and secrets are masked
// before anything leaves this file.
import { featureDomain } from "../features/registry.mjs";
import { DOMAINS } from "./catalog.mjs";
import { parseRows } from "./editors.mjs";
import { MASK, isSecret } from "./secrets.mjs";
import { isMac } from "./shell.mjs";

const num = (text, fallback = 0) => {
  const n = Number(text);
  return Number.isFinite(n) ? n : fallback;
};
const get = (nvram, key) => nvram.get(key) ?? "";
const bandLabel = (nband) => ({ "2": "2.4 GHz", "1": "5 GHz", "4": "6 GHz" })[String(nband)] ?? "Wi-Fi";

// Entry fields a control may need in the browser, beyond the ones above.
const PASSED_FIELDS = ["options", "values", "min", "max", "step", "unit", "minLength", "maxLength", "presets", "pattern", "delimiter", "maxItems", "network", "allowRange", "within", "accept", "encoding", "minPrefix", "maxPrefix", "freeText", "freeTextReason", "readOnly", "feature", "columns", "item", "hint", "counter", "meta"];

// A catalogue entry plus its current value, safe to send to the browser.
export function describeEntry(entry, nvram) {
  const raw = get(nvram, entry.key);
  const secret = isSecret(entry.key, entry);
  const out = {
    id: entry.id,
    domain: entry.domain,
    group: entry.group,
    groupLabel: entry.groupLabel,
    key: entry.key,
    control: entry.control,
    label: entry.label,
    help: entry.help,
    risk: entry.risk,
    restart: entry.restart,
    disabled: entry.disabled,
    optional: Boolean(entry.optional),
    secret,
    value: secret ? "" : raw,
    hasValue: raw !== "",
    masked: secret && raw !== "",
  };
  for (const field of PASSED_FIELDS)
    if (entry[field] !== undefined) out[field] = entry[field];
  return out;
}

const entriesFor = (ctx, domain) => ctx.catalog.filter((e) => e.domain === domain).map((e) => describeEntry(e, ctx.nvram));

async function run(ctx, command) {
  try {
    const result = await ctx.exec(command);
    return result.code === 0 ? result.stdout : null;
  } catch (error) {
    if (error.code === "UNREACHABLE") throw error;
    return null;
  }
}

// ---- overview ----------------------------------------------------------

function parseNetDev(text) {
  const rows = {};
  for (const line of text.split("\n")) {
    const at = line.indexOf(":");
    if (at < 0 || /Inter|face/.test(line)) continue;
    const cols = line.slice(at + 1).trim().split(/\s+/).map(Number);
    rows[line.slice(0, at).trim()] = { rx: cols[0] ?? 0, tx: cols[8] ?? 0 };
  }
  return rows;
}

async function overview(ctx) {
  const { nvram, info } = ctx;
  const [uptime, load, meminfo, dev, cpu] = await Promise.all([
    run(ctx, "head -n 100000 /proc/uptime"),
    run(ctx, "head -n 100000 /proc/loadavg"),
    run(ctx, "head -n 100000 /proc/meminfo"),
    run(ctx, "head -n 100000 /proc/net/dev"),
    run(ctx, "head -n 100000 /sys/class/thermal/thermal_zone0/temp"),
  ]);
  const mem = Object.fromEntries((meminfo ?? "").split("\n").map((l) => l.split(":")).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), parseInt(v, 10) || 0]));
  const totalKb = mem.MemTotal ?? 0;
  const usedKb = totalKb - (mem.MemFree ?? 0) - (mem.Buffers ?? 0) - (mem.Cached ?? 0);
  const radios = [];
  for (const band of info.bands) {
    const out = await run(ctx, `wl -i ${band.ifname} phy_tempsense`);
    const temp = out ? parseInt(out, 10) : NaN;
    radios.push({ band: bandLabel(band.nband), tempC: Number.isFinite(temp) ? temp : null, on: get(nvram, `wl${band.index}_radio`) === "1" });
  }
  const rows = parseNetDev(dev ?? "");
  const wanName = get(nvram, "wan0_ifname") || "eth0";
  const row = rows[wanName] ?? Object.entries(rows).find(([n]) => !/^(lo|br|wl|eth[1-9])/.test(n))?.[1] ?? { rx: 0, tx: 0 };
  const now = Date.now();
  const last = ctx.session.netSample;
  let rxRate = 0;
  let txRate = 0;
  if (last && now - last.at > 200 && row.rx >= last.rx && row.tx >= last.tx) {
    rxRate = ((row.rx - last.rx) * 8) / ((now - last.at) / 1000);
    txRate = ((row.tx - last.tx) * 8) / ((now - last.at) / 1000);
  }
  ctx.session.netSample = { at: now, rx: row.rx, tx: row.tx };
  const state = get(nvram, "wan0_state_t");
  return {
    id: "overview",
    info,
    uptimeSeconds: Math.floor(num(uptime?.split(" ")[0])),
    load: (load ?? "").split(" ").slice(0, 3).map((n) => num(n)),
    memory: { totalKb, usedKb, usedPct: totalKb ? Math.round((usedKb / totalKb) * 100) : 0 },
    cpuTempC: cpu ? Math.round(num(cpu) / 1000) : null,
    radios,
    wan: {
      connected: state === "2",
      state,
      ip: get(nvram, "wan0_ipaddr"),
      gateway: get(nvram, "wan0_gateway"),
      proto: get(nvram, "wan0_proto") || get(nvram, "wan_proto"),
      dns: get(nvram, "wan0_dns").split(/\s+/).filter(Boolean),
    },
    traffic: { rxBytes: row.rx, txBytes: row.tx, rxBitsPerSecond: Math.round(rxRate), txBitsPerSecond: Math.round(txRate), at: now },
    lan: info.lan,
  };
}

// ---- devices -----------------------------------------------------------

export async function readDevices(ctx) {
  const { nvram, info } = ctx;
  const [leasesText, arpText] = await Promise.all([run(ctx, "head -n 100000 /var/lib/misc/dnsmasq.leases"), run(ctx, "head -n 100000 /proc/net/arp")]);
  const devices = new Map();
  const upsert = (mac) => {
    const key = mac.toUpperCase();
    if (!devices.has(key)) devices.set(key, { mac: key, ip: "", hostname: "", iface: "wired", band: null, rssi: null, online: false });
    return devices.get(key);
  };
  for (const line of (leasesText ?? "").split("\n")) {
    const [, mac, ip, host] = line.trim().split(/\s+/);
    if (!mac || !isMac(mac)) continue;
    const d = upsert(mac);
    d.ip = ip;
    d.hostname = host && host !== "*" ? host : "";
  }
  for (const line of (arpText ?? "").split("\n").slice(1)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 6 || !isMac(cols[3]) || cols[2] === "0x0") continue;
    const d = upsert(cols[3]);
    d.ip ||= cols[0];
    d.online = true;
  }
  for (const band of info.bands) {
    const list = await run(ctx, `wl -i ${band.ifname} assoclist`);
    for (const line of (list ?? "").split("\n")) {
      const mac = line.trim().split(/\s+/)[1];
      if (!mac || !isMac(mac)) continue;
      const d = upsert(mac);
      d.iface = "wireless";
      d.band = bandLabel(band.nband);
      d.online = true;
      const rssi = await run(ctx, `wl -i ${band.ifname} rssi ${mac.toUpperCase()}`);
      d.rssi = rssi ? parseInt(rssi, 10) : null;
    }
  }
  const names = new Map(parseRows(get(nvram, "custom_clientlist")).map((row) => [row[1]?.toUpperCase(), row[0]]));
  const reserved = new Map(parseRows(get(nvram, "dhcp_staticlist")).map((row) => [row[0]?.toUpperCase(), row[1]]));
  const blockedMacs = blockList(nvram);
  const list = [...devices.values()].map((d) => {
    const block = blockedMacs.find((b) => b.mac === d.mac);
    return {
      ...d,
      name: names.get(d.mac) || d.hostname || d.ip || d.mac,
      customName: names.get(d.mac) ?? "",
      reservedIp: reserved.get(d.mac) ?? "",
      blocked: block?.mode === "2",
      scheduled: block?.mode === "1",
    };
  });
  list.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  return { id: "devices", devices: list, summary: { total: list.length, online: list.filter((d) => d.online).length, wireless: list.filter((d) => d.iface === "wireless").length } };
}

function blockList(nvram) {
  const column = (key) => (get(nvram, key) === "" ? [] : get(nvram, key).split(">"));
  const macs = column("MULTIFILTER_MAC");
  const enable = column("MULTIFILTER_ENABLE");
  const names = column("MULTIFILTER_DEVICENAME");
  return macs.map((mac, i) => ({ index: i, mac: mac.toUpperCase(), mode: enable[i] ?? "0", name: names[i] ?? "" }));
}

// ---- list domains ------------------------------------------------------

export function readForwardingRules(nvram) {
  return parseRows(get(nvram, "vts_rulelist")).map((row, index) => ({
    index,
    name: row[0] ?? "",
    extPort: row[1] ?? "",
    ip: row[2] ?? "",
    intPort: row[3] ?? "",
    proto: row[4] ?? "TCP",
    srcIp: row[5] ?? "",
  }));
}

export function readReservations(nvram) {
  return parseRows(get(nvram, "dhcp_staticlist")).map((row) => ({ mac: (row[0] ?? "").toUpperCase(), ip: row[1] ?? "", dns: row[2] ?? "", hostname: row[3] ?? "" }));
}

function parseLog(text) {
  return text
    .split("\n")
    .filter(Boolean)
    .map((raw) => ({
      raw,
      time: raw.slice(0, 15),
      message: raw.slice(16),
      level: /error|fail|denied|refused|drop/i.test(raw) ? "warn" : "info",
    }));
}

async function logs(ctx, { lines = 200 } = {}) {
  const n = Math.min(Math.max(Math.floor(num(lines, 200)), 1), 1000);
  const out = await run(ctx, `tail -n ${n} /tmp/syslog.log`);
  return { id: "logs", lines: out ? parseLog(out) : [], available: out !== null };
}

async function jobs(ctx) {
  if (!ctx.info.merlin)
    return { id: "jobs", supported: false, reason: { en: "Scheduled jobs need Asuswrt-Merlin firmware.", yue: "排程工作要用 Asuswrt-Merlin 韌體先有。" }, jobs: [] };
  const out = (await run(ctx, "cru l")) ?? "";
  const list = out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*?)(?:\s+#([^#]+)#)?$/);
      return m ? { schedule: m.slice(1, 6).join(" "), command: m[6], id: m[7] ?? "" } : { schedule: "", command: line, id: "" };
    });
  return { id: "jobs", supported: true, jobs: list };
}

async function merlinExtras(ctx) {
  const base = { id: "merlin", entries: entriesFor(ctx, "merlin"), supported: ctx.info.merlin };
  if (!ctx.info.merlin) return { ...base, scripts: [], addons: [], entware: false };
  const lines = async (command) => ((await run(ctx, command)) ?? "").split("\n").filter(Boolean);
  const entware = ((await run(ctx, "test -d /opt/bin && echo yes || echo no")) ?? "").trim() === "yes";
  return {
    ...base,
    scripts: await lines("ls -1 /jffs/scripts"),
    addons: await lines("ls -1 /jffs/addons"),
    entware,
    entwarePackages: entware ? await lines("ls -1 /opt/bin") : [],
  };
}

function aimesh(ctx) {
  const rows = parseRows(get(ctx.nvram, "cfg_clientlist"));
  return {
    id: "aimesh",
    supported: ctx.info.capabilities.includes("amas"),
    nodes: rows.map((row) => ({ mac: row[0] ?? "", ip: row[1] ?? "", backhaulMac: row[2] ?? "", role: row[3] === "0" ? "router" : "node" })),
  };
}

function usb(ctx) {
  const drives = [];
  for (let i = 1; i <= 4; i += 1) {
    const kind = get(ctx.nvram, `usb_path${i}`);
    if (!kind) continue;
    drives.push({ port: i, kind, manufacturer: get(ctx.nvram, `usb_path${i}_manufacturer`), product: get(ctx.nvram, `usb_path${i}_product`) });
  }
  return { id: "usb", entries: entriesFor(ctx, "usb"), drives, supported: ctx.info.capabilities.includes("usbX1") };
}

function parental(ctx) {
  const devices = blockList(ctx.nvram).map((b) => ({ ...b, blocked: b.mode === "2", scheduled: b.mode === "1" }));
  return { id: "parental", entries: entriesFor(ctx, "parental"), blocks: devices };
}

function system(ctx) {
  const keys = get(ctx.nvram, "sshd_authkeys").split(/\n|>/).map((l) => l.trim()).filter(Boolean);
  return {
    id: "system",
    entries: entriesFor(ctx, "system"),
    ssh: { keyCount: keys.length, keys: keys.map((k) => ({ type: k.split(" ")[0], comment: k.split(" ").slice(2).join(" ") })) },
  };
}

function advanced(ctx) {
  const byKey = new Map(ctx.catalog.map((e) => [e.key, e]));
  const rows = [...ctx.nvram.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const entry = byKey.get(key);
      const secret = isSecret(key, entry);
      const long = value.length > 2000;
      return {
        key,
        value: secret ? "" : value.slice(0, 2000),
        masked: secret && value !== "",
        truncated: long && !secret,
        editable: !long,
        label: entry?.label ?? null,
        entryId: entry?.id ?? null,
      };
    });
  return { id: "advanced", rows, total: rows.length, mask: MASK };
}

function maintenance(ctx) {
  return {
    id: "maintenance",
    model: ctx.info.model,
    confirmPhrase: ctx.info.model,
    services: [
      { id: "restart_wireless", label: { en: "Wi-Fi", yue: "Wi-Fi" } },
      { id: "restart_dnsmasq", label: { en: "Address handout and DNS", yue: "派地址同 DNS" } },
      { id: "restart_firewall", label: { en: "Firewall", yue: "防火牆" } },
      { id: "restart_httpd", label: { en: "Router web page", yue: "路由器網頁" } },
      { id: "restart_time", label: { en: "Clock", yue: "時鐘" } },
    ],
  };
}

const firmware = (ctx) => ({
  id: "firmware",
  model: ctx.info.model,
  version: ctx.info.firmware,
  merlin: ctx.info.merlin,
  note: {
    en: "This app shows your firmware version but does not flash firmware. Update from the router's own page or the vendor's site, then press Refresh.",
    yue: "呢個程式只會顯示韌體版本，唔會幫你刷韌體。請喺路由器自己嘅網頁或者廠商網站更新，之後撳「重新整理」。",
  },
});

const tools = (ctx) => ({ id: "tools", tools: ["ping", "traceroute", "nslookup", "wake"], lan: ctx.info.lan });

const backup = (ctx) => ({ id: "backup", model: ctx.info.model, keyCount: ctx.nvram.size, note: { en: "Secrets are left out of a backup unless the owner asks for them.", yue: "備份預設唔包含密碼，除非擁有者特別要求。" } });

// ---- entry point -------------------------------------------------------

const CATALOG_ONLY = new Set(["wifi", "internet", "lan", "firewall", "qos", "vpn"]);

export async function readDomain(id, ctx, query = {}) {
  const custom = DOMAINS.some((d) => d.id === id) ? null : featureDomain(id);
  if (custom) {
    const data = await custom.read({ ...ctx, query, entries: (domain = id) => entriesFor(ctx, domain) });
    return { id, ...data };
  }
  if (!DOMAINS.some((d) => d.id === id)) throw Object.assign(new Error("That screen does not exist."), { status: 404 });
  switch (id) {
    case "overview":
      return overview(ctx);
    case "devices":
      return readDevices(ctx);
    case "forwarding":
      return { id, entries: entriesFor(ctx, "forwarding"), rules: readForwardingRules(ctx.nvram) };
    case "lan":
      return { id, entries: entriesFor(ctx, "lan"), reservations: readReservations(ctx.nvram) };
    case "wifi":
      return { id, entries: entriesFor(ctx, "wifi"), bands: ctx.info.bands.map((b) => ({ ...b, label: bandLabel(b.nband) })) };
    case "parental":
      return parental(ctx);
    case "aimesh":
      return aimesh(ctx);
    case "usb":
      return usb(ctx);
    case "logs":
      return logs(ctx, query);
    case "jobs":
      return jobs(ctx);
    case "merlin":
      return merlinExtras(ctx);
    case "system":
      return system(ctx);
    case "advanced":
      return advanced(ctx);
    case "maintenance":
      return maintenance(ctx);
    case "firmware":
      return firmware(ctx);
    case "tools":
      return tools(ctx);
    case "backup":
      return backup(ctx);
    case "history":
      return { id }; // filled in by the change engine's history list
    default:
      if (CATALOG_ONLY.has(id)) {
        const extra = id === "internet" ? { wan: (await overview(ctx)).wan } : {};
        return { id, entries: entriesFor(ctx, id), ...extra };
      }
      throw Object.assign(new Error("That screen does not exist."), { status: 404 });
  }
}
