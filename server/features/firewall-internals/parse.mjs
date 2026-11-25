// Pure parsers for the read-only firewall viewers. Nothing here talks to the router.

const MAX_RULES = 1500;

// `iptables -S` lists one rule per line: -P chain policy, -N user chain, -A chain rule.
export function parseIptables(text) {
  const chains = new Map();
  const chain = (name) => {
    if (!chains.has(name)) chains.set(name, { name, builtin: false, policy: null, rules: [] });
    return chains.get(name);
  };
  let total = 0;
  let truncated = false;
  for (const raw of String(text).split("\n")) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^-P (\S+) (\S+)/))) Object.assign(chain(m[1]), { builtin: true, policy: m[2] });
    else if ((m = line.match(/^-N (\S+)/))) chain(m[1]);
    else if ((m = line.match(/^-A (\S+)\s*(.*)$/))) {
      total += 1;
      if (total > MAX_RULES) {
        truncated = true;
        continue;
      }
      const target = (m[2].match(/(?:^|\s)-[jg] (\S+)/) ?? [])[1] ?? null;
      chain(m[1]).rules.push({ text: m[2], target });
    }
  }
  return { chains: [...chains.values()], total, truncated };
}

// `ipset list`: blocks that start with "Name:", a header and a "Members:" list.
export function parseIpset(text) {
  const sets = [];
  let current = null;
  let inMembers = false;
  for (const raw of String(text).split("\n")) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^Name: (\S+)/))) {
      current = { name: m[1], type: "", entries: 0, memory: null, references: 0, family: "", maxelem: null, members: [], moreMembers: 0 };
      sets.push(current);
      inMembers = false;
    } else if (!current) continue;
    else if (line === "Members:") inMembers = true;
    else if (inMembers) {
      if (!line) continue;
      if (current.members.length < 60) current.members.push(line);
      else current.moreMembers += 1;
    } else if ((m = line.match(/^Type: (\S+)/))) current.type = m[1];
    else if ((m = line.match(/^Number of entries: (\d+)/))) current.entries = Number(m[1]);
    else if ((m = line.match(/^Size in memory: (\d+)/))) current.memory = Number(m[1]);
    else if ((m = line.match(/^References: (\d+)/))) current.references = Number(m[1]);
    else if ((m = line.match(/^Header: (.*)$/))) {
      current.family = (m[1].match(/family (\S+)/) ?? [])[1] ?? "";
      const max = m[1].match(/maxelem (\d+)/);
      current.maxelem = max ? Number(max[1]) : null;
    }
  }
  return sets;
}

// `head -n 100000 A B` prints "==> A <==" before each file.
export function parseHeadFiles(text) {
  const out = new Map();
  let file = null;
  for (const line of String(text).split("\n")) {
    const m = line.match(/^==> (.+) <==$/);
    if (m) file = m[1];
    else if (file && line.trim() !== "" && !out.has(file)) out.set(file, line.trim());
  }
  return out;
}

// Counts of tracked connections by protocol and state, from /proc/net/nf_conntrack.
export function summariseConntrack(text) {
  const protocols = {};
  const states = {};
  let lines = 0;
  for (const line of String(text).split("\n")) {
    const m = line.match(/^ipv([46])\s+\d+\s+(\S+)\s+\d+\s+\d+\s*(\S*)/);
    if (!m) continue;
    lines += 1;
    protocols[m[2]] = (protocols[m[2]] ?? 0) + 1;
    if (m[2] === "tcp" && /^[A-Z_]+$/.test(m[3])) states[m[3]] = (states[m[3]] ?? 0) + 1;
  }
  return { lines, protocols, states };
}

const UNITS = { K: 1e3, M: 1e6, G: 1e9 };
const size = (n, unit) => Math.round(Number(n) * (UNITS[unit] ?? 1));

// `tc -s qdisc show` and `tc -s class show dev X`: a header line then indented statistics.
export function parseTc(text, kind) {
  const items = [];
  let item = null;
  for (const raw of String(text).split("\n")) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^(qdisc|class) (\S+) (\S+)(.*)$/)) && m[1] !== kind) item = null;
    else if (m) {
      const rest = m[4];
      item = {
        kind, type: m[2], handle: m[3],
        device: (rest.match(/\bdev (\S+)/) ?? [])[1] ?? "",
        parent: (rest.match(/\bparent (\S+)/) ?? ["", ""])[1] || (/\broot\b/.test(rest) ? "root" : ""),
        detail: rest.replace(/\bdev \S+/, "").replace(/\bparent \S+/, "").replace(/\broot\b/, "").trim(),
        bytes: 0, packets: 0, dropped: 0, overlimits: 0, requeues: 0, backlogBytes: 0, backlogPackets: 0,
      };
      items.push(item);
    } else if (item && (m = line.match(/^Sent (\d+) bytes (\d+) pkt \(dropped (\d+), overlimits (\d+) requeues (\d+)\)/))) {
      Object.assign(item, { bytes: Number(m[1]), packets: Number(m[2]), dropped: Number(m[3]), overlimits: Number(m[4]), requeues: Number(m[5]) });
    } else if (item && (m = line.match(/^backlog (\d+)([KMG]?)b (\d+)p/))) {
      Object.assign(item, { backlogBytes: size(m[1], m[2]), backlogPackets: Number(m[3]) });
    }
  }
  return items;
}

