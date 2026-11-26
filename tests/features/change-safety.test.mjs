// Change safety: impact levels, live mode, the local configuration history,
// undo and redo, the four-key confirmation, the reboot launch sequence and
// live progress. Everything runs against the pretend router.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { compileRegex, parseMessage } from "../../server/changes/history-repo.mjs";
import { impactOfAction, impactOfItem } from "../../server/changes/impact.mjs";
import { startApp, waitFor } from "../helpers.mjs";

const clockAt = () => ({ t: Date.now() });
const live = (t, changes, extra = {}) => t.owner.post("/api/changes/live", { changes, ...extra });
const history = async (t, query = "") => (await t.owner.get(`/api/safety/history${query}`)).data;

// The four keys, done properly: the server hands out what to acknowledge and type.
function proofFrom(begin, clock, { hold = 1600, wait = 2000 } = {}) {
  clock.t += wait;
  return { nonce: begin.nonce, ackPeople: begin.steps.acknowledge.people.map((p) => p.id), typed: begin.steps.typeName.shortName, holdMs: hold, chord: true };
}

test("change-safety: every entry and action has an impact level, and the hand-checked ones are right", async () => {
  const t = await startApp();
  try {
    const catalog = (await t.owner.get("/api/catalog")).data;
    for (const entry of catalog.entries) assert.ok([0, 1, 2, 3].includes(entry.impact.level), `${entry.id} has an impact`);
    const level = (key) => catalog.entries.find((e) => e.key === key).impact.level;
    assert.equal(level("ddns_hostname_x"), 0, "a dynamic DNS name changes nothing at home");
    assert.equal(level("time_zone"), 0);
    assert.equal(level("AllLED"), 1, "the LEDs are a small blip");
    assert.equal(level("wl0.1_bss_enabled"), 1, "the guest network is a small blip");
    assert.equal(level("wl0_ssid"), 2, "the Wi-Fi name drops everyone's Wi-Fi");
    assert.equal(level("wl0_wpa_psk"), 2);
    assert.equal(level("lan_ipaddr"), 3, "the router address makes devices reconnect by hand");
    assert.equal(level("wan_proto"), 3);

    const table = (await t.owner.get("/api/safety/impact")).data;
    assert.deepEqual(table.levels.map((l) => l.level), [0, 1, 2, 3]);
    assert.equal(table.actions.reboot, 3);
    assert.equal(table.actions.ping, 0);
    assert.equal(table.actions["install-key"], 0);
    assert.equal(table.entries["lan.ip"], 3);
    assert.equal(Object.keys(table.entries).length, catalog.entries.length, "every entry is in the table");
    for (const name of ["aimesh-pro.reboot-node", "example-uptime.mark"]) assert.ok(name in table.actions, `${name} is in the action table`);
    assert.equal(table.actions["aimesh-pro.reboot-node"], 3, "a destructive feature action is level 3");
    assert.equal(table.actions["example-uptime.mark"], 0);

    assert.equal(impactOfAction("restart-service", { body: { service: "restart_wireless" } }).level, 2);
    assert.equal(impactOfAction("restart-service", { body: { service: "restart_net_and_phy" } }).level, 3);
    assert.equal(impactOfItem({ key: "something_new", risk: "network" }).level, 1, "an unknown network setting is at least a blip");
    assert.equal(impactOfItem({ key: "something_new", risk: "destructive" }).level, 3);

    // A preview carries its impact, the short name to type and the reasons.
    const preview = (await t.owner.post("/api/changes/preview", { changes: [{ id: "wl0.ssid", value: "Harbour Home 2" }, { id: "ddns.host", value: "home.example.com" }] })).data;
    assert.equal(preview.impact.level, 2);
    assert.equal(preview.impact.reasons[0].key, "wl0_ssid");
    assert.equal(preview.shortName, preview.items.find((i) => i.key === "wl0_ssid").label.en);
    assert.deepEqual(preview.items.map((i) => i.impact), [2, 0]);
  } finally {
    await t.stop();
  }
});

