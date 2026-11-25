// The Ports and VLAN canvas edits settings that other features own. This folder only reports
// which of them this router does not have, so the screen can switch those
// controls off and say so, instead of writing a setting that is not there.
import { L } from "../kit.mjs";

const ID = "port-canvas";

export default {
  id: ID,

  domainMeta: [{ id: ID, icon: "settings_ethernet", label: L("Ports and VLAN canvas", "接口同 VLAN 畫布"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [ID]: async (ctx) => ({ missing: ["switch_stb_x", "switch_wantag", ...[0, 1, 2].flatMap((n) => [`switch_wan${n}tagid`, `switch_wan${n}prio`])].filter((key) => !ctx.nvram.has(key)) }),
  },
};
