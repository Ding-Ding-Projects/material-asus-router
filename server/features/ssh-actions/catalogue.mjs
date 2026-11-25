// Every action the app can run over SSH, as data. A card on the screen is one
// entry here: its parameters (each a typed control, never a bare text box), a
// risk level, the exact command it will send (built only from checked pieces)
// and, for risky ones, the command that puts things back.
import { L, hostTarget, macAddress, quote } from "../kit.mjs";
import { bad, parseProcesses, resolveOptions } from "./sources.mjs";

export const SERVICES = [
  ["restart_wireless", L("Wi-Fi radios", "Wi-Fi 無線電"), "network"],
  ["restart_dnsmasq", L("DNS and DHCP server", "DNS 同 DHCP 伺服器"), "network"],
  ["restart_firewall", L("Firewall rules", "防火牆規則"), "network"],
  ["restart_httpd", L("Router web page", "路由器網頁"), "low"],
  ["restart_time", L("Clock sync (NTP)", "時鐘同步（NTP）"), "low"],
  ["restart_ddns", L("Dynamic DNS", "動態 DNS"), "low"],
  ["restart_qos", L("Traffic control (QoS)", "流量控制（QoS）"), "network"],
  ["restart_vpnd", L("OpenVPN server", "OpenVPN 伺服器"), "network"],
  ["restart_wgs", L("WireGuard server", "WireGuard 伺服器"), "network"],
  ["restart_nasapps", L("USB sharing apps", "USB 分享程式"), "low"],
  ["restart_sshd", L("SSH server", "SSH 伺服器"), "network"],
  ["restart_upnp", L("UPnP", "UPnP"), "low"],
  ["restart_leds", L("Lights", "燈號"), "low"],
  ["restart_samba", L("Windows file sharing", "Windows 檔案分享"), "low"],
  ["restart_ftpd", L("FTP server", "FTP 伺服器"), "low"],
  ["restart_dnsfilter", L("DNS filter", "DNS 過濾"), "network"],
  ["restart_diskmon", L("USB disk monitor", "USB 磁碟監察"), "low"],
  ["restart_syslogd", L("System log", "系統記錄"), "low"],
  ["restart_net_and_phy", L("The whole network side", "整個網絡部份"), "network"],
];

export const TEST_DOWNLOADS = [
  ["http://speedtest.tele2.net/1MB.zip", L("Tele2 1 MB test file", "Tele2 1 MB 測試檔")],
  ["http://ipv4.download.thinkbroadband.com/5MB.zip", L("ThinkBroadband 5 MB test file", "ThinkBroadband 5 MB 測試檔")],
  ["http://speedtest.tele2.net/10MB.zip", L("Tele2 10 MB test file", "Tele2 10 MB 測試檔")],
];

// One piece of a cron schedule: *, a number, a range, a step, or a list of those.
const CRON_PART = "(?:\\*|\\d{1,2}(?:-\\d{1,2})?)(?:/\\d{1,2})?";
const CRON_FIELD = new RegExp(`^${CRON_PART}(?:,${CRON_PART}){0,11}$`);
const cronField = (max) => (value) => CRON_FIELD.test(value) && [...value.matchAll(/\d+/g)].every((m) => Number(m[0]) <= max);
const cronOk = { minute: cronField(59), hour: cronField(23), day: cronField(31), month: cronField(12), weekday: cronField(7) };

const SSH_KEY = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(?:256|384|521)|sk-ssh-ed25519@openssh\.com) [A-Za-z0-9+/=]{20,1500}( [A-Za-z0-9@._-]{1,64})?$/;
export const isPublicKey = (value) => SSH_KEY.test(String(value).trim());

