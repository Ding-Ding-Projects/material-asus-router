// Firewall internals: the parsers for the live viewers, the viewers' routes on the pretend router,
// the typed settings (including the timeouts control), and the rule that a setting the router does not
// have is disabled with its reason instead of being written.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { barPercent, ruleSearch, bytesText } from "../../public/js/features/firewall-internals/index.js";
import { parseHeadFiles, parseIpset, parseIptables, parseTc, summariseConntrack } from "../../server/features/firewall-internals/parse.mjs";
import { startApp } from "../helpers.mjs";

const ENTRY_IDS = ["ct-max", "ct-tcp", "ct-udp", "loopback", "sip", "ftp", "pptp", "rtsp", "h323", "rstats", "rstats-path", "rstats-save", "rstats-day", "cstats"];

test("firewall-internals: iptables, ipset, tc and head output are parsed", () => {
  const rules = parseIptables("-P INPUT DROP\n-N mine\n-A INPUT -j mine\n-A mine -s 203.0.113.9/32 -j DROP\n-A mine -j RETURN\n");
  assert.deepEqual(rules.chains.map((c) => [c.name, c.policy, c.builtin, c.rules.length]), [["INPUT", "DROP", true, 1], ["mine", null, false, 2]]);
  assert.equal(rules.chains[1].rules[0].target, "DROP");
  assert.equal(rules.total, 3);
  const many = parseIptables(Array.from({ length: 1700 }, () => "-A INPUT -j ACCEPT").join("\n"));
  assert.equal(many.truncated, true);
  assert.equal(many.chains[0].rules.length, 1500);

  const sets = parseIpset("Name: a\nType: hash:ip\nHeader: family inet hashsize 1024 maxelem 100\nNumber of entries: 2\nSize in memory: 300\nReferences: 1\nMembers:\n192.0.2.1\n192.0.2.2\n");
  assert.deepEqual(sets.map((s) => [s.name, s.type, s.family, s.maxelem, s.entries, s.members]), [["a", "hash:ip", "inet", 100, 2, ["192.0.2.1", "192.0.2.2"]]]);

  const tc = parseTc("qdisc htb 1: dev eth0 root refcnt 2\n Sent 5 bytes 1 pkt (dropped 2, overlimits 3 requeues 4)\n backlog 3Kb 2p requeues 0\nclass htb 1:1 root rate 1Mbit\n Sent 9 bytes 1 pkt (dropped 0, overlimits 0 requeues 0)\n", "qdisc");
  assert.deepEqual(tc.map((q) => [q.type, q.device, q.parent, q.dropped, q.overlimits, q.backlogBytes, q.backlogPackets]), [["htb", "eth0", "root", 2, 3, 3000, 2]]);

  assert.deepEqual([...parseHeadFiles("==> /a <==\n5\n\n==> /b <==\n7\n")], [["/a", "5"], ["/b", "7"]]);
  const summary = summariseConntrack("ipv4     2 tcp      6 431999 ESTABLISHED src=1\nipv4     2 udp      17 20 src=1\nipv6 10 tcp 6 5 TIME_WAIT src=1\n");
  assert.deepEqual([summary.lines, summary.protocols, summary.states], [3, { tcp: 2, udp: 1 }, { ESTABLISHED: 1, TIME_WAIT: 1 }]);
});

test("firewall-internals: the viewers read the pretend router and refuse a wrong table", async () => {
  const t = await startApp();
  try {
    const filter = (await t.owner.get("/api/x/firewall-internals/rules?table=filter")).data;
    assert.equal(filter.available, true);
    assert.deepEqual(filter.chains.filter((c) => c.builtin).map((c) => [c.name, c.policy]), [["INPUT", "DROP"], ["FORWARD", "DROP"], ["OUTPUT", "ACCEPT"]]);
    assert.ok(filter.chains.find((c) => c.name === "logdrop"), "user chains are listed");
    const nat = (await t.owner.get("/api/x/firewall-internals/rules?table=nat")).data;
    assert.ok(nat.chains.some((c) => c.rules.some((r) => r.text.includes("MASQUERADE"))));
    assert.equal((await t.owner.get("/api/x/firewall-internals/rules?table=mangle")).data.available, true);
    assert.equal((await t.owner.get("/api/x/firewall-internals/rules?table=ip6")).data.chains[0].policy, "DROP");
    assert.equal((await t.owner.get("/api/x/firewall-internals/rules?table=raw; reboot")).status, 400);
    assert.ok(!t.router.commands.some((c) => /reboot/.test(c)), "a bad table name never reaches the router");

    const ipsets = (await t.owner.get("/api/x/firewall-internals/ipsets")).data;
    assert.deepEqual(ipsets.sets.map((s) => [s.name, s.entries]), [["Skynet-Blacklist", 3], ["Skynet-Whitelist", 1]]);

    const conn = (await t.owner.get("/api/x/firewall-internals/connections")).data;
    assert.deepEqual([conn.count, conn.max, conn.percent], [812, 16384, 5]);
    assert.equal(conn.effective.tcp_timeout_established, 1200);
    assert.ok(conn.protocols.tcp > 0, "the connection table is summarised by protocol");

    const shaping = (await t.owner.get("/api/x/firewall-internals/shaping")).data;
    assert.equal(shaping.qdiscs.length, 3);
    assert.equal(shaping.qdiscs[0].dropped, 14);
    assert.deepEqual(shaping.classes.map((c) => c.handle), ["1:3", "1:1"]);

    const hardening = (await t.owner.get("/api/x/firewall-internals/hardening")).data;
    const byId = Object.fromEntries(hardening.items.map((i) => [i.id, i]));
    assert.equal(byId.syncookies.status, "ok");
    assert.equal(byId["rp-filter"].status, "warn", "rp_filter 0 is flagged");
    assert.equal(byId["send-redirects"].status, "warn");
    assert.equal(hardening.warn, 2);

    t.router.nvram.mar_fake_no_firewall_viewers = "1";
    const gone = (await t.owner.get("/api/x/firewall-internals/rules?table=filter")).data;
    assert.equal(gone.available, false, "a router without the tool says so");
    assert.ok(gone.reason.en && gone.reason.yue);
  } finally {
    await t.stop();
  }
});

