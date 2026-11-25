// Checks the shape of a feature module's default export. It imports nothing,
// so the browser registry and the Node tests use the same code.
export const FEATURE_ID = /^[a-z][a-z0-9-]{0,39}$/;
const ITEM_ID = /^[a-z][a-z0-9.-]{0,59}$/;
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const labelled = (v) => isObject(v) && typeof v.en === "string" && v.en !== "" && typeof v.yue === "string" && v.yue !== "";

// Returns null when the module is fine, or a sentence saying what is wrong.
export function checkFeatureModule(feature, folder) {
  if (!isObject(feature)) return "the default export is not an object";
  if (feature.id !== folder) return `id "${feature.id}" must equal the folder name "${folder}"`;
  const lists = { screens: ["id", "icon"], settings: ["id"], commands: ["id"], overlays: ["id"], toolbar: ["id", "icon"] };
  for (const [name, fields] of Object.entries(lists)) {
    const list = feature[name];
    if (list === undefined) continue;
    if (!Array.isArray(list)) return `${name} must be a list`;
    for (const item of list) {
      if (!isObject(item) || !ITEM_ID.test(String(item.id))) return `every ${name} item needs an id of lowercase letters, digits, dots and dashes`;
      for (const field of fields) if (typeof item[field] !== "string" || !item[field]) return `${name} item "${item.id}" needs a ${field}`;
      if (name !== "overlays" && !labelled(item.label)) return `${name} item "${item.id}" needs a label with en and yue`;
      const fn = { screens: "render", settings: "render", commands: "run", overlays: "mount", toolbar: "onClick" }[name];
      if (typeof item[fn] !== "function") return `${name} item "${item.id}" needs a ${fn} function`;
    }
  }
  if (feature.controls !== undefined && (!isObject(feature.controls) || Object.values(feature.controls).some((f) => typeof f !== "function"))) return "controls must map a control type to a factory function";
  return null;
}
