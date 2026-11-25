// A small QR code encoder: byte mode, error correction levels L, M, Q and H,
// versions 1 to 20 (up to 858 bytes), all eight masks with the standard
// penalty scoring. No dependencies, no DOM: it returns a grid of booleans that
// the screen draws as SVG, and tests/features/wifi-qr.test.mjs reads the grid
// back to prove that the format bits, the error correction and the text are
// all valid.

const ECC_PER_BLOCK = { L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28] };
const BLOCKS = { L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25] };
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
export const LEVELS = ["L", "M", "Q", "H"];
export const MAX_VERSION = 20;

// ---- sizes -----------------------------------------------------------------

export const sizeOf = (version) => version * 4 + 17;

export function rawModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

// How the codewords are split into blocks: how many, and how many error correction codewords each.
export const blockInfo = (version, level) => ({ blocks: BLOCKS[level][version - 1], eccLen: ECC_PER_BLOCK[level][version - 1], raw: Math.floor(rawModules(version) / 8) });

export function dataCodewords(version, level) {
  return Math.floor(rawModules(version) / 8) - ECC_PER_BLOCK[level][version - 1] * BLOCKS[level][version - 1];
}

// The bytes of a text as UTF-8, because that is what phones read from a QR code.
export const utf8 = (text) => [...new TextEncoder().encode(text)];

// ---- Reed-Solomon over GF(256) --------------------------------------------

const EXP = new Array(512);
const LOG = new Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    poly.forEach((c, j) => {
      next[j] ^= c;
      next[j + 1] ^= mul(c, EXP[i]);
    });
    poly = next;
  }
  return poly; // highest power first, leading 1
}

export function remainder(data, degree) {
  const gen = generator(degree);
  const result = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    for (let i = 0; i < degree; i += 1) result[i] ^= mul(gen[i + 1], factor);
  }
  return result;
}

// ---- building the grid -------------------------------------------------------

const bit = (value, i) => ((value >>> i) & 1) === 1;

function alignmentPositions(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let position = sizeOf(version) - 7; result.length < count; position -= step) result.splice(1, 0, position);
  return result;
}

// Which modules belong to patterns (finders, timing, alignment, format and version bits) instead of data.
export function functionMap(version) {
  const size = sizeOf(version);
  const map = Array.from({ length: size }, () => new Array(size).fill(false));
  const fill = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) if (x >= 0 && y >= 0 && x < size && y < size) map[y][x] = true;
  };
  fill(0, 0, 9, 9);
  fill(size - 8, 0, 8, 9);
  fill(0, size - 8, 9, 8);
  fill(6, 0, 1, size);
  fill(0, 6, size, 1);
  const align = alignmentPositions(version);
  for (const [i, cy] of align.entries())
    for (const [j, cx] of align.entries()) {
      if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) continue;
      fill(cx - 2, cy - 2, 5, 5);
    }
  if (version >= 7) {
    fill(size - 11, 0, 3, 6);
    fill(0, size - 11, 6, 3);
  }
  return map;
}

function drawFunctionPatterns(modules, version) {
  const size = sizeOf(version);
  const set = (x, y, dark) => {
    if (x >= 0 && y >= 0 && x < size && y < size) modules[y][x] = dark;
  };
  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy += 1)
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const align = alignmentPositions(version);
  for (const [i, cy] of align.entries())
    for (const [j, cx] of align.entries()) {
      if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const dark = bit(bits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }
}

export function formatBits(level, mask) {
  const data = (FORMAT_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormat(modules, version, level, mask) {
  const size = sizeOf(version);
  const bits = formatBits(level, mask);
  for (let i = 0; i <= 5; i += 1) modules[i][8] = bit(bits, i);
  modules[7][8] = bit(bits, 6);
  modules[8][8] = bit(bits, 7);
  modules[8][7] = bit(bits, 8);
  for (let i = 9; i < 15; i += 1) modules[8][14 - i] = bit(bits, i);
  for (let i = 0; i < 8; i += 1) modules[8][size - 1 - i] = bit(bits, i);
  for (let i = 8; i < 15; i += 1) modules[size - 15 + i][8] = bit(bits, i);
  modules[size - 8][8] = true; // the always-dark module
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];
export const maskTest = (mask, x, y) => MASKS[mask](x, y);

// The order data bits are placed in: pairs of columns from the right, zigzagging up and down, skipping the timing column.
export function* dataPositions(version, isFunction) {
  const size = sizeOf(version);
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1)
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (!isFunction[y][x]) yield [x, y];
      }
  }
}

