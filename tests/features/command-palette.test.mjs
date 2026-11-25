// The palette's list and ranking: every page, setting and command appears,
// locked ones are labelled, and the shortcut table has Ctrl+Shift+F and Ctrl+K.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/command-palette/index.js";
import { buildItems, rank } from "../../public/js/features/command-palette/palette-model.js";
import { assertModuleListed, catalogs } from "../nav-kit.mjs";

const L = (en, yue) => ({ en, yue });

test("command-palette: every page, every setting and every command is listed, once", async () => {
  const c = (await catalogs()).merlin;
  const commands = [{ id: "theme", label: L("Theme", "主題"), run() {} }, { id: "theme", label: L("Theme again", "主題"), run() {} }];
  const items = buildItems({ domains: c.domains, featureScreens: { notifications: { id: "notifications", icon: "notifications", label: L("Notification centre", "通知中心"), group: L("Monitor", "監察") } }, entries: c.entries, commands, canWrite: true });
  const keys = new Set(items.map((i) => i.key));
  assert.equal(keys.size, items.length, "no duplicates");
  for (const d of c.domains) assert.ok(keys.has(`page:${d.id}`), `page ${d.id}`);
  for (const e of c.entries) assert.ok(keys.has(`setting:${e.id}`), `setting ${e.id}`);
  assert.ok(keys.has("page:notifications") && keys.has("command:theme"));
  assert.equal(items.filter((i) => i.key === "command:theme").length, 1);
});

test("command-palette: a setting the person cannot change is labelled locked with the reason, and is still listed", async () => {
  const c = (await catalogs()).stock;
  const view = buildItems({ domains: c.domains, entries: c.entries, canWrite: false });
  const settings = view.filter((i) => i.kind === "setting");
  assert.ok(settings.length > 0 && settings.every((i) => i.locked && i.lockedReason.en && i.lockedReason.yue), "a viewer is locked out of every setting");
  const disabled = buildItems({ domains: c.domains, entries: c.entries, canWrite: true }).filter((i) => i.kind === "setting" && i.locked);
  assert.ok(disabled.length > 0, "stock firmware has settings that need Merlin");
  assert.ok(disabled.every((i) => i.lockedReason.en));
});

test("command-palette: words match in any order, labels beat help text, both languages and keys are searchable", async () => {
  const c = (await catalogs()).merlin;
  const items = buildItems({ domains: c.domains, entries: c.entries, canWrite: true });
  const top = rank(items, "guest network name")[0];
  assert.equal(top.id, "wl0.1.ssid");
  assert.ok(rank(items, "network guest").some((i) => i.id === "wl0.1.ssid"), "any order");
  assert.ok(rank(items, "訪客").some((i) => i.id === "wl0.1.ssid"), "Cantonese");
  assert.ok(rank(items, "wl0_closed").some((i) => i.id === "wl0.hidden"), "the router key");
  assert.deepEqual(rank(items, "zzzzzzzzzz"), []);
  assert.equal(rank(items, "")[0].kind, "page", "with no query, pages come first");
});

test("command-palette: a regex test replaces the word search and checks the label on its own", async () => {
  const c = (await catalogs()).merlin;
  const items = buildItems({ domains: c.domains, entries: c.entries, canWrite: true });
  const hits = rank(items, "", (s) => /^Guest network name$/.test(s));
  assert.ok(hits.some((i) => i.id === "wl0.1.ssid"), "an anchored pattern matches the label alone");
  assert.equal(rank(items, "", () => false).length, 0);
});

test("command-palette: Ctrl+Shift+F and Ctrl+K open the same palette, the module is listed and well formed", async () => {
  await assertModuleListed("command-palette", feature, { style: true });
  const q = globalThis.marNav.shortcutQueue;
  assert.equal(q.find((d) => d.id === "palette.open").keys, "Mod+Shift+F");
  assert.equal(q.find((d) => d.id === "palette.open-k").keys, "Mod+K");
  assert.ok(feature.overlays.some((o) => o.id === "command-palette.stock-button"), "the stock button is redirected to this palette");
});
