// Tests for the wifi-pro feature: every one of its settings is read, previewed,
// applied, read back and undone on both firmwares; the screen data, the route
// and the frontend module are checked too.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/wifi-pro/index.js";
import { startApp, waitFor } from "../helpers.mjs";

const settle = (t, record) =>
  waitFor(async () => {
    const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
    return next.status !== "guarded" && next.status !== "applying" ? next : null;
  });

async function change(t, id, value) {
  const preview = await t.owner.post("/api/changes/preview", { changes: [{ id, value }] });
  assert.equal(preview.status, 200, `${id}: ${preview.text}`);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, `${id}: ${applied.text}`);
  const record = await settle(t, applied.data);
  assert.equal(record.status, "applied", `${id} ended as ${record.status}`);
  return record;
}

const EXPECTED = ["mode", "ax", "be", "twt", "ofdma", "mumimo", "txbf", "itxbf", "atf", "rssi", "rrm", "wnm", "ft", "mfp", "ctrl", "dfs", "bw160", "bcn", "dtim", "mrate", "crypto", "radius-ip", "radius-port", "radius-key", "country", "sched-on", "sched"];

for (const firmware of ["merlin", "stock"]) {
  test(`wifi-pro on ${firmware}: every setting reads, previews, applies, reads back and undoes`, async () => {
    const t = await startApp({ firmware });
    try {
      const entries = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "wifi-pro");
      const ids = new Set(entries.map((e) => e.id));
      // Both bands carry every capability the task lists, except the 5 GHz only ones on 2.4 GHz.
      for (const band of [0, 1]) for (const name of EXPECTED) {
        if (band === 0 && (name === "dfs" || name === "bw160")) continue;
        assert.ok(ids.has(`wifi-pro.wl${band}.${name}`), `wl${band} is missing ${name}`);
      }
      assert.ok(ids.has("wifi-pro.smart-connect"));
      let written = 0;
      for (const entry of entries) {
        if (entry.disabled) continue;
        const key = entry.key;
        if (entry.readOnly) {
          assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: entry.id, value: "ZZ" }] })).status, 400, `${entry.id} is read only`);
          continue;
        }
        const original = t.router.nvram[key];
        assert.notEqual(original, undefined, `${entry.id}: ${key} is not on the router`);
        if (!entry.secret) assert.equal(entry.value, original, `${entry.id} shows the router's value`);
        const pick = { switch: () => (original === entry.values.on ? entry.values.off : entry.values.on), select: () => entry.options.map(([v]) => v).find((v) => v !== original), slider: () => String(entry.max), stepper: () => String(entry.max), port: () => "1645", ipv4: () => "203.0.113.9", password: () => "a-new-radius-secret", schedule: () => "12345@08:00-17:00" };
        assert.ok(pick[entry.control], `${entry.id}: the test has no example for ${entry.control}`);
        const record = await change(t, entry.id, pick[entry.control]());
        assert.notEqual(t.router.nvram[key], original, `${entry.id} changed on the router`);
        assert.equal(t.router.committed[key], t.router.nvram[key], `${entry.id} was committed`);
        const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
        assert.equal(undo.status, 200, undo.text);
        const undone = await t.owner.post("/api/changes/apply", { previewId: undo.data.id });
        assert.equal((await settle(t, undone.data)).status, "applied");
        assert.equal(t.router.nvram[key], original, `${entry.id} undone`);
        written += 1;
      }
      assert.ok(written >= 45, `only ${written} settings were exercised`);
    } finally {
      await t.stop();
    }
  });
}

test("wifi-pro: Merlin-only and model-dependent settings stay visible but disabled with a reason", async () => {
  const merlin = await startApp({ firmware: "merlin" });
  const stock = await startApp({ firmware: "stock" });
  try {
    const on = (await merlin.owner.get("/api/catalog")).data.entries.find((e) => e.id === "wifi-pro.wl0.twt");
    const off = (await stock.owner.get("/api/catalog")).data.entries.find((e) => e.id === "wifi-pro.wl0.twt");
    assert.equal(on.disabled, null);
    assert.match(off.disabled.en, /Merlin/);
    assert.match(off.disabled.yue, /Merlin/);
    const wifi7 = (await merlin.owner.get("/api/catalog")).data.entries.find((e) => e.id === "wifi-pro.wl1.be");
    assert.ok(wifi7.disabled, "Wi-Fi 7 mode is disabled on a model without it");
    assert.equal((await merlin.owner.post("/api/changes/preview", { changes: [{ id: "wifi-pro.wl1.be", value: "1" }] })).status, 400);
    assert.equal((await stock.owner.post("/api/changes/preview", { changes: [{ id: "wifi-pro.wl0.twt", value: "0" }] })).status, 400);
  } finally {
    await merlin.stop();
    await stock.stop();
  }
});

test("wifi-pro: wrong values are refused and secrets never reach the browser", async () => {
  const t = await startApp();
  try {
    for (const [id, value] of [["wifi-pro.wl0.rssi", "5"], ["wifi-pro.wl0.bcn", "5"], ["wifi-pro.wl0.dtim", "0"], ["wifi-pro.wl0.mrate", "99"], ["wifi-pro.wl0.radius-ip", "999.1.1.1"], ["wifi-pro.wl0.radius-port", "70000"], ["wifi-pro.wl0.sched", "9@25:00-26:00"], ["wifi-pro.wl0.mfp", "3"]])
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id, value }] })).status, 400, `${id} ${value}`);
    const secret = (await t.owner.get("/api/catalog")).data.entries.find((e) => e.id === "wifi-pro.wl0.radius-key");
    assert.equal(secret.value, "");
    assert.equal(secret.masked, true);
    assert.ok(!JSON.stringify((await t.owner.get("/api/domain/wifi-pro")).data).includes("change-this-secret"));
  } finally {
    await t.stop();
  }
});

test("wifi-pro: the screen data lists both bands, their devices, the basic controls and the notes", async () => {
  const t = await startApp();
  try {
    const data = (await t.owner.get("/api/domain/wifi-pro")).data;
    assert.deepEqual(data.bands.map((b) => [b.index, b.on, b.clients, b.region]), [[0, true, 2, "HK"], [1, true, 2, "HK"]]);
    assert.ok(["wl0.radio", "wl0.ssid", "wl0.auth", "wl1.channel", "wl1.width", "wl1.power"].every((id) => data.stock.some((e) => e.id === id)));
    assert.ok(!data.stock.some((e) => /^wl\d\.1\./.test(e.id)), "guest settings stay on the guest screen");
    assert.ok(data.entries.some((e) => e.meta?.note), "unconfirmed settings carry a note");
    assert.ok(data.entries.every((e) => e.label.en && e.label.yue && e.help.en && e.help.yue));
    const bands = (await t.owner.get("/api/x/wifi-pro/bands")).data;
    assert.deepEqual(bands.bands.map((b) => b.clients), [2, 2]);
    assert.equal((await t.client().get("/api/x/wifi-pro/bands")).status, 401);
  } finally {
    await t.stop();
  }
});

test("wifi-pro: the manifest lists the module and its stylesheet, and the module is well formed", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/wifi-pro/index.js"));
    assert.ok(manifest.styles.includes("/js/features/wifi-pro/style.css"));
    assert.equal((await fetch(t.base + "/js/features/wifi-pro/style.css")).status, 200);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "wifi-pro"), null);
  assert.deepEqual(feature.screens.map((s) => s.id), ["wifi-pro"]);
  assert.ok(feature.commands.length >= 1 && feature.settings.length === 1);
});
