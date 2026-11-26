// The "My Wi-Fi is slow" checks. Each check looks at the router's real
// settings and readings and, when something is wrong or could be better,
// returns a finding: what it is, why it slows Wi-Fi, the evidence, and how to
// fix it. A fix on the router is a list of catalogue changes that the browser
// puts in the pending-changes dock, so it still goes through the preview, the
// confirmation, the safety net and undo. A fix is offered only when every
// setting it needs exists on this router and can be written; otherwise the
// finding says why it cannot be fixed from here.
//
// kind "problem": a setting or condition that is slowing Wi-Fi down now.
// kind "tip": something worth changing or trying that may help.
import { L } from "../kit.mjs";

export const LIMITS = {
  busyProblem: 70, // per cent of the air not free
  busyTip: 50,
  neighbours: 25, // per cent of the air used by other networks
  nonWifi: 15, // per cent of the air taken by non-Wi-Fi noise
  noise: -80, // dBm: a noise floor at or above this is high
  hot: 90, // degrees C
  warm: 80,
  weak: -75, // dBm
  veryWeak: -80,
  goodSignal: -67,
  slowLink: 30, // Mbps: a device this slow with a good signal is an old or struggling device
  lowPower: 60, // per cent transmit power
  longUptimeDays: 30,
};

const list = (devices, max = 4) => {
  const shown = devices.slice(0, max).map((d) => d.name || d.mac);
  return devices.length > max ? `${shown.join(", ")} and ${devices.length - max} more` : shown.join(", ");
};

