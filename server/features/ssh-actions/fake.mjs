// What the pretend router answers for this feature's commands: a small file
// system, a process list, USB drives, swap, routing and firewall tables, the
// scheduled jobs and the test tools. The state lives on the pretend router
// object (router.mar), so a test can look at it and change it.
const DAY = "Nov 25";

// Splits a command into words, honouring the single quotes quote() produces.
export function words(command) {
  const out = [];
  let current = "";
  let has = false;
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (ch === "'") {
      has = true;
      const end = command.indexOf("'", i + 1);
      current += command.slice(i + 1, end < 0 ? command.length : end);
      i = end < 0 ? command.length : end;
    } else if (ch === "\\" && command[i + 1] === "'") {
      current += "'";
      has = true;
      i += 1;
    } else if (/\s/.test(ch)) {
      if (has || current) out.push(current);
      current = "";
      has = false;
    } else {
      current += ch;
      has = true;
    }
  }
  if (has || current) out.push(current);
  return out;
}

const file = (text, mode = "-rw-r--r--") => ({ content: Buffer.from(text), mode });

function seed(router) {
  const merlin = router.nvram["3rd-party"] === "merlin";
  const files = new Map();
  const dirs = new Set(["/jffs", "/jffs/.sys", "/jffs/configs", "/tmp", "/tmp/mnt", "/tmp/mnt/usb1", "/opt"]);
  files.set("/jffs/.sys/diag.log", file("router internal\n"));
  files.set("/jffs/configs/readme.txt", file("Put dnsmasq.conf.add and friends here.\n"));
  files.set("/tmp/syslog.log", file(`${router.syslog.join("\n")}\n`));
  files.set("/tmp/mnt/usb1/swapfile", file("swap"));
  files.set("/tmp/mnt/usb1/notes.txt", file("hello from the usb drive\n"));
  files.set("/tmp/binary.bin", { content: Buffer.from([0, 1, 2, 3, 255, 254, 0, 9]), mode: "-rw-r--r--" });
  if (merlin) {
    for (const d of ["/jffs/scripts", "/jffs/addons", "/jffs/addons/spdmerlin.d", "/jffs/addons/connmon.d", "/jffs/addons/amtm"]) dirs.add(d);
    files.set("/jffs/scripts/firewall-start", file("#!/bin/sh\n# Runs after the firewall starts\niptables -I INPUT -p tcp --dport 22 -j ACCEPT\n", "-rwxr-xr-x"));
    files.set("/jffs/scripts/services-start", file("#!/bin/sh\nlogger \"services started\"\n", "-rwxr-xr-x"));
    files.set("/jffs/addons/spdmerlin.d/version.txt", file("4.4.8\n"));
    files.set("/jffs/addons/connmon.d/version.txt", file("3.0.1\n"));
  }
  return {
    files,
    dirs,
    processes: [
      { pid: 1, user: "admin", mem: "2460", state: "S", command: "/sbin/init" },
      { pid: 2, user: "admin", mem: "0", state: "SW", command: "[kthreadd]" },
      { pid: 812, user: "admin", mem: "1352", state: "S", command: "dropbear -p 22" },
      { pid: 905, user: "admin", mem: "4120", state: "S", command: "httpd -i br0" },
      { pid: 1100, user: "admin", mem: "2200", state: "S", command: "dnsmasq --log-async" },
      { pid: 2301, user: "admin", mem: "880", state: "S", command: "/opt/bin/transmission-daemon -f" },
      { pid: 2410, user: "admin", mem: "604", state: "S", command: "ping -c 100 example.com" },
      { pid: 2999, user: "admin", mem: "412", state: "S", command: "sh /tmp/mar/r-0123abcd.sh" },
    ],
    mounts: [{ dev: "/dev/sda1", mnt: "/tmp/mnt/usb1", type: "ext4" }],
    swaps: [],
    crons: merlin ? [{ name: "nightly-backup", line: "0 4 * * * /jffs/scripts/backup.sh" }] : [],
    down: new Set(),
    tools: { iperf3: false },
    cutOnDown: null,
  };
}

export const mar = (router) => (router.mar ??= seed(router));

const parentOf = (p) => p.slice(0, p.lastIndexOf("/")) || "/";
const children = (state, dir) => {
  const names = new Map();
  for (const d of state.dirs) if (parentOf(d) === dir && d !== dir) names.set(d.split("/").pop(), { dir: true });
  for (const [p, f] of state.files) if (parentOf(p) === dir) names.set(p.split("/").pop(), { dir: false, f });
  return names;
};

