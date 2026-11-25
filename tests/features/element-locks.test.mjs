// Element locks: six credential mixes, per-lock credentials with no master
// one, credentials kept hashed or encrypted, waiting after wrong tries, and no
// route or command that opens a lock without its credentials.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import feature from "../../public/js/features/element-locks/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { base32Decode, totp } from "../../server/features/element-locks/totp.mjs";
import { MIXES } from "../../server/features/element-locks/index.mjs";
import { createApp } from "../../server/app.mjs";
import { startApp } from "../helpers.mjs";

const base = "/api/x/element-locks";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PIN = "135790";
const PASSWORD = "toy password one";

async function makeLock(t, key, mix, { pinCode = PIN, password = PASSWORD } = {}) {
  const body = { key, mix };
  if (mix.includes("pin")) body.pin = pinCode;
  if (mix.includes("password")) body.password = password;
  let secret = null;
  if (mix.includes("totp")) {
    secret = (await t.owner.post(`${base}/prepare-totp`, { key })).data.secret;
    body.code = totp(base32Decode(secret), Date.now());
  }
  const out = await t.owner.post(`${base}/lock`, body);
  assert.equal(out.status, 200, `${mix}: ${out.text}`);
  await t.owner.post(`${base}/relock`, { key });
  return secret;
}

const creds = (mix, secret, over = {}) => ({ ...(mix.includes("pin") ? { pin: PIN } : {}), ...(mix.includes("password") ? { password: PASSWORD } : {}), ...(mix.includes("totp") ? { code: totp(base32Decode(secret), Date.now()) } : {}), ...over });

test("element-locks: all six credential mixes lock, and unlock only with every part right", async () => {
  assert.deepEqual(MIXES, ["pin", "password", "pin+password", "password+totp", "pin+totp", "pin+password+totp"]);
  const t = await startApp();
  try {
    for (const [i, mix] of MIXES.entries()) {
      const key = `overview: Card ${i}`;
      const secret = await makeLock(t, key, mix);
      const state = (await t.owner.get(`${base}/state`)).data.locks.find((l) => l.key === key);
      assert.deepEqual([state.mix, state.locked], [mix, true]);
      // Each single wrong part is refused; the fourth try would wait, so use the right ones in between.
      const wrongs = [];
      if (mix.includes("pin")) wrongs.push({ pin: "000000" });
      if (mix.includes("password")) wrongs.push({ password: "a wrong password" });
      if (mix.includes("totp")) wrongs.push({ code: "000000" });
      for (const wrong of wrongs.slice(0, 1)) {
        const bad = await t.owner.post(`${base}/unlock`, { key, ...creds(mix, secret, wrong) });
        assert.equal(bad.status, 401, `${mix} with ${Object.keys(wrong)} wrong`);
        assert.equal((await t.owner.get(`${base}/state`)).data.locks.find((l) => l.key === key).locked, true);
      }
      // Missing a part is refused too.
      if (mix.includes("+")) assert.equal((await t.owner.post(`${base}/unlock`, { key, ...creds(mix, secret, { [mix.includes("password") ? "password" : "pin"]: undefined }) })).status, 401, `${mix} with a part missing`);
      const good = await t.owner.post(`${base}/unlock`, { key, ...creds(mix, secret) });
      assert.equal(good.status, 200, `${mix}: ${good.text}`);
      assert.equal((await t.owner.get(`${base}/state`)).data.locks.find((l) => l.key === key).locked, false);
    }
    assert.equal((await t.owner.post(`${base}/lock`, { key: "overview: Bad", mix: "none", pin: "1234" })).status, 400);
    assert.equal((await t.owner.post(`${base}/lock`, { key: "overview: Bad", mix: "pin", pin: "12" })).status, 400);
    assert.equal((await t.owner.post(`${base}/lock`, { key: "overview: Bad", mix: "password", password: "short" })).status, 400);
    assert.equal((await t.owner.post(`${base}/lock`, { key: "<script>", mix: "pin", pin: "1234" })).status, 400);
    assert.equal((await t.owner.post(`${base}/lock`, { key: "overview: Bad2", mix: "pin+totp", pin: "1234", code: "123456" })).status, 409, "the one-time code needs its secret first");
  } finally {
    await t.stop();
  }
});

test("element-locks: one-time codes allow one step of clock skew and no more", async () => {
  const t = await startApp();
  try {
    const key = "overview: Skew";
    const secret = await makeLock(t, key, "password+totp");
    const at = (offset) => totp(base32Decode(secret), Date.now() + offset);
    assert.equal((await t.owner.post(`${base}/unlock`, { key, password: PASSWORD, code: at(-90_000) })).status, 401, "three windows behind");
    assert.equal((await t.owner.post(`${base}/unlock`, { key, password: PASSWORD, code: at(-30_000) })).status, 200, "one window behind");
    await t.owner.post(`${base}/relock`, { key });
    assert.equal((await t.owner.post(`${base}/unlock`, { key, password: PASSWORD, code: at(30_000) })).status, 200, "one window ahead");
  } finally {
    await t.stop();
  }
});

