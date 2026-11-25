// Device traffic: the connection table is parsed into per-device counters, the
// rate comes from two readings, names come from the router, and a router
// without byte counting is reported honestly.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { sizeText, sortRows, speedText } from "../../public/js/features/device-traffic/index.js";
import { lanTest, parseConntrack, rates } from "../../server/features/device-traffic/conntrack.mjs";
import { startApp } from "../helpers.mjs";

const LAN = { lanIp: "198.51.100.1", lanMask: "255.255.255.0" };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("device-traffic: the connection table is split into upload and download per device", () => {
  const text = [
    "ipv4 2 tcp 6 100 ESTABLISHED src=198.51.100.101 dst=203.0.113.10 sport=1 dport=443 packets=2 bytes=1000 src=203.0.113.10 dst=198.51.100.101 sport=443 dport=1 packets=3 bytes=9000",
    "ipv4 2 tcp 6 100 ESTABLISHED src=203.0.113.20 dst=198.51.100.20 sport=5 dport=25565 packets=2 bytes=700 src=198.51.100.20 dst=203.0.113.20 sport=25565 dport=5 packets=2 bytes=300",
    "ipv4 2 udp 17 20 src=198.51.100.101 dst=198.51.100.20 sport=1 dport=2 packets=1 bytes=50 src=198.51.100.20 dst=198.51.100.101 sport=2 dport=1 packets=1 bytes=50",
    "ipv4 2 tcp 6 100 ESTABLISHED src=198.51.100.1 dst=203.0.113.10 sport=1 dport=443 packets=1 bytes=1 src=203.0.113.10 dst=198.51.100.1 sport=443 dport=1 packets=1 bytes=1",
    "ipv6 10 tcp 6 100 not used",
  ].join("\n");
  const { devices, accounting } = parseConntrack(text, LAN);
  assert.deepEqual([...devices], [["198.51.100.101", { up: 1000, down: 9000, flows: 1 }], ["198.51.100.20", { up: 300, down: 700, flows: 1 }]]);
  assert.equal(accounting, true);
  assert.equal(parseConntrack("ipv4 2 tcp 6 1 src=198.51.100.101 dst=203.0.113.10 sport=1 dport=2 src=203.0.113.10 dst=198.51.100.101 sport=2 dport=1", LAN).accounting, false);
  assert.equal(parseConntrack("", LAN).accounting, null);
  assert.equal(lanTest("198.51.100.1", "255.255.255.0")("198.51.100.200"), true);
  assert.equal(lanTest("198.51.100.1", "255.255.255.0")("203.0.113.1"), false);
});

test("device-traffic: a rate is the counter difference over the time, and never negative", () => {
  const before = new Map([["a", { up: 100, down: 1000, flows: 1 }], ["b", { up: 500, down: 500, flows: 1 }]]);
  const after = new Map([["a", { up: 300, down: 3000, flows: 1 }], ["b", { up: 100, down: 900, flows: 1 }], ["c", { up: 1, down: 1, flows: 1 }]]);
  const r = rates(before, after, 2);
  assert.deepEqual(r.get("a"), { up: 100, down: 1000 });
  assert.deepEqual(r.get("b"), { up: 0, down: 200 }, "a connection that ended makes the counter drop: counted as zero");
  assert.deepEqual(r.get("c"), { up: 0, down: 0 }, "a new device has no earlier reading");
});

test("device-traffic: the sample route warms up, then shows rates and names; an off counter is reported", async () => {
  const t = await startApp();
  try {
    await t.owner.post("/api/x/device-traffic/reset");
    const domain = (await t.owner.get("/api/domain/device-traffic")).data;
    assert.deepEqual([domain.interval, domain.top, domain.hideIdle, domain.unit], [2, 8, true, "bits"]);
    assert.equal(domain.entries.length, 4);

    const first = (await t.owner.get("/api/x/device-traffic/sample")).data;
    assert.equal(first.warm, true);
    assert.equal(first.devices.length, 4);
    assert.ok(first.devices.every((d) => d.down === 0 && d.up === 0));
    await wait(1300);
    const second = (await t.owner.get("/api/x/device-traffic/sample")).data;
    assert.equal(second.warm, false);
    const byIp = Object.fromEntries(second.devices.map((d) => [d.ip, d]));
    assert.equal(byIp["198.51.100.101"].name, "Living room TV", "the name set on the Devices screen wins");
    assert.equal(byIp["198.51.100.102"].name, "Pats-iPhone");
    assert.ok(byIp["198.51.100.101"].down > 2_000_000 && byIp["198.51.100.101"].down < 3_000_000, `TV download rate ${byIp["198.51.100.101"].down}`);
    assert.ok(byIp["198.51.100.101"].down > byIp["198.51.100.102"].down);
    assert.ok(byIp["198.51.100.20"].up > byIp["198.51.100.20"].down, "the NAS uploads more than it downloads");
    assert.equal(byIp["198.51.100.101"].flows, 2);
    assert.equal(second.history.length, 1);
    assert.ok(second.total.down > 0);
    assert.equal(second.accounting, true);
    assert.ok(t.router.commands.includes("head -n 100000 /proc/net/nf_conntrack"));

    // Asking again straight away reuses the last reading instead of asking the router again.
    const count = t.router.commands.filter((c) => c.includes("nf_conntrack")).length;
    await t.owner.get("/api/x/device-traffic/sample");
    assert.equal(t.router.commands.filter((c) => c.includes("nf_conntrack")).length, count);

    // A router that lists connections without byte counts.
    await t.owner.post("/api/x/device-traffic/reset");
    t.router.nvram.mar_fake_conntrack_acct = "0";
    assert.equal((await t.owner.get("/api/x/device-traffic/sample")).data.accounting, false);

    // A setting changes through the change engine and is read back.
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "device-traffic.unit", value: "bytes" }] });
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.equal((await t.owner.get("/api/domain/device-traffic")).data.unit, "bytes");
  } finally {
    await t.stop();
  }
});

