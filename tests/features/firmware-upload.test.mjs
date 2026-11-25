// Checking a firmware file: the file is described from its name and first bytes
// inside the browser, a personal vocabulary file is recognised by shape alone,
// and nothing about any of it ever reaches the app's server or the router.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/firmware-upload/index.js";
import { describeFirmware, fromName, inspectFile, kindOf, looksLikePersonalVocabulary, sameModel, zipInnerName } from "../../public/js/features/firmware-upload/inspect.js";
import { startApp } from "../helpers.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FEATURE_DIR = path.join(ROOT, "public", "js", "features", "firmware-upload");

function zipHeader(inner) {
  const bytes = new Uint8Array(30 + inner.length + 20);
  bytes.set([0x50, 0x4b, 0x03, 0x04], 0);
  bytes[26] = inner.length;
  bytes.set(new TextEncoder().encode(inner), 30);
  return bytes;
}

test("firmware-upload: the browser module has the shape the registry needs", () => {
  assert.equal(checkFeatureModule(feature, "firmware-upload"), null);
  assert.equal(feature.overlays.length, 1, "the card is added to the Firmware page by an overlay, no shared file is edited");
});

test("firmware-upload: file kinds are recognised from the first bytes", () => {
  assert.equal(kindOf(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0])).id, "zip");
  assert.equal(kindOf(new TextEncoder().encode("HDR0....")).id, "trx");
  assert.equal(kindOf(new Uint8Array([0xd0, 0x0d, 0xfe, 0xed])).id, "fit");
  assert.equal(kindOf(new Uint8Array([0x1f, 0x8b, 8])).id, "gzip");
  assert.equal(kindOf(new TextEncoder().encode("UBI#")).id, "ubi");
  assert.equal(kindOf(new TextEncoder().encode("hsqs")).id, "squashfs");
  assert.equal(kindOf(new Uint8Array([0x7f, 0x45, 0x4c, 0x46])).id, "elf");
  assert.equal(kindOf(new TextEncoder().encode("hello")).id, "unknown");
  assert.equal(kindOf(new Uint8Array()).id, "unknown");
  for (const k of [kindOf(new Uint8Array()), kindOf(new TextEncoder().encode("HDR0"))]) assert.ok(k.en && k.yue);
});

test("firmware-upload: the model and version come from the file name when it follows a known pattern", () => {
  assert.deepEqual(fromName("RT-AX86U_388.8_4.pkgtb"), { family: "merlin", model: "RT-AX86U", version: "388.8_4" });
  assert.deepEqual(fromName("GT-AX11000_388.8_0_cferom_ubi.w"), { family: "merlin", model: "GT-AX11000", version: "388.8_0" });
  assert.deepEqual(fromName("FW_RT_AX86U_300438824198.zip"), { family: "asus", model: "RT-AX86U", version: "3.0.0.4.388.24198" });
  assert.deepEqual(fromName("C:\\Downloads\\RT-AX86U_388.8_4.zip"), { family: "merlin", model: "RT-AX86U", version: "388.8_4" });
  assert.deepEqual(fromName("my-custom-build.bin"), { family: null, model: null, version: null });
  assert.deepEqual(fromName(""), { family: null, model: null, version: null });
  assert.equal(sameModel("RT-AX86U", "rt ax86u"), true);
  assert.equal(sameModel("RT-AX86U", "RT-AX88U"), false);
  assert.equal(sameModel(null, "RT-AX88U"), false);
});

test("firmware-upload: a zip with an unhelpful name is described from the name inside it", () => {
  const head = zipHeader("RT-AX86U_388.8_4.pkgtb");
  assert.equal(zipInnerName(head), "RT-AX86U_388.8_4.pkgtb");
  const info = describeFirmware({ name: "download (3).zip", size: 90_000_000, head });
  assert.deepEqual([info.kind.id, info.model, info.version, info.from], ["zip", "RT-AX86U", "388.8_4", "name inside the archive"]);
  const own = describeFirmware({ name: "FW_RT_AX86U_300438824198.zip", size: 1, head });
  assert.equal(own.from, "file name");
  assert.equal(zipInnerName(new Uint8Array(40)), null);
  assert.equal(zipInnerName(new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new Array(40).fill(0xff)])), null, "an unreadable name is not guessed at");
});

test("firmware-upload: a personal vocabulary file is recognised by its shape and by nothing else", () => {
  assert.equal(looksLikePersonalVocabulary(JSON.stringify({ version: 1, name: "x", words: { router: "box" } })), true);
  assert.equal(looksLikePersonalVocabulary(JSON.stringify({ version: 2, entries: { a: "b" } })), true);
  assert.equal(looksLikePersonalVocabulary(JSON.stringify({ version: 1, terms: [["a", "b"]] })), true);
  assert.equal(looksLikePersonalVocabulary(`\uFEFF${JSON.stringify({ version: 1, words: { a: "b" } })}`), true);
  assert.equal(looksLikePersonalVocabulary(JSON.stringify({ version: 1, words: {} })), false, "an empty list is not a vocabulary");
  assert.equal(looksLikePersonalVocabulary(JSON.stringify({ words: { a: "b" } })), false, "no version");
  assert.equal(looksLikePersonalVocabulary(JSON.stringify({ version: "1", words: { a: "b" } })), false);
  assert.equal(looksLikePersonalVocabulary(JSON.stringify([{ version: 1, words: { a: "b" } }])), false);
  assert.equal(looksLikePersonalVocabulary(JSON.stringify({ name: "package", version: 1 })), false);
  assert.equal(looksLikePersonalVocabulary("not json"), false);
  assert.equal(looksLikePersonalVocabulary(""), false);
});

