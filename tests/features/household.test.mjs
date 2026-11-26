// The household: people, a weekly schedule, "most brother madness allowed",
// presence from the home Wi-Fi client list and Home Assistant, the allowance
// check, the owner's override, and quiet apply. The pretend router answers
// the Wi-Fi client list from router.assoc, and a small local server stands in
// for Home Assistant.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { test } from "node:test";
import { currentBlock, defaultMember, memberAllowance } from "../../server/changes/household.mjs";
import { presenceOf } from "../../server/changes/homeassistant.mjs";
import { startApp } from "../helpers.mjs";

const PHONE = "F0:18:98:AA:BB:01";
const LAPTOP = "3C:22:FB:10:20:30";
const BAND_5G = "eth7";
// Wednesday 25 November 2026 at the given local time.
const at = (h, m = 0, day = 25) => new Date(2026, 10, day, h, m).getTime();
const patch = (t, body, id = "brother") => t.owner.request("PATCH", `/api/household/members/${id}`, body);
const live = (t, changes, extra = {}) => t.owner.post("/api/changes/live", { changes, ...extra });

async function fakeHomeAssistant(token = "ha-long-lived-token") {
  const states = new Map([
    ["person.pat", { state: "home", name: "Pat" }],
    ["binary_sensor.front_door", { state: "off", name: "Front door" }],
    ["light.kitchen", { state: "on", name: "Kitchen light" }],
  ]);
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(req.url);
    if (req.headers.authorization !== `Bearer ${token}`) return res.writeHead(401).end("{}");
    const one = /^\/api\/states\/([a-z_]+\.[a-z0-9_]+)$/.exec(req.url);
    if (req.url === "/api/states") return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify([...states].map(([entity_id, s]) => ({ entity_id, state: s.state, attributes: { friendly_name: s.name, latitude: 22.3, longitude: 114.1 } }))));
    if (one && states.has(one[1])) return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ entity_id: one[1], state: states.get(one[1]).state, attributes: { latitude: 22.3 } }));
    res.writeHead(404).end("{}");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { states, requests, url: `http://127.0.0.1:${server.address().port}`, token, close: () => new Promise((r) => server.close(r)) };
}

