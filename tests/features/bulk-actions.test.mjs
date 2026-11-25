// Bulk actions on devices: the exact count, skipped devices with reasons, the
// change engine's preview, and undo through the normal history.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/bulk-actions/index.js";
import { createSelection } from "../../public/js/features/bulk-actions/selection.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp, waitFor } from "../helpers.mjs";

const base = "/api/x/bulk-actions";

async function applyOps(t, ops) {
  const preview = await t.owner.post("/api/changes/preview", { ops });
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  return waitFor(async () => {
    const record = (await t.owner.get(`/api/changes/history/${applied.data.id}`)).data;
    return record.status !== "guarded" && record.status !== "applying" ? record : null;
  });
}

test("bulk-actions: the device list is searchable and lists every action", async () => {
  const t = await startApp();
  try {
    const all = (await t.owner.get(`${base}/devices`)).data;
    assert.ok(all.total >= 3 && all.devices.length === all.total);
    assert.deepEqual(all.actions.map((a) => a.id), ["forget-names", "unreserve", "block", "unblock"]);
    assert.ok(all.actions.filter((a) => a.destructive).map((a) => a.id).join() === "forget-names,unreserve");
    const nas = (await t.owner.get(`${base}/devices?q=${encodeURIComponent(all.devices[0].mac.slice(0, 8))}`)).data;
    assert.ok(nas.devices.length >= 1 && nas.devices.length <= all.total);
  } finally {
    await t.stop();
  }
});

test("bulk-actions: a plan reports the exact count, each skipped device and its reason, and previews through the change engine", async () => {
  const t = await startApp();
  try {
    const all = (await t.owner.get(`${base}/devices`)).data.devices;
    const named = all.filter((d) => d.customName);
    const unnamed = all.filter((d) => !d.customName);
    assert.ok(named.length >= 1 && unnamed.length >= 1);
    const plan = (await t.owner.post(`${base}/plan`, { action: "forget-names", macs: [...named.map((d) => d.mac), unnamed[0].mac, "AA:AA:AA:AA:AA:AA", "not-a-mac"] })).data;
    assert.equal(plan.count, named.length);
    assert.equal(plan.requested, named.length + 3);
    assert.deepEqual(plan.skipped.map((s) => s.reason).sort(), ["it has no custom name", "not a valid MAC address", "the router no longer lists this device"].sort());
    assert.equal(plan.destructive, true);
    assert.equal(plan.undoable, true);
    assert.ok(plan.preview.id && plan.preview.items.length >= 1, "the change engine produced a preview");
    assert.deepEqual(plan.ops.map((o) => o.op), named.map(() => "rename"));

    const none = (await t.owner.post(`${base}/plan`, { action: "unblock", macs: [all[0].mac] })).data;
    assert.deepEqual([none.count, none.preview, none.skipped[0].reason], [0, null, "it is not blocked"]);
    assert.equal((await t.owner.post(`${base}/plan`, { action: "explode", macs: [all[0].mac] })).status, 400);
    assert.equal((await t.owner.post(`${base}/plan`, { action: "block", macs: [] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("bulk-actions: blocking a selection applies once and can be undone from the change history", async () => {
  const t = await startApp();
  try {
    const all = (await t.owner.get(`${base}/devices`)).data.devices;
    const chosen = all.slice(0, 2).map((d) => d.mac);
    const plan = (await t.owner.post(`${base}/plan`, { action: "block", macs: [...chosen, chosen[0]] })).data;
    assert.equal(plan.count, 2, "a repeated device counts once");
    const record = await applyOps(t, plan.ops);
    assert.equal(record.status, "applied");
    assert.deepEqual((await t.owner.get(`${base}/devices`)).data.devices.filter((d) => chosen.includes(d.mac)).map((d) => d.blocked), [true, true]);
    const again = (await t.owner.post(`${base}/plan`, { action: "block", macs: chosen })).data;
    assert.deepEqual([again.count, again.skipped.length, again.skipped[0].reason], [0, 2, "it is already blocked"]);
    const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
    assert.equal(undo.status, 200, undo.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: undo.data.id })).status, 200);
    await waitFor(async () => !(await t.owner.get(`${base}/devices`)).data.devices.some((d) => chosen.includes(d.mac) && d.blocked));
  } finally {
    await t.stop();
  }
});

test("bulk-actions: viewers and signed-out people cannot plan, and the selection model behaves", async () => {
  const t = await startApp();
  try {
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const viewer = t.client();
    await viewer.signIn("vi", "viewer password 1");
    assert.equal((await viewer.get(`${base}/devices`)).status, 200);
    assert.equal((await viewer.post(`${base}/plan`, { action: "block", macs: ["AA:BB:CC:DD:EE:FF"] })).status, 403);
    assert.equal((await t.client().get(`${base}/devices`)).status, 401);
  } finally {
    await t.stop();
  }
  const sel = createSelection();
  const page = ["a", "b", "c", "d"];
  sel.toggle("a", page);
  sel.toggle("c", page, { shift: true });
  assert.deepEqual([...sel.chosen], ["a", "b", "c"]);
  sel.invert(page);
  assert.deepEqual([...sel.chosen], ["d"]);
  assert.equal(checkFeatureModule(feature, "bulk-actions"), null);
});
