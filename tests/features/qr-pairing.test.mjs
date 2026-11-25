// QR pairing: the QR drawing is made in-process, the secret is shown only on
// request and never stored before the person types a current code, and the
// factor arms only on a right code.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import feature from "../../public/js/features/qr-pairing/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { encodeQr } from "../../server/features/qr-pairing/qr.mjs";
import { totp } from "../../server/features/qr-pairing/totp.mjs";
import { base32Decode } from "../../server/features/qr-pairing/totp.mjs";
import { startApp } from "../helpers.mjs";

const finder = (rows, x, y) => [0, 1, 2, 3, 4, 5, 6].map((dy) => rows[y + dy].slice(x, x + 7)).join("|");
const FINDER = ["1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111"].join("|");

test("qr-pairing: the encoder draws valid structure for short, long and versioned codes", () => {
  for (const text of ["HELLO", "otpauth://totp/Pat:pat@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Pat", "x".repeat(250), `otpauth://totp/Alex?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&pad=${"a".repeat(180)}`]) {
    const qr = encodeQr(text);
    assert.equal(qr.size, qr.version * 4 + 17);
    assert.equal(qr.rows.length, qr.size);
    assert.ok(qr.rows.every((r) => r.length === qr.size && /^[01]+$/.test(r)));
    assert.equal(finder(qr.rows, 0, 0), FINDER, "top-left finder");
    assert.equal(finder(qr.rows, qr.size - 7, 0), FINDER, "top-right finder");
    assert.equal(finder(qr.rows, 0, qr.size - 7), FINDER, "bottom-left finder");
    for (let i = 8; i < qr.size - 8; i++) assert.equal(qr.rows[6][i], i % 2 === 0 ? "1" : "0", "timing pattern");
  }
  assert.throws(() => encodeQr("x".repeat(2000)), /too long/);
  assert.throws(() => encodeQr(""), /nothing/);
  assert.equal(encodeQr("HELLO").version, 1);
});

test("qr-pairing: pairing reveals the secret only on request and arms only on a right code", async () => {
  const t = await startApp();
  const calls = [];
  const realFetch = globalThis.fetch;
  try {
    const begin = (await t.owner.post("/api/x/qr-pairing/begin", { algorithm: "SHA256", digits: 8, period: 45 })).data;
    assert.equal(begin.algorithm, "SHA256");
    assert.equal(begin.revealed, false);
    assert.ok(!JSON.stringify(begin).match(/secret/i), "begin returns no secret");

    // The code cannot be confirmed before the secret was revealed.
    assert.equal((await t.owner.post("/api/x/qr-pairing/confirm", { id: begin.id, code: "00000000" })).status, 409);

    globalThis.fetch = async (...args) => (calls.push(args[0]), realFetch(...args));
    const shown = (await t.owner.post("/api/x/qr-pairing/reveal", { id: begin.id })).data;
    globalThis.fetch = realFetch;
    assert.match(shown.secret, /^[A-Z2-7]{32}$/);
    assert.match(shown.uri, /^otpauth:\/\/totp\//);
    assert.ok(shown.uri.includes(shown.secret) && shown.uri.includes("algorithm=SHA256") && shown.uri.includes("digits=8") && shown.uri.includes("period=45"));
    assert.equal(shown.qr.rows.length, shown.qr.size);
    assert.equal(calls.filter((c) => !String(c).startsWith(t.base)).length, 0, "no outside request while drawing the code");

    // Before arming, the secret is nowhere on disk.
    const files = await readdir(t.dir);
    for (const file of files) if ((await readFile(path.join(t.dir, file)).catch(() => Buffer.alloc(0))).includes(shown.secret)) assert.fail(`${file} holds the secret before arming`);

    const wrong = await t.owner.post("/api/x/qr-pairing/confirm", { id: begin.id, code: "12345678" });
    assert.equal(wrong.status, 400);
    assert.equal((await t.owner.get("/api/x/qr-pairing/status")).data.armed, false);

    const code = totp(base32Decode(shown.secret), Date.now(), { algorithm: "SHA256", digits: 8, period: 45 });
    const ok = await t.owner.post("/api/x/qr-pairing/confirm", { id: begin.id, code });
    assert.equal(ok.status, 200, ok.text);
    const status = (await t.owner.get("/api/x/qr-pairing/status")).data;
    assert.deepEqual([status.armed, status.digits, status.period], [true, 8, 45]);

    // Armed: the secret is in the encrypted vault, never in plain text.
    for (const file of await readdir(t.dir)) assert.ok(!(await readFile(path.join(t.dir, file)).catch(() => Buffer.alloc(0))).includes(shown.secret), `${file} holds the secret in plain text`);
    assert.equal((await t.owner.post("/api/x/qr-pairing/disarm", { code: "00000000" })).status, 400);
    const off = await t.owner.post("/api/x/qr-pairing/disarm", { code: totp(base32Decode(shown.secret), Date.now(), { algorithm: "SHA256", digits: 8, period: 45 }) });
    assert.equal(off.data.armed, false);
  } finally {
    globalThis.fetch = realFetch;
    await t.stop();
  }
});

test("qr-pairing: the qr route draws any short text, needs a session and refuses bad input", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().post("/api/x/qr-pairing/qr", { text: "hi" })).status, 401);
    assert.equal((await t.owner.post("/api/x/qr-pairing/qr", { text: "" })).status, 400);
    assert.equal((await t.owner.post("/api/x/qr-pairing/qr", { text: "x".repeat(361) })).status, 400);
    const out = (await t.owner.post("/api/x/qr-pairing/qr", { text: "hello" })).data;
    assert.equal(out.quietZone, 4);
    assert.equal(out.rows.length, out.size);
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/qr-pairing/index.js"));
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "qr-pairing"), null);
});
