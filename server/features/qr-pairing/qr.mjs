// A small QR Code encoder (byte mode, error correction L or M, versions 1 to
// 20), written for this app so a pairing code is drawn without any online
// service. encodeQr(text) returns { size, rows } where rows is a list of
// strings of "0" (light) and "1" (dark), without the quiet zone.
const ECC_LEN = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26],
};
const BLOCKS = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16],
};
const FORMAT_BITS = { L: 1, M: 0 };

const rawModules = (ver) => {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
};
const dataCodewords = (ver, level) => Math.floor(rawModules(ver) / 8) - ECC_LEN[level][ver - 1] * BLOCKS[level][ver - 1];

const gfMul = (x, y) => {
  let z = 0;
  for (let i = 7; i >= 0; i--) z = (z << 1) ^ ((z >>> 7) * 0x11d) ^ (((y >>> i) & 1) * x);
  return z & 0xff;
};
const rsDivisor = (degree) => {
  const coef = new Array(degree).fill(0);
  coef[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      coef[j] = gfMul(coef[j], root);
      if (j + 1 < degree) coef[j] ^= coef[j + 1];
    }
    root = gfMul(root, 2);
  }
  return coef;
};
const rsRemainder = (data, divisor) => {
  const out = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ out.shift();
    out.push(0);
    divisor.forEach((c, i) => (out[i] ^= gfMul(c, factor)));
  }
  return out;
};

function interleave(data, ver, level) {
  const blocks = BLOCKS[level][ver - 1];
  const eccLen = ECC_LEN[level][ver - 1];
  const raw = Math.floor(rawModules(ver) / 8);
  const short = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const divisor = rsDivisor(eccLen);
  const list = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < short ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < short) dat.push(0);
    list.push(dat.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < list[0].length; i++) list.forEach((block, j) => (i !== shortLen - eccLen || j >= short) && out.push(block[i]));
  return out;
}

function makeData(bytes, ver, level) {
  const bits = [];
  const put = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(4, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const capacity = dataCodewords(ver, level) * 8;
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; out.length < capacity; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

class Grid {
  constructor(ver) {
    this.ver = ver;
    this.size = ver * 4 + 17;
    this.m = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.f = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }
  set(x, y, dark) {
    this.m[y][x] = dark;
    this.f[y][x] = true;
  }
  finder(cx, cy) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) this.set(x, y, dist !== 2 && dist !== 4);
      }
  }
  alignment(cx, cy) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  positions() {
    if (this.ver === 1) return [];
    const n = Math.floor(this.ver / 7) + 2;
    const step = this.ver === 32 ? 26 : Math.ceil((this.ver * 4 + 4) / (n * 2 - 2)) * 2;
    const out = [6];
    for (let p = this.size - 7; out.length < n; p -= step) out.splice(1, 0, p);
    return out;
  }
  patterns() {
    for (let i = 0; i < this.size; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    this.finder(3, 3);
    this.finder(this.size - 4, 3);
    this.finder(3, this.size - 4);
    const pos = this.positions();
    pos.forEach((a, i) =>
      pos.forEach((b, j) => {
        if (!((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0))) this.alignment(a, b);
      }),
    );
    this.format("L", 0);
    if (this.ver >= 7) {
      let rem = this.ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (this.ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = ((bits >>> i) & 1) === 1;
        const a = this.size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        this.set(a, b, bit);
        this.set(b, a, bit);
      }
    }
  }
  format(level, mask) {
    const data = (FORMAT_BITS[level] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(i));
    this.set(8, 7, bit(6));
    this.set(8, 8, bit(7));
    this.set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.set(this.size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.set(8, this.size - 15 + i, bit(i));
    this.set(8, this.size - 8, true);
  }
  codewords(data) {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert++)
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const y = ((right + 1) & 2) === 0 ? this.size - 1 - vert : vert;
          if (!this.f[y][x] && i < data.length * 8) {
            this.m[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
            i++;
          }
        }
    }
  }
  mask(k) {
    const rules = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) if (!this.f[y][x] && rules[k](x, y)) this.m[y][x] = !this.m[y][x];
  }
  penalty() {
    const n = this.size;
    let score = 0;
    const lines = [];
    for (let i = 0; i < n; i++) {
      lines.push(this.m[i].map(Number).join(""));
      lines.push(this.m.map((row) => Number(row[i])).join(""));
    }
    for (const line of lines) {
      for (const run of line.match(/0+|1+/g)) if (run.length >= 5) score += 3 + run.length - 5;
      score += (line.match(/(?=0000101110100|0010111010000)/g) ?? []).length * 40;
    }
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (this.m[y][x] === this.m[y][x + 1] && this.m[y][x] === this.m[y + 1][x] && this.m[y][x] === this.m[y + 1][x + 1]) score += 3;
    const dark = this.m.flat().filter(Boolean).length;
    score += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
    return score;
  }
}

export function encodeQr(text, preferred = "M") {
  const bytes = [...Buffer.from(String(text), "utf8")];
  if (!bytes.length) throw new Error("There is nothing to put in the code.");
  for (const level of preferred === "M" ? ["M", "L"] : ["L"])
    for (let ver = 1; ver <= 20; ver++) {
      const room = dataCodewords(ver, level) * 8 - 4 - (ver < 10 ? 8 : 16);
      if (bytes.length * 8 > room) continue;
      const grid = new Grid(ver);
      grid.patterns();
      grid.codewords(interleave(makeData(bytes, ver, level), ver, level));
      let best = 0;
      let bestScore = Infinity;
      for (let k = 0; k < 8; k++) {
        grid.mask(k);
        grid.format(level, k);
        const score = grid.penalty();
        if (score < bestScore) [best, bestScore] = [k, score];
        grid.mask(k);
      }
      grid.mask(best);
      grid.format(level, best);
      return { size: grid.size, version: ver, level, mask: best, rows: grid.m.map((row) => row.map((d) => (d ? "1" : "0")).join("")) };
    }
  throw new Error("That text is too long for a pairing code (the limit is about 300 characters).");
}
