// Two-key super confirmation: nothing is confirmed until both keys and the full
// slide are done, in order, by a person; a token works once and only for the
// action it was made for.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import feature from "../../public/js/features/super-confirmation/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp } from "../helpers.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = "/api/x/super-confirmation";

test("super-confirmation: untouched, one key, both keys, partial slide and full slide", async () => {
  const t = await startApp();
  try {
    const { id } = (await t.owner.post(`${base}/begin`, { action: "demo.action", summary: "Delete everything" })).data;
    const finish = () => t.owner.post(`${base}/finish`, { id });

    // Untouched.
    let r = await finish();
    assert.deepEqual([r.status, r.data.code], [409, "INCOMPLETE"]);
    // The slider is refused before both keys are turned.
    assert.equal((await t.owner.post(`${base}/slide`, { id, value: 100 })).status, 409);
    // One key only.
    await sleep(140);
    assert.deepEqual((await t.owner.post(`${base}/key`, { id, key: 1 })).data, { key1: true, key2: false });
    assert.equal((await finish()).status, 409);
    // Both keys, no slide.
    await sleep(140);
    assert.deepEqual((await t.owner.post(`${base}/key`, { id, key: 2 })).data, { key1: true, key2: true });
    assert.equal((await finish()).status, 409);
    // A partial slide does not count.
    await sleep(140);
    assert.deepEqual((await t.owner.post(`${base}/slide`, { id, value: 60 })).data, { slider: false });
    assert.equal((await finish()).status, 409);
    // The full slide completes it.
    await sleep(140);
    assert.deepEqual((await t.owner.post(`${base}/slide`, { id, value: 100 })).data, { slider: true });
    r = await finish();
    assert.equal(r.status, 200, r.text);
    assert.equal(r.data.action, "demo.action");
    assert.ok(r.data.token.length >= 20);
    // The confirmation is spent: finishing again fails, and the token is valid exactly for its action.
    assert.equal((await finish()).status, 410);
    assert.equal((await t.owner.post(`${base}/check`, { token: r.data.token, action: "demo.action" })).data.valid, true);
    assert.equal((await t.owner.post(`${base}/check`, { token: r.data.token, action: "other.action" })).data.valid, false);
  } finally {
    await t.stop();
  }
});

test("super-confirmation: cancel, bad keys, too-fast presses and bad actions", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post(`${base}/begin`, { action: "NOT VALID" })).status, 400);
    const { id } = (await t.owner.post(`${base}/begin`, { action: "demo.cancel" })).data;
    await sleep(140);
    assert.equal((await t.owner.post(`${base}/key`, { id, key: 3 })).status, 400);
    assert.equal((await t.owner.post(`${base}/key`, { id, key: 1 })).status, 200);
    // A second press straight away is refused as too fast for a person.
    assert.equal((await t.owner.post(`${base}/key`, { id, key: 2 })).status, 429);
    assert.equal((await t.owner.post(`${base}/cancel`, { id })).data.cancelled, true);
    assert.equal((await t.owner.post(`${base}/key`, { id, key: 2 })).status, 410, "a cancelled confirmation cannot continue");
    // Nobody else can use somebody's confirmation.
    const mine = (await t.owner.post(`${base}/begin`, { action: "demo.mine" })).data.id;
    await t.owner.post("/api/users", { name: "Op", username: "op", password: "operator password 1", role: "operator" });
    const other = t.client();
    await other.signIn("op", "operator password 1");
    assert.equal((await other.post(`${base}/key`, { id: mine, key: 1 })).status, 410);
    // Viewers can never confirm.
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const viewer = t.client();
    await viewer.signIn("vi", "viewer password 1");
    assert.equal((await viewer.post(`${base}/begin`, { action: "demo.viewer" })).status, 403);
    assert.equal((await t.client().post(`${base}/begin`, { action: "demo.anon" })).status, 401);
  } finally {
    await t.stop();
  }
});

test("super-confirmation: the dialog offers Escape, an always-available Emergency exit and returns focus", async () => {
  assert.equal(checkFeatureModule(feature, "super-confirmation"), null);
  const source = await readFile("public/js/features/super-confirmation/index.js", "utf8");
  assert.match(source, /Emergency exit/);
  assert.match(source, /superconfirm:ask/);
  assert.match(source, /opener\?\.focus/, "focus returns to the control that asked");
  assert.match(source, /detail\.claimed/, "an unclaimed ask resolves to no, so callers fail closed");
  // Escape is handled by the shared dialog (cancel closes with no token); the sheet must not swallow it.
  assert.doesNotMatch(source, /preventDefault\(\)[^\n]*Escape/);
  const css = await readFile("public/js/features/super-confirmation/style.css", "utf8");
  assert.match(css, /sc-key\.hold/);
  const commands = feature.commands.map((c) => c.id);
  assert.deepEqual(commands, ["super-confirmation.try"]);
});
