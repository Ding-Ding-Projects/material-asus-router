// The Priority board edits settings that other features own. This folder only reports
// which of them this router does not have, so the screen can switch those
// controls off and say so, instead of writing a setting that is not there.
import { L } from "../kit.mjs";

const ID = "priority-board";

export default {
  id: ID,

  domainMeta: [{ id: ID, icon: "low_priority", label: L("Priority board", "優先次序板"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [ID]: async (ctx) => ({ missing: ["bwdpi_app_rulelist", "qos_rulelist", "qos_bw_rulelist"].filter((key) => !ctx.nvram.has(key)) }),
  },
};
