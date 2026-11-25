// Tests for top-talkers: connection parsing, byte counting that follows each
// connection, ranking by downloading, uploading and both, and the live route.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/top-talkers/index.js";
import { MODES, percentText, rankDevices, sizeText, speedText, valueText } from "../../public/js/features/top-talkers/rank.js";
import { advance, lanTest, parseFlows } from "../../server/features/top-talkers/flows.mjs";
import { startApp } from "../helpers.mjs";

const LAN = { lanIp: "198.51.100.1", lanMask: "255.255.255.0" };
const line = (src, sport, up, down, proto = "tcp") => `ipv4     2 ${proto}      6 431999 ESTABLISHED src=${src} dst=203.0.113.10 sport=${sport} dport=443 packets=1 bytes=${up} src=203.0.113.10 dst=${src} sport=443 dport=${sport} packets=1 bytes=${down} [ASSURED]\n`;

test("top-talkers: only device to internet connections are read, in the right direction", () => {
  assert.equal(lanTest("198.51.100.1", "255.255.255.0")("198.51.100.77"), true);
  const text = line("198.51.100.20", 5000, 100, 9000)
    + "ipv4     2 tcp      6 100 ESTABLISHED src=203.0.113.10 dst=198.51.100.21 sport=443 dport=6000 packets=1 bytes=700 src=198.51.100.21 dst=203.0.113.10 sport=6000 dport=443 packets=1 bytes=50\n" // inbound first
    + line("198.51.100.1", 40000, 1, 1) // the router itself
    + "ipv4     2 udp      17 20 src=198.51.100.20 dst=198.51.100.21 sport=1 dport=2 packets=1 bytes=10 src=198.51.100.21 dst=198.51.100.20 sport=2 dport=1 packets=1 bytes=10\n"; // inside only
  const { flows, accounting } = parseFlows(text, LAN);
  assert.equal(accounting, true);
  assert.equal(flows.length, 2);
  assert.deepEqual([flows[0].ip, flows[0].up, flows[0].down], ["198.51.100.20", 100, 9000]);
  assert.deepEqual([flows[1].ip, flows[1].up, flows[1].down], ["198.51.100.21", 50, 700], "an inbound-first line is flipped so up and down stay the device's view");
  assert.equal(parseFlows(line("198.51.100.20", 1, 1, 1).replace(/ packets=1 bytes=\d+/g, ""), LAN).accounting, false);
  assert.equal(parseFlows("", LAN).accounting, null);
});

test("top-talkers: counting follows each connection, so a finished connection never makes the total fall", () => {
  const fresh = () => ({ at: null, flows: new Map(), devices: new Map(), since: 0, readings: 0 });
  const read = (state, at, ...rows) => advance(state, parseFlows(rows.join(""), LAN).flows, at);
  let s = read(fresh(), 1000, line("198.51.100.20", 1, 100, 1000));
  assert.equal(s.devices.get("198.51.100.20").totalDown, 0, "the first reading is only the starting point");
  s = read(s, 3000, line("198.51.100.20", 1, 300, 5000));
  let d = s.devices.get("198.51.100.20");
  assert.deepEqual([d.totalUp, d.totalDown, d.rateUp, d.rateDown], [200, 4000, 100, 2000]);
  // The first connection ends and a new one starts: the total keeps growing and counts the new bytes.
  s = read(s, 5000, line("198.51.100.20", 2, 40, 900));
  d = s.devices.get("198.51.100.20");
  assert.deepEqual([d.totalUp, d.totalDown], [240, 4900]);
  assert.equal(d.peakDown, 2000);
  // Nothing tracked any more: the rate drops to zero and the total stays.
  s = read(s, 7000);
  d = s.devices.get("198.51.100.20");
  assert.deepEqual([d.totalDown, d.rateDown, d.peakDown], [4900, 0, 2000]);
});

