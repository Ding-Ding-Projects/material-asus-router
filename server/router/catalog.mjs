// The human-readable settings catalogue. Each entry turns one router setting
// into a labelled control with help text, allowed values and a risk level.
// The raw nvram key is kept for the Advanced view and previews, but it is
// never the main thing a person reads.
//
// risk:
//   low          confirm, then apply
//   network      confirm, then apply under the connection-loss guard
//   destructive  two-key super confirmation (see actions.mjs)

import { featureCatalog, reportFeatureError } from "../features/registry.mjs";
import { validateExtra } from "./controls.mjs";

const L = (en, yue) => ({ en, yue });
const ON_OFF = { on: "1", off: "0" };
const DAY = 86400;

export const DOMAINS = [
  { id: "overview", icon: "dashboard", label: L("Overview", "概覽") },
  { id: "devices", icon: "devices", label: L("Devices", "裝置") },
  { id: "wifi", icon: "wifi", label: L("Wi-Fi", "Wi-Fi") },
  { id: "internet", icon: "public", label: L("Internet", "互聯網") },
  { id: "lan", icon: "lan", label: L("Local network", "本地網絡") },
  { id: "forwarding", icon: "swap_horiz", label: L("Port forwarding", "端口轉發") },
  { id: "firewall", icon: "shield", label: L("Firewall", "防火牆") },
  { id: "parental", icon: "family_restroom", label: L("Parental controls", "家長控制") },
  { id: "qos", icon: "speed", label: L("Traffic priority", "流量優先") },
  { id: "vpn", icon: "vpn_lock", label: L("VPN", "VPN") },
  { id: "aimesh", icon: "hub", label: L("AiMesh", "AiMesh") },
  { id: "usb", icon: "usb", label: L("USB and storage", "USB 同儲存") },
  { id: "logs", icon: "receipt_long", label: L("Logs", "記錄") },
  { id: "tools", icon: "build", label: L("Network tools", "網絡工具") },
  { id: "jobs", icon: "schedule", label: L("Scheduled jobs", "排程工作") },
  { id: "backup", icon: "backup", label: L("Backup and restore", "備份同還原") },
  { id: "firmware", icon: "system_update", label: L("Firmware", "韌體") },
  { id: "system", icon: "settings_applications", label: L("System", "系統") },
  { id: "maintenance", icon: "restart_alt", label: L("Maintenance", "維護") },
  { id: "merlin", icon: "extension", label: L("Merlin extras", "Merlin 附加功能") },
  { id: "advanced", icon: "table_rows", label: L("Advanced", "進階") },
  { id: "history", icon: "history", label: L("Change history", "變更記錄") },
];

const BAND_NAMES = { 2: L("2.4 GHz", "2.4 GHz"), 1: L("5 GHz", "5 GHz"), 4: L("6 GHz", "6 GHz") };

