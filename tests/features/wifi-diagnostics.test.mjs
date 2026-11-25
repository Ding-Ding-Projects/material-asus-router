// Wi-Fi diagnostics: the driver text is parsed, the client table and the
// busiest-devices ranking come from real counters read twice, the radio gauges
// say "unavailable" when the radio will not answer, disconnecting a device and
// re-running automatic channel selection need their confirmations, and the
// settings go through the change engine.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/wifi-diagnostics/index.js";
import { bytesPerSecond, parseAssoc, parseChanim, parseDfs, parseNumber, parseStaInfo, quality, rank } from "../../server/features/wifi-diagnostics/parse.mjs";
import { startApp } from "../helpers.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STA = `[VER 4] STA 3C:22:FB:10:20:30:\n\t aid:1\n\t idle 3 seconds\n\t in network 4321 seconds\n\t state: AUTHENTICATED ASSOCIATED AUTHORIZED\n\t tx total bytes: 123456\n\t tx failures: 2\n\t rx data bytes: 654321\n\t smoothed rssi: -61\n\t rate of last tx pkt: 866700 kbps - 780000 kbps\n`;

test("wifi-diagnostics: the driver's text is parsed and a missing field is null, never a guess", () => {
  assert.deepEqual(parseAssoc("assoclist AA:BB:CC:DD:EE:01\nassoclist aa:bb:cc:dd:ee:02\nnoise\n"), ["AA:BB:CC:DD:EE:01", "AA:BB:CC:DD:EE:02"]);
  const sta = parseStaInfo(STA);
  assert.deepEqual([sta.txBytes, sta.rxBytes, sta.rssi, sta.txKbps, sta.rxKbps, sta.connected, sta.idle, sta.failures, sta.authorized], [123456, 654321, -61, 866700, 780000, 4321, 3, 2, true]);
  const empty = parseStaInfo("nothing useful");
  assert.equal(empty.txBytes, null);
  assert.equal(empty.rssi, null);
  const air = parseChanim("chanspec tx inbss obss nocat nopkt doze txop goodtx badtx glitch badplcp knoise timestamp\n0x1006 6 9 18 5 4 0 62 9 1 220 40 -92 1\n");
  assert.deepEqual([air.busy, air.own, air.otherNetworks, air.noiseFloor], [38, 6, 18, -92]);
  assert.equal(parseChanim("wl: not enabled"), null);
  assert.equal(parseNumber("-92\n"), -92);
  assert.equal(parseNumber("48 (0x30)"), 48);
  assert.equal(parseNumber("garbage"), null);
  const dfs = parseDfs("state In-Service Check(CAC) time elapsed 1500 ms radar channel 52 channel switch 0");
  assert.deepEqual([dfs.state, dfs.elapsedMs, dfs.radarChannel, dfs.checking, dfs.idle], ["In-Service Check(CAC)", 1500, 52, true, false]);
  assert.equal(parseDfs("state IDLE time elapsed 5 ms radar channel 0").idle, true);
  assert.equal(parseDfs("nonsense"), null);
  assert.equal(bytesPerSecond(100, 600, 2), 250);
  assert.equal(bytesPerSecond(600, 100, 2), null, "a counter that went down means the device rejoined");
  assert.equal(bytesPerSecond(null, 5, 1), null);
  assert.equal(quality(-30), 100);
  assert.equal(quality(-90), 0);
  assert.equal(quality(-60), 50);
  const rows = [{ mac: "A", downBps: 10, upBps: 90 }, { mac: "B", downBps: 80, upBps: 5 }, { mac: "C", downBps: null, upBps: null }];
  assert.deepEqual(rank(rows, "down").map((r) => r.mac), ["B", "A"]);
  assert.deepEqual(rank(rows, "up").map((r) => r.mac), ["A", "B"]);
  assert.deepEqual(rank(rows, "total", 1).map((r) => r.mac), ["A"], "unmeasured devices are left out and the count is honoured");
});

