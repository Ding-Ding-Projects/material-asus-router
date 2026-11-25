// Reads /proc/net/nf_conntrack one connection at a time and keeps a running
// count per device. Pure functions: nothing here talks to the router.
//
// A tracked connection line looks like
//   ipv4 2 tcp 6 431999 ESTABLISHED src=A dst=B sport=1 dport=2 packets=10 bytes=1200 src=B dst=A sport=2 dport=1 packets=12 bytes=9000 ...
// The first src/dst/bytes group is the original direction, the second the reply. Byte counts exist only
// while the router has connection accounting turned on.

const ipNumber = (ip) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);

export function lanTest(ip, mask) {
  const net = ipNumber(ip);
  const m = ipNumber(mask);
  return (candidate) => /^\d{1,3}(\.\d{1,3}){3}$/.test(candidate) && ((ipNumber(candidate) & m) >>> 0) === ((net & m) >>> 0);
}

// Every connection between a device and the internet: { key, ip, up, down } with byte totals so far.
export function parseFlows(text, { lanIp, lanMask }) {
  const inLan = lanTest(lanIp, lanMask);
  const flows = [];
  let counted = 0;
  let lines = 0;
  for (const line of String(text).split("\n")) {
    if (!/^ipv4\s/.test(line)) continue;
    const src = [...line.matchAll(/\bsrc=(\S+)/g)].map((m) => m[1]);
    const dst = [...line.matchAll(/\bdst=(\S+)/g)].map((m) => m[1]);
    if (src.length < 2 || dst.length < 2) continue;
    const fromLan = inLan(src[0]);
    if (fromLan === inLan(dst[0])) continue; // both inside, or neither: not internet traffic for a device
    if (src[0] === lanIp || dst[0] === lanIp) continue; // the router's own traffic
    lines += 1;
    const bytes = [...line.matchAll(/\bbytes=(\d+)/g)].map((m) => Number(m[1]));
    const proto = line.trim().split(/\s+/)[2] ?? "";
    const sport = line.match(/\bsport=(\d+)/)?.[1] ?? "";
    const dport = line.match(/\bdport=(\d+)/)?.[1] ?? "";
    const row = { key: `${proto}|${src[0]}|${sport}|${dst[0]}|${dport}`, ip: fromLan ? src[0] : dst[0], up: 0, down: 0, flows: 1, counted: bytes.length >= 2 };
    if (row.counted) {
      counted += 1;
      row.up = fromLan ? bytes[0] : bytes[1];
      row.down = fromLan ? bytes[1] : bytes[0];
    }
    flows.push(row);
  }
  return { flows, accounting: lines === 0 ? null : counted > 0 };
}

// Adds what each connection moved since the last reading to the running totals. A connection seen for the
// first time counts in full, unless this is the very first reading, which is only the starting point. A
// counter that went backwards (a reused connection) counts as new traffic from zero.
export function advance(state, flows, now) {
  const seconds = state.at === null ? 0 : (now - state.at) / 1000;
  const next = new Map();
  const step = new Map(); // ip -> { up, down, flows } moved in this step
  for (const f of flows) {
    const before = state.flows.get(f.key);
    let up = 0;
    let down = 0;
    if (seconds > 0) {
      if (before) {
        up = f.up >= before.up ? f.up - before.up : f.up;
        down = f.down >= before.down ? f.down - before.down : f.down;
      } else {
        up = f.up;
        down = f.down;
      }
    }
    next.set(f.key, { up: f.up, down: f.down });
    const row = step.get(f.ip) ?? { up: 0, down: 0, flows: 0 };
    row.up += up;
    row.down += down;
    row.flows += 1;
    step.set(f.ip, row);
  }
  const devices = new Map(state.devices);
  for (const [ip, row] of devices) devices.set(ip, { ...row, rateUp: 0, rateDown: 0, flows: 0 });
  for (const [ip, moved] of step) {
    const row = devices.get(ip) ?? { totalUp: 0, totalDown: 0, rateUp: 0, rateDown: 0, peakUp: 0, peakDown: 0, flows: 0 };
    const rateUp = seconds > 0 ? moved.up / seconds : 0;
    const rateDown = seconds > 0 ? moved.down / seconds : 0;
    devices.set(ip, { totalUp: row.totalUp + moved.up, totalDown: row.totalDown + moved.down, rateUp, rateDown, peakUp: Math.max(row.peakUp, rateUp), peakDown: Math.max(row.peakDown, rateDown), flows: moved.flows });
  }
  return { at: now, flows: next, devices, since: state.since, readings: state.readings + 1 };
}
