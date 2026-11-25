// Firewall and filters: what is logged, the website and keyword filters, the
// network services filter with its weekly schedule, and the IPv6 firewall
// rules. The four stock firewall switches (firewall, ping from the internet,
// flood protection, IPv6 firewall) stay in the stock catalogue; the screen
// shows them beside these.
//
// Every list is a "rule-table" control (see table.mjs), the schedules are
// "weekdays" and "timerange" controls (see time.mjs), and every write goes
// through the change engine like any other setting.
import { L, ON_OFF, parseRows } from "../kit.mjs";
import { ruleTable } from "./table.mjs";
import { timerange, weekdays } from "./time.mjs";

const GROUP = {
  log: L("Logging", "記錄"),
  url: L("Website filter", "網站過濾"),
  keyword: L("Keyword filter", "關鍵字過濾"),
  services: L("Network services filter", "網絡服務過濾"),
  ipv6: L("IPv6 firewall rules", "IPv6 防火牆規則"),
};

const ICMP = ["echo-request", "echo-reply", "destination-unreachable", "time-exceeded", "redirect"].map((v) => [v, L(v, v)]);
const PROTOCOLS = [["TCP", L("TCP", "TCP")], ["UDP", L("UDP", "UDP")]];
const PROTOCOLS_V6 = [["TCP", L("TCP", "TCP")], ["UDP", L("UDP", "UDP")], ["BOTH", L("TCP and UDP", "TCP 同 UDP")]];

// The app masks every setting whose name matches this pattern as a secret
// (server/router/secrets.mjs), and the keyword filter's names contain "key". A
// masked list reads as empty, so editing it would silently wipe the real list.
// Until the shared pattern leaves "keyword" alone, those entries are shown but
// read-only, with the reason. tests/features/firewall-pro.test.mjs fails when
// the shared pattern changes, as the reminder to remove this.
const MASKED = /psk|passw|authkey|secret|token|key/i;
export const maskedByApp = (key) => MASKED.test(key);
const MASKED_NOTE = L(
  "In progress: the router's setting name for this contains \"key\", so the app hides its value as if it were a secret. Editing it from here would replace the real list with an empty one, so it is read-only until the app stops hiding the keyword filter's settings.",
  "進行中：呢個路由器設定名稱包含 \"key\"，所以程式會當佢係機密隱藏。喺呢度編輯會用空白清單覆蓋真正嘅清單，所以暫時唯讀，直到程式唔再隱藏關鍵字過濾嘅設定。",
);

const entry = (id, group, key, control, label, help, rest = {}) => ({
  id: `firewall-pro.${id}`, group, groupLabel: GROUP[group], key, control, restart: "restart_firewall", risk: "low", label, help, ...rest,
  ...(maskedByApp(key) ? { readOnly: true, meta: { note: MASKED_NOTE } } : {}),
});

// The schedule of one filter: which days, and one or two time windows.
const schedule = (prefix, group, key, windows = 1) => [
  entry(`${prefix}.days`, group, `${key}_date_x`, "weekdays", L("Days it applies", "適用日子"), L("The filter only works on the days that are on. Sunday is first.", "只喺開咗嘅日子先會過濾。星期日喺最前。")),
  entry(`${prefix}.time`, group, `${key}_time_x`, "timerange", L("Time of day", "時段"), L("The filter only works between these two times.", "只喺呢兩個時間之間先會過濾。")),
  ...(windows === 2
    ? [entry(`${prefix}.time2`, group, `${key}_time2_x`, "timerange", L("Second time of day", "第二個時段"), L("An optional second window on the same days.", "同一批日子可以再加一個時段。"), { optional: true })]
    : []),
];

