// Wi-Fi advanced gaps: Smart Connect is shown but never edited, 6 GHz and Wi-Fi 7
// are gated by what the router really has, MLO is a real control that refuses a
// setting the router does not list, and the operation mode changes only as a
// destructive change: model typed, button held, one restart, read back, undone.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/wifi-advanced-gaps/index.js";
import { MODES, availability, currentMode, writesFor } from "../../server/features/wifi-advanced-gaps/modes.mjs";
import { startApp, waitFor } from "../helpers.mjs";

const settle = (t, record) =>
  waitFor(async () => {
    const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
    return next.status !== "guarded" && next.status !== "applying" ? next : null;
  });

const MODEL = "RT-AX86U";
const ask = (t, mode, extra = { confirm: MODEL, hold: true }) => t.owner.post("/api/actions/wifi-advanced-gaps.set-mode", { mode, ...extra });

async function applyPreview(t, preview) {
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.id });
  assert.equal(applied.status, 200, applied.text);
  return settle(t, applied.data);
}

test("wifi-advanced-gaps: the five modes read the router and write only what they must", () => {
  const book = (obj) => new Map(Object.entries(obj));
  const info = { capabilities: ["amas"] };
  assert.equal(currentMode(book({ sw_mode: "1" })), "router");
  assert.equal(currentMode(book({ sw_mode: "2" })), "repeater");
  assert.equal(currentMode(book({ sw_mode: "3" })), "ap");
  assert.equal(currentMode(book({ sw_mode: "3", wlc_psta: "1" })), "bridge");
  assert.equal(currentMode(book({ sw_mode: "3", re_mode: "1", wlc_psta: "0" })), "aimesh-node");
  assert.equal(currentMode(book({ sw_mode: "4" })), "other");
  const plain = book({ sw_mode: "1", wlc_psta: "0", wlc_ssid: "Upstream", re_mode: "0" });
  assert.equal(availability(MODES.router, plain, info, "router").already, true);
  assert.equal(availability(MODES.ap, plain, info, "router").available, true);
  assert.deepEqual(writesFor(MODES.bridge, plain), [["sw_mode", "3"], ["wlc_psta", "1"]]);
  assert.deepEqual(writesFor(MODES.router, book({ sw_mode: "3", wlc_psta: "1", wlc_ssid: "Upstream" })), [["sw_mode", "1"], ["wlc_psta", "0"]], "a media bridge flag is switched off again");
  assert.deepEqual(writesFor(MODES.ap, book({ sw_mode: "1" })), [["sw_mode", "3"]], "a flag the router does not list is never written");
  assert.match(availability(MODES.bridge, book({ sw_mode: "1", wlc_ssid: "x" }), info, "router").reason.en, /does not have the setting wlc_psta/);
  assert.match(availability(MODES.repeater, book({ sw_mode: "1", wlc_ssid: "" }), info, "router").reason.en, /wlc_ssid is empty/);
  assert.match(availability(MODES["aimesh-node"], plain, { capabilities: [] }, "router").reason.en, /does not support AiMesh/);
  assert.equal(Object.keys(MODES).length, 5);
});

