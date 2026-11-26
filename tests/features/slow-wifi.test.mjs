// "My Wi-Fi is slow": the checks find real problems in the router's settings
// and readings, every fix names catalogue settings the change engine accepts,
// a healthy router shows no problems, viewers may read, and the browser module
// queues fixes in the pending-changes dock instead of writing to the router.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { queueFix } from "../../public/js/features/slow-wifi/index.js";
import { LIMITS, diagnose } from "../../server/features/slow-wifi/checks.mjs";
import { parseAir, parseAssoc, parseLeadingNumber, parseStation } from "../../server/features/slow-wifi/read.mjs";
import { startApp } from "../helpers.mjs";

const band = (over = {}) => ({ index: 0, nband: "2", ifname: "eth6", band: "2.4 GHz", ssid: "Home", on: true, air: { busy: 20, otherNetworks: 5, nonWifi: 1 }, noise: -95, temperature: 50, devices: [], ...over });
const run = (bands, nvram = {}, usable = () => null) => diagnose({ reading: { bands, uptimeDays: 3 }, get: (k) => nvram[k], usable });
const ids = (findings) => findings.map((f) => f.id);

test("slow-wifi: the driver text is read, and a missing field is null", () => {
  assert.deepEqual(parseAir("chanspec tx inbss obss nocat nopkt doze txop\n0x1006 6 9 18 5 4 0 62\n"), { busy: 38, otherNetworks: 18, nonWifi: 5 });
  assert.equal(parseAir("wl: not enabled"), null);
  assert.equal(parseLeadingNumber("48 (0x30)"), 48);
  assert.equal(parseLeadingNumber("nope"), null);
  assert.deepEqual(parseAssoc("assoclist aa:bb:cc:dd:ee:01\njunk\n"), ["AA:BB:CC:DD:EE:01"]);
  assert.deepEqual(parseStation("\t smoothed rssi: -71\n\t rate of last tx pkt: 72200 kbps - 65000 kbps\n"), { rssi: -71, linkMbps: 72.2 });
  assert.deepEqual(parseStation(""), { rssi: null, linkMbps: null });
});

test("slow-wifi: each check fires on its condition, with the right fix", () => {
  const five = band({ index: 1, nband: "1", ifname: "eth7", band: "5 GHz" });
  assert.deepEqual(run([band(), five], { wl0_bw: "1", wl1_bw: "0", wl0_txpower: "100", wl1_txpower: "100" }), [], "a healthy router has nothing to say");

  const bad = run([band(), five], { wl0_nmode_x: "2", wl0_crypto: "tkip+aes", wl0_auth_mode_x: "psk2", wl0_txpower: "30", wl1_bw: "2", wl1_11ax: "0", ctf_disable_force: "1" });
  assert.deepEqual(new Set(ids(bad)), new Set(["wl0.legacy", "wl0.tkip", "wl0.low-power", "wl1.narrow", "wl1.ax-off", "router.acceleration-off"]));
  assert.ok(bad.every((f) => f.kind === "problem"));
  assert.deepEqual(bad.find((f) => f.id === "wl0.tkip").fix.changes, [{ id: "wifi-pro.wl0.crypto", value: "aes" }]);
  assert.deepEqual(bad.find((f) => f.id === "wl1.narrow").fix.changes, [{ id: "wl1.width", value: "0" }]);
  assert.equal(bad[0].severity, 3, "the worst problems come first");

  assert.deepEqual(ids(run([band(), five], { wl0_crypto: "tkip+aes", wl0_auth_mode_x: "psk2sae" })), [], "WPA3 always uses AES, so the TKIP check is quiet");

  const off = run([band({ on: false }), five], {});
  assert.deepEqual(off.find((f) => f.id === "wl0.radio-off").fix.changes, [{ id: "wl0.radio", value: "1" }]);

  const crowded = run([band({ air: { busy: 80, otherNetworks: 40, nonWifi: 2 } })], { wl0_bw: "2", wl0_chanspec: "0" });
  assert.deepEqual(crowded.find((f) => f.id === "wl0.wide-crowded").fix.changes, [{ id: "wl0.width", value: "1" }]);
  const busy = crowded.find((f) => f.id === "wl0.busy-air");
  assert.equal(busy.kind, "problem");
  assert.deepEqual(busy.fix.action.name, "wifi-diagnostics.acs", "an automatic channel gets a fresh channel search");
  const pinned = run([band({ air: { busy: 75, otherNetworks: 10, nonWifi: 2 } })], { wl0_chanspec: "6" });
  assert.deepEqual(pinned.find((f) => f.id === "wl0.fixed-busy").fix.changes, [{ id: "wl0.channel", value: "0" }]);

  const devices = [{ mac: "AA:AA:AA:AA:AA:01", name: "tablet", rssi: -82, linkMbps: 6 }, { mac: "AA:AA:AA:AA:AA:02", name: "", rssi: -50, linkMbps: 11 }];
  const mixed = run([band({ devices, noise: -76, air: { busy: 30, otherNetworks: 5, nonWifi: 20 }, temperature: 92 })], { wl0_atf: "0", wl0_mumimo: "0", wl0_txbf: "1", "wl0.1_bss_enabled": "1", "wl0.2_bss_enabled": "1" });
  assert.deepEqual(new Set(ids(mixed)), new Set(["wl0.weak", "wl0.slow-devices", "wl0.interference", "wl0.hot", "wl0.helpers-off", "wl0.many-networks"]));
  assert.match(mixed.find((f) => f.id === "wl0.weak").evidence.en, /tablet.*-82 dBm/);
  assert.deepEqual(mixed.find((f) => f.id === "wl0.slow-devices").fix.changes, [{ id: "wifi-pro.wl0.atf", value: "1" }]);
  assert.deepEqual(mixed.find((f) => f.id === "wl0.helpers-off").fix.changes, [{ id: "wifi-pro.wl0.mumimo", value: "1" }]);
  assert.equal(mixed.find((f) => f.id === "wl0.hot").kind, "problem");

  const qos = run([band()], { qos_enable: "1", qos_type: "0", qos_ibw: "50000" });
  assert.match(qos[0].title.en, /about 50 Mbps/);
  assert.equal(run([band()], { qos_enable: "1", qos_type: "2" })[0].fix.changes[0].id, "qos.enabled");
  assert.equal(diagnose({ reading: { bands: [band()], uptimeDays: LIMITS.longUptimeDays }, get: () => undefined, usable: () => null })[0].id, "router.uptime");

  const blocked = run([band()], { wl0_nmode_x: "2" }, () => ({ en: "This router does not have the setting wl0_nmode_x", yue: "冇" }));
  assert.equal(blocked[0].fix, null, "a fix is never offered for a setting the router lacks");
  assert.match(blocked[0].fixBlocked.en, /does not have/);
});

