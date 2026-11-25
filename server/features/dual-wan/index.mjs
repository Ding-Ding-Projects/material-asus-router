// Dual WAN: two ways to reach the internet. Failover or load balance, which
// ports are used, how the router decides a connection is down, and the second
// connection's own type and address. Every setting is the router's own value
// and is written through the change engine.
import { L, ON_OFF, hostTarget } from "../kit.mjs";

const F = "dual-wan";
const G = {
  mode: { group: "mode", groupLabel: L("Dual WAN", "雙 WAN") },
  balance: { group: "balance", groupLabel: L("Sharing the load", "分擔流量") },
  detect: { group: "detect", groupLabel: L("Is the connection alive?", "連線仲係咪正常？") },
  second: { group: "second", groupLabel: L("Second connection", "第二條連線") },
};
const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${F}.${id}`, domain: F, ...group, key, control, label, help, ...extra });
const net = { risk: "network", restart: "restart_dualwan" };
const wan1 = { risk: "network", restart: "restart_wan_if 1" };
const DUAL = ["wan lan", "lan wan", "wan usb", "usb wan"];
const LAN_PORT = ["wan lan", "lan wan"];
const rule = (id, values) => ({ id: `${F}.${id}`, in: values });

const MASKS = [["255.255.255.0", L("/24  255.255.255.0", "/24  255.255.255.0")], ["255.255.254.0", L("/23  255.255.254.0", "/23  255.255.254.0")], ["255.255.252.0", L("/22  255.255.252.0", "/22  255.255.252.0")], ["255.255.255.128", L("/25  255.255.255.128", "/25  255.255.255.128")], ["255.255.255.252", L("/30  255.255.255.252", "/30  255.255.255.252")]];

const read = (nvram, key) => nvram.get(key) ?? "";
const STATES = { 0: "starting", 1: "connecting", 2: "connected", 3: "disconnected", 4: "off" };

const wanStatus = (n, unit) => ({
  unit,
  proto: read(n, `wan${unit}_proto`),
  state: STATES[read(n, `wan${unit}_state_t`)] ?? "unknown",
  connected: read(n, `wan${unit}_state_t`) === "2",
  ip: read(n, `wan${unit}_ipaddr`),
  gateway: read(n, `wan${unit}_gateway`),
});

export default {
  id: F,

  catalog: (info) => [
    e("mode", G.mode, "wans_dualwan", "select", L("Dual WAN", "雙 WAN"), L("Choose what the second connection is, or turn dual WAN off.", "揀第二條連線係咩，或者關閉雙 WAN。"), {
      ...net,
      options: [
        ["wan none", L("Off (one connection)", "關閉（一條連線）"), L("The router uses its normal internet port only.", "路由器只用平時嗰個上網埠。")],
        ["wan lan", L("Internet port, with a LAN port as backup", "上網埠，後備用 LAN 埠"), L("Plug the second line into a LAN port.", "將第二條線插入 LAN 埠。")],
        ["lan wan", L("LAN port first, internet port as backup", "LAN 埠優先，上網埠後備"), L("The LAN port line is the main one.", "LAN 埠嗰條線做主線。")],
        ...(info.capabilities.includes("usbX1")
          ? [["wan usb", L("Internet port, with a USB modem as backup", "上網埠，後備用 USB 數據機"), L("A phone or mobile modem plugged into USB.", "插咗入 USB 嘅手機或者流動數據機。")], ["usb wan", L("USB modem first, internet port as backup", "USB 數據機優先，上網埠後備"), L("The USB modem is the main line.", "USB 數據機做主線。")]]
          : []),
      ],
    }),
    e("policy", G.mode, "wans_mode", "select", L("When to use the second connection", "幾時用第二條連線"), L("Failover waits for a problem. Fail back returns to the main line as soon as it recovers. Load balance uses both.", "故障轉移要出事先轉。故障回復係主線恢復就即刻轉返。負載平衡就兩條同時用。"), {
      ...net, meta: { showWhen: { id: `${F}.mode`, in: DUAL } },
      options: [["fo", L("Failover", "故障轉移"), L("Use the second line only when the first stops working.", "第一條斷咗先用第二條。")], ["fb", L("Fail back", "故障回復"), L("Return to the main line as soon as it works again.", "主線恢復就即刻轉返。")], ["lb", L("Load balance", "負載平衡"), L("Use both lines at once, in a ratio you choose.", "兩條線同時用，比例由你定。")]],
    }),
    e("lan-port", G.mode, "wans_lanport", "segmented", L("LAN port used as a second internet port", "用嚟做第二個上網埠嘅 LAN 埠"), L("Which LAN port the second line is plugged into.", "第二條線插咗喺邊個 LAN 埠。"), {
      ...net, meta: { showWhen: { id: `${F}.mode`, in: LAN_PORT } },
      options: [["1", L("LAN 1", "LAN 1")], ["2", L("LAN 2", "LAN 2")], ["3", L("LAN 3", "LAN 3")], ["4", L("LAN 4", "LAN 4")]],
    }),

    e("ratio", G.balance, "wans_lb_ratio", "select", L("Load balance ratio", "負載平衡比例"), L("How much traffic goes to the first line compared with the second. 3:1 sends three connections to the first for every one to the second.", "第一條線同第二條線嘅流量比例。3:1 即係每三個連線去第一條，一個去第二條。"), {
      ...net, meta: { showWhen: [[{ id: `${F}.mode`, in: DUAL }, rule("policy", ["lb"])]] },
      options: [["1:1", L("1 : 1  (even)", "1 : 1（平均）")], ["2:1", L("2 : 1", "2 : 1")], ["3:1", L("3 : 1", "3 : 1")], ["4:1", L("4 : 1", "4 : 1")], ["5:1", L("5 : 1", "5 : 1")], ["3:2", L("3 : 2", "3 : 2")], ["4:3", L("4 : 3", "4 : 3")], ["5:2", L("5 : 2", "5 : 2")]],
    }),
    e("routing-rules", G.balance, "wans_routing_enable", "switch", L("Use routing rules when balancing", "負載平衡時用路由規則"), L("Lets chosen devices or sites always use one line.", "等指定裝置或網站一直用同一條線。"), { values: ON_OFF, ...net, meta: { showWhen: [[{ id: `${F}.mode`, in: DUAL }, rule("policy", ["lb"])]] } }),

    e("check", G.detect, "wandog_enable", "switch", L("Check the connection", "檢查連線"), L("The router tests the line regularly and switches when it stops answering.", "路由器會定時測試條線，冇回應就轉線。"), { values: ON_OFF, ...net, meta: { showWhen: { id: `${F}.mode`, in: DUAL } } }),
    e("target", G.detect, "wandog_target", "hostname", L("Test against", "測試對象"), L("A host that always answers, such as a public DNS address. Empty uses the provider's gateway.", "一個一定會回應嘅主機，例如公共 DNS 地址。留空就用供應商網關。"), { optional: true, ...net, meta: { showWhen: [[{ id: `${F}.mode`, in: DUAL }, rule("check", ["1"])]] } }),
    e("interval", G.detect, "wandog_interval", "stepper", L("Test every", "每隔幾耐測試"), L("Seconds between tests.", "兩次測試之間嘅秒數。"), { min: 1, max: 3600, unit: "s", ...net, meta: { showWhen: [[{ id: `${F}.mode`, in: DUAL }, rule("check", ["1"])]] } }),
    e("max-fail", G.detect, "wandog_maxfail", "stepper", L("Failed tests before switching", "失敗幾次先轉線"), L("A higher number avoids switching because of one lost packet.", "數字高啲，就唔會因為一個漏咗嘅封包而轉線。"), { min: 1, max: 100, unit: "tests", ...net, meta: { showWhen: [[{ id: `${F}.mode`, in: DUAL }, rule("check", ["1"])]] } }),
    e("switch-delay", G.detect, "wandog_delay", "stepper", L("Wait before switching", "轉線前等幾耐"), L("Seconds to wait after the last failed test.", "最後一次失敗之後等嘅秒數。"), { min: 0, max: 600, unit: "s", ...net, meta: { note: L("The key name wandog_delay is not confirmed on every firmware build.", "wandog_delay 呢個鍵名未必每個韌體版本都一樣。"), showWhen: [[{ id: `${F}.mode`, in: DUAL }, rule("check", ["1"])]] } }),
    e("fb-count", G.detect, "wandog_fb_count", "stepper", L("Good tests before switching back", "成功幾次先轉返"), L("How many passed tests count as the main line being back.", "要成功幾次先當主線已經恢復。"), { min: 1, max: 20, unit: "tests", ...net, meta: { showWhen: [[{ id: `${F}.mode`, in: DUAL }, rule("policy", ["fb"])]] } }),
    e("fb-delay", G.detect, "wandog_fb_delay", "stepper", L("Wait before switching back", "轉返前等幾耐"), L("Seconds to wait once the main line looks fine.", "主線睇落冇事之後等嘅秒數。"), { min: 0, max: 600, unit: "s", ...net, meta: { showWhen: [[{ id: `${F}.mode`, in: DUAL }, rule("policy", ["fb"])]] } }),

    e("wan1-enable", G.second, "wan1_enable", "switch", L("Use the second connection", "使用第二條連線"), L("Turns the second connection on or off.", "開或者關第二條連線。"), { values: ON_OFF, ...wan1, meta: { showWhen: { id: `${F}.mode`, in: DUAL } } }),
    e("wan1-proto", G.second, "wan1_proto", "segmented", L("Second connection type", "第二條連線類型"), L("How the second line gets its address.", "第二條線點樣攞地址。"), {
      ...wan1, meta: { showWhen: { id: `${F}.mode`, in: DUAL } },
      options: [["dhcp", L("Automatic", "自動")], ["static", L("Fixed IP", "固定 IP")], ["pppoe", L("PPPoE", "PPPoE")]],
    }),
    e("wan1-ip", G.second, "wan1_ipaddr_x", "ipv4", L("Internet address", "上網地址"), L("The address for the second line.", "第二條線嘅地址。"), { optional: true, ...wan1, meta: { showWhen: [[{ id: `${F}.mode`, in: DUAL }, rule("wan1-proto", ["static"])]] } }),
    e("wan1-mask", G.second, "wan1_netmask_x", "select", L("Network size", "網絡大小"), L("The subnet mask for the second line.", "第二條線嘅子網遮罩。"), { options: MASKS, ...wan1, meta: { showWhen: [[{ id: `${F}.mode`, in: DUAL }, rule("wan1-proto", ["static"])]] } }),
    e("wan1-gateway", G.second, "wan1_gateway_x", "ipv4", L("Gateway", "網關"), L("The router that carries the second line's traffic.", "負責轉送第二條線流量嘅路由器。"), { optional: true, ...wan1, meta: { showWhen: [[{ id: `${F}.mode`, in: DUAL }, rule("wan1-proto", ["static"])]] } }),
    e("wan1-clone", G.second, "wan1_hwaddr_x", "device", L("Clone a MAC address", "複製 MAC 地址"), L("Pick a device to copy its MAC address onto the second line. Empty uses the router's own.", "揀一部裝置，將佢嘅 MAC 地址複製去第二條線。留空就用路由器自己嘅。"), { optional: true, ...wan1, meta: { showWhen: { id: `${F}.mode`, in: DUAL } } }),
    e("wan1-mtu", G.second, "wan1_mtu", "stepper", L("MTU", "MTU"), L("The largest packet sent on the second line.", "第二條線傳送嘅最大封包。"), { min: 576, max: 1500, unit: "bytes", ...wan1, meta: { showWhen: { id: `${F}.mode`, in: DUAL } } }),
  ],

  domainMeta: [{ id: F, icon: "alt_route", label: L("Dual WAN", "雙 WAN"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [F]: async (ctx) => {
      const n = ctx.nvram;
      const mode = read(n, "wans_dualwan");
      return {
        enabled: DUAL.includes(mode),
        mode,
        policy: read(n, "wans_mode"),
        wans: [wanStatus(n, 0), wanStatus(n, 1)],
        entries: ctx.entries(),
        inProgress: [],
      };
    },
  },

  routes(api) {
    api.get("/status", async ({ live }) => {
      const n = (await live()).nvram;
      return { enabled: DUAL.includes(read(n, "wans_dualwan")), mode: read(n, "wans_dualwan"), policy: read(n, "wans_mode"), wans: [wanStatus(n, 0), wanStatus(n, 1)] };
    });
  },

  actions: {
    // Pings the connection-check target (or the main line's gateway) so a person can see it answers.
    probe: {
      risk: "low",
      run: async ({ exec, nvram, body }) => {
        const n = await nvram();
        const wanted = String(body.target ?? "").trim() || read(n, "wandog_target") || read(n, "wan0_gateway");
        let target;
        try {
          target = hostTarget(wanted);
        } catch {
          return { ok: false, message: "There is no valid test target. Enter one under Test against." };
        }
        const out = await exec(`ping -c 2 -W 2 ${target}`);
        return { ok: out.code === 0 && /\b0% packet loss/.test(out.stdout), target, message: out.code === 0 ? `${target} answered.` : `${target} did not answer.` };
      },
    },
  },

  fakeRouter: {
    nvram: {
      wans_dualwan: "wan none", wans_mode: "fo", wans_lanport: "4", wans_lb_ratio: "3:1", wans_routing_enable: "0",
      wandog_enable: "1", wandog_target: "203.0.113.9", wandog_interval: "5", wandog_maxfail: "12", wandog_delay: "0", wandog_fb_count: "4", wandog_fb_delay: "0",
      wan1_enable: "0", wan1_proto: "dhcp", wan1_ipaddr_x: "", wan1_netmask_x: "255.255.255.0", wan1_gateway_x: "", wan1_hwaddr_x: "", wan1_mtu: "1500",
      wan1_state_t: "4", wan1_ipaddr: "", wan1_gateway: "",
    },
  },
};