const ENTRIES = [
  entry("log", "log", "fw_log_x", "select", L("Log these packets", "記錄邊啲封包"), L("Choose which firewall decisions are written to the system log.", "揀邊啲防火牆決定要寫入系統記錄。"), {
    options: [["none", L("None", "唔記錄"), L("Nothing is logged.", "乜都唔記錄。")], ["accept", L("Accepted", "已接受"), L("Connections the firewall let through.", "防火牆放行嘅連線。")], ["drop", L("Dropped", "已丟棄"), L("Connections the firewall blocked.", "防火牆擋住嘅連線。")], ["both", L("Both", "兩者")]],
  }),

  entry("url.enable", "url", "url_enable_x", "switch", L("Website filter", "網站過濾"), L("Blocks the websites in the list for every device.", "所有裝置都唔俾去名單入面嘅網站。"), { values: ON_OFF }),
  entry("url.list", "url", "url_rulelist", "rule-table", L("Blocked websites", "封鎖嘅網站"), L("Any address that contains one of these names is blocked, for example ads.example.test.", "地址入面包含呢啲名嘅都會被封鎖，例如 ads.example.test。"), {
    maxItems: 64,
    unique: true,
    hint: L("One website per rule.", "每條規則一個網站。"),
    columns: [{ id: "site", cell: "text", label: L("Website", "網站"), max: 48, pattern: "^[A-Za-z0-9._~/%:-]+$", patternHint: "use letters, digits and . - _ / only.", example: "ads{n}.example.test" }],
  }),
  ...schedule("url", "url", "url"),

  entry("keyword.enable", "keyword", "keyword_enable_x", "switch", L("Keyword filter", "關鍵字過濾"), L("Blocks any page address that contains one of the keywords.", "頁面地址只要包含其中一個關鍵字就會被封鎖。"), { values: ON_OFF }),
  entry("keyword.list", "keyword", "keyword_rulelist", "rule-table", L("Blocked keywords", "封鎖嘅關鍵字"), L("A short word. Pages whose address contains it are blocked.", "一個短詞。地址包含佢嘅頁面會被封鎖。"), {
    maxItems: 64,
    unique: true,
    columns: [{ id: "word", cell: "text", label: L("Keyword", "關鍵字"), max: 32, example: "keyword{n}" }],
  }),
  ...schedule("keyword", "keyword", "keyword"),

  entry("services.enable", "services", "fw_lw_enable_x", "switch", L("Network services filter", "網絡服務過濾"), L("Controls which connections devices may open to the internet. Test it with care: a wrong rule can cut devices off.", "控制裝置可以向互聯網開邊啲連線。小心設定：寫錯規則會令裝置上唔到網。"), { values: ON_OFF, risk: "network" }),
  entry("services.default", "services", "filter_lw_default_x", "segmented", L("Connections that match no rule", "唔符合任何規則嘅連線"), L("Drop blocks them. Accept lets them through. The rules below are the exceptions.", "丟棄即係擋住；接受即係放行。下面嘅規則就係例外。"), {
    risk: "network",
    options: [["DROP", L("Drop", "丟棄"), L("Block anything not listed as an exception.", "凡係未列為例外嘅都擋住。")], ["ACCEPT", L("Accept", "接受"), L("Allow anything not listed as an exception.", "凡係未列為例外嘅都放行。")]],
  }),
  entry("services.icmp", "services", "filter_lw_icmp_x", "chips", L("ICMP types to filter", "要過濾嘅 ICMP 類型"), L("The kinds of ping and error messages that are filtered.", "要過濾嘅 ping 同錯誤訊息種類。"), { delimiter: " ", options: ICMP, optional: true, maxItems: 5 }),
  entry("services.rules", "services", "filter_lwlist", "rule-table", L("Service rules", "服務規則"), L("Each rule names the devices, ports and protocol it covers. Leave a field empty to mean any.", "每條規則寫明適用嘅裝置、端口同協定。留空即係任何。"), {
    maxItems: 32,
    risk: "network",
    columns: [
      { id: "srcip", cell: "ipv4", label: L("From address", "來源地址"), optional: true },
      { id: "srcport", cell: "port", label: L("From port", "來源端口"), optional: true },
      { id: "dstip", cell: "ipv4", label: L("To address", "目的地址"), optional: true },
      { id: "dstport", cell: "port", label: L("To port", "目的端口"), optional: true },
      { id: "proto", cell: "select", label: L("Protocol", "協定"), options: PROTOCOLS },
    ],
  }),
  ...schedule("services", "services", "filter_lw", 2),

  entry("ipv6.rules", "ipv6", "ipv6_fw_rulelist", "rule-table", L("Allowed incoming IPv6 connections", "容許嘅 IPv6 連入連線"), L("When the IPv6 firewall is on, only the connections listed here may reach a device from the internet.", "開咗 IPv6 防火牆之後，只有呢度列出嘅連線先可以由互聯網連入裝置。"), {
    maxItems: 32,
    risk: "network",
    columns: [
      { id: "name", cell: "text", label: L("Service name", "服務名稱"), max: 24, example: "Service {n}" },
      { id: "remote", cell: "ipv6", label: L("Remote address", "遠端地址"), optional: true, example: "2001:db8:ffff::{n}" },
      { id: "local", cell: "ipv6", label: L("Device address", "裝置地址"), example: "2001:db8:1::{n}" },
      { id: "port", cell: "port", label: L("Port or range", "端口或範圍") },
      { id: "proto", cell: "select", label: L("Protocol", "協定"), options: PROTOCOLS_V6 },
    ],
  }),
];

