// Internet Pro: the whole WAN connection. Connection type with every field that
// type needs (automatic, static, PPPoE, PPTP, L2TP), MTU and MRU, MAC clone,
// host name and the other things providers ask for, and VLAN tagging with
// IPTV profiles. Every setting reads the router's own value and is written
// through the change engine, so each edit has a preview, the safety net and undo.
//
// The keys are the per-connection ones the router itself uses (wan0_...). The
// stock Internet page writes the unit-less copy, which cannot say PPTP or L2TP.
import { L, ON_OFF, hostTarget, isIpv4 } from "../kit.mjs";

const F = "internet-pro";
const G = {
  conn: { group: "conn", groupLabel: L("Connection type", "連線類型") },
  addr: { group: "addr", groupLabel: L("Fixed address", "固定地址") },
  login: { group: "login", groupLabel: L("Provider login", "供應商登入") },
  size: { group: "size", groupLabel: L("Packet size (MTU)", "封包大小（MTU）") },
  isp: { group: "isp", groupLabel: L("What your provider asks for", "供應商嘅特別要求") },
  vlan: { group: "vlan", groupLabel: L("VLAN tagging and IPTV", "VLAN 標籤同 IPTV") },
};

const maskOf = (prefix) => [24, 16, 8, 0].map((shift) => ((0xffffffff << (32 - prefix)) >>> 0 >>> shift) & 255).join(".");
const MASKS = Array.from({ length: 23 }, (_, i) => 30 - i).map((p) => [maskOf(p), L(`/${p}  ${maskOf(p)}  (${(2 ** (32 - p) - 2).toLocaleString("en")} hosts)`, `/${p}  ${maskOf(p)}  （${(2 ** (32 - p) - 2).toLocaleString("en")} 部主機）`)]);

