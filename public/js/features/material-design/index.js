// The Appearance screen: Material 3 theme (light, dark or system), seed and
// dynamic colour, shape, density and font with a live preview, the colour role
// tokens, the component inventory and the honest completeness inventory. The
// settings are kept by the app in this browser (see prefs.js).
import { startAppearance, hasDynamicSeed } from "./apply.js";
import { INVENTORY, COMPONENTS, STATES } from "./inventory.js";
import { DEFAULTS, DENSITIES, PALETTE, RAINBOW, exportPrefs, importPrefs, prefs } from "./prefs.js";
import { widgets } from "./ui.js";
import { collapsible } from "../collapse-filters/collapsible.js";
import { pickColor } from "../color-picker/picker.js";

const label = { en: "Appearance", yue: "外觀" };
const set = (fn) => prefs.update(fn);
const TOKEN_NAMES = [["--primary", "Primary"], ["--primary-c", "Primary container"], ["--secondary-c", "Secondary container"], ["--tertiary", "Tertiary"], ["--bg", "Background"], ["--surf", "Surface"], ["--surf-low", "Surface low"], ["--surf-high", "Surface high"], ["--text", "On surface"], ["--sub", "On surface variant"], ["--line", "Outline"], ["--good", "Good"], ["--warn", "Warning"], ["--bad", "Error"]];
const DENSITY_LABEL = { compact: { en: "Compact", yue: "緊湊" }, comfortable: { en: "Comfortable", yue: "舒適" }, spacious: { en: "Spacious", yue: "寬鬆" } };
const STATE_YUE = { working: "運作中", partial: "部分運作", progress: "進行緊" };

