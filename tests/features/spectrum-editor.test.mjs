// The spectrum editor: the chart geometry, snapping to channels and widths the
// router really offers, and the channel and width edits through the change engine.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/spectrum-editor/index.js";
import { axisRange, crowding, curvePath, halfSpan, mhzOf, nearestChannel, nearestWidth, stepChannel, stepWidth, widthChoices } from "../../public/js/features/spectrum-editor/model.js";
import { startApp, waitFor } from "../helpers.mjs";

test("spectrum-editor: a curve is as wide as the channel it takes and snaps to offered channels", () => {
  assert.equal(halfSpan(20), 2);
  assert.equal(halfSpan(80), 8);
  assert.equal(nearestChannel([0, 1, 6, 11], 8.4), 6);
  assert.equal(nearestChannel([0, 1, 6, 11], 9.6), 11);
  assert.equal(nearestChannel([0], 5), null, "automatic is never a position");
  assert.equal(stepChannel([0, 36, 44, 149], 36, 1), 44);
  assert.equal(stepChannel([0, 36, 44, 149], 149, 1), 149, "it stops at the end");
  assert.equal(stepChannel([0, 36, 44, 149], 40, 1), 36, "an unlisted channel snaps to the nearest offered one");
  const path = curvePath({ centre: 6, width: 20, rssi: -50 }, (c) => c * 10, () => 40, 200);
  assert.match(path, /^M40 200 C40 40 .* 80 200 Z$/);
  assert.deepEqual(axisRange("2.4", [0, 1, 6, 11], [{ channel: 13 }], 6), [-2, 16]);
  assert.deepEqual(axisRange("5", [0, 36, 149], [{ channel: 44 }], 36), [28, 157]);
});

test("spectrum-editor: widths come from the width setting and step through the fixed ones", () => {
  const entry = { options: [["0", { en: "Automatic" }], ["1", { en: "20 MHz" }], ["2", { en: "40 MHz" }], ["3", { en: "80 MHz" }], ["5", { en: "160 MHz" }]] };
  const choices = widthChoices(entry);
  assert.deepEqual(choices.map((c) => c.mhz), [0, 20, 40, 80, 160]);
  assert.equal(mhzOf("80 MHz"), 80);
  assert.equal(mhzOf("Automatic"), 0);
  assert.equal(nearestWidth(choices, 55).mhz, 40);
  assert.equal(nearestWidth(choices, 500).mhz, 160);
  assert.equal(nearestWidth([{ value: "0", mhz: 0 }], 20), null);
  assert.equal(stepWidth(choices, "3", 1).mhz, 160);
  assert.equal(stepWidth(choices, "1", -1).mhz, 20);
  assert.equal(stepWidth(choices, "0", 1).mhz, 20, "from automatic, the first fixed width");
  const summary = [{ channel: 1, interference: 4 }, { channel: 6, interference: 8 }];
  assert.deepEqual([...crowding(summary, [0, 1, 6, 11])], [[1, 0.5], [6, 1], [11, 0]]);
});

test("spectrum-editor: the scan the chart draws comes from the channel analyser and the entries it edits are real", async () => {
  const t = await startApp();
  try {
    const bands = (await t.owner.get("/api/domain/channel-analyser")).data.bands;
    assert.ok(bands.length >= 2);
    const scan = (await t.owner.get(`/api/x/channel-analyser/scan?band=${bands[0].index}`)).data;
    assert.ok(scan.networks.length >= 4 && scan.candidates.length >= 3);
    assert.equal(scan.entryId, `wl${bands[0].index}.channel`);
    const entries = (await t.owner.get("/api/catalog")).data.entries;
    const channel = entries.find((e) => e.id === "wl0.channel");
    const width = entries.find((e) => e.id === "wl0.width");
    assert.deepEqual(channel.options.map(([v]) => v), ["0", "1", "6", "11"]);
    assert.ok(widthChoices(width).some((c) => c.mhz === 40));

    // Drag the curve to channel 11 and widen it to 40 MHz: both are staged, previewed and applied together.
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "wl0.channel", value: "11" }, { id: "wl0.width", value: "2" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal(preview.data.guard.armed, true, "a channel change is a network-risk change, so the safety net is armed");
    const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
    const done = await waitFor(async () => {
      const record = (await t.owner.get(`/api/changes/history/${applied.data.id}`)).data;
      return record.status === "guarded" || record.status === "applying" ? null : record;
    });
    assert.equal(done.status, "applied");
    assert.deepEqual([t.router.nvram.wl0_chanspec, t.router.nvram.wl0_bw], ["11", "2"]);
    // A channel the router does not offer is refused, so a drag can never stage one.
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "wl0.channel", value: "14" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("spectrum-editor: the module is listed and well formed, and needs no drag helper", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/spectrum-editor/index.js"));
    for (const file of ["index.js", "model.js", "style.css"]) assert.equal((await fetch(`${t.base}/js/features/spectrum-editor/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "spectrum-editor"), null);
});
