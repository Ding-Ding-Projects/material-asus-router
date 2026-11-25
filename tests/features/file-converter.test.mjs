// file-converter runs in the browser, so this drives its pure converters and
// queue from Node and checks the module is well formed and served.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CATALOG, CATEGORIES, ConversionQueue, DETECT_LIMIT, bytesToBinaryText, bytesToHex, convertEncoding, convertStructured, csvToRecords, detectType, encodeBmp, encodeText, hexToBytes, minifyJson, parseCsv, parseXml, parseYaml, searchCatalog, sniffEncoding, toCsv, toXml, toYaml, uniqueName } from "../../public/js/features/file-converter/convert.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/file-converter/index.js";
import { startApp } from "../helpers.mjs";

const bytes = (s) => new TextEncoder().encode(s);

test("detection looks only at the first bytes and names how it decided", () => {
  const pad = (list) => Uint8Array.from([...list, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(detectType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).id, "png");
  assert.equal(detectType(pad([0xff, 0xd8, 0xff, 0xe0])).id, "jpeg");
  assert.equal(detectType(bytes("%PDF-1.7")).id, "pdf");
  assert.equal(detectType(bytes("RIFF....WEBPVP8 ")).id, "webp");
  assert.equal(detectType(bytes("....ftypmp42")).id, "mp4");
  assert.equal(detectType(bytes('{"a":1}')).id, "json");
  assert.equal(detectType(bytes("<root><a/></root>")).id, "xml");
  assert.equal(detectType(bytes('<svg width="1"></svg>')).id, "svg");
  assert.equal(detectType(bytes("a,b\n1,2\n")).id, "csv");
  assert.equal(detectType(bytes("name: Pat\nage: 3\n")).id, "yaml");
  assert.equal(detectType(bytes("just words")).id, "text");
  assert.equal(detectType(Uint8Array.from([0, 1, 2])).id, "binary");
  assert.equal(detectType(Uint8Array.from([0xe9, 0x74, 0xe9])).id, "text-8bit");
  const huge = new Uint8Array(DETECT_LIMIT * 100).fill(65);
  assert.equal(detectType(huge).how, "valid UTF-8 text", "a huge file is judged from a bounded prefix");
});

test("text encodings: sniffing, every target, lossy reports and line endings", () => {
  assert.equal(sniffEncoding(Uint8Array.from([0xff, 0xfe, 0x41, 0])), "utf-16le");
  assert.equal(sniffEncoding(bytes("plain")), "utf-8");
  assert.equal(sniffEncoding(Uint8Array.from([0x63, 0x61, 0x66, 0xe9])), "windows-1252");
  const out = convertEncoding(Uint8Array.from([0x63, 0x61, 0x66, 0xe9]), "auto", "utf-8");
  assert.equal(new TextDecoder().decode(out.bytes), "caf\u00e9");
  const wide = encodeText("Hi 香", "utf-16le");
  assert.deepEqual([...wide.bytes.slice(0, 2)], [0xff, 0xfe]);
  assert.equal(convertEncoding(wide.bytes, "auto", "utf-8").bytes.length, bytes("Hi 香").length);
  const lossy = encodeText("香港 ok", "ascii");
  assert.equal(new TextDecoder().decode(lossy.bytes), "?? ok");
  assert.match(lossy.lossy[0], /2 character/);
  assert.equal(new TextDecoder().decode(convertEncoding(bytes("a\r\nb\nc"), "utf-8", "utf-8", { eol: "lf" }).bytes), "a\nb\nc");
  assert.equal(new TextDecoder().decode(convertEncoding(bytes("a\nb"), "utf-8", "utf-8", { eol: "crlf" }).bytes), "a\r\nb");
  assert.deepEqual([...encodeText("\u20ac", "windows-1252").bytes], [0x80]);
});

test("hex and binary text round trip", () => {
  const raw = Uint8Array.from([0, 15, 255, 128]);
  assert.equal(bytesToHex(raw), "00 0f ff 80");
  assert.equal(bytesToHex(raw, { upper: true, separator: "" }), "000FFF80");
  assert.deepEqual(hexToBytes("00 0F, ff:80 0x01"), Uint8Array.from([0, 15, 255, 128, 1]));
  assert.throws(() => hexToBytes("abc"), /pairs/);
  assert.equal(bytesToBinaryText(Uint8Array.from([5])), "00000101");
});

test("CSV follows RFC 4180: quotes, doubled quotes, newlines inside fields, other separators", () => {
  const rows = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n"two\nlines",\r\n');
  assert.deepEqual(rows, [["a", "b"], ["x, y", 'say "hi"'], ["two\nlines", ""]]);
  assert.equal(toCsv(rows), 'a,b\r\n"x, y","say ""hi"""\r\n"two\nlines",');
  assert.deepEqual(parseCsv("a;b\n1;2", ";"), [["a", "b"], ["1", "2"]]);
  assert.throws(() => parseCsv('a,"b'), /never closed/);
  assert.deepEqual(csvToRecords([["n", "ok"], ["1", "true"], ["", "x"]], { detect: true }), [{ n: 1, ok: true }, { n: null, ok: "x" }]);
});

test("YAML reads maps, lists, nested lists of maps, flow collections and block text, and writes what it reads", () => {
  const doc = [
    "# a comment",
    "name: Pat # trailing",
    "age: 41",
    "ratio: 0.5",
    'quoted: "a: b"',
    "none: ~",
    "ok: true",
    "tags: [x, 'y z', 3]",
    "inline: {a: 1, b: [2, 3]}",
    "people:",
    "  - name: Alex",
    "    roles:",
    "      - admin_user",
    "      - guest",
    "  - name: Sam",
    "list:",
    "- one",
    "- two",
    "text: |",
    "  line one",
    "  line two",
    "folded: >",
    "  joined",
    "  words",
  ].join("\n");
  const value = parseYaml(doc);
  assert.deepEqual(value, {
    name: "Pat", age: 41, ratio: 0.5, quoted: "a: b", none: null, ok: true, tags: ["x", "y z", 3], inline: { a: 1, b: [2, 3] },
    people: [{ name: "Alex", roles: ["admin_user", "guest"] }, { name: "Sam" }], list: ["one", "two"], text: "line one\nline two\n", folded: "joined words\n",
  });
  assert.deepEqual(parseYaml(toYaml(value)), value, "writing and reading again is lossless");
  assert.deepEqual(parseYaml(toYaml(["a", { b: [1, { c: null }] }, [], {}])), ["a", { b: [1, { c: null }] }, [], {}]);
  assert.deepEqual(parseYaml(toYaml({ "yes": "no", n: "12", e: "", s: "a: b", multi: "x\ny" })), { yes: "no", n: "12", e: "", s: "a: b", multi: "x\ny" });
  assert.throws(() => parseYaml("a: &x 1"), /anchors/);
  assert.throws(() => parseYaml("a:\n\tb: 1"), /tabs/);
  assert.equal(parseYaml(""), null);
});

test("XML reads attributes, repeated elements, text, CDATA and entities, and writes valid names", () => {
  const value = parseXml('<?xml version="1.0"?><!-- c --><lib id="7"><book>A &amp; B</book><book>C</book><note lang="en">hi</note><raw><![CDATA[<x>]]></raw><e/></lib>');
  assert.deepEqual(value, { lib: { "@id": "7", book: ["A & B", "C"], note: { "@lang": "en", "#text": "hi" }, raw: "<x>", e: "" } });
  const lossy = [];
  const xml = toXml({ lib: { "@id": "7", book: ["A & B", "C"], "9bad name": 1, none: null } }, {}, lossy);
  assert.match(xml, /<lib id="7">/);
  assert.match(xml, /<book>A &amp; B<\/book>\n\s+<book>C<\/book>/);
  assert.match(xml, /<_9bad_name>1<\/_9bad_name>/);
  assert.match(xml, /<none\/>/);
  assert.match(lossy[0], /not valid in XML/);
  assert.deepEqual(parseXml(xml).lib.book, ["A & B", "C"]);
  assert.throws(() => parseXml("<a><b></a>"), /closes <b>/);
  assert.throws(() => parseXml("<a></a><b></b>"), /exactly one root/);
  assert.throws(() => parseXml("<a>"), /never closed/);
  assert.match(toXml([1, 2], { root: "nums", item: "n" }), /<nums>\n {2}<n>1<\/n>/);
});

test("every JSON/YAML/CSV/XML pair converts, and each says what it loses", () => {
  const people = [{ name: "Pat", age: 41, tags: ["a", "b"] }, { name: "Alex", age: 7, tags: [] }];
  const json = JSON.stringify(people);
  for (const from of ["json", "yaml", "csv", "xml"]) {
    for (const to of ["json", "yaml", "csv", "xml"]) {
      if (from === to) continue;
      let source = json;
      if (from !== "json") source = convertStructured(json, "json", from).text;
      const out = convertStructured(source, from, to);
      assert.ok(out.text.length > 10, `${from} to ${to}`);
    }
  }
  assert.match(convertStructured("a,b\n1,2", "csv", "json").lossy[0], /text/);
  assert.deepEqual(JSON.parse(convertStructured("a,b\n1,2", "csv", "json", { detect: true }).text), [{ a: 1, b: 2 }]);
  const csv = convertStructured(json, "json", "csv");
  assert.match(csv.lossy.join(" "), /JSON text inside a cell/);
  assert.equal(csv.text.split("\r\n")[0], "name,age,tags");
  assert.deepEqual(JSON.parse(convertStructured("name: Pat\nitems:\n  - 1\n  - 2\n", "yaml", "json").text), { name: "Pat", items: [1, 2] });
  assert.deepEqual(JSON.parse(convertStructured('{"a":1, /* c */ "b":[1,],}', "json", "json").text), { a: 1, b: [1] }, "comments and trailing commas are tolerated");
  assert.throws(() => convertStructured("5", "json", "csv"), /list of records/);
  assert.equal(minifyJson('{ "a": [1, 2] }').text, '{"a":[1,2]}');
});

test("BMP output has the right header, size and pixel order", () => {
  const rgba = Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 9, 9, 9, 128]);
  const bmp = encodeBmp(2, 2, rgba);
  assert.equal(String.fromCharCode(bmp[0], bmp[1]), "BM");
  assert.equal(bmp.length, 54 + 16);
  assert.equal(new DataView(bmp.buffer).getUint32(2, true), bmp.length);
  assert.deepEqual([...bmp.slice(54, 58)], [255, 0, 0, 255], "bottom row first, BGRA: the blue pixel is stored first");
});

