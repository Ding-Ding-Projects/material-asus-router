// base64-tools is a browser-only feature, so this test drives its pure codec
// from Node and checks that the module itself is well formed and served.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Base64Error, Decoder, decode, decodeBlob, encode, encodeBlob, encodedName, hexView, makeControl, parseDataUrl, buildDataUrl, pushHistory, restoredName, sha256, textToBytes, bytesToText, uniqueName, undoHistory } from "../../public/js/features/base64-tools/codec.js";
import { makeZip, readZip } from "../../public/js/features/base64-tools/zip.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/base64-tools/index.js";
import { startApp } from "../helpers.mjs";

const bytes = (s) => new TextEncoder().encode(s);
const ascii = (b) => new TextDecoder().decode(b);

test("base64: every variant round trips and matches the platform encoder", () => {
  for (const sample of ["", "f", "fo", "foo", "foob", "fooba", "foobar", "ÿþý??>>"]) {
    const raw = bytes(sample);
    const expected = Buffer.from(raw).toString("base64");
    assert.equal(encode(raw), expected, sample);
    assert.equal(encode(raw, { urlSafe: true, padding: false }), Buffer.from(raw).toString("base64url"));
    assert.deepEqual(decode(expected).bytes, raw);
    assert.deepEqual(decode(Buffer.from(raw).toString("base64url"), { urlSafe: true, requirePadding: false }).bytes, raw);
  }
  const all = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual(decode(encode(all, { lineLength: 76 }), { mime: true }).bytes, all);
  const wrapped = encode(all, { lineLength: 64, eol: "\n" });
  assert.ok(wrapped.split("\n").slice(0, -1).every((line) => line.length === 64));
});

test("base64: strict mode says the exact offset, lenient mode skips and warns", () => {
  const offset = (text, options) => {
    try {
      decode(text, options);
    } catch (error) {
      assert.ok(error instanceof Base64Error);
      return error.offset;
    }
    return null;
  };
  assert.equal(offset("SGVs*G8="), 4, "a character outside the alphabet");
  assert.equal(offset("SGVs bG8="), 4, "whitespace is refused outside MIME mode");
  assert.equal(offset("SGVsbG8"), 7, "missing padding is reported at the end");
  assert.equal(offset("SGVsbG8=="), 7, "wrong padding is reported where it starts");
  assert.equal(offset("SGVsb"), 5, "a lone trailing character");
  assert.equal(offset("SGVsbG8=AA"), 8, "data after padding");
  assert.equal(offset("SGVsbG9="), 6, "non-zero trailing bits are not canonical");
  assert.equal(offset("a-b_", {}), 1, "URL-safe characters are refused in standard mode");
  assert.equal(offset("SGVs\r\nbG8=", { mime: true }), null, "MIME allows line breaks");
  const lenient = decode("SGVs*bG8", { strict: false });
  assert.equal(ascii(lenient.bytes), "Hello", "it still decodes");
  assert.deepEqual(lenient.warnings.map((w) => w.offset), [4]);
  assert.equal(ascii(decode("SGVsbG8", { strict: false }).bytes), "Hello");
});

test("base64: a streaming decoder gives the same bytes and offsets however the text is cut", () => {
  const raw = Uint8Array.from({ length: 1000 }, (_, i) => (i * 7) & 255);
  const text = encode(raw);
  const decoder = new Decoder();
  const out = [];
  for (let i = 0; i < text.length; i += 37) out.push(...decoder.push(text.slice(i, i + 37)));
  decoder.finish();
  assert.deepEqual(Uint8Array.from(out), raw);
  const broken = new Decoder();
  broken.push(text.slice(0, 500));
  assert.throws(() => broken.push("!"), (error) => error.offset === 500);
});

test("base64: a large Blob is processed in pieces, with progress, and the SHA-256 round trip holds", async () => {
  const raw = Uint8Array.from({ length: 700_000 }, (_, i) => (i * 31 + 7) & 255);
  const blob = new Blob([raw]);
  const seen = [];
  const encoded = await encodeBlob(blob, { lineLength: 76, onProgress: (p) => seen.push(p), chunkLines: 512 });
  assert.ok(seen.length > 3 && seen.at(-1) === 1, "progress was reported in several steps");
  assert.equal(await encoded.text(), encode(raw, { lineLength: 76 }), "pieces join exactly like one pass");
  const back = await decodeBlob(encoded, { mime: true, chunkChars: 100_000 });
  assert.equal(await sha256(back.blob), await sha256(raw));
});