test("wifi-diagnostics: the client table shows signal, rate and band for every device on every network", async () => {
  const t = await startApp();
  try {
    const first = (await t.owner.get("/api/x/wifi-diagnostics/clients")).data;
    assert.equal(first.warming, true, "the first reading has no speed yet");
    assert.equal(first.clients.length, 4);
    assert.ok(first.networks.some((n) => n.band === "2.4 GHz" && n.clients === 2));
    assert.ok(first.networks.some((n) => n.band === "5 GHz" && n.clients === 2));
    const tv = first.clients.find((c) => c.mac === "AC:5A:F0:01:02:03");
    assert.equal(tv.name, "Living room TV", "a name given on the Devices screen wins");
    assert.equal(tv.band, "5 GHz");
    assert.equal(tv.network, "Harbour Home 5G");
    assert.equal(tv.rssi, -48);
    assert.equal(tv.txMbps, 1201);
    assert.equal(tv.rxMbps, 960.7);
    assert.equal(tv.connected, 93000);
    assert.equal(tv.downBps, null);
    assert.equal(first.clients.find((c) => c.name === "kitchen-speaker").band, "2.4 GHz");
    assert.equal(first.clients.find((c) => c.name === "printer").weak, false, "-71 dBm is above the default weak line of -75");
    assert.equal(first.clients.every((c) => c.quality > 0), true);
  } finally {
    await t.stop();
  }
});

test("wifi-diagnostics: the busiest devices are ranked by real counters and can be ranked three ways", async () => {
  const t = await startApp();
  try {
    await t.owner.get("/api/x/wifi-diagnostics/top?force=1");
    await sleep(1300);
    const total = (await t.owner.get("/api/x/wifi-diagnostics/top?force=1")).data;
    assert.equal(total.warming, false);
    assert.equal(total.by, "total");
    const tv = total.rows.find((r) => r.mac === "AC:5A:F0:01:02:03");
    assert.ok(Math.abs(tv.downBps - 4_200_000) / 4_200_000 < 0.35, `the television downloads about 4.2 MB/s, saw ${tv.downBps}`);
    assert.equal(total.rows[0].mac, "AC:5A:F0:01:02:03", "the television is the busiest overall");
    const down = (await t.owner.get("/api/x/wifi-diagnostics/top?by=down&force=1")).data;
    assert.equal(down.rows[0].name, "Living room TV");
    const up = (await t.owner.get("/api/x/wifi-diagnostics/top?by=up&force=1")).data;
    assert.equal(up.rows[0].name, "Pats-iPhone", "the phone is uploading the most");
    assert.ok(up.rows[0].upBps > up.rows[1].upBps);
    assert.ok(up.rows[0].shareUp > 50 && up.rows[0].shareUp <= 100);
    assert.ok(down.rows.reduce((sum, r) => sum + r.shareDown, 0) <= 100.5);
    assert.ok(down.totals.downBps > 4_000_000);
    assert.equal(down.totals.clients, 4);
    assert.ok(down.rows[0].downTotal > 0, "totals since the app started watching grow");
    assert.ok(down.networks.length === 2 && down.networks[0].band === "5 GHz", "the busier network comes first");
    assert.equal((await t.owner.get("/api/x/wifi-diagnostics/top?count=2&force=1")).data.rows.length, 2);
    assert.ok(down.rows.every((r) => Array.isArray(r.trail)));
  } finally {
    await t.stop();
  }
});

test("wifi-diagnostics: the radio gauges read noise, busy air, radar state and temperature, and say so when a radio will not answer", async () => {
  const t = await startApp();
  try {
    const { radios } = (await t.owner.get("/api/x/wifi-diagnostics/radios")).data;
    const two = radios.find((r) => r.band === "2.4 GHz");
    const five = radios.find((r) => r.band === "5 GHz");
    assert.deepEqual([two.noise, two.air.busy, two.temperature, two.dfsApplies, two.dfs], [-92, 38, 48, false, null]);
    assert.deepEqual([five.noise, five.air.busy, five.temperature, five.dfsApplies, five.dfs.state, five.dfs.idle], [-95, 15, 53, true, "IDLE", true]);
    assert.equal(five.autoChannel, true);
    assert.deepEqual(two.unavailable, []);
    t.router.wlDiag.chanimOff.add("eth6");
    t.router.wlDiag.dfs = "state In-Service Check(CAC) time elapsed 20000 ms radar channel 100 channel switch 1\n";
    const again = (await t.owner.get("/api/x/wifi-diagnostics/radios")).data.radios;
    assert.deepEqual(again.find((r) => r.band === "2.4 GHz").unavailable, ["air"]);
    assert.equal(again.find((r) => r.band === "2.4 GHz").air, null);
    const dfs = again.find((r) => r.band === "5 GHz").dfs;
    assert.deepEqual([dfs.checking, dfs.radarChannel], [true, 100]);
    t.router.wlDiag.broken.add("eth7");
    assert.deepEqual((await t.owner.get("/api/x/wifi-diagnostics/radios")).data.radios.find((r) => r.band === "5 GHz").unavailable, ["noise", "air", "dfs", "temperature"]);
    const clients = (await t.owner.get("/api/x/wifi-diagnostics/clients?force=1")).data;
    assert.equal(clients.networks.find((n) => n.band === "5 GHz").supported, false);
    assert.equal(clients.clients.length, 2, "only the 2.4 GHz devices can be read while the 5 GHz radio is silent");
  } finally {
    await t.stop();
  }
});

