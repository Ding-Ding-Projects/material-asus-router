// Change safety, browser side. The parts of the interface that need no browser
// are plain functions: shortcuts, the four-key proof, history grouping and
// statistics, the five export formats and the choice of before-and-after
// picture. The screens themselves were driven in a real browser against the
// demo (see docs/articles/safety/change-safety-interface.md).
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { FEATURES, ROOT } from "./fakes.mjs";

const load = (name) => import(pathToFileURL(path.join(FEATURES, "change-safety", name)).href);
const model = await load("model.js");

const key = (k, extra = {}) => ({ key: k, ctrlKey: true, ...extra });
const input = (type = "text") => ({ tagName: "INPUT", type });

test("shortcuts: Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y act on the router, but never inside a text field", () => {
  const { stackShortcut, isTextTarget } = model;
  assert.equal(stackShortcut(key("z"), { tagName: "DIV" }), "undo");
  assert.equal(stackShortcut(key("Z", { shiftKey: true }), { tagName: "BODY" }), "redo");
  assert.equal(stackShortcut(key("y"), { tagName: "BUTTON" }), "redo");
  assert.equal(stackShortcut({ key: "z", metaKey: true }, { tagName: "DIV" }), "undo", "Command works on a Mac");
  for (const target of [input("text"), input("search"), input("password"), input("number"), { tagName: "TEXTAREA" }, { tagName: "SELECT" }, { tagName: "DIV", isContentEditable: true }])
    assert.equal(stackShortcut(key("z"), target), null, `${target.tagName}/${target.type ?? ""} keeps its own undo`);
  for (const target of [input("checkbox"), input("radio"), input("range"), input("button")]) assert.equal(stackShortcut(key("z"), target), "undo", `${target.type} is not a text field`);
  assert.equal(stackShortcut({ key: "z" }, { tagName: "DIV" }), null, "plain z does nothing");
  assert.equal(stackShortcut(key("z", { altKey: true }), { tagName: "DIV" }), null);
  assert.equal(stackShortcut(key("y", { shiftKey: true }), { tagName: "DIV" }), null);
  assert.equal(isTextTarget(null), false);
});

test("four keys: the proof is complete only when all four are done", () => {
  const { keyState, buildProof, chordMatches } = model;
  const detail = { nonce: "n1", steps: { acknowledge: { people: [{ id: "a" }, { id: "b" }] }, typeName: { shortName: "Network name" }, hold: { minMs: 1500 }, chord: { keys: "Ctrl+Shift+Enter" } } };
  const done = { acked: ["a", "b"], typed: "Network name", holdMs: 1600, chord: true };
  assert.equal(keyState(detail, done).ready, true);
  assert.deepEqual(buildProof(detail, done), { nonce: "n1", ackPeople: ["a", "b"], typed: "Network name", holdMs: 1600, chord: true });
  assert.equal(keyState(detail, { ...done, acked: ["a"] }).keys.acknowledge, false, "everyone affected must be acknowledged");
  assert.equal(keyState(detail, { ...done, typed: "network name" }).keys.typeName, false, "the name is typed exactly");
  assert.equal(keyState(detail, { ...done, holdMs: 1499 }).keys.hold, false);
  assert.equal(keyState(detail, { ...done, chord: false }).keys.chord, false);
  assert.equal(keyState({ steps: { typeName: { shortName: "" } } }, { typed: "" }).keys.typeName, false, "an empty name never counts");
  const nobody = { nonce: "n2", steps: { acknowledge: { people: [] }, typeName: { shortName: "Reboot" }, hold: { minMs: 1500 } } };
  assert.equal(keyState(nobody, { typed: "Reboot", holdMs: 2000, chord: true }).keys.acknowledge, false, "with nobody listed the person still ticks the box");
  assert.equal(keyState(nobody, { typed: "Reboot", holdMs: 2000, chord: true, noPeopleAck: true }).ready, true);
  assert.equal(chordMatches({ key: "Enter", ctrlKey: true, shiftKey: true }, "Ctrl+Shift+Enter"), true);
  assert.equal(chordMatches({ key: "Enter", ctrlKey: true }, "Ctrl+Shift+Enter"), false);
  assert.equal(chordMatches({ key: "Enter", ctrlKey: true, shiftKey: true, altKey: true }, "Ctrl+Shift+Enter"), false);
});

