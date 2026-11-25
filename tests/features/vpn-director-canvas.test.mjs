// The VPN Director canvas: routing devices to the internet or a tunnel, the
// rule list as a real catalogue entry, and what it says on a router without it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/vpn-director-canvas/index.js";
import { canDropOn, isTarget, laneOf, readRules, route, ruleName, writeRules } from "../../public/js/features/vpn-director-canvas/model.js";
import { IFACES, isTarget as serverIsTarget, readTunnels } from "../../server/features/vpn-director-canvas/index.mjs";
import { startApp } from "../helpers.mjs";

const phone = { ip: "198.51.100.102", name: "Pat phone" };

test("vpn-director-canvas: routing a device adds, moves or removes its everywhere rule", () => {
  let rules = readRules("<1>Pat phone>198.51.100.102>>WAN<1>TV>198.51.100.101>203.0.113.0/24>OVPN1");
  assert.equal(laneOf(rules, "198.51.100.102"), "WAN");
  assert.equal(laneOf(rules, "198.51.100.101"), "", "a rule for one destination is not the device's route everywhere");
  rules = route(rules, phone, "OVPN2");
  assert.deepEqual(rules.map((r) => [r.local, r.iface]), [["198.51.100.102", "OVPN2"], ["198.51.100.101", "OVPN1"]]);
  assert.equal(rules[0].desc, "Pat phone → OVPN2");
  rules = route(rules, { ip: "198.51.100.103", name: "Printer" }, "WGC1");
  assert.equal(rules.length, 3);
  assert.equal(writeRules(rules), "<1>Pat phone → OVPN2>198.51.100.102>>OVPN2<1>TV>198.51.100.101>203.0.113.0/24>OVPN1<1>Printer → WGC1>198.51.100.103>>WGC1");
  assert.deepEqual(route(rules, phone, "").map((r) => r.local), ["198.51.100.101", "198.51.100.103"]);
  assert.equal(route(rules, { ip: "198.51.100.9", name: "x" }, "").length, 3, "removing a rule that is not there changes nothing");
  assert.equal([...ruleName("A very long device name that cannot fit", "OVPN1")].length <= 32, true);
  assert.equal(ruleName("<bad>", "WAN"), "bad → WAN");
});

test("vpn-director-canvas: addresses, networks and lanes are checked the same on both sides", () => {
  for (const text of ["198.51.100.1", "198.51.100.0/24", "203.0.113.9/32"]) assert.equal(isTarget(text) && serverIsTarget(text), true, text);
  for (const text of ["", "198.51.100", "198.51.100.1/33", "198.51.100.1/24/1", "a.b.c.d"]) assert.equal(isTarget(text) || serverIsTarget(text), false, text);
  assert.equal(IFACES.length, 11);
  const tunnels = readTunnels(new Map([["vpn_client1_addr", "vpn.example.test"], ["vpn_client1_rgw", "2"], ["wgc2_ep_addr", "203.0.113.20"], ["wgc2_enable", "1"]]));
  assert.deepEqual(tunnels.filter((x) => x.configured).map((x) => [x.id, x.followsPolicy]), [["WAN", true], ["OVPN1", true], ["WGC2", true]]);
  assert.equal(canDropOn(tunnels.find((x) => x.id === "OVPN3"), []), false);
  assert.equal(canDropOn(tunnels.find((x) => x.id === "OVPN3"), [{ iface: "OVPN3" }]), true, "a tunnel that still has a rule stays usable");
});

test("vpn-director-canvas: the domain, the catalogue entry and a real change on Asuswrt-Merlin", async () => {
  const t = await startApp();
  try {
    t.router.nvram.vpn_client1_addr = "vpn.example.test";
    t.router.nvram.vpn_client1_rgw = "2";
    const data = (await t.owner.get("/api/domain/vpn-director-canvas")).data;
    assert.equal(data.merlin, true);
    assert.equal(data.present, true);
    assert.deepEqual(data.rules.map((r) => [r.desc, r.local, r.iface]), [["Pat phone", "198.51.100.102", "WAN"]]);
    assert.equal(data.tunnels.find((x) => x.id === "OVPN1").followsPolicy, true);
    const entry = data.entries[0];
    assert.equal(entry.id, "vpn-director-canvas.rules");
    assert.equal(entry.control, "rule-table");
    const value = writeRules(route(readRules(entry.value), { ip: "198.51.100.101", name: "Living room TV" }, "OVPN1"));
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: entry.id, value }, { id: "vpn-pro.director", value: "1" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.ok(preview.data.restarts.includes("restart_vpnrouting0"), "a change restarts VPN routing");
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.equal(t.router.nvram.vpndirector_rulelist, value);
    assert.equal(t.router.nvram.vpndirector_enable, "1");
    // The list the engine refuses is the list the canvas can never stage.
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: entry.id, value: "<1>x>nonsense>>WAN" }] })).status, 400);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: entry.id, value: "<1>x>198.51.100.5>>OVPN9" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("vpn-director-canvas: stock firmware says why it cannot be used, and a missing setting disables the canvas", async () => {
  const stock = await startApp({ firmware: "stock" });
  try {
    const data = (await stock.owner.get("/api/domain/vpn-director-canvas")).data;
    assert.equal(data.merlin, false);
    assert.match(data.entries[0].disabled.en, /Merlin/);
    const refused = await stock.owner.post("/api/changes/preview", { changes: [{ id: "vpn-director-canvas.rules", value: "" }] });
    assert.equal(refused.status, 400);
  } finally {
    await stock.stop();
  }
  const t = await startApp();
  try {
    delete t.router.nvram.vpndirector_rulelist;
    delete t.router.committed.vpndirector_rulelist;
    const data = (await t.owner.get("/api/domain/vpn-director-canvas")).data;
    assert.equal(data.present, false);
    assert.deepEqual(data.missing, ["vpndirector_rulelist"], "the screen says which setting the router lacks");
  } finally {
    await t.stop();
  }
});

test("vpn-director-canvas: the module is listed and well formed", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/vpn-director-canvas/index.js"));
    for (const file of ["index.js", "drag.js", "model.js", "style.css"]) assert.equal((await fetch(`${t.base}/js/features/vpn-director-canvas/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "vpn-director-canvas"), null);
});
