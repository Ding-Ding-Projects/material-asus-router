// Ports: what each wired port is doing right now (link, speed, duplex), which
// chip drives them, and the switch settings that are not already on the Local
// network Pro, Internet Pro and Dual WAN screens: hardware acceleration, the
// jumbo frame size and multicast for IPTV. Port status is read only. Every
// setting whose name is not certain to exist on every firmware is marked
// verifyKey, so it is offered only when the router's own settings list has it.
import { L, ON_OFF } from "../kit.mjs";
import { CHIPSET_COMMAND, ROBOCFG_COMMAND, SYSFS_COMMAND, readPorts } from "./status.mjs";

const F = "ports";
const G = {
  accel: { group: "accel", groupLabel: L("Hardware acceleration", "硬件加速") },
  jumbo: { group: "jumbo", groupLabel: L("Jumbo frames", "巨型幀") },
  multicast: { group: "multicast", groupLabel: L("IPTV and multicast", "IPTV 同多播") },
};
const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${F}.${id}`, domain: F, ...group, key, control, label, help, verifyKey: true, ...extra });
const REBOOT = L("Takes effect after the router restarts.", "路由器重啟之後生效。");

export default {
  id: F,

  catalog: () => [
    e("ctf", G.accel, "ctf_disable_force", "switch", L("Turn off Cut-Through Forwarding (CTF)", "關閉 CTF 直通轉發"), L("CTF moves wired traffic through the router without bothering the processor. Turn it off only when a feature such as traffic shaping needs the processor to see every packet; wired speed on fast lines drops.", "CTF 令有線流量唔使經處理器。只有流量整形等功能需要處理器睇到每個封包先好關；快線嘅有線速度會跌。"), { values: ON_OFF, risk: "network", meta: { note: REBOOT } }),
    e("flow-cache", G.accel, "fc_disable", "switch", L("Turn off Flow Cache", "關閉 Flow Cache"), L("Flow Cache is the faster wired path on newer Broadcom models. Turning it off is a fix for rare faults and costs speed.", "Flow Cache 係新款 Broadcom 型號較快嘅有線通道。關咗係為咗解決罕見問題，會慢啲。"), { values: ON_OFF, risk: "network", meta: { note: REBOOT } }),
    e("runner", G.accel, "runner_disable", "switch", L("Turn off Runner offload", "關閉 Runner 卸載"), L("Runner offload lets the network chip forward traffic by itself on the newest models. Turn it off only when you are told to.", "Runner 卸載等網絡晶片自己轉發流量，最新型號先有。除非有人叫你，否則唔好關。"), { values: ON_OFF, risk: "network", meta: { note: REBOOT } }),

    e("jumbo-size", G.jumbo, "jumbo_frame_size", "number", L("Jumbo frame size", "巨型幀大小"), L("The largest packet, in bytes, used when jumbo frames are on (the switch is on the Local network Pro screen). Every device on the path must accept this size.", "開咗巨型幀之後用嘅最大封包（位元組）。開關喺「本地網絡進階」畫面。路徑上每部裝置都要接受呢個大小。"), { min: 1518, max: 9216, unit: "bytes", risk: "network", restart: "restart_net_and_phy" }),

    e("igmp-proxy", G.multicast, "mr_enable_x", "switch", L("Multicast routing (IGMP proxy)", "多播路由（IGMP 代理）"), L("Lets IPTV streams from the provider reach the box on its LAN port. Turn on when the provider's IPTV needs it.", "等供應商嘅 IPTV 串流去到接機頂盒嘅 LAN 埠。供應商 IPTV 需要先開。"), { values: ON_OFF, risk: "network", restart: "restart_net_and_phy" }),
    e("snooping", G.multicast, "emf_enable", "switch", L("Efficient multicast forwarding (IGMP snooping)", "高效多播轉發（IGMP 偵聽）"), L("Sends multicast only to the ports that asked for it, so IPTV does not flood the whole home network.", "多播只會送去有要求嘅埠，IPTV 唔會灌滿成個屋企網絡。"), { values: ON_OFF, risk: "network", restart: "restart_net_and_phy" }),
    e("udpxy", G.multicast, "udpxy_enable_x", "number", L("Multicast to web address converter (udpxy) port", "多播轉網址轉換器（udpxy）端口"), L("Turns an IPTV stream into a web address that players such as VLC can open. 0 is off; otherwise the port the converter listens on.", "將 IPTV 串流變成 VLC 等播放器開得到嘅網址。0 係關閉，否則係轉換器用嘅端口。"), { min: 0, max: 65535, unit: "port", risk: "network", restart: "restart_firewall" }),
  ],

  domainMeta: [{ id: F, icon: "settings_ethernet", label: L("Ports", "網絡埠"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [F]: async (ctx) => ({
      ...(await readPorts(ctx.exec, ctx.nvram)),
      model: ctx.info.model,
      entries: ctx.entries(),
      elsewhere: [
        { id: "lan-pro", label: L("Jumbo frames and link aggregation", "巨型幀同鏈路聚合"), about: L("The switch settings on Local network Pro.", "「本地網絡進階」入面嘅交換器設定。") },
        { id: "internet-pro", label: L("Provider profile, VLAN ids and the IPTV port", "供應商設定檔、VLAN 編號同 IPTV 埠"), about: L("On Internet Pro.", "喺「互聯網進階」。") },
        { id: "dual-wan", label: L("A LAN port as the second internet port", "將 LAN 埠變成第二個上網埠"), about: L("On Dual WAN.", "喺「雙 WAN」。") },
      ],
    }),
  },

  routes(api) {
    // The same reading the screen shows, repeated while the screen is open.
    api.get("/status", async ({ live }) => {
      const ctx = await live();
      return readPorts(ctx.exec, ctx.nvram);
    });
  },

  fakeRouter: {
    nvram: {
      ctf_disable_force: "0", fc_disable: "0", runner_disable: "0",
      mr_enable_x: "0", emf_enable: "1", udpxy_enable_x: "0",
      // jumbo_frame_size is deliberately absent: the screen must show it switched off with the reason.
    },
    handlers: [
      (command) => {
        if (command === CHIPSET_COMMAND) return { stdout: "/usr/sbin/robocfg\n/usr/sbin/ethswctl\n" };
        if (command === ROBOCFG_COMMAND) {
          return {
            stdout: [
              "Port 0: 1000FD enabled stp: none vlan: 1 jumbo: off mac: 04:d9:f5:12:34:51",
              "Port 1: 2500FD enabled stp: none vlan: 1 jumbo: off mac: 04:d9:f5:12:34:52",
              "Port 2: DOWN enabled stp: none vlan: 1 jumbo: off mac: 00:00:00:00:00:00",
              "Port 3: 100FD enabled stp: none vlan: 1 jumbo: off mac: 04:d9:f5:12:34:54",
              "Port 4: 1000FD enabled stp: none vlan: 1 jumbo: off mac: 04:d9:f5:12:34:55",
              "Port 8: 1000FD enabled stp: none vlan: 1 jumbo: off mac: 04:d9:f5:12:34:50",
            ].join("\n") + "\n",
          };
        }
        if (command === SYSFS_COMMAND) return { stdout: "eth0 1 1000 full\neth1 1 2500 full\neth2 0   \neth3 1 100 full\neth6   \neth7   \n" };
        return undefined;
      },
    ],
  },
};