test("household: a default person, presets, and the allowance rules in plain numbers", () => {
  const member = { ...defaultMember(), schedule: [{ id: "w", days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00", kind: "work", allowance: null }, { id: "s", days: [0, 1, 2, 3, 4, 5, 6], from: "23:00", to: "07:00", kind: "sleep", allowance: null }] };
  assert.equal(member.name, "Your brother");
  assert.equal(member.nameYue, "你兄弟");
  const wed = (h, m = 0) => new Date(at(h, m));
  assert.equal(currentBlock(member, 1, wed(10)).kind, "work");
  assert.equal(currentBlock(member, 1, wed(20)).kind, "home");
  assert.equal(currentBlock(member, 1, wed(23, 30)).kind, "sleep", "an overnight block covers the evening");
  assert.equal(currentBlock(member, 1, wed(3)).kind, "sleep", "and the early morning of the next day");
  assert.equal(currentBlock(member, 1, new Date(at(3, 0, 28))).kind, "sleep", "also on a Saturday morning");
  // Home: the lower of the block and the home allowance. Away: the higher of the block and the away allowance.
  assert.equal(memberAllowance(member, "home", 1, wed(10)).allowed, 1, "at work on paper, but at home: madness 1 wins");
  assert.equal(memberAllowance(member, "away", 1, wed(10)).allowed, 3);
  assert.equal(memberAllowance(member, "home", 2, wed(10)).allowed, 2);
  assert.equal(memberAllowance(member, "home", 1, wed(23, 30)).allowed, 0, "asleep at home");
  assert.equal(memberAllowance(member, "away", 1, wed(23, 30)).allowed, 3, "asleep on paper but away");
  assert.equal(memberAllowance(member, "unknown", 1, wed(23, 30)).allowed, 0, "unknown is treated as at home");
  assert.equal(memberAllowance({ ...member, awayAllowance: 1 }, "away", 0, wed(23, 30)).allowed, 1);
  assert.match(memberAllowance(member, "home", 1, wed(23, 30)).reason.yue, /你兄弟/);

  assert.equal(presenceOf("person", "home"), "home");
  assert.equal(presenceOf("person", "Work"), "away", "any other zone is away");
  assert.equal(presenceOf("binary_sensor", "on"), "home");
  assert.equal(presenceOf("binary_sensor", "off"), "away");
  assert.equal(presenceOf("person", "unavailable"), "unknown");
});

test("household: nobody is protected until a person has a device or an entity, and only the owner edits", async () => {
  const t = await startApp();
  try {
    const view = (await t.owner.get("/api/household")).data;
    assert.equal(view.madness, 1);
    assert.equal(view.members.length, 1);
    assert.equal(view.members[0].name, "Your brother");
    assert.equal(view.presets.length >= 3 && /my brother/i.test(view.presets[0].label.en), true, "preset copy may say my brother");
    assert.equal(view.ha.hasToken, false);
    let allowance = (await t.owner.get("/api/household/allowance")).data;
    assert.deepEqual([allowance.configured, allowance.allowed], [false, 3], "no one set up, so everything is allowed");
    assert.equal((await live(t, [{ id: "wl0.ssid", value: "Harbour Home 2" }])).status, 200, "a level 2 change goes through with nobody set up");

    const devices = (await t.owner.get("/api/household/devices")).data.devices;
    assert.ok(devices.some((d) => d.mac === PHONE && d.name === "Pats-iPhone" && d.wireless));
    assert.equal((await patch(t, { devices: [{ mac: "nonsense" }] })).status, 400);
    assert.equal((await patch(t, { name: "" })).status, 400);
    assert.equal((await patch(t, { allowances: { work: 7 } })).status, 400);
    assert.equal((await patch(t, { schedule: [{ days: [], from: "09:00", to: "18:00", kind: "work" }] })).status, 400);
    assert.equal((await patch(t, { schedule: [{ days: [1], from: "9am", to: "18:00", kind: "work" }] })).status, 400);
    assert.equal((await patch(t, { schedule: [{ days: [1], from: "09:00", to: "18:00", kind: "party" }] })).status, 400);
    const saved = await patch(t, { name: "Your brother", devices: [{ mac: PHONE.toLowerCase(), label: "Brother's phone" }], schedule: [{ days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00", kind: "work" }] });
    assert.equal(saved.status, 200, saved.text);
    assert.equal(saved.data.devices[0].mac, PHONE, "stored in capitals");
    assert.equal((await t.owner.get("/api/household/allowance")).data.configured, true);

    const added = await t.owner.post("/api/household/members", { name: "Grandma", nameYue: "嫲嫲" });
    assert.equal(added.status, 201);
    assert.equal((await t.owner.get("/api/household")).data.members.length, 2);
    assert.equal((await t.owner.request("DELETE", `/api/household/members/${added.data.id}`)).status, 200);
    assert.equal((await t.owner.request("DELETE", "/api/household/members/nobody")).status, 404);
    assert.equal((await t.owner.request("PUT", "/api/household", { madness: 5 })).status, 400);
    assert.equal((await t.owner.request("PUT", "/api/household", { madness: 2 })).data.madness, 2);

    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "a long operator password", role: "operator" });
    await t.owner.post("/api/users", { name: "Sam", username: "sam", password: "a long viewer password", role: "viewer" });
    const alex = t.client();
    await alex.signIn("alex", "a long operator password");
    const sam = t.client();
    await sam.signIn("sam", "a long viewer password");
    assert.equal((await alex.get("/api/household")).status, 200, "an operator can look");
    assert.equal((await alex.request("PATCH", "/api/household/members/brother", { name: "Mine" })).data.code, "OWNER_ONLY");
    assert.equal((await alex.request("PUT", "/api/household", { madness: 3 })).status, 403);
    assert.equal((await sam.request("PATCH", "/api/household/members/brother", { name: "Mine" })).status, 403);
    assert.equal((await t.client().get("/api/household")).status, 401);
  } finally {
    await t.stop();
  }
});

test("household: presence comes only from the Wi-Fi client list, per network, and nothing is kept", async () => {
  const t = await startApp({ safety: { now: () => at(10) } });
  try {
    await patch(t, { devices: [{ mac: PHONE, label: "Phone" }, { mac: LAPTOP, label: "Laptop" }] });
    t.router.assoc = { eth6: [], [BAND_5G]: [PHONE] };
    let presence = (await t.owner.get("/api/household/presence")).data;
    assert.equal(presence.members[0].state, "home");
    assert.deepEqual(presence.members[0].sources[0].devices, [{ mac: PHONE, label: "Phone", network: "Harbour Home 5G" }]);
    assert.deepEqual(presence.networks.map((n) => [n.ifname, n.clients]), [["eth6", 0], ["eth7", 1]]);
    t.router.assoc = {};
    assert.equal((await t.owner.get("/api/household/presence")).data.members[0].state, "away");

    // Only the router's Wi-Fi client list is asked: no ping, no address tables, no leases.
    t.router.commands.length = 0;
    await t.owner.get("/api/household/presence");
    await t.owner.get("/api/household/allowance");
    const asked = t.router.commands.filter((c) => !c.startsWith("nvram"));
    assert.ok(asked.length >= 1 && asked.every((c) => /^wl -i [a-z0-9.]+ assoclist$/.test(c)), `only Wi-Fi client lists were read: ${asked.join(" | ")}`);
    assert.ok(!t.router.commands.some((c) => /ping|arp|dnsmasq\.leases|traceroute/.test(c)));

    // A guest network is not a home network unless asked for; the list shows which are.
    const networks = (await t.owner.get("/api/household/networks")).data.networks;
    assert.deepEqual(networks.map((n) => [n.ifname, n.home]), [["eth6", true], ["eth7", true]]);
    assert.equal((await t.owner.request("PUT", "/api/household", { homeNetworks: { guest: false, picked: ["eth6"] } })).status, 200);
    t.router.assoc = { eth6: [], [BAND_5G]: [PHONE] };
    assert.equal((await t.owner.get("/api/household/presence")).data.members[0].state, "away", "the phone is on a network the owner did not pick");
    assert.equal((await t.owner.request("PUT", "/api/household", { homeNetworks: { picked: ["; rm -rf /"] } })).status, 400);

    // Nothing about presence was written down.
    const state = await readFile(path.join(t.dir, "state.json"), "utf8");
    assert.ok(!/presence|"state": "(home|away)"|assoc/i.test(state), "the saved state holds no presence");
  } finally {
    await t.stop();
  }
});

test("household: the allowance refuses a change that is too much right now, checked again when it is applied", async () => {
  const clock = { t: at(23, 30) };
  const t = await startApp({ safety: { now: () => clock.t } });
  try {
    await patch(t, { devices: [{ mac: PHONE, label: "Phone" }], schedule: [{ days: [0, 1, 2, 3, 4, 5, 6], from: "23:00", to: "07:00", kind: "sleep" }, { days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00", kind: "work" }] });
    t.router.assoc = { eth6: [], [BAND_5G]: [PHONE] };

    // Asleep at home: allowed 0, so a small blip is refused with the reason.
    let allowance = (await t.owner.get("/api/household/allowance")).data;
    assert.equal(allowance.allowed, 0);
    assert.equal(allowance.limitedBy, "brother");
    assert.equal(allowance.people[0].block.kind, "sleep");
    const refused = await live(t, [{ id: "qos.up", value: "25000" }]);
    assert.equal(refused.status, 403);
    assert.equal(refused.data.code, "ALLOWANCE");
    assert.equal(refused.data.detail.allowed, 0);
    assert.equal(refused.data.detail.people[0].name, "Your brother");
    assert.match(refused.data.detail.people[0].reason.yue, /你兄弟/);
    assert.ok(refused.data.detail.previewId, "the preview is kept so the owner can override it");
    assert.equal(t.router.nvram.qos_obw, "20000");
    assert.equal((await live(t, [{ id: "ddns.host", value: "home.example.com" }])).status, 200, "level 0 is always allowed");
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "qos.up", value: "25000" }] });
    assert.equal(preview.data.allowance.ok, false, "the preview already says so");
    assert.equal(preview.data.allowance.allowed, 0);

    // An operator cannot override; the owner can, and it is written in the history.
    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "a long operator password", role: "operator" });
    const alex = t.client();
    await alex.signIn("alex", "a long operator password");
    const alexTry = await alex.post("/api/changes/live", { previewId: refused.data.detail.previewId, override: true });
    assert.equal(alexTry.data.code, "OVERRIDE_OWNER");
    const overridden = await live(t, [{ id: "qos.up", value: "25000" }], { override: true });
    assert.equal(overridden.status, 200, overridden.text);
    assert.equal(overridden.data.override, "allowance: level 1 above 0");
    const top = (await t.owner.get("/api/safety/history")).data.items[0];
    assert.equal(top.override, "allowance: level 1 above 0");
    assert.ok(!JSON.stringify(top).includes(PHONE), "the history says an override happened, not who was home");

    // Away and awake: the same level 2 change is fine. Rechecked at apply time, though.
    t.router.assoc = {};
    const awayPreview = await t.owner.post("/api/changes/preview", { changes: [{ id: "wl0.ssid", value: "Harbour Home 3" }] });
    assert.equal(awayPreview.data.allowance.ok, true);
    t.router.assoc = { eth6: [], [BAND_5G]: [PHONE] };
    const late = await t.owner.post("/api/changes/apply", { previewId: awayPreview.data.id });
    assert.equal(late.status, 403, "he came home between the preview and the apply");
    assert.equal(late.data.code, "ALLOWANCE");
    assert.notEqual(t.router.nvram.wl0_ssid, "Harbour Home 3");
    t.router.assoc = {};
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: awayPreview.data.id })).status, 200);
    assert.equal(t.router.nvram.wl0_ssid, "Harbour Home 3");

    // At home on a weekday morning: the work block is generous, but madness 1 still caps it.
    clock.t = at(10);
    t.router.assoc = { eth6: [], [BAND_5G]: [PHONE] };
    assert.equal((await t.owner.get("/api/household/allowance")).data.allowed, 1);
    assert.equal((await live(t, [{ id: "qos.down", value: "250000" }])).status, 200, "level 1 fits");
    assert.equal((await live(t, [{ id: "wl0.ssid", value: "Harbour Home 4" }])).data.code, "ALLOWANCE", "level 2 does not");
    await t.owner.request("PUT", "/api/household", { madness: 2 });
    assert.equal((await t.owner.get("/api/household/allowance")).data.allowed, 2);
    assert.equal((await live(t, [{ id: "wl0.ssid", value: "Harbour Home 4" }])).status, 200);
    assert.equal((await live(t, [{ id: "lan.mask", value: "255.255.254.0" }])).data.code, "ALLOWANCE", "level 3 is still too much");

    // Actions are held to the same allowance.
    assert.equal((await t.owner.post("/api/actions/restart-service", { service: "restart_wireless" })).status, 200, "level 2 fits madness 2");
    assert.equal((await t.owner.post("/api/actions/restart-service", { service: "restart_net_and_phy" })).data.code, "ALLOWANCE");
    assert.equal((await t.owner.post("/api/actions/ping", { host: "example.com" })).status, 200);

    // Two people: the more careful one decides.
    await t.owner.post("/api/household/members", { name: "Grandma", devices: [{ mac: LAPTOP, label: "Tablet" }], allowances: { work: 0, sleep: 0, home: 0 }, homeAllowance: 0 });
    t.router.assoc = { eth6: [LAPTOP], [BAND_5G]: [PHONE] };
    const both = (await t.owner.get("/api/household/allowance")).data;
    assert.equal(both.allowed, 0);
    assert.equal(both.people.length, 2);
    assert.notEqual(both.limitedBy, "brother");
  } finally {
    await t.stop();
  }
});

