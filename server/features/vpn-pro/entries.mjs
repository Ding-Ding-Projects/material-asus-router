// Every VPN setting as a typed control with its real nvram key: the OpenVPN
// server, five OpenVPN clients, the WireGuard server and five WireGuard
// clients, IPsec (shown, gated) and the VPN Director switch.
import { L, ON_OFF } from "../kit.mjs";

export const ID = "vpn-pro";
export const UNITS = [1, 2, 3, 4, 5];
const NOTE = L("This setting name is the one recent ASUS and Merlin builds use; confirm it on your model after applying.", "呢個設定名稱係近期 ASUS 同 Merlin 版本用嘅；套用後請喺你部機確認。");
const KEY_NOTE = L("Stored as a single line the way the router keeps it. Never shown in plain text.", "以單行方式儲存，同路由器一樣。唔會以純文字顯示。");

const base = (id, group, groupLabel, key, control, label, help, extra = {}) => ({ id: `${ID}.${id}`, domain: ID, group, groupLabel, key, control, label, help, risk: "low", ...extra });

const MASKS = [
  ["255.255.255.0", "/24", "254 devices", "254 部裝置"],
  ["255.255.255.128", "/25", "126 devices", "126 部裝置"],
  ["255.255.255.192", "/26", "62 devices", "62 部裝置"],
  ["255.255.254.0", "/23", "510 devices", "510 部裝置"],
].map(([value, prefix, en, yue]) => [value, L(prefix, prefix), L(en, yue)]);

export function serverEntries() {
  const g = L("OpenVPN server", "OpenVPN 伺服器");
  const o = { restart: "restart_vpnd", requires: "openvpnd" };
  return [
    base("ovpn.subnet", "ovpn-server", g, "vpn_server1_sn", "ipv4", L("VPN network address", "VPN 網絡地址"), L("The address range given to people who connect. It must not overlap your home network. Together with the size below it makes the VPN network, for example 192.0.2.0/24.", "分配畀連線者嘅地址範圍，唔可以同屋企網絡重疊。同下面嘅大小合埋就係 VPN 網絡，例如 192.0.2.0/24。"), o),
    base("ovpn.size", "ovpn-server", g, "vpn_server1_nm", "select", L("VPN network size", "VPN 網絡大小"), L("How many devices can be connected at the same time.", "最多可以同時連線幾多部裝置。"), { ...o, options: MASKS }),
    base("ovpn.lan", "ovpn-server", g, "vpn_server1_plan", "switch", L("Let connected devices reach the home network", "等連線嘅裝置可以用屋企網絡"), L("Adds a route to your home network on each device that connects.", "喺每部連線嘅裝置加入通往屋企網絡嘅路由。"), { ...o, values: ON_OFF }),
    base("ovpn.c2c", "ovpn-server", g, "vpn_server1_c2c", "switch", L("Let connected devices see each other", "等連線嘅裝置互相睇到"), L("Devices on the VPN can reach one another, not only the home network.", "VPN 上嘅裝置可以互相連線，唔止屋企網絡。"), { ...o, values: ON_OFF }),
    base("ovpn.dns", "ovpn-server", g, "vpn_server1_pdns", "switch", L("Give connected devices the router's DNS", "派路由器嘅 DNS 畀連線嘅裝置"), L("Names are looked up through the router while connected.", "連線時用路由器嚟查詢名稱。"), { ...o, values: ON_OFF }),
    base("ovpn.cipher", "ovpn-server", g, "vpn_server1_cipher", "select", L("Encryption", "加密方式"), L("AES-256-GCM is a strong, fast choice. Older devices may need AES-128-CBC.", "AES-256-GCM 夠強又夠快。較舊嘅裝置可能要用 AES-128-CBC。"), { ...o, options: [["AES-128-CBC", L("AES-128-CBC", "AES-128-CBC"), L("Works everywhere", "到處都用得")], ["AES-256-CBC", L("AES-256-CBC", "AES-256-CBC"), L("Stronger key", "較強嘅金鑰")], ["AES-128-GCM", L("AES-128-GCM", "AES-128-GCM"), L("Fast and modern", "又快又新")], ["AES-256-GCM", L("AES-256-GCM", "AES-256-GCM"), L("Strong and modern", "又強又新")]] }),
    base("ovpn.comp", "ovpn-server", g, "vpn_server1_comp", "select", L("Compression", "壓縮"), L("Off is safest. Compression can leak information about what is sent.", "關閉最安全。壓縮可能洩露傳送內容嘅資訊。"), { ...o, options: [["-1", L("Off (recommended)", "關閉（建議）")], ["adaptive", L("Adaptive", "自動調整")], ["lz4-v2", L("LZ4", "LZ4")]] }),
    base("ovpn.userpass", "ovpn-server", g, "vpn_server1_userpass_auth", "switch", L("Ask for a user name and password", "要求用戶名稱同密碼"), L("People sign in with an account below as well as their key.", "除咗金鑰，連線者仲要用下面嘅帳戶登入。"), { ...o, values: ON_OFF }),
    base("ovpn.users", "ovpn-server", g, "vpn_server1_clientlist", "file", L("VPN accounts", "VPN 帳戶"), L("The accounts that may sign in when a password is asked for. Managed from the account list, never shown as plain text.", "要求密碼時可以登入嘅帳戶。由帳戶清單管理，唔會以純文字顯示。"), { ...o, secret: true, optional: true, maxLength: 2048, meta: { note: KEY_NOTE } }),
  ];
}

