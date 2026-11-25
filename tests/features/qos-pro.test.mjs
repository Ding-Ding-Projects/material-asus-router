// Tests for the qos-pro feature: the Adaptive QoS priority order, the
// traditional rules, the per-device bandwidth limiter, the Cake settings gated
// to Asuswrt-Merlin, the plan route, and the screen's helpers (including the
// speed test lookup, which must say plainly when there is no speed test).
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/qos-pro/index.js";
import * as model from "../../public/js/features/qos-pro/model.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { DEFAULT_ORDER, parseOrder, priorityOrder } from "../../server/features/qos-pro/priority.mjs";
import { isSecretKey } from "../../server/router/secrets.mjs";
import { startApp, waitFor } from "../helpers.mjs";

async function settle(t, record) {
  if (record.status !== "guarded" && record.status !== "applying") return record;
  return waitFor(async () => {
    const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
    return next.status !== "guarded" && next.status !== "applying" ? next : null;
  });
}

async function change(t, changes) {
  const preview = await t.owner.post("/api/changes/preview", { changes });
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  const record = await settle(t, applied.data);
  assert.equal(record.status, "applied", JSON.stringify(record));
  return record;
}

async function undo(t, record) {
  const preview = await t.owner.post(`/api/changes/${record.id}/undo`);
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal((await settle(t, applied.data)).status, "applied");
}

const entries = async (t) => (await t.owner.get("/api/domain/qos-pro")).data.entries;
const refuse = async (t, id, value) => assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id, value }] })).status, 400, `${id} should refuse ${value}`);

test("qos-pro: every entry reads the router's value through the rich controls", async () => {
  const t = await startApp();
  try {
    const list = await entries(t);
    assert.deepEqual(list.map((e) => [e.id, e.key, e.control]), [
      ["qos-pro.adaptive.order", "bwdpi_app_rulelist", "priority-order"],
      ["qos-pro.rules", "qos_rulelist", "rule-table"],
      ["qos-pro.limiter.rules", "qos_bw_rulelist", "rule-table"],
      ["qos-pro.cake.overhead", "qos_overhead", "stepper"],
      ["qos-pro.cake.atm", "qos_atm", "switch"],
    ]);
    for (const e of list) {
      assert.equal(e.value, t.router.nvram[e.key], `${e.id} shows the router's value`);
      assert.equal(isSecretKey(e.key), false, `${e.key} must not be masked`);
      assert.notEqual(e.control, "text");
    }
    const data = (await t.owner.get("/api/domain/qos-pro")).data;
    assert.deepEqual(data.stock.map((e) => e.id), ["qos.enabled", "qos.type", "qos.up", "qos.down"]);
    assert.deepEqual([data.method, data.bwdpi, data.merlin, data.speed], ["adaptive", true, true, { up: 20000, down: 300000 }]);
    assert.equal(data.defaultOrder, DEFAULT_ORDER);
  } finally {
    await t.stop();
  }
});

test("qos-pro: the priority order previews, applies, reads back and undoes", async () => {
  const t = await startApp();
  try {
    const reversed = "7,10,11,21,23<1,3,14<13,24<8<0,5,6,15,17<4<9,20";
    const record = await change(t, [{ id: "qos-pro.adaptive.order", value: reversed }]);
    assert.equal(t.router.nvram.bwdpi_app_rulelist, reversed);
    assert.ok(t.router.services.includes("restart_qos"));
    assert.equal((await entries(t)).find((e) => e.key === "bwdpi_app_rulelist").value, reversed);
    // Moving one group in the screen's model gives a value the server accepts.
    const moved = model.formatOrder(model.moveGroup(model.parseOrder(reversed), 6, 0));
    assert.equal(moved, "9,20<7,10,11,21,23<1,3,14<13,24<8<0,5,6,15,17<4");
    const second = await change(t, [{ id: "qos-pro.adaptive.order", value: moved }]);
    assert.equal(t.router.nvram.bwdpi_app_rulelist, moved);
    await undo(t, second);
    assert.equal(t.router.nvram.bwdpi_app_rulelist, reversed);
    await undo(t, record);
    assert.equal(t.router.nvram.bwdpi_app_rulelist, DEFAULT_ORDER);
  } finally {
    await t.stop();
  }
});

