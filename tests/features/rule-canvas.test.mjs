// The rule canvas: the lanes' data, conflict finding, and the forwarding and
// firewall edits it stages, which all go through the change engine.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/rule-canvas/index.js";
import { conflictedRules, findConflicts, laneRows, parsePort, portText, problemsOf, protoOverlap } from "../../public/js/features/rule-canvas/model.js";
import { readServices } from "../../server/features/rule-canvas/index.mjs";
import { startApp } from "../helpers.mjs";

const rule = (extPort, proto = "TCP", srcIp = "", ip = "198.51.100.20") => ({ name: "r", extPort, intPort: extPort, ip, proto, srcIp });

test("rule-canvas: ports and ranges parse, and protocols overlap the way they should", () => {
  assert.deepEqual(parsePort("8080"), [8080, 8080]);
  assert.deepEqual(parsePort("8000:8010"), [8000, 8010]);
  for (const bad of ["", "0", "70000", "9:3", "abc", "80:"]) assert.equal(parsePort(bad), null, bad);
  assert.equal(portText([80, 80]), "80");
  assert.equal(portText([8000, 8010]), "8000:8010");
  assert.equal(protoOverlap("BOTH", "UDP"), true);
  assert.equal(protoOverlap("TCP", "UDP"), false);
});

test("rule-canvas: conflicts between rules, and with what the router offers the internet", () => {
  const rules = [rule("8000:8010"), rule("8005", "TCP", "", "198.51.100.21"), rule("8005", "UDP"), rule("9000", "TCP", "203.0.113.5"), rule("9000", "TCP", "203.0.113.6"), rule("51820", "UDP")];
  const services = [{ id: "wireguard", port: 51820, proto: "UDP", wan: true }, { id: "web-lan", port: 80, proto: "TCP", wan: false }];
  const found = findConflicts(rules, services);
  assert.deepEqual(found, [{ kind: "forward-forward", a: 0, b: 1 }, { kind: "forward-service", rule: 5, service: "wireguard" }]);
  assert.deepEqual([...conflictedRules(found)].sort(), [0, 1, 5], "same ports from different source addresses, and TCP against UDP, do not fight");
  assert.deepEqual(findConflicts([rule("80")], services), [], "a port only the home network can reach is not a conflict");
  assert.deepEqual(problemsOf({ extPort: "x", intPort: "80", ip: "198.51.100.77" }, [{ ip: "198.51.100.20" }]), ["ext-port", "unknown-device"]);
  assert.deepEqual(laneRows([{ ip: "198.51.100.20", name: "nas" }], [rule("1", "TCP", "", "198.51.100.77")]).map((r) => [r.ip, r.known]), [["198.51.100.20", true], ["198.51.100.77", false]]);
});

test("rule-canvas: services the router listens on come from its own settings", () => {
  const nv = (o) => new Map(Object.entries(o));
  assert.deepEqual(readServices(nv({ http_lanport: "80", sshd_enable: "2", sshd_port: "22" })).map((s) => [s.id, s.wan]), [["web-lan", false], ["ssh", false]]);
  assert.deepEqual(readServices(nv({ http_lanport: "80", sshd_enable: "1", sshd_port: "2222", VPNServer_enable: "1", vpn_server1_port: "1194", vpn_server1_proto: "udp", wgs_enable: "1", wgs_port: "51820" })).map((s) => [s.id, s.port, s.proto, s.wan]),
    [["web-lan", 80, "TCP", false], ["ssh", 2222, "TCP", true], ["openvpn", 1194, "UDP", true], ["wireguard", 51820, "UDP", true]]);
  assert.deepEqual(readServices(nv({ sshd_enable: "0", sshd_port: "22" })), [], "a service that is off, or has no setting on this router, is not drawn");
});

