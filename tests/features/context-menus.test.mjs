// The context menu model: what each target offers, the appearance classes,
// filtering, and the kind of target recognised.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/context-menus/index.js";
import { ALL_APPEARANCE_CLASSES, APPEARANCE, COMMON_ITEMS, appearanceClasses, filterItems, targetKind } from "../../public/js/features/context-menus/menu-model.js";
import { assertModuleListed } from "../nav-kit.mjs";

test("context-menus: every common item is bilingual and Edit appearance and Lock are always offered", () => {
  for (const item of COMMON_ITEMS) assert.ok(item.id && item.icon && item.label.en && item.label.yue);
  const ids = COMMON_ITEMS.map((i) => i.id);
  assert.ok(ids.includes("appearance") && ids.includes("lock"));
});

test("context-menus: a saved appearance becomes only known class names", () => {
  assert.deepEqual(appearanceClasses({ tint: "warn", size: "large", density: "compact" }), ["nav-tint-warn", "nav-size-large", "nav-density-compact"]);
  assert.deepEqual(appearanceClasses({ tint: "none", size: "normal", density: "normal" }), []);
  assert.deepEqual(appearanceClasses({ tint: "<script>", size: "huge" }), []);
  assert.deepEqual(appearanceClasses(undefined), []);
  for (const [field, opts] of Object.entries(APPEARANCE)) for (const [v] of opts) for (const c of appearanceClasses({ [field]: v })) assert.ok(ALL_APPEARANCE_CLASSES.includes(c), `${c} can be cleared again`);
});

test("context-menus: the filter keeps matching items and the honest empty result is just an empty list", () => {
  const items = [{ label: { en: "Copy this row", yue: "複製呢行" } }, { label: { en: "Lock this element", yue: "鎖住" } }];
  assert.equal(filterItems(items, (s) => /copy/i.test(s)).length, 1);
  assert.equal(filterItems(items, (s) => /鎖/.test(s)).length, 1);
  assert.equal(filterItems(items, () => false).length, 0);
});

test("context-menus: the target kind is recognised from the nearest matching ancestor", () => {
  const el = (matchMap) => ({ closest: (sel) => (matchMap[sel] ? {} : null) });
  assert.equal(targetKind(null), "page");
  assert.equal(targetKind(el({ "input, textarea": true })), "text-field");
  assert.equal(targetKind(el({ ".setting[id^='s-']": true })), "setting");
  assert.equal(targetKind(el({ ".mar-tab": true })), "tab");
  assert.equal(targetKind(el({ tr: true })), "table-row");
  assert.equal(targetKind(el({ ".card": true })), "card");
  assert.equal(targetKind(el({})), "page");
});

test("context-menus: the module is listed, styled and well formed, with keyboard shortcuts for the menu", async () => {
  await assertModuleListed("context-menus", feature, { style: true });
  const ids = (globalThis.marNav.shortcutQueue ?? []).map((d) => d.id);
  for (const id of ["context.open", "context.open-key", "element.lock", "element.appearance"]) assert.ok(ids.includes(id), id);
});