test("household: Home Assistant adds presence from entities the owner picked, and the token stays in the vault", async () => {
  const ha = await fakeHomeAssistant();
  const t = await startApp({ safety: { now: () => at(10) } });
  try {
    assert.equal((await t.owner.get("/api/household/homeassistant/entities")).data.code, "HOME_ASSISTANT_NOT_SET");
    assert.equal((await t.owner.request("PUT", "/api/household/homeassistant", { url: "ftp://nope" })).status, 400);
    assert.equal((await t.owner.request("PUT", "/api/household/homeassistant", { url: "http://user:pass@127.0.0.1:1" })).status, 400);
    const set = await t.owner.request("PUT", "/api/household/homeassistant", { url: ha.url, token: "wrong-token" });
    assert.equal(set.status, 200);
    assert.equal((await t.owner.post("/api/household/homeassistant/test")).data.code, "HOME_ASSISTANT_AUTH");
    const good = await t.owner.request("PUT", "/api/household/homeassistant", { url: ha.url, token: ha.token });
    assert.deepEqual([good.data.url, good.data.hasToken], [ha.url, true]);

    for (const text of [JSON.stringify((await t.owner.get("/api/household")).data), await readFile(path.join(t.dir, "state.json"), "utf8"), await readFile(path.join(t.dir, "vault.json"), "utf8")]) assert.ok(!text.includes(ha.token), "the token is never shown or kept in the clear");

    const entities = (await t.owner.get("/api/household/homeassistant/entities")).data.entities;
    assert.deepEqual(entities.map((e) => e.entityId), ["binary_sensor.front_door", "person.pat"], "only people and sensors can be picked");
    assert.equal(entities.find((e) => e.entityId === "person.pat").name, "Pat");
    assert.ok(!JSON.stringify(entities).includes("22.3"), "no location ever leaves the entity list");
    assert.equal((await t.owner.post("/api/household/homeassistant/test")).data.entities, 2);
    assert.equal((await patch(t, { haEntities: [{ entityId: "not an entity" }] })).status, 400);
    assert.equal((await patch(t, { haEntities: [{ entityId: "person.pat", name: "Pat" }] })).status, 200);

    // Home Assistant alone; the member has no device.
    t.router.assoc = {};
    const read = async () => (await t.owner.get("/api/household/presence")).data.members[0];
    assert.equal((await read()).state, "home");
    ha.states.get("person.pat").state = "not_home";
    assert.equal((await read()).state, "away");
    ha.states.get("person.pat").state = "unavailable";
    assert.equal((await read()).state, "unknown");
    assert.equal((await t.owner.get("/api/household/allowance")).data.people[0].presence, "unknown");

    // Either source saying home wins; away needs a source to say away and none to say home.
    await patch(t, { devices: [{ mac: PHONE, label: "Phone" }] });
    ha.states.get("person.pat").state = "home";
    assert.equal((await read()).state, "home", "Wi-Fi away but Home Assistant home");
    ha.states.get("person.pat").state = "not_home";
    t.router.assoc = { eth6: [], [BAND_5G]: [PHONE] };
    assert.equal((await read()).state, "home", "Wi-Fi home but Home Assistant away");
    t.router.assoc = {};
    const away = await read();
    assert.equal(away.state, "away");
    assert.deepEqual(away.sources.map((s) => s.source), ["wifi", "homeAssistant"]);
    assert.equal(away.sources[1].entities[0].state, "not_home");
    for (const url of ha.requests) assert.match(url, /^\/api\/states(\/[a-z_]+\.[a-z0-9_]+)?$/, "only entity states are read, never history");

    // When Home Assistant stops answering, that is reported as an error and never guessed.
    await ha.close();
    const gone = await read();
    assert.equal(gone.sources[1].entities[0].error.length > 0, true);
    const state = await readFile(path.join(t.dir, "state.json"), "utf8");
    assert.ok(!/not_home|"state": "home"/.test(state), "no presence is saved");

    // Only the owner can set it up.
    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "a long operator password", role: "operator" });
    const alex = t.client();
    await alex.signIn("alex", "a long operator password");
    assert.equal((await alex.request("PUT", "/api/household/homeassistant", { url: ha.url, token: "x" })).status, 403);
    assert.equal((await alex.get("/api/household/homeassistant/entities")).status, 403);
    // Turning it off forgets the token.
    assert.equal((await t.owner.request("PUT", "/api/household/homeassistant", { url: "" })).data.hasToken, false);
  } finally {
    await t.stop();
  }
});

