// VPN Director canvas: the data behind the picture that sends devices to the
// internet directly or through a VPN tunnel (Asuswrt-Merlin only). It owns the
// one list the router keeps for this, vpndirector_rulelist, as a catalogue
// entry so a change restarts VPN routing, and describes which tunnels exist.
// The browser draws devices and tunnels and stages every edit in the
// pending-changes dock.
import { L, cleanText, formatRows, isIpv4, parseRows } from "../kit.mjs";

const ID = "vpn-director-canvas";
const UNITS = [1, 2, 3, 4, 5];
export const IFACES = ["WAN", ...UNITS.map((n) => `OVPN${n}`), ...UNITS.map((n) => `WGC${n}`)];
const MAX_RULES = 64;

// An address or a network: 198.51.100.102 or 198.51.100.0/24.
export function isTarget(text) {
  const [ip, prefix, extra] = String(text).split("/");
  if (extra !== undefined || !isIpv4(ip)) return false;
  return prefix === undefined || (/^\d{1,2}$/.test(prefix) && Number(prefix) >= 0 && Number(prefix) <= 32);
}

const directorRules = {
  // <1>name>device>destination>interface  (the destination may be empty, meaning every destination)
  validate(entry, text, fail) {
    if (text === "") return "";
    if (!text.startsWith("<")) fail("the list is not in the router's format. Use the canvas instead of typing it.");
    const rows = parseRows(text);
    if (rows.length > MAX_RULES) fail(`use at most ${MAX_RULES} rules.`);
    return formatRows(
      rows.map((cells, i) => {
        if (cells.length !== 5) fail(`rule ${i + 1} has ${cells.length} fields but needs 5.`);
        const [on, desc, local, remote, iface] = cells;
        if (!["0", "1"].includes(on)) fail(`rule ${i + 1}: the first field is 1 (on) or 0 (off).`);
        try {
          cleanText(desc, `Rule ${i + 1} name`, { max: 32 });
        } catch (error) {
          fail(error.message);
        }
        if (!isTarget(local)) fail(`rule ${i + 1}: the device must be an IPv4 address or a network such as 198.51.100.0/24.`);
        if (remote !== "" && !isTarget(remote)) fail(`rule ${i + 1}: the destination must be an IPv4 address, a network, or empty.`);
        if (!IFACES.includes(iface)) fail(`rule ${i + 1}: "${iface}" is not WAN or a VPN connection.`);
        return cells;
      }),
    );
  },
  sample(_entry, current) {
    const rows = parseRows(current);
    if (rows.length < MAX_RULES) rows.push(["1", `Sample ${rows.length + 1}`, `198.51.100.${150 + rows.length}`, "", rows.length % 2 ? "WAN" : "OVPN1"]);
    else rows.shift();
    return formatRows(rows);
  },
  invalid: () => "<1>x>not-an-address>>WAN",
};

const get = (nvram, key) => nvram.get(key) ?? "";

export function readTunnels(nvram) {
  const out = [{ id: "WAN", kind: "wan", name: L("The internet directly", "直接上網"), configured: true, followsPolicy: true }];
  for (const n of UNITS) {
    const host = get(nvram, `vpn_client${n}_addr`);
    out.push({ id: `OVPN${n}`, kind: "openvpn", name: L(get(nvram, `vpn_client${n}_desc`) || `OpenVPN ${n}`, get(nvram, `vpn_client${n}_desc`) || `OpenVPN ${n}`), configured: host !== "", followsPolicy: get(nvram, `vpn_client${n}_rgw`) === "2" });
  }
  for (const n of UNITS) out.push({ id: `WGC${n}`, kind: "wireguard", name: L(`WireGuard ${n}`, `WireGuard ${n}`), configured: get(nvram, `wgc${n}_ep_addr`) !== "", enabled: get(nvram, `wgc${n}_enable`) === "1", followsPolicy: true });
  return out;
}

export default {
  id: ID,

  catalog: () => [
    { id: `${ID}.rules`, domain: ID, group: "rules", groupLabel: L("Device routing rules", "裝置路由規則"), key: "vpndirector_rulelist", control: "director-rules", optional: true, firmware: "merlin", risk: "low", restart: "restart_vpnrouting0", maxItems: MAX_RULES,
      label: L("VPN Director rules", "VPN Director 規則"), help: L("Each rule sends one device or network to the internet directly, or through a VPN connection. The canvas edits this list.", "每條規則將一部裝置或者一個網絡直接上網，或者經 VPN 連線上網。畫布會編輯呢個清單。") },
  ],

  controls: { "director-rules": directorRules },

  domainMeta: [{ id: ID, icon: "alt_route", label: L("VPN Director canvas", "VPN Director 畫布"), group: { en: "Network", yue: "網絡" }, firmware: "merlin", live: true }],
  domains: {
    [ID]: async (ctx) => {
      const { nvram } = ctx;
      const present = nvram.has("vpndirector_rulelist") && nvram.has("vpndirector_enable");
      return {
        merlin: ctx.info.merlin,
        present,
        missing: present ? [] : ["vpndirector_rulelist", "vpndirector_enable"].filter((k) => !nvram.has(k)),
        enabled: get(nvram, "vpndirector_enable") === "1",
        enableEntryId: "vpn-pro.director",
        entries: ctx.entries(),
        tunnels: readTunnels(nvram),
        rules: parseRows(get(nvram, "vpndirector_rulelist")).map((r, index) => ({ index, enabled: r[0] === "1", desc: r[1] ?? "", local: r[2] ?? "", remote: r[3] ?? "", iface: r[4] ?? "" })),
      };
    },
  },
};
