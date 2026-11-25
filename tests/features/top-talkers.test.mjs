// Who's using the most: the per-connection byte meter, the leaderboard route on the pretend router (its
// connection table comes from the device-traffic feature's fake handler), the privacy limits, the settings,
// and the browser helpers.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { metricOf, ownerLabel, rankDevices, sizeText, speedText } from "../../public/js/features/top-talkers/index.js";
import { Meter, dayKey, parseFlows, weekKey } from "../../server/features/top-talkers/meter.mjs";
import { startApp } from "../helpers.mjs";

const LAN = { lanIp: "198.51.100.1", lanMask: "255.255.255.0" };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const flow = (key, ip, up, down) => ({ key, ip, up, down });

test("top-talkers: connection lines become per-device flows and nothing but bytes is kept", () => {
  const text = [
    "ipv4 2 tcp 6 100 ESTABLISHED src=198.51.100.101 dst=203.0.113.10 sport=1 dport=443 packets=2 bytes=1000 src=203.0.113.10 dst=198.51.100.101 sport=443 dport=1 packets=3 bytes=9000",
    "ipv4 2 tcp 6 100 ESTABLISHED src=203.0.113.20 dst=198.51.100.20 sport=5 dport=25565 packets=2 bytes=700 src=198.51.100.20 dst=203.0.113.20 sport=25565 dport=5 packets=2 bytes=300",
    "ipv4 2 udp 17 20 src=198.51.100.101 dst=198.51.100.20 sport=1 dport=2 packets=1 bytes=50 src=198.51.100.20 dst=198.51.100.101 sport=2 dport=1 packets=1 bytes=50",
    "ipv4 2 tcp 6 100 ESTABLISHED src=198.51.100.1 dst=203.0.113.10 sport=1 dport=443 packets=1 bytes=1 src=203.0.113.10 dst=198.51.100.1 sport=443 dport=1 packets=1 bytes=1",
  ].join("\n");
  const { flows, accounting } = parseFlows(text, LAN);
  assert.deepEqual(flows.map((f) => [f.ip, f.up, f.down]), [["198.51.100.101", 1000, 9000], ["198.51.100.20", 300, 700]]);
  assert.deepEqual(Object.keys(flows[0]).sort(), ["down", "ip", "key", "up"], "no address of the other side is kept apart from the connection key");
  assert.equal(accounting, true);
  assert.equal(parseFlows("ipv4 2 tcp 6 1 ESTABLISHED src=198.51.100.101 dst=203.0.113.10 sport=1 dport=2 src=203.0.113.10 dst=198.51.100.101 sport=2 dport=1", LAN).accounting, false);
  assert.equal(parseFlows("", LAN).accounting, null);
});

test("top-talkers: the meter counts growth per connection, welcomes new ones and survives resets and endings", () => {
  const meter = new Meter({ historyLength: 3 });
  const t0 = new Date(2026, 10, 25, 10, 0, 0).getTime();
  assert.equal(meter.update([flow("a", "x", 100, 1000), flow("b", "y", 10, 10)], t0).warm, true);
  assert.equal(meter.devices.get("x").todayDown, 0, "the first reading is only a baseline");
  meter.update([flow("a", "x", 300, 3000), flow("b", "y", 10, 10), flow("c", "x", 50, 500)], t0 + 2000);
  const x = meter.devices.get("x");
  assert.deepEqual([x.up, x.down, x.todayUp, x.todayDown, x.weekUp, x.weekDown, x.flows], [125, 1250, 250, 2500, 250, 2500, 2], "200 up and 2000 down from the old connection plus 50 and 500 from the new one");
  // Connection "a" ended and "c" restarted with a smaller counter: the new counter counts as new bytes.
  meter.update([flow("c", "x", 20, 200)], t0 + 4000);
  assert.deepEqual([x.todayUp, x.todayDown], [270, 2700]);
  assert.equal(meter.devices.get("y").up, 0, "a device with no connection now moves nothing");
  assert.equal(meter.devices.get("y").flows, 0);
  for (let i = 0; i < 5; i += 1) meter.update([flow("c", "x", 20 + i, 200)], t0 + 6000 + i * 1000);
  assert.equal(x.history.length, 3, "the history is bounded");
  // The next day starts today's totals again but keeps the week.
  const next = new Date(2026, 10, 26, 0, 0, 5).getTime();
  meter.update([flow("c", "x", 1000, 200)], next);
  assert.equal(dayKey(new Date(next)), meter.day);
  assert.ok(x.todayUp > 0 && x.todayUp < x.weekUp, "today restarted, the week kept counting");
  // A new week (Monday) starts both again.
  assert.equal(weekKey(new Date(2026, 10, 29)), "2026-11-23", "Sunday belongs to the week that began on Monday the 23rd");
  assert.equal(weekKey(new Date(2026, 10, 30)), "2026-11-30");
  meter.update([flow("c", "x", 2000, 200)], new Date(2026, 10, 30, 8).getTime());
  assert.ok(Math.abs(x.weekUp - 1000) < 1e-9 && x.todayUp === 1000, `the week restarted: ${x.weekUp}`);
});