test("every refusal the server can send has an English and a Cantonese sentence", () => {
  const codes = ["CONFIRM_NONCE", "CONFIRM_ACK", "CONFIRM_TYPED", "CONFIRM_HOLD", "CONFIRM_CHORD", "ALLOWANCE", "OVERRIDE_OWNER", "LIVE_MODE_OFF", "STACK_EMPTY", "LAUNCH_REQUIRED", "LAUNCH_ORDER", "LAUNCH_CODE", "LAUNCH_KEYS", "LAUNCH_TOO_EARLY", "LAUNCH_ABORTED", "LAUNCH_DONE"];
  for (const code of codes) {
    const r = model.refusalText({ code });
    assert.ok(r?.en && r?.yue && r.en !== r.yue, `${code} has both languages`);
  }
  assert.equal(model.refusalText({ code: "SOMETHING_ELSE" }), null);
  assert.equal(model.LEVELS.length, 4);
  for (const l of model.LEVELS) assert.ok(l.name.en && l.name.yue && l.about.en && l.about.yue && l.icon);
  assert.equal(model.levelOf(9).level, 3);
  assert.equal(model.levelOf(-1).level, 0);
});

test("the allowance chip names the level, the person and what tells us they are home", () => {
  const allowance = { configured: true, allowed: 1, people: [{ id: "brother", name: "Your brother", nameYue: "你兄弟", presence: "home" }] };
  const presence = { members: [{ id: "brother", state: "home", sources: [{ source: "wifi", state: "home", devices: [{ label: "desk PC" }] }] }] };
  const chip = model.chipText(allowance, presence);
  assert.equal(chip.en, "Allowance: Level 1 · Your brother is home (desk PC on Wi-Fi)");
  assert.match(chip.yue, /你兄弟喺屋企/);
  const wired = model.chipText({ ...allowance, people: [{ ...allowance.people[0], presence: "unknown" }] }, { members: [{ id: "brother", state: "unknown", sources: [{ source: "wifi", state: "unknown" }] }] });
  assert.match(wired.en, /cannot tell/, "a wired-only person is an honest unknown");
  assert.equal(model.chipText({ configured: false }).tone, "muted");
});

test("history: grouping, query building and the pattern check", () => {
  const items = [
    { oid: "a", at: "2026-11-25T10:00:00Z", areas: ["wifi"], person: "Pat", impact: 2, mode: "live", source: "ui", subject: "Wi-Fi name" },
    { oid: "b", at: "2026-11-25T11:00:00Z", areas: ["lan", "wifi"], person: "Sam", impact: 3, mode: "review", source: "ui", subject: "Router address" },
    { oid: "c", at: "2026-11-24T09:00:00Z", areas: [], person: "Pat", impact: 0, mode: "live", source: "restore", subject: "Time zone" },
  ];
  const days = model.groupTimeline(items, "day");
  assert.equal(days.length, 2);
  assert.ok(days[0].key > days[1].key, "newest day first");
  const areas = model.groupTimeline(items, "area");
  assert.deepEqual(areas.map((g) => g.key), ["lan", "other", "wifi"]);
  assert.equal(model.historyQuery({ area: "wifi", impact: 0, text: "ssid" }, { limit: 40, offset: 0 }), "?area=wifi&impact=0&text=ssid&limit=40&offset=0");
  assert.equal(model.historyQuery({ regex: "wl0_.*ssid" }), "?regex=wl0_.*ssid");
  assert.equal(model.historyQuery({}), "");
  assert.equal(model.checkPattern("^wl[0-9]_ssid$").ok, true);
  assert.equal(model.checkPattern("(unclosed").ok, false);
  assert.equal(model.checkPattern("x".repeat(201)).ok, false);
  assert.equal(model.checkPattern("").ok, true);
  const stats = model.statistics(items);
  assert.equal(stats.total, 3);
  assert.deepEqual(stats.byImpact.map((r) => r.n), [1, 0, 1, 1]);
  assert.deepEqual(stats.byDay.map((r) => r.key), ["2026-11-24", "2026-11-25"].map((d) => stats.byDay.find((x) => x.key === d)?.key));
  assert.equal(stats.byArea.find((r) => r.key === "wifi").n, 2);
  assert.equal(model.areaName("wifi").yue, "Wi-Fi");
});

