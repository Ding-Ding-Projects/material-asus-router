// ports: the switch status readers, the settings (some gated by verifyKey), the
// live status route, roles, and the frontend module. Every entry is also proved
// by tests/real-controls.test.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { detectChipset, parseRobocfg, parseSysfs, portRoles } from "../../server/features/ports/status.mjs";
import feature, { linkTone, speedText } from "../../public/js/features/ports/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp } from "../helpers.mjs";

test("ports: robocfg and sysfs readings become ports with link, speed and duplex", () => {
  const ports = parseRobocfg("Port 0: 1000FD enabled stp: none vlan: 1 jumbo: on mac: 04:d9:f5:12:34:51\nPort 2: DOWN enabled stp: none vlan: 1 jumbo: off mac: 00:00:00:00:00:00\nPort 1: 100HD disabled stp: none\nnoise\n");
  assert.deepEqual(ports.map((p) => [p.number, p.up, p.speed, p.duplex, p.jumbo]), [[0, true, 1000, "full", true], [1, false, 100, "half", null], [2, false, 0, "", false]]);
  assert.equal(ports[1].enabled, false, "a disabled port is never reported as up");

  const sys = parseSysfs("eth0 1 1000 full\neth1 0  \neth6   \neth7 1 -1 unknown\n", ["eth6", "eth7"]);
  assert.deepEqual(sys.map((p) => [p.name, p.up, p.speed, p.duplex]), [["eth0", true, 1000, "full"], ["eth1", false, 0, ""]]);
  assert.deepEqual(parseSysfs("garbage\n"), []);
});

test("ports: the chipset follows the tools the router has", () => {
  assert.equal(detectChipset("/usr/sbin/robocfg\n/usr/sbin/ethswctl\n").tool, "robocfg");
  assert.equal(detectChipset("/bin/ethswctl\n").id, "broadcom-runner");
  assert.equal(detectChipset("").id, "generic");
  assert.deepEqual(detectChipset("/usr/sbin/robocfg\n").tools, ["robocfg"]);
});

test("ports: roles come from the router's own settings", () => {
  const roles = (o) => portRoles(new Map(Object.entries(o))).map((r) => [r.kind, r.lan.join("+")]);
  assert.deepEqual(roles({ switch_stb_x: "5", lacp_enabled: "1", jumbo_frame_enable: "1", runner_disable: "1" }), [["iptv", "1+2"], ["aggregation", ""], ["jumbo", ""], ["accel-off", ""]]);
  assert.deepEqual(roles({ wans_dualwan: "wan lan", wans_lanport: "4", switch_stb_x: "0" }), [["second-internet", "4"]]);
  assert.deepEqual(roles({ wans_dualwan: "wan none", wans_lanport: "4" }), []);
});

test("ports: the screen data, the live status route and the switched-off setting with its reason", async () => {
  const t = await startApp();
  try {
    const domain = (await t.owner.get("/api/domain/ports")).data;
    assert.equal(domain.chipset.id, "broadcom-robocfg");
    assert.equal(domain.source, "robocfg");
    assert.deepEqual(domain.ports.map((p) => [p.number, p.up, p.speed]), [[0, true, 1000], [1, true, 2500], [2, false, 0], [3, true, 100], [4, true, 1000], [8, true, 1000]]);
    assert.equal(domain.elsewhere.length, 3);

    t.router.nvram.switch_stb_x = "6";
    t.router.nvram.ctf_disable_force = "1";
    const status = (await t.owner.get("/api/x/ports/status")).data;
    assert.deepEqual(status.roles.map((r) => r.kind), ["iptv", "accel-off"]);
    assert.deepEqual(status.roles[0].lan, [3, 4]);

    // jumbo_frame_size is not in the pretend router's own list, so the control is off with the reason.
    const entries = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "ports");
    assert.equal(entries.length, 7);
    const size = entries.find((e) => e.id === "ports.jumbo-size");
    assert.equal(size.disabled.en, "This router does not have the setting jumbo_frame_size");
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: size.id, value: "9000" }] })).status, 400);
    assert.equal(t.router.nvram.jumbo_frame_size, undefined, "a setting the router lacks is never written");
    for (const e of entries.filter((x) => x.id !== "ports.jumbo-size")) assert.equal(e.disabled, null, e.id);

    // Once the router lists the key, the control works.
    t.router.nvram.jumbo_frame_size = "1500";
    const open = (await t.owner.get("/api/catalog")).data.entries.find((e) => e.id === "ports.jumbo-size");
    assert.equal(open.disabled, null);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: open.id, value: "9000" }] })).status, 200);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: open.id, value: "100" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("ports: without a switch tool the generic link files are used, and an empty router says so", async () => {
  const t = await startApp();
  try {
    t.router.nvram.wl_ifnames = "eth6 eth7";
    const original = t.router.execute.bind(t.router);
    t.router.execute = (command) => (command.startsWith("for c in robocfg") ? { code: 0, stdout: "" } : command === "robocfg showports" ? { code: 127, stdout: "" } : original(command));
    const domain = (await t.owner.get("/api/domain/ports")).data;
    assert.equal(domain.chipset.id, "generic");
    assert.equal(domain.source, "sysfs");
    assert.deepEqual(domain.ports.map((p) => [p.name, p.up, p.speed]), [["eth0", true, 1000], ["eth1", true, 2500], ["eth2", false, 0], ["eth3", true, 100]]);
    t.router.execute = (command) => (command.startsWith("for ") ? { code: 1, stdout: "" } : original(command));
    const none = (await t.owner.get("/api/domain/ports")).data;
    assert.deepEqual([none.source, none.ports], ["none", []]);
  } finally {
    await t.stop();
  }
});

test("ports: viewers may read the status", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/x/ports/status")).status, 401);
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/x/ports/status")).status, 200);
  } finally {
    await t.stop();
  }
});

test("ports: the frontend module is well formed and its small helpers are right", () => {
  assert.equal(checkFeatureModule(feature, "ports"), null);
  assert.equal(speedText(2500), "2.5 Gbps");
  assert.equal(speedText(1000), "1 Gbps");
  assert.equal(speedText(100), "100 Mbps");
  assert.equal(speedText(0), "");
  assert.deepEqual([linkTone({ up: true, speed: 1000 }), linkTone({ up: true, speed: 100 }), linkTone({ up: false, enabled: true }), linkTone({ up: false, enabled: false })], ["good", "warn", "off", "bad"]);
});
