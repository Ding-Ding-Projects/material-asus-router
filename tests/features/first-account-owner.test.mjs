// First account becomes the owner: no setup code, one atomic winner, later
// attempts refused with a pointer to sign-in, and old setup-code files removed.
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import feature from "../../public/js/features/first-account-owner/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { removeSetupCodeFiles } from "../../server/features/first-account-owner/index.mjs";
import { createApp } from "../../server/app.mjs";
import { Client, startApp } from "../helpers.mjs";

test("first-account-owner: the first registration works without a code and later attempts are refused", async () => {
  const t = await startApp();
  try {
    // startApp already registered Pat with no code at all. A second attempt is refused with a pointer to sign-in.
    const second = await t.client().post("/api/setup", { name: "Alex", username: "alex", password: "another long password" });
    assert.equal(second.status, 409);
    assert.deepEqual([second.data.code, second.data.signIn], ["ALREADY_SETUP", true]);
    assert.match(second.data.error, /Sign in instead/);
    // The owner is unchanged: Pat still signs in, Alex cannot.
    assert.equal((await t.client().signIn("pat", "correct horse battery")).status, 200);
    assert.equal((await t.client().signIn("alex", "another long password")).status, 401);
    assert.equal((await t.owner.get("/api/session")).data.setup, "done");
    const status = (await t.owner.get("/api/x/first-account-owner/status")).data;
    assert.deepEqual([status.hasOwner, status.ownerUsername, status.setupCodeRequired], [true, "pat", false]);
  } finally {
    await t.stop();
  }
});

test("first-account-owner: simultaneous first registrations produce exactly one owner", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-owner-"));
  const app = await createApp({ dataDir: dir });
  await app.listen(0, "127.0.0.1");
  try {
    const base = `http://127.0.0.1:${app.port}`;
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => new Client(base).post("/api/setup", { name: `P${i}`, username: `person${i}`, password: `a long password ${i} here` })));
    assert.equal(results.filter((r) => r.status === 200).length, 1, "exactly one winner");
    assert.equal(results.filter((r) => r.status === 409).length, 5, "everyone else is refused");
    const winner = results.findIndex((r) => r.status === 200);
    assert.equal((await new Client(base).signIn(`person${winner}`, `a long password ${winner} here`)).status, 200);
    assert.equal(app.store.read().owner.username, `person${winner}`);
    assert.equal(app.store.read().users.length, 0, "no one else was added");
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("first-account-owner: old setup-code files are removed and the setup form asks for no code", async () => {
  const t = await startApp();
  try {
    for (const name of ["setup-code", "setup-code.txt", "setup_token.json", "owner-code"]) await writeFile(path.join(t.dir, name), "123456");
    await writeFile(path.join(t.dir, "notes.txt"), "keep me");
    const status = (await t.owner.get("/api/x/first-account-owner/status")).data;
    assert.deepEqual(status.removedSetupCodeFiles.sort(), ["owner-code", "setup-code", "setup-code.txt", "setup_token.json"]);
    const left = await readdir(t.dir);
    assert.ok(left.includes("notes.txt") && !left.some((f) => /setup|owner-code/i.test(f)), "only setup-code files went");
    assert.deepEqual(await removeSetupCodeFiles(t.dir), [], "nothing left to remove");

    // The form the browser is served has no code field and says the first account becomes the owner.
    const auth = await (await fetch(`${t.base}/js/screens/auth.js`)).text();
    const setup = auth.slice(auth.indexOf("export function setupScreen"), auth.indexOf("export function signInScreen"));
    assert.match(setup, /first account made on a fresh install becomes the owner/);
    assert.doesNotMatch(setup, /setup.?code|invite|token/i);
    assert.equal((setup.match(/h\("input"/g) ?? []).length, 3, "name, user name and password only");
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "first-account-owner"), null);
  assert.match(await readFile("docs/articles/setup/first-owner-account.md", "utf8"), /There is no setup code/);
});
