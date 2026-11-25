// The Spectrum editor edits settings that other features own. This folder only reports
// which of them this router does not have, so the screen can switch those
// controls off and say so, instead of writing a setting that is not there.
import { L } from "../kit.mjs";

const ID = "spectrum-editor";

export default {
  id: ID,

  domainMeta: [{ id: ID, icon: "graphic_eq", label: L("Spectrum editor", "頻譜編輯器"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [ID]: async (ctx) => ({ missing: ctx.info.bands.flatMap((b) => [`wl${b.index}_chanspec`, `wl${b.index}_bw`]).filter((key) => !ctx.nvram.has(key)) }),
  },
};