test("every export format is real, and a spreadsheet can never run a value as a formula", () => {
  const items = [
    { oid: "a1", at: "2026-11-25T10:00:00Z", person: "Pat", mode: "live", source: "ui", impact: 2, areas: ["wifi"], subject: "=HYPERLINK(\"x\")" },
    { oid: "b2", at: "2026-11-25T11:00:00Z", person: "Sam, Jr", mode: "review", source: "ui", impact: 0, areas: [], subject: "He said \"hi\" <b>" },
  ];
  const csv = model.toCsv(items);
  assert.match(csv, /^version,at,person,mode,source,impact,areas,subject\r\n/);
  assert.ok(csv.includes("'=HYPERLINK"), "a leading = is neutralised");
  assert.ok(csv.includes('"Sam, Jr"'), "commas are quoted");
  assert.ok(csv.includes('"He said ""hi"" <b>"'), "quotes are doubled");
  const json = JSON.parse(model.toJson(items));
  assert.equal(json.count, 2);
  assert.equal(json.items[1].oid, "b2");
  const md = model.toMarkdown([{ ...items[1], subject: "a | b" }]);
  assert.ok(md.includes("a \\| b"), "pipes are escaped in a Markdown table");
  const html = model.toHtml(items);
  assert.ok(!html.includes("<b>"), "markup in a value is escaped");
  assert.ok(html.includes("&lt;b&gt;") && html.includes("&quot;"));
  const pdf = model.toPdf(items);
  assert.ok(pdf.startsWith("%PDF-1.4") && pdf.trimEnd().endsWith("%%EOF"));
  // The cross-reference table must point at real objects, or a reader refuses the file.
  const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)[1]);
  assert.ok(pdf.slice(xrefAt).startsWith("xref"));
  const offsets = [...pdf.slice(xrefAt).matchAll(/^(\d{10}) 00000 n /gm)].map((m) => Number(m[1]));
  offsets.forEach((offset, i) => assert.ok(pdf.slice(offset).startsWith(`${i + 1} 0 obj`), `object ${i + 1} is where the table says`));
  const many = Array.from({ length: 120 }, (_, i) => ({ ...items[0], oid: String(i), subject: `entry ${i}` }));
  assert.ok((model.toPdf(many).match(/\/Type \/Page /g) ?? []).length >= 3, "a long history is paginated");
  assert.deepEqual(Object.keys(model.EXPORTS).sort(), ["csv", "html", "json", "markdown", "pdf"]);
  for (const f of Object.values(model.EXPORTS)) assert.equal(typeof f.make([]), "string", `${f.name} makes an empty file too`);
});

test("each change gets the picture that explains it, built from its real values", () => {
  const { simKind, channelOf, poolOf, ipToNumber, scheduleOf, describeChange } = model;
  assert.equal(simKind({ key: "wl0_chanspec" }), "wifi");
  assert.equal(simKind({ key: "wl1.1_channel" }), "wifi");
  assert.equal(simKind({ key: "dhcp_start" }), "dhcp");
  assert.equal(simKind({ key: "lan_ipaddr" }), "dhcp");
  assert.equal(simKind({ key: "vts_rulelist" }), "portforward");
  assert.equal(simKind({ key: "fw_enable_x" }), "firewall");
  assert.equal(simKind({ key: "qos_enable" }), "qos");
  assert.equal(simKind({ key: "vpnc_unit" }), "vpn");
  assert.equal(simKind({ key: "MULTIFILTER_TIME" }), "parental");
  assert.equal(simKind({ key: "dhcp_staticlist" }), "devices");
  assert.equal(simKind({ key: "time_zone" }), "generic");
  assert.deepEqual(channelOf("36/80"), { channel: 36, width: 80, auto: false });
  assert.equal(channelOf("0").auto, true);
  assert.equal(ipToNumber("198.51.100.1") - ipToNumber("198.51.100.0"), 1);
  assert.equal(ipToNumber("999.1.1.1"), null);
  const pool = poolOf({ key: "dhcp_start", old: "198.51.100.2", new: "198.51.100.50" }, [{ key: "dhcp_end", old: "198.51.100.254", new: "198.51.100.200" }]);
  assert.equal(pool.newEnd - pool.oldEnd, -54);
  assert.deepEqual(scheduleOf("W03E21000700<W04122000800"), [{ days: [1, 2, 3, 4, 5], from: "21:00", to: "07:00" }, { days: [0, 6], from: "22:00", to: "08:00" }]);
  assert.match(describeChange({ key: "x", label: { en: "Name", yue: "名" }, old: "a", new: "b" }).en, /Name: a to b/);
  assert.match(describeChange({ key: "x", label: "Name", old: "", new: "b" }).en, /set to b/);
  assert.equal(describeChange({ key: "x", label: "Name", old: "secret", new: "other", secret: true }).en.includes("secret"), false, "a secret is never written out");
});

