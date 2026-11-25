// Tests for the logo feature: the byte checker (real signatures, animation,
// truncation, size bombs, name and type mismatches), crop and fit, the stored
// logo's shape, and that nothing here can send the image anywhere.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { DEFAULT_LOGO, PRESETS, sanitizeLogo } from "../../public/js/features/logo-customization/index.js";
import { LIMITS, cropRect, crc32, dominantColor, inspectImage, sniff } from "../../public/js/features/logo-customization/verify.js";
import { readSources } from "./fakes.mjs";

const bytes = (...parts) => Uint8Array.from(parts.flatMap((p) => (typeof p === "number" ? [p] : typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : [...p])));
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const le16 = (n) => [n & 255, (n >>> 8) & 255];

function pngChunk(type, data = []) {
  const body = bytes(type, data);
  return bytes(be32(data.length), body, be32(crc32(body)));
}
function png(w, h, { extra = [], iend = true, idat = true } = {}) {
  return bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], pngChunk("IHDR", [...be32(w), ...be32(h), 8, 2, 0, 0, 0]), ...extra, idat ? pngChunk("IDAT", [1, 2, 3, 4]) : [], iend ? pngChunk("IEND") : []);
}
function jpeg(w, h, { eoi = true } = {}) {
  return bytes([0xff, 0xd8], [0xff, 0xc0, 0, 17, 8, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1], [0xff, 0xda, 0, 12, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 63, 0], [1, 2, 3, 4, 5], eoi ? [0xff, 0xd9] : []);
}
function gif(w, h, frames = 1, { trailer = true } = {}) {
  const frame = [0x2c, 0, 0, 0, 0, ...le16(w), ...le16(h), 0, 2, 2, 1, 2, 0];
  return bytes("GIF89a", le16(w), le16(h), [0, 0, 0], ...Array.from({ length: frames }, () => frame), trailer ? [0x3b] : []);
}
function webpX(w, h, { animated = false, riff } = {}) {
  const chunk = bytes("VP8X", le32(10), [animated ? 0x02 : 0, 0, 0, 0], [(w - 1) & 255, ((w - 1) >> 8) & 255, ((w - 1) >> 16) & 255], [(h - 1) & 255, ((h - 1) >> 8) & 255, ((h - 1) >> 16) & 255]);
  return bytes("RIFF", le32(riff ?? 4 + chunk.length), "WEBP", chunk);
}
function webpL(w, h) {
  const bits = (w - 1) | ((h - 1) << 14);
  const chunk = bytes("VP8L", le32(5), [0x2f], le32(bits >>> 0));
  return bytes("RIFF", le32(4 + chunk.length + 1), "WEBP", chunk, [0]);
}
const reason = (b, o) => { const r = inspectImage(b, o); return r.ok ? "ok" : r.code; };

test("logo-customization: the module is well formed and offers six presets", () => {
  assert.equal(checkFeatureModule(feature, "logo-customization"), null);
  assert.equal(PRESETS.length, 6);
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, 6);
  for (const p of PRESETS) assert.ok(p.label.en && p.label.yue && p.paths.length, p.id);
});

test("logo-customization: real PNG, JPEG, GIF and WebP pictures are read from their own bytes", () => {
  assert.deepEqual(inspectImage(png(120, 80)), { ok: true, format: "png", mime: "image/png", width: 120, height: 80 });
  assert.deepEqual(inspectImage(jpeg(300, 200)), { ok: true, format: "jpeg", mime: "image/jpeg", width: 300, height: 200 });
  assert.deepEqual(inspectImage(gif(64, 48)), { ok: true, format: "gif", mime: "image/gif", width: 64, height: 48 });
  assert.deepEqual(inspectImage(webpX(256, 128)), { ok: true, format: "webp", mime: "image/webp", width: 256, height: 128 });
  assert.deepEqual(inspectImage(webpL(100, 90)), { ok: true, format: "webp", mime: "image/webp", width: 100, height: 90 });
  assert.equal(sniff(bytes("<svg")), null);
  assert.equal(crc32(bytes("IEND")), 0xae426082);
});