test("change-safety: live mode is on by default, applies at once, and review mode keeps the preview step", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.get("/api/safety/settings")).data.liveMode, true);
    assert.equal((await t.owner.get("/api/settings")).data.liveMode, true);
    const applied = await live(t, [{ id: "qos.up", value: "25000" }]);
    assert.equal(applied.status, 200, applied.text);
    assert.equal(applied.data.status, "applied");
    assert.equal(applied.data.mode, "live");
    assert.ok(applied.data.runId);
    assert.equal(t.router.nvram.qos_obw, "25000");

    assert.equal((await t.owner.post("/api/settings", { liveMode: "yes" })).status, 400, "live mode is a plain on or off");
    assert.equal((await t.owner.post("/api/settings", { liveMode: false })).status, 200);
    assert.equal((await t.owner.get("/api/safety/settings")).data.liveMode, false);
    const refused = await live(t, [{ id: "qos.up", value: "26000" }]);
    assert.equal(refused.status, 409);
    assert.equal(refused.data.code, "LIVE_MODE_OFF");
    assert.equal(t.router.nvram.qos_obw, "25000", "review mode never writes by itself");

    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "qos.up", value: "26000" }] });
    const done = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
    assert.equal(done.data.status, "applied");
    assert.equal(done.data.mode, "review");
    const modes = (await history(t)).items.map((c) => c.mode);
    assert.deepEqual(modes.slice(0, 2), ["review", "live"]);

    await t.owner.post("/api/settings", { liveMode: true });
    const viewer = await t.owner.post("/api/users", { name: "Sam", username: "sam", password: "a long viewer password", role: "viewer" });
    assert.equal(viewer.status, 201);
    const sam = t.client();
    await sam.signIn("sam", "a long viewer password");
    assert.equal((await sam.post("/api/changes/live", { changes: [{ id: "qos.up", value: "27000" }] })).status, 403, "a viewer cannot change anything");
  } finally {
    await t.stop();
  }
});

