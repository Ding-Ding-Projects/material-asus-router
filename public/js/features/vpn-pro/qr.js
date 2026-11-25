// A small QR code encoder for the WireGuard configuration. Byte mode, error
// correction level L or M, versions 1 to 25. It imports nothing and touches no
// DOM, so the browser and the Node tests use the same code. The output is a
// square matrix of booleans (true is a dark module).
const ECC_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28],
};
const BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21],
};
const FORMAT_BITS = { L: 1, M: 0 };
export const MAX_VERSION = 25;

const rawModules = (ver) => {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
};
const dataCodewords = (ver, ecl) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * BLOCKS[ecl][ver];

// How many bytes fit at the largest version for a level.
export const capacity = (ecl, ver = MAX_VERSION) => dataCodewords(ver, ecl) - (ver <= 9 ? 2 : 3);

// ---- Reed-Solomon over GF(256) ----------------------------------------------
const mul = (x, y) => {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
};
function generator(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = mul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = mul(root, 0x02);
  }
  return result;
}
function remainder(data, gen) {
  const out = new Array(gen.length).fill(0);
  for (const b of data) {
    const factor = b ^ out.shift();
    out.push(0);
    gen.forEach((coef, i) => (out[i] ^= mul(coef, factor)));
  }
  return out;
}

function addEccAndInterleave(data, ver, ecl) {
  const blocks = BLOCKS[ecl][ver];
  const eccLen = ECC_PER_BLOCK[ecl][ver];
  const raw = Math.floor(rawModules(ver) / 8);
  const shortBlocks = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const gen = generator(eccLen);
  const split = [];
  for (let i = 0, k = 0; i < blocks; i += 1) {
    const len = shortLen - eccLen + (i < shortBlocks ? 0 : 1);
    const part = data.slice(k, k + len);
    k += len;
    const ecc = remainder(part, gen);
    if (i < shortBlocks) part.push(0);
    split.push(part.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < split[0].length; i += 1) split.forEach((block, j) => (i !== shortLen - eccLen || j >= shortBlocks) && out.push(block[i]));
  return out;
}

// ---- the matrix ---------------------------------------------------------------
function alignmentPositions(ver) {
  if (ver === 1) return [];
  const count = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
  const out = [6];
  for (let pos = ver * 4 + 10; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}

function build(ver) {
  const size = ver * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => {
    modules[y][x] = dark;
    fixed[y][x] = true;
  };
  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy += 1)
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const align = alignmentPositions(ver);
  align.forEach((cy, i) =>
    align.forEach((cx, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
  // Reserve the format and version areas; they are filled in once the mask is known.
  for (let i = 0; i < 9; i += 1) {
    fixed[8][i] = fixed[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) fixed[8][size - 1 - i] = fixed[size - 1 - i][8] = true;
  set(8, size - 8, true);
  if (ver >= 7) for (let i = 0; i < 6; i += 1) for (let j = 0; j < 3; j += 1) fixed[size - 11 + j][i] = fixed[i][size - 11 + j] = true;
  return { size, modules, fixed };
}

function placeData(m, codewords) {
  const bits = [];
  for (const b of codewords) for (let i = 7; i >= 0; i -= 1) bits.push((b >>> i) & 1);
  let k = 0;
  for (let right = m.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < m.size; vert += 1)
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? m.size - 1 - vert : vert;
        if (!m.fixed[y][x] && k < bits.length) m.modules[y][x] = bits[k++] === 1;
      }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function drawFormat(modules, size, ecl, mask) {
  const data = (FORMAT_BITS[ecl] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i) => ((bits >>> i) & 1) !== 0;
  const put = (x, y, dark) => {
    modules[y][x] = dark;
  };
  for (let i = 0; i <= 5; i += 1) put(8, i, bit(i));
  put(8, 7, bit(6));
  put(8, 8, bit(7));
  put(7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) put(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i += 1) put(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i += 1) put(8, size - 15 + i, bit(i));
  put(8, size - 8, true);
}

function drawVersion(modules, size, ver) {
  if (ver < 7) return;
  let rem = ver;
  for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (ver << 12) | rem;
  for (let i = 0; i < 18; i += 1) {
    const dark = ((bits >>> i) & 1) !== 0;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    modules[b][a] = dark;
    modules[a][b] = dark;
  }
}

function penalty(modules, size) {
  let score = 0;
  const lines = [];
  for (let y = 0; y < size; y += 1) lines.push(modules[y]);
  for (let x = 0; x < size; x += 1) lines.push(modules.map((row) => row[x]));
  const FINDER = [true, false, true, true, true, false, true];
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i += 1) {
      if (i < size && line[i] === line[i - 1]) run += 1;
      else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
    for (let i = 0; i + 7 <= size; i += 1) {
      if (!FINDER.every((v, k) => line[i + k] === v)) continue;
      const before = [1, 2, 3, 4].every((k) => i - k < 0 || line[i - k] === false);
      const after = [0, 1, 2, 3].every((k) => i + 7 + k >= size || line[i + 7 + k] === false);
      if (before || after) score += 40;
    }
  }
  for (let y = 0; y + 1 < size; y += 1) for (let x = 0; x + 1 < size; x += 1) if (modules[y][x] === modules[y][x + 1] && modules[y][x] === modules[y + 1][x] && modules[y][x] === modules[y + 1][x + 1]) score += 3;
  const dark = modules.flat().filter(Boolean).length;
  score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  return score;
}

// Encodes text as UTF-8 bytes. Returns { version, size, modules, ecl, mask }.
export function encodeQr(text, ecl = "M") {
  const bytes = [...new TextEncoder().encode(String(text))];
  for (const level of ecl === "M" ? ["M", "L"] : ["L"]) {
    for (let ver = 1; ver <= MAX_VERSION; ver += 1) {
      const lenBits = ver <= 9 ? 8 : 16;
      const cap = dataCodewords(ver, level);
      if (4 + lenBits + bytes.length * 8 > cap * 8) continue;
      const bits = [];
      const put = (value, count) => {
        for (let i = count - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
      };
      put(0b0100, 4);
      put(bytes.length, lenBits);
      bytes.forEach((b) => put(b, 8));
      put(0, Math.min(4, cap * 8 - bits.length));
      while (bits.length % 8) bits.push(0);
      const data = [];
      for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
      for (let pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);
      const m = build(ver);
      placeData(m, addEccAndInterleave(data, ver, level));
      let best = null;
      for (let mask = 0; mask < 8; mask += 1) {
        const modules = m.modules.map((row, y) => row.map((dark, x) => (m.fixed[y][x] ? dark : dark !== MASKS[mask](x, y))));
        drawFormat(modules, m.size, level, mask);
        drawVersion(modules, m.size, ver);
        const score = penalty(modules, m.size);
        if (!best || score < best.score) best = { score, modules, mask };
      }
      return { version: ver, size: m.size, modules: best.modules, ecl: level, mask: best.mask };
    }
  }
  throw new Error("That text is too long for a QR code.");
}
