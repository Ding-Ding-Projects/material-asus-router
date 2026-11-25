// The model behind the per-element appearance editor. Pure functions, no DOM.
// A change is a "layer": one property of one kind of element in one state.
// Layers stack in order (a later layer wins), can be switched off without being
// deleted, and are turned into CSS by buildCss(). Nothing in the app's own
// files is touched, so removing every layer always gives back the stock look.
import { clampColor, format, parseColor } from "../material-design/color.js";

export const TARGETS = [
  { id: "card", selector: ".card", label: { en: "Card", yue: "卡片" }, motion: "cards" },
  { id: "button", selector: ".btn", label: { en: "Button", yue: "按鈕" }, motion: "hover-lift" },
  { id: "chip", selector: ".chip", label: { en: "Chip", yue: "標籤按鈕" }, motion: "hover-lift" },
  { id: "tag", selector: ".tag", label: { en: "Status tag", yue: "狀態標籤" }, motion: null },
  { id: "field", selector: ".field", label: { en: "Text field", yue: "輸入框" }, motion: null },
  { id: "rail-item", selector: ".navi", label: { en: "Rail item", yue: "側欄項目" }, motion: "tab-change" },
  { id: "tab", selector: ".tab", label: { en: "Tab", yue: "分頁" }, motion: "tab-change" },
  { id: "setting", selector: ".setting", label: { en: "Setting row", yue: "設定列" }, motion: null },
  { id: "dialog", selector: ".sheet", label: { en: "Dialog sheet", yue: "對話框" }, motion: "dialog" },
  { id: "panel", selector: ".mo-panel", label: { en: "Floating panel", yue: "浮動面板" }, motion: "sheet" },
  { id: "pill", selector: ".pill", label: { en: "Pill", yue: "藥丸標籤" }, motion: "hover-lift" },
  { id: "switch", selector: ".sw", label: { en: "Switch", yue: "開關" }, motion: "switch" },
  { id: "toast", selector: ".toast", label: { en: "Toast", yue: "短訊息" }, motion: "toast" },
  { id: "table", selector: ".tbl", label: { en: "Table", yue: "表格" }, motion: null },
  { id: "heading", selector: ".disp", label: { en: "Page heading", yue: "頁面標題" }, motion: "page-entry" },
  { id: "note", selector: ".note", label: { en: "Note", yue: "備註" }, motion: null },
];

export const STATES = [
  { id: "default", label: { en: "Default", yue: "預設" }, suffix: (s) => s },
  { id: "hover", label: { en: "Hover", yue: "懸停" }, suffix: (s) => `${s}:hover` },
  { id: "focus", label: { en: "Keyboard focus", yue: "鍵盤焦點" }, suffix: (s) => `${s}:focus-visible` },
  { id: "active", label: { en: "Pressed", yue: "按住" }, suffix: (s) => `${s}:active` },
  { id: "disabled", label: { en: "Disabled", yue: "停用" }, suffix: (s) => `${s}:disabled,${s}[aria-disabled=true]` },
];

const SHADOWS = { none: "none", e1: "var(--e1)", e2: "var(--e2)", e3: "var(--e3)" };
// type: color | px | number | choice. `css` is the property written.
export const PROPS = [
  { id: "color", css: "color", type: "color", label: { en: "Text colour", yue: "文字顏色" } },
  { id: "background", css: "background-color", type: "color", label: { en: "Background", yue: "背景" } },
  { id: "border-color", css: "border-color", type: "color", label: { en: "Border colour", yue: "邊框顏色" }, extra: "border-style:solid;border-width:1.5px" },
  { id: "radius", css: "border-radius", type: "px", min: 0, max: 60, label: { en: "Corner radius", yue: "圓角" } },
  { id: "font-size", css: "font-size", type: "px", min: 10, max: 44, label: { en: "Text size", yue: "文字大細" } },
  { id: "font-weight", css: "font-weight", type: "number", min: 100, max: 900, step: 50, label: { en: "Text weight", yue: "文字粗幼" } },
  { id: "letter-spacing", css: "letter-spacing", type: "px", min: -2, max: 8, step: 0.1, label: { en: "Letter spacing", yue: "字距" } },
  { id: "padding", css: "padding", type: "px", min: 0, max: 48, label: { en: "Spacing inside", yue: "內距" } },
  { id: "gap", css: "gap", type: "px", min: 0, max: 40, label: { en: "Gap between parts", yue: "各部分間距" } },
  { id: "min-height", css: "min-height", type: "px", min: 0, max: 160, label: { en: "Minimum height", yue: "最小高度" } },
  { id: "opacity", css: "opacity", type: "number", min: 0.1, max: 1, step: 0.05, label: { en: "Opacity", yue: "不透明度" } },
  { id: "shadow", css: "box-shadow", type: "choice", choices: Object.keys(SHADOWS), label: { en: "Elevation", yue: "高度陰影" } },
];
const PROP = Object.fromEntries(PROPS.map((p) => [p.id, p]));
const TARGET = Object.fromEntries(TARGETS.map((t) => [t.id, t]));
const STATE = Object.fromEntries(STATES.map((s) => [s.id, s]));

