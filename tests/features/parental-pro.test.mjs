// Tests for the parental-pro feature: the four device lists (read, preview,
// apply, read back, undo), the /device route that changes them together, the
// slot format, the week-grid model the screen uses (and that it matches the
// server), the gated web and apps filters, and the browser module.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature, { gridEditor } from "../../public/js/features/parental-pro/index.js";
import * as model from "../../public/js/features/parental-pro/model.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import * as server from "../../server/features/parental-pro/columns.mjs";
import { isSecretKey } from "../../server/router/secrets.mjs";
import { startApp, waitFor } from "../helpers.mjs";

async function settle(t, record) {
  if (record.status !== "guarded" && record.status !== "applying") return record;
  return waitFor(async () => {
    const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
    return next.status !== "guarded" && next.status !== "applying" ? next : null;
  });
}

async function apply(t, preview) {
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  const record = await settle(t, applied.data);
  assert.equal(record.status, "applied", JSON.stringify(record));
  return record;
}

const change = (t, changes) => t.owner.post("/api/changes/preview", { changes }).then((p) => apply(t, p));
const device = (t, body) => t.owner.post("/api/x/parental-pro/device", body);
const lists = (t) => ({ mac: t.router.nvram.MULTIFILTER_MAC, mode: t.router.nvram.MULTIFILTER_ENABLE, name: t.router.nvram.MULTIFILTER_DEVICENAME, daytime: t.router.nvram.MULTIFILTER_MACFILTER_DAYTIME });

test("parental-pro: the four lists are real entries that read, apply, read back and undo", async () => {
  const t = await startApp();
  try {
    const entries = (await t.owner.get("/api/domain/parental-pro")).data.entries.filter((e) => e.group === "devices");
    assert.deepEqual(entries.map((e) => [e.id, e.key, e.control]), [
      ["parental-pro.macs", "MULTIFILTER_MAC", "column-list"],
      ["parental-pro.modes", "MULTIFILTER_ENABLE", "column-list"],
      ["parental-pro.names", "MULTIFILTER_DEVICENAME", "column-list"],
      ["parental-pro.daytime", "MULTIFILTER_MACFILTER_DAYTIME", "column-list"],
    ]);
    for (const e of entries) assert.equal(isSecretKey(e.key), false);
    const record = await change(t, [
      { id: "parental-pro.macs", value: "aa:bb:cc:dd:ee:01>AA:BB:CC:DD:EE:02" },
      { id: "parental-pro.modes", value: "1>2" },
      { id: "parental-pro.names", value: "Alex laptop>Pat tablet" },
      { id: "parental-pro.daytime", value: "W03E21000700<W04122000800>" },
    ]);
    assert.deepEqual(lists(t), { mac: "AA:BB:CC:DD:EE:01>AA:BB:CC:DD:EE:02", mode: "1>2", name: "Alex laptop>Pat tablet", daytime: "W03E21000700<W04122000800>" });
    assert.equal((await t.owner.get("/api/domain/parental-pro")).data.entries.find((e) => e.id === "parental-pro.modes").value, "1>2");
    const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
    await apply(t, undo);
    assert.deepEqual(lists(t), { mac: "", mode: "", name: "", daytime: "" });
  } finally {
    await t.stop();
  }
});

test("parental-pro: bad device lists are refused", async () => {
  const t = await startApp();
  try {
    const refuse = async (id, value) => assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id, value }] })).status, 400, `${id} should refuse ${value}`);
    await refuse("parental-pro.macs", "not-a-mac");
    await refuse("parental-pro.macs", "AA:BB:CC:DD:EE:01>aa:bb:cc:dd:ee:01"); // repeated device
    await refuse("parental-pro.modes", "3");
    await refuse("parental-pro.names", "<script>");
    await refuse("parental-pro.daytime", "W03E25000700"); // 25:00 is not a time
    await refuse("parental-pro.daytime", "W00021000700"); // no days
    await refuse("parental-pro.daytime", "W03E21002100"); // starts and ends together
    await refuse("parental-pro.daytime", "Monday 9 to 5");
    await refuse("parental-pro.macs", Array.from({ length: 65 }, (_, i) => `02:00:00:00:00:${i.toString(16).padStart(2, "0")}`).join(">"));
  } finally {
    await t.stop();
  }
});

