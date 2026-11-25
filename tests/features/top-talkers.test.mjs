// Tests for top-talkers: the ranking helpers behind the three tabs, the module
// shape, and that it reads the Device traffic reading the router really gives.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/top-talkers/index.js";
import { MODES, accumulate, percent, rank, visitRank } from "../../public/js/features/top-talkers/model.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp } from "../helpers.mjs";

const devices = [
  { ip: "198.51.100.101", name: "Laptop", down: 5000000, up: 100000, totalDown: 9e9, totalUp: 1e6 },
  { ip: "198.51.100.102", name: "Phone", down: 1000000, up: 3000000, totalDown: 2e6, totalUp: 8e8 },
  { ip: "198.51.100.103", name: "TV", down: 4000000, up: 0, totalDown: 5e8, totalUp: 0 },
  { ip: "198.51.100.104", name: "Idle", down: 0, up: 0, totalDown: 0, totalUp: 0 },
];

test("top-talkers: each tab ranks a different way, with shares that add up", () => {
  assert.deepEqual(MODES, ["down", "up", "both"]);
  assert.deepEqual(rank(devices, "down").map((r) => r.name), ["Laptop", "TV", "Phone", "Idle"]);
  assert.deepEqual(rank(devices, "up").map((r) => r.name), ["Phone", "Laptop", "Idle", "TV"]);
  assert.deepEqual(rank(devices, "both").map((r) => r.name), ["Laptop", "Phone", "TV", "Idle"]);
  const down = rank(devices, "down");
  assert.equal(Math.round(down.reduce((s, r) => s + r.share, 0) * 100), 100);
  assert.deepEqual([down[0].place, down[0].rate, percent(down[0].share)], [1, 5000000, "50%"]);
  assert.equal(rank(devices, "down", 2).length, 2);
  assert.deepEqual(rank([], "down"), []);
  assert.equal(rank([{ ...devices[3] }], "down")[0].share, 0);
});

test("top-talkers: a tie is broken by the tracked total and then the name, so the order never jumps", () => {
  const tie = [{ ip: "a", name: "Bee", down: 10, up: 0, totalDown: 5, totalUp: 0 }, { ip: "b", name: "Ant", down: 10, up: 0, totalDown: 5, totalUp: 0 }, { ip: "c", name: "Cob", down: 10, up: 0, totalDown: 9, totalUp: 0 }];
  assert.deepEqual(rank(tie, "down").map((r) => r.name), ["Cob", "Ant", "Bee"]);
});

test("top-talkers: what each device moved since the page opened adds up reading by reading", () => {
  let totals = new Map();
  totals = accumulate(totals, devices, 0);
  assert.equal(totals.size, 0, "the first reading has nothing to add");
  totals = accumulate(totals, devices, 2);
  totals = accumulate(totals, devices, 2);
  assert.equal(totals.get("198.51.100.101").down, 20000000);
  assert.equal(accumulate(totals, devices, 600).get("198.51.100.101").down, 20000000, "a long gap is ignored, not guessed");
  assert.deepEqual(visitRank(totals, "up", 2).map((r) => r.name), ["Phone", "Laptop"]);
  assert.deepEqual(visitRank(totals, "down").map((r) => r.name), ["Laptop", "TV", "Phone"], "an idle device is left out");
});

test("top-talkers: the Device traffic reading it depends on is served and has the fields it uses", async () => {
  const t = await startApp();
  try {
    const view = (await t.owner.get("/api/x/device-traffic/sample")).data;
    assert.ok(Array.isArray(view.devices));
    for (const field of ["ip", "name", "down", "up", "totalDown", "totalUp"]) assert.ok(view.devices.every((d) => field in d), field);
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/top-talkers/index.js"));
    assert.ok(manifest.styles.includes("/js/features/top-talkers/style.css"));
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "top-talkers"), null);
  assert.deepEqual(feature.screens.map((s) => s.id), ["top-talkers"]);
});