test("slow-wifi: the screen reads the pretend router, and every fix goes through the change engine", async () => {
  const t = await startApp();
  try {
    const healthy = await t.owner.get("/api/domain/slow-wifi");
    assert.equal(healthy.status, 200, healthy.text);
    assert.equal(healthy.data.counts.problems, 0, JSON.stringify(healthy.data.findings.map((f) => f.id)));
    assert.equal(healthy.data.bands.length, 2);
    assert.equal(healthy.data.bands[0].busy, 38, "the air reading comes from the radio");
    assert.ok(healthy.data.always.length >= 3);

    Object.assign(t.router.nvram, { wl0_nmode_x: "2", wl0_crypto: "tkip+aes", wl0_txpower: "40", wl1_bw: "1", ctf_disable_force: "1" });
    const data = (await t.owner.get("/api/domain/slow-wifi")).data;
    assert.deepEqual(new Set(data.findings.filter((f) => f.kind === "problem").map((f) => f.id)), new Set(["wl0.legacy", "wl0.tkip", "wl0.low-power", "wl1.narrow", "router.acceleration-off"]));
    const changes = data.findings.flatMap((f) => f.fix?.changes ?? []);
    assert.equal(changes.length, 5);
    const catalog = (await t.owner.get("/api/catalog")).data.entries;
    for (const c of changes) assert.ok(catalog.some((e) => e.id === c.id && !e.disabled), `${c.id} is a usable catalogue setting`);
    const preview = await t.owner.post("/api/changes/preview", { changes });
    assert.equal(preview.status, 200, preview.text);
    assert.equal(t.router.nvram.wl0_crypto, "tkip+aes", "a check never writes to the router");
    assert.ok(!t.router.commands.some((c) => c.startsWith("nvram set")));

    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201, viewer.text);
    const guest = t.client();
    assert.equal((await guest.signIn("vi", "viewer password 1")).status, 200);
    assert.equal((await guest.get("/api/domain/slow-wifi")).status, 200, "viewers may read the check");
  } finally {
    await t.stop();
  }
});

test("slow-wifi: the browser module is well formed and a fix only fills the dock", async () => {
  assert.equal(checkFeatureModule(feature, "slow-wifi"), null);
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/slow-wifi/index.js"));
  } finally {
    await t.stop();
  }
  const queued = [];
  const ctx = { state: { catalog: { entries: [{ id: "wl1.width", value: "1" }, { id: "ports.ctf", value: "1", disabled: { en: "no", yue: "冇" } }] } }, dock: { setEntry: (entry, value) => queued.push([entry.id, value]) } };
  const out = queueFix(ctx, { fix: { changes: [{ id: "wl1.width", value: "0" }, { id: "ports.ctf", value: "0" }, { id: "nope", value: "1" }] } });
  assert.deepEqual(queued, [["wl1.width", "0"]]);
  assert.deepEqual(out, { queued: 1, missing: ["ports.ctf", "nope"] });
});