test("parental-pro: the device route sets a schedule in all four lists at once, and removes a device", async () => {
  const t = await startApp();
  try {
    const slots = [{ days: [1, 2, 3, 4, 5], start: "2100", end: "0700" }, { days: [0, 6], start: "2200", end: "0800" }];
    const preview = await device(t, { mac: "f0:18:98:aa:bb:01", name: "Pats-iPhone", mode: "1", slots });
    assert.deepEqual(preview.data.items.map((i) => i.key).sort(), ["MULTIFILTER_DEVICENAME", "MULTIFILTER_ENABLE", "MULTIFILTER_MAC", "MULTIFILTER_MACFILTER_DAYTIME"]);
    await apply(t, preview);
    assert.deepEqual(lists(t), { mac: "F0:18:98:AA:BB:01", mode: "1", name: "Pats-iPhone", daytime: "W03E21000700<W04122000800" });
    assert.ok(t.router.services.includes("restart_firewall"));

    // A second device: always blocked, no schedule. The first one is kept.
    await apply(t, await device(t, { mac: "3C:22:FB:10:20:30", mode: "2" }));
    assert.deepEqual(lists(t), { mac: "F0:18:98:AA:BB:01>3C:22:FB:10:20:30", mode: "1>2", name: "Pats-iPhone>", daytime: "W03E21000700<W04122000800>" });

    const domain = (await t.owner.get("/api/domain/parental-pro")).data;
    assert.deepEqual(domain.devices.map((d) => [d.mac, d.mode, d.name, d.ip, d.slots.length]), [
      ["F0:18:98:AA:BB:01", "1", "Pats-iPhone", "198.51.100.102", 2],
      ["3C:22:FB:10:20:30", "2", "kitchen-speaker", "198.51.100.103", 0],
    ]);
    assert.deepEqual(domain.devices[0].slots[0], { days: [1, 2, 3, 4, 5], start: "2100", end: "0700" });
    assert.equal(domain.known.length, 5, "the router's known devices are listed for the picker");

    // Change the first device to always blocked: its slots go, the other device stays.
    await apply(t, await device(t, { mac: "F0:18:98:AA:BB:01", mode: "2" }));
    assert.equal(lists(t).daytime, ">");
    // Remove the second device.
    await apply(t, await device(t, { mac: "3C:22:FB:10:20:30", mode: "0" }));
    assert.deepEqual(lists(t), { mac: "F0:18:98:AA:BB:01", mode: "2", name: "Pats-iPhone", daytime: "" });
  } finally {
    await t.stop();
  }
});

test("parental-pro: the device route refuses bad input and respects roles", async () => {
  const t = await startApp();
  try {
    assert.equal((await device(t, { mac: "nope", mode: "2" })).status, 400);
    assert.equal((await device(t, { mac: "AA:BB:CC:DD:EE:01", mode: "9" })).status, 400);
    assert.equal((await device(t, { mac: "AA:BB:CC:DD:EE:01", mode: "1", slots: [] })).status, 400, "a schedule needs at least one blocked time");
    assert.equal((await device(t, { mac: "AA:BB:CC:DD:EE:01", mode: "1", slots: [{ days: [9], start: "2100", end: "0700" }] })).status, 400);
    assert.equal((await device(t, { mac: "AA:BB:CC:DD:EE:01", mode: "1", slots: [{ days: [1], start: "2500", end: "0700" }] })).status, 400, "25:00 is refused by the setting's own check");
    assert.equal((await device(t, { mac: "AA:BB:CC:DD:EE:01", mode: "0" })).status, 404, "removing a device with no rule");
    assert.equal((await t.owner.post("/api/x/parental-pro/device", { mac: "AA:BB:CC:DD:EE:01", mode: "2" }, { csrf: "wrong" })).status, 403, "a write needs the CSRF token");
  } finally {
    await t.stop();
  }
});

test("parental-pro: viewers cannot use the device route and the route needs a session", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().post("/api/x/parental-pro/device", { mac: "AA:BB:CC:DD:EE:01", mode: "2" })).status, 401);
    assert.equal((await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "viewer password 1", role: "viewer" })).status, 201);
    const guest = t.client();
    await guest.signIn("alex", "viewer password 1");
    assert.equal((await guest.get("/api/domain/parental-pro")).status, 200, "viewers may read the screen");
    assert.equal((await guest.post("/api/x/parental-pro/device", { mac: "AA:BB:CC:DD:EE:01", mode: "2" })).status, 403);
  } finally {
    await t.stop();
  }
});

test("parental-pro: web and apps filters work on a bwdpi model and are visible but disabled without it", async () => {
  const t = await startApp();
  try {
    let web = (await t.owner.get("/api/domain/parental-pro")).data;
    assert.equal(web.webSupported, true);
    assert.deepEqual(web.entries.filter((e) => e.group === "web").map((e) => [e.id, e.control, e.value]), [
      ["parental-pro.web.enable", "switch", "0"],
      ["parental-pro.web.apps", "switch", "0"],
      ["parental-pro.web.categories", "chips", "1>3"],
    ]);
    for (const e of web.entries.filter((x) => x.group === "web")) assert.ok(e.meta.note.yue, "an unverified setting says so in both languages");
    await change(t, [{ id: "parental-pro.web.enable", value: "1" }, { id: "parental-pro.web.categories", value: "1>3>7" }]);
    assert.deepEqual([t.router.nvram.wrs_enable, t.router.nvram.wrs_rulelist], ["1", "1>3>7"]);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "parental-pro.web.categories", value: "99" }] })).status, 400);

    t.router.nvram.rc_support = "2.4G 5G usbX1";
    web = (await t.owner.get("/api/domain/parental-pro")).data;
    assert.equal(web.webSupported, false);
    assert.match(web.webReason.en, /bwdpi/);
    for (const e of web.entries.filter((x) => x.group === "web")) assert.ok(e.disabled?.en.includes("bwdpi"), e.id);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "parental-pro.web.apps", value: "1" }] })).status, 400);
    // The device lists do not depend on the engine.
    await apply(t, await device(t, { mac: "AA:BB:CC:DD:EE:01", mode: "2" }));
  } finally {
    await t.stop();
  }
});

