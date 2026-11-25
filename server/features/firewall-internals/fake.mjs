// What the pretend router answers for the firewall viewers, so tests and demo mode never need a real router.
// Addresses are reserved example addresses only.

const FILTER = `-P INPUT DROP
-P FORWARD DROP
-P OUTPUT ACCEPT
-N FORWARD_PROTECT
-N logdrop
-A INPUT -m state --state RELATED,ESTABLISHED -j ACCEPT
-A INPUT -i br0 -j ACCEPT
-A INPUT -p icmp -m limit --limit 5/sec -j ACCEPT
-A INPUT -m set --match-set Skynet-Blacklist src -j DROP
-A INPUT -j logdrop
-A FORWARD -j FORWARD_PROTECT
-A FORWARD -i br0 -o eth0 -j ACCEPT
-A FORWARD_PROTECT -m state --state INVALID -j DROP
-A logdrop -m state --state NEW -j LOG --log-prefix "DROP "
`;
const NAT = `-P PREROUTING ACCEPT
-P POSTROUTING ACCEPT
-P OUTPUT ACCEPT
-N VSERVER
-A PREROUTING -d 203.0.113.50/32 -j VSERVER
-A POSTROUTING -o eth0 -j MASQUERADE
-A VSERVER -p tcp -m tcp --dport 8080 -j DNAT --to-destination 198.51.100.20:80
`;
const MANGLE = `-P PREROUTING ACCEPT
-P INPUT ACCEPT
-P FORWARD ACCEPT
-P OUTPUT ACCEPT
-P POSTROUTING ACCEPT
-A PREROUTING -i eth0 -j MARK --set-xmark 0x1/0xf
`;
const IP6 = `-P INPUT DROP
-P FORWARD DROP
-P OUTPUT ACCEPT
-A INPUT -p ipv6-icmp -j ACCEPT
-A INPUT -m state --state RELATED,ESTABLISHED -j ACCEPT
`;
const IPSET = `Name: Skynet-Blacklist
Type: hash:net
Revision: 6
Header: family inet hashsize 1024 maxelem 65536
Size in memory: 17000
References: 1
Number of entries: 3
Members:
203.0.113.5
203.0.113.0/28
192.0.2.77
Name: Skynet-Whitelist
Type: hash:ip
Revision: 4
Header: family inet hashsize 1024 maxelem 65536
Size in memory: 8200
References: 1
Number of entries: 1
Members:
198.51.100.20
`;
const QDISC = `qdisc htb 1: dev eth0 root refcnt 2 r2q 10 default 0x3 direct_packets_stat 12
 Sent 91000000 bytes 120000 pkt (dropped 14, overlimits 530 requeues 2)
 backlog 3Kb 2p requeues 2
qdisc fq_codel 10: dev eth0 parent 1:3 limit 1024p flows 1024 quantum 1514
 Sent 40000000 bytes 60000 pkt (dropped 3, overlimits 0 requeues 0)
 backlog 0b 0p requeues 0
qdisc noqueue 0: dev br0 root refcnt 2
 Sent 0 bytes 0 pkt (dropped 0, overlimits 0 requeues 0)
 backlog 0b 0p requeues 0
`;
const CLASSES = `class htb 1:3 parent 1:1 prio 3 rate 80Mbit ceil 100Mbit burst 15Kb cburst 1600b
 Sent 40000000 bytes 60000 pkt (dropped 3, overlimits 0 requeues 0)
 backlog 0b 0p requeues 0
class htb 1:1 root rate 100Mbit ceil 100Mbit burst 1600b cburst 1600b
 Sent 91000000 bytes 120000 pkt (dropped 0, overlimits 0 requeues 0)
 backlog 0b 0p requeues 0
`;

const SYSCTL = {
  "/proc/sys/net/ipv4/tcp_syncookies": "1",
  "/proc/sys/net/ipv4/conf/all/rp_filter": "0",
  "/proc/sys/net/ipv4/icmp_echo_ignore_broadcasts": "1",
  "/proc/sys/net/ipv4/icmp_ignore_bogus_error_responses": "1",
  "/proc/sys/net/ipv4/conf/all/accept_source_route": "0",
  "/proc/sys/net/ipv4/conf/all/accept_redirects": "0",
  "/proc/sys/net/ipv4/conf/all/send_redirects": "1",
  "/proc/sys/kernel/randomize_va_space": "2",
  "/proc/sys/net/ipv4/ip_forward": "1",
  "/proc/sys/net/netfilter/nf_conntrack_count": "812",
  "/proc/sys/net/netfilter/nf_conntrack_max": "16384",
  "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_established": "1200",
  "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_syn_sent": "120",
  "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_syn_recv": "60",
  "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_fin_wait": "120",
  "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_time_wait": "120",
  "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_close_wait": "60",
  "/proc/sys/net/netfilter/nf_conntrack_tcp_timeout_last_ack": "30",
  "/proc/sys/net/netfilter/nf_conntrack_udp_timeout": "30",
  "/proc/sys/net/netfilter/nf_conntrack_udp_timeout_stream": "180",
};

export function fakeHandlers({ TABLES, CONNTRACK_FILES, HARDENING_FILES, headCommand }) {
  const tables = { [TABLES.filter.command]: FILTER, [TABLES.nat.command]: NAT, [TABLES.mangle.command]: MANGLE, [TABLES.ip6.command]: IP6 };
  const headFor = (files) => files.map((f) => `==> ${f} <==\n${SYSCTL[f] ?? ""}\n`).join("\n");
  return [
    (command, router) => {
      if (command in tables) return router.nvram.mar_fake_no_firewall_viewers === "1" ? { code: 127, stderr: "not found" } : { stdout: tables[command] };
      if (command === "ipset list") return { stdout: IPSET };
      if (command === "tc -s qdisc show") return { stdout: QDISC };
      if (command === "tc -s class show dev eth0") return { stdout: CLASSES };
      if (command === headCommand(CONNTRACK_FILES)) return { stdout: headFor(CONNTRACK_FILES) };
      if (command === headCommand(HARDENING_FILES)) return { stdout: headFor(HARDENING_FILES) };
      return undefined;
    },
  ];
}