test("firmware-upload: a vocabulary file gives back nothing but the fact, and a firmware file never reaches any network API", async () => {
  const calls = [];
  const real = { fetch: globalThis.fetch, XMLHttpRequest: globalThis.XMLHttpRequest, WebSocket: globalThis.WebSocket, EventSource: globalThis.EventSource };
  const trip = (name) => (...args) => { calls.push([name, args[0]]); throw new Error(`${name} must not be used`); };
  globalThis.fetch = trip("fetch");
  globalThis.XMLHttpRequest = trip("XMLHttpRequest");
  globalThis.WebSocket = trip("WebSocket");
  globalThis.EventSource = trip("EventSource");
  try {
    const secret = "never-show-this-word";
    const vocab = new File([JSON.stringify({ version: 1, name: secret, words: { router: secret } })], "my-words.json", { type: "application/json" });
    const out = await inspectFile(vocab);
    assert.deepEqual(out, { vocabulary: true }, "only the fact that it is a vocabulary file, never its contents");
    assert.doesNotMatch(JSON.stringify(out), new RegExp(secret));

    const zip = new File([zipHeader("RT-AX86U_388.8_4.pkgtb"), new Uint8Array(2000)], "RT-AX86U_388.8_4.zip");
    const info = await inspectFile(zip);
    assert.deepEqual([info.vocabulary, info.name, info.size, info.kind.id, info.model, info.version], [false, "RT-AX86U_388.8_4.zip", zip.size, "zip", "RT-AX86U", "388.8_4"]);

    const other = new File([JSON.stringify({ name: "not words", list: [1, 2] })], "package.json");
    assert.equal((await inspectFile(other)).vocabulary, false, "other JSON is just a file with an unknown kind");
    const huge = new File([new Uint8Array(1000)], "RT-AX86U_388.8_4.w");
    assert.equal((await inspectFile(huge)).model, "RT-AX86U");
    assert.deepEqual(calls, [], "no network call of any kind was made");
  } finally {
    Object.assign(globalThis, real);
  }
});

test("firmware-upload: the module's own code cannot reach the network or the app's API, and no server route takes a file", async () => {
  const files = (await readdir(FEATURE_DIR)).filter((f) => f.endsWith(".js"));
  assert.deepEqual(files.sort(), ["basket.js", "index.js", "inspect.js"]);
  for (const f of files) {
    const text = (await readFile(path.join(FEATURE_DIR, f), "utf8")).replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(text, /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|FormData|importScripts|ctx\.api|\bapi\b)\b/, `${f} touches something that could send a file`);
    assert.doesNotMatch(text, /\bimport\s+[^;]*from\s+["'](?!\.\/)/, `${f} imports something from outside its own folder`);
    assert.doesNotMatch(text, /\.(arrayBuffer|text)\(\)\s*\)?\s*\.then\([^)]*(post|send)/i);
  }
  await assert.rejects(readFile(path.join(ROOT, "server", "features", "firmware-upload", "index.mjs")), { code: "ENOENT" }, "there is no server half to receive anything");

  const t = await startApp();
  try {
    const before = t.router.commands.length;
    const payload = Buffer.from("a pretend firmware file".repeat(1000)).toString("base64");
    for (const [method, url] of [["POST", "/api/x/firmware-upload/upload"], ["PUT", "/api/x/firmware-upload/file"], ["POST", "/api/x/firmware-pro/upload"], ["POST", "/api/upload"], ["POST", "/api/firmware"], ["POST", "/api/actions/firmware-upload.flash"], ["POST", "/api/x/ssh-actions/files/upload-firmware"]]) {
      const r = await t.owner.request(method, url, { name: "fw.w", data: payload });
      assert.ok([404, 405].includes(r.status), `${method} ${url} -> ${r.status}`);
    }
    assert.equal(t.router.commands.length, before, "nothing reached the router");
    assert.equal(t.router.rebooted, undefined);
    assert.equal(t.router.commands.some((c) => /mtd|flash|nandwrite|upgrade|reboot/i.test(c)), false);
  } finally {
    await t.stop();
  }
});

test("firmware-upload: the folder obeys the project's wording and address rules", async () => {
  for (const f of await readdir(FEATURE_DIR)) {
    const text = await readFile(path.join(FEATURE_DIR, f), "utf8");
    assert.doesNotMatch(text, new RegExp(`\\b${"c"}${"at"}\\b`, "i"), `${f}: reserved word found`);
    assert.doesNotMatch(text, /\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/, `${f}: private-range address`);
    assert.doesNotMatch(text, /\b(admin|root|docker)@[0-9a-z]/i, `${f}: user@address`);
  }
});
