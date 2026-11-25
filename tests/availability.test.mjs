// A control is only available when the router's own settings list has its setting. The check runs against the
// live list every time, so another model or firmware is judged by what it really has, and a setting that is
// missing is shown switched off with the reason, never written.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { startApp } from "./helpers.mjs";

const find = async (t, id) => (await t.owner.get("/api/catalog")).data.entries.find((e) => e.id === id);

test("a control whose setting the router lacks is switched off with the reason, and is never written", async () => {
  const t = await startApp({ profile: "rt-be88u-merlin-3006" });
  try {
    assert.equal((await t.owner.get("/api/domain/overview")).status, 200);
    const info = (await t.owner.get("/api/catalog")).data.info;
    assert.deepEqual([info.model, info.merlin, info.firmware], ["RT-BE88U", true, "3.0.0.6.102.7_2"]);
    assert.equal("settingKeys" in info, false, "the whole settings list never travels to the browser");

    // This firmware has only one WireGuard client slot, so the other four are shown but switched off.
    const absent = await find(t, "vpn-pro.wgc2.enable");
    assert.equal(absent.key, "wgc2_enable");
    assert.equal(absent.disabled.en, "This router does not have the setting wgc2_enable");
    assert.match(absent.disabled.yue, /wgc2_enable/);
    const refused = await t.owner.post("/api/changes/preview", { changes: [{ id: "vpn-pro.wgc2.enable", value: "1" }] });
    assert.equal(refused.status, 400);
    assert.match(refused.text, /does not have the setting wgc2_enable/);
    assert.ok(!t.router.commands.some((c) => c.includes("wgc2_")), "nothing about a missing setting is sent to the router");

    // A setting the router does have stays available.
    const led = await find(t, "sys.led");
    assert.deepEqual([led.key, led.disabled], ["AllLED", null]);
    const wgc1 = await find(t, "vpn-pro.wgc1.enable");
    assert.equal(wgc1.disabled, null);
  } finally {
    await t.stop();
  }
});

test("availability follows the router's list at run time, so a setting that disappears is switched off", async () => {
  const t = await startApp();
  try {
    assert.equal((await find(t, "sys.ntp")).disabled, null);
    delete t.router.nvram.ntp_server0;
    t.app.session.invalidate();
    const gone = await find(t, "sys.ntp");
    assert.equal(gone.disabled.en, "This router does not have the setting ntp_server0");
    t.router.nvram.ntp_server0 = "pool.ntp.org";
    t.app.session.invalidate();
    assert.equal((await find(t, "sys.ntp")).disabled, null, "and it comes back when the router has it again");
  } finally {
    await t.stop();
  }
});

test("the RT-BE88U profile has the real setting names, a Merlin 3006 identity and no private data", async () => {
  const profile = JSON.parse(await readFile(new URL("../server/ssh/profiles/rt-be88u-merlin-3006.json", import.meta.url), "utf8"));
  assert.equal(profile.model, "RT-BE88U");
  assert.ok(profile.names.length > 5000, "the whole list of setting names");
  assert.equal(new Set(profile.names).size, profile.names.length);
  assert.ok(profile.names.every((n) => /^[A-Za-z0-9_.:-]{1,64}$/.test(n)), "names only");
  for (const name of ["AllLED", "wgc1_enable", "upnp_mnp", "firmware_check_enable", "apg1_enable", "wl0.1_bss_maxassoc", "wl0_bss_mlo_mode"]) assert.ok(profile.names.includes(name), name);
  for (const name of ["led_disable", "wgc2_enable", "mar_speed_host", "wl0.1_maxassoc"]) assert.ok(!profile.names.includes(name), `${name} is not a setting of this router`);
  const text = JSON.stringify([profile.names, profile.rc_support, profile.note]);
  assert.ok(!/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(text), "no address in the profile");
  assert.ok(!/(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/.test(text), "no hardware address in the profile");
  assert.deepEqual(Object.keys(profile).sort(), ["buildno", "extendno", "firmver", "model", "names", "note", "profile", "rc_support"]);

  const t = await startApp({ profile: "rt-be88u-merlin-3006" });
  try {
    assert.deepEqual(Object.keys(t.router.nvram).filter((k) => !profile.names.includes(k)), [], "the router has the profile's names and no other");
    assert.ok(profile.names.every((n) => n in t.router.nvram), "every real name is there");
  } finally {
    await t.stop();
  }
});
