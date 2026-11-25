// Wi-Fi band extras: the per-band radio settings that no other screen covers, written under each band's real
// key (wl0_ampdu, wl1_wme and so on). Frame aggregation and bursting, WMM, multicast handling, how many devices
// a band takes, MBO, preamble, radio power saving and the RTS and fragmentation thresholds. One block per band the
// router reports, so a tri-band router gets three.
//
// Everything here is a plain value the firmware documents (on, off, auto, a number, 0 or 1). Settings whose meaning
// or format is not clear, such as the vendor tuning tables, are not written here.
import { L, ON_OFF } from "../kit.mjs";

const F = "wifi-band-extras";
const BAND = { 2: L("2.4 GHz", "2.4 GHz"), 1: L("5 GHz", "5 GHz"), 4: L("6 GHz", "6 GHz") };
const bandName = (b) => BAND[b.nband] ?? L(`Band ${b.index + 1}`, `頻段 ${b.index + 1}`);
const AUTO = [
  ["auto", L("Automatic", "自動"), L("The firmware decides.", "由韌體決定。")],
  ["on", L("On", "開"), L("Always on.", "一直開。")],
  ["off", L("Off", "關"), L("Always off.", "一直關。")],
];
const ON_OFF_TEXT = { on: "on", off: "off" };

