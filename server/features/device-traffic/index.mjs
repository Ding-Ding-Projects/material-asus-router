// Device traffic: live upload and download per device, worked out from the
// router's connection tracking table (/proc/net/nf_conntrack). The table is
// read twice and the difference gives the rate, so the first reading is
// "warming up". This does not use the ASUS traffic analyser database (bwdpi).
import { L, ON_OFF, parseRows } from "../kit.mjs";
import { lanTest, parseConntrack, rates } from "./conntrack.mjs";

const HISTORY = 90;
let previous = null; // { at, devices }
let latest = null;
const history = [];

async function names(exec, nvram) {
  const out = await exec("head -n 100000 /var/lib/misc/dnsmasq.leases");
  const byIp = new Map();
  for (const line of out.stdout.split("\n")) {
    const [, mac, ip, host] = line.trim().split(/\s+/);
    if (ip) byIp.set(ip, { mac: (mac ?? "").toUpperCase(), name: host && host !== "*" ? host : "" });
  }
  // A name given in the Devices screen wins over the one the device announces.
  const custom = new Map();
  for (const row of parseRows(nvram.get("custom_clientlist") ?? "")) if (row[1]) custom.set(String(row[1]).toUpperCase(), row[0]);
  for (const info of byIp.values()) if (custom.get(info.mac)) info.name = custom.get(info.mac);
  return byIp;
}

async function sample(ctx, force = false) {
  const now = Date.now();
  if (!force && latest && now - latest.at < 900) return latest.view;
  const out = await ctx.exec("head -n 100000 /proc/net/nf_conntrack", { timeoutMs: 15000 });
  if (out.code !== 0) throw Object.assign(new Error("The router has no connection tracking table to read."), { status: 502 });
  const { devices, accounting } = parseConntrack(out.stdout, { lanIp: ctx.info.lan.ip, lanMask: ctx.info.lan.mask });
  const seconds = previous ? (now - previous.at) / 1000 : 0;
  const speed = rates(previous?.devices ?? new Map(), devices, seconds);
  const known = await names(ctx.exec, ctx.nvram);
  const rows = [...devices].map(([ip, row]) => {
    const rate = speed.get(ip);
    const who = known.get(ip) ?? { mac: "", name: "" };
    return { ip, mac: who.mac, name: who.name || ip, up: rate.up, down: rate.down, flows: row.flows, totalUp: row.up, totalDown: row.down };
  });
  previous = { at: now, devices };
  const total = rows.reduce((s, r) => ({ up: s.up + r.up, down: s.down + r.down }), { up: 0, down: 0 });
  if (seconds > 0) {
    history.push({ at: now, up: total.up, down: total.down, devices: Object.fromEntries(rows.map((r) => [r.ip, { up: r.up, down: r.down }])) });
    while (history.length > HISTORY) history.shift();
  }
  const view = { at: now, warm: seconds === 0, accounting, devices: rows, total, history: [...history], lan: { ip: ctx.info.lan.ip, mask: ctx.info.lan.mask } };
  latest = { at: now, view };
  return view;
}

