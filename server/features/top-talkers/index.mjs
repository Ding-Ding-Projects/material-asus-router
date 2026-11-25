// Who is using the most: a live leaderboard of devices by upload and download, with today and this-week
// totals and a live history per device. It uses only the byte counters of each connection in the router's
// connection table. It never reads, stores or shows websites, apps or what anyone visited, and the totals
// are only byte counts kept in memory (they start again when this app restarts).
//
// Household owners come from the optional setting mar_member_owners (rows like <AA:BB:CC:DD:EE:FF>Your brother).
import { L, ON_OFF, parseRows } from "../kit.mjs";
import { Meter, parseFlows } from "./meter.mjs";

const meter = new Meter({ historyLength: 90 });
let latest = null; // { at, view }
const MAX_DEVICES = 200;

async function nameBook(exec, nvram) {
  const leases = await exec("head -n 100000 /var/lib/misc/dnsmasq.leases");
  const byIp = new Map();
  for (const line of leases.stdout.split("\n")) {
    const [, mac, ip, host] = line.trim().split(/\s+/);
    if (ip) byIp.set(ip, { mac: (mac ?? "").toUpperCase(), name: host && host !== "*" ? host : "" });
  }
  const custom = new Map();
  for (const row of parseRows(nvram.get("custom_clientlist") ?? "")) if (row[1]) custom.set(String(row[1]).toUpperCase(), row[0]);
  const owners = new Map();
  for (const row of parseRows(nvram.get("mar_member_owners") ?? "")) if (row[0] && row[1]) owners.set(String(row[0]).toUpperCase(), String(row[1]).trim().slice(0, 40));
  for (const info of byIp.values()) {
    if (custom.get(info.mac)) info.name = custom.get(info.mac);
    info.owner = owners.get(info.mac) ?? "";
  }
  return byIp;
}

async function sample(ctx, force = false) {
  const now = Date.now();
  if (!force && latest && now - latest.at < 800) return latest.view;
  const out = await ctx.exec("head -n 100000 /proc/net/nf_conntrack", { timeoutMs: 15000 });
  if (out.code !== 0) throw Object.assign(new Error("The router has no connection tracking table to read."), { status: 502 });
  const { flows, accounting } = parseFlows(out.stdout, { lanIp: ctx.info.lan.ip, lanMask: ctx.info.lan.mask });
  const { warm } = meter.update(flows, now);
  const book = await nameBook(ctx.exec, ctx.nvram);
  const devices = [...meter.devices.values()]
    .sort((a, b) => b.weekDown + b.weekUp - (a.weekDown + a.weekUp) || a.ip.localeCompare(b.ip, undefined, { numeric: true }))
    .slice(0, MAX_DEVICES)
    .map((d) => {
      const who = book.get(d.ip) ?? { mac: "", name: "", owner: "" };
      return { ip: d.ip, mac: who.mac, name: who.name || d.ip, owner: who.owner, up: d.up, down: d.down, flows: d.flows, todayUp: d.todayUp, todayDown: d.todayDown, weekUp: d.weekUp, weekDown: d.weekDown, history: d.history };
    });
  const total = devices.reduce((s, d) => ({ up: s.up + d.up, down: s.down + d.down, todayUp: s.todayUp + d.todayUp, todayDown: s.todayDown + d.todayDown, weekUp: s.weekUp + d.weekUp, weekDown: s.weekDown + d.weekDown }), { up: 0, down: 0, todayUp: 0, todayDown: 0, weekUp: 0, weekDown: 0 });
  const view = { at: now, since: meter.since, day: meter.day, week: meter.week, warm, accounting, devices, total };
  latest = { at: now, view };
  return view;
}

export default {
  id: "top-talkers",

  catalog: () => {
    const g = { domain: "top-talkers", group: "board", groupLabel: L("Leaderboard", "排行榜"), risk: "low" };
    return [
      { ...g, id: "top-talkers.interval", key: "mar_talkers_interval", control: "stepper", min: 1, max: 10, unit: "s",
        label: L("Refresh every", "更新間隔"), help: L("How often the leaderboard reads the router. Shorter is livelier but asks the router more often.", "排行榜幾耐讀一次路由器。短啲會生動啲，但路由器要做多啲。") },
      { ...g, id: "top-talkers.shown", key: "mar_talkers_shown", control: "stepper", min: 3, max: 30, unit: "devices",
        label: L("Devices in each list", "每個榜顯示嘅裝置數"), help: L("Each leaderboard shows this many of the busiest devices.", "每個排行榜顯示呢個數量最繁忙嘅裝置。") },
      { ...g, id: "top-talkers.rank", key: "mar_talkers_rank", control: "segmented", options: [["rate", L("Speed now", "而家速度"), L("Who is using the most this second.", "呢一刻邊個用得最多。")], ["today", L("Today", "今日"), L("Who has moved the most data today.", "今日邊個用咗最多流量。")], ["week", L("This week", "本星期"), L("Who has moved the most data since Monday.", "星期一起邊個用咗最多流量。")]],
        label: L("Rank by", "排名方式"), help: L("What the two leaderboards are sorted by when the page opens.", "打開頁面時兩個排行榜按咩排序。") },
      { ...g, id: "top-talkers.hide-idle", key: "mar_talkers_hide_idle", control: "switch", values: ON_OFF,
        label: L("Hide idle devices", "隱藏冇流量嘅裝置"), help: L("Devices with no traffic in the chosen ranking are left out.", "喺所選排名入面冇流量嘅裝置唔會顯示。") },
    ];
  },

  domainMeta: [{ id: "top-talkers", icon: "leaderboard", label: L("Who's using the most", "邊個用得最多"), group: { en: "Monitor", yue: "監察" }, live: true }],
  domains: {
    "top-talkers": async (ctx) => ({
      interval: Number(ctx.nvram.get("mar_talkers_interval") ?? 2),
      shown: Number(ctx.nvram.get("mar_talkers_shown") ?? 8),
      rank: ["rate", "today", "week"].includes(ctx.nvram.get("mar_talkers_rank")) ? ctx.nvram.get("mar_talkers_rank") : "rate",
      hideIdle: (ctx.nvram.get("mar_talkers_hide_idle") ?? "1") === "1",
      entries: ctx.entries(),
    }),
  },

  routes(api) {
    api.get("/sample", async ({ live }) => sample(await live()));
    api.post("/reset", async () => {
      meter.reset();
      latest = null;
      return { ok: true };
    });
  },

  fakeRouter: {
    nvram: { mar_talkers_interval: "2", mar_talkers_shown: "8", mar_talkers_rank: "rate", mar_talkers_hide_idle: "1", mar_member_owners: "<AC:5A:F0:01:02:03>Your brother" },
  },
};