test("change-safety: every applied change becomes a readable version in the local history, secrets masked", async () => {
  const clock = clockAt();
  const t = await startApp({ safety: { now: () => clock.t } });
  try {
    assert.equal((await history(t)).total, 0, "an empty history before the first change");
    assert.equal((await live(t, [{ id: "qos.up", value: "25000" }])).status, 200);
    clock.t += 60000;
    const password = "congee-with-century-egg-77";
    assert.equal((await live(t, [{ id: "wl0.password", value: password }])).status, 200);
    clock.t += 60000;
    assert.equal((await live(t, [{ id: "wl0.ssid", value: "Harbour Home 2" }, { id: "fw.ping", value: "1" }])).status, 200);

    const list = await history(t);
    assert.equal(list.total, 4, "a baseline plus three changes");
    const [third, second, first, baseline] = list.items;
    assert.equal(baseline.mode, "baseline");
    assert.equal(first.person, "Pat");
    assert.deepEqual([first.mode, first.source, first.impact, first.guard, first.keys, first.areas], ["live", "change", 1, "none", ["qos_obw"], ["qos"]]);
    assert.equal(second.guard, "confirmed", "a guarded change records what the guard did");
    assert.equal(second.impact, 2);
    assert.deepEqual(third.keys.sort(), ["misc_ping_x", "wl0_ssid"]);
    assert.deepEqual(third.areas.sort(), ["firewall", "wifi"]);
    assert.match(first.subject, /: 20000 -> 25000$/);
    assert.match(third.subject, /^2 settings changed/);
    assert.ok(first.changeId && first.runId, "the version points at the change and its live run");

    // The first change's diff has the OLD value even though the history only started after it.
    const diff = (await t.owner.get(`/api/safety/history/${first.oid}`)).data;
    assert.deepEqual(diff.changes.map((c) => [c.key, c.old, c.new, c.area]), [["qos_obw", "20000", "25000", "qos"]]);
    assert.equal(diff.changes[0].label.yue.length > 0, true);

    // A secret never appears; a diff still says it changed.
    const secretDiff = (await t.owner.get(`/api/safety/history/${second.oid}`)).data;
    assert.equal(secretDiff.changes.length, 1);
    assert.equal(secretDiff.changes[0].secret, true);
    assert.match(secretDiff.changes[0].new, /^•{4} secret #[0-9a-f]{8}$/);
    assert.notEqual(secretDiff.changes[0].old, secretDiff.changes[0].new);
    const repo = path.join(t.dir, "history", "router-config");
    const files = [];
    for (const dir of ["areas"]) for (const name of await readdir(path.join(repo, dir))) files.push(path.join(repo, dir, name));
    const text = (await Promise.all(files.map((f) => readFile(f, "utf8")))).join("\n");
    assert.ok(!text.includes(password) && !text.includes("milk-tea-and-egg-tarts"), "no secret in the snapshot files");
    assert.ok(text.includes('"key": "wl0_ssid"') && text.includes("Harbour Home 2") && text.includes('"yue"'), "readable, with raw keys and both labels");
    assert.ok(!JSON.stringify(list).includes(password) && !JSON.stringify(secretDiff).includes(password));

    // Filters.
    assert.equal((await history(t, "?area=wifi")).total, 2);
    assert.equal((await history(t, "?person=pat&mode=live")).total, 3);
    assert.equal((await history(t, "?person=nobody")).total, 0);
    assert.equal((await history(t, "?text=harbour")).total, 1);
    assert.equal((await history(t, "?regex=%5E2%20settings")).total, 1);
    assert.equal((await history(t, "?key=qos_obw")).total, 1);
    assert.equal((await history(t, "?impact=2")).total, 2);
    assert.equal((await history(t, `?since=${encodeURIComponent(new Date(clock.t - 90000).toISOString())}`)).total, 2);
    assert.equal((await history(t, `?until=${encodeURIComponent(new Date(clock.t - 90000).toISOString())}`)).total, 2);
    assert.equal((await history(t, "?limit=1&offset=1")).items[0].oid, second.oid);
    assert.equal((await t.owner.get("/api/safety/history?regex=%28a%2B%29%2B%24")).status, 400, "a pattern that can run for ever is refused");
    assert.equal((await t.owner.get("/api/safety/history?regex=%5B")).status, 400);
    assert.equal((await t.owner.get("/api/safety/history?since=yesterday")).status, 400);

    // The history of one setting, and any two versions side by side.
    const one = (await t.owner.get("/api/safety/history/setting?key=wl0_ssid")).data;
    assert.deepEqual(one.items.map((i) => [i.old, i.new]), [["Harbour Home", "Harbour Home 2"]]);
    assert.equal((await t.owner.get("/api/safety/history/setting?id=qos.up")).data.items.length, 1);
    const across = (await t.owner.get(`/api/safety/history/diff?a=${baseline.oid}&b=${third.oid}`)).data;
    assert.deepEqual(across.changes.map((c) => c.key).sort(), ["misc_ping_x", "qos_obw", "wl0_ssid", "wl0_wpa_psk"]);

    // Bookmarks.
    const mark = await t.owner.post("/api/safety/history/bookmarks", { oid: first.oid, label: "Before the Wi-Fi work", note: "known good" });
    assert.equal(mark.status, 201, mark.text);
    assert.equal((await history(t)).items.find((c) => c.oid === first.oid).bookmarks[0].label, "Before the Wi-Fi work");
    assert.equal((await t.owner.get("/api/safety/history/bookmarks")).data.items.length, 1);
    assert.equal((await t.owner.post("/api/safety/history/bookmarks", { oid: first.oid, label: "" })).status, 400);
    assert.equal((await t.owner.request("DELETE", `/api/safety/history/bookmarks/${mark.data.id}`)).status, 200);
    assert.equal((await t.owner.get("/api/safety/history/bookmarks")).data.items.length, 0);

    // Statistics and export.
    const stats = (await t.owner.get("/api/safety/history/stats")).data;
    assert.equal(stats.total, 4);
    assert.equal(stats.perPerson[0].person, "Pat");
    assert.ok(stats.mostChanged.some((m) => m.key === "wl0_ssid" && m.count === 1));
    assert.equal(stats.perImpact[2].count, 2);
    assert.ok(stats.perDay.length >= 1);
    const json = await t.owner.get("/api/safety/history/export");
    assert.equal(json.status, 200);
    assert.equal(json.data.commits.length, 4);
    const csv = await t.owner.get("/api/safety/history/export?format=csv");
    assert.match(csv.headers.get("content-type"), /text\/csv/);
    assert.match(csv.text, /^version,date,person,mode/);
    assert.ok(!csv.text.includes(password));

    // Restore one setting, then everything, each through preview and guard.
    const one2 = await t.owner.post("/api/safety/history/restore", { oid: baseline.oid, key: "wl0_ssid", apply: true });
    assert.equal(one2.status, 200, one2.text);
    assert.equal(one2.data.applied.status, "applied");
    assert.equal(one2.data.applied.guard.seconds > 0, true, "a Wi-Fi restore is guarded");
    assert.equal(t.router.nvram.wl0_ssid, "Harbour Home");
    const all = await t.owner.post("/api/safety/history/restore", { oid: baseline.oid, all: true, apply: true });
    assert.equal(all.status, 200, all.text);
    assert.equal(t.router.nvram.qos_obw, "20000");
    assert.equal(t.router.nvram.misc_ping_x, "0");
    assert.equal(t.router.nvram.wl0_wpa_psk, password, "a secret is never restored from the history");
    assert.ok(all.data.skipped.some((s) => s.key === "wl0_wpa_psk"), "and the answer says so");
    assert.equal((await t.owner.post("/api/safety/history/restore", { oid: baseline.oid, all: true })).status, 400, "nothing left to restore");
    const restores = (await history(t, "?source=restore")).items;
    assert.equal(restores.length, 2);
    assert.match(restores[0].subject, /^Restore: /);
    // Without apply, restore only previews.
    t.router.nvram.qos_obw = "1";
    const dry = await t.owner.post("/api/safety/history/restore", { oid: baseline.oid, key: "qos_obw" });
    assert.equal(dry.status, 200);
    assert.equal(dry.data.preview.items[0].new, "20000");
    assert.equal(t.router.nvram.qos_obw, "1");
    // A version that does not exist.
    assert.equal((await t.owner.get("/api/safety/history/deadbeef0")).status, 404);
    assert.equal((await t.owner.get("/api/safety/history/not-an-id")).status, 400);
  } finally {
    await t.stop();
  }
});

test("change-safety: the history message and pattern helpers", () => {
  const parsed = parseMessage("Subject line\n\n- body one\n- body two\n\nMode: live\nImpact: 2\nKeys: a,b");
  assert.deepEqual([parsed.subject, parsed.trailers.mode, parsed.trailers.impact, parsed.trailers.keys], ["Subject line", "live", "2", "a,b"]);
  assert.match(parsed.body, /body one/);
  assert.equal(parseMessage("Just a subject").subject, "Just a subject");
  assert.equal(compileRegex(""), null);
  assert.throws(() => compileRegex("x".repeat(300)), /longer/);
  assert.throws(() => compileRegex("(a+)+$"), /too long/);
  assert.ok(compileRegex("^wi-?fi").test("Wi-Fi"));
});

test("change-safety: undo and redo are a stack for each person, and every one is recorded", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/safety/undo", {})).data.code, "STACK_EMPTY");
    await live(t, [{ id: "qos.up", value: "25000" }]);
    await live(t, [{ id: "fw.ping", value: "1" }]);
    const state = (await t.owner.get("/api/safety/undo-state")).data;
    assert.equal(state.undo.length, 2);
    assert.equal(state.undo[0].items[0].key, "misc_ping_x", "the newest change is on top");
    assert.equal(state.redo.length, 0);

    const undone = await t.owner.post("/api/safety/undo", {});
    assert.equal(undone.status, 200, undone.text);
    assert.equal(undone.data.status, "applied");
    assert.equal(t.router.nvram.misc_ping_x, "0");
    assert.equal(t.router.nvram.qos_obw, "25000");
    assert.match((await history(t)).items[0].subject, /^Undo: /);
    assert.equal((await history(t)).items[0].source, "undo");
    let after = (await t.owner.get("/api/safety/undo-state")).data;
    assert.deepEqual([after.undo.length, after.redo.length], [1, 1]);

    const redone = await t.owner.post("/api/safety/redo", {});
    assert.equal(redone.data.status, "applied");
    assert.equal(t.router.nvram.misc_ping_x, "1");
    assert.match((await history(t)).items[0].subject, /^Redo: /);
    after = (await t.owner.get("/api/safety/undo-state")).data;
    assert.deepEqual([after.undo.length, after.redo.length], [2, 0]);

    // Undo twice, and a new change throws the redo stack away.
    await t.owner.post("/api/safety/undo", {});
    await t.owner.post("/api/safety/undo", {});
    assert.equal(t.router.nvram.qos_obw, "20000");
    assert.equal((await t.owner.get("/api/safety/undo-state")).data.redo.length, 2);
    await live(t, [{ id: "qos.down", value: "250000" }]);
    assert.equal((await t.owner.get("/api/safety/undo-state")).data.redo.length, 0);
    assert.equal((await t.owner.post("/api/safety/redo", {})).data.code, "STACK_EMPTY");

    // Review mode only previews; the preview is then applied like any other.
    await t.owner.post("/api/settings", { liveMode: false });
    const preview = await t.owner.post("/api/safety/undo", {});
    assert.equal(preview.status, 200);
    assert.ok(preview.data.id && preview.data.items.length === 1 && !preview.data.status, "a preview, not a result");
    assert.equal(t.router.nvram.qos_ibw, "250000", "nothing was written yet");
    const finished = await t.owner.post("/api/safety/undo", { previewId: preview.data.id });
    assert.equal(finished.data.status, "applied");
    assert.equal(t.router.nvram.qos_ibw, "300000");

    // Another person has a stack of their own.
    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "a long operator password", role: "operator" });
    const alex = t.client();
    await alex.signIn("alex", "a long operator password");
    assert.equal((await alex.get("/api/safety/undo-state")).data.undo.length, 0);
    assert.equal((await alex.post("/api/safety/undo", {})).data.code, "STACK_EMPTY");
  } finally {
    await t.stop();
  }
});

