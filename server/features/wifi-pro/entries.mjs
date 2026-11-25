// The wireless settings that sit beyond the basic band controls: standards,
// streams and beamforming, roaming, channel details, beacon timing, security
// extras, regulation and the on-air schedule. One block of entries is built for
// every band the router reports, so a tri-band router gets three blocks.
//
// A setting whose real nvram key could not be confirmed carries meta.note,
// which the screen lists under "In progress" so nothing is passed off as
// verified when it has only been proved against the pretend router.
import { L, ON_OFF } from "../kit.mjs";

const BAND = { 2: L("2.4 GHz", "2.4 GHz"), 1: L("5 GHz", "5 GHz"), 4: L("6 GHz", "6 GHz") };
export const bandName = (nband, index) => BAND[nband] ?? L(`Band ${index + 1}`, `頻段 ${index + 1}`);

const UNSURE = (en, yue) => ({ note: L(en, yue) });
const NEEDS_HARDWARE = UNSURE(
  "The setting name follows common Asuswrt builds and is proved against the pretend router only. Confirm it on your model.",
  "設定名稱跟足常見 Asuswrt 版本，只喺模擬路由器證實過。請喺你部型號上確認。",
);

export function bandEntries(index, nband) {
  const p = `wl${index}`;
  const band = bandName(nband, index);
  const five = nband === "1" || nband === "4";
  const g = (id, en, yue) => ({ group: `band${index}-${id}`, groupLabel: L(`${band.en}: ${en}`, `${band.yue}：${yue}`) });
  const base = (id, name, key, extra) => ({ id: `wifi-pro.${p}.${id}`, key: `${p}_${key}`, restart: "restart_wireless", risk: "network", ...g(...name), ...extra });
  const sw = (id, name, key, label, help, extra = {}) => base(id, name, key, { control: "switch", values: ON_OFF, label, help, ...extra });
  const standards = ["standards", "Wi-Fi standards", "Wi-Fi 標準"];
  const streams = ["streams", "Streams and beamforming", "串流同波束成形"];
  const roaming = ["roaming", "Roaming and steering", "漫遊同引導"];
  const channel = ["channel", "Channel details", "頻道細節"];
  const timing = ["timing", "Beacon timing", "信標時序"];
  const security = ["security", "Security extras", "保安補充"];
  const region = ["region", "Region", "地區"];
  const sched = ["schedule", "Schedule", "時間表"];

  return [
    base("mode", standards, "nmode_x", {
      control: "select",
      options: [
        ["0", L("Automatic", "自動"), L("Every standard the radio supports. Best for most homes.", "電台支援嘅標準全部開，大部分屋企都適合。")],
        ["1", L("Newer devices only", "淨係新裝置"), L("Wi-Fi 4 and newer. Older devices cannot join this band.", "Wi-Fi 4 或以上。舊裝置連唔到呢個頻段。")],
        ["2", L("Legacy compatible", "兼容舊裝置"), L("Keeps the old protocol on for very old gadgets, at the cost of speed.", "為好舊嘅裝置保留舊協定，速度會慢啲。")],
      ],
      label: L("Wi-Fi 6 legacy protocol", "Wi-Fi 6 舊協定"),
      help: L("Choose whether older devices may join. Legacy mode slows everyone on the band, so leave it off unless an old device cannot connect.", "揀舊裝置可唔可以連入。兼容舊裝置會拖慢成個頻段，除非有舊裝置連唔到，否則唔好開。"),
      meta: NEEDS_HARDWARE,
    }),
    sw("ax", standards, "11ax", L("802.11ax (Wi-Fi 6) mode", "802.11ax（Wi-Fi 6）模式"), L("Lets Wi-Fi 6 devices use the faster standard. Turn it off only to fix a device that fails to connect.", "等 Wi-Fi 6 裝置用較快嘅標準。淨係有裝置連唔到先至關。")),
    sw("be", standards, "11be", L("802.11be (Wi-Fi 7) mode", "802.11be（Wi-Fi 7）模式"), L("Wi-Fi 7 features such as wider channels and multi-link. Only routers with a Wi-Fi 7 radio have it.", "Wi-Fi 7 功能，例如更闊頻寬同多連結。淨係有 Wi-Fi 7 電台嘅型號先有。"), { requires: "wifi7" }),
    sw("twt", standards, "twt", L("Target Wake Time", "目標喚醒時間（TWT）"), L("Lets battery devices agree when to wake, which saves power. A few older devices disconnect when it is on.", "等電池裝置約好幾時喚醒，慳電。少數舊裝置開咗會斷線。"), { firmware: "merlin", meta: NEEDS_HARDWARE }),

    base("ofdma", streams, "ofdma", {
      control: "select",
      options: [
        ["0", L("Off", "關"), L("One device talks at a time.", "一次淨係一部裝置傾偈。")],
        ["1", L("Downlink OFDMA", "下行 OFDMA"), L("The router sends to several devices at once.", "路由器同時向幾部裝置傳資料。")],
        ["2", L("Downlink and uplink OFDMA", "上下行 OFDMA"), L("Devices can also send together.", "裝置亦可以同時上傳。")],
        ["3", L("OFDMA with MU-MIMO", "OFDMA 加 MU-MIMO"), L("Adds multi-user streams on top of OFDMA.", "OFDMA 之上再加多用戶串流。")],
      ],
      label: L("OFDMA and 802.11ax MU-MIMO", "OFDMA 同 802.11ax MU-MIMO"),
      help: L("Splits the channel so many devices share it efficiently. Leave on for busy homes with many devices.", "將頻道分細，等好多裝置有效率咁共用。裝置多嘅屋企建議開。"),
      meta: NEEDS_HARDWARE,
    }),
    sw("mumimo", streams, "mumimo", L("MU-MIMO", "MU-MIMO"), L("Sends separate streams to several devices at the same time. Needs devices that support it.", "同時向幾部裝置傳各自嘅串流。裝置要支援先有用。")),
    sw("txbf", streams, "txbf", L("Explicit beamforming", "顯式波束成形"), L("Aims the signal at devices that report where they are. Helps range and speed.", "將訊號射向會匯報位置嘅裝置，對距離同速度有幫助。")),
    sw("itxbf", streams, "itxbf", L("Universal beamforming", "通用波束成形"), L("Aims the signal at older devices that cannot report their position. Usually helpful, rarely harmful.", "對唔會匯報位置嘅舊裝置都集中訊號。通常有益，好少有害。")),
    sw("atf", streams, "atf", L("Airtime fairness", "公平空中時間"), L("Stops one slow device from using most of the airtime. Good for mixed old and new devices.", "避免一部慢裝置霸住大部分空中時間。新舊裝置混用好有用。")),

    base("rssi", roaming, "user_rssi", {
      control: "slider", min: -90, max: 0, step: 5, unit: " dBm",
      label: L("Roaming assistant threshold", "漫遊助手門檻"),
      help: L("When a device's signal falls below this level the router nudges it to a closer access point. Set 0 to turn the assistant off. -70 is a common choice.", "裝置訊號低過呢個數值，路由器會叫佢轉去較近嘅接入點。設 0 就關閉。-70 係常用值。"),
      meta: NEEDS_HARDWARE,
    }),
    sw("rrm", roaming, "rrm", L("802.11k neighbour reports", "802.11k 鄰近報告"), L("Tells devices which other access points are nearby so they roam faster.", "話俾裝置知附近有邊啲接入點，等佢哋漫遊得快啲。"), { meta: NEEDS_HARDWARE }),
    sw("wnm", roaming, "wnm", L("802.11v network-assisted roaming", "802.11v 網絡協助漫遊"), L("Lets the router suggest a better access point to a device.", "等路由器向裝置建議更好嘅接入點。"), { meta: NEEDS_HARDWARE }),
    sw("ft", roaming, "ft_enable", L("802.11r fast transition", "802.11r 快速轉換"), L("Cuts the pause when a device roams. A few devices fail to join when it is on.", "減少裝置漫遊時嘅停頓。少數裝置開咗會連唔到。"), { firmware: "merlin", meta: NEEDS_HARDWARE }),
    base("mfp", roaming, "mfp", {
      control: "select",
      options: [
        ["0", L("Off", "關"), L("Management frames are not protected.", "管理訊框唔受保護。")],
        ["1", L("Capable", "可用"), L("Protected when the device supports it.", "裝置支援就用保護。")],
        ["2", L("Required", "必須"), L("Only devices with protected management frames can join.", "淨係支援保護管理訊框嘅裝置先連到。")],
      ],
      label: L("Protected management frames", "受保護管理訊框"),
      help: L("Stops attackers from kicking devices off with fake disconnect messages. WPA3 needs at least Capable.", "防止有人發假斷線訊息踢走裝置。WPA3 起碼要「可用」。"),
    }),

    base("ctrl", channel, "nctrlsb", {
      control: "select",
      options: [["lower", L("Lower", "下邊"), L("The control channel sits below the extra width.", "控制頻道喺額外頻寬下面。")], ["upper", L("Upper", "上邊"), L("The control channel sits above the extra width.", "控制頻道喺額外頻寬上面。")]],
      label: L("Control channel", "控制頻道"),
      help: L("Used when the channel is wider than 20 MHz: which side of the wide channel carries the main signal. Change it to dodge a neighbour.", "頻寬超過 20 MHz 時用：主訊號喺闊頻道嘅邊一面。想避開鄰居可以轉。"),
      meta: NEEDS_HARDWARE,
    }),
    ...(five
      ? [
          sw("dfs", channel, "acs_dfs", L("Use DFS channels", "用 DFS 頻道"), L("More channels to choose from, but the router must step aside if a weather radar is detected, which briefly drops Wi-Fi.", "有更多頻道可揀，但偵測到氣象雷達就要避開，Wi-Fi 會短暫中斷。"), { meta: NEEDS_HARDWARE }),
          sw("bw160", channel, "bw_160", L("160 MHz channels", "160 MHz 頻道"), L("Allows the widest channel for top speed. It uses DFS channels and suffers more from neighbours.", "容許最闊嘅頻道，速度最快。要用 DFS 頻道，亦較易受鄰居影響。"), { meta: NEEDS_HARDWARE }),
        ]
      : []),

    base("bcn", timing, "bcn", {
      control: "slider", min: 20, max: 1000, step: 10, unit: " ms",
      label: L("Beacon interval", "信標間隔"),
      help: L("How often the router announces the network. 100 ms is standard; longer saves a little power but slows discovery.", "路由器幾耐廣播一次網絡。100 毫秒係標準；越長越慳電，但搵網絡越慢。"),
    }),
    base("dtim", timing, "dtim", {
      control: "stepper", min: 1, max: 255, unit: " beacons",
      label: L("DTIM interval", "DTIM 間隔"),
      help: L("How many beacons pass between wake-up calls for sleeping devices. Higher saves phone battery but delays multicast and some video.", "喺幾多個信標之後叫醒休眠裝置一次。越高手機越慳電，但多播同部分影片會慢啲。"),
    }),
    base("mrate", timing, "mrate_x", {
      control: "select",
      options: [["0", L("Automatic", "自動")], ...["1", "2", "5.5", "6", "9", "11", "12", "18", "24", "36", "48", "54"].map((rate, i) => [String(i + 1), L(`${rate} Mbps`, `${rate} Mbps`)])],
      label: L("Multicast rate", "多播速率"),
      help: L("The speed used for multicast and broadcast traffic. A higher fixed rate frees airtime for IPTV, but far devices may miss it.", "多播同廣播用嘅速度。固定高速可以慳空中時間，但遠啲嘅裝置可能收唔到。"),
    }),

    base("crypto", security, "crypto", {
      control: "select",
      options: [["aes", L("AES", "AES"), L("The modern, safe choice.", "現代、安全嘅選擇。")], ["tkip+aes", L("TKIP and AES", "TKIP 加 AES"), L("Also lets very old devices join, but is weaker.", "好舊嘅裝置都連到，但較弱。")]],
      label: L("WPA encryption", "WPA 加密"),
      help: L("Use AES unless a device from the 2000s refuses to connect. WPA3 always uses AES.", "除非有二千年代嘅舊裝置連唔到，否則用 AES。WPA3 一定用 AES。"),
    }),
    base("radius-ip", security, "radius_ipaddr", {
      control: "ipv4", optional: true,
      label: L("RADIUS server address", "RADIUS 伺服器地址"),
      help: L("The address of your RADIUS server. WPA Enterprise sign-in needs it. Leave empty for a home network.", "你嘅 RADIUS 伺服器地址。WPA 企業登入需要。屋企網絡留空。"),
    }),
    base("radius-port", security, "radius_port", {
      control: "port", min: 1, max: 65535, presets: [["1812", L("Standard RADIUS", "標準 RADIUS")], ["1645", L("Older RADIUS", "舊式 RADIUS")]],
      label: L("RADIUS port", "RADIUS 連接埠"),
      help: L("The port the RADIUS server listens on. 1812 is the standard.", "RADIUS 伺服器監聽嘅連接埠。標準係 1812。"),
    }),
    base("radius-key", security, "radius_key", {
      control: "password", secret: true, minLength: 1, maxLength: 64,
      label: L("RADIUS shared secret", "RADIUS 共用密碼"),
      help: L("The secret shared with your RADIUS server. It is hidden everywhere and never sent to your browser.", "同 RADIUS 伺服器共用嘅密碼。到處都隱藏，亦唔會傳去瀏覽器。"),
    }),

    base("country", region, "country_code", {
      control: "text", freeText: true, freeTextReason: "The regulatory region is reported by the firmware and shown as it is; it is read only.", maxLength: 8, readOnly: true, risk: "low",
      hint: L("Set by the firmware and the router's sales region. It cannot be changed here.", "由韌體同路由器銷售地區決定，呢度改唔到。"),
      label: L("Regulatory region", "法規地區"),
      help: L("The country code the radio uses to decide which channels and power are legal. Shown for reference.", "電台用嚟決定邊啲頻道同功率合法嘅國家代碼。只供參考。"),
    }),

    sw("sched-on", sched, "timesched", L("Switch the radio on a schedule", "按時間表開關電台"), L("Turns this band on only during the times painted below. Outside them the radio is off.", "淨係喺下面畫咗嘅時段開呢個頻段，其他時間關閉。")),
    base("sched", sched, "sched", {
      control: "schedule", step: 60,
      label: L("Wi-Fi schedule", "Wi-Fi 時間表"),
      help: L("Paint the hours this band should be on. Click or drag across the grid; keyboard users press Space on a cell.", "畫出呢個頻段應該開嘅時間。撳或者拖過格仔；鍵盤用戶喺格仔撳空白鍵。"),
      meta: UNSURE("The schedule is stored as days and times, and the router's own on-disk format still needs to be confirmed on your model.", "時間表以日同時間儲存，路由器自己嘅儲存格式仍要喺你部型號上確認。"),
    }),
  ];
}

