// Parsers and small sums for the radio driver's text output (the Broadcom
// "wl" tool). Each parser reads only the lines it knows and returns null for a
// field it cannot find, so a firmware that words something differently shows
// "unavailable" instead of a wrong number.

const MAC = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i;
export const IFNAME = /^[a-z]{2,5}\d{1,2}(\.\d{1,2})?$/;

const whole = (text) => {
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

// "assoclist AA:BB:CC:DD:EE:FF" lines.
export function parseAssoc(text) {
  const out = [];
  for (const line of String(text).split("\n")) {
    const m = line.trim().match(/^assoclist\s+([0-9A-F:]{17})$/i);
    if (m && MAC.test(m[1])) out.push(m[1].toUpperCase());
  }
  return out;
}

// "wl sta_info MAC": counters, rates and times for one connected device.
export function parseStaInfo(text) {
  const s = String(text);
  const num = (re) => {
    const m = s.match(re);
    return m ? whole(m[1]) : null;
  };
  const rate = s.match(/rate of last tx pkt:\s*(\d+)\s*kbps(?:\s*-\s*(\d+)\s*kbps)?/i);
  const antenna = s.match(/per antenna average rssi of rx data frames:\s*(-?\d+)/i);
  return {
    txBytes: num(/tx total bytes:\s*(\d+)/i),
    rxBytes: num(/rx data bytes:\s*(\d+)/i),
    txPackets: num(/tx total pkts:\s*(\d+)/i),
    rxPackets: num(/rx data pkts:\s*(\d+)/i),
    failures: num(/tx failures:\s*(\d+)/i),
    connected: num(/in network\s+(\d+)\s*seconds/i),
    idle: num(/\bidle\s+(\d+)\s*seconds/i),
    rssi: num(/smoothed rssi:\s*(-?\d+)/i) ?? (antenna ? whole(antenna[1]) : null),
    txKbps: rate ? whole(rate[1]) : null,
    rxKbps: rate && rate[2] ? whole(rate[2]) : null,
    authorized: /AUTHORIZED/.test(s),
  };
}

// A counter that can only grow: a drop means the device reconnected, so the rate is unknown for that step.
export function bytesPerSecond(before, after, seconds) {
  if (before === null || after === null || !(seconds > 0)) return null;
  if (after < before) return null;
  return (after - before) / seconds;
}

// 0 to 100 from a signal level: -90 dBm is nothing, -30 dBm is as good as it gets.
export const quality = (rssi) => (rssi === null || rssi === undefined ? null : Math.max(0, Math.min(100, Math.round(((rssi + 90) / 60) * 100))));

// "wl chanim_stats": a header line, then one line of numbers. Busy time is the
// share of the air that was not free for this radio (100 minus txop).
export function parseChanim(text) {
  const lines = String(text).split("\n").map((l) => l.trim()).filter(Boolean);
  const at = lines.findIndex((l) => /^chanspec\b/i.test(l));
  if (at < 0 || !lines[at + 1]) return null;
  const names = lines[at].split(/\s+/).map((n) => n.toLowerCase());
  const values = lines[at + 1].split(/\s+/);
  const get = (name) => {
    const i = names.indexOf(name);
    return i >= 0 ? whole(values[i]) : null;
  };
  const txop = get("txop");
  const clamp = (v) => (v === null ? null : Math.max(0, Math.min(100, v)));
  return {
    busy: txop === null ? null : clamp(100 - txop),
    own: clamp(get("tx")),
    inBss: clamp(get("inbss")),
    otherNetworks: clamp(get("obss")),
    nonWifi: clamp(get("nocat")),
    noPacket: clamp(get("nopkt")),
    glitch: get("glitch"),
    noiseFloor: get("knoise"),
  };
}

// "wl noise": one number in dBm.
export function parseNumber(text) {
  const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)/);
  return m ? whole(m[1]) : null;
}

// "wl dfs_status": the state name, how long it has lasted and the last radar channel.
export function parseDfs(text) {
  const s = String(text);
  const m = s.match(/state\s+(.+?)\s+time elapsed\s+(\d+)\s*ms/i);
  if (!m) return null;
  const radar = s.match(/radar channel\s+(\d+)/i);
  const state = m[1].trim();
  return { state, elapsedMs: whole(m[2]), radarChannel: radar ? whole(radar[1]) : 0, idle: /^idle$/i.test(state), checking: /CAC/i.test(state) };
}

export const BAND = { 2: "2.4 GHz", 1: "5 GHz", 4: "6 GHz", 5: "6 GHz" };
export const bandLabel = (nband, index) => BAND[nband] ?? `Band ${index + 1}`;

// Rank devices by what the person asked for: download, upload or both together.
export function rank(rows, by = "total", count = 10) {
  const key = { down: (r) => r.downBps, up: (r) => r.upBps, total: (r) => (r.downBps ?? 0) + (r.upBps ?? 0) }[by] ?? ((r) => (r.downBps ?? 0) + (r.upBps ?? 0));
  const sorted = [...rows].filter((r) => r.downBps !== null || r.upBps !== null).sort((a, b) => (key(b) ?? 0) - (key(a) ?? 0) || a.mac.localeCompare(b.mac));
  return sorted.slice(0, count);
}

// "wl channel": the channel the radio is on right now.
export function parseChannel(text) {
  const s = String(text);
  const m = s.match(/current mac channel\s+(\d+)/i) ?? s.match(/target channel\s+(\d+)/i);
  return m ? whole(m[1]) : null;
}
