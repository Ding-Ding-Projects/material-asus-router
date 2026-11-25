// Channel analyser: the scan is read from the radio, neighbours are charted by
// channel, the recommendation avoids busy channels, and choosing a channel
// goes through the change engine.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { spanOf } from "../../public/js/features/channel-analyser/index.js";
import { bandOf, interference, overlap, parseScan, recommend, summarise } from "../../server/features/channel-analyser/parse.mjs";
import { startApp } from "../helpers.mjs";

const SAMPLE = `SSID: "Cafe"\nMode: Managed\tRSSI: -48 dBm\tSNR: 30 dB\tnoise: -92 dBm\tChannel: 6\nBSSID: aa:10:00:00:00:01\tCapability: ESS RSN\n\nSSID: ""\nMode: Managed\tRSSI: -74 dBm\tChannel: 36/80\nBSSID: AA:10:00:00:00:05\tCapability: ESS\n\nSSID: "No channel"\nMode: Managed\tRSSI: -70 dBm\n`;

test("channel-analyser: the scan text is parsed and the maths prefers a quiet channel", () => {
  const nets = parseScan(SAMPLE);
  assert.deepEqual(nets.map((n) => [n.ssid, n.rssi, n.channel, n.width, n.secured, n.bssid]), [["Cafe", -48, 6, 20, true, "AA:10:00:00:00:01"], ["", -74, 36, 80, false, "AA:10:00:00:00:05"]]);
  assert.equal(bandOf("2"), "2.4");
  assert.equal(bandOf("1"), "5");
  assert.equal(bandOf("4"), "6");
  assert.equal(overlap("2.4", 1, 6), 0);
  assert.equal(overlap("2.4", 6, 6), 1);
  assert.equal(overlap("5", 36, 40), 0);
  const busy = [{ channel: 6, rssi: -40 }, { channel: 6, rssi: -55 }, { channel: 11, rssi: -80 }];
  assert.ok(interference("2.4", 6, busy) > interference("2.4", 1, busy));
  const pick = recommend("2.4", busy, [1, 6, 11], 6);
  assert.equal(pick.channel, 1);
  assert.equal(pick.keep, false);
  assert.ok(pick.improvement > 90);
  assert.equal(recommend("2.4", busy, [1, 6, 11], 1).keep, true, "already on the quietest channel");
  assert.equal(recommend("2.4", busy, [], 6), null);
  assert.equal(recommend("2.4", busy, [1, 6, 11], null).improvement, null, "automatic channel has nothing to compare");
  assert.deepEqual(summarise("2.4", busy, [1]).map((c) => [c.channel, c.count]), [[1, 0], [6, 2], [11, 1]]);
  assert.deepEqual(spanOf("2.4", { channel: 6 }), { from: 4, to: 8 });
  assert.deepEqual(spanOf("5", { channel: 36, width: 80 }), { from: 28, to: 44 });
});

test("channel-analyser: the routes scan each band, count only what the settings allow and recommend through the change engine", async () => {
  const t = await startApp();
  try {
    const domain = (await t.owner.get("/api/domain/channel-analyser")).data;
    assert.deepEqual(domain.bands.map((b) => [b.index, b.band, b.ifname]), [[0, "2.4", "eth6"], [1, "5", "eth7"]]);
    assert.equal(domain.entries.length, 3);

    const two = (await t.owner.get("/api/x/channel-analyser/scan?band=0&wait=0")).data;
    assert.equal(two.scanned, 6);
    assert.equal(two.counted, 5, "the faint network is under the -85 dBm threshold");
    assert.equal(two.ownChannel, 6);
    assert.deepEqual(two.candidates, [1, 6, 11]);
    assert.equal(two.recommendation.channel, 1);
    assert.equal(two.entryId, "wl0.channel");
    assert.ok(t.router.commands.includes("wl -i 'eth6' scan"));
    assert.ok(t.router.commands.includes("wl -i 'eth6' scanresults"));
    assert.equal(two.channels.find((c) => c.channel === 6).count, 2);

    const five = (await t.owner.get("/api/x/channel-analyser/scan?band=1&wait=0")).data;
    assert.equal(five.networks.length, 3);
    assert.equal(five.ownChannel, 36);
    assert.equal(five.recommendation.channel, 149, "the 5 GHz channels the router offers that nobody uses");

    // Count fewer networks: raise the threshold through the change engine.
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "channel-analyser.min-rssi", value: "-60" }, { id: "channel-analyser.hidden", value: "0" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    const fewer = (await t.owner.get("/api/x/channel-analyser/scan?band=0&wait=0")).data;
    assert.equal(fewer.counted, 2);

    // The recommendation is applied like any other channel edit.
    const change = await t.owner.post("/api/changes/preview", { changes: [{ id: two.entryId, value: String(two.recommendation.channel) }] });
    assert.equal(change.status, 200, change.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: change.data.id })).status, 200);
    assert.equal(t.router.nvram.wl0_chanspec, "1");

    assert.equal((await t.owner.get("/api/x/channel-analyser/scan?band=9&wait=0")).status, 404);
    assert.equal((await t.owner.get("/api/x/channel-analyser/scan?band=x")).status, 400);
    t.router.nvram.wl1_radio = "0";
    assert.equal((await t.owner.get("/api/x/channel-analyser/scan?band=1&wait=0")).status, 409);
  } finally {
    await t.stop();
  }
});

test("channel-analyser: the browser module is well formed", () => {
  assert.equal(checkFeatureModule(feature, "channel-analyser"), null);
});
