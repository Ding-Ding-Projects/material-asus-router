// Colour picker feature: a screen with the picker and translator, saved
// colours with export, import and reset, a name search with a regex builder,
// and "use as accent". The animated rainbow is a separate sentinel choice,
// never a stored palette colour.
import { NAMED, format, parseColor, clampColor } from "../material-design/color.js";
import { createJsonStore, prefs, safeStorage, RAINBOW } from "../material-design/prefs.js";
import { widgets } from "../material-design/ui.js";
import { collapsible } from "../collapse-filters/collapsible.js";
import { createColorPicker, pickColor } from "./picker.js";
import { createSearchBox } from "./search.js";

const label = { en: "Colour picker", yue: "顏色選擇器" };

export const sanitizeSaved = (raw) => {
  const out = [];
  for (const v of Array.isArray(raw?.saved) ? raw.saved : []) {
    if (typeof v !== "string" || v === RAINBOW) continue;
    const p = parseColor(v);
    if (!p.ok) continue;
    const hex = format(clampColor(p.color), p.color.a < 0.9995 ? "hex8" : "hex");
    if (!out.includes(hex)) out.push(hex);
    if (out.length >= 48) break;
  }
  return { saved: out };
};
export const savedColors = createJsonStore(safeStorage(), "mar.appearance.colors", sanitizeSaved, () => ({ saved: [] }));
export const exportSaved = (list) => JSON.stringify({ kind: "material-asus-router-colours", version: 1, saved: list }, null, 2);
export function importSaved(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: "That is not valid JSON." }; }
  if (data?.kind !== "material-asus-router-colours" || data.version !== 1 || !Array.isArray(data.saved)) return { ok: false, error: "That file is not a colour preset from this app." };
  const clean = sanitizeSaved({ saved: data.saved });
  const dropped = data.saved.length - clean.saved.length;
  return { ok: true, saved: clean.saved, dropped };
}

const named = Object.entries(NAMED).map(([name, hex]) => ({ name, hex: `#${hex}` }));

