// Dual WAN: the mode, ports, load balance, connection check and second
// connection settings read the router's real values and change through the
// change engine. Options that depend on the model follow its capabilities.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/dual-wan/index.js";
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

const mine = async (t) => (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "dual-wan");

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

test("dual-wan: the settings read the router, and the modes follow what the model has", async () => {
  const t = await startApp();
  try {
    const entries = await mine(t);
    const mode = entries.find((e) => e.id === "dual-wan.mode");
    assert.equal(mode.value, "wan none");
    assert.deepEqual(mode.options.map(([v]) => v), ["wan none", "wan lan", "lan wan", "wan usb", "usb wan"], "this pretend router has a USB port, so USB modem modes are offered");
    for (const id of ["policy", "lan-port", "ratio", "routing-rules", "check", "target", "interval", "max-fail", "switch-delay", "fb-count", "fb-delay", "wan1-enable", "wan1-proto", "wan1-ip", "wan1-mask", "wan1-gateway", "wan1-clone", "wan1-mtu"])
      assert.ok(entries.some((e) => e.id === `dual-wan.${id}`), `${id} is missing`);
    assert.equal(entries.find((e) => e.id === "dual-wan.wan1-clone").control, "device");
    rulesAreReal(entries);

    const domain = (await t.owner.get("/api/domain/dual-wan")).data;
    assert.equal(domain.enabled, false);
    assert.equal(domain.wans[0].connected, true);
    assert.equal(domain.wans[0].ip, "100.64.12.34");
    assert.equal(domain.wans[1].state, "off");
  } finally {
    await t.stop();
  }
});

test("dual-wan: a load balance setup is written, read back and undone", async () => {
  const t = await startApp();
  try {
    const record = await change(t, [
      { id: "dual-wan.mode", value: "wan lan" },
      { id: "dual-wan.lan-port", value: "3" },
      { id: "dual-wan.policy", value: "lb" },
      { id: "dual-wan.ratio", value: "3:2" },
      { id: "dual-wan.routing-rules", value: "1" },
      { id: "dual-wan.interval", value: "10" },
      { id: "dual-wan.target", value: "203.0.113.20" },
      { id: "dual-wan.wan1-proto", value: "static" },
      { id: "dual-wan.wan1-ip", value: "203.0.113.30" },
      { id: "dual-wan.wan1-gateway", value: "203.0.113.1" },
    ]);
    assert.deepEqual([t.router.nvram.wans_dualwan, t.router.nvram.wans_lanport, t.router.nvram.wans_mode, t.router.nvram.wans_lb_ratio, t.router.nvram.wandog_interval], ["wan lan", "3", "lb", "3:2", "10"]);
    assert.ok(t.router.services.includes("restart_dualwan"));
    assert.equal((await t.owner.get("/api/domain/dual-wan")).data.enabled, true);
    const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
    const applied = await t.owner.post("/api/changes/apply", { previewId: undo.data.id });
    assert.equal((await settle(t, applied.data)).status, "applied");
    assert.deepEqual([t.router.nvram.wans_dualwan, t.router.nvram.wans_mode, t.router.nvram.wans_lb_ratio], ["wan none", "fo", "3:1"]);
  } finally {
    await t.stop();
  }
});

test("dual-wan: wrong values are refused", async () => {
  const t = await startApp();
  try {
    const refuse = async (id, value) => assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id, value }] })).status, 400, `${id} = ${value}`);
    await refuse("dual-wan.mode", "wan wan");
    await refuse("dual-wan.policy", "random");
    await refuse("dual-wan.ratio", "9:9");
    await refuse("dual-wan.lan-port", "7");
    await refuse("dual-wan.interval", "0");
    await refuse("dual-wan.max-fail", "500");
    await refuse("dual-wan.wan1-ip", "203.0.113.300");
    await refuse("dual-wan.target", "not a host!");
  } finally {
    await t.stop();
  }
});

test("dual-wan: a router without a USB port is not offered USB modem modes", async () => {
  const t = await startApp();
  try {
    t.router.nvram.rc_support = "2.4G 5G amas";
    await t.app.session.catalog({ fresh: true });
    const mode = (await mine(t)).find((e) => e.id === "dual-wan.mode");
    assert.deepEqual(mode.options.map(([v]) => v), ["wan none", "wan lan", "lan wan"]);
  } finally {
    await t.stop();
  }
});

test("dual-wan: the status route, the target probe and roles work", async () => {
  const t = await startApp();
  try {
    const status = (await t.owner.get("/api/x/dual-wan/status")).data;
    assert.equal(status.wans.length, 2);
    assert.equal(status.mode, "wan none");

    const probe = await t.owner.post("/api/actions/dual-wan.probe", {});
    assert.equal(probe.status, 200, probe.text);
    assert.deepEqual([probe.data.ok, probe.data.target], [true, "203.0.113.9"]);
    assert.ok(t.router.commands.includes("ping -c 2 -W 2 203.0.113.9"));
    const named = await t.owner.post("/api/actions/dual-wan.probe", { target: "bad host; reboot" });
    assert.equal(named.data.ok, false, "a target that is not a host name or address is not sent to the router");
    assert.ok(!t.router.rebooted);

    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201, viewer.text);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/x/dual-wan/status")).status, 200);
    assert.equal((await guest.post("/api/actions/dual-wan.probe", {})).status, 403);
  } finally {
    await t.stop();
  }
});

test("dual-wan: the browser module is well formed and the manifest lists it", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/dual-wan/index.js"));
    assert.ok(manifest.styles.includes("/js/features/dual-wan/style.css"));
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "dual-wan"), null);
});