const CLIENT_RGW = [["0", L("Only the listed devices or sites", "只限列出嘅裝置或網站")], ["1", L("All internet traffic", "所有互聯網流量")], ["2", L("Policy rules (VPN Director)", "按規則（VPN Director）")]];

export function clientEntries() {
  const out = [
    base("ovpnc.start", "ovpnc-start", L("OpenVPN clients at start-up", "OpenVPN 客戶端開機連線"), "vpn_clientx_eas", "chips", L("Connect these clients when the router starts", "路由器開機時連線呢啲客戶端"), L("Each client you choose reconnects by itself after a restart.", "你揀咗嘅客戶端會喺重啟後自動重新連線。"), { requires: "openvpnd", optional: true, delimiter: ",", maxItems: 5, options: UNITS.map((n) => [String(n), L(`Client ${n}`, `客戶端 ${n}`)]), meta: { note: NOTE } }),
  ];
  for (const n of UNITS) {
    const g = L(`OpenVPN client ${n}`, `OpenVPN 客戶端 ${n}`);
    const o = { restart: `restart_vpnclient${n}`, requires: "openvpnd" };
    out.push(
      base(`ovpnc${n}.desc`, `ovpnc${n}`, g, `vpn_client${n}_desc`, "text", L("Name", "名稱"), L("A name so you can tell the clients apart.", "方便你分辨各個客戶端嘅名稱。"), { ...o, freeText: true, freeTextReason: "A connection name is a free label chosen by the person.", maxLength: 32, hint: L("Up to 32 characters", "最多 32 個字") }),
      base(`ovpnc${n}.addr`, `ovpnc${n}`, g, `vpn_client${n}_addr`, "hostname", L("Server address", "伺服器地址"), L("The VPN provider's server name or address.", "VPN 供應商嘅伺服器名稱或地址。"), { ...o, optional: true }),
      base(`ovpnc${n}.port`, `ovpnc${n}`, g, `vpn_client${n}_port`, "port", L("Server port", "伺服器端口"), L("1194 is the usual port; some providers use 443.", "通常用 1194；部分供應商用 443。"), { ...o, min: 1, max: 65535, presets: [["1194", L("Usual", "常用")], ["443", L("Looks like web traffic", "似網頁流量")]] }),
      base(`ovpnc${n}.proto`, `ovpnc${n}`, g, `vpn_client${n}_proto`, "segmented", L("Protocol", "協定"), L("UDP is faster. TCP passes strict networks.", "UDP 較快。TCP 較易穿過嚴格網絡。"), { ...o, options: [["udp", L("UDP", "UDP")], ["tcp-client", L("TCP", "TCP")]] }),
      base(`ovpnc${n}.rgw`, `ovpnc${n}`, g, `vpn_client${n}_rgw`, "select", L("What goes through the VPN", "邊啲流量經 VPN"), L("Choose all traffic, or let VPN Director rules decide device by device.", "揀全部流量，或者由 VPN Director 規則逐部裝置決定。"), { ...o, options: CLIENT_RGW }),
      base(`ovpnc${n}.user`, `ovpnc${n}`, g, `vpn_client${n}_username`, "text", L("Account name", "帳戶名稱"), L("The user name your VPN provider gave you, if it asks for one.", "VPN 供應商畀你嘅用戶名稱（如有要求）。"), { ...o, freeText: true, freeTextReason: "The account name comes from the VPN provider and has no fixed format.", maxLength: 64, hint: L("Leave empty if the provider uses a key only", "如果供應商只用金鑰就留空") }),
      base(`ovpnc${n}.password`, `ovpnc${n}`, g, `vpn_client${n}_password`, "password", L("Account password", "帳戶密碼"), L("Stored on the router and never shown again.", "儲存喺路由器，之後唔會再顯示。"), { ...o, secret: true, minLength: 0, maxLength: 64 }),
    );
  }
  return out;
}

