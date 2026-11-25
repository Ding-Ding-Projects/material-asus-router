// VPN clients in depth: tunnel details of each OpenVPN client slot the router really has (vpn_clientN_), Merlin only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { slotEntries, slotsOf } from "../../server/features/vpn-clients-pro/index.mjs";
import { startApp } from "../helpers.mjs";

const PROFILE = { profile: "rt-be88u-merlin-3006" };
const mine = async (t) => (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "vpn-clients-pro");

test("vpn-clients-pro: slots come from the router's own list and each slot has twelve controls", async () => {
  assert.deepEqual(slotsOf({ settingKeys: new Set(["vpn_client1_state", "vpn_client5_state", "vpn_client_state", "vpn_client2_addr"]) }), [1, 5]);
  const keys = slotEntries(3).map((e) => e.key);
  assert.equal(keys.length, 12);
  assert.ok(keys.every((k) => k.startsWith("vpn_client3_")));
  const t = await startApp(PROFILE);
  try {
    const entries = await mine(t);
    assert.equal(entries.length, 5 * 12);
    assert.ok(entries.every((e) => e.disabled === null && e.key in t.router.nvram && e.restart === `restart_vpnclient${e.id.match(/client(\d)/)[1]}`));
    assert.deepEqual((await t.owner.get("/api/domain/vpn-clients-pro")).data.slots, [1, 2, 3, 4, 5]);
  } finally {
    await t.stop();
  }
});

test("vpn-clients-pro: a slot's encryption and kill switch are written in the firmware's format, with the right restart", async () => {
  const t = await startApp(PROFILE);
  try {
    const preview = await t.owner.post("/api/changes/preview", { changes: [
      { id: "vpn-clients-pro.client2.cipher", value: "AES-256-GCM" }, { id: "vpn-clients-pro.client2.comp", value: "lz4" }, { id: "vpn-clients-pro.client2.enforce", value: "1" }, { id: "vpn-clients-pro.client2.reneg", value: "3600" }, { id: "vpn-clients-pro.client2.retry", value: "-1" },
    ] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.deepEqual(["cipher", "comp", "enforce", "reneg", "connretry"].map((k) => t.router.nvram[`vpn_client2_${k}`]), ["AES-256-GCM", "lz4", "1", "3600", "-1"]);
    assert.equal(t.router.nvram.vpn_client1_cipher, "default", "another slot is left alone");
    assert.ok(t.router.services.includes("restart_vpnclient2"));
    for (const [id, value] of [["cipher", "ROT13"], ["comp", "zip"], ["verb", "12"], ["reneg", "-2"], ["dns", "4"], ["nat", "yes"]])
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: `vpn-clients-pro.client1.${id}`, value }] })).status, 400, `${id}=${value}`);
  } finally {
    await t.stop();
  }
});

test("vpn-clients-pro: a router without client slots shows no controls", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    assert.deepEqual(await mine(t), []);
  } finally {
    await t.stop();
  }
});
