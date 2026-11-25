// Household impact: how much a change or action disturbs the people at home.
//
//   0  nobody notices (a label, the clock, the log level)
//   1  a small blip (the guest network, the LEDs, a DNS or firewall reload)
//   2  everyone's Wi-Fi drops for a few seconds (channel, password, Wi-Fi mode)
//   3  the internet or the router is down, or devices must reconnect by hand
//      (the router address, the WAN type, a reboot, a reset, new firmware)
//
// The level comes from three things, strongest first: a hand-checked override
// for a setting or action, the level of the service the change restarts, and a
// floor from the change's own risk (network = 1, destructive = 3).
import { L } from "../features/kit.mjs";

export const LEVELS = [
  { level: 0, name: L("No effect", "冇影響"), about: L("Nobody at home will notice.", "屋企人唔會有感覺。") },
  { level: 1, name: L("Small blip", "輕微中斷"), about: L("A quick hiccup for some devices, such as the guest network or the lights on the router.", "部分裝置會閃一閃，例如訪客網絡或者路由器嘅燈。") },
  { level: 2, name: L("Wi-Fi drops", "Wi-Fi 會斷"), about: L("Everyone's Wi-Fi drops for a few seconds and devices reconnect by themselves.", "所有人嘅 Wi-Fi 會斷幾秒，裝置會自己連返。") },
  { level: 3, name: L("Internet or router down", "上網或路由器停頓"), about: L("The internet or the router is unavailable, or devices need to be reconnected by hand.", "上唔到網或者路由器停頓，裝置可能要人手重新連線。") },
];
export const levelInfo = (level) => LEVELS[Math.min(Math.max(Number(level) || 0, 0), 3)];

const SERVICE_LEVEL = {
  restart_wireless: 2,
  restart_net_and_phy: 3,
  restart_net: 3,
  restart_wan: 3,
  restart_lan: 3,
  restart_dualwan: 3,
  restart_firewall: 1,
  restart_dnsmasq: 1,
  restart_dnsfilter: 1,
  restart_stubby: 1,
  restart_upnp: 1,
  restart_qos: 1,
  restart_vpnd: 1,
  restart_wgs: 1,
  restart_ipsec: 1,
  restart_nasapps: 1,
  restart_timemachine: 1,
  restart_wrs: 1,
  restart_sshd: 0,
  restart_httpd: 0,
  restart_time: 0,
  restart_ddns: 0,
  restart_logger: 0,
  reboot: 3,
};
export const SERVICE_LEVELS = SERVICE_LEVEL;
const RISK_FLOOR = { low: 0, network: 1, destructive: 3 };

// Hand-checked overrides, matched against the setting's raw key. First match wins.
const KEY_OVERRIDES = [
  [/^wl\d+\.\d+_/, 1, L("Only the guest network restarts for a moment.", "淨係訪客網絡會停一陣。")],
  [/^led_/, 1, L("Only the lights on the router change.", "淨係路由器嘅燈會變。")],
  [/^(lan_ipaddr|lan_netmask|lan_gateway)$/, 3, L("The router moves to a new address, so every device must find it again.", "路由器搬去新地址，所有裝置都要重新搵佢。")],
  [/^(dhcp_enable_x)$/, 3, L("Devices stop getting addresses automatically.", "裝置唔再自動攞到地址。")],
  [/^(dhcp_start|dhcp_end|dhcp_lease|dhcp_staticlist|lan_domain)$/, 1, L("Devices renew their address and a few may blink off.", "裝置會更新地址，個別可能會閃斷一下。")],
  [/^(wan\d*_proto|wans_mode|wans_dualwan|wan\d*_(ipaddr|netmask|gateway|enable|pppoe_.*|dnsenable_x|dns\d_x|mac|hwaddr|clone.*))$/, 3, L("The internet connection is rebuilt, so the internet is down for a while.", "上網連線重新建立，上唔到網會一陣。")],
  [/^wl\d*_(ssid|wpa_psk|crypto|auth_mode_x|chanspec|bw|nmode_x|radio|closed|mfp|wep.*|key.*|wpa_gtk_rekey|bss_enabled|maxassoc|sae_.*|he_.*|mumimo.*|ofdma.*)$/, 2, L("The Wi-Fi radios restart, so every Wi-Fi device drops and reconnects.", "Wi-Fi 無線電重新啟動，所有 Wi-Fi 裝置會斷線再連返。")],
  [/^(sshd_.*|ntp_.*|time_zone|ddns_.*|http_.*|misc_http_x|log.*|syslog.*|jffs2_.*|telnetd_.*|webdav.*)$/, 0, L("Only the router's own services change, so no one at home notices.", "淨係路由器自己嘅服務有變，屋企人唔會察覺。")],
  [/^(wan_dns.*|dnsfilter_.*|dnspriv_.*)$/, 1, L("Name lookups restart for a moment.", "域名查詢會停一陣。")],
  [/^(amas_.*|cfg_.*|sw_mode)$/, 3, L("The mesh or the router mode changes, so devices reconnect.", "Mesh 或路由器模式改變，裝置要重新連線。")],
];

