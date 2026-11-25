// Guest networks, all of them: up to three per band, each with its own name,
// security, access time limit, intranet access, bandwidth limit and device cap.
//
// The stock catalogue already owns guest network 1 of each band (switch, name,
// password and intranet access). This feature adds the settings that were
// missing there and everything for guest networks 2 and 3, using the router's
// real per-network keys such as wl0.2_bss_enabled and wl0.2_expire.
import { L, ON_OFF } from "../kit.mjs";

const BAND = { 2: L("2.4 GHz", "2.4 GHz"), 1: L("5 GHz", "5 GHz"), 4: L("6 GHz", "6 GHz") };
const GUESTS = [1, 2, 3];
const FREE_NAME = "A network name is whatever the owner wants to call it.";

const EXPIRE = [
  ["0", L("No limit", "冇限制")],
  ["1800", L("30 minutes", "30 分鐘")],
  ["3600", L("1 hour", "1 小時")],
  ["7200", L("2 hours", "2 小時")],
  ["14400", L("4 hours", "4 小時")],
  ["28800", L("8 hours", "8 小時")],
  ["86400", L("1 day", "1 日")],
  ["259200", L("3 days", "3 日")],
  ["604800", L("7 days", "7 日")],
];

const bandOf = (band) => BAND[band.nband] ?? L(`Band ${band.index + 1}`, `頻段 ${band.index + 1}`);

export function guestEntries(band) {
  const name = bandOf(band);
  const out = [];
  for (const n of GUESTS) {
    const p = `wl${band.index}.${n}`;
    const group = `guest-${band.index}-${n}`;
    const groupLabel = L(`${name.en}: guest network ${n}`, `${name.yue}：訪客網絡 ${n}`);
    const entry = (id, key, extra) => ({ id: `wifi-guest-plus.${p}.${id}`, key: `${p}_${key}`, group, groupLabel, restart: "restart_wireless", risk: "low", ...extra });
    // Guest network 1 already has these four in the stock catalogue.
    if (n > 1) {
      out.push(
        entry("enabled", "bss_enabled", { control: "switch", values: ON_OFF, label: L(`Guest network ${n}`, `訪客網絡 ${n}`), help: L("Another separate Wi-Fi for visitors, with its own name and rules.", "俾訪客用嘅另一個獨立 Wi-Fi，有自己嘅名同規則。") }),
        entry("ssid", "ssid", { control: "text", freeText: true, freeTextReason: FREE_NAME, maxLength: 32, minLength: 1, hint: L("Up to 32 characters.", "最多 32 個字元。"), label: L("Network name", "網絡名稱"), help: L("The name visitors look for.", "訪客搵嘅網絡名稱。") }),
        entry("password", "wpa_psk", { control: "password", secret: true, minLength: 8, maxLength: 63, label: L("Password", "密碼"), help: L("8 to 63 characters. Used when the security below is not Open.", "8 至 63 個字元。下面嘅保安唔係「開放」時使用。") }),
        entry("lan", "lanaccess", { control: "switch", values: { on: "on", off: "off" }, label: L("Intranet access", "內部網絡存取"), help: L("Lets guests reach your printer, files and other home devices. Keep it off so visitors only get the internet.", "等訪客見到你部打印機、檔案同其他屋企裝置。建議關住，訪客就淨係可以上網。") }),
      );
    }
    out.push(
      entry("auth", "auth_mode_x", {
        control: "select", risk: "network",
        options: [["open", L("Open (no password)", "開放（無密碼）"), L("Anyone nearby can join. Good for a public café style network.", "附近嘅人都可以連。適合公開式網絡。")], ["psk2", L("WPA2 Personal", "WPA2 個人"), L("A shared password protects the network.", "用共用密碼保護網絡。")], ["psk2sae", L("WPA2 and WPA3 Personal", "WPA2 同 WPA3 個人"), L("Works with old and new devices.", "新舊裝置都連到。")], ["sae", L("WPA3 Personal", "WPA3 個人"), L("Strongest, but older devices cannot join.", "最安全，但舊裝置連唔到。")]],
        label: L("Security", "保安模式"), help: L("Visitors on an Open network need no password. Pick WPA2 or WPA3 to ask for one.", "開放網絡嘅訪客唔使密碼。揀 WPA2 或 WPA3 就要密碼。"),
      }),
      entry("hidden", "closed", { control: "switch", values: ON_OFF, label: L("Hide network name", "隱藏網絡名稱"), help: L("Visitors must type the name by hand. This does not make the network more secure.", "訪客要人手打名。呢樣唔會令網絡更安全。") }),
      entry("expire", "expire", {
        control: "select", options: EXPIRE,
        label: L("Access time limit", "使用時間限制"),
        help: L("The guest network switches itself off after this long. Pick No limit to keep it on until you turn it off.", "過咗呢段時間，訪客網絡會自動關閉。揀「冇限制」就一直開到你自己關。"),
      }),
      entry("maxassoc", "maxassoc", { control: "stepper", min: 1, max: 128, unit: " devices", label: L("Most devices at once", "同時最多裝置"), help: L("The most devices allowed on this guest network together. Extra devices are refused until one leaves.", "呢個訪客網絡同時容許嘅最多裝置數目。超出嘅要等有裝置離開先連到。") }),
      entry("bw-on", "bw_enabled", { control: "switch", values: ON_OFF, label: L("Bandwidth limit", "頻寬限制"), help: L("Caps how much speed this guest network can use, so visitors cannot slow the rest of the home.", "限制呢個訪客網絡可以用幾多速度，免得訪客拖慢屋企其他裝置。") }),
      entry("bw-down", "bw_dl", { control: "stepper", min: 0, max: 1048576, step: 1000, unit: " kbps", label: L("Download limit", "下載限速"), help: L("The fastest download this guest network may use. Applies only when the bandwidth limit is on.", "呢個訪客網絡最快可以用幾多下載速度。淨係開咗頻寬限制先生效。") }),
      entry("bw-up", "bw_ul", { control: "stepper", min: 0, max: 1048576, step: 1000, unit: " kbps", label: L("Upload limit", "上傳限速"), help: L("The fastest upload this guest network may use. Applies only when the bandwidth limit is on.", "呢個訪客網絡最快可以用幾多上傳速度。淨係開咗頻寬限制先生效。") }),
    );
  }
  return out;
}

