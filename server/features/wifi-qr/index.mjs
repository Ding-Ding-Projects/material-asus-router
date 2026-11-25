// Wi-Fi QR codes: lists the router's networks (each band and each guest
// network) and builds the sign-in text a phone camera understands. The QR
// picture itself is drawn in the browser (public/js/features/wifi-qr/qr.js).
// The password is handed out only through a POST route, so viewer accounts
// (who can read but not write) never receive it.
import { L, ON_OFF } from "../kit.mjs";

const BAND = { 2: "2.4 GHz", 1: "5 GHz", 4: "6 GHz" };
const LEVELS = ["L", "M", "Q", "H"];

// ASUS authentication modes to the type a phone expects in WIFI:T:... Enterprise modes cannot be a QR code.
export function securityOf(mode) {
  switch (mode) {
    case "open":
      return "nopass";
    case "psk":
    case "psk2":
    case "pskpsk2":
    case "psk2sae":
      return "WPA";
    case "sae":
      return "SAE";
    case "shared":
      return "WEP";
    default:
      return null;
  }
}

export function networksOf(nvram, info) {
  const get = (k, d = "") => nvram.get(k) ?? d;
  const out = [];
  for (const b of info.bands) {
    const band = BAND[b.nband] ?? `Band ${b.index + 1}`;
    const main = `wl${b.index}`;
    const guest = `wl${b.index}.1`;
    out.push({ id: main, kind: "main", band, ssid: get(`${main}_ssid`), mode: get(`${main}_auth_mode_x`, "psk2"), hidden: get(`${main}_closed`) === "1", enabled: get(`${main}_radio`, "1") === "1", hasPassword: get(`${main}_wpa_psk`) !== "" });
    if (nvram.has(`${guest}_ssid`))
      out.push({ id: guest, kind: "guest", band, ssid: get(`${guest}_ssid`), mode: get(`${guest}_auth_mode_x`, "psk2"), hidden: get(`${guest}_closed`) === "1", enabled: get(`${guest}_bss_enabled`) === "1" && get(`${main}_radio`, "1") === "1", hasPassword: get(`${guest}_wpa_psk`) !== "" });
  }
  return out.map((n) => ({ ...n, security: securityOf(n.mode), supported: securityOf(n.mode) !== null }));
}

export default {
  id: "wifi-qr",

  catalog: () => {
    const g = { domain: "wifi-qr", group: "card", groupLabel: L("QR code and card", "QR 碼同咭"), risk: "low" };
    return [
      { ...g, id: "wifi-qr.level", key: "mar_wifiqr_ecc", control: "select", options: [["L", L("Low", "低"), L("Smallest code, easiest to read on a screen", "最細，喺螢幕易讀")], ["M", L("Medium", "中"), L("A good balance", "平衡")], ["Q", L("Quarter", "四分一"), L("Survives some wear", "耐啲磨損")], ["H", L("High", "高"), L("Survives a lot of wear, biggest code", "好耐磨損，但最大")]],
        label: L("Error correction", "糾錯程度"), help: L("A higher level lets the code be read when it is scuffed, but makes it bigger.", "程度愈高，碼磨損咗都讀到，不過會愈大。") },
      { ...g, id: "wifi-qr.password-text", key: "mar_wifiqr_print_password", control: "switch", values: ON_OFF,
        label: L("Print the password under the code", "喺碼下面印密碼"), help: L("Off keeps the password out of sight on the printed card. The code still contains it.", "關閉就唔會喺印出嚟嘅咭見到密碼。碼入面一樣有。") },
      { ...g, id: "wifi-qr.note", key: "mar_wifiqr_note", control: "text", freeText: true, freeTextReason: "The line of text printed on the card is whatever the owner wants to say to guests.", maxLength: 80, hint: L("For example: Scan with your phone camera to join.", "例如：用手機相機掃描就可以連線。"),
        label: L("Line printed on the card", "咭上面嘅字"), help: L("A short welcome shown under the network name.", "喺網絡名稱下面顯示嘅簡短歡迎字句。") },
    ];
  },

  domainMeta: [{ id: "wifi-qr", icon: "qr_code_2", label: L("Wi-Fi QR codes", "Wi-Fi QR 碼"), group: { en: "Network", yue: "網絡" } }],
  domains: {
    "wifi-qr": async (ctx) => ({
      level: LEVELS.includes(ctx.nvram.get("mar_wifiqr_ecc")) ? ctx.nvram.get("mar_wifiqr_ecc") : "M",
      printPassword: ctx.nvram.get("mar_wifiqr_print_password") === "1",
      note: ctx.nvram.get("mar_wifiqr_note") ?? "",
      networks: networksOf(ctx.nvram, ctx.info),
      entries: ctx.entries(),
    }),
  },

  routes(api) {
    // POST /payload { id } : the text to put in the QR code. POST so that viewer accounts never get the password.
    api.post("/payload", async ({ live, body, bad }) => {
      const ctx = await live();
      const network = networksOf(ctx.nvram, ctx.info).find((n) => n.id === String(body.id ?? ""));
      if (!network) throw bad("That network does not exist.", 404);
      if (!network.supported) throw bad("This network uses sign-in with a user name (enterprise security), which a QR code cannot carry.", 409);
      const password = network.security === "nopass" ? "" : ctx.nvram.get(`${network.id}_wpa_psk`) ?? "";
      if (network.security !== "nopass" && !password) throw bad("This network has no password set.", 409);
      return { id: network.id, ssid: network.ssid, security: network.security, hidden: network.hidden, password };
    });
  },

  fakeRouter: { nvram: { mar_wifiqr_ecc: "M", mar_wifiqr_print_password: "0", mar_wifiqr_note: "Scan with your phone camera to join." } },
};
