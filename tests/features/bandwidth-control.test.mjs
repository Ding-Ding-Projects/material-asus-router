// bandwidth-control: kick (pause for a while) and ban (until lifted), the firewall rules they put
// on the router, putting rules back after a router restart, and the public Unkick page, which can
// only ever lift a pause on the visitor's own device.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import client, { minutesText, untilText } from "../../public/js/features/bandwidth-control/index.js";
import { reconcile, selfService } from "../../server/features/bandwidth-control/index.mjs";
import { startApp } from "../helpers.mjs";

process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "mar-kick-"));

const TV = "AC:5A:F0:01:02:03"; // 198.51.100.101 on the pretend router
const PHONE = "F0:18:98:AA:BB:01"; // 198.51.100.102
const rules = (t, chain) => t.router.firewall?.chains.get(chain) ?? [];
const execOf = (t) => async (command) => (await t.app.session.exec(command));
// Each test starts with no pauses: the saved state is one file in the data folder.
async function start() {
  await rm(path.join(process.env.DATA_DIR, "features", "bandwidth-control.json"), { force: true });
  return startApp();
}

test("bandwidth-control: a kick pauses one device with a firewall rule of its own and ends by itself", async () => {
  const t = await start();
  try {
    const kick = await t.owner.post("/api/x/bandwidth-control/hold", { mac: TV, name: "TV", method: "pause", minutes: 15, note: "Homework first" });
    assert.equal(kick.status, 200, kick.text);
    assert.equal(kick.data.hold.ban, false);
    assert.ok(kick.data.hold.until > Date.now() + 14 * 60000);
    assert.deepEqual(rules(t, "MAR_PAUSE"), [`-m mac --mac-source ${TV} -j DROP`], "one rule, for that device only");
    assert.ok(t.router.firewall.hooks.has("v4 FORWARD MAR_PAUSE"), "the chain is hooked into forwarded traffic");
    assert.deepEqual(t.router.firewall.v6, [`-m mac --mac-source ${TV} -j DROP`], "IPv6 is paused too");

    const view = (await t.owner.get("/api/domain/bandwidth-control")).data;
    assert.deepEqual(view.holds.map((h) => [h.mac, h.method, h.note]), [[TV, "pause", "Homework first"]]);
    assert.equal(view.log[0].event, "kick");

    // A finished kick is removed from the router on the next sync.
    const exec = execOf(t);
    assert.equal(await reconcile(exec, view.holds, Date.now() + 16 * 60000), 1);
    assert.deepEqual(rules(t, "MAR_PAUSE"), []);
    assert.deepEqual(t.router.firewall.v6, []);
  } finally {
    await t.stop();
  }
});

test("bandwidth-control: name lookups, bans and lifting from the app", async () => {
  const t = await start();
  try {
    const names = await t.owner.post("/api/x/bandwidth-control/hold", { mac: PHONE, method: "names", minutes: 30 });
    assert.equal(names.status, 200, names.text);
    assert.deepEqual(rules(t, "MAR_NAMES"), [`-m mac --mac-source ${PHONE} -p udp -m udp --dport 53 -j DROP`, `-m mac --mac-source ${PHONE} -p tcp -m tcp --dport 53 -j DROP`]);
    assert.ok(t.router.firewall.hooks.has("v4 INPUT MAR_NAMES"));

    const ban = await t.owner.post("/api/x/bandwidth-control/hold", { mac: TV, method: "pause", ban: true });
    assert.equal(ban.status, 200, ban.text);
    assert.equal(ban.data.hold.until, null, "a ban has no end time");

    // After a router restart the rules are gone; a sync puts them back.
    t.router.firewall.chains.clear();
    t.router.firewall.v6.length = 0;
    assert.equal((await t.owner.post("/api/x/bandwidth-control/sync")).data.changed, 3);
    assert.equal(rules(t, "MAR_PAUSE").length, 1);
    assert.equal(rules(t, "MAR_NAMES").length, 2);

    const unban = await t.owner.request("DELETE", `/api/x/bandwidth-control/hold/${ban.data.hold.id}`);
    assert.equal(unban.status, 200, unban.text);
    assert.deepEqual(rules(t, "MAR_PAUSE"), []);
    assert.equal((await t.owner.request("DELETE", `/api/x/bandwidth-control/hold/${ban.data.hold.id}`)).status, 404, "it has already ended");
    const log = (await t.owner.get("/api/domain/bandwidth-control")).data.log.map((e) => e.event);
    assert.deepEqual(log.slice(0, 3), ["unban", "ban", "kick"]);
  } finally {
    await t.stop();
  }
});

test("bandwidth-control: disconnect sends the device off every Wi-Fi network once and keeps no rule", async () => {
  const t = await start();
  try {
    const out = await t.owner.post("/api/x/bandwidth-control/hold", { mac: PHONE, method: "disconnect" });
    assert.equal(out.status, 200, out.text);
    assert.equal(out.data.disconnected, PHONE);
    assert.ok(t.router.firewall.deauth.length >= 1 && t.router.firewall.deauth.every((m) => m === PHONE));
    assert.deepEqual((await t.owner.get("/api/domain/bandwidth-control")).data.holds, []);
  } finally {
    await t.stop();
  }
});

