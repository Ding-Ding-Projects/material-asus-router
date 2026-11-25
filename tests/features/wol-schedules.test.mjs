// Wake-on-LAN: the grid and its text form agree, the timing logic fires each
// block once at its start minute, the routes keep schedules in the app's own
// state, and a wake goes to the router with the chosen network and repeat.
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/wol-schedules/index.js";
import { CELLS, PRESETS, describe, emptyGrid, gridToSpec, runsOf, slotCount, specToGrid } from "../../public/js/features/wol-schedules/grid.js";
import { createRunner, settingsOf } from "../../server/features/wol-schedules/runner.mjs";
import { dueAt, nextWake, parseSpec } from "../../server/features/wol-schedules/schedule.mjs";
import { featureState } from "../../server/features/wol-schedules/state.mjs";
import { startApp } from "../helpers.mjs";

process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "mar-wol-"));

test("wol-schedules: the grid and the schedule text agree both ways", () => {
  const grid = emptyGrid();
  for (const d of [1, 2, 3, 4, 5]) for (let c = 16; c < 34; c += 1) grid[d][c] = true; // 08:00 to 17:00
  for (let c = 20; c < 24; c += 1) grid[6][c] = true; // 10:00 to 12:00
  assert.equal(gridToSpec(grid), "12345@08:00-17:00,6@10:00-12:00");
  assert.deepEqual(specToGrid("12345@08:00-17:00,6@10:00-12:00"), grid);
  assert.deepEqual(runsOf([false, true, true, false, true]), [[1, 3], [4, 5]]);
  const full = emptyGrid();
  full[0].fill(true);
  assert.equal(gridToSpec(full), "0@00:00-23:59", "a block to the end of the day ends at 23:59");
  assert.deepEqual(specToGrid("0@00:00-23:59")[0], new Array(CELLS).fill(true));
  assert.equal(gridToSpec(emptyGrid()), "");
  assert.equal(slotCount("a,b,c"), 3);
  assert.equal(describe("12@08:00-17:00", (en) => en), "Mon Tue 08:00");
  for (const p of PRESETS) assert.ok(parseSpec(p.spec).length >= 1 && gridToSpec(specToGrid(p.spec)) === p.spec, p.id);
});

test("wol-schedules: a spec is checked and the due blocks are found exactly at their start minute", () => {
  assert.throws(() => parseSpec(""), /Paint/);
  assert.throws(() => parseSpec("9@25:00-26:00"), /not a time block/);
  assert.throws(() => parseSpec("11@08:00-09:00"), /repeats a day/);
  assert.throws(() => parseSpec("1@09:00-08:00"), /end after/);
  const monday = new Date(2026, 10, 23, 8, 0, 20); // Monday 23 November 2026, 08:00:20 local time
  const schedules = [{ id: "a", spec: "12345@08:00-17:00", enabled: true }, { id: "b", spec: "6@08:00-09:00", enabled: true }, { id: "c", spec: "1@08:00-09:00", enabled: false }, { id: "d", spec: "broken", enabled: true }];
  assert.deepEqual(dueAt(schedules, monday).map((x) => x.schedule.id), ["a"]);
  assert.equal(dueAt(schedules, monday)[0].key, "a:2026-11-23:08:00");
  assert.deepEqual(dueAt(schedules, new Date(2026, 10, 23, 8, 1)), []);
  assert.deepEqual(dueAt(schedules, new Date(2026, 10, 28, 8, 0)).map((x) => x.schedule.id), ["b"], "Saturday");
  assert.deepEqual(nextWake("12345@08:00-17:00", new Date(2026, 10, 23, 8, 30)), new Date(2026, 10, 24, 8, 0));
  assert.deepEqual(nextWake("12345@08:00-17:00", new Date(2026, 10, 27, 9, 0)), new Date(2026, 10, 30, 8, 0), "after Friday it waits for Monday");
  assert.equal(nextWake("nonsense", new Date()), null);
});

test("wol-schedules: the runner wakes a due schedule once per minute with the chosen network and repeat", async () => {
  const sent = [];
  const ctx = { nvram: new Map([["mar_wol_iface", "br1"], ["mar_wol_repeat", "3"], ["mar_wol_enabled", "1"]]), exec: async (command) => (sent.push(command), { code: 0, stdout: "", stderr: "" }) };
  const store = featureState("wol-runner-test", { schedules: [], log: [] });
  await store.update((s) => s.schedules.push({ id: "x1", mac: "AC:5A:F0:01:02:03", name: "TV", spec: "12345@08:00-17:00", enabled: true, lastKey: null, lastRun: null }));
  const runner = createRunner({ store });
  const at = new Date(2026, 10, 23, 8, 0, 5);
  assert.equal((await runner.tick(ctx, at)).length, 1);
  assert.deepEqual(sent, Array(3).fill("ether-wake -i br1 AC:5A:F0:01:02:03"));
  assert.equal((await runner.tick(ctx, new Date(2026, 10, 23, 8, 0, 35))).length, 0, "the same minute never fires twice");
  assert.equal((await runner.tick(ctx, new Date(2026, 10, 24, 8, 0, 5))).length, 1, "the next day fires again");
  ctx.nvram.set("mar_wol_enabled", "0");
  assert.equal((await runner.tick(ctx, new Date(2026, 10, 25, 8, 0, 5))).length, 0, "scheduled wakes can be paused");
  const { log, schedules } = await store.read();
  assert.deepEqual(log.map((e) => [e.name, e.source, e.ok, e.iface]), [["TV", "schedule", true, "br1"], ["TV", "schedule", true, "br1"]]);
  assert.equal(schedules[0].lastKey, "x1:2026-11-24:08:00");
  const failing = { ...ctx, exec: async () => ({ code: 1, stdout: "", stderr: "ether-wake: sendto: No such device\n" }) };
  const entry = await runner.wake(failing, "AC:5A:F0:01:02:03", { source: "manual" });
  assert.deepEqual([entry.ok, entry.detail], [false, "ether-wake: sendto: No such device"]);
  assert.deepEqual(settingsOf(new Map([["mar_wol_iface", "eth0"], ["mar_wol_repeat", "99"]])), { iface: "br0", repeat: 2, scheduled: true });
  runner.stop();
});

