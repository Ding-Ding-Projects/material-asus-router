import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { startApp, waitFor } from "./helpers.mjs";

async function change(t, body) {
  const preview = await t.owner.post("/api/changes/preview", body);
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  return { preview: preview.data, applied: applied.data };
}

test("a low-risk change previews, applies without a guard, and can be undone", async () => {
  const t = await startApp();
  try {
    const { preview, applied } = await change(t, { changes: [{ id: "qos.up", value: "25000" }, { id: "fw.ping", value: "1" }] });
    assert.equal(preview.maxRisk, "low");
    assert.equal(preview.guard.armed, false);
    assert.deepEqual(preview.items.map((i) => [i.key, i.old, i.new]), [["qos_obw", "20000", "25000"], ["misc_ping_x", "0", "1"]]);
    assert.deepEqual(preview.restarts.sort(), ["restart_firewall", "restart_qos"]);
    assert.equal(applied.status, "applied");
    assert.equal(t.router.nvram.qos_obw, "25000");
    assert.equal(t.router.committed.misc_ping_x, "1");
    assert.ok(t.router.services.includes("restart_qos"));
    assert.ok(!t.router.commands.some((c) => c.includes("/tmp/mar")), "no guard for low risk");
    assert.equal(applied.canUndo, true);

    const undoPreview = await t.owner.post(`/api/changes/${applied.id}/undo`);
    assert.equal(undoPreview.status, 200, undoPreview.text);
    assert.deepEqual(undoPreview.data.items.map((i) => [i.key, i.new]), [["qos_obw", "20000"], ["misc_ping_x", "0"]]);
    const undone = await t.owner.post("/api/changes/apply", { previewId: undoPreview.data.id });
    assert.equal(undone.data.status, "applied");
    assert.equal(t.router.nvram.qos_obw, "20000");
    assert.equal(t.router.nvram.misc_ping_x, "0");
    const history = (await t.owner.get("/api/changes/history")).data.items;
    assert.equal(history.length, 2);
    assert.equal(history.find((h) => h.id === applied.id).canUndo, false, "already undone");
    assert.equal((await t.owner.post(`/api/changes/${applied.id}/undo`)).status, 409);
  } finally {
    await t.stop();
  }
});

test("validation refuses bad values and previews expire or are single use", async () => {
  const t = await startApp();
  try {
    const bad = await t.owner.post("/api/changes/preview", { changes: [{ id: "dhcp.start", value: "300.1.1.1" }] });
    assert.equal(bad.status, 400);
    assert.match(bad.data.error, /IPv4/);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "qos.up", value: "20000" }] })).status, 400, "nothing would change");
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "wl0.ssid", value: "x\ny" }] })).status, 400);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ key: "productid", value: "x" }] })).status, 400, "protected key");
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ key: "bad key;rm", value: "x" }] })).status, 400);
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "qos.up", value: "21000" }] });
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 410, "single use");
  } finally {
    await t.stop();
  }
});

test("a change made behind the app's back is refused instead of overwritten", async () => {
  const t = await startApp();
  try {
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "qos.up", value: "21000" }] });
    t.router.nvram.qos_obw = "99";
    const res = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
    assert.equal(res.status, 409);
    assert.equal(t.router.nvram.qos_obw, "99");
  } finally {
    await t.stop();
  }
});

