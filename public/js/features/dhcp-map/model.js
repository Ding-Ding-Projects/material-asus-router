// Pure helpers for the DHCP address map screen. A cell is
// { ip, n, kind: "free" | "leased" | "reserved" | "router" | "edge", inPool, mac?, name? }.

export const ipNumber = (ip) => String(ip).split(".").reduce((n, part) => n * 256 + Number(part), 0) >>> 0;
export const numberIp = (n) => [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join(".");

// Which cells are in the pool for a first and last address.
export function applyPool(cells, start, end) {
  const lo = ipNumber(start);
  const hi = ipNumber(end);
  return cells.map((c) => ({ ...c, inPool: ipNumber(c.ip) >= lo && ipNumber(c.ip) <= hi }));
}

// A pool edge moved to `ip`: the other edge follows when they would cross. Addresses the network cannot
// hand out (its first and last, and anything outside the map) are refused with null.
export function movePool(cells, pool, edge, ip) {
  const target = cells.find((c) => c.ip === ip);
  if (!target || target.kind === "edge") return null;
  const next = { start: pool.start, end: pool.end };
  next[edge] = ip;
  if (ipNumber(next.start) > ipNumber(next.end)) next[edge === "start" ? "end" : "start"] = ip;
  return next;
}

// One step along the usable cells from `ip`, by `steps` (negative for earlier); null at the ends.
export function stepIp(cells, ip, steps) {
  const usable = cells.filter((c) => c.kind !== "edge");
  const at = usable.findIndex((c) => c.ip === ip);
  if (at === -1) return null;
  const to = at + steps;
  return to < 0 || to >= usable.length ? null : usable[to].ip;
}

// Keep an address for a device: it moves onto a free cell and its old cell becomes free.
export function reserveAt(cells, mac, ip, name) {
  const target = cells.find((c) => c.ip === ip);
  if (!target || target.kind !== "free") return cells;
  return cells.map((c) => {
    if (c.ip === ip) return { ...c, kind: "reserved", mac, name, leased: false, pending: true };
    if (c.mac === mac) return { ip: c.ip, n: c.n, inPool: c.inPool, kind: "free" };
    return c;
  });
}

// Give up a reservation: the address is free (a device holding a lease there keeps it until it renews).
export function releaseAt(cells, ip) {
  return cells.map((c) => (c.ip === ip && c.kind === "reserved" ? (c.leased ? { ...c, kind: "leased", pending: true } : { ip: c.ip, n: c.n, inPool: c.inPool, kind: "free" }) : c));
}

// Things worth a sentence: a pool with fewer addresses than devices, a pool that includes the router.
export function warnings(cells, pool) {
  const out = [];
  const lo = ipNumber(pool.start);
  const hi = ipNumber(pool.end);
  const size = hi >= lo ? hi - lo + 1 : 0;
  const leased = cells.filter((c) => c.kind === "leased").length;
  if (size === 0) out.push("empty-pool");
  else if (size < leased) out.push("small-pool");
  if (cells.some((c) => c.kind === "router" && ipNumber(c.ip) >= lo && ipNumber(c.ip) <= hi)) out.push("router-in-pool");
  return out;
}

// "3 h 20 min left", from the epoch seconds a lease ends and the current time.
export function leaseLeft(ends, now) {
  if (!ends) return null;
  const s = Math.max(0, ends - now);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return { hours: h, minutes: m };
}

export const rowsOf = (cells, columns) => Array.from({ length: Math.ceil(cells.length / columns) }, (_, r) => cells.slice(r * columns, r * columns + columns));
