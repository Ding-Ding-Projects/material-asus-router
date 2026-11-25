// The colour picker: a continuous 2D field, hue, alpha and OKLCH sliders, a
// number entry and translator for every format, honest gamut and contrast
// notes, and the animated rainbow choice. It is built from `ctx` only; the
// maths lives in ../material-design/color.js.
import { FORMATS, format, fromHsv, fromOklch, gamutMap, inGamut, parseColor, toHsv, toOklch, translate, wcagLevel, clampColor } from "../material-design/color.js";
import { RAINBOW } from "../material-design/prefs.js";

const FORMAT_LABEL = { hex: "HEX", hex8: "HEX8 (with alpha)", rgb: "RGB", hsl: "HSL", hsv: "HSV", hwb: "HWB", lab: "CIELAB", lch: "CIELCH", oklab: "OKLab", oklch: "OKLCH", cmyk: "CMYK", name: "Nearest name" };
const FORMAT_YUE = { name: "最近嘅名稱", hex8: "HEX8（連透明度）" };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createColorPicker(ctx, { initial = "#4f5bd5", allowRainbow = false, onChange = () => {}, onRainbow = null } = {}) {
  const { h, icon, t } = ctx;
  const parsed = parseColor(initial);
  let color = parsed.ok ? parsed.color : { r: 0.31, g: 0.36, b: 0.84, a: 1 };
  let hsv = toHsv(color);
  let rainbow = false;
  // The colour as text for the page: out-of-range colours are mapped into sRGB the same way the translator shows them.
  const outText = () => format(inGamut(color) ? clampColor(color) : gamutMap(color), color.a < 0.9995 ? "hex8" : "hex");

  const fl = (f) => t(FORMAT_LABEL[f], FORMAT_YUE[f]);
  const el = h("div", { class: "cp" });
  const field = h("div", { class: "cp-field", tabindex: "0", role: "slider", "aria-label": t("Saturation and brightness", "飽和度同亮度") });
  const thumb = h("i", { class: "cp-thumb" });
  field.append(thumb);
  const hue = h("input", { type: "range", class: "cp-range cp-hue", min: "0", max: "360", step: "0.1", "aria-label": t("Hue", "色相") });
  const alpha = h("input", { type: "range", class: "cp-range cp-alpha", min: "0", max: "100", step: "0.1", "aria-label": t("Alpha", "透明度") });
  const oks = [
    ["L", t("Lightness (OKLCH)", "亮度（OKLCH）"), 0, 1, 0.001],
    ["C", t("Chroma (OKLCH, can go past sRGB)", "彩度（OKLCH，可超出 sRGB）"), 0, 0.4, 0.001],
    ["h", t("Hue (OKLCH)", "色相（OKLCH）"), 0, 360, 0.1],
  ].map(([key, label, min, max, step]) => {
    const input = h("input", { type: "range", class: "cp-range", min: String(min), max: String(max), step: String(step), "aria-label": label });
    input.addEventListener("input", () => {
      const o = toOklch(color);
      o[key] = Number(input.value);
      set(fromOklch(o, color.a), { from: "oklch" });
    });
    return { key, input, label };
  });
  const preview = h("div", { class: "cp-preview", "aria-hidden": "true" }, h("i", {}));
  const nameOut = h("div", { class: "cp-name" });
  const contrastOut = h("div", { class: "chips" });
  const warnOut = h("div", { class: "cp-warn", role: "status" });
  const rainbowBtn = allowRainbow
    ? h("button", { type: "button", class: "chip cp-rainbow", "aria-pressed": "false", onClick: () => { rainbow = !rainbow; draw(); if (rainbow) onRainbow?.(); else onChange(format(color, "hex"), color); } }, icon("looks", "sm"), t("Animated rainbow", "動態彩虹"))
    : null;

  // One text box per format, each parses on Enter or when it loses focus.
  const rows = FORMATS.map((f) => {
    const input = h("input", { class: "field", spellcheck: "false", autocomplete: "off", "aria-label": fl(f), readOnly: f === "name" });
    const err = h("div", { class: "err", role: "alert", hidden: true });
    const commit = () => {
      if (f === "name") return;
      const p = parseColor(input.value);
      if (!p.ok) { err.textContent = p.error; err.hidden = false; input.setAttribute("aria-invalid", "true"); return; }
      err.hidden = true;
      input.removeAttribute("aria-invalid");
      set(p.color, { from: f });
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); });
    input.addEventListener("blur", () => { if (input.value !== input.dataset.shown) commit(); });
    const copy = h("button", { type: "button", class: "info", "aria-label": `${t("Copy", "複製")} ${fl(f)}`, async onClick() {
      try { await navigator.clipboard.writeText(input.value); ctx.toast(t("Copied.", "已複製。")); } catch { ctx.toast(t("Copy is not available here.", "呢度用唔到複製。"), "bad"); }
    } }, icon("content_copy", "sm"));
    return { f, input, err, node: h("div", { class: "cp-row" }, h("label", { class: "lbl" }, fl(f), h("div", { class: "cp-entry" }, input, copy)), err) };
  });

  function draw(from) {
    const k = clampColor(color);
    const css = format(color.r < 0 || color.r > 1 || color.g < 0 || color.g > 1 || color.b < 0 || color.b > 1 ? translate(color).mapped : color, "hex8");
    el.dataset.rainbow = String(rainbow);
    el.style.setProperty("--cp-hue", String(hsv.h));
    el.style.setProperty("--cp-color", css);
    el.style.setProperty("--cp-opaque", format(k, "hex"));
    thumb.style.setProperty("--x", `${hsv.s * 100}%`);
    thumb.style.setProperty("--y", `${(1 - hsv.v) * 100}%`);
    field.setAttribute("aria-valuetext", `${t("Saturation", "飽和度")} ${Math.round(hsv.s * 100)}%, ${t("brightness", "亮度")} ${Math.round(hsv.v * 100)}%`);
    field.setAttribute("aria-valuenow", String(Math.round(hsv.s * 100)));
    if (from !== "hue") hue.value = String(hsv.h);
    alpha.value = String(color.a * 100);
    const o = toOklch(color);
    for (const s of oks) if (from !== "oklch") s.input.value = String(o[s.key]);
    const tr = translate(color);
    for (const r of rows) {
      const text = tr.rows[r.f];
      r.input.dataset.shown = text;
      if (document.activeElement !== r.input || from !== r.f) { r.input.value = text; r.err.hidden = true; r.input.removeAttribute("aria-invalid"); }
    }
    nameOut.textContent = `${t("Nearest CSS name", "最近嘅 CSS 名稱")}: ${tr.rows.name}`;
    contrastOut.replaceChildren(...[["white", tr.contrastWhite, t("on white", "喺白色上")], ["black", tr.contrastBlack, t("on black", "喺黑色上")]].map(([, ratio, label]) => h("span", { class: `tag ${ratio >= 4.5 ? "good" : ratio >= 3 ? "warn" : "bad"}` }, `${label}: ${ratio.toFixed(2)}:1 ${wcagLevel(ratio)}`)));
    warnOut.replaceChildren(...tr.warnings.map((w) => h("div", { class: "note warn" }, icon("warning", "sm"), w)));
    rainbowBtn?.setAttribute("aria-pressed", String(rainbow));
    rainbowBtn?.classList.toggle("on", rainbow);
  }

  function set(next, { from, silent } = {}) {
    color = next;
    rainbow = false;
    const nh = toHsv(color);
    // Keep the hue when the colour is grey, so dragging does not jump around.
    hsv = { h: nh.s < 0.001 || nh.v < 0.001 ? hsv.h : nh.h, s: nh.s, v: nh.v };
    draw(from);
    if (!silent) onChange(outText(), color);
  }
  const fromHsvState = (from) => { color = fromHsv(hsv, color.a); rainbow = false; draw(from); onChange(outText(), color); };

  // pointer and keyboard on the 2D field
  const move = (e) => {
    const r = field.getBoundingClientRect();
    hsv = { ...hsv, s: clamp((e.clientX - r.left) / r.width, 0, 1), v: 1 - clamp((e.clientY - r.top) / r.height, 0, 1) };
    fromHsvState("field");
  };
  field.addEventListener("pointerdown", (e) => { field.setPointerCapture(e.pointerId); field.focus(); move(e); });
  field.addEventListener("pointermove", (e) => { if (field.hasPointerCapture(e.pointerId)) move(e); });
  field.addEventListener("keydown", (e) => {
    const d = (e.shiftKey ? 0.1 : 0.01) * (e.altKey ? 0.1 : 1);
    const map = { ArrowRight: [d, 0], ArrowLeft: [-d, 0], ArrowUp: [0, d], ArrowDown: [0, -d], PageUp: [0, 0.1], PageDown: [0, -0.1] };
    if (!map[e.key]) return;
    e.preventDefault();
    hsv = { ...hsv, s: clamp(hsv.s + map[e.key][0], 0, 1), v: clamp(hsv.v + map[e.key][1], 0, 1) };
    fromHsvState("field");
  });
  hue.addEventListener("input", () => { hsv = { ...hsv, h: Number(hue.value) }; fromHsvState("hue"); });
  alpha.addEventListener("input", () => { color = { ...color, a: Number(alpha.value) / 100 }; rainbow = false; draw("alpha"); onChange(outText(), color); });

  el.append(
    h("div", { class: "cp-top" }, preview, h("div", { class: "cp-main" }, field, h("label", { class: "lbl" }, t("Hue", "色相"), hue), h("label", { class: "lbl" }, t("Alpha", "透明度"), alpha))),
    h("div", { class: "cp-name-row" }, nameOut, contrastOut, rainbowBtn),
    h("div", { class: "cp-oklch" }, ...oks.map((s) => h("label", { class: "lbl" }, s.label, s.input))),
    warnOut,
    h("div", { class: "cp-rows" }, ...rows.map((r) => r.node)),
  );
  draw();
  return {
    el,
    get: () => (rainbow ? RAINBOW : outText()),
    getColor: () => color,
    set: (value) => { const p = parseColor(value); if (p.ok) set(p.color, { silent: true }); return p; },
    isRainbow: () => rainbow,
  };
}

// A dialog around the picker: resolves to a colour text, "rainbow", or null when cancelled.
export function pickColor(ctx, { initial, title, allowRainbow = false } = {}) {
  const { h, t } = ctx;
  let value = initial;
  let rainbow = false;
  const dialog = ctx.openDialog((close) => {
    const picker = createColorPicker(ctx, { initial, allowRainbow, onChange: (v) => { value = v; rainbow = false; }, onRainbow: () => { rainbow = true; } });
    return [
      h("h2", { class: "h2" }, title ?? t("Choose a colour", "揀顏色")),
      picker.el,
      h("div", { class: "actions" }, h("button", { type: "button", class: "btn o", onClick: () => close(null) }, t("Cancel", "取消")), h("button", { type: "button", class: "btn f", onClick: () => close(rainbow ? RAINBOW : value ?? initial) }, t("Use this colour", "用呢個顏色"))),
    ];
  }, { label: title ?? t("Choose a colour", "揀顏色") });
  return dialog.closed.then((v) => v ?? null);
}
