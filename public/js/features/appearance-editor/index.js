// The per-element appearance editor. Alt + right-click on any element, the
// "Pick an element" button, or Ctrl+Alt+E on the focused element opens a
// non-modal panel next to it, with a live preview, layers, undo and redo,
// presets, copy and paste style, import and export, and the motion of that
// element. Closing the panel returns focus to where it was.
import { parseColor, format, clampColor } from "../material-design/color.js";
import { createJsonStore, prefs, safeStorage } from "../material-design/prefs.js";
import { widgets } from "../material-design/ui.js";
import { effectiveKind, KINDS, EASINGS, easingCss } from "../material-design/motion-engine.js";
import { motionState } from "../material-design/apply.js";
import { collapsible } from "../collapse-filters/collapsible.js";
import { pickColor } from "../color-picker/picker.js";
import { openPanel } from "../overlay-panels/panels.js";
import { MATRIX, PROPS, STATES, TARGETS, applyPreset, buildCss, clearAll, copyStyle, deletePreset, emptyEditor, exportEditor, importEditor, moveLayer, pasteStyle, removeLayer, sanitizeEditor, sanitizeLayers, savePreset, setLayer, targetOf, toggleLayer } from "./editor-core.js";

const label = { en: "Element appearance", yue: "元素外觀" };
export const editorStore = createJsonStore(safeStorage(), "mar.appearance.editor", sanitizeEditor, emptyEditor);

// ---- undo and redo (while the page is open) -------------------------------------
const past = [];
const future = [];
let lastKey = "";
let lastAt = 0;
let clipboard = [];
// mutate(fn, key): changes the editor data. Repeated changes with the same key within a second
// (dragging a slider) count as one undo step.
export function mutate(fn, key = "") {
  const snapshot = JSON.stringify(editorStore.get().layers);
  const merge = key && key === lastKey && Date.now() - lastAt < 1000;
  if (!merge) { past.push(snapshot); if (past.length > 100) past.shift(); }
  future.length = 0;
  lastKey = key;
  lastAt = Date.now();
  editorStore.update((d) => { fn(d); });
}
export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;
export function undo() {
  if (!past.length) return false;
  future.push(JSON.stringify(editorStore.get().layers));
  const back = JSON.parse(past.pop());
  editorStore.update((d) => { d.layers = sanitizeLayers(back); d.log.push({ at: Date.now(), text: "Undid a change" }); });
  lastKey = "";
  return true;
}
export function redo() {
  if (!future.length) return false;
  past.push(JSON.stringify(editorStore.get().layers));
  const next = JSON.parse(future.pop());
  editorStore.update((d) => { d.layers = sanitizeLayers(next); d.log.push({ at: Date.now(), text: "Redid a change" }); });
  lastKey = "";
  return true;
}

// ---- the live stylesheet ----------------------------------------------------------
let sheet = null;
function paint() {
  const css = buildCss(editorStore.get().layers);
  if (!sheet) return;
  try { sheet.replaceSync(css); } catch { /* an invalid rule is dropped; nothing else changes */ }
}
function attachSheet() {
  if (sheet || typeof CSSStyleSheet === "undefined" || !("adoptedStyleSheets" in document)) return false;
  sheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  paint();
  return true;
}

// ---- the panel ----------------------------------------------------------------------
const targetName = (t, ctx) => `${ctx.tt(t.label)}`;

function readComputed(el, cssProp, type) {
  try {
    const raw = getComputedStyle(el)[cssProp];
    if (type === "color") { const p = parseColor(raw); return p.ok ? format(clampColor(p.color), p.color.a < 0.9995 ? "hex8" : "hex") : "#000000"; }
    if (type === "choice") return "none";
    const n = parseFloat(raw);
    return Number.isFinite(n) ? String(Number(n.toFixed(2))) : "0";
  } catch { return "0"; }
}

