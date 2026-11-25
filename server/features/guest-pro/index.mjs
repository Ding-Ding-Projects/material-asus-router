// Guest Network Pro: put each guest Wi-Fi on its own separate network (its own
// bridge, its own addresses, optionally its own VLAN) so visitors can never
// see the home network, and stop guests seeing each other.
//
// Stock ASUS firmware only. Asuswrt-Merlin does not have these settings, so
// every entry is switched off there with the reason. The key names below follow
// what the stock firmware is known to use but have not been checked on a real
// router; the screen therefore also switches off any entry whose setting the
// router does not list ("This router does not have the setting <key>").
import { L, ON_OFF } from "../kit.mjs";

const STOCK_ONLY = "stock-firmware"; // never a real capability, so the entries stay off on Merlin
const BAND = { 2: L("2.4 GHz", "2.4 GHz"), 1: L("5 GHz", "5 GHz"), 4: L("6 GHz", "6 GHz") };
const BRIDGES = [
  ["br0", L("Home network (not separated)", "屋企網絡（唔分隔）"), L("The guests share the home network. Not recommended.", "訪客同屋企用同一個網絡。唔建議。")],
  ["br1", L("Separate guest network 1", "獨立訪客網絡 1"), L("Visitors get their own network and cannot reach home devices.", "訪客有自己嘅網絡，睇唔到屋企裝置。")],
  ["br2", L("Separate guest network 2", "獨立訪客網絡 2"), L("A second private network, so two groups of visitors stay apart.", "第二個私人網絡，令兩組訪客互相分隔。")],
  ["br3", L("Separate guest network 3", "獨立訪客網絡 3"), L("A third private network.", "第三個私人網絡。")],
];
const MASKS = [
  ["255.255.255.0", L("/24  255.255.255.0 (254 devices)", "/24  255.255.255.0（254 部裝置）")],
  ["255.255.255.128", L("/25  255.255.255.128 (126 devices)", "/25  255.255.255.128（126 部裝置）")],
  ["255.255.254.0", L("/23  255.255.254.0 (510 devices)", "/23  255.255.254.0（510 部裝置）")],
];
const NOTE = L(
  "The setting name follows what stock ASUS firmware is known to use but has not been checked on a real router yet. It works against the pretend router in tests.",
  "設定名稱跟返原廠 ASUS 韌體常見做法，但未喺真正路由器驗證過。喺測試用嘅模擬路由器上運作正常。",
);
const GUESTS = [1, 2, 3];

const bandName = (band) => BAND[band.nband] ?? L(`Band ${band.index + 1}`, `頻段 ${band.index + 1}`);

export function guestProEntries(info) {
  const stockOnly = info.merlin ? { requires: STOCK_ONLY } : {};
  const out = [];
  for (const band of info.bands) {
    const name = bandName(band);
    for (const n of GUESTS) {
      const p = `wl${band.index}.${n}`;
      const groupLabel = L(`${name.en}: guest network ${n}`, `${name.yue}：訪客網絡 ${n}`);
      const base = { domain: "guest-pro", group: `net-${band.index}-${n}`, groupLabel, restart: "restart_wireless", risk: "network", ...stockOnly };
      out.push(
        { ...base, id: `guest-pro.${p}.brif`, key: `${p}_brif`, control: "select", options: BRIDGES, label: L("Which network the guests join", "訪客加入邊個網絡"), help: L("Pick a separate guest network so visitors cannot see your printer, files or other home devices.", "揀一個獨立訪客網絡，訪客就睇唔到你部打印機、檔案同其他屋企裝置。"), meta: { note: NOTE } },
        { ...base, id: `guest-pro.${p}.isolate`, key: `${p}_ap_isolate`, control: "switch", values: ON_OFF, label: L("Keep guests apart from each other", "令訪客之間互相隔開"), help: L("Stops one visitor's phone from reaching another visitor's phone on this guest network.", "令呢個訪客網絡入面嘅手機互相連唔到。"), meta: { note: NOTE } },
      );
    }
  }
  out.push(
    {
      id: "guest-pro.vlan.rules", domain: "guest-pro", group: "vlan", groupLabel: L("VLAN tags", "VLAN 標籤"), key: "vlan_rulelist", control: "rule-table", restart: "restart_net_and_phy", risk: "network", ...stockOnly,
      label: L("VLAN for each guest network", "每個訪客網絡嘅 VLAN"), help: L("Gives a guest network its own VLAN number so a managed switch or access point can keep it separate all the way along the cable.", "俾訪客網絡一個獨立 VLAN 編號，等網管交換機或接入點可以由頭到尾都分隔住。"),
      maxItems: 3, unique: true, meta: { note: NOTE },
      columns: [
        { id: "name", cell: "text", label: L("Name", "名稱"), max: 24, example: "Guests{n}", pattern: "^[A-Za-z0-9_-]+$", patternHint: "use letters, digits, - and _ only." },
        { id: "vid", cell: "number", label: L("VLAN number", "VLAN 編號"), min: 2, max: 4094 },
        { id: "bridge", cell: "select", label: L("Guest network", "訪客網絡"), options: BRIDGES.slice(1) },
      ],
    },
    {
      id: "guest-pro.subnets", domain: "guest-pro", group: "subnets", groupLabel: L("Addresses for each guest network", "每個訪客網絡嘅地址"), key: "subnet_rulelist", control: "rule-table", restart: "restart_net_and_phy", risk: "network", ...stockOnly,
      label: L("Guest network addresses", "訪客網絡地址"), help: L("The router's own address on each guest network and the range it hands out to visitors. Keep it different from your home addresses.", "路由器喺每個訪客網絡嘅地址同派俾訪客嘅範圍。要同屋企嘅地址唔同。"),
      maxItems: 3, unique: true, meta: { note: NOTE },
      columns: [
        { id: "bridge", cell: "select", label: L("Guest network", "訪客網絡"), options: BRIDGES.slice(1) },
        { id: "gateway", cell: "ipv4", label: L("Router address", "路由器地址") },
        { id: "mask", cell: "select", label: L("Size", "大小"), options: MASKS },
        { id: "dhcp", cell: "switch", label: L("Hand out addresses", "自動派地址") },
        { id: "lease", cell: "number", label: L("Lease (seconds)", "租期（秒）"), min: 120, max: 604800 },
      ],
    },
  );
  return out;
}

