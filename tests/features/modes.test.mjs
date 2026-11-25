// One-click modes: each mode is a real bundle of catalogue changes that goes
// through the change engine (preview, apply, read back, undo), shows its exact
// old and new values, and reports honestly whether it is on.
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/modes/index.js";
import { PRESETS, cleanParams } from "../../server/features/modes/presets.mjs";
import { isActive, resolveItems, showValue } from "../../server/features/modes/resolve.mjs";
import { startApp, waitFor } from "./../helpers.mjs";

// Every test gets its own data folder, so a mode applied in one test is not remembered in the next.
beforeEach(async () => {
  process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "mar-modes-"));
});

const bad = (message) => Object.assign(new Error(message), { status: 400 });
const modeOf = (list, id) => list.modes.find((m) => m.id === id);
const list = async (t) => (await t.owner.get("/api/x/modes/list")).data;

async function settle(t, record) {
  if (record.status !== "guarded" && record.status !== "applying") return record;
  return waitFor(async () => {
    const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
    return next.status !== "guarded" && next.status !== "applying" ? next : null;
  });
}

// What the browser does: preview the mode, apply the engine preview, then confirm.
async function run(t, id, action = "apply", params) {
  const previewed = await t.owner.post("/api/x/modes/preview", { id, action, params });
  assert.equal(previewed.status, 200, previewed.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: previewed.data.preview.id });
  assert.equal(applied.status, 200, applied.text);
  const record = await settle(t, applied.data);
  assert.equal(record.status, "applied", `the change ended as ${record.status}`);
  const confirmed = await t.owner.post("/api/x/modes/confirm", { previewId: previewed.data.preview.id });
  assert.equal(confirmed.status, 200, confirmed.text);
  return { previewed: previewed.data, confirmed: confirmed.data };
}

test("modes: the seven ready-made modes are listed with exact items and are all off at first", async () => {
  const t = await startApp();
  try {
    const data = await list(t);
    assert.deepEqual(data.modes.map((m) => m.id), ["gaming", "bedtime", "guest", "wfh", "privacy", "lockdown", "away"]);
    assert.equal(data.active, 0);
    for (const mode of data.modes) {
      assert.ok(mode.name.en && mode.name.yue && mode.about.en && mode.about.yue, `${mode.id} has English and Cantonese text`);
      assert.equal(mode.active, false);
      assert.equal(mode.canUndo, false);
    }
    const gaming = modeOf(data, "gaming");
    assert.deepEqual(gaming.items.map((i) => [i.id, i.now.en, i.to.en]), [["qos.enabled", "Off", "On"], ["qos.type", "Adaptive (by app type)", "Adaptive (by app type)"], ["routing.upnp", "On", "On"]]);
    assert.equal(modeOf(data, "bedtime").needsChoice, true, "Bedtime needs devices before it can do anything");
    // The guest mode follows the router's bands: a guest network, a four hour limit, no access to home devices, on each band.
    assert.deepEqual(modeOf(data, "guest").items.map((i) => i.key), ["wl0.1_bss_enabled", "wl0.1_expire", "wl0.1_lanaccess", "wl1.1_bss_enabled", "wl1.1_expire", "wl1.1_lanaccess"]);
  } finally {
    await t.stop();
  }
});

test("modes: Gaming applies through the change engine, reads back as on, and undoes in one step", async () => {
  const t = await startApp();
  try {
    const before = { ...t.router.nvram };
    const { previewed, confirmed } = await run(t, "gaming", "apply", { console: "198.51.100.77" });
    assert.equal(confirmed.active, true);
    assert.equal(confirmed.recorded, true);
    assert.equal(t.router.nvram.qos_enable, "1");
    assert.equal(t.router.nvram.qos_type, "0");
    assert.equal(t.router.nvram.upnp_enable, "1");
    assert.match(t.router.nvram.qos_rulelist, /^<Game console>198\.51\.100\.77>>any>>0<Web Surf>/, "the console rule goes first and the old rules stay");
    assert.deepEqual(previewed.display.map((d) => [d.key, d.old.en, d.new.en]).slice(0, 2), [["qos_enable", "Off", "On"], ["qos_type", "Adaptive (by app type)", "Traditional (by rules)"]]);

    const after = await list(t);
    const gaming = modeOf(after, "gaming");
    assert.equal(gaming.active, true);
    assert.equal(gaming.canUndo, true);
    assert.equal(gaming.params.console, "198.51.100.77");
    assert.equal(after.active, 1);

    // Applying it again has nothing to change, and says so.
    assert.equal((await t.owner.post("/api/x/modes/preview", { id: "gaming", action: "apply" })).status, 409);

    const undone = await run(t, "gaming", "undo");
    assert.equal(undone.confirmed.recorded, true);
    for (const key of ["qos_enable", "qos_type", "upnp_enable", "qos_rulelist"]) assert.equal(t.router.nvram[key], before[key], `${key} is back`);
    const last = modeOf(await list(t), "gaming");
    assert.equal(last.active, false);
    assert.equal(last.canUndo, false);
    assert.equal((await t.owner.post("/api/x/modes/preview", { id: "gaming", action: "undo" })).status, 409, "nothing left to undo");
  } finally {
    await t.stop();
  }
});