test("change-safety: the four-key confirmation is checked by the server, step by step", async () => {
  const clock = clockAt();
  const t = await startApp({ safety: { fourKey: true, now: () => clock.t } });
  try {
    // The household chose "no disturbance at all", so every change above Level 0 takes the keys.
    assert.equal((await t.owner.request("PUT", "/api/household", { madness: 0 })).status, 200);
    // Impact 0 needs no keys at all.
    assert.equal((await live(t, [{ id: "ddns.host", value: "home.example.com" }])).status, 200);

    // Impact 1 or more: the answer says which keys, and nothing was written.
    const first = await live(t, [{ id: "qos.up", value: "25000" }]);
    assert.equal(first.status, 428);
    assert.equal(first.data.code, "CONFIRM_REQUIRED");
    assert.equal(t.router.nvram.qos_obw, "20000");
    const { previewId, confirmation: begin } = first.data.detail;
    assert.ok(previewId && begin.nonce);
    assert.equal(begin.steps.hold.minMs, 1500);
    assert.equal(begin.steps.chord.keys, "Ctrl+Shift+Enter");
    assert.equal(begin.steps.acknowledge.people[0].name, "Your brother");
    assert.equal(begin.steps.typeName.shortName, "Upload speed");
    assert.ok(begin.yue === undefined && first.data.yue.length > 0, "the refusal carries a Cantonese line too");

    const good = proofFrom(begin, clock);
    const attempt = (changes) => t.owner.post("/api/changes/live", { previewId, confirmation: { ...good, ...changes } });
    for (const [broken, code] of [
      [{ ackPeople: [] }, "CONFIRM_ACK"],
      [{ typed: "upload bandwidth" }, "CONFIRM_TYPED"],
      [{ typed: "" }, "CONFIRM_TYPED"],
      [{ holdMs: 1499 }, "CONFIRM_HOLD"],
      [{ holdMs: 60000 }, "CONFIRM_HOLD"],
      [{ holdMs: "long" }, "CONFIRM_HOLD"],
      [{ chord: false }, "CONFIRM_CHORD"],
      [{ chord: undefined }, "CONFIRM_CHORD"],
      [{ nonce: "made-up" }, "CONFIRM_NONCE"],
    ]) {
      const res = await attempt(broken);
      assert.equal(res.status, 403, `${code}: ${res.text}`);
      assert.equal(res.data.code, code);
      assert.equal(t.router.nvram.qos_obw, "20000", `${code} wrote nothing`);
    }
    // A missing proof is a different answer from a wrong one.
    assert.equal((await t.owner.post("/api/changes/live", { previewId })).status, 428);

    // Someone else cannot use the nonce.
    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "a long operator password", role: "operator" });
    const alex = t.client();
    await alex.signIn("alex", "a long operator password");
    assert.equal((await alex.post("/api/changes/live", { previewId, confirmation: good })).status >= 400, true);

    const done = await attempt({});
    assert.equal(done.status, 200, done.text);
    assert.equal(done.data.status, "applied");
    assert.equal(t.router.nvram.qos_obw, "25000");
    assert.equal((await attempt({})).status, 410, "a preview is used once");

    // A nonce is for one change only.
    const other = await live(t, [{ id: "fw.ping", value: "1" }]);
    const reuse = await t.owner.post("/api/changes/live", { previewId: other.data.detail.previewId, confirmation: good });
    assert.equal(reuse.data.code, "CONFIRM_NONCE");

    // The review-mode route is guarded the same way, and begin tells the screen what to show.
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "wl0.ssid", value: "Harbour Home 2" }] });
    assert.equal(preview.data.confirmation.required, true);
    assert.equal(preview.data.impact.level, 2);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).data.code, "CONFIRM_REQUIRED");
    const begun = (await t.owner.post("/api/safety/confirm/begin", { previewId: preview.data.id })).data;
    assert.equal(begun.required, true);
    const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id, confirmation: proofFrom(begun, clock) });
    assert.equal(applied.status, 200, applied.text);
    assert.equal(t.router.nvram.wl0_ssid, "Harbour Home 2");
    assert.equal((await t.owner.post("/api/safety/confirm/begin", { previewId: (await t.owner.post("/api/changes/preview", { changes: [{ id: "ddns.host", value: "x.example.com" }] })).data.id })).data.required, false);

    // Undo is a change too.
    const undo = await t.owner.post("/api/safety/undo", {});
    assert.equal(undo.data.code, "CONFIRM_REQUIRED");
    const undoDone = await t.owner.post("/api/safety/undo", { previewId: undo.data.detail.previewId, confirmation: proofFrom(undo.data.detail.confirmation, clock) });
    assert.equal(undoDone.data.status, "applied");

    // Actions with an impact need the keys too; the others do not.
    assert.equal((await t.owner.post("/api/actions/ping", { host: "example.com" })).status, 200);
    const restart = await t.owner.post("/api/actions/restart-service", { service: "restart_wireless" });
    assert.equal(restart.status, 428);
    const actionBegin = (await t.owner.post("/api/safety/confirm/begin", { action: "restart-service", body: { service: "restart_wireless" } })).data;
    assert.equal(actionBegin.impact, 2);
    assert.equal(actionBegin.steps.typeName.shortName, "Restart wireless");
    const ran = await t.owner.post("/api/actions/restart-service", { service: "restart_wireless", confirmation: proofFrom(actionBegin, clock) });
    assert.equal(ran.status, 200, ran.text);
    assert.ok(t.router.services.includes("restart_wireless"));
    const featureAction = await t.owner.post("/api/actions/aimesh-pro.reboot-node", { mac: "04:D9:F5:77:88:90", confirm: "RT-AX86U", hold: true });
    assert.equal(featureAction.status, 428, "a feature action with impact is gated as well");
  } finally {
    await t.stop();
  }
});

