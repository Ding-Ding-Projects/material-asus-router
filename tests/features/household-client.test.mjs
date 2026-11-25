// The household screen, browser side: the weekly painting grid and how it turns
// into time blocks and back, the presence wording, and the ranking of who is
// uploading or downloading the most. The screens were driven in a browser
// against the demo; these are the parts that need no browser.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { FEATURES } from "./fakes.mjs";

const model = await import(pathToFileURL(path.join(FEATURES, "household", "model.js")).href);

test("painting: a grid becomes blocks, joins identical days, and comes back the same", () => {
  let grid = model.emptyGrid();
  for (const day of [1, 2, 3, 4, 5]) grid = model.paintRect(grid, { day, hour: 9 }, { day, hour: 17 }, "work");
  for (let day = 0; day < 7; day += 1) {
    grid = model.paintRect(grid, { day, hour: 0 }, { day, hour: 6 }, "sleep");
    grid = model.paintRect(grid, { day, hour: 23 }, { day, hour: 23 }, "sleep");
  }
  const blocks = model.blocksFromGrid(grid);
  const work = blocks.filter((b) => b.kind === "work");
  assert.equal(work.length, 1, "five identical weekdays are one block");
  assert.deepEqual(work[0].days, [1, 2, 3, 4, 5]);
  assert.equal(work[0].from, "09:00");
  assert.equal(work[0].to, "18:00");
  assert.deepEqual(blocks.filter((b) => b.kind === "sleep").map((b) => `${b.from}-${b.to}`).sort(), ["00:00-07:00", "23:00-00:00"]);
  assert.deepEqual(model.gridFromBlocks(blocks), grid, "blocks paint back to the very same grid");
  assert.deepEqual(model.gridSummary(grid), { work: 45, sleep: 56, home: 0 });
  assert.equal(model.countCells(grid), 101);
});

test("painting: an overnight block runs into the next day, and the eraser takes cells away", () => {
  const overnight = [{ days: [5], from: "23:00", to: "07:00", kind: "sleep" }];
  const grid = model.gridFromBlocks(overnight);
  assert.equal(grid[5][23], "sleep");
  assert.equal(grid[5][22], null);
  assert.equal(grid[6][0], "sleep");
  assert.equal(grid[6][6], "sleep");
  assert.equal(grid[6][7], null);
  assert.equal(grid[0][0], null, "Friday night does not leak into Sunday");
  const erased = model.paintRect(grid, { day: 6, hour: 0 }, { day: 6, hour: 6 }, "erase");
  assert.equal(erased[6][3], null);
  assert.equal(grid[6][3], "sleep", "painting returns a new grid and leaves the old one alone");
  const rect = model.paintRect(model.emptyGrid(), { day: 3, hour: 10 }, { day: 1, hour: 8 }, "home");
  assert.equal(rect[2][9], "home", "the corners may be given in any order");
  assert.equal(model.countCells(rect), 9);
  assert.equal(model.hourText(24), "00:00");
  assert.deepEqual(model.blocksFromGrid(model.emptyGrid()), []);
  assert.equal(model.blocksFromGrid(grid, { sleep: 0 })[0].allowance, 0, "an allowance for the kind is carried onto its blocks");
});

test("presence reads in words, and a wired-only person is an honest unknown", () => {
  const home = model.presenceText({ id: "b", name: "Your brother", nameYue: "你兄弟", configured: true, state: "home", sources: [{ source: "wifi", state: "home", devices: [{ label: "desk PC", network: "Harbour Home 5G" }] }] });
  assert.equal(home.tone, "home");
  assert.match(home.en, /Your brother is home .* desk PC \(Harbour Home 5G\)/);
  assert.match(home.yue, /你兄弟喺屋企/);
  const away = model.presenceText({ id: "b", name: "Your brother", nameYue: "你兄弟", configured: true, state: "away", sources: [{ source: "wifi", state: "away" }, { source: "homeAssistant", state: "away" }] });
  assert.match(away.en, /no device on the home Wi-Fi/);
  assert.match(away.en, /Home Assistant says away/);
  const unknown = model.presenceText({ id: "b", name: "Your brother", nameYue: "你兄弟", configured: true, state: "unknown", sources: [{ source: "wifi", state: "unknown" }] });
  assert.match(unknown.en, /cannot tell/);
  assert.match(model.presenceText({ id: "b", name: "X", nameYue: "X", configured: false, state: "unknown", sources: [] }).en, /no devices or entities/);
  const devices = [{ mac: "AA:AA:AA:AA:AA:01", wireless: false }, { mac: "AA:AA:AA:AA:AA:02", wireless: true }];
  assert.equal(model.wiredOnlyNote({ devices: [{ mac: "AA:AA:AA:AA:AA:01" }] }, devices), true);
  assert.equal(model.wiredOnlyNote({ devices: [{ mac: "AA:AA:AA:AA:AA:01" }, { mac: "AA:AA:AA:AA:AA:02" }] }, devices), false);
  assert.equal(model.wiredOnlyNote({ devices: [] }, devices), false);
});