test("modes: Bedtime schedules the chosen devices and keeps the ones already listed", async () => {
  const t = await startApp();
  try {
    const first = await t.owner.post("/api/x/modes/preview", { id: "bedtime", action: "apply", params: { devices: [] } });
    assert.equal(first.status, 409, first.text);
    const wrong = await t.owner.post("/api/x/modes/preview", { id: "bedtime", action: "apply", params: { devices: [{ mac: "nope" }] } });
    assert.equal(wrong.status, 400);

    t.router.nvram.MULTIFILTER_MAC = "02:00:00:00:00:01";
    t.router.nvram.MULTIFILTER_ENABLE = "2";
    t.router.nvram.MULTIFILTER_DEVICENAME = "Old Tablet";
    t.router.nvram.MULTIFILTER_MACFILTER_DAYTIME = "";
    const devices = [{ mac: "02:00:00:00:00:01", name: "Old Tablet" }, { mac: "02:00:00:00:00:02", name: "Alex Phone" }];
    const { confirmed } = await run(t, "bedtime", "apply", { devices, from: "21:30", to: "07:00" });
    assert.equal(confirmed.active, true);
    assert.equal(t.router.nvram.MULTIFILTER_ALL, "1");
    assert.equal(t.router.nvram.MULTIFILTER_MAC, "02:00:00:00:00:01>02:00:00:00:00:02");
    assert.equal(t.router.nvram.MULTIFILTER_ENABLE, "2>1", "a device that is always blocked stays always blocked");
    assert.equal(t.router.nvram.MULTIFILTER_DEVICENAME, "Old Tablet>Alex Phone");
    assert.equal(t.router.nvram.MULTIFILTER_MACFILTER_DAYTIME, "W07F21300700>W07F21300700");

    const bedtime = modeOf(await list(t), "bedtime");
    assert.equal(bedtime.active, true);
    assert.equal(bedtime.items.filter((i) => !i.hidden).length, 2, "the helper lists are not shown as separate rows");
    assert.match(bedtime.items.find((i) => i.id === "parental-pro.macs").to.en, /Old Tablet, Alex Phone, off 21:30 to 07:00/);

    await run(t, "bedtime", "undo");
    assert.equal(t.router.nvram.MULTIFILTER_MAC, "02:00:00:00:00:01");
    assert.equal(t.router.nvram.MULTIFILTER_MACFILTER_DAYTIME, "");
  } finally {
    await t.stop();
  }
});

test("modes: Guest party, Work from home, Lock it down, Privacy DNS and Away each change exactly their settings", async () => {
  const t = await startApp();
  try {
    await run(t, "guest");
    for (const band of [0, 1]) {
      assert.equal(t.router.nvram[`wl${band}.1_bss_enabled`], "1");
      assert.equal(t.router.nvram[`wl${band}.1_expire`], "14400");
      assert.equal(t.router.nvram[`wl${band}.1_lanaccess`], "off");
    }
    assert.equal(modeOf(await list(t), "guest").active, true);

    await run(t, "wfh");
    assert.equal(t.router.nvram.qos_type, "1");
    assert.equal(t.router.nvram.qos_enable, "1");

    t.router.nvram.misc_http_x = "1";
    await run(t, "lockdown");
    assert.equal(t.router.nvram.wps_enable, "0");
    assert.equal(t.router.nvram.wl0_wps_mode, "disabled");
    assert.equal(t.router.nvram.misc_http_x, "0");
    assert.equal(t.router.nvram.wl0_auth_mode_x, "psk2sae");

    const privacy = await run(t, "privacy", "apply", { resolver: "cloudflare" });
    assert.equal(privacy.confirmed.active, true);
    assert.equal(t.router.nvram.dnspriv_enable, "1");
    assert.equal(t.router.nvram.dnspriv_profile, "1");
    assert.equal(t.router.nvram.dnspriv_rulelist, "<1.1.1.1>853>cloudflare-dns.com>");

    await run(t, "away", "apply", { from: "08:00", minutes: "30" });
    assert.equal(t.router.nvram.wl0_timesched, "1");
    assert.equal(t.router.nvram.wl0_sched, "0123456@08:00-08:30");
    assert.equal(t.router.nvram.mar_wol_enabled, "0");
    assert.equal((await t.owner.post("/api/x/modes/preview", { id: "away", action: "apply", params: { from: "23:30", minutes: "120" } })).status, 400, "a window may not run past midnight");

    // Gaming without a console and Work from home ask for the same priority settings, so both read as on.
    assert.deepEqual((await list(t)).modes.filter((m) => m.active).map((m) => m.id), ["gaming", "guest", "wfh", "privacy", "lockdown", "away"]);
  } finally {
    await t.stop();
  }
});