// Starting values for the pretend router.
export function bandDefaults(index, nband) {
  const p = `wl${index}`;
  const five = nband === "1" || nband === "4";
  return {
    [`${p}_nmode_x`]: "0", [`${p}_11ax`]: "1", [`${p}_11be`]: "0", [`${p}_twt`]: "1",
    [`${p}_ofdma`]: "3", [`${p}_mumimo`]: "1", [`${p}_txbf`]: "1", [`${p}_itxbf`]: "1", [`${p}_atf`]: "0",
    [`${p}_user_rssi`]: "-70", [`${p}_rrm`]: "1", [`${p}_wnm`]: "1", [`${p}_ft_enable`]: "0", [`${p}_mfp`]: "1",
    [`${p}_nctrlsb`]: "lower",
    ...(five ? { [`${p}_acs_dfs`]: "1", [`${p}_bw_160`]: "0" } : {}),
    [`${p}_bcn`]: "100", [`${p}_dtim`]: "3", [`${p}_mrate_x`]: "0",
    [`${p}_crypto`]: "aes", [`${p}_radius_ipaddr`]: "", [`${p}_radius_port`]: "1812", [`${p}_radius_key`]: "change-this-secret",
    [`${p}_country_code`]: "HK",
    [`${p}_timesched`]: "0", [`${p}_sched`]: "0123456@07:00-23:00",
  };
}
