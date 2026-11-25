// Pure helpers for the network map editor.

const toNumber = (ip) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0) >>> 0;
const toIp = (n) => [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join(".");

// Reads "N packets transmitted, M packets received, X% packet loss" and the time= values.
export function parsePing(output) {
  const loss = Number((String(output).match(/(\d+(?:\.\d+)?)% packet loss/) ?? [])[1]);
  const times = [...String(output).matchAll(/time[=<]([\d.]+) ms/g)].map((m) => Number(m[1]));
  if (!Number.isFinite(loss)) return { loss: null, ms: null };
  return { loss, ms: times.length ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10 : null };
}

// great, ok, weak or unknown. Loss counts more than delay: a link that drops
// packets feels worse than a slow one.
export function grade({ loss, ms }) {
  if (loss === null || loss === undefined) return "unknown";
  if (loss >= 34 || (ms !== null && ms > 120)) return "weak";
  if (loss >= 5 || (ms !== null && ms > 50)) return "ok";
  return "great";
}

// Up to `limit` addresses on the router's network that nothing uses yet, those
// inside the automatic pool first. Networks bigger than a /20 are not listed.
export function freeAddresses(lanIp, mask, used, poolStart, poolEnd, limit) {
  if (!lanIp || !mask) return [];
  const m = toNumber(mask);
  const net = (toNumber(lanIp) & m) >>> 0;
  const size = (~m >>> 0) + 1;
  if (size > 4096 || size < 4) return [];
  const taken = new Set(used.filter(Boolean));
  const lo = poolStart ? toNumber(poolStart) : 0;
  const hi = poolEnd ? toNumber(poolEnd) : 0;
  const inPool = [];
  const outside = [];
  for (let i = 1; i < size - 1; i += 1) {
    const n = (net + i) >>> 0;
    const ip = toIp(n);
    if (taken.has(ip)) continue;
    (n >= lo && n <= hi ? inPool : outside).push(ip);
    if (inPool.length >= limit) break;
  }
  return [...inPool, ...outside].slice(0, limit);
}