const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${F}.${id}`, domain: F, ...group, key, control, label, help, ...extra });
const PPP = ["pppoe", "pptp", "l2tp"];
const when = (id, values) => ({ showWhen: { id: `${F}.${id}`, in: values } });
const stock = { risk: "network", restart: "restart_wan_if 0" };

// VLAN ids the common provider profiles use. Typical values only; the provider decides.
const PROFILES = {
  unifi_home: { internet: 500, iptv: 600 },
  singtel_mio: { internet: 10, iptv: 20, voip: 30 },
  m1_fiber: { internet: 1103, voip: 1107 },
};

const read = (nvram, key) => nvram.get(key) ?? "";

export default {
  id: F,

  catalog: () => [
    e("enable", G.conn, "wan0_enable", "switch", L("Use this connection", "使用呢條連線"), L("Turns the internet connection on or off. Off means no internet for the whole home.", "開或者關上網連線。關咗全屋都冇網絡。"), { values: ON_OFF, ...stock }),
    e("proto", G.conn, "wan0_proto", "select", L("Connection type", "連線類型"), L("Your provider tells you which one to use. Most homes use Automatic.", "用邊種由供應商話事。大部分屋企用自動。"), {
      ...stock,
      options: [
        ["dhcp", L("Automatic IP (DHCP)", "自動 IP（DHCP）"), L("The provider hands out the address by itself.", "供應商自動派地址。")],
        ["static", L("Fixed IP", "固定 IP"), L("You type the address, mask and gateway your provider gave you.", "自己輸入供應商俾你嘅地址、遮罩同網關。")],
        ["pppoe", L("PPPoE", "PPPoE"), L("Log in with a user name and password. Common on DSL and fibre.", "用用戶名稱同密碼登入。DSL 同光纖常見。")],
        ["pptp", L("PPTP", "PPTP"), L("Log in to a provider VPN server first.", "先登入供應商嘅 VPN 伺服器。")],
        ["l2tp", L("L2TP", "L2TP"), L("Log in to a provider L2TP server first.", "先登入供應商嘅 L2TP 伺服器。")],
      ],
    }),
    e("auto-ip", G.conn, "wan0_dhcpenable_x", "switch", L("Get the address automatically", "自動攞地址"), L("Leave on unless your provider gave you a fixed address for this login.", "除非供應商俾咗固定地址，否則保持開住。"), { values: ON_OFF, ...stock, meta: when("proto", PPP) }),

    e("ip", G.addr, "wan0_ipaddr_x", "ipv4", L("Internet address", "上網地址"), L("The address your provider gave you.", "供應商俾你嘅地址。"), {
      optional: true, ...stock, meta: { showWhen: [[{ id: `${F}.proto`, in: ["static"] }], [{ id: `${F}.proto`, in: PPP }, { id: `${F}.auto-ip`, in: ["0"] }]] },
    }),
    e("mask", G.addr, "wan0_netmask_x", "select", L("Network size", "網絡大小"), L("The subnet mask, with its prefix length and how many hosts fit.", "子網遮罩，連前綴長度同可容納嘅主機數。"), {
      options: MASKS, ...stock, meta: { showWhen: [[{ id: `${F}.proto`, in: ["static"] }], [{ id: `${F}.proto`, in: PPP }, { id: `${F}.auto-ip`, in: ["0"] }]] },
    }),
    e("gateway", G.addr, "wan0_gateway_x", "ipv4", L("Gateway", "網關"), L("The provider's router that carries your traffic.", "負責轉送你流量嘅供應商路由器。"), {
      optional: true, ...stock, meta: { showWhen: [[{ id: `${F}.proto`, in: ["static"] }], [{ id: `${F}.proto`, in: PPP }, { id: `${F}.auto-ip`, in: ["0"] }]] },
    }),

    e("user", G.login, "wan0_pppoe_username", "text", L("User name", "用戶名稱"), L("The login your provider issued.", "供應商發俾你嘅登入名稱。"), {
      freeText: true, freeTextReason: "A provider login name is whatever the provider issued, so it cannot be picked from a list.", maxLength: 64, hint: L("Exactly as your provider wrote it.", "同供應商寫嘅一模一樣。"), ...stock, meta: when("proto", PPP),
    }),
    e("password", G.login, "wan0_pppoe_passwd", "password", L("Password", "密碼"), L("The password your provider issued. It is never shown or logged.", "供應商發俾你嘅密碼。唔會顯示或者記錄。"), {
      secret: true, minLength: 1, maxLength: 64, ...stock, meta: when("proto", PPP),
    }),
    e("service", G.login, "wan0_pppoe_service", "text", L("Service name", "服務名稱"), L("Only if your provider asks for it. Leave empty otherwise.", "只有供應商要求先需要，否則留空。"), {
      freeText: true, freeTextReason: "A PPPoE service name is chosen by the provider and has no fixed list.", maxLength: 32, hint: L("Optional.", "可選。"), ...stock, meta: when("proto", ["pppoe"]),
    }),
    e("ac", G.login, "wan0_pppoe_ac", "text", L("Access concentrator", "接入集中器"), L("Only if your provider asks for it. Leave empty otherwise.", "只有供應商要求先需要，否則留空。"), {
      freeText: true, freeTextReason: "A PPPoE access concentrator name is chosen by the provider and has no fixed list.", maxLength: 32, hint: L("Optional.", "可選。"), ...stock, meta: when("proto", ["pppoe"]),
    }),
    e("idle", G.login, "wan0_pppoe_idletime", "slider", L("Disconnect when idle", "閒置後斷線"), L("Hang up after this many seconds without traffic. 0 keeps the line up all the time.", "冇流量過咗呢個秒數就斷線。0 就一直保持連線。"), { min: 0, max: 3600, unit: "s", ...stock, meta: when("proto", ["pppoe"]) }),
    e("server", G.login, "wan0_heartbeat_x", "hostname", L("VPN server", "VPN 伺服器"), L("The server name or address your provider gave you for PPTP or L2TP.", "供應商俾你嘅 PPTP 或者 L2TP 伺服器名稱或地址。"), { optional: true, ...stock, meta: when("proto", ["pptp", "l2tp"]) }),
    e("pptp-crypto", G.login, "wan0_pptp_options_x", "select", L("PPTP encryption", "PPTP 加密"), L("Leave on Automatic unless your provider says otherwise.", "除非供應商另有指示，否則用自動。"), {
      ...stock, meta: when("proto", ["pptp"]),
      options: [["", L("Automatic", "自動")], ["-mppc", L("No encryption", "唔加密")], ["+mppe-40", L("MPPE 40-bit", "MPPE 40 位")], ["+mppe-56", L("MPPE 56-bit", "MPPE 56 位")], ["+mppe-128", L("MPPE 128-bit", "MPPE 128 位")]],
    }),

    e("mtu", G.size, "wan0_mtu", "stepper", L("MTU", "MTU"), L("The largest packet sent to the provider. 1500 suits most lines.", "傳送俾供應商嘅最大封包。大部分線路用 1500。"), { min: 576, max: 1500, unit: "bytes", ...stock, meta: { note: L("The key name wan0_mtu is not confirmed on every firmware build.", "wan0_mtu 呢個鍵名未必每個韌體版本都一樣。") } }),
    e("pppoe-mtu", G.size, "wan0_pppoe_mtu", "stepper", L("PPPoE MTU", "PPPoE MTU"), L("1492 is the usual value on PPPoE.", "PPPoE 通常用 1492。"), { min: 576, max: 1492, unit: "bytes", ...stock, meta: when("proto", ["pppoe"]) }),
    e("pppoe-mru", G.size, "wan0_pppoe_mru", "stepper", L("PPPoE MRU", "PPPoE MRU"), L("The largest packet accepted from the provider. Usually the same as the MTU.", "接受供應商嘅最大封包。通常同 MTU 一樣。"), { min: 576, max: 1492, unit: "bytes", ...stock, meta: when("proto", ["pppoe"]) }),

    e("hostname", G.isp, "wan0_hostname", "hostname", L("Host name sent to the provider", "俾供應商嘅主機名稱"), L("Some providers only accept a particular name.", "有啲供應商只接受指定嘅名稱。"), { optional: true, ...stock, meta: when("proto", ["dhcp", "static"].concat(PPP)) }),
    e("clone", G.isp, "wan0_hwaddr_x", "device", L("Clone a MAC address", "複製 MAC 地址"), L("Some providers remember the first device you connected. Pick that device, or type its MAC address. Empty uses the router's own.", "有啲供應商會記住第一部連接嘅裝置。揀返嗰部裝置或者輸入佢嘅 MAC 地址。留空就用路由器自己嘅。"), { optional: true, ...stock }),
    e("client-id", G.isp, "wan0_clientid", "text", L("DHCP client ID (option 61)", "DHCP 用戶端 ID（選項 61）"), L("Only if your provider asks for it.", "只有供應商要求先需要。"), {
      freeText: true, freeTextReason: "A DHCP client ID is an arbitrary string the provider checks, so it cannot be picked from a list.", maxLength: 64, hint: L("Optional.", "可選。"), ...stock, meta: when("proto", ["dhcp"]),
    }),
    e("vendor-id", G.isp, "wan0_vendorid", "text", L("DHCP vendor class (option 60)", "DHCP 供應商類別（選項 60）"), L("Only if your provider asks for it.", "只有供應商要求先需要。"), {
      freeText: true, freeTextReason: "A DHCP vendor class is an arbitrary string the provider checks, so it cannot be picked from a list.", maxLength: 64, hint: L("Optional.", "可選。"), ...stock, meta: when("proto", ["dhcp"]),
    }),
    e("query", G.isp, "wan0_dhcp_qry", "segmented", L("How often to ask for an address", "幾密詢問地址"), L("Aggressive helps on lines that drop the lease. Normal is right for most.", "積極適合經常丟失租約嘅線路。大部分用正常。"), {
      ...stock, meta: when("proto", ["dhcp"]),
      options: [["0", L("Aggressive", "積極")], ["1", L("Normal", "正常")], ["2", L("Continuous", "持續")]],
    }),
    e("ttl-inc", G.isp, "ttl_inc_enable", "switch", L("Extend the TTL value", "延長 TTL 值"), L("Lets devices behind a second router share one connection when the provider limits that.", "供應商限制共用連線時，等後面再接一部路由器嘅裝置都可以上網。"), { values: ON_OFF, risk: "low", restart: "restart_firewall" }),
    e("ttl-spoof", G.isp, "ttl_spoof_enable", "switch", L("Spoof the TTL value", "偽裝 TTL 值"), L("Hides that you share the connection, for providers that count devices.", "隱藏你有共用連線，適合會計算裝置數量嘅供應商。"), { values: ON_OFF, firmware: "merlin", risk: "low", restart: "restart_firewall" }),
    e("nat", G.isp, "wan0_nat_x", "switch", L("Network address translation (NAT)", "網絡地址轉換（NAT）"), L("Keep on at home. Turn off only if your provider routes a block of addresses to you.", "屋企請保持開住。只有供應商俾你一整段地址先關。"), { values: ON_OFF, ...stock }),

    e("profile", G.vlan, "switch_wantag", "select", L("Provider profile", "供應商設定檔"), L("Fills in the VLAN ids many providers use for internet and IPTV. Choose Manual to type your own.", "自動填入好多供應商用嘅 VLAN 編號。選手動就自己輸入。"), {
      risk: "network", restart: "restart_net_and_phy",
      options: [
        ["none", L("None", "冇")], ["unifi_home", L("Unifi Home", "Unifi Home")], ["unifi_biz", L("Unifi Business", "Unifi Business")], ["singtel_mio", L("Singtel MIO", "Singtel MIO")],
        ["singtel_others", L("Singtel others", "Singtel 其他")], ["m1_fiber", L("M1 fibre", "M1 光纖")], ["maxis_fiber", L("Maxis fibre", "Maxis 光纖")], ["maxis_fiber_sp", L("Maxis fibre (special)", "Maxis 光纖（特別）")],
        ["movistar", L("Movistar", "Movistar")], ["meo", L("MEO", "MEO")], ["vodafone", L("Vodafone", "Vodafone")], ["hinet", L("HiNet", "HiNet")], ["stuff_fibre", L("Stuff Fibre", "Stuff Fibre")], ["manual", L("Manual", "手動")],
      ],
      meta: { note: L("The profile names follow the router firmware. Which ones exist depends on the model and region.", "設定檔名稱跟路由器韌體。有邊啲視乎型號同地區。") },
    }),
    e("stb", G.vlan, "switch_stb_x", "select", L("IPTV box port", "IPTV 機頂盒埠"), L("The LAN port that carries IPTV. It gets its own tagged traffic, apart from your other devices.", "傳送 IPTV 嘅 LAN 埠。佢嘅流量會獨立標籤，同其他裝置分開。"), {
      risk: "network", restart: "restart_net_and_phy",
      options: [["0", L("None", "冇")], ["1", L("LAN 1", "LAN 1")], ["2", L("LAN 2", "LAN 2")], ["3", L("LAN 3", "LAN 3")], ["4", L("LAN 4", "LAN 4")], ["5", L("LAN 1 and 2", "LAN 1 同 2")], ["6", L("LAN 3 and 4", "LAN 3 同 4")]],
    }),
    ...[["0", "internet", L("Internet", "互聯網")], ["1", "iptv", L("IPTV", "IPTV")], ["2", "voip", L("Phone (VoIP)", "電話（VoIP）")]].flatMap(([n, name, label]) => [
      e(`vlan-${name}`, G.vlan, `switch_wan${n}tagid`, "number", L(`${label.en} VLAN id`, `${label.yue} VLAN 編號`), L("0 means untagged. Valid ids run from 2 to 4094.", "0 代表唔加標籤。有效編號係 2 至 4094。"), {
        min: 0, max: 4094, unit: "id", risk: "network", restart: "restart_net_and_phy", meta: when("profile", ["manual"]),
      }),
      e(`prio-${name}`, G.vlan, `switch_wan${n}prio`, "stepper", L(`${label.en} priority`, `${label.yue} 優先級`), L("802.1p priority from 0 (lowest) to 7 (highest).", "802.1p 優先級，0 最低，7 最高。"), { min: 0, max: 7, unit: "", risk: "network", restart: "restart_net_and_phy", meta: when("profile", ["manual"]) }),
    ]),
  ],

  domainMeta: [{ id: F, icon: "public", label: L("Internet Pro", "互聯網進階"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [F]: async (ctx) => {
      const n = ctx.nvram;
      const state = read(n, "wan0_state_t");
      return {
        wan: {
          connected: state === "2",
          state,
          proto: read(n, "wan0_proto"),
          ip: read(n, "wan0_ipaddr"),
          gateway: read(n, "wan0_gateway"),
          dns: read(n, "wan0_dns").split(" ").filter(Boolean),
        },
        profiles: PROFILES,
        entries: ctx.entries(),
        inProgress: [],
      };
    },
  },

  routes(api) {
    // Finds the largest packet that gets through unfragmented, by asking the
    // router to ping with the "don't fragment" option at falling sizes.
    api.post("/mtu-probe", async ({ body, live, bad }) => {
      let target;
      try {
        target = hostTarget(body.target ?? "203.0.113.9");
      } catch {
        throw bad("Enter an IPv4 address or a host name to test against.");
      }
      const ctx = await live();
      const tried = [];
      for (const size of [1472, 1464, 1452, 1432, 1400, 1372, 1272]) {
        const out = await ctx.exec(`ping -c 1 -W 2 -M do -s ${size} ${target}`);
        const ok = out.code === 0;
        tried.push({ size, ok });
        if (ok) return { target, mtu: size + 28, tried, note: "The MTU is the largest payload that got through plus 28 bytes of headers." };
      }
      return { target, mtu: null, tried, note: "Nothing got through. The target may not answer ping, or the router's ping may not support the don't fragment option." };
    });
    api.get("/profile/:name", async ({ params, bad }) => {
      const profile = PROFILES[params.name];
      if (!profile) throw bad("No typical values are known for that profile. Ask your provider.", 404);
      return { name: params.name, ...profile };
    });
  },

  actions: {
    // Drops and re-opens the connection, which also asks for a fresh address.
    reconnect: {
      risk: "network",
      run: async ({ exec }) => {
        const out = await exec("service restart_wan_if 0");
        return { ok: out.code === 0, message: out.code === 0 ? "The connection was restarted." : "The router did not accept the restart." };
      },
    },
    // Checks that an address typed in the browser looks like what the router accepts.
    check: {
      risk: "low",
      run: async ({ body }) => ({ ip: isIpv4(body.ip), mask: MASKS.some(([m]) => m === body.mask) }),
    },
  },

  fakeRouter: {
    nvram: {
      wan0_enable: "1", wan0_dhcpenable_x: "1", wan0_ipaddr_x: "", wan0_netmask_x: "255.255.255.0", wan0_gateway_x: "",
      wan0_pppoe_username: "", wan0_pppoe_passwd: "", wan0_pppoe_service: "", wan0_pppoe_ac: "", wan0_pppoe_idletime: "0", wan0_heartbeat_x: "", wan0_pptp_options_x: "",
      wan0_mtu: "1500", wan0_pppoe_mtu: "1492", wan0_pppoe_mru: "1492",
      wan0_hostname: "", wan0_hwaddr_x: "", wan0_clientid: "", wan0_vendorid: "", wan0_dhcp_qry: "1", ttl_inc_enable: "0", ttl_spoof_enable: "0", wan0_nat_x: "1",
      switch_wantag: "none", switch_stb_x: "0",
      switch_wan0tagid: "0", switch_wan0prio: "0", switch_wan1tagid: "0", switch_wan1prio: "0", switch_wan2tagid: "0", switch_wan2prio: "0",
    },
    handlers: [
      // The pretend line carries packets up to 1464 bytes of payload (a PPPoE-sized path).
      (command) => {
        const m = command.match(/^ping -c 1 -W 2 -M do -s (\d+) (\S+)$/);
        if (!m) return undefined;
        return Number(m[1]) <= 1464 ? { stdout: `64 bytes from ${m[2]}: seq=0 ttl=55 time=12.1 ms\n` } : { stderr: "ping: sendto: Message too long\n", code: 1 };
      },
    ],
  },
};
