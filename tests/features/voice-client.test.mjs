// The browser half of the voice feature, tested from Node. Every module here imports
// nothing and touches no page global at load time, so the logic (the record, the
// personal wording file, tone, sounds, narration, schedules, School mode's lock and
// the dim sum draw) is checked directly, with a fake storage, speech engine and
// audio engine standing in for the browser's.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CLASS, MODES, cardsOf } from "../../public/js/features/voice/adhd.js";
import * as dimsum from "../../public/js/features/voice/dimsum.js";
import { createI18n } from "../../public/js/features/voice/i18n.js";
import * as narr from "../../public/js/features/voice/narrator.js";
import * as sched from "../../public/js/features/voice/schedule.js";
import { createLock, verifyLock } from "../../public/js/features/voice/school.js";
import * as snd from "../../public/js/features/voice/sounds.js";
import { HISTORY_LIMIT, KEYS, createStore, defaults, sanitize } from "../../public/js/features/voice/store.js";
import * as tone from "../../public/js/features/voice/tone.js";
import * as vocab from "../../public/js/features/voice/vocab.js";

class FakeStorage {
  map = new Map();
  getItem = (k) => (this.map.has(k) ? this.map.get(k) : null);
  setItem = (k, v) => void this.map.set(k, String(v));
  removeItem = (k) => void this.map.delete(k);
}
const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };

// ---- the record ----------------------------------------------------------------------------------

test("store: every choice survives a restart, clamps to its range and starts at the documented default", () => {
  const disk = new FakeStorage();
  const first = createStore({ storage: disk });
  const d = first.get();
  assert.deepEqual([d.tone.en, d.tone.yue, d.tone.emoji], [5, 5, false], "funny levels default to 5, emoji off");
  assert.deepEqual(d.adhd, { focus: false, low: false, time: false, one: false, momentum: false }, "every ADHD mode starts off");
  assert.equal(d.school.on, false);
  assert.equal(d.narration.on, false, "the narrator is off by default");
  assert.equal(d.name, "");
  first.update((r) => { r.tone.en = 2; r.tone.yue = 4; r.tone.emoji = true; r.name = "Home Router"; r.adhd.focus = true; r.sound.volume = 30; r.narration.rate = 1.5; });
  const second = createStore({ storage: disk });
  const r = second.get();
  assert.deepEqual([r.tone.en, r.tone.yue, r.tone.emoji, r.name, r.adhd.focus, r.sound.volume, r.narration.rate], [2, 4, true, "Home Router", true, 30, 1.5]);
  second.update((x) => { x.tone.en = 99; x.tone.yue = -3; x.sound.volume = 400; x.narration.rate = 9; x.narration.pitch = -1; x.look.accent = "red"; x.look.density = "huge"; });
  const c = second.get();
  assert.deepEqual([c.tone.en, c.tone.yue, c.sound.volume, c.narration.rate, c.narration.pitch, c.look.accent, c.look.density], [5, 1, 100, 2, 0, "", "comfortable"]);
});

test("store: a damaged record is reported, never half-used, and is replaced on the next save", () => {
  const disk = new FakeStorage();
  disk.setItem(KEYS.record, "{not json");
  const store = createStore({ storage: disk });
  assert.equal(store.readable, false);
  assert.ok(store.problem);
  assert.deepEqual(store.get(), defaults());
  store.update((r) => void (r.tone.en = 3));
  assert.equal(store.readable, true);
  assert.equal(createStore({ storage: disk }).get().tone.en, 3);
  assert.deepEqual(sanitize({ tone: { en: "x" }, school: { on: "yes", lock: { kind: "evil" } }, extra: 1 }).school, { on: false, label: "School mode", lock: null, prevLang: null });
  assert.ok(!("extra" in sanitize({ extra: 1 })));
});

test("store: when the browser refuses storage everything still works for the visit", () => {
  const store = createStore({ storage: throwing });
  store.update((r) => void (r.tone.en = 2));
  assert.equal(store.get().tone.en, 2);
  assert.equal(store.persistent, false);
  store.append("setting", { name: "x" });
  assert.equal(store.history().length, 1);
  assert.equal(createStore({ storage: null }).get().tone.en, 5);
});

test("store: history is append-only, bounded, and never holds a word, token, PIN or hash", () => {
  const store = createStore({ storage: new FakeStorage(), now: () => new Date("2026-11-25T10:00:00Z") });
  store.append("rename", { from: "A", to: "B", token: "SECRET", pin: "1234", password: "p", hash: "h", salt: "s" });
  const [entry] = store.history();
  assert.deepEqual(entry, { at: "2026-11-25T10:00:00.000Z", kind: "rename", data: { from: "A", to: "B" } });
  for (let i = 0; i < HISTORY_LIMIT + 25; i++) store.append("setting", { name: "n", value: String(i) });
  const all = store.history();
  assert.equal(all.length, HISTORY_LIMIT);
  assert.equal(all.at(-1).data.value, String(HISTORY_LIMIT + 24), "the newest entry is kept");
  assert.equal(typeof store.history, "function");
  for (const forbidden of ["remove", "delete", "edit", "set", "clearHistory"]) assert.equal(store[forbidden], undefined, `no ${forbidden} on the history`);
});

test("store: the export leaves out the personal wording, the tokens and the School lock", () => {
  const disk = new FakeStorage();
  const store = createStore({ storage: disk });
  store.vocabulary.write('{"version":1,"words":{"secret word":"x"}}');
  store.secrets.write({ api: "TOKEN-A", ha: "TOKEN-B" });
  store.update((r) => { r.school.lock = { kind: "pin", salt: "SALT", hash: "HASH", iter: 1000 }; });
  const text = JSON.stringify({ ...store.exportable(), history: store.history() });
  for (const leak of ["secret word", "TOKEN-A", "TOKEN-B", "SALT", "HASH"]) assert.ok(!text.includes(leak), `${leak} must not be exported`);
  assert.deepEqual(store.exportable().record.school.lock, { kind: "pin" });
  assert.deepEqual(store.secrets.read(), { api: "TOKEN-A", ha: "TOKEN-B" });
  assert.equal(JSON.stringify([...disk.map.keys()].sort()), JSON.stringify(Object.values(KEYS).filter((k) => disk.map.has(k)).sort()), "only the named keys are used");
});

