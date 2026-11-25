// Firewall internals: live, read-only viewers for the firewall tables, the address lists (ipset),
// the connection table and traffic shaping, kernel hardening read-outs, and typed settings for
// connection tracking, NAT helpers, NAT loopback and the traffic history. (VPN passthrough switches
// belong to the routing feature and are not repeated here.)
//
// The viewers only read. Every setting is a catalogue entry and is written through the change engine.
// Setting names that differ between firmware are marked needsKey: the entry is disabled with the reason
// "This router does not have the setting <key>" unless the router's own settings list has that name.
import { L, ON_OFF } from "../kit.mjs";
import { CONNTRACK_FILES, HARDENING, HARDENING_FILES, headCommand, parseHeadFiles, parseIpset, parseIptables, parseTc, summariseConntrack } from "./parse.mjs";
import { fakeHandlers } from "./fake.mjs";

const TABLES = {
  filter: { command: "iptables -S", label: L("Filter table", "過濾表") },
  nat: { command: "iptables -t nat -S", label: L("NAT table", "NAT 表") },
  mangle: { command: "iptables -t mangle -S", label: L("Mangle table", "Mangle 表") },
  ip6: { command: "ip6tables -S", label: L("IPv6 filter table", "IPv6 過濾表") },
};
const DEVICE = /^[A-Za-z0-9_.:-]{1,15}$/;

const g = (group, label) => ({ domain: "firewall-internals", group, groupLabel: label, risk: "low" });
const TRACK = g("conntrack", L("Connection tracking", "連線追蹤"));
const NAT = g("nat", L("NAT helpers and loopback", "NAT 輔助同回環"));
const HIST = g("history", L("Traffic history", "流量歷史"));

const helper = (id, key, en, yue, helpEn, helpYue) => ({
  ...NAT, id: `firewall-internals.${id}`, key, control: "switch", values: ON_OFF, restart: "restart_firewall", risk: "network", firmware: "merlin", needsKey: true,
  label: L(en, yue), help: L(helpEn, helpYue),
});
// The ten positions of ct_tcp_timeout, in the order the router reads them. Positions 0 and 9 are not used.
const TCP_FIELDS = [
  ["unused", "Not used", "未用", 0, 0], ["established", "Established", "已建立", 1, 432000], ["syn_sent", "SYN sent", "已發 SYN", 1, 3600],
  ["syn_recv", "SYN received", "已收 SYN", 1, 3600], ["fin_wait", "FIN wait", "FIN 等待", 1, 3600], ["time_wait", "Time wait", "Time wait", 1, 3600],
  ["close", "Close", "關閉", 1, 3600], ["close_wait", "Close wait", "Close wait", 1, 3600], ["last_ack", "Last ACK", "最後 ACK", 1, 3600], ["unused2", "Not used", "未用", 0, 0],
].map(([id, en, yue, min, max]) => ({ id, label: L(en, yue), min, max, unit: "s" }));
const UDP_FIELDS = [
  ["unreplied", "No reply yet", "未有回覆", 1, 3600], ["assured", "Reply seen (stream)", "已有回覆（串流）", 1, 7200],
].map(([id, en, yue, min, max]) => ({ id, label: L(en, yue), min, max, unit: "s" }));

const timeouts = (id, key, en, yue, helpEn, helpYue, fields) => ({
  ...TRACK, id: `firewall-internals.${id}`, key, control: "timeouts", restart: "restart_firewall", risk: "network", firmware: "merlin", needsKey: true,
  meta: { fields }, label: L(en, yue), help: L(helpEn, helpYue),
});