test("logo-customization: the file's bytes decide the type, so a wrong name or declared type is refused", () => {
  assert.equal(reason(png(64, 64), { name: "logo.jpg" }), "TYPE_MISMATCH");
  assert.equal(reason(jpeg(64, 64), { type: "image/png" }), "TYPE_MISMATCH");
  assert.equal(reason(gif(64, 64), { name: "x.webp" }), "TYPE_MISMATCH");
  assert.equal(reason(png(64, 64), { name: "logo.PNG", type: "image/png" }), "ok");
  assert.equal(reason(png(64, 64), { name: "logo.jpeg" }), "TYPE_MISMATCH");
  assert.equal(reason(jpeg(64, 64), { name: "logo.jpeg", type: "image/jpeg" }), "ok");
  assert.equal(reason(png(64, 64), { name: "readme.txt", type: "" }), "ok", "an unrelated name is not a mismatch; the bytes are what count");
  assert.equal(reason(bytes("<svg xmlns='x'><script>1</script></svg>"), { name: "logo.png", type: "image/png" }), "UNKNOWN_FORMAT");
  assert.equal(reason(bytes("hello world, this is not a picture"), {}), "UNKNOWN_FORMAT");
  assert.equal(reason(new Uint8Array(0), {}), "EMPTY");
  assert.equal(reason(undefined, {}), "EMPTY");
});

test("logo-customization: animated pictures are refused in every format", () => {
  assert.equal(reason(png(64, 64, { extra: [pngChunk("acTL", [0, 0, 0, 2, 0, 0, 0, 0])] })), "ANIMATED");
  assert.equal(reason(gif(64, 64, 2)), "ANIMATED");
  assert.equal(reason(gif(64, 64, 5)), "ANIMATED");
  assert.equal(reason(webpX(64, 64, { animated: true })), "ANIMATED");
  const anim = bytes("RIFF", le32(4 + 18 + 8), "WEBP", "VP8X", le32(10), [0, 0, 0, 0, 63, 0, 0, 63, 0, 0], "ANIM", le32(0));
  assert.equal(reason(anim), "ANIMATED", "an ANIM chunk is enough");
  assert.equal(reason(gif(64, 64, 1)), "ok", "a one-frame GIF is a still picture");
});

test("logo-customization: truncated, damaged and malformed pictures are refused with no partial result", () => {
  assert.equal(reason(png(64, 64, { iend: false })), "MALFORMED");
  assert.equal(reason(png(64, 64, { idat: false })), "MALFORMED");
  const good = png(64, 64);
  assert.equal(reason(good.slice(0, good.length - 5)), "MALFORMED");
  const flipped = Uint8Array.from(good);
  flipped[20] ^= 0xff; // a byte inside IHDR: the checksum no longer matches
  assert.equal(reason(flipped), "MALFORMED");
  assert.equal(reason(jpeg(64, 64, { eoi: false })), "MALFORMED");
  assert.equal(reason(jpeg(64, 64).slice(0, 10)), "MALFORMED");
  assert.equal(reason(gif(64, 64, 1, { trailer: false })), "MALFORMED");
  assert.equal(reason(gif(64, 64, 1).slice(0, 8)), "MALFORMED");
  assert.equal(reason(webpX(64, 64, { riff: 99999 })), "MALFORMED");
  assert.equal(reason(bytes("RIFF", le32(4), "WEBP")), "MALFORMED");
  const lying = Uint8Array.from(png(64, 64));
  lying.set(be32(1_000_000), 8); // IHDR claims a chunk far longer than the file
  assert.equal(reason(lying), "MALFORMED");
  assert.equal(inspectImage(flipped).ok, false);
});

test("logo-customization: pictures that are far too large are refused before anything decodes them", () => {
  assert.equal(reason(png(100000, 100000)), "TOO_BIG_DIMENSIONS");
  assert.equal(reason(png(8193, 64)), "TOO_BIG_DIMENSIONS");
  assert.equal(reason(png(8000, 8000)), "TOO_BIG_DIMENSIONS", "too many pixels in all, even if each side is allowed");
  assert.equal(reason(jpeg(65535, 65535)), "TOO_BIG_DIMENSIONS");
  assert.equal(reason(webpX(16000, 16000)), "TOO_BIG_DIMENSIONS");
  assert.equal(reason(png(4096, 4096)), "ok");
  assert.equal(reason(png(8, 8)), "TOO_SMALL");
  assert.equal(reason(new Uint8Array(LIMITS.maxBytes + 1)), "TOO_LARGE");
  assert.equal(reason(png(0, 64)), "MALFORMED");
  assert.ok(LIMITS.maxPixels <= 40_000_000 && LIMITS.maxBytes <= 4 * 1024 * 1024);
});

