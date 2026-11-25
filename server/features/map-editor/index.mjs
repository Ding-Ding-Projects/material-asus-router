// Network map editor: the data behind the drag-and-drop map. It lists the
// router, its AiMesh nodes (with a measured link quality) and every device with
// the node it is attached to, so the browser can draw the map. Nothing is
// written here: the browser stages renames, reservations and blocks as list
// edits, and they go through the change engine like every other edit.
import { L, isIpv4, isMac, parseRows } from "../kit.mjs";
import { freeAddresses, grade, parsePing } from "./model.mjs";

const ID = "map-editor";
const BANDS = { wired_mac: "wired", "2G": "2.4 GHz", "5G": "5 GHz", "5G1": "5 GHz", "5G2": "5 GHz", "6G": "6 GHz" };
const KIND = { wired: "wired", "2g": "2.4 GHz", "5g": "5 GHz", "6g": "6 GHz" };
const num = (v) => (v !== "" && v !== null && Number.isFinite(Number(v)) ? Number(v) : null);

const text = async (exec, command) => {
  try {
    const out = await exec(command, { timeoutMs: 8000 });
    return out.code === 0 ? out.stdout : "";
  } catch {
    return "";
  }
};

// Which node each client is attached to, from the router's own client list.
export function readClientList(raw) {
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const out = new Map();
  for (const [node, groups] of Object.entries(json ?? {})) {
    if (!isMac(node) || typeof groups !== "object" || groups === null) continue;
    for (const [group, members] of Object.entries(groups)) {
      if (!BANDS[group] || typeof members !== "object" || members === null) continue;
      for (const [mac, info] of Object.entries(members)) {
        if (!isMac(mac)) continue;
        const rssi = num(info?.rssi);
        out.set(mac.toUpperCase(), { node: node.toUpperCase(), via: BANDS[group], rssi: rssi !== null && rssi < 0 ? rssi : null });
      }
    }
  }
  return out;
}

export function readNodes(nvram) {
  const alias = new Map(parseRows(nvram.get("cfg_alias") ?? "").map((r) => [String(r[0] ?? "").toUpperCase(), r[1] ?? ""]));
  return parseRows(nvram.get("cfg_clientlist") ?? "")
    .filter((r) => isMac(r[0] ?? ""))
    .map((r) => {
      const mac = r[0].toUpperCase();
      return { mac, ip: isIpv4(r[1] ?? "") ? r[1] : "", role: r[3] === "0" ? "router" : "node", name: alias.get(mac) ?? "", backhaul: KIND[String(r[4] ?? "").toLowerCase()] ?? null };
    });
}

export default {
  id: ID,

  domainMeta: [{ id: ID, icon: "lan", label: L("Network map editor", "網絡地圖編輯器"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [ID]: async (ctx) => {
      const { nvram, exec, info } = ctx;
      const names = new Map(parseRows(nvram.get("custom_clientlist") ?? "").map((r) => [String(r[1] ?? "").toUpperCase(), r[0]]));
      const reserved = new Map(parseRows(nvram.get("dhcp_staticlist") ?? "").map((r) => [String(r[0] ?? "").toUpperCase(), r[1]]));
      const blocks = new Map();
      const macs = (nvram.get("MULTIFILTER_MAC") ?? "").split(">").filter(Boolean);
      const modes = (nvram.get("MULTIFILTER_ENABLE") ?? "").split(">");
      macs.forEach((mac, i) => blocks.set(mac.toUpperCase(), modes[i] ?? "0"));

      const leases = new Map();
      for (const line of (await text(exec, "head -n 100000 /var/lib/misc/dnsmasq.leases")).split("\n")) {
        const [, mac, ip, host] = line.trim().split(/\s+/);
        if (mac && isMac(mac) && isIpv4(ip ?? "")) leases.set(mac.toUpperCase(), { ip, host: host && host !== "*" ? host : "" });
      }
      const clientList = readClientList(await text(exec, "head -n 100000 /tmp/clientlist.json"));
      const nodes = readNodes(nvram);
      const main = nodes.find((n) => n.role === "router");
      const mainMac = main?.mac ?? String(nvram.get("lan_hwaddr") ?? "").toUpperCase();

      // With no client list from the firmware, the radios themselves say who is on Wi-Fi.
      const radio = new Map();
      if (!clientList) {
        for (const band of info.bands) {
          for (const line of (await text(exec, `wl -i ${band.ifname} assoclist`)).split("\n")) {
            const mac = line.trim().split(/\s+/)[1];
            if (!mac || !isMac(mac)) continue;
            const rssi = num((await text(exec, `wl -i ${band.ifname} rssi ${mac.toUpperCase()}`)).trim());
            radio.set(mac.toUpperCase(), { via: { "2": "2.4 GHz", "1": "5 GHz", "4": "6 GHz" }[String(band.nband)] ?? "Wi-Fi", rssi: rssi !== null && rssi < 0 ? rssi : null });
          }
        }
      }

      const devices = [...leases].map(([mac, lease]) => {
        const seen = clientList?.get(mac);
        const air = radio.get(mac);
        return {
          mac,
          ip: lease.ip,
          host: lease.host,
          name: names.get(mac) || lease.host || lease.ip,
          customName: names.get(mac) ?? "",
          node: seen?.node ?? mainMac,
          via: seen?.via ?? air?.via ?? "wired",
          rssi: seen?.rssi ?? air?.rssi ?? null,
          reserved: reserved.get(mac) ?? "",
          blocked: blocks.get(mac) === "2",
          scheduled: blocks.get(mac) === "1",
        };
      });

      // The link to every node is measured from the router: three pings, the loss and the delay.
      const links = await Promise.all(
        nodes
          .filter((n) => n.role === "node" && n.ip)
          .map(async (n) => {
            const result = parsePing(await text(exec, `ping -c 3 -W 2 ${n.ip}`));
            return [n.mac, { ...result, grade: grade(result) }];
          }),
      );
      const quality = new Map(links);
      const lan = info.lan;
      const used = [...[...leases.values()].map((l) => l.ip), ...reserved.values(), lan.ip];
      return {
        lan,
        mesh: nodes.length > 0,
        main: { mac: mainMac, ip: lan.ip, name: main?.name || info.model },
        nodes: nodes.filter((n) => n.role === "node").map((n) => ({ ...n, quality: quality.get(n.mac) ?? { grade: "unknown" } })),
        devices,
        free: freeAddresses(lan.ip, lan.mask, used, nvram.get("dhcp_start") ?? "", nvram.get("dhcp_end") ?? "", 60),
        pool: { start: nvram.get("dhcp_start") ?? "", end: nvram.get("dhcp_end") ?? "" },
      };
    },
  },

  fakeRouter: {
    handlers: [
      // The AiMesh node answers pings a little slowly, so the map has a link worth grading.
      (command) => {
        if (command !== "ping -c 3 -W 2 198.51.100.2") return undefined;
        return { stdout: "PING 198.51.100.2 (198.51.100.2): 56 data bytes\n64 bytes from 198.51.100.2: seq=0 ttl=64 time=34.200 ms\n64 bytes from 198.51.100.2: seq=1 ttl=64 time=41.700 ms\n64 bytes from 198.51.100.2: seq=2 ttl=64 time=38.000 ms\n\n--- 198.51.100.2 ping statistics ---\n3 packets transmitted, 3 packets received, 0% packet loss\n" };
      },
    ],
  },
};
