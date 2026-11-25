// The authenticator: RFC 4226 and 6238 vectors, accounts and their secrets,
// search, grouping, reordering, bulk actions behind the two-key confirmation,
// and exports that leave secrets out unless the owner confirms.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import feature from "../../public/js/features/authenticator/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { base32Decode, base32Encode, buildUri, codeNow, hotp, parseUri, totp, verify } from "../../server/features/authenticator/totp.mjs";
import { createApp } from "../../server/app.mjs";
import { startApp } from "../helpers.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function superToken(client, action) {
  const id = (await client.post("/api/x/super-confirmation/begin", { action, summary: "test" })).data.id;
  for (const [route, body] of [["key", { key: 1 }], ["key", { key: 2 }], ["slide", { value: 100 }]]) {
    await sleep(140);
    const r = await client.post(`/api/x/super-confirmation/${route}`, { id, ...body });
    assert.equal(r.status, 200, r.text);
  }
  await sleep(140);
  return (await client.post("/api/x/super-confirmation/finish", { id })).data.token;
}

const SECRET = "JBSWY3DPEHPK3PXP";
const copies = ["qr-pairing", "element-locks"];

test("authenticator: RFC 4226 HOTP vectors", () => {
  const key = Buffer.from("12345678901234567890");
  const want = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  assert.deepEqual(want.map((_, i) => hotp(key, i)), want);
});

test("authenticator: RFC 6238 vectors for SHA-1, SHA-256 and SHA-512", () => {
  const keys = { SHA1: Buffer.from("12345678901234567890"), SHA256: Buffer.from("12345678901234567890123456789012"), SHA512: Buffer.from("1234567890123456789012345678901234567890123456789012345678901234") };
  const rows = [[59, "94287082", "46119246", "90693936"], [1111111109, "07081804", "68084774", "25091201"], [1111111111, "14050471", "67062674", "99943326"], [1234567890, "89005924", "91819424", "93441116"], [2000000000, "69279037", "90698825", "38618901"], [20000000000, "65353130", "77737706", "47863826"]];
  for (const [time, a, b, c] of rows) {
    assert.equal(totp(keys.SHA1, time * 1000, { digits: 8, algorithm: "SHA1" }), a, `SHA1 at ${time}`);
    assert.equal(totp(keys.SHA256, time * 1000, { digits: 8, algorithm: "SHA256" }), b, `SHA256 at ${time}`);
    assert.equal(totp(keys.SHA512, time * 1000, { digits: 8, algorithm: "SHA512" }), c, `SHA512 at ${time}`);
  }
});

test("authenticator: digits, period, rollover, the next code and clock skew", () => {
  const key = base32Decode(SECRET);
  assert.equal(totp(key, 1_000_000, { digits: 7 }).length, 7);
  assert.equal(totp(key, 1_000_000, { digits: 6, period: 90 }).length, 6);
  // At a window boundary the code changes, and the "next" code becomes the current one.
  const before = codeNow(SECRET, 59_000);
  const after = codeNow(SECRET, 60_000);
  assert.equal(before.remaining, 1);
  assert.equal(after.remaining, 30);
  assert.equal(before.next, after.code);
  assert.notEqual(before.code, after.code);
  // Skew: one window either side is accepted, two are not.
  const now = 1_700_000_000_000;
  assert.ok(verify(SECRET, totp(key, now - 30_000), now));
  assert.ok(verify(SECRET, totp(key, now + 30_000), now));
  assert.ok(!verify(SECRET, totp(key, now - 90_000), now));
  assert.ok(!verify(SECRET, "12345", now));
  assert.equal(base32Encode(base32Decode("GEZDGNBVGY3TQOJQ")), "GEZDGNBVGY3TQOJQ");
  assert.throws(() => base32Decode("not base32!"), /letters A to Z/);
  assert.throws(() => base32Decode("ABC"), /too short/);
});

