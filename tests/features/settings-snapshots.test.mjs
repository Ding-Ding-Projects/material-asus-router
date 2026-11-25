// Settings snapshots: saved in the app's own state without secrets, compared
// with friendly labels, restored through the change engine, with a safety copy.
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { friendly, groupRows } from "../../public/js/features/settings-snapshots/index.js";
import { diff } from "../../server/features/settings-snapshots/index.mjs";
import { startApp } from "../helpers.mjs";

const dataDir = await mkdtemp(path.join(os.tmpdir(), "mar-snap-"));
process.env.DATA_DIR = dataDir;

async function change(t, changes) {
  const preview = await t.owner.post("/api/changes/preview", { changes });
  assert.equal(preview.status, 200, preview.text);
  assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
}

test("settings-snapshots: the comparison and the friendly values", () => {
  const catalog = [{ id: "a.x", key: "x", label: { en: "X", yue: "X" }, groupLabel: { en: "Group", yue: "組" }, control: "switch", values: { on: "1", off: "0" } }, { id: "a.pw", key: "pw", control: "password", label: { en: "Pw", yue: "Pw" }, secret: true }, { id: "a.ro", key: "ro", control: "number", readOnly: true, label: { en: "RO", yue: "RO" }, groupLabel: { en: "Group", yue: "組" } }];
  const rows = diff(catalog, { "a.x": "1", "a.pw": "x", "a.ro": "1", "gone.y": "5" }, { "a.x": "0", "a.pw": "y", "a.ro": "2" });
  assert.deepEqual(rows.map((r) => [r.id, r.restorable]).sort(), [["a.pw", false], ["a.ro", false], ["a.x", true], ["gone.y", false]]);
  const t = (en) => en;
  assert.equal(friendly(catalog[0], "1", t), "On");
  assert.equal(friendly(catalog[0], "0", t), "Off");
  assert.equal(friendly(undefined, null, t), "not set");
  assert.equal(friendly({ control: "select", options: [["a", { en: "Apple", yue: "蘋果" }]] }, "a", t), "Apple");
  assert.equal(friendly({ control: "slider", unit: " %" }, "40", t), "40 %");
  assert.deepEqual(groupRows(rows).map((g) => g.label.en), ["Group", "Other"]);
});

