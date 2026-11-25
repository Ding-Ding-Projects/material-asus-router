// Cloud and ASUS account: AiCloud and WebDAV (off by default, with an exposure
// warning), voice assistant and IFTTT switches with the token masked, the
// built-in speed test setting, and read-only views of the remote app binding,
// the ASUS feedback keys and the consent state.
//
// Consent screens (EULAs) are only ever shown, never accepted: agreeing to a
// vendor agreement has to be done by a person on the official page. Nothing in
// this folder writes a EULA setting, and the two EULA entries are read only.
import { L, ON_OFF } from "../kit.mjs";

const ID = "cloud";
const G = {
  aicloud: L("AiCloud and WebDAV", "AiCloud 同 WebDAV"),
  voice: L("Voice assistants and IFTTT", "語音助手同 IFTTT"),
  speed: L("Speed test", "速度測試"),
  consent: L("Agreements you accepted", "你已接受嘅協議"),
};
const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${ID}.${id}`, domain: ID, group, groupLabel: G[group], key, control, label, help, risk: "low", ...extra });
// A switch that opens the router to the internet. The screen asks for a typed word before it turns one on.
const exposure = { values: ON_OFF, risk: "network", restart: "restart_webdav", meta: { exposure: true } };
const AGREED = [["0", L("Not accepted", "未接受")], ["1", L("Accepted", "已接受")]];

export const catalog = () => [
  e("aicloud.disk", "aicloud", "webdav_aidisk", "switch", L("AiCloud cloud disk", "AiCloud 雲端磁碟"), L("Lets you open the USB drive from outside the home through the AiCloud app or a web link. Anyone who learns the sign-in can reach your files, so leave it off unless you need it.", "等你喺屋企以外，用 AiCloud 程式或網頁連結開 USB 磁碟。誰知道登入資料都可以去到你嘅檔案，所以除非需要，否則請保持關閉。"), exposure),
  e("webdav.enable", "aicloud", "enable_webdav", "switch", L("WebDAV file access", "WebDAV 檔案存取"), L("Opens the drive to apps that speak WebDAV, from home and from the internet. Off by default; turn it on only for a device you trust.", "等識 WebDAV 嘅程式由屋企同互聯網開磁碟。預設關閉；淨係畀你信任嘅裝置先開。"), exposure),
  e("webdav.http", "aicloud", "webdav_http_port", "port", L("WebDAV port", "WebDAV 端口"), L("The port WebDAV listens on. Changing it from the usual one makes casual scans find less.", "WebDAV 聽嘅端口。轉咗唔用常用嗰個，隨意掃描就少啲搵到。"), { min: 1, max: 65535, risk: "network", restart: "restart_webdav" }),
  e("webdav.https", "aicloud", "webdav_https_port", "port", L("WebDAV secure port", "WebDAV 加密端口"), L("The port for WebDAV over HTTPS. Prefer this one for anything that leaves the home.", "WebDAV 用 HTTPS 嘅端口。凡係離開屋企嘅連線都應該用呢個。"), { min: 1, max: 65535, risk: "network", restart: "restart_webdav" }),
  e("cloudsync", "aicloud", "enable_cloudsync", "switch", L("Cloud sync", "雲端同步"), L("Keeps a folder on the drive in step with an online storage account.", "將磁碟入面一個資料夾同網上儲存帳戶保持同步。"), { values: ON_OFF, restart: "restart_cloudsync" }),
  e("alexa.enable", "voice", "alexa_enable", "switch", L("Alexa skill", "Alexa 技能"), L("Lets an Alexa speaker control the router with your voice.", "等 Alexa 喇叭可以用語音控制路由器。"), { values: ON_OFF, risk: "network", restart: "restart_alexa" }),
  e("ifttt.enable", "voice", "ifttt_enable", "switch", L("IFTTT", "IFTTT"), L("Lets IFTTT applets control the router.", "等 IFTTT 小程式控制路由器。"), { values: ON_OFF, risk: "network", restart: "restart_ifttt" }),
  e("ifttt.token", "voice", "ifttt_token", "password", L("IFTTT token", "IFTTT 令牌"), L("The secret that links IFTTT to this router. It is never shown; anyone who has it can use the applets.", "連接 IFTTT 同呢部路由器嘅密碼。永遠唔會顯示；有咗佢就可以用嗰啲小程式。"), { secret: true, minLength: 8, maxLength: 128, risk: "network", restart: "restart_ifttt" }),
  e("speedtest.enable", "speed", "speedtest_enable", "switch", L("Built-in speed test", "內置速度測試"), L("Lets the router run its own internet speed test on a schedule, using your line while it runs.", "等路由器定時做自己嘅網速測試，測試期間會用到你條線。"), { values: ON_OFF, restart: "restart_speedtest" }),
  e("eula.asus", "consent", "ASUS_EULA", "select", L("ASUS terms of use", "ASUS 使用條款"), L("Shown only. Accept or withdraw it on the router's own page; this app never agrees to a vendor agreement for you.", "只顯示。請喺路由器自己嘅頁面接受或撤回；呢個程式永遠唔會替你同意廠商協議。"), { options: AGREED, readOnly: true }),
  e("eula.tm", "consent", "TM_EULA", "select", L("Trend Micro terms of use", "Trend Micro 使用條款"), L("Shown only, for the protection features. Accept or withdraw it on the router's own page.", "只顯示，關於防護功能。請喺路由器自己嘅頁面接受或撤回。"), { options: AGREED, readOnly: true }),
];

// Keys the router uses for the remote app link and for feedback to ASUS. Only whether each is set is ever
// shown, never its value.
const BINDING = /^(tm_device_bind|aae_)/;
const FEEDBACK = /^fb_/;
const keysLike = (nvram, pattern) => [...nvram.keys()].filter((k) => pattern.test(k)).sort().slice(0, 40).map((key) => ({ key, set: (nvram.get(key) ?? "") !== "" && nvram.get(key) !== "0" }));

const missing = (entries, nvram) => entries.map((entry) => (entry.disabled || nvram.has(entry.key) ? entry : { ...entry, disabled: { en: `This router does not have the setting ${entry.key}`, yue: `呢部路由器冇 ${entry.key} 呢個設定` } }));

export default {
  id: ID,
  catalog,
  domainMeta: [{ id: ID, icon: "cloud", label: L("Cloud and ASUS account", "雲端同 ASUS 帳戶"), group: { en: "Router", yue: "路由器" }, live: true }],
  domains: {
    [ID]: async (ctx) => {
      const on = (key) => (ctx.nvram.get(key) ?? "") === "1";
      const binding = keysLike(ctx.nvram, BINDING);
      const feedback = keysLike(ctx.nvram, FEEDBACK);
      return {
        entries: missing(ctx.entries(), ctx.nvram),
        exposed: { aicloud: on("webdav_aidisk"), webdav: on("enable_webdav") },
        binding: { bound: binding.some((k) => k.set), keys: binding },
        feedback: { sending: feedback.some((k) => k.set), keys: feedback },
        agreements: { asus: ctx.nvram.get("ASUS_EULA") === "1", trendMicro: ctx.nvram.get("TM_EULA") === "1" },
      };
    },
  },
  fakeRouter: {
    nvram: {
      webdav_aidisk: "0", enable_webdav: "0", webdav_http_port: "8082", webdav_https_port: "443", enable_cloudsync: "0",
      alexa_enable: "0", ifttt_enable: "0", ifttt_token: "example-ifttt-token", speedtest_enable: "0", ASUS_EULA: "1", TM_EULA: "0",
      tm_device_bind_state: "0", aae_enable: "0", fb_state: "0", fb_comment: "",
    },
  },
};
