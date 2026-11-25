// Rule canvas: the data behind the picture of port forwarding and firewall
// rules. The internet is on the left, the router (and what it listens on
// itself) in the middle and the devices on the right. The browser draws the
// lanes and stages every edit as a list edit or a catalogue change in the
// pending-changes dock, so previews, the safety net and undo all apply.
import { L, isIpv4, isMac, parseRows } from "../kit.mjs";

const ID = "rule-canvas";
const has = (nvram, key) => nvram.has(key);
const get = (nvram, key) => nvram.get(key) ?? "";

async function devices(ctx) {
  const names = new Map(parseRows(get(ctx.nvram, "custom_clientlist")).map((r) => [String(r[1] ?? "").toUpperCase(), r[0]]));
  const out = [];
  try {
    const result = await ctx.exec("head -n 100000 /var/lib/misc/dnsmasq.leases", { timeoutMs: 8000 });
    for (const line of result.code === 0 ? result.stdout.split("\n") : []) {
      const [, mac, ip, host] = line.trim().split(/\s+/);
      if (mac && isMac(mac) && isIpv4(ip ?? "")) out.push({ mac: mac.toUpperCase(), ip, name: names.get(mac.toUpperCase()) || (host && host !== "*" ? host : ip) });
    }
  } catch {
    /* A router that cannot list leases still shows its rules. */
  }
  return out;
}

// What the router itself listens on. `wan` says whether the internet can reach it, which is what
// makes a forwarding rule on the same port a conflict.
export function readServices(nvram) {
  const list = [];
  const add = (id, name, port, proto, wan, keys) => {
    if (!keys.every((k) => has(nvram, k)) || !/^\d{1,5}$/.test(String(port))) return;
    list.push({ id, name, port: Number(port), proto, wan });
  };
  add("web-lan", L("Router web page", "路由器網頁"), get(nvram, "http_lanport"), "TCP", false, ["http_lanport"]);
  if (has(nvram, "misc_http_x") && get(nvram, "misc_http_x") === "1") {
    add("web-wan", L("Router web page from the internet", "由互聯網入路由器網頁"), get(nvram, "misc_httpsport_x") || get(nvram, "misc_httpport_x"), "TCP", true, ["misc_http_x"]);
  }
  if (get(nvram, "sshd_enable") !== "0") add("ssh", L("Router SSH", "路由器 SSH"), get(nvram, "sshd_port"), "TCP", get(nvram, "sshd_enable") === "1", ["sshd_port", "sshd_enable"]);
  if (get(nvram, "VPNServer_enable") === "1") add("openvpn", L("OpenVPN server", "OpenVPN 伺服器"), get(nvram, "vpn_server1_port"), get(nvram, "vpn_server1_proto").toUpperCase() === "TCP" ? "TCP" : "UDP", true, ["vpn_server1_port"]);
  if (get(nvram, "wgs_enable") === "1") add("wireguard", L("WireGuard server", "WireGuard 伺服器"), get(nvram, "wgs_port"), "UDP", true, ["wgs_port"]);
  return list;
}

export default {
  id: ID,

  domainMeta: [{ id: ID, icon: "swap_horiz", label: L("Rule canvas", "規則畫布"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [ID]: async (ctx) => {
      const { nvram } = ctx;
      return {
        lan: ctx.info.lan,
        forwarding: {
          enabled: get(nvram, "vts_enable_x") === "1",
          entryId: "fw.forwarding",
          rules: parseRows(get(nvram, "vts_rulelist")).map((row, index) => ({ index, name: row[0] ?? "", extPort: row[1] ?? "", ip: row[2] ?? "", intPort: row[3] ?? "", proto: row[4] ?? "TCP", srcIp: row[5] ?? "" })),
        },
        services: readServices(nvram),
        firewall: {
          present: has(nvram, "filter_lwlist") && has(nvram, "fw_lw_enable_x"),
          enabled: get(nvram, "fw_lw_enable_x") === "1",
          defaultAction: get(nvram, "filter_lw_default_x") || "DROP",
          rules: parseRows(get(nvram, "filter_lwlist")).map((row, index) => ({ index, srcIp: row[0] ?? "", srcPort: row[1] ?? "", dstIp: row[2] ?? "", dstPort: row[3] ?? "", proto: row[4] ?? "TCP" })),
        },
        devices: await devices(ctx),
      };
    },
  },
};