const view = () => ({
  warm: false,
  accounting: true,
  devices: [
    { ip: "198.51.100.101", mac: "AA:AA:AA:AA:AA:01", name: "Living room TV", up: 50_000, down: 2_500_000, totalUp: 9_000_000, totalDown: 400_000_000, flows: 4 },
    { ip: "198.51.100.102", mac: "AA:AA:AA:AA:AA:02", name: "Phone", up: 700_000, down: 120_000, totalUp: 60_000_000, totalDown: 20_000_000, flows: 8 },
    { ip: "198.51.100.103", mac: "", name: "Speaker", up: 0, down: 0, totalUp: 1_000, totalDown: 2_000, flows: 1 },
    { ip: "198.51.100.20", mac: "AA:AA:AA:AA:AA:03", name: "nas", up: 100_000, down: 800_000, totalUp: 500_000_000, totalDown: 100_000_000, flows: 2 },
  ],
  history: [
    { devices: { "198.51.100.102": { up: 3_000_000, down: 0 }, "198.51.100.101": { up: 0, down: 100_000 } } },
    { devices: { "198.51.100.102": { up: 3_000_000, down: 0 }, "198.51.100.101": { up: 0, down: 100_000 } } },
  ],
});
const members = [{ id: "brother", name: "Your brother", nameYue: "你兄弟", devices: [{ mac: "aa:aa:aa:aa:aa:02", label: "phone" }] }];

test("top talkers: ranked by download, upload and totals, with the owner named", () => {
  const down = model.rankTalkers(view(), members, "down");
  assert.deepEqual(down.map((r) => r.name), ["Living room TV", "nas", "Phone"], "the idle speaker is left out");
  assert.equal(down[0].rank, 1);
  assert.equal(down[0].ratio, 1);
  assert.ok(Math.abs(down.reduce((s, r) => s + r.share, 0) - 1) < 1e-9, "shares add up to the whole");
  assert.equal(down[2].owner.name, "Your brother", "an owner's device carries their name, whatever the MAC letter case");
  assert.equal(down[0].owner, null);
  const up = model.rankTalkers(view(), members, "up");
  assert.equal(up[0].name, "Phone", "upload has its own order");
  const totals = model.rankTalkers(view(), members, "totalUp");
  assert.equal(totals[0].name, "nas");
  assert.equal(model.rankTalkers(view(), members, "down", { idle: true }).length, 4, "idle devices can be shown");
  assert.equal(model.rankTalkers(view(), members, "down", { idle: true, limit: 2 }).length, 2);
  assert.equal(model.rankTalkers({ devices: [] }, members, "down").length, 0);
  assert.equal(model.rankTalkers(view(), members, "nonsense")[0].name, "Living room TV", "an unknown metric falls back to download");
});

test("top talkers: the last-minute view averages the recent readings, so one busy second does not win", () => {
  const avg = model.rankTalkers(view(), members, "up", { average: true });
  assert.equal(avg[0].name, "Phone");
  assert.equal(avg[0].value, 3_000_000, "the average of two equal readings");
  const quiet = [...view().history, { devices: {} }];
  assert.equal(model.recentAverage(quiet, 4).get("198.51.100.102").up, 2_000_000, "a reading with nothing from the device counts as nothing");
  assert.equal(model.recentAverage(quiet, 1).get("198.51.100.102"), undefined, "only the last reading is used when the window is one");
  assert.equal(model.recentAverage([]).size, 0);
});

test("top talkers: people are totalled, and devices nobody owns are grouped together", () => {
  const people = model.rankPeople(view(), members, "totalDown");
  const other = people.find((p) => p.id === "other");
  assert.equal(other.devices, 3);
  assert.equal(other.value, 400_000_000 + 2_000 + 100_000_000);
  assert.equal(people.find((p) => p.id === "brother").value, 20_000_000);
  assert.equal(people[0].id, "other", "the biggest total comes first");
  assert.equal(model.rateText(2_500_000, "down", "bits"), "20 Mbit/s");
  assert.equal(model.rateText(2_500_000, "down", "bytes"), "2.5 MB/s");
  assert.equal(model.rateText(400_000_000, "totalDown"), "400.0 MB");
  assert.equal(model.rateText(2_500_000_000, "totalUp"), "2.50 GB");
  assert.equal(model.rateText(5_000, "totalUp"), "5 kB");
  assert.deepEqual(Object.keys(model.METRICS), ["down", "up", "totalDown", "totalUp"]);
});

test("the household screens exist: people, presence, Home Assistant, home Wi-Fi and the top talkers tab", async () => {
  const index = await readFile(path.join(FEATURES, "household", "index.js"), "utf8");
  for (const tab of ["people", "presence", "homeassistant", "networks", "talkers"]) assert.ok(index.includes(`["${tab}"`), `the ${tab} tab`);
  assert.match(index, /id: "top-talkers"/, "the ranking is also its own screen and workspace tab");
  assert.match(index, /Most brother madness allowed/);
  assert.match(index, /Your brother|brother/);
  const talkers = await readFile(path.join(FEATURES, "household", "talkers.js"), "utf8");
  assert.match(talkers, /api\/x\/device-traffic\/sample/, "it reads the router's connection table through the traffic feature");
  assert.ok(!/ping|arp|lease/i.test(talkers.replace(/Warming up/g, "")), "nothing about presence is tracked from traffic");
  const people = await readFile(path.join(FEATURES, "household", "people.js"), "utf8");
  assert.ok(!/ping\(|navigator\.geolocation|watchPosition/.test(people), "no location and no pings");
  assert.match(people, /No pings, no address tracking, no location, nothing is kept/);
});