test("rule-canvas: the domain shows the rules, services, firewall rules and devices", async () => {
  const t = await startApp();
  try {
    assert.ok((await t.owner.get("/api/catalog")).data.domains.some((d) => d.id === "rule-canvas" && d.supported));
    const data = (await t.owner.get("/api/domain/rule-canvas")).data;
    assert.equal(data.forwarding.enabled, true);
    assert.deepEqual(data.forwarding.rules.map((r) => [r.name, r.extPort, r.ip, r.proto]), [["Game server", "25565", "198.51.100.20", "TCP"]]);
    assert.ok(data.services.some((s) => s.id === "web-lan" && !s.wan));
    assert.equal(data.firewall.present, true);
    assert.ok(data.devices.some((d) => d.ip === "198.51.100.20" && d.name === "nas"));
    // The conflict check on what the router really has: nothing fights yet.
    assert.deepEqual(findConflicts(data.forwarding.rules, data.services), []);
  } finally {
    await t.stop();
  }
});

test("rule-canvas: add, move, change and remove a forwarding rule through the change engine", async () => {
  const t = await startApp();
  try {
    const apply = async (body) => {
      const preview = await t.owner.post("/api/changes/preview", body);
      assert.equal(preview.status, 200, preview.text);
      const done = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
      assert.equal(done.status, 200, done.text);
      assert.equal(done.data.status, "applied");
    };
    const read = async () => (await t.owner.get("/api/domain/rule-canvas")).data.forwarding.rules;
    await apply({ ops: [{ op: "forward-add", name: "Web", extPort: "8080", ip: "198.51.100.101", intPort: "80", proto: "TCP", srcIp: "" }] });
    assert.deepEqual((await read()).map((r) => [r.name, r.extPort, r.intPort, r.ip]), [["Game server", "25565", "25565", "198.51.100.20"], ["Web", "8080", "80", "198.51.100.101"]]);
    // Drag the Web card onto the nas, then change its port and protocol, in one batch like the browser stages them.
    await apply({ ops: [
      { op: "forward-update", index: 1, name: "Web", extPort: "8080", ip: "198.51.100.20", intPort: "80", proto: "TCP", srcIp: "" },
      { op: "forward-update", index: 1, name: "Web", extPort: "8081", ip: "198.51.100.20", intPort: "80", proto: "BOTH", srcIp: "" },
    ] });
    assert.deepEqual((await read())[1], { index: 1, name: "Web", extPort: "8081", ip: "198.51.100.20", intPort: "80", proto: "BOTH", srcIp: "" });
    // Removing the first rule shifts the second to index 0, which the browser mirrors.
    await apply({ ops: [{ op: "forward-remove", index: 0 }] });
    assert.deepEqual((await read()).map((r) => r.name), ["Web"]);
    // A rule that points off the router's network is refused.
    const off = await t.owner.post("/api/changes/preview", { ops: [{ op: "forward-add", name: "Bad", extPort: "1", ip: "203.0.113.9", intPort: "1", proto: "TCP" }] });
    assert.equal(off.status, 400);
    // A bad port is refused.
    assert.equal((await t.owner.post("/api/changes/preview", { ops: [{ op: "forward-add", name: "Bad", extPort: "99999", ip: "198.51.100.20", intPort: "1", proto: "TCP" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("rule-canvas: the firewall rule list is edited as a catalogue entry and the master switches too", async () => {
  const t = await startApp();
  try {
    const entries = (await t.owner.get("/api/catalog")).data.entries;
    assert.ok(entries.some((e) => e.id === "fw.forwarding"));
    const rules = entries.find((e) => e.id === "firewall-pro.services.rules");
    assert.ok(rules && rules.control === "rule-table" && rules.columns.length === 5);
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: rules.id, value: "<>>>443>TCP" }, { id: "fw.forwarding", value: "0" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    const data = (await t.owner.get("/api/domain/rule-canvas")).data;
    assert.deepEqual(data.firewall.rules.map((r) => [r.dstPort, r.proto]), [["443", "TCP"]]);
    assert.equal(data.forwarding.enabled, false);
  } finally {
    await t.stop();
  }
});

test("rule-canvas: the module is listed, well formed and needs a session", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/domain/rule-canvas")).status, 401);
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/rule-canvas/index.js"));
    for (const file of ["index.js", "drag.js", "model.js", "style.css"]) assert.equal((await fetch(`${t.base}/js/features/rule-canvas/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "rule-canvas"), null);
});
