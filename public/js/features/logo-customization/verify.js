// Checks the bytes of a chosen logo image before anything decodes it. Pure
// functions: the file's real signature decides what it is (never its name or
// the type the browser guessed), the header is read for the size, and an image
// that is animated, malformed, truncated or far too large is refused with a
// reason. Nothing here uses the network.

export const LIMITS = Object.freeze({ maxBytes: 2 * 1024 * 1024, maxSide: 8192, maxPixels: 36_000_000, minSide: 16 });
const MIME = { png: "image/png", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
const EXT = { png: ["png"], jpeg: ["jpg", "jpeg", "jfif"], gif: ["gif"], webp: ["webp"] };

const fail = (code, error) => ({ ok: false, code, error });
const u32be = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u16be = (b, i) => (b[i] << 8) | b[i + 1];
const u16le = (b, i) => b[i] | (b[i + 1] << 8);
const u24le = (b, i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32le = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));

let crcTable = null;
export function crc32(bytes, start = 0, end = bytes.length) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = start; i < end; i += 1) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function sniff(b) {
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 6 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) return "gif";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  return null;
}

function readPng(b) {
  let i = 8;
  let width = 0;
  let height = 0;
  let seenIdat = false;
  let first = true;
  while (i + 12 <= b.length) {
    const len = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    if (len > b.length - i - 12) return fail("MALFORMED", "The PNG is cut short or a chunk length is wrong.");
    if (u32be(b, i + 8 + len) !== crc32(b, i + 4, i + 8 + len)) return fail("MALFORMED", `The PNG has a damaged ${type} chunk.`);
    if (first) {
      if (type !== "IHDR" || len !== 13) return fail("MALFORMED", "The PNG does not start with a valid header.");
      width = u32be(b, i + 8);
      height = u32be(b, i + 12);
      first = false;
    }
    if (type === "acTL" || type === "fcTL" || type === "fdAT") return fail("ANIMATED", "Animated PNG images are not accepted. Use a still image.");
    if (type === "IDAT") seenIdat = true;
    if (type === "IEND") return seenIdat ? { width, height } : fail("MALFORMED", "The PNG has no image data.");
    i += 12 + len;
  }
  return fail("MALFORMED", "The PNG ends before its end marker.");
}

function readJpeg(b) {
  let i = 2;
  let size = null;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return fail("MALFORMED", "The JPEG has a broken segment.");
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; }
    if (marker === 0xd9) return size ?? fail("MALFORMED", "The JPEG has no size.");
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { i += 2; continue; }
    const len = u16be(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) return fail("MALFORMED", "The JPEG is cut short.");
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (len < 8) return fail("MALFORMED", "The JPEG header is too short.");
      size = { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    }
    if (marker === 0xda) {
      // Entropy-coded data follows. Find the end marker from the back (trailing zero padding is allowed).
      let end = b.length;
      while (end > 0 && b[end - 1] === 0) end -= 1;
      return size && b[end - 2] === 0xff && b[end - 1] === 0xd9 ? size : fail("MALFORMED", "The JPEG has no end marker, so it may be cut short.");
    }
    i += 2 + len;
  }
  return fail("MALFORMED", "The JPEG ended before the picture started.");
}

function readGif(b) {
  if (b.length < 13) return fail("MALFORMED", "The GIF is cut short.");
  const width = u16le(b, 6);
  const height = u16le(b, 8);
  let i = 13;
  if (b[10] & 0x80) i += 3 * (1 << ((b[10] & 7) + 1));
  let frames = 0;
  while (i < b.length) {
    const block = b[i];
    if (block === 0x3b) return frames === 0 ? fail("MALFORMED", "The GIF has no picture.") : { width, height };
    if (block === 0x21) { i += 2; while (i < b.length && b[i] !== 0) i += b[i] + 1; i += 1; continue; }
    if (block === 0x2c) {
      frames += 1;
      if (frames > 1) return fail("ANIMATED", "Animated GIF images are not accepted. Use a still image.");
      if (i + 10 > b.length) return fail("MALFORMED", "The GIF is cut short.");
      const flags = b[i + 9];
      i += 10;
      if (flags & 0x80) i += 3 * (1 << ((flags & 7) + 1));
      i += 1;
      while (i < b.length && b[i] !== 0) i += b[i] + 1;
      i += 1;
      continue;
    }
    return fail("MALFORMED", "The GIF has an unknown block.");
  }
  return fail("MALFORMED", "The GIF ends before its end marker.");
}