// What the pretend router starts with, for two bands.
export function defaults(bandIndexes) {
  const out = {
    vlan_rulelist: "<Guests>20>br1",
    subnet_rulelist: "<br1>203.0.113.1>255.255.255.0>1>86400",
  };
  for (const index of bandIndexes) for (const n of GUESTS) {
    const p = `wl${index}.${n}`;
    Object.assign(out, { [`${p}_brif`]: n === 1 ? "br1" : "br0", [`${p}_ap_isolate`]: "1" });
  }
  return out;
}

const missing = (key) => ({ en: `This router does not have the setting ${key}`, yue: `呢部路由器冇「${key}」呢個設定` });

export default {
  id: "guest-pro",

  catalog: guestProEntries,

  domainMeta: [{ id: "guest-pro", icon: "hub", label: L("Guest Network Pro", "訪客網絡 Pro"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    "guest-pro": async (ctx) => {
      const nv = (key) => ctx.nvram.get(key) ?? "";
      const nets = [];
      for (const band of ctx.info.bands) for (const n of GUESTS) {
        const p = `wl${band.index}.${n}`;
        nets.push({
          id: p, band: band.index, nband: band.nband, number: n,
          ssid: nv(`${p}_ssid`), on: nv(`${p}_bss_enabled`) === "1", bridge: nv(`${p}_brif`) || "br0",
          isolate: nv(`${p}_ap_isolate`) === "1",
          present: ctx.nvram.has(`${p}_brif`) && ctx.nvram.has(`${p}_ap_isolate`),
        });
      }
      // An entry whose setting the router does not list is switched off with that reason.
      const entries = ctx.entries().map((e) => (e.disabled || ctx.nvram.has(e.key) ? e : { ...e, disabled: missing(e.key) }));
      return {
        entries,
        stockOnly: !ctx.info.merlin,
        reason: ctx.info.merlin ? { en: "Guest Network Pro needs the stock ASUS firmware. This router runs Asuswrt-Merlin.", yue: "訪客網絡 Pro 要用原廠 ASUS 韌體。呢部路由器用緊 Asuswrt-Merlin。" } : null,
        nets,
        vlans: nv("vlan_rulelist"),
        subnets: nv("subnet_rulelist"),
      };
    },
  },

  routes(api) {
    // Who is on each guest network right now. Read only; the screen polls it.
    api.get("/clients", async ({ live }) => {
      const { exec, info } = await live();
      const networks = [];
      for (const band of info.bands) for (const n of GUESTS) {
        const id = `wl${band.index}.${n}`;
        let count = 0;
        try {
          const r = await exec(`wl -i ${id} assoclist`);
          if (r.code === 0) count = r.stdout.split("\n").filter((line) => /^assoclist\s+[0-9A-F:]{17}$/i.test(line.trim())).length;
        } catch {
          // a network that cannot be asked simply shows no devices
        }
        networks.push({ id, count });
      }
      return { at: new Date().toISOString(), networks };
    });
  },

  fakeRouter: {
    nvram: defaults([0, 1]),
    handlers: [
      (command) => {
        const m = command.match(/^wl -i (wl\d\.\d) assoclist$/);
        if (!m) return undefined;
        return { stdout: m[1] === "wl0.1" ? "assoclist F0:18:98:AA:BB:77\nassoclist F0:18:98:AA:BB:78\n" : "" };
      },
    ],
  },
};