test("change-safety: a reboot only goes out through the launch sequence", async () => {
  const clock = clockAt();
  const t = await startApp({ safety: { fourKey: true, launch: true, now: () => clock.t, countdownMs: 10000, rebootPollMs: 40 } });
  try {
    t.router.rebootMs = 600;
    const direct = await t.owner.post("/api/actions/reboot", { confirm: "RT-AX86U", hold: true });
    assert.equal(direct.status, 403);
    assert.equal(direct.data.code, "LAUNCH_REQUIRED");
    assert.equal(t.router.rebooted, undefined);

    // The sequence itself starts only with the four keys.
    assert.equal((await t.owner.post("/api/safety/launch/begin", {})).data.code, "CONFIRM_REQUIRED");
    const begin = async () => {
      const b = (await t.owner.post("/api/safety/confirm/begin", { action: "reboot" })).data;
      assert.equal(b.impact, 3);
      const res = await t.owner.post("/api/safety/launch/begin", { confirmation: proofFrom(b, clock) });
      assert.equal(res.status, 201, res.text);
      return res.data;
    };
    const step = (id, name, body) => t.owner.post(`/api/safety/launch/${id}/${name}`, body ?? {});

    // Out of order, a wrong code, keys not held together, a countdown not finished: all refused.
    let seq = await begin();
    assert.equal(seq.state, "covered");
    assert.equal((await step(seq.id, "arm")).data.code, "LAUNCH_ORDER");
    assert.equal((await step(seq.id, "launch")).data.code, "LAUNCH_ORDER");
    assert.equal((await step(seq.id, "open-cover")).data.state, "cover-open");
    assert.equal((await step(seq.id, "open-cover")).data.code, "LAUNCH_ORDER");
    const armed = (await step(seq.id, "arm")).data;
    assert.match(armed.code, /^[A-Z2-9]{6}$/);
    assert.equal((await step(seq.id, "keys-ready")).data.code, "LAUNCH_ORDER", "the code has not been typed yet");
    const wrong = await step(seq.id, "code", { code: "WRONG1" });
    assert.equal(wrong.data.code, "LAUNCH_CODE");
    assert.equal(wrong.data.detail.attemptsLeft, 2);
    assert.equal((await step(seq.id, "code", { code: armed.code.toLowerCase() })).data.state, "code-ok");
    assert.equal((await step(seq.id, "keys-ready")).data.code, "LAUNCH_KEYS", "no key is down");
    await step(seq.id, "key", { key: 1, state: "down" });
    assert.equal((await step(seq.id, "keys-ready")).data.code, "LAUNCH_KEYS", "one key is not two");
    await step(seq.id, "key", { key: 2, state: "down" });
    assert.equal((await step(seq.id, "keys-ready")).data.code, "LAUNCH_KEYS", "together, but not for long enough");
    await step(seq.id, "key", { key: 1, state: "up" });
    clock.t += 2000;
    assert.equal((await step(seq.id, "keys-ready")).data.code, "LAUNCH_KEYS", "one key was let go");
    await step(seq.id, "key", { key: 1, state: "down" });
    clock.t += 1000;
    assert.equal((await step(seq.id, "keys-ready")).data.state, "keys-held");
    assert.equal((await step(seq.id, "launch")).data.code, "LAUNCH_ORDER", "the countdown has not started");
    const counting = (await step(seq.id, "countdown")).data;
    assert.equal(counting.countdownLeftMs, 10000);
    clock.t += 4000;
    const early = await step(seq.id, "launch");
    assert.equal(early.data.code, "LAUNCH_TOO_EARLY");
    assert.ok(early.data.detail.leftMs <= 6000);
    assert.equal((await t.owner.get(`/api/safety/launch/${seq.id}`)).data.countdownLeftMs, 6000);
    // Abort in the middle of the countdown: that launch is dead.
    assert.equal((await step(seq.id, "abort")).data.state, "aborted");
    clock.t += 20000;
    assert.equal((await step(seq.id, "launch")).data.code, "LAUNCH_ABORTED");
    assert.equal(t.router.rebooted, undefined, "nothing was sent");

    // Three wrong codes abort the launch.
    seq = await begin();
    await step(seq.id, "open-cover");
    await step(seq.id, "arm");
    for (let i = 0; i < 2; i += 1) assert.equal((await step(seq.id, "code", { code: "NOPE00" })).data.code, "LAUNCH_CODE");
    assert.equal((await step(seq.id, "code", { code: "NOPE00" })).data.code, "LAUNCH_CODE");
    assert.equal((await step(seq.id, "code", { code: "NOPE00" })).data.code, "LAUNCH_ABORTED");

    // Somebody else cannot take over a launch.
    seq = await begin();
    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "a long operator password", role: "operator" });
    const alex = t.client();
    await alex.signIn("alex", "a long operator password");
    assert.equal((await alex.post(`/api/safety/launch/${seq.id}/open-cover`)).status, 404);
    await step(seq.id, "abort");

    // The whole sequence, start to finish.
    seq = await begin();
    await step(seq.id, "open-cover");
    const code = (await step(seq.id, "arm")).data.code;
    await step(seq.id, "code", { code });
    await step(seq.id, "key", { key: 1, state: "down" });
    await step(seq.id, "key", { key: 2, state: "down" });
    clock.t += 900;
    await step(seq.id, "keys-ready");
    await step(seq.id, "countdown");
    clock.t += 10000;
    const fired = await step(seq.id, "launch");
    assert.equal(fired.status, 200, fired.text);
    assert.equal(fired.data.state, "launched");
    const runId = fired.data.runId;
    const run = await waitFor(async () => {
      const r = (await t.owner.get(`/api/safety/runs/${runId}`)).data;
      return r.finishedAt ? r : null;
    });
    assert.equal(run.status, "done", JSON.stringify(run.steps));
    assert.deepEqual(run.steps.map((s) => [s.key, s.state]), [["send", "done"], ["down", "done"], ["up", "done"], ["back", "done"]]);
    assert.ok(run.steps.every((s) => s.label.en && s.label.yue && s.at));
    assert.match(run.steps[3].detail, /settings read back/);
    assert.equal(t.router.rebootCount, 1);
    assert.equal((await t.owner.get("/api/catalog")).status, 200, "the app talks to the router again");
    assert.equal((await step(seq.id, "launch")).data.code, "LAUNCH_DONE");
  } finally {
    await t.stop();
  }
});

