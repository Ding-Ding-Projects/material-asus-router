// The action catalogue: every card builds a checked command, risky ones run
// under the safety net or need the two-key confirmation, output streams while
// a command runs, files are browsed and changed only through reviewed steps,
// and nothing the router owns can be stopped, edited or deleted from here.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/ssh-actions/index.js";
import { ACTIONS, GROUPS, checkParams, isPublicKey } from "../../server/features/ssh-actions/catalogue.mjs";
import { lineDiff, parseListing, cleanPath } from "../../server/features/ssh-actions/files.mjs";
import { mar } from "../../server/features/ssh-actions/fake.mjs";
import { parseProcesses, stoppable } from "../../server/features/ssh-actions/sources.mjs";
import { Client, startApp } from "../helpers.mjs";

const base = "/api/x/ssh-actions";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function superToken(client, action) {
  const id = (await client.post("/api/x/super-confirmation/begin", { action })).data.id;
  for (const [route, body] of [["key", { key: 1 }], ["key", { key: 2 }], ["slide", { value: 100 }]]) {
    await sleep(140);
    await client.post(`/api/x/super-confirmation/${route}`, { id, ...body });
  }
  await sleep(140);
  return (await client.post("/api/x/super-confirmation/finish", { id })).data.token;
}

// Follows a job the way the screen does: ask for everything after piece N, wait for news.
async function follow(client, job) {
  let from = 0;
  let output = "";
  let polls = 0;
  let sawRunning = false;
  for (;;) {
    const r = (await client.get(`${base}/jobs/${job}?from=${from}&wait=5000`)).data;
    polls += 1;
    from = r.next;
    output += r.chunks.map((c) => c.text).join("");
    if (r.status === "running" && r.chunks.length) sawRunning = true;
    if (r.status !== "running") return { ...r, output, polls, sawRunning };
  }
}
async function run(client, id, params = {}, extra = {}) {
  const r = await client.post(`${base}/run`, { id, params, ack: true, ...extra });
  assert.equal(r.status, 200, `${id}: ${r.text}`);
  return follow(client, r.data.job);
}

// A valid set of choices for a card, read from the router the way the screen reads them.
async function sample(client, card) {
  const params = {};
  for (const p of card.params) {
    if (p.source) params[p.id] = (await client.get(`${base}/options/${p.source}`)).data.options[0]?.[0];
    else if (p.options) params[p.id] = p.default ?? p.options[0].value;
    else if (p.type === "number") params[p.id] = p.default ?? p.min;
    else if (p.type === "host") params[p.id] = p.default ?? "example.com";
    else if (p.type === "mac") params[p.id] = "AA:BB:CC:DD:EE:FF";
    else if (p.type === "name") params[p.id] = card.id === "usb-mount" ? "usb2" : (p.default ?? "test-job");
    else params[p.id] = p.default ?? "*";
  }
  return params;
}

test("ssh-actions: the browser module has the shape the registry needs", () => {
  assert.equal(checkFeatureModule(feature, "ssh-actions"), null);
  assert.ok(feature.screens.length >= 1);
});

test("ssh-actions: every card is bilingual, has a risk and a real control for each parameter", () => {
  const ids = new Set();
  const groups = new Set(GROUPS.map(([id]) => id));
  for (const a of ACTIONS) {
    assert.ok(!ids.has(a.id), `${a.id} is listed twice`);
    ids.add(a.id);
    assert.ok(groups.has(a.group), `${a.id}: unknown group ${a.group}`);
    assert.ok(a.label.en && a.label.yue && a.help.en && a.help.yue, `${a.id}: needs English and Cantonese text`);
    assert.ok(["low", "network", "destructive"].includes(a.risk), `${a.id}: risk`);
    for (const p of a.params) {
      assert.ok(["select", "segmented", "number", "host", "mac", "name", "cronfield", "pubkey"].includes(p.type), `${a.id}.${p.id}: ${p.type} is not a typed control`);
      assert.ok(p.label.en && p.label.yue, `${a.id}.${p.id}: label`);
      if (p.type === "select" || p.type === "segmented") assert.ok(p.source || p.options?.length, `${a.id}.${p.id}: a choice needs its options`);
    }
    if (!a.viaEngine && !a.link) assert.equal(typeof a.build, "function", `${a.id}: needs a build function`);
  }
  for (const needed of ["restart-service", "stop-process", "clear-logs", "flush-dns", "renew-wan", "interface-state", "wifi-disconnect", "view-routes", "view-arp", "view-iptables", "view-connections", "wake-on-lan", "ping", "traceroute", "lookup", "download-test", "iperf", "usb-mount", "usb-unmount", "usb-eject", "disk-check", "swap-on", "swap-off", "cron-add", "cron-remove", "ssh-key-add", "ssh-key-remove", "ntp-sync", "led", "reboot"])
    assert.ok(ids.has(needed), `the catalogue is missing ${needed}`);
});

