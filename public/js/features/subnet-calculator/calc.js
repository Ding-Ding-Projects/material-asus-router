// IPv4 subnet maths. Pure functions: addresses are unsigned 32-bit numbers.

export const toNumber = (ip) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);
export const toIp = (n) => [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join(".");
export const isIpv4 = (text) => /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(String(text).trim());

export const maskOf = (prefix) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);
export const prefixOfMask = (mask) => {
  if (!isIpv4(mask)) return null;
  const n = toNumber(mask);
  for (let p = 0; p <= 32; p += 1) if (maskOf(p) === n) return p;
  return null; // not a contiguous mask such as 255.0.255.0
};

export const binary = (n) => [24, 16, 8, 0].map((shift) => ((n >>> shift) & 255).toString(2).padStart(8, "0")).join(".");

// The kind of address, by the standard special ranges.
export function scopeOf(n) {
  const a = n >>> 24;
  const b = (n >>> 16) & 255;
  if (a === 0) return "this-network";
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "private";
  if (a === 100 && b >= 64 && b <= 127) return "shared";
  if (a === 127) return "loopback";
  if (a === 169 && b === 254) return "link-local";
  if ((n >>> 8) === 0xc00002 || (n >>> 8) === 0xc63364 || (n >>> 8) === 0xcb0071) return "documentation";
  if (a >= 224 && a <= 239) return "multicast";
  if (a >= 240) return "reserved";
  return "public";
}

export const classOf = (n) => { const a = n >>> 24; return a < 128 ? "A" : a < 192 ? "B" : a < 224 ? "C" : a < 240 ? "D" : "E"; };

// Everything about one network. The address may be any address inside it.
export function describeNetwork(ip, prefix) {
  if (!isIpv4(ip)) throw new Error("Enter an IPv4 address such as 198.51.100.0.");
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error("The prefix is a whole number from 0 to 32.");
  const address = toNumber(ip);
  const mask = maskOf(prefix);
  const network = (address & mask) >>> 0;
  const size = 2 ** (32 - prefix);
  const broadcast = (network + size - 1) >>> 0;
  // /31 links use both addresses (RFC 3021) and /32 is a single host; every other network gives up the first and last.
  const usable = prefix >= 31 ? size : size - 2;
  const first = prefix >= 31 ? network : network + 1;
  const last = prefix >= 31 ? broadcast : broadcast - 1;
  return {
    address, network, broadcast, mask, wildcard: (~mask) >>> 0, prefix, size, usable, first, last,
    ip: toIp(address), networkIp: toIp(network), broadcastIp: toIp(broadcast), maskIp: toIp(mask), wildcardIp: toIp((~mask) >>> 0), firstIp: toIp(first), lastIp: toIp(last),
    cidr: `${toIp(network)}/${prefix}`, scope: scopeOf(network), klass: classOf(network), isNetworkAddress: address === network,
  };
}

export const contains = (net, ip) => isIpv4(ip) && ((toNumber(ip) & net.mask) >>> 0) === net.network;

// Splits a network into `parts` equal subnets (a power of two, up to the /32 limit and 256 rows).
export function split(net, parts) {
  if (!Number.isInteger(parts) || parts < 2 || (parts & (parts - 1)) !== 0 || parts > 256) throw new Error("Split into 2, 4, 8, 16, 32, 64, 128 or 256 parts.");
  const extra = Math.log2(parts);
  if (net.prefix + extra > 32) throw new Error("That network is too small to split that far.");
  const prefix = net.prefix + extra;
  const step = 2 ** (32 - prefix);
  return Array.from({ length: parts }, (_, i) => describeNetwork(toIp((net.network + i * step) >>> 0), prefix));
}

// The common sizes people pick, with what they hold.
export const COMMON = [8, 16, 20, 22, 24, 25, 26, 27, 28, 29, 30, 31, 32];

export function parseCidr(text) {
  const m = String(text).trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/);
  if (!m || !isIpv4(m[1])) return null;
  return { ip: m[1], prefix: m[2] === undefined ? null : Number(m[2]) };
}
