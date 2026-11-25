// A pretend Asus router that speaks SSH. It answers the same commands the app
// sends to a real router (nvram, service, head -n 100000 /proc/..., wl, ping and so on)
// from an in-memory settings table. Tests and demo mode use it, so nothing in
// this project needs a real router to prove its behaviour.
import { createHash } from "node:crypto";
import ssh2 from "ssh2";
import { featureFakeHandlers, featureNvram } from "../features/registry.mjs";
import { generateEd25519 } from "./keys.mjs";

const { Server, utils } = ssh2;

const STOCK = { firmver: "3.0.0.4", buildno: "388", extendno: "24198-g2f1a4b6", "3rd-party": "" };
const MERLIN = { firmver: "3.0.0.4", buildno: "388.8", extendno: "4", "3rd-party": "merlin", jffs2_scripts: "1" };

export function defaultNvram({ firmware = "merlin", model = "RT-AX86U" } = {}) {
  return {
    productid: model,
    odmpid: "",
    ...(firmware === "merlin" ? MERLIN : STOCK),
    rc_support: "2.4G 5G usbX1 amas wireguard openvpnd qos bwdpi smart_connect",
    lan_hwaddr: "04:D9:F5:12:34:50",
    lan_ipaddr: "198.51.100.1",
    lan_netmask: "255.255.255.0",
    lan_domain: "home.lan",
    dhcp_enable_x: "1",
    dhcp_start: "198.51.100.100",
    dhcp_end: "198.51.100.199",
    dhcp_lease: "86400",
    dhcp_staticlist: "<B8:27:EB:11:22:33>198.51.100.20>>nas",
    wl_ifnames: "eth6 eth7",
    wl0_ifname: "eth6",
    wl1_ifname: "eth7",
    wl0_nband: "2",
    wl1_nband: "1",
    wl0_radio: "1",
    wl1_radio: "1",
    wl0_ssid: "Harbour Home",
    wl1_ssid: "Harbour Home 5G",
    wl0_closed: "0",
    wl1_closed: "0",
    wl0_auth_mode_x: "psk2",
    wl1_auth_mode_x: "psk2sae",
    wl0_wpa_psk: "milk-tea-and-egg-tarts",
    wl1_wpa_psk: "milk-tea-and-egg-tarts",
    wl0_chanspec: "0",
    wl1_chanspec: "0",
    wl0_bw: "1",
    wl1_bw: "3",
    wl0_txpower: "100",
    wl1_txpower: "100",
    "wl0.1_bss_enabled": "0",
    "wl0.1_ssid": "Harbour Guest",
    "wl0.1_wpa_psk": "visitors-welcome",
    "wl0.1_lanaccess": "off",
    "wl1.1_bss_enabled": "0",
    "wl1.1_ssid": "Harbour Guest 5G",
    "wl1.1_wpa_psk": "visitors-welcome",
    "wl1.1_lanaccess": "off",
    smart_connect_x: "0",
    wan_proto: "dhcp",
    wan0_proto: "dhcp",
    wan0_ipaddr: "100.64.12.34",
    wan0_gateway: "100.64.0.1",
    wan0_dns: "1.1.1.1 8.8.8.8",
    wan0_state_t: "2",
    wan_dnsenable_x: "1",
    wan_dns1_x: "",
    wan_dns2_x: "",
    ddns_enable_x: "0",
    ddns_server_x: "WWW.ASUS.COM",
    ddns_hostname_x: "",
    vts_enable_x: "1",
    vts_rulelist: "<Game server>25565>198.51.100.20>25565>TCP>",
    fw_enable_x: "1",
    misc_ping_x: "0",
    fw_dos_x: "0",
    ipv6_fw_enable: "1",
    qos_enable: "0",
    qos_type: "1",
    qos_obw: "20000",
    qos_ibw: "300000",
    VPNServer_enable: "0",
    vpn_server1_port: "1194",
    vpn_server1_proto: "udp",
    wgs_enable: "0",
    wgs_port: "51820",
    MULTIFILTER_ALL: "1",
    MULTIFILTER_ENABLE: "",
    MULTIFILTER_MAC: "",
    MULTIFILTER_DEVICENAME: "",
    custom_clientlist: "<Living room TV>AC:5A:F0:01:02:03>0>0>>",
    cfg_clientlist: "<04:D9:F5:12:34:50>198.51.100.1>04:D9:F5:12:34:54>0<04:D9:F5:77:88:90>198.51.100.2>04:D9:F5:77:88:94>1",
    cfg_alias: "",
    enable_samba: "1",
    enable_ftp: "0",
    dms_enable: "0",
    timemachine_enable: "0",
    time_zone: "UTC-8",
    ntp_server0: "pool.ntp.org",
    http_lanport: "80",
    misc_http_x: "0",
    sshd_enable: "2",
    sshd_port: "22",
    sshd_authkeys: "",
    led_disable: "0",
    usb_path1: "storage",
    usb_path1_manufacturer: "SanDisk",
    usb_path1_product: "Ultra Fit",
  };
}