test("ssh-actions: nothing the catalogue can send is a command the app must never offer", async () => {
  const forbidden = /mtd-write|hnd-write|mtd-erase|nandwrite|flash_erase|telnet|\bSet_[A-Za-z]|\bkillall\b|mkfs|\bformat\b|\bdd if=|setrf|wl .*(country|txpower|pwr)|mdio|gpio|iptables .* -[ADIRF] /i;
  const source = await readFile(path.join(ROOT, "server", "features", "ssh-actions", "catalogue.mjs"), "utf8");
  assert.doesNotMatch(source.replace(/^\s*\/\/.*$/gm, ""), /mtd-write|hnd-write|mtd-erase|nandwrite|telnet|killall|mkfs|Set_[A-Z]/);
  const t = await startApp();
  try {
    const card = (await t.owner.get("/api/domain/ssh-actions")).data.actions;
    for (const c of card.filter((x) => !x.viaEngine && !x.link && !x.unavailable)) {
      let params;
      try {
        params = await sample(t.owner, c);
      } catch {
        continue;
      }
      const r = await t.owner.post(`${base}/preview`, { id: c.id, params });
      if (r.status === 200) assert.doesNotMatch(r.data.command, forbidden, `${c.id}: ${r.data.command}`);
    }
  } finally {
    await t.stop();
  }
});

for (const firmware of ["merlin", "stock"]) {
  test(`ssh-actions: every available card runs on a ${firmware} router and sends exactly the previewed command`, async () => {
    const t0 = await startApp({ firmware });
    const catalogue = (await t0.owner.get("/api/domain/ssh-actions")).data;
    await t0.stop();
    assert.ok(catalogue.actions.length >= 30);
    const cron = catalogue.actions.find((a) => a.id === "cron-add");
    assert.equal(Boolean(cron.unavailable), firmware === "stock", "cron needs Merlin's cru");
    assert.ok(catalogue.actions.find((a) => a.id === "iperf").unavailable, "iperf3 is not on the router, so the card says so");
    assert.equal(catalogue.actions.find((a) => a.id === "iperf").unavailable.en, "This router does not have iperf3.");

    for (const card of catalogue.actions) {
      if (card.viaEngine || card.link || card.unavailable) continue;
      const t = await startApp({ firmware });
      try {
        const state = mar(t.router);
        state.swaps.push("/tmp/mnt/usb1/swapfile");
        if (card.id === "swap-on") state.swaps.length = 0;
        let params = await sample(t.owner, card);
        if (card.id === "stop-process") params = { pid: 2301 };
        const preview = await t.owner.post(`${base}/preview`, { id: card.id, params });
        assert.equal(preview.status, 200, `${card.id}: ${preview.text}`);
        const extra = preview.data.needsSuper ? { token: await superToken(t.owner, `ssh-actions.${card.id}`) } : {};
        const out = await run(t.owner, card.id, params, extra);
        assert.equal(out.status, "done", `${card.id}: ended as ${out.status}: ${out.output}`);
        assert.equal(out.command, preview.data.command);
        assert.ok(t.router.commands.includes(preview.data.command), `${card.id}: the router never saw ${preview.data.command}`);
        assert.ok(out.output.length > 0 || ["clear-logs", "ntp-sync", "usb-unmount", "usb-eject", "usb-mount", "swap-on", "swap-off", "cron-add", "cron-remove", "wake-on-lan", "wifi-disconnect", "stop-process", "interface-state", "restart-service", "flush-dns", "renew-wan"].includes(card.id), `${card.id}: no output`);
      } finally {
        await t.stop();
      }
    }
  });
}