test("wifi-advanced-gaps: Smart Connect, 6 GHz and Wi-Fi 7 are shown with their gates", async () => {
  const t = await startApp();
  try {
    const d = (await t.owner.get("/api/domain/wifi-advanced-gaps")).data;
    assert.equal(d.smartConnect.supported, true);
    assert.equal(d.smartConnect.triBand, false);
    assert.equal(d.smartConnect.value, "0");
    assert.deepEqual(d.smartConnect.bands.map((b) => b.band), ["2.4 GHz", "5 GHz"]);
    assert.ok(d.smartConnect.details.every(([k]) => k.startsWith("bsd_")), "only steering details are listed");
    assert.equal(d.sixGhz.present, false);
    assert.equal(d.wifi7.capable, false);
    const mlo = d.entries.find((e) => e.id === "wifi-advanced-gaps.mlo");
    assert.ok(mlo.disabled, "MLO is gated by Wi-Fi 7 hardware");
    const smart = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "wifi-advanced-gaps");
    assert.deepEqual(smart.map((e) => e.key), ["wl_mlo_enable"], "no steering string can be edited from here");

    // A router with a 6 GHz radio: WPA3 is the only security that counts there.
    Object.assign(t.router.nvram, { wl_ifnames: "eth6 eth7 eth8", wl2_ifname: "eth8", wl2_nband: "4", wl2_ssid: "Harbour Home 6G", wl2_auth_mode_x: "psk2sae", wl2_mfp: "2", wl2_radio: "1" });
    t.app.session.invalidate();
    let six = (await t.owner.get("/api/domain/wifi-advanced-gaps")).data;
    assert.equal(six.sixGhz.present, true);
    assert.equal(six.smartConnect.triBand, true);
    assert.deepEqual([six.sixGhz.bands[0].wpa3, six.sixGhz.bands[0].auth], [false, "psk2sae"], "mixed WPA2 and WPA3 does not satisfy 6 GHz");
    t.router.nvram.wl2_auth_mode_x = "sae";
    t.app.session.invalidate();
    six = (await t.owner.get("/api/domain/wifi-advanced-gaps")).data;
    assert.equal(six.sixGhz.bands[0].wpa3, true);
  } finally {
    await t.stop();
  }
});

test("wifi-advanced-gaps: MLO works as a real control on a Wi-Fi 7 router and refuses a setting the router does not list", async () => {
  const t = await startApp();
  try {
    t.router.nvram.rc_support += " wifi7";
    t.app.session.invalidate();
    const d = (await t.owner.get("/api/domain/wifi-advanced-gaps")).data;
    assert.equal(d.wifi7.capable, true);
    assert.equal(d.wifi7.mlo.present, true);
    const entry = d.entries.find((e) => e.id === "wifi-advanced-gaps.mlo");
    assert.equal(entry.disabled, null);
    assert.equal(entry.value, "0", "it shows the router's own value");
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "wifi-advanced-gaps.mlo", value: "1" }] });
    assert.equal(preview.status, 200, preview.text);
    const record = await applyPreview(t, preview.data);
    assert.equal(record.status, "applied");
    assert.equal(t.router.nvram.wl_mlo_enable, "1");
    const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
    assert.equal((await settle(t, (await t.owner.post("/api/changes/apply", { previewId: undo.data.id })).data)).status, "applied");
    assert.equal(t.router.nvram.wl_mlo_enable, "0");

    delete t.router.nvram.wl_mlo_enable;
    t.app.session.invalidate();
    const gone = (await t.owner.get("/api/domain/wifi-advanced-gaps")).data;
    assert.equal(gone.wifi7.mlo.present, false);
    assert.equal(gone.entries.find((e) => e.id === "wifi-advanced-gaps.mlo").disabled.en, "This router does not have the setting wl_mlo_enable");
  } finally {
    await t.stop();
  }
});

test("wifi-advanced-gaps: the operation mode needs the model typed and the hold, then restarts once and reads back", async () => {
  const t = await startApp();
  try {
    const view = (await t.owner.get("/api/x/wifi-advanced-gaps/mode")).data;
    assert.deepEqual([view.current, view.value, view.model], ["router", "1", MODEL]);
    assert.equal(view.meshNodes, 1);
    const by = Object.fromEntries(view.modes.map((m) => [m.id, m]));
    assert.equal(by.router.available, false);
    assert.equal(by.ap.available, true);
    assert.ok(by.ap.warnings.some((w) => /AiMesh node/.test(w.en)), "the nodes that would be orphaned are named");
    assert.ok(by.ap.warnings.some((w) => /address usually changes/.test(w.en)));
    assert.equal(by.router.warnings.length, 0);

    // Each key is checked on its own, and nothing is previewed without both.
    assert.equal((await ask(t, "ap", {})).data.code, "CONFIRM_MODEL");
    assert.equal((await ask(t, "ap", { confirm: "rt-ax86u", hold: true })).data.code, "CONFIRM_MODEL", "the model must match exactly");
    assert.equal((await ask(t, "ap", { confirm: MODEL })).data.code, "CONFIRM_HOLD");
    assert.equal(t.router.nvram.sw_mode, "1");
    assert.equal((await ask(t, "teleporter")).status, 400);
    assert.equal((await ask(t, "router")).status, 409, "already in that mode");

    const preview = await ask(t, "ap");
    assert.equal(preview.status, 200, preview.text);
    assert.equal(preview.data.maxRisk, "destructive");
    assert.deepEqual(preview.data.restarts, ["reboot"]);
    assert.equal(preview.data.guard.armed, true, "the safety timer is on");
    assert.deepEqual(preview.data.items.map((i) => [i.key, i.old, i.new, i.risk]), [["sw_mode", "1", "3", "destructive"]]);
    assert.equal(t.router.nvram.sw_mode, "1", "previewing changes nothing");

    const record = await applyPreview(t, preview.data);
    assert.equal(record.status, "applied");
    assert.equal(t.router.nvram.sw_mode, "3");
    assert.equal(t.router.committed.sw_mode, "3", "the change was saved on the router");
    assert.equal(t.router.rebooted, true, "the router was asked to restart");
    assert.equal(t.router.services.filter((s) => s === "reboot").length, 1, "once");
    assert.equal((await t.owner.get("/api/x/wifi-advanced-gaps/mode")).data.current, "ap", "read back from the router itself");

    // Back again through the undo of the very same change.
    const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
    assert.equal((await applyPreview(t, undo.data)).status, "applied");
    assert.equal(t.router.nvram.sw_mode, "1");
  } finally {
    await t.stop();
  }
});