export function appearanceCards(ctx) {
  const w = widgets(ctx);
  const { h, t } = ctx;
  const controls = [];
  const add = (c) => (controls.push(c), c);
  const themeSeg = add(w.segmented([["auto", { en: "System", yue: "跟系統" }], ["light", { en: "Light", yue: "淺色" }], ["dark", { en: "Dark", yue: "深色" }]], () => prefs.get().theme, (v) => set((d) => { d.theme = v; }), { en: "Theme", yue: "主題" }));
  const palette = h("div", { class: "palette-row", role: "group", "aria-label": t("Accent colour", "主色") });
  const swatches = PALETTE.map((hex) => {
    const b = h("button", { type: "button", class: "swatch-btn", "aria-label": hex, "aria-pressed": "false", onClick: () => set((d) => { d.accent = hex; }) });
    b.style.setProperty("--sw", hex);
    b.dataset.hex = hex;
    return b;
  });
  const rainbow = h("button", { type: "button", class: "swatch-btn rainbow", "aria-label": t("Animated rainbow", "動態彩虹"), title: t("Animated rainbow (stops moving when motion is reduced)", "動態彩虹（減少動態時會停喺一種顏色）"), "aria-pressed": "false", onClick: () => set((d) => { d.accent = RAINBOW; }) });
  const custom = w.button({ en: "Any colour…", yue: "任何顏色…" }, "colorize", async () => {
    const v = await pickColor(ctx, { initial: prefs.get().accent === RAINBOW ? "#4f5bd5" : prefs.get().accent, allowRainbow: true, title: t("Accent colour", "主色") });
    if (v) set((d) => { d.accent = v; });
  });
  palette.append(...swatches, rainbow, custom);
  const syncPalette = { sync() { const a = prefs.get().accent; swatches.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.hex === a))); rainbow.setAttribute("aria-pressed", String(a === RAINBOW)); } };
  add(syncPalette);
  syncPalette.sync();
  const dynamicNote = h("div", { class: "t2" });
  const dynamic = add(w.toggle(() => prefs.get().dynamic, (v) => set((d) => { d.dynamic = v; }), { en: "Dynamic colour from the logo", yue: "跟標誌嘅動態顏色" }));
  const dynSync = { sync() { dynamicNote.textContent = prefs.get().dynamic ? (hasDynamicSeed() ? t("Following the colour of your custom logo.", "而家跟住你自訂標誌嘅顏色。") : t("Waiting for a custom logo. Until then the accent above is used.", "等緊自訂標誌，期間用上面嘅主色。")) : ""; } };
  add(dynSync);
  dynSync.sync();
  const shape = add(w.slider({ min: 0, max: 2, step: 0.1, label: { en: "Corner roundness", yue: "圓角程度" }, get: () => prefs.get().shape, set: (v) => set((d) => { d.shape = v; }), format: (v) => (v === 0 ? t("Square", "方角") : `${Math.round(v * 100)}%`) }));
  const density = add(w.segmented(DENSITIES.map((d) => [d, DENSITY_LABEL[d]]), () => prefs.get().density, (v) => set((d) => { d.density = v; }), { en: "Density", yue: "密度" }));
  const font = add(w.segmented([["default", { en: "Roboto Flex", yue: "Roboto Flex" }], ["system", { en: "System", yue: "系統" }], ["serif", { en: "Serif", yue: "襯線" }], ["mono", { en: "Monospace", yue: "等寬" }]], () => prefs.get().font, (v) => set((d) => { d.font = v; }), { en: "Font", yue: "字體" }));
  const off = prefs.subscribe(() => (themeSeg.isConnected ? controls.forEach((c) => c.sync?.()) : off()));

  // The colour role tokens, read from the page as it is now.
  const tokens = h("div", { class: "tokens" });
  const drawTokens = () => {
    const cs = getComputedStyle(document.documentElement);
    tokens.replaceChildren(...TOKEN_NAMES.map(([v, name]) => {
      const sw = h("i", {});
      sw.style.setProperty("background", `var(${v})`);
      return h("div", { class: "token" }, sw, h("b", {}, name), h("small", {}, `${v} ${cs.getPropertyValue(v).trim().slice(0, 36)}`));
    }));
  };
  const offTokens = prefs.subscribe(() => (tokens.isConnected ? drawTokens() : offTokens()));
  queueMicrotask(drawTokens);

  return [
    w.card({ en: "Theme and colour", yue: "主題同顏色" },
      w.row({ en: "Theme", yue: "主題" }, { en: "Light, dark, or follow the system.", yue: "淺色、深色，或者跟系統。" }, themeSeg),
      w.row({ en: "Accent colour", yue: "主色" }, { en: "Every colour in the app is made from this one. Pick a swatch, any colour, or the animated rainbow.", yue: "成個程式嘅顏色都由呢個生成。揀色板、任何顏色，或者動態彩虹。" }, palette),
      w.row({ en: "Dynamic colour", yue: "動態顏色" }, { en: "Take the accent from your custom logo instead.", yue: "改為由你嘅自訂標誌取主色。" }, h("div", {}, dynamic, dynamicNote))),
    w.card({ en: "Shape, density and font", yue: "形狀、密度同字體" },
      w.row({ en: "Corner roundness", yue: "圓角程度" }, { en: "Changes every card, button, field and dialog at once.", yue: "同時改變所有卡片、按鈕、輸入框同對話框。" }, shape),
      w.row({ en: "Density", yue: "密度" }, { en: "How much space is between things.", yue: "各項之間有幾多空間。" }, density),
      w.row({ en: "Font", yue: "字體" }, { en: "Roboto Flex is built in. The others use fonts already on your device.", yue: "Roboto Flex 已內置，其他用你裝置已有嘅字體。" }, font)),
    collapsible(ctx, { id: "material-design.tokens", title: { en: "Colour roles in use now", yue: "而家使用緊嘅顏色角色" }, descriptive: true }, tokens),
  ];
}