function bandSettings(index, nband) {
  const band = BAND_NAMES[nband] ?? L(`Band ${index + 1}`, `頻段 ${index + 1}`);
  const group = `band${index}`;
  const p = `wl${index}`;
  const g = `wl${index}.1`;
  const widths =
    nband === "2"
      ? [["0", L("Automatic", "自動")], ["1", L("20 MHz", "20 MHz")], ["2", L("40 MHz", "40 MHz")]]
      : [["0", L("Automatic", "自動")], ["1", L("20 MHz", "20 MHz")], ["2", L("40 MHz", "40 MHz")], ["3", L("80 MHz", "80 MHz")], ["5", L("160 MHz", "160 MHz")]];
  const channels = nband === "2" ? ["0", "1", "6", "11"] : nband === "1" ? ["0", "36", "44", "149", "157"] : ["0", "37", "53", "69"];
  return [
    { id: `${p}.radio`, domain: "wifi", group, groupLabel: band, key: `${p}_radio`, control: "switch", values: ON_OFF, restart: "restart_wireless", risk: "network",
      label: L(`${band.en} radio`, `${band.yue} 無線電`), help: L("Turn this band's wireless signal on or off. Devices on it disconnect while it is off.", "開或者關呢個頻段嘅無線訊號。關咗嘅時候，連住佢嘅裝置會斷線。") },
    { id: `${p}.ssid`, domain: "wifi", group, groupLabel: band, key: `${p}_ssid`, control: "text", freeText: true, freeTextReason: "A network name is whatever the owner wants to call it.", maxLength: 32, minLength: 1, restart: "restart_wireless", risk: "network",
      label: L("Network name", "網絡名稱"), help: L("The name people see when they look for Wi-Fi. Up to 32 characters.", "大家搵 Wi-Fi 時見到嘅名。最多 32 個字元。") },
    { id: `${p}.hidden`, domain: "wifi", group, groupLabel: band, key: `${p}_closed`, control: "switch", values: ON_OFF, restart: "restart_wireless", risk: "network",
      label: L("Hide network name", "隱藏網絡名稱"), help: L("Hidden networks must be typed in by hand. This does not make Wi-Fi more secure.", "隱藏咗就要人手打名先連到。咁做唔會令 Wi-Fi 安全啲。") },
    { id: `${p}.auth`, domain: "wifi", group, groupLabel: band, key: `${p}_auth_mode_x`, control: "select", restart: "restart_wireless", risk: "network",
      options: [["open", L("Open (no password)", "開放（無密碼）")], ["psk2", L("WPA2 Personal", "WPA2 個人")], ["psk2sae", L("WPA2 and WPA3 Personal", "WPA2 同 WPA3 個人")], ["sae", L("WPA3 Personal", "WPA3 個人")]],
      label: L("Security", "保安模式"), help: L("WPA2 and WPA3 together works with old and new devices. WPA3 alone is stronger but older devices cannot join.", "WPA2 加 WPA3 新舊裝置都用到。淨係 WPA3 最穩陣，但舊裝置連唔到。") },
    { id: `${p}.password`, domain: "wifi", group, groupLabel: band, key: `${p}_wpa_psk`, control: "password", secret: true, minLength: 8, maxLength: 63, restart: "restart_wireless", risk: "network",
      label: L("Wi-Fi password", "Wi-Fi 密碼"), help: L("8 to 63 characters. Every device on this band must enter the new password after you change it.", "8 至 63 個字元。改咗之後，呢個頻段所有裝置都要重新輸入密碼。") },
    { id: `${p}.channel`, domain: "wifi", group, groupLabel: band, key: `${p}_chanspec`, control: "select", restart: "restart_wireless", risk: "network",
      options: channels.map((c) => [c, c === "0" ? L("Automatic", "自動") : L(`Channel ${c}`, `頻道 ${c}`)]),
      label: L("Channel", "頻道"), help: L("Automatic lets the router avoid busy channels. Pick one only if you know your neighbours' channels.", "自動會等路由器避開擠迫嘅頻道。除非你知鄰居用邊個頻道，否則唔使自己揀。") },
    { id: `${p}.width`, domain: "wifi", group, groupLabel: band, key: `${p}_bw`, control: "select", restart: "restart_wireless", risk: "network",
      options: widths, label: L("Channel width", "頻寬"), help: L("Wider channels are faster but more easily disturbed by neighbours.", "頻寬越闊越快，但越容易受鄰居干擾。") },
    { id: `${p}.power`, domain: "wifi", group, groupLabel: band, key: `${p}_txpower`, control: "slider", min: 10, max: 100, step: 10, unit: "%", restart: "restart_wireless", risk: "network",
      label: L("Transmit power", "發射功率"), help: L("Lower power keeps the signal inside a small home and can reduce interference.", "細屋可以調低功率，訊號唔會射到出面，亦減少干擾。") },
    { id: `${g}.enabled`, domain: "wifi", group: `guest${index}`, groupLabel: L(`Guest network, ${band.en}`, `訪客網絡（${band.yue}）`), key: `${g}_bss_enabled`, control: "switch", values: ON_OFF, restart: "restart_wireless", risk: "low",
      label: L("Guest network", "訪客網絡"), help: L("A separate Wi-Fi for visitors.", "俾訪客用嘅另一個 Wi-Fi。") },
    { id: `${g}.ssid`, domain: "wifi", group: `guest${index}`, groupLabel: L(`Guest network, ${band.en}`, `訪客網絡（${band.yue}）`), key: `${g}_ssid`, control: "text", freeText: true, freeTextReason: "A network name is whatever the owner wants to call it.", maxLength: 32, minLength: 1, restart: "restart_wireless", risk: "low",
      label: L("Guest network name", "訪客網絡名稱"), help: L("The name visitors look for.", "訪客搵嘅網絡名稱。") },
    { id: `${g}.password`, domain: "wifi", group: `guest${index}`, groupLabel: L(`Guest network, ${band.en}`, `訪客網絡（${band.yue}）`), key: `${g}_wpa_psk`, control: "password", secret: true, minLength: 8, maxLength: 63, restart: "restart_wireless", risk: "low",
      label: L("Guest password", "訪客密碼"), help: L("8 to 63 characters.", "8 至 63 個字元。") },
    { id: `${g}.lan`, domain: "wifi", group: `guest${index}`, groupLabel: L(`Guest network, ${band.en}`, `訪客網絡（${band.yue}）`), key: `${g}_lanaccess`, control: "switch", values: { on: "on", off: "off" }, restart: "restart_wireless", risk: "low",
      label: L("Guests can reach home devices", "訪客可以見到屋企裝置"), help: L("Leave this off so visitors only get internet, not your printer or files.", "建議關住，訪客就只可以上網，見唔到你部打印機同檔案。") },
  ];
}