test("household: quiet apply waits for a time or for nobody to be on the Wi-Fi, and records what it did", async () => {
  const clock = { t: at(14) };
  const t = await startApp({ safety: { now: () => clock.t } });
  try {
    const schedule = (body) => t.owner.post("/api/safety/pending", body);

    // When the house is quiet.
    t.router.assoc = { eth6: [LAPTOP], [BAND_5G]: [] };
    const waiting = await schedule({ changes: [{ id: "qos.up", value: "25000" }], when: { quiet: true } });
    assert.equal(waiting.status, 201, waiting.text);
    assert.equal(waiting.data.status, "pending");
    assert.equal(waiting.data.when.type, "quiet");
    assert.equal(waiting.data.shortName, "Upload speed");
    assert.equal((await t.owner.get("/api/household/quiet")).data.quiet, false);
    await t.app.safety.tick();
    assert.equal(t.router.nvram.qos_obw, "20000", "someone is on the Wi-Fi, so nothing happens");
    assert.equal((await t.owner.get("/api/safety/pending")).data.items[0].status, "pending");
    t.router.assoc = {};
    assert.equal((await t.owner.get("/api/household/quiet")).data.quiet, true);
    await t.app.safety.tick();
    const done = (await t.owner.get("/api/safety/pending")).data.items[0];
    assert.equal(done.status, "applied", JSON.stringify(done));
    assert.equal(t.router.nvram.qos_obw, "25000");
    assert.ok(done.runId && done.historyId);
    const version = (await t.owner.get("/api/safety/history")).data.items[0];
    assert.deepEqual([version.source, version.mode, version.person], ["quiet", "quiet", "Pat"]);
    assert.match(version.subject, /^Quiet apply: /);
    assert.equal((await t.owner.get(`/api/safety/runs/${done.runId}`)).data.status, "done");
    await t.app.safety.tick();
    assert.equal(t.router.nvram.qos_obw, "25000", "a change is only applied once");

    // At a set time.
    assert.equal((await schedule({ changes: [{ id: "qos.down", value: "250000" }], when: { at: new Date(clock.t - 1000).toISOString() } })).status, 400, "not in the past");
    assert.equal((await schedule({ changes: [{ id: "qos.down", value: "250000" }], when: {} })).status, 400);
    assert.equal((await schedule({ changes: [{ id: "qos.down", value: "250000" }], when: { at: "someday" } })).status, 400);
    assert.equal((await schedule({ changes: [{ id: "qos.down", value: "300000" }], when: { at: new Date(clock.t + 3600000).toISOString() } })).status, 400, "nothing would change");
    const later = await schedule({ changes: [{ id: "qos.down", value: "250000" }], when: { at: new Date(clock.t + 3600000).toISOString() } });
    assert.equal(later.status, 201, later.text);
    await t.app.safety.tick();
    assert.equal(t.router.nvram.qos_ibw, "300000");
    clock.t += 3601000;
    await t.app.safety.tick();
    assert.equal(t.router.nvram.qos_ibw, "250000");

    // Cancelling, and a deadline that passes without a quiet moment.
    const cancel = await schedule({ changes: [{ id: "fw.ping", value: "1" }], when: { quiet: true } });
    assert.equal((await t.owner.request("DELETE", `/api/safety/pending/${cancel.data.id}`)).data.status, "cancelled");
    assert.equal((await t.owner.request("DELETE", `/api/safety/pending/${cancel.data.id}`)).status, 409);
    assert.equal((await t.owner.request("DELETE", "/api/safety/pending/nothing")).status, 404);
    t.router.assoc = { eth6: [LAPTOP] };
    const hopeless = await schedule({ changes: [{ id: "fw.ping", value: "1" }], when: { quiet: true, notAfter: new Date(clock.t + 60000).toISOString() } });
    clock.t += 120000;
    await t.app.safety.tick();
    const expired = (await t.owner.get("/api/safety/pending")).data.items.find((p) => p.id === hopeless.data.id);
    assert.equal(expired.status, "expired");
    assert.equal(t.router.nvram.misc_ping_x, "0");

    // A waiting change is still held to the household allowance when its turn comes.
    await patch(t, { devices: [{ mac: LAPTOP, label: "Laptop" }], allowances: { work: 3, sleep: 0, home: 0 }, homeAllowance: 0, awayAllowance: 0 });
    t.router.assoc = { eth6: [], [BAND_5G]: [] };
    const strict = await schedule({ changes: [{ id: "fw.ping", value: "1" }], when: { quiet: true } });
    await t.app.safety.tick();
    const held = (await t.owner.get("/api/safety/pending")).data.items.find((p) => p.id === strict.data.id);
    assert.equal(held.status, "pending");
    assert.match(held.note, /household does not allow/);
    assert.equal(t.router.nvram.misc_ping_x, "0");
  } finally {
    await t.stop();
  }
});

