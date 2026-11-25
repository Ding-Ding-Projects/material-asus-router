// firmware-pro: the version read, the latest-version check (Merlin from GitHub
// with an offline state, stock from the router), the auto-update settings and
// the explanation that nothing is flashed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MERLIN_RELEASES, compare, parseMerlin, parseStockInfo, setFetcher } from "../../server/features/firmware-pro/releases.mjs";
import feature, { stateCopy } from "../../public/js/features/firmware-pro/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp } from "../helpers.mjs";

const release = (tag, extra = {}) => async (url) => {
  assert.equal(url, MERLIN_RELEASES);
  return { ok: true, status: 200, json: async () => ({ tag_name: tag, name: `Release ${tag}`, published_at: "2026-10-01T00:00:00Z", html_url: "https://github.com/RMerl/asuswrt-merlin.ng/releases/tag/x", body: "<b>Fixes</b>\nA fix for Pat's Wi-Fi.", ...extra }) };
};

test("firmware-pro: versions are read and compared the way the two firmwares write them", () => {
  assert.deepEqual(parseMerlin("3004.388.8_4"), [388, 8, 4]);
  assert.deepEqual(parseMerlin("388.8_4"), [388, 8, 4]);
  assert.deepEqual(parseMerlin("386.12_4"), [386, 12, 4]);
  assert.equal(parseMerlin("nonsense"), null);
  assert.deepEqual(parseStockInfo("3004_388_25000_0"), [388, 25000]);
  assert.equal(parseStockInfo(""), null);
  assert.equal(compare([388, 8, 4], [388, 9, 0]), -1);
  assert.equal(compare([388, 9, 0], [388, 8, 9]), 1);
  assert.equal(compare([388, 8], [388, 8, 0]), 0);
  for (const state of ["current", "newer", "ahead", "unchecked", "offline", "unknown"]) assert.ok(stateCopy[state].en && stateCopy[state].yue, state);
});

test("firmware-pro: the screen data shows the version, the settings and why nothing is flashed", async () => {
  const t = await startApp();
  try {
    const data = (await t.owner.get("/api/domain/firmware-pro")).data;
    assert.equal(data.current.family, "merlin");
    assert.equal(data.current.display, "388.8_4");
    assert.equal(data.model, "RT-AX86U");
    assert.deepEqual(data.entries.map((e) => [e.id, e.control, e.value]), [["firmware-pro.check", "switch", "1"], ["firmware-pro.auto", "switch", "0"], ["firmware-pro.period", "stepper", "7"]]);
    assert.equal(data.flashing.allowed, false);
    assert.equal(data.flashing.reasons.length, 3);
    assert.ok(data.flashing.reasons.every((r) => r.en && r.yue));
    assert.equal(data.known, null, "Merlin has no router-reported latest version");
  } finally {
    await t.stop();
  }
});

test("firmware-pro: Merlin finds the latest GitHub release, and says so plainly when offline", async () => {
  const t = await startApp();
  try {
    setFetcher(release("3004.388.9_0"));
    let out = (await t.owner.get("/api/x/firmware-pro/latest")).data;
    assert.deepEqual([out.state, out.latest, out.current, out.source], ["newer", "3004.388.9_0", "388.8_4", "github"]);
    assert.equal(out.notes, "Fixes\nA fix for Pat's Wi-Fi.", "markup is stripped from the notes");
    assert.match(out.url, /^https:\/\/github\.com\//);

    setFetcher(release("388.8_4"));
    assert.equal((await t.owner.get("/api/x/firmware-pro/latest")).data.state, "current");
    setFetcher(release("388.7_9"));
    assert.equal((await t.owner.get("/api/x/firmware-pro/latest")).data.state, "ahead");
    setFetcher(release("388.9_0", { html_url: "https://example.test/evil" }));
    assert.equal((await t.owner.get("/api/x/firmware-pro/latest")).data.url, "https://www.asuswrt-merlin.net/download", "only GitHub links are passed on");

    setFetcher(async () => ({ ok: false, status: 503 }));
    out = (await t.owner.get("/api/x/firmware-pro/latest")).data;
    assert.deepEqual([out.state, out.reason], ["offline", "GitHub answered 503."]);
    setFetcher(async () => {
      throw new TypeError("fetch failed");
    });
    out = (await t.owner.get("/api/x/firmware-pro/latest")).data;
    assert.equal(out.state, "offline");
    assert.match(out.reason, /could not reach GitHub/);
    assert.equal((await t.owner.post("/api/x/firmware-pro/check")).data.state, "offline", "checking again from the screen behaves the same");
  } finally {
    setFetcher(null);
    await t.stop();
  }
});

test("firmware-pro: stock firmware asks the router and reads what it reports", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    assert.equal((await t.owner.get("/api/domain/firmware-pro")).data.current.display, "3.0.0.4.388.24198");
    let out = (await t.owner.get("/api/x/firmware-pro/latest")).data;
    assert.equal(out.state, "unchecked");
    assert.equal(out.url, "https://www.asus.com/supportonly/RT-AX86U/helpdesk_bios/");

    const asked = (await t.owner.post("/api/x/firmware-pro/check")).data;
    assert.equal(asked.asked, true);
    assert.ok(t.router.services.includes("start_webs_update"), "the router was asked to look now");

    t.router.nvram.webs_state_info = "3004_388_25000_0";
    out = (await t.owner.get("/api/x/firmware-pro/latest")).data;
    assert.deepEqual([out.state, out.latest, out.source], ["newer", "3.0.0.4.388.25000", "router"]);
    t.router.nvram.webs_state_info = "3004_388_24198_0";
    assert.equal((await t.owner.get("/api/x/firmware-pro/latest")).data.state, "current");
    assert.equal((await t.owner.get("/api/domain/firmware-pro")).data.known.state, "current");
  } finally {
    await t.stop();
  }
});

test("firmware-pro: the auto-update setting goes through the change engine and the check needs write access", async () => {
  const t = await startApp();
  try {
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "firmware-pro.check", value: "0" }, { id: "firmware-pro.auto", value: "1" }, { id: "firmware-pro.period", value: "14" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.deepEqual([t.router.nvram.firmware_check_enable, t.router.nvram.fw_auto_upgrade, t.router.nvram.fw_check_period], ["0", "1", "14"]);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "firmware-pro.period", value: "99" }] })).status, 400);

    assert.equal((await t.client().get("/api/x/firmware-pro/latest")).status, 401);
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    setFetcher(release("388.8_4"));
    assert.equal((await guest.get("/api/x/firmware-pro/latest")).status, 200, "viewers may look");
    assert.equal((await guest.post("/api/x/firmware-pro/check")).status, 403, "asking the router is a write");
  } finally {
    setFetcher(null);
    await t.stop();
  }
});

test("firmware-pro: the browser module is well formed and listed in the manifest", async () => {
  assert.equal(checkFeatureModule(feature, "firmware-pro"), null);
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/firmware-pro/index.js"));
  } finally {
    await t.stop();
  }
});
