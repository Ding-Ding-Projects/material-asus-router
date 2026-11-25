// Turns /proc/net/nf_conntrack into per-device byte counters. Pure functions.
//
// A tracked connection line looks like
//   ipv4 2 tcp 6 431999 ESTABLISHED src=A dst=B sport=1 dport=2 packets=10 bytes=1200 src=B dst=A sport=2 dport=1 packets=12 bytes=9000 ...
// The first src/dst/bytes group is the original direction (device to internet for
// an outgoing connection), the second is the reply. Byte counts exist only when the
// router has connection accounting turned on.

const ipNumber = (ip) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);

export function lanTest(ip, mask) {
  const net = ipNumber(ip);
  const m = ipNumber(mask);
  return (candidate) => {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(candidate)) return false;
    return ((ipNumber(candidate) & m) >>> 0) === ((net & m) >>> 0);
  };
}

// Returns { devices: Map<ip, { up, down, flows }>, accounting } where up and down are total bytes
// of the connections currently tracked. LAN to LAN and router-local connections are left out.
export function parseConntrack(text, { lanIp, lanMask }) {
  const inLan = lanTest(lanIp, lanMask);
  const devices = new Map();
  let withBytes = 0;
  let lines = 0;
  for (const line of String(text).split("\n")) {
    if (!/^ipv4\s/.test(line)) continue;
    const src = [...line.matchAll(/\bsrc=(\S+)/g)].map((m) => m[1]);
    const dst = [...line.matchAll(/\bdst=(\S+)/g)].map((m) => m[1]);
    const bytes = [...line.matchAll(/\bbytes=(\d+)/g)].map((m) => Number(m[1]));
    if (src.length < 2 || dst.length < 2) continue;
    const [origSrc, origDst] = [src[0], dst[0]];
    const fromLan = inLan(origSrc);
    const toLan = inLan(origDst);
    if (fromLan === toLan) continue; // both inside, or neither: not internet traffic for a device
    if (origSrc === lanIp || origDst === lanIp) continue;
    lines += 1;
    if (bytes.length >= 2) withBytes += 1;
    const ip = fromLan ? origSrc : origDst;
    const row = devices.get(ip) ?? { up: 0, down: 0, flows: 0 };
    row.flows += 1;
    if (bytes.length >= 2) {
      row.up += fromLan ? bytes[0] : bytes[1];
      row.down += fromLan ? bytes[1] : bytes[0];
    }
    devices.set(ip, row);
  }
  return { devices, accounting: lines === 0 ? null : withBytes > 0, lines };
}

// The rate in bytes per second between two readings. A connection that ended makes a counter drop,
// so a negative step counts as zero rather than as negative traffic.
export function rates(previous, now, seconds) {
  const out = new Map();
  for (const [ip, row] of now) {
    const before = previous.get(ip);
    if (!before || !(seconds > 0)) {
      out.set(ip, { up: 0, down: 0 });
      continue;
    }
    out.set(ip, { up: Math.max(0, row.up - before.up) / seconds, down: Math.max(0, row.down - before.down) / seconds });
  }
  return out;
}
