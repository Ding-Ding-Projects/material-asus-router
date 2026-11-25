// Speed test: settings are real nvram controls, a run measures with curl on the
// (pretend) router in steps, the result is saved in the app's own state, and a
// dead server is reported honestly.
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/speed-test/index.js";
import { startApp } from "../helpers.mjs";

process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "mar-speed-"));

// The test server settings are this app's own preferences, saved by the app and never written to the router.
async function change(t, id, value) {
  const saved = await t.owner.request("PUT", "/api/x/speed-test/prefs", { changes: [{ id, value }] });
  assert.equal(saved.status, 200, saved.text);
}

test("speed-test: preferences are saved by the app, a run measures in steps and the result is saved", async () => {
  const t = await startApp();
  try {
    // Nothing here is a router setting: the preferences are the app's own and the router never receives them.
    assert.deepEqual((await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "speed-test"), []);
    const before = Object.keys(t.router.nvram).sort();
    const prefs = (await t.owner.get("/api/domain/speed-test")).data.entries;
    assert.deepEqual(prefs.map((e) => e.id).sort(), ["speed-test.chunks", "speed-test.host", "speed-test.scheme", "speed-test.size", "speed-test.style", "speed-test.upload"]);
    assert.ok(prefs.every((e) => e.appSetting === true));
    assert.equal((await t.owner.request("PUT", "/api/x/speed-test/prefs", { changes: [{ id: "speed-test.chunks", value: "99" }] })).status, 400, "a wrong value is refused");
    assert.equal((await t.owner.request("PUT", "/api/x/speed-test/prefs", { changes: [{ id: "speed-test.nothing", value: "1" }] })).status, 404);

    const first = await t.owner.post("/api/x/speed-test/runs");
    assert.equal(first.status, 409, "no server chosen yet");

    await change(t, "speed-test.host", "speed.example.net");
    await change(t, "speed-test.chunks", "3");
    const domain = (await t.owner.get("/api/domain/speed-test")).data;
    assert.deepEqual([domain.host, domain.configured, domain.chunks, domain.upload], ["speed.example.net", true, 3, true]);

    const run = (await t.owner.post("/api/x/speed-test/runs")).data;
    assert.deepEqual([run.steps, run.upload], [3, true]);
    let last;
    for (let i = 0; i < 6; i += 1) {
      last = (await t.owner.post(`/api/x/speed-test/runs/${run.id}/step`)).data;
      assert.ok(last.runningMbit > 0);
      if (i < 5) assert.equal(last.finished, undefined);
    }
    assert.equal(Math.round(last.finished.down), 90);
    assert.equal(Math.round(last.finished.up), 24);
    assert.equal(last.finished.host, "speed.example.net");
    assert.ok(t.router.commands.some((c) => c.includes("curl -s -o /dev/null") && c.includes("https://speed.example.net/__down?bytes=8333333")));
    assert.ok(t.router.commands.some((c) => c.includes("--data-binary @- 'https://speed.example.net/__up'")));
    assert.equal((await t.owner.post(`/api/x/speed-test/runs/${run.id}/step`)).status, 404, "a finished run is gone");

    const history = (await t.owner.get("/api/x/speed-test/history")).data.history;
    assert.equal(history.length, 1);
    assert.equal((await t.owner.get("/api/domain/speed-test")).data.history.length, 1);

    // Download only, using fixed files.
    await change(t, "speed-test.upload", "0");
    await change(t, "speed-test.style", "file");
    const second = (await t.owner.post("/api/x/speed-test/runs")).data;
    let done;
    for (let i = 0; i < 3; i += 1) done = (await t.owner.post(`/api/x/speed-test/runs/${second.id}/step`)).data;
    assert.equal(done.finished.up, null);
    assert.ok(t.router.commands.some((c) => c.includes("https://speed.example.net/8MB.bin")));
    assert.deepEqual(Object.keys(t.router.nvram).sort(), before, "the router has no new or changed setting names");
    assert.ok(!t.router.commands.some((c) => c.startsWith("nvram set")), "nothing was written to the router");
  } finally {
    await t.stop();
  }
});

test("speed-test: an unreachable server is reported, history can be cleared and viewers cannot start a run", async () => {
  const t = await startApp();
  try {
    await change(t, "speed-test.host", "gone.invalid");
    const run = (await t.owner.post("/api/x/speed-test/runs")).data;
    const failed = await t.owner.post(`/api/x/speed-test/runs/${run.id}/step`);
    assert.equal(failed.status, 502);
    assert.match(failed.data.error ?? failed.text, /did not answer/);

    const cleared = await t.owner.request("DELETE", "/api/x/speed-test/history");
    assert.equal(cleared.status, 200);
    assert.deepEqual((await t.owner.get("/api/x/speed-test/history")).data.history, []);

    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("alex", "viewer password 1");
    assert.equal((await guest.get("/api/x/speed-test/history")).status, 200);
    assert.equal((await guest.request("PUT", "/api/x/speed-test/prefs", { changes: [{ id: "speed-test.upload", value: "0" }] })).status, 403, "viewers cannot save preferences");
    assert.equal((await guest.post("/api/x/speed-test/runs")).status, 403);
  } finally {
    await t.stop();
  }
});

test("speed-test: the browser module is well formed and the gauge scales", async () => {
  assert.equal(checkFeatureModule(feature, "speed-test"), null);
  assert.equal(feature.screens[0].group.en, "Monitor");
  assert.ok(feature.commands.length >= 1);
});