test("qos-pro: the priority order refuses orders the router would misread", async () => {
  const t = await startApp();
  try {
    await refuse(t, "qos-pro.adaptive.order", "9,20<9,4"); // 9 in two groups
    await refuse(t, "qos-pro.adaptive.order", "9,20<<4"); // an empty group
    await refuse(t, "qos-pro.adaptive.order", "a<b");
    await refuse(t, "qos-pro.adaptive.order", "100<4"); // not a category number
    await refuse(t, "qos-pro.adaptive.order", "1<2<3<4<5<6<7<8<9"); // nine groups
  } finally {
    await t.stop();
  }
  const fail = (text) => { throw new Error(text); };
  assert.equal(priorityOrder.validate({}, "1,2<3", fail), "1,2<3");
  assert.deepEqual(parseOrder("1<2,3"), [["1"], ["2", "3"]]);
  assert.equal(parseOrder(""), null);
  assert.notEqual(priorityOrder.sample({}, "1"), "1", "a single group still gets a different sample");
  assert.notEqual(priorityOrder.sample({}, ""), "");
});

test("qos-pro: the traditional QoS rules and the per-device limiter apply and undo", async () => {
  const t = await startApp();
  try {
    const rules = "<Web Surf>>80>tcp>>0<Video calls>198.51.100.104>3478:3481>udp>>1<HTTPS>>443>tcp>>0<Backups>AA:BB:CC:DD:EE:01>>any>512~>4";
    const first = await change(t, [{ id: "qos-pro.rules", value: rules }]);
    assert.equal(t.router.nvram.qos_rulelist, rules);
    const limits = "<1>198.51.100.103>20000>5000<0>198.51.100.104>1500>800";
    const second = await change(t, [{ id: "qos-pro.limiter.rules", value: limits }]);
    assert.equal(t.router.nvram.qos_bw_rulelist, limits);
    const plan = (await t.owner.get("/api/x/qos-pro/plan")).data;
    assert.deepEqual([plan.rules, plan.limits, plan.limitsOn, plan.tiers], [4, 2, 1, 7]);
    await undo(t, second);
    assert.equal(t.router.nvram.qos_bw_rulelist, "<1>198.51.100.103>20000>5000");
    await undo(t, first);
    assert.equal(t.router.nvram.qos_rulelist, "<Web Surf>>80>tcp>>0<HTTPS>>443>tcp>>0<Big Downloads>>80>tcp>512~>3");
  } finally {
    await t.stop();
  }
});

test("qos-pro: bad rules and limits are refused", async () => {
  const t = await startApp();
  try {
    await refuse(t, "qos-pro.rules", "<Web>>80>tcp>>9"); // no such priority
    await refuse(t, "qos-pro.rules", "<Web>>80>sctp>>0"); // no such protocol
    await refuse(t, "qos-pro.rules", "<Web>>99999>tcp>>0");
    await refuse(t, "qos-pro.rules", "<Web>>80>tcp>big>0"); // transferred bytes not a range
    await refuse(t, "qos-pro.rules", "<>>80>tcp>>0"); // a rule needs a name
    await refuse(t, "qos-pro.rules", "<Web>nobody>80>tcp>>0"); // not an address or MAC
    await refuse(t, "qos-pro.limiter.rules", "<1>198.51.100.103>fast>5000");
    await refuse(t, "qos-pro.limiter.rules", "<2>198.51.100.103>1000>5000"); // the switch is 0 or 1
    await refuse(t, "qos-pro.limiter.rules", "<1>>1000>5000"); // a limit needs a device
    await refuse(t, "qos-pro.limiter.rules", "<1>198.51.100.103>99999999>5000");
  } finally {
    await t.stop();
  }
});

test("qos-pro: Cake settings work on Merlin and are visible but disabled on the stock firmware", async () => {
  const merlin = await startApp({ firmware: "merlin" });
  try {
    const before = (await entries(merlin)).find((e) => e.id === "qos-pro.cake.overhead");
    assert.equal(before.disabled, null);
    await change(merlin, [{ id: "qos-pro.cake.overhead", value: "44" }, { id: "qos-pro.cake.atm", value: "1" }]);
    assert.deepEqual([merlin.router.nvram.qos_overhead, merlin.router.nvram.qos_atm], ["44", "1"]);
    await refuse(merlin, "qos-pro.cake.overhead", "65");
  } finally {
    await merlin.stop();
  }
  const stock = await startApp({ firmware: "stock" });
  try {
    const cake = (await entries(stock)).filter((e) => e.group === "cake");
    assert.equal(cake.length, 2, "both settings stay visible");
    for (const e of cake) {
      assert.match(e.disabled.en, /Merlin/);
      assert.ok(e.disabled.yue.includes("Merlin"));
      assert.equal((await stock.owner.post("/api/changes/preview", { changes: [{ id: e.id, value: e.control === "switch" ? "1" : "10" }] })).status, 400);
    }
    assert.equal((await stock.owner.get("/api/domain/qos-pro")).data.merlin, false);
  } finally {
    await stock.stop();
  }
});

