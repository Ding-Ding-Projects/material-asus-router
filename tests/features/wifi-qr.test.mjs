// Wi-Fi QR codes. The encoder is proved by reading every code back the way a
// phone does: format bits (both copies, BCH-checked), version bits, the data
// modules unmasked in zigzag order, de-interleaved, every block's
// Reed-Solomon codewords recomputed and compared, and the text read back.
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/wifi-qr/index.js";
import { LEVELS, blockInfo, dataCodewords, encode, formatBits, functionMap, maskTest, rawModules, remainder, sizeOf, toPath, utf8, wifiPayload } from "../../public/js/features/wifi-qr/qr.js";
import { networksOf, securityOf } from "../../server/features/wifi-qr/index.mjs";
import { startApp } from "../helpers.mjs";

process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "mar-qr-"));

const FORMAT_LEVEL = { 1: "L", 0: "M", 3: "Q", 2: "H" };

// An independent reader: shares only the function-module map and the tables with the encoder.
function read(qr) {
  const { version, size, modules } = qr;
  const fn = functionMap(version);
  const fromModules = (list) => list.reduce((n, [x, y], i) => n | ((modules[y][x] ? 1 : 0) << i), 0);
  const one = fromModules([[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]);
  const two = fromModules([...Array.from({ length: 8 }, (_, i) => [size - 1 - i, 8]), ...Array.from({ length: 7 }, (_, i) => [8, size - 7 + i])]);
  assert.equal(one, two, "both copies of the format bits agree");
  const data = (one ^ 0x5412) >>> 10;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  assert.equal((one ^ 0x5412) & 0x3ff, rem, "format bits pass their BCH check");
  assert.equal(modules[size - 8][8], true, "the always-dark module");
  const level = FORMAT_LEVEL[data >>> 3];
  const mask = data & 7;
  if (version >= 7) {
    const info = fromModules(Array.from({ length: 18 }, (_, i) => [Math.floor(i / 3), size - 11 + (i % 3)]));
    assert.equal(info >>> 12, version, "the version bits say the right version");
    let check = info >>> 12;
    for (let i = 0; i < 12; i += 1) check = (check << 1) ^ ((check >>> 11) * 0x1f25);
    assert.equal(info & 0xfff, check & 0xfff, "version bits pass their BCH check");
  }
  const bits = [];
  let up = true;
  for (let x = size - 1; x > 0; x -= 2) {
    if (x === 6) x -= 1;
    for (let i = 0; i < size; i += 1) {
      const y = up ? size - 1 - i : i;
      for (const col of [x, x - 1]) if (!fn[y][col]) bits.push(modules[y][col] !== maskTest(mask, col, y));
    }
    up = !up;
  }
  assert.equal(bits.length, rawModules(version), "the data area holds exactly the raw data modules of this version");
  const raw = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) raw.push(bits.slice(i, i + 8).reduce((n, b) => n * 2 + (b ? 1 : 0), 0));
  // De-interleave and check every block's error correction.
  const { blocks, eccLen, raw: total } = blockInfo(version, level);
  assert.equal(raw.length, total);
  const short = blocks - (total % blocks);
  const lengths = Array.from({ length: blocks }, (_, i) => Math.floor(total / blocks) - eccLen + (i < short ? 0 : 1));
  const dataBlocks = lengths.map(() => []);
  let at = 0;
  for (let i = 0; i < Math.max(...lengths); i += 1) for (const [b, len] of lengths.entries()) if (i < len) dataBlocks[b].push(raw[at++]);
  const eccBlocks = lengths.map(() => []);
  for (let i = 0; i < eccLen; i += 1) for (const b of eccBlocks.keys()) eccBlocks[b].push(raw[at++]);
  assert.equal(at, raw.length);
  dataBlocks.forEach((block, i) => assert.deepEqual(remainder(block, eccLen), eccBlocks[i], `block ${i} error correction`));
  const stream = dataBlocks.flat();
  assert.equal(stream.length, dataCodewords(version, level));
  const bitsOut = stream.flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >>> (7 - i)) & 1));
  const num = (from, count) => bitsOut.slice(from, from + count).reduce((n, b) => n * 2 + b, 0);
  assert.equal(num(0, 4), 0b0100, "byte mode");
  const countBits = version < 10 ? 8 : 16;
  const length = num(4, countBits);
  const bytes = Array.from({ length }, (_, i) => num(4 + countBits + i * 8, 8));
  return { text: new TextDecoder().decode(new Uint8Array(bytes)), level, mask };
}

test("wifi-qr: the QR encoder produces codes that read back correctly for every level and many sizes", () => {
  for (const level of LEVELS)
    for (const length of [1, 5, 17, 18, 40, 77, 100, 140, 200, 250, 300]) {
      const text = Array.from({ length }, (_, i) => String.fromCharCode(33 + ((i * 7) % 90))).join("");
      let qr;
      try {
        qr = encode(text, level);
      } catch {
        assert.ok(length > 100, "only long texts at strong levels may not fit");
        continue;
      }
      const out = read(qr);
      assert.equal(out.text, text, `${level} ${length}`);
      assert.equal(out.level, level);
      assert.equal(qr.size, sizeOf(qr.version));
    }
});

