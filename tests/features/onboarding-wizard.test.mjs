// The setup guide: real steps, saved progress that can be resumed, optional
// steps that can be skipped, no password stored, and a finish that opens the
// workspace.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import feature from "../../public/js/features/onboarding-wizard/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { STEPS } from "../../server/features/onboarding-wizard/index.mjs";
import { startApp } from "../helpers.mjs";

const base = "/api/x/onboarding-wizard";

test("onboarding-wizard: progress starts at the first step, saves values, resumes and can be started over", async () => {
  const t = await startApp();
  try {
    const first = (await t.owner.get(`${base}/progress`)).data;
    assert.deepEqual(first.steps, ["owner", "router", "login", "test", "polling", "finish"]);
    assert.deepEqual([first.step, first.completed, first.dismissed, first.ownerDone, first.routerConfigured], [0, false, false, true, true]);
    assert.equal(first.router.host, "127.0.0.1");

    const saved = await t.owner.post(`${base}/progress`, { step: 2, finished: 1, values: { host: "198.51.100.1", port: 2222, username: "pat", authType: "key" } });
    assert.equal(saved.status, 200, saved.text);
    assert.deepEqual([saved.data.step, saved.data.done, saved.data.values], [2, ["router"], { host: "198.51.100.1", port: 2222, username: "pat", authType: "key" }]);
    // Resume: a fresh sign-in sees where the person stopped.
    const again = t.client();
    await again.signIn("pat", "correct horse battery");
    const resumed = (await again.get(`${base}/progress`)).data;
    assert.deepEqual([resumed.step, resumed.values.host, resumed.done], [2, "198.51.100.1", ["router"]]);

    assert.equal((await t.owner.post(`${base}/restart`)).data.restarted, true);
    assert.equal((await t.owner.get(`${base}/progress`)).data.step, 0);
  } finally {
    await t.stop();
  }
});

test("onboarding-wizard: only optional steps can be skipped and every value is validated", async () => {
  const t = await startApp();
  try {
    const skip = await t.owner.post(`${base}/progress`, { step: 5, skipped: "polling" });
    assert.deepEqual([skip.status, skip.data.skipped], [200, ["polling"]]);
    assert.equal((await t.owner.post(`${base}/progress`, { step: 3, skipped: "test" })).status, 400, "the connection test is not optional");
    assert.equal((await t.owner.post(`${base}/progress`, { step: 9 })).status, 400);
    assert.equal((await t.owner.post(`${base}/progress`, { step: 1, values: { host: "not a host!" } })).status, 400);
    assert.equal((await t.owner.post(`${base}/progress`, { step: 1, values: { port: 70000 } })).status, 400);
    assert.equal((await t.owner.post(`${base}/progress`, { step: 2, values: { username: "bad user;rm" } })).status, 400);
    assert.equal((await t.owner.post(`${base}/progress`, { step: 4, values: { pollSeconds: 1 } })).status, 400);
    assert.equal((await t.owner.post(`${base}/progress`, { step: 4, values: { pollSeconds: 15 } })).data.values.pollSeconds, 15);
    assert.equal(STEPS.length, 6);
  } finally {
    await t.stop();
  }
});

test("onboarding-wizard: no password is ever saved, and the router test uses the app's own connect route", async () => {
  const t = await startApp();
  try {
    const secret = "an ssh password nobody may keep";
    await t.owner.post(`${base}/progress`, { step: 2, values: { host: "198.51.100.1", username: "pat", authType: "password", password: secret } });
    const saved = JSON.stringify((await t.owner.get(`${base}/progress`)).data);
    assert.ok(!saved.includes(secret), "the progress route never returns a password");
    for (const file of await readdir(t.dir)) assert.ok(!(await readFile(path.join(t.dir, file)).catch(() => Buffer.alloc(0))).toString("latin1").includes(secret), `${file} holds the password`);
    // The wizard's connection test is the app's real connect route, answered by the pretend router.
    const connect = await t.owner.post("/api/router/connect", { host: "127.0.0.1", port: t.router.port, username: t.router.username, authType: "password", password: t.router.password });
    assert.equal(connect.status, 200, connect.text);
    assert.equal(connect.data.connected, true);
    const wrong = await t.owner.post("/api/router/connect", { host: "127.0.0.1", port: t.router.port, username: t.router.username, authType: "password", password: "wrong password here" });
    assert.ok(wrong.status >= 400, "a wrong SSH password fails honestly");
  } finally {
    await t.stop();
  }
});

test("onboarding-wizard: finishing needs a router, opens the workspace and can be dismissed; viewers only read", async () => {
  const t = await startApp({ configure: true });
  const none = await startApp({ configure: false });
  try {
    assert.equal((await none.owner.post(`${base}/complete`)).status, 409, "no router is connected yet");
    assert.equal((await t.owner.post(`${base}/complete`)).data.completed, true);
    const done = (await t.owner.get(`${base}/progress`)).data;
    assert.deepEqual([done.completed, done.step], [true, 5]);
    assert.equal((await t.owner.post(`${base}/dismiss`)).data.dismissed, true);
    assert.equal((await t.owner.get(`${base}/progress`)).data.dismissed, true);
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const viewer = t.client();
    await viewer.signIn("vi", "viewer password 1");
    assert.equal((await viewer.get(`${base}/progress`)).status, 200);
    assert.equal((await viewer.post(`${base}/progress`, { step: 1 })).status, 403);
    assert.equal((await t.client().get(`${base}/progress`)).status, 401);
  } finally {
    await t.stop();
    await none.stop();
  }
});

test("onboarding-wizard: the browser steps cover the real actions, navigation, keyboard use and the workspace at the end", async () => {
  assert.equal(checkFeatureModule(feature, "onboarding-wizard"), null);
  const source = await readFile("public/js/features/onboarding-wizard/index.js", "utf8");
  for (const needle of ["/api/router/connect", "/api/router/approve-host-key", "/api/router/key", "onboarding-wizard/complete", 'ctx.navigate("overview")', "Skip this step", "Back", "Next", 'e.key === "Enter"', "aria-current", "tabindex", "In progress"]) assert.ok(source.includes(needle), `the guide uses ${needle}`);
  assert.doesNotMatch(source, /password: form\.password[^}]*progress/, "the password goes only to the connect route");
  assert.match(source, /save\(/);
  assert.equal(feature.screens[0].group.en, "Help");
});