test("firewall-internals: the viewers are reads, so no write command is ever sent", async () => {
  const t = await startApp();
  try {
    for (const url of ["rules?table=filter", "ipsets", "connections", "shaping", "hardening"]) await t.owner.get(`/api/x/firewall-internals/${url}`);
    const sent = t.router.commands.filter((c) => /iptables|ipset|tc |head -n/.test(c));
    assert.ok(sent.length >= 8);
    assert.ok(sent.every((c) => /^(iptables -S|iptables -t (nat|mangle) -S|ip6tables -S|ipset list|tc -s (qdisc show|class show dev [\w.]+)|head -n 100000 )/.test(c)), sent.join("\n"));
    assert.ok(!t.router.commands.some((c) => /nvram set|ipset (add|del|destroy|flush)|iptables -[ADIRF]\b/.test(c)));
  } finally {
    await t.stop();
  }
});

test("firewall-internals: the settings are typed controls and the timeouts control checks its numbers", async () => {
  const t = await startApp();
  try {
    const entries = (await t.owner.get("/api/domain/firewall-internals")).data.entries;
    assert.deepEqual(entries.map((e) => e.id.replace("firewall-internals.", "")), ENTRY_IDS);
    assert.ok(entries.every((e) => e.control !== "text"));
    const tcp = entries.find((e) => e.id === "firewall-internals.ct-tcp");
    assert.equal(tcp.value, "0 1200 120 60 120 120 10 60 30 0");
    assert.equal(tcp.meta.fields.length, 10);

    const change = (id, value) => t.owner.post("/api/changes/preview", { changes: [{ id: `firewall-internals.${id}`, value }] });
    assert.equal((await change("ct-tcp", "0 1200 120")).status, 400, "too few numbers");
    assert.equal((await change("ct-tcp", "0 1200 120 60 120 120 10 60 30 5")).status, 400, "an unused position stays zero");
    assert.equal((await change("ct-tcp", "0 999999 120 60 120 120 10 60 30 0")).status, 400, "out of range");
    assert.equal((await change("ct-udp", "30 x")).status, 400);
    assert.equal((await change("ct-udp", "30 240")).status, 200);
    assert.equal((await change("ct-max", "100")).status, 400, "below the minimum");
    const ok = await change("ct-tcp", "0 600 120 60 120 120 10 60 30 0");
    assert.equal(ok.status, 200, ok.text);
    assert.ok(ok.data.restarts.includes("restart_firewall"));
  } finally {
    await t.stop();
  }
});

test("firewall-internals: a setting the router does not have is disabled with the reason and never written", async () => {
  const t = await startApp();
  try {
    delete t.router.nvram.nf_rtsp;
    delete t.router.nvram.rstats_offset;
    const entries = (await t.owner.get("/api/domain/firewall-internals")).data.entries;
    const rtsp = entries.find((e) => e.id === "firewall-internals.rtsp");
    assert.equal(rtsp.disabled.en, "This router does not have the setting nf_rtsp");
    assert.ok(rtsp.disabled.yue.includes("nf_rtsp"));
    assert.equal(entries.find((e) => e.id === "firewall-internals.rstats-day").disabled.en, "This router does not have the setting rstats_offset");
    assert.equal(entries.find((e) => e.id === "firewall-internals.sip").disabled, null);
    const refused = await t.owner.post("/api/changes/preview", { changes: [{ id: "firewall-internals.rtsp", value: "1" }] });
    assert.equal(refused.status, 400);
    assert.equal(t.router.nvram.nf_rtsp, undefined);
  } finally {
    await t.stop();
  }
});

test("firewall-internals: on stock firmware the Merlin-only entries are disabled and every entry is still listed", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const entries = (await t.owner.get("/api/domain/firewall-internals")).data.entries;
    const by = Object.fromEntries(entries.map((e) => [e.id.replace("firewall-internals.", ""), e]));
    assert.ok(Object.values(by).every((e) => e.disabled), "all of them need Merlin");
    assert.equal(Object.keys(by).length, ENTRY_IDS.length);
  } finally {
    await t.stop();
  }
});

test("firewall-internals: the browser module is well formed and its helpers behave", () => {
  assert.equal(checkFeatureModule(feature, "firewall-internals"), null);
  assert.equal(feature.screens.length, 1);
  assert.equal(typeof feature.controls.timeouts, "function");
  assert.equal(barPercent(5, 10), 50);
  assert.equal(barPercent(20, 10), 100);
  assert.equal(barPercent(1, 0), 0);
  assert.equal(bytesText(1500), "1.5 kB");
  assert.equal(bytesText(91000000), "91.0 MB");
  assert.equal(ruleSearch("drop", "-A INPUT -j DROP"), true);
  assert.equal(ruleSearch("ssh", "-A INPUT -j DROP"), false);
  assert.equal(ruleSearch("", "anything"), true);
});

test("firewall-internals: the routes need a session and give viewers read access only", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/x/firewall-internals/hardening")).status, 401);
    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201, viewer.text);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/x/firewall-internals/hardening")).status, 200);
  } finally {
    await t.stop();
  }
});