export function bandEntries(band) {
  const p = `wl${band.index}`;
  const name = bandName(band);
  const g = (id, en, yue) => ({ group: `band${band.index}-${id}`, groupLabel: L(`${name.en}: ${en}`, `${name.yue}：${yue}`) });
  const e = (group, id, key, extra) => ({ id: `${F}.${p}.${id}`, key: `${p}_${key}`, ...g(...group), restart: "restart_wireless", risk: "network", ...extra });
  const speed = ["speed", "Speed tricks", "加速功能"];
  const traffic = ["traffic", "Traffic handling", "流量處理"];
  const reach = ["reach", "Devices and reach", "裝置同覆蓋"];
  return [
    e(speed, "ampdu", "ampdu", { control: "select", options: AUTO, label: L("Combine frames (A-MPDU)", "合併訊框（A-MPDU）"), help: L("Sends several frames in one go. Leave on Automatic unless a device misbehaves.", "一次過傳幾個訊框。除非有裝置有問題，否則用自動。") }),
    e(speed, "amsdu", "amsdu", { control: "select", options: AUTO, label: L("Combine packets (A-MSDU)", "合併封包（A-MSDU）"), help: L("Packs several packets into one frame. Leave on Automatic unless a device misbehaves.", "將幾個封包放入一個訊框。除非有裝置有問題，否則用自動。") }),
    e(speed, "frameburst", "frameburst", { control: "switch", values: ON_OFF_TEXT, label: L("Frame bursting", "訊框連發"), help: L("Lets the router send frames back to back for more speed. A few older devices dislike it.", "路由器連續傳訊框，速度更快。少數舊裝置唔鍾意。") }),
    e(speed, "preamble", "plcphdr", { control: "select", options: [["long", L("Long", "長"), L("Works with every device.", "所有裝置都用得。")], ["short", L("Short", "短"), L("A little faster, for modern devices only.", "稍快，只適合新裝置。")]], label: L("Preamble", "前導碼"), help: L("The start of every frame. Long suits every device; short saves a little time.", "每個訊框嘅開頭。長嘅所有裝置都適用；短嘅慳少少時間。") }),
    e(traffic, "wme", "wme", { control: "select", options: AUTO, label: L("Wi-Fi Multimedia (WMM)", "Wi-Fi 多媒體（WMM）"), help: L("Gives calls and video priority over downloads. Wi-Fi 4 and newer need it on.", "畀通話同影片優先於下載。Wi-Fi 4 或以上要開。") }),
    e(traffic, "apsd", "wme_apsd", { control: "switch", values: ON_OFF_TEXT, label: L("WMM power save (APSD)", "WMM 慳電（APSD）"), help: L("Lets battery devices sleep between frames. Turn it off if a phone drops calls.", "等電池裝置喺訊框之間休息。電話通話斷線就關閉。") }),
    e(traffic, "wmf", "wmf_bss_enable", { control: "switch", values: ON_OFF, label: L("Wireless multicast forwarding", "無線組播轉發"), help: L("Turns multicast, such as TV streams, into one stream per device so Wi-Fi is not flooded.", "將組播（例如電視串流）變成每部裝置一條串流，免得塞爆 Wi-Fi。") }),
    e(traffic, "igs", "igs", { control: "switch", values: ON_OFF, label: L("IGMP snooping", "IGMP 窺探"), help: L("Sends multicast only to devices that asked for it.", "組播淨係傳俾有要求嘅裝置。") }),
    e(reach, "isolate", "ap_isolate", { control: "switch", values: ON_OFF, label: L("Keep devices apart from each other", "裝置之間互相隔開"), help: L("Wi-Fi devices on this band cannot see each other, only the internet and the router.", "呢個頻段嘅 Wi-Fi 裝置睇唔到對方，只可以上網同連路由器。") }),
    e(reach, "maxassoc", "bss_maxassoc", { control: "stepper", min: 1, max: 128, unit: " devices", label: L("Most devices at once", "同時最多裝置"), help: L("The most devices this band takes together. Extra devices are refused until one leaves.", "呢個頻段同時接受嘅最多裝置數。多出嚟嘅要等有裝置離開先連到。") }),
    e(reach, "coex", "obss_coex", { control: "switch", values: ON_OFF, label: L("Share the air with neighbours (20/40 MHz coexistence)", "同鄰居共用頻道（20/40 MHz 共存）"), help: L("Drops to a narrower channel when a neighbour needs the space. Turn it off only if you know your area is quiet.", "鄰居需要空間就縮窄頻道。淨係喺知道附近好靜先關。") }),
    e(reach, "mbo", "mbo_enable", { control: "switch", values: ON_OFF, label: L("Multi-Band Operation (MBO)", "多頻段運作（MBO）"), help: L("Helps devices pick the best band and roam between them.", "幫裝置揀最好嘅頻段，並喺頻段之間漫遊。") }),
    e(reach, "powersave", "radio_pwrsave_enable", { control: "switch", values: ON_OFF, label: L("Radio power saving", "電台慳電"), help: L("Lets the radio rest when no device is using it. Saves a little power, adds a little delay.", "冇裝置用嗰陣等電台休息。慳少少電，但會多少少延遲。") }),
    e(reach, "rts", "rts", { control: "stepper", min: 0, max: 2347, unit: " bytes", label: L("RTS threshold", "RTS 門檻"), help: L("Frames longer than this ask permission before sending. 2347 turns it off. Lower it only in a crowded area.", "長過呢個數嘅訊框會先問許可。2347 即係關閉。淨係好擠嘅地方先調低。") }),
    e(reach, "frag", "frag", { control: "stepper", min: 256, max: 2346, unit: " bytes", label: L("Fragmentation threshold", "分段門檻"), help: L("Frames longer than this are cut into pieces. 2346 turns it off. Lower it only on a noisy link.", "長過呢個數嘅訊框會切開。2346 即係關閉。淨係干擾多嘅連線先調低。") }),
  ];
}

const DEMO = { ampdu: "auto", amsdu: "auto", frameburst: "on", plcphdr: "long", wme: "on", wme_apsd: "on", wmf_bss_enable: "1", igs: "1", ap_isolate: "0", bss_maxassoc: "128", obss_coex: "1", mbo_enable: "0", radio_pwrsave_enable: "0", rts: "2347", frag: "2346" };

export default {
  id: F,

  catalog: (info) => info.bands.flatMap(bandEntries),

  domainMeta: [{ id: F, icon: "tune", label: L("Wi-Fi band extras", "Wi-Fi 頻段進階"), group: { en: "Network", yue: "網絡" } }],
  domains: { [F]: async (ctx) => ({ bands: ctx.info.bands.map((b) => ({ index: b.index, nband: b.nband })), entries: ctx.entries() }) },

  fakeRouter: {
    nvram: () => Object.fromEntries([0, 1].flatMap((i) => Object.entries(DEMO).map(([key, value]) => [`wl${i}_${key}`, value]))),
  },
};
