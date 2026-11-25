// Captive portal: the "welcome" page visitors see before they can use a guest
// Wi-Fi. A switch, a picker for which guest network it covers, and how long a
// visitor stays signed in. Stock ASUS firmware only; on Asuswrt-Merlin every
// entry is switched off with the reason. The key names follow what the stock
// firmware is known to use but have not been checked on a real router, so the
// screen also switches off any entry whose setting the router does not list.
import { L, ON_OFF } from "../kit.mjs";

const STOCK_ONLY = "stock-firmware";
const NOTE = L(
  "The setting name follows what stock ASUS firmware is known to use but has not been checked on a real router yet. It works against the pretend router in tests.",
  "設定名稱跟返原廠 ASUS 韌體常見做法，但未喺真正路由器驗證過。喺測試用嘅模擬路由器上運作正常。",
);
const BAND = { 2: "2.4 GHz", 1: "5 GHz", 4: "6 GHz" };
const SESSIONS = [
  ["0", L("Until they leave", "直到佢哋離開")],
  ["3600", L("1 hour", "1 小時")],
  ["14400", L("4 hours", "4 小時")],
  ["86400", L("1 day", "1 日")],
  ["604800", L("7 days", "7 日")],
];
const missing = (key) => ({ en: `This router does not have the setting ${key}`, yue: `呢部路由器冇「${key}」呢個設定` });

export function captiveEntries(info) {
  const stockOnly = info.merlin ? { requires: STOCK_ONLY } : {};
  const base = { domain: "captive-portal", group: "portal", groupLabel: L("Welcome page for guests", "訪客歡迎頁"), restart: "restart_chilli", risk: "low", meta: { note: NOTE }, ...stockOnly };
  const networks = info.bands.flatMap((band) => [1, 2, 3].map((n) => [`wl${band.index}.${n}`, L(`${BAND[band.nband] ?? `Band ${band.index + 1}`}: guest network ${n}`, `${BAND[band.nband] ?? `頻段 ${band.index + 1}`}：訪客網絡 ${n}`)]));
  return [
    { ...base, id: "captive-portal.enabled", key: "captive_portal_enable", control: "switch", values: ON_OFF, label: L("Show a welcome page to guests", "向訪客顯示歡迎頁"), help: L("Visitors who join the guest Wi-Fi see a welcome page first and tap to continue. Leave it off if you want them online straight away.", "訪客連上訪客 Wi-Fi 後會先見到歡迎頁，撳一下先上到網。想佢哋即刻上網就保持關閉。") },
    { ...base, id: "captive-portal.network", key: "captive_portal_wlif", control: "select", options: networks, label: L("Guest network with the welcome page", "有歡迎頁嘅訪客網絡"), help: L("Pick which guest Wi-Fi shows the welcome page. Other guest networks are not affected.", "揀邊個訪客 Wi-Fi 顯示歡迎頁。其他訪客網絡唔受影響。") },
    { ...base, id: "captive-portal.session", key: "captive_portal_session", control: "select", options: SESSIONS, label: L("How long a visitor stays signed in", "訪客保持登入幾耐"), help: L("After this time the welcome page appears again. Until they leave means it only returns once the device has gone away for a while.", "過咗呢段時間歡迎頁會再出現。「直到佢哋離開」即係部裝置走咗一輪先會再出現。") },
    { ...base, id: "captive-portal.idle", key: "captive_portal_idle", control: "stepper", min: 0, max: 1440, step: 5, unit: " minutes", label: L("Sign out idle guests after", "閒置幾耐後登出訪客"), help: L("A visitor who has not used the internet for this long is signed out. 0 turns it off.", "訪客有咁耐冇上網就會登出。0 代表唔使。") },
  ];
}

export function defaults(bandIndexes) {
  return { captive_portal_enable: "0", captive_portal_wlif: `wl${bandIndexes[0]}.1`, captive_portal_session: "14400", captive_portal_idle: "30" };
}

export default {
  id: "captive-portal",

  catalog: captiveEntries,

  domainMeta: [{ id: "captive-portal", icon: "waving_hand", label: L("Guest welcome page", "訪客歡迎頁"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    "captive-portal": async (ctx) => {
      const nv = (key) => ctx.nvram.get(key) ?? "";
      const entries = ctx.entries().map((e) => (e.disabled || ctx.nvram.has(e.key) ? e : { ...e, disabled: missing(e.key) }));
      const wlif = nv("captive_portal_wlif");
      const ssids = ctx.info.bands.flatMap((band) => [1, 2, 3].map((n) => ({ id: `wl${band.index}.${n}`, ssid: nv(`wl${band.index}.${n}_ssid`), on: nv(`wl${band.index}.${n}_bss_enabled`) === "1" })));
      return {
        entries,
        stockOnly: !ctx.info.merlin,
        reason: ctx.info.merlin ? { en: "The welcome page needs the stock ASUS firmware. This router runs Asuswrt-Merlin.", yue: "歡迎頁要用原廠 ASUS 韌體。呢部路由器用緊 Asuswrt-Merlin。" } : null,
        enabled: nv("captive_portal_enable") === "1",
        network: wlif,
        networkReady: ssids.find((s) => s.id === wlif)?.on ?? false,
        ssids,
      };
    },
  },

  fakeRouter: { nvram: defaults([0, 1]) },
};