test("ssh-actions: parameters are checked, so nothing typed can become a different command", async () => {
  const t = await startApp();
  try {
    const bad = async (id, params, status = 400) => assert.equal((await t.owner.post(`${base}/preview`, { id, params })).status, status, `${id} ${JSON.stringify(params)}`);
    await bad("ping", { host: "example.com; reboot" });
    await bad("ping", { host: "a b" });
    await bad("ping", { host: "example.com", count: 99 });
    await bad("restart-service", { service: "restart_wireless; reboot" });
    await bad("restart-service", { service: "reboot" });
    await bad("interface-state", { interface: "br0", state: "down" });
    await bad("interface-state", { interface: "lo", state: "down" });
    await bad("interface-state", { interface: "eth0; reboot", state: "down" });
    await bad("wake-on-lan", { mac: "AA:BB" });
    await bad("download-test", { url: "http://203.0.113.5/evil.sh" });
    await bad("usb-unmount", { mount: "/tmp/mnt/usb1; reboot" });
    await bad("usb-mount", { device: "/dev/sda1", name: "x" }); // sda1 is already mounted, so it is not offered
    await bad("disk-check", { device: "/dev/sda1" }); // a mounted drive is never checked
    await bad("cron-add", { name: "bad name", minute: "0", hour: "4", day: "*", month: "*", weekday: "*", script: "/jffs/scripts/firewall-start" });
    await bad("cron-add", { name: "ok", minute: "99", hour: "4", day: "*", month: "*", weekday: "*", script: "/jffs/scripts/firewall-start" });
    await bad("cron-add", { name: "ok", minute: "0", hour: "4", day: "*", month: "*", weekday: "*", script: "/jffs/scripts/firewall-start; reboot" });
    await bad("no-such-action", {}, 404);
    assert.equal((await t.owner.post(`${base}/run`, { id: "ping", params: { host: "example.com" } })).status, 403, "running needs the confirmation flag");
    assert.equal((await t.owner.post(`${base}/run`, { id: "reboot", params: {}, ack: true })).data.code, "USE_MAINTENANCE", "rebooting is left to the Maintenance screen");
    assert.equal(t.router.commands.some((c) => c.includes("reboot")), false);
    const ping = ACTIONS.find((a) => a.id === "ping");
    assert.equal((await checkParams(ping, { host: "ok.test", count: "3" }, {})).count, 3);
    await assert.rejects(checkParams(ping, { host: "ok.test", count: "3.5" }, {}), /whole number/);
  } finally {
    await t.stop();
  }
});

test("ssh-actions: output streams in pieces while the command runs", async () => {
  const t = await startApp();
  try {
    const started = await t.owner.post(`${base}/run`, { id: "download-test", params: { url: "http://speedtest.tele2.net/1MB.zip" }, ack: true });
    const result = await follow(t.owner, started.data.job);
    assert.equal(result.status, "done");
    assert.ok(result.sawRunning, "news arrived while the job was still running");
    assert.ok(result.polls >= 2, "more than one answer was needed");
    assert.match(result.output, /Connecting to speedtest\.tele2\.net/);
    assert.match(result.output, /written to stdout/);
    const again = (await t.owner.get(`${base}/jobs/${started.data.job}?from=1`)).data;
    assert.equal(again.chunks[0].n, 1, "a later request continues from where it left off");
    assert.equal((await t.client().get(`${base}/jobs/${started.data.job}`)).status, 401);
  } finally {
    await t.stop();
  }
});

test("ssh-actions: a network action runs under the safety net, which is switched off once the router answers", async () => {
  const t = await startApp();
  try {
    const out = await run(t.owner, "restart-service", { service: "restart_wireless" });
    assert.equal(out.status, "done");
    assert.equal(out.guard.state, "ok");
    assert.match(out.output, /Safety net on/);
    assert.ok(t.router.commands.some((c) => /^mkdir -p \/tmp\/mar; printf/.test(c)), "the router was given a revert script first");
    assert.equal(t.router.guardFiles.size, 0, "the script was removed after the router answered");
    assert.ok(t.router.services.includes("restart_wireless"));
    // A low risk service does not need the net.
    const low = await run(t.owner, "restart-service", { service: "restart_httpd" });
    assert.equal(low.risk, "low");
    assert.equal(low.guard, null);
    const history = (await t.owner.get("/api/changes/history")).data.items;
    const mine = history.filter((h) => h.items[0]?.key === "ssh-action");
    assert.equal(mine.length, 1, "the network action is in the change history, the low one is not");
    assert.equal(mine[0].status, "recorded");
    assert.equal(mine[0].canUndo, false);
    assert.match(mine[0].items[0].new, /service restart_wireless/);
  } finally {
    await t.stop();
  }
});