export function wireguardEntries() {
  const g = L("WireGuard server", "WireGuard 伺服器");
  const o = { restart: "restart_wgs", requires: "wireguard" };
  const out = [
    base("wg.address", "wg-server", g, "wgs_addr", "cidr", L("WireGuard network", "WireGuard 網絡"), L("The router's own address on the VPN and the size of the VPN network, for example 192.0.2.1/24. It must not overlap your home network.", "路由器喺 VPN 上嘅地址同 VPN 網絡大小，例如 192.0.2.1/24。唔可以同屋企網絡重疊。"), { ...o, minPrefix: 16, maxPrefix: 30 }),
    base("wg.dns", "wg-server", g, "wgs_dns", "ipv4", L("DNS for connected devices", "連線裝置用嘅 DNS"), L("Usually the router itself. Leave empty to let each device choose.", "通常係路由器自己。留空就由各裝置自己揀。"), { ...o, optional: true }),
    base("wg.lan", "wg-server", g, "wgs_lanaccess", "switch", L("Let connected devices reach the home network", "等連線嘅裝置可以用屋企網絡"), L("Without this they can only reach the router and each other.", "冇呢項，佢哋只可以連到路由器同互相連線。"), { ...o, values: ON_OFF }),
    base("wg.public", "wg-server", g, "wgs_pub", "text", L("Router public key", "路由器公開金鑰"), L("Each phone or laptop needs this key. It is made for you and is safe to share.", "每部手機或電腦都需要呢條金鑰。已經幫你建立，可以安心分享。"), { ...o, readOnly: true, freeText: true, freeTextReason: "A public key is generated by the router and only shown.", maxLength: 64, hint: L("Read only", "只讀") }),
    base("wg.private", "wg-server", g, "wgs_priv", "password", L("Router private key", "路由器私密金鑰"), L("Made by the router and never shown. It cannot be changed here.", "由路由器建立，唔會顯示，亦唔可以喺度改。"), { ...o, secret: true, readOnly: true, minLength: 0, maxLength: 64 }),
    base("wg.peers", "wg-server", g, "wgs_clientlist", "file", L("WireGuard devices", "WireGuard 裝置"), L("The phones and laptops that may connect, with their keys. Managed from the device list, never shown as plain text.", "可以連線嘅手機同電腦同佢哋嘅金鑰。由裝置清單管理，唔會以純文字顯示。"), { ...o, secret: true, optional: true, maxLength: 4096, meta: { note: KEY_NOTE } }),
  ];
  for (const n of UNITS) {
    const cg = L(`WireGuard client ${n}`, `WireGuard 客戶端 ${n}`);
    const c = { restart: `restart_wgc ${n}`, requires: "wireguard", firmware: "merlin", meta: { note: NOTE } };
    out.push(
      base(`wgc${n}.enable`, `wgc${n}`, cg, `wgc${n}_enable`, "switch", L("Connect", "連線"), L("Connects this router to a WireGuard provider.", "將路由器連去 WireGuard 供應商。"), { ...c, values: ON_OFF }),
      base(`wgc${n}.address`, `wgc${n}`, cg, `wgc${n}_addr`, "cidr", L("Address given by the provider", "供應商分配嘅地址"), L("The address the provider gave this router, with its size.", "供應商分配畀呢部路由器嘅地址同大小。"), { ...c, minPrefix: 8, maxPrefix: 32 }),
      base(`wgc${n}.private`, `wgc${n}`, cg, `wgc${n}_priv`, "password", L("Router private key", "路由器私密金鑰"), L("From the provider's configuration. Stored on the router and never shown again.", "來自供應商嘅設定。儲存喺路由器，之後唔會再顯示。"), { ...c, secret: true, minLength: 0, maxLength: 64 }),
      base(`wgc${n}.public`, `wgc${n}`, cg, `wgc${n}_ppub`, "text", L("Provider public key", "供應商公開金鑰"), L("The PublicKey line of the provider's configuration.", "供應商設定入面嘅 PublicKey 一行。"), { ...c, freeText: true, freeTextReason: "A public key is an opaque value pasted from the provider's configuration.", maxLength: 44, hint: L("44 characters ending in =", "44 個字元，最後係 =") }),
      base(`wgc${n}.host`, `wgc${n}`, cg, `wgc${n}_ep_addr`, "hostname", L("Provider server", "供應商伺服器"), L("The server name or address from the Endpoint line.", "Endpoint 一行入面嘅伺服器名稱或地址。"), { ...c, optional: true }),
      base(`wgc${n}.port`, `wgc${n}`, cg, `wgc${n}_ep_port`, "port", L("Provider port", "供應商端口"), L("The port from the Endpoint line. 51820 is the usual one.", "Endpoint 一行入面嘅端口，通常係 51820。"), { ...c, min: 1, max: 65535, presets: [["51820", L("Usual", "常用")]] }),
      base(`wgc${n}.allowed`, `wgc${n}`, cg, `wgc${n}_aips`, "text", L("What goes through the VPN", "邊啲流量經 VPN"), L("The AllowedIPs line of the provider's configuration. 0.0.0.0/0 sends everything.", "供應商設定入面嘅 AllowedIPs 一行。0.0.0.0/0 即係全部流量。"), { ...c, freeText: true, freeTextReason: "A list of networks written exactly as the provider gives it.", maxLength: 255, hint: L("Networks separated by commas", "網絡之間用逗號分隔") }),
      base(`wgc${n}.dns`, `wgc${n}`, cg, `wgc${n}_dns`, "ipv4", L("DNS from the provider", "供應商嘅 DNS"), L("Leave empty to keep the router's own DNS.", "留空就繼續用路由器自己嘅 DNS。"), { ...c, optional: true }),
    );
  }
  return out;
}

export function otherEntries() {
  return [
    base("ipsec", "ipsec", L("IPsec VPN server", "IPsec VPN 伺服器"), "ipsec_server_enable", "switch", L("IPsec VPN server", "IPsec VPN 伺服器"), L("For phones and computers that use the built-in IPsec client. Only some router models include it.", "供使用內置 IPsec 客戶端嘅手機同電腦。只有部分型號有。"), { values: ON_OFF, restart: "restart_ipsec", requires: "ipsec_srv", meta: { note: NOTE } }),
    base("director", "director", L("VPN Director", "VPN Director"), "vpndirector_enable", "switch", L("Send chosen devices through a VPN", "揀定嘅裝置經 VPN 上網"), L("Turns on the per-device rules below. A client must be set to follow policy rules for its rules to work.", "開啟下面逐部裝置嘅規則。客戶端要設定為跟規則，規則先會生效。"), { values: ON_OFF, firmware: "merlin", restart: "restart_vpnrouting0", meta: { note: NOTE } }),
  ];
}

export const catalog = () => [...serverEntries(), ...clientEntries(), ...wireguardEntries(), ...otherEntries()];