const STATIC = [
  // Internet
  { id: "wan.proto", domain: "internet", group: "connection", groupLabel: L("Connection", "連線"), key: "wan_proto", control: "select", restart: "restart_wan_if 0", risk: "network",
    options: [["dhcp", L("Automatic (DHCP)", "自動（DHCP）")], ["static", L("Static address", "固定地址")], ["pppoe", L("PPPoE", "PPPoE")]],
    label: L("Connection type", "連線類型"), help: L("Most home broadband uses Automatic. Your provider tells you if you need PPPoE or a static address.", "大部分家居寬頻用自動。要用 PPPoE 或者固定地址，供應商會話你知。") },
  { id: "wan.dnsauto", domain: "internet", group: "dns", groupLabel: L("Name servers (DNS)", "域名伺服器（DNS）"), key: "wan_dnsenable_x", control: "switch", values: ON_OFF, restart: "restart_wan_if 0", risk: "network",
    label: L("Use the provider's DNS", "用供應商嘅 DNS"), help: L("Turn this off to choose your own name servers, such as 1.1.1.1.", "關咗就可以自己揀 DNS，例如 1.1.1.1。") },
  { id: "wan.dns1", domain: "internet", group: "dns", groupLabel: L("Name servers (DNS)", "域名伺服器（DNS）"), key: "wan_dns1_x", control: "ipv4", optional: true, restart: "restart_wan_if 0", risk: "network",
    label: L("First DNS server", "第一個 DNS"), help: L("Used when the provider's DNS is off.", "唔用供應商 DNS 時會用呢個。") },
  { id: "wan.dns2", domain: "internet", group: "dns", groupLabel: L("Name servers (DNS)", "域名伺服器（DNS）"), key: "wan_dns2_x", control: "ipv4", optional: true, restart: "restart_wan_if 0", risk: "network",
    label: L("Second DNS server", "第二個 DNS"), help: L("A backup in case the first does not answer.", "第一個唔應嘅時候用嘅後備。") },
  { id: "ddns.enabled", domain: "internet", group: "ddns", groupLabel: L("Dynamic DNS", "動態 DNS"), key: "ddns_enable_x", control: "switch", values: ON_OFF, restart: "restart_ddns", risk: "low",
    label: L("Dynamic DNS", "動態 DNS"), help: L("Keeps a name such as home.asuscomm.com pointing at your changing internet address.", "等一個名（例如 home.asuscomm.com）一直指住你會變嘅上網地址。") },
  { id: "ddns.server", domain: "internet", group: "ddns", groupLabel: L("Dynamic DNS", "動態 DNS"), key: "ddns_server_x", control: "select", restart: "restart_ddns", risk: "low",
    options: [["WWW.ASUS.COM", L("ASUS", "ASUS")], ["WWW.DYNDNS.ORG", L("Dyn", "Dyn")], ["WWW.NO-IP.COM", L("No-IP", "No-IP")], ["DOMAINS.GOOGLE.COM", L("Google Domains", "Google Domains")]],
    label: L("Provider", "服務商"), help: L("The company that hosts the name.", "提供呢個名嘅公司。") },
  { id: "ddns.host", domain: "internet", group: "ddns", groupLabel: L("Dynamic DNS", "動態 DNS"), key: "ddns_hostname_x", control: "hostname", optional: true, restart: "restart_ddns", risk: "low",
    label: L("Host name", "主機名稱"), help: L("The full name, for example myhome.asuscomm.com.", "完整名稱，例如 myhome.asuscomm.com。") },
  // Local network
  { id: "lan.ip", domain: "lan", group: "address", groupLabel: L("Router address", "路由器地址"), key: "lan_ipaddr", control: "ipv4", restart: "restart_net_and_phy", risk: "network",
    label: L("Router address", "路由器地址"), help: L("Changing this moves the router. This app keeps the old address ready and puts it back if it cannot reach the router afterwards.", "改咗就等於搬咗路由器去新地址。呢個程式會保留舊地址，如果之後連唔返就會自動還原。") },
  { id: "lan.mask", domain: "lan", group: "address", groupLabel: L("Router address", "路由器地址"), key: "lan_netmask", control: "select", restart: "restart_net_and_phy", risk: "network",
    options: [["255.255.255.0", L("255.255.255.0 (254 devices)", "255.255.255.0（254 部裝置）")], ["255.255.254.0", L("255.255.254.0 (510 devices)", "255.255.254.0（510 部裝置）")], ["255.255.0.0", L("255.255.0.0 (65,534 devices)", "255.255.0.0（65,534 部裝置）")]],
    label: L("Network size", "網絡大小"), help: L("How many addresses the home network has.", "屋企網絡有幾多個地址。") },
  { id: "lan.domain", domain: "lan", group: "address", groupLabel: L("Router address", "路由器地址"), key: "lan_domain", control: "hostname", optional: true, restart: "restart_dnsmasq", risk: "low",
    label: L("Local domain", "本地網域"), help: L("Devices become reachable as name.domain, for example nas.home.lan.", "裝置可以用「名.網域」嚟搵，例如 nas.home.lan。") },
  { id: "dhcp.enabled", domain: "lan", group: "dhcp", groupLabel: L("Automatic addresses (DHCP)", "自動派地址（DHCP）"), key: "dhcp_enable_x", control: "switch", values: ON_OFF, restart: "restart_dnsmasq", risk: "network",
    label: L("Hand out addresses", "自動派地址"), help: L("Leave on unless another device on your network already does this.", "除非網絡入面有其他裝置負責派地址，否則保持開住。") },
  { id: "dhcp.start", domain: "lan", group: "dhcp", groupLabel: L("Automatic addresses (DHCP)", "自動派地址（DHCP）"), key: "dhcp_start", control: "ipv4", restart: "restart_dnsmasq", risk: "low",
    label: L("First address", "第一個地址"), help: L("The first address given to a device.", "派俾裝置嘅第一個地址。") },
  { id: "dhcp.end", domain: "lan", group: "dhcp", groupLabel: L("Automatic addresses (DHCP)", "自動派地址（DHCP）"), key: "dhcp_end", control: "ipv4", restart: "restart_dnsmasq", risk: "low",
    label: L("Last address", "最後一個地址"), help: L("The last address given to a device.", "派俾裝置嘅最後一個地址。") },
  { id: "dhcp.lease", domain: "lan", group: "dhcp", groupLabel: L("Automatic addresses (DHCP)", "自動派地址（DHCP）"), key: "dhcp_lease", control: "number", min: 120, max: 7 * DAY, unit: "s", restart: "restart_dnsmasq", risk: "low",
    label: L("Lease time", "租用時間"), help: L("How long a device keeps its address before asking again. One day is 86,400 seconds.", "裝置用住個地址幾耐先再問。一日即係 86,400 秒。") },
  // Firewall
  { id: "fw.enabled", domain: "firewall", group: "firewall", groupLabel: L("Firewall", "防火牆"), key: "fw_enable_x", control: "switch", values: ON_OFF, restart: "restart_firewall", risk: "network",
    label: L("Firewall", "防火牆"), help: L("Blocks unrequested connections from the internet. Keep it on.", "擋住由互聯網嚟、冇人邀請嘅連線。請保持開住。") },
  { id: "fw.ping", domain: "firewall", group: "firewall", groupLabel: L("Firewall", "防火牆"), key: "misc_ping_x", control: "switch", values: ON_OFF, restart: "restart_firewall", risk: "low",
    label: L("Answer ping from the internet", "回應互聯網嘅 ping"), help: L("Off hides the router from simple internet scans.", "關咗就唔會俾簡單嘅網絡掃描發現。") },
  { id: "fw.dos", domain: "firewall", group: "firewall", groupLabel: L("Firewall", "防火牆"), key: "fw_dos_x", control: "switch", values: ON_OFF, restart: "restart_firewall", risk: "low",
    label: L("Flood protection", "防洪水式攻擊"), help: L("Drops floods of connection attempts. Can slow some games.", "會丟棄大量連線請求，有啲遊戲可能會慢啲。") },
  { id: "fw.ipv6", domain: "firewall", group: "firewall", groupLabel: L("Firewall", "防火牆"), key: "ipv6_fw_enable", control: "switch", values: ON_OFF, restart: "restart_firewall", risk: "network",
    label: L("IPv6 firewall", "IPv6 防火牆"), help: L("Protects devices that have their own IPv6 internet address.", "保護有自己 IPv6 地址嘅裝置。") },
  { id: "fw.forwarding", domain: "forwarding", group: "forwarding", groupLabel: L("Port forwarding", "端口轉發"), key: "vts_enable_x", control: "switch", values: ON_OFF, restart: "restart_firewall", risk: "low",
    label: L("Port forwarding", "端口轉發"), help: L("Lets the internet reach chosen devices on chosen ports. Only forward what you need.", "等互聯網可以連到指定裝置嘅指定端口。需要先開。") },
  // Parental
  { id: "parental.enabled", domain: "parental", group: "parental", groupLabel: L("Parental controls", "家長控制"), key: "MULTIFILTER_ALL", control: "switch", values: ON_OFF, restart: "restart_firewall", risk: "low",
    label: L("Parental controls", "家長控制"), help: L("Turns all internet blocks and schedules on or off at once.", "一次過開或者關所有上網封鎖同時間表。") },
  // QoS
  { id: "qos.enabled", domain: "qos", group: "qos", groupLabel: L("Traffic priority", "流量優先"), key: "qos_enable", control: "switch", values: ON_OFF, restart: "restart_qos", risk: "low",
    label: L("Traffic priority (QoS)", "流量優先（QoS）"), help: L("Keeps calls and games smooth when someone is downloading.", "有人下載大檔案時，通話同遊戲都可以保持順暢。") },
  { id: "qos.type", domain: "qos", group: "qos", groupLabel: L("Traffic priority", "流量優先"), key: "qos_type", control: "select", restart: "restart_qos", risk: "low",
    options: [["1", L("Adaptive (by app type)", "自適應（按應用類型）")], ["0", L("Traditional (by rules)", "傳統（按規則）")], ["2", L("Bandwidth limiter", "頻寬限制")]],
    label: L("Method", "方式"), help: L("Adaptive needs no setup. Traditional and the limiter use the speeds below.", "自適應唔使設定。傳統同頻寬限制會用下面嘅速度。") },
  { id: "qos.up", domain: "qos", group: "qos", groupLabel: L("Traffic priority", "流量優先"), key: "qos_obw", control: "number", min: 0, max: 10000000, unit: "kbit/s", restart: "restart_qos", risk: "low",
    label: L("Upload speed", "上載速度"), help: L("Your real upload speed, a little under the plan's figure.", "你實際嘅上載速度，比計劃寫嘅數字低少少。") },
  { id: "qos.down", domain: "qos", group: "qos", groupLabel: L("Traffic priority", "流量優先"), key: "qos_ibw", control: "number", min: 0, max: 10000000, unit: "kbit/s", restart: "restart_qos", risk: "low",
    label: L("Download speed", "下載速度"), help: L("Your real download speed, a little under the plan's figure.", "你實際嘅下載速度，比計劃寫嘅數字低少少。") },
  // VPN
  { id: "vpn.openvpn", domain: "vpn", group: "openvpn", groupLabel: L("OpenVPN server", "OpenVPN 伺服器"), key: "VPNServer_enable", control: "switch", values: ON_OFF, restart: "restart_vpnd", risk: "low", requires: "openvpnd",
    label: L("OpenVPN server", "OpenVPN 伺服器"), help: L("Lets you reach your home network securely from elsewhere.", "等你喺出面都可以安全咁連返屋企網絡。") },
  { id: "vpn.openvpn.port", domain: "vpn", group: "openvpn", groupLabel: L("OpenVPN server", "OpenVPN 伺服器"), key: "vpn_server1_port", control: "number", min: 1, max: 65535, restart: "restart_vpnd", risk: "low", requires: "openvpnd",
    label: L("Port", "端口"), help: L("1194 is the usual port.", "通常用 1194。") },
  { id: "vpn.openvpn.proto", domain: "vpn", group: "openvpn", groupLabel: L("OpenVPN server", "OpenVPN 伺服器"), key: "vpn_server1_proto", control: "select", restart: "restart_vpnd", risk: "low", requires: "openvpnd",
    options: [["udp", L("UDP (faster)", "UDP（較快）")], ["tcp", L("TCP (passes strict networks)", "TCP（較易穿過嚴格網絡）")]],
    label: L("Protocol", "協定"), help: L("UDP is faster. TCP works on networks that block UDP.", "UDP 快啲。網絡擋咗 UDP 就用 TCP。") },
  { id: "vpn.wireguard", domain: "vpn", group: "wireguard", groupLabel: L("WireGuard server", "WireGuard 伺服器"), key: "wgs_enable", control: "switch", values: ON_OFF, restart: "restart_wgs", risk: "low", requires: "wireguard",
    label: L("WireGuard server", "WireGuard 伺服器"), help: L("A newer, faster VPN. Phones and laptops connect with the WireGuard app.", "較新、較快嘅 VPN。手機同電腦用 WireGuard app 連線。") },
  { id: "vpn.wireguard.port", domain: "vpn", group: "wireguard", groupLabel: L("WireGuard server", "WireGuard 伺服器"), key: "wgs_port", control: "number", min: 1, max: 65535, restart: "restart_wgs", risk: "low", requires: "wireguard",
    label: L("Port", "端口"), help: L("51820 is the usual port.", "通常用 51820。") },
  // USB
  { id: "usb.samba", domain: "usb", group: "sharing", groupLabel: L("Sharing", "分享"), key: "enable_samba", control: "switch", values: ON_OFF, restart: "restart_nasapps", risk: "low", requires: "usbX1",
    label: L("Windows file sharing", "Windows 檔案分享"), help: L("Lets computers at home open the USB drive.", "等屋企部電腦可以打開 USB 磁碟。") },
  { id: "usb.ftp", domain: "usb", group: "sharing", groupLabel: L("Sharing", "分享"), key: "enable_ftp", control: "switch", values: ON_OFF, restart: "restart_nasapps", risk: "low", requires: "usbX1",
    label: L("FTP server", "FTP 伺服器"), help: L("An older way to share files. Leave off unless a device needs it.", "較舊嘅分享方法。除非有裝置需要，否則關住。") },
  { id: "usb.media", domain: "usb", group: "sharing", groupLabel: L("Sharing", "分享"), key: "dms_enable", control: "switch", values: ON_OFF, restart: "restart_nasapps", risk: "low", requires: "usbX1",
    label: L("Media server", "媒體伺服器"), help: L("TVs and speakers can play music and video from the drive.", "電視同喇叭可以直接播放磁碟入面嘅音樂同影片。") },
  { id: "usb.timemachine", domain: "usb", group: "sharing", groupLabel: L("Sharing", "分享"), key: "timemachine_enable", control: "switch", values: ON_OFF, restart: "restart_timemachine", risk: "low", requires: "usbX1",
    label: L("Time Machine backups", "Time Machine 備份"), help: L("Macs can back up to the drive.", "Mac 可以備份去個磁碟。") },
  // System
  { id: "sys.timezone", domain: "system", group: "time", groupLabel: L("Time", "時間"), key: "time_zone", control: "select", restart: "restart_time", risk: "low",
    options: [["UTC0", L("UTC", "UTC")], ["GMT0BST", L("London", "倫敦")], ["CET-1CEST", L("Central Europe", "中歐")], ["EST5DST", L("New York, Toronto", "紐約、多倫多")], ["PST8DST", L("Los Angeles, Vancouver", "洛杉磯、溫哥華")], ["UTC-8", L("Hong Kong, Singapore", "香港、新加坡")], ["UTC-9", L("Tokyo, Seoul", "東京、首爾")], ["UTC-10", L("Sydney", "悉尼")]],
    label: L("Time zone", "時區"), help: L("Schedules and logs use this time zone.", "時間表同記錄都用呢個時區。") },
  { id: "sys.ntp", domain: "system", group: "time", groupLabel: L("Time", "時間"), key: "ntp_server0", control: "hostname", restart: "restart_time", risk: "low",
    label: L("Time server", "時間伺服器"), help: L("Where the router gets the correct time.", "路由器由邊度攞準確時間。") },
  { id: "sys.webport", domain: "system", group: "access", groupLabel: L("Router access", "路由器存取"), key: "http_lanport", control: "number", min: 1, max: 65535, restart: "restart_httpd", risk: "low",
    label: L("Router web page port", "路由器網頁端口"), help: L("The port of the router's own web page at home. 80 is the usual one.", "屋企入面路由器自己網頁嘅端口，通常係 80。") },
  { id: "sys.remoteweb", domain: "system", group: "access", groupLabel: L("Router access", "路由器存取"), key: "misc_http_x", control: "switch", values: ON_OFF, restart: "restart_httpd", risk: "low",
    label: L("Router web page from the internet", "由互聯網開路由器網頁"), help: L("Keep off. Use the VPN to manage the router from outside.", "請保持關閉。喺出面想管路由器，用 VPN。") },
  { id: "sys.ssh", domain: "system", group: "access", groupLabel: L("Router access", "路由器存取"), key: "sshd_enable", control: "select", restart: "restart_sshd", risk: "network",
    options: [["2", L("Home network only", "只限屋企網絡")], ["1", L("Home network and internet", "屋企網絡同互聯網")], ["0", L("Off (this app stops working)", "關閉（呢個程式會停止運作）")]],
    label: L("SSH access", "SSH 存取"), help: L("This app manages the router over SSH. Turning it off disconnects the app; the guard puts it back if the router can no longer be reached.", "呢個程式靠 SSH 管理路由器。關咗會斷線；如果之後連唔返，保護機制會自動還原。") },
  { id: "sys.led", domain: "system", group: "lights", groupLabel: L("Lights", "燈號"), key: "AllLED", control: "switch", values: { on: "0", off: "1" }, restart: "", risk: "low",
    label: L("Turn the lights off", "關燈"), help: L("Useful when the router is in a bedroom.", "路由器放喺睡房時好有用。") },
  // Merlin
  { id: "merlin.scripts", domain: "merlin", group: "scripts", groupLabel: L("Custom scripts", "自訂腳本"), key: "jffs2_scripts", control: "switch", values: ON_OFF, restart: "", risk: "low", firmware: "merlin",
    label: L("Run custom scripts", "執行自訂腳本"), help: L("Lets scripts in /jffs/scripts run when the router starts and on events. Needed by most add-ons.", "等 /jffs/scripts 入面嘅腳本喺開機同事件時執行。大部分附加功能都需要。") },
];