test("ssh-actions: when a command cuts the router off the safety net puts things back and the job says so", async () => {
  const t = await startApp({ guardScale: 0.05 });
  try {
    mar(t.router).cutOnDown = "eth0";
    const out = await run(t.owner, "interface-state", { interface: "eth0", state: "down" });
    assert.equal(out.status, "reverted");
    assert.equal(out.guard.state, "reverted");
    assert.match(out.output, /not answering yet/);
    assert.match(out.output, /safety net fired/i);
    assert.equal(mar(t.router).down.has("eth0"), false, "the interface was brought back up by the router itself");
    assert.ok(t.router.commands.includes("ifconfig eth0 up"));
  } finally {
    await t.stop();
  }
});

test("ssh-actions: a destructive action needs the two-key confirmation, once", async () => {
  const t = await startApp();
  try {
    const params = { device: "/dev/sdb1" };
    const refused = await t.owner.post(`${base}/run`, { id: "disk-repair", params, ack: true });
    assert.equal(refused.status, 403);
    assert.equal(refused.data.code, "SUPER_CONFIRM_REQUIRED");
    const wrong = await t.owner.post(`${base}/run`, { id: "disk-repair", params, ack: true, token: await superToken(t.owner, "ssh-actions.something-else") });
    assert.equal(wrong.status, 403, "a token for another action is no good");
    assert.equal(t.router.commands.some((c) => c.startsWith("e2fsck -p")), false, "nothing ran");
    const token = await superToken(t.owner, "ssh-actions.disk-repair");
    const out = await run(t.owner, "disk-repair", params, { token });
    assert.equal(out.status, "done");
    assert.match(out.output, /clean/);
    assert.equal((await t.owner.post(`${base}/run`, { id: "disk-repair", params, ack: true, token })).status, 403, "the token works once");
    assert.equal((await t.owner.get("/api/changes/history")).data.items.filter((h) => h.items[0]?.key === "ssh-action" && h.risk === "destructive").length, 1);
  } finally {
    await t.stop();
  }
});

test("ssh-actions: only programs the person started can be stopped", async () => {
  const t = await startApp();
  try {
    const list = (await t.owner.get(`${base}/processes`)).data.processes;
    const by = Object.fromEntries(list.map((p) => [p.pid, p.stoppable]));
    assert.deepEqual([by[1], by[2], by[812], by[905], by[1100], by[2301], by[2410], by[2999]], [false, false, false, false, false, true, true, false]);
    assert.equal((await t.owner.post(`${base}/run`, { id: "stop-process", params: { pid: 1 }, ack: true })).status, 400, "the first process is never offered");
    for (const pid of [2, 812, 905, 1100, 2999]) {
      const r = await t.owner.post(`${base}/run`, { id: "stop-process", params: { pid }, ack: true });
      assert.equal(r.status, 403, `pid ${pid}`);
      assert.equal(r.data.code, "PROTECTED_PROCESS");
    }
    assert.equal((await t.owner.post(`${base}/run`, { id: "stop-process", params: { pid: 99999 }, ack: true })).status, 404);
    assert.equal((await run(t.owner, "stop-process", { pid: 2410 })).status, "done");
    assert.equal((await t.owner.get(`${base}/processes`)).data.processes.some((p) => p.pid === 2410), false);
    assert.equal(stoppable("/opt/bin/x -a"), true);
    assert.equal(stoppable("sh /jffs/scripts/job.sh"), true);
    assert.equal(stoppable("sh /tmp/mar/r-abc.sh"), false);
    assert.equal(stoppable("/opt/sbin/dropbear -p 22"), false);
    assert.equal(parseProcesses("  PID USER VSZ STAT COMMAND\n  812 admin 1352 S dropbear -p 22\n")[0].command, "dropbear -p 22");
  } finally {
    await t.stop();
  }
});