const opt = (list) => list.map(([value, label, risk]) => ({ value, label, risk }));
const whole = (p, id, min, max) => {
  const n = Number(p[id]);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${id} must be a whole number from ${min} to ${max}.`);
  return n;
};

// risk: low = ask once, network = under the safety net, destructive = super confirmation.
// build(p, env) returns { command, revert?: [commands] } and may refuse.
export const ACTIONS = [
  // ---- services and housekeeping -------------------------------------------
  {
    id: "restart-service", group: "services", icon: "restart_alt", risk: "network",
    label: L("Restart a router service", "重啟路由器服務"),
    help: L("Restart one part of the router without restarting the whole router. The safety net checks the router still answers afterwards.", "只重啟路由器其中一部份，唔使成部機重啟。之後安全機制會確認路由器仍然有回應。"),
    params: [{ id: "service", type: "select", label: L("Service", "服務"), options: opt(SERVICES), required: true }],
    riskFor: (p) => SERVICES.find(([v]) => v === p.service)?.[2] ?? "network",
    build: (p) => ({ command: `service ${p.service}`, revert: [`service ${p.service}`] }),
  },
  {
    id: "ntp-sync", group: "services", icon: "schedule", risk: "low",
    label: L("Sync the clock now", "即刻同步時鐘"),
    help: L("Asks the router to look up the time again straight away.", "叫路由器即刻重新查時間。"),
    params: [],
    build: () => ({ command: "service restart_time" }),
  },
  {
    id: "clear-logs", group: "services", icon: "delete_sweep", risk: "low",
    label: L("Clear the system log", "清除系統記錄"),
    help: L("Empties the router's current log. The log lives in memory and starts again by itself.", "清空路由器而家嘅記錄。記錄喺記憶體，會自己重新開始。"),
    params: [],
    build: () => ({ command: ": > /tmp/syslog.log" }),
  },
  {
    id: "flush-dns", group: "services", icon: "dns", risk: "network",
    label: L("Flush the DNS cache", "清除 DNS 快取"),
    help: L("Restarts the router's DNS and DHCP server so it forgets every answer it remembered.", "重啟路由器嘅 DNS 同 DHCP 伺服器，令佢忘記所有記住咗嘅答案。"),
    params: [],
    build: () => ({ command: "service restart_dnsmasq", revert: ["service restart_dnsmasq"] }),
  },
  {
    id: "renew-wan", group: "services", icon: "public", risk: "network",
    label: L("Renew the internet connection", "更新互聯網連線"),
    help: L("Reconnects the WAN port and asks the provider for a fresh address lease. The internet drops for a few seconds.", "重新連接 WAN 埠，向供應商要新嘅地址租約。互聯網會斷幾秒。"),
    params: [],
    build: () => ({ command: "service restart_wan_if 0", revert: ["service restart_wan_if 0"] }),
  },
  {
    id: "stop-process", group: "viewers", icon: "stop_circle", risk: "low", hidden: true,
    label: L("Stop a process", "停止程序"),
    help: L("Stops a program you started. The router's own programs are refused.", "停止你自己開嘅程式。路由器自己嘅程式會被拒絕。"),
    params: [{ id: "pid", type: "number", label: L("Process number", "程序編號"), min: 2, max: 4194304, required: true }],
    async build(p, env) {
      const pid = whole(p, "pid", 2, 4194304);
      const found = parseProcesses((await env.exec("ps w")).stdout).find((x) => x.pid === pid);
      if (!found) throw bad("That process is not running any more.", 404);
      if (!found.stoppable) throw bad("That program belongs to the router, so it cannot be stopped from here.", 403, { code: "PROTECTED_PROCESS" });
      return { command: `kill ${pid}` };
    },
  },
  {
    id: "reboot", group: "services", icon: "restart_alt", risk: "destructive", link: "maintenance",
    label: L("Restart the router", "重啟路由器"),
    help: L("Restarting is done on the Maintenance screen, which has its own confirmation and a live timeline until the router is back.", "重啟喺「維護」畫面做，嗰度有自己嘅確認同即時時間線，直至路由器返嚟。"),
    params: [],
  },
  // ---- network ----------------------------------------------------------------
  {
    id: "interface-state", group: "network", icon: "settings_ethernet", risk: "network",
    label: L("Turn a network interface up or down", "開關網絡介面"),
    help: L("Brings one interface up or down. The LAN bridge is not offered, because turning it down would cut this app off. A down interface is put back up by the safety net if the router stops answering.", "開或關其中一個網絡介面。唔提供 LAN 橋接，因為關咗會令程式連唔到。如果路由器冇回應，安全機制會將介面重新開返。"),
    params: [
      { id: "interface", type: "select", label: L("Interface", "介面"), source: "interfaces", required: true },
      { id: "state", type: "segmented", label: L("State", "狀態"), options: opt([["down", L("Down", "關")], ["up", L("Up", "開")]]), default: "down", required: true },
    ],
    riskFor: (p) => (p.state === "up" ? "low" : "network"),
    build: (p) => ({ command: `ifconfig ${p.interface} ${p.state}`, revert: [`ifconfig ${p.interface} up`] }),
  },
  {
    id: "wifi-disconnect", group: "network", icon: "wifi_off", risk: "low",
    label: L("Disconnect a Wi-Fi device", "斷開 Wi-Fi 裝置"),
    help: L("Kicks one device off the Wi-Fi. It can join again straight away unless it is blocked.", "將一部裝置踢出 Wi-Fi。除非被封鎖，否則佢可以即刻再連返。"),
    params: [{ id: "client", type: "select", label: L("Connected device", "已連線嘅裝置"), source: "wifi-clients", required: true }],
    build(p) {
      const [iface, mac] = String(p.client).split("/");
      return { command: `wl -i ${iface} deauthenticate ${macAddress(mac)}` };
    },
  },
  {
    id: "wake-on-lan", group: "network", icon: "power_settings_new", risk: "low",
    label: L("Wake a device (Wake-on-LAN)", "喚醒裝置（Wake-on-LAN）"),
    help: L("Sends a magic packet on the home network so a sleeping computer starts.", "喺家庭網絡送出喚醒封包，叫休眠緊嘅電腦開機。"),
    params: [{ id: "mac", type: "mac", label: L("Device MAC address", "裝置 MAC 地址"), required: true }],
    build: (p) => ({ command: `ether-wake -i br0 ${macAddress(p.mac)}` }),
  },
  // ---- viewers ----------------------------------------------------------------
  { id: "view-routes", group: "viewers", icon: "alt_route", risk: "low", view: "text", label: L("Routing table", "路由表"), help: L("The routes the router uses to decide where traffic goes.", "路由器用嚟決定流量去邊度嘅路由。"), params: [], build: () => ({ command: "ip route" }) },
  { id: "view-arp", group: "viewers", icon: "lan", risk: "low", view: "text", label: L("Neighbour (ARP) table", "鄰居（ARP）表"), help: L("Which address belongs to which device on the home network.", "家庭網絡入面邊個地址屬於邊部裝置。"), params: [], build: () => ({ command: "head -n 100000 /proc/net/arp" }) },
  {
    id: "view-iptables", group: "viewers", icon: "local_fire_department", risk: "low", view: "text",
    label: L("Firewall tables (iptables)", "防火牆表（iptables）"),
    help: L("The firewall rules as the router loaded them, with packet counters.", "路由器載入咗嘅防火牆規則同封包計數。"),
    params: [{ id: "table", type: "segmented", label: L("Table", "表"), options: opt([["filter", L("Filter", "過濾")], ["nat", L("NAT", "NAT")], ["mangle", L("Mangle", "Mangle")]]), default: "filter", required: true }],
    build: (p) => ({ command: `iptables -t ${p.table} -L -n -v` }),
  },
  { id: "view-connections", group: "viewers", icon: "swap_horiz", risk: "low", view: "text", label: L("Open connections", "開緊嘅連線"), help: L("The first 200 connections the router is tracking right now.", "路由器而家追蹤緊嘅頭 200 個連線。"), params: [], build: () => ({ command: "head -n 200 /proc/net/nf_conntrack" }) },
  { id: "view-interfaces", group: "viewers", icon: "device_hub", risk: "low", view: "text", label: L("Interfaces and addresses", "介面同地址"), help: L("Every network interface with its address and counters.", "每個網絡介面嘅地址同計數。"), params: [], build: () => ({ command: "ifconfig -a" }) },
  { id: "view-processes", group: "viewers", icon: "memory", risk: "low", view: "processes", label: L("Running processes", "運行緊嘅程序"), help: L("What is running on the router. Only programs you started can be stopped from here.", "路由器上面運行緊嘅嘢。只可以停止你自己開嘅程式。"), params: [], build: () => ({ command: "ps w" }) },
  { id: "view-usb", group: "viewers", icon: "usb", risk: "low", view: "text", label: L("Mounted drives", "已掛載嘅磁碟"), help: L("The USB drives the router has mounted, and how full they are.", "路由器已掛載嘅 USB 磁碟同用咗幾多。"), params: [], build: () => ({ command: "df -k" }) },
  // ---- tests ------------------------------------------------------------------
  {
    id: "ping", group: "tests", icon: "network_ping", risk: "low", view: "text", live: true,
    label: L("Ping", "Ping"), help: L("Checks a host answers, and how fast.", "檢查一個主機有冇回應，同埋幾快。"),
    params: [
      { id: "host", type: "host", label: L("Host name or address", "主機名稱或地址"), default: "example.com", presets: ["example.com", "1.1.1.1", "8.8.8.8"], required: true },
      { id: "count", type: "number", label: L("Packets", "封包數量"), min: 1, max: 9, default: 4, required: true },
    ],
    build: (p) => ({ command: `ping -c ${whole(p, "count", 1, 9)} -W 2 ${hostTarget(p.host)}` }),
  },
  {
    id: "traceroute", group: "tests", icon: "route", risk: "low", view: "text", live: true,
    label: L("Trace the route", "追蹤路由"), help: L("Shows each hop on the way to a host.", "顯示去一個主機路上嘅每一跳。"),
    params: [{ id: "host", type: "host", label: L("Host name or address", "主機名稱或地址"), default: "example.com", presets: ["example.com", "1.1.1.1"], required: true }],
    build: (p) => ({ command: `traceroute -m 15 -w 2 ${hostTarget(p.host)}` }),
  },
  {
    id: "lookup", group: "tests", icon: "travel_explore", risk: "low", view: "text", live: true,
    label: L("Look up a name", "查詢域名"), help: L("Asks the router's DNS what address a name has.", "問路由器嘅 DNS 一個名有咩地址。"),
    params: [{ id: "host", type: "host", label: L("Host name", "主機名稱"), default: "example.com", presets: ["example.com"], required: true }],
    build: (p) => ({ command: `nslookup ${hostTarget(p.host)}` }),
  },
  {
    id: "download-test", group: "tests", icon: "download", risk: "low", view: "text", live: true,
    label: L("Download speed test", "下載速度測試"),
    help: L("Downloads a public test file and throws it away, to see how fast the internet is from the router itself.", "下載一個公開測試檔再丟棄，睇路由器本身上網幾快。"),
    params: [{ id: "url", type: "select", label: L("Test file", "測試檔"), options: opt(TEST_DOWNLOADS), required: true }],
    build: (p) => ({ command: `wget -O /dev/null -T 20 ${quote(p.url)}` }),
  },
  {
    id: "iperf", group: "tests", icon: "speed", risk: "low", view: "text", live: true, probe: "iperf3",
    label: L("iperf3 speed test", "iperf3 速度測試"),
    help: L("Measures speed to an iperf3 server you run on another computer. Needs iperf3 on the router.", "量度去你喺另一部電腦開嘅 iperf3 伺服器嘅速度。路由器要有 iperf3。"),
    params: [
      { id: "host", type: "host", label: L("iperf3 server", "iperf3 伺服器"), required: true },
      { id: "seconds", type: "number", label: L("Seconds", "秒數"), min: 1, max: 30, default: 5, unit: "s", required: true },
    ],
    build: (p) => ({ command: `iperf3 -c ${hostTarget(p.host)} -t ${whole(p, "seconds", 1, 30)}` }),
  },
  // ---- storage ----------------------------------------------------------------
  {
    id: "usb-mount", group: "storage", icon: "usb", risk: "low",
    label: L("Mount a USB partition", "掛載 USB 分區"), help: L("Makes a USB partition available under /tmp/mnt.", "令一個 USB 分區喺 /tmp/mnt 下面用得。"),
    params: [
      { id: "device", type: "select", label: L("Partition", "分區"), source: "unmounted-partitions", required: true },
      { id: "name", type: "name", label: L("Folder name under /tmp/mnt", "/tmp/mnt 下面嘅資料夾名"), pattern: "^[A-Za-z0-9_-]{1,20}$", default: "usb1", required: true },
    ],
    async build(p, env) {
      const taken = (await env.exec("mount")).stdout.includes(` on /tmp/mnt/${p.name} `);
      if (taken) throw bad("Another drive is already mounted with that folder name. Choose a different name.", 409);
      return { command: `mkdir -p /tmp/mnt/${p.name}; mount ${p.device} /tmp/mnt/${p.name}` };
    },
  },
  {
    id: "usb-unmount", group: "storage", icon: "eject", risk: "low",
    label: L("Unmount a USB drive", "卸載 USB 磁碟"), help: L("Detaches a mounted drive. Anything still using it will stop.", "斷開一個已掛載嘅磁碟。仲用緊佢嘅嘢會停。"),
    params: [{ id: "mount", type: "select", label: L("Mounted drive", "已掛載嘅磁碟"), source: "mounts", required: true }],
    build: (p) => ({ command: `umount ${quote(p.mount)}` }),
  },
  {
    id: "usb-eject", group: "storage", icon: "eject", risk: "low",
    label: L("Safely remove a USB drive", "安全移除 USB 磁碟"),
    help: L("Writes everything still waiting in memory to the drive, then detaches it, so it is safe to pull out.", "將記憶體入面等緊嘅資料寫落磁碟，再斷開，之後可以安全拔出。"),
    params: [{ id: "mount", type: "select", label: L("Mounted drive", "已掛載嘅磁碟"), source: "mounts", required: true }],
    build: (p) => ({ command: `sync; umount ${quote(p.mount)}` }),
  },
  {
    id: "disk-check", group: "storage", icon: "troubleshoot", risk: "low", view: "text", live: true,
    label: L("Check a disk (look only)", "檢查磁碟（只睇）"),
    help: L("Reads an unmounted partition and reports problems without changing anything. Mounted drives are never checked.", "讀取一個未掛載嘅分區並報告問題，唔會改動任何嘢。已掛載嘅磁碟唔會檢查。"),
    params: [{ id: "device", type: "select", label: L("Unmounted partition", "未掛載嘅分區"), source: "unmounted-partitions", required: true }],
    build: (p) => ({ command: `e2fsck -n ${p.device}` }),
  },
  {
    id: "disk-repair", group: "storage", icon: "build_circle", risk: "destructive", view: "text", live: true,
    label: L("Check and repair a disk", "檢查並修復磁碟"),
    help: L("Repairs problems on an unmounted partition. This changes the drive. Only do it after a look-only check found problems and your files are backed up.", "修復未掛載分區嘅問題。呢個會改動磁碟。請喺只睇嘅檢查發現問題、而且資料已備份之後先做。"),
    params: [{ id: "device", type: "select", label: L("Unmounted partition", "未掛載嘅分區"), source: "unmounted-partitions", required: true }],
    build: (p) => ({ command: `e2fsck -p ${p.device}` }),
  },
  {
    id: "swap-on", group: "storage", icon: "memory_alt", risk: "low",
    label: L("Turn swap on", "開啟 swap"), help: L("Uses an existing swap file on a USB drive as extra memory.", "將 USB 磁碟上面現有嘅 swap 檔當額外記憶體用。"),
    params: [{ id: "file", type: "select", label: L("Swap file", "Swap 檔"), source: "swap-files", required: true }],
    build: (p) => ({ command: `swapon ${quote(p.file)}` }),
  },
  {
    id: "swap-off", group: "storage", icon: "memory_alt", risk: "low",
    label: L("Turn swap off", "關閉 swap"), help: L("Stops using a swap file.", "停止使用一個 swap 檔。"),
    params: [{ id: "file", type: "select", label: L("Active swap", "使用緊嘅 swap"), source: "swaps", required: true }],
    build: (p) => ({ command: `swapoff ${quote(p.file)}` }),
  },
  // ---- schedule ---------------------------------------------------------------
  {
    id: "cron-add", group: "schedule", icon: "event_repeat", risk: "low", requires: "cru",
    label: L("Add a scheduled job", "加入定時工作"),
    help: L("Runs one of your scripts on a schedule. The job is forgotten when the router restarts unless a start-up script adds it again.", "按時間表執行你其中一個腳本。路由器重啟後工作會消失，除非開機腳本再加入。"),
    params: [
      { id: "name", type: "name", label: L("Job name", "工作名稱"), pattern: "^[A-Za-z0-9_-]{1,32}$", required: true },
      { id: "minute", type: "cronfield", label: L("Minute (0-59)", "分（0-59）"), default: "0", required: true },
      { id: "hour", type: "cronfield", label: L("Hour (0-23)", "時（0-23）"), default: "4", required: true },
      { id: "day", type: "cronfield", label: L("Day of month", "日"), default: "*", required: true },
      { id: "month", type: "cronfield", label: L("Month", "月"), default: "*", required: true },
      { id: "weekday", type: "cronfield", label: L("Weekday (0 = Sunday)", "星期（0 = 星期日）"), default: "*", required: true },
      { id: "script", type: "select", label: L("Script to run", "要執行嘅腳本"), source: "scripts", required: true },
    ],
    build(p) {
      for (const f of ["minute", "hour", "day", "month", "weekday"]) if (!cronOk[f](String(p[f]))) throw bad(`The ${f} field is not a valid schedule piece.`);
      return { command: `cru a ${p.name} ${quote(`${p.minute} ${p.hour} ${p.day} ${p.month} ${p.weekday} ${p.script}`)}` };
    },
  },
  {
    id: "cron-remove", group: "schedule", icon: "event_busy", risk: "low", requires: "cru",
    label: L("Remove a scheduled job", "移除定時工作"), help: L("Deletes one job from the router's schedule.", "由路由器嘅時間表刪除一個工作。"),
    params: [{ id: "name", type: "select", label: L("Job", "工作"), source: "crons", required: true }],
    build: (p) => ({ command: `cru d ${p.name}` }),
  },
  // ---- keys and lights (written through the change engine) -------------------
  {
    id: "ssh-key-add", group: "access", icon: "key", risk: "network", viaEngine: true,
    label: L("Allow an SSH key", "容許 SSH 金鑰"), help: L("Adds a public key to the router's allowed list. You review it before it is written.", "將一條公開金鑰加入路由器嘅容許名單，寫入前你會先睇過。"),
    params: [{ id: "key", type: "pubkey", label: L("Public key", "公開金鑰"), required: true }],
  },
  {
    id: "ssh-key-remove", group: "access", icon: "key_off", risk: "network", viaEngine: true,
    label: L("Remove an SSH key", "移除 SSH 金鑰"), help: L("Takes one public key off the allowed list. You review it before it is written.", "將一條公開金鑰由容許名單移除，寫入前你會先睇過。"),
    params: [{ id: "key", type: "select", label: L("Allowed key", "已容許嘅金鑰"), source: "ssh-keys", required: true }],
  },
  {
    id: "led", group: "access", icon: "lightbulb", risk: "low", viaEngine: true,
    label: L("Router lights", "路由器燈號"), help: L("Turns the router's lights off or back on. You review it before it is written.", "關閉或重新開啟路由器燈號，寫入前你會先睇過。"),
    params: [{ id: "state", type: "segmented", label: L("Lights", "燈號"), options: opt([["on", L("On", "開")], ["off", L("Off", "關")]]), required: true }],
  },
];

export const GROUPS = [
  ["services", L("Services and housekeeping", "服務同日常維護"), "settings_suggest"],
  ["network", L("Network", "網絡"), "lan"],
  ["tests", L("Tests", "測試"), "network_check"],
  ["viewers", L("Look at the router", "查看路由器"), "visibility"],
  ["storage", L("USB and storage", "USB 同儲存"), "usb"],
  ["schedule", L("Schedule", "時間表"), "event_repeat"],
  ["access", L("Keys and lights", "金鑰同燈號"), "key"],
];

export const actionById = (id) => ACTIONS.find((a) => a.id === id) ?? null;

// Checks every parameter of an action and returns the clean values.
export async function checkParams(action, input, env) {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const out = {};
  for (const def of action.params) {
    let value = raw[def.id];
    if (value === undefined || value === null || value === "") value = def.default;
    if (value === undefined || value === null || value === "") {
      if (def.required) throw bad(`${def.label.en}: choose or enter a value.`);
      continue;
    }
    switch (def.type) {
      case "select":
      case "segmented": {
        const allowed = def.source ? (await resolveOptions(def.source, env)).map(([v]) => String(v)) : def.options.map((o) => String(o.value));
        if (!allowed.includes(String(value))) throw bad(`${def.label.en}: that choice is not available on this router.`);
        out[def.id] = String(value);
        break;
      }
      case "number": {
        const n = Number(value);
        if (!Number.isInteger(n) || n < def.min || n > def.max) throw bad(`${def.label.en}: enter a whole number from ${def.min} to ${def.max}.`);
        out[def.id] = n;
        break;
      }
      case "host": out[def.id] = hostTarget(value); break;
      case "mac": out[def.id] = macAddress(value); break;
      case "name": {
        if (!new RegExp(def.pattern).test(String(value))) throw bad(`${def.label.en}: use letters, digits, dashes and underscores only.`);
        out[def.id] = String(value);
        break;
      }
      case "cronfield": out[def.id] = String(value).trim(); break;
      case "pubkey": {
        const key = String(value).trim().replace(/\s+/g, " ");
        if (!isPublicKey(key)) throw bad("That is not a public SSH key. It starts with ssh-ed25519, ssh-rsa or ecdsa-sha2- and fits on one line.");
        out[def.id] = key;
        break;
      }
      default: throw bad(`${def.label.en}: unknown control.`);
    }
  }
  return out;
}

// Why an action cannot be used on this router, or null.
export function unavailable(action, probes) {
  const need = action.requires ?? action.probe;
  if (need && probes[need] === false) return L(`This router does not have ${need}.`, `呢部路由器冇 ${need}。`);
  return null;
}
