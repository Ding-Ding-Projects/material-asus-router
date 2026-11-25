// The ports and VLAN canvas: how the IPTV port setting maps to ports, and the
// real Internet settings it writes through the change engine.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/port-canvas/index.js";
import { assignIptv, partnerOf, portsFor, profileIds, roleOf, togglePair, validVlan, valueFor } from "../../public/js/features/port-canvas/model.js";
import { startApp, waitFor } from "../helpers.mjs";

test("port-canvas: the IPTV port number and the ports it means convert both ways", () => {
  assert.deepEqual(["0", "1", "4", "5", "6", "9", "x"].map((v) => portsFor(v)), [[], [1], [4], [1, 2], [3, 4], [], []]);
  assert.deepEqual([[], [2], [1, 2], [3, 4], [2, 3], [1, 4]].map(valueFor), ["0", "2", "5", "6", null, null], "a pair the router has no choice for is null");
  assert.equal(partnerOf(1), 2);
  assert.equal(partnerOf(4), 3);
  assert.equal(partnerOf(9), null);
  assert.equal(assignIptv("0", 3), "3");
  assert.equal(assignIptv("3", 1), "1", "a new port replaces the old one");
  assert.equal(assignIptv("5", 2), "5", "dropping on a port of the current pair keeps the pair");
  assert.equal(togglePair("1", 1), "5");
  assert.equal(togglePair("5", 1), "1");
  assert.equal(togglePair("0", 1), "0", "a port that is not the IPTV port has nothing to pair");
  assert.equal(roleOf(2, "5"), "iptv");
  assert.equal(roleOf(3, "5"), "lan");
});

test("port-canvas: VLAN ids and provider profiles are read the way the router means them", () => {
  assert.deepEqual(["0", "2", "4094", "1", "4095", "-5", "abc", ""].map(validVlan), [true, true, true, false, false, false, false, false]);
  assert.deepEqual(profileIds({ unifi_home: { internet: 500, iptv: 600 } }, "unifi_home"), [{ name: "internet", id: 500 }, { name: "iptv", id: 600 }]);
  assert.deepEqual(profileIds({}, "manual"), []);
});

test("port-canvas: the IPTV port, profile and VLAN ids are real entries and go through the change engine", async () => {
  const t = await startApp();
  try {
    const data = (await t.owner.get("/api/domain/internet-pro")).data;
    const id = (name) => data.entries.find((e) => e.id === `internet-pro.${name}`);
    for (const name of ["stb", "profile", "vlan-internet", "vlan-iptv", "vlan-voip", "prio-internet", "prio-iptv", "prio-voip"]) assert.ok(id(name), name);
    assert.deepEqual(id("stb").options.map(([v]) => v), ["0", "1", "2", "3", "4", "5", "6"]);
    assert.ok(data.profiles.unifi_home.iptv);

    // Drag IPTV onto LAN 3, pick Manual and give the IPTV traffic its own VLAN.
    const changes = [
      { id: id("stb").id, value: assignIptv("0", 3) },
      { id: id("profile").id, value: "manual" },
      { id: id("vlan-iptv").id, value: "600" },
      { id: id("prio-iptv").id, value: "4" },
    ];
    const preview = await t.owner.post("/api/changes/preview", { changes });
    assert.equal(preview.status, 200, preview.text);
    assert.equal(preview.data.guard.armed, true, "port and VLAN changes can cut the line, so the safety net is armed");
    const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
    const done = await waitFor(async () => {
      const record = (await t.owner.get(`/api/changes/history/${applied.data.id}`)).data;
      return record.status === "guarded" || record.status === "applying" ? null : record;
    });
    assert.equal(done.status, "applied");
    assert.deepEqual([t.router.nvram.switch_stb_x, t.router.nvram.switch_wantag, t.router.nvram.switch_wan1tagid, t.router.nvram.switch_wan1prio], ["3", "manual", "600", "4"]);
    // A VLAN id the router cannot have, and a port that does not exist, are refused.
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: id("vlan-iptv").id, value: "5000" }] })).status, 400);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: id("stb").id, value: "9" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("port-canvas: the module is listed and well formed", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/port-canvas/index.js"));
    for (const file of ["index.js", "drag.js", "model.js", "style.css"]) assert.equal((await fetch(`${t.base}/js/features/port-canvas/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "port-canvas"), null);
});