test("settings-snapshots: save, compare and restore selected settings through the change engine", async () => {
  const t = await startApp();
  try {
    const empty = (await t.owner.get("/api/x/settings-snapshots/snapshots")).data;
    assert.deepEqual([empty.snapshots, empty.settings.autoBeforeRestore, empty.settings.keep], [[], true, 30]);

    assert.equal((await t.owner.post("/api/x/settings-snapshots/snapshots", { name: "" })).status, 400);
    assert.equal((await t.owner.post("/api/x/settings-snapshots/snapshots", { name: "<b>" })).status, 400);
    const saved = (await t.owner.post("/api/x/settings-snapshots/snapshots", { name: "Before the holiday", note: "All as Pat likes it" })).data;
    assert.equal(saved.name, "Before the holiday");
    assert.ok(saved.count > 40, "it holds the settings the app knows by name");
    assert.ok(saved.skippedSecrets >= 2, "Wi-Fi passwords are counted but never stored");

    // The password never reaches the file the app keeps.
    const file = await readFile(path.join(dataDir, "features", "settings-snapshots.json"), "utf8");
    assert.ok(!file.includes("milk-tea-and-egg-tarts"));
    assert.ok(!file.includes("wl0.password"));

    await change(t, [{ id: "wl0.power", value: "50" }, { id: "wl0.radio", value: "0" }, { id: "wl0.channel", value: "11" }]);
    const diffed = (await t.owner.get(`/api/x/settings-snapshots/diff?a=${saved.id}`)).data;
    assert.equal(diffed.same, false);
    assert.deepEqual(diffed.rows.map((r) => r.id).sort(), ["wl0.channel", "wl0.power", "wl0.radio"]);
    const power = diffed.rows.find((r) => r.id === "wl0.power");
    assert.deepEqual([power.a, power.b, power.label.en, power.restorable], ["100", "50", "Transmit power", true]);

    // Put back two of the three; the safety copy is saved first.
    const restored = await t.owner.post("/api/x/settings-snapshots/restore", { from: saved.id, ids: ["wl0.power", "wl0.channel"] });
    assert.equal(restored.status, 200, restored.text);
    assert.deepEqual(restored.data.changes, [{ id: "wl0.power", value: "100" }, { id: "wl0.channel", value: "0" }]);
    assert.match(restored.data.safetySnapshot.name, /^Before restoring/);
    assert.equal(restored.data.items.length, 2);
    assert.equal(t.router.nvram.wl0_txpower, "50", "nothing is written until the changes are applied");
    await change(t, restored.data.changes);
    assert.equal(t.router.nvram.wl0_txpower, "100");
    assert.equal(t.router.nvram.wl0_chanspec, "0");
    assert.equal(t.router.nvram.wl0_radio, "0", "the one that was not chosen stays as it is");

    const after = (await t.owner.get(`/api/x/settings-snapshots/diff?a=${saved.id}`)).data;
    assert.deepEqual(after.rows.map((r) => r.id), ["wl0.radio"]);
    const safety = (await t.owner.get("/api/x/settings-snapshots/snapshots")).data.snapshots.find((s) => s.auto);
    assert.ok(safety, "the safety copy is listed");
    const compared = (await t.owner.get(`/api/x/settings-snapshots/diff?a=${saved.id}&b=${safety.id}`)).data;
    assert.deepEqual(compared.rows.map((r) => r.id).sort(), ["wl0.channel", "wl0.power", "wl0.radio"], "the safety copy holds what the router had before the restore");
    assert.equal(compared.rows.find((r) => r.id === "wl0.power").b, "50");

    // Refusals.
    assert.equal((await t.owner.post("/api/x/settings-snapshots/restore", { from: saved.id, ids: ["wl0.password"] })).status, 409, "a secret is never restored");
    assert.equal((await t.owner.post("/api/x/settings-snapshots/restore", { from: saved.id, ids: ["wl0.radio", "no.such"] })).data.skipped[0].id, "no.such");
    assert.equal((await t.owner.post("/api/x/settings-snapshots/restore", { from: "nope", ids: ["wl0.radio"] })).status, 404);
    assert.equal((await t.owner.post("/api/x/settings-snapshots/restore", { from: saved.id, ids: [] })).status, 400);

    assert.equal((await t.owner.request("DELETE", `/api/x/settings-snapshots/snapshots/${saved.id}`)).status, 200);
    assert.equal((await t.owner.get(`/api/x/settings-snapshots/diff?a=${saved.id}`)).status, 404);
  } finally {
    await t.stop();
  }
});

test("settings-snapshots: the safety copy can be turned off, old ones are dropped and viewers cannot write", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.request("PUT", "/api/x/settings-snapshots/settings", { autoBeforeRestore: false, keep: 5 })).status, 200);
    assert.equal((await t.owner.request("PUT", "/api/x/settings-snapshots/settings", { autoBeforeRestore: "no", keep: 5 })).status, 400);
    assert.equal((await t.owner.request("PUT", "/api/x/settings-snapshots/settings", { autoBeforeRestore: false, keep: 500 })).status, 400);
    for (let i = 0; i < 7; i += 1) await t.owner.post("/api/x/settings-snapshots/snapshots", { name: `Snapshot ${i}` });
    const { snapshots, settings } = (await t.owner.get("/api/x/settings-snapshots/snapshots")).data;
    assert.deepEqual([snapshots.length, settings.autoBeforeRestore], [5, false]);
    assert.deepEqual(snapshots.map((s) => s.name), ["Snapshot 6", "Snapshot 5", "Snapshot 4", "Snapshot 3", "Snapshot 2"], "newest first, oldest dropped");

    await change(t, [{ id: "wl0.power", value: "30" }]);
    const restored = (await t.owner.post("/api/x/settings-snapshots/restore", { from: snapshots[0].id, ids: ["wl0.power"] })).data;
    assert.equal(restored.safetySnapshot, null);

    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("alex", "viewer password 1");
    assert.equal((await guest.get("/api/x/settings-snapshots/snapshots")).status, 200);
    assert.equal((await guest.post("/api/x/settings-snapshots/snapshots", { name: "nope" })).status, 403);
  } finally {
    await t.stop();
  }
});

test("settings-snapshots: the browser module is well formed", () => {
  assert.equal(checkFeatureModule(feature, "settings-snapshots"), null);
});
