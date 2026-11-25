// The seven ready-made modes. Each one is a list of items, "set this catalogue
// setting to this value", built from the router's own current values and a few
// choices the person makes (a console, the kids' devices, a time). Nothing here
// writes to the router: the change engine previews and applies the items.
import { L, formatRows, isIpv4, isMac, parseRows } from "../kit.mjs";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const hhmm = (text) => text.replace(":", "");
const minutesOf = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3));
const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const MAX_QOS_RULES = 32;
const MAX_PARENTAL_DEVICES = 64;

const RESOLVERS = [
  ["quad9", L("Quad9", "Quad9"), "9.9.9.9", "dns.quad9.net"],
  ["cloudflare", L("Cloudflare", "Cloudflare"), "1.1.1.1", "cloudflare-dns.com"],
  ["adguard", L("AdGuard", "AdGuard"), "94.140.14.14", "dns.adguard-dns.com"],
  ["google", L("Google", "Google"), "8.8.8.8", "dns.google"],
];

// ---- parameter kinds ------------------------------------------------------

// A parameter is checked here, on the server, whatever the browser sent.
export function cleanParams(schema, input, bad) {
  const body = input && typeof input === "object" ? input : {};
  const out = {};
  for (const p of schema) {
    const raw = body[p.id];
    switch (p.kind) {
      case "device": {
        const source = raw === undefined || raw === null || raw === "" ? "" : String(raw).trim();
        if (!source) {
          if (!p.optional) throw bad(`${p.label.en}: choose a device.`);
          out[p.id] = "";
        } else if (isIpv4(source)) out[p.id] = source;
        else if (isMac(source)) out[p.id] = source.toUpperCase();
        else throw bad(`${p.label.en}: use a device's IPv4 address or MAC address.`);
        break;
      }
      case "devices": {
        const list = raw === undefined ? [] : raw;
        if (!Array.isArray(list) || list.length > 16) throw bad(`${p.label.en}: choose up to 16 devices.`);
        const seen = new Set();
        out[p.id] = list.map((d) => {
          const mac = String(d?.mac ?? "").trim().toUpperCase();
          if (!isMac(mac)) throw bad(`${p.label.en}: "${String(d?.mac ?? "").slice(0, 24)}" is not a MAC address.`);
          if (seen.has(mac)) throw bad(`${p.label.en}: ${mac} is listed twice.`);
          seen.add(mac);
          const name = String(d?.name ?? "").replace(/[\x00-\x1f<>]/g, "").trim().slice(0, 32) || mac;
          return { mac, name };
        });
        break;
      }
      case "choice": {
        const value = raw === undefined ? p.default : String(raw);
        if (!p.options.some(([v]) => v === value)) throw bad(`${p.label.en}: choose one of the listed options.`);
        out[p.id] = value;
        break;
      }
      case "time": {
        const value = raw === undefined ? p.default : String(raw);
        if (!TIME.test(value)) throw bad(`${p.label.en}: use a time such as 21:30.`);
        out[p.id] = value;
        break;
      }
      default:
        throw new Error(`unknown parameter kind ${p.kind}`);
    }
  }
  return out;
}

// ---- list helpers ---------------------------------------------------------

// Puts one named rule at the top of the traditional priority rules, replacing an older rule of the same name.
function upsertRule(current, { name, source, priority }, bad) {
  const rows = parseRows(current ?? "").filter((row) => row[0] !== name);
  if (rows.length >= MAX_QOS_RULES) throw bad(`There are already ${MAX_QOS_RULES} priority rules. Remove one first.`);
  return formatRows([[name, source, "", "any", "", priority], ...rows]);
}

const split = (value) => (value === "" || value === undefined || value === null ? [] : String(value).split(">"));

// The four parallel internet-block lists with the chosen devices scheduled for one blocked window.
function blockedWindow(nvram, devices, slot, bad) {
  const macs = split(nvram.get("MULTIFILTER_MAC"));
  const modes = split(nvram.get("MULTIFILTER_ENABLE"));
  const names = split(nvram.get("MULTIFILTER_DEVICENAME"));
  const times = split(nvram.get("MULTIFILTER_MACFILTER_DAYTIME"));
  while (modes.length < macs.length) modes.push("0");
  while (names.length < macs.length) names.push("");
  while (times.length < macs.length) times.push("");
  for (const device of devices) {
    const at = macs.findIndex((m) => m.toUpperCase() === device.mac);
    if (at === -1) {
      macs.push(device.mac);
      modes.push("1");
      names.push(device.name);
      times.push(slot);
      continue;
    }
    if (modes[at] === "0") modes[at] = "1";
    const slots = times[at] === "" ? [] : times[at].split("<");
    if (!slots.includes(slot)) times[at] = [...slots, slot].join("<");
  }
  if (macs.length > MAX_PARENTAL_DEVICES) throw bad(`Internet blocks hold at most ${MAX_PARENTAL_DEVICES} devices.`);
  return { macs: macs.join(">"), modes: modes.join(">"), names: names.join(">"), times: times.join(">") };
}

