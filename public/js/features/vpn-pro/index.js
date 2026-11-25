// The VPN tools screen: OpenVPN server and clients, WireGuard server and
// clients, IPsec (shown and gated) and VPN Director with VPN Fusion.
import { directorSection, ipsecSection } from "./director.js";
import { clientsSection as ovpnClients, serverSection as ovpnServer } from "./openvpn.js";
import { createUi } from "./ui.js";
import { clientsSection as wgClients, serverSection as wgServer } from "./wireguard.js";

const label = { en: "VPN tools", yue: "VPN 工具" };
const lede = { en: "OpenVPN, WireGuard and per-device routing, with keys made on the router and nothing shown in plain text.", yue: "OpenVPN、WireGuard 同逐部裝置路由；金鑰喺路由器建立，唔會以純文字顯示。" };

export const SECTIONS = [
  { id: "ovpn-server", icon: "dns", label: { en: "OpenVPN server", yue: "OpenVPN 伺服器" }, draw: ovpnServer },
  { id: "ovpn-clients", icon: "vpn_key", label: { en: "OpenVPN clients", yue: "OpenVPN 客戶端" }, draw: ovpnClients },
  { id: "wg-server", icon: "shield", label: { en: "WireGuard server", yue: "WireGuard 伺服器" }, draw: wgServer },
  { id: "wg-clients", icon: "lan", label: { en: "WireGuard clients", yue: "WireGuard 客戶端" }, draw: wgClients },
  { id: "ipsec", icon: "enhanced_encryption", label: { en: "IPsec", yue: "IPsec" }, draw: ipsecSection },
  { id: "director", icon: "alt_route", label: { en: "VPN Director", yue: "VPN Director" }, draw: directorSection },
];

// What the person last looked at stays chosen while the screen redraws.
const state = { section: "ovpn-server", ovpnUnit: 1, wgUnit: 1 };

async function draw(ctx, root) {
  const ui = createUi(ctx);
  const { api, h, icon, tt } = ctx;
  const data = await api.get("/api/domain/vpn-pro");
  const page = ctx.page(label, lede);
  root.replaceChildren(page);
  const refresh = () => draw(ctx, root);
  const nav = h("div", { class: "tabs", role: "tablist", "aria-label": tt(label) }, SECTIONS.map((s) => h("button", { class: `tab ${s.id === state.section ? "on" : ""}`, role: "tab", id: `vpn-tab-${s.id}`, "aria-selected": String(s.id === state.section), "aria-controls": "vpn-panel", onClick: () => { state.section = s.id; refresh(); } }, icon(s.icon, "sm"), tt(s.label))));
  const section = SECTIONS.find((s) => s.id === state.section) ?? SECTIONS[0];
  page.append(nav, h("div", { class: "vpn-panel", id: "vpn-panel", role: "tabpanel", "aria-labelledby": `vpn-tab-${section.id}` }, section.draw(ctx, ui, data, refresh, state).flat().filter(Boolean)));
}

export default {
  id: "vpn-pro",
  screens: [
    {
      id: "vpn-pro",
      group: { en: "Network", yue: "網絡" },
      icon: "vpn_lock",
      label,
      async render(ctx) {
        await draw(ctx, ctx.root);
        return ctx.bus.on("changed", () => draw(ctx, ctx.root));
      },
    },
  ],
  settings: [
    {
      id: "vpn-pro",
      icon: "vpn_lock",
      label,
      async render(ctx) {
        const data = await ctx.api.get("/api/domain/vpn-pro");
        const hidden = new Set(["vpn-pro.ovpn.users", "vpn-pro.wg.peers", "vpn-pro.wg.private"]);
        const groups = new Set(["ovpn-server", "ovpnc-start", "wg-server", "ipsec", "director"]);
        return ctx.controls.settingGroups(data.entries.filter((e) => groups.has(e.group) && !hidden.has(e.id))).map((g) => ctx.controls.groupCard(g.label, g.entries));
      },
    },
  ],
  commands: [
    { id: "vpn-pro.open", icon: "vpn_lock", label: { en: "Open VPN tools", yue: "開啟 VPN 工具" }, keywords: "vpn openvpn wireguard ipsec director", run: (ctx) => ctx.navigate("vpn-pro") },
    { id: "vpn-pro.wireguard", icon: "qr_code_2", label: { en: "Add a WireGuard device", yue: "新增 WireGuard 裝置" }, keywords: "wireguard peer qr phone", run: (ctx) => { state.section = "wg-server"; ctx.navigate("vpn-pro"); } },
    { id: "vpn-pro.director", icon: "alt_route", label: { en: "Route a device through a VPN", yue: "將裝置經 VPN 路由" }, keywords: "vpn director routing device policy", run: (ctx) => { state.section = "director"; ctx.navigate("vpn-pro"); } },
  ],
};
