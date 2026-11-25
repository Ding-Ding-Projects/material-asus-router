// System: router access, SSH keys, time, remote syslog, lights, buttons, USB
// mode, a scheduled restart, wake-on-LAN devices and live temperature gauges.
// Every setting is a typed control that reads its real nvram value and is
// written through the change engine. The two lists (SSH keys and wake-on-LAN
// devices) are built by routes that return a reviewed preview.
import { createHash } from "node:crypto";
import { L, ON_OFF, cleanText, formatRows, isMac, macAddress, parseRows } from "../kit.mjs";

const ID = "system-pro";
const G = {
  access: L("Router web page and remote access", "路由器網頁同遠端存取"),
  ssh: L("SSH and Telnet", "SSH 同 Telnet"),
  time: L("Time and daylight saving", "時間同夏令時間"),
  logs: L("Remote log server", "遠端記錄伺服器"),
  lights: L("Lights and buttons", "燈號同按鈕"),
  usb: L("USB mode", "USB 模式"),
  reboot: L("Scheduled restart", "定時重啟"),
};
const NOTE = L("This setting name is the one recent ASUS builds use; confirm it on your model after applying.", "呢個設定名稱係近期 ASUS 版本用嘅；套用後請喺你部機確認。");

const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${ID}.${id}`, domain: ID, group, groupLabel: G[group], key, control, label, help, risk: "low", ...extra });
const merlin = { firmware: "merlin" };

export const entries = () => [
  e("login", "access", "http_username", "text", L("Router login name", "路由器登入名稱"), L("The name you sign in to the router's own page with. It cannot be changed here.", "登入路由器網頁用嘅名稱，呢度唔可以改。"), { readOnly: true, freeText: true, freeTextReason: "Shown only; the login name is never written by this app.", maxLength: 64, hint: L("Read only", "只讀") }),
  e("https.mode", "access", "http_enable", "select", L("Router web page protocol", "路由器網頁協定"), L("HTTPS encrypts the router's web page. Choose HTTPS only if every browser at home can open it.", "HTTPS 會加密路由器網頁。只有當家中所有瀏覽器都開到，先揀淨 HTTPS。"), { restart: "restart_httpd", options: [["0", L("HTTP only", "只用 HTTP"), L("Not encrypted", "冇加密")], ["1", L("HTTPS only", "只用 HTTPS"), L("Encrypted", "有加密")], ["2", L("HTTP and HTTPS", "HTTP 同 HTTPS"), L("Either works", "兩種都得")]] }),
  e("https.port", "access", "https_lanport", "port", L("HTTPS port at home", "屋企 HTTPS 端口"), L("The port of the router's secure web page. 8443 is the usual one.", "路由器加密網頁嘅端口，通常係 8443。"), { restart: "restart_httpd", min: 1, max: 65535, presets: [["8443", L("Usual", "常用")], ["443", L("Standard HTTPS", "標準 HTTPS")]] }),
  e("remote.port", "access", "misc_httpsport_x", "port", L("Port for remote access", "遠端存取端口"), L("The port used when the router web page is opened from the internet. It only matters while remote access is on.", "喺互聯網開路由器網頁用嘅端口。只喺開咗遠端存取時先有用。"), { restart: "restart_httpd", min: 1, max: 65535, presets: [["8443", L("Usual", "常用")]] }),
  e("remote.restrict", "access", "http_client", "switch", L("Remote access only from listed addresses", "只准指定地址遠端存取"), L("When on, the router web page opens from the internet only for the addresses you list on the router.", "開咗之後，只有你喺路由器列出嘅地址先可以由互聯網開網頁。"), { values: ON_OFF, restart: "restart_httpd" }),
  e("ssh.port", "ssh", "sshd_port", "port", L("SSH port", "SSH 端口"), L("This app signs in over this port, so it is shown but cannot be changed here. Change it on the router's own page, then reconnect the app.", "呢個程式靠呢個端口登入，所以只顯示，唔可以喺度改。請喺路由器自己嘅網頁改，再重新連線。"), { readOnly: true, min: 1, max: 65535, presets: [["22", L("Standard", "標準")]] }),
  e("ssh.pass", "ssh", "sshd_pass", "switch", L("Allow password sign-in over SSH", "容許用密碼 SSH 登入"), L("Turn off once your SSH key works. A wrong order locks this app out; the safety net puts it back.", "SSH 金鑰行得通之後可以關閉。次序錯咗會鎖住呢個程式；安全機制會還原。"), { ...merlin, values: ON_OFF, restart: "restart_sshd", risk: "network" }),
  e("ssh.bfp", "ssh", "sshd_bfp", "switch", L("Block repeated wrong SSH passwords", "擋住重複嘅 SSH 錯誤密碼"), L("Blocks an address for a while after several failed sign-ins.", "登入失敗幾次之後，暫時擋住嗰個地址。"), { ...merlin, values: ON_OFF, restart: "restart_sshd" }),
  e("telnet", "ssh", "telnetd_enable", "switch", L("Telnet", "Telnet"), L("An old, unencrypted way to sign in. Keep it off.", "舊式、冇加密嘅登入方法。請保持關閉。"), { values: ON_OFF, restart: "restart_telnetd" }),
  e("tz.dst", "time", "time_zone_dst", "switch", L("Daylight saving time", "夏令時間"), L("Moves the clock by an hour in summer, using the rule below.", "夏天將時鐘撥快一個鐘，用下面嘅規則。"), { values: ON_OFF, restart: "restart_time" }),
  e("tz.rule", "time", "time_zone_dstoff", "select", L("Daylight saving rule", "夏令時間規則"), L("When the clock changes. Pick the rule for your region.", "幾時轉時間。揀你所在地區嘅規則。"), { restart: "restart_time", options: [["M3.2.0/2,M11.1.0/2", L("North America", "北美"), L("March to November", "三月至十一月")], ["M3.5.0/2,M10.5.0/3", L("Europe", "歐洲"), L("Last Sunday of March to October", "三月尾至十月尾")], ["M10.1.0/2,M4.1.0/3", L("Australia (south-east)", "澳洲（東南）"), L("October to April", "十月至四月")]] }),
  e("ntp.second", "time", "ntp_server1", "hostname", L("Second time server", "第二個時間伺服器"), L("Used when the first time server cannot be reached.", "第一個時間伺服器連唔到時用。"), { optional: true, restart: "restart_time" }),
  e("ntpd.enable", "time", "ntpd_enable", "switch", L("Let devices at home use the router as their time server", "等屋企裝置用路由器做時間伺服器"), L("The router answers time requests from your network.", "路由器會回應屋企網絡嘅時間要求。"), { ...merlin, values: ON_OFF, restart: "restart_time" }),
  e("ntpd.redirect", "time", "ntpd_server_redir", "switch", L("Send every time request to the router", "所有時間要求都導向路由器"), L("Devices that name their own time server still get the router's time.", "就算裝置自己指定咗時間伺服器，都攞路由器嘅時間。"), { ...merlin, values: ON_OFF, restart: "restart_firewall" }),
  e("log.ip", "logs", "log_ipaddr", "ipv4", L("Send the log to this address", "將記錄傳去呢個地址"), L("Leave empty to keep the log on the router. Use a log server at home.", "留空就只保留喺路由器。可以用屋企嘅記錄伺服器。"), { optional: true, restart: "restart_logger" }),
  e("log.port", "logs", "log_port", "port", L("Log server port", "記錄伺服器端口"), L("514 is the usual syslog port.", "514 係常用嘅 syslog 端口。"), { restart: "restart_logger", min: 1, max: 65535, presets: [["514", L("Usual", "常用")]] }),
  e("led.eth", "lights", "led_eth_disable", "switch", L("Turn the Ethernet port lights off", "關閉網線埠嘅燈"), L("Only the port lights. The main light switch is under System.", "只關網線埠嘅燈。總燈掣喺「系統」。"), { values: ON_OFF, meta: { note: NOTE } }),
  e("btn.radio", "lights", "btn_ez_radiotoggle", "switch", L("The WPS button turns Wi-Fi on and off", "WPS 掣用嚟開關 Wi-Fi"), L("Press the button to switch the radios instead of starting WPS.", "撳掣就開關 Wi-Fi，唔再啟動 WPS。"), { values: ON_OFF }),
  e("btn.mode", "lights", "btn_ez_mode", "segmented", L("What the front button does", "前面個掣做咩"), L("Choose between WPS and switching the lights.", "揀 WPS 定係開關燈。"), { options: [["0", L("Start WPS", "啟動 WPS")], ["1", L("Lights on and off", "開關燈")]], meta: { note: NOTE } }),
  e("usb.mode", "usb", "usb_usb3", "select", L("USB speed", "USB 速度"), L("USB 2.0 reduces interference with 2.4 GHz Wi-Fi. Takes effect after the router restarts.", "USB 2.0 可以減少對 2.4 GHz Wi-Fi 嘅干擾。路由器重啟後生效。"), { requires: "usbX1", options: [["1", L("USB 3.0 (faster)", "USB 3.0（較快）")], ["0", L("USB 2.0 (less interference)", "USB 2.0（干擾較少）")]] }),
  e("reboot.enable", "reboot", "reboot_schedule_enable", "switch", L("Restart the router on a schedule", "定時重啟路由器"), L("A weekly restart keeps some routers steady.", "每週重啟一次可以令部分路由器更穩定。"), { values: ON_OFF, meta: { note: NOTE } }),
  e("reboot.schedule", "reboot", "reboot_schedule", "schedule", L("When to restart", "幾時重啟"), L("Paint the days and the hour. The router restarts at the start of each painted slot.", "塗上日子同鐘數。每個塗咗嘅時段開始時，路由器會重啟。"), { step: 60, meta: { note: NOTE } }),
];

// ---- readers ---------------------------------------------------------------

export const fingerprint = (line) => {
  const parts = line.trim().split(/\s+/);
  try {
    return `SHA256:${createHash("sha256").update(Buffer.from(parts[1], "base64")).digest("base64").replace(/=+$/, "")}`;
  } catch {
    return "";
  }
};
export const KEY_LINE = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(?:256|384|521)) [A-Za-z0-9+/]{20,}={0,2}(?: [^\r\n<>]{0,64})?$/;

// nvram show cannot hold a multi-line value, so the keys are read directly.
const sshKeys = async (exec) => (await exec("nvram get sshd_authkeys")).stdout.split("\n").map((l) => l.trim()).filter(Boolean);
const describeKey = (line, index) => ({ index, type: line.split(" ")[0], comment: line.split(" ").slice(2).join(" "), fingerprint: fingerprint(line) });
const wolList = (nvram) => parseRows(nvram.get("wollist") ?? "").map(([name, mac]) => ({ name: name ?? "", mac: (mac ?? "").toUpperCase() })).filter((r) => isMac(r.mac));

async function sensors(live) {
  const { exec, info } = await live();
  const number = async (command, scale = 1) => {
    const out = await exec(command);
    const n = out.code === 0 ? parseInt(out.stdout, 10) : NaN;
    return Number.isFinite(n) ? n / scale : null;
  };
  const gauges = [{ id: "cpu", label: L("Processor", "處理器"), celsius: await number("head -n 100000 /sys/class/thermal/thermal_zone0/temp", 1000), warnAt: 80, maxAt: 100 }];
  const names = { 2: L("2.4 GHz radio", "2.4 GHz 無線電"), 1: L("5 GHz radio", "5 GHz 無線電"), 4: L("6 GHz radio", "6 GHz 無線電") };
  for (const band of info.bands) gauges.push({ id: `radio${band.index}`, label: names[band.nband] ?? L(`Radio ${band.index + 1}`, `無線電 ${band.index + 1}`), celsius: await number(`wl -i ${band.ifname} phy_tempsense`), warnAt: 85, maxAt: 105 });
  return { gauges, readAt: new Date().toISOString() };
}

const bad = (message, status = 400) => Object.assign(new Error(message), { status });

export default {
  id: ID,
  catalog: entries,
  domainMeta: [{ id: ID, icon: "settings_applications", label: L("System tools", "系統工具"), group: { en: "Router", yue: "路由器" } }],
  domains: {
    [ID]: async (ctx) => ({
      entries: ctx.entries(),
      related: ctx.entries("system"),
      model: ctx.info.model,
      merlin: ctx.info.merlin,
      sshKeys: (await sshKeys(ctx.exec)).map(describeKey),
      wol: wolList(ctx.nvram),
    }),
  },
  routes(api) {
    api.get("/sensors", ({ live }) => sensors(live));

    // Each list change answers with a preview that the person reviews and applies.
    api.post("/ssh-keys", async ({ body, live, preview }) => {
      const line = String(body.key ?? "").trim().replace(/\s+/g, " ");
      if (!KEY_LINE.test(line)) throw bad("Paste one SSH public key, such as an ssh-ed25519 line.");
      const keys = await sshKeys((await live()).exec);
      if (keys.some((k) => k.split(" ")[1] === line.split(" ")[1])) throw bad("That key is already allowed.", 409);
      if (keys.length >= 20) throw bad("The router can keep at most 20 keys.");
      return preview({ changes: [{ key: "sshd_authkeys", value: [...keys, line].join("\n"), risk: "network" }] });
    });
    api.delete("/ssh-keys/:index", async ({ params, live, preview }) => {
      const keys = await sshKeys((await live()).exec);
      const at = Number(params.index);
      if (!Number.isInteger(at) || !keys[at]) throw bad("That key is no longer on the router.", 404);
      keys.splice(at, 1);
      return preview({ changes: [{ key: "sshd_authkeys", value: keys.join("\n"), risk: "network" }] });
    });

    api.post("/wol", async ({ body, live, preview }) => {
      const mac = macAddress(body.mac);
      const name = cleanText(body.name, "Name", { max: 32 });
      const rows = wolList((await live()).nvram).filter((r) => r.mac !== mac);
      if (rows.length >= 32) throw bad("The list can hold 32 devices.");
      rows.push({ name, mac });
      return preview({ changes: [{ key: "wollist", value: formatRows(rows.map((r) => [r.name, r.mac])), risk: "low" }] });
    });
    api.delete("/wol/:mac", async ({ params, live, preview }) => {
      const mac = macAddress(decodeURIComponent(params.mac));
      const rows = wolList((await live()).nvram);
      if (!rows.some((r) => r.mac === mac)) throw bad("That device is not on the list.", 404);
      return preview({ changes: [{ key: "wollist", value: formatRows(rows.filter((r) => r.mac !== mac).map((r) => [r.name, r.mac])), risk: "low" }] });
    });
  },
  fakeRouter: {
    nvram: {
      http_username: "pat-router", http_enable: "2", https_lanport: "8443", misc_httpsport_x: "8443", http_client: "0",
      sshd_pass: "1", sshd_bfp: "1", telnetd_enable: "0", time_zone_dst: "0", time_zone_dstoff: "M3.2.0/2,M11.1.0/2",
      ntp_server1: "", ntpd_enable: "0", ntpd_server_redir: "0", log_ipaddr: "", log_port: "514", led_eth_disable: "0",
      btn_ez_radiotoggle: "0", btn_ez_mode: "0", usb_usb3: "1", reboot_schedule_enable: "0", reboot_schedule: "0@04:00-05:00",
      wollist: "<Living room PC>AA:BB:CC:00:11:22",
    },
  },
};
