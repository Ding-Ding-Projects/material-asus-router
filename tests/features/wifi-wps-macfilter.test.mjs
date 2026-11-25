// Tests for the wifi-wps-macfilter feature: the MAC filter mode and list on each
// band, WPS switches, the hidden PIN, the push-button action and the list control.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/wifi-wps-macfilter/index.js";
import { formatList, parseList } from "../../public/js/features/wifi-wps-macfilter/maclist.js";
import { startApp, waitFor } from "../helpers.mjs";

const settle = (t, record) =>
  waitFor(async () => {
    const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
    return next.status !== "guarded" && next.status !== "applying" ? next : null;
  });

async function change(t, changes) {
  const preview = await t.owner.post("/api/changes/preview", { changes });
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  const record = await settle(t, applied.data);
  assert.equal(record.status, "applied");
  return record;
}

for (const firmware of ["merlin", "stock"]) {
  test(`wifi-wps-macfilter on ${firmware}: every setting reads, previews, applies, reads back and undoes`, async () => {
    const t = await startApp({ firmware });
    try {
      const entries = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "wifi-wps-macfilter");
      assert.deepEqual(entries.map((e) => e.id).sort(), ["wifi-wps-macfilter.enable", "wifi-wps-macfilter.pin", "wifi-wps-macfilter.wl0.maclist", "wifi-wps-macfilter.wl0.macmode", "wifi-wps-macfilter.wl0.wps", "wifi-wps-macfilter.wl1.maclist", "wifi-wps-macfilter.wl1.macmode", "wifi-wps-macfilter.wl1.wps"]);
      for (const entry of entries) {
        const original = t.router.nvram[entry.key];
        assert.notEqual(original, undefined, `${entry.key} is on the router`);
        if (entry.readOnly) {
          assert.equal(entry.masked, true, "the PIN is hidden");
          assert.equal(entry.value, "");
          assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: entry.id, value: "87654321" }] })).status, 400);
          continue;
        }
        const next = { switch: original === entry.values?.on ? entry.values.off : entry.values?.on, select: entry.options?.map(([v]) => v).find((v) => v !== original), "wifi-maclist": original === "" ? "<02:00:00:00:00:01<02:00:00:00:00:02" : "" }[entry.control];
        const record = await change(t, [{ id: entry.id, value: next }]);
        assert.equal(t.router.nvram[entry.key], next);
        assert.equal(t.router.committed[entry.key], next);
        const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
        assert.equal((await settle(t, (await t.owner.post("/api/changes/apply", { previewId: undo.data.id })).data)).status, "applied");
        assert.equal(t.router.nvram[entry.key], original);
      }
    } finally {
      await t.stop();
    }
  });
}

test("wifi-wps-macfilter: the list is checked strictly and stored in the router's format", async () => {
  const t = await startApp();
  try {
    const refused = (value) => t.owner.post("/api/changes/preview", { changes: [{ id: "wifi-wps-macfilter.wl1.maclist", value }] });
    for (const bad of ["AA:BB:CC:DD:EE:FF", "<AA:BB", "<not-a-mac", "<02:00:00:00:00:01<02:00:00:00:00:01", "<", `${"<02:00:00:00:00:01".repeat(2)}<zz`])
      assert.equal((await refused(bad)).status, 400, bad);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "wifi-wps-macfilter.wl1.macmode", value: "block" }] })).status, 400);
    // Lower case input is stored upper case.
    await change(t, [{ id: "wifi-wps-macfilter.wl1.maclist", value: "<aa:bb:cc:00:11:22<02:00:00:00:00:09" }, { id: "wifi-wps-macfilter.wl1.macmode", value: "allow" }]);
    assert.equal(t.router.nvram.wl1_maclist_x, "<AA:BB:CC:00:11:22<02:00:00:00:00:09");
    const band = (await t.owner.get("/api/domain/wifi-wps-macfilter")).data.bands.find((b) => b.index === 1);
    assert.deepEqual([band.mode, band.list, band.locksOut], ["allow", ["AA:BB:CC:00:11:22", "02:00:00:00:00:09"], false]);
    // Allow-only with nothing in the list is flagged as a lock-out.
    await change(t, [{ id: "wifi-wps-macfilter.wl1.maclist", value: "" }]);
    assert.equal((await t.owner.get("/api/domain/wifi-wps-macfilter")).data.bands.find((b) => b.index === 1).locksOut, true);
  } finally {
    await t.stop();
  }
});

