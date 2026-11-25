// aimesh-pro: the node list, devices per node, node names, the backhaul
// priority setting and the two node actions with their confirmations.
import assert from "node:assert/strict";
import { test } from "node:test";
import { nodeCommand, readClients, readNodes } from "../../server/features/aimesh-pro/index.mjs";
import feature from "../../public/js/features/aimesh-pro/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp, waitFor } from "../helpers.mjs";

async function applyPreview(t, preview) {
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.id });
  assert.equal(applied.status, 200, applied.text);
  return waitFor(async () => {
    const record = (await t.owner.get(`/api/changes/history/${applied.data.id}`)).data;
    return record.status !== "guarded" && record.status !== "applying" ? record : null;
  });
}

test("aimesh-pro: nodes are read with their names, roles and the devices attached to each", async () => {
  const t = await startApp();
  try {
    const data = (await t.owner.get("/api/domain/aimesh-pro")).data;
    assert.equal(data.clientsKnown, true);
    assert.deepEqual(data.nodes.map((n) => [n.mac, n.ip, n.role, n.alias, n.backhaul, n.clients.length]), [
      ["04:D9:F5:12:34:50", "198.51.100.1", "router", "", null, 4],
      ["04:D9:F5:77:88:90", "198.51.100.2", "node", "Hallway node", null, 1],
    ]);
    assert.deepEqual(data.nodes[1].clients[0], { mac: "DC:A6:32:44:55:66", name: "printer", ip: "198.51.100.104", via: "5 GHz", rssi: -71 });
    assert.deepEqual(data.nodes[0].clients.map((c) => c.via).sort(), ["2.4 GHz", "5 GHz", "5 GHz", "wired"]);
    assert.deepEqual(data.entries.map((e) => [e.id, e.control, e.value, e.disabled]), [["aimesh-pro.priority", "select", "0", null]]);
  } finally {
    await t.stop();
  }
});

test("aimesh-pro: the parsers keep only well-formed rows and report what the firmware does not say", () => {
  const nvram = new Map([["cfg_clientlist", "<04:D9:F5:12:34:50>198.51.100.1>x>0<04:D9:F5:77:88:90>198.51.100.2>y>1>5G<not-a-mac>1>2>1<04:D9:F5:77:88:91>nonsense>z>1>wired"], ["cfg_alias", "<04:d9:f5:77:88:90>Study"]]);
  assert.deepEqual(readNodes(nvram).map((n) => [n.mac, n.ip, n.role, n.alias, n.backhaul]), [
    ["04:D9:F5:12:34:50", "198.51.100.1", "router", "", null],
    ["04:D9:F5:77:88:90", "198.51.100.2", "node", "Study", "5 GHz"],
    ["04:D9:F5:77:88:91", "", "node", "", "wired"],
  ]);
  assert.equal(readClients("not json"), null);
  const clients = readClients(JSON.stringify({ "04:D9:F5:12:34:50": { "5G": { "AA:BB:CC:00:00:01": { name: "x".repeat(200), ip: "evil", rssi: "5" } }, other: { "AA:BB:CC:00:00:02": {} } }, bogus: {} }));
  assert.deepEqual([...clients.keys()], ["04:D9:F5:12:34:50"]);
  assert.deepEqual(clients.get("04:D9:F5:12:34:50").map((c) => [c.name.length, c.ip, c.rssi]), [[64, "", null]], "long names are cut, bad addresses and positive signal values dropped");
  assert.throws(() => nodeCommand(nvram, "198.51.100.1", "reboot"), /not an AiMesh node/, "the main router is never a node target");
  assert.throws(() => nodeCommand(nvram, "198.51.100.9", "reboot"), /not an AiMesh node/);
});