test("household: a waiting change needs the four keys when it is scheduled, not when it runs", async () => {
  const clock = { t: at(14) };
  const t = await startApp({ safety: { fourKey: true, now: () => clock.t } });
  try {
    t.router.assoc = {};
    assert.equal((await t.owner.request("PUT", "/api/household", { madness: 0 })).status, 200);
    const body = { changes: [{ id: "qos.up", value: "25000" }], when: { quiet: true } };
    const first = await t.owner.post("/api/safety/pending", body);
    assert.equal(first.status, 428);
    assert.equal(first.data.code, "CONFIRM_REQUIRED");
    const begin = first.data.detail.confirmation;
    assert.match(begin.target, /^schedule:[0-9a-f]{24}$/);
    clock.t += 2000;
    const proof = { nonce: begin.nonce, ackPeople: begin.steps.acknowledge.people.map((p) => p.id), typed: begin.steps.typeName.shortName, holdMs: 1600, chord: true };
    const changed = await t.owner.post("/api/safety/pending", { ...body, changes: [{ id: "qos.up", value: "26000" }], confirmation: proof });
    assert.equal(changed.data.code, "CONFIRM_NONCE", "the proof is for that change only");
    assert.equal((await t.owner.post("/api/safety/pending", { ...body, confirmation: proof })).status, 201);
    await t.app.safety.tick();
    assert.equal(t.router.nvram.qos_obw, "25000", "the app ran it by itself, with no one at the keyboard");
  } finally {
    await t.stop();
  }
});

