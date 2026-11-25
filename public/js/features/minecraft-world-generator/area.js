// The chunk map: pure maths for the drawing canvas (turning pointer positions
// into whole chunks, and counting what a set of rectangles covers), shared by
// the screen and the tests. No browser-only calls.
export const VIEW = 256; // the map shows 256 chunks across, centred on the origin

// A position on the canvas (0..size) to a chunk number.
export const toChunk = (px, size) => Math.floor((px / size) * VIEW) - VIEW / 2;

// Two corner positions to a rectangle of whole chunks, both corners included.
export function rectFromDrag(a, b, size) {
  const x = [toChunk(a.x, size), toChunk(b.x, size)];
  const z = [toChunk(a.y, size), toChunk(b.y, size)];
  return { x0: Math.min(...x), x1: Math.max(...x), z0: Math.min(...z), z1: Math.max(...z) };
}

export const clampRect = (r, limit = VIEW / 2) => ({ x0: Math.max(-limit, r.x0), x1: Math.min(limit - 1, r.x1), z0: Math.max(-limit, r.z0), z1: Math.min(limit - 1, r.z1) });

// How many distinct chunks the rectangles cover, counted without building a
// huge set when the area is plainly too big.
export function coverage(rects, cap = 40000) {
  const seen = new Set();
  for (const r of rects) {
    if ((r.x1 - r.x0 + 1) * (r.z1 - r.z0 + 1) > cap * 4) return { chunks: Infinity, over: true };
    for (let x = r.x0; x <= r.x1; x += 1) for (let z = r.z0; z <= r.z1; z += 1) seen.add(`${x},${z}`);
    if (seen.size > cap) return { chunks: seen.size, over: true };
  }
  return { chunks: seen.size, over: false };
}

// The canvas size in pixels that one chunk takes.
export const pixelsPerChunk = (size) => size / VIEW;

// Default square, as a rectangle (matches the server's squareArea).
export function defaultSquare(size) {
  const lo = -Math.floor(size / 2) || 0;
  return { x0: lo, z0: lo, x1: lo + size - 1, z1: lo + size - 1 };
}
