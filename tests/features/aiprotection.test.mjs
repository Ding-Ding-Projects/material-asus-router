// Tests for the aiprotection feature: the protection switches (read, preview,
// apply, read back, undo), their gating by rc_support "bwdpi", and the router
// security scan with a real result for every item and queued fixes.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature, { queueFix } from "../../public/js/features/aiprotection/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { runScan } from "../../server/features/aiprotection/scan.mjs";
import { isSecretKey } from "../../server/router/secrets.mjs";
import { startApp, waitFor } from "../helpers.mjs";

async function settle(t, record) {
  if (record.status !== "guarded" && record.status !== "applying") return record;
  return waitFor(async () => {
    const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
    return next.status !== "guarded" && next.status !== "applying" ? next : null;
  });
}

async function change(t, changes) {
  const preview = await t.owner.post("/api/changes/preview", { changes });
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  const record = await settle(t, applied.data);
  assert.equal(record.status, "applied", JSON.stringify(record));
  return record;
}

const scan = async (t) => (await t.owner.get("/api/x/aiprotection/scan")).data;
const byId = (result, id) => result.items.find((i) => i.id === id);

test("aiprotection: the four switches read the router, apply, read back and undo", async () => {
  const t = await startApp();
  try {
    const entries = (await t.owner.get("/api/domain/aiprotection")).data.entries;
    assert.deepEqual(entries.map((e) => [e.id, e.key, e.control, e.value]), [
      ["aiprotection.enable", "wrs_protect_enable", "switch", "1"],
      ["aiprotection.sites", "wrs_mals_enable", "switch", "1"],
      ["aiprotection.ips", "wrs_vp_enable", "switch", "0"],
      ["aiprotection.infected", "wrs_cc_enable", "switch", "1"],
    ]);
    for (const e of entries) assert.equal(isSecretKey(e.key), false, `${e.key} must not be masked`);
    for (const e of entries) {
      const next = e.value === "1" ? "0" : "1";
      const record = await change(t, [{ id: e.id, value: next }]);
      assert.equal(t.router.nvram[e.key], next, `${e.id} applied`);
      assert.ok(t.router.services.includes("restart_wrs"), "the protection engine is restarted");
      assert.equal((await t.owner.get("/api/domain/aiprotection")).data.entries.find((x) => x.id === e.id).value, next, `${e.id} reads back`);
      const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
      assert.equal((await settle(t, (await t.owner.post("/api/changes/apply", { previewId: undo.data.id })).data)).status, "applied");
      assert.equal(t.router.nvram[e.key], e.value, `${e.id} undone`);
    }
  } finally {
    await t.stop();
  }
});

test("aiprotection: on a model without bwdpi the switches stay visible, disabled, with the reason", async () => {
  const t = await startApp();
  try {
    t.router.nvram.rc_support = "2.4G 5G usbX1";
    const catalog = (await t.owner.get("/api/catalog")).data;
    const mine = catalog.entries.filter((e) => e.feature === "aiprotection");
    assert.equal(mine.length, 4);
    for (const e of mine) {
      assert.ok(e.disabled?.en.includes("bwdpi"), `${e.id} says why it is disabled`);
      assert.ok(e.disabled.yue, `${e.id} has a Cantonese reason`);
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: e.id, value: "0" }] })).status, 400, `${e.id} refuses changes`);
    }
    const domain = (await t.owner.get("/api/domain/aiprotection")).data;
    assert.equal(domain.supported, false);
    assert.match(domain.reason.en, /bwdpi/);
    // The scan still works and says the engine items were not checked.
    const result = await scan(t);
    assert.equal(byId(result, "ai-wrs_mals_enable").status, "unknown");
    assert.equal(byId(result, "firewall").status, "pass");
  } finally {
    await t.stop();
  }
});

test("aiprotection: the scan gives a real result and evidence for every item", async () => {
  const t = await startApp();
  try {
    const result = await scan(t);
    assert.equal(result.model, "RT-AX86U");
    const ids = result.items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, "item ids are unique");
    for (const id of ["firewall", "remote-web", "ssh", "telnet", "upnp", "wps", "ping", "dos", "https", "admin-name", "ipv6-firewall", "wifi-0", "wifi-1", "ai-wrs_protect_enable", "ai-wrs_mals_enable", "ai-wrs_vp_enable", "ai-wrs_cc_enable"]) assert.ok(ids.includes(id), `${id} is in the scan`);
    for (const item of result.items) {
      assert.ok(["pass", "warn", "fail", "unknown"].includes(item.status), item.id);
      assert.ok(item.title.en && item.title.yue && item.detail.en && item.detail.yue, `${item.id} is bilingual`);
      assert.match(item.evidence, /\S/, `${item.id} shows what it read`);
    }
    assert.equal(result.counts.pass + result.counts.warn + result.counts.fail + result.counts.unknown, result.items.length);
    // The pretend router ships a mostly healthy setup: the one weak spot is flood protection being off.
    assert.deepEqual([byId(result, "firewall").status, byId(result, "dos").status, byId(result, "ai-wrs_vp_enable").status], ["pass", "warn", "warn"]);
    assert.equal(byId(result, "wifi-0").evidence, "wl0_auth_mode_x=psk2");
    assert.ok(result.score > 0 && result.score <= 100);
  } finally {
    await t.stop();
  }
});

