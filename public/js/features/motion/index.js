// The animation and transition editor. Every kind of animated element can be
// switched on or off and tuned (duration, delay, stagger, easing curve,
// distance, scale), with a live preview, four ready-made profiles, a global
// speed, and import and export. Changes apply to the whole app straight away.
// Reduced motion always wins, and the editor says so.
import { EASINGS, KINDS, PROFILES, effectiveKind, easingCss, easingPoints, exportMotion, importMotion, parseBezier, resolveMotion, DEFAULT_MOTION } from "../material-design/motion-engine.js";
import { prefs } from "../material-design/prefs.js";
import { motionState } from "../material-design/apply.js";
import { widgets } from "../material-design/ui.js";
import { collapsible } from "../collapse-filters/collapsible.js";

const label = { en: "Animation and transitions", yue: "動畫同轉場" };
const edit = (fn) => prefs.update((d) => fn(d.motion));
const NS = "http://www.w3.org/2000/svg";

function curve(ctx, easingId) {
  const pts = easingPoints(easingId);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "-0.05 -0.35 1.1 1.7");
  svg.setAttribute("class", "mo-curve");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", ctx.t("Easing curve, time across and progress up", "緩動曲線，橫軸係時間，縱軸係進度"));
  const box = document.createElementNS(NS, "rect");
  for (const [k, v] of Object.entries({ x: 0, y: 0, width: 1, height: 1, class: "mo-curve-box", fill: "none" })) box.setAttribute(k, v);
  const path = document.createElementNS(NS, "polyline");
  path.setAttribute("points", pts.map(([x, y]) => `${x.toFixed(3)},${(1 - y).toFixed(3)}`).join(" "));
  path.setAttribute("class", "mo-curve-line");
  path.setAttribute("fill", "none");
  svg.append(box, path);
  return svg;
}

function kindEditor(ctx, w, def) {
  const { h, t, tt } = ctx;
  const get = () => effectiveKind(prefs.get().motion, def.id);
  const own = () => prefs.get().motion.kinds[def.id] ?? {};
  const setKey = (key) => (v) => edit((m) => { m.kinds[def.id] = { ...(m.kinds[def.id] ?? {}), [key]: v }; });
  const controls = [];
  const add = (c) => (controls.push(c), c);
  const preview = h("div", { class: "mo-demo", "aria-hidden": "true" }, [0, 1, 2, 3].map(() => h("i", {})));
  const previewNote = h("div", { class: "t2", role: "status" });
  const curveHost = h("div", { class: "mo-curve-host" });
  const bez = [0, 1, 2, 3].map((i) => add(w.slider({
    min: i % 2 === 0 ? 0 : -1, max: i % 2 === 0 ? 1 : 2, step: 0.01, label: { en: ["Curve x1", "Curve y1", "Curve x2", "Curve y2"][i], yue: ["曲線 x1", "曲線 y1", "曲線 x2", "曲線 y2"][i] },
    get: () => (parseBezier(get().easing) ?? EASINGS[get().easing]?.bezier ?? [0.2, 0, 0, 1])[i],
    set: (v) => { const b = [...(parseBezier(get().easing) ?? EASINGS[get().easing]?.bezier ?? [0.2, 0, 0, 1])]; b[i] = v; setKey("easing")(`bezier(${b.map((x) => Number(x.toFixed(2))).join(",")})`); },
    format: (v) => v.toFixed(2),
  })));
  const easingChoices = [...Object.entries(EASINGS).map(([id, e]) => [id, e.label]), ["custom", { en: "Custom curve", yue: "自訂曲線" }]];
  const easing = add(w.segmented(easingChoices, () => (parseBezier(get().easing) ? "custom" : get().easing), (v) => setKey("easing")(v === "custom" ? "bezier(0.2,0,0,1)" : v), { en: "Easing", yue: "緩動" }));
  const redrawCurve = () => { curveHost.replaceChildren(curve(ctx, get().easing)); bez.forEach((b) => (b.hidden = !parseBezier(get().easing))); };
  const num = (key, min, max, step, unit, name) => add(w.slider({ min, max, step, unit, label: name, get: () => get()[key], set: setKey(key), format: (v) => `${v}${unit}` }));
  const duration = num("duration", 0, 3000, 10, " ms", { en: "Duration", yue: "時長" });
  const delay = num("delay", 0, 1500, 10, " ms", { en: "Delay", yue: "延遲" });
  const stagger = num("stagger", 0, 300, 5, " ms", { en: "Stagger between items", yue: "每項之間嘅間隔" });
  const distance = num("distance", 0, 80, 1, " px", { en: "Distance travelled", yue: "移動距離" });
  const scale = add(w.slider({ min: 0.5, max: 1.5, step: 0.01, label: { en: "Scale at the start", yue: "開始嘅縮放" }, get: () => get().scale, set: setKey("scale"), format: (v) => `${v.toFixed(2)}×` }));
  const enabled = add(w.toggle(() => get().enabled, (v) => setKey("enabled")(v), { en: `Animate ${def.label.en}`, yue: `${def.label.yue}加動畫` }));

  function play() {
    const r = resolveMotion(prefs.get().motion, motionState().reduced).kinds[def.id];
    const reduced = motionState().reduced;
    previewNote.textContent = reduced ? t("Reduced motion is on, so the preview shows the end state without moving.", "已開啟減少動態，所以預覽直接顯示結果，唔會郁。") : !r.enabled ? t("This animation is switched off.", "呢個動畫已經關閉。") : `${r.duration} ms · ${easingCss(r.easing).slice(0, 38)}${easingCss(r.easing).length > 38 ? "…" : ""}`;
    if (reduced || !r.enabled || typeof preview.firstChild?.animate !== "function") return;
    [...preview.children].forEach((el, i) => el.animate([{ opacity: 0, transform: `translateY(${r.distance}px) scale(${r.scale})` }, { opacity: 1, transform: "translateY(0) scale(1)" }], { duration: Math.max(1, r.duration), delay: r.delay + i * r.stagger, easing: easingCss(r.easing), fill: "backwards" }));
  }
  function sync() { controls.forEach((c) => c.sync?.()); redrawCurve(); }
  const reset = w.button({ en: "Reset this kind", yue: "重設呢類" }, "restart_alt", () => edit((m) => { delete m.kinds[def.id]; }));
  const body = h("div", { class: "mo-kind" },
    w.row({ en: "Animate", yue: "加動畫" }, null, enabled),
    w.row({ en: "Easing", yue: "緩動" }, null, easing), curveHost, h("div", { class: "mo-bez" }, bez),
    w.row({ en: "Duration", yue: "時長" }, null, duration), w.row({ en: "Delay", yue: "延遲" }, null, delay), w.row({ en: "Stagger", yue: "間隔" }, null, stagger),
    w.row({ en: "Distance", yue: "距離" }, null, distance), w.row({ en: "Scale", yue: "縮放" }, null, scale),
    h("div", { class: "mo-preview" }, preview, previewNote), h("div", { class: "actions" }, w.button({ en: "Play preview", yue: "播放預覽" }, "play_arrow", play, "t sm"), reset));
  sync();
  const el = collapsible(ctx, { id: `motion.kind.${def.id}`, title: def.label, defaultCollapsed: true, activeCount: () => Object.keys(own()).length }, body);
  el.syncAll = sync;
  el.dataset.kind = def.id;
  el.dataset.text = `${def.label.en} ${def.label.yue}`.toLowerCase();
  return el;
}

