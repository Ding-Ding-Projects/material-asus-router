// The setup checklist: its steps, saved progress, skipping rules, and the real
// server calls its steps make.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/onboarding-wizard/index.js";
import { STEPS, complete, emptyProgress, guardValid, percent, sanitize, skip } from "../../public/js/features/onboarding-wizard/steps.js";
import { assertModuleListed } from "../nav-kit.mjs";
import { startApp } from "../helpers.mjs";

test("onboarding-wizard: the steps are bilingual and only the checks that can be skipped are optional", () => {
  assert.deepEqual(STEPS.map((s) => s.id), ["router", "guard", "people", "finish"]);
  for (const s of STEPS) assert.ok(s.title.en && s.title.yue && s.about.en && s.about.yue, s.id);
  assert.deepEqual(STEPS.filter((s) => s.optional).map((s) => s.id), ["guard", "people"]);
});

test("onboarding-wizard: progress completes and skips steps, and a required step cannot be skipped", () => {
  let p = emptyProgress();
  assert.equal(percent(p), 0);
  p = complete(p, "router");
  p = skip(p, "guard");
  assert.deepEqual([p.done, p.skipped], [["router"], ["guard"]]);
  assert.equal(skip(p, "router"), p, "the router check is required");
  assert.equal(percent(p), 50);
  p = complete(p, "guard");
  assert.deepEqual(p.skipped, [], "completing a skipped step removes the skip");
  assert.equal(percent(complete(complete(complete(p, "people"), "finish"), "router")), 100);
});

test("onboarding-wizard: saved progress is resumed and bad stored data is dropped", () => {
  assert.deepEqual(sanitize({ step: 2, done: ["router", "bogus"], skipped: ["guard", 5] }), { step: 2, done: ["router"], skipped: ["guard"] });
  assert.deepEqual(sanitize({ step: 99 }), emptyProgress());
  assert.deepEqual(sanitize(null), emptyProgress());
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify({ step: 1, done: ["router"], skipped: [] }))), { step: 1, done: ["router"], skipped: [] });
});

test("onboarding-wizard: the safety timer rule is the server's rule, and the server enforces it", async () => {
  for (const n of [19, 601, 1.5, NaN]) assert.equal(guardValid(n), false, String(n));
  for (const n of [20, 60, 600]) assert.equal(guardValid(n), true, String(n));
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/settings", { guardSeconds: 19 })).status, 400);
    assert.equal((await t.owner.post("/api/settings", { guardSeconds: 90 })).status, 200);
    assert.equal((await t.owner.get("/api/settings")).data.guardSeconds, 90);
    const router = (await t.owner.get("/api/router")).data;
    for (const k of ["connected", "host", "port", "username", "authType", "demo"]) assert.ok(k in router, `the router view has ${k}`);
    assert.deepEqual(Object.keys(router).filter((k) => /pass|private|secret/i.test(k)), [], "no credential is in the connection view");
    const users = (await t.owner.get("/api/users")).data;
    assert.equal(users.owner.username, "pat");
  } finally {
    await t.stop();
  }
});

test("onboarding-wizard: the module is listed, styled and well formed", async () => {
  await assertModuleListed("onboarding-wizard", feature, { style: true });
  assert.ok(feature.screens.some((s) => s.id === "setup"));
});