test("the catalogue shows every unbundled engine as unavailable with its reason", () => {
  assert.ok(CATALOG.length > 40);
  for (const c of CATALOG) {
    assert.ok(CATEGORIES.some(([id]) => id === c.category), c.id);
    if (!c.available) assert.ok(c.missing && c.missing.length > 20, `${c.id} must say what is missing`);
  }
  for (const category of ["documents", "audio", "video"]) assert.ok(CATALOG.filter((c) => c.category === category).every((c) => !c.available), `${category} stays disabled until its engine is bundled`);
  assert.ok(CATALOG.some((c) => c.id === "json-to-yaml" && c.available));
  const plain = searchCatalog("pdf");
  assert.ok(plain.items.length >= 3 && plain.items.every((c) => /pdf/i.test(`${c.label} ${c.from} ${c.to}`)));
  assert.equal(searchCatalog("^png to").items.length, 0, "plain text does not read ^ as a pattern");
  assert.ok(searchCatalog("^PNG to", { regex: true }).items.length >= 3);
  assert.match(searchCatalog("(", { regex: true }).error, /./);
  assert.equal(searchCatalog("a".repeat(300), { regex: true }).items.length, 0);
});

test("the queue runs one file at a time, can pause, resume and cancel, and keeps no file bytes", async () => {
  let running = 0;
  let peak = 0;
  const order = [];
  const queue = new ConversionQueue(async (item) => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 10));
    running -= 1;
    if (item.name === "bad") throw new Error("nope");
    order.push(item.name);
    return { name: `${item.name}.out` };
  });
  queue.pause();
  for (const name of ["a", "bad", "b", "c"]) queue.add({ name, size: 1 }, null);
  assert.deepEqual(queue.view().map((i) => i.status), ["queued", "queued", "queued", "queued"], "paused: nothing starts");
  queue.cancel(queue.view()[3].id);
  queue.resume();
  await queue.idle();
  assert.equal(peak, 1, "one at a time, so memory stays flat");
  assert.deepEqual(queue.view().map((i) => i.status), ["done", "failed", "done", "cancelled"]);
  assert.equal(queue.view()[1].error, "nope");
  assert.deepEqual(order, ["a", "b"]);
  assert.ok(queue.items.every((i) => i.file === null || i.status === "cancelled"), "finished items drop their file");
  assert.ok(!("file" in queue.view()[0]), "the public view never carries a file");
});

test("a result never takes a name that is already used", () => {
  const taken = new Set(["a.png", "a (2).png"]);
  assert.equal(uniqueName("a.png", taken), "a (3).png");
});

test("the module is well formed, listed in the manifest and served", async () => {
  assert.equal(checkFeatureModule(feature, "file-converter"), null);
  const t = await startApp();
  try {
    assert.ok((await t.owner.get("/api/features/manifest")).data.modules.includes("/js/features/file-converter/index.js"));
    for (const file of ["convert.js", "images.js", "ui.js", "store.js", "zip.js"]) assert.equal((await fetch(`${t.base}/js/features/file-converter/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
});