test("bandwidth-control: bad requests are refused and nothing reaches the router", async () => {
  const t = await start();
  try {
    const before = t.router.commands.length;
    for (const body of [{ mac: "nonsense", method: "pause", minutes: 15 }, { mac: TV, method: "explode", minutes: 15 }, { mac: TV, method: "pause", minutes: 7 }, { mac: `${TV}; reboot`, method: "pause", minutes: 15 }])
      assert.equal((await t.owner.post("/api/x/bandwidth-control/hold", body)).status, 400, JSON.stringify(body));
    assert.equal(t.router.commands.slice(before).some((c) => /iptables|deauth|reboot/.test(c)), false);
    const viewer = t.client();
    assert.equal((await viewer.post("/api/x/bandwidth-control/hold", { mac: TV, method: "pause", minutes: 15 })).status, 401, "signed-out people cannot kick");
  } finally {
    await t.stop();
  }
});

test("bandwidth-control: the Unkick page lifts only the visitor's own device, with no account", async () => {
  const t = await start();
  try {
    await t.owner.post("/api/x/bandwidth-control/hold", { mac: TV, name: "TV", method: "pause", minutes: 60, note: "Dinner" });
    await t.owner.post("/api/x/bandwidth-control/hold", { mac: PHONE, name: "Phone", method: "pause", ban: true });
    const exec = execOf(t);

    // The TV's own address sees its own pause, never the phone's.
    const seen = await selfService({ exec, ip: "198.51.100.101" });
    assert.equal(seen.found, true);
    assert.deepEqual(seen.holds.map((h) => [h.method, h.note, h.ban]), [["pause", "Dinner", false]]);
    assert.equal(JSON.stringify(seen).includes(PHONE), false, "nobody else's device is shown");
    assert.equal(JSON.stringify(seen).includes(TV), false, "not even its own address details");

    const lifted = await selfService({ exec, ip: "::ffff:198.51.100.101", lift: true });
    assert.equal(lifted.lifted, 1);
    assert.deepEqual(rules(t, "MAR_PAUSE"), [`-m mac --mac-source ${PHONE} -j DROP`], "only the visitor's rule is gone");

    // A ban is always self-liftable too.
    const unbanned = await selfService({ exec, ip: "198.51.100.102", lift: true });
    assert.equal(unbanned.lifted, 1);
    assert.deepEqual(rules(t, "MAR_PAUSE"), []);
    const log = (await t.owner.get("/api/domain/bandwidth-control")).data.log;
    assert.deepEqual(log.slice(0, 2).map((e) => [e.event, e.by]), [["unban", "the device itself"], ["unkick", "the device itself"]]);

    assert.deepEqual(await selfService({ exec, ip: "203.0.113.9" }), { found: false, reason: "device" }, "an unknown address finds nothing");
    assert.deepEqual(await selfService({ exec, ip: "not an address" }), { found: false, reason: "address" });

    // Over HTTP: no sign-in needed, and lifting needs the page's own header.
    const anonymous = t.client();
    const look = await anonymous.get("/api/unkick");
    assert.equal(look.status, 200, look.text);
    assert.equal(look.data.found, false, "the test connects from an address the router does not list");
    assert.equal((await anonymous.request("POST", "/api/unkick", {})).status, 403, "another website cannot press the button");
  } finally {
    await t.stop();
  }
});

test("bandwidth-control: the screen module, the Unkick page and their wording", async () => {
  assert.equal(checkFeatureModule(client, "bandwidth-control"), null);
  const t = (en) => en;
  assert.equal(minutesText(15, t), "15 min");
  assert.equal(minutesText(120, t), "2 h");
  assert.equal(untilText({ until: null }, t), "until lifted");
  assert.match(untilText({ until: Date.now() + 30 * 60000 }, t, Date.now()), /30 min left/);
  const page = await readFile(new URL("../../public/unkick.html", import.meta.url), "utf8");
  assert.doesNotMatch(page, /<script>|\son[a-z]+="/i, "no inline script, so the page works under the app's security policy");
  const js = await readFile(new URL("../../public/js/unkick.js", import.meta.url), "utf8");
  assert.match(js, /"x-unkick": "1"/);
  const screenSource = await readFile(new URL("../../public/js/features/bandwidth-control/index.js", import.meta.url), "utf8");
  assert.match(screenSource, /api\.del\(`\/api\/x\/bandwidth-control\/hold\//, "Unkick in the app uses the API helper's delete");
  assert.doesNotMatch(screenSource, /api\.delete\(/, "the API helper has no api.delete");
  assert.match(js, /never shows anyone else's devices/);
});