const DEVICES = [
  { mac: "AC:5A:F0:01:02:03", ip: "198.51.100.101", host: "lgwebostv", iface: "eth7", rssi: -48 },
  { mac: "F0:18:98:AA:BB:01", ip: "198.51.100.102", host: "Pats-iPhone", iface: "eth7", rssi: -55 },
  { mac: "3C:22:FB:10:20:30", ip: "198.51.100.103", host: "kitchen-speaker", iface: "eth6", rssi: -67 },
  { mac: "B8:27:EB:11:22:33", ip: "198.51.100.20", host: "nas", iface: null, rssi: null },
  { mac: "DC:A6:32:44:55:66", ip: "198.51.100.104", host: "printer", iface: "eth6", rssi: -71 },
];

// Split on ; outside quotes, keeping single-quoted text intact.
function segments(command) {
  const parts = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    // Outside quotes, backslash + quote is the quote() escape for an apostrophe.
    if (!quoted && ch === "\\" && command[i + 1] === "'") {
      current += "\\'";
      i += 1;
      continue;
    }
    if (ch === "'") quoted = !quoted;
    if (ch === ";" && !quoted) {
      parts.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function unquote(text) {
  // Reverses quote() from shell.mjs: '...' with '\'' for embedded quotes.
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "'") {
      const end = text.indexOf("'", i + 1);
      out += text.slice(i + 1, end);
      i = end + 1;
    } else if (text[i] === "\\" && text[i + 1] === "'") {
      out += "'";
      i += 2;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

export class FakeRouter {
  constructor({ firmware = "merlin", model, password = "router-password", username = "admin", guardScale = 1 } = {}) {
    this.username = username;
    this.password = password;
    // Feature folders add their own default settings (fakeRouter.nvram).
    this.nvram = { ...defaultNvram({ firmware, model }), ...featureNvram({ firmware, model }) };
    this.committed = { ...this.nvram };
    this.services = [];
    this.commands = [];
    this.timers = new Map();
    this.guardFiles = new Set(); // safety-net scripts armed and not yet run or removed
    this.nextPid = 4000;
    this.bootedAt = Date.now() - 3 * 86400 * 1000 - 5 * 3600 * 1000;
    this.counters = { rx: 9.1e10, tx: 1.2e10, at: Date.now() };
    this.guardScale = guardScale;
    this.startLanIp = this.nvram.lan_ipaddr;
    this.hostKey = generateEd25519().private;
    this.syslog = [
      "Nov 25 09:12:01 kernel: eth7: link up",
      "Nov 25 09:12:04 dnsmasq-dhcp[1520]: DHCPACK(br0) 198.51.100.102 f0:18:98:aa:bb:01 Pats-iPhone",
      "Nov 25 09:30:10 wlceventd: wlceventd_proc_event(530): eth6: Auth 3C:22:FB:10:20:30, status: Successful (0)",
      "Nov 25 10:02:44 dropbear[2210]: Password auth succeeded for 'admin' from 198.51.100.102:51234",
      "Nov 25 10:15:00 ntpd: Initial clock set",
    ];
  }

  // SHA256 fingerprint of this router's host key, in the format the app pins.
  get hostKeyFingerprint() {
    const blob = utils.parseKey(this.hostKey).getPublicSSH();
    return `SHA256:${createHash("sha256").update(blob).digest("base64").replace(/=+$/, "")}`;
  }

  // The router is unreachable while its address or SSH service no longer
  // matches what the app connects to, like a real router after a bad change.
  get reachable() {
    return !this.cutOff && this.committed.lan_ipaddr === this.startLanIp && this.committed.sshd_enable !== "0" && this.committed.sshd_port === "22";
  }

  authorizedKeys() {
    return String(this.nvram.sshd_authkeys || "")
      .split(/>|\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => utils.parseKey(line))
      .filter((key) => !(key instanceof Error));
  }

  listen(port = 0, host = "127.0.0.1") {
    this.server = new Server({ hostKeys: [this.hostKey] }, (client) => {
      if (!this.reachable) return client.end();
      client.on("error", () => {});
      client.on("authentication", (ctx) => {
        if (ctx.username !== this.username) return ctx.reject();
        if (ctx.method === "password" && ctx.password === this.password) return ctx.accept();
        if (ctx.method === "publickey") {
          const key = this.authorizedKeys().find((k) => k.type === ctx.key.algo && k.getPublicSSH().equals(ctx.key.data));
          if (key && (!ctx.signature || key.verify(ctx.blob, ctx.signature, ctx.hashAlgo))) return ctx.accept();
        }
        ctx.reject(["password", "publickey"]);
      });
      client.on("ready", () => {
        client.on("session", (accept) => {
          const session = accept();
          // An interactive shell, for the owner's terminal.
          session.on("pty", (acceptPty) => acceptPty?.());
          session.on("window-change", (acceptResize, _reject, size) => {
            this.lastWindow = size;
            acceptResize?.();
          });
          session.on("shell", (acceptShell) => this.#shell(acceptShell()));
          session.on("exec",(acceptExec, _reject, info) => {
            const stream = acceptExec();
            const result = this.execute(info.command);
            const finish = () => {
              if (result.stderr) stream.stderr.write(result.stderr);
              stream.exit(result.code);
              stream.end();
            };
            if (result.stdout) stream.write(result.stdout);
            // A handler may answer with pieces and a pause between them, to show live output.
            if (result.chunks?.length) {
              let at = 0;
              const next = () => (at < result.chunks.length ? (stream.write(result.chunks[at++]), setTimeout(next, result.chunkDelayMs ?? 30)) : finish());
              next();
            } else finish();
          });
        });
      });
    });
    return new Promise((resolve) =>
      this.server.listen(port, host, () => {
        this.port = this.server.address().port;
        this.host = host;
        resolve(this);
      }),
    );
  }

  close() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  // Feature folders may answer a command first (fakeRouter.handlers). A handler
  // returns { stdout, stderr, code } to answer, or undefined to pass.
  #feature(command) {
    for (const handler of featureFakeHandlers()) {
      const result = handler(command, this);
      if (result !== undefined) return { code: 0, stdout: "", ...result };
    }
    return undefined;
  }

  execute(command) {
    this.commands.push(command);
    const answered = this.#feature(command);
    if (answered) return answered;
    const guard = command.match(
      /^mkdir -p \/tmp\/mar; printf '%s' '([A-Za-z0-9+/=]+)' \| base64 -d > (\/tmp\/mar\/r-[A-Za-z0-9-]+\.sh); \( trap '' HUP; sleep (\d+); sh \2 \) <\/dev\/null >\/dev\/null 2>&1 & echo \$!$/,
    );
    if (guard) return this.#arm(Buffer.from(guard[1], "base64").toString("utf8"), Number(guard[3]), guard[2]);
    let stdout = "";
    let code = 0;
    for (const part of segments(command)) {
      const result = this.#one(part.replace(/\s+2>\/dev\/null/g, "").replace(/\s+2>&1/g, ""));
      stdout += result.stdout ?? "";
      code = result.code ?? 0;
    }
    return { stdout, code };
  }

  // A tiny interactive shell: echoes what is typed, runs each line through
  // execute() and prints the answer with a prompt.
  #shell(stream) {
    const prompt = () => stream.write(`${this.nvram.productid}:/tmp/home/root# `);
    let line = "";
    this.shells = (this.shells ?? 0) + 1;
    stream.write("Welcome to the pretend router.\r\n");
    prompt();
    stream.on("data", (data) => {
      for (const ch of String(data)) {
        if (ch === "\r" || ch === "\n") {
          stream.write("\r\n");
          const text = line.trim();
          line = "";
          if (text === "exit" || text === "logout") {
            stream.exit(0);
            return void stream.end();
          }
          if (text) {
            const out = this.execute(text);
            const body = `${out.stdout ?? ""}${out.stderr ?? ""}`;
            if (body) stream.write(body.replace(/\r?\n/g, "\r\n"));
          }
          prompt();
        } else if (ch === "\x7f" || ch === "\b") {
          if (line) {
            line = line.slice(0, -1);
            stream.write("\b \b");
          }
        } else if (ch === "\x03") {
          line = "";
          stream.write("^C\r\n");
          prompt();
        } else if (ch === "\x04") {
          stream.exit(0);
          return void stream.end();
        } else if (ch >= " ") {
          line += ch;
          stream.write(ch);
        }
      }
    });
  }

  #arm(script, seconds, file) {
    const pid = this.nextPid++;
    this.guardFiles.add(file);
    const timer = setTimeout(() => {
      this.timers.delete(pid);
      this.revertedBy = pid;
      for (const line of script.split("\n").filter(Boolean)) this.execute(line);
    }, seconds * 1000 * this.guardScale);
    this.timers.set(pid, timer);
    return { stdout: `${pid}\n`, code: 0 };
  }

  #one(cmd) {
    const answered = this.#feature(cmd);
    if (answered) return answered;
    let m;
    if ((m = cmd.match(/^nvram get ([A-Za-z0-9_.:-]+)$/))) return { stdout: `${this.nvram[m[1]] ?? ""}\n` };
    if (cmd === "nvram show")
      return { stdout: `${Object.entries(this.nvram).map(([k, v]) => `${k}=${v}`).join("\n")}\nsize: 61234 bytes (69838 left)\n` };
    if ((m = cmd.match(/^nvram set ([A-Za-z0-9_.:-]+)=(.*)$/s))) {
      this.nvram[m[1]] = unquote(m[2]);
      return {};
    }
    if ((m = cmd.match(/^nvram unset ([A-Za-z0-9_.:-]+)$/))) {
      delete this.nvram[m[1]];
      return {};
    }
    if (cmd === "nvram commit") {
      this.committed = { ...this.nvram };
      return {};
    }
    if ((m = cmd.match(/^service ([a-z0-9_ ]+)$/))) {
      this.services.push(m[1]);
      return {};
    }
    if ((m = cmd.match(/^kill (\d+)$/))) {
      const timer = this.timers.get(Number(m[1]));
      if (!timer) return { code: 1 };
      clearTimeout(timer);
      this.timers.delete(Number(m[1]));
      return {};
    }
    if (/^rm -f \/tmp\/mar\/r-[A-Za-z0-9-]+\.sh$/.test(cmd)) return (this.guardFiles.delete(cmd.slice(6)), {});
    if (cmd === "head -n 100000 /proc/uptime") return { stdout: `${((Date.now() - this.bootedAt) / 1000).toFixed(2)} 1234567.00\n` };
    if (cmd === "head -n 100000 /proc/loadavg") return { stdout: `0.${10 + Math.floor(Math.random() * 40)} 0.22 0.19 1/180 4321\n` };
    if (cmd === "head -n 100000 /proc/meminfo") return { stdout: "MemTotal:        1018332 kB\nMemFree:          301204 kB\nBuffers:           20480 kB\nCached:           180224 kB\n" };
    if (cmd === "head -n 100000 /proc/net/dev") return { stdout: this.#netdev() };
    if (cmd === "head -n 100000 /sys/class/thermal/thermal_zone0/temp") return { stdout: `${61000 + Math.floor(Math.random() * 3000)}\n` };
    if ((m = cmd.match(/^wl -i (eth\d) phy_tempsense$/))) return { stdout: `${m[1] === "eth6" ? 48 : 53} (0x30)\n` };
    if ((m = cmd.match(/^wl -i (eth\d) assoclist$/)))
      return { stdout: DEVICES.filter((d) => d.iface === m[1]).map((d) => `assoclist ${d.mac}\n`).join("") };
    if ((m = cmd.match(/^wl -i (eth\d) rssi ([0-9A-F:]+)$/i)))
      return { stdout: `${DEVICES.find((d) => d.mac === m[2].toUpperCase())?.rssi ?? -90}\n` };
    if (cmd === "head -n 100000 /var/lib/misc/dnsmasq.leases")
      return { stdout: DEVICES.map((d) => `${Math.floor(Date.now() / 1000) + 40000} ${d.mac.toLowerCase()} ${d.ip} ${d.host} *\n`).join("") };
    if (cmd === "head -n 100000 /proc/net/arp")
      return {
        stdout: `IP address       HW type     Flags       HW address            Mask     Device\n${DEVICES.map((d) => `${d.ip.padEnd(17)}0x1         0x2         ${d.mac.toLowerCase()}     *        br0\n`).join("")}`,
      };
    if ((m = cmd.match(/^tail -n (\d+) \/tmp\/syslog\.log$/))) return { stdout: `${this.syslog.slice(-Number(m[1])).join("\n")}\n` };
    if (cmd === "uname -a") return { stdout: "Linux RT-AX86U 4.1.52 #2 SMP PREEMPT aarch64 ASUSWRT\n" };
    if (cmd === "test -f /usr/sbin/helper.sh && echo yes || echo no") return { stdout: this.nvram["3rd-party"] === "merlin" ? "yes\n" : "no\n" };
    if (cmd === "ls -1 /jffs/scripts")
      return this.nvram["3rd-party"] === "merlin" ? { stdout: "firewall-start\nservices-start\n" } : { stdout: "", code: 1 };
    if (cmd === "test -d /opt/bin && echo yes || echo no") return { stdout: "no\n" };
    if (cmd === "ls -1 /jffs/addons") return this.nvram["3rd-party"] === "merlin" ? { stdout: "" } : { code: 1 };
    if (cmd === "cru l")
      return this.nvram["3rd-party"] === "merlin" ? { stdout: "0 4 * * * /jffs/scripts/backup.sh #nightly-backup#\n" } : { code: 127, stdout: "" };
    if ((m = cmd.match(/^ping -c (\d) -W 2 (\S+)$/)))
      return {
        stdout: `PING ${m[2]} (93.184.216.34): 56 data bytes\n${Array.from({ length: Number(m[1]) }, (_, i) => `64 bytes from 93.184.216.34: seq=${i} ttl=55 time=${(12 + i * 0.7).toFixed(3)} ms\n`).join("")}\n--- ${m[2]} ping statistics ---\n${m[1]} packets transmitted, ${m[1]} packets received, 0% packet loss\n`,
      };
    if ((m = cmd.match(/^traceroute -m 15 -w 2 (\S+)$/)))
      return { stdout: ` 1  100.64.0.1  2.104 ms\n 2  203.0.113.9  6.881 ms\n 3  ${m[1]}  12.402 ms\n` };
    if ((m = cmd.match(/^nslookup (\S+)$/))) return { stdout: `Server:    127.0.0.1\nAddress 1: 127.0.0.1\n\nName:      ${m[1]}\nAddress 1: 93.184.216.34\n` };
    if ((m = cmd.match(/^ether-wake -i br0 ([0-9A-F:]+)$/i))) return {};
    if (cmd === "reboot") {
      this.rebooted = true;
      return {};
    }
    return { stdout: "", code: 127 };
  }

  #netdev() {
    const now = Date.now();
    const seconds = (now - this.counters.at) / 1000;
    this.counters.rx += seconds * (2e6 + Math.random() * 6e6);
    this.counters.tx += seconds * (2e5 + Math.random() * 9e5);
    this.counters.at = now;
    const row = (name, rx, tx) => `${name.padStart(6)}: ${Math.floor(rx)} 0 0 0 0 0 0 0 ${Math.floor(tx)} 0 0 0 0 0 0 0\n`;
    return `Inter-|   Receive |  Transmit\n face |bytes packets|bytes packets\n${row("eth0", this.counters.rx, this.counters.tx)}${row("br0", this.counters.tx * 0.9, this.counters.rx * 0.9)}`;
  }
}