test("wifi-advanced-gaps: a media bridge and an AiMesh node set their extra flag, and going back clears it", async () => {
  const t = await startApp();
  try {
    const bridge = await ask(t, "bridge");
    assert.deepEqual(bridge.data.items.map((i) => [i.key, i.new]), [["sw_mode", "3"], ["wlc_psta", "1"]]);
    assert.equal((await applyPreview(t, bridge.data)).status, "applied");
    assert.equal((await t.owner.get("/api/x/wifi-advanced-gaps/mode")).data.current, "bridge");
    const back = await ask(t, "router");
    assert.deepEqual(back.data.items.map((i) => [i.key, i.old, i.new]), [["sw_mode", "3", "1"], ["wlc_psta", "1", "0"]]);
    assert.equal((await applyPreview(t, back.data)).status, "applied");
    assert.equal(t.router.nvram.wlc_psta, "0");
    const node = await ask(t, "aimesh-node");
    assert.deepEqual(node.data.items.map((i) => [i.key, i.new]), [["sw_mode", "3"], ["re_mode", "1"]]);
    assert.equal((await applyPreview(t, node.data)).status, "applied");
    assert.equal((await t.owner.get("/api/x/wifi-advanced-gaps/mode")).data.current, "aimesh-node");
  } finally {
    await t.stop();
  }
});

test("wifi-advanced-gaps: a mode is refused, with the reason, when the router lacks what it needs", async () => {
  const t = await startApp();
  try {
    delete t.router.nvram.re_mode;
    t.router.nvram.wlc_ssid = "";
    t.app.session.invalidate();
    const node = await ask(t, "aimesh-node");
    assert.equal(node.status, 409);
    assert.match(node.data.error, /does not have the setting re_mode/);
    const repeater = await ask(t, "repeater");
    assert.equal(repeater.status, 409);
    assert.match(repeater.data.error, /No upstream Wi-Fi/);
    const bridge = await ask(t, "bridge");
    assert.equal(bridge.status, 409);
    const view = (await t.owner.get("/api/x/wifi-advanced-gaps/mode")).data.modes;
    assert.match(view.find((m) => m.id === "aimesh-node").reason.en, /re_mode/);
    assert.equal(t.router.nvram.sw_mode, "1", "nothing was written");
    assert.equal(t.router.rebooted, undefined);
  } finally {
    await t.stop();
  }
});

test("wifi-advanced-gaps: nothing here offers a flash write, a manufacturing command or an exposed service", async () => {
  const t = await startApp();
  try {
    await ask(t, "ap");
    for (const command of t.router.commands) assert.ok(!/mtd|nandwrite|Set_|telnet|ate\b/i.test(command), `unexpected command: ${command}`);
  } finally {
    await t.stop();
  }
});

test("wifi-advanced-gaps: the browser module is well formed", () => {
  assert.equal(checkFeatureModule(feature, "wifi-advanced-gaps"), null);
});