test("wifi-diagnostics: disconnecting a device asks for the hold, finds the right network itself and refuses strangers", async () => {
  const t = await startApp();
  try {
    const mac = "3C:22:FB:10:20:30";
    const noHold = await t.owner.post("/api/actions/wifi-diagnostics.kick", { mac });
    assert.equal(noHold.status, 403);
    assert.equal(noHold.data.code, "CONFIRM_HOLD");
    assert.equal(t.router.kickLog, undefined, "nothing was sent without the confirmation");
    assert.equal((await t.owner.post("/api/actions/wifi-diagnostics.kick", { mac: "nonsense", hold: true })).status, 400);
    assert.equal((await t.owner.post("/api/actions/wifi-diagnostics.kick", { mac: "11:22:33:44:55:66", hold: true })).status, 404);
    const done = await t.owner.post("/api/actions/wifi-diagnostics.kick", { mac, hold: true });
    assert.equal(done.status, 200, done.text);
    assert.deepEqual([done.data.ok, done.data.gone, done.data.band], [true, true, "2.4 GHz"]);
    assert.deepEqual(t.router.kickLog, [{ ifname: "eth6", mac }]);
    assert.ok(t.router.commands.includes(`wl -i eth6 deauthenticate ${mac}`));
    const after = (await t.owner.get("/api/x/wifi-diagnostics/clients?force=1")).data;
    assert.equal(after.clients.some((c) => c.mac === mac), false);
    await sleep(4200);
    assert.equal((await t.owner.get("/api/x/wifi-diagnostics/clients?force=1")).data.clients.some((c) => c.mac === mac), true, "the device rejoined");
    const viewer = t.client();
    assert.equal((await viewer.post("/api/actions/wifi-diagnostics.kick", { mac, hold: true })).status, 401, "signed-out visitors are refused");
  } finally {
    await t.stop();
  }
});

test("wifi-diagnostics: re-running automatic channel selection needs the hold, an automatic band and reports the move", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/actions/wifi-diagnostics.acs", { band: 0 })).data.code, "CONFIRM_HOLD");
    assert.equal((await t.owner.post("/api/actions/wifi-diagnostics.acs", { band: 7, hold: true })).status, 404);
    t.router.nvram.wl0_chanspec = "6";
    const fixed = await t.owner.post("/api/actions/wifi-diagnostics.acs", { band: 0, hold: true });
    assert.equal(fixed.status, 409);
    assert.match(fixed.data.error ?? fixed.text, /fixed channel/);
    t.router.nvram.wl0_chanspec = "0";
    const moved = await t.owner.post("/api/actions/wifi-diagnostics.acs", { band: 0, hold: true });
    assert.equal(moved.status, 200, moved.text);
    assert.deepEqual([moved.data.method, moved.data.before, moved.data.after, moved.data.moved], ["autochannel", "6", "11", true]);
    assert.ok(t.router.commands.includes("wl -i eth6 autochannel 1"));
    t.router.nvram.wl1_radio = "0";
    assert.equal((await t.owner.post("/api/actions/wifi-diagnostics.acs", { band: 1, hold: true })).status, 409);
  } finally {
    await t.stop();
  }
});