export default {
  id: "device-traffic",

  catalog: () => {
    const g = { domain: "device-traffic", group: "live", groupLabel: L("Live view", "即時顯示"), risk: "low" };
    return [
      { ...g, id: "device-traffic.interval", key: "mar_traffic_interval", control: "stepper", min: 1, max: 10, unit: "s",
        label: L("Refresh every", "更新間隔"), help: L("How often the table is read. Shorter is smoother but asks the router more often.", "幾耐讀一次表。短啲會順啲，但路由器要做多啲。") },
      { ...g, id: "device-traffic.top", key: "mar_traffic_top", control: "stepper", min: 3, max: 20, unit: "devices",
        label: L("Devices in the chart", "圖表顯示嘅裝置數"), help: L("The chart shows the busiest devices only.", "圖表只顯示最繁忙嘅裝置。") },
      { ...g, id: "device-traffic.hide-idle", key: "mar_traffic_hide_idle", control: "switch", values: ON_OFF,
        label: L("Hide idle devices", "隱藏冇流量嘅裝置"), help: L("Devices with no traffic right now are left out of the table.", "而家冇流量嘅裝置唔會喺表入面出現。") },
      { ...g, id: "device-traffic.unit", key: "mar_traffic_unit", control: "segmented", options: [["bits", L("Megabits", "兆位元"), L("Mbit/s, like internet plans", "Mbit/s，同寬頻計劃一樣")], ["bytes", L("Megabytes", "兆位元組"), L("MB/s, like file copies", "MB/s，同複製檔案一樣")]],
        label: L("Show speeds in", "速度單位"), help: L("Only changes how numbers are shown.", "只改變數字點樣顯示。") },
    ];
  },

  domainMeta: [{ id: "device-traffic", icon: "monitoring", label: L("Device traffic", "裝置流量"), group: { en: "Monitor", yue: "監察" }, live: true }],
  domains: {
    "device-traffic": async (ctx) => ({
      interval: Number(ctx.nvram.get("mar_traffic_interval") ?? 2),
      top: Number(ctx.nvram.get("mar_traffic_top") ?? 8),
      hideIdle: (ctx.nvram.get("mar_traffic_hide_idle") ?? "1") === "1",
      unit: ctx.nvram.get("mar_traffic_unit") === "bytes" ? "bytes" : "bits",
      lan: ctx.info.lan,
      entries: ctx.entries(),
    }),
  },

  routes(api) {
    api.get("/sample", async ({ live }) => sample(await live()));
    api.post("/reset", async () => {
      previous = null;
      latest = null;
      history.length = 0;
      return { ok: true };
    });
  },

  fakeRouter: {
    nvram: { mar_traffic_interval: "2", mar_traffic_top: "8", mar_traffic_hide_idle: "1", mar_traffic_unit: "bits" },
    handlers: [
      (command, router) => {
        if (command !== "head -n 100000 /proc/net/nf_conntrack") return undefined;
        // Each device moves data at a steady pretend rate (bytes per second) so two readings differ predictably.
        const plan = [
          ["198.51.100.101", 2_500_000, 50_000],
          ["198.51.100.102", 400_000, 120_000],
          ["198.51.100.103", 60_000, 5_000],
          ["198.51.100.20", 100_000, 800_000],
        ];
        router.trafficStart ??= Date.now();
        const seconds = (Date.now() - router.trafficStart) / 1000;
        const acct = router.nvram.mar_fake_conntrack_acct !== "0";
        const flow = (ip, port, down, up, extra = "") => {
          const orig = Math.round(up * seconds / 2) + 4000;
          const reply = Math.round(down * seconds / 2) + 9000;
          const counts = (n) => (acct ? ` packets=${Math.ceil(n / 800)} bytes=${n}` : "");
          return `ipv4     2 tcp      6 431999 ESTABLISHED src=${ip} dst=203.0.113.10 sport=${port} dport=443${counts(orig)} src=203.0.113.10 dst=${ip} sport=443 dport=${port}${counts(reply)} [ASSURED] mark=0 ${extra}\n`;
        };
        let text = "";
        for (const [ip, down, up] of plan) text += flow(ip, 50000, down, up) + flow(ip, 50001, down, up);
        text += "ipv4     2 udp      17 20 src=198.51.100.101 dst=198.51.100.20 sport=5000 dport=5001 packets=3 bytes=300 src=198.51.100.20 dst=198.51.100.101 sport=5001 dport=5000 packets=3 bytes=300\n";
        text += "ipv4     2 tcp      6 100 ESTABLISHED src=198.51.100.1 dst=203.0.113.10 sport=40000 dport=443 packets=1 bytes=100 src=203.0.113.10 dst=198.51.100.1 sport=443 dport=40000 packets=1 bytes=100\n";
        return { stdout: text };
      },
    ],
  },
};