const ENTRIES = [
  { ...TRACK, id: "firewall-internals.ct-max", key: "ct_max", control: "number", min: 1024, max: 1048576, step: 1024, unit: "connections", restart: "restart_firewall", risk: "network", firmware: "merlin", needsKey: true,
    label: L("Most connections tracked at once", "同時追蹤嘅最多連線數"), help: L("When the table is full the router drops new connections. More uses more memory, so raise it only when the viewer shows the table close to full.", "表滿咗路由器就會丟棄新連線。數字大啲會用多啲記憶體，所以只係喺檢視器顯示表接近滿嗰陣先加。") },
  timeouts("ct-tcp", "ct_tcp_timeout", "TCP connection timeouts", "TCP 連線逾時", "How long the router remembers an idle TCP connection in each state. Short values free the table sooner but can cut quiet connections.", "路由器喺每個狀態記住閒置 TCP 連線幾耐。短啲會快啲釋放表，但可能中斷安靜嘅連線。", TCP_FIELDS),
  timeouts("ct-udp", "ct_udp_timeout", "UDP connection timeouts", "UDP 連線逾時", "How long UDP flows are remembered before and after the other side replies.", "UDP 流喺對方回覆之前同之後會被記住幾耐。", UDP_FIELDS),

  { ...NAT, id: "firewall-internals.loopback", key: "fw_nat_loopback", control: "switch", values: ON_OFF, restart: "restart_firewall", risk: "network", firmware: "merlin", needsKey: true,
    label: L("NAT loopback", "NAT 回環"), help: L("Lets devices on your network reach a forwarded port by using the router's internet address, as if they were outside.", "俾網絡內嘅裝置用路由器嘅互聯網地址去連已轉發嘅端口，好似喺外面一樣。") },
  helper("sip", "nf_sip", "SIP helper", "SIP 輔助", "Helps internet phone calls (SIP) find their way through NAT. Turn off if calls misbehave.", "幫網絡電話（SIP）穿過 NAT。通話有問題可以關閉。"),
  helper("ftp", "nf_ftp", "FTP helper", "FTP 輔助", "Lets FTP file transfers in active mode work through NAT.", "令主動模式嘅 FTP 傳輸可以穿過 NAT。"),
  helper("pptp", "nf_pptp", "PPTP helper", "PPTP 輔助", "Lets older PPTP VPN connections work through NAT.", "令舊式 PPTP VPN 連線可以穿過 NAT。"),
  helper("rtsp", "nf_rtsp", "RTSP helper", "RTSP 輔助", "Helps camera and media streams (RTSP) through NAT.", "幫鏡頭同媒體串流（RTSP）穿過 NAT。"),
  helper("h323", "nf_h323", "H.323 helper", "H.323 輔助", "Helps old video-conference systems (H.323) through NAT.", "幫舊式視像會議系統（H.323）穿過 NAT。"),


  { ...HIST, id: "firewall-internals.rstats", key: "rstats_enable", control: "switch", values: ON_OFF, firmware: "merlin", needsKey: true,
    label: L("Keep traffic history", "記住流量歷史"), help: L("The router counts daily and monthly traffic. Takes effect the next time the router's traffic monitor restarts, which a reboot does.", "路由器會計算每日同每月流量。喺路由器流量監察下次重啟時生效，重新開機就會。") },
  { ...HIST, id: "firewall-internals.rstats-path", key: "rstats_path", control: "select", firmware: "merlin", needsKey: true,
    options: [["", L("Memory only", "只用記憶體"), L("Lost at every reboot.", "每次重新開機都會冇咗。")], ["*nvram", L("Router settings memory", "路由器設定記憶體"), L("Survives reboots but wears the flash; keep the save interval long.", "重新開機都會保留，但會磨損快閃記憶體，儲存間隔要長啲。")], ["/jffs/", L("Internal storage (JFFS)", "內部儲存（JFFS）"), L("Survives reboots and software updates that keep JFFS.", "重新開機同保留 JFFS 嘅更新之後都會保留。")]],
    label: L("Where the history is kept", "歷史存放位置"), help: L("Choose where the router saves its traffic history file.", "揀路由器將流量歷史檔案儲存喺邊。") },
  { ...HIST, id: "firewall-internals.rstats-save", key: "rstats_stime", control: "select", firmware: "merlin", needsKey: true,
    options: [1, 6, 12, 24, 48, 72, 96, 120, 144, 168].map((hours) => [String(hours), L(`Every ${hours} hours`, `每 ${hours} 小時`)]),
    label: L("Save the history every", "幾耐儲存一次歷史"), help: L("Less often is gentler on flash storage but loses more if the router loses power.", "越少儲存越慳快閃記憶體，但突然斷電會冇咗多啲。") },
  { ...HIST, id: "firewall-internals.rstats-day", key: "rstats_offset", control: "number", min: 1, max: 31, step: 1, unit: "day of month", firmware: "merlin", needsKey: true,
    label: L("Monthly counter starts on day", "月結由幾號開始"), help: L("Match this to the day your internet plan renews so monthly totals line up with the bill.", "同寬頻計劃續期嗰日對齊，月度總數就會同賬單一致。") },
  { ...HIST, id: "firewall-internals.cstats", key: "cstats_enable", control: "switch", values: ON_OFF, firmware: "merlin", needsKey: true,
    label: L("Count traffic per device", "計算每部裝置嘅流量"), help: L("Keeps byte counts for each device address, which the per-device history needs.", "為每個裝置地址記錄位元組數，每部裝置嘅歷史需要呢項。") },
];