test("qos-pro: the adaptive order needs bwdpi and says so when the model has none", async () => {
  const t = await startApp();
  try {
    t.router.nvram.rc_support = "2.4G 5G usbX1";
    const order = (await entries(t)).find((e) => e.id === "qos-pro.adaptive.order");
    assert.ok(order.disabled.en.includes("bwdpi"));
    await refuse(t, "qos-pro.adaptive.order", "4<9,20");
    assert.equal((await t.owner.get("/api/domain/qos-pro")).data.bwdpi, false);
    // The traditional rules do not need the engine.
    await change(t, [{ id: "qos-pro.rules", value: "<Web>>80>tcp>>0" }]);
  } finally {
    await t.stop();
  }
});

test("qos-pro: the line speed is read from the stock entries and the plan route needs a session", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/x/qos-pro/plan")).status, 401);
    const plan = (await t.owner.get("/api/x/qos-pro/plan")).data;
    assert.deepEqual([plan.enabled, plan.method, plan.up, plan.down], [false, "adaptive", 20000, 300000]);
    await change(t, [{ id: "qos.enabled", value: "1" }, { id: "qos.type", value: "2" }, { id: "qos.up", value: "45000" }, { id: "qos.down", value: "920000" }]);
    const after = (await t.owner.get("/api/x/qos-pro/plan")).data;
    assert.deepEqual([after.enabled, after.method, after.up, after.down], [true, "limiter", 45000, 920000]);
    assert.equal((await t.owner.get("/api/domain/qos-pro")).data.method, "limiter");
  } finally {
    await t.stop();
  }
});

test("qos-pro: the screen's helpers format speeds, find a speed test and read its result honestly", () => {
  assert.deepEqual(["", "n"].map(() => model.rateText("x")), ["", ""]);
  assert.equal(model.rateText(800), "800 kbit/s");
  assert.equal(model.rateText(20000), "20 Mbit/s");
  assert.equal(model.rateText(1500), "1.5 Mbit/s");
  assert.equal(model.rateText(2500000), "2.5 Gbit/s");
  assert.equal(model.plannedSpeed(100000), 90000);
  assert.equal(model.plannedSpeed(0), 1);
  assert.equal(model.findSpeedTest({ server: ["firewall-pro", "qos-pro"] }), null, "no speed test in this build");
  assert.equal(model.findSpeedTest({ server: ["speedtest"] }), "speedtest");
  assert.equal(model.findSpeedTest(undefined), null);
  assert.deepEqual(model.readSpeed({ downloadMbit: 300, uploadMbit: 20 }), { down: 300000, up: 20000 });
  assert.deepEqual(model.readSpeed({ downloadKbit: 250000.4, uploadKbit: 18000 }), { down: 250000, up: 18000 });
  assert.equal(model.readSpeed({ download: "fast" }), null, "an unknown shape is reported as unreadable, not guessed");
  assert.equal(model.readSpeed(null), null);
  assert.deepEqual(model.moveGroup([["1"], ["2"], ["3"]], 0, 2), [["2"], ["3"], ["1"]]);
  assert.deepEqual(model.moveGroup([["1"], ["2"]], 0, 5), [["1"], ["2"]], "an out-of-range move changes nothing");
});

test("qos-pro: the browser module is well formed and reuses firewall-pro's rule-table control", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/qos-pro/index.js"));
    assert.ok(manifest.modules.includes("/js/features/firewall-pro/index.js"), "the rule-table control comes from firewall-pro");
    for (const file of ["index.js", "model.js", "style.css"]) assert.equal((await fetch(`${t.base}/js/features/qos-pro/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "qos-pro"), null);
  assert.deepEqual(Object.keys(feature.controls), ["priority-order"]);
  assert.equal(feature.screens[0].id, "qos-pro");
});
