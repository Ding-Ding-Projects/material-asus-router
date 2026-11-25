// Tests for cloud: exposure switches, masked token, read-only agreements,
// binding and feedback read-outs that never reveal values, and the module.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { CONFIRM_WORD, exposureSummary, feedbackWord } from "../../public/js/features/cloud/index.js";
import { startApp } from "../helpers.mjs";

test("cloud: the exposure summary and feedback word only claim what the facts say", () => {
  assert.deepEqual(exposureSummary({ aicloud: false, webdav: false }), { open: false, names: [] });
  assert.deepEqual(exposureSummary({ aicloud: true, webdav: true }).names, ["AiCloud", "WebDAV"]);
  assert.equal(feedbackWord({ keys: [], sending: false }), "none");
  assert.equal(feedbackWord({ keys: [{ key: "fb_state", set: false }], sending: false }), "idle");
  assert.equal(feedbackWord({ keys: [{ key: "fb_state", set: true }], sending: true }), "sending");
});

test("cloud: AiCloud and WebDAV are off by default, flagged as exposure, and write through the engine", async () => {
  const t = await startApp();
  try {
    const entries = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "cloud");
    const flagged = entries.filter((e) => e.meta?.exposure).map((e) => e.key).sort();
    assert.deepEqual(flagged, ["enable_webdav", "webdav_aidisk"]);
    for (const key of flagged) assert.equal(t.router.nvram[key], "0", `${key} is off by default`);
    assert.equal(entries.find((e) => e.key === "enable_webdav").risk, "network", "exposure changes get the safety net");

    const domain = (await t.owner.get("/api/domain/cloud")).data;
    assert.deepEqual(domain.exposed, { aicloud: false, webdav: false });
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "cloud.webdav.enable", value: "1" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal(preview.data.items.find((i) => i.key === "enable_webdav").risk, "network");
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.equal(t.router.nvram.enable_webdav, "1");
    assert.equal((await t.owner.get("/api/domain/cloud")).data.exposed.webdav, true);
    assert.equal(CONFIRM_WORD, "INTERNET");
  } finally {
    await t.stop();
  }
});

test("cloud: the IFTTT token is masked everywhere and agreements can never be written", async () => {
  const t = await startApp();
  try {
    const catalog = (await t.owner.get("/api/catalog")).data;
    const token = catalog.entries.find((e) => e.id === "cloud.ifttt.token");
    assert.deepEqual([token.value, token.masked, token.secret], ["", true, true]);
    assert.ok(!JSON.stringify(catalog).includes("example-ifttt-token"), "the token never reaches the browser");
    assert.ok(!JSON.stringify((await t.owner.get("/api/domain/cloud")).data).includes("example-ifttt-token"));
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "cloud.ifttt.token", value: "another-example-token" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.ok(!preview.text.includes("another-example-token") && !preview.text.includes("example-ifttt-token"), "the preview masks both tokens");

    for (const id of ["cloud.eula.asus", "cloud.eula.tm"]) {
      const entry = catalog.entries.find((e) => e.id === id);
      assert.equal(entry.readOnly, true);
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id, value: "1" }] })).status, 400, `${id} refuses a write`);
    }
    assert.deepEqual((await t.owner.get("/api/domain/cloud")).data.agreements, { asus: true, trendMicro: false });
    assert.ok(!t.router.commands.some((c) => /EULA/.test(c) && /set/.test(c)), "no EULA setting was ever written");
  } finally {
    await t.stop();
  }
});

test("cloud: binding and feedback show which settings are filled in, never their values", async () => {
  const t = await startApp();
  try {
    t.router.nvram.tm_device_bind_state = "private-binding-value";
    t.router.nvram.fb_comment = "private feedback text";
    t.app.session.invalidate();
    const domain = (await t.owner.get("/api/domain/cloud")).data;
    assert.equal(domain.binding.bound, true);
    assert.equal(domain.feedback.sending, true);
    assert.ok(domain.binding.keys.every((k) => Object.keys(k).sort().join() === "key,set"));
    assert.ok(!JSON.stringify(domain).includes("private-binding-value") && !JSON.stringify(domain).includes("private feedback text"));
    assert.equal(domain.binding.keys.find((k) => k.key === "aae_enable").set, false);
  } finally {
    await t.stop();
  }
});

test("cloud: a router without a setting is shown locked with the reason", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    delete t.router.nvram.alexa_enable;
    t.app.session.invalidate();
    const entries = (await t.owner.get("/api/domain/cloud")).data.entries;
    assert.equal(entries.find((e) => e.key === "alexa_enable").disabled.en, "This router does not have the setting alexa_enable");
    assert.ok(!entries.find((e) => e.key === "ifttt_token").disabled, "a setting the router has stays usable");
    assert.equal((await t.client().get("/api/domain/cloud")).status, 401);
  } finally {
    await t.stop();
  }
});

test("cloud: the browser module is well formed", () => {
  assert.equal(checkFeatureModule(feature, "cloud"), null);
});