// A new control type: a row of whole numbers kept in one setting, separated by spaces.
const timeoutsControl = {
  validate(entry, text, fail) {
    const fields = entry.meta?.fields ?? [];
    const parts = String(text).trim().split(/\s+/).filter(Boolean);
    if (parts.length !== fields.length) fail(`Give ${fields.length} numbers separated by spaces.`);
    parts.forEach((part, i) => {
      const f = fields[i];
      if (!/^\d{1,7}$/.test(part)) fail(`${f.label.en} must be a whole number.`);
      const n = Number(part);
      if (n < f.min || n > f.max) fail(`${f.label.en} must be between ${f.min} and ${f.max} seconds.`);
    });
    return parts.map(Number).join(" ");
  },
  sample(entry, current) {
    const fields = entry.meta.fields;
    const parts = String(current).trim().split(/\s+/).map(Number);
    const next = parts.length === fields.length && parts.every(Number.isFinite) ? [...parts] : fields.map((f) => f.min);
    const at = fields.findIndex((f) => f.max > f.min);
    const f = fields[at];
    next[at] = next[at] + 10 <= f.max ? next[at] + 10 : Math.max(f.min, next[at] - 10);
    return next.join(" ");
  },
  // Angle brackets are refused by the generic guided check too, so both checks agree on this example.
  invalid: () => "<abc>",
};

const unavailable = (what, out) => ({ available: false, reason: { en: `The router could not show ${what}: ${(out.stderr || out.stdout || "no answer").trim().slice(0, 120) || "no answer"}`, yue: `路由器顯示唔到${what}：${(out.stderr || out.stdout || "冇回應").trim().slice(0, 120) || "冇回應"}` } });

async function readRules(exec, table) {
  const def = TABLES[table];
  const out = await exec(def.command, { timeoutMs: 15000 });
  if (out.code !== 0 || !out.stdout.trim()) return { table, label: def.label, ...unavailable(def.label.en.toLowerCase(), out) };
  return { table, label: def.label, available: true, ...parseIptables(out.stdout) };
}

async function readConnections(exec) {
  const [files, table] = await Promise.all([exec(headCommand(CONNTRACK_FILES)), exec("head -n 100000 /proc/net/nf_conntrack", { timeoutMs: 15000 })]);
  const values = parseHeadFiles(files.stdout);
  const num = (file) => (values.has(file) ? Number(values.get(file)) : null);
  const count = num(CONNTRACK_FILES[0]);
  const max = num(CONNTRACK_FILES[1]);
  const timeoutOf = (name) => num(`/proc/sys/net/netfilter/nf_conntrack_${name}`);
  return {
    available: count !== null,
    count, max, percent: count !== null && max ? Math.round((count / max) * 1000) / 10 : null,
    ...summariseConntrack(table.stdout),
    effective: Object.fromEntries(["tcp_timeout_established", "tcp_timeout_syn_sent", "tcp_timeout_syn_recv", "tcp_timeout_fin_wait", "tcp_timeout_time_wait", "tcp_timeout_close_wait", "tcp_timeout_last_ack", "udp_timeout", "udp_timeout_stream"].map((n) => [n, timeoutOf(n)])),
  };
}

