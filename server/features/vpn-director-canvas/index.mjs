// VPN Director canvas: the data behind the picture that sends devices to the
// internet directly or through a VPN tunnel (Asuswrt-Merlin only). It owns the
// one list the router keeps for this, vpndirector_rulelist, as a catalogue
// entry so a change restarts VPN routing, and describes which tunnels exist.
// The browser draws devices and tunnels and stages every edit in the
// pending-changes dock.
import { L, isIpv4, parseRows } from "../kit.mjs";

const ID = "vpn-director-canvas";
const UNITS = [1, 2, 3, 4, 5];
export const IFACES = ["WAN", ...UNITS.map((n) => `OVPN${n}`), ...UNITS.map((n) => `WGC${n}`)];
const MAX_RULES = 64;
// The list is drawn and checked by the shared rule-table control (provided by the firewall feature).
const OCTET = String.raw`(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)`;
const TARGET = `^${OCTET}(\\.${OCTET}){3}(/([0-9]|[12]\\d|3[0-2]))?$`;
const COLUMNS = [
  { id: "on", cell: "switch", label: L("On", "開") },
  { id: "desc", cell: "text", label: L("Name", "名稱"), max: 32, example: "Rule {n}" },
  { id: "local", cell: "text", label: L("Device or network", "裝置或者網絡"), max: 18, pattern: TARGET, patternHint: "enter an IPv4 address such as 198.51.100.102 or a network such as 198.51.100.0/24.", example: "198.51.100.{n}" },
  { id: "remote", cell: "text", label: L("Only when going to", "只當去緊"), optional: true, max: 18, pattern: TARGET, patternHint: "enter an IPv4 address, a network such as 203.0.113.0/24, or leave it empty.", example: "" },
  { id: "iface", cell: "select", label: L("Way out", "出路"), options: IFACES.map((v) => [v, L(v, v)]) },
];

// An address or a network: 198.51.100.102 or 198.51.100.0/24.
export function isTarget(text) {
  const [ip, prefix, extra] = String(text).split("/");
  if (extra !== undefined || !isIpv4(ip)) return false;
  return prefix === undefined || (/^\d{1,2}$/.test(prefix) && Number(prefix) >= 0 && Number(prefix) <= 32);
}

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
    { id: `${ID}.rules`, domain: ID, group: "rules", groupLabel: L("Device routing rules", "裝置路由規則"), key: "vpndirector_rulelist", control: "rule-table", optional: true, firmware: "merlin", risk: "low", restart: "restart_vpnrouting0", maxItems: MAX_RULES, columns: COLUMNS,
      label: L("VPN Director rules", "VPN Director 規則"), help: L("Each rule sends one device or network to the internet directly, or through a VPN connection. The canvas edits this list.", "每條規則將一部裝置或者一個網絡直接上網，或者經 VPN 連線上網。畫布會編輯呢個清單。") },
  ],

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
