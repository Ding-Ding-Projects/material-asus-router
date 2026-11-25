// WPS and the wireless MAC filter.
//
//   - Per band: the filter mode (off, allow only the list, block the list) and the
//     list itself, edited with a device picker.
//   - Router wide: WPS on or off, WPS per band, the device PIN (hidden until asked
//     for) and a push-button action that starts WPS pairing for two minutes.
//
// The list is stored the way the router stores it, as "<AA:BB:CC:DD:EE:FF<..."
// (every address preceded by a "<"), so the router and this app always agree.
import { L, ON_OFF, isMac } from "../kit.mjs";

const BAND = { 2: L("2.4 GHz", "2.4 GHz"), 1: L("5 GHz", "5 GHz"), 4: L("6 GHz", "6 GHz") };
const MAX_LIST = 64;

const bandOf = (band) => BAND[band.nband] ?? L(`Band ${band.index + 1}`, `頻段 ${band.index + 1}`);
const other = (candidates, current) => candidates.find((c) => c !== current) ?? candidates[0];

export const parseMacList = (text) => String(text ?? "").split("<").map((item) => item.trim().toUpperCase()).filter(Boolean);

function bandEntries(band) {
  const name = bandOf(band);
  const p = `wl${band.index}`;
  const group = `band${band.index}-filter`;
  const groupLabel = L(`${name.en}: MAC filter`, `${name.yue}：MAC 過濾`);
  const base = { restart: "restart_wireless", group, groupLabel };
  return [
    {
      ...base, id: `wifi-wps-macfilter.${p}.macmode`, key: `${p}_macmode`, control: "select", risk: "network",
      options: [
        ["disabled", L("Off", "關"), L("Every device may try to join.", "所有裝置都可以嘗試連入。")],
        ["allow", L("Allow only the list", "淨係容許名單"), L("Only the devices below can join. Anything else is refused.", "淨係下面嘅裝置可以連入，其他全部拒絕。")],
        ["deny", L("Block the list", "封鎖名單"), L("Devices below cannot join. Everything else can.", "下面嘅裝置連唔到，其他裝置可以連。")],
      ],
      label: L("MAC filter mode", "MAC 過濾模式"),
      help: L("Allow-only is strict: a device not on the list, including your own phone, is refused. Add your own device first, then switch the mode.", "「淨係容許名單」好嚴：唔喺名單嘅裝置（包括你自己部手機）都會被拒絕。請先加入自己嘅裝置，再轉模式。"),
    },
    {
      ...base, id: `wifi-wps-macfilter.${p}.maclist`, key: `${p}_maclist_x`, control: "wifi-maclist", risk: "network", optional: true, maxItems: MAX_LIST,
      label: L("MAC filter list", "MAC 過濾名單"),
      help: L("The devices the filter applies to. Pick from the devices the router knows, or type an address. Up to 64 devices.", "過濾適用嘅裝置。可以由路由器知道嘅裝置揀，或者自己打地址。最多 64 部。"),
    },
    {
      ...base, id: `wifi-wps-macfilter.${p}.wps`, key: `${p}_wps_mode`, control: "switch", values: { on: "enabled", off: "disabled" }, risk: "low",
      group: `band${band.index}-wps`, groupLabel: L(`${name.en}: WPS`, `${name.yue}：WPS`),
      label: L("WPS on this band", "呢個頻段嘅 WPS"),
      help: L("Lets a device join by pressing a button instead of typing the password. Leave it off if you never use it: WPS is a weaker way in.", "等裝置撳掣就連到，唔使打密碼。如果從來唔用就關咗：WPS 係較弱嘅入口。"),
      meta: { note: L("The per-band WPS setting name is proved against the pretend router only. Confirm it on your model.", "每個頻段嘅 WPS 設定名稱只喺模擬路由器證實過。請喺你部型號上確認。") },
    },
  ];
}

