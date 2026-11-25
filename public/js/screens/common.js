// Pieces every screen uses: the page header, domain loading and the generic
// settings view that renders catalogue groups as rich controls.
import { api, h, icon, t, tt } from "../core.js";
import { app } from "../dock.js";
import { groupCard, settingGroups } from "../controls.js";

export const LEDE = {
  overview: ["A live look at your router, your internet link and your traffic.", "即時睇路由器、上網連線同流量。"],
  devices: ["Everything connected right now. Rename, reserve an address, block or wake a device.", "而家連住嘅所有裝置。可以改名、留住地址、封鎖或者喚醒。"],
  wifi: ["Names, passwords, channels and guest networks for each Wi-Fi band.", "每個 Wi-Fi 頻段嘅名稱、密碼、頻道同訪客網絡。"],
  internet: ["How the router reaches the internet, plus name servers and dynamic DNS.", "路由器點樣連上互聯網，同域名伺服器、動態 DNS。"],
  lan: ["The router's address, automatic addresses and reserved addresses for devices.", "路由器地址、自動派地址，同俾裝置留住嘅地址。"],
  forwarding: ["Let the internet reach a chosen device on a chosen port. Only open what you need.", "等互聯網連到指定裝置嘅指定端口。需要先開。"],
  firewall: ["The router's built-in protection against unwanted connections.", "路由器內置嘅防護，擋住唔想要嘅連線。"],
  parental: ["Cut chosen devices off from the internet.", "封鎖指定裝置上網。"],
  qos: ["Keep calls and games smooth while someone downloads.", "有人下載嗰陣，都保持通話同遊戲順暢。"],
  vpn: ["Reach your home network safely from anywhere.", "喺任何地方都可以安全咁連返屋企網絡。"],
  aimesh: ["The router and any mesh nodes working together.", "路由器同 mesh 節點一齊運作。"],
  usb: ["Drives plugged into the router and how they are shared.", "插咗喺路由器嘅磁碟，同埋點樣分享。"],
  logs: ["What the router has been doing, newest at the bottom.", "路由器做過啲咩，最新嘅喺底部。"],
  tools: ["Ping, trace, look up a name or wake a sleeping device from the router.", "用路由器去 ping、追蹤路徑、查域名或者喚醒裝置。"],
  jobs: ["Tasks the router runs on a timetable.", "路由器按時間表自動做嘅工作。"],
  backup: ["Save the router's settings to a file, or restore them from one.", "將路由器設定存成檔案，或者由檔案還原。"],
  firmware: ["Which firmware the router runs.", "路由器用緊邊個韌體。"],
  system: ["Time, access to the router, the app's SSH key and who can use this app.", "時間、路由器存取、本程式嘅 SSH 金鑰同埋邊個可以用本程式。"],
  maintenance: ["Restart parts of the router, or the whole thing.", "重啟路由器嘅部分功能，或者成部機。"],
  merlin: ["Extras that only Asuswrt-Merlin firmware has.", "只有 Asuswrt-Merlin 韌體先有嘅附加功能。"],
  advanced: ["Every raw router setting. Powerful, so edits get the safety net.", "路由器所有原始設定。功能強大，所以每項改動都有安全機制。"],
  history: ["Everything this app changed, with one-click undo.", "呢個程式做過嘅所有改動，一撳就可以還原。"],
};

export function domainInfo(id) {
  return app.catalog.domains.find((d) => d.id === id) ?? app.featureScreens?.[id] ?? { id, icon: "settings", label: { en: id, yue: id } };
}

export function header(id, extra) {
  const domain = domainInfo(id);
  const [en, yue] = LEDE[id] ?? ["", ""];
  return h("div", { class: "rise" },
    h("h1", { class: "disp" }, tt(domain.label)),
    h("p", { class: "lede" }, t(en, yue)),
    app.canWrite ? null : h("div", { class: "pill t" }, icon("visibility", "sm"), t("View only. Your account cannot change settings.", "只可以睇。你嘅帳戶唔可以改設定。")),
    extra,
  );
}

export const loadDomain = (id, query = "") => api.get(`/api/domain/${id}${query}`);

export function unsupported(id, reason) {
  return h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("lock", "lg"), h("div", { class: "t1" }, t("Not available on this router", "呢部路由器用唔到")), h("div", { class: "muted" }, tt(reason))));
}

// The ordinary settings screen: one card per group of catalogue entries.
export async function settingsScreen(root, id, { extra, before } = {}) {
  const data = await loadDomain(id);
  const page = h("div", { class: "page" }, header(id));
  root.append(page);
  if (before) append(page, before(data));
  const cards = settingGroups(data.entries ?? []).map((g) => groupCard(g.label, g.entries));
  if (cards.length) page.append(h("div", { class: "grid2" }, cards));
  if (extra) {
    const more = await extra(data);
    if (more) page.append(...[more].flat());
  }
  return data;
}

function append(parent, nodes) {
  for (const n of [nodes].flat()) if (n) parent.append(n);
}

export const tableOf = (heads, rows) =>
  h("div", { class: "tbl" }, h("table", {}, h("thead", {}, h("tr", {}, heads.map((x) => h("th", {}, x)))), h("tbody", {}, rows)));