// Hardening read-outs: what the kernel is set to, and whether that is the safer choice.
const eq = (...wanted) => (v) => wanted.includes(v);
export const HARDENING = [
  { id: "syncookies", file: "/proc/sys/net/ipv4/tcp_syncookies", good: eq("1", "2"), label: ["SYN cookies", "SYN cookies"], about: ["Keeps the router answering when someone floods it with half-open connections.", "有人用大量半開連線轟炸時，路由器仍然可以回應。"], want: ["1 (on)", "1（開）"] },
  { id: "rp-filter", file: "/proc/sys/net/ipv4/conf/all/rp_filter", good: eq("1", "2"), label: ["Reverse path filter", "反向路徑過濾"], about: ["Drops packets that claim to come from an address that could not be reached that way.", "丟棄聲稱來自一個唔可能經嗰條路到達嘅地址嘅封包。"], want: ["1 or 2", "1 或 2"] },
  { id: "icmp-broadcast", file: "/proc/sys/net/ipv4/icmp_echo_ignore_broadcasts", good: eq("1"), label: ["Ignore broadcast pings", "忽略廣播 ping"], about: ["Stops the router joining in a ping flood aimed at the whole network.", "避免路由器參與針對成個網絡嘅 ping 洪水。"], want: ["1 (on)", "1（開）"] },
  { id: "icmp-bogus", file: "/proc/sys/net/ipv4/icmp_ignore_bogus_error_responses", good: eq("1"), label: ["Ignore bogus ICMP errors", "忽略假嘅 ICMP 錯誤"], about: ["Ignores badly formed error replies instead of logging each one.", "唔理格式錯誤嘅錯誤回覆，而唔係逐個記錄。"], want: ["1 (on)", "1（開）"] },
  { id: "source-route", file: "/proc/sys/net/ipv4/conf/all/accept_source_route", good: eq("0"), label: ["Accept source-routed packets", "接受來源路由封包"], about: ["Packets that choose their own route can bypass the firewall; it should be off.", "自己揀路線嘅封包可以繞過防火牆，應該關閉。"], want: ["0 (off)", "0（關）"] },
  { id: "accept-redirects", file: "/proc/sys/net/ipv4/conf/all/accept_redirects", good: eq("0"), label: ["Accept ICMP redirects", "接受 ICMP 重新導向"], about: ["Redirects can be forged to send traffic through another machine; it should be off.", "重新導向可以被偽造去令流量經另一部機，應該關閉。"], want: ["0 (off)", "0（關）"] },
  { id: "send-redirects", file: "/proc/sys/net/ipv4/conf/all/send_redirects", good: eq("0"), label: ["Send ICMP redirects", "發出 ICMP 重新導向"], about: ["A router does not usually need to tell devices about better routes; off is safer.", "路由器一般唔需要話俾裝置知有更好嘅路線，關閉較安全。"], want: ["0 (off)", "0（關）"] },
  { id: "aslr", file: "/proc/sys/kernel/randomize_va_space", good: eq("2"), label: ["Address space randomisation", "位址空間隨機化"], about: ["Makes memory attacks harder by moving programs around in memory.", "令程式喺記憶體入面移位，加大記憶體攻擊嘅難度。"], want: ["2 (full)", "2（完整）"] },
  { id: "forwarding", file: "/proc/sys/net/ipv4/ip_forward", good: eq("1"), label: ["Forward traffic between networks", "喺網絡之間轉發流量"], about: ["A router needs this on. It is listed so you can see it was not turned off by mistake.", "路由器要開住呢項。列出嚟係等你睇到佢冇被誤關。"], want: ["1 (on)", "1（開）"] },
];
export const HARDENING_FILES = HARDENING.map((h) => h.file);
export const CONNTRACK_FILES = [
  "/proc/sys/net/netfilter/nf_conntrack_count", "/proc/sys/net/netfilter/nf_conntrack_max",
  "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_established", "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_syn_sent",
  "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_syn_recv", "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_fin_wait",
  "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_time_wait", "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_close_wait",
  "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_last_ack", "/proc/sys/net/netfilter/nf_conntrack_udp_timeout",
  "/proc/sys/net/netfilter/nf_conntrack_udp_timeout_stream",
];
export const headCommand = (files) => `head -n 100000 ${files.join(" ")}`;
