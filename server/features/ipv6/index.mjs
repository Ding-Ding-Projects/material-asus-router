// IPv6: native (DHCPv6 with prefix delegation), passthrough, 6in4, 6rd and
// static, with the prefix, the name servers and the DHCPv6 and router
// advertisement settings for the home network. Every setting reads the
// router's own value and is written through the change engine.
import { L, ON_OFF } from "../kit.mjs";

const F = "ipv6";
const G = {
  service: { group: "service", groupLabel: L("IPv6 connection", "IPv6 連線") },
  native: { group: "native", groupLabel: L("Native IPv6", "原生 IPv6") },
  fixed: { group: "fixed", groupLabel: L("Fixed IPv6 address", "固定 IPv6 地址") },
  tunnel: { group: "tunnel", groupLabel: L("6in4 tunnel", "6in4 隧道") },
  sixrd: { group: "sixrd", groupLabel: L("6rd", "6rd") },
  dns: { group: "dns", groupLabel: L("IPv6 name servers", "IPv6 域名伺服器") },
  lan: { group: "lan", groupLabel: L("Home network prefix", "屋企網絡前綴") },
  clients: { group: "clients", groupLabel: L("How devices get addresses", "裝置點樣攞地址") },
};

// ---- IPv6 text: parse, compress, classify -------------------------------------

// Eight 16-bit numbers for a valid address, otherwise null.
export function parseIpv6(text) {
  if (!/^[0-9A-Fa-f:]{2,39}$/.test(text)) return null;
  const parts = text.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const groups = [...head, ...tail];
  if (groups.some((g) => !/^[0-9A-Fa-f]{1,4}$/.test(g))) return null;
  if (parts.length === 1 ? groups.length !== 8 : groups.length > 7) return null;
  return [...head, ...(parts.length === 2 ? new Array(8 - groups.length).fill("0") : []), ...tail].map((g) => parseInt(g, 16));
}

// The shortest standard spelling: lower case, leading zeros dropped, the longest run of zeros as "::".
export function compressIpv6(words) {
  let best = { start: -1, length: 0 };
  for (let i = 0; i < 8; ) {
    if (words[i] !== 0) { i += 1; continue; }
    let j = i;
    while (j < 8 && words[j] === 0) j += 1;
    if (j - i > best.length) best = { start: i, length: j - i };
    i = j;
  }
  const hex = words.map((w) => w.toString(16));
  if (best.length < 2) return hex.join(":");
  return `${hex.slice(0, best.start).join(":")}::${hex.slice(best.start + best.length).join(":")}`;
}

export const expandIpv6 = (words) => words.map((w) => w.toString(16).padStart(4, "0")).join(":");

export function kindOfIpv6(words) {
  if (words.every((w) => w === 0)) return "unspecified";
  if (words.slice(0, 7).every((w) => w === 0) && words[7] === 1) return "loopback";
  if (words[0] === 0x2001 && words[1] === 0x0db8) return "documentation";
  if ((words[0] & 0xffc0) === 0xfe80) return "link-local";
  if ((words[0] & 0xfe00) === 0xfc00) return "unique-local";
  if ((words[0] & 0xff00) === 0xff00) return "multicast";
  return "global";
}

const ipv6Control = {
  validate(entry, text, fail) {
    if (entry.optional && text === "") return "";
    const words = parseIpv6(text);
    if (!words) fail("enter an IPv6 address such as 2001:db8::1.");
    return compressIpv6(words);
  },
  sample: (_entry, current) => (current === "2001:db8:10::1" ? "2001:db8:20::1" : "2001:db8:10::1"),
  invalid: () => "2001:db8::zz",
};

// The host part of a DHCPv6 pool address: one to four hexadecimal digits.
const hexControl = {
  validate(entry, text, fail) {
    if (!/^[0-9A-Fa-f]{1,4}$/.test(text)) fail("enter one to four hexadecimal digits, such as 1000.");
    return text.toLowerCase();
  },
  sample: (_entry, current) => (current === "1100" ? "1200" : "1100"),
  invalid: () => "xyz!",
};

