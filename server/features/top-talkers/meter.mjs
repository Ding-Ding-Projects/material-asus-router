// Per-device byte meter for the "Who is using the most" leaderboard. It uses only the byte counters of the
// router's connection table, one counter pair per connection, so the numbers never say what anyone visited.
// Pure functions and one small class; nothing here talks to the router.

const ipNumber = (ip) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);

export function lanTest(ip, mask) {
  const net = ipNumber(ip);
  const m = ipNumber(mask);
  return (candidate) => /^\d{1,3}(\.\d{1,3}){3}$/.test(candidate) && ((ipNumber(candidate) & m) >>> 0) === ((net & m) >>> 0);
}

// One entry per tracked internet connection of a LAN device: { key, ip, up, down }. LAN to LAN traffic and the
// router's own connections are left out. `bytes` counts appear only when the router has connection accounting on.
export function parseFlows(text, { lanIp, lanMask }) {
  const inLan = lanTest(lanIp, lanMask);
  const flows = [];
  let seen = 0;
  let withBytes = 0;
  for (const line of String(text).split("\n")) {
    const head = line.match(/^ipv4\s+\d+\s+(\S+)\s+\d+/);
    if (!head) continue;
    const src = [...line.matchAll(/\bsrc=(\S+)/g)].map((m) => m[1]);
    const dst = [...line.matchAll(/\bdst=(\S+)/g)].map((m) => m[1]);
    if (src.length < 2 || dst.length < 2) continue;
    const fromLan = inLan(src[0]);
    if (fromLan === inLan(dst[0]) || src[0] === lanIp || dst[0] === lanIp) continue;
    seen += 1;
    const bytes = [...line.matchAll(/\bbytes=(\d+)/g)].map((m) => Number(m[1]));
    if (bytes.length >= 2) withBytes += 1;
    const sport = (line.match(/\bsport=(\d+)/) ?? [])[1] ?? "";
    const dport = (line.match(/\bdport=(\d+)/) ?? [])[1] ?? "";
    flows.push({
      key: `${head[1]}|${src[0]}|${sport}|${dst[0]}|${dport}`,
      ip: fromLan ? src[0] : dst[0],
      up: bytes.length >= 2 ? (fromLan ? bytes[0] : bytes[1]) : 0,
      down: bytes.length >= 2 ? (fromLan ? bytes[1] : bytes[0]) : 0,
    });
  }
  return { flows, accounting: seen === 0 ? null : withBytes > 0 };
}

const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
// The Monday that starts the week of this date.
export function weekKey(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}

export class Meter {
  constructor({ historyLength = 90 } = {}) {
    this.historyLength = historyLength;
    this.reset();
  }

  reset() {
    this.previous = null; // Map flow key -> { up, down }
    this.at = 0;
    this.since = null;
    this.devices = new Map();
    this.day = null;
    this.week = null;
  }

  // Adds a reading. Bytes are counted per connection: the growth since the last reading, or the whole
  // counter for a connection that is new. The first reading is only a baseline.
  update(flows, now = Date.now()) {
    const date = new Date(now);
    const day = dayKey(date);
    const week = weekKey(date);
    const seconds = this.previous ? (now - this.at) / 1000 : 0;
    const step = new Map();
    const mark = (ip) => {
      if (!step.has(ip)) step.set(ip, { up: 0, down: 0, flows: 0 });
      return step.get(ip);
    };
    const next = new Map();
    for (const f of flows) {
      next.set(f.key, { up: f.up, down: f.down });
      const entry = mark(f.ip);
      entry.flows += 1;
      if (!this.previous) continue;
      const before = this.previous.get(f.key) ?? { up: 0, down: 0 };
      entry.up += f.up >= before.up ? f.up - before.up : f.up;
      entry.down += f.down >= before.down ? f.down - before.down : f.down;
    }
    if (this.day !== day) for (const d of this.devices.values()) Object.assign(d, { todayUp: 0, todayDown: 0 });
    if (this.week !== week) for (const d of this.devices.values()) Object.assign(d, { weekUp: 0, weekDown: 0 });
    this.day = day;
    this.week = week;
    if (!this.previous) this.since = now;

    for (const ip of new Set([...step.keys(), ...this.devices.keys()])) {
      let d = this.devices.get(ip);
      if (!d) {
        d = { ip, up: 0, down: 0, flows: 0, todayUp: 0, todayDown: 0, weekUp: 0, weekDown: 0, history: [], lastSeen: now };
        this.devices.set(ip, d);
      }
      const s = step.get(ip) ?? { up: 0, down: 0, flows: 0 };
      d.flows = s.flows;
      if (s.flows) d.lastSeen = now;
      if (seconds > 0) {
        d.up = s.up / seconds;
        d.down = s.down / seconds;
        d.todayUp += s.up;
        d.todayDown += s.down;
        d.weekUp += s.up;
        d.weekDown += s.down;
        d.history.push({ up: d.up, down: d.down });
        while (d.history.length > this.historyLength) d.history.shift();
      }
    }
    this.previous = next;
    this.at = now;
    return { warm: seconds === 0, seconds };
  }
}