test("store: changes in one tab reach another through reload and subscribers hear about them", () => {
  const disk = new FakeStorage();
  const a = createStore({ storage: disk });
  const b = createStore({ storage: disk });
  const heard = [];
  b.subscribe((_, why) => heard.push(why));
  a.update((r) => void (r.school.on = true));
  assert.equal(b.get().school.on, false);
  b.reload("remote");
  assert.equal(b.get().school.on, true);
  assert.deepEqual(heard, ["remote"]);
});

// ---- personal wording ---------------------------------------------------------------------------

const file = (words, extra = {}) => JSON.stringify({ version: 1, words, ...extra });
const refuses = (text, code) => assert.throws(() => vocab.parseVocabulary(text), (e) => e instanceof vocab.VocabError && e.code === code, `${String(text).slice(0, 60)} -> ${code}`);

test("vocabulary: a good file is accepted, with a name, nesting and the entries alias", () => {
  const v = vocab.parseVocabulary(file({ router: "gateway", Guest: { network: "visitors" } }, { name: "Pat's wording" }));
  assert.deepEqual([v.name, v.count], ["Pat's wording", 2]);
  assert.equal(v.entries.get("guest.network"), undefined, "only the last key of a group counts");
  assert.equal(v.entries.get("network"), "visitors");
  assert.equal(vocab.parseVocabulary(JSON.stringify({ version: 1, entries: { a1: "b" } })).count, 1);
  assert.equal(vocab.parseVocabulary(`﻿${file({ a1: "b" })}`).count, 1, "a byte order mark is fine");
});

test("vocabulary: every bound is enforced exactly at its edge", () => {
  const cp = (n, ch = "a") => ch.repeat(n);
  assert.ok(vocab.parseVocabulary(file({ [cp(160)]: "x" })), "a key of 160 characters");
  refuses(file({ [cp(161)]: "x" }), "BAD_KEY");
  assert.ok(vocab.parseVocabulary(file({ k1: cp(1000) })), "a value of 1,000 characters");
  refuses(file({ k1: cp(1001) }), "BAD_VALUE");
  refuses(file({ [cp(161, "字")]: "x" }), "BAD_KEY");
  assert.ok(vocab.parseVocabulary(file({ [cp(160, "字")]: "x" })), "length counts characters, not bytes");

  const nested = (depth) => { let node = { leaf: "x" }; for (let i = 1; i < depth; i++) node = { g: node }; return node; };
  assert.ok(vocab.parseVocabulary(file(nested(8))), "depth 8 is allowed");
  refuses(file(nested(9)), "TOO_DEEP");

  const many = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`word${i}`, "x"]));
  assert.equal(vocab.parseVocabulary(file(many(5000))).count, 5000);
  refuses(file(many(5001)), "TOO_MANY");

  const pad = (size) => file({ a1: "x" }, { name: "n" }).replace('"n"', JSON.stringify("n".repeat(1)));
  const big = JSON.stringify({ version: 1, words: { a1: "x" }, name: "n" }) + " ".repeat(vocab.LIMITS.bytes);
  refuses(big, "TOO_BIG");
  const exact = JSON.stringify({ version: 1, words: { a1: "x" } });
  assert.ok(vocab.parseVocabulary(exact + " ".repeat(vocab.LIMITS.bytes - new TextEncoder().encode(exact).length)), "exactly 256 KiB is allowed");
  assert.ok(pad);
});

test("vocabulary: malformed, duplicate and unexpected input is refused and nothing is applied", () => {
  refuses("", "EMPTY");
  refuses("   ", "EMPTY");
  refuses("{not json", "NOT_JSON");
  refuses("[1,2]", "NOT_OBJECT");
  refuses('"text"', "NOT_OBJECT");
  refuses("null", "NOT_OBJECT");
  refuses('{"words":{"a1":"b"}}', "BAD_VERSION");
  refuses('{"version":2,"words":{"a1":"b"}}', "BAD_VERSION");
  refuses('{"version":1}', "NO_WORDS");
  refuses('{"version":1,"words":{}}', "NO_WORDS");
  refuses('{"version":1,"words":[]}', "NO_WORDS");
  refuses('{"version":1,"words":{"a1":"b"},"extra":1}', "UNKNOWN_FIELD");
  refuses('{"version":1,"words":{"a1":"b"},"entries":{"c1":"d"}}', "UNKNOWN_FIELD");
  refuses('{"version":1,"name":5,"words":{"a1":"b"}}', "BAD_NAME");
  refuses(`{"version":1,"name":"${"n".repeat(81)}","words":{"a1":"b"}}`, "BAD_NAME");
  refuses('{"version":1,"words":{"a1":1}}', "BAD_VALUE");
  refuses('{"version":1,"words":{"a1":["x"]}}', "BAD_VALUE");
  refuses('{"version":1,"words":{"a1":null}}', "BAD_VALUE");
  refuses('{"version":1,"words":{"a1":""}}', "BAD_VALUE");
  refuses('{"version":1,"words":{"":"b"}}', "BAD_KEY");
  refuses('{"version":1,"words":{"  ":"b"}}', "BAD_KEY");
  refuses('{"version":1,"words":{"!!!":"b"}}', "BAD_KEY");
  refuses('{"version":1,"words":{"a\\u0000b":"c"}}', "BAD_KEY");
  refuses('{"version":1,"words":{"__proto__":{"a1":"b"}}}', "BAD_KEY");
  refuses('{"version":1,"words":{"constructor":"x"}}', "BAD_KEY");
  // duplicates: written twice, written twice in different spellings, nested, and equal after case folding
  refuses('{"version":1,"words":{"a1":"b","a1":"c"}}', "DUPLICATE_KEY");
  refuses('{"version":1,"words":{"a1":"b","\\u0061\\u0031":"c"}}', "DUPLICATE_KEY");
  refuses('{"version":1,"words":{"g":{"a1":"b","a1":"c"}}}', "DUPLICATE_KEY");
  refuses('{"version":1,"version":1,"words":{"a1":"b"}}', "DUPLICATE_KEY");
  refuses('{"version":1,"words":{"Router":"a","router":"b"}}', "DUPLICATE_KEY");
  refuses('{"version":1,"words":{"x":{"router":"a"},"y":{"Router":"b"}}}', "DUPLICATE_KEY");
});