test("ssh-actions: keys and lights go through the change engine's preview, never straight to the router", async () => {
  const t = await startApp();
  try {
    const key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl laptop@example";
    assert.equal(isPublicKey(key), true);
    assert.equal(isPublicKey("hello world"), false);
    const before = t.router.commands.length;
    const led = await t.owner.post(`${base}/run`, { id: "led", params: { state: "off" } });
    assert.equal(led.status, 200, led.text);
    assert.equal(led.data.viaEngine, true);
    assert.deepEqual([led.data.preview.items[0].key, led.data.preview.items[0].old, led.data.preview.items[0].new], ["AllLED", "1", "0"]);
    assert.equal(t.router.nvram.AllLED, "1", "a preview changes nothing");
    const add = await t.owner.post(`${base}/run`, { id: "ssh-key-add", params: { key } });
    assert.equal(add.data.preview.items[0].key, "sshd_authkeys");
    assert.equal(add.data.preview.guard.armed, true, "key changes run under the engine's own safety net");
    assert.equal(t.router.commands.slice(before).some((c) => /nvram set/.test(c)), false);
    const applied = await t.owner.post("/api/changes/apply", { previewId: add.data.preview.id });
    assert.equal(applied.status, 200, applied.text);
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.ok(t.router.nvram.sshd_authkeys.includes("AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl"));
    const options = (await t.owner.get(`${base}/options/ssh-keys`)).data.options;
    assert.equal(options.length, 1);
    const remove = await t.owner.post(`${base}/run`, { id: "ssh-key-remove", params: { key: options[0][0] } });
    assert.equal(remove.data.preview.items[0].new, "");
    assert.equal((await t.owner.post(`${base}/run`, { id: "ssh-key-add", params: { key } })).status, 409, "the key is already allowed");
    assert.equal((await t.owner.post(`${base}/run`, { id: "ssh-key-add", params: { key: "ssh-ed25519 short" } })).status, 400);
  } finally {
    await t.stop();
  }
});

test("ssh-actions: who may do what", async () => {
  const t = await startApp();
  try {
    const key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl laptop@example";
    for (const role of ["operator", "viewer"]) await t.owner.post("/api/users", { name: role, username: role, password: "a long enough password", role });
    const operator = t.client();
    await operator.signIn("operator", "a long enough password");
    const viewer = t.client();
    await viewer.signIn("viewer", "a long enough password");
    assert.equal((await operator.post(`${base}/run`, { id: "ping", params: { host: "example.com" }, ack: true })).status, 200);
    assert.equal((await operator.post(`${base}/run`, { id: "ssh-key-add", params: { key } })).status, 403, "only the owner changes which SSH keys are allowed");
    assert.equal((await operator.get(`${base}/files/list?path=/jffs`)).status, 200);
    assert.equal((await viewer.post(`${base}/run`, { id: "ping", params: { host: "example.com" }, ack: true })).status, 403);
    assert.equal((await viewer.get(`${base}/files/list?path=/jffs`)).status, 403, "viewers cannot read the router's files");
    assert.equal((await viewer.get(`${base}/files/read?path=/tmp/syslog.log`)).status, 403);
    assert.equal((await viewer.get("/api/domain/ssh-actions")).status, 200, "viewers can see the catalogue");
    const job = (await operator.post(`${base}/run`, { id: "ping", params: { host: "example.com" }, ack: true })).data.job;
    assert.equal((await t.owner.get(`${base}/jobs/${job}`)).status, 200, "the owner can follow anyone's job");
    assert.equal((await new Client(t.base).get(`${base}/jobs/${job}`)).status, 401);
  } finally {
    await t.stop();
  }
});