test("change-safety: a running change streams its steps until it is really finished", async () => {
  const t = await startApp();
  try {
    const applied = await live(t, [{ id: "wl0.ssid", value: "Harbour Home 2" }]);
    assert.equal(applied.status, 200, applied.text);
    const run = (await t.owner.get(`/api/safety/runs/${applied.data.runId}`)).data;
    assert.equal(run.status, "done");
    assert.deepEqual(run.steps.map((s) => s.key), ["check", "guard", "write", "commit", "service:restart_wireless", "readback"]);
    assert.ok(run.steps.every((s) => s.state === "done"));
    assert.equal((await t.owner.get("/api/safety/runs")).data.items[0].id, applied.data.runId);

    // The stream replays what happened and closes when the run is over.
    const res = await fetch(`${t.base}/api/safety/runs/${applied.data.runId}/events`, { headers: { Cookie: t.owner.cookie } });
    assert.match(res.headers.get("content-type"), /text\/event-stream/);
    const text = await res.text();
    assert.match(text, /^event: run\n/);
    assert.equal((text.match(/event: step/g) ?? []).length, 6);
    assert.match(text, /event: end\ndata: \{"status":"done"/);
    assert.equal((await fetch(`${t.base}/api/safety/runs/nope/events`, { headers: { Cookie: t.owner.cookie } })).status, 404);
    assert.equal((await t.client().get(`/api/safety/runs/${applied.data.runId}`)).status, 401);

    // A stream opened before the run ends gets the steps as they happen.
    t.router.guardScale = 0.05;
    const slow = await t.owner.post("/api/changes/preview", { changes: [{ id: "lan.ip", value: "198.51.100.2" }] });
    const slowApply = t.owner.post("/api/changes/apply", { previewId: slow.data.id });
    const record = (await slowApply).data;
    assert.equal(record.status, "guarded", "the router became unreachable");
    const stream = await fetch(`${t.base}/api/safety/runs/${record.runId}/events`, { headers: { Cookie: t.owner.cookie } });
    const body = await stream.text();
    assert.match(body, /event: step\ndata: \{[^\n]*"key":"wait"/, "waiting for the router shows up");
    assert.match(body, /event: end\ndata: \{"status":"failed"/, "the safety timer put the old address back, so the run did not succeed");
    assert.equal((await t.owner.get(`/api/changes/history/${record.id}`)).data.status, "reverted-by-guard");
  } finally {
    await t.stop();
  }
});
