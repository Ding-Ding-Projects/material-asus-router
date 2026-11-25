// The Schedule painter edits settings that other features own. This folder only reports
// which of them this router does not have, so the screen can switch those
// controls off and say so, instead of writing a setting that is not there.
import { L } from "../kit.mjs";

const ID = "schedule-paint";

export default {
  id: ID,

  domainMeta: [{ id: ID, icon: "event_available", label: L("Schedule painter", "時間表畫板"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [ID]: async (ctx) => ({ missing: ["MULTIFILTER_MAC", "MULTIFILTER_ENABLE", "MULTIFILTER_DEVICENAME", "MULTIFILTER_MACFILTER_DAYTIME", ...ctx.info.bands.flatMap((b) => [`wl${b.index}_sched`, `wl${b.index}_timesched`])].filter((key) => !ctx.nvram.has(key)) }),
  },
};