test("vocabulary: words are swapped whole, in one pass, in any case, and Chinese phrases anywhere", () => {
  const v = vocab.parseVocabulary(file({ router: "gateway", "wi-fi": "airwaves", guest: "visitor", 網絡: "網路", tea: "x" }));
  const swap = vocab.compile(v.entries);
  assert.equal(swap("The Router and the routers"), "The gateway and the routers", "whole words only, any case");
  assert.equal(swap("Wi-Fi guest"), "airwaves visitor");
  assert.equal(swap("guests"), "guests");
  assert.equal(swap("本地網絡設定"), "本地網路設定", "a Chinese phrase matches inside a sentence");
  const chain = vocab.compile(vocab.parseVocabulary(file({ a1: "b1", b1: "c1" })).entries);
  assert.equal(chain("a1 b1"), "b1 c1", "a replacement is never replaced again");
  assert.equal(vocab.compile(new Map()), null);
  assert.equal(swap(""), "");
  assert.equal(swap("a.b*c? (regex) [chars]"), "a.b*c? (regex) [chars]", "special characters in the text are harmless");
  const odd = vocab.compile(vocab.parseVocabulary(file({ "a.b*c": "ok", "(x)": "paren" })).entries);
  assert.equal(odd("a.b*c and aXbbc"), "ok and aXbbc", "special characters in a word are matched literally");
});

test("vocabulary: the saved copy is checked again on load and a damaged copy is rejected", () => {
  const parsed = vocab.parseVocabulary(file({ router: "gateway" }, { name: "N" }));
  const loaded = vocab.loadStored(vocab.serialize(parsed));
  assert.deepEqual([loaded.state, loaded.name, loaded.count], ["loaded", "N", 1]);
  assert.equal(loaded.replace("router"), "gateway");
  assert.deepEqual(vocab.loadStored(null), { state: "none" });
  for (const damaged of ["{", '{"version":1,"words":{"a1":"b","a1":"c"}}', "[]", JSON.stringify({ version: 9, words: { a: "b" } })]) assert.equal(vocab.loadStored(damaged).state, "damaged", damaged);
  const budget = performance.now();
  const swap = vocab.compile(vocab.parseVocabulary(file(Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`word${i}`, `w${i}`])))).entries);
  assert.equal(swap("word4999 word0"), "w4999 w0");
  assert.ok(performance.now() - budget < 8000, "5,000 entries compile and run quickly, even on a busy machine");
});

// ---- funny levels --------------------------------------------------------------------------------

test("tone: level 1 adds nothing, levels 2 to 5 differ in both languages, and the facts are never touched", () => {
  for (const language of ["en", "yue"]) {
    for (const category of tone.CATEGORIES) {
      const lines = tone.LEVELS.map((level) => tone.aside(category, level, language));
      assert.equal(lines[0], "", `${language}/${category}: level 1 is plain`);
      assert.ok(lines.slice(1).every(Boolean), `${language}/${category}: every other level says something`);
      assert.equal(new Set(lines).size, 5, `${language}/${category}: every level is different`);
      assert.ok(lines.every((l) => l.length < 120), "an aside is short");
    }
  }
  assert.deepEqual(tone.CATEGORIES, ["error", "success", "confirm", "security", "access", "empty"], "errors, risky actions, security and accessibility are all covered");
  assert.equal(tone.asideFor("error", { en: 1, yue: 1 }, "both"), "", "level 1 in both languages adds nothing");
  assert.equal(tone.asideFor("error", { en: 5, yue: 1 }, "both"), tone.aside("error", 5, "en"), "the languages are independent");
  assert.equal(tone.asideFor("error", { en: 1, yue: 5 }, "en"), "", "English mode ignores the Cantonese level");
  assert.equal(tone.asideFor("success", { en: 5, yue: 3 }, "both"), `${tone.aside("success", 5, "en")}\n${tone.aside("success", 3, "yue")}`);
  assert.equal(tone.aside("error", 0, "en"), tone.aside("error", 5, "en"), "a level of 0 is not a level, so the default is used");
  assert.equal(tone.aside("error", "junk", "en"), tone.aside("error", 5, "en"), "a bad level falls back to the default");
  assert.equal(tone.aside("nothing", 5, "en"), "");
  assert.ok(!tone.LEVEL_NAMES.en.some((n, i) => n === tone.LEVEL_NAMES.en[i + 1]));
});

test("tone: the dialog emoji is one decorative character from a fixed set, chosen by the heading", () => {
  assert.equal(tone.emojiFor("Reboot"), tone.emojiFor("Reboot"));
  const seen = new Set(["Reboot", "Restore", "Delete rule", "Turn off", "Apply", "Undo", "Sign out"].map(tone.emojiFor));
  for (const e of seen) assert.ok(tone.DIALOG_EMOJI.includes(e));
  assert.ok(seen.size > 1, "different dialogs can get different emoji");
  for (const e of tone.DIALOG_EMOJI) assert.equal([...e].length, 1);
});

// ---- sounds --------------------------------------------------------------------------------------

const settings = (patch = {}) => ({ ...defaults(), sound: { ...defaults().sound, ...patch } });
const at = (h, m = 0) => new Date(2026, 10, 25, h, m);

