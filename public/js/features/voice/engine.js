// The engine ties the pieces together while the app is open: the saved record,
// the page layer, sounds, narration, the schedule, School mode, the comfort
// modes, the drop target and the dim sum surprise. The screens and settings
// sections only talk to this object. It is created once and started and stopped
// as the app shell is built and torn down.
import { createAdhd, lowStimulationOn } from "./adhd.js";
import { createDimsum } from "./dimsum.js";
import { createDomLayer, visibleText } from "./dom.js";
import { createI18n } from "./i18n.js";
import { createNarrator } from "./narrator.js";
import { SETTING_KEYS, plan, resolve, validateRule } from "./schedule.js";
import { createLock, verifyLock } from "./school.js";
import { createSounds } from "./sounds.js";
import { SHIPPED_NAME, createStore } from "./store.js";
import { LIMITS, VocabError, compile, loadStored, parseVocabulary, serialize } from "./vocab.js";

const LANG_LABEL = { en: "EN", yue: "粵", both: "EN+粵" };
export const CELEBRATE_MS = 3000;

export function createEngine(ctx, { store = createStore(), doc = globalThis.document, win = globalThis.window } = {}) {
  const tr = createI18n(() => ctx.getLang());
  const listeners = new Map();
  const events = {
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name).delete(fn);
    },
    emit(name, detail) {
      for (const fn of listeners.get(name) ?? []) {
        try {
          fn(detail);
        } catch {}
      }
    },
  };
  const rec = () => store.get();
  const schoolOn = () => rec().school.on;

  // ---- services ----
  const sounds = createSounds({ getSettings: rec, isLowStimulation: () => lowStimulationOn(rec()) });
  const narrator = createNarrator({
    synth: globalThis.speechSynthesis,
    Utterance: globalThis.SpeechSynthesisUtterance,
    getSettings: rec,
    getLang: () => ctx.getLang(),
    onState: (what) => (what?.voices || what?.error) && events.emit("narrator", what),
  });

  // ---- personal wording ----
  let vocab = { state: "none" };
  function loadVocabulary() {
    vocab = loadStored(store.vocabulary.read());
    if (vocab.state === "damaged") {
      store.vocabulary.clear();
      store.append("vocab-purged", { why: vocab.code });
      ctx.notice?.("warn", tr.en("vocabDamagedNotice"));
    }
  }

  const config = () => ({
    shipped: SHIPPED_NAME,
    displayName: rec().name,
    replace: schoolOn() || vocab.state !== "loaded" ? null : vocab.replace,
    tone: rec().tone,
    mode: ctx.getLang(),
    emoji: rec().tone.emoji,
    school: schoolOn(),
  });

  let dom = null;
  const dim = createDimsum({ doc, ctx, getRecord: rec, tr, store, sounds, session: safeSession(), isSchool: schoolOn, lowStimulation: () => lowStimulationOn(rec()) });
  const adhd = createAdhd({ doc, ctx, getRecord: rec, tr, onCounts: { exitFocus: () => setAdhd("focus", false) } });

  function safeSession() {
    try {
      return globalThis.sessionStorage ?? null;
    } catch {
      return null;
    }
  }

  // ---- language and theme live in the app core; the switch buttons are the way in ----
  function setLanguage(mode) {
    if (!LANG_LABEL[mode] || ctx.getLang() === mode) return true;
    const button = [...doc.querySelectorAll(".bar [role='radiogroup'] button")].find((b) => b.textContent.trim() === LANG_LABEL[mode]);
    if (!button) return false;
    button.click();
    return true;
  }
  const readTheme = () => {
    try {
      return win.localStorage.getItem("mar.theme") || "auto";
    } catch {
      return "auto";
    }
  };
  function setTheme(value) {
    if (value === "auto") delete doc.documentElement.dataset.theme;
    else doc.documentElement.dataset.theme = value;
    try {
      win.localStorage.setItem("mar.theme", value);
    } catch {}
  }

  // ---- appearance: density, font, colour, motion ----
  function applyLook() {
    const { look, adhd: a } = rec();
    const root = doc.documentElement;
    root.classList.toggle("vx-compact", look.density === "compact");
    root.classList.toggle("vx-font-large", look.font === "large");
    root.classList.toggle("vx-font-system", look.font === "system");
    root.classList.toggle("vx-motion-reduced", look.motion === "reduced" || a.low);
    if (look.accent) root.style.setProperty("--accent", look.accent);
    else root.style.removeProperty("--accent");
  }
  function setLook(key, value, by = "person") {
    store.update((r) => void (r.look[key] = value), "look");
    applyLook();
    store.append("look", { setting: key, value: String(value), by });
  }

  // ---- display name ----
  function setName(text) {
    const before = rec().name;
    const next = String(text ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
    if (next === before || (!next && !before)) return { ok: true, unchanged: true };
    if (next.toLowerCase() === SHIPPED_NAME.toLowerCase()) return setName("");
    store.update((r) => void (r.name = next), "name");
    store.append(next ? "rename" : "rename-reset", { from: before || SHIPPED_NAME, to: next || SHIPPED_NAME });
    dom?.refresh();
    return { ok: true, name: next };
  }

  // ---- personal wording: apply, refuse, clear ----
  function applyVocabularyText(text, { source = "settings" } = {}) {
    if (schoolOn()) return { ok: false, code: "SCHOOL" };
    try {
      const parsed = parseVocabulary(text);
      const stored = serialize(parsed);
      if (!store.vocabulary.write(stored)) store.vocabulary.write(stored);
      vocab = { state: "loaded", ...parsed, replace: compile(parsed.entries) };
      store.append("vocab-applied", { count: parsed.count, source });
      dom?.refresh();
      events.emit("vocab");
      return { ok: true, name: parsed.name, count: parsed.count };
    } catch (error) {
      const code = error instanceof VocabError ? error.code : "BAD";
      store.append("vocab-refused", { code, source });
      return { ok: false, code, detail: error.detail ?? "" };
    }
  }
  function clearVocabulary() {
    store.vocabulary.clear();
    vocab = { state: "none" };
    store.append("vocab-cleared", {});
    dom?.refresh();
    events.emit("vocab");
  }
  const vocabState = () => ({ state: vocab.state, name: vocab.name ?? "", count: vocab.count ?? 0 });

  // Reads a chosen or dropped file and applies it. The file's content is never
  // logged or kept anywhere but the validated local copy.
  async function applyVocabularyFile(file, { source }) {
    if (schoolOn()) return { ok: false, code: "SCHOOL" };
    if (!file) return refuse("NOT_JSON", source);
    if (file.size > LIMITS.bytes) return refuse("TOO_BIG", source);
    if (!/\.json$/i.test(file.name ?? "") && !/json/i.test(file.type ?? "")) return refuse("NOT_JSON", source);
    let text;
    try {
      text = await file.text();
    } catch {
      return refuse("NOT_JSON", source);
    }
    const result = applyVocabularyText(text, { source });
    result.ok ? celebrate(result.name) : reject(result.code);
    return result;
  }
  function refuse(code, source) {
    store.append("vocab-refused", { code, source });
    reject(code);
    return { ok: false, code };
  }
  function reject(code) {
    sounds.play("invalid");
    const message = tr(`vocabError_${code}`);
    ctx.toast(message, "bad");
    dom?.announce(tr.en(`vocabError_${code}`));
  }

  // The full-window celebration: animates in, holds about three seconds, animates out.
  function celebrate(name) {
    const calm = lowStimulationOn(rec()) || rec().look.motion === "reduced" || win.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const headline = name || tr("vocabApplied");
    const el = ctx.h("div", { class: `vx-celebrate ${calm ? "calm" : ""}`, role: "status", "aria-live": "polite" },
      ctx.h("div", { class: "vx-celebrate-card" }, ctx.icon("celebration", "lg"), ctx.h("div", { class: "disp" }, headline), name ? ctx.h("div", { class: "lede" }, tr("vocabApplied")) : null));
    doc.body.append(el);
    sounds.play("tada");
    dom?.announce(tr.en("vocabApplied"));
    requestAnimationFrame?.(() => el.classList.add("in"));
    setTimeout(() => el.classList.add("out"), CELEBRATE_MS);
    setTimeout(() => el.remove(), CELEBRATE_MS + 700);
    return el;
  }

  // ---- drop a file anywhere on the window ----
  const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes("Files");
  const onDrag = (e) => {
    if (!hasFiles(e) || schoolOn()) return;
    e.preventDefault();
    doc.body.classList.add("vx-dropping");
  };
  const onLeave = (e) => {
    if (e.relatedTarget === null) doc.body.classList.remove("vx-dropping");
  };
  const onDrop = (e) => {
    doc.body.classList.remove("vx-dropping");
    if (!hasFiles(e) || schoolOn() || e.defaultPrevented || e.target?.closest?.(".drop")) return;
    e.preventDefault();
    const files = [...(e.dataTransfer.files ?? [])];
    if (files.length !== 1) return void refuse("ONE_FILE", "drop");
    applyVocabularyFile(files[0], { source: "drop" });
  };

  // ---- School mode ----
  let pendingRestore = false;
  function enforceSchool() {
    const on = schoolOn();
    doc.documentElement.classList.toggle("vx-school", on);
    if (on) {
      if (ctx.getLang() !== "en") setLanguage("en");
      dim.stop();
    } else if (rec().school.prevLang) {
      pendingRestore = true;
    }
    dom?.refresh();
    events.emit("school");
  }
  function restoreLanguage() {
    const prev = rec().school.prevLang;
    if (!pendingRestore || !prev || schoolOn()) return;
    pendingRestore = false;
    store.update((r) => void (r.school.prevLang = null), "school-restore");
    if (prev !== ctx.getLang()) setLanguage(prev);
  }
  async function enableSchool(kind, secret) {
    const existing = rec().school.lock;
    let lock = existing;
    if (!lock) {
      try {
        lock = await createLock(kind, secret);
      } catch (error) {
        return { ok: false, code: error.message };
      }
    } else if (!(await verifyLock(lock, secret))) return { ok: false, code: "WRONG" };
    store.update((r) => {
      r.school.on = true;
      r.school.lock = lock;
      r.school.prevLang = ctx.getLang();
    }, "school");
    store.append("school-on", { label: rec().school.label, lock: lock.kind });
    enforceSchool();
    return { ok: true };
  }
  async function disableSchool(secret) {
    const lock = rec().school.lock;
    if (!lock || !(await verifyLock(lock, secret))) {
      store.append("school-off-refused", {});
      return { ok: false, code: "WRONG" };
    }
    store.update((r) => void (r.school.on = false), "school");
    store.append("school-off", { label: rec().school.label });
    doc.documentElement.classList.remove("vx-school");
    events.emit("school");
    // The language switch was removed from the bar; rebuilding the shell brings it back,
    // and the language the person had before is restored when the engine starts again.
    pendingRestore = Boolean(rec().school.prevLang);
    ctx.bus.emit("lang");
    return { ok: true };
  }
  async function changeLock(kind, secret, current) {
    const lock = rec().school.lock;
    if (lock && !(await verifyLock(lock, current))) return { ok: false, code: "WRONG" };
    try {
      const next = await createLock(kind, secret);
      store.update((r) => void (r.school.lock = next), "school");
      store.append("school-lock-changed", { lock: kind });
      return { ok: true };
    } catch (error) {
      return { ok: false, code: error.message };
    }
  }
  function renameSchool(label) {
    const next = String(label ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40) || "School mode";
    const before = rec().school.label;
    if (next === before) return;
    store.update((r) => void (r.school.label = next), "school-label");
    store.append("school-renamed", { from: before, to: next });
  }

  // ---- comfort modes ----
  function setAdhd(key, on) {
    store.update((r) => void (r.adhd[key] = Boolean(on)), "adhd");
    store.append("adhd", { mode: key, on: Boolean(on) });
    applyLook();
    adhd.refresh();
    events.emit("adhd");
  }

  // ---- narration and sounds helpers ----
  const speak = (text, priority = "normal") => narrator.speak(text, { priority });

  // ---- the schedule ----
  const ext = { api: null, ha: null };
  const extStatus = { api: { state: "idle" }, ha: { state: "idle" } };
  const streak = { api: 0, ha: 0 };
  const nextAt = { api: 0, ha: 0 };
  let previous = {};
  let timers = [];

  const currentValues = () => ({ language: ctx.getLang(), theme: readTheme(), density: rec().look.density, font: rec().look.font, accent: rec().look.accent, motion: rec().look.motion });

  function applyValue(key, value) {
    if (key === "language") return schoolOn() ? false : setLanguage(value);
    if (key === "theme") return void setTheme(value);
    if (key === "accent" || key === "density" || key === "font" || key === "motion") return setLook(key, value, "schedule");
  }

  // What the rules ask for right now, with no side effects (the screens use this).
  function evaluate(now = new Date()) {
    return resolve(rec().schedule.rules, now, usableExt());
  }

  function check(now = new Date()) {
    const { rules } = rec().schedule;
    const { active, values } = resolve(rules, now, usableExt());
    const current = currentValues();
    const result = plan({ values, base: rec().base, current, previous: previousValues(values) });
    const changed = Object.keys(result.apply).length + Object.keys(result.restore).length;
    for (const [key, value] of Object.entries(result.apply)) applyValue(key, value);
    for (const [key, value] of Object.entries(result.restore)) applyValue(key, value);
    previous = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.value]));
    if (JSON.stringify(result.base) !== JSON.stringify(rec().base)) store.update((r) => void (r.base = result.base), "schedule-base");
    if (changed) {
      store.append("schedule-applied", { rules: active.join(","), applied: Object.keys(result.apply).join(","), restored: Object.keys(result.restore).join(",") });
      sounds.play("notice");
      ctx.toast(tr("scheduleSwitched"));
    }
    events.emit("schedule");
    return { active, values, ...result };
  }
  const previousValues = () => previous;
  const usableExt = () => {
    const out = {};
    for (const key of ["api", "ha"]) if (ext[key]) out[key] = ext[key];
    return out;
  };

  async function refreshExternal(source, { manual = false } = {}) {
    const cfg = rec().schedule[source];
    const token = store.secrets.read()[source];
    const minutes = cfg.refreshMinutes;
    nextAt[source] = Date.now() + Math.min(60, minutes * 2 ** Math.min(streak[source], 6)) * 60000;
    extStatus[source] = { state: "checking", at: Date.now() };
    events.emit("schedule");
    try {
      if (!cfg.url) throw Object.assign(new Error("url"), { code: "NOT_CONFIGURED" });
      const body = source === "api" ? { url: cfg.url, token } : { url: cfg.url, entity: cfg.entity, token };
      const result = await ctx.api.post(source === "api" ? "/api/x/voice/external/api" : "/api/x/voice/external/home-assistant", body);
      ext[source] = { active: result.active, settings: result.settings ?? {}, validUntil: result.validUntil ?? null };
      extStatus[source] = { state: "ok", at: Date.now(), active: result.active };
      streak[source] = 0;
    } catch (error) {
      // Fail safe: keep the last good answer, say so, and tell the person once per streak.
      streak[source]++;
      extStatus[source] = { state: "failed", at: Date.now(), code: error.code ?? "UNAVAILABLE", message: error.message, stale: Boolean(ext[source]) };
      if (streak[source] === 1 || manual) {
        store.append("schedule-source-failed", { source, code: error.code ?? "UNAVAILABLE" });
        ctx.notice?.("warn", `${tr.en(source === "api" ? "scheduleApiFailed" : "scheduleHaFailed")} (${error.code ?? "UNAVAILABLE"})`);
        if (manual) ctx.toast(`${tr(source === "api" ? "scheduleApiFailed" : "scheduleHaFailed")} (${error.code ?? "UNAVAILABLE"})`, "bad");
      }
    }
    check();
  }

  function pollSources(now = Date.now()) {
    const used = new Set(rec().schedule.rules.filter((r) => r.enabled && r.source !== "local").map((r) => r.source));
    for (const source of used) if (now >= nextAt[source] && extStatus[source].state !== "checking") refreshExternal(source);
  }

  function saveRule(input) {
    const checked = validateRule(input);
    if (!checked.ok) return checked;
    const rules = [...rec().schedule.rules];
    const i = rules.findIndex((r) => r.id === checked.rule.id);
    if (i < 0 && rules.length >= 40) return { ok: false, errors: ["too-many"] };
    if (i < 0) rules.push(checked.rule);
    else rules[i] = checked.rule;
    store.update((r) => void (r.schedule.rules = rules), "schedule");
    store.append(i < 0 ? "schedule-rule-added" : "schedule-rule-changed", { rule: checked.rule.name, source: checked.rule.source });
    nextAt.api = nextAt.ha = 0;
    check();
    return checked;
  }
  function removeRule(id) {
    const rule = rec().schedule.rules.find((r) => r.id === id);
    if (!rule) return;
    store.update((r) => void (r.schedule.rules = r.schedule.rules.filter((x) => x.id !== id)), "schedule");
    store.append("schedule-rule-removed", { rule: rule.name });
    check();
  }
  function moveRule(id, delta) {
    const rules = [...rec().schedule.rules];
    const i = rules.findIndex((r) => r.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= rules.length) return;
    [rules[i], rules[j]] = [rules[j], rules[i]];
    store.update((r) => void (r.schedule.rules = rules), "schedule");
    store.append("schedule-rule-moved", { rule: rules[j].name, to: j + 1 });
    check();
  }
  function configureSource(source, patch, token) {
    store.update((r) => void Object.assign(r.schedule[source], patch), "schedule");
    if (token !== undefined) store.secrets.write({ [source]: token });
    store.append("schedule-source-changed", { source });
    nextAt[source] = 0;
    events.emit("schedule");
  }

  // ---- page hooks: toasts, dialogs and screen titles drive sounds and narration ----
  function added(el) {
    if (el.matches?.(".toast")) {
      const bad = el.classList.contains("bad");
      sounds.play(bad ? "error" : "success");
      speak(visibleText(el), bad ? "error" : "normal");
    } else if (el.matches?.("dialog")) {
      if (el.querySelector(".btn.d")) sounds.play("warn");
      const heading = el.querySelector("h2");
      if (heading) speak(visibleText(heading));
    } else if (el.matches?.(".page")) {
      const heading = el.querySelector("h1");
      if (heading && !el.querySelector(".empty .spin")) speak(visibleText(heading));
    }
  }

  // ---- first-run disclosure of the funny levels ----
  function discloseTone() {
    if (rec().tone.disclosed || schoolOn()) return;
    store.update((r) => void (r.tone.disclosed = true), "tone-disclosed");
    ctx.openDialog((close) => [
      ctx.h("h2", { class: "h2" }, tr("toneDisclosureTitle")),
      ctx.h("p", { class: "muted" }, tr("toneDisclosureBody")),
      ctx.h("div", { class: "actions" },
        ctx.h("button", { class: "btn o", onClick: () => close() }, tr("toneDisclosureKeep")),
        ctx.h("button", { class: "btn f", onClick: () => { close(); ctx.navigate("voice"); } }, tr("toneDisclosureOpen"))),
    ], { label: tr.en("toneDisclosureTitle") });
  }

  // ---- lifecycle ----
  let running = false;
  const offs = [];
  function start() {
    if (running) stop();
    running = true;
    loadVocabulary();
    dom = createDomLayer({ doc, getConfig: config, hooks: { added } });
    applyLook();
    dom.start();
    adhd.start();
    offs.push(narrator.watchVoices());
    enforceSchool();
    restoreLanguage();
    offs.push(
      store.subscribe((_, why) => {
        if (why === "history") events.emit("history");
        if (why === "remote") {
          loadVocabulary();
          applyLook();
          enforceSchool();
          adhd.refresh();
          events.emit("remote");
        }
      }),
      ctx.bus.on("lang", () => {
        dom?.refresh();
        if (schoolOn() && ctx.getLang() !== "en") setLanguage("en");
      }),
      ctx.bus.on("changed", () => sounds.play("applied")),
    );
    const onStorage = (e) => {
      if (e.key === "mar.voice.v1" || e.key === "mar.voice.vocab.v1") store.reload("remote");
    };
    win.addEventListener("storage", onStorage);
    win.addEventListener("dragenter", onDrag);
    win.addEventListener("dragover", onDrag);
    win.addEventListener("dragleave", onLeave);
    win.addEventListener("drop", onDrop);
    offs.push(() => {
      win.removeEventListener("storage", onStorage);
      win.removeEventListener("dragenter", onDrag);
      win.removeEventListener("dragover", onDrag);
      win.removeEventListener("dragleave", onLeave);
      win.removeEventListener("drop", onDrop);
    });
    timers = [setInterval(() => { check(); pollSources(); }, 30000)];
    check();
    pollSources();
    dim.maybeDraw();
    setTimeout(discloseTone, 1200);
  }
  function stop() {
    running = false;
    offs.splice(0).forEach((f) => f());
    timers.forEach(clearInterval);
    timers = [];
    dom?.stop();
    adhd.stop();
    dim.stop();
    narrator.stop?.();
    doc.querySelectorAll(".vx-celebrate").forEach((e) => e.remove());
    doc.documentElement.classList.remove("vx-school");
  }

  return {
    ctx, store, tr, events, sounds, narrator, dim, get dom() { return dom; },
    rec, start, stop, speak, setLanguage, setTheme, readTheme, setLook, setName, setAdhd,
    vocab: { state: vocabState, applyText: applyVocabularyText, applyFile: applyVocabularyFile, clear: clearVocabulary },
    school: { on: schoolOn, enable: enableSchool, disable: disableSchool, changeLock, rename: renameSchool },
    schedule: { check, evaluate, refreshExternal, saveRule, removeRule, moveRule, configureSource, status: () => ({ ...extStatus }), ext: () => ({ ...ext }) },
    celebrate, applyLook, settingKeys: SETTING_KEYS,
  };
}
