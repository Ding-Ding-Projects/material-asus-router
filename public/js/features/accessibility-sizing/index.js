// Accessibility tools: text size, contrast, reduced motion, focus ring, larger
// targets, keyboard help and read-aloud (which never reads secrets), in a
// button in the top bar that is visible by default. Hiding the button needs
// a confirmation with Cancel focused, and reset brings it back. A layout check
// reports anything on the current screen that is cut off or off the page.
import { prefs, DEFAULTS } from "../material-design/prefs.js";
import { widgets } from "../material-design/ui.js";
import { openPanel } from "../overlay-panels/panels.js";

const label = { en: "Accessibility tools", yue: "無障礙工具" };
const edit = (fn) => prefs.update(fn);

export const SHORTCUTS = [
  [["Ctrl", "K"], { en: "Open the command palette", yue: "開啟指令面板" }],
  [["Ctrl", "Alt", "A"], { en: "Open the accessibility tools", yue: "開啟無障礙工具" }],
  [["Ctrl", "Alt", "E"], { en: "Edit the appearance of the focused element", yue: "編輯聚焦元素嘅外觀" }],
  [["Alt", "right-click"], { en: "Edit the appearance of any element", yue: "編輯任何元素嘅外觀" }],
  [["Tab"], { en: "Move to the next control (Shift+Tab goes back)", yue: "移去下一個控制項（Shift+Tab 返轉頭）" }],
  [["Arrow keys"], { en: "Change a choice, move on a chart, move a floating panel", yue: "改選擇、喺圖表上移動、移動浮動面板" }],
  [["Shift", "Arrow keys"], { en: "Resize a floating panel from its header", yue: "喺標題上調整浮動面板大細" }],
  [["Home"], { en: "Reset a floating panel's position and size", yue: "重設浮動面板位置同大細" }],
  [["Esc"], { en: "Close a dialog, panel or search", yue: "關閉對話框、面板或搜尋" }],
];

// The text of the page that is safe to read out loud: nothing from fields, masked values or key text.
export function readableText(root) {
  const copy = root.cloneNode(true);
  copy.querySelectorAll('input,textarea,select,script,style,[data-secret],[type=password],.fp,.pwd,.pwdbox,pre.out,[aria-hidden=true]').forEach((n) => n.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 4000);
}

