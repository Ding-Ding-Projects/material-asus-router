// The schedule painter: the grid model (parental slots and the Wi-Fi schedule
// text), painting and keyboard helpers, and the real entries it writes through
// the change engine.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/schedule-paint/index.js";
import { COLUMN_KEYS, ENTRY_IDS, PRESETS, countOn, emptyGrid, gridToSchedule, gridToSlots, moveFocus, paint, parseSlot, readDevices, rectangle, scheduleToGrid, slotsToGrid, toggleDay, toggleHour, writeDevices, formatSlot } from "../../public/js/features/schedule-paint/model.js";
import { startApp } from "../helpers.mjs";

test("schedule-paint: parental slots and the grid convert both ways, including overnight", () => {
  const nights = gridToSlots(PRESETS.nights.build());
  const back = slotsToGrid(nights);
  assert.equal(back.exact, true);
  assert.deepEqual(back.grid, PRESETS.nights.build());
  assert.equal(countOn(PRESETS.nights.build()), 7 * 9);
  // An overnight slot from the router fills the evening and the next morning.
  const { grid } = slotsToGrid([parseSlot("W03E21000700")]);
  assert.equal(grid[1][21], true, "Monday evening");
  assert.equal(grid[2][3], true, "Tuesday early morning is the same night");
  assert.equal(grid[1][3], false);
  assert.equal(slotsToGrid([parseSlot("W03E21300700")]).exact, false, "a half hour start is flagged");
  assert.equal(formatSlot({ days: [1, 2], start: "2100", end: "0700" }), "W006" + "21000700");
  assert.equal(parseSlot("W00021000700"), null);
});

test("schedule-paint: the four router lists read and write the same devices", () => {
  const devices = [{ mac: "AA:BB:CC:DD:EE:01", mode: "1", name: "Tablet", slots: [parseSlot("W03E21000700")] }, { mac: "AA:BB:CC:DD:EE:02", mode: "2", name: "TV", slots: [] }, { mac: "AA:BB:CC:DD:EE:03", mode: "0", name: "Gone", slots: [] }];
  const values = writeDevices(devices);
  assert.equal(values[COLUMN_KEYS.mac], "AA:BB:CC:DD:EE:01>AA:BB:CC:DD:EE:02");
  assert.equal(values[COLUMN_KEYS.mode], "1>2");
  assert.deepEqual(readDevices((key) => values[key]), devices.slice(0, 2));
  assert.deepEqual(Object.values(ENTRY_IDS).sort(), ["parental-pro.daytime", "parental-pro.macs", "parental-pro.modes", "parental-pro.names"]);
});

test("schedule-paint: the Wi-Fi schedule text and the grid convert both ways", () => {
  const { grid, exact } = scheduleToGrid("12345@08:00-17:00,06@10:00-12:00");
  assert.equal(exact, true);
  assert.equal(grid[1][8], true);
  assert.equal(grid[1][16], true);
  assert.equal(grid[1][17], false);
  assert.equal(grid[0][10], true);
  assert.equal(countOn(grid), 5 * 9 + 2 * 2);
  assert.equal(gridToSchedule(grid), "06@10:00-12:00,12345@08:00-17:00", "Sunday comes first");
  assert.deepEqual(scheduleToGrid(gridToSchedule(grid)).grid, grid);
  assert.equal(gridToSchedule(emptyGrid()), "");
  assert.equal(gridToSchedule(PRESETS.always.build()), "0123456@00:00-23:59");
  assert.equal(scheduleToGrid("0123456@07:00-23:00").exact, true);
  assert.equal(scheduleToGrid("1@07:30-09:00").exact, false);
  assert.equal(scheduleToGrid("garbage").exact, false);
});

test("schedule-paint: painting, whole row and column toggles and keyboard movement", () => {
  let grid = emptyGrid();
  grid = paint(grid, [[1, 3], [1, 4], [9, 9]], true);
  assert.equal(countOn(grid), 2, "a cell outside the grid is ignored");
  assert.equal(emptyGrid()[1][3], false, "painting never changes the grid it was given");
  grid = toggleDay(grid, 1);
  assert.equal(grid[1].every(Boolean), true);
  assert.equal(toggleDay(grid, 1)[1].some(Boolean), false, "a full row clears");
  assert.equal(toggleHour(emptyGrid(), 5).every((row) => row[5]), true);
  assert.equal(rectangle([1, 3], [2, 5]).length, 6);
  assert.deepEqual(moveFocus([0, 0], "ArrowLeft"), [0, 23]);
  assert.deepEqual(moveFocus([6, 5], "ArrowDown"), [0, 5]);
  assert.deepEqual(moveFocus([0, 5], "ArrowUp"), [6, 5]);
  assert.deepEqual(moveFocus([2, 9], "End"), [2, 23]);
  assert.deepEqual(moveFocus([2, 9], "x"), [2, 9]);
});

test("schedule-paint: a painted schedule goes through the change engine for devices and Wi-Fi", async () => {
  const t = await startApp();
  try {
    const catalog = (await t.owner.get("/api/catalog")).data.entries;
    for (const id of Object.values(ENTRY_IDS)) assert.ok(catalog.some((e) => e.id === id), id);
    const wifi = catalog.find((e) => e.id === "wifi-pro.wl0.sched");
    assert.equal(wifi.control, "schedule");
    assert.ok(wifi.meta.note.en, "the entry says its on-disk format is not confirmed on hardware, and the screen shows that");

    const slots = gridToSlots(PRESETS.schoolNights.build());
    const values = writeDevices([{ mac: "AC:5A:F0:01:02:03", mode: "1", name: "Living room TV", slots }]);
    const text = gridToSchedule(PRESETS.daytime.build());
    const preview = await t.owner.post("/api/changes/preview", { changes: [
      ...Object.entries(ENTRY_IDS).map(([name, id]) => ({ id, value: values[COLUMN_KEYS[name]] })),
      { id: "wifi-pro.wl0.sched", value: text },
      { id: "wifi-pro.wl0.sched-on", value: "1" },
    ] });
    assert.equal(preview.status, 200, preview.text);
    const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
    assert.equal(applied.status, 200, applied.text);
    assert.equal(t.router.nvram.wl0_sched, "12345@08:00-17:00");
    assert.equal(t.router.nvram.wl0_timesched, "1");
    const domain = (await t.owner.get("/api/domain/parental-pro")).data;
    assert.deepEqual(domain.devices.map((d) => [d.mac, d.mode, d.slots.length]), [["AC:5A:F0:01:02:03", "1", slots.length]]);
    // An empty Wi-Fi schedule is refused by the engine, so the screen never stages one.
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "wifi-pro.wl0.sched", value: "" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("schedule-paint: the module is listed, well formed and keeps its parts", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/schedule-paint/index.js"));
    for (const file of ["index.js", "model.js", "style.css"]) assert.equal((await fetch(`${t.base}/js/features/schedule-paint/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "schedule-paint"), null);
});
