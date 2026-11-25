// Top talkers: who is uploading and downloading the most. The router's
// connection table is read every few seconds and each connection's byte counter
// is followed, so the ranking can show both the speed right now and the total
// since this screen started counting. It does not use the ASUS traffic
// analyser database, and it never writes to the router.
import { L, ON_OFF, parseRows } from "../kit.mjs";
import { advance, parseFlows } from "./flows.mjs";

const ID = "top-talkers";
const MAX_FLOWS = 20000;
const fresh = () => ({ at: null, flows: new Map(), devices: new Map(), since: Date.now(), readings: 0 });
let state = fresh();
let latest = null;
let accounting = null;

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

async function sample(ctx) {
  const now = Date.now();
  if (latest && now - latest.at < 900) return latest.view;
  const out = await ctx.exec("head -n 100000 /proc/net/nf_conntrack", { timeoutMs: 15000 });
  if (out.code !== 0) throw Object.assign(new Error("The router has no connection tracking table to read."), { status: 502 });
  const parsed = parseFlows(out.stdout, { lanIp: ctx.info.lan.ip, lanMask: ctx.info.lan.mask });
  accounting = parsed.accounting;
  state = advance(state, parsed.flows.slice(0, MAX_FLOWS), now);
  const known = await names(ctx.exec, ctx.nvram);
  const devices = [...state.devices].map(([ip, row]) => {
    const who = known.get(ip) ?? { mac: "", name: "" };
    return { ip, mac: who.mac, name: who.name || ip, ...row };
  });
  const view = { at: now, since: state.since, warm: state.readings < 2, accounting, devices };
  latest = { at: now, view };
  return view;
}

export default {
  id: ID,

  catalog: () => {
    const g = { domain: ID, group: "view", groupLabel: L("What to show", "顯示內容"), risk: "low" };
    return [
      { ...g, id: `${ID}.view`, key: "mar_talkers_view", control: "segmented", options: [["down", L("Downloading most", "下載最多")], ["up", L("Uploading most", "上傳最多")], ["both", L("Both together", "上傳加下載")]],
        label: L("Open on", "預設顯示"), help: L("Which ranking appears first when this page opens.", "打開呢頁嘅時候先顯示邊個排名。") },
      { ...g, id: `${ID}.window`, key: "mar_talkers_window", control: "segmented", options: [["now", L("Right now", "而家")], ["since", L("Since counting started", "由開始計數起")]],
        label: L("Measure", "計算方式"), help: L("Right now is the speed over the last few seconds; since counting started is the total moved while this app watched.", "「而家」係最近幾秒嘅速度；「由開始計數起」係呢個程式睇住期間搬咗嘅總量。") },
      { ...g, id: `${ID}.count`, key: "mar_talkers_count", control: "stepper", min: 3, max: 20, unit: "devices",
        label: L("Devices in the ranking", "排名顯示嘅裝置數"), help: L("The ranking shows this many of the busiest devices.", "排名顯示最繁忙嘅幾部裝置。") },
      { ...g, id: `${ID}.interval`, key: "mar_talkers_interval", control: "stepper", min: 1, max: 10, unit: "s",
        label: L("Refresh every", "更新間隔"), help: L("How often the table is read while this page is open. Shorter is smoother but asks the router more often.", "呢頁開住嗰陣幾耐讀一次表。短啲會順啲，但路由器要做多啲。") },
      { ...g, id: `${ID}.unit`, key: "mar_talkers_unit", control: "segmented", options: [["bits", L("Megabits", "兆位元"), L("Mbit/s, like internet plans", "Mbit/s，同寬頻計劃一樣")], ["bytes", L("Megabytes", "兆位元組"), L("MB/s, like file copies", "MB/s，同複製檔案一樣")]],
        label: L("Show speeds in", "速度單位"), help: L("Only changes how numbers are shown.", "只改變數字點樣顯示。") },
      { ...g, id: `${ID}.hide-idle`, key: "mar_talkers_hide_idle", control: "switch", values: ON_OFF,
        label: L("Hide devices that moved nothing", "隱藏冇流量嘅裝置"), help: L("Devices with no traffic in the chosen measure are left out of the ranking.", "喺所揀計算方式入面冇流量嘅裝置唔會出現喺排名。") },
    ];
  },

  domainMeta: [{ id: ID, icon: "leaderboard", label: L("Top talkers", "邊個用得最多"), group: { en: "Monitor", yue: "監察" }, live: true }],
  domains: {
    [ID]: async (ctx) => {
      const get = (key, fallback) => ctx.nvram.get(key) ?? fallback;
      return {
        view: get("mar_talkers_view", "down"),
        window: get("mar_talkers_window", "now"),
        count: Number(get("mar_talkers_count", 8)),
        interval: Number(get("mar_talkers_interval", 2)),
        unit: get("mar_talkers_unit", "bits") === "bytes" ? "bytes" : "bits",
        hideIdle: get("mar_talkers_hide_idle", "1") === "1",
        entries: ctx.entries(),
      };
    },
  },

  routes(api) {
    api.get("/sample", async ({ live }) => sample(await live()));
    // Starts counting again from zero. Nothing on the router changes.
    api.post("/reset", async () => {
      state = fresh();
      latest = null;
      return { ok: true, since: state.since };
    });
  },

  fakeRouter: {
    nvram: { mar_talkers_view: "down", mar_talkers_window: "now", mar_talkers_count: "8", mar_talkers_interval: "2", mar_talkers_unit: "bits", mar_talkers_hide_idle: "1" },
  },
};