async function screen(ctx) {
  const w = widgets(ctx);
  const { h, t } = ctx;
  const controls = [];
  const add = (c) => (controls.push(c), c);
  const status = h("div", { role: "status", class: "mo-status" });
  const drawStatus = () => {
    const m = prefs.get().motion;
    const state = motionState();
    const why = m.low ? t("Low stimulation is on.", "低刺激已開啟。") : m.reduced === "on" ? t("You chose reduced motion.", "你揀咗減少動態。") : state.reduced ? t("Your system asks for reduced motion.", "你嘅系統要求減少動態。") : "";
    status.replaceChildren(state.reduced ? w.note("warn", t(`Reduced motion is on. ${why} Everything below is saved, but nothing moves, and it always wins over the editor.`, `減少動態已開啟。${why}以下設定都會儲存，但係唔會郁，而且永遠優先過編輯器。`)) : w.note("", t("Motion is on. Changes apply to the whole app straight away.", "動態已開啟，改動會即時套用到成個程式。")));
  };
  const reduced = add(w.segmented([["system", { en: "Follow the system", yue: "跟系統" }], ["on", { en: "Always reduce", yue: "一律減少" }], ["off", { en: "Allow motion", yue: "容許動態" }]], () => prefs.get().motion.reduced, (v) => edit((m) => { m.reduced = v; }), { en: "Reduced motion", yue: "減少動態" }));
  const low = add(w.toggle(() => prefs.get().motion.low, (v) => edit((m) => { m.low = v; }), { en: "Low stimulation", yue: "低刺激" }));
  const master = add(w.toggle(() => prefs.get().motion.master, (v) => edit((m) => { m.master = v; }), { en: "All animation", yue: "所有動畫" }));
  const speed = add(w.slider({ min: 0.25, max: 3, step: 0.05, label: { en: "Global speed", yue: "整體速度" }, get: () => prefs.get().motion.speed, set: (v) => edit((m) => { m.speed = v; }), format: (v) => `${v.toFixed(2)}×` }));
  const profile = add(w.segmented(Object.entries(PROFILES).map(([id, p]) => [id, p.label]), () => prefs.get().motion.profile, (v) => edit((m) => { m.profile = v; m.kinds = {}; }), { en: "Profile", yue: "設定檔" }));
  let query = "";
  const search = h("input", { class: "field", type: "search", "aria-label": t("Find an animated element", "搵動畫元素"), placeholder: t("Find an animated element", "搵動畫元素"), onInput: (e) => { query = e.target.value.trim().toLowerCase(); filter(); } });
  const list = h("div", { class: "mo-list" });
  const editors = KINDS.map((k) => kindEditor(ctx, w, k));
  list.append(...editors);
  const filter = () => { editors.forEach((e) => { e.hidden = query !== "" && !e.dataset.text.includes(query); }); filterBox.refresh(); };
  const filterBox = collapsible(ctx, { id: "motion.filter", title: { en: "Find an element", yue: "搵元素" }, activeCount: () => (query ? 1 : 0) }, search);
  const message = h("div", { role: "status" });

  const off = prefs.subscribe(() => { if (!list.isConnected) return off(); controls.forEach((c) => c.sync?.()); editors.forEach((e) => e.syncAll()); drawStatus(); });
  drawStatus();
  ctx.root.append(ctx.page(label, { en: "Tune how every part of the app moves. Pick a profile, then adjust any kind of element.", yue: "調較成個程式每個部分點樣郁。先揀設定檔，再微調任何元素。" },
    status,
    w.card({ en: "Overall", yue: "整體" },
      w.row({ en: "Reduced motion", yue: "減少動態" }, { en: "Always wins over everything in this editor.", yue: "永遠優先過呢個編輯器入面嘅任何設定。" }, reduced),
      w.row({ en: "Low stimulation", yue: "低刺激" }, { en: "Stops all motion and the rainbow, and snaps charts. Works together with the system setting.", yue: "停止所有動態同彩虹，圖表即時更新。同系統設定一齊運作。" }, low),
      w.row({ en: "All animation", yue: "所有動畫" }, { en: "A master switch for every kind below.", yue: "下面所有類別嘅總開關。" }, master),
      w.row({ en: "Global speed", yue: "整體速度" }, { en: "Above 1 is faster, below 1 is slower.", yue: "大過 1 就快啲，細過 1 就慢啲。" }, speed),
      w.row({ en: "Profile", yue: "設定檔" }, { en: "Choosing a profile clears your per-element edits.", yue: "揀設定檔會清除你逐個元素嘅修改。" }, profile),
      h("div", { class: "actions" },
        w.button({ en: "Export", yue: "匯出" }, "download", () => w.download("motion-profile.json", exportMotion(prefs.get().motion))),
        w.button({ en: "Import", yue: "匯入" }, "upload", async () => {
          const f = await w.pickTextFile();
          if (!f) return;
          const r = f.error ? { ok: false, error: f.error } : importMotion(f.text);
          if (!r.ok) return void message.replaceChildren(w.note("bad", r.error));
          prefs.update((d) => { d.motion = r.motion; });
          message.replaceChildren(w.note("", t("Motion profile imported.", "已匯入動畫設定檔。")));
        }),
        w.button({ en: "Reset everything", yue: "全部重設" }, "restart_alt", () => { prefs.update((d) => { d.motion = structuredClone(DEFAULT_MOTION); }); message.replaceChildren(w.note("", t("Motion reset to the defaults.", "動畫已重設做預設。"))); })),
      message),
    filterBox,
    h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Every animated element", "每個動畫元素")), list)));
  return off;
}

export default {
  id: "motion",
  screens: [{ id: "motion", group: { en: "Appearance", yue: "外觀" }, icon: "animation", label, render: screen }],
  settings: [{
    id: "motion", icon: "animation", label,
    render(ctx) {
      const w = widgets(ctx);
      const profile = w.segmented(Object.entries(PROFILES).map(([id, p]) => [id, p.label]), () => prefs.get().motion.profile, (v) => edit((m) => { m.profile = v; m.kinds = {}; }), { en: "Profile", yue: "設定檔" });
      const low = w.toggle(() => prefs.get().motion.low, (v) => edit((m) => { m.low = v; }), { en: "Low stimulation", yue: "低刺激" });
      const off = prefs.subscribe(() => (profile.isConnected ? (profile.sync(), low.sync()) : off()));
      return [w.row({ en: "Motion profile", yue: "動畫設定檔" }, null, profile), w.row({ en: "Low stimulation", yue: "低刺激" }, null, low), w.button({ en: "Open the full editor", yue: "開啟完整編輯器" }, "animation", () => ctx.navigate("motion"), "t sm")];
    },
  }],
  commands: [
    { id: "motion.open", icon: "animation", label: { en: "Open the animation editor", yue: "開啟動畫編輯器" }, keywords: "motion transition easing duration reduced", run: (ctx) => ctx.navigate("motion") },
    { id: "motion.low", icon: "motion_photos_off", label: { en: "Toggle low stimulation", yue: "切換低刺激" }, keywords: "reduced motion calm", run: () => edit((m) => { m.low = !m.low; }) },
  ],
};