function penalty(modules) {
  const size = modules.length;
  let score = 0;
  const line = (get) => {
    for (let a = 0; a < size; a += 1) {
      let run = 1;
      let text = "";
      for (let b = 0; b < size; b += 1) {
        const dark = get(a, b);
        text += dark ? "1" : "0";
        if (b > 0 && dark === get(a, b - 1)) {
          run += 1;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else run = 1;
      }
      for (const pattern of ["10111010000", "00001011101"]) {
        let at = text.indexOf(pattern);
        while (at !== -1) {
          score += 40;
          at = text.indexOf(pattern, at + 1);
        }
      }
    }
  };
  line((y, x) => modules[y][x]);
  line((x, y) => modules[y][x]);
  let dark = 0;
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) dark += 1;
      if (x + 1 < size && y + 1 < size && modules[y][x] === modules[y][x + 1] && modules[y][x] === modules[y + 1][x] && modules[y][x] === modules[y + 1][x + 1]) score += 3;
    }
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

// Returns the codewords (data plus error correction, interleaved) for a list of data bytes.
export function codewords(bytes, version, level) {
  const capacity = dataCodewords(version, level);
  const bits = [];
  const push = (value, count) => {
    for (let i = count - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11) data.push(pad);

  const blocks = BLOCKS[level][version - 1];
  const eccLen = ECC_PER_BLOCK[level][version - 1];
  const raw = Math.floor(rawModules(version) / 8);
  const shortBlocks = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const parts = [];
  let offset = 0;
  for (let i = 0; i < blocks; i += 1) {
    const length = shortLen - eccLen + (i < shortBlocks ? 0 : 1);
    const chunk = data.slice(offset, offset + length);
    offset += length;
    parts.push({ data: chunk, ecc: remainder(chunk, eccLen) });
  }
  const out = [];
  for (let i = 0; i < Math.max(...parts.map((p) => p.data.length)); i += 1) for (const p of parts) if (i < p.data.length) out.push(p.data[i]);
  for (let i = 0; i < eccLen; i += 1) for (const p of parts) out.push(p.ecc[i]);
  return out;
}

// encode(text, "M") -> { version, size, level, mask, modules: boolean[][] }. Throws if the text does not fit.
export function encode(text, level = "M", { minVersion = 1 } = {}) {
  if (!LEVELS.includes(level)) throw new Error(`Unknown error correction level "${level}".`);
  const bytes = utf8(text);
  let version = minVersion;
  for (; version <= MAX_VERSION; version += 1) {
    const used = 4 + (version < 10 ? 8 : 16) + bytes.length * 8;
    if (used <= dataCodewords(version, level) * 8) break;
  }
  if (version > MAX_VERSION) throw new Error("That text is too long for a QR code at this error correction level.");
  const size = sizeOf(version);
  const isFunction = functionMap(version);
  const stream = codewords(bytes, version, level);
  const base = Array.from({ length: size }, () => new Array(size).fill(false));
  drawFunctionPatterns(base, version);
  let index = 0;
  for (const [x, y] of dataPositions(version, isFunction)) {
    base[y][x] = index < stream.length * 8 ? bit(stream[index >> 3], 7 - (index & 7)) : false;
    index += 1;
  }
  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const modules = base.map((row) => row.slice());
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (!isFunction[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x];
    drawFormat(modules, version, level, mask);
    const score = penalty(modules);
    if (!best || score < best.score) best = { score, modules, mask };
  }
  return { version, size, level, mask: best.mask, modules: best.modules, bytes: bytes.length };
}

// ---- the Wi-Fi sign-in text phones understand -----------------------------------

// WIFI:T:WPA;S:name;P:password;H:true;;  with \ ; , : " escaped by a backslash.
const escapeField = (value) => String(value).replace(/([\\;,:"])/g, "\\$1");

export function wifiPayload({ ssid, password = "", security = "WPA", hidden = false }) {
  if (!ssid) throw new Error("A network name is needed.");
  const type = security === "open" ? "nopass" : security;
  if (!["WPA", "SAE", "WEP", "nopass"].includes(type)) throw new Error(`Unknown security type "${security}".`);
  return `WIFI:T:${type};S:${escapeField(ssid)};${type === "nopass" ? "" : `P:${escapeField(password)};`}H:${hidden ? "true" : "false"};;`;
}

// SVG path data for the dark modules (one rectangle per run), with a quiet zone of `margin` modules.
export function toPath(qr, margin = 4) {
  let d = "";
  for (let y = 0; y < qr.size; y += 1) {
    let x = 0;
    while (x < qr.size) {
      if (!qr.modules[y][x]) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < qr.size && qr.modules[y][end]) end += 1;
      d += `M${x + margin} ${y + margin}h${end - x}v1h-${end - x}z`;
      x = end;
    }
  }
  return d;
}
