// Pure helpers for the DHCP address-space map: every address of the network as
// a cell that is the router, reserved, leased, free or not usable.

const toNumber = (ip) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0) >>> 0;
const toIp = (n) => [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join(".");
export const MAX_CELLS = 1024;

// The block of addresses the map draws: the whole network, or the /24 holding the router
// when the network is bigger than MAX_CELLS.
export function blockOf(lanIp, mask) {
  const m = toNumber(mask);
  const size = (~m >>> 0) + 1;
  const net = (toNumber(lanIp) & m) >>> 0;
  if (size <= MAX_CELLS) return { net, size, whole: true };
  return { net: (toNumber(lanIp) & 0xffffff00) >>> 0, size: 256, whole: false, networkSize: size };
}

// leases: [{ ip, mac, name, ends }], reservations: [{ ip, mac, name }].
export function buildCells({ lanIp, mask, leases, reservations, poolStart, poolEnd }) {
  const block = blockOf(lanIp, mask);
  const lo = poolStart ? toNumber(poolStart) : 1;
  const hi = poolEnd ? toNumber(poolEnd) : 0;
  const reservedBy = new Map(reservations.map((r) => [r.ip, r]));
  const leasedBy = new Map(leases.map((l) => [l.ip, l]));
  const cells = [];
  for (let i = 0; i < block.size; i += 1) {
    const n = (block.net + i) >>> 0;
    const ip = toIp(n);
    const cell = { ip, n: i, inPool: n >= lo && n <= hi, kind: "free" };
    const hostBits = block.whole ? block.size : 256;
    if (i === 0 || i === hostBits - 1) cell.kind = "edge";
    else if (ip === lanIp) cell.kind = "router";
    else if (reservedBy.has(ip)) Object.assign(cell, { kind: "reserved", mac: reservedBy.get(ip).mac, name: reservedBy.get(ip).name, leased: leasedBy.has(ip) });
    else if (leasedBy.has(ip)) Object.assign(cell, { kind: "leased", mac: leasedBy.get(ip).mac, name: leasedBy.get(ip).name, ends: leasedBy.get(ip).ends });
    cells.push(cell);
  }
  return { block: { whole: block.whole, size: block.size, networkSize: block.networkSize ?? block.size, first: toIp(block.net) }, cells };
}

export function summarise(cells) {
  const count = (kind) => cells.filter((c) => c.kind === kind).length;
  const pool = cells.filter((c) => c.inPool && c.kind !== "edge" && c.kind !== "router");
  return {
    router: count("router"),
    reserved: count("reserved"),
    leased: count("leased"),
    free: count("free"),
    pool: pool.length,
    poolFree: pool.filter((c) => c.kind === "free").length,
  };
}
