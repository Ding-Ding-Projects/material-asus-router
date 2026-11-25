// VPN clients, in depth: the tunnel details of each OpenVPN client slot the router really has (the keys
// vpn_client1_..., vpn_client2_... and so on), beside the server address, port and sign-in that the VPN screen
// already holds. Encryption and compression, how loud the log is, how often the key is renewed and how often
// to retry, what the tunnel may do (NAT, inbound firewall, the kill switch, DNS) and how it signs in.
//
// One block per slot, found from the router's own settings list. Certificates and keys are not written here.
import { L, ON_OFF } from "../kit.mjs";

const F = "vpn-clients-pro";
const DEMO_SLOTS = 5;

const CIPHERS = [
  ["default", L("Let the server choose", "由伺服器決定"), L("Uses what the server and the client agree on.", "用伺服器同用戶端協商嘅設定。")],
  ["AES-128-CBC", L("AES-128-CBC", "AES-128-CBC")],
  ["AES-256-CBC", L("AES-256-CBC", "AES-256-CBC")],
  ["AES-128-GCM", L("AES-128-GCM", "AES-128-GCM")],
  ["AES-256-GCM", L("AES-256-GCM", "AES-256-GCM")],
];
const COMPRESSION = [
  ["-1", L("Off", "關"), L("No compression. The safe choice.", "唔壓縮，最穩陣。")],
  ["no", L("None, but accept it", "唔壓縮，但接受對方壓縮"), L("Sends plain, understands compressed.", "自己唔壓縮，但睇得明對方壓縮。")],
  ["adaptive", L("Adaptive", "自動調整"), L("Compresses only when it helps.", "有幫助先壓縮。")],
  ["yes", L("Always", "一律壓縮"), L("Compresses everything.", "全部壓縮。")],
  ["lz4", L("LZ4", "LZ4"), L("A fast compressor.", "快速壓縮。")],
];
const DNS_MODES = [
  ["0", L("Ignore the server's DNS", "唔理伺服器嘅 DNS")],
  ["1", L("Relaxed", "寬鬆"), L("Use the server's DNS alongside yours.", "同你自己嘅 DNS 一齊用。")],
  ["2", L("Strict", "嚴格"), L("Use the server's DNS first.", "優先用伺服器嘅 DNS。")],
  ["3", L("Exclusive", "獨佔"), L("Use only the server's DNS.", "淨係用伺服器嘅 DNS。")],
];

// Slot numbers the router really has, from its own list of settings.
export const slotsOf = (info) => [...(info.settingKeys ?? [])].map((key) => /^vpn_client([1-9]\d*)_state$/.exec(key)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);