test("household: the four keys are asked only above the level the household chose or allows right now", async () => {
  const t = await startApp({ safety: { fourKey: true, now: () => at(14) } });
  try {
    // Nobody is set up yet and the household's chosen level is the default, Level 1.
    assert.equal((await t.owner.get("/api/household")).data.madness, 1);
    const blip = await t.owner.post("/api/changes/preview", { changes: [{ id: "qos.up", value: "25000" }] });
    assert.equal(blip.data.impact.level, 1);
    assert.equal(blip.data.confirmation.required, false, "the preview says no keys are needed");
    assert.equal((await t.owner.post("/api/safety/confirm/begin", { previewId: blip.data.id })).data.required, false);
    const applied = await t.owner.post("/api/changes/live", { previewId: blip.data.id });
    assert.equal(applied.status, 200, applied.text);
    assert.equal(t.router.nvram.qos_obw, "25000", "a Level 1 change applies without the keys");
    assert.equal((await t.owner.post("/api/safety/pending", { changes: [{ id: "qos.up", value: "26000" }], when: { quiet: true } })).status, 201, "and schedules without them");

    // Level 2 is above the chosen level, so it still takes the keys.
    const drop = await live(t, [{ id: "wl0.ssid", value: "Harbour Home 5" }]);
    assert.equal(drop.status, 428);
    assert.equal(drop.data.code, "CONFIRM_REQUIRED");
    assert.equal((await t.owner.post("/api/actions/restart-service", { service: "restart_wireless" })).status, 428);
    assert.equal((await t.owner.post("/api/actions/restart-service", { service: "restart_firewall" })).status, 200, "a Level 1 action runs without them");

    // Choosing Level 2 lifts the keys for Level 2 as well; Level 3 keeps them.
    assert.equal((await t.owner.request("PUT", "/api/household", { madness: 2 })).status, 200);
    assert.equal((await live(t, [{ id: "wl0.ssid", value: "Harbour Home 5" }])).status, 200);
    assert.equal((await live(t, [{ id: "lan.mask", value: "255.255.254.0" }])).status, 428);

    // Choosing Level 0 brings the keys back for everything above Level 0.
    assert.equal((await t.owner.request("PUT", "/api/household", { madness: 0 })).status, 200);
    assert.equal((await live(t, [{ id: "qos.up", value: "27000" }])).status, 428);

    // A reboot takes the keys whatever the household chose.
    assert.equal((await t.owner.request("PUT", "/api/household", { madness: 3 })).status, 200);
    assert.equal((await t.owner.post("/api/safety/confirm/begin", { action: "reboot" })).data.required, true);
    assert.equal((await t.owner.post("/api/safety/launch/begin", {})).data.code, "CONFIRM_REQUIRED");

    // Someone is home and puts up with nothing right now: a Level 1 change is refused, and the
    // owner's override still takes the keys even though Level 1 is the chosen level.
    assert.equal((await t.owner.request("PUT", "/api/household", { madness: 1 })).status, 200);
    await patch(t, { devices: [{ mac: PHONE, label: "Phone" }], homeAllowance: 0 });
    t.router.assoc = { eth6: [], [BAND_5G]: [PHONE] };
    const refused = await live(t, [{ id: "qos.up", value: "28000" }]);
    assert.equal(refused.data.code, "ALLOWANCE");
    const override = await t.owner.post("/api/changes/live", { previewId: refused.data.detail.previewId, override: true });
    assert.equal(override.status, 428);
    assert.equal(override.data.code, "CONFIRM_REQUIRED");
    assert.equal(t.router.nvram.qos_obw, "25000");

    // Once they are away the household allows it again, and no keys are asked.
    t.router.assoc = {};
    assert.equal((await live(t, [{ id: "qos.up", value: "28000" }])).status, 200);
  } finally {
    await t.stop();
  }
});