export function diagnose({ reading, get, usable }) {
  const findings = [];
  const fix = (changes) => {
    for (const c of changes) {
      const reason = usable(c.id);
      if (reason) return { fix: null, fixBlocked: reason };
    }
    return { fix: { changes }, fixBlocked: null };
  };
  const add = (f) => findings.push({ evidence: null, steps: null, fix: null, fixBlocked: null, open: null, band: null, ...f });
  const bandsOn = reading.bands.filter((b) => b.on);

  for (const b of reading.bands) {
    const p = `wl${b.index}`;
    const band = b.band;
    const five = b.nband !== "2";
    const on = (key) => get(`${p}_${key}`);

    if (!b.on) {
      if (bandsOn.length) {
        add({ id: `${p}.radio-off`, kind: "problem", severity: 2, band,
          title: L(`The ${band} radio is switched off`, `${band} 無線電關咗`),
          why: L(`Every device has to share the ${bandsOn.map((x) => x.band).join(" and ")} band instead, so they slow each other down.`, `所有裝置都要擠喺 ${bandsOn.map((x) => x.band).join(" 同 ")}，互相拖慢。`),
          ...fix([{ id: `${p}.radio`, value: "1" }]) });
      }
      continue;
    }

    if (on("nmode_x") === "2") {
      add({ id: `${p}.legacy`, kind: "problem", severity: 3, band,
        title: L(`${band} is in legacy compatible mode`, `${band} 開咗兼容舊裝置模式`),
        why: L("Keeping the old protocol on makes every device on this band wait for the slowest one.", "保留舊協定會令呢個頻段所有裝置都要等最慢嗰部。"),
        steps: L("If a very old gadget stops connecting afterwards, put it on the 2.4 GHz guest network instead.", "之後如果有好舊嘅裝置連唔到，可以叫佢用 2.4 GHz 訪客網絡。"),
        ...fix([{ id: `wifi-pro.${p}.mode`, value: "0" }]) });
    }

    if (on("11ax") === "0") {
      add({ id: `${p}.ax-off`, kind: "problem", severity: 2, band,
        title: L(`Wi-Fi 6 is switched off on ${band}`, `${band} 關咗 Wi-Fi 6`),
        why: L("Wi-Fi 6 devices fall back to the older, slower standard.", "Wi-Fi 6 裝置會退返用較舊、較慢嘅標準。"),
        ...fix([{ id: `wifi-pro.${p}.ax`, value: "1" }]) });
    }

    const auth = on("auth_mode_x") ?? "";
    if (/tkip/i.test(on("crypto") ?? "") && !/sae/.test(auth) && auth !== "open") {
      add({ id: `${p}.tkip`, kind: "problem", severity: 3, band,
        title: L(`${band} allows TKIP encryption`, `${band} 容許 TKIP 加密`),
        why: L("Devices that use TKIP are held to 54 Mbps, the speed of Wi-Fi from 2003. AES has no such limit and is safer.", "用 TKIP 嘅裝置最快得 54 Mbps，即係 2003 年嘅 Wi-Fi 速度。AES 冇呢個限制，仲安全啲。"),
        ...fix([{ id: `wifi-pro.${p}.crypto`, value: "aes" }]) });
    }

    const weak = b.devices.filter((d) => d.rssi !== null && d.rssi < LIMITS.weak);
    const power = Number(on("txpower"));
    if (on("txpower") !== undefined && Number.isFinite(power) && power < LIMITS.lowPower) {
      add({ id: `${p}.low-power`, kind: "problem", severity: weak.length ? 3 : 2, band,
        title: L(`${band} transmit power is turned down to ${power}%`, `${band} 發射功率調低咗去 ${power}%`),
        why: L("A weaker signal means slower speeds further from the router.", "訊號弱咗，離路由器遠啲就會慢。"),
        evidence: weak.length ? L(`${weak.length} device${weak.length === 1 ? " has" : "s have"} a weak signal: ${list(weak)}.`, `有 ${weak.length} 部裝置訊號弱：${list(weak)}。`) : null,
        ...fix([{ id: `${p}.power`, value: "100" }]) });
    }

    const width = on("bw");
    const air = b.air;
    if (five && (width === "1" || width === "2")) {
      add({ id: `${p}.narrow`, kind: "problem", severity: 2, band,
        title: L(`${band} is held to a ${width === "1" ? "20" : "40"} MHz channel`, `${band} 頻寬限制咗喺 ${width === "1" ? "20" : "40"} MHz`),
        why: L(`A narrow channel caps every device on ${band}. Automatic lets the router use 80 MHz when the air allows it.`, `窄頻道會限制 ${band} 每部裝置嘅速度。揀自動，路由器喺空中許可時會用 80 MHz。`),
        ...fix([{ id: `${p}.width`, value: "0" }]) });
    }
    if (!five && width === "2" && air && ((air.otherNetworks ?? 0) >= LIMITS.neighbours || (air.busy ?? 0) >= LIMITS.busyTip)) {
      add({ id: `${p}.wide-crowded`, kind: "problem", severity: 2, band,
        title: L("2.4 GHz is forced to 40 MHz in crowded air", "2.4 GHz 喺擠迫嘅空中強制用 40 MHz"),
        why: L("On 2.4 GHz a 40 MHz channel overlaps the neighbours' networks, so both slow down. 20 MHz is faster here.", "2.4 GHz 用 40 MHz 會同鄰居網絡重疊，兩邊都慢。呢度用 20 MHz 反而快。"),
        evidence: L(`Other networks use ${air.otherNetworks ?? "?"}% of the air; it is busy ${air.busy ?? "?"}% of the time.`, `其他網絡佔用 ${air.otherNetworks ?? "?"}% 空中時間；${air.busy ?? "?"}% 時間繁忙。`),
        ...fix([{ id: `${p}.width`, value: "1" }]) });
    }

    const fixed = (on("chanspec") ?? "0") !== "0" && on("chanspec") !== "";
    if (air && air.busy !== null && air.busy >= LIMITS.busyTip) {
      const evidence = L(`The air on ${band} is busy ${air.busy}% of the time${air.otherNetworks !== null ? `, ${air.otherNetworks}% of it from other networks` : ""}.`, `${band} 嘅空中有 ${air.busy}% 時間繁忙${air.otherNetworks !== null ? `，其中 ${air.otherNetworks}% 來自其他網絡` : ""}。`);
      if (fixed) {
        add({ id: `${p}.fixed-busy`, kind: "problem", severity: 2, band, evidence,
          title: L(`${band} is stuck on a busy fixed channel`, `${band} 鎖死咗喺一個擠迫嘅頻道`),
          why: L("A fixed channel cannot move away from neighbours. Automatic lets the router pick a quieter one.", "固定頻道避唔開鄰居。揀自動，路由器會揀較靜嘅頻道。"),
          ...fix([{ id: `${p}.channel`, value: "0" }]) });
      } else {
        const action = { name: "wifi-diagnostics.acs", body: { band: b.index, hold: true }, label: L("Search for a quieter channel now", "即時搵較靜嘅頻道") };
        const reason = usable(`action:${action.name}`);
        add({ id: `${p}.busy-air`, kind: air.busy >= LIMITS.busyProblem ? "problem" : "tip", severity: air.busy >= LIMITS.busyProblem ? 2 : 1, band, evidence,
          title: L(`The air on ${band} is crowded`, `${band} 嘅空中好擠迫`),
          why: L("When the air is busy, devices wait their turn to talk, so everything feels slow.", "空中繁忙時，裝置要排隊先講到嘢，所以樣樣都慢。"),
          steps: five ? null : L("Use 5 GHz for devices that can: it has far more room than 2.4 GHz.", "支援 5 GHz 嘅裝置就用 5 GHz：空間比 2.4 GHz 多好多。"),
          fix: reason ? null : { action }, fixBlocked: reason });
      }
    }

    if (air && ((air.nonWifi ?? 0) >= LIMITS.nonWifi || (b.noise !== null && b.noise >= LIMITS.noise))) {
      add({ id: `${p}.interference`, kind: "tip", severity: 2, band,
        title: L(`Something that is not Wi-Fi is interfering on ${band}`, `${band} 有唔係 Wi-Fi 嘅嘢干擾緊`),
        why: L("Microwaves, baby monitors, cordless phones, Bluetooth speakers and USB 3 drives can drown out the signal.", "微波爐、嬰兒監察器、無線電話、藍牙喇叭同 USB 3 硬碟都可能蓋過訊號。"),
        evidence: L(`Non-Wi-Fi noise takes ${air.nonWifi ?? "?"}% of the air; the noise floor is ${b.noise ?? "?"} dBm.`, `非 Wi-Fi 噪音佔 ${air.nonWifi ?? "?"}% 空中時間；噪音底線係 ${b.noise ?? "?"} dBm。`),
        steps: L("Move the router at least a metre away from those gadgets, and plug USB 3 drives into a USB 2 port or use a short extension cable.", "將路由器移離呢啲裝置至少一米；USB 3 硬碟改插 USB 2 插口，或者用短延長線。") });
    }

    if (b.temperature !== null && b.temperature >= LIMITS.warm) {
      add({ id: `${p}.hot`, kind: b.temperature >= LIMITS.hot ? "problem" : "tip", severity: b.temperature >= LIMITS.hot ? 2 : 1, band,
        title: L(`The ${band} radio is running hot`, `${band} 無線電好熱`),
        why: L("A hot radio turns its own speed down to protect itself.", "無線電太熱會自己降速保護自己。"),
        evidence: L(`The radio reports ${b.temperature} °C.`, `無線電報告 ${b.temperature} °C。`),
        steps: L("Stand the router upright with space around it, out of the sun and off carpet, and keep its vents clear.", "將路由器企直擺，周圍留位，避開陽光同地氈，唔好擋住散熱孔。") });
    }

    if (weak.length && !(on("txpower") !== undefined && power < LIMITS.lowPower)) {
      const roaming = on("user_rssi");
      const changes = roaming === "0" && bandsOn.length > 1 ? [{ id: `wifi-pro.${p}.rssi`, value: "-70" }] : null;
      add({ id: `${p}.weak`, kind: "tip", severity: weak.some((d) => d.rssi < LIMITS.veryWeak) || weak.length >= 3 ? 2 : 1, band,
        title: L(`${weak.length} device${weak.length === 1 ? " is" : "s are"} too far from the router on ${band}`, `${band} 有 ${weak.length} 部裝置離路由器太遠`),
        why: L("A weak signal forces a device down to a slow speed, and it takes longer on the air, slowing everyone else too.", "訊號弱會令裝置跌到慢速，仲佔用多啲空中時間，連累其他人。"),
        evidence: L(`${list(weak)} (weakest ${Math.min(...weak.map((d) => d.rssi))} dBm).`, `${list(weak)}（最弱 ${Math.min(...weak.map((d) => d.rssi))} dBm）。`),
        steps: L("Put the router high up and in the middle of the home, away from thick walls, mirrors and fish tanks. If that is not enough, add an AiMesh node or a wired access point.", "將路由器放高啲、擺喺屋中間，避開厚牆、鏡同魚缸。如果都唔夠，加一部 AiMesh 節點或者有線接入點。"),
        ...(changes ? fix(changes) : {}) });
    }

    const slow = b.devices.filter((d) => d.rssi !== null && d.rssi >= LIMITS.goodSignal && d.linkMbps !== null && d.linkMbps < LIMITS.slowLink);
    if (slow.length && on("atf") === "0") {
      add({ id: `${p}.slow-devices`, kind: "tip", severity: 1, band,
        title: L(`Slow devices are hogging ${band}`, `慢裝置霸住 ${band}`),
        why: L("These devices have a good signal but talk slowly, so they take up much of the airtime. Airtime fairness stops them from slowing the others.", "呢啲裝置訊號好但講嘢慢，佔用大量空中時間。公平空中時間可以避免佢哋拖慢其他人。"),
        evidence: L(`${list(slow)} ${slow.length === 1 ? "is" : "are"} under ${LIMITS.slowLink} Mbps.`, `${list(slow)} 低過 ${LIMITS.slowLink} Mbps。`),
        ...fix([{ id: `wifi-pro.${p}.atf`, value: "1" }]) });
    }

    const helpers = [["mumimo", L("MU-MIMO", "MU-MIMO")], ["txbf", L("beamforming", "波束成形")]].filter(([key]) => on(key) === "0");
    if (helpers.length) {
      add({ id: `${p}.helpers-off`, kind: "tip", severity: 1, band,
        title: L(`${helpers.map(([, n]) => n.en).join(" and ")} ${helpers.length === 1 ? "is" : "are"} off on ${band}`, `${band} 關咗${helpers.map(([, n]) => n.yue).join("同")}`),
        why: L("Both let the router serve several devices faster at once. Leave them on unless a device misbehaves.", "兩樣都可以等路由器同時服務多部裝置。除非有裝置出事，否則開住佢。"),
        ...fix(helpers.map(([key]) => ({ id: `wifi-pro.${p}.${key}`, value: "1" }))) });
    }

    const guests = [1, 2, 3].filter((g) => get(`${p}.${g}_bss_enabled`) === "1");
    if (guests.length >= 2) {
      add({ id: `${p}.many-networks`, kind: "tip", severity: 1, band,
        title: L(`${band} broadcasts ${guests.length + 1} networks`, `${band} 廣播緊 ${guests.length + 1} 個網絡`),
        why: L("Every extra network sends its own announcements many times a second, which uses airtime.", "每多一個網絡，每秒都要多發好多次廣播，會用咗空中時間。"),
        steps: L("Switch off the guest networks nobody uses on the Wi-Fi screen.", "喺 Wi-Fi 畫面關咗冇人用嘅訪客網絡。"), open: "wifi" });
    }
  }

  // Router-wide checks.
  const accel = [["ctf_disable_force", "ports.ctf"], ["runner_disable", "ports.runner"]].filter(([key]) => get(key) === "1");
  if (accel.length) {
    add({ id: "router.acceleration-off", kind: "problem", severity: 3,
      title: L("Hardware acceleration is switched off", "硬件加速關咗"),
      why: L("Without it the router's processor handles every packet, which caps internet speed for Wi-Fi and wired devices alike.", "冇咗佢，路由器處理器要逐個封包處理，Wi-Fi 同有線裝置上網速度都會被封頂。"),
      steps: L("Takes effect after the router restarts.", "路由器重啟之後生效。"),
      ...fix(accel.map(([, id]) => ({ id, value: "0" }))) });
  }

  if (get("qos_enable") === "1" && get("qos_type") === "2") {
    add({ id: "router.limiter", kind: "tip", severity: 2, open: "qos",
      title: L("The bandwidth limiter is on", "頻寬限制開咗"),
      why: L("The limiter holds chosen devices to a fixed speed, which can look like slow Wi-Fi on those devices.", "頻寬限制會將指定裝置鎖死喺固定速度，喺嗰啲裝置上睇落似 Wi-Fi 慢。"),
      steps: L("Check the limits on the traffic priority screen, or switch the limiter off.", "去流量優先畫面檢查限制，或者關咗佢。"),
      ...fix([{ id: "qos.enabled", value: "0" }]) });
  } else if (get("qos_enable") === "1" && get("qos_type") === "0" && Number(get("qos_ibw")) > 0) {
    const mbps = Math.round(Number(get("qos_ibw")) / 1000);
    add({ id: "router.qos-cap", kind: "tip", severity: 2, open: "speed-test",
      title: L(`Traffic priority caps downloads at about ${mbps} Mbps`, `流量優先將下載封頂喺大約 ${mbps} Mbps`),
      why: L("Traditional traffic priority never goes faster than the download speed you entered. If your plan is faster, that figure is holding you back.", "傳統流量優先唔會快過你入咗嘅下載速度。如果你嘅計劃快過呢個數，就係佢拖住你。"),
      steps: L("Run a speed test with traffic priority off, then enter about 90% of the result as the download speed.", "關咗流量優先做一次速度測試，然後入返結果嘅九成做下載速度。") });
  }

  if (reading.uptimeDays !== null && reading.uptimeDays >= LIMITS.longUptimeDays) {
    add({ id: "router.uptime", kind: "tip", severity: 1, open: "system",
      title: L(`The router has been running for ${reading.uptimeDays} days`, `路由器已經連續運行咗 ${reading.uptimeDays} 日`),
      why: L("A restart clears memory and lets the radios pick fresh channels.", "重啟可以清記憶體，等無線電重新揀頻道。"),
      steps: L("Restart the router at a quiet time from the System screen.", "揀個靜啲嘅時間，喺系統畫面重啟路由器。") });
  }

  return findings.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "problem" ? -1 : 1) || b.severity - a.severity || a.id.localeCompare(b.id));
}