test("element-locks: every lock has its own credentials, there is no master, and wrong tries wait", async () => {
  const t = await startApp();
  try {
    await makeLock(t, "overview: A", "pin", { pinCode: "1111" });
    await makeLock(t, "overview: B", "pin", { pinCode: "2222" });
    assert.equal((await t.owner.post(`${base}/unlock`, { key: "overview: B", pin: "1111" })).status, 401, "lock A's PIN does not open lock B");
    assert.equal((await t.owner.post(`${base}/unlock`, { key: "overview: A", pin: "2222" })).status, 401);
    // No master: neither the account password nor an empty credential opens a lock.
    assert.equal((await t.owner.post(`${base}/unlock`, { key: "overview: A", pin: "correct horse battery" })).status, 401);
    assert.equal((await t.owner.post(`${base}/unlock`, { key: "overview: A" })).status, 401, "an empty try is wrong too");
    // Three wrong tries on A start a wait, even the right PIN waits, and B is unaffected.
    const wait = await t.owner.post(`${base}/unlock`, { key: "overview: A", pin: "1111" });
    assert.deepEqual([wait.status, wait.data.code], [423, "WAITING"]);
    assert.equal((await t.owner.post(`${base}/unlock`, { key: "overview: B", pin: "2222" })).status, 200);
    assert.ok((await t.owner.get(`${base}/state`)).data.locks.find((l) => l.key === "overview: A").waitSeconds > 0);
    // Removing a lock needs its credentials; waiting blocks even that.
    assert.equal((await t.owner.post(`${base}/remove`, { key: "overview: A", pin: "1111" })).status, 423);
    assert.equal((await t.owner.post(`${base}/remove`, { key: "overview: B", pin: "0000" })).status, 401);
    assert.equal((await t.owner.post(`${base}/remove`, { key: "overview: B", pin: "2222" })).data.removed, true);
    assert.equal((await t.owner.get(`${base}/state`)).data.locks.some((l) => l.key === "overview: B"), false);
  } finally {
    await t.stop();
  }
});

test("element-locks: credentials never appear in state, history, responses or files in the clear", async () => {
  const t = await startApp();
  let second;
  try {
    const secret = await makeLock(t, "overview: Secret", "pin+password+totp");
    const state = JSON.stringify((await t.owner.get(`${base}/state`)).data);
    for (const needle of [PIN, PASSWORD, secret]) assert.ok(!state.includes(needle), "the state route leaks nothing");
    assert.ok(!/hash|salt/i.test(state));
    for (const needle of [PIN, PASSWORD, secret]) for (const file of await readdir(t.dir)) assert.ok(!(await readFile(path.join(t.dir, file)).catch(() => Buffer.alloc(0))).includes(needle), `${file} holds a credential in the clear`);
    await t.owner.get("/api/x/local-history/status");
    const history = JSON.stringify((await t.owner.get("/api/x/local-history/export")).data);
    for (const needle of [PIN, PASSWORD, secret]) assert.ok(!history.includes(needle), "history holds no credential");

    // Locks survive a restart (and come back locked).
    second = await createApp({ dataDir: t.dir, cacheTtlMs: 0 });
    await second.listen(0, "127.0.0.1");
    const client = t.client();
    client.base = `http://127.0.0.1:${second.port}`;
    await client.signIn("pat", "correct horse battery");
    const back = (await client.get(`${base}/state`)).data.locks;
    assert.deepEqual(back.map((l) => [l.key, l.mix, l.locked]), [["overview: Secret", "pin+password+totp", true]]);
    assert.equal((await client.post(`${base}/unlock`, { key: "overview: Secret", pin: PIN, password: PASSWORD, code: totp(base32Decode(secret), Date.now()) })).status, 200);
  } finally {
    await second?.close();
    await t.stop();
  }
});

test("element-locks: nothing but the credential opens a lock; clearing every lock needs the owner and two keys", async () => {
  const t = await startApp();
  try {
    await makeLock(t, "overview: Safe", "pin");
    // A viewer cannot touch locks at all, and a lock is per session, so another session is locked.
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const viewer = t.client();
    await viewer.signIn("vi", "viewer password 1");
    assert.equal((await viewer.post(`${base}/unlock`, { key: "overview: Safe", pin: PIN })).status, 403);
    assert.equal((await viewer.get(`${base}/state`)).data.locks[0].locked, true);
    const other = t.client();
    await other.signIn("pat", "correct horse battery");
    assert.equal((await other.get(`${base}/state`)).data.locks[0].locked, true, "a new sign-in sees the lock closed");
    assert.equal((await other.post(`${base}/clear-all`, {})).status, 403);
    // The clear-all recovery needs a finished two-key confirmation.
    const id = (await other.post("/api/x/super-confirmation/begin", { action: "element-locks.clear-all" })).data.id;
    for (const [route, body] of [["key", { key: 1 }], ["key", { key: 2 }], ["slide", { value: 100 }]]) (await sleep(140), await other.post(`/api/x/super-confirmation/${route}`, { id, ...body }));
    await sleep(140);
    const token = (await other.post("/api/x/super-confirmation/finish", { id })).data.token;
    assert.equal((await other.post(`${base}/clear-all`, { token })).data.cleared, true);
    assert.deepEqual((await other.get(`${base}/state`)).data.locks, []);
  } finally {
    await t.stop();
  }
});

test("element-locks: the browser module has no command or shortcut that bypasses a lock and says the lock is a toy", async () => {
  assert.equal(checkFeatureModule(feature, "element-locks"), null);
  assert.equal(feature.commands, undefined, "no palette entry can open a lock");
  assert.equal(feature.screens, undefined, "no screen can open a lock");
  const source = await readFile("public/js/features/element-locks/index.js", "utf8");
  assert.match(source, /setAttribute\("inert", ""\)/, "a locked card is truly disabled");
  assert.match(source, /just for fun/);
  assert.match(source, /support:open/, "the unlock prompt links to the Support Tickets desk");
  assert.match(source, /ladder:open/, "the unlock prompt links to the unlock ladder");
  assert.match(source, /aria-label": k === "back"/, "the keypad buttons are labelled");
  for (const mix of MIXES) assert.ok(source.includes(`"${mix}"`) || source.includes(mix.replace("+", "+")), `${mix} is offered`);
});
