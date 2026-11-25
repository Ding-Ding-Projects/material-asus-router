// The live chart, in the Liveline style: an easing line over a soft gradient,
// a pulsing live dot, a quiet grid, axes and a badge that ease to new values,
// and a scrub crosshair with a time and value tooltip (pointer or keyboard).
// Reduced motion and Low stimulation make it snap instead of easing.
import { layout, nearestIndex, niceMax, segments, smoothPath, summary } from "./chart-model.js";
import { reducedNow, onAppearanceChange } from "../material-design/apply.js";

const NS = "http://www.w3.org/2000/svg";
const W = 600;
const PAD = { l: 8, r: 10, t: 14, b: 22 };
let uid = 0;

// opts: { label: {en,yue}, series: "primary"|"tertiary", format(v), windowMs, height, intervalMs }
export function createLiveChart(ctx, opts) {
  const { h, t, tt } = ctx;
  const { format, windowMs = 120000, height = 160, intervalMs = 2000, series = "primary" } = opts;
  const id = `lc${(uid += 1)}`;
  const svg = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };

  const root = svg("svg", { class: `lc-svg ${series}`, viewBox: `0 0 ${W} ${height}`, preserveAspectRatio: "none", "aria-hidden": "true" });
  const defs = svg("defs");
  const grad = svg("linearGradient", { id: `${id}-g`, x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(svg("stop", { offset: "0%", class: "lc-stop-a" }), svg("stop", { offset: "100%", class: "lc-stop-b" }));
  defs.append(grad);
  const grid = svg("g", { class: "lc-grid" });
  const area = svg("path", { class: "lc-area", fill: `url(#${id}-g)` });
  const line = svg("path", { class: "lc-line", fill: "none" });
  const dotRing = svg("circle", { class: "lc-ring", r: 6 });
  const dot = svg("circle", { class: "lc-dot", r: 4 });
  const cross = svg("line", { class: "lc-cross", y1: PAD.t, y2: height - PAD.b });
  const scrubDot = svg("circle", { class: "lc-scrub", r: 5 });
  root.append(defs, grid, area, line, dotRing, dot, cross, scrubDot);

  const yMax = h("span", { class: "lc-axis lc-ymax" });
  const yMin = h("span", { class: "lc-axis lc-ymin" }, "0");
  const xOld = h("span", { class: "lc-axis lc-xold" });
  const xNew = h("span", { class: "lc-axis lc-xnew" }, t("now", "而家"));
  const badge = h("span", { class: "lc-badge" });
  const tip = h("div", { class: "lc-tip", hidden: true, "aria-hidden": "true" });
  const stateBox = h("div", { class: "lc-state", role: "status" });
  const text = h("div", { class: "lc-summary t2" });
  const stage = h("div", { class: "lc-stage", tabindex: "0", role: "slider", "aria-roledescription": t("live chart", "即時圖表"), "aria-valuemin": "0", "aria-valuemax": "0", "aria-valuenow": "0" }, root, yMax, yMin, xOld, xNew, badge, tip, stateBox);
  stage.style.setProperty("--lc-h", `${height}px`);
  const el = h("figure", { class: "lc" }, stage, text);

  let points = [];
  let state = "loading";
  let max = 1;
  let shownMax = 1;
  let shownLast = null;
  let scrub = -1;
  let raf = 0;
  let drew = false;
  let lastAt = 0;
  let laid = [];
  const staleAfter = intervalMs * 3.5;

  const snap = () => reducedNow();

  function frame() {
    raf = 0;
    const target = niceMax(Math.max(...points.map((p) => p.v), 0) * 1.1);
    max = target;
    const last = points[points.length - 1];
    if (snap()) { shownMax = max; shownLast = last?.v ?? null; }
    else {
      shownMax += (max - shownMax) * 0.18;
      if (Math.abs(max - shownMax) < max * 0.004) shownMax = max;
      if (last) shownLast = shownLast === null ? last.v : shownLast + (last.v - shownLast) * 0.22;
      if (last && Math.abs(last.v - shownLast) < Math.max(1e-9, max * 0.002)) shownLast = last.v;
    }
    draw();
    const settling = !snap() && ((last && shownLast !== last.v) || shownMax !== max);
    if (settling) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function draw() {
    const end = points.length ? points[points.length - 1].t : Date.now();
    const shown = points.map((p, i) => (i === points.length - 1 && shownLast !== null ? { ...p, v: shownLast } : p));
    laid = layout(shown, { end, windowMs, width: W, height, pad: PAD, max: shownMax });
    const runs = segments(laid, Math.max(intervalMs * 4, 8000));
    const baseY = height - PAD.b;
    line.setAttribute("d", runs.map((r) => smoothPath(r.map((p) => [p.x, p.y]))).join(" "));
    area.setAttribute("d", runs.filter((r) => r.length > 1).map((r) => `${smoothPath(r.map((p) => [p.x, p.y]))}L${r[r.length - 1].x.toFixed(1)},${baseY}L${r[0].x.toFixed(1)},${baseY}Z`).join(" "));
    grid.replaceChildren(...[0, 1, 2, 3].map((i) => svg("line", { x1: PAD.l, x2: W - PAD.r, y1: PAD.t + ((baseY - PAD.t) * i) / 3, y2: PAD.t + ((baseY - PAD.t) * i) / 3 })));
    const last = laid[laid.length - 1];
    const live = state === "live" && last;
    dot.setAttribute("cx", last?.x ?? -10); dot.setAttribute("cy", last?.y ?? -10);
    dotRing.setAttribute("cx", last?.x ?? -10); dotRing.setAttribute("cy", last?.y ?? -10);
    dot.style.setProperty("display", last ? "" : "none");
    dotRing.classList.toggle("pulse", Boolean(live));
    dotRing.style.setProperty("display", live ? "" : "none");
    if (!drew && laid.length > 1 && !snap()) {
      drew = true;
      const len = Math.ceil(line.getTotalLength?.() ?? 1000);
      line.style.setProperty("--len", String(len));
      line.classList.add("draw");
      setTimeout(() => line.classList.remove("draw"), 1200);
    }
    yMax.textContent = format(shownMax);
    xOld.textContent = `−${Math.round(windowMs / 1000)} s`;
    badge.textContent = points.length ? format(points[points.length - 1].v) : "";
    badge.hidden = !points.length;
    badge.dataset.state = state;
    drawScrub();
    stage.dataset.state = state;
  }

  function drawScrub() {
    const p = scrub >= 0 ? laid[scrub] : null;
    cross.style.setProperty("display", p ? "" : "none");
    scrubDot.style.setProperty("display", p ? "" : "none");
    tip.hidden = !p;
    if (!p) return;
    cross.setAttribute("x1", p.x); cross.setAttribute("x2", p.x);
    scrubDot.setAttribute("cx", p.x); scrubDot.setAttribute("cy", p.y);
    stage.style.setProperty("--tx", `${(p.x / W) * 100}%`);
    stage.style.setProperty("--ty", `${(p.y / height) * 100}%`);
    tip.textContent = `${new Date(p.t).toLocaleTimeString([], { hour12: false })}  ${format(p.v)}`;
    stage.setAttribute("aria-valuenow", String(scrub));
    stage.setAttribute("aria-valuetext", tip.textContent);
  }

  function describe() {
    const message = {
      loading: t("Waiting for the first reading…", "等緊第一個讀數…"),
      paused: t("Paused. Press Resume to start again.", "已暫停。撳「繼續」重新開始。"),
      empty: t("Nothing to show yet.", "暫時未有資料。"),
      stale: t("No new reading for a while. Showing the last data.", "一段時間冇新讀數，顯示最後嘅資料。"),
    }[state] ?? "";
    stateBox.textContent = message;
    stateBox.hidden = !message;
    stateBox.classList.toggle("lc-over", state === "loading" || state === "empty");
    const sentence = summary(points, { format, label: tt(opts.label), state, windowMs });
    text.textContent = sentence;
    stage.setAttribute("aria-label", sentence);
    stage.setAttribute("aria-valuemax", String(Math.max(0, laid.length - 1)));
  }

  // stale detection runs on a timer so a stopped feed is noticed
  const watch = setInterval(() => {
    if (state === "live" && Date.now() - lastAt > staleAfter) { state = "stale"; describe(); draw(); }
  }, 1000);

  const pointerIndex = (e) => { const r = stage.getBoundingClientRect(); return nearestIndex(laid, ((e.clientX - r.left) / r.width) * W); };
  stage.addEventListener("pointermove", (e) => { scrub = pointerIndex(e); drawScrub(); });
  stage.addEventListener("pointerleave", () => { if (document.activeElement !== stage) { scrub = -1; drawScrub(); } });
  stage.addEventListener("blur", () => { scrub = -1; drawScrub(); });
  stage.addEventListener("keydown", (e) => {
    if (!laid.length) return;
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
    if (e.key === "Escape") { scrub = -1; drawScrub(); return; }
    if (!(e.key in moves)) return;
    e.preventDefault();
    const from = scrub < 0 ? laid.length - 1 : scrub;
    scrub = Math.max(0, Math.min(laid.length - 1, Number.isFinite(moves[e.key]) ? from + moves[e.key] : moves[e.key] < 0 ? 0 : laid.length - 1));
    drawScrub();
  });
  const offAppearance = onAppearanceChange(() => { shownMax = max; shownLast = points[points.length - 1]?.v ?? null; draw(); });

  describe();
  draw();
  return {
    el,
    // Add one real reading. Time defaults to now.
    push(v, at = Date.now()) {
      if (!Number.isFinite(v)) return;
      points.push({ t: at, v });
      points = points.filter((p) => p.t >= at - windowMs * 1.2).slice(-720);
      lastAt = Date.now();
      if (state !== "paused") state = "live";
      describe();
      kick();
    },
    setState(next) { state = next; describe(); draw(); },
    // The feed failed: keep the data but say it is out of date.
    markStale() { if (state !== "paused") { state = points.length ? "stale" : "empty"; describe(); draw(); } },
    getState: () => state,
    count: () => points.length,
    values: () => points.map((p) => p.v),
    destroy() { clearInterval(watch); cancelAnimationFrame(raf); offAppearance(); },
  };
}
