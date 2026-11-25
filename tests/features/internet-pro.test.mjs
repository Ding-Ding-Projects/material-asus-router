// Internet Pro: the WAN connection settings read the router's real values,
// change through the change engine (preview, apply, read back, undo), refuse
// wrong values, and the screen's routes, actions and browser module work.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/internet-pro/index.js";
import { startApp, waitFor } from "../helpers.mjs";

const settle = async (t, record) =>
  record.status === "guarded" || record.status === "applying"
    ? waitFor(async () => {
        const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
        return next.status !== "guarded" && next.status !== "applying" ? next : null;
      })
    : record;

async function change(t, changes) {
  const preview = await t.owner.post("/api/changes/preview", { changes });
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  const record = await settle(t, applied.data);
  assert.equal(record.status, "applied");
  return record;
}

async function undo(t, record) {
  const preview = await t.owner.post(`/api/changes/${record.id}/undo`);
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal((await settle(t, applied.data)).status, "applied");
}

const mine = async (t) => (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "internet-pro");

// Every showWhen rule must name an entry of this feature and values that entry can really hold.
function rulesAreReal(entries) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const entry of entries) {
    const rule = entry.meta?.showWhen;
    if (!rule) continue;
    for (const r of (Array.isArray(rule) ? rule.flat() : [rule])) {
      const target = byId.get(r.id);
      assert.ok(target, `${entry.id}: showWhen names ${r.id}, which is not an entry`);
      const allowed = target.options ? target.options.map(([v]) => v) : target.values ? [target.values.on, target.values.off] : null;
      if (allowed) for (const value of r.in) assert.ok(allowed.includes(value), `${entry.id}: showWhen expects ${r.id} to be "${value}", which it cannot be`);
    }
  }
}

test("internet-pro: every connection type, its fields and the VLAN settings are in the catalogue and read the router", async () => {
  const t = await startApp();
  try {
    const entries = await mine(t);
    assert.ok(entries.length >= 30, `only ${entries.length} entries`);
    const proto = entries.find((e) => e.id === "internet-pro.proto");
    assert.deepEqual(proto.options.map(([v]) => v), ["dhcp", "static", "pppoe", "pptp", "l2tp"]);
    assert.equal(proto.value, "dhcp");
    const mask = entries.find((e) => e.id === "internet-pro.mask");
    assert.ok(mask.options.some(([v]) => v === "255.255.255.252") && mask.options.every(([, label]) => /\/\d+/.test(label.en)), "masks show their prefix length");
    const password = entries.find((e) => e.id === "internet-pro.password");
    assert.equal(password.secret, true);
    assert.equal(password.value, "", "the password is never sent to the browser");
    for (const id of ["clone", "hostname", "client-id", "vendor-id", "query", "profile", "stb", "vlan-internet", "vlan-iptv", "vlan-voip", "prio-iptv", "mtu", "pppoe-mtu", "pppoe-mru", "server", "pptp-crypto"])
      assert.ok(entries.some((e) => e.id === `internet-pro.${id}`), `${id} is missing`);
    // A free text box is only used where the value really is free text, and says why.
    for (const e of entries.filter((x) => x.control === "text")) assert.ok(e.freeText && e.freeTextReason.length > 10, e.id);
    assert.equal(entries.find((e) => e.id === "internet-pro.clone").control, "device", "MAC clone picks from known devices");
    rulesAreReal(entries);

    const domain = (await t.owner.get("/api/domain/internet-pro")).data;
    assert.equal(domain.wan.connected, true);
    assert.equal(domain.wan.proto, "dhcp");
    assert.equal(domain.wan.ip, "100.64.12.34");
    assert.deepEqual(domain.wan.dns, ["1.1.1.1", "8.8.8.8"]);
    assert.equal(domain.entries.length, entries.length);
  } finally {
    await t.stop();
  }
});

test("internet-pro: a PPPoE login changes through the engine, the password stays hidden and undo restores everything", async () => {
  const t = await startApp();
  try {
    const record = await change(t, [
      { id: "internet-pro.proto", value: "pppoe" },
      { id: "internet-pro.user", value: "pat@isp.example" },
      { id: "internet-pro.password", value: "a long provider password" },
      { id: "internet-pro.pppoe-mtu", value: "1480" },
      { id: "internet-pro.idle", value: "600" },
    ]);
    assert.deepEqual([t.router.nvram.wan0_proto, t.router.nvram.wan0_pppoe_username, t.router.nvram.wan0_pppoe_passwd, t.router.nvram.wan0_pppoe_mtu, t.router.nvram.wan0_pppoe_idletime], ["pppoe", "pat@isp.example", "a long provider password", "1480", "600"]);
    assert.ok(t.router.services.includes("restart_wan_if 0"), "the connection is restarted");
    const after = (await mine(t)).find((e) => e.id === "internet-pro.password");
    assert.equal(after.value, "");
    assert.equal(after.masked, true);
    assert.ok(!JSON.stringify((await t.owner.get("/api/changes/history")).data).includes("a long provider password"), "the history never shows the password");
    await undo(t, record);
    assert.deepEqual([t.router.nvram.wan0_proto, t.router.nvram.wan0_pppoe_username, t.router.nvram.wan0_pppoe_passwd, t.router.nvram.wan0_pppoe_mtu], ["dhcp", "", "", "1492"]);
  } finally {
    await t.stop();
  }
});

