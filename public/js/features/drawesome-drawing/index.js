// Drawing and annotation. Seven pens with their own line behaviour, a partial
// eraser, Shift for a straight line, a toolbar that changes shape (palette,
// sliders, a small disc), undo and redo that survive a restart, a guarded
// clear, and SVG and PNG export of exactly what is shown. Use it to mark up a
// screenshot or a network diagram. The drawing stays in this browser.
import { DrawHistory, EXPORT_SCALES, MAX_SIZE, MIN_SIZE, PENS, SHORTCUTS, STORAGE_LIMIT, eraseAt, lockPoints, packStrokes, pen, strokePath, toSvg, unpackStrokes } from "./strokes.js";
import { makeUi } from "./ui.js";
import { load, save } from "./store.js";

const label = { en: "Drawing", yue: "畫畫" };
const W = 1200;
const H = 800;
const COLORS = ["#111111", "#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#ffffff"];
const SHAPES = ["palette", "sliders", "disc"];

const saveFile = (name, blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

function render(ctx) {
  const { h, icon, t, tt, toast, confirmDialog } = ctx;
  const ui = makeUi(ctx);
  const prefs = { pen: "ballpoint", eraser: false, color: "#111111", size: 6, shape: "palette", ...load("prefs", {}) };
  const persistPrefs = () => save("prefs", prefs);
  const history = new DrawHistory([]);
  let image = null; // an imported picture to draw on top of
  let imageUrl = load("background", null);

  try {
    const saved = load("drawing", null);
    if (saved?.strokes) history.strokes = unpackStrokes(saved.strokes);
    for (const snap of saved?.past ?? []) history.past.push(unpackStrokes(snap));
  } catch {
    // A damaged saved drawing is ignored; the canvas simply starts empty.
  }

  const canvas = h("canvas", { class: "draw-canvas", width: String(W), height: String(H), "aria-label": t("Drawing area", "畫布"), role: "img" });
  const g = canvas.getContext("2d");
  const stage = h("div", { class: "draw-stage", tabindex: "0", "aria-label": t("Drawing area. Use the pen keys 1 to 7, E for the eraser.", "畫布。用 1 至 7 揀筆，E 係擦膠。") }, canvas);
  let live = null; // the stroke being drawn
  let working = null; // the stroke list while erasing

  function paint(target, scale = 1) {
    const c = target;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, W, H);
    if (image) {
      const k = Math.min(W / image.width, H / image.height);
      c.drawImage(image, (W - image.width * k) / 2, (H - image.height * k) / 2, image.width * k, image.height * k);
    }
    const list = working ?? (live ? [...history.strokes, live] : history.strokes);
    for (const s of list) {
      const p = pen(s.pen);
      c.globalAlpha = p.alpha;
      c.globalCompositeOperation = p.blend === "multiply" ? "multiply" : "source-over";
      c.fillStyle = s.color;
      c.fill(new Path2D(strokePath(s)));
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  }
  const redraw = () => paint(g);

  function persist() {
    const strokes = packStrokes(history.strokes);
    if (strokes.length > STORAGE_LIMIT) { toast(t("The drawing is too large to keep in this browser. Export it to keep it.", "畫太大，呢個瀏覽器儲唔落。請匯出保存。"), "bad"); return; }
    const past = [];
    let budget = STORAGE_LIMIT - strokes.length;
    for (const snap of history.past.slice(-15).reverse()) {
      const text = packStrokes(snap);
      if (text.length > budget) break;
      budget -= text.length;
      past.unshift(text);
    }
    save("drawing", { strokes, past });
  }

  function commit(next) {
    history.commit(next);
    persist();
    refreshState();
    redraw();
  }

  // ---- pointer drawing -------------------------------------------------------
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, t: performance.now() };
  };
  let before = null;
  let shift = false;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    stage.focus({ preventScroll: true });
    const p = at(e);
    shift = e.shiftKey;
    if (prefs.eraser) {
      before = history.strokes;
      working = eraseAt(before, { x: p.x, y: p.y, r: prefs.size * 1.5 });
    } else live = { id: `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, pen: prefs.pen, color: prefs.color, size: prefs.size, points: [p] };
    redraw();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!live && !working) return;
    const p = at(e);
    shift = e.shiftKey;
    if (working) working = eraseAt(working, { x: p.x, y: p.y, r: prefs.size * 1.5 });
    else {
      live.points.push(p);
      live.locked = shift;
    }
    redraw();
  });
  const finish = () => {
    if (working) {
      const result = working;
      working = null;
      if (result.length !== before.length || result.some((s, i) => s !== before[i])) commit(result);
      else redraw();
    } else if (live) {
      const done = { ...live, points: shift && live.points.length > 1 ? lockPoints(live.points) : live.points };
      delete done.locked;
      live = null;
      commit([...history.strokes, done]);
    }
  };
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);

  // ---- actions ------------------------------------------------------------------
  const undo = () => { history.undo(); persist(); refreshState(); redraw(); };
  const redo = () => { history.redo(); persist(); refreshState(); redraw(); };
  async function clearAll() {
    if (!history.strokes.length) return toast(t("The drawing is already empty.", "畫布已經係空嘅。"));
    if (await confirmDialog({ title: t("Clear the drawing?", "清除畫？"), body: t("Everything drawn is removed. You can undo this with Undo.", "所有畫嘅嘢都會移除。可以用「還原」取消。"), confirm: t("Clear", "清除"), danger: true })) { history.clear(); persist(); refreshState(); redraw(); }
  }
  function setPen(id) { prefs.pen = id; prefs.eraser = false; persistPrefs(); drawBar(); }
  function setSize(v) { prefs.size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, v)); persistPrefs(); sizeCtl?.set(prefs.size); }
  function cycleShape() { prefs.shape = SHAPES[(SHAPES.indexOf(prefs.shape) + 1) % SHAPES.length]; persistPrefs(); drawBar(); }

  stage.addEventListener("keydown", (e) => {
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "y") { e.preventDefault(); redo(); }
    else if (e.ctrlKey || e.metaKey || e.altKey) return;
    else if (/^[1-7]$/.test(k)) setPen(PENS[Number(k) - 1].id);
    else if (k.toLowerCase() === "e") { prefs.eraser = !prefs.eraser; persistPrefs(); drawBar(); }
    else if (k === "[") setSize(prefs.size - 2);
    else if (k === "]") setSize(prefs.size + 2);
    else if (k === "Delete") clearAll();
    else if (k.toLowerCase() === "t") cycleShape();
  });

  // ---- export ---------------------------------------------------------------------
  const exportSvg = () => saveFile("drawing.svg", new Blob([toSvg(history.strokes, W, H, { background: "#ffffff", image: imageUrl })], { type: "image/svg+xml" }));
  function exportPng(scale) {
    const c = document.createElement("canvas");
    c.width = W * scale;
    c.height = H * scale;
    paint(c.getContext("2d"), scale);
    c.toBlob((blob) => (blob ? saveFile(`drawing@${scale}x.png`, blob) : toast(t("The browser could not make the PNG.", "瀏覽器整唔到 PNG。"), "bad")), "image/png");
  }
  const picker = h("input", { type: "file", accept: "image/*", hidden: true, "aria-label": t("Choose a picture to draw on", "揀一張圖畫喺上面"), onChange(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => { image = img; imageUrl = String(reader.result); if (imageUrl.length < 1_500_000) save("background", imageUrl); else toast(t("The picture is too large to keep after you close this page, but it is shown now.", "張圖太大，閂咗頁面之後唔會保留，但而家有顯示。")); redraw(); };
      img.onerror = () => toast(t("The browser could not read that picture.", "瀏覽器讀唔到嗰張圖。"), "bad");
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  } });
  if (imageUrl) { const img = new Image(); img.onload = () => { image = img; redraw(); }; img.src = imageUrl; }

  // ---- the toolbar, in three shapes ---------------------------------------------------
  const bar = h("div", { class: "draw-bar", role: "toolbar", "aria-label": t("Drawing tools", "畫畫工具") });
  let sizeCtl = null;
  const undoBtn = h("button", { type: "button", class: "btn t sm", title: t("Undo (Ctrl+Z)", "還原（Ctrl+Z）"), onClick: undo }, icon("undo", "sm"), t("Undo", "還原"));
  const redoBtn = h("button", { type: "button", class: "btn t sm", title: t("Redo (Ctrl+Shift+Z or Ctrl+Y)", "重做（Ctrl+Shift+Z 或 Ctrl+Y）"), onClick: redo }, icon("redo", "sm"), t("Redo", "重做"));
  function refreshState() {
    undoBtn.disabled = !history.canUndo;
    redoBtn.disabled = !history.canRedo;
    canvas.setAttribute("aria-label", t(`Drawing area with ${history.strokes.length} stroke(s).`, `畫布，有 ${history.strokes.length} 條線。`));
  }
  function drawBar() {
    bar.className = `draw-bar ${prefs.shape}`;
    const penButtons = PENS.map((p) => h("button", { type: "button", class: "pen", "aria-pressed": String(!prefs.eraser && prefs.pen === p.id), title: `${tt(p.name)} — ${tt(p.about)} (${p.key})`, onClick: () => setPen(p.id) }, icon("edit", "sm"), h("span", { class: "name" }, tt(p.name))));
    const eraser = h("button", { type: "button", class: "pen", "aria-pressed": String(prefs.eraser), title: t("Eraser removes only what it touches (E)", "擦膠只擦碰到嘅部分（E）"), onClick() { prefs.eraser = !prefs.eraser; persistPrefs(); drawBar(); } }, icon("ink_eraser", "sm"), h("span", { class: "name" }, t("Eraser", "擦膠")));
    const swatches = COLORS.map((c) => h("button", { type: "button", class: "swatch-btn", "aria-pressed": String(prefs.color === c), "aria-label": c, title: c, onClick() { prefs.color = c; persistPrefs(); drawBar(); } })).map((b, i) => { b.style.background = COLORS[i]; return b; });
    const picker2 = h("input", { type: "color", class: "swatch", value: prefs.color, "aria-label": t("Pick a colour", "揀顏色"), onInput(e) { prefs.color = e.target.value; persistPrefs(); } });
    sizeCtl = ui.slider(MIN_SIZE, MAX_SIZE, 1, "px", prefs.size, (v) => { prefs.size = v; persistPrefs(); }, { en: "Pen size", yue: "筆嘅粗幼" });
    const shapeBtn = h("button", { type: "button", class: "btn t sm icon", "aria-label": t("Change the toolbar shape (T)", "轉換工具列形狀（T）"), title: t("Change the toolbar shape (T)", "轉換工具列形狀（T）"), onClick: cycleShape }, icon(prefs.shape === "disc" ? "radio_button_checked" : "view_agenda", "sm"));
    if (prefs.shape === "disc") {
      const disc = h("button", { type: "button", class: "disc-btn", "aria-label": t("Open the drawing tools", "打開畫畫工具"), onClick() { prefs.shape = "palette"; persistPrefs(); drawBar(); } });
      disc.style.background = prefs.color;
      bar.replaceChildren(disc);
    } else if (prefs.shape === "sliders") {
      bar.replaceChildren(ui.select(PENS.map((p) => [p.id, p.name]), prefs.pen, setPen, { en: "Pen", yue: "筆" }).el, sizeCtl.el, picker2, eraser, undoBtn, redoBtn, shapeBtn);
    } else bar.replaceChildren(...penButtons, eraser, h("span", { class: "grow" }), ...swatches, picker2, sizeCtl.el, undoBtn, redoBtn, shapeBtn);
    refreshState();
  }
  drawBar();

  const keys = h("div", { class: "draw-keys", "aria-label": t("Keyboard shortcuts", "鍵盤快捷鍵") }, SHORTCUTS.filter((s, i, all) => all.findIndex((o) => o.action === s.action) === i).map((s) => h("span", {}, h("kbd", {}, s.keys), " ", tt(s.label))));

  const exports = h("div", { class: "chips" },
    h("button", { type: "button", class: "btn f", onClick: exportSvg }, icon("download", "sm"), t("Export SVG", "匯出 SVG")),
    h("span", { class: "seg", role: "group", "aria-label": t("Export PNG", "匯出 PNG") }, EXPORT_SCALES.map((s) => h("button", { type: "button", onClick: () => exportPng(s) }, `PNG ${s}×`))),
    h("button", { type: "button", class: "btn o", onClick: () => picker.click() }, icon("add_photo_alternate", "sm"), t("Draw on a picture", "喺圖上面畫")), picker,
    h("button", { type: "button", class: "btn o", disabled: !imageUrl, onClick() { image = null; imageUrl = null; save("background", null); redraw(); } }, icon("hide_image", "sm"), t("Remove the picture", "移除圖片")),
    h("button", { type: "button", class: "btn d", onClick: clearAll }, icon("delete", "sm"), t("Clear", "清除")));

  const note = h("div", { class: "note warn" }, icon("construction", "sm"), t("In progress: pressure from a stylus (speed is used instead), a layers panel, and the shared history that joins this drawing to other screens. Undo and redo keep the last 15 steps across a restart.", "進行中：手寫筆壓力（暫時用速度代替）、圖層面板，同將呢幅畫連接其他畫面嘅共用記錄。還原同重做喺重新啟動後保留最近 15 步。"));

  ctx.root.append(ctx.page(label, { en: "Sketch and mark up screenshots or diagrams with seven pens.", yue: "用七支筆畫草圖同喺截圖或圖表上面做標記。" }));
  ctx.root.firstChild.append(h("section", { class: "card rise draw-wrap" }, bar, stage, keys, exports), note);
  refreshState();
  redraw();
}

export default {
  id: "drawesome-drawing",
  screens: [{ id: "drawesome-drawing", group: { en: "Tools", yue: "工具" }, icon: "brush", label, render }],
  commands: [{ id: "drawesome-drawing.open", icon: "brush", label: { en: "Open the drawing board", yue: "開啟畫板" }, keywords: "draw sketch annotate pen eraser svg png", run: (ctx) => ctx.navigate("drawesome-drawing") }],
  settings: [{ id: "drawesome-drawing", icon: "brush", label, render: (ctx) => ctx.h("div", { class: "t2" }, ctx.t("Your pen, colour, size and toolbar shape are remembered in this browser.", "你嘅筆、顏色、粗幼同工具列形狀會記住喺呢個瀏覽器。")) }],
};