const routerEntries = () => [
  {
    id: "wifi-wps-macfilter.enable", key: "wps_enable", control: "switch", values: ON_OFF, restart: "restart_wireless", risk: "low",
    group: "wps", groupLabel: L("WPS", "WPS"),
    label: L("Wi-Fi Protected Setup (WPS)", "Wi-Fi Protected Setup（WPS）"),
    help: L("The master switch for WPS. Off disables the push button and the PIN for every band.", "WPS 嘅總開關。關咗就所有頻段嘅按掣同 PIN 都停用。"),
  },
  {
    id: "wifi-wps-macfilter.pin", key: "wps_device_pin", control: "password", secret: true, readOnly: true, minLength: 8, maxLength: 8, restart: "", risk: "low",
    group: "wps", groupLabel: L("WPS", "WPS"),
    label: L("WPS device PIN", "WPS 裝置 PIN"),
    help: L("The router's own 8-digit PIN. It stays hidden until you press show, and it cannot be changed here.", "路由器自己嘅 8 位 PIN。撳顯示先會見到，呢度改唔到。"),
  },
];

export default {
  id: "wifi-wps-macfilter",

  catalog: (info) => [...routerEntries(), ...info.bands.flatMap(bandEntries)],

  // A new control type: the router's MAC list, with strict checks.
  controls: {
    "wifi-maclist": {
      validate(entry, text, fail) {
        if (text === "") return "";
        if (!text.startsWith("<")) fail("start the list with < before each address, for example <AA:BB:CC:DD:EE:FF.");
        const items = parseMacList(text);
        if (items.length === 0) fail("add at least one address, or leave the list empty.");
        if (items.length > MAX_LIST) fail(`use at most ${MAX_LIST} addresses.`);
        for (const item of items) if (!isMac(item)) fail(`"${item}" is not a MAC address such as AA:BB:CC:DD:EE:FF.`);
        if (new Set(items).size !== items.length) fail("remove the repeated address.");
        return items.map((item) => `<${item}`).join("");
      },
      sample: (_entry, current) => other(["<02:00:00:00:00:01", "<02:00:00:00:00:01<02:00:00:00:00:02"], String(current)),
      invalid: () => "<not-a-mac",
    },
  },

  domainMeta: [{ id: "wifi-wps-macfilter", icon: "filter_alt", label: L("WPS and MAC filter", "WPS 同 MAC 過濾"), group: { en: "Network", yue: "網絡" } }],
  domains: {
    "wifi-wps-macfilter": async (ctx) => ({
      bands: ctx.info.bands.map((band) => {
        const mode = ctx.nvram.get(`wl${band.index}_macmode`) || "disabled";
        const list = parseMacList(ctx.nvram.get(`wl${band.index}_maclist_x`));
        return { index: band.index, nband: band.nband, mode, list, locksOut: mode === "allow" && list.length === 0 };
      }),
      wps: { enabled: ctx.nvram.get("wps_enable") === "1", pinSet: (ctx.nvram.get("wps_device_pin") ?? "") !== "" },
      entries: ctx.entries(),
    }),
  },

  routes(api) {
    // The list a band would end up with if every connected device were added.
    api.get("/connected/:band", async ({ live, params, bad }) => {
      const ctx = await live();
      const band = ctx.info.bands.find((b) => String(b.index) === params.band);
      if (!band) throw bad("That band does not exist on this router.", 404);
      const out = await ctx.exec(`wl -i ${band.ifname} assoclist`);
      const macs = out.stdout.split("\n").map((line) => line.replace(/^assoclist\s+/, "").trim().toUpperCase()).filter((mac) => isMac(mac));
      return { band: band.index, macs };
    });
  },

  actions: {
    // Starts WPS pairing, the same as pressing the WPS button on the router.
    "push-button": {
      risk: "low",
      run: async ({ exec, nvram }) => {
        const values = await nvram();
        if (values.get("wps_enable") !== "1") return { ok: false, message: "WPS is switched off. Turn it on first, then start pairing." };
        const out = await exec("service start_wps_method");
        return { ok: out.code === 0, message: out.code === 0 ? "WPS pairing started. Press the button on the device within two minutes." : out.stderr || "The router refused to start WPS." };
      },
    },
  },

  fakeRouter: {
    nvram: {
      wps_enable: "1", wps_device_pin: "12345670",
      wl0_macmode: "disabled", wl0_maclist_x: "<3C:22:FB:10:20:30", wl0_wps_mode: "enabled",
      wl1_macmode: "disabled", wl1_maclist_x: "", wl1_wps_mode: "enabled",
    },
  },
};