test("logo-customization: crop, fit, focal point and the average colour", () => {
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const sq = cropRect({ srcW: 1000, srcH: 500, size: 256, fit: "cover", zoom: 1, fx: 0.5, fy: 0.5 });
  assert.ok(near(sq.sw, 500) && near(sq.sh, 500) && near(sq.sx, 250) && near(sq.sy, 0));
  assert.deepEqual([sq.dx, sq.dy, sq.dw, sq.dh], [0, 0, 256, 256]);
  const left = cropRect({ srcW: 1000, srcH: 500, size: 256, fit: "cover", zoom: 1, fx: 0, fy: 0.5 });
  assert.ok(near(left.sx, 0), "the focal point keeps the left of the picture");
  const right = cropRect({ srcW: 1000, srcH: 500, size: 256, fit: "cover", zoom: 1, fx: 1, fy: 0.5 });
  assert.ok(near(right.sx, 500));
  const zoomed = cropRect({ srcW: 1000, srcH: 500, size: 256, fit: "cover", zoom: 2, fx: 0.5, fy: 0.5 });
  assert.ok(near(zoomed.sw, 250));
  const clamped = cropRect({ srcW: 1000, srcH: 500, size: 256, fit: "cover", zoom: 99, fx: 5, fy: -5 });
  assert.ok(clamped.sx >= 0 && clamped.sx + clamped.sw <= 1000 && clamped.sy >= 0 && clamped.sy + clamped.sh <= 500, "never reads outside the picture");
  const whole = cropRect({ srcW: 1000, srcH: 500, size: 256, fit: "contain", zoom: 1 });
  assert.ok(near(whole.dw, 256) && near(whole.dh, 128) && near(whole.dy, 64), "the whole picture is shown, centred");
  const small = cropRect({ srcW: 1000, srcH: 500, size: 256, fit: "contain", zoom: 0.5 });
  assert.ok(near(small.dw, 128));
  assert.equal(dominantColor(Uint8Array.from([255, 0, 0, 255, 255, 0, 0, 255])), "#ff0000");
  assert.equal(dominantColor(Uint8Array.from([255, 0, 0, 255, 0, 0, 255, 255])), "#800080");
  assert.equal(dominantColor(Uint8Array.from([10, 10, 10, 0])), null, "a fully transparent picture has no colour");
  assert.equal(dominantColor(new Uint8Array(0)), null);
});

test("logo-customization: the stored logo is cleaned, so a bad value can never become the logo", () => {
  assert.deepEqual(sanitizeLogo(undefined), DEFAULT_LOGO);
  assert.equal(sanitizeLogo({ kind: "custom", dataUrl: "" }).kind, "preset", "no picture means a preset");
  assert.equal(sanitizeLogo({ kind: "custom", dataUrl: "javascript:alert(1)" }).kind, "preset");
  assert.equal(sanitizeLogo({ kind: "custom", dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }).kind, "preset", "SVG is never stored");
  assert.equal(sanitizeLogo({ kind: "custom", dataUrl: "data:image/png;base64,AAAA\"onerror=x" }).kind, "preset");
  assert.equal(sanitizeLogo({ kind: "custom", dataUrl: `data:image/png;base64,${"A".repeat(700000)}` }).kind, "preset", "an oversized value is refused");
  const ok = sanitizeLogo({ kind: "custom", dataUrl: "data:image/png;base64,iVBORw0KGgo=", preset: "wifi", name: "a".repeat(200), seed: "#ABCDEF" });
  assert.deepEqual([ok.kind, ok.preset, ok.name.length, ok.seed], ["custom", "wifi", 80, "#abcdef"]);
  assert.equal(sanitizeLogo({ preset: "nope" }).preset, "router");
  assert.equal(sanitizeLogo({ seed: "red" }).seed, "");
});

test("logo-customization: the image never leaves the machine and the installed identity is never rewritten", async () => {
  for (const [file, source] of Object.entries(await readSources("logo-customization"))) {
    // The SVG namespace is a name, not an address, so it is not counted.
    const code = source.replace(/^\s*\/\/.*$/gm, "").replaceAll("http://www.w3.org/2000/svg", "");
    for (const banned of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "api.post", "api.patch", "ctx.api", "http://", "https://", "navigator.serviceWorker"]) assert.ok(!code.includes(banned), `${file} uses ${banned}`);
    assert.ok(!/rel=["']icon|document\.title\s*=|manifest/.test(code), `${file} rewrites the installed identity`);
  }
  const index = (await readSources("logo-customization"))["index.js"];
  assert.ok(index.includes("closeDraft()") && index.includes("unchanged"), "a failure keeps the previous logo");
  assert.ok(index.includes("canvas.toDataURL") && index.includes("sanitizeLogo"), "what is kept is the redrawn, cleaned PNG");
  assert.ok(index.includes("bitmap.width !== r.width"), "the decoded size must match the header");
});
