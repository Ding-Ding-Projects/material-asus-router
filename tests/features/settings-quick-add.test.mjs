// Quick add: the hand-written list of pointers, and that a quick entry writes the
// very same pending change (same entry id, same slot) as the Settings row.
import assert from "node:assert/strict";
import { test } from "node:test";
import { dock } from "../../public/js/dock.js";
import { validateValue } from "../../public/js/features/guided-forms/validators.js";
import feature from "../../public/js/features/settings-quick-add/index.js";
import { POINTERS, needsEnable, needsSecret, pointersFor, quickSet, valueOf } from "../../public/js/features/settings-quick-add/quick.js";
import { assertModuleListed, catalogs } from "../nav-kit.mjs";

test("settings-quick-add: the hand-written pointer list is exactly the two guest networks", () => {
  assert.deepEqual(POINTERS.map((p) => [p.id, p.enable, p.dependents]), [
    ["guest-2g", "wl0.1.enabled", ["wl0.1.ssid", "wl0.1.password", "wl0.1.lan"]],
    ["guest-5g", "wl1.1.enabled", ["wl1.1.ssid", "wl1.1.password", "wl1.1.lan"]],
  ]);
  for (const p of POINTERS) assert.ok(p.note.en && p.note.yue);
});

test("settings-quick-add: every pointer points at real catalogue entries, and an enable switch really is a switch", async () => {
  const c = await catalogs();
  for (const [firmware, catl] of Object.entries(c)) {
    const ids = new Map(catl.entries.map((e) => [e.id, e]));
    const found = pointersFor(catl.entries);
    assert.equal(found.length, POINTERS.length, `${firmware}: every pointer resolves`);
    for (const p of found) {
      assert.equal(ids.get(p.enable).control, "switch", `${p.enable} is a switch`);
      for (const d of p.dependents) assert.ok(ids.has(d), `${firmware}: ${d}`);
    }
  }
  assert.deepEqual(pointersFor([]), []);
});

test("settings-quick-add: the quick enable and the Settings row use the same stored slot", async () => {
  const entries = (await catalogs()).merlin.entries;
  const enable = entries.find((e) => e.id === "wl0.1.enabled");
  const pointer = pointersFor(entries)[0];
  dock.clear();
  assert.equal(needsEnable(pointer, entries, dock), true, "the guest network is off");
  // What the quick switch does, and what the row's switch does, are the same call.
  dock.setEntry(enable, enable.values.on);
  assert.equal(dock.has("wl0.1.enabled"), true);
  assert.equal(valueOf(dock, enable), "1");
  assert.equal(needsEnable(pointer, entries, dock), false, "the note disappears once it is queued");
  assert.deepEqual(dock.toBody().changes, [{ id: "wl0.1.enabled", value: "1" }]);
  dock.setEntry(enable, enable.value);
  assert.equal(dock.has("wl0.1.enabled"), false, "putting it back removes the pending change");
  dock.clear();
});

test("settings-quick-add: a quick secret is validated by the same rules and lands in the same slot as the row", async () => {
  const entries = (await catalogs()).merlin.entries;
  const pw = { ...entries.find((e) => e.id === "wl0.1.password"), hasValue: false, value: "" };
  dock.clear();
  assert.equal(needsSecret(pw), true);
  assert.equal(needsSecret({ ...pw, hasValue: true }), false);
  const short = quickSet(dock, pw, "abc", validateValue);
  assert.equal(short.ok, false);
  assert.ok(short.reason.en && short.reason.yue);
  assert.equal(dock.has(pw.id), false, "a refused value is never queued");
  const ok = quickSet(dock, pw, "visitors-welcome-2026", validateValue);
  assert.equal(ok.ok, true);
  assert.equal(dock.value(pw.id), "visitors-welcome-2026");
  assert.deepEqual(dock.toBody().changes, [{ id: "wl0.1.password", value: "visitors-welcome-2026" }]);
  assert.ok(!dock.lines().join("\n").includes("visitors-welcome-2026"), "the pending list masks the secret");
  dock.clear();
});

test("settings-quick-add: the module is listed, styled and well formed", async () => {
  await assertModuleListed("settings-quick-add", feature, { style: true });
});