// Builds the catalogue for one router, given what detection found.
export function buildCatalog(info) {
  const bands = info.bands.flatMap((band) => bandSettings(band.index, band.nband));
  const stock = [...bands, ...STATIC];
  const taken = new Set(stock.flatMap((e) => [e.id, e.key]));
  const extra = [];
  for (const entry of featureCatalog(info)) {
    if (taken.has(entry.id) || taken.has(entry.key)) {
      reportFeatureError(entry.feature, `entry "${entry.id}" (setting ${entry.key}) is already used by another entry`);
      continue;
    }
    taken.add(entry.id);
    taken.add(entry.key);
    extra.push(entry);
  }
  return [...stock, ...extra].map((entry) => {
    let disabled = null;
    if (entry.firmware === "merlin" && !info.merlin)
      disabled = L("Needs Asuswrt-Merlin firmware. This router runs the stock ASUS firmware.", "要用 Asuswrt-Merlin 韌體先有。呢部路由器用緊原廠 ASUS 韌體。");
    else if (entry.needsKey && info.keys && !info.keys.has(entry.key))
      disabled = L(`This router does not have the setting ${entry.key}`, `呢部路由器冇 ${entry.key} 呢個設定`);
    else if (entry.requires && !info.capabilities.includes(entry.requires))
      disabled = L(`This router model does not support this (${entry.requires} is missing).`, `呢個型號唔支援（缺少 ${entry.requires}）。`);
    // The router's own settings list decides what can be written: a setting it does not have is never created.
    else if (info.settingKeys && !info.settingKeys.has(entry.key))
      disabled = L(`This router does not have the setting ${entry.key}`, `呢部路由器冇 ${entry.key} 呢個設定`);
    return { ...entry, disabled };
  });
}