test("base64: pause holds the job and cancel stops it without output", async () => {
  const blob = new Blob([new Uint8Array(100_000)]);
  const control = makeControl();
  control.pause();
  let finished = false;
  const job = encodeBlob(blob, { control, chunkLines: 8 }).then(() => (finished = true), (e) => e);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(finished, false, "paused");
  control.cancel();
  const result = await job;
  assert.equal(result.message, "Cancelled");
});

test("base64: text encodings, data URLs and the hex view", () => {
  for (const encoding of ["utf-8", "utf-16le", "utf-16be"]) assert.equal(bytesToText(textToBytes("Hi 香港", encoding), encoding), "Hi 香港");
  assert.equal(bytesToText(textToBytes("café", "latin1"), "latin1"), "café");
  assert.throws(() => textToBytes("香", "latin1"), /cannot be written as Latin-1/);
  const url = buildDataUrl("text/plain", bytes("Hello"));
  assert.equal(url, "data:text/plain;base64,SGVsbG8=");
  const parsed = parseDataUrl(url);
  assert.deepEqual([parsed.mime, parsed.base64, ascii(parsed.bytes)], ["text/plain", true, "Hello"]);
  assert.equal(ascii(parseDataUrl("data:,a%20b").bytes), "a b");
  assert.throws(() => parseDataUrl("nope"), /data URL/);
  assert.equal(buildDataUrl("text/plain", bytes("a b"), { base64: false }), "data:text/plain,a%20b");
  assert.match(hexView(bytes("Hello, hex view!!")), /^00000000 {2}48 65 6c 6c 6f .*\|Hello, hex view!\|\n00000010 {2}21 /);
});

test("base64: the drop rule names files, restores them and never overwrites", () => {
  assert.equal(encodedName("photo.png"), "photo.png.base64.txt");
  assert.equal(restoredName("photo.png.base64.txt"), "photo.png");
  assert.equal(restoredName("notes.txt"), null);
  assert.equal(restoredName(".base64.txt"), null);
  const taken = new Set(["photo.png", "photo (2).png"]);
  assert.equal(uniqueName("photo.png", taken), "photo (3).png");
  assert.equal(uniqueName("fresh.png", taken), "fresh.png");
});

test("base64: history keeps entries and undo removes the newest", () => {
  let list = pushHistory([], { kind: "encode", from: "a", to: "YQ==" });
  list = pushHistory(list, { kind: "decode", from: "YQ==", to: "a" });
  const { list: rest, undone } = undoHistory(list);
  assert.equal(undone.kind, "decode");
  assert.equal(rest.length, 1);
  assert.equal(undoHistory([]).undone, null);
  assert.equal(pushHistory(Array.from({ length: 60 }, () => ({})), {}).length, 50);
});

test("base64: a bulk ZIP holds every file with a matching checksum and unique names", () => {
  const zip = makeZip([{ name: "a.txt", bytes: bytes("one") }, { name: "a.txt", bytes: bytes("two") }, { name: "../x.txt", bytes: bytes("three") }]);
  const entries = readZip(zip);
  assert.deepEqual(entries.map((e) => e.name), ["a.txt", "a (2).txt", "x.txt"]);
  assert.deepEqual(entries.map((e) => ascii(e.bytes)), ["one", "two", "three"]);
  zip[35] ^= 0xff;
  assert.throws(() => readZip(zip), /checksum|Damaged/);
});

test("base64: the module is well formed, listed in the manifest and served", async () => {
  assert.equal(checkFeatureModule(feature, "base64-tools"), null);
  const t = await startApp();
  try {
    assert.ok((await t.owner.get("/api/features/manifest")).data.modules.includes("/js/features/base64-tools/index.js"));
    assert.equal((await fetch(`${t.base}/js/features/base64-tools/codec.js`)).status, 200);
  } finally {
    await t.stop();
  }
});
