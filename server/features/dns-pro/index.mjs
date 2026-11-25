// DNS Pro: which name servers the router uses and how safely. Provider or
// custom servers with one-tap presets, DNS over TLS profiles (Merlin), DNSSEC
// and rebinding protection, DNS Director filtering with per-device rules
// (Merlin), and the Dynamic DNS account. The upstream name servers and the
// Dynamic DNS provider and host name are the stock settings; this screen
// draws them beside the extras and writes them through the same change engine.
import { L, ON_OFF, hostTarget } from "../kit.mjs";
import { tableControl } from "./table.mjs";

const F = "dns-pro";
const G = {
  dot: { group: "dot", groupLabel: L("DNS over TLS", "DNS over TLS") },
  safety: { group: "safety", groupLabel: L("Safety checks", "安全檢查") },
  director: { group: "director", groupLabel: L("DNS Director (filtering)", "DNS Director（過濾）") },
  ddns: { group: "ddns", groupLabel: L("Dynamic DNS", "動態 DNS") },
};
const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${F}.${id}`, domain: F, ...group, key, control, label, help, ...extra });
const dns = { risk: "low", restart: "restart_dnsmasq" };
const merlin = { firmware: "merlin" };

// Public resolvers people commonly pick. The addresses are the operators' own published ones.
export const PRESETS = [
  { id: "cloudflare", name: L("Cloudflare", "Cloudflare"), about: L("Fast and does not keep logs of your address.", "快，同埋唔會記錄你嘅地址。"), dns: ["1.1.1.1", "1.0.0.1"], dot: { ip: "1.1.1.1", host: "cloudflare-dns.com" } },
  { id: "google", name: L("Google", "Google"), about: L("Widely available and reliable.", "到處都用得到，穩定。"), dns: ["8.8.8.8", "8.8.4.4"], dot: { ip: "8.8.8.8", host: "dns.google" } },
  { id: "quad9", name: L("Quad9", "Quad9"), about: L("Blocks known harmful sites.", "會擋已知嘅有害網站。"), dns: ["9.9.9.9", "149.112.112.112"], dot: { ip: "9.9.9.9", host: "dns.quad9.net" } },
  { id: "adguard", name: L("AdGuard", "AdGuard"), about: L("Blocks ads and trackers.", "會擋廣告同追蹤。"), dns: ["94.140.14.14", "94.140.15.15"], dot: { ip: "94.140.14.14", host: "dns.adguard-dns.com" } },
  { id: "opendns", name: L("OpenDNS", "OpenDNS"), about: L("Optional filtering by category.", "可以按類別過濾。"), dns: ["208.67.222.222", "208.67.220.220"], dot: null },
];

// Endings people often use for a Dynamic DNS name, by provider.
const SUFFIXES = {
  "WWW.ASUS.COM": ["asuscomm.com", "asuscomm.cn"],
  "WWW.DYNDNS.ORG": ["dyndns.org", "dyndns.info", "dyndns.biz"],
  "WWW.NO-IP.COM": ["ddns.net", "hopto.org", "zapto.org", "sytes.net", "servebeer.com"],
  "DOMAINS.GOOGLE.COM": [],
};

const MODES = [
  ["0", L("The router's own DNS (no filter)", "路由器自己嘅 DNS（唔過濾）")], ["1", L("OpenDNS Home", "OpenDNS Home")], ["2", L("OpenDNS Family Shield", "OpenDNS Family Shield")],
  ["3", L("Yandex Safe", "Yandex Safe")], ["4", L("Yandex Family", "Yandex Family")], ["5", L("AdGuard Default", "AdGuard Default")], ["6", L("AdGuard Family", "AdGuard Family")],
  ["7", L("CleanBrowsing Family", "CleanBrowsing Family")], ["8", L("CleanBrowsing Adult", "CleanBrowsing Adult")], ["9", L("CleanBrowsing Security", "CleanBrowsing Security")],
  ["11", L("Custom server 1", "自訂伺服器 1")], ["12", L("Custom server 2", "自訂伺服器 2")], ["13", L("Custom server 3", "自訂伺服器 3")],
];
const modeNote = { note: L("The mode numbers follow Asuswrt-Merlin 388 DNS Director. Compare them with your firmware's own page if a name looks wrong.", "模式編號跟 Asuswrt-Merlin 388 嘅 DNS Director。如果名稱唔啱，請同韌體自己嘅頁面對比。") };

const read = (nvram, key) => nvram.get(key) ?? "";
const rowOf = (preset) => `<${preset.dot.ip}>853>${preset.dot.host}>`;

export default {
  id: F,

  catalog: () => [
    e("dot-enable", G.dot, "dnspriv_enable", "switch", L("DNS over TLS", "DNS over TLS"), L("Sends your name lookups encrypted, so the line cannot read or change them.", "將域名查詢加密後先送出，線路上面睇唔到亦改唔到。"), { values: ON_OFF, ...merlin, risk: "network", restart: "restart_stubby" }),
    e("dot-profile", G.dot, "dnspriv_profile", "segmented", L("When the encrypted server does not answer", "加密伺服器冇回應嗰陣"), L("Strict refuses to look anything up unencrypted. Opportunistic falls back to ordinary DNS so the internet keeps working.", "嚴格就寧願唔查都唔用未加密。機會式就退返用普通 DNS，上網唔會斷。"), {
      ...merlin, risk: "network", restart: "restart_stubby", meta: { showWhen: { id: `${F}.dot-enable`, in: ["1"] } },
      options: [["0", L("Opportunistic", "機會式"), L("Falls back to ordinary DNS.", "退返用普通 DNS。")], ["1", L("Strict", "嚴格"), L("Never falls back.", "永不退回。")]],
    }),
    e("dot-servers", G.dot, "dnspriv_rulelist", "dotservers", L("Encrypted DNS servers", "加密 DNS 伺服器"), L("The servers to ask. Each needs its address, port (853 is standard) and the name on its certificate.", "要查詢嘅伺服器。每個要有地址、端口（標準係 853）同證書上嘅名稱。"), {
      ...merlin, optional: true, maxItems: 8, risk: "network", restart: "restart_stubby", meta: { showWhen: { id: `${F}.dot-enable`, in: ["1"] } },
      emptyText: L("No servers yet. Pick a preset above or add one.", "未有伺服器。喺上面揀個預設或者加一個。"),
      columns: [
        { id: "ip", label: L("Address", "地址"), kind: "ipv4" },
        { id: "port", label: L("Port", "端口"), kind: "number", min: 1, max: 65535, default: "853" },
        { id: "tls", label: L("Certificate name", "證書名稱"), kind: "hostname" },
        { id: "pin", label: L("Key pin (optional)", "金鑰指紋（可選）"), kind: "text", optional: true, maxLength: 64 },
      ],
    }),

    e("dnssec", G.safety, "dnssec_enable", "switch", L("Check DNSSEC signatures", "檢查 DNSSEC 簽名"), L("Rejects answers that were tampered with, for names that are signed. A few providers break it.", "對有簽名嘅域名，會拒絕被改過嘅答案。有少數供應商會令佢出問題。"), { values: ON_OFF, ...dns }),
    e("dnssec-unsigned", G.safety, "dnssec_check_unsigned_x", "switch", L("Require proof for unsigned names", "要求未簽名域名提供證明"), L("Stricter. Names that claim to be unsigned must prove it. Needs DNSSEC checking on.", "更嚴格。聲稱冇簽名嘅域名要證明。要先開 DNSSEC 檢查。"), { values: ON_OFF, ...dns, meta: { showWhen: { id: `${F}.dnssec`, in: ["1"] } } }),
    e("rebind", G.safety, "dns_norebind", "switch", L("Block DNS rebinding", "阻止 DNS 重綁定"), L("Refuses answers that point an outside name at a device inside your home.", "拒絕將外面域名指去屋企裝置嘅答案。"), { values: ON_OFF, ...dns }),
    e("forward-local", G.safety, "dns_fwd_local", "switch", L("Ask upstream about local names", "本地名稱都向上游查詢"), L("Off keeps names that end in your local domain inside your home. Leave off unless you know you need it.", "關閉就等本地網域嘅名稱留喺屋企。除非你確定需要，否則保持關閉。"), { values: ON_OFF, ...merlin, ...dns }),

    e("director-enable", G.director, "dnsfilter_enable_x", "switch", L("DNS Director", "DNS Director"), L("Filters what devices can look up, with a default and a different choice for chosen devices.", "過濾裝置可以查詢嘅內容，有預設，亦可以為指定裝置另揀。"), { values: ON_OFF, ...merlin, risk: "network", restart: "restart_dnsfilter" }),
    e("director-mode", G.director, "dnsfilter_mode", "select", L("Default filter", "預設過濾"), L("What every device without its own rule gets.", "冇自己規則嘅裝置會用呢個。"), {
      ...merlin, risk: "network", restart: "restart_dnsfilter", options: MODES, meta: { ...modeNote, showWhen: { id: `${F}.director-enable`, in: ["1"] } },
    }),
    ...[1, 2, 3].map((n) => e(`custom${n}`, G.director, `dnsfilter_custom${n}`, "ipv4", L(`Custom server ${n}`, `自訂伺服器 ${n}`), L("A DNS server address you choose, used by the modes called Custom.", "你自己揀嘅 DNS 伺服器地址，供「自訂」模式使用。"), {
      ...merlin, optional: true, risk: "network", restart: "restart_dnsfilter", meta: { showWhen: { id: `${F}.director-enable`, in: ["1"] } },
    })),
    e("director-devices", G.director, "dnsfilter_rulelist", "dnsclients", L("Filter for chosen devices", "指定裝置嘅過濾"), L("Give a device its own filter. For example, a stricter one for a child's tablet.", "俾某部裝置自己嘅過濾，例如小朋友平板用較嚴格嗰個。"), {
      ...merlin, optional: true, maxItems: 64, risk: "network", restart: "restart_dnsfilter", meta: { ...modeNote, showWhen: { id: `${F}.director-enable`, in: ["1"] } },
      emptyText: L("No device has its own filter.", "冇裝置有自己嘅過濾。"),
      columns: [
        { id: "name", label: L("Name", "名稱"), kind: "text", maxLength: 32 },
        { id: "mac", label: L("Device (MAC)", "裝置（MAC）"), kind: "mac", unique: true },
        { id: "mode", label: L("Filter", "過濾"), kind: "select", options: MODES },
      ],
    }),

    e("ddns-user", G.ddns, "ddns_username_x", "text", L("Account name", "帳戶名稱"), L("The user name or token name your Dynamic DNS provider gave you.", "動態 DNS 供應商俾你嘅用戶名稱或者 token 名稱。"), {
      freeText: true, freeTextReason: "An account name is whatever the provider issued, so it cannot be picked from a list.", maxLength: 64, hint: L("Not needed for the ASUS service.", "ASUS 服務唔需要。"), risk: "low", restart: "restart_ddns",
    }),
    e("ddns-password", G.ddns, "ddns_passwd_x", "password", L("Account password", "帳戶密碼"), L("The password or key your Dynamic DNS provider gave you. It is never shown or logged.", "動態 DNS 供應商俾你嘅密碼或者金鑰。唔會顯示或者記錄。"), { secret: true, minLength: 1, maxLength: 64, risk: "low", restart: "restart_ddns" }),
    e("ddns-wildcard", G.ddns, "ddns_wildcard_x", "switch", L("Also answer for sub-names", "子名稱都指返嚟"), L("Makes www.yourname and any other sub-name point at your home too. Not every provider supports it.", "等 www.你嘅名稱 同其他子名稱都指返你屋企。唔係每個供應商都支援。"), { values: ON_OFF, risk: "low", restart: "restart_ddns" }),
    e("ddns-refresh", G.ddns, "ddns_regular_check", "switch", L("Refresh the name regularly", "定時更新名稱"), L("Some providers drop a name that is never updated. This keeps it alive even when your address does not change.", "有啲供應商會刪除長期冇更新嘅名稱。呢個設定令佢即使地址冇變都保持有效。"), { values: ON_OFF, risk: "low", restart: "restart_ddns" }),
    e("ddns-period", G.ddns, "ddns_regular_period", "stepper", L("Refresh every", "每隔幾耐更新"), L("Days between refreshes.", "兩次更新之間嘅日數。"), { min: 1, max: 90, unit: "days", risk: "low", restart: "restart_ddns", meta: { showWhen: { id: `${F}.ddns-refresh`, in: ["1"] } } }),
    e("ddns-check", G.ddns, "ddns_ipcheck", "segmented", L("How the router learns its address", "路由器點樣知道自己嘅地址"), L("Ask an outside service when the router sits behind another router or a shared provider address.", "路由器喺另一部路由器後面、或者用供應商共用地址嗰陣，就問外部服務。"), {
      risk: "low", restart: "restart_ddns",
      options: [["0", L("From the connection", "由連線得知")], ["1", L("Ask an outside service", "問外部服務")]],
    }),
  ],

  controls: { dotservers: tableControl(), dnsclients: tableControl() },

  domainMeta: [{ id: F, icon: "dns", label: L("DNS Pro", "DNS 進階"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [F]: async (ctx) => {
      const n = ctx.nvram;
      const stock = ctx.entries("internet").filter((x) => x.group === "dns" || x.group === "ddns");
      return {
        presets: PRESETS,
        suffixes: SUFFIXES,
        usingProvider: read(n, "wan_dnsenable_x") === "1",
        servers: [read(n, "wan_dns1_x"), read(n, "wan_dns2_x")].filter(Boolean),
        merlin: ctx.info.merlin,
        stock,
        entries: ctx.entries(),
        inProgress: [
          {
            label: L("More Dynamic DNS providers", "更多動態 DNS 供應商"),
            detail: L("The provider list belongs to the stock Internet settings and offers ASUS, Dyn, No-IP and Google Domains. Providers that the router firmware also supports, such as DuckDNS or Cloudflare, need that list to grow first.", "供應商清單屬於標準互聯網設定，目前有 ASUS、Dyn、No-IP 同 Google Domains。路由器韌體仲支援嘅其他供應商（例如 DuckDNS 或者 Cloudflare），要等清單擴充先可以揀。"),
          },
        ],
      };
    },
  },

  routes(api) {
    api.get("/presets", async () => ({ presets: PRESETS }));

    // Queues a preset: ordinary name servers, DNS over TLS, or back to the provider's.
    api.post("/preset", async ({ body, preview, bad }) => {
      const id = String(body.id ?? "");
      const mode = String(body.mode ?? "dns");
      if (id === "provider") return { preview: await preview({ changes: [{ id: "wan.dnsauto", value: "1" }] }) };
      const preset = PRESETS.find((p) => p.id === id);
      if (!preset) throw bad("That preset does not exist.", 404);
      const changes = [];
      if (mode === "dns" || mode === "both") changes.push({ id: "wan.dnsauto", value: "0" }, { id: "wan.dns1", value: preset.dns[0] }, { id: "wan.dns2", value: preset.dns[1] });
      if (mode === "dot" || mode === "both") {
        if (!preset.dot) throw bad(`${preset.name.en} has no encrypted DNS server in this list.`);
        changes.push({ id: `${F}.dot-enable`, value: "1" }, { id: `${F}.dot-servers`, value: rowOf(preset) });
      }
      if (!changes.length) throw bad("Choose dns, dot or both.");
      return { preview: await preview({ changes }) };
    });

    // Looks a name up through the router, to prove the chosen servers work.
    api.get("/lookup", async ({ query, live, bad }) => {
      let name;
      try {
        name = hostTarget(query.name ?? "example.test");
      } catch {
        throw bad("Enter a host name to look up.");
      }
      const out = await (await live()).exec(`nslookup ${name}`);
      const addresses = [...out.stdout.matchAll(/^Address(?: \d+)?:\s+([0-9a-fA-F.:]+)/gm)].map((m) => m[1]).slice(1);
      return { name, ok: out.code === 0 && addresses.length > 0, addresses };
    });
  },

  fakeRouter: {
    nvram: {
      dnspriv_enable: "0", dnspriv_profile: "1", dnspriv_rulelist: "<1.1.1.1>853>cloudflare-dns.com>",
      dnssec_enable: "0", dnssec_check_unsigned_x: "0", dns_norebind: "1", dns_fwd_local: "0",
      dnsfilter_enable_x: "0", dnsfilter_mode: "0", dnsfilter_custom1: "", dnsfilter_custom2: "", dnsfilter_custom3: "", dnsfilter_rulelist: "",
      ddns_username_x: "", ddns_passwd_x: "", ddns_wildcard_x: "0", ddns_regular_check: "0", ddns_regular_period: "60", ddns_ipcheck: "0",
    },
  },
};
