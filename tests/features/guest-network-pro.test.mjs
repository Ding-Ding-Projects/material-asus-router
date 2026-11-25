// Guest Network Pro: one block of controls per network slot the router really has (apgN_), each writing the
// slot's own documented keys through the change engine. A router without the slots shows none.
import assert from "node:assert/strict";
import { test } from "node:test";
import { slotEntries, slotsOf } from "../../server/features/guest-network-pro/index.mjs";
import { startApp } from "../helpers.mjs";

const PROFILE = { profile: "rt-be88u-merlin-3006" };
const mine = async (t) => (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "guest-network-pro");

test("guest-network-pro: slots come from the router's own settings list and every key is a real one", async () => {
  assert.deepEqual(slotsOf({ settingKeys: new Set(["apg1_enable", "apg3_enable", "apg2_ssid", "apg_enable", "apg0_enable", "apg10_enable"]) }), [1, 3, 10], "only numbered slots that have an enable switch");
  assert.deepEqual(slotsOf({}), [], "no list, no slots");
  assert.deepEqual(slotEntries(2).map((e) => e.key), ["apg2_enable", "apg2_ssid", "apg2_hide_ssid", "apg2_ap_isolate", "apg2_11be", "apg2_mlo", "apg2_macmode", "apg2_timesched"]);

  const t = await startApp(PROFILE);
  try {
    const entries = await mine(t);
    assert.equal(entries.length, 18 * 8, "eighteen slots of eight controls");
    assert.equal(new Set(entries.map((e) => e.group)).size, 18);
    assert.ok(entries.every((e) => e.key in t.router.nvram && e.disabled === null), "every control is available and its setting exists on the router");
    assert.ok(entries.every((e) => e.label.yue && e.help.yue));
    const domain = (await t.owner.get("/api/domain/guest-network-pro")).data;
    assert.deepEqual([domain.slots.length, domain.active, domain.entries.length], [18, 0, 144]);
  } finally {
    await t.stop();
  }
});

test("guest-network-pro: a slot is switched on, named and put in multi-link, and wrong values are refused", async () => {
  const t = await startApp(PROFILE);
  try {
    const changes = [
      { id: "guest-network-pro.apg2.enable", value: "1" },
      { id: "guest-network-pro.apg2.ssid", value: "Harbour Visitors" },
      { id: "guest-network-pro.apg2.mlo", value: "1" },
      { id: "guest-network-pro.apg2.macmode", value: "allow" },
    ];
    const preview = await t.owner.post("/api/changes/preview", { changes });
    assert.equal(preview.status, 200, preview.text);
    assert.deepEqual(preview.data.items.map((i) => i.key).sort(), ["apg2_enable", "apg2_macmode", "apg2_mlo", "apg2_ssid"]);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.deepEqual(["apg2_enable", "apg2_ssid", "apg2_mlo", "apg2_macmode"].map((k) => t.router.nvram[k]), ["1", "Harbour Visitors", "1", "allow"]);
    assert.equal(t.router.nvram.apg3_enable, "0", "another slot is left alone");
    assert.equal((await t.owner.get("/api/domain/guest-network-pro")).data.active, 1);

    for (const [id, value] of [["macmode", "everyone"], ["enable", "yes"], ["ssid", "x".repeat(33)], ["hide", "2"]])
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: `guest-network-pro.apg4.${id}`, value }] })).status, 400, `${id}=${value}`);
  } finally {
    await t.stop();
  }
});

test("guest-network-pro: a router that has no such slots shows no controls", async () => {
  const t = await startApp();
  try {
    assert.deepEqual(await mine(t), []);
    assert.equal((await t.owner.get("/api/domain/guest-network-pro")).data.entries.length, 0);
  } finally {
    await t.stop();
  }
});
