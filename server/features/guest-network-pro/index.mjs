// Guest Network Pro: the extra guest networks of a Wi-Fi 7 router, one block per network slot the router really
// has (the keys apg1_..., apg2_... and so on). Each slot can be switched on, named, hidden, isolated from the
// other devices and put in multi-link, with an optional device allow or block mode and a weekly timetable switch.
//
// The slots are found from the router's own settings list, so a router with six slots shows six and a router
// without any shows none. What is not here: the password and security of a slot are stored by the firmware in
// one packed text value (apgN_security), the access lists and the bandwidth limit have packed formats too, so
// those stay on the router's own page and in the Advanced table rather than being written blind.
import { L, ON_OFF } from "../kit.mjs";

const F = "guest-network-pro";
const FREE_NAME = "A network name is whatever the owner wants to call it.";
const MODES = [
  ["disabled", L("Everyone may join", "所有人都可以連"), L("No device list is used.", "唔使用裝置名單。")],
  ["allow", L("Only listed devices", "淨係名單入面嘅裝置"), L("Devices that are not on the list are refused.", "唔喺名單嘅裝置會被拒絕。")],
  ["deny", L("Everyone except listed devices", "名單入面嘅裝置以外嘅人"), L("Listed devices are refused.", "喺名單嘅裝置會被拒絕。")],
];
const DEMO_SLOTS = 18;

// Slot numbers the router really has, from its own list of settings.
export const slotsOf = (info) => [...(info.settingKeys ?? [])].map((key) => /^apg([1-9]\d*)_enable$/.exec(key)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);

export function slotEntries(n) {
  const p = `apg${n}`;
  const g = { group: `slot-${n}`, groupLabel: L(`Guest network ${n}`, `訪客網絡 ${n}`) };
  const entry = (id, key, extra) => ({ id: `${F}.${p}.${id}`, key: `${p}_${key}`, ...g, restart: "restart_wireless", risk: "low", requires: "mtlancfg", ...extra });
  return [
    entry("enable", "enable", { control: "switch", values: ON_OFF, label: L("Use this guest network", "使用呢個訪客網絡"), help: L("Switches the Wi-Fi on. Give it a name and a password on the router's own page first.", "開啟呢個 Wi-Fi。請先喺路由器自己嘅網頁設定名稱同密碼。") }),
    entry("ssid", "ssid", { control: "text", freeText: true, freeTextReason: FREE_NAME, minLength: 0, maxLength: 32, hint: L("Up to 32 characters.", "最多 32 個字元。"), label: L("Network name", "網絡名稱"), help: L("The name visitors look for. Leave it empty until you have chosen one.", "訪客搵嘅名。未揀之前可以留空。") }),
    entry("hide", "hide_ssid", { control: "switch", values: ON_OFF, label: L("Hide the network name", "隱藏網絡名稱"), help: L("Visitors must type the name by hand. This does not make the network more secure.", "訪客要自己打名。呢樣唔會令網絡更安全。") }),
    entry("isolate", "ap_isolate", { control: "switch", values: ON_OFF, label: L("Keep guests apart from each other", "訪客之間互相隔開"), help: L("Devices on this network cannot see each other, only the internet.", "呢個網絡入面嘅裝置睇唔到對方，只可以上網。") }),
    entry("be", "11be", { control: "switch", values: ON_OFF, label: L("Use Wi-Fi 7 on this network", "呢個網絡用 Wi-Fi 7"), help: L("Lets Wi-Fi 7 devices use the fastest standard here. Turn it off if a device fails to join.", "等 Wi-Fi 7 裝置喺度用最快嘅標準。有裝置連唔到就關閉。"), requires: "wifi7" }),
    entry("mlo", "mlo", { control: "switch", values: ON_OFF, label: L("Use multi-link on this network", "呢個網絡用多連結"), help: L("Wi-Fi 7 devices may use two bands at once. Needs Wi-Fi 7 above to be on.", "Wi-Fi 7 裝置可以同時用兩個頻段。要先開上面嘅 Wi-Fi 7。"), requires: "mlo" }),
    entry("macmode", "macmode", { control: "select", options: MODES, label: L("Which devices may join", "邊啲裝置可以連"), help: L("Choose how the list of devices on the router's own page is used.", "揀路由器自己網頁入面嘅裝置名單點樣用。") }),
    entry("timed", "timesched", { control: "switch", values: ON_OFF, label: L("Follow the weekly timetable", "跟每星期時間表"), help: L("The network is on only at the times set on the router's own page.", "網絡淨係喺路由器自己網頁設定嘅時間開。") }),
  ];
}

export default {
  id: F,

  catalog: (info) => slotsOf(info).flatMap(slotEntries),

  domainMeta: [{ id: F, icon: "diversity_3", label: L("Guest Network Pro", "訪客網絡 Pro"), group: { en: "Network", yue: "網絡" } }],
  domains: {
    [F]: async (ctx) => {
      const slots = slotsOf(ctx.info);
      return { slots, active: slots.filter((n) => ctx.nvram.get(`apg${n}_enable`) === "1").length, entries: ctx.entries() };
    },
  },

  // The demo values only exist on the pretend model of a router that has the slots.
  fakeRouter: {
    nvram: ({ profile }) => {
      if (!profile) return {};
      const out = {};
      for (let n = 1; n <= DEMO_SLOTS; n += 1) Object.assign(out, { [`apg${n}_enable`]: "0", [`apg${n}_ssid`]: "", [`apg${n}_hide_ssid`]: "0", [`apg${n}_ap_isolate`]: "0", [`apg${n}_11be`]: "0", [`apg${n}_mlo`]: "0", [`apg${n}_macmode`]: "disabled", [`apg${n}_timesched`]: "0" });
      return out;
    },
  },
};