// Finds things on the current screen that are cut off or past the edge of the window.
export function findClipping(root = document.querySelector("#content") ?? document.body) {
  const found = [];
  const vw = document.documentElement.clientWidth;
  const hint = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`;
  for (const el of root.querySelectorAll("*")) {
    if (found.length >= 25) break;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || el.closest("[hidden],dialog:not([open])")) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (r.right > vw + 1 && !el.closest(".tbl,.cp-swatches,.tabs,.rail,.palette,.ae-log,.lc-svg")) found.push({ el, why: "past the right edge", hint: hint(el) });
    else if ((cs.overflowX === "hidden" || cs.overflowX === "clip") && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !/^(svg|path|canvas)$/i.test(el.tagName) && !el.matches(".sr,.lc-stage,.logo,.meter,.rangebar,.mo-panel,.hold")) found.push({ el, why: "text or content cut off", hint: hint(el) });
  }
  return found;
}

function help(ctx) {
  const { h, t } = ctx;
  ctx.openDialog((close) => [
    h("h2", { class: "h2" }, t("Keyboard help", "鍵盤說明")),
    ...SHORTCUTS.map(([keys, about]) => h("div", { class: "row" }, h("div", { class: "grow" }, ctx.tt(about)), h("div", { class: "chips" }, keys.map((k) => h("kbd", { class: "chip" }, k))))),
    h("div", { class: "actions" }, h("button", { type: "button", class: "btn f", onClick: () => close() }, t("Close", "關閉"))),
  ], { label: t("Keyboard help", "鍵盤說明") });
}

let speaking = false;
function readAloud(ctx, status) {
  const { t } = ctx;
  const synth = globalThis.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return void (status.textContent = t("This browser has no read-aloud voice.", "呢個瀏覽器冇朗讀語音。"));
  if (speaking) { synth.cancel(); speaking = false; status.textContent = t("Stopped reading.", "已停止朗讀。"); return; }
  const text = readableText(document.querySelector("#content") ?? document.body);
  if (!text) return void (status.textContent = t("There is nothing to read on this screen.", "呢個畫面冇嘢可以朗讀。"));
  const u = new SpeechSynthesisUtterance(text);
  u.lang = ctx.getLang() === "yue" ? "zh-HK" : "en";
  u.onend = u.onerror = () => { speaking = false; status.textContent = ""; };
  speaking = true;
  status.textContent = t("Reading this screen. Passwords, keys and fields are skipped. Press again to stop.", "朗讀緊呢個畫面。密碼、金鑰同輸入欄會略過。再撳一次停止。");
  synth.speak(u);
}

export async function hideMenu(ctx) {
  const { t } = ctx;
  const ok = await ctx.confirmDialog({ title: t("Hide the accessibility button?", "隱藏無障礙按鈕？"), body: t("The button in the top bar will disappear. You can still open the tools with Ctrl+Alt+A or the command palette, and Reset in this panel shows the button again.", "頂欄嘅按鈕會消失。你仍然可以用 Ctrl+Alt+A 或者指令面板開啟工具，喺面板撳「重設」就可以再顯示個按鈕。"), confirm: t("Hide it", "隱藏") });
  if (ok) edit((d) => { d.a11yMenu = false; });
  return ok;
}

// The controls, shared by the panel and the screen. Returns a list of nodes.
export function accessibilityControls(ctx) {
  const w = widgets(ctx);
  const { h, t } = ctx;
  const controls = [];
  const add = (c) => (controls.push(c), c);
  const status = h("div", { class: "t2", role: "status" });
  const size = add(w.slider({ min: 80, max: 160, step: 5, label: { en: "Text size", yue: "文字大細" }, get: () => prefs.get().textSize, set: (v) => edit((d) => { d.textSize = v; }), format: (v) => `${v}%` }));
  const contrast = add(w.segmented([["standard", { en: "Standard", yue: "標準" }], ["high", { en: "High", yue: "高" }]], () => prefs.get().contrast, (v) => edit((d) => { d.contrast = v; }), { en: "Contrast", yue: "對比度" }));
  const motion = add(w.segmented([["system", { en: "System", yue: "跟系統" }], ["on", { en: "Reduce", yue: "減少" }], ["off", { en: "Allow", yue: "容許" }]], () => prefs.get().motion.reduced, (v) => edit((d) => { d.motion.reduced = v; }), { en: "Reduced motion", yue: "減少動態" }));
  const focus = add(w.segmented([["standard", { en: "Standard", yue: "標準" }], ["thick", { en: "Thick", yue: "加粗" }]], () => prefs.get().focus, (v) => edit((d) => { d.focus = v; }), { en: "Focus ring", yue: "焦點框" }));
  const targets = add(w.toggle(() => prefs.get().largeTargets, (v) => edit((d) => { d.largeTargets = v; }), { en: "Larger targets", yue: "較大觸控目標" }));
  const off = prefs.subscribe(() => (size.isConnected ? controls.forEach((c) => c.sync?.()) : off()));
  return [
    w.row({ en: "Text size", yue: "文字大細" }, { en: "Makes everything bigger or smaller.", yue: "將所有嘢放大或縮細。" }, size),
    w.row({ en: "Contrast", yue: "對比度" }, { en: "High contrast adds outlines and darker text.", yue: "高對比度加外框同更深嘅文字。" }, contrast),
    w.row({ en: "Reduced motion", yue: "減少動態" }, { en: "Stops animation. Always wins over the animation editor.", yue: "停止動畫，永遠優先過動畫編輯器。" }, motion),
    w.row({ en: "Focus ring", yue: "焦點框" }, { en: "How clearly the focused control is outlined.", yue: "聚焦嘅控制項嘅外框有幾清楚。" }, focus),
    w.row({ en: "Larger targets", yue: "較大觸控目標" }, { en: "Buttons and links are at least 48 px.", yue: "按鈕同連結最少 48 px。" }, targets),
    h("div", { class: "actions" },
      w.button({ en: "Keyboard help", yue: "鍵盤說明" }, "keyboard", () => help(ctx)),
      w.button({ en: "Read this screen aloud", yue: "朗讀呢個畫面" }, "record_voice_over", () => readAloud(ctx, status)),
      w.button({ en: "Reset these settings", yue: "重設呢啲設定" }, "restart_alt", () => edit((d) => { Object.assign(d, { textSize: DEFAULTS.textSize, contrast: "standard", focus: "standard", largeTargets: false, a11yMenu: true }); d.motion.reduced = "system"; d.motion.low = false; }))),
    status,
  ];
}

function openTools(ctx, opener) {
  return openPanel(ctx, {
    id: "accessibility-tools", title: label, size: { w: 400, h: 560 }, opener,
    build(body) {
      const w = widgets(ctx);
      body.append(...accessibilityControls(ctx), w.row({ en: "Show this button", yue: "顯示呢個按鈕" }, { en: "Hiding it asks you to confirm.", yue: "隱藏前會請你確認。" }, w.toggle(() => prefs.get().a11yMenu, (v) => (v ? edit((d) => { d.a11yMenu = true; }) : hideMenu(ctx)), { en: "Show the accessibility button", yue: "顯示無障礙按鈕" })));
      return null;
    },
  });
}

async function screen(ctx) {
  const w = widgets(ctx);
  const { h, t, icon } = ctx;
  const results = h("div", { role: "status" });
  const runCheck = () => {
    const found = findClipping();
    results.replaceChildren(found.length ? h("div", { class: "inv" }, [w.note("warn", t(`${found.length} possible problem${found.length === 1 ? "" : "s"} on this screen.`, `呢個畫面可能有 ${found.length} 個問題。`)), ...found.map((f) => h("div", { class: "item" }, h("b", {}, f.hint), h("div", { class: "t2" }, f.why)))]) : w.note("", t("Nothing is cut off or past the edge on the screen you were last on, at this window size and text size.", "你上一個畫面喺而家嘅視窗同文字大細下，冇內容被裁切或者超出邊界。")));
  };
  ctx.root.append(ctx.page(label, { en: "Make the app easier to see, hear and use. These settings apply everywhere and are saved in this browser.", yue: "令程式更易睇、更易聽、更易用。呢啲設定套用到所有地方，並儲存喺呢個瀏覽器。" },
    w.card({ en: "Settings", yue: "設定" }, ...accessibilityControls(ctx),
      w.row({ en: "Show the top bar button", yue: "顯示頂欄按鈕" }, { en: "Visible by default. Hiding it asks you to confirm.", yue: "預設顯示。隱藏前會請你確認。" }, w.toggle(() => prefs.get().a11yMenu, (v) => (v ? edit((d) => { d.a11yMenu = true; }) : hideMenu(ctx)), { en: "Show the accessibility button", yue: "顯示無障礙按鈕" }))),
    w.card({ en: "Layout check", yue: "版面檢查" }, h("p", { class: "muted" }, t("Go to any screen, open this one in a second tab if you like, and press the button. It looks for anything cut off or past the edge at your current window size, text size, density and language.", "去任何畫面，再撳呢個按鈕。佢會喺你而家嘅視窗大細、文字大細、密度同語言下，搵出被裁切或超出邊界嘅內容。")), h("div", { class: "actions" }, w.button({ en: "Check this screen", yue: "檢查呢個畫面" }, "fact_check", runCheck, "t")), results),
    w.inProgress({ en: "The check runs on the screen you are looking at. A full pass over every screen, scale, density and language on the built app has not been run yet.", yue: "呢個檢查喺你睇緊嘅畫面運行。喺已建置程式上逐個畫面、縮放、密度同語言嘅完整檢查未跑。" }),
    h("span", { class: "sr" }, icon("accessibility"))));
}

export default {
  id: "accessibility-sizing",
  screens: [{ id: "accessibility-sizing", group: { en: "Appearance", yue: "外觀" }, icon: "accessibility_new", label, render: screen }],
  toolbar: [{ id: "accessibility-button", icon: "accessibility_new", label, onClick: (ctx) => openTools(ctx, document.activeElement) }],
  overlays: [{
    id: "accessibility-sizing.mount",
    mount(ctx) {
      // The button is part of the top bar; follow the saved choice to show or hide it.
      const text = ctx.tt(label);
      const paint = () => document.querySelectorAll(".bar .icb").forEach((b) => { if (b.getAttribute("aria-label") === text) b.hidden = !prefs.get().a11yMenu; });
      paint();
      const off = prefs.subscribe(paint);
      const onKey = (e) => { if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "a") { e.preventDefault(); openTools(ctx, document.activeElement); } };
      document.addEventListener("keydown", onKey);
      return () => { off(); document.removeEventListener("keydown", onKey); };
    },
  }],
  commands: [
    { id: "accessibility-sizing.open", icon: "accessibility_new", label: { en: "Open the accessibility tools", yue: "開啟無障礙工具" }, keywords: "text size contrast reduced motion focus read aloud keyboard", run: (ctx) => openTools(ctx) },
    { id: "accessibility-sizing.show", icon: "visibility", label: { en: "Show the accessibility button again", yue: "再顯示無障礙按鈕" }, run: () => edit((d) => { d.a11yMenu = true; }) },
    { id: "accessibility-sizing.larger", icon: "text_increase", label: { en: "Make the text larger", yue: "放大文字" }, run: () => edit((d) => { d.textSize = Math.min(160, d.textSize + 10); }) },
    { id: "accessibility-sizing.smaller", icon: "text_decrease", label: { en: "Make the text smaller", yue: "縮細文字" }, run: () => edit((d) => { d.textSize = Math.max(80, d.textSize - 10); }) },
  ],
  settings: [{ id: "accessibility-sizing", icon: "accessibility_new", label, render: (ctx) => accessibilityControls(ctx) }],
};