test("aimesh-pro: a node can be named and the name goes through a reviewed preview", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/x/aimesh-pro/nodes/04%3AD9%3AF5%3A00%3A00%3A00/alias", { name: "Ghost" })).status, 404);
    assert.equal((await t.owner.post("/api/x/aimesh-pro/nodes/not-a-mac/alias", { name: "Ghost" })).status, 400);
    assert.equal((await t.owner.post("/api/x/aimesh-pro/nodes/04%3AD9%3AF5%3A77%3A88%3A90/alias", { name: "bad<name>" })).status, 400);
    const preview = await t.owner.post("/api/x/aimesh-pro/nodes/04%3AD9%3AF5%3A12%3A34%3A50/alias", { name: "Living room" });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await applyPreview(t, preview.data)).status, "applied");
    assert.equal(t.router.nvram.cfg_alias, "<04:D9:F5:77:88:90>Hallway node<04:D9:F5:12:34:50>Living room");
    const clear = await t.owner.post("/api/x/aimesh-pro/nodes/04%3AD9%3AF5%3A77%3A88%3A90/alias", { name: "" });
    assert.equal((await applyPreview(t, clear.data)).status, "applied");
    assert.equal(t.router.nvram.cfg_alias, "<04:D9:F5:12:34:50>Living room");
  } finally {
    await t.stop();
  }
});

test("aimesh-pro: the node light needs the hold button and sends one fixed command to a known node", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/actions/aimesh-pro.node-led", { ip: "198.51.100.2", off: true })).status, 403);
    assert.equal((await t.owner.post("/api/actions/aimesh-pro.node-led", { ip: "198.51.100.2", off: "yes", hold: true })).status, 400);
    assert.equal((await t.owner.post("/api/actions/aimesh-pro.node-led", { ip: "198.51.100.77", off: true, hold: true })).status, 404);
    assert.equal((await t.owner.post("/api/actions/aimesh-pro.node-led", { ip: "198.51.100.1", off: true, hold: true })).status, 404, "the main router is not a node");
    assert.deepEqual(t.router.nodeCommands ?? [], []);
    const out = await t.owner.post("/api/actions/aimesh-pro.node-led", { ip: "198.51.100.2", off: true, hold: true });
    assert.equal(out.status, 200, out.text);
    assert.deepEqual([out.data.ok, out.data.off], [true, true]);
    assert.deepEqual(t.router.nodeCommands, [{ user: "pat-router", ip: "198.51.100.2", remote: "nvram set AllLED=0; nvram commit; service restart_leds" }]);
  } finally {
    await t.stop();
  }
});

test("aimesh-pro: restarting a node is a super confirm: the model typed exactly and the hold button", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/actions/aimesh-pro.reboot-node", { ip: "198.51.100.2" })).data.code, "CONFIRM_MODEL");
    assert.equal((await t.owner.post("/api/actions/aimesh-pro.reboot-node", { ip: "198.51.100.2", confirm: "rt-ax86u", hold: true })).status, 403, "the model is case sensitive");
    assert.equal((await t.owner.post("/api/actions/aimesh-pro.reboot-node", { ip: "198.51.100.2", confirm: "RT-AX86U" })).data.code, "CONFIRM_HOLD");
    assert.deepEqual(t.router.nodeCommands ?? [], [], "nothing was sent before both keys were turned");
    const out = await t.owner.post("/api/actions/aimesh-pro.reboot-node", { ip: "198.51.100.2", confirm: "RT-AX86U", hold: true });
    assert.equal(out.status, 200, out.text);
    assert.equal(out.data.ok, true);
    assert.deepEqual(t.router.nodeCommands, [{ user: "pat-router", ip: "198.51.100.2", remote: "reboot" }]);
    assert.equal((await t.owner.post("/api/actions/aimesh-pro.reboot-node", { ip: "198.51.100.1", confirm: "RT-AX86U", hold: true })).status, 404, "the main router cannot be restarted from here");
  } finally {
    await t.stop();
  }
});

test("aimesh-pro: viewers can look but cannot act, and the browser module is well formed", async () => {
  assert.equal(checkFeatureModule(feature, "aimesh-pro"), null);
  const t = await startApp();
  try {
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/domain/aimesh-pro")).status, 200);
    assert.equal((await guest.post("/api/actions/aimesh-pro.reboot-node", { ip: "198.51.100.2", confirm: "RT-AX86U", hold: true })).status, 403);
    assert.ok((await t.owner.get("/api/features/manifest")).data.modules.includes("/js/features/aimesh-pro/index.js"));
  } finally {
    await t.stop();
  }
});