function guestDefaults(band) {
  const out = {};
  for (const n of GUESTS) {
    const p = `wl${band.index}.${n}`;
    Object.assign(out, {
      [`${p}_auth_mode_x`]: "psk2", [`${p}_closed`]: "0", [`${p}_expire`]: "0", [`${p}_maxassoc`]: "32",
      [`${p}_bw_enabled`]: "0", [`${p}_bw_dl`]: "20000", [`${p}_bw_ul`]: "10000",
    });
    // Guest network 1 is created by the pretend router itself; 2 and 3 are ours.
    if (n > 1) Object.assign(out, { [`${p}_bss_enabled`]: "0", [`${p}_ssid`]: `Harbour Guest ${n}${band.index === 1 ? " 5G" : ""}`, [`${p}_wpa_psk`]: "visitors-welcome", [`${p}_lanaccess`]: "off" });
  }
  return out;
}

const DEMO_BANDS = [{ index: 0, nband: "2" }, { index: 1, nband: "1" }];

export default {
  id: "wifi-guest-plus",

  catalog: (info) => info.bands.flatMap(guestEntries),

  domainMeta: [{ id: "wifi-guest-plus", icon: "group", label: L("Guest networks", "訪客網絡"), group: { en: "Network", yue: "網絡" } }],
  domains: {
    "wifi-guest-plus": async (ctx) => {
      const stock = ctx.entries("wifi").filter((e) => /^wl\d+\.1\.(enabled|ssid|password|lan)$/.test(e.id));
      const networks = ctx.info.bands.flatMap((band) =>
        GUESTS.map((n) => {
          const p = `wl${band.index}.${n}`;
          return {
            band: band.index,
            nband: band.nband,
            number: n,
            ssid: ctx.nvram.get(`${p}_ssid`) ?? "",
            on: ctx.nvram.get(`${p}_bss_enabled`) === "1",
            open: ctx.nvram.get(`${p}_auth_mode_x`) === "open",
            intranet: ctx.nvram.get(`${p}_lanaccess`) === "on",
            expireSeconds: Number(ctx.nvram.get(`${p}_expire`) ?? 0) || 0,
            limited: ctx.nvram.get(`${p}_bw_enabled`) === "1",
          };
        }),
      );
      return { networks, stock, entries: ctx.entries(), bands: ctx.info.bands.map((b) => ({ index: b.index, nband: b.nband })) };
    },
  },

  routes(api) {
    // A read-only list of the guest networks that are on right now.
    api.get("/active", async ({ live }) => {
      const ctx = await live();
      const result = await ctx.exec("nvram show");
      const values = new Map(result.stdout.split("\n").map((line) => line.split("=")).filter((p) => p.length >= 2).map(([k, ...v]) => [k, v.join("=")]));
      const active = [];
      for (const band of ctx.info.bands) for (const n of GUESTS) if (values.get(`wl${band.index}.${n}_bss_enabled`) === "1") active.push({ band: band.index, number: n, ssid: values.get(`wl${band.index}.${n}_ssid`) ?? "" });
      return { active };
    });
  },

  fakeRouter: {
    nvram: () => Object.assign({}, ...DEMO_BANDS.map(guestDefaults)),
  },
};
