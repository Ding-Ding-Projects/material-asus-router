// Traffic priority beyond the stock on/off, method and line speed: the
// Adaptive QoS priority order, the traditional QoS rules, the per-device
// bandwidth limiter, and the Cake settings on Asuswrt-Merlin.
//
// The lists use the "rule-table" control, which the firewall-pro feature
// provides (one control type, shared); the priority order is the
// "priority-order" control in priority.mjs. The line speed (qos_obw and
// qos_ibw) and the method (qos_type) stay in the stock catalogue.
import { L, parseRows } from "../kit.mjs";
import { DEFAULT_ORDER, priorityOrder } from "./priority.mjs";

const ADAPTIVE = L("Adaptive QoS", "自適應 QoS");
const TRADITIONAL = L("Traditional QoS rules", "傳統 QoS 規則");
const LIMITER = L("Bandwidth limiter", "頻寬限制");
const CAKE = L("Cake", "Cake");

const NOTE = L(
  "The setting name and its value form follow what Asus routers are known to use, but have not been checked on a real router yet. They work against the pretend router in tests.",
  "設定名稱同值嘅格式係跟 Asus 路由器常見做法，但未喺真正路由器驗證過。喺測試用嘅模擬路由器上運作正常。",
);

// The default Asus groups, from the most important to the least. The names
// describe what the groups usually hold; the router only stores the numbers.
const TIERS = [
  ["9,20", L("Work and video calls", "工作同視像通話")],
  ["4", L("Video and music streaming", "影片同音樂串流")],
  ["0,5,6,15,17", L("Web browsing and messaging", "瀏覽網頁同訊息")],
  ["8", L("Online games", "網上遊戲")],
  ["13,24", L("Learning", "學習")],
  ["1,3,14", L("File transfers", "檔案傳輸")],
  ["7,10,11,21,23", L("Everything else", "其他所有")],
];

const entry = (id, group, groupLabel, key, control, label, help, rest = {}) => ({ id: `qos-pro.${id}`, group, groupLabel, key, control, restart: "restart_qos", risk: "low", label, help, ...rest });

const PRIORITIES = [["0", L("Highest", "最高")], ["1", L("High", "高")], ["2", L("Medium", "中")], ["3", L("Low", "低")], ["4", L("Lowest", "最低")]];