// Capability matrix: what the editor can and cannot do, each row mapped to how it is done.
export const MATRIX = [
  ...PROPS.map((p) => ({ id: p.id, label: p.label, status: "working", how: { en: `Writes ${p.css} for the chosen element kind and state. Saved in this browser, undoable, reachable by keyboard.`, yue: `為揀咗嘅元素同狀態寫入 ${p.css}。儲存喺呢個瀏覽器，可還原，可用鍵盤操作。` } })),
  { id: "layers", label: { en: "Layers (order, show/hide)", yue: "圖層（次序、顯示／隱藏）" }, status: "working", how: { en: "Each change is a layer you can hide, reorder or delete without losing the others.", yue: "每個改動都係一個圖層，可以隱藏、調次序或刪除，唔影響其他。" } },
  { id: "undo", label: { en: "Undo, redo and history", yue: "還原、重做同記錄" }, status: "working", how: { en: "Undo and redo while the page is open; every change is also appended to a saved history log.", yue: "頁面開住期間可還原同重做；每個改動都會加入已儲存嘅記錄。" } },
  { id: "presets", label: { en: "Named presets, copy and paste style, import and export", yue: "命名預設、複製貼上樣式、匯入同匯出" }, status: "working", how: { en: "Saved in this browser; import is checked and unreadable layers are reported.", yue: "儲存喺呢個瀏覽器；匯入會檢查，讀唔到嘅圖層會報告。" } },
  { id: "animation", label: { en: "Animation and transition tab", yue: "動畫同轉場分頁" }, status: "partial", how: { en: "Edits the motion kind that belongs to the element (duration, delay, easing, distance) with a timeline. Triggers are fixed per element kind.", yue: "編輯屬於該元素嘅動畫類別（時長、延遲、緩動、距離），附時間軸。觸發方式按元素類別固定。" } },
  { id: "gradients", label: { en: "Gradient and image fills", yue: "漸層同圖片填色" }, status: "unsupported", how: { en: "Not built. Backgrounds are single colours for now.", yue: "未做。背景暫時只有單色。" } },
  { id: "blend", label: { en: "Blend modes, masks and filters", yue: "混合模式、遮罩同濾鏡" }, status: "unsupported", how: { en: "Not built. This editor changes properties; it is not a compositing editor.", yue: "未做。呢個編輯器改屬性，唔係合成編輯器。" } },
  { id: "rich-text", label: { en: "Per-word typography (kerning, ligatures, OpenType features)", yue: "逐字排版（字距微調、連字、OpenType 功能）" }, status: "unsupported", how: { en: "Not built. Text size, weight and letter spacing apply to the whole element.", yue: "未做。文字大細、粗幼同字距套用到成個元素。" } },
  { id: "any-element", label: { en: "Elements outside the list above", yue: "上面清單以外嘅元素" }, status: "partial", how: { en: "Only the element kinds listed can be edited. Other elements are matched to the nearest listed kind, or reported as not editable.", yue: "只可以編輯清單入面嘅元素類別。其他元素會對應最近嘅類別，或者報告為不可編輯。" } },
];

// ---- layers --------------------------------------------------------------------
export function cleanValue(prop, value) {
  const p = PROP[prop];
  if (!p) return null;
  if (p.type === "color") {
    const c = parseColor(value);
    return c.ok ? format(clampColor(c.color), c.color.a < 0.9995 ? "hex8" : "hex") : null;
  }
  if (p.type === "choice") return p.choices.includes(value) ? value : null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return String(Math.min(p.max, Math.max(p.min, Number(n.toFixed(2)))));
}

export const emptyEditor = () => ({ layers: [], presets: {}, log: [] });
let counter = 0;
export const newId = () => `l${Date.now().toString(36)}${(counter += 1).toString(36)}`;

export function sanitizeLayer(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!(raw.kind in TARGET) || !(raw.state in STATE) || !(raw.prop in PROP)) return null;
  const value = cleanValue(raw.prop, raw.value);
  if (value === null) return null;
  return { id: typeof raw.id === "string" && /^[a-z0-9]{1,30}$/.test(raw.id) ? raw.id : newId(), kind: raw.kind, state: raw.state, prop: raw.prop, value, on: raw.on !== false };
}
export const sanitizeLayers = (list, limit = 400) => (Array.isArray(list) ? list : []).map(sanitizeLayer).filter(Boolean).slice(0, limit);
const presetName = /^[\p{L}\p{N} _.-]{1,40}$/u;