const bandIndexes = (info) => info.bands.map((b) => b.index);
const qosFor = (source, name, priority, nvram, bad) => [
  { id: "qos.enabled", key: "qos_enable", value: "1" },
  { id: "qos.type", key: "qos_type", value: source ? "0" : "1" },
  ...(source ? [{ id: "qos-pro.rules", key: "qos_rulelist", value: upsertRule(nvram.get("qos_rulelist"), { name, source, priority }, bad), shown: L(`${name} first`, `${name}行先`) }] : []),
];

// ---- the modes --------------------------------------------------------------

export const PRESETS = [
  {
    id: "gaming",
    icon: "sports_esports",
    hue: 300,
    name: L("Gaming", "打機"),
    about: L("The console goes first, and games can open their own ports.", "遊戲機行先，遊戲可以自己開端口。"),
    params: [{ id: "console", kind: "device", optional: true, label: L("Game console", "遊戲機"), help: L("Optional. Leave empty to put games first for every device.", "可選。留空就係所有裝置嘅遊戲行先。") }],
    items: (info, nvram, p, bad) => [
      ...qosFor(p.console, "Game console", "0", nvram, bad),
      { id: "routing.upnp", key: "upnp_enable", value: "1" },
    ],
  },
  {
    id: "bedtime",
    icon: "bedtime",
    hue: 262,
    name: L("Bedtime", "瞓覺時間"),
    about: L("The chosen devices lose the internet at night and get it back in the morning.", "揀咗嘅裝置夜晚斷網，朝早先返嚟。"),
    params: [
      { id: "devices", kind: "devices", label: L("Devices", "裝置"), help: L("Choose at least one.", "最少揀一部。") },
      { id: "begin", kind: "time", default: "21:30", label: L("Internet goes off at", "幾點斷網") },
      { id: "finish", kind: "time", default: "07:00", label: L("Internet back at", "幾點返嚟") },
    ],
    items: (info, nvram, p, bad) => {
      if (!p.devices.length) return [];
      if (p.begin === p.finish) throw bad("Choose different start and end times.");
      const slot = `W07F${hhmm(p.begin)}${hhmm(p.finish)}`;
      const lists = blockedWindow(nvram, p.devices, slot, bad);
      const names = p.devices.map((d) => d.name).join(", ");
      return [
        { id: "parental.enabled", key: "MULTIFILTER_ALL", value: "1" },
        { id: "parental-pro.macs", key: "MULTIFILTER_MAC", value: lists.macs, shown: L(`${names}, off ${p.begin} to ${p.finish}`, `${names}，${p.begin} 至 ${p.finish} 斷網`) },
        { id: "parental-pro.modes", key: "MULTIFILTER_ENABLE", value: lists.modes, hidden: true },
        { id: "parental-pro.names", key: "MULTIFILTER_DEVICENAME", value: lists.names, hidden: true },
        { id: "parental-pro.daytime", key: "MULTIFILTER_MACFILTER_DAYTIME", value: lists.times, hidden: true },
      ];
    },
  },
  {
    id: "guest",
    icon: "celebration",
    hue: 22,
    name: L("Guest party", "請客模式"),
    about: L("A guest Wi-Fi with a QR card that closes itself after four hours.", "開個訪客 Wi-Fi，附 QR 卡，四個鐘後自己閂。"),
    params: [],
    items: (info) =>
      bandIndexes(info).flatMap((i) => [
        { id: `wl${i}.1.enabled`, key: `wl${i}.1_bss_enabled`, value: "1", essential: true },
        { id: `wifi-guest-plus.wl${i}.1.expire`, key: `wl${i}.1_expire`, value: "14400" },
        { id: `wl${i}.1.lan`, key: `wl${i}.1_lanaccess`, value: "off" },
      ]),
  },
  {
    id: "wfh",
    icon: "work",
    hue: 215,
    name: L("Work from home", "在家工作"),
    about: L("Video calls stay smooth while someone else is downloading.", "有人下載緊，視像會議都順。"),
    params: [{ id: "laptop", kind: "device", optional: true, label: L("Work laptop", "工作電腦"), help: L("Optional. Leave empty to keep video calls first for every device.", "可選。留空就係所有裝置嘅視像會議行先。") }],
    items: (info, nvram, p, bad) => qosFor(p.laptop, "Work laptop", "1", nvram, bad),
  },
  {
    id: "privacy",
    icon: "shield",
    hue: 165,
    name: L("Privacy DNS", "私隱 DNS"),
    about: L("Name lookups are encrypted so the provider cannot read them. Needs Asuswrt-Merlin.", "查網址會加密，供應商睇唔到。要用 Asuswrt-Merlin。"),
    params: [{ id: "resolver", kind: "choice", default: "quad9", options: RESOLVERS.map(([v, label]) => [v, label]), label: L("Resolver", "解析伺服器") }],
    items: (info, nvram, p) => {
      const [, name, ip, host] = RESOLVERS.find(([v]) => v === p.resolver);
      return [
        { id: "dns-pro.dot-enable", key: "dnspriv_enable", value: "1", essential: true },
        { id: "dns-pro.dot-profile", key: "dnspriv_profile", value: "1", essential: true },
        { id: "dns-pro.dot-servers", key: "dnspriv_rulelist", value: formatRows([[ip, "853", host, ""]]), essential: true, shown: L(`${name.en} (${host})`, `${name.yue}（${host}）`) },
        { id: "dns-pro.dnssec", key: "dnssec_enable", value: "1" },
      ];
    },
  },
  {
    id: "lockdown",
    icon: "lock",
    hue: 8,
    name: L("Lock it down", "鎖實佢"),
    about: L("Closes the common ways in: WPS, the router's web page from the internet, and old Wi-Fi security.", "閂埋常見入口：WPS、由互聯網開路由器網頁，同舊式 Wi-Fi 保安。"),
    params: [],
    items: (info, nvram) => [
      { id: "wifi-wps-macfilter.enable", key: "wps_enable", value: "0" },
      ...bandIndexes(info).map((i) => ({ id: `wifi-wps-macfilter.wl${i}.wps`, key: `wl${i}_wps_mode`, value: "disabled" })),
      { id: "sys.remoteweb", key: "misc_http_x", value: "0" },
      // WPA2 and WPA3 together works for old and new devices; a band that is already WPA3 only stays as it is.
      ...bandIndexes(info).map((i) => ({ id: `wl${i}.auth`, key: `wl${i}_auth_mode_x`, value: nvram.get(`wl${i}_auth_mode_x`) === "sae" ? "sae" : "psk2sae" })),
    ],
  },
  {
    id: "away",
    icon: "flight_takeoff",
    hue: 195,
    name: L("Away", "出門"),
    about: L("Wi-Fi is on only for a short window each day, and wake-on-LAN is off.", "Wi-Fi 每日只開一小段時間，網絡喚醒關閉。"),
    params: [
      { id: "begin", kind: "time", default: "08:00", label: L("Wi-Fi comes on at", "幾點開 Wi-Fi") },
      { id: "minutes", kind: "choice", default: "60", options: [["30", L("30 minutes", "30 分鐘")], ["60", L("1 hour", "1 個鐘")], ["120", L("2 hours", "2 個鐘")]], label: L("For how long", "開幾耐") },
    ],
    items: (info, nvram, p, bad) => {
      const end = minutesOf(p.begin) + Number(p.minutes);
      if (end > 23 * 60 + 59) throw bad("Choose an earlier start so the Wi-Fi window ends before midnight.");
      const window = `0123456@${p.begin}-${clock(end)}`;
      return [
        ...bandIndexes(info).flatMap((i) => [
          { id: `wifi-pro.wl${i}.sched-on`, key: `wl${i}_timesched`, value: "1", essential: true },
          { id: `wifi-pro.wl${i}.sched`, key: `wl${i}_sched`, value: window, essential: true },
        ]),
        { id: "wol-schedules.scheduled", key: "mar_wol_enabled", value: "0" },
      ];
    },
  },
];

export const presetById = (id) => PRESETS.find((p) => p.id === id) ?? null;
// A mode that needs a choice before it can do anything says so.
export const needsChoice = (preset, params) => preset.params.some((p) => p.kind === "devices" && !params[p.id]?.length);