function openEditor(ctx, picked, opener) {
  const w = widgets(ctx);
  const { h, t, icon } = ctx;
  const state = { kind: picked.target, element: picked.element, state: "default", tab: "style" };
  const anchor = picked.element.getBoundingClientRect();
  let body;
  let panel;
  const render = () => {
    if (!body?.isConnected) return;
    body.replaceChildren(
      h("div", { class: "ae-target t2" }, `${t("Editing", "編輯緊")}: `, h("b", {}, targetName(state.kind, ctx)), ` · ${t("changes apply to every", "改動會套用到每個")} ${targetName(state.kind, ctx)}`),
      w.segmented([["style", { en: "Style", yue: "樣式" }], ["layers", { en: "Layers", yue: "圖層" }], ["animation", { en: "Animation", yue: "動畫" }]], () => state.tab, (v) => { state.tab = v; render(); }, { en: "Section", yue: "部分" }),
      state.tab === "style" ? styleTab() : state.tab === "layers" ? layersTab() : animationTab());
    panel?.el.setAttribute("aria-label", `${t("Appearance of", "外觀：")} ${targetName(state.kind, ctx)}`);
  };
  const live = () => state.element.isConnected;

  function styleTab() {
    const stateSeg = w.segmented(STATES.map((s) => [s.id, s.label]), () => state.state, (v) => { state.state = v; render(); }, { en: "State", yue: "狀態" });
    const layerFor = (prop) => editorStore.get().layers.find((l) => l.kind === state.kind.id && l.state === state.state && l.prop === prop);
    const rows = PROPS.map((p) => {
      const layer = layerFor(p.id);
      const current = layer?.value ?? (live() ? readComputed(state.element, p.css, p.type) : "0");
      let control;
      if (p.type === "color") {
        const sw = h("span", { class: "ae-sw" });
        sw.style.setProperty("--sw", current);
        control = h("button", { type: "button", class: "btn o sm", onClick: async () => { const v = await pickColor(ctx, { initial: current, title: ctx.tt(p.label) }); if (v && v !== "rainbow") mutate((d) => setLayer(d, state.kind.id, state.state, p.id, v)); } }, sw, current);
      } else if (p.type === "choice") {
        control = w.segmented(p.choices.map((c) => [c, c === "none" ? { en: "None", yue: "冇" } : { en: c.toUpperCase(), yue: c.toUpperCase() }]), () => layer?.value ?? current, (v) => mutate((d) => setLayer(d, state.kind.id, state.state, p.id, v)), p.label);
      } else {
        control = w.slider({ min: p.min, max: p.max, step: p.step ?? 1, label: p.label, get: () => Number(layerFor(p.id)?.value ?? current), set: (v) => mutate((d) => setLayer(d, state.kind.id, state.state, p.id, v), `${state.kind.id}.${state.state}.${p.id}`), format: (v) => `${v}${p.type === "px" ? " px" : ""}` });
      }
      const clear = layer ? h("button", { type: "button", class: "info", "aria-label": `${t("Reset", "重設")} ${ctx.tt(p.label)}`, onClick: () => mutate((d) => removeLayer(d, layer.id)) }, icon("undo", "sm")) : null;
      return w.row(p.label, layer ? { en: "Edited", yue: "已修改" } : null, h("div", { class: "ae-ctl" }, control, clear));
    });
    return h("div", { class: "ae-tab" }, w.row({ en: "State", yue: "狀態" }, null, stateSeg), ...rows);
  }

  function layersTab() {
    const layers = editorStore.get().layers.filter((l) => l.kind === state.kind.id);
    const all = editorStore.get().layers;
    return h("div", { class: "ae-tab" },
      h("div", { class: "actions" },
        w.button({ en: "Copy style", yue: "複製樣式" }, "content_copy", () => { clipboard = copyStyle(editorStore.get(), state.kind.id, state.state); ctx.toast(t(`Copied ${clipboard.length} changes from ${targetName(state.kind, ctx)}.`, `已複製 ${clipboard.length} 個改動。`)); }),
        w.button({ en: "Paste style", yue: "貼上樣式" }, "content_paste", () => { if (!clipboard.length) return ctx.toast(t("Nothing copied yet.", "未複製任何樣式。"), "bad"); mutate((d) => pasteStyle(d, clipboard, state.kind.id, state.state)); }),
        w.button({ en: "Undo", yue: "還原" }, "undo", () => { undo(); }, "o sm", { disabled: !canUndo() }),
        w.button({ en: "Redo", yue: "重做" }, "redo", () => { redo(); }, "o sm", { disabled: !canRedo() })),
      layers.length ? layers.map((l) => h("div", { class: "row" },
        w.toggle(() => l.on, () => mutate((d) => toggleLayer(d, l.id)), { en: "Show this change", yue: "顯示呢個改動" }),
        h("div", { class: "grow" }, h("div", { class: "t1" }, `${ctx.tt(PROPS.find((p) => p.id === l.prop).label)}: ${l.value}`), h("div", { class: "t2" }, ctx.tt(STATES.find((s) => s.id === l.state).label))),
        h("button", { type: "button", class: "info", "aria-label": t("Move earlier", "上移"), disabled: all.indexOf(l) === 0, onClick: () => mutate((d) => moveLayer(d, l.id, -1)) }, icon("arrow_upward", "sm")),
        h("button", { type: "button", class: "info", "aria-label": t("Move later", "下移"), disabled: all.indexOf(l) === all.length - 1, onClick: () => mutate((d) => moveLayer(d, l.id, 1)) }, icon("arrow_downward", "sm")),
        h("button", { type: "button", class: "info", "aria-label": t("Delete this change", "刪除呢個改動"), onClick: () => mutate((d) => removeLayer(d, l.id)) }, icon("delete", "sm"))))
        : h("div", { class: "empty" }, icon("layers", "lg"), t("No changes to this kind of element yet. Use the Style section.", "呢類元素未有改動。去「樣式」部分改。")));
  }

  function animationTab() {
    const id = state.kind.motion;
    if (!id) return h("div", { class: "empty" }, icon("motion_photos_off", "lg"), t("This kind of element has no animation of its own.", "呢類元素本身冇動畫。"));
    const def = KINDS.find((k) => k.id === id);
    const k = effectiveKind(prefs.get().motion, id);
    const reduced = motionState().reduced;
    const edit = (patch) => prefs.update((d) => { d.motion.kinds[id] = { ...(d.motion.kinds[id] ?? {}), ...patch }; });
    const total = Math.max(1, k.delay + k.duration);
    const bar = h("div", { class: "ae-timeline", role: "img", "aria-label": `${t("Timeline", "時間軸")}: ${k.delay} ms ${t("delay then", "延遲，然後")} ${k.duration} ms` }, h("i", { class: "wait" }), h("i", { class: "run" }));
    bar.firstChild.style.setProperty("--w", `${(k.delay / total) * 100}%`);
    bar.lastChild.style.setProperty("--w", `${(k.duration / total) * 100}%`);
    return h("div", { class: "ae-tab" },
      reduced ? w.note("warn", t("Reduced motion is on, so this element does not move. These values are saved for when motion is allowed.", "減少動態已開啟，所以呢個元素唔會郁。呢啲數值會儲存，到容許動態時使用。")) : null,
      h("div", { class: "t2" }, `${t("Motion kind", "動畫類別")}: ${ctx.tt(def.label)} · ${t("trigger", "觸發")}: ${id === "hover-lift" ? t("pointer hover", "滑鼠懸停") : id === "tab-change" ? t("selecting", "選取") : t("appearing on screen", "出現喺畫面")}`),
      bar,
      w.row({ en: "On", yue: "開" }, null, w.toggle(() => effectiveKind(prefs.get().motion, id).enabled, (v) => edit({ enabled: v }), { en: "Animate", yue: "加動畫" })),
      w.row({ en: "Duration", yue: "時長" }, null, w.slider({ min: 0, max: 2000, step: 10, unit: " ms", label: { en: "Duration", yue: "時長" }, get: () => effectiveKind(prefs.get().motion, id).duration, set: (v) => edit({ duration: v }), format: (v) => `${v} ms` })),
      w.row({ en: "Delay", yue: "延遲" }, null, w.slider({ min: 0, max: 1000, step: 10, label: { en: "Delay", yue: "延遲" }, get: () => effectiveKind(prefs.get().motion, id).delay, set: (v) => edit({ delay: v }), format: (v) => `${v} ms` })),
      w.row({ en: "Easing", yue: "緩動" }, null, w.segmented(["standard", "emphasized-decelerate", "spring", "linear"].map((e) => [e, EASINGS[e].label]), () => effectiveKind(prefs.get().motion, id).easing, (v) => edit({ easing: v }), { en: "Easing", yue: "緩動" })),
      h("div", { class: "t2" }, easingCss(k.easing).slice(0, 80)),
      h("div", { class: "actions" }, w.button({ en: "Open the full animation editor", yue: "開啟完整動畫編輯器" }, "animation", () => ctx.navigate("motion"), "t sm")));
  }

  // Do not rebuild the panel while a slider is being dragged; it would drop the drag.
  const busy = () => body?.contains(document.activeElement) && document.activeElement.type === "range";
  const offStore = editorStore.subscribe(() => { if (!busy()) render(); });
  const offPrefs = prefs.subscribe(() => state.tab === "animation" && render());
  panel = openPanel(ctx, {
    id: "appearance-editor", title: { en: "Element appearance", yue: "元素外觀" }, size: { w: 420, h: 520 }, opener, anchor,
    build(el) { body = el; body.addEventListener("focusout", () => queueMicrotask(() => { if (!busy()) render(); })); render(); return () => { offStore(); offPrefs(); }; },
  });
  panel.retarget = (next) => { state.kind = next.target; state.element = next.element; state.state = "default"; render(); };
  return panel;
}