test("sounds: switch, mute, volume, reduced sound and quiet hours each stop a cue, and say why", () => {
  const verdict = (patch, cue = "success", extra = {}) => snd.decide({ settings: settings(patch), cue, date: at(12), ...extra });
  assert.deepEqual([verdict({}).play, verdict({}).reason], [true, "ok"]);
  assert.deepEqual([verdict({ on: false }).play, verdict({ on: false }).reason], [false, "switched-off"]);
  assert.equal(verdict({ muted: true }).reason, "muted");
  assert.equal(verdict({ volume: 0 }).reason, "volume-zero");
  assert.equal(verdict({ reduced: true }).reason, "reduced-sound");
  assert.equal(verdict({ reduced: true }, "error").play, true, "reduced sound still lets errors through");
  assert.equal(verdict({ reduced: true }, "warn").play, true);
  assert.equal(verdict({}, "success", { lowStimulation: true }).reason, "reduced-sound", "low stimulation quietens sounds");
  assert.equal(verdict({}, "error", { lowStimulation: true }).play, true);
  assert.equal(verdict({}, "success", { sinceLast: 10 }).reason, "too-soon");
  assert.equal(verdict({}, "nope").reason, "unknown-cue");
  assert.ok(verdict({ volume: 100 }).gain > verdict({ volume: 20 }).gain, "volume scales the level");
  const quiet = { quiet: { on: true, from: "22:00", to: "07:00" } };
  assert.equal(snd.decide({ settings: settings(quiet), cue: "error", date: at(23, 30) }).reason, "quiet-hours");
  assert.equal(snd.decide({ settings: settings(quiet), cue: "error", date: at(3) }).reason, "quiet-hours", "quiet hours run past midnight");
  assert.equal(snd.decide({ settings: settings(quiet), cue: "error", date: at(7) }).play, true, "the end time is outside quiet hours");
  assert.equal(snd.decide({ settings: settings(quiet), cue: "error", date: at(21, 59) }).play, true);
  assert.equal(snd.inQuietHours(at(10), "09:00", "17:00"), true, "a same-day window");
  assert.equal(snd.inQuietHours(at(8), "09:00", "17:00"), false);
  assert.equal(snd.inQuietHours(at(10), "10:00", "10:00"), false, "an empty window is never quiet");
});

test("sounds: every cue has notes and a documented trigger, and the cues are generated, not loaded", () => {
  assert.deepEqual(snd.CUE_MAP.map((c) => c.cue).sort(), Object.keys(snd.CUES).sort(), "the action-to-cue map covers every cue");
  for (const c of snd.CUE_MAP) assert.ok(c.when.en && c.when.yue);
  for (const [name, cue] of Object.entries(snd.CUES)) {
    assert.ok(cue.notes.length >= 1, name);
    for (const n of cue.notes) assert.ok(n.f > 80 && n.f < 4000 && n.d > 0 && n.d < 1 && n.g > 0 && n.g <= 1 && ["sine", "triangle", "square"].includes(n.type), `${name}: a sensible note`);
  }
});

function fakeAudio() {
  const made = { osc: 0, started: 0 };
  return { made, currentTime: 1, destination: {}, resume: () => Promise.resolve(),
    createOscillator: () => { made.osc++; return { type: "", frequency: { value: 0 }, connect() {}, start() { made.started++; }, stop() {} }; },
    createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }) };
}

test("sounds: the service plays through one audio engine, obeys the settings, and never throws", () => {
  let now = 1000;
  const audio = fakeAudio();
  let current = settings();
  const service = snd.createSounds({ getSettings: () => current, clock: () => now, now: () => at(12), makeContext: () => audio });
  assert.equal(service.play("applied").play, true);
  assert.equal(audio.made.osc, snd.CUES.applied.notes.length);
  assert.equal(service.play("applied").reason, "too-soon", "a rapid repeat is coalesced");
  now += 500;
  current = settings({ on: false });
  assert.equal(service.play("applied").play, false);
  assert.equal(audio.made.osc, snd.CUES.applied.notes.length, "a switched-off cue makes no sound");
  current = settings();
  now += 500;
  assert.equal(service.play("tada").play, true);
  const broken = snd.createSounds({ getSettings: () => settings(), makeContext: () => { throw new Error("no audio"); } });
  assert.deepEqual(broken.play("success"), { play: false, reason: "audio-unavailable" });
  assert.equal(broken.state.available, false, "the failure is reported, not thrown");
  const throwsLater = snd.createSounds({ getSettings: () => { throw new Error("boom"); } });
  assert.doesNotThrow(() => throwsLater.play("success"));
});

// ---- narrator ------------------------------------------------------------------------------------

const voice = (name, lang, extra = {}) => ({ name, lang, voiceURI: `uri:${name}`, ...extra });
const VOICES = [voice("Alex", "en-US", { default: true }), voice("Daniel", "en-GB"), voice("Sinji", "zh-HK"), voice("Meijia", "zh-TW"), voice("Tingting", "zh-CN")];

test("narrator: bilingual text splits into one track per language, in the order the mode wants", () => {
  assert.deepEqual(narr.splitTracks("Saved. · 已儲存。"), [{ lang: "en", text: "Saved." }, { lang: "yue", text: "已儲存。" }]);
  assert.deepEqual(narr.splitTracks("Cannot reach the router\n連唔到路由器"), [{ lang: "en", text: "Cannot reach the router" }, { lang: "yue", text: "連唔到路由器" }]);
  assert.deepEqual(narr.tracksFor("Saved. · 已儲存。", "en"), [{ lang: "en", text: "Saved." }]);
  assert.deepEqual(narr.tracksFor("Saved. · 已儲存。", "yue"), [{ lang: "yue", text: "已儲存。" }]);
  assert.deepEqual(narr.tracksFor("已儲存。\nSaved.", "both").map((t) => t.lang), ["en", "yue"], "English first, then Cantonese");
  assert.deepEqual(narr.tracksFor("", "both"), []);
  assert.equal(narr.splitTracks("same · same").length, 1);
});

