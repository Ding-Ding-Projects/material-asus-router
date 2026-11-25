// Wi-Fi band extras: one block of documented per-band radio settings for every band the router reports.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bandEntries } from "../../server/features/wifi-band-extras/index.mjs";
import { startApp } from "../helpers.mjs";

const PROFILE = { profile: "rt-be88u-merlin-3006" };
const mine = async (t) => (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "wifi-band-extras");

test("wifi-band-extras: each band gets fifteen controls on its own real keys", async () => {
  const keys = bandEntries({ index: 1, nband: "1" }).map((e) => e.key);
  assert.equal(keys.length, 15);
  assert.ok(keys.every((k) => k.startsWith("wl1_")));
  for (const key of ["wl1_ampdu", "wl1_amsdu", "wl1_frameburst", "wl1_plcphdr", "wl1_wme", "wl1_wme_apsd", "wl1_wmf_bss_enable", "wl1_igs", "wl1_ap_isolate", "wl1_bss_maxassoc", "wl1_obss_coex", "wl1_mbo_enable", "wl1_radio_pwrsave_enable", "wl1_rts", "wl1_frag"]) assert.ok(keys.includes(key), key);

  for (const options of [{ firmware: "merlin" }, PROFILE]) {
    const t = await startApp(options);
    try {
      const entries = await mine(t);
      assert.equal(entries.length, 30, "two bands");
      assert.ok(entries.every((e) => e.disabled === null && e.key in t.router.nvram));
    } finally {
      await t.stop();
    }
  }
});

test("wifi-band-extras: values are written in the router's own format and wrong ones are refused", async () => {
  const t = await startApp(PROFILE);
  try {
    const preview = await t.owner.post("/api/changes/preview", { changes: [
      { id: "wifi-band-extras.wl0.frameburst", value: "off" }, { id: "wifi-band-extras.wl0.ampdu", value: "on" }, { id: "wifi-band-extras.wl1.maxassoc", value: "32" }, { id: "wifi-band-extras.wl1.coex", value: "0" }, { id: "wifi-band-extras.wl1.frag", value: "1500" },
    ] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.deepEqual(["wl0_frameburst", "wl0_ampdu", "wl1_bss_maxassoc", "wl1_obss_coex", "wl1_frag"].map((k) => t.router.nvram[k]), ["off", "on", "32", "0", "1500"]);
    for (const [id, value] of [["frameburst", "1"], ["ampdu", "maybe"], ["maxassoc", "129"], ["frag", "100"], ["rts", "9000"], ["preamble", "medium"]])
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: `wifi-band-extras.wl0.${id}`, value }] })).status, 400, `${id}=${value}`);
    const domain = (await t.owner.get("/api/domain/wifi-band-extras")).data;
    assert.deepEqual([domain.bands.length, domain.entries.length], [2, 30]);
  } finally {
    await t.stop();
  }
});
