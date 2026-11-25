// Parental controls, per device: cut one device off from the internet, or block
// it on a weekly schedule, plus the web and apps filter categories on models
// that have the traffic-inspection engine (rc_support "bwdpi").
//
// The device list is the router's four parallel MULTIFILTER_* settings (see
// columns.mjs). Each is a normal catalogue entry, so each can be previewed and
// undone; the screen and the /device route change all four together so they
// never fall out of step. The master switch is the stock parental.enabled entry.
import { L, ON_OFF, parseRows } from "../kit.mjs";
import { COLUMN_KEYS, MAX_DEVICES, MODES, columnList, readDevices, writeDevices } from "./columns.mjs";

const DEVICES = L("Devices", "裝置");
const WEB = L("Web and apps filters", "網頁同應用程式過濾");
const UNVERIFIED = L(
  "The setting name and its value form follow what Asus routers are known to use, but have not been checked on a real router yet. They work against the pretend router in tests.",
  "設定名稱同值嘅格式係跟 Asus 路由器常見做法，但未喺真正路由器驗證過。喺測試用嘅模擬路由器上運作正常。",
);

const column = (id, key, item, label, help, rest = {}) => ({ id: `parental-pro.${id}`, group: "devices", groupLabel: DEVICES, key, control: "column-list", item, restart: "restart_firewall", risk: "low", label, help, ...rest });

const CATEGORIES = [
  ["1", L("Adult content", "成人內容")],
  ["2", L("Chat and messaging", "傾偈同訊息")],
  ["3", L("File sharing and P2P", "檔案分享同 P2P")],
  ["4", L("Video and music streaming", "影片同音樂串流")],
  ["5", L("Social networks", "社交網絡")],
  ["6", L("Online games", "網上遊戲")],
  ["7", L("Gambling", "賭博")],
  ["8", L("Shopping", "購物")],
];

const web = (id, key, control, label, help, rest = {}) => ({ id: `parental-pro.web.${id}`, group: "web", groupLabel: WEB, key, control, restart: "restart_wrs", risk: "low", requires: "bwdpi", label, help, meta: { note: UNVERIFIED }, ...rest });

const ENTRIES = [
  column("macs", COLUMN_KEYS.mac, "mac", L("Controlled devices", "受控制嘅裝置"), L("The devices that have a rule, by MAC address. Change a device on the screen so the four lists stay together.", "有規則嘅裝置（MAC 地址）。請喺畫面改裝置，咁四個清單先會保持一致。")),
  column("modes", COLUMN_KEYS.mode, "mode", L("Rule for each device", "每部裝置嘅規則"), L("0 is no rule, 1 is blocked on the schedule, 2 is blocked all the time. One value per device, in the same order.", "0 係冇規則，1 係按時間表封鎖，2 係全日封鎖。每部裝置一個值，次序一樣。")),
  column("names", COLUMN_KEYS.name, "name", L("Device names", "裝置名稱"), L("A name for each device, in the same order.", "每部裝置嘅名稱，次序一樣。")),
  column("daytime", COLUMN_KEYS.daytime, "daytime", L("Blocked times", "封鎖時段"), L("For each device, the windows when the internet is blocked. A window is the days, a start and an end; an end before the start runs overnight.", "每部裝置封鎖上網嘅時段。每個時段有日子、開始同結束；結束早過開始即係跨夜。"), {
    meta: { note: L("The window form was reconstructed from router output and has not been checked on hardware, and whether windows mean blocked or allowed time still needs confirming.", "時段格式係根據路由器輸出推斷，未喺硬件驗證，而且時段代表封鎖定容許，都仲要確認。") },
  }),

  web("enable", "wrs_enable", "switch", L("Web filter", "網頁過濾"), L("Blocks websites in the chosen categories for the devices that have a rule.", "對有規則嘅裝置封鎖所揀類別嘅網站。"), { values: ON_OFF }),
  web("apps", "wrs_app_enable", "switch", L("Apps filter", "應用程式過濾"), L("Blocks apps in the chosen categories, even when they do not use a website.", "封鎖所揀類別嘅應用程式，就算佢哋唔經網站。"), { values: ON_OFF }),
  web("categories", "wrs_rulelist", "chips", L("Blocked categories", "封鎖嘅類別"), L("Pick the kinds of content to block. The category numbers are assumed, not confirmed.", "揀要封鎖嘅內容種類。類別編號係假設，未確認。"), { delimiter: ">", options: CATEGORIES, optional: true, maxItems: CATEGORIES.length }),
];

