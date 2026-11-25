// The tab strip as data: fresh install, update, closed-stays-closed, Open every
// tab, pinning, groups, the four isolated searches, bulk close with a preview,
// and that saved state survives a round trip through storage.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/tabs/index.js";
import { DOCKS, addGroup, closeMatching, closeTab, decorateGroup, deleteGroup, emptyState, layout, moveIntoGroup, moveTab, openEvery, openTab, reconcile, sanitize, searchCatalog, searchClosed, searchGroups, searchOpen, setDock, setPinned, shiftTab } from "../../public/js/features/tabs/tabs-model.js";
import { assertModuleListed } from "../nav-kit.mjs";

const D = (...ids) => ids.map((id) => ({ id, icon: "tab", label: { en: id, yue: id } }));
const ids = (s) => s.tabs.map((t) => t.id);
const label = (id) => id;
const has = (word) => (s) => s.includes(word);

test("tabs: a fresh profile opens every destination, left docked", () => {
  const s = reconcile(emptyState(), D("overview", "devices", "wifi"));
  assert.deepEqual(ids(s), ["overview", "devices", "wifi"]);
  assert.equal(s.dock, "left");
  assert.deepEqual(s.offered.sort(), ["devices", "overview", "wifi"]);
});

test("tabs: an update opens only destinations never offered before, and closed tabs stay closed", () => {
  let s = reconcile(emptyState(), D("overview", "devices", "wifi"));
  s = closeTab(s, "devices");
  const updated = reconcile(s, D("overview", "devices", "wifi", "newone"));
  assert.deepEqual(ids(updated), ["overview", "wifi", "newone"], "devices stays closed, newone arrives");
  assert.deepEqual(updated.closed, ["devices"]);
  const again = reconcile(updated, D("overview", "devices", "wifi", "newone"));
  assert.deepEqual(ids(again), ids(updated), "reconciling twice changes nothing");
  assert.deepEqual(ids(reconcile(updated, D("overview"))), ["overview"], "a destination that no longer exists disappears");
});

test("tabs: Open every tab reopens all closed tabs; opening one removes it from closed", () => {
  let s = reconcile(emptyState(), D("a", "b", "c"));
  s = closeTab(closeTab(s, "a"), "b");
  assert.deepEqual(openTab(s, "a").closed, ["b"]);
  const all = openEvery(s, D("a", "b", "c"));
  assert.deepEqual(all.closed, []);
  assert.deepEqual(ids(all).sort(), ["a", "b", "c"]);
});

test("tabs: pinned tabs stay in front, cannot be closed and are never moved behind loose tabs", () => {
  let s = reconcile(emptyState(), D("a", "b", "c", "d"));
  s = setPinned(s, "c", true);
  assert.deepEqual(ids(s), ["c", "a", "b", "d"]);
  assert.equal(closeTab(s, "c"), s, "a pinned tab does not close");
  s = moveTab(s, "d", 0);
  assert.deepEqual(ids(s), ["c", "d", "a", "b"], "a loose tab cannot go in front of a pinned one");
  s = shiftTab(s, "b", -1);
  assert.deepEqual(ids(s), ["c", "d", "b", "a"]);
  assert.deepEqual(ids(setPinned(s, "c", false)), ["c", "d", "b", "a"], "unpinning keeps the order");
});

test("tabs: groups carry a name, colour and icon, collapse, hold tabs and can be deleted", () => {
  let s = reconcile(emptyState(), D("a", "b", "c"));
  const made = addGroup(s, "  Wi-Fi  ", { color: "#2e8b57", icon: "wifi" }, "g1");
  s = moveIntoGroup(made.state, ["a", "b"], "g1");
  assert.equal(made.group.name, "Wi-Fi");
  assert.equal(addGroup(s, "   ").group, null, "an empty name makes no group");
  s = decorateGroup(s, "g1", { color: "#c0392b", icon: "hub", collapsed: true, name: "Network" });
  assert.deepEqual(s.groups[0], { id: "g1", name: "Network", color: "#c0392b", icon: "hub", collapsed: true });
  assert.deepEqual(layout(s).groups[0].tabs.map((t) => t.id), ["a", "b"]);
  assert.deepEqual(layout(s).loose.map((t) => t.id), ["c"]);
  s = deleteGroup(s, "g1");
  assert.equal(s.groups.length, 0);
  assert.ok(s.tabs.every((t) => t.group === null));
});

test("tabs: order, pins, groups, collapsed state and dock survive storage and bad data is dropped", () => {
  let s = reconcile(emptyState(), D("a", "b", "c"));
  s = setPinned(s, "b", true);
  const g = addGroup(s, "Mine", {}, "g9");
  s = decorateGroup(moveIntoGroup(g.state, ["c"], "g9"), "g9", { collapsed: true });
  s = setDock(s, "right");
  const back = sanitize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back, s);
  assert.deepEqual(sanitize({ v: 1 }), emptyState(), "an unknown version resets");
  assert.equal(sanitize({ v: 2, dock: "diagonal", tabs: [{ id: "x", group: "nope" }, { id: "x" }, 5] }).dock, "left");
  assert.deepEqual(sanitize({ v: 2, tabs: [{ id: "x", group: "nope" }, { id: "x" }, 5] }).tabs, [{ id: "x", pinned: false, group: null }]);
  for (const d of DOCKS) assert.equal(setDock(emptyState(), d).dock, d);
  assert.equal(setDock(emptyState(), "x").dock, "left");
});

test("tabs: four searches each take their own test and cannot affect each other", () => {
  let s = reconcile(emptyState(), D("wifi", "wifi-guest", "logs", "lan"));
  s = closeTab(s, "logs");
  s = addGroup(s, "Wireless", {}, "g").state;
  assert.deepEqual(searchOpen(s, has("wifi"), label), ["wifi", "wifi-guest"]);
  assert.deepEqual(searchClosed(s, has("logs"), label), ["logs"]);
  assert.deepEqual(searchClosed(s, has("wifi"), label), []);
  assert.deepEqual(searchGroups(s, has("Wire")).map((g) => g.id), ["g"]);
  assert.deepEqual(searchCatalog(D("wifi", "logs", "lan"), has("lan"), label), ["lan"]);
});

test("tabs: close tabs containing or not containing text previews first and never includes pinned tabs", () => {
  let s = reconcile(emptyState(), D("wifi", "wifi-guest", "logs", "lan"));
  s = setPinned(s, "wifi", true);
  const plan = closeMatching(s, has("wifi"), { contains: true, labelOf: label });
  assert.deepEqual(plan.targets, ["wifi-guest"]);
  assert.deepEqual(plan.pinnedSkipped, ["wifi"]);
  assert.equal(ids(s).length, 4, "previewing changes nothing");
  const after = plan.apply();
  assert.deepEqual(ids(after), ["wifi", "logs", "lan"]);
  assert.ok(after.closed.includes("wifi-guest"));
  const not = closeMatching(s, has("wifi"), { contains: false, labelOf: label });
  assert.deepEqual(not.targets.sort(), ["lan", "logs"]);
  assert.deepEqual(not.pinnedSkipped, [], "the pinned tab matches so it is not part of 'not containing'");
});

test("tabs: the module is listed, styled and well formed, and registers its shortcuts", async () => {
  await assertModuleListed("tabs", feature, { style: true });
  const ids2 = (globalThis.marNav.shortcutQueue ?? []).map((d) => d.id);
  for (const id of ["tabs.close", "tabs.new", "tabs.find", "tabs.reopen"]) assert.ok(ids2.includes(id), id);
});