test("top-talkers: ranking by downloading, uploading and both, right now and in total", () => {
  const rows = [
    { ip: "198.51.100.101", name: "TV", rateUp: 50, rateDown: 2500, totalUp: 10, totalDown: 900 },
    { ip: "198.51.100.20", name: "Laptop", rateUp: 800, rateDown: 100, totalUp: 5000, totalDown: 100 },
    { ip: "198.51.100.102", name: "Phone", rateUp: 120, rateDown: 400, totalUp: 50, totalDown: 400 },
    { ip: "198.51.100.103", name: "Idle", rateUp: 0, rateDown: 0, totalUp: 0, totalDown: 0 },
  ];
  assert.deepEqual(rankDevices(rows, { mode: "down", window: "now" }).map((r) => r.name), ["TV", "Phone", "Laptop"]);
  assert.deepEqual(rankDevices(rows, { mode: "up", window: "now" }).map((r) => r.name), ["Laptop", "Phone", "TV"]);
  assert.deepEqual(rankDevices(rows, { mode: "both", window: "now" }).map((r) => r.name), ["TV", "Laptop", "Phone"]);
  assert.deepEqual(rankDevices(rows, { mode: "up", window: "since" }).map((r) => r.name), ["Laptop", "Phone", "TV"]);
  assert.equal(rankDevices(rows, { hideIdle: false, count: 10 }).length, 4);
  assert.equal(rankDevices(rows, { count: 2 }).length, 2);
  const [first, second] = rankDevices(rows, { mode: "down" });
  assert.deepEqual([first.position, first.rel, second.position], [1, 1, 2]);
  assert.ok(Math.abs(first.share - 2500 / 3000) < 1e-9);
  assert.deepEqual(MODES, ["down", "up", "both"]);
  assert.deepEqual(rankDevices([], {}), []);
  assert.equal(rankDevices(rows.slice(3), { hideIdle: false })[0].share, 0, "an all-idle network divides by nothing safely");
});

test("top-talkers: speeds and sizes read like the rest of the app", () => {
  assert.equal(speedText(2_500_000, "bits"), "20 Mbit/s");
  assert.equal(speedText(2_500_000, "bytes"), "2.5 MB/s");
  assert.equal(sizeText(1_500_000_000), "1.50 GB");
  assert.equal(valueText(2_500_000, "now", "bits"), "20 Mbit/s");
  assert.equal(valueText(2_500_000, "since", "bits"), "2.5 MB");
  assert.equal(percentText(0.834), "83%");
});

test("top-talkers: the live route ranks the pretend devices and a reset starts counting from zero", async () => {
  const t = await startApp();
  try {
    const entries = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "top-talkers").map((e) => e.id).sort();
    assert.deepEqual(entries, ["top-talkers.count", "top-talkers.hide-idle", "top-talkers.interval", "top-talkers.unit", "top-talkers.view", "top-talkers.window"]);
    assert.equal((await t.owner.post("/api/x/top-talkers/reset")).status, 200);
    const first = (await t.owner.get("/api/x/top-talkers/sample")).data;
    assert.equal(first.warm, true);
    assert.equal(first.accounting, true);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = (await t.owner.get("/api/x/top-talkers/sample")).data;
    assert.equal(second.warm, false);
    const names = (mode, window) => rankDevices(second.devices, { mode, window }).map((r) => r.ip);
    assert.equal(names("down", "now")[0], "198.51.100.101", "the TV downloads the most");
    assert.equal(names("up", "now")[0], "198.51.100.20", "the laptop uploads the most");
    assert.ok(second.devices.every((d) => d.totalDown >= 0 && d.totalUp >= 0));
    assert.ok(second.devices.some((d) => d.totalDown > 0), "bytes moved since counting started are counted");
    assert.equal((await t.owner.get("/api/domain/top-talkers")).data.view, "down");

    await t.owner.post("/api/x/top-talkers/reset");
    const again = (await t.owner.get("/api/x/top-talkers/sample")).data;
    assert.equal(again.warm, true);
    assert.ok(again.devices.every((d) => d.totalDown === 0), "a reset forgets the totals");

    assert.ok(!t.router.commands.some((c) => /nvram set|conntrack -F/.test(c)), "reading the table never changes the router");
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "top-talkers.view", value: "up" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.equal((await t.owner.get("/api/domain/top-talkers")).data.view, "up");

    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/x/top-talkers/sample")).status, 200, "viewers may look");
    assert.equal((await guest.post("/api/x/top-talkers/reset")).status, 403, "viewers may not reset");
    assert.equal((await t.client().get("/api/x/top-talkers/sample")).status, 401);
  } finally {
    await t.stop();
  }
});

test("top-talkers: the browser module is well formed", () => {
  assert.equal(checkFeatureModule(feature, "top-talkers"), null);
});