test("internet-pro: a fixed address, MAC clone, VLAN profile and IPTV port are written and read back", async () => {
  const t = await startApp();
  try {
    await change(t, [
      { id: "internet-pro.proto", value: "static" },
      { id: "internet-pro.ip", value: "203.0.113.50" },
      { id: "internet-pro.mask", value: "255.255.255.248" },
      { id: "internet-pro.gateway", value: "203.0.113.49" },
      { id: "internet-pro.clone", value: "aa:bb:cc:00:11:22" },
      { id: "internet-pro.profile", value: "manual" },
      { id: "internet-pro.stb", value: "4" },
      { id: "internet-pro.vlan-iptv", value: "600" },
      { id: "internet-pro.prio-iptv", value: "5" },
    ]);
    assert.equal(t.router.nvram.wan0_ipaddr_x, "203.0.113.50");
    assert.equal(t.router.nvram.wan0_netmask_x, "255.255.255.248");
    assert.equal(t.router.nvram.wan0_hwaddr_x, "AA:BB:CC:00:11:22", "a MAC address is stored in upper case");
    assert.deepEqual([t.router.nvram.switch_wantag, t.router.nvram.switch_stb_x, t.router.nvram.switch_wan1tagid, t.router.nvram.switch_wan1prio], ["manual", "4", "600", "5"]);
    assert.ok(t.router.services.includes("restart_net_and_phy"));
    const read = await mine(t);
    assert.equal(read.find((e) => e.id === "internet-pro.ip").value, "203.0.113.50");
  } finally {
    await t.stop();
  }
});

test("internet-pro: wrong values are refused before anything is written", async () => {
  const t = await startApp();
  try {
    const refuse = async (id, value) => assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id, value }] })).status, 400, `${id} = ${value} should be refused`);
    await refuse("internet-pro.proto", "carrier-pigeon");
    await refuse("internet-pro.ip", "203.0.113.999");
    await refuse("internet-pro.mask", "255.0.255.0");
    await refuse("internet-pro.clone", "not-a-mac");
    await refuse("internet-pro.mtu", "100");
    await refuse("internet-pro.pppoe-mtu", "1500");
    await refuse("internet-pro.vlan-internet", "5000");
    await refuse("internet-pro.prio-voip", "8");
    await refuse("internet-pro.password", "");
    await refuse("internet-pro.user", "<script>");
    assert.equal(t.router.nvram.wan0_proto, "dhcp");
  } finally {
    await t.stop();
  }
});

test("internet-pro: Merlin-only items are visible but disabled on the stock firmware, with the reason", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const spoof = (await mine(t)).find((e) => e.id === "internet-pro.ttl-spoof");
    assert.ok(spoof.disabled?.en.includes("Merlin"), "the reason names Merlin");
    assert.ok(spoof.disabled.yue.length > 5);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "internet-pro.ttl-spoof", value: "1" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("internet-pro: the MTU finder, the VLAN profile route and the reconnect action work and respect roles", async () => {
  const t = await startApp();
  try {
    const probe = await t.owner.post("/api/x/internet-pro/mtu-probe", { target: "203.0.113.9" });
    assert.equal(probe.status, 200, probe.text);
    assert.equal(probe.data.mtu, 1464 + 28, "the pretend line carries 1464 bytes of payload");
    assert.deepEqual(probe.data.tried.map((x) => x.ok), [false, true]);
    assert.ok(t.router.commands.includes("ping -c 1 -W 2 -M do -s 1472 203.0.113.9"));
    assert.equal((await t.owner.post("/api/x/internet-pro/mtu-probe", { target: "bad host; reboot" })).status, 400, "a target is checked before it reaches the shell");
    assert.ok(!t.router.rebooted);

    assert.deepEqual((await t.owner.get("/api/x/internet-pro/profile/unifi_home")).data, { name: "unifi_home", internet: 500, iptv: 600 });
    assert.equal((await t.owner.get("/api/x/internet-pro/profile/unknown")).status, 404);

    const reconnect = await t.owner.post("/api/actions/internet-pro.reconnect");
    assert.equal(reconnect.status, 200, reconnect.text);
    assert.equal(reconnect.data.ok, true);
    assert.ok(t.router.services.includes("restart_wan_if 0"));

    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201, viewer.text);
    const guest = t.client();
    assert.equal((await guest.signIn("vi", "viewer password 1")).status, 200);
    assert.equal((await guest.get("/api/domain/internet-pro")).status, 200, "viewers may read");
    assert.equal((await guest.post("/api/x/internet-pro/mtu-probe", {})).status, 403);
    assert.equal((await guest.post("/api/actions/internet-pro.reconnect")).status, 403);
    assert.equal((await t.client().get("/api/domain/internet-pro")).status, 401);
  } finally {
    await t.stop();
  }
});

test("internet-pro: the browser module is well formed and the manifest lists it", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/internet-pro/index.js"));
    for (const url of ["/js/features/internet-pro/index.js", "/js/features/internet-pro/view.js"]) assert.equal((await fetch(t.base + url)).status, 200);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "internet-pro"), null);
  assert.equal(feature.screens[0].id, "internet-pro");
  assert.ok(feature.commands.length >= 1, "the command palette can reconnect");
});