test("ssh-actions: files can be browsed, edited after review, uploaded, downloaded and deleted, and the router's own places stay off limits", async () => {
  const t = await startApp();
  try {
    const list = await t.owner.get(`${base}/files/list?path=/jffs`);
    assert.equal(list.status, 200, list.text);
    assert.deepEqual(list.data.roots, ["/jffs", "/tmp", "/opt"]);
    const names = list.data.entries.map((e) => e.name);
    assert.ok(names.includes("scripts") && names.includes("configs"));
    assert.equal(names.includes(".sys"), false, "the router's own folder is not listed");
    assert.equal(list.data.entries[0].type, "folder");
    const scripts = (await t.owner.get(`${base}/files/list?path=/jffs/scripts`)).data.entries;
    assert.deepEqual(scripts.map((e) => e.name), ["firewall-start", "services-start"]);

    for (const bad of ["/etc/passwd", "/jffs/../etc/passwd", "/jffs/.sys/diag.log", "/tmp/mar/up.bin", "jffs/scripts", "/jffs/scripts/a'b", "/proc/self/environ", "/jffs//x"])
      assert.ok([400, 403].includes((await t.owner.get(`${base}/files/read?path=${encodeURIComponent(bad)}`)).status), bad);
    assert.throws(() => cleanPath("/jffs/../x"));

    // Read, then review a change before it is written.
    const read = (await t.owner.get(`${base}/files/read?path=/jffs/scripts/firewall-start`)).data;
    assert.match(read.content, /iptables -I INPUT/);
    const edited = read.content.replace("--dport 22", "--dport 2222");
    const review = await t.owner.post(`${base}/files/review`, { path: "/jffs/scripts/firewall-start", content: edited });
    assert.equal(review.status, 200, review.text);
    assert.deepEqual([review.data.diff.added, review.data.diff.removed], [1, 1]);
    assert.equal(mar(t.router).files.get("/jffs/scripts/firewall-start").content.toString().includes("2222"), false, "reviewing writes nothing");
    assert.equal((await t.owner.post(`${base}/files/review`, { path: "/jffs/scripts/firewall-start", content: read.content })).status, 400, "no change is refused");
    const saved = await t.owner.post(`${base}/files/save`, { id: review.data.id });
    assert.equal(saved.status, 200, saved.text);
    assert.equal(mar(t.router).files.get("/jffs/scripts/firewall-start").content.toString(), edited);
    assert.equal(mar(t.router).files.get("/jffs/scripts/firewall-start").mode, "-rwxr-xr-x", "permissions are kept");
    assert.equal((await t.owner.post(`${base}/files/save`, { id: review.data.id })).status, 410, "a review is used once");
    // A file that changed after the review is not overwritten.
    const second = await t.owner.post(`${base}/files/review`, { path: "/jffs/scripts/services-start", content: "#!/bin/sh\nlogger one\n" });
    mar(t.router).files.get("/jffs/scripts/services-start").content = Buffer.from("changed behind your back\n");
    assert.equal((await t.owner.post(`${base}/files/save`, { id: second.data.id })).status, 409);

    // Binary files cannot be shown but can be downloaded.
    assert.equal((await t.owner.get(`${base}/files/read?path=/tmp/binary.bin`)).data.code, "BINARY");
    const download = await fetch(`${t.base}${base}/files/download?path=/tmp/binary.bin`, { headers: { Cookie: t.owner.cookie } });
    assert.deepEqual([...Buffer.from(await download.arrayBuffer())], [0, 1, 2, 3, 255, 254, 0, 9]);
    assert.match(download.headers.get("content-disposition"), /attachment; filename="binary.bin"/);

    // Upload.
    const bytes = Buffer.from("#!/bin/sh\necho hi\n");
    const up = await t.owner.post(`${base}/files/upload`, { folder: "/jffs/scripts", name: "hello.sh", data: bytes.toString("base64"), executable: true });
    assert.equal(up.status, 200, up.text);
    assert.equal(mar(t.router).files.get("/jffs/scripts/hello.sh").content.toString(), bytes.toString());
    assert.equal(mar(t.router).files.get("/jffs/scripts/hello.sh").mode, "-rwxr-xr-x");
    assert.equal((await t.owner.post(`${base}/files/upload`, { folder: "/jffs/scripts", name: "hello.sh", data: bytes.toString("base64") })).status, 409, "an existing file is not replaced by accident");
    assert.equal((await t.owner.post(`${base}/files/upload`, { folder: "/jffs/scripts", name: "hello.sh", data: bytes.toString("base64"), replace: true })).status, 200);
    assert.equal((await t.owner.post(`${base}/files/upload`, { folder: "/jffs/scripts", name: "../x", data: "AAAA" })).status, 400);
    assert.equal((await t.owner.post(`${base}/files/upload`, { folder: "/etc", name: "x", data: "AAAA" })).status, 403);
    const big = Buffer.alloc(150_000, 65);
    assert.equal((await t.owner.post(`${base}/files/upload`, { folder: "/tmp", name: "big.txt", data: big.toString("base64") })).status, 200, "a file that needs several pieces arrives whole");
    assert.equal(mar(t.router).files.get("/tmp/big.txt").content.length, 150_000);
    assert.equal(t.router.commands.filter((c) => c.startsWith("printf '%s' '") && c.includes(">> /tmp/mar/up-")).length >= 4, true);
    assert.equal(t.router.commands.some((c) => /of=\/dev|mtd/.test(c)), false);

    // Delete: the name must be typed back, and /jffs needs the two-key confirmation too.
    assert.equal((await t.owner.post(`${base}/files/delete`, { path: "/tmp/big.txt", confirmName: "wrong" })).status, 403);
    assert.equal((await t.owner.post(`${base}/files/delete`, { path: "/tmp/big.txt", confirmName: "big.txt" })).status, 200);
    assert.equal(mar(t.router).files.has("/tmp/big.txt"), false);
    const needs = await t.owner.post(`${base}/files/delete`, { path: "/jffs/scripts/hello.sh", confirmName: "hello.sh" });
    assert.equal(needs.status, 403);
    assert.equal(needs.data.code, "SUPER_CONFIRM_REQUIRED");
    const gone = await t.owner.post(`${base}/files/delete`, { path: "/jffs/scripts/hello.sh", confirmName: "hello.sh", token: await superToken(t.owner, "ssh-actions.file-delete") });
    assert.equal(gone.status, 200, gone.text);
    assert.equal((await t.owner.post(`${base}/files/delete`, { path: "/jffs/configs", confirmName: "configs", token: await superToken(t.owner, "ssh-actions.file-delete") })).status, 409, "only empty folders go");
    assert.equal((await t.owner.post(`${base}/files/delete`, { path: "/jffs", confirmName: "jffs" })).status, 400);
    const notes = (await t.owner.get("/api/changes/history")).data.items.filter((h) => h.items[0]?.key === "ssh-action").map((h) => h.items[0].new);
    assert.ok(notes.some((n) => n.startsWith("/jffs/scripts/firewall-start")) && notes.some((n) => n === "/jffs/scripts/hello.sh"));
  } finally {
    await t.stop();
  }
});