test("wifi-wps-macfilter: the connected-devices route lists a band's devices", async () => {
  const t = await startApp();
  try {
    assert.deepEqual((await t.owner.get("/api/x/wifi-wps-macfilter/connected/0")).data, { band: 0, macs: ["3C:22:FB:10:20:30", "DC:A6:32:44:55:66"] });
    assert.deepEqual((await t.owner.get("/api/x/wifi-wps-macfilter/connected/1")).data.macs, ["AC:5A:F0:01:02:03", "F0:18:98:AA:BB:01"]);
    assert.equal((await t.owner.get("/api/x/wifi-wps-macfilter/connected/9")).status, 404);
    assert.equal((await t.client().get("/api/x/wifi-wps-macfilter/connected/0")).status, 401);
  } finally {
    await t.stop();
  }
});

test("wifi-wps-macfilter: the push button starts WPS only when WPS is on, and viewers cannot press it", async () => {
  const t = await startApp();
  try {
    const started = await t.owner.post("/api/actions/wifi-wps-macfilter.push-button");
    assert.equal(started.status, 200, started.text);
    assert.equal(started.data.ok, true);
    assert.ok(t.router.services.includes("start_wps_method"), "the router was asked to start WPS");

    t.router.services.length = 0;
    await change(t, [{ id: "wifi-wps-macfilter.enable", value: "0" }]);
    t.router.services.length = 0;
    const refused = await t.owner.post("/api/actions/wifi-wps-macfilter.push-button");
    assert.equal(refused.data.ok, false);
    assert.match(refused.data.message, /switched off/);
    assert.ok(!t.router.services.includes("start_wps_method"), "nothing was sent while WPS is off");
    assert.equal((await t.owner.get("/api/domain/wifi-wps-macfilter")).data.wps.enabled, false);

    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const viewer = t.client();
    assert.equal((await viewer.signIn("vi", "viewer password 1")).status, 200);
    assert.equal((await viewer.post("/api/actions/wifi-wps-macfilter.push-button")).status, 403);
    assert.equal((await viewer.get("/api/domain/wifi-wps-macfilter")).status, 200);
  } finally {
    await t.stop();
  }
});

test("wifi-wps-macfilter: the PIN stays hidden unless the owner asks to reveal it", async () => {
  const t = await startApp();
  try {
    assert.ok(!JSON.stringify((await t.owner.get("/api/domain/wifi-wps-macfilter")).data).includes("12345670"));
    const shown = await t.owner.post("/api/reveal", { id: "wifi-wps-macfilter.pin" });
    assert.equal(shown.data.value, "12345670");
  } finally {
    await t.stop();
  }
});

test("wifi-wps-macfilter: the list control parses and formats the router's format", async () => {
  assert.deepEqual(parseList("<aa:bb:cc:dd:ee:ff<11:22:33:44:55:66"), ["AA:BB:CC:DD:EE:FF", "11:22:33:44:55:66"]);
  assert.deepEqual(parseList(""), []);
  assert.equal(formatList(["AA:BB:CC:DD:EE:FF"]), "<AA:BB:CC:DD:EE:FF");
  assert.equal(formatList(parseList("<aa:bb:cc:dd:ee:ff")), "<AA:BB:CC:DD:EE:FF");
});

test("wifi-wps-macfilter: the manifest lists the module and its stylesheet, and the module is well formed", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/wifi-wps-macfilter/index.js"));
    assert.ok(manifest.styles.includes("/js/features/wifi-wps-macfilter/style.css"));
    assert.equal((await fetch(t.base + "/js/features/wifi-wps-macfilter/maclist.js")).status, 200);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "wifi-wps-macfilter"), null);
  assert.equal(typeof feature.controls["wifi-maclist"], "function");
});