function readWebp(b) {
  const riff = u32le(b, 4);
  if (riff + 8 > b.length || riff < 12) return fail("MALFORMED", "The WebP size does not match the file, so it may be cut short.");
  let i = 12;
  let size = null;
  while (i + 8 <= Math.min(b.length, riff + 8)) {
    const type = ascii(b, i, 4);
    const len = u32le(b, i + 4);
    if (i + 8 + len > b.length) return fail("MALFORMED", "A WebP chunk runs past the end of the file.");
    const d = i + 8;
    if (type === "ANIM" || type === "ANMF") return fail("ANIMATED", "Animated WebP images are not accepted. Use a still image.");
    if (type === "VP8X") {
      if (len < 10) return fail("MALFORMED", "The WebP header is too short.");
      if (b[d] & 0x02) return fail("ANIMATED", "Animated WebP images are not accepted. Use a still image.");
      size = { width: u24le(b, d + 4) + 1, height: u24le(b, d + 7) + 1 };
    } else if (type === "VP8 " && !size) {
      if (len < 10 || b[d + 3] !== 0x9d || b[d + 4] !== 0x01 || b[d + 5] !== 0x2a) return fail("MALFORMED", "The WebP picture header is not valid.");
      size = { width: u16le(b, d + 6) & 0x3fff, height: u16le(b, d + 8) & 0x3fff };
    } else if (type === "VP8L" && !size) {
      if (len < 5 || b[d] !== 0x2f) return fail("MALFORMED", "The WebP picture header is not valid.");
      const bits = u32le(b, d + 1);
      size = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    i += 8 + len + (len & 1);
  }
  return size ?? fail("MALFORMED", "The WebP has no picture.");
}

// inspectImage(bytes, { type, name }) -> { ok: true, format, mime, width, height } or { ok: false, code, error }
export function inspectImage(input, { type = "", name = "" } = {}) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input ?? []);
  if (b.length === 0) return fail("EMPTY", "The file is empty.");
  if (b.length > LIMITS.maxBytes) return fail("TOO_LARGE", `The file is larger than ${LIMITS.maxBytes / 1024 / 1024} MB.`);
  const format = sniff(b);
  if (!format) return fail("UNKNOWN_FORMAT", "This is not a PNG, JPEG, GIF or WebP picture. SVG files are not accepted because they can carry scripts.");
  if (type && Object.values(MIME).includes(type.toLowerCase()) && type.toLowerCase() !== MIME[format]) return fail("TYPE_MISMATCH", `The file says it is ${type}, but its contents are ${MIME[format]}.`);
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext && Object.values(EXT).flat().includes(ext) && !EXT[format].includes(ext)) return fail("TYPE_MISMATCH", `The file name ends in .${ext}, but its contents are ${MIME[format]}.`);
  const read = { png: readPng, jpeg: readJpeg, gif: readGif, webp: readWebp }[format](b);
  if (read.ok === false) return read;
  const { width, height } = read;
  if (!(width > 0 && height > 0)) return fail("MALFORMED", "The picture has no size.");
  if (width > LIMITS.maxSide || height > LIMITS.maxSide || width * height > LIMITS.maxPixels) return fail("TOO_BIG_DIMENSIONS", `The picture is ${width} × ${height} pixels, which is more than this app will open (${LIMITS.maxSide} per side, ${LIMITS.maxPixels / 1e6} million in all).`);
  if (width < LIMITS.minSide || height < LIMITS.minSide) return fail("TOO_SMALL", `The picture is ${width} × ${height} pixels. Use one at least ${LIMITS.minSide} × ${LIMITS.minSide}.`);
  return { ok: true, format, mime: MIME[format], width, height };
}

// ---- crop and fit (pure) -------------------------------------------------------
const lim = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Where to read from the source and where to draw on a square canvas of `size`.
// fit "cover" fills the square, "contain" shows the whole picture. zoom 1 to 4 for cover; 0.4 to 1 for contain.
export function cropRect({ srcW, srcH, size, fit = "cover", zoom = 1, fx = 0.5, fy = 0.5 }) {
  if (fit === "contain") {
    const scale = (size / Math.max(srcW, srcH)) * lim(zoom, 0.4, 1);
    const dw = srcW * scale;
    const dh = srcH * scale;
    return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: (size - dw) / 2, dy: (size - dh) / 2, dw, dh };
  }
  const scale = (size / Math.min(srcW, srcH)) * lim(zoom, 1, 4);
  const sw = size / scale;
  const sh = size / scale;
  return { sx: lim(fx * srcW - sw / 2, 0, Math.max(0, srcW - sw)), sy: lim(fy * srcH - sh / 2, 0, Math.max(0, srcH - sh)), sw, sh, dx: 0, dy: 0, dw: size, dh: size };
}

// The average colour of the visible pixels of an RGBA buffer, as #rrggbb (or null for an empty picture).
export function dominantColor(rgba) {
  let r = 0; let g = 0; let b = 0; let n = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a < 32) continue;
    r += rgba[i] * a; g += rgba[i + 1] * a; b += rgba[i + 2] * a; n += a;
  }
  if (!n) return null;
  return `#${[r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, "0")).join("")}`;
}
