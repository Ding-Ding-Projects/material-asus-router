// The router security scan: a read-only look at the settings that decide how
// exposed the router is. Each item reports pass, warn, fail or unknown with
// the setting it read, so the person sees exactly why. An item that has a
// safe fix also names the setting and value to change; the screen queues it
// in the change dock, so the fix still gets a preview, the safety net and undo.
import { L } from "../kit.mjs";

const item = (id, status, title, detail, evidence, fix) => ({ id, status, title, detail, evidence, ...(fix ? { fix } : {}) });
const setTo = (key, value, label) => ({ key, value, label });

// get(key) returns the router's value, or "" when the setting does not exist.
// has(key) says whether the router has the setting at all.
export function runScan({ get, has, bands, bwdpi }) {
  const items = [];
  // Reads one setting and picks a verdict; a missing setting is unknown, never a guess.
  const check = (id, key, title, rule) => {
    if (!has(key)) {
      items.push(item(id, "unknown", title, L("This router does not report this setting, so it could not be checked.", "呢部路由器冇提供呢個設定，所以檢查唔到。"), `${key} is not set`));
      return;
    }
    const result = rule(get(key));
    items.push(item(id, result.status, title, result.detail, `${key}=${get(key) === "" ? "(empty)" : get(key)}`, result.fix && { ...result.fix, current: get(key) }));
  };

  check("firewall", "fw_enable_x", L("Firewall", "防火牆"), (v) =>
    v === "1"
      ? { status: "pass", detail: L("The firewall is on.", "防火牆開緊。") }
      : { status: "fail", detail: L("The firewall is off, so the internet can reach devices directly.", "防火牆關咗，互聯網可以直接連到裝置。"), fix: setTo("fw_enable_x", "1", L("Turn the firewall on", "開啟防火牆")) });
  check("remote-web", "misc_http_x", L("Router page from the internet", "由互聯網開路由器網頁"), (v) =>
    v === "0"
      ? { status: "pass", detail: L("The router's own page can only be opened at home.", "路由器網頁只可以喺屋企開。") }
      : { status: "fail", detail: L("Anyone on the internet can try to sign in to the router page.", "互聯網上任何人都可以試圖登入路由器網頁。"), fix: setTo("misc_http_x", "0", L("Close the router page to the internet", "唔俾由互聯網開路由器網頁")) });
  check("ssh", "sshd_enable", L("SSH from the internet", "由互聯網用 SSH"), (v) =>
    v === "1"
      ? { status: "fail", detail: L("SSH answers on the internet side. Limit it to the home network.", "SSH 喺互聯網一邊都有回應。請限制為只限屋企網絡。"), fix: setTo("sshd_enable", "2", L("Limit SSH to the home network", "SSH 只限屋企網絡")) }
      : { status: "pass", detail: L("SSH is not reachable from the internet.", "互聯網連唔到 SSH。") });
  check("telnet", "telnetd_enable", L("Telnet", "Telnet"), (v) =>
    v === "0"
      ? { status: "pass", detail: L("Telnet is off.", "Telnet 已關閉。") }
      : { status: "fail", detail: L("Telnet sends passwords as plain text. Turn it off.", "Telnet 用明文傳送密碼，請關閉。"), fix: setTo("telnetd_enable", "0", L("Turn Telnet off", "關閉 Telnet")) });
  check("upnp", "upnp_enable", L("UPnP", "UPnP"), (v) =>
    v === "0"
      ? { status: "pass", detail: L("Devices cannot open ports on their own.", "裝置唔可以自己開端口。") }
      : { status: "warn", detail: L("Any device at home can ask the router to open a port to the internet.", "屋企任何裝置都可以叫路由器向互聯網開端口。"), fix: setTo("upnp_enable", "0", L("Turn UPnP off", "關閉 UPnP")) });
  check("wps", "wps_enable", L("Wi-Fi Protected Setup (WPS)", "Wi-Fi 快速連線（WPS）"), (v) =>
    v === "0"
      ? { status: "pass", detail: L("WPS is off.", "WPS 已關閉。") }
      : { status: "warn", detail: L("WPS has known weaknesses. Turn it off once your devices are connected.", "WPS 有已知弱點。裝置連好之後建議關閉。"), fix: setTo("wps_enable", "0", L("Turn WPS off", "關閉 WPS")) });
  check("ping", "misc_ping_x", L("Ping from the internet", "互聯網嘅 ping"), (v) =>
    v === "0"
      ? { status: "pass", detail: L("The router does not answer ping from the internet.", "路由器唔會回應互聯網嘅 ping。") }
      : { status: "warn", detail: L("The router answers ping, so scanners can find it.", "路由器會回應 ping，掃描器容易發現佢。"), fix: setTo("misc_ping_x", "0", L("Stop answering ping", "唔再回應 ping")) });
  check("dos", "fw_dos_x", L("Flood protection", "防洪水式攻擊"), (v) =>
    v === "1"
      ? { status: "pass", detail: L("Floods of connection attempts are dropped.", "大量連線請求會被丟棄。") }
      : { status: "warn", detail: L("Flood protection is off.", "防洪水式攻擊關咗。"), fix: setTo("fw_dos_x", "1", L("Turn flood protection on", "開啟防洪水式攻擊")) });
  check("https", "http_enable", L("Router page uses HTTPS", "路由器網頁用 HTTPS"), (v) =>
    v === "0"
      ? { status: "warn", detail: L("The router page only works over plain HTTP, so a password can be read on the home network.", "路由器網頁只可以用普通 HTTP，屋企網絡內有人可以睇到密碼。"), fix: setTo("http_enable", "2", L("Allow HTTPS as well", "同時容許 HTTPS")) }
      : { status: "pass", detail: L("The router page can use HTTPS.", "路由器網頁可以用 HTTPS。") });
  check("admin-name", "http_username", L("Router sign-in name", "路由器登入名稱"), (v) =>
    v === "admin"
      ? { status: "warn", detail: L("The sign-in name is the well-known default. Choose a different one.", "登入名稱係眾所周知嘅預設值，請改一個。") }
      : { status: "pass", detail: L("The sign-in name is not the default.", "登入名稱唔係預設值。") });
  check("ipv6-firewall", "ipv6_fw_enable", L("IPv6 firewall", "IPv6 防火牆"), (v) =>
    v === "1"
      ? { status: "pass", detail: L("Devices with an IPv6 address are protected.", "有 IPv6 地址嘅裝置受保護。") }
      : { status: "warn", detail: L("Devices with an IPv6 address are open to the internet.", "有 IPv6 地址嘅裝置對互聯網開放。"), fix: setTo("ipv6_fw_enable", "1", L("Turn the IPv6 firewall on", "開啟 IPv6 防火牆")) });

  for (const band of bands) {
    const key = `wl${band.index}_auth_mode_x`;
    const name = { "2": "2.4 GHz", "1": "5 GHz", "4": "6 GHz" }[String(band.nband)] ?? `Wi-Fi ${band.index}`;
    check(`wifi-${band.index}`, key, L(`Wi-Fi security, ${name}`, `Wi-Fi 保安，${name}`), (v) => {
      if (v === "open" || v === "shared" || v === "")
        return { status: "fail", detail: L("Anyone nearby can join this network. Use WPA2 or WPA3.", "附近任何人都可以加入呢個網絡。請用 WPA2 或 WPA3。"), fix: setTo(key, "psk2", L(`Use WPA2 on ${name}`, `${name} 用 WPA2`)) };
      if (v === "psk" || v === "wpa" || v === "radius")
        return { status: "warn", detail: L("This uses the older WPA. WPA2 or WPA3 is stronger.", "呢個用較舊嘅 WPA。WPA2 或 WPA3 較強。"), fix: setTo(key, "psk2", L(`Use WPA2 on ${name}`, `${name} 用 WPA2`)) };
      return { status: "pass", detail: L("The network uses WPA2 or WPA3.", "網絡用 WPA2 或 WPA3。") };
    });
  }

  const engines = [
    ["wrs_protect_enable", L("AiProtection", "AiProtection")],
    ["wrs_mals_enable", L("Malicious site blocking", "惡意網站封鎖")],
    ["wrs_vp_enable", L("Two-way IPS", "雙向 IPS")],
    ["wrs_cc_enable", L("Infected device prevention", "受感染裝置防護")],
  ];
  for (const [key, title] of engines) {
    if (!bwdpi) {
      items.push(item(`ai-${key}`, "unknown", title, L("This router model does not include the traffic-inspection engine.", "呢個型號冇流量檢查引擎。"), "bwdpi is not supported"));
      continue;
    }
    check(`ai-${key}`, key, title, (v) =>
      v === "1"
        ? { status: "pass", detail: L("Turned on.", "已開啟。") }
        : { status: "warn", detail: L("Turned off. The router is not checking for this.", "已關閉，路由器冇做呢項檢查。"), fix: setTo(key, "1", L(`Turn on: ${title.en}`, `開啟：${title.yue}`)) });
  }

  const counts = { pass: 0, warn: 0, fail: 0, unknown: 0 };
  for (const entry of items) counts[entry.status] += 1;
  const judged = counts.pass + counts.warn + counts.fail;
  const score = judged ? Math.round((100 * (counts.pass + counts.warn * 0.5)) / judged) : null;
  return { items, counts, score };
}