// Hand-checked overrides for whole feature entries and actions, by id.
const ID_OVERRIDES = [
  [/^firmware-pro\./, 3, L("New firmware restarts the router.", "新韌體會令路由器重啟。")],
  [/^dual-wan\./, 3, L("Both internet links are rebuilt.", "兩條上網線路都會重建。")],
];

const ACTION_LEVEL = {
  ping: 0,
  traceroute: 0,
  nslookup: 0,
  wake: 0,
  "install-key": 0,
  reboot: 3,
};
const FEATURE_ACTION_FLOOR = { low: 0, network: 1, destructive: 3 };

export const serviceImpact = (name) => (name in SERVICE_LEVEL ? SERVICE_LEVEL[name] : 1);

// The impact of one setting. `entry` is its catalogue entry when it has one.
export function impactOfItem({ key, entry = null, risk = "low", restart = "" }) {
  if (entry && Number.isInteger(entry.impact) && entry.impact >= 0 && entry.impact <= 3) return { level: entry.impact, why: entry.impactWhy ?? L("Set by the setting itself.", "由設定本身指定。") };
  const id = String(entry?.id ?? "");
  for (const [re, level, why] of ID_OVERRIDES) if (id && re.test(id)) return { level, why };
  for (const [re, level, why] of KEY_OVERRIDES) if (re.test(String(key))) return { level, why };
  const byService = restart ? serviceImpact(restart) : 0;
  const floor = RISK_FLOOR[risk] ?? 1;
  const level = Math.max(byService, floor);
  const why = byService >= floor && restart ? L(`It restarts ${restart.replace(/^restart_/, "")}.`, `會重新啟動 ${restart.replace(/^restart_/, "")}。`) : L("The change carries some risk.", "呢個改動有啲風險。");
  return { level, why };
}

export const impactOfEntry = (entry) => impactOfItem({ key: entry.key, entry, risk: entry.risk, restart: entry.restart });

// The impact of a whole change: the highest of its settings, plus any service
// restarts that no setting in the change already accounts for.
export function impactOfChange({ items, explicitServices = [] }) {
  const reasons = items.map((item) => {
    const { level, why } = impactOfItem(item);
    return { key: item.key, label: item.label ?? { en: item.key, yue: item.key }, level, why };
  });
  const accounted = new Set(items.map((i) => i.restart).filter(Boolean));
  for (const service of new Set(explicitServices)) {
    if (!service || accounted.has(service)) continue;
    reasons.push({ key: service, label: { en: `Restart ${service.replace(/^restart_/, "")}`, yue: `重新啟動 ${service.replace(/^restart_/, "")}` }, level: serviceImpact(service), why: L("The change restarts this service.", "呢個改動會重新啟動呢項服務。") });
  }
  const level = reasons.reduce((max, r) => Math.max(max, r.level), 0);
  return { level, ...levelInfo(level), reasons: reasons.sort((a, b) => b.level - a.level).slice(0, 12) };
}

// The impact of an action, by the name used in /api/actions/<name>.
export function impactOfAction(name, { risk = null, body = {} } = {}) {
  if (name === "restart-service") {
    const level = serviceImpact(String(body.service ?? ""));
    return { level, ...levelInfo(level) };
  }
  if (name in ACTION_LEVEL) return { level: ACTION_LEVEL[name], ...levelInfo(ACTION_LEVEL[name]) };
  for (const [re, level] of ID_OVERRIDES) if (re.test(name)) return { level, ...levelInfo(level) };
  const level = FEATURE_ACTION_FLOOR[risk] ?? 1;
  return { level, ...levelInfo(level) };
}

// A short name a person can type to confirm a change (the setting's English label).
export function shortNameOf(items) {
  const top = [...items].sort((a, b) => b.level - a.level)[0];
  const text = String(top?.label?.en ?? top?.key ?? "this change").trim();
  return text.length > 48 ? text.slice(0, 48).trim() : text;
}
