// Wi-Fi 7 multi-link: Wi-Fi 7 and multi-link switches for each network profile the router really has (apmN_).
// The profile's own on switch is never offered, because switching a main profile off would take the Wi-Fi down.
import assert from "node:assert/strict";
import { test } from "node:test";
import { slotEntries, slotsOf } from "../../server/features/wifi-multilink/index.mjs";
import { startApp } from "../helpers.mjs";

const PROFILE = { profile: "rt-be88u-merlin-3006" };
const mine = async (t) => (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "wifi-multilink");

test("wifi-multilink: profiles come from the router's own list and the on switch is never offered", async () => {
  assert.deepEqual(slotsOf({ settingKeys: new Set(["apm1_enable", "apm4_enable", "apm2_mlo", "apm_enable"]) }), [1, 4]);
  assert.deepEqual(slotEntries(1).map((e) => e.key), ["apm1_11be", "apm1_mlo", "apm1_hide_ssid", "apm1_ap_isolate"]);
  const t = await startApp(PROFILE);
  try {
    const entries = await mine(t);
    assert.equal(entries.length, 10 * 4);
    assert.ok(!entries.some((e) => e.key.endsWith("_enable")), "no profile on switch");
    assert.ok(entries.every((e) => e.key in t.router.nvram && e.disabled === null));
    const domain = (await t.owner.get("/api/domain/wifi-multilink")).data;
    assert.deepEqual([domain.slots.length, domain.linked], [10, 1], "one profile is in multi-link in the demo");
  } finally {
    await t.stop();
  }
});

test("wifi-multilink: multi-link is switched, checked and undone through the change engine", async () => {
  const t = await startApp(PROFILE);
  try {
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "wifi-multilink.apm2.mlo", value: "1" }, { id: "wifi-multilink.apm1.be", value: "0" }] });
    assert.equal(preview.status, 200, preview.text);
    const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
    assert.equal(applied.status, 200, applied.text);
    assert.deepEqual([t.router.nvram.apm2_mlo, t.router.nvram.apm1_11be], ["1", "0"]);
    assert.equal((await t.owner.get("/api/domain/wifi-multilink")).data.linked, 2);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "wifi-multilink.apm2.mlo", value: "2" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("wifi-multilink: a router without profiles shows none", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    assert.deepEqual(await mine(t), []);
  } finally {
    await t.stop();
  }
});
