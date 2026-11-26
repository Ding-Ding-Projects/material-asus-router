// The personal vocabulary file: the shared format ({ schemaVersion, entries }) loads as well as the
// older { version, words }, and words that differ only in capitals keep their own replacements.
import assert from "node:assert/strict";
import { test } from "node:test";
import { compile, parseVocabulary } from "../../public/js/features/voice/vocab.js";

test("voice: the shared schemaVersion format loads, and mixing both version fields is refused", () => {
  const v = parseVocabulary(JSON.stringify({ schemaVersion: 1, entries: { kettle: "teapot", "Green Lane": "Jade Road" } }));
  assert.equal(v.count, 2);
  assert.equal(parseVocabulary(JSON.stringify({ version: 1, words: { kettle: "teapot" } })).count, 1, "the older format still loads");
  assert.throws(() => parseVocabulary(JSON.stringify({ version: 1, schemaVersion: 1, entries: { a1: "b" } })), (e) => e.code === "UNKNOWN_FIELD");
  assert.throws(() => parseVocabulary(JSON.stringify({ schemaVersion: 2, entries: { kettle: "teapot" } })), (e) => e.code === "BAD_VERSION");
  assert.throws(() => parseVocabulary(JSON.stringify({ schemaVersion: 1, entries: { kettle: "teapot" }, extra: 1 })), (e) => e.code === "UNKNOWN_FIELD");
});

test("voice: words that differ only in capitals keep their own replacements", () => {
  const v = parseVocabulary(JSON.stringify({ schemaVersion: 1, entries: { Kettle: "Brand Kettle", kettle: "teapot" } }));
  assert.equal(v.count, 2, "both spellings are kept");
  const replace = compile(v.entries);
  assert.equal(replace("Kettle and kettle and KETTLE"), "Brand Kettle and teapot and teapot", "an exact spelling wins; other capitals use the lower-case entry");
  assert.throws(() => parseVocabulary('{"schemaVersion":1,"entries":{"kettle":"a","kettle":"b"}}'), (e) => e.code === "DUPLICATE_KEY", "the very same spelling twice is still refused");
});