test("modes: a setting the router does not have is shown as unavailable and never written", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const privacy = modeOf(await list(t), "privacy");
    assert.equal(privacy.usable, 0);
    assert.match(privacy.items[0].unavailable.en, /Merlin/);
    assert.match(privacy.blockedBy.en, /Merlin/, "a mode whose main settings are missing says why it cannot be used");
    assert.equal(privacy.active, false);
    const refused = await t.owner.post("/api/x/modes/preview", { id: "privacy", action: "apply" });
    assert.equal(refused.status, 409);

    delete t.router.nvram["wl1.1_expire"];
    const guest = modeOf(await list(t), "guest");
    const expire = guest.items.find((i) => i.key === "wl1.1_expire");
    assert.equal(expire.unavailable.en, "This router does not have the setting wl1.1_expire");
    assert.ok(expire.unavailable.yue.includes("wl1.1_expire"));
    // The rest of the mode still works, and the missing key is never written.
    await run(t, "guest");
    assert.equal(t.router.nvram["wl1.1_bss_enabled"], "1");
    assert.equal("wl1.1_expire" in t.router.nvram, false);
    assert.equal(modeOf(await list(t), "guest").active, true, "on means every setting the router can take is in place");
  } finally {
    await t.stop();
  }
});

test("modes: a refusal from the engine reaches the browser as a message, and viewers can only read", async () => {
  const t = await startApp();
  try {
    const laptop = "02:00:00:00:00:09";
    const stale = await t.owner.post("/api/x/modes/preview", { id: "wfh", action: "apply", params: { laptop } });
    assert.equal(stale.status, 200);
    t.router.nvram.qos_enable = "1"; // the router changed after the preview
    const refused = await t.owner.post("/api/changes/apply", { previewId: stale.data.preview.id });
    assert.equal(refused.status, 409);
    assert.match(refused.data.error ?? refused.text, /changed on the router since the preview/);
    assert.equal((await t.owner.post("/api/x/modes/confirm", { previewId: stale.data.preview.id })).data.active, false, "an unapplied mode is not remembered as applied");
    assert.equal(modeOf(await list(t), "wfh").canUndo, false);

    assert.equal((await t.client().get("/api/x/modes/list")).status, 401);
    assert.equal((await t.owner.post("/api/x/modes/preview", { id: "wfh", action: "apply" }, { csrf: "wrong" })).status, 403);
    assert.equal((await t.owner.post("/api/x/modes/preview", { id: "nothing", action: "apply" })).status, 404);
    assert.equal((await t.owner.post("/api/x/modes/preview", { id: "wfh", action: "dance" })).status, 400);
    assert.equal((await t.owner.post("/api/x/modes/preview", { id: "gaming", action: "apply", params: { console: "not a device" } })).status, 400);

    assert.equal((await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" })).status, 201);
    const viewer = t.client();
    assert.equal((await viewer.signIn("vi", "viewer password 1")).status, 200);
    assert.equal((await viewer.get("/api/x/modes/list")).status, 200);
    assert.equal((await viewer.post("/api/x/modes/preview", { id: "wfh", action: "apply" })).status, 403);
    assert.equal((await viewer.post("/api/x/modes/confirm", { previewId: "x" })).status, 403);
    assert.equal((await viewer.post("/api/x/modes/params/gaming", { params: {} })).status, 403);
  } finally {
    await t.stop();
  }
});

test("modes: choices are remembered, and the helpers behave", async () => {
  const t = await startApp();
  try {
    const saved = await t.owner.post("/api/x/modes/params/gaming", { params: { console: "02:aa:bb:cc:dd:ee" } });
    assert.equal(saved.status, 200, saved.text);
    assert.equal(modeOf(await list(t), "gaming").params.console, "02:AA:BB:CC:DD:EE");
    assert.equal((await t.owner.post("/api/x/modes/params/nothing", { params: {} })).status, 404);
  } finally {
    await t.stop();
  }

  assert.throws(() => cleanParams(PRESETS.find((p) => p.id === "privacy").params, { resolver: "nope" }, bad), /choose one/);
  assert.deepEqual(cleanParams(PRESETS.find((p) => p.id === "away").params, {}, bad), { from: "08:00", minutes: "60" });
  const entry = { id: "a", key: "k", control: "switch", values: { on: "1", off: "0" }, label: { en: "A", yue: "A" } };
  const items = resolveItems([{ id: "a", value: "1" }, { id: "gone", key: "x_y", value: "1" }], { catalog: [entry], nvram: new Map([["k", "1"]]) });
  assert.equal(isActive(items), true, "unavailable items do not count against a mode");
  assert.equal(items[1].unavailable.en, "This router does not have the setting x_y");
  assert.equal(isActive([]), false, "an empty mode is never on");
  assert.equal(showValue(entry, "0").en, "Off");
  assert.equal(showValue(undefined, null).yue, "未設定");
});

test("modes: the manifest lists the browser module and it is well formed", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/modes/index.js"));
    assert.ok(manifest.styles.includes("/js/features/modes/style.css"));
    assert.ok(manifest.server.includes("modes"));
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "modes"), null);
});