// ---- opening the editor -------------------------------------------------------------
let openApi = null;
function openFor(ctx, el, opener) {
  const picked = targetOf(el);
  if (!picked) { ctx.toast(ctx.t("That element cannot be edited here. Try a card, button, field, tab, dialog or other listed element.", "呢個元素喺呢度改唔到。試吓卡片、按鈕、輸入框、分頁、對話框等列出嘅元素。"), "bad"); return null; }
  attachSheet();
  const existing = document.querySelector('[data-panel="appearance-editor"]');
  if (existing && openApi?.retarget) { openApi.retarget(picked); openApi.focus(); return openApi; }
  openApi = openEditor(ctx, picked, opener ?? el);
  return openApi;
}

let picking = false;
function startPick(ctx) {
  if (picking) return;
  picking = true;
  document.documentElement.dataset.picking = "true";
  ctx.toast(ctx.t("Click an element to edit its appearance. Press Escape to cancel.", "撳一個元素去編輯佢嘅外觀。撳 Escape 取消。"));
  const stop = () => { picking = false; delete document.documentElement.dataset.picking; document.removeEventListener("click", onClick, true); document.removeEventListener("keydown", onKey, true); };
  const onClick = (e) => { e.preventDefault(); e.stopPropagation(); stop(); openFor(ctx, e.target, document.activeElement); };
  const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); stop(); } };
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
}

