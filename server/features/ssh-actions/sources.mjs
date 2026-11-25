// Where the choices on an action card come from. Every list is read from the
// router when the card is opened, never typed in, so a card can only offer
// things that exist right now (an interface, a process, a mounted drive).

export const bad = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });
export const linesOf = (text) => String(text ?? "").split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");
const run = async (exec, command) => {
  const out = await exec(command).catch(() => ({ code: 1, stdout: "" }));
  return out.code === 0 ? out.stdout : "";
};

// Processes the card may stop: only programs the person started (from /opt,
// /jffs or a USB drive) and plain command line tools. The router's own
// daemons, kernel threads and this app's safety timers are never offered.
const USER_TOOLS = new Set(["ping", "traceroute", "iperf", "iperf3", "wget", "curl", "sleep", "nc", "ncat", "tail", "top"]);
const PROTECTED = new Set(["init", "rc", "httpd", "nvram", "dnsmasq", "wanduck", "watchdog", "dropbear", "sshd", "networkmap", "eapd", "nas", "wlceventd", "acsd", "bsd", "cfg_server", "cfg_client", "lld2d", "udhcpc", "pppd", "hotplug2", "infosvr", "lighttpd", "crond", "syslogd", "klogd"]);
const userPath = (t) => /^\/(opt|jffs|tmp\/mnt)\//.test(t);
export function stoppable(commandLine) {
  const text = String(commandLine ?? "").trim();
  if (!text || text.startsWith("[")) return false;
  const tokens = text.split(/\s+/);
  const base = (t) => t.split("/").pop();
  if (tokens.some((t) => t.startsWith("/tmp/mar"))) return false;
  if (PROTECTED.has(base(tokens[0]))) return false;
  return userPath(tokens[0]) || USER_TOOLS.has(base(tokens[0])) || (["sh", "bash", "ash"].includes(base(tokens[0])) && tokens.slice(1).some(userPath));
}

export function parseProcesses(text) {
  const out = [];
  for (const line of linesOf(text)) {
    const m = line.match(/^\s*(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
    if (!m) continue;
    out.push({ pid: Number(m[1]), user: m[2], memory: m[3], state: m[4], command: m[5], stoppable: stoppable(m[5]) });
  }
  return out;
}

export function parseMounts(text) {
  const out = [];
  for (const line of linesOf(text)) {
    const m = line.match(/^(\/dev\/\S+) on (\/tmp\/mnt\/[A-Za-z0-9 ._-]{1,64}) type (\S+)/);
    if (m) out.push({ device: m[1], mount: m[2], type: m[3] });
  }
  return out;
}

export function parseMtd(text) {
  const out = [];
  for (const line of linesOf(text)) {
    const m = line.match(/^mtd(\d+):\s+([0-9a-f]+)\s+([0-9a-f]+)\s+"([^"]*)"/i);
    if (m) out.push({ index: Number(m[1]), size: Number.parseInt(m[2], 16), erase: Number.parseInt(m[3], 16), name: m[4] });
  }
  return out;
}

const pairs = (list) => list.map((v) => (Array.isArray(v) ? v : [v, v]));

// Each source answers [[value, label]]. `ctx` has exec and nvram.
export const SOURCES = {
  async interfaces({ exec }) {
    return pairs(linesOf(await run(exec, "ls -1 /sys/class/net")).filter((n) => /^[a-z][a-z0-9.]{1,14}$/.test(n) && n !== "lo" && n !== "br0"));
  },
  async "wifi-clients"({ exec, nvram }) {
    const names = String(nvram.get("wl_ifnames") ?? "").split(/\s+/).filter((n) => /^[a-z][a-z0-9.]{1,14}$/.test(n));
    const leases = new Map(linesOf(await run(exec, "head -n 100000 /var/lib/misc/dnsmasq.leases")).map((l) => l.split(/\s+/)).map((p) => [String(p[1] ?? "").toUpperCase(), p[3]]));
    const out = [];
    for (const name of names)
      for (const line of linesOf(await run(exec, `wl -i ${name} assoclist`))) {
        const m = line.match(/^assoclist ([0-9A-Fa-f:]{17})$/);
        if (m) out.push([`${name}/${m[1].toUpperCase()}`, `${leases.get(m[1].toUpperCase()) && leases.get(m[1].toUpperCase()) !== "*" ? leases.get(m[1].toUpperCase()) : m[1].toUpperCase()} · ${name}`]);
      }
    return out;
  },
  async mounts({ exec }) {
    return parseMounts(await run(exec, "mount")).map((m) => [m.mount, `${m.mount} (${m.device}, ${m.type})`]);
  },
  async "unmounted-partitions"({ exec }) {
    const mounted = new Set(parseMounts(await run(exec, "mount")).map((m) => m.device));
    const out = [];
    for (const line of linesOf(await run(exec, "head -n 100000 /proc/partitions"))) {
      const m = line.match(/^\s*\d+\s+\d+\s+(\d+)\s+(sd[a-z][0-9]{1,2})$/);
      if (m && !mounted.has(`/dev/${m[2]}`)) out.push([`/dev/${m[2]}`, `/dev/${m[2]} (${Math.round(Number(m[1]) / 1024)} MB, not mounted)`]);
    }
    return out;
  },
  async swaps({ exec }) {
    return pairs(linesOf(await run(exec, "head -n 100000 /proc/swaps")).slice(1).map((l) => l.split(/\s+/)[0]).filter((p) => /^\/tmp\/mnt\/[A-Za-z0-9 ._/-]+$/.test(p)));
  },
  async "swap-files"({ exec }) {
    const active = new Set(linesOf(await run(exec, "head -n 100000 /proc/swaps")).slice(1).map((l) => l.split(/\s+/)[0]));
    return pairs(linesOf(await run(exec, "ls -1d /tmp/mnt/*/swap*")).filter((p) => /^\/tmp\/mnt\/[A-Za-z0-9._-]+\/swap[A-Za-z0-9._-]*$/.test(p) && !active.has(p)));
  },
  async scripts({ exec }) {
    const out = [];
    for (const dir of ["/jffs/scripts", "/opt/etc/init.d"])
      for (const name of linesOf(await run(exec, `ls -1 ${dir}`))) if (/^[A-Za-z0-9._-]{1,48}$/.test(name)) out.push([`${dir}/${name}`, `${dir}/${name}`]);
    return out;
  },
  async crons({ exec }) {
    const out = [];
    for (const line of linesOf(await run(exec, "cru l"))) {
      const m = line.match(/#([A-Za-z0-9_-]{1,32})#\s*$/);
      if (m) out.push([m[1], `${m[1]}: ${line.replace(/\s*#[^#]*#\s*$/, "")}`]);
    }
    return out;
  },
  async "ssh-keys"({ nvram }) {
    return String(nvram.get("sshd_authkeys") ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((key, i) => [String(i), key.replace(/^(\S+)\s+(\S{8})\S*\s*(.*)$/, "$1 $2…  $3")]);
  },
};

export const resolveOptions = async (source, ctx) => {
  const fn = SOURCES[source];
  if (!fn) throw bad("That list does not exist.", 404);
  return fn(ctx);
};