test("wifi-diagnostics: its settings are real controls with the router's own values", async () => {
  const t = await startApp();
  try {
    const entries = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "wifi-diagnostics");
    assert.deepEqual(entries.map((e) => e.id).sort(), ["wifi-diagnostics.count", "wifi-diagnostics.guests", "wifi-diagnostics.rank", "wifi-diagnostics.refresh", "wifi-diagnostics.weak"]);
    assert.ok(entries.every((e) => e.control !== "text"), "no bare text boxes");
    const domain = (await t.owner.get("/api/domain/wifi-diagnostics")).data;
    assert.deepEqual([domain.refresh, domain.weak, domain.rank, domain.count], [5, -75, "total", 8]);
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "wifi-diagnostics.weak", value: "-60" }, { id: "wifi-diagnostics.rank", value: "up" }, { id: "wifi-diagnostics.guests", value: "0" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    const weak = (await t.owner.get("/api/x/wifi-diagnostics/clients?force=1")).data;
    assert.equal(weak.weakBelow, -60);
    assert.equal(weak.clients.find((c) => c.name === "kitchen-speaker").weak, true, "-67 dBm is now under the line");
    assert.equal((await t.owner.get("/api/x/wifi-diagnostics/top?force=1")).data.by, "up", "the saved ranking is used when none is asked for");
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "wifi-diagnostics.weak", value: "-20" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("wifi-diagnostics: nothing in the feature tracks where anyone is", async () => {
  const t = await startApp();
  try {
    await t.owner.get("/api/x/wifi-diagnostics/clients?force=1");
    await t.owner.get("/api/x/wifi-diagnostics/top?force=1");
    for (const command of t.router.commands) assert.ok(!/ping|arp|ether-wake/.test(command), `unexpected command: ${command}`);
    const body = JSON.stringify((await t.owner.get("/api/x/wifi-diagnostics/clients?force=1")).data);
    assert.ok(!/location|history|presence/i.test(body));
  } finally {
    await t.stop();
  }
});

test("wifi-diagnostics: the browser module is well formed", () => {
  assert.equal(checkFeatureModule(feature, "wifi-diagnostics"), null);
});

test("wifi-diagnostics: the screen's number formatting, gauge tones and sorting", async () => {
  const { duration, fraction, size, sortClients, speed, tone } = await import("../../public/js/features/wifi-diagnostics/format.js");
  assert.equal(speed(4_200_000), "4.2 MB/s");
  assert.equal(speed(25_000_000), "25 MB/s");
  assert.equal(speed(800_000), "800 kB/s");
  assert.equal(speed(512), "512 B/s");
  assert.equal(speed(null), "…");
  assert.equal(size(2_500_000_000), "2.50 GB");
  assert.equal(size(1_500_000), "1.5 MB");
  assert.equal(duration(45), "45 s");
  assert.equal(duration(5400), "1 h 30 min");
  assert.equal(duration(90_000), "1 d 1 h");
  assert.equal(tone("air", 38), "good");
  assert.equal(tone("air", 55), "warn");
  assert.equal(tone("air", 90), "bad");
  assert.equal(tone("noise", -92), "good");
  assert.equal(tone("noise", -70), "bad");
  assert.equal(tone("heat", null), "off");
  assert.equal(fraction(-92, -100, -60), 20);
  assert.equal(fraction(500, 0, 100), 100, "a gauge never goes past the end of its arc");
  const rows = [{ mac: "B", name: "zeta", rssi: -40, downBps: 5, upBps: 5 }, { mac: "A", name: "alpha", rssi: -80, downBps: 900, upBps: 0 }, { mac: "C", name: "", rssi: null, downBps: null, upBps: null }];
  assert.deepEqual(sortClients(rows, "name").map((r) => r.mac), ["A", "C", "B"], "an unnamed device sorts by its address");
  assert.deepEqual(sortClients(rows, "signal").map((r) => r.mac), ["B", "A", "C"]);
  assert.deepEqual(sortClients(rows, "speed").map((r) => r.mac), ["A", "B", "C"]);
});

test("wifi-diagnostics: motion stops under reduced motion and the browser code builds no markup strings", async () => {
  const { readFile } = await import("node:fs/promises");
  const dir = new URL("../../public/js/features/wifi-diagnostics/", import.meta.url);
  const css = await readFile(new URL("style.css", dir), "utf8");
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@keyframes wd-rise/);
  for (const file of ["index.js", "charts.js", "timeline.js", "format.js"]) {
    const source = await readFile(new URL(file, dir), "utf8");
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(source), `${file} must not write HTML strings`);
    assert.ok(!/setAttribute\(["']style["']|\bstyle:\s*["'`]/.test(source), `${file} must not use inline styles`);
  }
});
