// DHCP address-space map: every address of the home network as a cell (router,
// reserved, leased or free) and the pool the router hands addresses out from.
// The browser draws the grid and stages every edit (the pool's first and last
// address, keeping an address for a device) in the pending-changes dock.
import { L, isIpv4, isMac, parseRows } from "../kit.mjs";
import { buildCells, summarise } from "./model.mjs";

const ID = "dhcp-map";
const get = (nvram, key) => nvram.get(key) ?? "";

export default {
  id: ID,

  domainMeta: [{ id: ID, icon: "grid_view", label: L("DHCP address map", "DHCP 地址地圖"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [ID]: async (ctx) => {
      const { nvram, exec, info } = ctx;
      const names = new Map(parseRows(get(nvram, "custom_clientlist")).map((r) => [String(r[1] ?? "").toUpperCase(), r[0]]));
      const leases = [];
      try {
        const out = await exec("head -n 100000 /var/lib/misc/dnsmasq.leases", { timeoutMs: 8000 });
        for (const line of out.code === 0 ? out.stdout.split("\n") : []) {
          const [ends, mac, ip, host] = line.trim().split(/\s+/);
          if (mac && isMac(mac) && isIpv4(ip ?? "")) leases.push({ ip, mac: mac.toUpperCase(), name: names.get(mac.toUpperCase()) || (host && host !== "*" ? host : ""), ends: Number(ends) || null });
        }
      } catch {
        /* Without the lease file the map still shows reservations. */
      }
      const reservations = parseRows(get(nvram, "dhcp_staticlist"))
        .filter((r) => isMac(r[0] ?? "") && isIpv4(r[1] ?? ""))
        .map((r) => ({ mac: r[0].toUpperCase(), ip: r[1], name: r[3] || names.get(r[0].toUpperCase()) || "" }));
      const poolStart = get(nvram, "dhcp_start");
      const poolEnd = get(nvram, "dhcp_end");
      const { block, cells } = buildCells({ lanIp: info.lan.ip, mask: info.lan.mask, leases, reservations, poolStart, poolEnd });
      return {
        lan: info.lan,
        block,
        cells,
        summary: summarise(cells),
        pool: { start: poolStart, end: poolEnd, enabled: get(nvram, "dhcp_enable_x") === "1", leaseSeconds: Number(get(nvram, "dhcp_lease")) || 0, startEntryId: "dhcp.start", endEntryId: "dhcp.end" },
        now: Math.floor(Date.now() / 1000),
        entries: ctx.entries("lan"),
      };
    },
  },
};