test("aiprotection: the scan notices weak settings and offers a fix that goes through the change engine", async () => {
  const t = await startApp();
  try {
    Object.assign(t.router.nvram, { fw_enable_x: "0", misc_http_x: "1", sshd_enable: "1", telnetd_enable: "1", upnp_enable: "1", wps_enable: "1", wl0_auth_mode_x: "open", wl1_auth_mode_x: "psk", http_username: "admin", http_enable: "0" });
    const result = await scan(t);
    const status = (id) => byId(result, id).status;
    assert.deepEqual(["firewall", "remote-web", "ssh", "telnet"].map(status), ["fail", "fail", "fail", "fail"]);
    assert.deepEqual(["upnp", "wps", "wifi-1", "admin-name", "https"].map(status), ["warn", "warn", "warn", "warn", "warn"]);
    assert.equal(status("wifi-0"), "fail");
    assert.ok(result.counts.fail >= 5);
    assert.ok(result.score < 60);

    // Every non-passing item that can be fixed names the setting, the value and the current value.
    const fixes = result.items.filter((i) => i.status !== "pass" && i.fix);
    assert.ok(fixes.length >= 9);
    for (const { fix } of fixes) {
      assert.ok(fix.key && fix.value !== undefined && fix.label.en && fix.label.yue);
      assert.equal(fix.current, t.router.nvram[fix.key], "the fix carries the current value");
    }
    assert.equal(byId(result, "firewall").fix.value, "1");

    // Applying the fixes as one change, through preview and apply, makes those items pass.
    const record = await change(t, fixes.filter((i) => ["firewall", "remote-web", "telnet", "upnp"].includes(i.id)).map((i) => ({ key: i.fix.key, value: i.fix.value })));
    assert.equal(t.router.nvram.fw_enable_x, "1");
    assert.equal(t.router.nvram.telnetd_enable, "0");
    const after = await scan(t);
    assert.deepEqual(["firewall", "remote-web", "telnet", "upnp"].map((id) => byId(after, id).status), ["pass", "pass", "pass", "pass"]);
    assert.equal(byId(after, "ssh").status, "fail", "an item that was not fixed is still reported");
    assert.ok(record.canUndo);
  } finally {
    await t.stop();
  }
});

test("aiprotection: a setting the router does not report is unknown, never guessed", () => {
  const settings = new Map([["fw_enable_x", "1"], ["wl0_auth_mode_x", "psk2sae"]]);
  const result = runScan({ get: (k) => settings.get(k) ?? "", has: (k) => settings.has(k), bands: [{ index: 0, nband: "2" }, { index: 1, nband: "1" }], bwdpi: true });
  assert.equal(result.items.find((i) => i.id === "firewall").status, "pass");
  assert.equal(result.items.find((i) => i.id === "telnet").status, "unknown");
  assert.equal(result.items.find((i) => i.id === "wifi-0").status, "pass");
  assert.equal(result.items.find((i) => i.id === "wifi-1").status, "unknown");
  assert.equal(result.counts.pass, 2);
  assert.equal(result.score, 100, "unknown items are left out of the score");
  assert.equal(runScan({ get: () => "", has: () => false, bands: [], bwdpi: false }).score, null);
});

test("aiprotection: the scan route needs a session, is read-only for viewers and never writes", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/x/aiprotection/scan")).status, 401);
    const viewer = await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201, viewer.text);
    const guest = t.client();
    await guest.signIn("alex", "viewer password 1");
    const before = t.router.commands.length;
    assert.equal((await guest.get("/api/x/aiprotection/scan")).status, 200);
    assert.equal(t.router.commands.slice(before).some((c) => /nvram (set|commit|unset)|^service /.test(c)), false, "the scan changes nothing on the router");
    const preview = await guest.post("/api/changes/preview", { changes: [{ id: "aiprotection.sites", value: "0" }] });
    assert.equal((await guest.post("/api/changes/apply", { previewId: preview.data.id })).status, 403, "a viewer cannot change a protection");
    assert.equal(t.router.nvram.wrs_mals_enable, "1");
  } finally {
    await t.stop();
  }
});

test("aiprotection: the browser module is well formed and queues fixes in the dock", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/aiprotection/index.js"));
    assert.equal((await fetch(`${t.base}/js/features/aiprotection/index.js`)).status, 200);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "aiprotection"), null);
  assert.equal(feature.screens[0].id, "aiprotection");
  assert.deepEqual(feature.commands.map((c) => c.id), ["aiprotection.open", "aiprotection.scan"]);

  const calls = [];
  const dock = { setEntry: (entry, value) => calls.push(["entry", entry.id, value]), setRaw: (key, value, original) => calls.push(["raw", key, value, original]) };
  const ctx = { dock, state: { catalog: { entries: [{ id: "fw.enabled", key: "fw_enable_x" }, { id: "x.off", key: "gone", disabled: { en: "no" } }] } } };
  queueFix(ctx, { key: "fw_enable_x", value: "1", label: { en: "x" } });
  queueFix(ctx, { key: "telnetd_enable", value: "0", current: "1", label: { en: "x" } });
  queueFix(ctx, { key: "gone", value: "1", current: "0", label: { en: "x" } });
  assert.deepEqual(calls, [["entry", "fw.enabled", "1"], ["raw", "telnetd_enable", "0", "1"], ["raw", "gone", "1", "0"]]);
});
