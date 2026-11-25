// LAN Pro: the home network in full. What the automatic address service tells
// devices (gateway, name servers, WINS), reserved addresses with a device
// picker, and the switch (jumbo frames, link aggregation where the model has
// it). The router's own address, mask, automatic address range and lease time
// are the stock settings; this screen draws them with a range bar and a lease
// slider and writes them through the same change engine.
import { L, ON_OFF, isIpv4, isMac, parseRows } from "../kit.mjs";
import { tableControl } from "./table.mjs";

const F = "lan-pro";
const G = {
  clients: { group: "clients", groupLabel: L("What devices are told", "裝置會收到嘅資料") },
  reserved: { group: "reserved", groupLabel: L("Reserved addresses", "留住嘅地址") },
  switch: { group: "switch", groupLabel: L("Switch", "交換器") },
};
const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${F}.${id}`, domain: F, ...group, key, control, label, help, ...extra });
const dhcp = { risk: "network", restart: "restart_dnsmasq" };

const num = (ip) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);
const text = (n) => [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join(".");
const read = (nvram, key) => nvram.get(key) ?? "";

// The router's network worked out from its address and mask, or null when either is not an address.
function plan(nvram) {
  const ip = read(nvram, "lan_ipaddr");
  const mask = read(nvram, "lan_netmask");
  if (!isIpv4(ip) || !isIpv4(mask)) return null;
  const m = num(mask) >>> 0;
  const network = (num(ip) & m) >>> 0;
  const broadcast = (network | ~m) >>> 0;
  const start = read(nvram, "dhcp_start");
  const end = read(nvram, "dhcp_end");
  return {
    ip, mask,
    prefix: m.toString(2).replace(/0/g, "").length,
    network: text(network),
    broadcast: text(broadcast),
    hosts: broadcast - network - 1,
    pool: isIpv4(start) && isIpv4(end) ? { start, end, size: Math.max(0, num(end) - num(start) + 1) } : null,
    inside: (address) => isIpv4(address) && ((num(address) & m) >>> 0) === network,
    inPool: (address) => isIpv4(start) && isIpv4(end) && isIpv4(address) && num(address) >= num(start) && num(address) <= num(end),
  };
}

const view = ({ inside, inPool, ...rest }) => rest;

// The leases dnsmasq has handed out: expiry, MAC, address, host name.
async function leases(exec) {
  const out = await exec("head -n 100000 /var/lib/misc/dnsmasq.leases");
  if (out.code !== 0) return [];
  return out.stdout.split("\n").map((line) => line.trim().split(/\s+/)).filter((p) => p.length >= 4 && isMac(p[1].toUpperCase()))
    .map((p) => ({ mac: p[1].toUpperCase(), ip: p[2], host: p[3] === "*" ? "" : p[3], expires: Number(p[0]) || 0 }));
}

const reserved = (nvram) => parseRows(read(nvram, "dhcp_staticlist")).map((r) => ({ mac: String(r[0]).toUpperCase(), ip: r[1], dns: r[2] ?? "", host: r[3] ?? "" }));

export default {
  id: F,

  catalog: () => [
    e("gateway", G.clients, "dhcp_gateway_x", "ipv4", L("Default gateway for devices", "俾裝置嘅預設網關"), L("Empty means the router itself, which is right for nearly every home.", "留空就係路由器自己，差唔多所有屋企都應該咁。"), { optional: true, ...dhcp }),
    e("dns1", G.clients, "dhcp_dns1_x", "ipv4", L("First DNS server for devices", "俾裝置嘅第一個 DNS"), L("Empty means the router answers name lookups itself.", "留空就由路由器自己回答域名查詢。"), { optional: true, ...dhcp }),
    e("dns2", G.clients, "dhcp_dns2_x", "ipv4", L("Second DNS server for devices", "俾裝置嘅第二個 DNS"), L("A backup in case the first does not answer.", "第一個唔應嘅時候用嘅後備。"), { optional: true, ...dhcp }),
    e("dns-router", G.clients, "dhcpd_dns_router", "switch", L("Also tell devices about the router", "同時話俾裝置知路由器"), L("Adds the router to the name servers above, so local names keep working.", "將路由器加入以上嘅 DNS，本地名稱就繼續搵到。"), { values: ON_OFF, ...dhcp }),
    e("wins", G.clients, "dhcp_wins_x", "ipv4", L("WINS server", "WINS 伺服器"), L("Only for very old Windows networks. Leave empty at home.", "只供舊式 Windows 網絡用。屋企留空。"), { optional: true, ...dhcp }),

    e("use-reserved", G.reserved, "dhcp_static_x", "switch", L("Use reserved addresses", "使用留住嘅地址"), L("Turn this on so the devices below always get the same address.", "開咗佢，下面嘅裝置就每次都攞到同一個地址。"), { values: ON_OFF, ...dhcp }),
    e("reservations", G.reserved, "dhcp_staticlist", "lanreservations", L("Reserved addresses", "留住嘅地址"), L("Pick a device and give it an address inside your home network. It gets that address every time it joins.", "揀一部裝置，俾佢屋企網絡入面嘅一個地址。每次連線都會攞到。"), {
      optional: true, maxItems: 128, ...dhcp,
      emptyText: L("No reserved addresses yet.", "未有留住嘅地址。"),
      columns: [
        { id: "mac", label: L("Device (MAC)", "裝置（MAC）"), kind: "mac", unique: true },
        { id: "ip", label: L("Address", "地址"), kind: "ipv4", unique: true, within: "lan" },
        { id: "dns", label: L("DNS for it", "專用 DNS"), kind: "ipv4", optional: true },
        { id: "host", label: L("Host name", "主機名稱"), kind: "hostname", optional: true },
      ],
    }),

    e("jumbo", G.switch, "jumbo_frame_enable", "switch", L("Jumbo frames", "巨型幀"), L("Allows larger packets between wired devices that all support them. Turn on only when every device on the path does.", "等支援嘅有線裝置之間用更大嘅封包。只有路徑上每部裝置都支援先好開。"), { values: ON_OFF, risk: "network", restart: "restart_net_and_phy", meta: { note: L("Only some models offer jumbo frames.", "只有部分型號提供巨型幀。") } }),
    e("lacp", G.switch, "lacp_enabled", "switch", L("Link aggregation (two LAN ports as one)", "鏈路聚合（兩個 LAN 埠當一個用）"), L("Joins two LAN ports into one faster link to a switch or NAS that supports it. Available only on models with the hardware.", "將兩個 LAN 埠合成一條更快嘅連線，連去支援嘅交換器或者 NAS。只有有硬件嘅型號先有。"), { values: ON_OFF, requires: "lacp", risk: "network", restart: "restart_net_and_phy" }),
  ],

  controls: { lanreservations: tableControl() },

  domainMeta: [{ id: F, icon: "lan", label: L("Local network Pro", "本地網絡進階"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [F]: async (ctx) => {
      const net = plan(ctx.nvram);
      return {
        lan: net ? view(net) : null,
        reservations: reserved(ctx.nvram).length,
        lacpSupported: ctx.info.capabilities.includes("lacp"),
        stock: ctx.entries("lan"),
        entries: ctx.entries(),
        inProgress: [],
      };
    },
  },

  routes(api) {
    // Devices the router knows about, with whether each one has a reserved address.
    api.get("/clients", async ({ live }) => {
      const ctx = await live();
      const held = new Map(reserved(ctx.nvram).map((r) => [r.mac, r]));
      const now = Math.floor(Date.now() / 1000);
      return { clients: (await leases(ctx.exec)).map((l) => ({ ...l, active: l.expires > now, reservedAddress: held.get(l.mac)?.ip ?? null })) };
    });

    // Reserves an address after checking it is inside the home network and not in use by another device.
    api.post("/reserve", async ({ body, live, preview, bad }) => {
      const ctx = await live();
      const net = plan(ctx.nvram);
      if (!net) throw bad("The router's own address is not set, so the home network is unknown.", 409);
      const mac = String(body.mac ?? "").trim().toUpperCase();
      const ip = String(body.ip ?? "").trim();
      if (!isMac(mac)) throw bad("Enter the device's MAC address, such as AA:BB:CC:DD:EE:FF.");
      if (!isIpv4(ip)) throw bad("Enter an IPv4 address such as 198.51.100.150.");
      if (!net.inside(ip)) throw bad(`${ip} is outside the home network ${net.network}/${net.prefix}.`);
      if (ip === net.ip || ip === net.network || ip === net.broadcast) throw bad(`${ip} cannot be given to a device.`);
      const now = Math.floor(Date.now() / 1000);
      const user = (await leases(ctx.exec)).find((l) => l.ip === ip && l.mac !== mac && l.expires > now);
      if (user) throw bad(`${ip} is in use by ${user.host || user.mac} right now. Pick another address or wait until it leaves.`, 409);
      const result = await preview({ ops: [{ op: "reserve", mac, ip, hostname: body.hostname ?? "" }], restart: [] });
      return { preview: result, inPool: net.inPool(ip), note: net.inPool(ip) ? "This address is inside the automatic range, which is fine. The router will not give it to anyone else." : "This address is outside the automatic range, which keeps it free for this device." };
    });

    api.post("/unreserve", async ({ body, preview, bad }) => {
      const mac = String(body.mac ?? "").trim().toUpperCase();
      if (!isMac(mac)) throw bad("Enter the device's MAC address, such as AA:BB:CC:DD:EE:FF.");
      return { preview: await preview({ ops: [{ op: "unreserve", mac }] }) };
    });
  },

  fakeRouter: {
    nvram: {
      dhcp_gateway_x: "", dhcp_dns1_x: "", dhcp_dns2_x: "", dhcpd_dns_router: "1", dhcp_wins_x: "", dhcp_static_x: "1",
      jumbo_frame_enable: "0", lacp_enabled: "0",
    },
  },
};