test("parental-pro: the slot format round-trips and the client model equals the server", () => {
  const mon_fri_night = model.parseSlot("W03E21000700");
  assert.deepEqual(mon_fri_night, { days: [1, 2, 3, 4, 5], start: "2100", end: "0700" });
  assert.deepEqual(model.parseSlot("W041" + "22000800"), { days: [0, 6], start: "2200", end: "0800" });
  for (const bad of ["", "W000" + "21000700", "W03E" + "21002100", "W03E" + "25000700", "X03E21000700", "W03E2100"]) assert.equal(model.parseSlot(bad), null, bad);
  assert.equal(model.formatSlot(mon_fri_night), "W03E21000700");
  assert.deepEqual(server.parseSlot("W03E21000700"), mon_fri_night);
  assert.equal(server.formatSlot(mon_fri_night), model.formatSlot(mon_fri_night));

  const devices = [
    { mac: "AA:BB:CC:DD:EE:01", mode: "1", name: "Alex laptop", slots: [mon_fri_night, { days: [0, 6], start: "2200", end: "0800" }] },
    { mac: "AA:BB:CC:DD:EE:02", mode: "2", name: "", slots: [] },
  ];
  assert.deepEqual(model.writeDevices(devices), server.writeDevices(devices));
  const written = model.writeDevices(devices);
  const get = (key) => written[key] ?? "";
  assert.deepEqual(model.readDevices(get), devices);
  assert.deepEqual(server.readDevices(get), devices);
  assert.equal(model.writeDevices([{ ...devices[0], mode: "0" }, devices[1]])["MULTIFILTER_MAC"], "AA:BB:CC:DD:EE:02", "a device with no rule is left out");
});

test("parental-pro: the week grid model turns slots into hours and back, including overnight windows", () => {
  const { grid, exact } = model.slotsToGrid([{ days: [1, 2, 3, 4, 5], start: "2100", end: "0700" }]);
  assert.equal(exact, true);
  // Monday 21:00 to 24:00 is blocked, and Tuesday 00:00 to 07:00 follows it.
  assert.deepEqual([grid[1][20], grid[1][21], grid[1][23], grid[2][0], grid[2][6], grid[2][7]], [false, true, true, true, true, false]);
  assert.equal(grid[0][23], false, "Sunday night is not part of Monday to Friday");
  assert.equal(grid[6][3], true, "Friday night runs into Saturday morning");
  assert.equal(model.blockedHours(grid), 5 * 10);

  const back = model.gridToSlots(grid);
  const again = model.slotsToGrid(back).grid;
  assert.deepEqual(again, grid, "the grid survives a round trip through slots");
  for (const slot of back) assert.equal(model.parseSlot(model.formatSlot(slot)) !== null, true, "every slot is valid");

  const whole = model.slotsToGrid([{ days: [3], start: "0000", end: "2359" }]);
  assert.equal(whole.grid[3].every(Boolean), true);
  assert.deepEqual(model.gridToSlots(whole.grid), [{ days: [3], start: "0000", end: "2359" }]);
  assert.equal(model.slotsToGrid([{ days: [1], start: "2130", end: "0645" }]).exact, false, "windows off the hour are flagged");
  assert.deepEqual(model.gridToSlots(Array.from({ length: 7 }, () => new Array(24).fill(false))), []);
  assert.equal(model.describeSlot(mon(), ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]), "Mon, Tue 21:00-07:00");
});

const mon = () => ({ days: [1, 2], start: "2100", end: "0700" });

test("parental-pro: the browser module is well formed", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/parental-pro/index.js"));
    assert.ok(manifest.styles.includes("/js/features/parental-pro/style.css"));
    for (const file of ["index.js", "model.js", "style.css"]) assert.equal((await fetch(`${t.base}/js/features/parental-pro/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "parental-pro"), null);
  assert.deepEqual(Object.keys(feature.controls), ["column-list"]);
  assert.equal(feature.screens[0].id, "parental-pro");
  assert.equal(typeof gridEditor, "function");
});