async function screen(ctx) {
  const w = widgets(ctx);
  const { h, t, icon } = ctx;
  let draft = prefs.get().accent;
  const picker = createColorPicker(ctx, { initial: draft === RAINBOW ? "#4f5bd5" : draft, allowRainbow: true, onChange: (v) => { draft = v; }, onRainbow: () => { draft = RAINBOW; } });
  const savedRow = h("div", { class: "cp-saved" });
  const drawSaved = () => {
    const list = savedColors.get().saved;
    savedRow.replaceChildren(...(list.length
      ? list.map((hex) => h("span", { class: "chip" }, h("button", { type: "button", class: "chip", "aria-label": `${t("Load", "載入")} ${hex}`, onClick: () => picker.set(hex) }, Object.assign(h("i", {}), {}), hex), h("button", { type: "button", class: "x", "aria-label": `${t("Remove", "移除")} ${hex}`, onClick: () => savedColors.update((d) => { d.saved = d.saved.filter((x) => x !== hex); }) }, icon("close", "sm"))))
      : [h("div", { class: "empty" }, icon("palette", "lg"), t("No saved colours yet. Pick one and press Save colour.", "未有儲低嘅顏色。揀咗之後撳「儲存顏色」。"))]));
    savedRow.querySelectorAll(".chip > .chip i").forEach((dot, i) => dot.style.setProperty("--sw", list[i]));
  };
  const off = savedColors.subscribe(drawSaved);
  drawSaved();

  const swatches = h("div", { class: "cp-swatches", role: "list" });
  let activeSearch = 0;
  const search = createSearchBox(ctx, {
    items: named,
    label: { en: "Search colour names", yue: "搜尋顏色名稱" },
    onChange: ({ matches, state }) => {
      activeSearch = state.query ? 1 : 0;
      swatches.replaceChildren(...matches.map((m) => {
        const b = h("button", { type: "button", role: "listitem", onClick: () => picker.set(m.hex) }, h("i", {}), m.name);
        b.style.setProperty("--sw", m.hex);
        b.querySelector("i").style.setProperty("--sw", m.hex);
        return b;
      }));
      if (!matches.length) swatches.append(h("div", { class: "empty" }, t("No colour name matches.", "冇顏色名稱符合。")));
      filterBox?.refresh();
    },
  });
  const filterBox = collapsible(ctx, { id: "color-picker.names", title: { en: "Find a named colour", yue: "搵有名嘅顏色" }, activeCount: () => activeSearch, descriptive: true }, search.el, swatches);

  const message = h("div", { role: "status" });
  const actions = h("div", { class: "actions" },
    w.button({ en: "Use as accent", yue: "用作主色" }, "palette", () => { prefs.update((d) => { d.accent = draft; }); ctx.toast(draft === RAINBOW ? t("The accent now cycles through the rainbow.", "主色而家會彩虹循環。") : t("Accent colour set.", "已設定主色。")); }, "f"),
    w.button({ en: "Save colour", yue: "儲存顏色" }, "bookmark_add", () => { if (draft !== RAINBOW) savedColors.update((d) => { d.saved.push(draft); }); else ctx.toast(t("The rainbow is a special choice and cannot be saved as a colour.", "彩虹係特別選擇，唔可以儲存做顏色。"), "bad"); }, "t"),
    w.button({ en: "Reset picker", yue: "重設選擇器" }, "restart_alt", () => { picker.set(prefs.get().accent === RAINBOW ? "#4f5bd5" : prefs.get().accent); draft = prefs.get().accent; }));
  const io = h("div", { class: "actions" },
    w.button({ en: "Export saved colours", yue: "匯出已儲存顏色" }, "download", () => w.download("saved-colours.json", exportSaved(savedColors.get().saved))),
    w.button({ en: "Import saved colours", yue: "匯入已儲存顏色" }, "upload", async () => {
      const f = await w.pickTextFile();
      if (!f) return;
      const r = f.error ? { ok: false, error: f.error } : importSaved(f.text);
      if (!r.ok) { message.replaceChildren(w.note("bad", r.error)); return; }
      savedColors.update((d) => { d.saved = r.saved; });
      message.replaceChildren(w.note(r.dropped ? "warn" : "", r.dropped ? t(`Imported ${r.saved.length} colours. ${r.dropped} could not be read and were left out.`, `已匯入 ${r.saved.length} 個顏色，有 ${r.dropped} 個讀唔到，冇加入。`) : t(`Imported ${r.saved.length} colours.`, `已匯入 ${r.saved.length} 個顏色。`)));
    }),
    w.button({ en: "Remove all saved", yue: "移除全部已儲存" }, "delete", async () => { if (await ctx.confirmDialog({ title: t("Remove all saved colours?", "移除全部已儲存顏色？"), body: t("This cannot be undone, but you can export first.", "冇得還原，不過你可以先匯出。"), confirm: t("Remove", "移除"), danger: true })) savedColors.reset(); }, "o sm"));

  ctx.root.append(ctx.page(label, { en: "Pick any colour, and see it translated to every format with honest notes about what changes.", yue: "揀任何顏色，睇佢轉成每種格式，同埋有咩會改變都會老實講。" },
    w.card({ en: "Picker and translator", yue: "選擇器同轉換器" }, picker.el, actions),
    w.card({ en: "Saved colours", yue: "已儲存顏色" }, savedRow, io, message),
    filterBox,
    w.inProgress({ en: "The search box has plain text and a regex mode with a small builder. A full regex builder with every RegexBuddy feature is not built yet.", yue: "搜尋有純文字同正則模式，另有簡單建構器。完整、涵蓋 RegexBuddy 全部功能嘅正則建構器未做。" })));
  return off;
}

export default {
  id: "color-picker",
  screens: [{ id: "color-picker", group: { en: "Appearance", yue: "外觀" }, icon: "palette", label, render: screen }],
  settings: [{
    id: "color-picker", icon: "palette", label,
    render(ctx) {
      const w = widgets(ctx);
      return w.row({ en: "Accent colour", yue: "主色" }, { en: "Opens the picker. Any colour, or the animated rainbow.", yue: "開啟選擇器。任何顏色，或者動態彩虹。" }, w.button({ en: "Choose accent", yue: "揀主色" }, "palette", async () => {
        const v = await pickColor(ctx, { initial: prefs.get().accent === RAINBOW ? "#4f5bd5" : prefs.get().accent, allowRainbow: true, title: ctx.t("Accent colour", "主色") });
        if (v) prefs.update((d) => { d.accent = v; });
      }));
    },
  }],
  commands: [
    { id: "color-picker.open", icon: "palette", label: { en: "Open the colour picker", yue: "開啟顏色選擇器" }, keywords: "color colour translate hex rgb hsl oklch", run: (ctx) => ctx.navigate("color-picker") },
    { id: "color-picker.accent", icon: "colorize", label: { en: "Choose the accent colour", yue: "揀主色" }, keywords: "accent seed rainbow", async run(ctx) { const v = await pickColor(ctx, { initial: prefs.get().accent === RAINBOW ? "#4f5bd5" : prefs.get().accent, allowRainbow: true }); if (v) prefs.update((d) => { d.accent = v; }); } },
  ],
};
