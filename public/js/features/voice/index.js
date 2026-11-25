// Voice and comfort: language modes, funny levels, personal wording, action
// sounds, the narrator, scheduled settings, renaming the app, ADHD modes,
// School mode and the dim sum surprise. The registry loads this file; the work is
// in the files beside it (see engine.js for how they fit together).
import { createEngine } from "./engine.js";
import { PANELS, buildPanels } from "./panels.js";

let engine = null;
let panels = null;
function ensure(ctx) {
  if (!engine) {
    engine = createEngine(ctx);
    panels = buildPanels(engine);
  }
  return engine;
}

const title = { en: "Voice and comfort", yue: "聲音同舒適" };
const lede = { en: "Language, tone, personal wording, sounds, narration, schedules, the app's name, comfort modes and School mode.", yue: "語言、語氣、個人用詞、音效、朗讀、排程、程式名稱、舒適模式同校園模式。" };

// The screen: every panel, with a row of links to jump between them.
function renderScreen(ctx) {
  const e = ensure(ctx);
  const { h, icon } = ctx;
  const root = ctx.root;
  const draw = () => {
    ctx.clear(root);
    const school = e.school.on();
    const shown = PANELS.filter((p) => !school || p.school);
    root.append(ctx.page(title, lede,
      h("nav", { class: "chips vx-toc", "aria-label": e.tr("tocLabel") }, shown.map((p) => h("a", { class: "chip", href: `#vx-${p.id}`, onClick: (ev) => { ev.preventDefault(); document.getElementById(`vx-${p.id}`)?.scrollIntoView({ block: "start" }); } }, icon(p.icon, "sm"), ctx.tt(p.label)))),
      shown.map((p) => panels[p.id]())));
  };
  draw();
  return e.events.on("school", () => root.isConnected && draw());
}

function settingsSection(p) {
  return {
    id: `voice-${p.id}`,
    icon: p.icon,
    label: p.label,
    render(ctx) {
      const e = ensure(ctx);
      if (e.school.on() && !p.school) return ctx.h("p", { class: "muted" }, e.tr("schoolLeftOut"));
      return ctx.h("div", { class: "vx-in-settings" }, panels[p.id]());
    },
  };
}

function openPanel(id) {
  return async (ctx) => {
    await ctx.navigate("voice");
    document.getElementById(`vx-${id}`)?.scrollIntoView({ block: "start" });
  };
}

// A one-line name dialog for the palette command.
function renameDialog(ctx) {
  const e = ensure(ctx);
  const { h } = ctx;
  let value = e.rec().name;
  return ctx.openDialog((close) => [
    h("h2", { class: "h2" }, e.tr("panelName")),
    h("p", { class: "muted" }, e.tr("nameHelp")),
    h("input", { class: "field", type: "text", maxlength: "60", value, "aria-label": e.tr("nameField"), onInput: (ev) => (value = ev.target.value) }),
    h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close() }, e.tr("cancel")), h("button", { class: "btn f", onClick: () => { e.setName(value); close(true); } }, e.tr("nameApply"))),
  ], { label: e.tr.en("panelName") });
}

function chooseFile(ctx) {
  const e = ensure(ctx);
  const input = ctx.h("input", { type: "file", accept: ".json,application/json" });
  input.addEventListener("change", () => input.files?.[0] && e.vocab.applyFile(input.files[0], { source: "palette" }));
  input.click();
}

const toggle = (id, en, yue, keywords, run) => ({ id: `voice.${id}`, icon: "toggle_on", label: { en, yue }, keywords, run });