export function findByKey(catalog, key) {
  return catalog.find((entry) => entry.key === key) ?? null;
}

// Checks one value against its catalogue entry and returns the nvram string.
export function validate(entry, value) {
  const text = value === undefined || value === null ? "" : String(value);
  const fail = (en) => {
    throw Object.assign(new Error(`${entry.label.en}: ${en}`), { status: 400 });
  };
  if (entry.disabled) fail(entry.disabled.en);
  if (entry.readOnly) fail("this setting is read only.");
  switch (entry.control) {
    case "switch":
      if (![entry.values.on, entry.values.off].includes(text)) fail("choose on or off.");
      return text;
    case "select":
    case "segmented":
      if (!entry.options.some(([v]) => v === text)) fail("choose one of the listed options.");
      return text;
    case "number":
    case "slider":
    case "stepper": {
      const n = Number(text);
      if (!Number.isInteger(n) || n < entry.min || n > entry.max) fail(`enter a whole number from ${entry.min} to ${entry.max}.`);
      return String(n);
    }
    case "ipv4":
      if (entry.optional && text === "") return "";
      if (!/^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(text)) fail("enter an IPv4 address such as 198.51.100.1.");
      return text;
    case "hostname":
      if (entry.optional && text === "") return "";
      if (!/^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?)*$/.test(text)) fail("enter a host name such as pool.ntp.org.");
      return text;
    case "text":
    case "password":
      if (text.length < (entry.minLength ?? 0) || text.length > (entry.maxLength ?? 256)) fail(`use ${entry.minLength ?? 0} to ${entry.maxLength} characters.`);
      if (/[\x00-\x1f<>]/.test(text)) fail("remove line breaks and the < and > characters.");
      return text;
    default: {
      const value = validateExtra(entry, text, fail);
      if (value === undefined) fail("this setting cannot be changed here.");
      return value;
    }
  }
}