// Who the router knows: leased devices, with names the person gave them first.
async function known(ctx) {
  const names = new Map(parseRows(ctx.nvram.get("custom_clientlist") ?? "").map((row) => [String(row[1] ?? "").toUpperCase(), row[0]]));
  const out = new Map();
  let leases = "";
  try {
    const result = await ctx.exec("head -n 100000 /var/lib/misc/dnsmasq.leases");
    if (result.code === 0) leases = result.stdout;
  } catch {
    leases = "";
  }
  for (const line of leases.split("\n")) {
    const [, mac, ip, host] = line.trim().split(/\s+/);
    if (!mac) continue;
    const key = mac.toUpperCase();
    out.set(key, { mac: key, ip: ip ?? "", name: names.get(key) || (host && host !== "*" ? host : key) });
  }
  return out;
}

const view = (device, directory) => ({
  mac: device.mac,
  mode: device.mode,
  name: device.name || directory.get(device.mac)?.name || device.mac,
  ip: directory.get(device.mac)?.ip ?? "",
  slots: device.slots.map((slot) => ({ days: slot.days, start: slot.start, end: slot.end })),
});

export default {
  id: "parental-pro",

  catalog: () => ENTRIES,

  controls: { "column-list": columnList },

  domainMeta: [{ id: "parental-pro", icon: "family_restroom", label: L("Time limits and filters", "時間限制同過濾"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    "parental-pro": async (ctx) => {
      const directory = await known(ctx);
      const controlled = readDevices((key) => ctx.nvram.get(key) ?? "").filter((d) => d.mode !== "0");
      const bwdpi = ctx.info.capabilities.includes("bwdpi");
      return {
        entries: ctx.entries(),
        stock: ctx.entries("parental"),
        enabled: ctx.nvram.get("MULTIFILTER_ALL") === "1",
        devices: controlled.map((d) => view(d, directory)),
        known: [...directory.values()],
        limit: MAX_DEVICES,
        webSupported: bwdpi,
        webReason: bwdpi ? null : L("This router model does not include the traffic-inspection engine (bwdpi), so web and apps filters are not available.", "呢個型號冇流量檢查引擎（bwdpi），所以冇網頁同應用程式過濾。"),
      };
    },
  },

  routes(api) {
    // Sets one device's rule and blocked times in all four lists at once and
    // returns the change preview; the person still applies it.
    // body: { mac, name?, mode: "0" | "1" | "2", slots?: [{ days: [0-6], start: "HHMM", end: "HHMM" }] }
    api.post("/device", async ({ body, live, preview, bad }) => {
      const mac = String(body.mac ?? "").toUpperCase();
      if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) throw bad("Enter the device's MAC address.");
      const mode = String(body.mode ?? "");
      if (!MODES.includes(mode)) throw bad("Choose a rule: 0 none, 1 on the schedule, 2 always blocked.");
      const slots = (body.slots ?? []).map((slot) => ({ days: [...new Set((slot.days ?? []).map(Number))].sort(), start: String(slot.start), end: String(slot.end) }));
      for (const slot of slots) if (!slot.days.length || slot.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || !/^\d{4}$/.test(slot.start) || !/^\d{4}$/.test(slot.end)) throw bad("Each blocked time needs days 0 to 6 and a start and an end such as 2100.");
      const ctx = await live();
      const devices = readDevices((key) => ctx.nvram.get(key) ?? "");
      const at = devices.findIndex((d) => d.mac === mac);
      if (mode === "0") {
        if (at === -1) throw bad("That device has no rule.", 404);
        devices.splice(at, 1);
      } else {
        const next = { mac, mode, name: String(body.name ?? devices[at]?.name ?? "").slice(0, 32), slots: mode === "1" ? slots : [] };
        if (mode === "1" && !slots.length) throw bad("Add at least one blocked time, or choose always blocked.");
        if (at === -1) devices.push(next);
        else devices[at] = next;
      }
      if (devices.length > MAX_DEVICES) throw bad(`The router can keep rules for at most ${MAX_DEVICES} devices.`);
      const values = writeDevices(devices);
      const byKey = new Map(ENTRIES.map((e) => [e.key, e.id]));
      return preview({ changes: Object.entries(values).map(([key, value]) => ({ id: byKey.get(key), value })) });
    });
  },

  fakeRouter: {
    nvram: { MULTIFILTER_MACFILTER_DAYTIME: "", wrs_enable: "0", wrs_app_enable: "0", wrs_rulelist: "1>3" },
  },
};