export function sanitizeEditor(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const presets = {};
  for (const [name, layers] of Object.entries(r.presets && typeof r.presets === "object" ? r.presets : {})) if (presetName.test(name) && Object.keys(presets).length < 30) presets[name] = sanitizeLayers(layers, 200);
  const log = (Array.isArray(r.log) ? r.log : []).filter((e) => e && typeof e.at === "number" && typeof e.text === "string").map((e) => ({ at: e.at, text: e.text.slice(0, 160) })).slice(-300);
  return { layers: sanitizeLayers(r.layers), presets, log };
}

// The CSS for a list of layers. Every value was cleaned above, so nothing from storage or an
// import can add anything but these properties.
export function buildCss(layers) {
  const rules = [];
  for (const l of layers) {
    if (!l.on) continue;
    const t = TARGET[l.kind];
    const s = STATE[l.state];
    const p = PROP[l.prop];
    if (!t || !s || !p) continue;
    const v = p.type === "px" ? `${l.value}px` : p.type === "choice" ? SHADOWS[l.value] : l.value;
    const selector = s.suffix(t.selector).split(",").map((x) => x.trim()).join(",");
    rules.push(`${selector}{${p.css}:${v}!important;${p.extra ? p.extra.split(";").map((e) => `${e.split(":")[0]}:${e.split(":")[1]}!important`).join(";") + ";" : ""}}`);
  }
  return rules.join("\n");
}

// ---- operations on a draft (use inside store.update) --------------------------
const label = (l) => `${TARGET[l.kind]?.label.en ?? l.kind} (${STATE[l.state]?.label.en ?? l.state}): ${PROP[l.prop]?.label.en ?? l.prop} = ${l.value}`;
const note = (d, text) => { d.log.push({ at: Date.now(), text }); if (d.log.length > 300) d.log.splice(0, d.log.length - 300); };

export function setLayer(d, kind, state, prop, value) {
  const clean = cleanValue(prop, value);
  if (clean === null) return false;
  const existing = d.layers.find((l) => l.kind === kind && l.state === state && l.prop === prop);
  if (existing) { existing.value = clean; existing.on = true; note(d, `Changed ${label(existing)}`); }
  else { const l = { id: newId(), kind, state, prop, value: clean, on: true }; d.layers.push(l); note(d, `Added ${label(l)}`); }
  return true;
}
export function removeLayer(d, id) {
  const i = d.layers.findIndex((l) => l.id === id);
  if (i < 0) return false;
  note(d, `Removed ${label(d.layers[i])}`);
  d.layers.splice(i, 1);
  return true;
}
export function toggleLayer(d, id) {
  const l = d.layers.find((x) => x.id === id);
  if (!l) return false;
  l.on = !l.on;
  note(d, `${l.on ? "Showed" : "Hid"} ${label(l)}`);
  return true;
}
export function moveLayer(d, id, delta) {
  const i = d.layers.findIndex((l) => l.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= d.layers.length) return false;
  [d.layers[i], d.layers[j]] = [d.layers[j], d.layers[i]];
  note(d, `Moved ${label(d.layers[j])} ${delta < 0 ? "earlier" : "later"}`);
  return true;
}
export function clearAll(d) { note(d, `Reset all ${d.layers.length} layers`); d.layers = []; }
export function savePreset(d, name) {
  if (!presetName.test(name)) return false;
  d.presets[name] = structuredClone(d.layers);
  note(d, `Saved preset "${name}"`);
  return true;
}
export function applyPreset(d, name) {
  if (!d.presets[name]) return false;
  d.layers = sanitizeLayers(structuredClone(d.presets[name])).map((l) => ({ ...l, id: newId() }));
  note(d, `Applied preset "${name}"`);
  return true;
}
export function deletePreset(d, name) { if (!(name in d.presets)) return false; delete d.presets[name]; note(d, `Deleted preset "${name}"`); return true; }
// Copy the layers of one kind and state, and paste them onto another.
export const copyStyle = (d, kind, state) => d.layers.filter((l) => l.kind === kind && l.state === state).map(({ prop, value }) => ({ prop, value }));
export function pasteStyle(d, clip, kind, state) {
  let n = 0;
  for (const c of clip) if (setLayer(d, kind, state, c.prop, c.value)) n += 1;
  return n;
}

export const exportEditor = (d) => JSON.stringify({ kind: "material-asus-router-elements", version: 1, layers: d.layers, presets: d.presets }, null, 2);
export function importEditor(text) {
  if (typeof text !== "string" || text.length > 400000) return { ok: false, error: "That file is too large." };
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: "That is not valid JSON." }; }
  if (data?.kind !== "material-asus-router-elements" || data.version !== 1) return { ok: false, error: "That file is not an element style file from this app." };
  const layers = sanitizeLayers(data.layers);
  const clean = sanitizeEditor({ presets: data.presets });
  const total = (Array.isArray(data.layers) ? data.layers.length : 0);
  return { ok: true, layers, presets: clean.presets, dropped: total - layers.length };
}

// Finds which listed kind an element belongs to (the nearest ancestor that matches).
export function targetOf(el) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    for (const t of TARGETS) if (node.matches?.(t.selector)) return { target: t, element: node };
  }
  return null;
}