test("a network change arms the router-side guard first, then cancels it once the router answers", async () => {
  const t = await startApp();
  try {
    const { preview, applied } = await change(t, { changes: [{ id: "wl0.ssid", value: "Harbour Home 2" }] });
    assert.equal(preview.maxRisk, "network");
    assert.equal(preview.guard.armed, true);
    assert.equal(applied.status, "applied");
    const commands = t.router.commands;
    const armAt = commands.findIndex((c) => c.startsWith("mkdir -p /tmp/mar; printf '%s' '"));
    const setAt = commands.findIndex((c) => c === "nvram set wl0_ssid='Harbour Home 2'");
    assert.ok(armAt >= 0 && setAt > armAt, "guard armed before the first write");
    assert.match(commands[armAt], /\( trap '' HUP; sleep 30; sh \/tmp\/mar\/r-[0-9a-f-]+\.sh \) <\/dev\/null >\/dev\/null 2>&1 & echo \$!$/);
    const script = Buffer.from(commands[armAt].match(/printf '%s' '([^']+)'/)[1], "base64").toString();
    assert.match(script, /^nvram set wl0_ssid='Harbour Home'\nnvram commit\nservice restart_wireless\nrm -f /);
    assert.ok(commands.some((c) => /^kill \d+$/.test(c)), "the guard was cancelled");
    assert.equal(t.router.timers.size, 0, "no guard timer is left running");
    assert.equal(t.router.nvram.wl0_ssid, "Harbour Home 2");
    assert.equal(applied.guard.seconds, 30);
  } finally {
    await t.stop();
  }
});

test("when the router becomes unreachable the guard puts the old settings back and the app reports it", async () => {
  const t = await startApp({ guardScale: 0.1, guardSeconds: 30 });
  try {
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "lan.ip", value: "198.51.100.2" }] });
    assert.equal(preview.data.guard.armed, true);
    const started = Date.now();
    const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
    assert.equal(applied.status, 200, applied.text);
    assert.equal(applied.data.status, "guarded", "the router could not be reached after the change");
    assert.equal(t.router.reachable, false);
    const final = await waitFor(async () => {
      const record = (await t.owner.get(`/api/changes/history/${applied.data.id}`)).data;
      return record.status === "guarded" ? null : record;
    });
    assert.equal(final.status, "reverted-by-guard");
    assert.ok(Date.now() - started >= 2500, "the revert waited for the guard timer");
    assert.equal(t.router.nvram.lan_ipaddr, "198.51.100.1");
    assert.equal(t.router.reachable, true);
    assert.ok(t.router.revertedBy, "the router ran its own revert script");
    const catalog = await t.owner.get("/api/catalog");
    assert.equal(catalog.status, 200, "the app talks to the router again");
    assert.equal(catalog.data.entries.find((e) => e.id === "lan.ip").value, "198.51.100.1");
  } finally {
    await t.stop();
  }
});

test("secrets are masked in previews and history and stored only in the vault", async () => {
  const t = await startApp();
  try {
    const newPassword = "tea-and-toast-4-breakfast";
    const { preview, applied } = await change(t, { changes: [{ id: "wl0.password", value: newPassword }] });
    for (const view of [preview, applied, (await t.owner.get("/api/changes/history")).data]) {
      const text = JSON.stringify(view);
      assert.ok(!text.includes(newPassword) && !text.includes("milk-tea-and-egg-tarts"), "no secret in the response");
    }
    assert.equal(preview.items[0].secret, true);
    assert.equal(t.router.nvram.wl0_wpa_psk, newPassword);
    for (const file of ["state.json", "vault.json"]) {
      const text = await readFile(path.join(t.dir, file), "utf8");
      assert.ok(!text.includes(newPassword) && !text.includes("milk-tea-and-egg-tarts") && !text.includes("router-password"), `${file} holds no clear-text secret`);
    }
    const undo = await t.owner.post(`/api/changes/${applied.id}/undo`);
    await t.owner.post("/api/changes/apply", { previewId: undo.data.id });
    assert.equal(t.router.nvram.wl0_wpa_psk, "milk-tea-and-egg-tarts", "undo restores the secret from the vault");
  } finally {
    await t.stop();
  }
});

