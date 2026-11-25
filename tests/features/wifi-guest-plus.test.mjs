// Tests for the wifi-guest-plus feature: guest networks 1 to 3 on each band, with
// their time limit, intranet access, bandwidth limit and device cap.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/wifi-guest-plus/index.js";
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
  test(`wifi-guest-plus on ${firmware}: every guest setting reads, previews, applies, reads back and undoes`, async () => {
    const t = await startApp({ firmware });
    try {
      const entries = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "wifi-guest-plus");
      // Three guest networks on each of two bands. Guest 1 keeps its basics in the stock catalogue.
      const perBand = (band, n) => entries.filter((e) => e.id.startsWith(`wifi-guest-plus.wl${band}.${n}.`)).map((e) => e.id.split(".").pop()).sort();
      for (const band of [0, 1]) {
        assert.deepEqual(perBand(band, 1), ["auth", "bw-down", "bw-on", "bw-up", "expire", "hidden", "maxassoc"]);
        for (const n of [2, 3]) assert.deepEqual(perBand(band, n), ["auth", "bw-down", "bw-on", "bw-up", "enabled", "expire", "hidden", "lan", "maxassoc", "password", "ssid"]);
      }
      let written = 0;
      for (const entry of entries) {
        assert.equal(entry.disabled, null, `${entry.id} works on every firmware`);
        const original = t.router.nvram[entry.key];
        assert.notEqual(original, undefined, `${entry.key} is on the router`);
        const next = { switch: original === entry.values?.on ? entry.values.off : entry.values?.on, select: entry.options?.map(([v]) => v).find((v) => v !== original), stepper: String(entry.max), password: "a-new-guest-pass", text: "Cafe Visitors" }[entry.control];
        const record = await change(t, [{ id: entry.id, value: next }]);
        assert.notEqual(t.router.nvram[entry.key], original, `${entry.id} changed`);
        assert.equal(t.router.committed[entry.key], t.router.nvram[entry.key]);
        const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
        assert.equal((await settle(t, (await t.owner.post("/api/changes/apply", { previewId: undo.data.id })).data)).status, "applied");
        assert.equal(t.router.nvram[entry.key], original, `${entry.id} undone`);
        written += 1;
      }
      assert.equal(written, 58);
    } finally {
      await t.stop();
    }
  });
}

test("wifi-guest-plus: wrong values are refused", async () => {
  const t = await startApp();
  try {
    for (const [id, value] of [["wifi-guest-plus.wl0.2.expire", "5"], ["wifi-guest-plus.wl0.2.maxassoc", "0"], ["wifi-guest-plus.wl0.3.bw-down", "-1"], ["wifi-guest-plus.wl1.2.password", "short"], ["wifi-guest-plus.wl1.3.auth", "wep"], ["wifi-guest-plus.wl0.2.ssid", "<bad>"]])
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id, value }] })).status, 400, `${id} ${value}`);
    const secret = (await t.owner.get("/api/catalog")).data.entries.find((e) => e.id === "wifi-guest-plus.wl0.2.password");
    assert.equal(secret.value, "");
    assert.ok(!JSON.stringify((await t.owner.get("/api/domain/wifi-guest-plus")).data).includes("visitors-welcome"));
  } finally {
    await t.stop();
  }
});

test("wifi-guest-plus: turning a guest network on shows in the screen data and the active route", async () => {
  const t = await startApp();
  try {
    const before = (await t.owner.get("/api/domain/wifi-guest-plus")).data;
    assert.equal(before.networks.length, 6, "three guest networks on each of two bands");
    assert.ok(before.networks.every((n) => !n.on));
    assert.deepEqual((await t.owner.get("/api/x/wifi-guest-plus/active")).data.active, []);
    assert.ok(["wl0.1.enabled", "wl0.1.ssid", "wl0.1.password", "wl0.1.lan", "wl1.1.enabled"].every((id) => before.stock.some((e) => e.id === id)), "guest 1 basics come from the stock catalogue");

    await change(t, [
      { id: "wifi-guest-plus.wl1.2.enabled", value: "1" },
      { id: "wifi-guest-plus.wl1.2.expire", value: "14400" },
      { id: "wifi-guest-plus.wl1.2.bw-on", value: "1" },
      { id: "wifi-guest-plus.wl1.2.lan", value: "on" },
    ]);
    const after = (await t.owner.get("/api/domain/wifi-guest-plus")).data;
    const net = after.networks.find((n) => n.band === 1 && n.number === 2);
    assert.deepEqual([net.on, net.open, net.intranet, net.expireSeconds, net.limited], [true, false, true, 14400, true]);
    assert.deepEqual((await t.owner.get("/api/x/wifi-guest-plus/active")).data.active, [{ band: 1, number: 2, ssid: "Harbour Guest 2 5G" }]);
    assert.equal((await t.client().get("/api/x/wifi-guest-plus/active")).status, 401);
  } finally {
    await t.stop();
  }
});

test("wifi-guest-plus: the manifest lists the module and its stylesheet, and the module is well formed", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/wifi-guest-plus/index.js"));
    assert.ok(manifest.styles.includes("/js/features/wifi-guest-plus/style.css"));
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "wifi-guest-plus"), null);
  assert.deepEqual(feature.screens.map((s) => s.id), ["wifi-guest-plus"]);
});
