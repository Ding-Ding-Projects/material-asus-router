// App logo customization: six presets, or your own picture. The picture is
// checked byte by byte (verify.js) before the browser decodes it, redrawn to a
// 256 pixel PNG with your crop, and kept only in this browser. It is never sent
// anywhere, and the previous logo stays if anything fails. The installed
// identity (page title, favicon) is never changed.
import { setDynamicSeed } from "../material-design/apply.js";
import { createJsonStore, safeStorage } from "../material-design/prefs.js";
import { parseColor, clampColor, format } from "../material-design/color.js";
import { widgets } from "../material-design/ui.js";
import { pickColor } from "../color-picker/picker.js";
import { LIMITS, cropRect, dominantColor, inspectImage } from "./verify.js";

const label = { en: "Logo", yue: "標誌" };
const NS = "http://www.w3.org/2000/svg";
export const PRESETS = [
  { id: "router", label: { en: "Router", yue: "路由器" }, paths: ["M5 15h14a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z", "M7 11a7 7 0 0 1 10 0", "M9.5 8a3.5 3.5 0 0 1 5 0"], dots: [[7, 18]] },
  { id: "wifi", label: { en: "Wi-Fi", yue: "Wi-Fi" }, paths: ["M2 9a15 15 0 0 1 20 0", "M5 12.5a10 10 0 0 1 14 0", "M8.5 16a5 5 0 0 1 7 0"], dots: [[12, 19.5]] },
  { id: "shield", label: { en: "Shield", yue: "盾牌" }, paths: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M8.5 12l2.5 2.5 4.5-5"], dots: [] },
  { id: "mesh", label: { en: "Mesh", yue: "網狀" }, paths: ["M6 7h12l-6 10z"], dots: [[6, 7], [18, 7], [12, 17]] },
  { id: "hex", label: { en: "Hexagon", yue: "六角形" }, paths: ["M12 2l8.5 5v10L12 22l-8.5-5V7z", "M12 8v8", "M8.5 10l7 4", "M15.5 10l-7 4"], dots: [] },
  { id: "globe", label: { en: "Globe", yue: "環球" }, paths: ["M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z", "M3 12h18", "M12 3a14 14 0 0 1 0 18", "M12 3a14 14 0 0 0 0 18"], dots: [] },
];
const PRESET_IDS = PRESETS.map((p) => p.id);

export const DEFAULT_LOGO = { kind: "preset", preset: "router", dataUrl: "", name: "", seed: "" };
export function sanitizeLogo(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const preset = PRESET_IDS.includes(r.preset) ? r.preset : "router";
  const dataUrl = typeof r.dataUrl === "string" && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(r.dataUrl) && r.dataUrl.length <= 600000 ? r.dataUrl : "";
  const seed = typeof r.seed === "string" && /^#[0-9a-f]{6}$/i.test(r.seed) ? r.seed.toLowerCase() : "";
  return { kind: r.kind === "custom" && dataUrl ? "custom" : "preset", preset, dataUrl, name: typeof r.name === "string" ? r.name.slice(0, 80) : "", seed };
}
export const logoStore = createJsonStore(safeStorage(), "mar.appearance.logo", sanitizeLogo, () => DEFAULT_LOGO);

function glyph(preset, size) {
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(k, String(v));
  for (const d of preset.paths) { const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); svg.append(p); }
  for (const [cx, cy] of preset.dots) { const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", 1.5); c.setAttribute("fill", "currentColor"); svg.append(c); }
  return svg;
}

// Fills an element with the current logo.
export function paintLogo(host, ctx, size = 24) {
  const l = logoStore.get();
  host.replaceChildren(l.kind === "custom" ? ctx.h("img", { src: l.dataUrl, alt: "", width: String(size * 1.5), height: String(size * 1.5), class: "logo-img" }) : glyph(PRESETS.find((p) => p.id === l.preset) ?? PRESETS[0], size));
  host.classList.toggle("custom", l.kind === "custom");
}
const syncSeed = () => setDynamicSeed(logoStore.get().kind === "custom" ? logoStore.get().seed || null : null);

async function screen(ctx) {
  const w = widgets(ctx);
  const { h, t, icon } = ctx;
  const status = h("div", { role: "status", "aria-live": "polite" });
  const setStatus = (kind, text) => status.replaceChildren(text ? w.note(kind, text) : "");
  const sizes = h("div", { class: "lg-sizes" });
  const presetsRow = h("div", { class: "lg-presets", role: "group", "aria-label": t("Preset logos", "預設標誌") });
  const draftHost = h("div", { class: "lg-draft", hidden: true });
  let draft = null;
  let loading = false;

  const drawCurrent = () => {
    const l = logoStore.get();
    sizes.replaceChildren(...[16, 24, 32, 44, 64, 128].map((px) => {
      const tile = h("div", { class: "lg-tile" }, h("span", { class: "logo lg-prev" }), h("small", {}, `${px}px`));
      const logo = tile.firstChild;
      logo.style.setProperty("width", `${px}px`); logo.style.setProperty("height", `${px}px`);
      paintLogo(logo, ctx, Math.round(px * 0.55));
      return tile;
    }));
    presetsRow.replaceChildren(...PRESETS.map((p) => h("button", { type: "button", class: "lg-pick", "aria-pressed": String(l.kind === "preset" && l.preset === p.id), "aria-label": ctx.tt(p.label), onClick: () => { logoStore.update((d) => { d.kind = "preset"; d.preset = p.id; }); setStatus("", t("Preset logo chosen.", "已揀預設標誌。")); } }, h("span", { class: "logo" }, glyph(p, 28)), h("span", {}, ctx.tt(p.label)))));
  };
  const off = logoStore.subscribe(() => { if (!sizes.isConnected) return off(); drawCurrent(); });
  drawCurrent();

  function showDraft() {
    const fit = { v: "cover" }; const zoom = { v: 1 }; const fx = { v: 0.5 }; const fy = { v: 0.5 }; const bg = { v: "" }; const safe = { v: true };
    const canvas = h("canvas", { width: "256", height: "256", class: "lg-canvas", role: "img", "aria-label": t("Preview of the cropped logo", "裁切後標誌嘅預覽") });
    const cx = canvas.getContext("2d");
    const redraw = () => {
      cx.clearRect(0, 0, 256, 256);
      if (bg.v) { cx.fillStyle = bg.v; cx.fillRect(0, 0, 256, 256); }
      const r = cropRect({ srcW: draft.bitmap.width, srcH: draft.bitmap.height, size: 256, fit: fit.v, zoom: zoom.v, fx: fx.v, fy: fy.v });
      cx.drawImage(draft.bitmap, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
      canvas.parentElement?.classList.toggle("safe", safe.v);
    };
    const redrawers = [];
    const slider = (cfg) => { const s = w.slider({ ...cfg, get: () => cfg.ref.v, set: (v) => { cfg.ref.v = v; redraw(); } }); redrawers.push(s); return s; };
    const fitSeg = w.segmented([["cover", { en: "Fill the square", yue: "填滿方形" }], ["contain", { en: "Show the whole picture", yue: "顯示成幅圖" }]], () => fit.v, (v) => { fit.v = v; zoom.v = 1; fitSeg.sync(); redrawers.forEach((s) => s.sync()); redraw(); }, { en: "Fit", yue: "適配" });
    const bgBtn = w.button({ en: "Background colour", yue: "背景顏色" }, "format_color_fill", async () => { const v = await pickColor(ctx, { initial: bg.v || "#ffffff", title: t("Logo background", "標誌背景") }); if (v && v !== "rainbow") { const p = parseColor(v); bg.v = format(clampColor(p.color), "hex"); redraw(); } });
    const noBg = w.button({ en: "No background", yue: "唔要背景" }, "format_color_reset", () => { bg.v = ""; redraw(); });
    const safeToggle = w.toggle(() => safe.v, (v) => { safe.v = v; safeToggle.sync(); redraw(); }, { en: "Show the safe area", yue: "顯示安全區" });
    const use = w.button({ en: "Use this logo", yue: "用呢個標誌" }, "check", () => {
      try {
        const data = canvas.toDataURL("image/png");
        const rgba = cx.getImageData(0, 0, 256, 256).data;
        const next = sanitizeLogo({ kind: "custom", preset: logoStore.get().preset, dataUrl: data, name: draft.name, seed: dominantColor(rgba) ?? "" });
        if (next.kind !== "custom") throw new Error("too big");
        logoStore.replace(next);
        setStatus("", t("Your logo is set. It stays in this browser and was never uploaded.", "已設定你嘅標誌。佢只存喺呢個瀏覽器，從未上載。"));
        closeDraft();
      } catch {
        setStatus("bad", t("The logo could not be saved, so your previous logo is unchanged.", "標誌儲存唔到，所以保留原本嘅標誌。"));
      }
    }, "f");
    const cancel = w.button({ en: "Cancel", yue: "取消" }, "close", () => { closeDraft(); setStatus("", t("Cancelled. Your logo is unchanged.", "已取消，標誌保持不變。")); });
    const guide = h("div", { class: "lg-frame safe" }, canvas, h("i", { class: "lg-safe", "aria-hidden": "true" }));
    draftHost.replaceChildren(
      h("div", { class: "lg-edit" }, guide, h("div", { class: "lg-ctrls" },
        w.row({ en: "Fit", yue: "適配" }, null, fitSeg),
        w.row({ en: "Zoom", yue: "縮放" }, null, slider({ min: 1, max: 4, step: 0.05, label: { en: "Zoom", yue: "縮放" }, ref: zoom, format: (v) => `${v.toFixed(2)}×` })),
        w.row({ en: "Focal point across", yue: "焦點（左右）" }, { en: "Which part of the picture stays in view.", yue: "圖片邊個部分留喺畫面。" }, slider({ min: 0, max: 1, step: 0.01, label: { en: "Focal point across", yue: "焦點左右" }, ref: fx, format: (v) => `${Math.round(v * 100)}%` })),
        w.row({ en: "Focal point down", yue: "焦點（上下）" }, null, slider({ min: 0, max: 1, step: 0.01, label: { en: "Focal point down", yue: "焦點上下" }, ref: fy, format: (v) => `${Math.round(v * 100)}%` })),
        w.row({ en: "Background", yue: "背景" }, { en: "Shows behind transparent parts.", yue: "喺透明部分後面顯示。" }, h("div", { class: "ctl" }, bgBtn, noBg)),
        w.row({ en: "Safe area guide", yue: "安全區參考" }, { en: "Keep the important part inside the dashed shape.", yue: "將重點放喺虛線形狀入面。" }, safeToggle))),
      h("div", { class: "actions" }, cancel, use));
    draftHost.hidden = false;
    redraw();
  }
  function closeDraft() { draft?.bitmap?.close?.(); draft = null; draftHost.hidden = true; draftHost.replaceChildren(); }

  // Choosing a file: check the bytes first, then let the browser decode, then show the crop controls.
  async function choose(file) {
    if (loading) return;
    if (!file) return;
    loading = true;
    setStatus("", t("Checking the file…", "檢查緊個檔案…"));
    try {
      if (file.size > LIMITS.maxBytes) return void setStatus("bad", t(`That file is larger than ${LIMITS.maxBytes / 1048576} MB. Your logo is unchanged.`, `個檔案大過 ${LIMITS.maxBytes / 1048576} MB。標誌保持不變。`));
      const bytes = new Uint8Array(await file.arrayBuffer());
      const r = inspectImage(bytes, { type: file.type, name: file.name });
      if (!r.ok) return void setStatus("bad", `${r.error} ${t("Your logo is unchanged.", "標誌保持不變。")}`);
      let bitmap;
      try { bitmap = await createImageBitmap(new Blob([bytes], { type: r.mime })); } catch { return void setStatus("bad", t("The browser could not open this picture. Your logo is unchanged.", "瀏覽器打開唔到呢幅圖。標誌保持不變。")); }
      if (bitmap.width !== r.width || bitmap.height !== r.height) { bitmap.close?.(); return void setStatus("bad", t("The picture's header and contents disagree, so it was refused. Your logo is unchanged.", "圖片嘅標頭同內容唔一致，已拒絕。標誌保持不變。")); }
      closeDraft();
      draft = { bitmap, name: file.name };
      showDraft();
      setStatus("", t(`Converted ${r.format.toUpperCase()} ${r.width} × ${r.height} to a 256 × 256 PNG preview. Adjust it, then press Use this logo.`, `已將 ${r.format.toUpperCase()} ${r.width} × ${r.height} 轉成 256 × 256 PNG 預覽。調好之後撳「用呢個標誌」。`));
    } catch {
      setStatus("bad", t("The file could not be read. Your logo is unchanged.", "讀唔到個檔案。標誌保持不變。"));
    } finally {
      loading = false;
    }
  }
  const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/gif,image/webp", class: "sr", tabindex: "-1", "aria-hidden": "true", onChange: () => { choose(input.files?.[0]); input.value = ""; } });
  const drop = h("div", { class: "drop", role: "button", tabindex: "0", "aria-label": t("Choose a picture for the logo, or drop one here", "揀一幅圖做標誌，或者拖放到呢度"),
    onClick: () => input.click(),
    onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } },
    onDragover: (e) => { e.preventDefault(); drop.classList.add("over"); },
    onDragleave: () => drop.classList.remove("over"),
    onDrop: (e) => { e.preventDefault(); drop.classList.remove("over"); choose(e.dataTransfer?.files?.[0]); } },
  icon("add_photo_alternate", "lg"), h("div", {}, h("div", { class: "t1" }, t("Choose a picture or drop one here", "揀一幅圖，或者拖放到呢度")), h("div", { class: "t2" }, t(`PNG, JPEG, GIF or WebP, still pictures only, up to ${LIMITS.maxBytes / 1048576} MB. Stays on this device.`, `PNG、JPEG、GIF 或 WebP，只限靜態圖，最大 ${LIMITS.maxBytes / 1048576} MB。只留喺呢部裝置。`))));

  ctx.root.append(ctx.page(label, { en: "Pick a preset, or use your own picture. The picture is checked, kept only in this browser, and never uploaded.", yue: "揀預設標誌，或者用自己嘅圖片。圖片會經過檢查，只儲存喺呢個瀏覽器，絕不上載。" },
    w.card({ en: "Your logo at every size", yue: "標誌喺各個大細嘅樣子" }, sizes),
    w.card({ en: "Presets", yue: "預設" }, presetsRow),
    w.card({ en: "Your own picture", yue: "你自己嘅圖片" }, drop, input, status, draftHost,
      h("div", { class: "actions" }, w.button({ en: "Reset to the default logo", yue: "重設做預設標誌" }, "restart_alt", () => { closeDraft(); logoStore.replace(DEFAULT_LOGO); setStatus("", t("Back to the default logo.", "已回復預設標誌。")); }))),
    w.note("", t("The page title and the browser tab icon belong to the installed app and are not changed by this.", "頁面標題同瀏覽器分頁圖示屬於已安裝程式，唔會被改動。"))));
  return () => { off(); closeDraft(); };
}

export default {
  id: "logo-customization",
  screens: [{ id: "logo-customization", group: { en: "Appearance", yue: "外觀" }, icon: "add_photo_alternate", label, render: screen }],
  overlays: [{
    id: "logo-customization.apply",
    mount(ctx) {
      const apply = () => { const host = document.querySelector(".rail .logo"); if (host) paintLogo(host, ctx, 26); syncSeed(); };
      apply();
      const off = logoStore.subscribe(apply);
      return off;
    },
  }],
  commands: [{ id: "logo-customization.open", icon: "add_photo_alternate", label: { en: "Change the app logo", yue: "更改程式標誌" }, keywords: "logo icon brand image upload", run: (ctx) => ctx.navigate("logo-customization") }],
  settings: [{ id: "logo-customization", icon: "add_photo_alternate", label, render: (ctx) => { const w = widgets(ctx); return w.row({ en: "App logo", yue: "程式標誌" }, { en: "Presets or your own picture.", yue: "預設或者你自己嘅圖片。" }, w.button({ en: "Change logo", yue: "更改標誌" }, "add_photo_alternate", () => ctx.navigate("logo-customization"), "t sm")); } }],
};
