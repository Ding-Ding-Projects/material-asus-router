// The panels: one card per area of this feature. The "Voice and comfort" screen
// shows all of them, and each one is also a section on the Feature settings
// screen, so every control is reachable from the rail, from Settings and from
// the command palette. School mode leaves out (rather than greys out) the panels
// that do not apply to it.
import { kit } from "./controls.js";
import { CUES, CUE_MAP } from "./sounds.js";
import { ASIDES, CATEGORIES, LEVEL_NAMES, asideFor } from "./tone.js";
import { LIMITS } from "./vocab.js";
import { PITCH, RATE, voicesFor, voiceKey } from "./narrator.js";
import { SETTINGS, timeZones, validateRule, newRuleId } from "./schedule.js";
import { PASSWORD_MAX, PASSWORD_MIN } from "./school.js";

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_KEYS = ["daySun", "dayMon", "dayTue", "dayWed", "dayThu", "dayFri", "daySat"];

export const PANELS = [
  { id: "language", icon: "translate", label: { en: "Language", yue: "語言" }, school: false },
  { id: "tone", icon: "mood", label: { en: "Funny levels", yue: "搞笑程度" }, school: false },
  { id: "wording", icon: "spellcheck", label: { en: "Personal wording", yue: "個人用詞" }, school: false },
  { id: "sounds", icon: "volume_up", label: { en: "Action sounds", yue: "動作音效" }, school: true },
  { id: "narration", icon: "record_voice_over", label: { en: "Narrator", yue: "朗讀" }, school: true },
  { id: "look", icon: "palette", label: { en: "Appearance and motion", yue: "外觀同動態" }, school: true },
  { id: "schedule", icon: "schedule", label: { en: "Scheduled settings", yue: "排程設定" }, school: true },
  { id: "name", icon: "badge", label: { en: "App name", yue: "程式名稱" }, school: true },
  { id: "comfort", icon: "self_improvement", label: { en: "ADHD modes", yue: "ADHD 模式" }, school: true },
  { id: "school", icon: "school", label: { en: "School mode", yue: "校園模式" }, school: true },
  { id: "dimsum", icon: "ramen_dining", label: { en: "Dim sum", yue: "點心" }, school: false },
  { id: "history", icon: "history", label: { en: "History and about", yue: "紀錄同關於" }, school: true },
];