const ENTRIES = [
  entry("adaptive.order", "adaptive", ADAPTIVE, "bwdpi_app_rulelist", "priority-order", L("Priority order", "優先次序"), L("Drag the groups to put the traffic that matters most at the top. When the line is busy, the top group is served first.", "拖動群組，將最重要嘅流量放喺最頂。線路繁忙時，最頂嘅群組最先處理。"), {
    requires: "bwdpi",
    options: TIERS,
    meta: { note: L("The group names describe the usual contents; the category numbers behind them are the Asus defaults.", "群組名稱係描述通常嘅內容；背後嘅類別編號係 Asus 預設值。") },
  }),

  entry("rules", "rules", TRADITIONAL, "qos_rulelist", "rule-table", L("Priority rules", "優先規則"), L("Each rule gives some traffic a priority. Rules are checked from the top. Leave the device or port empty to mean any.", "每條規則俾某啲流量一個優先級。規則由上而下檢查。裝置或端口留空即係任何。"), {
    maxItems: 32,
    meta: { note: NOTE },
    columns: [
      { id: "name", cell: "text", label: L("Name", "名稱"), max: 32, example: "Rule {n}" },
      { id: "source", cell: "device", label: L("Device", "裝置"), optional: true },
      { id: "port", cell: "port", label: L("Port", "端口"), optional: true },
      { id: "proto", cell: "select", label: L("Protocol", "協定"), options: [["tcp", L("TCP", "TCP")], ["udp", L("UDP", "UDP")], ["any", L("Any", "任何")]] },
      { id: "size", cell: "text", label: L("Transferred bytes", "傳輸量（位元組）"), optional: true, example: "", max: 24, pattern: "^\\d*~\\d*$", patternHint: "write a range such as 512~ or ~1024 or 512~2048." },
      { id: "priority", cell: "select", label: L("Priority", "優先級"), options: PRIORITIES },
    ],
  }),

  entry("limiter.rules", "limiter", LIMITER, "qos_bw_rulelist", "rule-table", L("Per-device limits", "每部裝置嘅限制"), L("Caps how fast one device can download and upload, so it cannot use up the whole line.", "限制一部裝置嘅下載同上載速度，唔會用晒成條線。"), {
    maxItems: 32,
    meta: { note: NOTE },
    columns: [
      { id: "on", cell: "switch", label: L("On", "開") },
      { id: "device", cell: "device", label: L("Device", "裝置") },
      { id: "down", cell: "kbps", label: L("Download limit", "下載上限"), unit: "kbit/s", min: 0, max: 10000000 },
      { id: "up", cell: "kbps", label: L("Upload limit", "上載上限"), unit: "kbit/s", min: 0, max: 10000000 },
    ],
  }),

  entry("cake.overhead", "cake", CAKE, "qos_overhead", "stepper", L("Packet overhead", "封包額外開銷"), L("How many extra bytes your connection adds to every packet. 0 is right for most home lines; ask your provider if unsure.", "你嘅連線喺每個封包加幾多額外位元組。大部分屋企線路用 0；唔肯定可以問網絡供應商。"), { firmware: "merlin", min: 0, max: 64, unit: "bytes" }),
  entry("cake.atm", "cake", CAKE, "qos_atm", "switch", L("ATM framing", "ATM 封裝"), L("Turn on only for older ADSL lines that use ATM cells.", "只有用 ATM 嘅舊式 ADSL 線路先需要開。"), { firmware: "merlin", values: { on: "1", off: "0" } }),
];

const METHODS = { "0": "traditional", "1": "adaptive", "2": "limiter" };

export default {
  id: "qos-pro",

  catalog: () => ENTRIES,

  controls: { "priority-order": priorityOrder },

  domainMeta: [{ id: "qos-pro", icon: "speed", label: L("Priority and limits", "優先同限制"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    "qos-pro": async (ctx) => {
      const get = (key) => ctx.nvram.get(key) ?? "";
      return {
        entries: ctx.entries(),
        stock: ctx.entries("qos"),
        method: METHODS[get("qos_type")] ?? "other",
        enabled: get("qos_enable") === "1",
        bwdpi: ctx.info.capabilities.includes("bwdpi"),
        merlin: ctx.info.merlin,
        defaultOrder: DEFAULT_ORDER,
        speed: { up: Number(get("qos_obw")) || 0, down: Number(get("qos_ibw")) || 0 },
      };
    },
  },

  routes(api) {
    // What the router is set to do right now, in one place.
    api.get("/plan", async ({ live }) => {
      const { nvram } = await live();
      const get = (key) => nvram.get(key) ?? "";
      const limits = parseRows(get("qos_bw_rulelist"));
      return {
        enabled: get("qos_enable") === "1",
        method: METHODS[get("qos_type")] ?? "other",
        up: Number(get("qos_obw")) || 0,
        down: Number(get("qos_ibw")) || 0,
        rules: parseRows(get("qos_rulelist")).length,
        limits: limits.length,
        limitsOn: limits.filter((row) => row[0] === "1").length,
        tiers: (get("bwdpi_app_rulelist") || "").split("<").filter(Boolean).length,
      };
    });
  },

  fakeRouter: {
    nvram: {
      bwdpi_app_rulelist: DEFAULT_ORDER,
      qos_rulelist: "<Web Surf>>80>tcp>>0<HTTPS>>443>tcp>>0<Big Downloads>>80>tcp>512~>3",
      qos_bw_rulelist: "<1>198.51.100.103>20000>5000",
      qos_overhead: "0",
      qos_atm: "0",
    },
  },
};