test("device-traffic: the browser helpers sort and format and the module is well formed", () => {
  assert.equal(checkFeatureModule(feature, "device-traffic"), null);
  assert.equal(speedText(1_250_000, "bits"), "10 Mbit/s");
  assert.equal(speedText(2_500_000, "bytes"), "2.5 MB/s");
  assert.equal(sizeText(2_500_000), "2.5 MB");
  const rows = [{ name: "b", ip: "198.51.100.2", down: 1 }, { name: "A", ip: "198.51.100.10", down: 5 }, { name: "c", ip: "198.51.100.3", down: 5 }];
  assert.deepEqual(sortRows(rows, "down", "desc").map((r) => r.ip), ["198.51.100.3", "198.51.100.10", "198.51.100.2"]);
  assert.deepEqual(sortRows(rows, "name", "asc").map((r) => r.name), ["A", "b", "c"]);
});

// ---- the "who is uploading or downloading the most" tab ----------------------
import { createLeaders, rank } from "../../public/js/features/device-traffic/leaders.js";

const leadersView = () => ({
  warm: false,
  accounting: true,
  devices: [
    { ip: "198.51.100.101", mac: "AC:5A:F0:01:02:03", name: "Living room TV", down: 2_500_000, up: 50_000, totalDown: 9e9, totalUp: 1e6 },
    { ip: "198.51.100.20", mac: "", name: "nas", down: 100_000, up: 800_000, totalDown: 2e6, totalUp: 5e9 },
    { ip: "198.51.100.103", mac: "", name: "kitchen-speaker", down: 0, up: 0, totalDown: 0, totalUp: 0 },
  ],
  history: [
    { at: 1000, up: 0, down: 0, devices: {} },
    { at: 3000, up: 0, down: 0, devices: { "198.51.100.101": { up: 10, down: 1000 }, "198.51.100.20": { up: 500, down: 100 } } },
    { at: 7000, up: 0, down: 0, devices: { "198.51.100.101": { up: 10, down: 3000 }, "198.51.100.20": { up: 600, down: 100 } } },
  ],
});

test("device-traffic leaders: each view ranks by its own measure and skips devices that moved nothing", () => {
  const view = leadersView();
  const now = rank(view, "down", "now");
  assert.deepEqual(now.rows.map((r) => r.name), ["Living room TV", "nas"], "the idle speaker is left out");
  assert.equal(Math.round(now.rows[0].share * 100), 96);
  assert.deepEqual(rank(view, "up", "now").rows.map((r) => r.name), ["nas", "Living room TV"]);
  // 2 s at 1000 plus 4 s at 3000 bytes per second.
  const window = rank(view, "down", "window");
  assert.equal(window.rows[0].value, 2 * 1000 + 4 * 3000 + 0);
  assert.equal(window.seconds, 6);
  assert.deepEqual(rank(view, "up", "total").rows.map((r) => r.name), ["nas", "Living room TV"]);
  assert.deepEqual(rank({ ...view, history: [] }, "down", "window").rows, [], "no readings yet means an empty list, not a guess");
  assert.equal(rank({ ...view, devices: Array.from({ length: 14 }, (_, i) => ({ ip: `198.51.100.${100 + i}`, name: `d${i}`, mac: "", down: 1000 + i, up: 0, totalDown: 0, totalUp: 0 })) }, "down", "now").rows.length, 10, "at most ten are listed");
});

test("device-traffic leaders: the tab module is well formed and the screen has the tab", () => {
  assert.equal(typeof createLeaders, "function");
  assert.equal(checkFeatureModule(feature, "device-traffic"), null);
});