function inventory(ctx) {
  const { h, t, tt } = ctx;
  const items = h("div", { class: "inv" }, INVENTORY.map((i) => h("div", { class: "item" },
    h("div", { class: "top" }, h("b", {}, tt(i.title)), h("span", { class: `state-tag ${i.state}` }, t(STATES[i.state], STATE_YUE[i.state]))),
    h("div", { class: "t2" }, h("b", {}, t("Works: ", "已做：")), tt(i.works)),
    h("div", { class: "t2" }, h("b", {}, t("Missing: ", "未做：")), tt(i.missing)))));
  const counts = INVENTORY.reduce((a, i) => ((a[i.state] += 1), a), { working: 0, partial: 0, progress: 0 });
  const comps = h("div", { class: "inv" }, COMPONENTS.map((c) => h("div", { class: "item" }, h("div", { class: "top" }, h("b", {}, c.surface), h("span", { class: "t2" }, c.classes.map((x) => `.${x}`).join(" "))), h("div", { class: "t2" }, c.component))));
  return [
    collapsible(ctx, { id: "material-design.inventory", title: { en: `Completeness: ${counts.working} working, ${counts.partial} partly, ${counts.progress} in progress`, yue: `完成度：${counts.working} 項運作中、${counts.partial} 項部分、${counts.progress} 項進行緊` }, defaultCollapsed: false }, items),
    collapsible(ctx, { id: "material-design.components", title: { en: "Material components in use", yue: "使用緊嘅 Material 組件" }, descriptive: true }, comps),
  ];
}

async function screen(ctx) {
  const w = widgets(ctx);
  const { t, h } = ctx;
  const message = h("div", { role: "status" });
  ctx.root.append(ctx.page(label, { en: "Make the app look and feel the way you like. Everything here is saved in this browser and changes the whole app straight away.", yue: "將程式調到你鍾意嘅樣子。呢度所有設定都儲存喺呢個瀏覽器，並即時改變成個程式。" },
    ...appearanceCards(ctx),
    w.card({ en: "Save, share and reset", yue: "儲存、分享同重設" }, h("div", { class: "actions" },
      w.button({ en: "Export appearance", yue: "匯出外觀" }, "download", () => w.download("appearance.json", exportPrefs())),
      w.button({ en: "Import appearance", yue: "匯入外觀" }, "upload", async () => {
        const f = await w.pickTextFile();
        if (!f) return;
        const r = f.error ? { ok: false, error: f.error } : importPrefs(f.text);
        if (!r.ok) return void message.replaceChildren(w.note("bad", r.error));
        prefs.replace(r.prefs);
        message.replaceChildren(w.note("", t("Appearance imported.", "已匯入外觀。")));
      }),
      w.button({ en: "Reset appearance", yue: "重設外觀" }, "restart_alt", async () => {
        if (await ctx.confirmDialog({ title: t("Reset the appearance?", "重設外觀？"), body: t("Theme, colour, shape, density, font, text size and motion go back to the defaults. Your element changes and logo are kept.", "主題、顏色、形狀、密度、字體、文字大細同動態會回復預設。你嘅元素改動同標誌會保留。"), confirm: t("Reset", "重設") })) prefs.replace({ ...DEFAULTS, a11yMenu: true });
      })), message),
    ...inventory(ctx)));
}

export default {
  id: "material-design",
  screens: [{ id: "material-design", group: { en: "Appearance", yue: "外觀" }, icon: "palette", label, render: screen }],
  overlays: [{ id: "material-design.apply", mount() { startAppearance(); return () => {}; } }],
  settings: [{ id: "material-design", icon: "palette", label, render: (ctx) => appearanceCards(ctx).slice(0, 1) }],
  commands: [
    { id: "material-design.open", icon: "palette", label: { en: "Open appearance", yue: "開啟外觀" }, keywords: "theme dark light accent colour density font shape", run: (ctx) => ctx.navigate("material-design") },
    { id: "material-design.reset", icon: "restart_alt", label: { en: "Reset the appearance", yue: "重設外觀" }, run: () => prefs.replace({ ...DEFAULTS, a11yMenu: true }) },
    { id: "material-design.contrast", icon: "contrast", label: { en: "Toggle high contrast", yue: "切換高對比度" }, keywords: "accessibility", run: () => set((d) => { d.contrast = d.contrast === "high" ? "standard" : "high"; }) },
  ],
};