test("narrator: voices are chosen by stable identity, automatic choice is sensible and bounds are enforced", () => {
  assert.equal(narr.chooseVoice(VOICES, null, "en").voice.name, "Alex", "automatic prefers the system default");
  assert.equal(narr.chooseVoice(VOICES, null, "yue").voice.name, "Sinji", "automatic Cantonese prefers Hong Kong");
  assert.deepEqual(narr.voicesFor(VOICES, "yue").map((v) => v.name), ["Sinji"], "only Hong Kong Cantonese voices are listed for Cantonese");
  const chosen = narr.chooseVoice(VOICES, narr.voiceKey(VOICES[1]), "en");
  assert.deepEqual([chosen.voice.name, chosen.how], ["Daniel", "chosen"]);
  assert.equal(narr.chooseVoice([...VOICES].reverse(), narr.voiceKey(VOICES[1]), "en").voice.name, "Daniel", "the choice survives a different enumeration order");
  const renamedUri = { ...narr.voiceKey(VOICES[1]), uri: "uri:old" };
  assert.equal(narr.chooseVoice(VOICES, renamedUri, "en").voice.name, "Daniel", "name and language match when the identifier changed");
  const gone = narr.chooseVoice(VOICES.filter((v) => v.name !== "Daniel"), narr.voiceKey(VOICES[1]), "en");
  assert.deepEqual([gone.voice.name, gone.how, gone.missing], ["Alex", "auto", true], "an uninstalled voice falls back to automatic and says so");
  assert.deepEqual(narr.chooseVoice(VOICES.filter((v) => !/zh-HK/.test(v.lang)), null, "yue"), { voice: null, how: "none" }, "never borrows a Mandarin voice for Cantonese");
  assert.deepEqual(narr.chooseVoice([], null, "en"), { voice: null, how: "none" });
  assert.deepEqual([narr.clampRate(0), narr.clampRate(9), narr.clampRate("x"), narr.clampRate(1.3)], [0.5, 2, 1, 1.3]);
  assert.deepEqual([narr.clampPitch(-1), narr.clampPitch(9), narr.clampPitch(NaN), narr.clampPitch(0)], [0, 2, 1, 0]);
});

function fakeSpeech(voices = VOICES) {
  const synth = { spoken: [], pending: null, voices, listeners: new Map(), cancelled: 0,
    getVoices: () => synth.voices,
    speak(u) { synth.spoken.push(u); },
    cancel() { synth.cancelled++; },
    addEventListener(name, fn) { synth.listeners.set(name, fn); },
    removeEventListener(name) { synth.listeners.delete(name); } };
  class Utterance { constructor(text) { this.text = text; } }
  return { synth, Utterance };
}
function narrator({ voices, patch = {}, mode = "both" } = {}) {
  const { synth, Utterance } = fakeSpeech(voices);
  let now = 10000;
  const timers = [];
  const rec = { ...defaults(), narration: { ...defaults().narration, on: true, ...patch } };
  const n = narr.createNarrator({ synth, Utterance, getSettings: () => rec, getLang: () => mode, clock: () => now, setTimer: (fn, ms) => timers.push({ fn, ms }) - 1, clearTimer: () => {} });
  n.readVoices();
  return { n, synth, rec, advance: (ms) => (now += ms), timers };
}

test("narrator: one utterance at a time, in order, with the chosen voice, rate and pitch", () => {
  const { n, synth, rec, advance } = narrator({ patch: { rate: 1.4, pitch: 0.8 } });
  assert.deepEqual(n.speak("Saved. · 已儲存。"), { spoken: true, tracks: ["en", "yue"] });
  assert.equal(synth.spoken.length, 1, "the second track waits for the first");
  const first = synth.spoken[0];
  assert.deepEqual([first.text, first.voice.name, first.rate, first.pitch], ["Saved.", "Alex", 1.4, 0.8]);
  first.onend();
  assert.equal(synth.spoken.length, 2);
  const second = synth.spoken[1];
  assert.deepEqual([second.text, second.voice.name, second.lang], ["已儲存。", "Sinji", "zh-HK"]);
  second.onend();
  assert.equal(n.state.spoken, 2);
  assert.equal(n.state.speaking, false);
  rec.narration.rate = 99;
  advance(5000);
  n.speak("Later");
  assert.equal(synth.spoken.at(-1).rate, 2, "a rate out of range is clamped");
});

test("narrator: it is silent when off, with a screen reader, or without an engine, and never speaks Cantonese without a Cantonese voice", () => {
  const off = narrator({ patch: { on: false } });
  assert.deepEqual([off.n.speak("Hello").spoken, off.n.speak("Hello").why], [false, "off"]);
  const sr = narrator({ patch: { screenReader: true } });
  assert.equal(sr.n.speak("Hello", { priority: "error" }).why, "screen-reader", "even errors yield to a screen reader");
  const none = narr.createNarrator({ synth: null, Utterance: null, getSettings: () => defaults(), getLang: () => "en" });
  assert.equal(none.speak("Hello").why, "no-speech");
  assert.equal(none.state.available, false);
  assert.doesNotThrow(() => none.stop());
  const noYue = narrator({ voices: VOICES.filter((v) => !/zh/.test(v.lang)), mode: "yue" });
  noYue.n.speak("已儲存。");
  assert.equal(noYue.synth.spoken.length, 0);
  assert.equal(noYue.n.state.lastError, "no-cantonese-voice");
});

test("narrator: repeats and rushes are dropped for ordinary messages, but an error is always spoken", () => {
  const { n, synth, advance } = narrator({ mode: "en" });
  assert.equal(n.speak("Saved").spoken, true);
  synth.spoken[0].onend();
  advance(100);
  assert.equal(n.speak("Saved").why, "repeat");
  assert.equal(n.speak("Other").why, "rate-limited", "a second message inside half a second is dropped");
  advance(600);
  assert.equal(n.speak("Other").spoken, true);
  synth.spoken[1].onend();
  advance(600);
  const before = synth.spoken.length;
  assert.equal(n.speak("Disk full", { priority: "error" }).spoken, true);
  advance(1);
  assert.equal(n.speak("Disk full again", { priority: "error" }).spoken, true, "errors are not rate limited");
  assert.ok(synth.spoken.length >= before + 1);
  advance(1000);
  n.speak("Calm message");
  n.speak("Error while queued", { priority: "error" });
  const order = [];
  for (let i = 0; i < 8 && synth.spoken.length; i++) {
    const u = synth.spoken[synth.spoken.length - 1];
    order.push(u.text);
    u.onend?.();
    if (order.length > 6) break;
  }
  assert.ok(order.includes("Error while queued"));
});

