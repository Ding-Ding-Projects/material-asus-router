// What goes in a context menu, as plain data. No imports and no DOM, so the
// Node tests can build the same menus the page does.

// The items every menu can offer, with the shortcut id each one is bound to
// (the key text itself always comes from the shortcut table).
export const COMMON_ITEMS = [
  { id: "palette", icon: "search_check", label: { en: "Open the command palette", yue: "打開指令面板" }, shortcutId: "palette.open" },
  { id: "notifications", icon: "notifications", label: { en: "Open the notification centre", yue: "打開通知中心" }, shortcutId: "notifications.open" },
  { id: "appearance", icon: "palette", label: { en: "Edit appearance of this element", yue: "編輯呢個元素嘅外觀" }, shortcutId: "element.appearance" },
  { id: "lock", icon: "lock", label: { en: "Lock this element", yue: "鎖住呢個元素" }, shortcutId: "element.lock" },
];

export const APPEARANCE = {
  tint: [["none", { en: "No tint", yue: "冇底色" }], ["primary", { en: "Accent", yue: "強調色" }], ["tertiary", { en: "Second colour", yue: "第二色" }], ["warn", { en: "Amber", yue: "琥珀色" }]],
  size: [["normal", { en: "Normal text", yue: "一般文字" }], ["large", { en: "Larger text", yue: "較大文字" }], ["xlarge", { en: "Largest text", yue: "最大文字" }]],
  density: [["normal", { en: "Normal spacing", yue: "一般間距" }], ["compact", { en: "Compact", yue: "緊湊" }], ["roomy", { en: "Roomy", yue: "寬鬆" }]],
};

// A saved appearance becomes class names; unknown values are ignored.
export function appearanceClasses(a = {}) {
  const out = [];
  if (APPEARANCE.tint.some(([v]) => v === a.tint) && a.tint !== "none") out.push(`nav-tint-${a.tint}`);
  if (APPEARANCE.size.some(([v]) => v === a.size) && a.size !== "normal") out.push(`nav-size-${a.size}`);
  if (APPEARANCE.density.some(([v]) => v === a.density) && a.density !== "normal") out.push(`nav-density-${a.density}`);
  return out;
}
export const ALL_APPEARANCE_CLASSES = ["primary", "tertiary", "warn"].map((x) => `nav-tint-${x}`).concat(["large", "xlarge"].map((x) => `nav-size-${x}`), ["compact", "roomy"].map((x) => `nav-density-${x}`));

// Filters items with a test function. A group of live controls stays visible
// while the filter matches its label.
export function filterItems(items, test) {
  return items.filter((item) => test(`${item.label.en}
${item.label.yue}`));
}

// The text a menu shows for an item's shortcut, read from the shortcut table.
export function shortcutText(item, shortcuts, mac) {
  if (!item.shortcutId || !shortcuts) return "";
  return shortcuts.displayFor(item.shortcutId, mac);
}

// Describes what was clicked as a small target the menu builder understands.
export function targetKind(el) {
  if (!el) return "page";
  if (el.closest?.("input, textarea")) return "text-field";
  if (el.closest?.(".setting[id^='s-']")) return "setting";
  if (el.closest?.(".mar-tab")) return "tab";
  if (el.closest?.(".toast, .nt-item")) return "notification";
  if (el.closest?.("tr")) return "table-row";
  if (el.closest?.(".card")) return "card";
  return "page";
}