test("wol-schedules: schedules are kept by the app, shown with the next wake, edited and deleted; a manual wake reaches the router", async () => {
  const t = await startApp();
  try {
    const first = (await t.owner.get("/api/x/wol-schedules/status")).data;
    assert.equal(first.scheduler.running, true);
    assert.deepEqual([first.settings.iface, first.settings.repeat, first.settings.scheduled], ["br0", 2, true]);
    assert.ok(first.devices.some((d) => d.mac === "AC:5A:F0:01:02:03" && d.name === "Living room TV"));

    assert.equal((await t.owner.post("/api/x/wol-schedules/schedules", { mac: "nope", spec: "1@08:00-09:00" })).status, 400);
    assert.equal((await t.owner.post("/api/x/wol-schedules/schedules", { mac: "AC:5A:F0:01:02:03", spec: "1@25:00-26:00" })).status, 400);
    const made = (await t.owner.post("/api/x/wol-schedules/schedules", { mac: "ac:5a:f0:01:02:03", name: "TV", spec: "12345@08:00-17:00" })).data;
    assert.deepEqual([made.mac, made.enabled, typeof made.next], ["AC:5A:F0:01:02:03", true, "string"]);
    const paused = (await t.owner.request("PUT", `/api/x/wol-schedules/schedules/${made.id}`, { enabled: false })).data;
    assert.deepEqual([paused.enabled, paused.next, paused.spec], [false, null, "12345@08:00-17:00"]);
    assert.equal((await t.owner.request("PUT", "/api/x/wol-schedules/schedules/nope", { enabled: true })).status, 404);
    assert.equal((await t.owner.get("/api/x/wol-schedules/status")).data.schedules.length, 1);

    const woke = await t.owner.post("/api/actions/wol-schedules.wake", { mac: "AC:5A:F0:01:02:03", name: "TV" });
    assert.equal(woke.status, 200, woke.text);
    assert.equal(woke.data.ok, true);
    assert.equal(t.router.commands.filter((c) => c === "ether-wake -i br0 AC:5A:F0:01:02:03").length, 2, "two packets, as the setting says");
    const failed = (await t.owner.post("/api/actions/wol-schedules.wake", { mac: "02:00:00:00:00:99" })).data;
    assert.deepEqual([failed.ok, failed.detail], [false, "ether-wake: sendto: No such device"]);
    assert.equal((await t.owner.post("/api/actions/wol-schedules.wake", { mac: "bad" })).status, 400);

    const status = (await t.owner.get("/api/x/wol-schedules/status")).data;
    assert.deepEqual(status.log.map((e) => [e.ok, e.source]), [[false, "manual"], [true, "manual"]], "newest first");

    // The router settings change through the change engine.
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "wol-schedules.iface", value: "br1" }, { id: "wol-schedules.repeat", value: "1" }] });
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    await t.owner.post("/api/actions/wol-schedules.wake", { mac: "AC:5A:F0:01:02:03" });
    assert.equal(t.router.commands.filter((c) => c === "ether-wake -i br1 AC:5A:F0:01:02:03").length, 1);

    assert.equal((await t.owner.request("DELETE", `/api/x/wol-schedules/schedules/${made.id}`)).status, 200);
    assert.equal((await t.owner.request("DELETE", `/api/x/wol-schedules/schedules/${made.id}`)).status, 404);
    assert.equal((await t.owner.request("DELETE", "/api/x/wol-schedules/log")).status, 200);

    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("alex", "viewer password 1");
    assert.equal((await guest.get("/api/x/wol-schedules/status")).status, 200);
    assert.equal((await guest.post("/api/x/wol-schedules/schedules", { mac: "AC:5A:F0:01:02:03", spec: "1@08:00-09:00" })).status, 403);
    assert.equal((await guest.post("/api/actions/wol-schedules.wake", { mac: "AC:5A:F0:01:02:03" })).status, 403);
  } finally {
    await t.stop();
  }
});

test("wol-schedules: the browser module is well formed", () => {
  assert.equal(checkFeatureModule(feature, "wol-schedules"), null);
});