test("top-talkers: the sample route builds a leaderboard with owners, totals and per-device history", async () => {
  const t = await startApp();
  try {
    await t.owner.post("/api/x/top-talkers/reset");
    const domain = (await t.owner.get("/api/domain/top-talkers")).data;
    assert.deepEqual([domain.interval, domain.shown, domain.rank, domain.hideIdle], [2, 8, "rate", true]);
    assert.equal(domain.entries.length, 4);

    const first = (await t.owner.get("/api/x/top-talkers/sample")).data;
    assert.equal(first.warm, true);
    assert.ok(first.devices.every((d) => d.down === 0 && d.todayDown === 0));
    await wait(1300);
    const second = (await t.owner.get("/api/x/top-talkers/sample")).data;
    assert.equal(second.warm, false);
    assert.equal(second.accounting, true);
    const byIp = Object.fromEntries(second.devices.map((d) => [d.ip, d]));
    assert.equal(byIp["198.51.100.101"].name, "Living room TV");
    assert.equal(byIp["198.51.100.101"].owner, "Your brother");
    assert.equal(byIp["198.51.100.102"].owner, "");

    const downBoard = rankDevices(second.devices, "down", "rate");
    const upBoard = rankDevices(second.devices, "up", "rate");
    assert.equal(downBoard[0].ip, "198.51.100.101", "the TV downloads the most");
    assert.equal(upBoard[0].ip, "198.51.100.20", "the NAS uploads the most");
    assert.ok(byIp["198.51.100.101"].todayDown > 0 && byIp["198.51.100.101"].weekDown >= byIp["198.51.100.101"].todayDown);
    assert.equal(byIp["198.51.100.101"].history.length, 1);
    assert.ok(second.total.todayDown >= byIp["198.51.100.101"].todayDown);
    assert.equal(rankDevices(second.devices, "down", "week")[0].ip, "198.51.100.101");

    // Privacy: a device row carries names, addresses and byte counts only, never a website, app or other side.
    const allowed = new Set(["ip", "mac", "name", "owner", "up", "down", "flows", "todayUp", "todayDown", "weekUp", "weekDown", "history"]);
    for (const d of second.devices) assert.deepEqual(Object.keys(d).filter((k) => !allowed.has(k)), []);
    assert.ok(!JSON.stringify(second).includes("203.0.113.10"), "the address on the other side of a connection is not sent");

    // Asking again straight away reuses the last reading.
    const count = t.router.commands.filter((c) => c.includes("nf_conntrack")).length;
    await t.owner.get("/api/x/top-talkers/sample");
    assert.equal(t.router.commands.filter((c) => c.includes("nf_conntrack")).length, count);

    // A router that lists connections without byte counts is reported honestly.
    await t.owner.post("/api/x/top-talkers/reset");
    t.router.nvram.mar_fake_conntrack_acct = "0";
    assert.equal((await t.owner.get("/api/x/top-talkers/sample")).data.accounting, false);
  } finally {
    await t.stop();
  }
});

test("top-talkers: a setting changes through the change engine and the routes need a session", async () => {
  const t = await startApp();
  try {
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "top-talkers.rank", value: "week" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.equal((await t.owner.get("/api/domain/top-talkers")).data.rank, "week");
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "top-talkers.shown", value: "99" }] })).status, 400);
    assert.equal((await t.client().get("/api/x/top-talkers/sample")).status, 401);
    assert.equal((await t.owner.post("/api/x/top-talkers/reset", {}, { csrf: "wrong" })).status, 403);
  } finally {
    await t.stop();
  }
});

test("top-talkers: the browser helpers rank, format and name owners, and the module is well formed", () => {
  assert.equal(checkFeatureModule(feature, "top-talkers"), null);
  assert.equal(feature.screens[0].id, "top-talkers");
  assert.equal(speedText(1_250_000, "bits"), "10 Mbit/s");
  assert.equal(speedText(2_500_000, "bytes"), "2.5 MB/s");
  assert.equal(sizeText(2_500_000), "2.5 MB");
  assert.equal(sizeText(512), "512 B");
  assert.deepEqual(ownerLabel("Your brother"), { en: "Your brother", yue: "你兄弟" });
  assert.deepEqual(ownerLabel("brother"), { en: "Your brother", yue: "你兄弟" });
  assert.deepEqual(ownerLabel("Pat"), { en: "Pat", yue: "Pat" });
  assert.equal(ownerLabel(""), null);
  const devices = [
    { ip: "198.51.100.2", up: 5, down: 1, todayUp: 9, todayDown: 0, weekUp: 0, weekDown: 7 },
    { ip: "198.51.100.10", up: 1, down: 5, todayUp: 1, todayDown: 8, weekUp: 3, weekDown: 7 },
    { ip: "198.51.100.3", up: 0, down: 5, todayUp: 0, todayDown: 2, weekUp: 4, weekDown: 7 },
  ];
  assert.deepEqual(rankDevices(devices, "down", "rate").map((d) => d.ip), ["198.51.100.3", "198.51.100.10", "198.51.100.2"]);
  assert.deepEqual(rankDevices(devices, "up", "today").map((d) => d.ip), ["198.51.100.2", "198.51.100.10"], "idle devices are hidden");
  assert.deepEqual(rankDevices(devices, "up", "today", { hideIdle: false, shown: 3 }).length, 3);
  assert.deepEqual(rankDevices(devices, "down", "week", { shown: 2 }).map((d) => d.ip), ["198.51.100.2", "198.51.100.3"]);
  assert.equal(metricOf(devices[0], "up", "today"), 9);
  assert.equal(metricOf(devices[0], "down", "week"), 7);
});