test("narrator: a stuck engine cannot freeze the queue, and voices that arrive late are picked up", () => {
  const stuck = narrator({ mode: "en" });
  stuck.n.speak("First");
  stuck.advance(1000);
  stuck.n.speak("Second");
  assert.equal(stuck.synth.spoken.length, 1);
  stuck.timers.at(-1).fn();
  assert.equal(stuck.synth.spoken.length, 2, "the watchdog moves on after a stuck utterance");

  const late = narrator({ voices: [], mode: "en" });
  assert.deepEqual(narr.voicesFor(late.n.voices, "en"), []);
  const stop = late.n.watchVoices();
  assert.ok(late.synth.listeners.has("voiceschanged"));
  late.synth.voices = VOICES;
  late.synth.listeners.get("voiceschanged")();
  assert.equal(late.n.effective("en").voice.name, "Alex", "the voice list updates when the engine says it changed");
  late.synth.voices = [];
  late.timers.at(-1).fn();
  assert.equal(late.n.voices.length, 0, "an empty late answer is handled");
  stop();
  assert.equal(late.synth.listeners.has("voiceschanged"), false, "the listener is removed on stop");
  const failing = fakeSpeech();
  failing.synth.getVoices = () => { throw new Error("blocked"); };
  assert.doesNotThrow(() => narr.createNarrator({ synth: failing.synth, Utterance: failing.Utterance, getSettings: () => defaults(), getLang: () => "en" }).readVoices());
});

// ---- schedules -----------------------------------------------------------------------------------

