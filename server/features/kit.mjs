// The small toolbox a feature folder may import. It only re-exports modules
// that never import the feature registry, so a feature can use it without
// creating an import cycle. Features must import nothing else from server/
// (see server/features/README.md).
export { quote, nvramKey, isIpv4, isMac, hostTarget, macAddress } from "../router/shell.mjs";
export { parseRows, formatRows, cleanText } from "../router/editors.mjs";

// L("English", "廣東話"): a bilingual label, the same shape the catalogue uses.
export const L = (en, yue) => ({ en, yue });
// The usual on/off values for a switch stored as 1 or 0.
export const ON_OFF = { on: "1", off: "0" };
export const DAY = 86400;