async function readShaping(exec) {
  const qd = await exec("tc -s qdisc show", { timeoutMs: 15000 });
  if (qd.code !== 0) return { ...unavailable("traffic shaping", qd) };
  const qdiscs = parseTc(qd.stdout, "qdisc");
  const classes = [];
  for (const dev of [...new Set(qdiscs.map((q) => q.device).filter((d) => DEVICE.test(d)))].slice(0, 12)) {
    const out = await exec(`tc -s class show dev ${dev}`, { timeoutMs: 15000 });
    if (out.code === 0) classes.push(...parseTc(out.stdout, "class").map((c) => ({ ...c, device: c.device || dev })));
  }
  return { available: true, qdiscs, classes };
}

async function readHardening(exec) {
  const out = await exec(headCommand(HARDENING_FILES));
  const values = parseHeadFiles(out.stdout);
  const items = HARDENING.map((h) => {
    const value = values.get(h.file) ?? null;
    return { id: h.id, label: L(...h.label), about: L(...h.about), expected: L(...h.want), value, status: value === null ? "unknown" : h.good(value) ? "ok" : "warn" };
  });
  return { available: values.size > 0, items, ok: items.filter((i) => i.status === "ok").length, warn: items.filter((i) => i.status === "warn").length };
}

export default {
  id: "firewall-internals",

  catalog: () => ENTRIES,
  controls: { timeouts: timeoutsControl },

  domainMeta: [{ id: "firewall-internals", icon: "security", label: L("Firewall internals", "防火牆內部"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    "firewall-internals": async (ctx) => ({ entries: ctx.entries(), merlin: ctx.info.merlin }),
  },

  routes(api) {
    api.get("/rules", async ({ query, live, bad }) => {
      const table = String(query.table ?? "filter");
      if (!TABLES[table]) throw bad(`The table must be one of ${Object.keys(TABLES).join(", ")}.`);
      return { at: Date.now(), ...(await readRules((await live()).exec, table)) };
    });
    api.get("/ipsets", async ({ live }) => {
      const out = await (await live()).exec("ipset list", { timeoutMs: 15000 });
      if (out.code !== 0) return { at: Date.now(), ...unavailable("the address lists", out) };
      return { at: Date.now(), available: true, sets: parseIpset(out.stdout) };
    });
    api.get("/connections", async ({ live }) => ({ at: Date.now(), ...(await readConnections((await live()).exec)) }));
    api.get("/shaping", async ({ live }) => ({ at: Date.now(), ...(await readShaping((await live()).exec)) }));
    api.get("/hardening", async ({ live }) => ({ at: Date.now(), ...(await readHardening((await live()).exec)) }));
  },

  fakeRouter: {
    nvram: ({ firmware }) => ({
      ...(firmware === "merlin"
        ? {
            ct_max: "16384", ct_tcp_timeout: "0 1200 120 60 120 120 10 60 30 0", ct_udp_timeout: "30 180", fw_nat_loopback: "1",
            nf_sip: "0", nf_ftp: "1", nf_pptp: "1", nf_rtsp: "0", nf_h323: "0",
            rstats_enable: "1", rstats_path: "", rstats_stime: "1", rstats_offset: "1", cstats_enable: "1",
          }
        : {}),
    }),
    handlers: fakeHandlers({ TABLES, CONNTRACK_FILES, HARDENING_FILES, headCommand }),
  },
};