test("authenticator: otpauth addresses are read and written faithfully", () => {
  const uri = buildUri({ issuer: "Example Co", label: "pat@example.com", secret: SECRET, algorithm: "SHA512", digits: 8, period: 45 });
  const back = parseUri(uri);
  assert.deepEqual([back.issuer, back.label, back.secret, back.algorithm, back.digits, back.period], ["Example Co", "pat@example.com", SECRET, "SHA512", 8, 45]);
  assert.throws(() => parseUri("https://example.com"), /not an otpauth/);
  assert.throws(() => parseUri("otpauth://hotp/x?secret=JBSWY3DPEHPK3PXP"), /time-based/);
  assert.throws(() => parseUri("otpauth://totp/x"), /no secret/);
  assert.throws(() => parseUri("otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&digits=9"), /6, 7 or 8/);
});

test("authenticator: the totp copies in other feature folders are identical", async () => {
  const original = await readFile(path.join("server", "features", "authenticator", "totp.mjs"), "utf8");
  for (const folder of copies) assert.equal(await readFile(path.join("server", "features", folder, "totp.mjs"), "utf8"), original, `${folder}/totp.mjs differs`);
});

test("authenticator: accounts, codes, search, grouping, reorder, bulk delete and exports", async () => {
  const t = await startApp();
  try {
    const add = async (body) => (await t.owner.post("/api/x/authenticator/accounts", body));
    const a = (await add({ uri: buildUri({ issuer: "Alpha", label: "pat", secret: SECRET }) })).data;
    const b = (await add({ issuer: "Beta", label: "alex", secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", algorithm: "SHA256", digits: 8, period: 60 })).data;
    assert.equal((await add({ label: "x", secret: "bad secret!" })).status, 400);
    assert.equal((await add({ label: "", secret: SECRET })).status, 400);

    const codes = (await t.owner.get(`/api/x/authenticator/codes?clientTime=${Date.now()}`)).data;
    assert.equal(codes.codes.length, 2);
    const one = codes.codes.find((c) => c.id === a.id);
    assert.equal(one.code.length, 6);
    assert.ok(one.remaining >= 1 && one.remaining <= 30);
    assert.equal(codes.codes.find((c) => c.id === b.id).code.length, 8);
    assert.equal(codes.clockWarning, null);
    const skewed = (await t.owner.get(`/api/x/authenticator/codes?clientTime=${Date.now() + 120_000}`)).data;
    assert.ok(skewed.clockWarning.seconds >= 119 && /clock differs/.test(skewed.clockWarning.en) && skewed.clockWarning.yue);

    // The list never carries a secret.
    const list = (await t.owner.get("/api/x/authenticator/accounts")).data;
    assert.ok(!JSON.stringify(list).includes(SECRET));
    assert.deepEqual((await t.owner.get("/api/x/authenticator/accounts?q=beta")).data.accounts.map((x) => x.issuer), ["Beta"]);

    assert.equal((await t.owner.request("PATCH", `/api/x/authenticator/accounts/${a.id}`, { group: "work", label: "pat (work)" })).data.group, "work");
    assert.deepEqual((await t.owner.get("/api/x/authenticator/accounts")).data.groups, ["work"]);
    await t.owner.post("/api/x/authenticator/reorder", { ids: [b.id, a.id] });
    assert.deepEqual((await t.owner.get("/api/x/authenticator/accounts")).data.accounts.map((x) => x.id), [b.id, a.id]);

    // Bulk: group two, then delete needs the two-key token and reports skipped ids.
    assert.equal((await t.owner.post("/api/x/authenticator/bulk", { action: "group", ids: [a.id, b.id, "ghost"], group: "all" })).data.skipped[0].reason, "not in your list");
    assert.equal((await t.owner.post("/api/x/authenticator/bulk", { action: "delete", ids: [a.id] })).status, 403);
    assert.equal((await t.owner.post("/api/x/authenticator/bulk", { action: "delete", ids: [a.id], token: "made-up" })).status, 403);
    const token = await superToken(t.owner, "authenticator.bulk-delete");
    const wrongAction = await superToken(t.owner, "authenticator.export-secrets");
    assert.equal((await t.owner.post("/api/x/authenticator/bulk", { action: "delete", ids: [a.id], token: wrongAction })).status, 403, "a token for another action is refused");
    const gone = await t.owner.post("/api/x/authenticator/bulk", { action: "delete", ids: [a.id], token });
    assert.deepEqual([gone.status, gone.data.done], [200, 1]);
    assert.equal((await t.owner.post("/api/x/authenticator/bulk", { action: "delete", ids: [b.id], token })).status, 403, "a token works once");

    // Exports: ordinary leaves secrets out and says so; secrets need owner and token.
    const plain = (await t.owner.get("/api/x/authenticator/export")).data;
    assert.equal(plain.secretsIncluded, false);
    assert.ok(plain.omitted && !JSON.stringify(plain).includes("GEZDGNBV"));
    assert.equal((await t.owner.get("/api/x/authenticator/export?secrets=1")).status, 403);
    const exportToken = await superToken(t.owner, "authenticator.export-secrets");
    const full = (await t.owner.get(`/api/x/authenticator/export?secrets=1&token=${exportToken}`)).data;
    assert.equal(full.secretsIncluded, true);
    assert.ok(full.accounts[0].uri.includes("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"));
    // A reveal also needs a fresh token.
    assert.equal((await t.owner.post("/api/x/authenticator/reveal", { id: b.id, token: exportToken })).status, 403);
    const revealToken = await superToken(t.owner, "authenticator.reveal");
    assert.ok((await t.owner.post("/api/x/authenticator/reveal", { id: b.id, token: revealToken })).data.uri.startsWith("otpauth://"));

    // Secrets are encrypted at rest.
    for (const file of await readdir(t.dir)) assert.ok(!(await readFile(path.join(t.dir, file)).catch(() => Buffer.alloc(0))).includes("GEZDGNBVGY3TQOJQ"), `${file} holds a plain secret`);
  } finally {
    await t.stop();
  }
});

test("authenticator: import by text, accounts survive a restart and viewers cannot change them", async () => {
  const t = await startApp();
  let second;
  try {
    const text = [buildUri({ issuer: "One", label: "a", secret: SECRET }), "not an address", "otpauth://totp/Bad?secret=!!!", buildUri({ issuer: "Two", label: "b", secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" })].join("\n");
    const out = (await t.owner.post("/api/x/authenticator/import-text", { text })).data;
    assert.equal(out.added, 2);
    assert.equal(out.skipped.length, 1);
    assert.equal((await t.owner.post("/api/x/authenticator/import-text", { text: "nothing here" })).status, 400);
    const asJson = JSON.stringify([buildUri({ issuer: "Three", label: "c", secret: SECRET })]);
    assert.equal((await t.owner.post("/api/x/authenticator/import-text", { text: asJson })).data.added, 1);

    // A second app on the same data folder (a restart) reads them back.
    second = await createApp({ dataDir: t.dir, cacheTtlMs: 0 });
    await second.listen(0, "127.0.0.1");
    const client = t.client();
    client.base = `http://127.0.0.1:${second.port}`;
    assert.equal((await client.signIn("pat", "correct horse battery")).status, 200);
    const list = (await client.get("/api/x/authenticator/accounts")).data;
    assert.equal(list.total, 3);
    assert.equal((await client.get("/api/x/authenticator/codes")).data.codes.length, 3);
    await second.close();
    second = null;

    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.post("/api/x/authenticator/accounts", { uri: buildUri({ label: "z", secret: SECRET }) })).status, 403);
    assert.equal((await guest.get("/api/x/authenticator/accounts")).data.total, 0, "accounts belong to the person who made them");
  } finally {
    await second?.close();
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "authenticator"), null);
});
