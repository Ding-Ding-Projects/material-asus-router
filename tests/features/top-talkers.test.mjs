// Top talkers: the ranking, the number formats, the history sparkline, and the
// live readings from the router's connection table that feed them.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/top-talkers/index.js";
import { METRICS, accumulate, bytesText, rank, rateText, sparkline, valueOf } from "../../public/js/features/top-talkers/model.js";
import { startApp } from "../helpers.mjs";

const devices = [
  { ip: "198.51.100.101", name: "tv", up: 50_000, down: 2_500_000, flows: 3 },
  { ip: "198.51.100.102", name: "phone", up: 120_000, down: 400_000, flows: 2 },
  { ip: "198.51.100.20", name: "nas", up: 800_000, down: 100_000, flows: 1 },
  { ip: "198.51.100.104", name: "printer", up: 0, down: 0, flows: 0 },
];

test("top-talkers: the downloaders, the uploaders and the busiest overall come out in order", () => {
  assert.deepEqual(METRICS, ["down", "up", "both"]);
  assert.deepEqual(rank(devices, "down").map((r) => r.name), ["tv", "phone", "nas"], "the idle printer is left out");
  assert.deepEqual(rank(devices, "up").map((r) => r.name), ["nas", "phone", "tv"]);
  assert.deepEqual(rank(devices, "both").map((r) => [r.name, r.rank]), [["tv", 1], ["nas", 2], ["phone", 3]]);
  assert.deepEqual(rank(devices, "down", { hideIdle: false }).map((r) => r.name).at(-1), "printer");
  assert.equal(rank(devices, "down", { top: 2 }).length, 2);
  const shares = rank(devices, "down").map((r) => r.share);
  assert.ok(Math.abs(shares.reduce((a, b) => a + b, 0) - 1) < 1e-9, "the shares add up to everyone");
  assert.equal(Math.round(shares[0] * 100), 83);
  assert.equal(valueOf(devices[0], "both"), 2_550_000);
  assert.deepEqual(rank([], "down"), []);
  assert.equal(rank([{ ip: "x", name: "a", up: 0, down: 0 }], "down", { hideIdle: false })[0].share, 0, "no traffic at all is never a divide by zero");
});

test("top-talkers: speeds and sizes are written the way people read them", () => {
  assert.equal(rateText(2_500_000, "bits"), "20 Mbit/s");
  assert.equal(rateText(100_000, "bits"), "800 kbit/s");
  assert.equal(rateText(2_500_000, "bytes"), "2.5 MB/s");
  assert.equal(rateText(40_000, "bytes"), "40 kB/s");
  assert.equal(rateText(150_000, "bits"), "1.2 Mbit/s");
  assert.equal(bytesText(1_500_000_000), "1.5 GB");
  assert.equal(bytesText(340_000_000), "340 MB");
  assert.equal(bytesText(12_000), "12 kB");
});

test("top-talkers: totals since the page opened add up and the sparkline stays in its box", () => {
  let totals = accumulate({}, devices.slice(0, 2), 2);
  totals = accumulate(totals, devices.slice(0, 1), 1);
  assert.deepEqual(totals["198.51.100.101"], { up: 150_000, down: 7_500_000 });
  assert.deepEqual(totals["198.51.100.102"], { up: 240_000, down: 800_000 });
  assert.deepEqual(accumulate(totals, devices, 0), totals, "no time passed, nothing added");
  const history = [{ devices: { a: { up: 0, down: 10 } } }, { devices: { a: { up: 0, down: 40 } } }, { devices: {} }];
  const points = sparkline(history, "a", "down", 120, 28).split(" ").map((p) => p.split(",").map(Number));
  assert.equal(points.length, 3);
  assert.deepEqual(points.map(([x]) => x), [0, 60, 120]);
  assert.ok(points.every(([, y]) => y >= 0 && y <= 28));
  assert.ok(points[1][1] < points[0][1] && points[2][1] > points[1][1], "higher traffic draws higher");
  assert.equal(sparkline([history[0]], "a", "down", 120, 28), "", "one reading is not a line");
});

test("top-talkers: the live readings rank the pretend router's devices and a block goes through the engine", async () => {
  const t = await startApp();
  try {
    const first = (await t.owner.get("/api/x/device-traffic/sample")).data;
    assert.equal(first.warm, true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const second = (await t.owner.get("/api/x/device-traffic/sample")).data;
    assert.equal(second.warm, false);
    assert.equal(second.accounting, true);
    const down = rank(second.devices, "down");
    assert.equal(down[0].ip, "198.51.100.101", "the television downloads the most");
    assert.ok(down[0].down > down[1].down);
    assert.equal(rank(second.devices, "up")[0].ip, "198.51.100.20", "the nas uploads the most");
    assert.ok(second.history.length >= 1);
    assert.ok(sparkline(second.history, down[0].ip, "down", 120, 28).length >= 0);
    const settings = (await t.owner.get("/api/domain/device-traffic")).data;
    assert.ok(settings.interval >= 1 && settings.unit);

    // Blocking the busiest device is a list edit that the engine previews and applies.
    const preview = await t.owner.post("/api/changes/preview", { ops: [{ op: "block", mac: down[0].mac, name: down[0].name, blocked: true }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.ok(t.router.nvram.MULTIFILTER_MAC.includes(down[0].mac));
  } finally {
    await t.stop();
  }
});

test("top-talkers: the module is listed, in the Monitor section, and well formed", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/top-talkers/index.js"));
    for (const file of ["index.js", "model.js", "style.css"]) assert.equal((await fetch(`${t.base}/js/features/top-talkers/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "top-talkers"), null);
  assert.equal(feature.screens[0].group.en, "Monitor");
});
