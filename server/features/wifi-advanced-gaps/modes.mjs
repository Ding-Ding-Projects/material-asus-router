// The five operation modes and what each one writes. A mode that needs a setting
// this router does not list is unavailable with the reason, never written blind.
// Router, access point and repeater use the standard mode number (1, 3, 2). A
// media bridge and an AiMesh node are an access-point style mode plus one more
// setting, which only some firmware lists.
import { L } from "../kit.mjs";

export const MODES = {
  router: {
    id: "router", icon: "router", writes: [["sw_mode", "1"]], keys: [],
    label: L("Wireless router", "無線路由器"),
    about: L("The normal mode: this device connects to the internet, shares out addresses and runs the firewall.", "正常模式：呢部裝置連接互聯網、分配地址同行防火牆。"),
  },
  ap: {
    id: "ap", icon: "wifi_tethering", writes: [["sw_mode", "3"]], keys: [],
    label: L("Access point", "接入點"),
    about: L("Joins another router by cable and only adds Wi-Fi. The other router keeps doing the routing.", "用網線接去另一部路由器，淨係加 Wi-Fi。路由由另一部繼續做。"),
  },
  repeater: {
    id: "repeater", icon: "cell_tower", writes: [["sw_mode", "2"]], keys: ["wlc_ssid"], upstream: true,
    label: L("Repeater", "中繼器"),
    about: L("Joins another router over Wi-Fi and repeats it further. Speed drops by about half, so it is a last resort.", "用 Wi-Fi 接去另一部路由器再擴展覆蓋。速度大約減半，所以係最後手段。"),
  },
  bridge: {
    id: "bridge", icon: "settings_ethernet", writes: [["sw_mode", "3"], ["wlc_psta", "1"]], keys: ["wlc_psta", "wlc_ssid"], upstream: true,
    label: L("Media bridge", "媒體橋接"),
    about: L("Joins another router over Wi-Fi and hands the connection to wired devices such as a television or a console.", "用 Wi-Fi 接去另一部路由器，再用網線交俾電視或遊戲機等有線裝置。"),
  },
  "aimesh-node": {
    id: "aimesh-node", icon: "hub", writes: [["sw_mode", "3"], ["re_mode", "1"]], keys: ["re_mode"], needs: "amas",
    label: L("AiMesh node", "AiMesh 節點"),
    about: L("Becomes a node of another AiMesh router. You then add it from that router's own AiMesh page.", "變成另一部 AiMesh 路由器嘅節點。之後要喺嗰部路由器嘅 AiMesh 頁面加入。"),
  },
};

// The "also reset" settings: a mode that does not use one of these writes it back to 0 when the router has it.
const FLAGS = ["wlc_psta", "re_mode"];

export function currentMode(nvram) {
  const sw = nvram.get("sw_mode");
  if (sw === "3" && nvram.get("re_mode") === "1") return "aimesh-node";
  if (sw === "3" && nvram.get("wlc_psta") === "1") return "bridge";
  return { 1: "router", 2: "repeater", 3: "ap" }[sw] ?? "other";
}

const missing = (key) => L(`This router does not have the setting ${key}`, `呢部路由器冇 ${key} 呢個設定`);

// { available, reason } for one mode on this router right now.
export function availability(mode, nvram, info, current) {
  if (mode.id === current) return { available: false, already: true, reason: L("The router is already in this mode.", "路由器已經係呢個模式。") };
  for (const key of mode.keys) if (!nvram.has(key)) return { available: false, reason: missing(key) };
  if (mode.needs && !info.capabilities.includes(mode.needs)) return { available: false, reason: L("This router model does not support AiMesh.", "呢個型號唔支援 AiMesh。") };
  if (mode.upstream && !(nvram.get("wlc_ssid") ?? "")) return { available: false, reason: L("No upstream Wi-Fi is stored on the router (wlc_ssid is empty). Connect it to that network with the router's own setup wizard first.", "路由器冇儲存上游 Wi-Fi（wlc_ssid 係空）。請先用路由器自己嘅設定精靈連去嗰個網絡。") };
  return { available: true, reason: null };
}

// The settings to write: the mode's own, then each flag it does not use set back to 0 where the router has it.
export function writesFor(mode, nvram) {
  const own = new Map(mode.writes);
  const writes = [...own];
  for (const key of FLAGS) if (!own.has(key) && nvram.has(key) && nvram.get(key) !== "0") writes.push([key, "0"]);
  return writes.filter(([key, value]) => nvram.get(key) !== value);
}
