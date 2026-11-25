// Local version history: every change to the app's saved state becomes a new
// revision in an isolated append-only file; a restore is a new revision; broken
// writes are survived; secrets are never recorded; and a history failure never
// fails the operation that caused it.
import assert from "node:assert/strict";
import { appendFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import feature from "../../public/js/features/local-history/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { diffSnapshots, snapshotOf } from "../../server/features/local-history/index.mjs";
import { startApp, waitFor } from "../helpers.mjs";

const base = "/api/x/local-history";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function superToken(client, action) {
  const id = (await client.post("/api/x/super-confirmation/begin", { action })).data.id;
  for (const [route, body] of [["key", { key: 1 }], ["key", { key: 2 }], ["slide", { value: 100 }]]) {
    await sleep(140);
    await client.post(`/api/x/super-confirmation/${route}`, { id, ...body });
  }
  await sleep(140);
  return (await client.post("/api/x/super-confirmation/finish", { id })).data.token;
}
const list = async (t, query = "") => (await t.owner.get(`${base}/revisions${query}`)).data;
const setGuard = (t, seconds) => t.owner.post("/api/settings", { guardSeconds: seconds });

test("local-history: a baseline is recorded, each change adds one revision with a derived action and a diff", async () => {
  const t = await startApp();
  try {
    const status = (await t.owner.get(`${base}/status`)).data;
    assert.equal(status.count, 1);
    assert.equal(status.gitFolderUsed, false);
    assert.ok(status.recordedOnly.includes("credential fingerprint") && status.restorable.join() === "settings");
    assert.equal((await list(t)).revisions[0].action, "baseline");

    assert.equal((await setGuard(t, 90)).status, 200);
    const after = await waitFor(async () => ((await list(t)).total === 2 ? await list(t) : null));
    const rev = after.revisions[0];
    assert.deepEqual([rev.action, rev.kind, rev.changed], ["settings", "change", ["settings.guardSeconds"]]);
    const detail = (await t.owner.get(`${base}/revisions/${rev.rev}`)).data;
    assert.deepEqual(detail.diff, [{ path: "settings.guardSeconds", before: undefined, after: 90 }].map((d) => ({ path: d.path, after: d.after })));
    // An identical save adds nothing.
    await setGuard(t, 90);
    await sleep(200);
    assert.equal((await list(t)).total, 2);
    // History lives beside the data, in its own folder, never as a .git folder.
    assert.ok((await readdir(path.join(t.dir, "history"))).includes("revisions.jsonl"));
    assert.ok(!(await readdir(t.dir)).includes(".git"));
  } finally {
    await t.stop();
  }
});

test("local-history: restores are new revisions, a restore of a restore works, and labels and diffs read back", async () => {
  const t = await startApp();
  try {
    await t.owner.get(`${base}/status`);
    await setGuard(t, 60);
    await waitFor(async () => (await list(t)).total === 2);
    await setGuard(t, 120);
    await waitFor(async () => (await list(t)).total === 3);

    // Restore revision 2 (guard 60): settings go back and a NEW revision 4 records it.
    const restored = await t.owner.post(`${base}/restore`, { rev: 2 });
    assert.equal(restored.status, 200, restored.text);
    assert.equal(restored.data.revision.rev, 4);
    assert.deepEqual([restored.data.revision.kind, restored.data.revision.restoredFrom], ["restore", 2]);
    assert.equal((await t.owner.get("/api/settings")).data.guardSeconds, 60);
    const revs = (await list(t)).revisions;
    assert.deepEqual(revs.map((r) => r.rev), [4, 3, 2, 1], "nothing was rewritten or removed");

    // A restore of that restore (revision 4 holds guard 60; restoring revision 3 first, then 4).
    await t.owner.post(`${base}/restore`, { rev: 3 });
    assert.equal((await t.owner.get("/api/settings")).data.guardSeconds, 120);
    const again = await t.owner.post(`${base}/restore`, { rev: 4 });
    assert.equal(again.data.revision.restoredFrom, 4);
    assert.equal((await t.owner.get("/api/settings")).data.guardSeconds, 60);

    const diff = (await t.owner.get(`${base}/diff?a=3&b=2`)).data.diff;
    assert.deepEqual(diff.map((d) => [d.path, d.before, d.after]), [["settings.guardSeconds", 120, 60]]);
    assert.equal((await t.owner.get(`${base}/diff?a=3&b=99`)).status, 404);
    assert.equal((await t.owner.post(`${base}/restore`, { rev: 99 })).status, 404);

    const label = await t.owner.post(`${base}/label`, { rev: 3, label: "before the holiday" });
    assert.equal(label.status, 200);
    assert.ok((await list(t)).revisions.some((r) => r.label === "before the holiday" && r.kind === "label"));
    assert.equal((await t.owner.post(`${base}/label`, { rev: 3, label: " " })).status, 400);

    // Only the owner restores.
    await t.owner.post("/api/users", { name: "Op", username: "op", password: "operator password 1", role: "operator" });
    const op = t.client();
    await op.signIn("op", "operator password 1");
    assert.equal((await op.post(`${base}/restore`, { rev: 2 })).status, 403);
  } finally {
    await t.stop();
  }
});

test("local-history: filters compose (date, action counts) and counts follow the date range", async () => {
  const t = await startApp();
  try {
    await t.owner.get(`${base}/status`);
    await setGuard(t, 45);
    await waitFor(async () => (await list(t)).total === 2);
    await t.owner.request("PATCH", `/api/users/${(await t.owner.post("/api/users", { name: "Op", username: "op", password: "operator password 1", role: "operator" })).data.id}`, { name: "Operator Two" });
    await waitFor(async () => (await list(t)).total >= 4);
    const all = await list(t);
    assert.ok(all.counts.settings >= 1 && all.counts.baseline === 1);
    const today = new Date().toISOString().slice(0, 10);
    assert.equal((await list(t, `?from=${today}&to=${today}`)).total, all.total);
    assert.equal((await list(t, "?from=2099-01-01")).matching, 0);
    assert.equal((await list(t, "?to=2000-01-01")).matching, 0);
    assert.deepEqual(Object.keys((await list(t, "?from=2099-01-01")).counts), []);
    const onlySettings = await list(t, "?action=settings");
    assert.ok(onlySettings.revisions.every((r) => r.action === "settings"));
    assert.equal(onlySettings.matching, all.counts.settings, "filters compose with counts of the date range");
    // Typed junk dates are ignored rather than breaking the list.
    assert.equal((await list(t, "?from=2026-1&to=soon")).matching, all.total);
  } finally {
    await t.stop();
  }
});

test("local-history: password and display-name changes are one entry each and never record the secret", async () => {
  const t = await startApp();
  try {
    await t.owner.get(`${base}/status`);
    const user = (await t.owner.post("/api/users", { name: "Op", username: "op", password: "operator password 1", role: "operator" })).data;
    await waitFor(async () => (await list(t)).total >= 2);
    const before = (await list(t)).total;
    await t.owner.request("PATCH", `/api/users/${user.id}`, { password: "a brand new password 22" });
    await waitFor(async () => (await list(t)).total === before + 1);
    assert.equal((await list(t)).revisions[0].action, "credential-change");
    await t.owner.request("PATCH", `/api/users/${user.id}`, { name: "Opal" });
    await waitFor(async () => (await list(t)).total === before + 2);
    assert.equal((await list(t)).revisions[0].action, "display-name-change");
    const exported = JSON.stringify((await t.owner.get(`${base}/export`)).data);
    const record = t.app.store.read();
    for (const secret of ["a brand new password 22", "operator password 1", record.owner.hash, record.owner.salt, record.users[0].hash]) assert.ok(!exported.includes(secret), "the history export holds no secret or hash");
    const raw = await readFile(path.join(t.dir, "history", "revisions.jsonl"), "utf8");
    for (const secret of ["a brand new password 22", record.owner.hash, record.users[0].hash]) assert.ok(!raw.includes(secret), "the history file holds no secret or hash");
    // Masking in diffs: any secret-looking key shows as hidden.
    const diff = diffSnapshots({ settings: { apiToken: "abc" } }, { settings: { apiToken: "def" } });
    assert.deepEqual(diff.map((d) => [d.before, d.after]), [["(hidden)", "(hidden)"]]);
    assert.ok(snapshotOf(record, t.app.vault).credentials.length === 16);
  } finally {
    await t.stop();
  }
});

test("local-history: an interrupted write is recovered from and a history failure never fails the operation", async () => {
  const t = await startApp();
  try {
    await t.owner.get(`${base}/status`);
    await setGuard(t, 33);
    await waitFor(async () => (await list(t)).total === 2);
    // A half-written last line, as left by a crash.
    await appendFile(path.join(t.dir, "history", "revisions.jsonl"), '{"rev":3,"parent":2,"at":"2026-11-2');
    const status = (await t.owner.get(`${base}/status`)).data;
    assert.deepEqual([status.count, status.damagedLines], [2, 1]);
    await setGuard(t, 44);
    const out = await waitFor(async () => ((await list(t)).total === 3 ? await list(t) : null));
    assert.deepEqual(out.revisions.map((r) => r.rev), [3, 2, 1], "the next revision continues after the damaged line");
    assert.equal((await t.owner.get(`${base}/revisions/3`)).status, 200);

    // Break the file so appends fail: the user's own operation still succeeds.
    await rm(path.join(t.dir, "history", "revisions.jsonl"));
    await mkdir(path.join(t.dir, "history", "revisions.jsonl"));
    const saved = await setGuard(t, 55);
    assert.equal(saved.status, 200, "the settings change succeeded although history could not be written");
    assert.equal((await t.owner.get("/api/settings")).data.guardSeconds, 55);
  } finally {
    await t.stop();
  }
});

test("local-history: pruning needs the owner and the two-key confirmation and keeps the baseline", async () => {
  const t = await startApp();
  try {
    await t.owner.get(`${base}/status`);
    for (let i = 0; i < 12; i++) {
      await setGuard(t, 40 + i);
      await waitFor(async () => (await list(t)).total === i + 2);
    }
    assert.equal((await t.owner.post(`${base}/prune`, { keep: 10 })).status, 403);
    assert.equal((await t.owner.post(`${base}/prune`, { keep: 5, token: "x" })).status, 400, "keep at least 10");
    const token = await superToken(t.owner, "local-history.prune");
    const out = await t.owner.post(`${base}/prune`, { keep: 10, token });
    assert.deepEqual([out.status, out.data.removed, out.data.kept], [200, 3, 10]);
    const revs = (await list(t)).revisions;
    assert.equal(revs.at(-1).action, "baseline");
    assert.equal(revs[0].rev, 13);
    assert.equal((await t.owner.post(`${base}/prune`, { keep: 10, token })).status, 403, "the token was spent");
    const exported = (await t.owner.get(`${base}/export?format=jsonl`)).data;
    assert.equal(exported.text.split("\n").length, 10);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "local-history"), null);
});