test("wifi-qr: versions span 1 to 20, multi-block interleaving works, and text that is too long is refused", () => {
  const seen = new Set();
  for (const length of [10, 30, 60, 100, 160, 230, 300, 400, 500, 620, 760]) {
    const text = "x".repeat(length - 3) + "é€";
    const qr = encode(text, "L");
    seen.add(qr.version);
    assert.equal(read(qr).text, text);
  }
  assert.ok(seen.size >= 8 && Math.max(...seen) >= 15, `versions covered: ${[...seen]}`);
  assert.throws(() => encode("x".repeat(900), "L"), /too long/);
  assert.throws(() => encode("x", "Z"), /Unknown error correction/);
  assert.equal(encode("hello", "M").version, 1);
  assert.equal(encode("hello", "M", { minVersion: 3 }).version, 3);
  assert.deepEqual(utf8("é"), [0xc3, 0xa9]);
  assert.equal(formatBits("M", 0).toString(2).padStart(15, "0"), "101010000010010", "the standard format string for level M, mask 0");
  assert.equal(formatBits("L", 4).toString(2).padStart(15, "0"), "110011000101111", "level L, mask 4");
});

test("wifi-qr: the Wi-Fi text escapes special characters and the picture path covers the dark modules", () => {
  assert.equal(wifiPayload({ ssid: "Harbour Home", password: "milk-tea", security: "WPA" }), "WIFI:T:WPA;S:Harbour Home;P:milk-tea;H:false;;");
  assert.equal(wifiPayload({ ssid: 'A;B,C:D"E\\F', password: "p;w", security: "SAE", hidden: true }), 'WIFI:T:SAE;S:A\\;B\\,C\\:D\\"E\\\\F;P:p\\;w;H:true;;');
  assert.equal(wifiPayload({ ssid: "Cafe", security: "open" }), "WIFI:T:nopass;S:Cafe;H:false;;");
  assert.throws(() => wifiPayload({ ssid: "" }), /network name/);
  assert.throws(() => wifiPayload({ ssid: "x", security: "WPA3" }), /Unknown security/);
  const qr = encode("hi", "M");
  const path = toPath(qr, 4);
  const dark = qr.modules.flat().filter(Boolean).length;
  const cells = [...path.matchAll(/h(\d+)v1/g)].reduce((n, m) => n + Number(m[1]), 0);
  assert.equal(cells, dark, "every dark module is in the path exactly once");
});

test("wifi-qr: networks come from the router and the password is given out only to people who can write", async () => {
  const t = await startApp();
  try {
    const domain = (await t.owner.get("/api/domain/wifi-qr")).data;
    assert.deepEqual(domain.networks.map((n) => [n.id, n.kind, n.ssid, n.security, n.enabled]), [
      ["wl0", "main", "Harbour Home", "WPA", true], ["wl0.1", "guest", "Harbour Guest", "WPA", false],
      ["wl1", "main", "Harbour Home 5G", "WPA", true], ["wl1.1", "guest", "Harbour Guest 5G", "WPA", false]]);
    assert.equal(domain.level, "M");
    assert.deepEqual(domain.entries.map((e) => [e.id, e.value]), [["wifi-qr.level", "M"], ["wifi-qr.password-text", "0"], ["wifi-qr.note", "Scan with your phone camera to join."]]);
    assert.deepEqual((await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "wifi-qr"), [], "the card settings are the app's own, not the router's");
    const card = await t.owner.request("PUT", "/api/x/wifi-qr/prefs", { changes: [{ id: "wifi-qr.level", value: "H" }, { id: "wifi-qr.note", value: "Welcome" }] });
    assert.equal(card.status, 200, card.text);
    assert.deepEqual([(await t.owner.get("/api/domain/wifi-qr")).data.level, (await t.owner.get("/api/domain/wifi-qr")).data.note], ["H", "Welcome"]);
    assert.equal((await t.owner.request("PUT", "/api/x/wifi-qr/prefs", { changes: [{ id: "wifi-qr.level", value: "Z" }] })).status, 400);
    assert.ok(!t.router.commands.some((c) => c.startsWith("nvram set")), "nothing was written to the router");
    await t.owner.request("PUT", "/api/x/wifi-qr/prefs", { changes: [{ id: "wifi-qr.level", value: "M" }] });
    assert.equal(JSON.stringify(domain).includes("milk-tea"), false, "the screen data carries no password");

    const secret = (await t.owner.post("/api/x/wifi-qr/payload", { id: "wl0" })).data;
    assert.deepEqual([secret.ssid, secret.password, secret.security, secret.hidden], ["Harbour Home", "milk-tea-and-egg-tarts", "WPA", false]);
    const qr = encode(wifiPayload(secret), domain.level);
    assert.equal(read(qr).text, "WIFI:T:WPA;S:Harbour Home;P:milk-tea-and-egg-tarts;H:false;;");

    assert.equal((await t.owner.post("/api/x/wifi-qr/payload", { id: "wl9" })).status, 404);
    t.router.nvram.wl1_auth_mode_x = "wpa2";
    assert.equal((await t.owner.post("/api/x/wifi-qr/payload", { id: "wl1" })).status, 409, "enterprise security has no QR code");
    t.router.nvram.wl0_auth_mode_x = "open";
    const open = (await t.owner.post("/api/x/wifi-qr/payload", { id: "wl0" })).data;
    assert.deepEqual([open.security, open.password], ["nopass", ""]);

    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("alex", "viewer password 1");
    assert.equal((await guest.get("/api/domain/wifi-qr")).status, 200);
    assert.equal((await guest.post("/api/x/wifi-qr/payload", { id: "wl1.1" })).status, 403, "viewers never get a password");
  } finally {
    await t.stop();
  }
});

test("wifi-qr: security names and the browser module", () => {
  assert.deepEqual(["open", "psk2", "psk2sae", "sae", "shared", "wpa2", "radius"].map(securityOf), ["nopass", "WPA", "WPA", "SAE", "WEP", null, null]);
  assert.equal(networksOf(new Map([["wl0_ssid", "A"]]), { bands: [{ index: 0, nband: "2" }] })[0].band, "2.4 GHz");
  assert.equal(checkFeatureModule(feature, "wifi-qr"), null);
});