test("device, reservation, block and forwarding edits combine into list changes", async () => {
  const t = await startApp();
  try {
    const { applied } = await change(t, {
      ops: [
        { op: "rename", mac: "3c:22:fb:10:20:30", name: "Kitchen speaker" },
        { op: "reserve", mac: "DC:A6:32:44:55:66", ip: "198.51.100.150", hostname: "printer" },
        { op: "block", mac: "F0:18:98:AA:BB:01", name: "Pat's phone", blocked: true },
        { op: "forward-add", name: "Web", extPort: "8080", ip: "198.51.100.20", intPort: "80", proto: "TCP" },
      ],
    });
    assert.equal(applied.status, "applied");
    assert.match(t.router.nvram.custom_clientlist, /<Kitchen speaker>3C:22:FB:10:20:30>0>0>>/);
    assert.equal(t.router.nvram.dhcp_staticlist, "<B8:27:EB:11:22:33>198.51.100.20>>nas<DC:A6:32:44:55:66>198.51.100.150>>printer");
    assert.equal(t.router.nvram.MULTIFILTER_MAC, "F0:18:98:AA:BB:01");
    assert.equal(t.router.nvram.MULTIFILTER_ENABLE, "2");
    assert.equal(t.router.nvram.MULTIFILTER_DEVICENAME, "Pat's phone");
    assert.equal(t.router.nvram.vts_rulelist, "<Game server>25565>198.51.100.20>25565>TCP><Web>8080>198.51.100.20>80>TCP>");
    const devices = (await t.owner.get("/api/domain/devices")).data.devices;
    assert.equal(devices.find((d) => d.mac === "F0:18:98:AA:BB:01").blocked, true);
    assert.equal(devices.find((d) => d.mac === "3C:22:FB:10:20:30").name, "Kitchen speaker");
    assert.equal(devices.find((d) => d.mac === "DC:A6:32:44:55:66").reservedIp, "198.51.100.150");
    assert.equal((await t.owner.get("/api/domain/forwarding")).data.rules.length, 2);

    const second = await change(t, { ops: [{ op: "block", mac: "F0:18:98:AA:BB:01", blocked: false }, { op: "forward-remove", index: 0 }, { op: "unreserve", mac: "DC:A6:32:44:55:66" }] });
    assert.equal(second.applied.status, "applied");
    assert.equal(t.router.nvram.MULTIFILTER_MAC, "");
    assert.equal(t.router.nvram.vts_rulelist, "<Web>8080>198.51.100.20>80>TCP>");
    assert.equal(t.router.nvram.dhcp_staticlist, "<B8:27:EB:11:22:33>198.51.100.20>>nas");
  } finally {
    await t.stop();
  }
});

test("list edits refuse clashing or off-network addresses", async () => {
  const t = await startApp();
  try {
    const clash = await t.owner.post("/api/changes/preview", { ops: [{ op: "reserve", mac: "DC:A6:32:44:55:66", ip: "198.51.100.20" }] });
    assert.equal(clash.status, 409);
    const off = await t.owner.post("/api/changes/preview", { ops: [{ op: "reserve", mac: "DC:A6:32:44:55:66", ip: "203.0.113.5" }] });
    assert.equal(off.status, 400);
    const port = await t.owner.post("/api/changes/preview", { ops: [{ op: "forward-add", name: "x", extPort: "70000", ip: "198.51.100.20", proto: "TCP" }] });
    assert.equal(port.status, 400);
    assert.equal((await t.owner.post("/api/changes/preview", { ops: [{ op: "nope" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("Advanced raw edits are validated, guarded and shown with the key name", async () => {
  const t = await startApp();
  try {
    const { preview, applied } = await change(t, { changes: [{ key: "custom_note", value: "hello" }] });
    assert.equal(preview.items[0].added, true);
    assert.equal(preview.guard.armed, true);
    assert.equal(applied.status, "applied");
    assert.equal(t.router.nvram.custom_note, "hello");
    const undo = await t.owner.post(`/api/changes/${applied.id}/undo`);
    assert.equal(undo.data.items[0].removed, true);
    await t.owner.post("/api/changes/apply", { previewId: undo.data.id });
    assert.equal("custom_note" in t.router.nvram, false);
  } finally {
    await t.stop();
  }
});
