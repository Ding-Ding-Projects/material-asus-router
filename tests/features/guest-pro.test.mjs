// Tests for guest-pro: separate guest networks and VLAN tags on stock firmware,
// switched off with the reason on Merlin and for any setting the router does
// not list, plus the live visitor count and the screen's map helpers.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/guest-pro/index.js";
import { bridgeName, countsOf, guestMap, prefixOf, rows } from "../../public/js/features/guest-pro/model.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp, waitFor } from "../helpers.mjs";

async function change(t, changes) {
  const preview = await t.owner.post("/api/changes/preview", { changes });
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  const record = await waitFor(async () => {
    const next = (await t.owner.get(`/api/changes/history/${applied.data.id}`)).data;
    return next.status !== "guarded" && next.status !== "applying" ? next : null;
  });
  assert.equal(record.status, "applied");
  return record;
}
const entries = async (t) => (await t.owner.get("/api/domain/guest-pro")).data.entries;

test("guest-pro on stock firmware: every control reads, writes through the change engine and reads back", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const list = await entries(t);
    assert.equal(list.length, 14, "two settings for each of six guest networks, plus the VLAN and address lists");
    for (const e of list) {
      assert.equal(e.disabled, null, `${e.id} works on stock firmware`);
      assert.equal(e.value, t.router.nvram[e.key], `${e.id} shows the router's value`);
      assert.notEqual(e.control, "text");
    }
    await change(t, [{ id: "guest-pro.wl0.2.brif", value: "br2" }, { id: "guest-pro.wl0.2.isolate", value: "0" }]);
    assert.deepEqual([t.router.committed["wl0.2_brif"], t.router.committed["wl0.2_ap_isolate"]], ["br2", "0"]);
    await change(t, [{ id: "guest-pro.vlan.rules", value: "<Guests>20>br1<Kids>30>br2" }]);
    assert.equal(t.router.nvram.vlan_rulelist, "<Guests>20>br1<Kids>30>br2");
    const data = (await t.owner.get("/api/domain/guest-pro")).data;
    assert.equal(data.nets.find((n) => n.id === "wl0.2").bridge, "br2");
    assert.equal(data.stockOnly, true);
  } finally {
    await t.stop();
  }
});

test("guest-pro: wrong values are refused", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    for (const [id, value] of [["guest-pro.wl0.1.brif", "br9"], ["guest-pro.wl0.1.isolate", "maybe"], ["guest-pro.vlan.rules", "<Guests>1>br1"], ["guest-pro.vlan.rules", "<Guests>20>br0"], ["guest-pro.subnets", "<br1>not-an-ip>255.255.255.0>1>86400"], ["guest-pro.subnets", "<br1>203.0.113.1>255.255.255.0>1>10"]])
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id, value }] })).status, 400, `${id} ${value}`);
  } finally {
    await t.stop();
  }
});

test("guest-pro on Merlin: every entry is switched off and refuses changes", async () => {
  const t = await startApp({ firmware: "merlin" });
  try {
    const data = (await t.owner.get("/api/domain/guest-pro")).data;
    assert.equal(data.stockOnly, false);
    assert.match(data.reason.en, /stock ASUS firmware/);
    assert.ok(data.reason.yue.length > 5);
    for (const e of data.entries) {
      assert.ok(e.disabled, `${e.id} is off on Merlin`);
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: e.id, value: e.control === "switch" ? "0" : "x" }] })).status, 400);
    }
  } finally {
    await t.stop();
  }
});

test("guest-pro: a setting the router does not list is switched off with the exact reason", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    delete t.router.nvram["wl1.3_brif"];
    const gone = (await entries(t)).find((e) => e.key === "wl1.3_brif");
    assert.equal(gone.disabled.en, "This router does not have the setting wl1.3_brif");
    assert.ok(gone.disabled.yue.includes("wl1.3_brif"));
    assert.equal((await entries(t)).find((e) => e.key === "wl1.2_brif").disabled, null);
  } finally {
    await t.stop();
  }
});

test("guest-pro: the live route counts visitors on each guest network and needs a session", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    assert.equal((await t.client().get("/api/x/guest-pro/clients")).status, 401);
    const out = (await t.owner.get("/api/x/guest-pro/clients")).data;
    assert.equal(out.networks.length, 6);
    assert.equal(out.networks.find((n) => n.id === "wl0.1").count, 2);
    assert.equal(out.networks.find((n) => n.id === "wl1.3").count, 0);
    assert.ok(Date.parse(out.at) > 0);
  } finally {
    await t.stop();
  }
});

test("guest-pro: the map helpers join each guest Wi-Fi to its network, VLAN and addresses", () => {
  assert.deepEqual(rows("<a>1>b<c>2>d"), [["a", "1", "b"], ["c", "2", "d"]]);
  assert.equal(prefixOf("255.255.255.0"), 24);
  assert.equal(prefixOf("255.255.254.0"), 23);
  assert.equal(prefixOf("255.0.255.0"), null);
  assert.equal(bridgeName("br1").en, "Guest network 1");
  const nets = [
    { id: "wl0.1", ssid: "Visitors", on: true, bridge: "br1", isolate: true },
    { id: "wl0.2", ssid: "Cafe", on: true, bridge: "br0", isolate: false },
    { id: "wl0.3", ssid: "", on: false, bridge: "br0", isolate: false },
  ];
  const map = guestMap(nets, "<Guests>20>br1", "<br1>203.0.113.1>255.255.255.0>1>86400", countsOf({ networks: [{ id: "wl0.1", count: 3 }] }));
  assert.deepEqual(map.map((m) => m.advice), ["safe", "shared", "off"]);
  assert.deepEqual(map[0].vlan, { name: "Guests", vid: 20 });
  assert.equal(map[0].subnet.gateway, "203.0.113.1");
  assert.equal(map[0].clients, 3);
  assert.equal(map[1].vlan, null);
  // A change waiting in the dock moves the line before it is applied.
  const pending = guestMap(nets, "", "", new Map(), new Map([["wl0.1_ap_isolate", "0"]]));
  assert.equal(pending[0].advice, "visible");
});

test("guest-pro: the module is well formed and the manifest lists it", async () => {
  assert.equal(checkFeatureModule(feature, "guest-pro"), null);
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/guest-pro/index.js"));
    assert.ok(manifest.styles.includes("/js/features/guest-pro/style.css"));
  } finally {
    await t.stop();
  }
});
