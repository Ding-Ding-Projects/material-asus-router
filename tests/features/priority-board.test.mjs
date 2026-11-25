// The priority board: ordering Adaptive QoS groups, moving traditional rules
// between priority lanes and setting per-device limits, all through real
// catalogue entries and the change engine.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { draggable } from "../../public/js/features/priority-board/drag.js";
import feature from "../../public/js/features/priority-board/index.js";
import { PRIORITIES, formatOrder, lanes, moveGroup, parseOrder, readLimits, readRules, setPriority, share, speedText, writeLimits, writeRules } from "../../public/js/features/priority-board/model.js";
import { startApp } from "../helpers.mjs";

test("priority-board: groups move to any position and the order text round-trips", () => {
  const text = "9,20<4<0,5,6,15,17<8";
  assert.equal(formatOrder(parseOrder(text)), text);
  assert.equal(formatOrder(moveGroup(parseOrder(text), 3, 0)), "8<9,20<4<0,5,6,15,17");
  assert.equal(formatOrder(moveGroup(parseOrder(text), 0, 3)), "4<0,5,6,15,17<8<9,20");
  assert.equal(moveGroup(parseOrder(text), 1, 1).length, 4);
  assert.deepEqual(moveGroup([["1"], ["2"]], 5, 0), [["1"], ["2"]], "an out-of-range move changes nothing");
  assert.deepEqual(parseOrder(""), []);
  assert.equal(typeof draggable, "function");
});

test("priority-board: rules sit in priority lanes and move between them without losing their place", () => {
  const rules = readRules("<Web Surf>>80>tcp>>0<HTTPS>>443>tcp>>0<Big Downloads>>80>tcp>512~>3");
  assert.deepEqual(rules.map((r) => [r.name, r.priority]), [["Web Surf", "0"], ["HTTPS", "0"], ["Big Downloads", "3"]]);
  assert.deepEqual(lanes(rules).map((l) => l.rules.length), [2, 0, 0, 1, 0]);
  const moved = setPriority(rules, 1, "4");
  assert.deepEqual(moved.map((r) => r.name), ["Web Surf", "HTTPS", "Big Downloads"], "the checking order stays");
  assert.equal(writeRules(moved), "<Web Surf>>80>tcp>>0<HTTPS>>443>tcp>>4<Big Downloads>>80>tcp>512~>3");
  assert.equal(PRIORITIES.length, 5);
  assert.equal(readRules("<x>>1>udp>>9")[0].priority, "2", "an unknown priority reads as medium");
});

test("priority-board: limits read, write and show in words", () => {
  const limits = readLimits("<1>198.51.100.103>20000>5000<0>198.51.100.20>0>800");
  assert.deepEqual(limits.map((l) => [l.on, l.device, l.down, l.up]), [[true, "198.51.100.103", 20000, 5000], [false, "198.51.100.20", 0, 800]]);
  assert.equal(writeLimits(limits), "<1>198.51.100.103>20000>5000<0>198.51.100.20>0>800");
  assert.equal(speedText(20000, "none"), "20 Mbit/s");
  assert.equal(speedText(800, "none"), "800 kbit/s");
  assert.equal(speedText(0, "none"), "none");
  assert.equal(share(5000, 20000), 0.25);
  assert.equal(share(50000, 20000), 1);
  assert.equal(share(100, 0), 0);
});

test("priority-board: reorder, lane change and limits write through the change engine and undo", async () => {
  const t = await startApp();
  try {
    const data = (await t.owner.get("/api/domain/qos-pro")).data;
    const order = data.entries.find((e) => e.id === "qos-pro.adaptive.order");
    assert.equal(order.control, "priority-order");
    assert.ok(order.options.length >= 7 && !order.disabled);
    const reordered = formatOrder(moveGroup(parseOrder(order.value), 6, 0));
    const rules = data.entries.find((e) => e.id === "qos-pro.rules");
    const lowered = writeRules(setPriority(readRules(rules.value), 0, "4"));
    const limit = data.entries.find((e) => e.id === "qos-pro.limiter.rules");
    const limited = writeLimits([...readLimits(limit.value), { index: 1, on: true, device: "198.51.100.20", down: 10000, up: 2500 }]);
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: order.id, value: reordered }, { id: rules.id, value: lowered }, { id: limit.id, value: limited }] });
    assert.equal(preview.status, 200, preview.text);
    const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
    assert.equal(applied.status, 200, applied.text);
    assert.equal(t.router.nvram.bwdpi_app_rulelist, reordered);
    assert.equal(t.router.nvram.qos_rulelist.startsWith("<Web Surf>>80>tcp>>4"), true);
    assert.equal(t.router.nvram.qos_bw_rulelist, limited);
    const undo = await t.owner.post(`/api/changes/${applied.data.id}/undo`);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: undo.data.id })).status, 200);
    assert.equal(t.router.nvram.bwdpi_app_rulelist, order.value);
    // A category in two groups is refused, so the board can never stage one.
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: order.id, value: "9,20<9" }] })).status, 400);
    assert.equal(data.method, "adaptive");
  } finally {
    await t.stop();
  }
});

test("priority-board: the module is listed, well formed and has every file", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/priority-board/index.js"));
    for (const file of ["index.js", "drag.js", "model.js", "style.css"]) assert.equal((await fetch(`${t.base}/js/features/priority-board/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "priority-board"), null);
});