const rule = (patch = {}) => sched.validateRule({ id: "r-a", name: "Work", source: "local", days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00", tz: "Asia/Hong_Kong", apply: { theme: "dark" }, ...patch });
const open = (r, iso) => sched.windowOpen(r.rule, new Date(iso));

test("schedule: a rule is validated completely and a bad one is explained", () => {
  assert.equal(rule().ok, true);
  const bad = (patch, error) => assert.ok(rule(patch).errors.includes(error), JSON.stringify(patch));
  bad({ name: " " }, "name");
  bad({ start: "9:00" }, "time");
  bad({ end: "25:00" }, "time");
  bad({ end: "09:00" }, "same-time");
  bad({ tz: "Mars/Olympus" }, "tz");
  bad({ from: "2026-13-45" }, "date");
  bad({ from: "2026-12-31", to: "2026-12-01" }, "date-order");
  bad({ apply: {} }, "apply");
  bad({ apply: { theme: "neon" } }, "theme");
  bad({ apply: { accent: "red" } }, "accent");
  bad({ apply: { wallpaper: "x" } }, "unknown:wallpaper");
  bad({ id: "BAD ID" }, "id");
  assert.equal(rule({ allDay: true, start: "", end: "" }).ok, true, "an all-day rule needs no times");
  assert.equal(rule({ source: "api", apply: {} }).ok, true, "an API rule may take its settings from the answer");
  assert.deepEqual(rule({ days: [5, 1, 1, 9] }).rule.days, [1, 5], "days are sorted, unique and 0 to 6");
  const draws = [0, 0, 0.5];
  assert.notEqual(sched.newRuleId([{ id: "r-000000" }], () => draws.shift()), "r-000000", "an id already in use is never reused");
});

test("schedule: weekdays, weekends and date ranges are read in the rule's own time zone", () => {
  const work = rule();
  assert.equal(open(work, "2026-11-25T02:00:00Z"), true, "Wednesday 10:00 in Hong Kong");
  assert.equal(open(work, "2026-11-28T02:00:00Z"), false, "Saturday");
  assert.equal(open(work, "2026-11-25T09:00:00Z"), false, "17:00 sharp is outside the window");
  assert.equal(open(work, "2026-11-25T08:59:00Z"), true, "16:59 is inside");
  assert.equal(open(work, "2026-11-25T01:00:00Z"), true, "09:00 sharp is inside");
  assert.equal(open(work, "2026-11-25T00:59:00Z"), false);
  const daily = rule({ days: [] });
  assert.equal(open(daily, "2026-11-29T02:00:00Z"), true, "no days picked means every day");
  const ny = rule({ tz: "America/New_York", days: [] });
  assert.equal(open(ny, "2026-11-25T15:00:00Z"), true, "10:00 in New York is 15:00 UTC");
  assert.equal(open(ny, "2026-11-25T02:00:00Z"), false, "the same instant is 21:00 in New York");
  const range = rule({ days: [], from: "2026-12-01", to: "2026-12-31" });
  assert.deepEqual([open(range, "2026-11-30T02:00:00Z"), open(range, "2026-12-01T02:00:00Z"), open(range, "2026-12-31T02:00:00Z"), open(range, "2027-01-01T02:00:00Z")], [false, true, true, false], "the first and last day are included");
  assert.equal(open(rule({ allDay: true, days: [3] }), "2026-11-25T10:00:00Z"), true, "an all-day rule on Wednesday");
});

test("schedule: a window that runs past midnight belongs to the day it started", () => {
  const night = rule({ start: "22:00", end: "06:00", days: [5] }); // Friday nights
  assert.equal(open(night, "2026-11-27T15:00:00Z"), true, "Friday 23:00");
  assert.equal(open(night, "2026-11-27T19:00:00Z"), true, "Saturday 03:00 still belongs to Friday");
  assert.equal(open(night, "2026-11-27T22:00:00Z"), false, "Saturday 06:00 has ended");
  assert.equal(open(night, "2026-11-28T15:00:00Z"), false, "Saturday night is not Friday");
  assert.equal(open(night, "2026-11-28T19:00:00Z"), false, "Sunday 03:00 belongs to Saturday");
  assert.equal(open(night, "2026-11-29T19:00:00Z"), false);
  const everyNight = rule({ start: "22:00", end: "06:00", days: [] });
  assert.equal(open(everyNight, "2026-11-25T18:00:00Z"), true, "02:00 on any day");
  const ranged = rule({ start: "22:00", end: "06:00", days: [], from: "2026-12-01", to: "2026-12-01" });
  assert.equal(open(ranged, "2026-12-01T19:00:00Z"), true, "Dec 2 03:00 belongs to Dec 1, which is in range");
  assert.equal(open(ranged, "2026-12-02T19:00:00Z"), false, "Dec 3 03:00 belongs to Dec 2, which is out of range");
});

test("schedule: daylight saving changes behave like a clock", () => {
  const gap = rule({ tz: "America/New_York", days: [], start: "02:30", end: "04:00" });
  assert.equal(open(gap, "2026-03-08T06:59:00Z"), false, "01:59 before the clocks jump");
  assert.equal(open(gap, "2026-03-08T07:00:00Z"), true, "03:00 after the jump, when 02:30 never happened");
  const repeat = rule({ tz: "America/New_York", days: [], start: "01:00", end: "02:00" });
  assert.equal(open(repeat, "2026-11-01T05:30:00Z"), true, "01:30 the first time");
  assert.equal(open(repeat, "2026-11-01T06:30:00Z"), true, "01:30 again after the clocks go back");
  assert.equal(open(repeat, "2026-11-01T07:30:00Z"), false, "02:30");
  assert.deepEqual(sched.zoned(new Date("2026-11-25T02:00:00Z"), "Asia/Hong_Kong"), { date: "2026-11-25", weekday: 3, minutes: 600 });
  assert.equal(sched.zoned(new Date("2026-11-25T16:30:00Z"), "Asia/Hong_Kong").date, "2026-11-26", "midnight is read per zone");
});

test("schedule: external sources decide external rules, expire, and the first rule in the list wins each setting", () => {
  const api = rule({ id: "r-api", name: "API", source: "api", apply: { theme: "light", density: "compact" } }).rule;
  const ha = rule({ id: "r-ha", name: "HA", source: "ha", apply: { language: "en" } }).rule;
  const local = rule({ id: "r-loc", days: [], apply: { theme: "dark", motion: "reduced" } }).rule;
  const now = new Date("2026-11-25T02:00:00Z");
  assert.equal(sched.ruleActive(api, now, {}), false, "no answer yet means off");
  assert.equal(sched.ruleActive(api, now, { api: { active: false } }), false);
  assert.equal(sched.ruleActive(api, now, { api: { active: true } }), true);
  assert.equal(sched.ruleActive(api, now, { api: { active: true, validUntil: "2026-11-25T01:00:00Z" } }), false, "an expired answer is off");
  assert.equal(sched.ruleActive({ ...api, enabled: false }, now, { api: { active: true } }), false);
  const resolved = sched.resolve([api, ha, local], now, { api: { active: true, settings: { theme: "dark", accent: "#112233" } }, ha: { active: true } });
  assert.deepEqual(resolved.active, ["r-api", "r-ha", "r-loc"]);
  assert.deepEqual(resolved.values, { theme: { value: "dark", rule: "r-api" }, accent: { value: "#112233", rule: "r-api" }, density: { value: "compact", rule: "r-api" }, language: { value: "en", rule: "r-ha" }, motion: { value: "reduced", rule: "r-loc" } }, "API settings override the rule's own, and the first rule keeps each setting");
  assert.deepEqual(sched.resolve([local, api], now, { api: { active: true } }).values.theme, { value: "dark", rule: "r-loc" }, "reordering changes the winner");
  assert.deepEqual(sched.resolve([], now).values, {});
});

test("schedule: a rule only borrows a setting, and the person's own value comes back", () => {
  const now = { language: "both", theme: "light", density: "comfortable" };
  const on = sched.plan({ values: { theme: { value: "dark", rule: "r" } }, base: null, current: now, previous: {} });
  assert.deepEqual([on.apply, on.restore, on.base], [{ theme: "dark" }, {}, { theme: "light" }]);
  const held = sched.plan({ values: { theme: { value: "dark", rule: "r" } }, base: on.base, current: { ...now, theme: "dark" }, previous: { theme: "dark" } });
  assert.deepEqual([held.apply, held.restore, held.base], [{}, {}, { theme: "light" }], "nothing changes while it stays on");
  const manual = sched.plan({ values: { theme: { value: "dark", rule: "r" } }, base: on.base, current: { ...now, theme: "light" }, previous: { theme: "dark" } });
  assert.deepEqual(manual.apply, {}, "a change the person makes while a rule is on is not fought");
  const off = sched.plan({ values: {}, base: on.base, current: { ...now, theme: "dark" }, previous: { theme: "dark" } });
  assert.deepEqual([off.apply, off.restore, off.base], [{}, { theme: "light" }, null], "the person's value returns and the base is cleared");
  const switched = sched.plan({ values: { theme: { value: "light", rule: "r2" } }, base: on.base, current: { ...now, theme: "dark" }, previous: { theme: "dark" } });
  assert.deepEqual([switched.apply, switched.base], [{ theme: "light" }, { theme: "light" }], "a second rule replaces the first without losing the original");
});

// ---- School mode ---------------------------------------------------------------------------------

test("school: the lock keeps only a salted slow hash, accepts the right secret and refuses everything else", async () => {
  const lock = await createLock("pin", "2468", 1000);
  assert.deepEqual(Object.keys(lock).sort(), ["hash", "iter", "kind", "salt"]);
  assert.ok(!JSON.stringify(lock).includes("2468"));
  assert.equal(await verifyLock(lock, "2468"), true);
  for (const wrong of ["2469", "", "246", "24680", " 2468"]) assert.equal(await verifyLock(lock, wrong), false, wrong);
  assert.equal(await verifyLock(null, "2468"), false);
  assert.equal(await verifyLock({ ...lock, hash: "###" }, "2468"), false, "a damaged lock refuses");
  const again = await createLock("pin", "2468", 1000);
  assert.notEqual(again.hash, lock.hash, "every lock has its own salt");
  const password = await createLock("password", "correct horse", 1000);
  assert.equal(await verifyLock(password, "correct horse"), true);
  await assert.rejects(createLock("pin", "12", 1000), /pin/);
  await assert.rejects(createLock("pin", "abcd", 1000), /pin/);
  await assert.rejects(createLock("pin", "1".repeat(13), 1000), /pin/);
  await assert.rejects(createLock("password", "short", 1000), /password/);
  await assert.rejects(createLock("password", "x".repeat(129), 1000), /password/);
  await assert.rejects(createLock("fingerprint", "1234", 1000), /kind/);
});

// ---- comfort modes -------------------------------------------------------------------------------

test("comfort: five independent modes, each with its own class, all off by default", () => {
  assert.deepEqual(MODES, ["focus", "low", "time", "one", "momentum"]);
  assert.equal(new Set(Object.values(CLASS)).size, 5);
  const off = defaults().adhd;
  for (const mode of MODES) assert.equal(off[mode], false);
  const some = createStore({ storage: new FakeStorage() });
  some.update((r) => { r.adhd.focus = true; r.adhd.one = true; });
  assert.deepEqual(MODES.filter((m) => some.get().adhd[m]), ["focus", "one"], "modes combine freely");
  assert.deepEqual(cardsOf(null), []);
});

// ---- text ----------------------------------------------------------------------------------------

test("i18n: the three language modes, with a fallback to English and a visible key when nothing matches", () => {
  let mode = "en";
  const tr = createI18n(() => mode);
  assert.equal(tr("save"), "Save");
  mode = "yue";
  assert.equal(tr("save"), "儲存");
  mode = "both";
  assert.equal(tr("save"), "Save · 儲存");
  assert.match(tr("narrationNoYue"), /\n/, "long pairs wrap onto two lines");
  assert.equal(tr("vocabLoaded", { count: 3 }), "Loaded: 3 entries · 已載入：3 項", "short pairs share one line");
  assert.equal(tr("noSuchKeyAnywhere"), "noSuchKeyAnywhere");
  assert.equal(tr.en("save"), "Save");
  assert.equal(tr.yue("save"), "儲存");
});

// ---- dim sum -------------------------------------------------------------------------------------

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("dim sum: about one launch in ten draws a surprise", () => {
  const random = seeded(7);
  let hits = 0;
  const n = 100000;
  for (let i = 0; i < n; i++) if (dimsum.drawHit(random)) hits++;
  assert.ok(hits / n > 0.095 && hits / n < 0.105, `${hits / n} is about 0.1`);
  assert.equal(dimsum.RATE, 0.1);
  assert.equal(dimsum.drawHit(() => 0.0999), true);
  assert.equal(dimsum.drawHit(() => 0.1), false);
});

function dimsumHarness({ random = () => 0, school = false, launches = 5, blocked = [] } = {}) {
  const store = createStore({ storage: new FakeStorage() });
  store.update((r) => void (r.dimsum.launches = launches));
  const timers = [];
  const body = { children: [], append(el) { this.children.push(el); } };
  const doc = { body, querySelector: (sel) => (blocked.find((b) => sel.includes(b.sel)) ? {} : null) };
  const calls = { fetched: 0, sounds: [] };
  const ctx = {
    h: (tag, props, ...kids) => ({ tag, props, kids: kids.flat(), remove() { body.children = body.children.filter((c) => c !== this); } }),
    icon: () => null, getLang: () => "both", state: { route: "overview" }, dock: { count: () => 0 }, notice() {},
    api: { get: async () => { calls.fetched++; return { dish: { id: "hk-dish-0001", en: "Classic Har Gow", zhHant: "蝦餃", altEn: "Har gow", altYue: "蝦餃" }, photo: { dataUrl: "data:image/png;base64,AA==" } }; } },
  };
  const session = new FakeStorage();
  const d = dimsum.createDimsum({ doc, ctx, getRecord: store.get, tr: Object.assign((k) => k, { en: (k) => k }), store, sounds: { play: (c) => calls.sounds.push(c) }, session, random, setTimer: (fn, ms) => timers.push({ fn, ms }) - 1, clearTimer() {}, isSchool: () => school });
  return { d, store, timers, body, calls, session };
}

test("dim sum: the draw happens once per session and never on the first launch or in School mode", async () => {
  const first = dimsumHarness({ launches: 0 });
  assert.deepEqual(first.d.maybeDraw(), { drawn: false, why: "first-launch" });
  assert.equal(first.timers.length, 0);
  assert.equal(first.store.get().dimsum.launches, 1, "the launch is counted");
  assert.deepEqual(first.d.maybeDraw(), { drawn: false, why: "already-drawn" }, "reloading never gives a second chance");
  assert.equal(first.store.get().dimsum.launches, 1);

  const school = dimsumHarness({ school: true });
  assert.deepEqual(school.d.maybeDraw(), { drawn: false, why: "school" });
  assert.equal(school.calls.fetched, 0);

  const miss = dimsumHarness({ random: () => 0.5 });
  assert.deepEqual(miss.d.maybeDraw(), { drawn: true, hit: false });
  assert.equal(miss.timers.length, 0);

  const hit = dimsumHarness();
  assert.deepEqual(hit.d.maybeDraw(), { drawn: true, hit: true });
  assert.equal(hit.timers.length, 1, "it waits a moment before appearing");
  assert.equal(hit.d.maybeDraw().why, "already-drawn", "a second call in the same session does nothing");
  hit.timers[0].fn();
  await new Promise((r) => setImmediate(r));
  assert.equal(hit.calls.fetched, 1, "exactly one fetch, exactly one card");
  assert.equal(hit.body.children.length, 1);
  assert.deepEqual(hit.calls.sounds, ["pop"]);
  assert.ok(hit.store.history().some((e) => e.kind === "dimsum-shown"));
  const [card] = hit.body.children;
  const img = card.kids.find((k) => k.tag === "img");
  assert.match(img.props.alt, /Har gow/, "the picture's text names the dish");
  assert.ok(card.kids.some((k) => k.tag === "figcaption"));
});

test("dim sum: it waits out errors, dialogs, running tasks and updates, then gives up quietly", async () => {
  for (const [sel, why] of [[".toast.bad", "error"], ["dialog[open]", "dialog"], [".spin", "task"]]) {
    assert.equal(dimsum.blockedBy({ doc: { querySelector: (s) => (s.includes(sel) ? {} : null) }, route: "overview", dockCount: 0 }), why);
  }
  assert.equal(dimsum.blockedBy({ doc: { querySelector: () => null }, route: "firmware", dockCount: 2 }), "update");
  assert.equal(dimsum.blockedBy({ doc: { querySelector: () => null }, route: "overview", dockCount: 2 }), null);
  const busy = dimsumHarness({ blocked: [{ sel: ".spin" }] });
  busy.d.maybeDraw();
  for (let i = 0; i < dimsum.RETRIES + 2 && busy.timers[i]; i++) busy.timers[i].fn();
  await new Promise((r) => setImmediate(r));
  assert.equal(busy.calls.fetched, 0, "nothing is fetched or shown while a task is running");
  assert.equal(busy.body.children.length, 0);
  assert.ok(busy.store.history().some((e) => e.kind === "dimsum-omitted" && e.data.why === "task"), "giving up is recorded");
  assert.equal(busy.timers.length, dimsum.RETRIES + 1, "a bounded number of retries");
});
