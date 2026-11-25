// Draws the app icon (a router with two antennas on a rounded purple tile) and writes
// desktop/assets/icon.png (256 px) and desktop/assets/icon.ico (PNG-compressed, 256 px).
//   node desktop/scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");
const N = 256;
const px = new Uint8Array(N * N * 4);

const inRound = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const shapes = [
  { c: [103, 80, 164], test: (x, y) => inRound(x, y, 8, 8, 248, 248, 56) },
  { c: [255, 255, 255], test: (x, y) => inRound(x, y, 48, 138, 208, 190, 14) },
  { c: [255, 255, 255], test: (x, y) => inRound(x, y, 70, 64, 82, 140, 6) },
  { c: [255, 255, 255], test: (x, y) => inRound(x, y, 174, 64, 186, 140, 6) },
  { c: [103, 80, 164], test: (x, y) => (x - 78) ** 2 + (y - 164) ** 2 <= 36 || (x - 106) ** 2 + (y - 164) ** 2 <= 36 },
  { c: [234, 221, 255], test: (x, y) => (x - 178) ** 2 + (y - 164) ** 2 <= 49 },
];
const SS = 3;
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const fx = x + (sx + 0.5) / SS, fy = y + (sy + 0.5) / SS;
        let hit = null;
        for (const s of shapes) if (s.test(fx, fy)) hit = s.c;
        if (hit) { r += hit[0]; g += hit[1]; b += hit[2]; a += 1; }
      }
    }
    const i = (y * N + x) * 4, n = SS * SS;
    if (a) { px[i] = Math.round(r / a); px[i + 1] = Math.round(g / a); px[i + 2] = Math.round(b / a); px[i + 3] = Math.round((a / n) * 255); }
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
};
const raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; Buffer.from(px.buffer, y * N * 4, N * 4).copy(raw, y * (N * 4 + 1) + 1); }
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);

const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 0; ico[7] = 0; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "icon.png"), png);
writeFileSync(path.join(OUT, "icon.ico"), Buffer.concat([ico, png]));
console.log(`Wrote icon.png (${png.length} bytes) and icon.ico`);