const rows = (value) => parseRows(value).map((cells) => cells[0] ?? "").filter(Boolean);

function summarize(nvram) {
  const get = (key) => nvram.get(key) ?? "";
  return {
    firewall: get("fw_enable_x") === "1",
    ipv6Firewall: get("ipv6_fw_enable") === "1",
    log: get("fw_log_x") || "none",
    url: { enabled: get("url_enable_x") === "1", rules: rows(get("url_rulelist")).length },
    keyword: { enabled: get("keyword_enable_x") === "1", rules: rows(get("keyword_rulelist")).length },
    services: { enabled: get("fw_lw_enable_x") === "1", rules: parseRows(get("filter_lwlist")).length, fallback: get("filter_lw_default_x") || "DROP" },
    ipv6: { rules: parseRows(get("ipv6_fw_rulelist")).length },
  };
}

export default {
  id: "firewall-pro",

  catalog: () => ENTRIES,

  controls: { "rule-table": ruleTable, weekdays, timerange },

  domainMeta: [{ id: "firewall-pro", icon: "local_fire_department", label: L("Firewall and filters", "防火牆同過濾"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    "firewall-pro": async (ctx) => ({ entries: ctx.entries(), stock: ctx.entries("firewall"), summary: summarize(ctx.nvram) }),
  },

  routes(api) {
    // Would this address be blocked by the website or keyword filter right now?
    api.get("/test-url", async ({ query, live, bad }) => {
      const text = String(query.url ?? "").trim().toLowerCase();
      if (!text || text.length > 200 || /[\s<>]/.test(text)) throw bad("Enter a website address such as shop.example.test/page.");
      const { nvram } = await live();
      const get = (key) => nvram.get(key) ?? "";
      const site = rows(get("url_rulelist")).find((rule) => text.includes(rule.toLowerCase())) ?? null;
      const word = rows(get("keyword_rulelist")).find((rule) => text.includes(rule.toLowerCase())) ?? null;
      const byUrl = get("url_enable_x") === "1" && site !== null;
      const byKeyword = get("keyword_enable_x") === "1" && word !== null;
      return { url: text, blocked: byUrl || byKeyword, byUrlFilter: byUrl, byKeywordFilter: byKeyword, matchedSite: site, matchedKeyword: word };
    });
  },

  fakeRouter: {
    nvram: {
      fw_log_x: "none",
      url_enable_x: "0",
      url_date_x: "1111111",
      url_time_x: "00002359",
      url_rulelist: "<ads.example.test<tracker.example.test",
      keyword_enable_x: "0",
      keyword_date_x: "1111111",
      keyword_time_x: "00002359",
      keyword_rulelist: "<gambling",
      fw_lw_enable_x: "0",
      filter_lw_default_x: "DROP",
      filter_lw_icmp_x: "",
      filter_lw_date_x: "1111111",
      filter_lw_time_x: "08001700",
      filter_lw_time2_x: "",
      filter_lwlist: "<198.51.100.104>>203.0.113.9>25>TCP",
      ipv6_fw_rulelist: "<Web server>>2001:db8:1::5>443>TCP",
    },
  },
};
