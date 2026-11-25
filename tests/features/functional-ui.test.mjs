// Tests for functional-ui: discarded work is recorded before it is dropped,
// can be restored, never keeps a secret, and an applied change is not mistaken
// for a discard.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { discards, emptyState, record, restore, sanitizeDiscards, snapshot } from "../../public/js/features/functional-ui/index.js";
import { fakeBus } from "./fakes.mjs";

function fakeDock(bus) {
  return {
    changes: new Map(),
    ops: [],
    emit() { bus.emit("dock"); },
    setEntry(entry, value) { this.changes.set(entry.id, { id: entry.id, label: entry.label, value, shown: entry.secret ? "••••••••" : value }); this.emit(); },
    setRaw(key, value, _o, label) { this.changes.set(`raw:${key}`, { key, label: label ?? { en: key, yue: key }, value, shown: value }); this.emit(); },
    addOp(op, summary) { this.ops.push({ op, summary }); this.emit(); },
    clear() { this.changes.clear(); this.ops = []; this.emit(); },
  };
}
const label = (en) => ({ en, yue: en });
const wait = (ms = 15) => new Promise((r) => setTimeout(r, ms));

test("functional-ui: the module is well formed and has a recovery screen and a page-hide watcher", () => {
  assert.equal(checkFeatureModule(feature, "functional-ui"), null);
  assert.equal(feature.overlays.length, 1);
  assert.deepEqual(feature.screens.map((s) => s.id), ["functional-ui"]);
});

test("functional-ui: a snapshot never contains a secret value", () => {
  const bus = fakeBus();
  const dock = fakeDock(bus);
  dock.setEntry({ id: "wifi.name", label: label("Network name") }, "Home");
  dock.setEntry({ id: "wifi.key", label: label("Wi-Fi key"), secret: true }, "correct horse battery staple");
  dock.addOp({ type: "forward.add", port: 8080 }, "Forward 8080");
  const snap = snapshot(dock);
  assert.equal(snap.changes.length, 2);
  assert.deepEqual(snap.changes.map((c) => [c.id, c.value, c.secret]), [["wifi.name", "Home", false], ["wifi.key", "", true]]);
  assert.ok(!JSON.stringify(snap).includes("correct horse"), "the secret is not in the snapshot");
  assert.deepEqual(snap.ops, [{ op: { type: "forward.add", port: 8080 }, summary: "Forward 8080" }]);
  discards.reset();
  assert.equal(record(snap, "discard"), true);
  assert.ok(!localStorageText().includes("correct horse"), "nor in what is stored");
  assert.equal(record({ changes: [], ops: [] }, "discard"), false, "an empty bar records nothing");
  discards.reset();
});
const localStorageText = () => JSON.stringify(discards.get());

test("functional-ui: stored history is cleaned, bounded and never keeps a secret even if a file says it does", () => {
  const clean = sanitizeDiscards({ items: [
    { at: 1, reason: "discard", changes: [{ id: "a", label: { en: "A", yue: "甲" }, value: "x", secret: false }, { id: "b", value: "TOPSECRET", secret: true }, { value: "no id or key" }], ops: [] },
    { at: "bad", changes: [{ id: "z" }] },
    { at: 3, reason: "weird", changes: [], ops: [{ op: { a: 1 }, summary: "s" }, { op: "string", summary: "x" }, { op: null }] },
    { at: 4, changes: [], ops: [] },
    null,
  ] });
  assert.equal(clean.items.length, 2);
  assert.deepEqual(clean.items[0].changes.map((c) => [c.id, c.value, c.secret]), [["a", "x", false], ["b", "", true]]);
  assert.equal(clean.items[1].reason, "discard");
  assert.equal(clean.items[1].ops.length, 1);
  assert.ok(!JSON.stringify(clean).includes("TOPSECRET"));
  const many = sanitizeDiscards({ items: Array.from({ length: 50 }, (_, i) => ({ at: i + 1, changes: [{ id: "a", value: "v" }] })) });
  assert.equal(many.items.length, 20, "only the newest twenty are kept");
  assert.equal(many.items.at(-1).at, 50);
});

test("functional-ui: pressing Discard records the changes; applying them does not", async () => {
  discards.reset();
  const bus = fakeBus();
  const dock = fakeDock(bus);
  const stop = feature.overlays[0].mount({ bus, dock });
  try {
    dock.setEntry({ id: "wifi.name", label: label("Network name") }, "Cafe");
    dock.setEntry({ id: "wifi.hidden", label: label("Hidden network") }, "1");
    dock.clear(); // Discard
    await wait();
    assert.equal(discards.get().items.length, 1, "the discarded changes are recorded");
    assert.deepEqual(discards.get().items[0].changes.map((c) => c.value), ["Cafe", "1"]);
    assert.equal(discards.get().items[0].reason, "discard");

    dock.setEntry({ id: "wifi.name", label: label("Network name") }, "Home");
    dock.clear(); // applied: the app emits "changed" right after clearing the bar
    bus.emit("changed");
    await wait();
    assert.equal(discards.get().items.length, 1, "an applied change is not a discard");

    dock.setEntry({ id: "wifi.name", label: label("Network name") }, "Again");
    dock.clear();
    await wait();
    assert.equal(discards.get().items.length, 2, "a later discard is recorded even after an applied change");
    dock.clear();
    await wait();
    assert.equal(discards.get().items.length, 2, "clearing an empty bar records nothing");
  } finally {
    stop();
    discards.reset();
  }
});

test("functional-ui: a discarded change can be put back in the waiting list from the recovery screen's own function", async () => {
  discards.reset();
  const bus = fakeBus();
  const dock = fakeDock(bus);
  const entries = [{ id: "wifi.name", label: label("Network name"), value: "Old" }];
  const ctx = { bus, dock, state: { catalog: { entries } } };
  const stop = feature.overlays[0].mount(ctx);
  try {
    dock.setEntry(entries[0], "New");
    dock.setRaw("some_key", "7", undefined, label("Some key"));
    dock.addOp({ type: "x" }, "an op");
    dock.clear();
    await wait();
    assert.equal(dock.changes.size, 0);
    // The screen's Restore button calls restore().
    const item = discards.get().items[0];
    assert.equal(item.changes.length, 2);
    assert.deepEqual(restore(ctx, item), { restored: 3, skipped: 0 });
    assert.equal(dock.changes.get("wifi.name").value, "New");
    assert.equal(dock.changes.get("raw:some_key").value, "7");
    assert.equal(dock.ops.length, 1);
  } finally {
    stop();
    discards.reset();
  }
});

test("functional-ui: an empty state says what is missing and offers a real way forward", () => {
  const made = [];
  const ctx = { h: (tag, props = {}, ...kids) => { const el = { tag, props, kids: kids.flat(Infinity).filter(Boolean) }; made.push(el); return el; }, icon: (n) => ({ icon: n }), tt: (p) => p.en };
  let clicked = false;
  const el = emptyState(ctx, { icon: "router", title: { en: "No router connected yet", yue: "未連接路由器" }, body: { en: "Connect one to begin.", yue: "連接一個開始。" }, action: { label: { en: "Connect a router", yue: "連接路由器" }, onClick: () => { clicked = true; } } });
  const text = JSON.stringify(el);
  assert.match(text, /No router connected yet/);
  assert.match(text, /Connect one to begin\./);
  const button = made.find((m) => m.tag === "button");
  assert.ok(button, "a real button, not just text");
  button.props.onClick();
  assert.equal(clicked, true);
});
