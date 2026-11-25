// Adapted from the site demonstrations (site-src/sims/core.js): the same figure frame, play, step and reset,
// now reading the app language and motion settings instead of the site ones.
// Shared building blocks for the interactive demonstrations: DOM helpers, bilingual text,
// the figure frame (play, pause, step, reset), drag handling and a visibility-aware ticker.
import { bus, getLang } from "../../../core.js";

const SVGNS = 'http://www.w3.org/2000/svg';
export const root = typeof document === 'undefined' ? null : document.documentElement;

function setAttrs(e, a) {
  for (const k in a) {
    const v = a[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
}
function add(e, kids) {
  for (const k of kids.flat(2)) {
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}
export function h(tag, attrs = {}, ...kids) { const e = document.createElement(tag); setAttrs(e, attrs); add(e, kids); return e; }
export function s(tag, attrs = {}, ...kids) { const e = document.createElementNS(SVGNS, tag); setAttrs(e, attrs); add(e, kids); return e; }

export const bi = (en, zh) => h('span', { class: 'bi' }, L(en, zh));
export const curLang = () => { const l = getLang(); return l === 'yue' ? 'zh' : l; };
export const L = (en, zh) => { const l = curLang(); return l === 'zh' ? zh : l === 'both' ? `${en} · ${zh}` : en; };
export const motionFull = () => { try { return !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pad2 = (n) => String(n).padStart(2, '0');
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// One shared animation loop; a figure only ticks while it is playing and on screen.
const tickers = new Set();
let raf = 0; let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
  for (const f of tickers) f(dt);
  raf = tickers.size ? requestAnimationFrame(loop) : 0;
}
function addTicker(f) { tickers.add(f); if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
function delTicker(f) { tickers.delete(f); }

const ICON = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  step: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
  reset: 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
};
const icon = (d) => s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'sim-ico' }, s('path', { d }));

const instances = {};
export function mountSim(host, def) {
  const [W, H] = def.view;
  const texts = new Set();
  const selects = new Set();
  const state = { playing: false, visible: false };
  let inst = {};
  let lastSay = '';

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sim-svg', role: 'img', preserveAspectRatio: 'xMidYMid meet' });
  const uid = def.id + (instances[def.id] ? `-${instances[def.id]}` : ''); instances[def.id] = (instances[def.id] || 0) + 1;
  const titleId = `simt-${uid}`;
  const readout = h('p', { class: 'sim-readout', role: 'status', 'aria-live': 'polite' });
  const extra = h('div', { class: 'sim-controls sim-extra' });
  const playBtn = h('button', { type: 'button', class: 'sim-btn primary', 'aria-pressed': 'false' });
  const stepBtn = h('button', { type: 'button', class: 'sim-btn' }, icon(ICON.step), bi('Step', '單步'));
  const resetBtn = h('button', { type: 'button', class: 'sim-btn' }, icon(ICON.reset), bi('Reset', '重設'));

  const scroller = h('div', { class: 'sim-scroll', tabindex: '0', role: 'region', 'data-label-en': 'Demonstration stage, scrollable', 'data-label-zh': '示範畫面，可捲動' }, svg);
  const fig = h('figure', { class: 'sim', id: `sim-${uid}`, 'aria-labelledby': titleId },
    h('div', { class: 'sim-head' },
      h('h3', { class: 'sim-title', id: titleId }, bi(def.title.en, def.title.zh)),
      h('span', { class: 'sim-badge' }, bi('Visual explanation, not your router', '視覺解釋，並非你嘅路由器'))),
    h('p', { class: 'sim-summary' }, bi(def.summary.en, def.summary.zh)),
    h('div', { class: 'sim-controls sim-main' }, playBtn, stepBtn, resetBtn),
    extra, scroller, readout,
    h('figcaption', { class: 'sim-hint' }, bi(def.hint.en, def.hint.zh)));
  host.replaceChildren(fig);

  function relabel() {
    svg.setAttribute('aria-label', L(def.label.en, def.label.zh));
    scroller.setAttribute('aria-label', L(scroller.dataset.labelEn, scroller.dataset.labelZh));
    for (const n of texts) { n.textContent = L(n._en, n._zh); fit(n); }
  }
  // In English plus Cantonese mode text can outgrow its box; squeeze it to the width it was given.
  function fit(n) {
    n.removeAttribute('textLength');
    if (curLang() !== 'both') return;
    let max = Number(n.getAttribute('data-maxw'));
    if (!max && n.parentNode === svg && n.getAttribute('text-anchor') !== 'middle' && !n.classList.contains('s-mid')) max = W - Number(n.getAttribute('x') || 0) - 10;
    if (!max) return;
    try { if (n.getComputedTextLength() > max) { n.setAttribute('textLength', String(max)); n.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } } catch (e) { /* not rendered yet */ }
  }
  const ui = {
    svg, W, H,
    get motion() { return motionFull(); },
    txt(parent, attrs, en, zh) {
      const n = s('text', attrs); n._en = en; n._zh = zh; n.textContent = L(en, zh); texts.add(n); parent.append(n); return n;
    },
    set(n, en, zh) { if (n._en === en && n._zh === zh) return; n._en = en; n._zh = zh; n.textContent = L(en, zh); fit(n); },
    say(en, zh) {
      const key = en + '|' + zh; if (key === lastSay) return; lastSay = key;
      readout.replaceChildren(bi(en, zh));
    },
    range(o) {
      const out = h('output', { class: 'sim-out' });
      const input = h('input', { type: 'range', min: o.min, max: o.max, step: o.step || 1, value: o.value });
      const show = () => { out.textContent = o.fmt ? o.fmt(Number(input.value)) : input.value; };
      input.addEventListener('input', () => { show(); o.onInput(Number(input.value)); });
      show();
      extra.append(h('label', { class: 'sim-field' }, h('span', { class: 'sim-flabel' }, bi(o.label.en, o.label.zh)), input, out));
      return { input, get: () => Number(input.value), set(v) { input.value = v; show(); } };
    },
    number(o) {
      const input = h('input', { type: 'number', min: o.min, max: o.max, step: 1, value: o.value, inputmode: 'numeric' });
      input.addEventListener('input', () => { const v = Math.round(Number(input.value)); if (Number.isFinite(v)) o.onInput(clamp(v, o.min, o.max)); });
      extra.append(h('label', { class: 'sim-field sim-num' }, h('span', { class: 'sim-flabel' }, bi(o.label.en, o.label.zh)), input));
      return { input, set(v) { input.value = v; } };
    },
    select(o) {
      const sel = h('select', {}, o.options.map(([v, en, zh]) => h('option', { value: v, 'data-en': en, 'data-zh': zh }, L(en, zh))));
      sel.value = o.value;
      sel.addEventListener('change', () => o.onChange(sel.value));
      selects.add(() => { for (const op of sel.options) op.textContent = L(op.dataset.en, op.dataset.zh); });
      extra.append(h('label', { class: 'sim-field' }, h('span', { class: 'sim-flabel' }, bi(o.label.en, o.label.zh)), sel));
      return { el: sel, get: () => sel.value, set(v) { sel.value = v; } };
    },
    toggle(o) {
      const box = h('input', { type: 'checkbox' });
      box.checked = !!o.value;
      box.addEventListener('change', () => o.onChange(box.checked));
      extra.append(h('label', { class: 'sim-field sim-check' }, box, h('span', { class: 'sim-flabel' }, bi(o.label.en, o.label.zh))));
      return { el: box, get: () => box.checked, set(v) { box.checked = !!v; } };
    },
    button(o) {
      const b = h('button', { type: 'button', class: 'sim-btn' }, bi(o.label.en, o.label.zh));
      b.addEventListener('click', o.onClick);
      extra.append(b);
      return b;
    },
    // Pointer and keyboard dragging in SVG coordinates. cb.move({x, y}) and cb.nudge(dx, dy).
    drag(node, cb) {
      node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button'); node.setAttribute('aria-roledescription', 'draggable');
      node.classList.add('s-drag');
      const pt = (ev) => { const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 }; const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse()); return { x: p.x, y: p.y }; };
      let active = false;
      node.addEventListener('pointerdown', (ev) => { active = true; node.setPointerCapture(ev.pointerId); node.classList.add('dragging'); cb.start && cb.start(); ev.preventDefault(); });
      node.addEventListener('pointermove', (ev) => { if (active) cb.move(pt(ev)); });
      const end = () => { if (!active) return; active = false; node.classList.remove('dragging'); cb.end && cb.end(); };
      node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
      node.addEventListener('focus', () => cb.start && cb.start());
      node.addEventListener('keydown', (ev) => {
        const step = ev.shiftKey ? 24 : 8;
        const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (map[ev.key]) { ev.preventDefault(); cb.nudge(...map[ev.key]); }
      });
    },
    rerender() { inst.render && inst.render(); },
  };

  inst = def.setup(ui) || {};
  const hasTick = typeof inst.tick === 'function';
  if (!hasTick) playBtn.hidden = true;
  if (typeof inst.step !== 'function') stepBtn.hidden = true;

  function refreshPlay() {
    const can = motionFull();
    playBtn.disabled = !can;
    playBtn.title = can ? '' : L('Motion is reduced, so use Step', '動態已減少，請用「單步」');
    if (!can) state.playing = false;
    playBtn.setAttribute('aria-pressed', String(state.playing));
    playBtn.replaceChildren(icon(state.playing ? ICON.pause : ICON.play), state.playing ? bi('Pause', '暫停') : bi('Play', '播放'));
    sync();
  }
  const tick = (dt) => { inst.tick(dt); };
  function sync() {
    if (state.playing && state.visible && hasTick) addTicker(tick); else delTicker(tick);
    fig.classList.toggle('is-playing', state.playing);
  }

  playBtn.addEventListener('click', () => { state.playing = !state.playing; refreshPlay(); });
  stepBtn.addEventListener('click', () => { state.playing = false; refreshPlay(); inst.step(); inst.render && inst.render(); });
  resetBtn.addEventListener('click', () => { inst.reset && inst.reset(); inst.render && inst.render(); });

  bus.on('lang', () => { relabel(); for (const f of selects) f(); refreshPlay(); inst.render && inst.render(); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { refreshPlay(); inst.render && inst.render(); });

  new IntersectionObserver((entries) => { for (const e of entries) { state.visible = e.isIntersecting; sync(); } }, { rootMargin: '80px' }).observe(fig);

  relabel();
  inst.render && inst.render();
  state.playing = motionFull() && hasTick;
  refreshPlay();
  return { fig, ui, inst };
}

// Splits a list of {id, dur} phases into cumulative boundaries.
export function boundaries(list) { let t = 0; return list.map((p) => { const b = { ...p, from: t, to: t + p.dur }; t += p.dur; return b; }); }
