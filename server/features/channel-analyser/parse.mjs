// Reads `wl scanresults` and scores channels. Pure functions, no router access.

// The Broadcom driver prints one block per access point it heard:
//   SSID: "Name"
//   Mode: Managed  RSSI: -55 dBm  SNR: 40 dB  noise: -95 dBm  Channel: 6
//   BSSID: 00:11:22:33:44:55  Capability: ESS RSN
export function parseScan(text) {
  const networks = [];
  let current = null;
  for (const line of String(text).split("\n")) {
    const ssid = line.match(/^SSID:\s*"(.*)"\s*$/);
    if (ssid) {
      current = { ssid: ssid[1], bssid: "", rssi: null, channel: null, width: 20, secured: false };
      networks.push(current);
      continue;
    }
    if (!current) continue;
    const rssi = line.match(/RSSI:\s*(-?\d+)/);
    if (rssi) current.rssi = Number(rssi[1]);
    const channel = line.match(/Channel:\s*(\d+)(?:\/(\d+))?/);
    if (channel) {
      current.channel = Number(channel[1]);
      if (channel[2]) current.width = Number(channel[2]);
    }
    const bssid = line.match(/BSSID:\s*([0-9A-Fa-f:]{17})/);
    if (bssid) current.bssid = bssid[1].toUpperCase();
    if (/Capability:.*(RSN|WPA|Privacy)/.test(line)) current.secured = true;
  }
  return networks.filter((n) => n.channel !== null && n.rssi !== null);
}

export const bandOf = (nband) => (String(nband) === "2" ? "2.4" : String(nband) === "4" ? "6" : "5");

// 2.4 GHz channels are 5 MHz apart but 20 MHz wide, so neighbours up to four channels away interfere.
// On 5 GHz and 6 GHz only the same primary channel counts.
export function overlap(band, a, b) {
  if (band === "2.4") return Math.max(0, 1 - Math.abs(a - b) / 5);
  return a === b ? 1 : 0;
}

// Total interference on a channel, in milliwatts of what the neighbours put into it.
export function interference(band, channel, networks) {
  return networks.reduce((sum, n) => sum + overlap(band, channel, n.channel) * 10 ** (n.rssi / 10), 0);
}

// One row per channel with at least one network, plus every channel the router could pick.
export function summarise(band, networks, candidates = []) {
  const channels = new Set([...networks.map((n) => n.channel), ...candidates]);
  return [...channels].sort((a, b) => a - b).map((channel) => {
    const here = networks.filter((n) => n.channel === channel);
    return {
      channel,
      count: here.length,
      strongest: here.length ? Math.max(...here.map((n) => n.rssi)) : null,
      interference: interference(band, channel, networks),
      networks: here.map((n) => n.ssid || "(hidden)"),
    };
  });
}

// Picks the quietest channel the router's settings actually offer.
export function recommend(band, networks, candidates, current) {
  if (!candidates.length) return null;
  const scored = candidates.map((channel) => ({ channel, score: interference(band, channel, networks) })).sort((a, b) => a.score - b.score || a.channel - b.channel);
  const best = scored[0];
  const now = current && Number.isFinite(current) ? interference(band, current, networks) : null;
  const better = now === null || best.score < now * 0.8;
  return {
    channel: best.channel,
    current: current ?? null,
    keep: !better || best.channel === current,
    improvement: now && now > 0 ? Math.min(99, Math.round((1 - best.score / now) * 100)) : null,
    note: now === null ? "The router picks the channel automatically, so there is no current channel to compare with." : null,
  };
}