export default {
  id: "voice",

  screens: [{ id: "voice", group: { en: "App", yue: "程式" }, icon: "tune", label: title, render: renderScreen }],

  settings: PANELS.map(settingsSection),

  commands: [
    { id: "voice.open", icon: "tune", label: { en: "Open voice and comfort", yue: "開啟聲音同舒適" }, keywords: "language funny tone sound narrator schedule name adhd school dim sum", run: (ctx) => ctx.navigate("voice") },
    ...PANELS.map((p) => ({ id: `voice.open.${p.id}`, icon: p.icon, label: { en: `Open: ${p.label.en}`, yue: `開啟：${p.label.yue}` }, keywords: p.id, run: openPanel(p.id) })),
    toggle("sounds", "Turn action sounds on or off", "開關動作音效", "sound audio mute", (ctx) => { const e = ensure(ctx); const on = !e.rec().sound.on; e.store.update((r) => void (r.sound.on = on), "sound"); e.store.append("setting", { name: "sound.on", value: String(on) }); ctx.toast(e.tr(on ? "soundsNowOn" : "soundsNowOff")); }),
    toggle("mute", "Mute or unmute sounds", "靜音或取消靜音", "mute volume", (ctx) => { const e = ensure(ctx); const muted = !e.rec().sound.muted; e.store.update((r) => void (r.sound.muted = muted), "sound"); e.store.append("setting", { name: "sound.muted", value: String(muted) }); ctx.toast(e.tr(muted ? "soundsMuted" : "soundsUnmuted")); }),
    toggle("narrator", "Turn the narrator on or off", "開關朗讀", "speech voice read aloud", (ctx) => { const e = ensure(ctx); const on = !e.rec().narration.on; e.store.update((r) => void (r.narration.on = on), "narration"); e.store.append("setting", { name: "narration.on", value: String(on) }); ctx.toast(e.tr(on ? "narrationNowOn" : "narrationNowOff")); if (!on) e.narrator.stop(); }),
    ...[["focus", "Focus", "專注"], ["low", "Low stimulation", "低刺激"], ["time", "Time awareness", "時間意識"], ["one", "One thing at a time", "一次一件事"], ["momentum", "Momentum", "進度感"]].map(([key, en, yue]) =>
      toggle(`adhd.${key}`, `ADHD mode: ${en}`, `ADHD 模式：${yue}`, "adhd focus calm", (ctx) => { const e = ensure(ctx); e.setAdhd(key, !e.rec().adhd[key]); ctx.toast(e.tr(e.rec().adhd[key] ? "adhdNowOn" : "adhdNowOff")); })),
    toggle("school", "Turn School mode on or off", "開關校園模式", "school kids", async (ctx) => { await ctx.navigate("voice"); document.getElementById("vx-school")?.scrollIntoView({ block: "start" }); }),
    { id: "voice.wording.choose", icon: "upload_file", label: { en: "Choose a personal wording file", yue: "揀個人用詞檔案" }, keywords: "vocabulary json upload", run: chooseFile },
    { id: "voice.wording.clear", icon: "delete", label: { en: "Clear personal wording", yue: "清除個人用詞" }, keywords: "vocabulary json restore", run: (ctx) => ensure(ctx).vocab.clear() },
    { id: "voice.rename", icon: "badge", label: { en: "Rename the app", yue: "改程式名稱" }, keywords: "name title", run: renameDialog },
    { id: "voice.rename.reset", icon: "restart_alt", label: { en: "Reset the app name", yue: "還原程式名稱" }, keywords: "name title", run: (ctx) => ensure(ctx).setName("") },
    { id: "voice.schedule", icon: "schedule", label: { en: "Open scheduled settings", yue: "開啟排程設定" }, keywords: "schedule home assistant time", run: openPanel("schedule") },
  ],

  toolbar: [
    { id: "voice.mute", icon: "volume_up", label: { en: "Mute or unmute sounds", yue: "靜音或取消靜音" }, onClick: (ctx) => { const e = ensure(ctx); const muted = !e.rec().sound.muted; e.store.update((r) => void (r.sound.muted = muted), "sound"); e.store.append("setting", { name: "sound.muted", value: String(muted) }); ctx.toast(e.tr(muted ? "soundsMuted" : "soundsUnmuted")); } },
  ],

  overlays: [
    {
      id: "voice.engine",
      mount(ctx) {
        const e = ensure(ctx);
        e.start();
        return () => e.stop();
      },
    },
  ],
};