// ---- the screen ----------------------------------------------------------------------
async function screen(ctx) {
  const w = widgets(ctx);
  const { h, t, icon } = ctx;
  const message = h("div", { role: "status" });
  const undoBtn = w.button({ en: "Undo", yue: "還原" }, "undo", () => undo(), "o sm");
  const redoBtn = w.button({ en: "Redo", yue: "重做" }, "redo", () => redo(), "o sm");
  const layersHost = h("div", {});
  const presetsHost = h("div", {});
  const logHost = h("div", { class: "ae-log" });
  const name = h("input", { class: "field", "aria-label": t("Preset name", "預設名稱"), placeholder: t("Preset name", "預設名稱"), maxlength: "40" });
  const draw = () => {
    undoBtn.disabled = !canUndo(); redoBtn.disabled = !canRedo();
    const d = editorStore.get();
    layersHost.replaceChildren(...(d.layers.length ? d.layers.map((l) => h("div", { class: "row" },
      w.toggle(() => l.on, () => mutate((x) => toggleLayer(x, l.id)), { en: "Show this change", yue: "顯示呢個改動" }),
      h("div", { class: "grow" }, h("div", { class: "t1" }, `${ctx.tt(TARGETS.find((x) => x.id === l.kind).label)} · ${ctx.tt(STATES.find((x) => x.id === l.state).label)}`), h("div", { class: "t2" }, `${ctx.tt(PROPS.find((p) => p.id === l.prop).label)}: ${l.value}`)),
      h("button", { type: "button", class: "info", "aria-label": t("Delete this change", "刪除呢個改動"), onClick: () => mutate((x) => removeLayer(x, l.id)) }, icon("delete", "sm")))) : [h("div", { class: "empty" }, icon("layers", "lg"), t("No element has been changed. The app looks as shipped. Pick an element to start.", "冇元素被改動，程式保持原貌。揀一個元素開始。"))]));
    presetsHost.replaceChildren(...(Object.keys(d.presets).length ? Object.keys(d.presets).map((n) => w.row(n, `${d.presets[n].length} ${t("changes", "個改動")}`, h("div", { class: "ctl" }, w.button({ en: "Apply", yue: "套用" }, "check", () => mutate((x) => applyPreset(x, n)), "t sm"), w.button({ en: "Delete", yue: "刪除" }, "delete", () => editorStore.update((x) => { deletePreset(x, n); })))))
      : [h("div", { class: "t2" }, t("No presets saved yet.", "未有儲存嘅預設。"))]));
    logHost.replaceChildren(...(d.log.length ? d.log.slice(-40).reverse().map((e) => h("div", { class: "logline" }, h("span", { class: "time" }, new Date(e.at).toLocaleTimeString([], { hour12: false })), e.text)) : [h("div", { class: "t2" }, t("No changes yet. The history only ever grows; undo adds to it.", "未有改動。記錄只會增加，還原都會加入記錄。"))]));
  };
  const off = editorStore.subscribe(() => (layersHost.isConnected ? draw() : off()));
  draw();

  const matrix = h("div", { class: "tbl" }, h("table", {},
    h("thead", {}, h("tr", {}, h("th", {}, t("Capability", "功能")), h("th", {}, t("State", "狀態")), h("th", {}, t("How it works", "運作方式")))),
    h("tbody", {}, MATRIX.map((m) => h("tr", {}, h("td", {}, ctx.tt(m.label)), h("td", {}, h("span", { class: `state-tag ${m.status === "working" ? "working" : m.status === "partial" ? "partial" : ""}` }, { working: t("Working", "運作中"), partial: t("Partly", "部分"), unsupported: t("Not supported", "未支援") }[m.status])), h("td", {}, ctx.tt(m.how)))))));

  ctx.root.append(ctx.page(label, { en: "Change the colour, shape, size, spacing and motion of any element and watch the whole app change. Nothing is lost: every change is a layer you can hide or reset.", yue: "改任何元素嘅顏色、形狀、大細、間距同動畫，成個程式即時變化。冇嘢會丟失：每個改動都係可以隱藏或重設嘅圖層。" },
    w.card({ en: "Edit an element", yue: "編輯元素" },
      h("p", { class: "muted" }, t("Three ways in: press Pick an element and click it; hold Alt and right-click it; or focus it with the keyboard and press Ctrl+Alt+E. The editor opens beside it and does not block the page.", "三個方法：撳「揀元素」再點選；按住 Alt 再右鍵點選；或者用鍵盤聚焦後撳 Ctrl+Alt+E。編輯器會喺旁邊打開，唔會擋住頁面。")),
      h("div", { class: "actions" }, w.button({ en: "Pick an element", yue: "揀元素" }, "ads_click", () => startPick(ctx), "f"), undoBtn, redoBtn)),
    w.card({ en: "Your changes", yue: "你嘅改動" }, layersHost, h("div", { class: "actions" },
      w.button({ en: "Reset all changes", yue: "重設所有改動" }, "restart_alt", async () => { if (!editorStore.get().layers.length) return; if (await ctx.confirmDialog({ title: t("Reset every element change?", "重設所有元素改動？"), body: t("The app goes back to its shipped look. You can undo this.", "程式會回復原貌。你可以還原。"), confirm: t("Reset", "重設") })) mutate((d) => clearAll(d)); }),
      w.button({ en: "Export", yue: "匯出" }, "download", () => w.download("element-styles.json", exportEditor(editorStore.get()))),
      w.button({ en: "Import", yue: "匯入" }, "upload", async () => {
        const f = await w.pickTextFile(".json,application/json", 400000);
        if (!f) return;
        const r = f.error ? { ok: false, error: f.error } : importEditor(f.text);
        if (!r.ok) return void message.replaceChildren(w.note("bad", r.error));
        mutate((d) => { d.layers = r.layers; Object.assign(d.presets, r.presets); d.log.push({ at: Date.now(), text: `Imported ${r.layers.length} changes` }); });
        message.replaceChildren(w.note(r.dropped ? "warn" : "", r.dropped ? t(`Imported ${r.layers.length} changes. ${r.dropped} were not valid and were left out.`, `已匯入 ${r.layers.length} 個改動，有 ${r.dropped} 個無效，已略過。`) : t(`Imported ${r.layers.length} changes.`, `已匯入 ${r.layers.length} 個改動。`)));
      })), message),
    w.card({ en: "Named presets", yue: "命名預設" }, presetsHost, h("div", { class: "ae-save" }, name, w.button({ en: "Save current as preset", yue: "將而家儲存做預設" }, "bookmark_add", () => { if (!savePresetFromInput()) message.replaceChildren(w.note("bad", t("Give the preset a name of 1 to 40 letters, numbers, spaces, dots or dashes.", "預設名稱要 1 至 40 個字母、數字、空格、點或橫線。"))); }))),
    collapsible(ctx, { id: "appearance-editor.history", title: { en: "History (append-only)", yue: "記錄（只增不減）" }, descriptive: true }, logHost),
    collapsible(ctx, { id: "appearance-editor.matrix", title: { en: "What the editor can and cannot do", yue: "編輯器可以同唔可以做嘅嘢" }, descriptive: true }, matrix)));
  function savePresetFromInput() {
    const n = name.value.trim();
    if (!n || !editorStore.get().layers.length) return false;
    let ok = false;
    editorStore.update((d) => { ok = savePreset(d, n); });
    if (ok) name.value = "";
    return ok;
  }
  return off;
}