test("the Level 3 warning, the launch control and the timeline exist, with a still path for reduced motion", async () => {
  const js = await readFile(path.join(FEATURES, "change-safety", "safety.js"), "utf8");
  const css = await readFile(path.join(FEATURES, "change-safety", "style.css"), "utf8");
  assert.match(js, /Prepare for brother mad/);
  assert.match(js, /reducedMotion\(\)/, "the warning checks for reduced motion");
  assert.match(css, /\.warn3\.still/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.warn3-stripes/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.launch-led/);
  for (const step of ["open-cover", "arm", "code", "key", "keys-ready", "countdown", "abort", "launch"]) assert.ok(js.includes(step === "key" ? "/key`" : step), `the launch sequence uses ${step}`);
  for (const word of ["ABORT", "LAUNCH", "SAFETY COVER", "Launch code"]) assert.ok(js.includes(word), `${word} is on the control panel`);
  assert.match(js, /EventSource|api\/safety\/runs\/\$\{runId\}/, "the timeline reads the run");
  assert.match(js, /status: "running"|r\.status === "running"|status === "running"/);
});

test("every picture kind has a builder and no client file breaks the project's rules", async () => {
  const scenes = await readFile(path.join(FEATURES, "change-safety", "sims", "scenes.js"), "utf8");
  for (const kind of ["wifi", "dhcp", "portforward", "firewall", "qos", "vpn", "parental", "devices", "generic"]) assert.match(scenes, new RegExp(`${kind}:\\s*\\w+Scene`), `${kind} has a scene`);
  const files = [];
  const walk = async (dir) => { for (const e of await readdir(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) await walk(p); else files.push(p); } };
  await walk(path.join(FEATURES, "change-safety"));
  await walk(path.join(FEATURES, "household"));
  files.push(path.join(ROOT, "public", "js", "dock.js"), path.join(ROOT, "public", "js", "main.js"));
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const rel = path.relative(ROOT, file);
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(text), `${rel} writes no HTML strings`);
    assert.ok(!/setAttribute\(\s*["']style["']/.test(text), `${rel} sets no inline style attribute`);
    assert.ok(!/\bcat\b/.test(text.replace(/\/\/.*$/gm, "")) || /\.css$/.test(file), `${rel} has no banned command word`);
    assert.ok(!/\b(admin|root|docker)@/.test(text), `${rel} has no user@host text`);
    assert.ok(!/\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/.test(text), `${rel} has no private address`);
  }
});

test("the shell wires in the safety bar, the badges and the api guard, and rebuilds on a language change without looping", async () => {
  const main = await readFile(path.join(ROOT, "public", "js", "main.js"), "utf8");
  assert.match(main, /installApiGuard\(\)/);
  assert.match(main, /mountBar\(safetyHost/);
  assert.match(main, /mountBadges\(/);
  // The event bus walks a Set while handlers run. A handler that rebuilds the shell registers a new handler,
  // and a Set walk visits what is added during it, so the rebuild has to wait until the walk is over.
  assert.match(main, /bus\.on\("lang", \(\) => queueMicrotask\(\(\) => \{ shell\.dispose\(\); buildShell\(\)/);
  const dock = await readFile(path.join(ROOT, "public", "js", "dock.js"), "utf8");
  assert.match(dock, /Apply now/);
  assert.match(dock, /Review and apply/);
  assert.match(dock, /preview\.allowance\.ok/, "the allowance verdict is the boolean ok, and allowed is the level");
});
