// Internet and IPv6 extras: the connection keep-alive of the main internet connection (wan0_) and the IPv6
// switches that the Internet and IPv6 screens do not hold. PPP keep-alive (how often the router asks the
// provider whether the line is alive, and how many missed answers mean it is not), UPnP and the VPN plus DHCP
// option for this connection, and for IPv6 router advertisements, the DHCPv6 server, accepting a default route
// and releasing the lease.
//
// Only settings the firmware documents with a plain on or off, or a number, are here.
import { L, ON_OFF } from "../kit.mjs";

const F = "wan-ipv6-extras";
const G = {
  line: { group: "line", groupLabel: L("Keeping the line alive", "保持連線") },
  wan: { group: "wan", groupLabel: L("This internet connection", "呢條上網連線") },
  home: { group: "home", groupLabel: L("IPv6 at home", "屋企 IPv6") },
  upstream: { group: "upstream", groupLabel: L("IPv6 from the provider", "供應商嘅 IPv6") },
};
const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${F}.${id}`, domain: F, ...group, key, control, label, help, risk: "network", ...extra });
const ipv6 = { requires: "ipv6", restart: "restart_net_and_phy" };
const wan = { restart: "restart_wan_if 0" };

export default {
  id: F,

  catalog: () => [
    e("ppp-echo", G.line, "wan0_ppp_echo", "switch", L("Ask the provider if the line is alive", "問供應商條線仲喺唔喺度"), L("For PPPoE and similar logins. The router sends a small question now and then and reconnects if nobody answers.", "適用於 PPPoE 之類登入。路由器定時發一個細問題，冇人答就重新連線。"), { values: ON_OFF, ...wan }),
    e("ppp-interval", G.line, "wan0_ppp_echo_interval", "stepper", L("Ask every", "幾耐問一次"), L("Seconds between the questions.", "兩次發問之間嘅秒數。"), { min: 1, max: 3600, unit: " s", ...wan }),
    e("ppp-failure", G.line, "wan0_ppp_echo_failure", "stepper", L("Reconnect after this many missed answers", "漏咗幾次回應就重新連線"), L("A higher number avoids reconnecting because of one lost question.", "數字高啲，就唔會因為漏咗一次而重新連線。"), { min: 1, max: 100, unit: " misses", ...wan }),
    e("upnp", G.wan, "wan0_upnp_enable", "switch", L("Allow UPnP on this connection", "呢條連線容許 UPnP"), L("Lets apps on the home network open ports on this internet connection by themselves.", "等屋企網絡嘅應用程式自己喺呢條上網連線開端口。"), { values: ON_OFF, ...wan }),
    e("vpn-dhcp", G.wan, "wan0_vpndhcp", "switch", L("Also get an address automatically (PPTP and L2TP)", "同時自動攞地址（PPTP 同 L2TP）"), L("Some providers want the router to ask for an ordinary address as well as the VPN login.", "有啲供應商要路由器除咗 VPN 登入之外，仲要求一個普通地址。"), { values: ON_OFF, ...wan }),
    e("radvd", G.home, "ipv6_radvd", "switch", L("Announce IPv6 to home devices", "向屋企裝置公布 IPv6"), L("Router advertisements tell devices at home how to get IPv6 addresses. Leave on.", "路由器通告話俾屋企裝置知點攞 IPv6 地址。請保持開住。"), { values: ON_OFF, ...ipv6 }),
    e("dhcp6s", G.home, "ipv6_dhcp6s_enable", "switch", L("Hand out IPv6 addresses (DHCPv6 server)", "派發 IPv6 地址（DHCPv6 伺服器）"), L("Lets the router give home devices their IPv6 addresses itself.", "等路由器自己派 IPv6 地址俾屋企裝置。"), { values: ON_OFF, ...ipv6 }),
    e("defrtr", G.upstream, "ipv6_accept_defrtr", "switch", L("Accept the provider's default route", "接受供應商嘅預設路由"), L("Lets the provider tell the router where IPv6 traffic should go. Leave on.", "等供應商話俾路由器知 IPv6 流量去邊。請保持開住。"), { values: ON_OFF, ...ipv6 }),
    e("release", G.upstream, "ipv6_dhcp6c_release", "switch", L("Give the address back when stopping", "停止時交還地址"), L("Releases the IPv6 lease cleanly when the connection stops, which some providers need before they hand out a new one.", "連線停止時乾淨咁交還 IPv6 租約，有啲供應商要咁先會派新嘅。"), { values: ON_OFF, ...ipv6 }),
  ],

  domainMeta: [{ id: F, icon: "settings_ethernet", label: L("Internet and IPv6 extras", "上網同 IPv6 進階"), group: { en: "Network", yue: "網絡" } }],
  domains: { [F]: async (ctx) => ({ entries: ctx.entries() }) },

  fakeRouter: {
    nvram: { wan0_ppp_echo: "1", wan0_ppp_echo_interval: "6", wan0_ppp_echo_failure: "10", wan0_upnp_enable: "0", wan0_vpndhcp: "1", ipv6_radvd: "1", ipv6_dhcp6s_enable: "1", ipv6_accept_defrtr: "1", ipv6_dhcp6c_release: "1" },
  },
};
