// Tests for captive-portal: the guest welcome page switch, network picker and
// sign-in times, stock firmware only, and the screen's story helpers.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/captive-portal/index.js";
import { effective, sessionWords, visitorStory } from "../../public/js/features/captive-portal/model.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp, waitFor } from "../helpers.mjs";

async function change(t, changes) {
  const preview = await t.owner.post("/api/changes/preview", { changes });
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  const record = await waitFor(async () => {
    const next = (await t.owner.get(`/api/changes/history/${applied.data.id}`)).data;
    return next.status !== "guarded" && next.status !== "applying" ? next : null;
  });
  assert.equal(record.status, "applied");
}
const data = async (t) => (await t.owner.get("/api/domain/captive-portal")).data;

test("captive-portal on stock firmware: the switch, the network picker and the times read, write and read back", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const before = await data(t);
    assert.deepEqual(before.entries.map((e) => [e.id, e.key, e.control]), [
      ["captive-portal.enabled", "captive_portal_enable", "switch"],
      ["captive-portal.network", "captive_portal_wlif", "select"],
      ["captive-portal.session", "captive_portal_session", "select"],
      ["captive-portal.idle", "captive_portal_idle", "stepper"],
    ]);
    for (const e of before.entries) assert.deepEqual([e.disabled, e.value], [null, t.router.nvram[e.key]]);
    assert.equal(before.enabled, false);
    await change(t, [{ id: "captive-portal.enabled", value: "1" }, { id: "captive-portal.network", value: "wl1.2" }, { id: "captive-portal.session", value: "86400" }, { id: "captive-portal.idle", value: "45" }]);
    assert.deepEqual(["captive_portal_enable", "captive_portal_wlif", "captive_portal_session", "captive_portal_idle"].map((k) => t.router.committed[k]), ["1", "wl1.2", "86400", "45"]);
    assert.ok(t.router.services.includes("restart_chilli"));
    const after = await data(t);
    assert.deepEqual([after.enabled, after.network], [true, "wl1.2"]);
    assert.equal(after.networkReady, false, "the picked guest network is still off");
  } finally {
    await t.stop();
  }
});

test("captive-portal: wrong values are refused", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    for (const [id, value] of [["captive-portal.enabled", "yes"], ["captive-portal.network", "wl9.1"], ["captive-portal.session", "5"], ["captive-portal.idle", "1441"], ["captive-portal.idle", "-1"]])
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id, value }] })).status, 400, `${id} ${value}`);
  } finally {
    await t.stop();
  }
});

test("captive-portal on Merlin: switched off with the reason, and off for a missing setting", async () => {
  const merlin = await startApp({ firmware: "merlin" });
  try {
    const d = await data(merlin);
    assert.match(d.reason.en, /stock ASUS firmware/);
    for (const e of d.entries) {
      assert.ok(e.disabled);
      assert.equal((await merlin.owner.post("/api/changes/preview", { changes: [{ id: e.id, value: "1" }] })).status, 400);
    }
  } finally {
    await merlin.stop();
  }
  const stock = await startApp({ firmware: "stock" });
  try {
    delete stock.router.nvram.captive_portal_idle;
    const idle = (await data(stock)).entries.find((e) => e.key === "captive_portal_idle");
    assert.equal(idle.disabled.en, "This router does not have the setting captive_portal_idle");
  } finally {
    await stock.stop();
  }
});

test("captive-portal: the story says what a visitor will see, including when the network is off", () => {
  assert.equal(visitorStory({ enabled: false }).id, "off");
  assert.equal(visitorStory({ enabled: true, networkReady: false, network: "wl0.2" }).id, "network-off");
  const on = visitorStory({ enabled: true, networkReady: true, ssid: "Visitors", session: "3600", idle: "10" });
  assert.deepEqual([on.id, on.session, on.idle], ["on", 3600, 10]);
  assert.equal(sessionWords(14400).en, "for 4 hours");
  assert.equal(sessionWords(0).yue, "直到佢哋離開");
  const d = { network: "wl0.1", ssids: [{ id: "wl0.1", ssid: "Visitors", on: true }, { id: "wl1.1", ssid: "Visitors 5G", on: false }], entries: [{ id: "captive-portal.enabled", value: "0" }, { id: "captive-portal.network", value: "wl0.1" }, { id: "captive-portal.session", value: "3600" }, { id: "captive-portal.idle", value: "5" }] };
  assert.deepEqual([effective(d, new Map()).enabled, effective(d, new Map()).networkReady], [false, true]);
  const pending = effective(d, new Map([["captive-portal.enabled", "1"], ["captive-portal.network", "wl1.1"]]));
  assert.deepEqual([pending.enabled, pending.networkReady, pending.ssid], [true, false, "Visitors 5G"]);
});

test("captive-portal: the module is well formed and the manifest lists it", async () => {
  assert.equal(checkFeatureModule(feature, "captive-portal"), null);
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/captive-portal/index.js"));
    assert.ok(manifest.styles.includes("/js/features/captive-portal/style.css"));
  } finally {
    await t.stop();
  }
});