// Advice that always applies and needs nothing changed on the router.
export const ALWAYS = [
  { id: "always.speed-test", open: "speed-test", title: L("Test the internet line first", "先測試條線"), why: L("If a wired speed test is slow as well, the line, not the Wi-Fi, is the bottleneck.", "如果有線測速都慢，樽頸就係條線，唔係 Wi-Fi。") },
  { id: "always.five", open: null, title: L("Use 5 GHz near the router", "近路由器就用 5 GHz"), why: L("5 GHz is several times faster than 2.4 GHz over short distances; 2.4 GHz reaches further but slower.", "近距離 5 GHz 比 2.4 GHz 快幾倍；2.4 GHz 去得遠啲但慢啲。") },
  { id: "always.wire", open: null, title: L("Plug in what does not move", "唔郁嘅裝置就插線"), why: L("A TV, console or desktop on a cable frees the air for phones and laptops.", "電視、遊戲機或者桌面電腦插線，可以將空中時間留俾手機同手提電腦。") },
  { id: "always.firmware", open: "firmware-pro", title: L("Keep the firmware up to date", "保持韌體最新"), why: L("Updates often fix Wi-Fi drivers and speed problems.", "更新經常會修正 Wi-Fi 驅動同速度問題。") },
  { id: "always.diagnostics", open: "wifi-diagnostics", title: L("See every device live", "即時睇晒所有裝置"), why: L("Wi-Fi diagnostics shows each device's signal and who is using the most.", "Wi-Fi 診斷會顯示每部裝置嘅訊號同邊個用得最多。") },
];
