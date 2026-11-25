// Internet and IPv6 extras: PPP keep-alive, UPnP and the DHCP option for the main connection, and four IPv6
// switches, all on the router's own keys.
import assert from "node:assert/strict";
import { test } from "node:test";
import { startApp } from "../helpers.mjs";

const mine = async (t) => (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "wan-ipv6-extras");

test("wan-ipv6-extras: nine controls on real keys, and the IPv6 ones need IPv6 on the model", async () => {
  const t = await startApp({ profile: "rt-be88u-merlin-3006" });
  try {
    const entries = await mine(t);
    assert.deepEqual(entries.map((e) => e.key), ["wan0_ppp_echo", "wan0_ppp_echo_interval", "wan0_ppp_echo_failure", "wan0_upnp_enable", "wan0_vpndhcp", "ipv6_radvd", "ipv6_dhcp6s_enable", "ipv6_accept_defrtr", "ipv6_dhcp6c_release"]);
    assert.ok(entries.every((e) => e.disabled === null && e.key in t.router.nvram), "available on the RT-BE88U model, which has IPv6");
  } finally {
    await t.stop();
  }
  const plain = await startApp();
  try {
    const entries = await mine(plain);
    assert.equal(entries.filter((e) => e.disabled).length, 4, "this pretend model lacks IPv6, so the four IPv6 switches show why they are off");
    assert.match(entries.find((e) => e.key === "ipv6_radvd").disabled.en, /ipv6/);
    assert.equal((await plain.owner.post("/api/changes/preview", { changes: [{ id: "wan-ipv6-extras.radvd", value: "0" }] })).status, 400);
  } finally {
    await plain.stop();
  }
});

test("wan-ipv6-extras: keep-alive and IPv6 switches are written, read back and refused when wrong", async () => {
  const t = await startApp({ profile: "rt-be88u-merlin-3006" });
  try {
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "wan-ipv6-extras.ppp-interval", value: "30" }, { id: "wan-ipv6-extras.ppp-failure", value: "5" }, { id: "wan-ipv6-extras.radvd", value: "0" }, { id: "wan-ipv6-extras.upnp", value: "1" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.deepEqual(["wan0_ppp_echo_interval", "wan0_ppp_echo_failure", "ipv6_radvd", "wan0_upnp_enable"].map((k) => t.router.nvram[k]), ["30", "5", "0", "1"]);
    for (const [id, value] of [["ppp-interval", "0"], ["ppp-failure", "101"], ["radvd", "2"], ["ppp-echo", "on"]])
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: `wan-ipv6-extras.${id}`, value }] })).status, 400, `${id}=${value}`);
    assert.equal((await t.owner.get("/api/domain/wan-ipv6-extras")).data.entries.length, 9);
  } finally {
    await t.stop();
  }
});