test("ssh-actions: listings and the line diff read the way a person expects", () => {
  const rows = parseListing("total 0\ndrwxr-xr-x    2 admin    root             0 Nov 25 09:12 scripts\n-rwxr-xr-x    1 admin    root           120 Nov 25 09:12 firewall-start\nlrwxrwxrwx    1 admin    root            11 Nov 25 09:12 link -> /tmp/x\n");
  assert.deepEqual(rows.map((r) => [r.name, r.type, r.size]), [["scripts", "folder", 0], ["firewall-start", "file", 120], ["link", "link", 11]]);
  const d = lineDiff("a\nb\nc\nd\ne\nf\ng\nh", "a\nb\nc\nX\ne\nf\ng\nh");
  assert.deepEqual([d.added, d.removed], [1, 1]);
  assert.ok(d.rows.some((r) => r.op === "-" && r.text === "d") && d.rows.some((r) => r.op === "+" && r.text === "X"));
});

test("ssh-actions: the folder obeys the project's wording and address rules", async () => {
  const files = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else files.push(full);
    }
  };
  await walk(path.join(ROOT, "server", "features", "ssh-actions"));
  await walk(path.join(ROOT, "public", "js", "features", "ssh-actions"));
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, new RegExp(`\\b${"c"}${"at"}\\b`, "i"), `${file}: reserved word found`);
    assert.doesNotMatch(text, /\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/, `${file}: private-range address`);
    assert.doesNotMatch(text, /\b(admin|root|docker)@[0-9a-z]/i, `${file}: user@address`);
  }
});
