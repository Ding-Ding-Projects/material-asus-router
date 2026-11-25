// Exports: every kind in every format, secrets always hidden, losses stated
// before exporting, JSON/CSV/YAML read back, valid PDF and ZIP files.
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { test } from "node:test";
import feature from "../../public/js/features/exports/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { FORMATS, crc32, parse, serialize, zipFile } from "../../server/features/exports/formats.mjs";
import { startApp } from "../helpers.mjs";

const base = "/api/x/exports";
const WIFI_PASSWORD = "milk-tea-and-egg-tarts";
const decode = (out) => (out.contentEncoding === "base64" ? Buffer.from(out.content, "base64") : Buffer.from(out.content, "utf8"));

function readZip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(at), 0x02014b50);
    const method = buffer.readUInt16LE(at + 10);
    const crc = buffer.readUInt32LE(at + 16);
    const size = buffer.readUInt32LE(at + 20);
    const rawSize = buffer.readUInt32LE(at + 24);
    const nameLength = buffer.readUInt16LE(at + 28);
    const offset = buffer.readUInt32LE(at + 42);
    const name = buffer.toString("utf8", at + 46, at + 46 + nameLength);
    const dataStart = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    const body = buffer.subarray(dataStart, dataStart + size);
    const data = method === 8 ? inflateRawSync(body) : body;
    assert.equal(data.length, rawSize, `${name} size`);
    assert.equal(crc32(data), crc, `${name} checksum`);
    files[name] = data;
    at += 46 + nameLength;
  }
  return files;
}

test("exports: the format list states encoding, line endings, schema version and what each loses", async () => {
  const t = await startApp();
  try {
    const info = (await t.owner.get(`${base}/formats`)).data;
    assert.deepEqual(info.formats.map((f) => f.format), FORMATS);
    for (const f of info.formats) {
      assert.ok(f.loss.en && f.loss.yue, `${f.format} says what it loses in both languages`);
      assert.ok(f.encoding && f.lineEndings && f.schemaVersion === 1);
    }
    assert.equal(info.formats.find((f) => f.format === "csv").lineEndings, "CRLF");
    assert.equal(info.formats.find((f) => f.format === "pdf").loss.importable, false);
    assert.equal(info.archives.zip.available, true);
    assert.equal(info.archives.sevenZip.available, false, "7z is honestly reported as not built");
  } finally {
    await t.stop();
  }
});

test("exports: every kind in every format works and secrets are hidden everywhere", async () => {
  const t = await startApp();
  try {
    for (const kind of ["settings", "devices", "history", "logs"]) {
      for (const format of FORMATS) {
        const res = await t.owner.get(`${base}/export?kind=${kind}&format=${format}`);
        assert.equal(res.status, 200, `${kind}.${format}: ${res.text.slice(0, 200)}`);
        const bytes = decode(res.data);
        assert.equal(bytes.length, res.data.bytes);
        assert.ok(!bytes.toString("latin1").includes(WIFI_PASSWORD), `${kind}.${format} leaks a secret`);
        assert.equal(res.data.filename.endsWith(format === "md" ? ".md" : `.${format}`), true);
      }
    }
    const settings = (await t.owner.get(`${base}/export?kind=settings&format=json`)).data;
    assert.ok(settings.meta.secretsOmitted >= 2, "the count of hidden secrets is stated");
    const text = settings.content;
    assert.ok(text.includes("(hidden)") && text.includes("wl0_ssid") && text.includes("Harbour Home"), "ordinary values stay, secrets go");
    assert.equal((await t.owner.get(`${base}/export?kind=nope&format=json`)).status, 400);
    assert.equal((await t.owner.get(`${base}/export?kind=settings&format=docx`)).status, 400);
    assert.equal((await t.client().get(`${base}/export?kind=settings&format=json`)).status, 401);
    // The device list can be limited to chosen rows (bulk selection).
    const devices = (await t.owner.get(`${base}/export?kind=devices&format=json`)).data;
    const rows = JSON.parse(devices.content).rows;
    assert.ok(rows.length >= 2);
    const one = JSON.parse((await t.owner.get(`${base}/export?kind=devices&format=json&keys=${rows[0].mac}`)).data.content).rows;
    assert.deepEqual(one.map((r) => r.mac), [rows[0].mac]);
  } finally {
    await t.stop();
  }
});

