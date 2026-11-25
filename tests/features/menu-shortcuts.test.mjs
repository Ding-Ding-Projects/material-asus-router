// One table of shortcuts: parsing, platform notation, matching, conflicts, and
// that every context-menu item shows exactly the keys the table registers.
import assert from "node:assert/strict";
import { test } from "node:test";
import "../../public/js/features/command-palette/index.js";
import "../../public/js/features/context-menus/index.js";
import "../../public/js/features/notifications/index.js";
import "../../public/js/features/tabs/index.js";
import feature from "../../public/js/features/menu-shortcuts/index.js";
import { createRegistry, display, matches, parseKeys } from "../../public/js/features/menu-shortcuts/shortcuts.js";
import { COMMON_ITEMS, shortcutText } from "../../public/js/features/context-menus/menu-model.js";
import { assertModuleListed } from "../nav-kit.mjs";

const press = (key, mods = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });

test("menu-shortcuts: keys parse and an unknown modifier is refused", () => {
  assert.deepEqual(parseKeys("Mod+Shift+F"), { mod: true, ctrl: false, alt: false, shift: true, key: "F" });
  assert.throws(() => parseKeys("Super+F"), /Unknown modifier/);
  assert.throws(() => parseKeys("Ctrl+"), /no key/);
});

test("menu-shortcuts: platform notation differs on a Mac and is empty when there is no shortcut", () => {
  assert.equal(display("Mod+Shift+F", false), "Ctrl+Shift+F");
  assert.equal(display("Mod+Shift+F", true), "⇧⌘F");
  assert.equal(display("Alt+Shift+W", false), "Alt+Shift+W");
  assert.equal(display("ArrowLeft", false), "←");
  assert.equal(display("", false), "");
  assert.equal(display(undefined, false), "");
});

test("menu-shortcuts: a key press matches only the exact modifiers", () => {
  assert.equal(matches("Mod+Shift+F", press("F", { ctrlKey: true, shiftKey: true }), false), true);
  assert.equal(matches("Mod+Shift+F", press("f", { ctrlKey: true, shiftKey: true }), false), true);
  assert.equal(matches("Mod+Shift+F", press("F", { ctrlKey: true }), false), false, "shift is missing");
  assert.equal(matches("Mod+Shift+F", press("F", { ctrlKey: true, shiftKey: true, altKey: true }), false), false, "alt is extra");
  assert.equal(matches("Mod+K", press("k", { metaKey: true }), true), true, "Command on a Mac");
  assert.equal(matches("Mod+K", press("k", { ctrlKey: true }), true), false, "Control is not Mod on a Mac");
  assert.equal(matches("Shift+F10", press("F10", { shiftKey: true }), false), true);
});

test("menu-shortcuts: no two real shortcuts press the same keys unless one is declared an alias", () => {
  const reg = createRegistry();
  for (const d of globalThis.marNav.shortcutQueue) reg.register(d);
  assert.deepEqual(reg.conflicts(), []);
  const clash = createRegistry();
  clash.register({ id: "a", keys: "Mod+J", run() {} });
  clash.register({ id: "b", keys: "Mod+J", run() {} });
  assert.deepEqual(clash.conflicts(), [["a", "b"]]);
});

test("menu-shortcuts: every context-menu item with a shortcut shows exactly the registered keys", () => {
  const reg = createRegistry();
  for (const d of globalThis.marNav.shortcutQueue) reg.register(d);
  const shown = [];
  for (const item of COMMON_ITEMS) {
    if (!item.shortcutId) {
      assert.equal(shortcutText(item, reg, false), "", "nothing is shown when there is no shortcut");
      continue;
    }
    const registered = reg.find(item.shortcutId);
    assert.ok(registered, `${item.id} names ${item.shortcutId}, which must be registered`);
    for (const mac of [false, true]) assert.equal(shortcutText(item, reg, mac), display(registered.keys, mac));
    shown.push(item.shortcutId);
  }
  assert.deepEqual(shown.sort(), ["element.appearance", "element.lock", "notifications.open", "palette.open"]);
  assert.equal(reg.find("palette.open").keys, "Mod+Shift+F");
  assert.equal(shortcutText({ label: {}, shortcutId: "nope" }, reg, false), "", "an unknown id shows nothing");
});

test("menu-shortcuts: the Ctrl+K alias and the context-menu keys are in the same table", () => {
  const reg = createRegistry();
  for (const d of globalThis.marNav.shortcutQueue) reg.register(d);
  assert.equal(reg.find("palette.open-k").keys, "Mod+K");
  assert.ok(reg.find_event(press("k", { ctrlKey: true }), false));
  assert.ok(reg.find("context.open"));
  assert.ok(reg.find("context.open-key"));
});

test("menu-shortcuts: the module is listed and well formed", async () => {
  await assertModuleListed("menu-shortcuts", feature);
  assert.ok(globalThis.marNav.shortcuts.find("palette.open"), "the live table holds the queued shortcuts");
});