export function buildPanels(engine) {
  const { ctx, tr, store } = engine;
  const { h, icon, clear } = ctx;
  const K = kit(ctx);
  const rec = engine.rec;
  const label = (key) => tr(key);
  const log = (name, value) => store.append("setting", { name, value: String(value) });

  // A panel that redraws itself when the language, School mode or another tab changes.
  function live(id, build) {
    return () => {
      const host = h("div", { class: "vx-panel", "data-panel": id });
      const draw = () => {
        clear(host);
        const out = build(draw);
        if (out) host.append(...[out].flat());
      };
      draw();
      const stops = ["remote", "school", "vocab", "adhd", "schedule", "narrator", "history"].map((name) =>
        engine.events.on(name, () => {
          if (!host.isConnected) return void stops.forEach((s) => s());
          // Only redraw for what this panel shows, so typing in another panel is never interrupted.
          if (name === "remote" || name === "school" || relevant(id, name)) draw();
        }));
      return host;
    };
  }
  const relevant = (id, name) => ({ wording: "vocab", comfort: "adhd", schedule: "schedule", narration: "narrator", history: "history" })[id] === name;

  // ---------------------------------------------------------------- language
  const language = live("language", () => {
    const current = ctx.getLang();
    return K.card("language", label("panelLanguage"), "translate", label("languageLede"),
      K.row(label("languageMode"), label("languageModeHelp"), K.seg(label("languageMode"), [["en", "English"], ["yue", "廣東話"], ["both", "English + 廣東話"]], current, (v) => { engine.setLanguage(v); store.append("setting", { name: "language", value: v }); })),
      h("div", { class: "note" }, icon("translate"), h("div", {}, h("div", { class: "t1" }, label("languageSample")), h("div", { class: "t2" }, label("languageSampleHelp")))));
  });

  // ---------------------------------------------------------------- tone
  const tone = live("tone", (redraw) => {
    const t = rec().tone;
    const level = (lang, value) => `${value} · ${LEVEL_NAMES[lang][value - 1]}`;
    const slide = (lang, title) => {
      const control = K.slider({ label: title, min: 1, max: 5, value: t[lang], format: (v) => level(lang, v), onInput: () => {}, onCommit: (v) => { store.update((r) => void (r.tone[lang] = v), "tone"); log(`tone.${lang}`, v); preview(); engine.dom?.refresh(); } });
      return K.row(title, label(lang === "en" ? "toneEnglishHelp" : "toneYueHelp"), h("div", { class: "vx-inline" }, control, K.btn(label("reset"), () => { store.update((r) => void (r.tone[lang] = 5), "tone"); log(`tone.${lang}`, 5); engine.dom?.refresh(); redraw(); }, { kind: "o" })));
    };
    const previewBox = h("div", { class: "vx-preview" });
    const preview = () => {
      clear(previewBox);
      for (const category of CATEGORIES) previewBox.append(h("div", { class: "vx-pv" }, h("span", { class: "k" }, label(`kind_${category}`)), h("span", {}, asideFor(category, rec().tone, ctx.getLang()) || label("toneNothingAdded"))));
    };
    const card = K.card("tone", label("panelTone"), "mood", label("toneLede"),
      slide("en", label("toneEnglish")), slide("yue", label("toneYue")),
      K.row(label("toneEmoji"), label("toneEmojiHelp"), K.sw(label("toneEmoji"), t.emoji, (on) => { store.update((r) => void (r.tone.emoji = on), "tone"); log("tone.emoji", on); engine.dom?.refresh(); })),
      K.note("", label("toneDisclosure")),
      h("h3", { class: "t1" }, label("tonePreview")), previewBox);
    preview();
    return card;
  });
  // ---------------------------------------------------------------- personal wording
  const wording = live("wording", () => {
    const v = engine.vocab.state();
    const input = h("input", { class: "sr", type: "file", accept: ".json,application/json", tabindex: "-1", onChange: async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) await engine.vocab.applyFile(file, { source: "settings" });
    } });
    const status = {
      none: label("vocabNone"),
      loaded: tr("vocabLoaded", { count: v.count }),
    }[v.state] ?? label("vocabNone");
    return K.card("wording", label("panelWording"), "spellcheck", label("wordingLede"),
      K.row(label("vocabStatus"), v.state === "loaded" && v.name ? h("span", { class: "vx-literal" }, v.name) : null, h("span", { class: `tag ${v.state === "loaded" ? "good" : ""}` }, status)),
      h("div", { class: "actions vx-actions" },
        input,
        K.btn(v.state === "loaded" ? label("vocabReplace") : label("vocabChoose"), () => input.click(), { kind: "f", iconName: "upload_file" }),
        v.state === "loaded" ? K.btn(label("vocabClear"), async () => { if (await ctx.confirmDialog({ title: label("vocabClearTitle"), body: label("vocabClearBody"), confirm: label("vocabClear"), danger: true })) engine.vocab.clear(); }, { kind: "o", iconName: "delete" }) : null),
      K.note("", label("vocabDrop")),
      K.note("", label("vocabLocal")),
      h("details", { class: "vx-details" }, h("summary", {}, label("vocabSchema")), h("pre", { class: "vx-literal vx-code" }, SCHEMA_SAMPLE), h("p", { class: "t2" }, tr("vocabLimits", { bytes: LIMITS.bytes / 1024, depth: LIMITS.depth, key: LIMITS.keyChars, value: LIMITS.valueChars, entries: LIMITS.entries }))));
  });

  // ---------------------------------------------------------------- sounds
  const sounds = live("sounds", (redraw) => {
    const s = rec().sound;
    const set = (path, value) => { store.update((r) => { const [a, b] = path.split("."); if (b) r.sound[a][b] = value; else r.sound[a] = value; }, "sound"); log(`sound.${path}`, value); };
    const last = engine.sounds.state.last;
    const time = (key, value) => h("input", { class: "field vx-time-input", type: "time", value, "aria-label": label(key), onChange: (e) => e.target.value && set(`quiet.${key === "quietFrom" ? "from" : "to"}`, e.target.value) });
    return K.card("sounds", label("panelSounds"), "volume_up", label("soundsLede"),
      K.row(label("soundsOn"), label("soundsOnHelp"), K.sw(label("soundsOn"), s.on, (v) => set("on", v))),
      K.row(label("soundsMute"), label("soundsMuteHelp"), K.sw(label("soundsMute"), s.muted, (v) => set("muted", v))),
      K.row(label("soundsVolume"), null, K.slider({ label: label("soundsVolume"), min: 0, max: 100, step: 5, value: s.volume, format: (v) => `${v}%`, onCommit: (v) => set("volume", v) })),
      K.row(label("soundsReduced"), label("soundsReducedHelp"), K.sw(label("soundsReduced"), s.reduced, (v) => set("reduced", v))),
      K.row(label("soundsQuiet"), label("soundsQuietHelp"), h("div", { class: "vx-inline" }, K.sw(label("soundsQuiet"), s.quiet.on, (v) => set("quiet.on", v)), time("quietFrom", s.quiet.from), h("span", {}, label("soundsTo")), time("quietTo", s.quiet.to))),
      h("h3", { class: "t1" }, label("soundsMap")),
      h("p", { class: "t2" }, label("soundsProvenance")),
      h("div", { class: "vx-table", role: "table" }, CUE_MAP.map((c) =>
        h("div", { class: "vx-trow", role: "row" }, h("span", { class: "vx-literal t1" }, c.cue), h("span", { class: "t2 grow" }, ctx.t(c.when.en, c.when.yue)), K.btn(label("soundsTest"), () => { engine.sounds.play(c.cue); redraw(); }, { kind: "o", iconName: "play_arrow" })))),
      last ? K.note(last.play ? "" : "warn", last.play ? tr("soundsPlayed", { cue: last.cue }) : tr("soundsNotPlayed", { cue: last.cue, why: label(`why_${last.reason}`) })) : null,
      !engine.sounds.state.available ? K.note("warn", label("soundsUnavailable")) : null);
  });

  // ---------------------------------------------------------------- narrator
  const narration = live("narration", (redraw) => {
    const n = rec().narration;
    const nar = engine.narrator;
    const set = (patch) => { store.update((r) => Object.assign(r.narration, patch), "narration"); };
    const pick = (lang, title) => {
      const voices = voicesFor(nar.voices, lang);
      const effective = nar.effective(lang);
      const select = h("select", { class: "field", "aria-label": title, onChange: (e) => {
        const chosen = voices.find((v) => v.voiceURI === e.target.value);
        store.update((r) => void (r.narration.voices[lang] = chosen ? voiceKey(chosen) : null), "narration");
        log(`narration.voice.${lang}`, chosen ? chosen.name : "auto");
        redraw();
      } },
      h("option", { value: "" }, label("narrationAuto")),
      voices.map((v) => h("option", { value: v.voiceURI, selected: n.voices[lang]?.uri === v.voiceURI || (!n.voices[lang]?.uri && n.voices[lang]?.name === v.name) }, `${v.name} (${v.lang})`)));
      const state = !voices.length ? label(lang === "yue" ? "narrationNoYue" : "narrationNoEn") : effective.voice ? tr("narrationEffective", { name: effective.voice.name, lang: effective.voice.lang }) : label("narrationNoVoice");
      return K.row(title, state, h("div", { class: "vx-inline" }, select, K.btn(label("narrationTest"), () => engine.narrator.speak(label(lang === "yue" ? "narrationSampleYue" : "narrationSampleEn"), { priority: "error" }), { kind: "o", iconName: "play_arrow", disabled: !voices.length })));
    };
    return K.card("narration", label("panelNarration"), "record_voice_over", label("narrationLede"),
      !nar.state.available ? K.note("warn", label("narrationUnavailable")) : null,
      K.row(label("narrationOn"), label("narrationOnHelp"), K.sw(label("narrationOn"), n.on, (v) => { set({ on: v }); log("narration.on", v); if (v) engine.narrator.speak(label("narrationOnSpoken"), { priority: "error" }); else engine.narrator.stop(); }, { disabled: !nar.state.available })),
      K.row(label("narrationScreenReader"), label("narrationScreenReaderHelp"), K.sw(label("narrationScreenReader"), n.screenReader, (v) => { set({ screenReader: v }); log("narration.screenReader", v); })),
      pick("en", label("narrationVoiceEn")),
      pick("yue", label("narrationVoiceYue")),
      K.row(label("narrationRate"), null, K.slider({ label: label("narrationRate"), min: RATE.min, max: RATE.max, step: RATE.step, value: n.rate, format: (v) => `${v.toFixed(1)}×`, onCommit: (v) => { set({ rate: v }); log("narration.rate", v); } })),
      K.row(label("narrationPitch"), null, K.slider({ label: label("narrationPitch"), min: PITCH.min, max: PITCH.max, step: PITCH.step, value: n.pitch, format: (v) => v.toFixed(1), onCommit: (v) => { set({ pitch: v }); log("narration.pitch", v); } })),
      K.note("", label("narrationRules")),
      K.btn(label("narrationRefresh"), () => { nar.readVoices(); redraw(); }, { kind: "o", iconName: "refresh" }));
  });

  // ---------------------------------------------------------------- look
  const look = live("look", () => {
    const l = rec().look;
    const set = (key, v) => { engine.setLook(key, v); };
    const colour = h("input", { class: "vx-colour", type: "color", value: l.accent || "#4f5bd5", "aria-label": label("lookAccent"), onChange: (e) => set("accent", e.target.value) });
    return K.card("look", label("panelLook"), "palette", label("lookLede"),
      K.row(label("lookDensity"), null, K.seg(label("lookDensity"), [["comfortable", label("densityComfortable")], ["compact", label("densityCompact")]], l.density, (v) => set("density", v))),
      K.row(label("lookFont"), label("lookFontHelp"), K.seg(label("lookFont"), [["default", label("fontDefault")], ["large", label("fontLarge")], ["system", label("fontSystem")]], l.font, (v) => set("font", v))),
      K.row(label("lookAccent"), label("lookAccentHelp"), h("div", { class: "vx-inline" }, colour, K.btn(label("reset"), () => { set("accent", ""); colour.value = "#4f5bd5"; }, { kind: "o" }))),
      K.row(label("lookMotion"), label("lookMotionHelp"), K.seg(label("lookMotion"), [["full", label("motionFull")], ["reduced", label("motionReduced")]], l.motion, (v) => set("motion", v))),
      K.row(label("lookTheme"), label("lookThemeHelp"), K.seg(label("lookTheme"), [["auto", label("themeAuto")], ["light", label("themeLight")], ["dark", label("themeDark")]], engine.readTheme(), (v) => { engine.setTheme(v); log("theme", v); })));
  });

  // ---------------------------------------------------------------- schedule
  function describeRule(rule) {
    const days = rule.days.length ? rule.days.map((d) => label(DAY_KEYS[d])).join(", ") : label("scheduleEveryDay");
    const when = rule.source !== "local" ? label(rule.source === "api" ? "scheduleWhenApi" : "scheduleWhenHa") : rule.allDay ? label("scheduleAllDay") : `${rule.start}–${rule.end}`;
    const apply = Object.entries(rule.apply).map(([k, v]) => `${label(`set_${k}`)}: ${k === "accent" ? v : label(`val_${v}`)}`).join(" · ");
    return `${when} · ${days}${rule.tz !== "local" ? ` · ${rule.tz}` : ""} → ${apply || label("scheduleFromApi")}`;
  }

  function openRuleEditor(existing) {
    const draft = existing ? structuredClone(existing) : { id: newRuleId(rec().schedule.rules), name: "", enabled: true, source: "local", days: [1, 2, 3, 4, 5], allDay: false, start: "08:00", end: "17:00", tz: "local", from: "", to: "", apply: {} };
    return ctx.openDialog((close, render) => {
      const errors = draft.__errors ?? [];
      const field = (key, control) => h("label", { class: "lbl" }, label(key), control);
      const applyRow = (key) => {
        const options = key === "accent" ? null : SETTINGS[key];
        if (!options) return h("div", { class: "vx-inline" }, h("label", { class: "lbl" }, label("set_accent"), h("div", { class: "vx-inline" },
          h("input", { type: "checkbox", checked: "accent" in draft.apply, "aria-label": label("set_accent"), onChange: (e) => { if (e.target.checked) draft.apply.accent = draft.apply.accent ?? "#4f5bd5"; else delete draft.apply.accent; render(); } }),
          h("input", { class: "vx-colour", type: "color", disabled: !("accent" in draft.apply), value: draft.apply.accent ?? "#4f5bd5", "aria-label": label("set_accent"), onChange: (e) => (draft.apply.accent = e.target.value) }))));
        return field(`set_${key}`, h("select", { class: "field", onChange: (e) => { if (e.target.value) draft.apply[key] = e.target.value; else delete draft.apply[key]; } },
          h("option", { value: "" }, label("scheduleNoChange")), options.map((v) => h("option", { value: v, selected: draft.apply[key] === v }, label(`val_${v}`)))));
      };
      return [
        h("h2", { class: "h2" }, existing ? label("scheduleEditRule") : label("scheduleNewRule")),
        field("scheduleName", h("input", { class: "field", type: "text", maxlength: "60", value: draft.name, autocomplete: "off", onInput: (e) => (draft.name = e.target.value) })),
        field("scheduleSource", h("select", { class: "field", onChange: (e) => { draft.source = e.target.value; render(); } }, [["local", label("scheduleSourceLocal")], ["api", label("scheduleSourceApi")], ["ha", label("scheduleSourceHa")]].map(([v, t]) => h("option", { value: v, selected: draft.source === v }, t)))),
        draft.source === "local" ? [
          h("div", { class: "lbl" }, label("scheduleDays"), h("div", { class: "chips", role: "group", "aria-label": label("scheduleDays") }, DAYS.map((d) => h("button", { type: "button", class: `chip ${draft.days.includes(d) ? "on" : ""}`, "aria-pressed": String(draft.days.includes(d)), onClick: () => { draft.days = draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort(); render(); } }, label(DAY_KEYS[d]))))),
          h("div", { class: "t2" }, label("scheduleDaysHelp")),
          h("label", { class: "vx-inline" }, h("input", { type: "checkbox", checked: draft.allDay, onChange: (e) => { draft.allDay = e.target.checked; render(); } }), label("scheduleAllDay")),
          draft.allDay ? null : h("div", { class: "two" }, field("scheduleStart", h("input", { class: "field", type: "time", value: draft.start, onChange: (e) => (draft.start = e.target.value) })), field("scheduleEnd", h("input", { class: "field", type: "time", value: draft.end, onChange: (e) => (draft.end = e.target.value) }))),
          draft.allDay ? null : h("div", { class: "t2" }, label("scheduleMidnight")),
          field("scheduleZone", h("select", { class: "field", onChange: (e) => (draft.tz = e.target.value) }, [h("option", { value: "local", selected: draft.tz === "local" }, label("scheduleZoneLocal")), ...timeZones().map((z) => h("option", { value: z, selected: draft.tz === z }, z))])),
          h("div", { class: "two" }, field("scheduleFrom", h("input", { class: "field", type: "date", value: draft.from, onChange: (e) => (draft.from = e.target.value) })), field("scheduleTo", h("input", { class: "field", type: "date", value: draft.to, onChange: (e) => (draft.to = e.target.value) }))),
        ] : h("div", { class: "note" }, icon("info"), h("div", {}, label(draft.source === "api" ? "scheduleApiRuleHelp" : "scheduleHaRuleHelp"))),
        h("h3", { class: "t1" }, label("scheduleApply")),
        h("div", { class: "grid2 vx-apply" }, ["language", "theme", "density", "font", "motion", "accent"].map(applyRow)),
        errors.length ? h("div", { class: "err", role: "alert" }, `${label("scheduleFix")} ${errors.map((e) => label(`scheduleErr_${e.split(":")[0]}`)).join(", ")}`) : null,
        h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close() }, label("cancel")), h("button", { class: "btn f", onClick: () => {
          const result = engine.schedule.saveRule(draft);
          if (!result.ok) { draft.__errors = result.errors; return render(); }
          close(true);
        } }, label("save"))),
      ];
    }, { label: tr.en("panelSchedule") });
  }

  const schedule = live("schedule", (redraw) => {
    const rules = rec().schedule.rules;
    const status = engine.schedule.status();
    const secrets = store.secrets.read();
    const source = (kind) => {
      const cfg = rec().schedule[kind];
      const st = status[kind];
      const url = h("input", { class: "field", type: "url", inputmode: "url", maxlength: "400", placeholder: label(kind === "api" ? "scheduleApiPlaceholder" : "scheduleHaPlaceholder"), value: cfg.url, autocomplete: "off", "aria-label": label("scheduleUrl") });
      const entity = kind === "ha" ? h("input", { class: "field", type: "text", maxlength: "120", placeholder: "input_boolean.school_hours", value: cfg.entity, autocomplete: "off", spellcheck: "false", "aria-label": label("scheduleEntity") }) : null;
      const token = h("input", { class: "field", type: "password", autocomplete: "off", maxlength: "2048", placeholder: secrets[kind] ? label("scheduleTokenSaved") : label("scheduleToken"), "aria-label": label("scheduleToken") });
      const minutes = h("input", { class: "field", type: "number", min: kind === "api" ? "5" : "1", max: "1440", value: String(cfg.refreshMinutes), "aria-label": label("scheduleRefresh") });
      const stateText = { idle: label("scheduleStateIdle"), checking: label("scheduleStateChecking"), ok: tr("scheduleStateOk", { state: st.active ? label("scheduleOn") : label("scheduleOff") }), failed: `${tr("scheduleStateFailed", { code: st.code ?? "" })}${st.stale ? ` ${label("scheduleStale")}` : ""}` }[st.state];
      return K.card(`schedule-${kind}`, label(kind === "api" ? "scheduleApiTitle" : "scheduleHaTitle"), kind === "api" ? "cloud" : "home", label(kind === "api" ? "scheduleApiHelp" : "scheduleHaHelp"),
        h("div", { class: "vx-form" }, url, entity, token, h("label", { class: "lbl" }, label("scheduleRefresh"), minutes)),
        K.note("", label("scheduleTokenHelp")),
        h("div", { class: "vx-inline" },
          K.btn(label("save"), () => { engine.schedule.configureSource(kind, { url: url.value.trim(), refreshMinutes: Number(minutes.value) || cfg.refreshMinutes, ...(entity ? { entity: entity.value.trim() } : {}) }, token.value ? token.value.trim() : undefined); token.value = ""; ctx.toast(label("saved")); redraw(); }, { kind: "t", iconName: "save" }),
          K.btn(label("scheduleCheckNow"), () => engine.schedule.refreshExternal(kind, { manual: true }), { kind: "o", iconName: "sync" }),
          secrets[kind] ? K.btn(label("scheduleForgetToken"), () => { engine.store.secrets.write({ [kind]: "" }); redraw(); }, { kind: "o", iconName: "key_off" }) : null),
        h("div", { class: `tag ${st.state === "ok" ? "good" : st.state === "failed" ? "bad" : ""}`, role: "status" }, stateText));
    };
    const list = rules.length ? rules.map((rule, i) =>
      h("div", { class: "row vx-rule" },
        h("div", { class: "grow" }, h("div", { class: "t1" }, rule.name), h("div", { class: "t2" }, describeRule(rule))),
        engine.schedule.evaluate().active.includes(rule.id) ? h("span", { class: "tag good" }, label("scheduleActiveNow")) : null,
        K.sw(rule.name, rule.enabled, (on) => { engine.schedule.saveRule({ ...rule, enabled: on }); redraw(); }),
        K.btn(label("moveUp"), () => engine.schedule.moveRule(rule.id, -1), { kind: "o", disabled: i === 0, iconName: "arrow_upward" }),
        K.btn(label("moveDown"), () => engine.schedule.moveRule(rule.id, 1), { kind: "o", disabled: i === rules.length - 1, iconName: "arrow_downward" }),
        K.btn(label("edit"), async () => { if (await openRuleEditor(rule).closed) redraw(); }, { kind: "t", iconName: "edit" }),
        K.btn(label("delete"), async () => { if (await ctx.confirmDialog({ title: label("scheduleDeleteTitle"), body: rule.name, confirm: label("delete"), danger: true })) engine.schedule.removeRule(rule.id); }, { kind: "o", iconName: "delete" }))) : [h("div", { class: "empty" }, icon("event_busy", "lg"), label("scheduleEmpty"))];
    const { active } = engine.schedule.evaluate();
    return [
      K.card("schedule", label("panelSchedule"), "schedule", label("scheduleLede"),
        K.note("", label("scheduleBase")),
        h("div", { class: "vx-rules" }, list),
        active.length ? h("p", { class: "t2" }, tr("scheduleActiveList", { names: rules.filter((r) => active.includes(r.id)).map((r) => r.name).join(", ") })) : h("p", { class: "t2" }, label("scheduleNoneActive")),
        K.btn(label("scheduleAdd"), async () => { if (await openRuleEditor(null).closed) redraw(); }, { kind: "f", iconName: "add", small: false })),
      source("api"),
      source("ha"),
    ];
  });

  // ---------------------------------------------------------------- name
  const name = live("name", () => {
    const current = rec().name;
    const input = h("input", { class: "field", type: "text", maxlength: "60", value: current, placeholder: "Material Asus Router", autocomplete: "off", "aria-label": label("nameField") });
    const shown = h("div", { class: "big vx-name-preview vx-literal" }, current || "Material Asus Router");
    input.addEventListener("input", () => (shown.textContent = input.value.trim() || "Material Asus Router"));
    return K.card("name", label("panelName"), "badge", label("nameLede"),
      K.row(label("nameField"), label("nameHelp"), input),
      shown,
      h("div", { class: "vx-inline" },
        K.btn(label("nameApply"), () => { engine.setName(input.value); ctx.toast(label("nameSaved")); engine.events.emit("remote"); }, { kind: "f", iconName: "check" }),
        K.btn(label("nameReset"), () => { engine.setName(""); ctx.toast(label("nameWasReset")); engine.events.emit("remote"); }, { kind: "o", iconName: "restart_alt", disabled: !current })),
      K.note("", label("nameCosmetic")),
      K.btn(label("nameDiagnostics"), async () => {
        try {
          const d = await ctx.api.get("/api/x/voice/diagnostics");
          await navigator.clipboard.writeText(JSON.stringify({ ...d, displayName: rec().name || d.product }, null, 2));
          ctx.toast(label("nameDiagnosticsCopied"));
        } catch {
          ctx.toast(label("nameDiagnosticsFailed"), "bad");
        }
      }, { kind: "o", iconName: "content_copy" }));
  });

  // ---------------------------------------------------------------- comfort (ADHD)
  const comfort = live("comfort", () => {
    const a = rec().adhd;
    const mode = (key, title, help) => K.row(label(title), label(help), K.sw(label(title), a[key], (v) => engine.setAdhd(key, v)));
    return K.card("comfort", label("panelComfort"), "self_improvement", label("comfortLede"),
      mode("focus", "adhdFocus", "adhdFocusHelp"), mode("low", "adhdLow", "adhdLowHelp"), mode("time", "adhdTime_", "adhdTimeHelp"), mode("one", "adhdOne", "adhdOneHelp"), mode("momentum", "adhdMomentumTitle", "adhdMomentumHelp"),
      K.note("", label("adhdNotMedical")), K.note("", label("adhdSchoolKids")));
  });

  // ---------------------------------------------------------------- school
  const school = live("school", (redraw) => {
    const s = rec().school;
    const kindPick = { kind: "pin" };
    async function ask({ title, body, kind }) {
      let secret = "";
      const input = h("input", { class: "field", type: "password", inputmode: kind === "pin" ? "numeric" : "text", autocomplete: "off", maxlength: String(kind === "pin" ? 12 : PASSWORD_MAX), "aria-label": title, onInput: (e) => (secret = e.target.value) });
      const result = await ctx.openDialog((close) => [h("h2", { class: "h2" }, title), h("p", { class: "muted" }, body), input, h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(null) }, label("cancel")), h("button", { class: "btn f", onClick: () => close(secret) }, label("continue")))], { label: title }).closed;
      return result;
    }
    const turnOn = async () => {
      const lock = rec().school.lock;
      const kind = lock?.kind ?? kindPick.kind;
      const secret = await ask({ title: tr("schoolSetTitle", { name: s.label }), body: lock ? label("schoolEnterToStart") : label(kind === "pin" ? "schoolSetPinBody" : "schoolSetPasswordBody"), kind });
      if (secret === null) return redraw();
      const r = await engine.school.enable(kind, secret);
      if (!r.ok) ctx.toast(label(`schoolErr_${r.code}`), "bad");
      redraw();
    };
    const turnOff = async () => {
      const secret = await ask({ title: tr("schoolOffTitle", { name: s.label }), body: label("schoolOffBody"), kind: s.lock?.kind ?? "pin" });
      if (secret === null) return redraw();
      const r = await engine.school.disable(secret);
      if (!r.ok) {
        ctx.toast(label("schoolErr_WRONG"), "bad");
        redraw();
      }
    };
    const nameInput = h("input", { class: "field", type: "text", maxlength: "40", value: s.label, "aria-label": label("schoolRename"), onChange: (e) => { engine.school.rename(e.target.value); redraw(); } });
    const lockKind = !s.lock ? K.row(label("schoolLockKind"), label("schoolLockKindHelp"), K.seg(label("schoolLockKind"), [["pin", label("schoolPin")], ["password", label("schoolPassword")]], kindPick.kind, (v) => (kindPick.kind = v))) : null;
    return K.card("school", s.label, "school", label("schoolLede"),
      !engine.store.readable ? K.note("warn", label("schoolUnreadable")) : null,
      K.row(s.label, s.on ? label("schoolOnHelp") : label("schoolOffHelp"), K.sw(s.label, s.on, (v) => (v ? turnOn() : turnOff()))),
      lockKind,
      K.row(label("schoolRename"), label("schoolRenameHelp"), nameInput),
      s.lock ? K.row(label("schoolChangeLock"), tr("schoolLockIs", { kind: label(s.lock.kind === "pin" ? "schoolPin" : "schoolPassword") }), K.btn(label("schoolChangeLock"), async () => {
        const kind = s.lock.kind;
        const current = await ask({ title: label("schoolCurrentTitle"), body: label("schoolCurrentBody"), kind });
        if (current === null) return;
        const next = await ask({ title: label("schoolNewTitle"), body: label(kind === "pin" ? "schoolSetPinBody" : "schoolSetPasswordBody"), kind });
        if (next === null) return;
        const r = await engine.school.changeLock(kind, next, current);
        ctx.toast(r.ok ? label("saved") : label(`schoolErr_${r.code}`), r.ok ? "" : "bad");
      }, { kind: "o", iconName: "key" })) : null,
      K.note("warn", label("schoolNotSecurity")),
      K.row(label("schoolPasskey"), label("schoolPasskeyHelp"), h("span", { class: "tag warn" }, label("inProgress"))),
      s.on ? K.note("", label("schoolWhatChanges")) : K.note("", label("schoolWillOmit")),
      h("p", { class: "t2" }, tr("schoolPinRules", { min: PASSWORD_MIN, max: PASSWORD_MAX })));
  });

  // ---------------------------------------------------------------- dim sum
  const dimsum = live("dimsum", (redraw) => {
    let state = { loading: true };
    const troll = K.sw(label("dimsumAllow"), true, (on) => {
      if (on) return;
      store.append("dimsum-troll", {});
      ctx.toast(label("dimsumTroll"));
      setTimeout(() => { troll.set(true); engine.dom?.announce(label("dimsumSpringsBack")); }, 1100);
    });
    const codeBox = h("div", { class: "vx-code-name" }, h("div", { class: "empty" }, h("div", { class: "spin" }), label("loading")));
    ctx.api.get("/api/x/voice/dimsum/codename?photo=1").then((d) => {
      clear(codeBox);
      if (!d.current) return codeBox.append(h("p", { class: "t2" }, tr("codenameNone", { version: d.version })));
      const names = ctx.getLang() === "en" ? d.current.en : ctx.getLang() === "yue" ? d.current.zhHant : `${d.current.en} · ${d.current.zhHant}`;
      codeBox.append(
        d.photo ? h("img", { class: "vx-dish", src: d.photo.dataUrl, alt: names, width: "160", height: "160" }) : h("div", { class: "note warn" }, icon("image_not_supported"), h("div", {}, tr("codenameNoPicture", { why: d.omitted?.[0]?.reason ?? label("catalogueUnavailable") }))),
        h("div", {}, h("div", { class: "k" }, tr("codenameFor", { version: d.version })), h("div", { class: "big" }, names), h("div", { class: "t2 vx-literal" }, `${d.current.id} · ${d.source} @ ${d.current.revision.slice(0, 8)}`)));
      if (d.all.length > 1) codeBox.append(h("div", { class: "t2" }, d.all.map((r) => `${r.version}: ${r.en} ${r.zhHant}`).join(" · ")));
    }).catch(() => { clear(codeBox); codeBox.append(h("div", { class: "note warn" }, icon("cloud_off"), h("div", {}, label("codenameUnavailable")))); });
    return K.card("dimsum", label("panelDimsum"), "ramen_dining", label("dimsumLede"),
      K.row(label("dimsumAllow"), label("dimsumAllowHelp"), troll),
      K.note("", label("dimsumRules")),
      K.note("", label("dimsumSource")),
      h("h3", { class: "t1" }, label("dimsumCodeName")), codeBox);
  });

  // ---------------------------------------------------------------- history and about
  const history = live("history", (redraw) => {
    const entries = store.history().slice(-100).reverse();
    const text = (e) => {
      const key = `hist_${e.kind}`;
      const vars = { ...e.data };
      const one = tr(key in engineStrings() ? key : "histUnknown", { ...vars, kind: e.kind });
      return one;
    };
    const download = () => {
      const blob = new Blob([JSON.stringify({ ...store.exportable(), history: store.history() }, null, 2)], { type: "application/json" });
      const a = h("a", { href: URL.createObjectURL(blob), download: "voice-settings.json" });
      document.body.append(a);
      a.click();
      a.remove();
    };
    return [
      K.card("about", label("panelAbout"), "info", null,
        K.row(label("aboutShown"), null, h("strong", { class: "vx-literal" }, rec().name || "Material Asus Router")),
        K.row(label("aboutShipped"), label("aboutShippedHelp"), h("span", { class: "vx-literal" }, "Material Asus Router")),
        K.btn(label("exportSettings"), download, { kind: "t", iconName: "download" }),
        K.note("", label("exportHelp"))),
      K.card("history", label("panelHistory"), "history", label("historyLede"),
        entries.length ? entries.map((e) => h("div", { class: "row vx-history" }, h("span", { class: "t2 vx-literal" }, new Date(e.at).toLocaleString()), h("span", { class: "grow" }, text(e)))) : h("div", { class: "empty" }, icon("history_toggle_off", "lg"), label("historyEmpty"))),
    ];
  });

  return { language, tone, wording, sounds, narration, look, schedule, name, comfort, school, dimsum, history };
}

import { EN } from "./strings-en.js";
const engineStrings = () => EN;

const SCHEMA_SAMPLE = `{
  "version": 1,
  "name": "Pat's wording",
  "words": {
    "router": "gateway",
    "guest": { "network": "visitor network" }
  }
}`;