export default {
  id: "appearance-editor",
  screens: [{ id: "appearance-editor", group: { en: "Appearance", yue: "外觀" }, icon: "edit_square", label, render: screen }],
  overlays: [{
    id: "appearance-editor.mount",
    mount(ctx) {
      attachSheet();
      const off = editorStore.subscribe(paint);
      const onContext = (e) => { if (e.altKey) { e.preventDefault(); openFor(ctx, e.target, e.target); } };
      const onKey = (e) => {
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "e") { e.preventDefault(); const el = document.activeElement && document.activeElement !== document.body ? document.activeElement : null; if (el) openFor(ctx, el, el); else startPick(ctx); }
      };
      document.addEventListener("contextmenu", onContext);
      document.addEventListener("keydown", onKey);
      return () => { off(); document.removeEventListener("contextmenu", onContext); document.removeEventListener("keydown", onKey); };
    },
  }],
  toolbar: [{ id: "pick-element", icon: "ads_click", label: { en: "Edit an element's appearance", yue: "編輯元素外觀" }, onClick: (ctx) => startPick(ctx) }],
  commands: [
    { id: "appearance-editor.pick", icon: "ads_click", label: { en: "Pick an element to edit", yue: "揀元素去編輯" }, keywords: "appearance style colour shape spacing element", run: (ctx) => startPick(ctx) },
    { id: "appearance-editor.open", icon: "edit_square", label: { en: "Open the element appearance screen", yue: "開啟元素外觀畫面" }, run: (ctx) => ctx.navigate("appearance-editor") },
    { id: "appearance-editor.undo", icon: "undo", label: { en: "Undo the last element change", yue: "還原上一個元素改動" }, run: () => undo() },
    { id: "appearance-editor.redo", icon: "redo", label: { en: "Redo the element change", yue: "重做元素改動" }, run: () => redo() },
  ],
  settings: [{
    id: "appearance-editor", icon: "edit_square", label,
    render(ctx) {
      const w = widgets(ctx);
      return [w.row({ en: "Element changes", yue: "元素改動" }, { en: `${editorStore.get().layers.length} saved in this browser.`, yue: `呢個瀏覽器已儲存 ${editorStore.get().layers.length} 個。` }, w.button({ en: "Open", yue: "開啟" }, "edit_square", () => ctx.navigate("appearance-editor"), "t sm"))];
    },
  }],
};