export function slotEntries(n) {
  const p = `vpn_client${n}`;
  const g = (id, en, yue) => ({ group: `client${n}-${id}`, groupLabel: L(`VPN client ${n}: ${en}`, `VPN 用戶端 ${n}：${yue}`) });
  const e = (group, id, key, extra) => ({ id: `${F}.client${n}.${id}`, key: `${p}_${key}`, ...g(...group), restart: `restart_vpnclient${n}`, risk: "network", firmware: "merlin", ...extra });
  const secure = ["secure", "Encryption", "加密"];
  const tunnel = ["tunnel", "Keeping the tunnel up", "維持隧道"];
  const rules = ["rules", "What the tunnel may do", "隧道可以做咩"];
  const login = ["login", "Signing in", "登入"];
  return [
    e(secure, "cipher", "cipher", { control: "select", options: CIPHERS, label: L("Encryption cipher", "加密方式"), help: L("How the tunnel is scrambled. It must be one the server accepts.", "隧道點樣加密。一定要係伺服器接受嘅。") }),
    e(secure, "comp", "comp", { control: "select", options: COMPRESSION, label: L("Compression", "壓縮"), help: L("Compression can leak information, so leave it off unless the provider needs it.", "壓縮有機會洩露資料，除非供應商要求，否則關閉。") }),
    e(tunnel, "verb", "verb", { control: "stepper", min: 0, max: 11, label: L("How much the log says", "記錄詳細程度"), help: L("0 says almost nothing, 3 is normal, higher numbers are for fixing a problem.", "0 幾乎冇記錄，3 係一般，數字高係為咗搵問題。") }),
    e(tunnel, "reneg", "reneg", { control: "stepper", min: -1, max: 604800, unit: " s", label: L("Renew the key every", "幾耐更新一次密鑰"), help: L("-1 follows the server. A shorter time is safer and drops a moment of traffic each time.", "-1 跟伺服器。時間短啲更安全，但每次會中斷一陣。") }),
    e(tunnel, "retry", "connretry", { control: "stepper", min: -1, max: 999, unit: " tries", label: L("Retry the connection", "重試連線次數"), help: L("How many times to try again after the tunnel drops. -1 keeps trying.", "隧道斷咗之後重試幾次。-1 即係一直試。") }),
    e(rules, "nat", "nat", { control: "switch", values: ON_OFF, label: L("Share the tunnel with the home network (NAT)", "同屋企網絡共用隧道（NAT）"), help: L("Needed so devices at home can use the tunnel. Leave on unless the provider routes your network.", "要開，屋企裝置先用到隧道。除非供應商有路由你嘅網絡，否則保持開住。") }),
    e(rules, "fw", "fw", { control: "switch", values: ON_OFF, label: L("Block unwanted traffic from the tunnel", "擋住隧道嚟嘅不明流量"), help: L("Stops other tunnel users from reaching your home network.", "防止隧道嘅其他用戶連入你嘅屋企網絡。") }),
    e(rules, "enforce", "enforce", { control: "switch", values: ON_OFF, label: L("Kill switch", "斷線保護"), help: L("If the tunnel drops, devices that use it are cut off instead of going out unprotected.", "隧道斷咗，用緊隧道嘅裝置會被截斷，唔會冇保護咁上網。") }),
    e(rules, "dns", "adns", { control: "select", options: DNS_MODES, label: L("Name servers from the server", "伺服器提供嘅域名伺服器"), help: L("Whether the router uses the DNS the VPN server offers.", "路由器用唔用 VPN 伺服器提供嘅 DNS。") }),
    e(login, "tlsremote", "tlsremote", { control: "switch", values: ON_OFF, label: L("Check the server's name", "檢查伺服器名稱"), help: L("Refuses a server whose certificate does not carry the expected name.", "伺服器證書嘅名稱唔啱就拒絕。") }),
    e(login, "userauth", "userauth", { control: "switch", values: ON_OFF, label: L("Sign in with a user name and password", "用用戶名稱同密碼登入"), help: L("Adds a user name and password on top of the certificate.", "喺證書之外再加用戶名稱同密碼。") }),
    e(login, "useronly", "useronly", { control: "switch", values: ON_OFF, label: L("Sign in with only a user name and password", "淨係用用戶名稱同密碼登入"), help: L("No client certificate is sent. Needs the option above.", "唔發送用戶端證書。要先開上面嘅選項。") }),
  ];
}

const DEMO = { cipher: "default", comp: "-1", verb: "3", reneg: "-1", connretry: "15", nat: "1", fw: "1", enforce: "0", adns: "1", tlsremote: "0", userauth: "0", useronly: "0", state: "0" };

export default {
  id: F,

  catalog: (info) => slotsOf(info).flatMap(slotEntries),

  domainMeta: [{ id: F, icon: "vpn_key", label: L("VPN clients in depth", "VPN 用戶端進階"), group: { en: "Network", yue: "網絡" }, firmware: "merlin" }],
  domains: { [F]: async (ctx) => ({ slots: slotsOf(ctx.info), entries: ctx.entries() }) },

  fakeRouter: {
    nvram: ({ profile }) => (profile ? Object.fromEntries(Array.from({ length: DEMO_SLOTS }, (_, i) => i + 1).flatMap((n) => Object.entries(DEMO).map(([key, value]) => [`vpn_client${n}_${key}`, value]))) : {}),
  },
};
