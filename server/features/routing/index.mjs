// Routing and NAT: static routes, the NAT passthrough switches, UPnP and
// NAT-PMP, port triggering and the DMZ host. Every setting is the router's own
// value and is written through the change engine, so each edit has a preview,
// the safety net and undo.
import { L, ON_OFF, isIpv4, parseRows } from "../kit.mjs";
import { tableControl } from "./table.mjs";

const F = "routing";
const G = {
  routes: { group: "routes", groupLabel: L("Static routes", "靜態路由") },
  nat: { group: "nat", groupLabel: L("NAT passthrough", "NAT 穿透") },
  upnp: { group: "upnp", groupLabel: L("UPnP and NAT-PMP", "UPnP 同 NAT-PMP") },
  trigger: { group: "trigger", groupLabel: L("Port triggering", "端口觸發") },
  dmz: { group: "dmz", groupLabel: L("DMZ host", "DMZ 主機") },
};
const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${F}.${id}`, domain: F, ...group, key, control, label, help, ...extra });
const fw = { risk: "low", restart: "restart_firewall" };
const MASKS = [24, 25, 26, 27, 28, 29, 30, 23, 22, 21, 20, 16, 8, 32].map((p) => {
  const mask = [24, 16, 8, 0].map((shift) => (p === 0 ? 0 : ((0xffffffff << (32 - p)) >>> 0 >>> shift) & 255)).join(".");
  return [mask, L(`/${p}  ${mask}`, `/${p}  ${mask}`)];
});

// A device address picked from the known devices, or typed. Empty means none.
const deviceIp = {
  validate(entry, text, fail) {
    if (entry.optional && text === "") return "";
    if (!isIpv4(text)) fail("enter an IPv4 address such as 198.51.100.20.");
    return text;
  },
  sample: (_entry, current) => (current === "198.51.100.77" ? "198.51.100.78" : "198.51.100.77"),
  invalid: () => "999.1.1.1",
};

const read = (nvram, key) => nvram.get(key) ?? "";
const ipFromHex = (hex) => {
  const n = parseInt(hex, 16);
  return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255].join(".");
};
const prefixOf = (hex) => (parseInt(hex, 16) >>> 0).toString(2).replace(/0/g, "").length;

// The routes the router is using right now, from the kernel's table.
async function kernelRoutes(exec) {
  const out = await exec("head -n 100000 /proc/net/route");
  if (out.code !== 0) return [];
  return out.stdout.split("\n").slice(1).map((line) => line.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^[0-9A-Fa-f]{8}$/.test(p[1]))
    .map((p) => ({ iface: p[0], network: ipFromHex(p[1]), prefix: prefixOf(p[7]), gateway: ipFromHex(p[2]) === "0.0.0.0" ? "" : ipFromHex(p[2]), metric: Number(p[6]) || 0, active: (Number.parseInt(p[3], 16) & 1) === 1 }));
}

// Ports other devices have asked the router to open: protocol, outside port, device, device port, expiry, description.
async function upnpLeases(exec) {
  const out = await exec("head -n 100000 /tmp/upnp.leases");
  if (out.code !== 0) return [];
  return out.stdout.split("\n").map((line) => line.trim().split(":")).filter((p) => p.length >= 4 && /^(TCP|UDP)$/i.test(p[0]))
    .map((p) => ({ proto: p[0].toUpperCase(), outsidePort: Number(p[1]), device: p[2], devicePort: Number(p[3]), expires: Number(p[4]) || 0, description: p.slice(5).join(":") }));
}

export default {
  id: F,

  catalog: () => [
    e("static-enable", G.routes, "sr_enable_x", "switch", L("Use static routes", "使用靜態路由"), L("Lets the router send traffic for chosen networks through another router at home.", "等路由器將指定網絡嘅流量，經屋企另一部路由器送出去。"), { values: ON_OFF, risk: "network", restart: "restart_net_and_phy" }),
    e("static-routes", G.routes, "sr_rulelist", "routetable", L("Routes", "路由"), L("Each route says: for traffic to this network, go through this gateway. The metric is a cost; lower wins.", "每條路由話俾路由器知：去呢個網絡嘅流量，經呢個網關。metric 係成本，越低越優先。"), {
      optional: true, maxItems: 32, risk: "network", restart: "restart_net_and_phy", meta: { showWhen: { id: `${F}.static-enable`, in: ["1"] }, note: L("The restart service name for static routes is not confirmed on every firmware build.", "靜態路由用邊個重啟服務名稱，未必每個韌體版本都一樣。") },
      emptyText: L("No static routes.", "冇靜態路由。"),
      columns: [
        { id: "net", label: L("Network", "網絡"), kind: "ipv4" },
        { id: "mask", label: L("Size", "大小"), kind: "select", options: MASKS },
        { id: "gateway", label: L("Gateway", "網關"), kind: "ipv4" },
        { id: "metric", label: L("Metric", "成本"), kind: "number", min: 0, max: 255, default: "1" },
        { id: "iface", label: L("Through", "經過"), kind: "select", options: [["LAN", L("Home network (LAN)", "屋企網絡（LAN）")], ["WAN", L("Internet (WAN)", "互聯網（WAN）")], ["MAN", L("Management (MAN)", "管理（MAN）")]] },
      ],
    }),

    ...[
      ["pptp", "fw_pt_pptp", L("PPTP passthrough", "PPTP 穿透"), L("Lets devices at home open a PPTP VPN to the outside.", "等屋企裝置可以向外開 PPTP VPN。")],
      ["l2tp", "fw_pt_l2tp", L("L2TP passthrough", "L2TP 穿透"), L("Lets devices at home open an L2TP VPN to the outside.", "等屋企裝置可以向外開 L2TP VPN。")],
      ["ipsec", "fw_pt_ipsec", L("IPsec passthrough", "IPsec 穿透"), L("Lets devices at home open an IPsec VPN to the outside.", "等屋企裝置可以向外開 IPsec VPN。")],
      ["rtsp", "fw_pt_rtsp", L("RTSP passthrough", "RTSP 穿透"), L("Lets streaming and camera sessions through NAT.", "等串流同鏡頭連線可以穿過 NAT。")],
      ["h323", "fw_pt_h323", L("H.323 passthrough", "H.323 穿透"), L("Lets older video-call systems through NAT.", "等舊式視像通話系統穿過 NAT。")],
      ["sip", "fw_pt_sip", L("SIP passthrough", "SIP 穿透"), L("Lets internet phone calls through NAT.", "等網絡電話穿過 NAT。")],
      ["pppoe-relay", "fw_pt_pppoerelay", L("PPPoE relay", "PPPoE 中繼"), L("Lets a device at home log in to the provider itself. Leave off unless you need it.", "等屋企裝置自己登入供應商。除非需要，否則保持關閉。")],
    ].map(([id, key, label, help]) => e(id, G.nat, key, "switch", label, help, { values: ON_OFF, ...fw })),

    e("upnp", G.upnp, "upnp_enable", "switch", L("UPnP", "UPnP"), L("Lets games and apps open the ports they need by themselves. Convenient, and a trust decision: any device at home can ask.", "等遊戲同應用程式自己開需要嘅端口。方便，但係屋企任何裝置都可以要求，要信得過。"), { values: ON_OFF, risk: "low", restart: "restart_upnp" }),
    e("upnp-secure", G.upnp, "upnp_secure", "switch", L("Only let a device open ports for itself", "只准裝置為自己開端口"), L("Stops one device from opening ports that lead to another device.", "防止一部裝置開通去另一部裝置嘅端口。"), { values: ON_OFF, firmware: "merlin", risk: "low", restart: "restart_upnp", meta: { showWhen: { id: `${F}.upnp`, in: ["1"] } } }),
    e("upnp-clean", G.upnp, "upnp_clean", "switch", L("Clear old mappings", "清除舊嘅映射"), L("Removes ports that nobody has used for a while.", "移除一段時間冇人用過嘅端口。"), { values: ON_OFF, firmware: "merlin", risk: "low", restart: "restart_upnp", meta: { showWhen: { id: `${F}.upnp`, in: ["1"] } } }),
    e("upnp-interval", G.upnp, "upnp_clean_interval", "stepper", L("Clear every", "每隔幾耐清除"), L("Seconds between clean-ups.", "兩次清除之間嘅秒數。"), { min: 60, max: 86400, unit: "s", firmware: "merlin", risk: "low", restart: "restart_upnp", meta: { showWhen: [[{ id: `${F}.upnp`, in: ["1"] }, { id: `${F}.upnp-clean`, in: ["1"] }]] } }),
    e("upnp-threshold", G.upnp, "upnp_clean_threshold", "stepper", L("Start clearing above", "超過幾多個先清除"), L("Clean up only once there are more mappings than this.", "映射多過呢個數量先會清除。"), { min: 0, max: 1000, unit: "mappings", firmware: "merlin", risk: "low", restart: "restart_upnp", meta: { showWhen: [[{ id: `${F}.upnp`, in: ["1"] }, { id: `${F}.upnp-clean`, in: ["1"] }]] } }),
    e("natpmp", G.upnp, "upnp_mnp", "switch", L("NAT-PMP", "NAT-PMP"), L("A simpler way for apps to open ports, used by some Apple and torrent software.", "俾應用程式開端口嘅簡單方法，部分 Apple 同下載軟件會用。"), { values: ON_OFF, firmware: "merlin", risk: "low", restart: "restart_upnp", meta: { showWhen: { id: `${F}.upnp`, in: ["1"] } } }),

    e("trigger-enable", G.trigger, "autofw_enable_x", "switch", L("Use port triggering", "使用端口觸發"), L("Opens an inbound port only while a device is using a chosen outbound port, then closes it.", "只喺某部裝置用緊指定嘅出站端口期間，先開對應嘅入站端口，之後再關。"), { values: ON_OFF, ...fw }),
    e("triggers", G.trigger, "autofw_rulelist", "triggertable", L("Trigger rules", "觸發規則"), L("When any device sends out on the trigger port, the router opens the incoming port for it.", "任何裝置喺觸發端口送出資料，路由器就為佢開返入站端口。"), {
      optional: true, maxItems: 32, ...fw, meta: { showWhen: { id: `${F}.trigger-enable`, in: ["1"] } },
      emptyText: L("No trigger rules.", "冇觸發規則。"),
      columns: [
        { id: "name", label: L("Name", "名稱"), kind: "text", maxLength: 24 },
        { id: "out", label: L("Trigger port", "觸發端口"), kind: "port", allowRange: true },
        { id: "outproto", label: L("Protocol", "協定"), kind: "select", options: [["TCP", L("TCP", "TCP")], ["UDP", L("UDP", "UDP")]] },
        { id: "in", label: L("Incoming port", "入站端口"), kind: "port", allowRange: true },
        { id: "inproto", label: L("Protocol", "協定"), kind: "select", options: [["TCP", L("TCP", "TCP")], ["UDP", L("UDP", "UDP")]] },
      ],
    }),

    e("dmz", G.dmz, "dmz_ip", "deviceip", L("DMZ host", "DMZ 主機"), L("Sends every unrequested connection from the internet to this one device. Empty means off. Only use it for a device that guards itself, and prefer port forwarding.", "將所有互聯網嚟、冇人要求嘅連線，全部送去呢一部裝置。留空就係關閉。只可以用喺自己有防護嘅裝置，而且最好用端口轉發。"), {
      optional: true, risk: "network", restart: "restart_firewall", meta: { note: L("DMZ is on when this holds an address. A separate on switch may exist on some firmware builds.", "呢度有地址就代表 DMZ 開咗。部分韌體版本可能另有開關。") },
    }),
  ],

  controls: { routetable: tableControl(), triggertable: tableControl(), deviceip: deviceIp },

  domainMeta: [{ id: F, icon: "route", label: L("Routing and NAT", "路由同 NAT"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [F]: async (ctx) => ({
      staticRoutes: parseRows(read(ctx.nvram, "sr_rulelist")).length,
      kernel: await kernelRoutes(ctx.exec),
      mappings: await upnpLeases(ctx.exec),
      dmz: read(ctx.nvram, "dmz_ip"),
      entries: ctx.entries(),
      inProgress: [],
    }),
  },

  routes(api) {
    api.get("/kernel-routes", async ({ live }) => ({ routes: await kernelRoutes((await live()).exec) }));
    api.get("/upnp-mappings", async ({ live }) => ({ mappings: await upnpLeases((await live()).exec) }));
  },

  fakeRouter: {
    nvram: {
      sr_enable_x: "1", sr_rulelist: "<203.0.113.0>255.255.255.0>198.51.100.2>1>LAN",
      fw_pt_pptp: "1", fw_pt_l2tp: "1", fw_pt_ipsec: "1", fw_pt_rtsp: "1", fw_pt_h323: "1", fw_pt_sip: "1", fw_pt_pppoerelay: "0",
      upnp_enable: "1", upnp_secure: "1", upnp_clean: "1", upnp_clean_interval: "600", upnp_clean_threshold: "20", upnp_mnp: "0",
      autofw_enable_x: "0", autofw_rulelist: "", dmz_ip: "",
    },
    handlers: [
      (command) => {
        if (command === "head -n 100000 /proc/net/route")
          return {
            stdout: [
              "Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT",
              "eth0\t00000000\t01004064\t0003\t0\t0\t0\t00000000\t0\t0\t0",
              "br0\t006433C6\t00000000\t0001\t0\t0\t0\t00FFFFFF\t0\t0\t0",
              "br0\t007100CB\t026433C6\t0003\t0\t0\t1\t00FFFFFF\t0\t0\t0",
              "",
            ].join("\n"),
          };
        if (command === "head -n 100000 /tmp/upnp.leases") return { stdout: "TCP:8080:198.51.100.20:80:0:web server\nUDP:51413:198.51.100.20:51413:0:torrent\n" };
        return undefined;
      },
    ],
  },
};