const listing = (state, dir) =>
  [...children(state, dir)]
    .map(([name, e]) => (e.dir ? `drwxr-xr-x    2 admin    root             0 ${DAY} 09:12 ${name}` : `${e.f.mode}    1 admin    root ${String(e.f.content.length).padStart(10)} ${DAY} 09:12 ${name}`))
    .join("\n");

const NET_UP = ["lo", "br0", "eth0", "eth6", "eth7", "vlan1", "vlan2"];
const PROC_PARTITIONS = "major minor  #blocks  name\n\n   8        0   15728640 sda\n   8        1   15727616 sda1\n   8       16    3912704 sdb\n   8       17    3911680 sdb1\n";

function psText(state) {
  return `  PID USER       VSZ STAT COMMAND\n${state.processes.map((p) => `${String(p.pid).padStart(5)} ${p.user.padEnd(8)} ${p.mem.padStart(6)} ${p.state.padEnd(4)} ${p.command}`).join("\n")}\n`;
}

const mountText = (state) => `ubi:rootfs_ubifs on / type ubifs (rw,noatime)\ntmpfs on /tmp type tmpfs (rw)\n${state.mounts.map((m) => `${m.dev} on ${m.mnt} type ${m.type} (rw,noatime)`).join("\n")}\n`;

// Handlers get the whole command first, then each ;-separated part. They must
// return undefined for anything else and change nothing until they match.
export function handler(command, router) {
  const state = mar(router);
  const w = words(command);
  let m;

  if (w[0] === "ls" && w[1] === "-lA" && w.length === 3) {
    const dir = w[2].replace(/\/+$/, "") || "/";
    if (!state.dirs.has(dir)) return { code: 1, stderr: `ls: ${dir}: No such file or directory\n` };
    return { stdout: `total 0\n${listing(state, dir)}\n` };
  }
  if (w[0] === "wc" && w[1] === "-c" && w[2] === "<" && w.length === 4) {
    const f = state.files.get(w[3]);
    return f ? { stdout: `${f.content.length}\n` } : { code: 1 };
  }
  if (w[0] === "base64" && w.length === 2) {
    const f = state.files.get(w[1]);
    return f ? { stdout: `${f.content.toString("base64").replace(/(.{76})/g, "$1\n")}\n` } : { code: 1 };
  }
  if (w[0] === "base64" && w[1] === "-d" && w[3] === ">" && w.length === 5) {
    const src = state.files.get(w[2]);
    if (!src) return { code: 1 };
    state.files.set(w[4], { content: Buffer.from(src.content.toString("utf8"), "base64"), mode: "-rw-r--r--" });
    return {};
  }
  if ((m = command.match(/^printf '%s' '([A-Za-z0-9+/=]*)' >> (\/tmp\/mar\/up-[a-f0-9]+\.b64)$/))) {
    const old = state.files.get(m[2]);
    if (!old) return { code: 1 };
    old.content = Buffer.from(old.content.toString("utf8") + m[1]);
    return {};
  }
  if (command === "mkdir -p /tmp/mar") return (state.dirs.add("/tmp/mar"), {});
  if ((m = command.match(/^: > (\/tmp\/mar\/up-[a-f0-9]+\.b64)$/))) return (state.files.set(m[1], file("")), {});
  if (command === ": > /tmp/syslog.log") {
    router.syslog = [];
    state.files.set("/tmp/syslog.log", file(""));
    return {};
  }
  if (w[0] === "cp" && w.length === 3 && w[1].startsWith("/tmp/mar/up-")) {
    const src = state.files.get(w[1]);
    if (!src || !state.dirs.has(parentOf(w[2]))) return { code: 1, stderr: "cp: cannot create regular file\n" };
    const old = state.files.get(w[2]);
    state.files.set(w[2], { content: Buffer.from(src.content), mode: old?.mode ?? "-rw-r--r--" });
    return {};
  }
  if (w[0] === "chmod" && w[1] === "755" && w.length === 3) {
    const f = state.files.get(w[2]);
    if (f) f.mode = "-rwxr-xr-x";
    return {};
  }
  if (w[0] === "rm" && w[1] === "-f" && w.length >= 3 && w.slice(2).every((p) => /^\/(tmp\/mar\/up-|jffs|tmp|opt)/.test(p) && !p.startsWith("/tmp/mar/r-"))) {
    for (const p of w.slice(2)) state.files.delete(p);
    return {};
  }
  if (w[0] === "rmdir" && w.length === 2) {
    if (children(state, w[1]).size) return { code: 1, stderr: "rmdir: Directory not empty\n" };
    state.dirs.delete(w[1]);
    return {};
  }
  if ((m = command.match(/^test -d (.+) && echo folder \|\| echo file$/))) return { stdout: state.dirs.has(words(m[1])[0]) ? "folder\n" : "file\n" };
  if (w[0] === "readlink" && w[1] === "-f" && w.length === 3) return { stdout: `${w[2]}\n` };

  // ---- processes, drives, swap ------------------------------------------------
  if (command === "ps w") return { stdout: psText(state) };
  if (w[0] === "kill" && w.length === 2 && /^\d+$/.test(w[1])) {
    const at = state.processes.findIndex((p) => p.pid === Number(w[1]));
    if (at < 0) return undefined;
    state.processes.splice(at, 1);
    return {};
  }
  if (command === "mount") return { stdout: mountText(state) };
  if (command === "head -n 100000 /proc/partitions") return { stdout: PROC_PARTITIONS };
  if (command === "sync") return {};
  if (w[0] === "mkdir" && w[1] === "-p" && /^\/tmp\/mnt\/[A-Za-z0-9_-]+$/.test(w[2] ?? "") && w.length === 3) return (state.dirs.add(w[2]), {});
  if (w[0] === "mount" && w.length === 3 && /^\/dev\/sd[a-z][0-9]+$/.test(w[1])) {
    if (state.mounts.some((x) => x.dev === w[1] || x.mnt === w[2])) return { code: 32, stderr: "mount: already mounted\n" };
    state.mounts.push({ dev: w[1], mnt: w[2], type: "ext4" });
    return {};
  }
  if (w[0] === "umount" && w.length === 2) {
    const at = state.mounts.findIndex((x) => x.mnt === w[1]);
    if (at < 0) return { code: 1, stderr: `umount: ${w[1]}: not mounted\n` };
    state.mounts.splice(at, 1);
    return {};
  }
  if (w[0] === "e2fsck" && w.length === 3 && ["-n", "-p"].includes(w[1])) {
    if (state.mounts.some((x) => x.dev === w[2])) return { code: 8, stderr: `e2fsck: ${w[2]} is mounted.\n` };
    return { chunks: [`e2fsck 1.46.2\n`, `${w[2]}: checking inodes\n`, `${w[2]}: clean, 11/245760 files, 36310/980480 blocks\n`], chunkDelayMs: 20 };
  }
  if (command === "head -n 100000 /proc/swaps") return { stdout: `Filename\t\t\t\tType\t\tSize\tUsed\tPriority\n${state.swaps.map((s) => `${s}\tfile\t\t65532\t0\t-2\n`).join("")}` };
  if (command === "ls -1d /tmp/mnt/*/swap*") {
    const found = [...state.files.keys()].filter((p) => /^\/tmp\/mnt\/[^/]+\/swap[^/]*$/.test(p));
    return found.length ? { stdout: `${found.join("\n")}\n` } : { code: 1 };
  }
  if (w[0] === "swapon" && w.length === 2) return state.files.has(w[1]) ? (state.swaps.push(w[1]), {}) : { code: 1, stderr: "swapon: no such file\n" };
  if (w[0] === "swapoff" && w.length === 2) {
    const at = state.swaps.indexOf(w[1]);
    return at < 0 ? { code: 1, stderr: "swapoff: not active\n" } : (state.swaps.splice(at, 1), {});
  }

  // ---- network ----------------------------------------------------------------
  if (command === "ls -1 /sys/class/net") return { stdout: `${NET_UP.join("\n")}\n` };
  if (w[0] === "ifconfig" && w.length === 3 && ["up", "down"].includes(w[2]) && NET_UP.includes(w[1])) {
    if (w[2] === "down") {
      state.down.add(w[1]);
      if (state.cutOnDown === w[1]) router.cutOff = true;
    } else {
      state.down.delete(w[1]);
      if (state.cutOnDown === w[1]) router.cutOff = false;
    }
    return {};
  }
  if (command === "ifconfig -a")
    return { stdout: NET_UP.map((n) => `${n.padEnd(8)}Link encap:Ethernet  ${state.down.has(n) ? "DOWN" : "UP"} BROADCAST RUNNING MULTICAST  MTU:1500\n         ${n === "br0" ? "inet addr:198.51.100.1  Bcast:198.51.100.255  Mask:255.255.255.0\n" : ""}         RX bytes:1234567 (1.1 MiB)  TX bytes:7654321 (7.3 MiB)\n`).join("\n") };
  if (command === "ip route") return { stdout: "default via 100.64.0.1 dev eth0\n100.64.0.0/10 dev eth0 proto kernel scope link src 100.64.12.34\n198.51.100.0/24 dev br0 proto kernel scope link src 198.51.100.1\n" };
  if ((m = command.match(/^iptables -t (filter|nat|mangle) -L -n -v$/)))
    return { stdout: `Chain ${m[1] === "nat" ? "PREROUTING" : "INPUT"} (policy ACCEPT 0 packets, 0 bytes)\n pkts bytes target     prot opt in     out     source               destination\n  412 51200 ACCEPT     all  --  br0    *       198.51.100.0/24      0.0.0.0/0\n   12   720 DROP       all  --  eth0   *       0.0.0.0/0            0.0.0.0/0\n` };
  if (command === "head -n 200 /proc/net/nf_conntrack")
    return { stdout: "ipv4 2 tcp 6 431999 ESTABLISHED src=198.51.100.101 dst=203.0.113.9 sport=51234 dport=443 src=203.0.113.9 dst=100.64.12.34 sport=443 dport=51234 [ASSURED] mark=0 use=2\nipv4 2 udp 17 28 src=198.51.100.102 dst=1.1.1.1 sport=40111 dport=53 src=1.1.1.1 dst=100.64.12.34 sport=53 dport=40111 mark=0 use=2\n" };
  // Disconnecting a Wi-Fi client is answered by the wifi-diagnostics pretend radio, which also
  // models the device leaving and rejoining; answering it here too would hide that.

  // ---- tools, jobs ------------------------------------------------------------
  if (command === "command -v cru") return router.nvram["3rd-party"] === "merlin" ? { stdout: "/usr/sbin/cru\n" } : { code: 1 };
  if (command === "command -v iperf3") return state.tools.iperf3 ? { stdout: "/opt/bin/iperf3\n" } : { code: 1 };
  if (command === "cru l" && router.nvram["3rd-party"] === "merlin") return { stdout: state.crons.map((c) => `${c.line} #${c.name}#\n`).join("") };
  if (w[0] === "cru" && w[1] === "a" && w.length === 4 && router.nvram["3rd-party"] === "merlin") {
    state.crons = state.crons.filter((c) => c.name !== w[2]);
    state.crons.push({ name: w[2], line: w[3] });
    return {};
  }
  if (w[0] === "cru" && w[1] === "d" && w.length === 3 && router.nvram["3rd-party"] === "merlin") {
    state.crons = state.crons.filter((c) => c.name !== w[2]);
    return {};
  }
  if (w[0] === "wget" && w[1] === "-O" && w[2] === "/dev/null" && w[3] === "-T" && w.length === 6)
    return { chunks: [`Connecting to ${w[5].replace(/^https?:\/\//, "").split("/")[0]} (203.0.113.9:80)\n`, "writing to '/dev/null'\n", "null                 100% |*******************************|  1024k  0:00:00 ETA\n", "written to stdout\n"], chunkDelayMs: 25 };
  if (w[0] === "iperf3" && w[1] === "-c" && w[3] === "-t" && w.length === 5)
    return state.tools.iperf3 ? { chunks: [`Connecting to host ${w[2]}, port 5201\n`, "[  5]   0.00-1.00   sec  11.2 MBytes  94.1 Mbits/sec\n", "[  5]   1.00-2.00   sec  11.3 MBytes  94.8 Mbits/sec\n", "iperf Done.\n"], chunkDelayMs: 25 } : { code: 127, stderr: "iperf3: not found\n" };
  if (command.startsWith("test -f /tmp/mar/r-") && command.endsWith("&& echo armed || echo fired")) {
    const name = command.slice("test -f ".length).split(" ")[0];
    return { stdout: router.guardFiles?.has(name) ? "armed\n" : "fired\n" };
  }
  if (command === "echo mar-alive") return { stdout: "mar-alive\n" };
  return undefined;
}