test("exports: JSON, CSV and YAML read back to the same rows, and the others refuse to be imported", async () => {
  const t = await startApp();
  try {
    const original = JSON.parse((await t.owner.get(`${base}/export?kind=settings&format=json`)).data.content);
    for (const format of ["json", "csv", "yaml"]) {
      const out = (await t.owner.get(`${base}/export?kind=settings&format=${format}`)).data;
      const parsed = (await t.owner.post(`${base}/parse`, { format, text: out.content })).data;
      assert.deepEqual(parsed.columns, original.columns, format);
      assert.deepEqual(parsed.rows.map((r) => original.columns.map((c) => r[c])), original.rows.map((r) => original.columns.map((c) => r[c])), `${format} round trip`);
    }
    for (const format of ["md", "html", "pdf"]) assert.equal((await t.owner.post(`${base}/parse`, { format, text: "x" })).status, 400, `${format} is not importable`);
    assert.equal((await t.owner.post(`${base}/parse`, { format: "json", text: "{\"nope\":1}" })).status, 400);
    assert.equal((await t.owner.post(`${base}/parse`, { format: "csv", text: "a,b\n\"unclosed" })).status, 400);
  } finally {
    await t.stop();
  }
  // Awkward values survive the text formats that can carry them.
  const table = { title: "Awkward", columns: ["a", "b"], rows: [{ a: 'say "hi", then leave', b: "line one\nline two" }, { a: "", b: "tab\there" }], meta: {} };
  for (const format of ["json", "csv", "yaml"]) assert.deepEqual(parse(format, serialize(format, table)).rows, table.rows, format);
});

test("exports: the PDF is a valid document, the HTML escapes markup and the ZIP is a real archive", async () => {
  const t = await startApp();
  try {
    const pdf = decode((await t.owner.get(`${base}/export?kind=devices&format=pdf`)).data);
    assert.equal(pdf.subarray(0, 8).toString(), "%PDF-1.4");
    assert.ok(pdf.toString("latin1").trimEnd().endsWith("%%EOF"));
    const text = pdf.toString("latin1");
    const xref = Number(text.match(/startxref\n(\d+)/)[1]);
    assert.equal(text.slice(xref, xref + 4), "xref", "the cross-reference table is where it says");
    assert.match(text, /\/Type \/Catalog/);
    assert.match(text, /\/BaseFont \/Courier/);

    const html = serialize("html", { title: "<b>x</b>", columns: ["c"], rows: [{ c: "<script>alert(1)</script>" }], meta: {} });
    assert.ok(!html.includes("<script>") && html.includes("&lt;script&gt;"));

    const archive = (await t.owner.get(`${base}/archive?format=csv&kinds=settings,devices,logs`)).data;
    const files = readZip(Buffer.from(archive.content, "base64"));
    assert.deepEqual(Object.keys(files).sort(), ["MANIFEST.txt", "devices/devices.csv", "logs/logs.csv", "settings/settings.csv"]);
    assert.ok(Object.keys(files).every((n) => !n.startsWith("/") && !n.includes("..")), "relative paths only");
    assert.match(files["MANIFEST.txt"].toString(), /secret value\(s\) hidden/);
    assert.ok(!Buffer.concat(Object.values(files)).toString().includes(WIFI_PASSWORD));
    assert.equal(archive.encryptedHeaders, false, "the archive says it has no encrypted names");
    assert.throws(() => zipFile([{ name: "../escape.txt", data: "x" }]), /safe relative path/);
    assert.throws(() => zipFile([{ name: "/abs.txt", data: "x" }]), /safe relative path/);
    assert.equal((await t.owner.get(`${base}/archive?format=json&kinds=nope`)).status, 400);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "exports"), null);
});
