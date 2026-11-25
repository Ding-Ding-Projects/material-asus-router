// Floating panels: they paint their own surface, stay inside the window,
// scroll inside, drag by the header, resize from every edge and corner, and
// remember their size and position per panel id. Keyboard: Arrow keys on the
// header move the panel, Shift+Arrow resizes it, Home resets it, Escape closes.
import { prefs } from "../material-design/prefs.js";

export const MIN_W = 240;
export const MIN_H = 160;
const MARGIN = 8;

// ---- geometry (pure) ---------------------------------------------------------
const lim = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export function clampRect(r, vp, min = { w: MIN_W, h: MIN_H }) {
  const maxW = Math.max(120, vp.w - MARGIN * 2);
  const maxH = Math.max(100, vp.h - MARGIN * 2);
  const w = lim(Math.round(r.w), Math.min(min.w, maxW), maxW);
  const h = lim(Math.round(r.h), Math.min(min.h, maxH), maxH);
  return { w, h, x: lim(Math.round(r.x), MARGIN, Math.max(MARGIN, vp.w - w - MARGIN)), y: lim(Math.round(r.y), MARGIN, Math.max(MARGIN, vp.h - h - MARGIN)) };
}
export function moveRect(r, dx, dy, vp) {
  return clampRect({ ...r, x: r.x + dx, y: r.y + dy }, vp);
}
// edge is any of n, s, e, w, ne, nw, se, sw
export function resizeRect(r, edge, dx, dy, vp, min = { w: MIN_W, h: MIN_H }) {
  let { x, y, w, h } = r;
  if (edge.includes("e")) w += dx;
  if (edge.includes("s")) h += dy;
  if (edge.includes("w")) { const nw = Math.max(min.w, w - dx); x += w - nw; w = nw; }
  if (edge.includes("n")) { const nh = Math.max(min.h, h - dy); y += h - nh; h = nh; }
  return clampRect({ x, y, w: Math.max(min.w, w), h: Math.max(min.h, h) }, vp, min);
}
// Next to an element: to its right if there is room, else to its left, else below it.
export function anchoredRect(anchor, want, vp) {
  const size = { w: want?.w ?? 420, h: want?.h ?? 360 };
  const right = anchor.right + 12;
  const left = anchor.left - size.w - 12;
  const x = right + size.w <= vp.w - MARGIN ? right : left >= MARGIN ? left : Math.max(MARGIN, anchor.left);
  const y = x === Math.max(MARGIN, anchor.left) ? anchor.bottom + 12 : anchor.top;
  return clampRect({ x, y, ...size }, vp);
}
export const defaultRect = (vp, want = { w: 420, h: 360 }) => clampRect({ x: vp.w - want.w - 24, y: 88, ...want }, vp);

const viewport = () => ({ w: globalThis.innerWidth || 1024, h: globalThis.innerHeight || 768 });
export const savedRect = (id, store = prefs) => store.get().panels[id] ?? null;
export const resetPanel = (id, store = prefs) => store.update((d) => { delete d.panels[id]; });
export const resetAllPanels = (store = prefs) => store.update((d) => { d.panels = {}; });

const open = new Map();

// opts: { id, title: {en,yue}, build(body, ctx) -> optional cleanup, size?: {w,h}, opener?: Element }
export function openPanel(ctx, opts) {
  const { h, icon, t, tt } = ctx;
  const { id, title } = opts;
  if (open.has(id)) { open.get(id).focus(); return open.get(id); }
  const opener = opts.opener ?? document.activeElement;
  const el = h("div", { class: "mo-panel", role: "dialog", "aria-label": tt(title), "aria-modal": "false", "data-panel": id });
  const head = h("div", { class: "mo-head", tabindex: "0", role: "group", "aria-label": `${tt(title)}. ${t("Arrow keys move, Shift and arrows resize, Home resets, Escape closes.", "方向鍵移動，Shift 加方向鍵調整大細，Home 重設，Escape 關閉。")}` }, h("b", { class: "mo-title" }, tt(title)));
  const body = h("div", { class: "mo-body" });
  const resetBtn = h("button", { type: "button", class: "info", "aria-label": t("Reset position and size", "重設位置同大細"), title: t("Reset position and size", "重設位置同大細"), onClick: () => { resetPanel(id); place(); } }, icon("restart_alt", "sm"));
  const closeBtn = h("button", { type: "button", class: "info", "aria-label": t("Close panel", "關閉面板"), onClick: () => api.close() }, icon("close", "sm"));
  head.append(resetBtn, closeBtn);
  const handles = ["n", "ne", "e", "se", "s", "sw", "w", "nw"].map((edge) => h("div", { class: `mo-h mo-h-${edge}`, "data-edge": edge, "aria-hidden": "true" }));
  el.append(head, body, ...handles);

  let rect = { x: 0, y: 0, w: 0, h: 0 };
  const paint = () => {
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.w}px`;
    el.style.height = `${rect.h}px`;
  };
  const place = () => { rect = clampRect(savedRect(id) ?? (opts.anchor ? anchoredRect(opts.anchor, opts.size, viewport()) : defaultRect(viewport(), opts.size)), viewport()); paint(); };
  const persist = () => prefs.update((d) => { d.panels[id] = { ...rect }; });

  // drag the header
  let drag = null;
  head.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    head.setPointerCapture(e.pointerId);
    drag = { type: "move", sx: e.clientX, sy: e.clientY, start: { ...rect } };
    el.classList.add("moving");
  });
  for (const hd of handles) hd.addEventListener("pointerdown", (e) => { hd.setPointerCapture(e.pointerId); drag = { type: hd.dataset.edge, sx: e.clientX, sy: e.clientY, start: { ...rect }, target: hd }; el.classList.add("moving"); e.stopPropagation(); });
  const onMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    rect = drag.type === "move" ? moveRect(drag.start, dx, dy, viewport()) : resizeRect(drag.start, drag.type, dx, dy, viewport());
    paint();
  };
  const onUp = () => { if (!drag) return; drag = null; el.classList.remove("moving"); persist(); };
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("pointerdown", () => { el.style.zIndex = String(60 + open.size + (++z)); });

  head.addEventListener("keydown", (e) => {
    const step = e.ctrlKey ? 64 : 16;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); rect = e.shiftKey ? resizeRect(rect, "se", d[0], d[1], viewport()) : moveRect(rect, d[0], d[1], viewport()); paint(); persist(); }
    else if (e.key === "Home") { e.preventDefault(); resetPanel(id); place(); }
  });
  el.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); api.close(); } });
  const onResize = () => { rect = clampRect(rect, viewport()); paint(); };
  globalThis.addEventListener("resize", onResize);

  const api = {
    el, body, id,
    focus: () => head.focus(),
    close() {
      globalThis.removeEventListener("resize", onResize);
      cleanup?.();
      el.remove();
      open.delete(id);
      if (opener?.isConnected) opener.focus?.();
      opts.onClose?.();
    },
  };
  open.set(id, api);
  document.body.append(el);
  place();
  const cleanup = opts.build?.(body, api) ?? null;
  head.focus();
  return api;
}
let z = 0;
export const openPanelIds = () => [...open.keys()];