const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${F}.${id}`, domain: F, ...group, key, control, label, help, ...extra });
const wan = { risk: "network", restart: "restart_wan_if 0" };
const lan = { risk: "network", restart: "restart_dnsmasq" };
const rule = (id, values) => ({ id: `${F}.${id}`, in: values });
const ON = ["dhcp6", "static6", "6in4", "6rd", "6to4", "flets"];
const on = (...more) => [[rule("service", ON), ...more]];
const only = (...values) => ({ showWhen: { id: `${F}.service`, in: values } });
const read = (nvram, key) => nvram.get(key) ?? "";

export default {
  id: F,

  catalog: () => [
    e("service", G.service, "ipv6_service", "select", L("IPv6 connection type", "IPv6 連線類型"), L("Native works when your provider gives IPv6. The others are for tunnels, forwarding to another router, or a fixed address.", "供應商有提供 IPv6 就用原生。其他係俾隧道、轉交另一部路由器或者固定地址用。"), {
      ...wan,
      options: [
        ["disabled", L("Off", "關閉"), L("No IPv6. Devices use IPv4 only.", "冇 IPv6，裝置只用 IPv4。")],
        ["dhcp6", L("Native (DHCPv6, with prefix delegation)", "原生（DHCPv6，連前綴委派）"), L("The provider hands out the address and a prefix for your home.", "供應商派地址同一段屋企用嘅前綴。")],
        ["static6", L("Fixed IPv6 address", "固定 IPv6 地址"), L("You type the address, prefix and gateway.", "自己輸入地址、前綴同網關。")],
        ["ipv6pt", L("Passthrough", "穿透"), L("Pass IPv6 to a device behind the router, which does the work.", "將 IPv6 轉俾路由器後面嘅裝置處理。")],
        ["6in4", L("6in4 tunnel", "6in4 隧道"), L("Carry IPv6 inside IPv4 to a tunnel provider.", "透過 IPv4 將 IPv6 送去隧道供應商。")],
        ["6rd", L("6rd", "6rd"), L("A provider's own way to carry IPv6 over IPv4.", "供應商透過 IPv4 傳送 IPv6 嘅方法。")],
        ["6to4", L("6to4", "6to4"), L("Automatic tunnel through a public relay.", "經公共中繼自動建立嘅隧道。")],
        ["flets", L("FLET'S IPv6", "FLET'S IPv6"), L("The service used by NTT East and West in Japan.", "日本 NTT 東西日本使用嘅服務。")],
      ],
      meta: { note: L("Which connection types appear depends on the model.", "有邊啲連線類型視乎型號。") },
    }),

    e("pd", G.native, "ipv6_dhcp_pd", "switch", L("Ask for a prefix for the home network", "要求一段屋企網絡用嘅前綴"), L("Needed so every device at home gets its own IPv6 address. Leave on.", "要有佢，屋企每部裝置先會有自己嘅 IPv6 地址。請保持開住。"), { values: ON_OFF, ...wan, meta: only("dhcp6") }),
    e("pd-length", G.native, "ipv6_dhcp_pd_len", "select", L("Prefix length to ask for", "要求嘅前綴長度"), L("Let the provider choose unless it told you a size.", "除非供應商指定咗大小，否則由供應商決定。"), {
      ...wan, meta: { ...only("dhcp6"), note: L("The key name ipv6_dhcp_pd_len is not confirmed on every firmware build.", "ipv6_dhcp_pd_len 呢個鍵名未必每個韌體版本都一樣。") },
      options: [["0", L("Let the provider choose", "由供應商決定")], ["48", L("/48", "/48")], ["56", L("/56", "/56")], ["60", L("/60", "/60")], ["64", L("/64", "/64")]],
    }),

    e("address", G.fixed, "ipv6_ipaddr", "ipv6addr", L("IPv6 address", "IPv6 地址"), L("The address your provider gave the router.", "供應商俾路由器嘅地址。"), { optional: true, ...wan, meta: only("static6") }),
    e("wan-prefix", G.fixed, "ipv6_prefix_len_wan", "stepper", L("Prefix length", "前綴長度"), L("How many leading bits are the network. 64 is common.", "頭幾多個位元係網絡部分。64 最常見。"), { min: 1, max: 128, unit: "bits", ...wan, meta: only("static6") }),
    e("gateway", G.fixed, "ipv6_gateway", "ipv6addr", L("Gateway", "網關"), L("The provider's router.", "供應商嘅路由器。"), { optional: true, ...wan, meta: only("static6") }),

    e("tun-end", G.tunnel, "ipv6_tun_v4end", "ipv4", L("Tunnel server (IPv4)", "隧道伺服器（IPv4）"), L("The IPv4 address of your tunnel provider's server.", "隧道供應商伺服器嘅 IPv4 地址。"), { optional: true, ...wan, meta: only("6in4") }),
    e("tun-address", G.tunnel, "ipv6_tun_addr", "ipv6addr", L("Your end of the tunnel", "隧道你呢端"), L("The IPv6 address of the router's end of the tunnel.", "隧道路由器呢端嘅 IPv6 地址。"), { optional: true, ...wan, meta: only("6in4") }),
    e("tun-length", G.tunnel, "ipv6_tun_addrlen", "stepper", L("Tunnel prefix length", "隧道前綴長度"), L("Usually 64.", "通常係 64。"), { min: 1, max: 128, unit: "bits", ...wan, meta: only("6in4") }),
    e("tun-mtu", G.tunnel, "ipv6_tun_mtu", "stepper", L("Tunnel MTU", "隧道 MTU"), L("The largest packet through the tunnel. 1480 is the usual limit.", "隧道可以傳送嘅最大封包。通常上限係 1480。"), { min: 1280, max: 1480, unit: "bytes", ...wan, meta: only("6in4") }),
    e("tun-ttl", G.tunnel, "ipv6_tun_ttl", "stepper", L("Tunnel TTL", "隧道 TTL"), L("How many hops a tunnelled packet may take.", "隧道封包可以經過幾多跳。"), { min: 1, max: 255, unit: "hops", ...wan, meta: only("6in4") }),

    e("6rd-auto", G.sixrd, "ipv6_6rd_dhcp", "switch", L("Get the 6rd settings from the provider", "由供應商攞 6rd 設定"), L("Leave on if your provider sends them automatically.", "供應商自動發送就保持開住。"), { values: ON_OFF, ...wan, meta: only("6rd") }),
    e("6rd-prefix", G.sixrd, "ipv6_6rd_prefix", "ipv6addr", L("6rd prefix", "6rd 前綴"), L("The provider's 6rd prefix.", "供應商嘅 6rd 前綴。"), { optional: true, ...wan, meta: { showWhen: [[rule("service", ["6rd"]), rule("6rd-auto", ["0"])]] } }),
    e("6rd-length", G.sixrd, "ipv6_6rd_prefixlen", "stepper", L("6rd prefix length", "6rd 前綴長度"), L("How long the provider's prefix is.", "供應商前綴有幾長。"), { min: 1, max: 64, unit: "bits", ...wan, meta: { showWhen: [[rule("service", ["6rd"]), rule("6rd-auto", ["0"])]] } }),
    e("6rd-relay", G.sixrd, "ipv6_6rd_router", "ipv4", L("Border relay (IPv4)", "邊界中繼（IPv4）"), L("The provider's relay address.", "供應商嘅中繼地址。"), { optional: true, ...wan, meta: { showWhen: [[rule("service", ["6rd"]), rule("6rd-auto", ["0"])]] } }),
    e("6rd-ip4", G.sixrd, "ipv6_6rd_ip4size", "stepper", L("IPv4 bits to copy", "要複製嘅 IPv4 位元"), L("How many bits of your IPv4 address go into the IPv6 prefix. 0 means all.", "你嘅 IPv4 地址有幾多個位元會放入 IPv6 前綴。0 代表全部。"), { min: 0, max: 32, unit: "bits", ...wan, meta: { showWhen: [[rule("service", ["6rd"]), rule("6rd-auto", ["0"])]] } }),

    e("dns-auto", G.dns, "ipv6_dnsenable", "switch", L("Get the name servers automatically", "自動攞域名伺服器"), L("Turn off to use your own, such as Cloudflare's 2606:4700:4700::1111.", "關咗就用自己揀嘅，例如 Cloudflare 嘅 2606:4700:4700::1111。"), { values: ON_OFF, ...wan, meta: { showWhen: on() } }),
    ...[1, 2, 3].map((n) => e(`dns${n}`, G.dns, `ipv6_dns${n}`, "ipv6addr", L(`IPv6 name server ${n}`, `IPv6 域名伺服器 ${n}`), L("Used when the automatic ones are off.", "自動模式關咗先會用。"), { optional: true, ...wan, meta: { showWhen: on(rule("dns-auto", ["0"])) } })),

    e("router-address", G.lan, "ipv6_rtr_addr", "ipv6addr", L("Router address on the home network", "路由器喺屋企網絡嘅地址"), L("The router's own IPv6 address for your devices.", "路由器對屋企裝置用嘅 IPv6 地址。"), { optional: true, ...wan, meta: only("static6") }),
    e("lan-prefix", G.lan, "ipv6_prefix", "ipv6addr", L("Home network prefix", "屋企網絡前綴"), L("The prefix your provider or tunnel routes to you. Devices get addresses inside it.", "供應商或者隧道分配俾你嘅前綴。裝置嘅地址喺佢裏面。"), { optional: true, ...wan, meta: only("static6", "6in4") }),
    e("lan-prefix-length", G.lan, "ipv6_prefix_length", "segmented", L("Home prefix length", "屋企前綴長度"), L("64 is right for nearly every home.", "差唔多所有屋企都用 64。"), {
      ...wan, meta: only("static6", "6in4"),
      options: [["48", L("/48", "/48")], ["56", L("/56", "/56")], ["60", L("/60", "/60")], ["64", L("/64", "/64")]],
    }),

    e("autoconf", G.clients, "ipv6_autoconf_type", "segmented", L("How devices get an address", "裝置點樣攞地址"), L("Automatic (SLAAC) needs nothing more. DHCPv6 hands out addresses from a pool, which some devices need.", "自動（SLAAC）唔使再設定。DHCPv6 就由地址池派地址，有啲裝置需要。"), {
      ...lan, meta: { showWhen: on() },
      options: [["0", L("Automatic (SLAAC)", "自動（SLAAC）")], ["1", L("DHCPv6 pool", "DHCPv6 地址池")]],
    }),
    e("pool-start", G.clients, "ipv6_dhcp_start", "hexpart", L("Pool starts at", "地址池由"), L("The last part of the first address in the pool, in hexadecimal. 1000 is the usual start.", "地址池第一個地址嘅尾段，十六進制。通常由 1000 開始。"), { ...lan, meta: { showWhen: on(rule("autoconf", ["1"])) } }),
    e("pool-end", G.clients, "ipv6_dhcp_end", "hexpart", L("Pool ends at", "地址池到"), L("The last part of the last address in the pool, in hexadecimal. 2000 is the usual end.", "地址池最後一個地址嘅尾段，十六進制。通常到 2000。"), { ...lan, meta: { showWhen: on(rule("autoconf", ["1"])) } }),
    e("lease", G.clients, "ipv6_dhcp_lifetime", "number", L("Lease time", "租用時間"), L("How long a device keeps its address before asking again.", "裝置用住個地址幾耐先再問。"), { min: 600, max: 604800, unit: "s", ...lan, meta: { showWhen: on(rule("autoconf", ["1"])) } }),
  ],

  controls: { ipv6addr: ipv6Control, hexpart: hexControl },

  domainMeta: [{ id: F, icon: "language", label: L("IPv6", "IPv6"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [F]: async (ctx) => {
      const n = ctx.nvram;
      return {
        service: read(n, "ipv6_service"),
        firewall: read(n, "ipv6_fw_enable") === "1",
        runtime: { wanAddress: read(n, "ipv6_wan_addr"), lanPrefix: read(n, "ipv6_prefix") },
        entries: ctx.entries(),
        inProgress: [],
      };
    },
  },

  routes(api) {
    // Says what an IPv6 address means, so the browser never has to guess.
    api.post("/check-address", async ({ body }) => {
      const words = parseIpv6(String(body.address ?? "").trim());
      if (!words) return { valid: false };
      return { valid: true, compressed: compressIpv6(words), expanded: expandIpv6(words), kind: kindOfIpv6(words) };
    });
  },

  fakeRouter: {
    nvram: {
      ipv6_service: "disabled", ipv6_dhcp_pd: "1", ipv6_dhcp_pd_len: "0",
      ipv6_ipaddr: "", ipv6_prefix_len_wan: "64", ipv6_gateway: "",
      ipv6_tun_v4end: "", ipv6_tun_addr: "", ipv6_tun_addrlen: "64", ipv6_tun_mtu: "1480", ipv6_tun_ttl: "255",
      ipv6_6rd_dhcp: "1", ipv6_6rd_prefix: "", ipv6_6rd_prefixlen: "32", ipv6_6rd_router: "", ipv6_6rd_ip4size: "0",
      ipv6_dnsenable: "1", ipv6_dns1: "", ipv6_dns2: "", ipv6_dns3: "",
      ipv6_rtr_addr: "", ipv6_prefix: "", ipv6_prefix_length: "64",
      ipv6_autoconf_type: "0", ipv6_dhcp_start: "1000", ipv6_dhcp_end: "2000", ipv6_dhcp_lifetime: "86400", ipv6_wan_addr: "",
    },
  },
};
