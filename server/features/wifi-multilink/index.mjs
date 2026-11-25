// Wi-Fi 7 multi-link: the network profiles of a Wi-Fi 7 router (the keys apm1_..., apm2_... and so on) and
// whether each one uses the Wi-Fi 7 standard and multi-link operation, where one device keeps two bands open
// at the same time. One block per profile the router really has, found from its own list of settings.
//
// The profile's own on switch and its security are left alone on purpose: switching a main network profile
// off would take the Wi-Fi down, and the security is one packed value that the router's own page writes.
import { L, ON_OFF } from "../kit.mjs";

const F = "wifi-multilink";
const DEMO_SLOTS = 10;

export const slotsOf = (info) => [...(info.settingKeys ?? [])].map((key) => /^apm([1-9]\d*)_enable$/.exec(key)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);

export function slotEntries(n) {
  const p = `apm${n}`;
  const g = { group: `profile-${n}`, groupLabel: L(`Wi-Fi network profile ${n}`, `Wi-Fi 網絡設定檔 ${n}`) };
  const entry = (id, key, extra) => ({ id: `${F}.${p}.${id}`, key: `${p}_${key}`, ...g, restart: "restart_wireless", risk: "network", requires: "wifi7", ...extra });
  return [
    entry("be", "11be", { control: "switch", values: ON_OFF, label: L("Wi-Fi 7 on this network", "呢個網絡用 Wi-Fi 7"), help: L("Lets Wi-Fi 7 devices use the fastest standard. Turn it off only to fix a device that cannot join.", "等 Wi-Fi 7 裝置用最快嘅標準。淨係有裝置連唔到先至關。") }),
    entry("mlo", "mlo", { control: "switch", values: ON_OFF, requires: "mlo", label: L("Multi-link operation", "多連結運作"), help: L("A Wi-Fi 7 device can use two bands at once for speed and a steadier link. Needs Wi-Fi 7 above to be on.", "Wi-Fi 7 裝置可以同時用兩個頻段，更快更穩。要先開上面嘅 Wi-Fi 7。") }),
    entry("hide", "hide_ssid", { control: "switch", values: ON_OFF, label: L("Hide the network name", "隱藏網絡名稱"), help: L("Devices must type the name by hand. This does not make the network more secure.", "裝置要自己打名。呢樣唔會令網絡更安全。") }),
    entry("isolate", "ap_isolate", { control: "switch", values: ON_OFF, label: L("Keep devices apart from each other", "裝置之間互相隔開"), help: L("Devices on this network cannot see each other, only the internet.", "呢個網絡入面嘅裝置睇唔到對方，只可以上網。") }),
  ];
}

export default {
  id: F,

  catalog: (info) => slotsOf(info).flatMap(slotEntries),

  domainMeta: [{ id: F, icon: "hub", label: L("Wi-Fi 7 multi-link", "Wi-Fi 7 多連結"), group: { en: "Network", yue: "網絡" }, requires: "mlo" }],
  domains: {
    [F]: async (ctx) => {
      const slots = slotsOf(ctx.info);
      return { slots, linked: slots.filter((n) => ctx.nvram.get(`apm${n}_mlo`) === "1").length, entries: ctx.entries() };
    },
  },

  fakeRouter: {
    nvram: ({ profile }) => {
      if (!profile) return {};
      const out = {};
      for (let n = 1; n <= DEMO_SLOTS; n += 1) Object.assign(out, { [`apm${n}_enable`]: n === 1 ? "1" : "0", [`apm${n}_11be`]: "1", [`apm${n}_mlo`]: n === 1 ? "1" : "0", [`apm${n}_hide_ssid`]: "0", [`apm${n}_ap_isolate`]: "0" });
      return out;
    },
  },
};
