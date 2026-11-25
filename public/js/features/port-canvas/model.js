// Pure helpers for the ports and VLAN canvas. The router stores the IPTV box
// port as one number: 0 none, 1 to 4 one LAN port, 5 LAN 1 and 2, 6 LAN 3 and 4.

export const LAN_PORTS = [1, 2, 3, 4];

export function portsFor(value) {
  const v = String(value);
  if (v === "5") return [1, 2];
  if (v === "6") return [3, 4];
  return /^[1-4]$/.test(v) ? [Number(v)] : [];
}

// The setting value for a set of ports, or null when the router has no such choice.
export function valueFor(ports) {
  const set = [...new Set(ports)].sort();
  if (!set.length) return "0";
  if (set.length === 1 && LAN_PORTS.includes(set[0])) return String(set[0]);
  if (set.join() === "1,2") return "5";
  if (set.join() === "3,4") return "6";
  return null;
}

// The ports that may be added next to `port` to make a pair the router supports.
export const partnerOf = (port) => ({ 1: 2, 2: 1, 3: 4, 4: 3 })[port] ?? null;

// Drop the IPTV role on a port: a single port, unless that port is already part of the current pair.
export function assignIptv(current, port) {
  const now = portsFor(current);
  return now.includes(port) && now.length === 2 ? valueFor(now) : valueFor([port]);
}

// Toggle the partner of the IPTV port, to go between one port and a supported pair.
export function togglePair(current, port) {
  const now = portsFor(current);
  const partner = partnerOf(port);
  if (!now.includes(port) || partner === null) return valueFor(now);
  return valueFor(now.includes(partner) ? [port] : [port, partner]);
}

export const roleOf = (port, stbValue) => (portsFor(stbValue).includes(port) ? "iptv" : "lan");

// What a provider profile fills in, from the Internet screen's profile table: "Internet 500, IPTV 600".
export function profileIds(profiles, profile) {
  const row = profiles?.[profile];
  return row ? Object.entries(row).map(([name, id]) => ({ name, id })) : [];
}

// A VLAN id is 0 (untagged) or 2 to 4094.
export const validVlan = (text) => /^\d{1,4}$/.test(String(text)) && (Number(text) === 0 || (Number(text) >= 2 && Number(text) <= 4094));
