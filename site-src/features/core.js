/* Shared core for the site features: storage, events, bilingual text, funny levels, the settings registry, dialogs. */
export const root = document.documentElement;
const NS = 'mar.f.';

export const store = {
  get(key, fallback) { try { const v = localStorage.getItem(NS + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
  set(key, value) { try { localStorage.setItem(NS + key, JSON.stringify(value)); return true; } catch (e) { return false; } },
  del(key) { try { localStorage.removeItem(NS + key); } catch (e) { /* storage may be blocked */ } },
  keys() { try { return Object.keys(localStorage).filter((k) => k.indexOf(NS) === 0).map((k) => k.slice(NS.length)); } catch (e) { return []; } },
};

// ---------- tiny event bus ----------
const handlers = new Map();
export function on(name, fn) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(fn); return () => handlers.get(name).delete(fn); }
export function emit(name, data) { (handlers.get(name) || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }

// ---------- DOM helpers ----------
export const $ = (sel, ctx) => (ctx || document).querySelector(sel);
export const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  Object.keys(props || {}).forEach((k) => {
    const v = props[k];
    if (v === null || v === undefined || v === false) return;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  });
  kids.flat(Infinity).forEach((c) => { if (c === null || c === undefined || c === false) return; el.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return el;
}
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- language ----------
export const lang = () => root.getAttribute('data-lang') || 'en';
/** Bilingual markup that follows the site language switch through the existing .bi styles. */
export function bi(en, zh, block) { return `<span class="bi${block ? ' bi-block' : ''}"><span class="en">${esc(en)}</span><span class="zh" lang="zh-HK">${esc(zh)}</span></span>`; }
export function biEl(en, zh, block) { const w = document.createElement('span'); w.innerHTML = bi(en, zh, block); return w.firstChild; }
/** Plain text in the current language, for attributes, titles and speech. */
export function pick(en, zh) { const l = lang(); return l === 'zh' ? zh : l === 'both' ? `${en} / ${zh}` : en; }

export function setLanguage(value) {
  const radio = $(`#settings input[name="lang"][value="${value}"]`);
  if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
  if (lang() !== value) {
    root.setAttribute('data-lang', value);
    root.setAttribute('lang', value === 'zh' ? 'zh-HK' : 'en');
    try { localStorage.setItem('mar.lang', value); } catch (e) { /* ignore */ }
    document.dispatchEvent(new CustomEvent('mar:lang'));
  }
}

// ---------- settings registry ----------
const defs = [];
const byId = new Map();
const values = {};
let guard = () => true;
export const setGuard = (fn) => { guard = fn; };

export function define(def) {
  defs.push(def); byId.set(def.id, def);
  values[def.id] = store.get('s.' + def.id, def.default);
  return def;
}
export const allSettings = () => defs.slice();
export const settingDef = (id) => byId.get(id);
export const get = (id) => values[id];
export function set(id, value, opts) {
  const d = byId.get(id); if (!d) return false;
  if (!(opts && opts.force) && !guard(id)) return false;
  values[id] = value; store.set('s.' + id, value);
  if (d.apply) d.apply(value, opts || {});
  emit('setting', { id, value });
  return true;
}
export function reset(id) {
  const d = byId.get(id); if (!d) return;
  if (!guard(id)) return;
  store.del('s.' + id); values[id] = d.default;
  if (d.reset) d.reset(); else if (d.apply) d.apply(d.default, { reset: true });
  emit('setting', { id, value: d.default, reset: true });
}
export function applyAll() { defs.forEach((d) => { if (d.apply) { try { d.apply(values[d.id], { boot: true }); } catch (e) { console.error(d.id, e); } } }); }
export function resetAll() { defs.forEach((d) => reset(d.id)); emit('reset-all'); }

// ---------- funny levels: the facts never change, only the voice ----------
const SCHOOL = () => root.hasAttribute('data-mf-school');
export function levelIndex(code) {
  if (SCHOOL()) return 0;
  const n = clamp(Number(get(code === 'zh' ? 'funny.zh' : 'funny.en')) || 5, 1, 5);
  return n <= 2 ? 0 : n <= 4 ? 1 : 2;
}
/** msg is { en:[plain, mild, playful], zh:[...] }. */
export function say(msg, vars) {
  const fix = (s) => (vars ? Object.keys(vars).reduce((a, k) => a.split('{' + k + '}').join(vars[k]), s) : s);
  const en = fix(msg.en[Math.min(levelIndex('en'), msg.en.length - 1)]);
  const zh = fix(msg.zh[Math.min(levelIndex('zh'), msg.zh.length - 1)]);
  return { en, zh };
}
export const sayHtml = (msg, vars, block) => { const m = say(msg, vars); return bi(m.en, m.zh, block); };
export const sayText = (msg, vars) => { const m = say(msg, vars); return pick(m.en, m.zh); };

// ---------- dialogs ----------
const EMOJI = ['✨', '🥟', '🎈', '🌟', '🧩', '🎈'];
let emojiTick = 0;
/** One modal dialog. body is a Node or markup, actions are [{en, zh, kind, onClick}]. */
export function dialog({ id, titleEn, titleZh, body, actions, wide, onClose }) {
  const old = id && document.getElementById(id); if (old) old.remove();
  const d = h('dialog', { class: 'mf-dialog' + (wide ? ' wide' : ''), id: id || null, 'aria-labelledby': (id || 'mf-d') + '-t' });
  const emoji = get('dialog.emoji') !== false && !SCHOOL() ? h('span', { class: 'mf-emoji', 'aria-hidden': 'true' }, EMOJI[emojiTick++ % EMOJI.length]) : null;
  const head = h('div', { class: 'mf-dhead' }, emoji, h('h2', { id: (id || 'mf-d') + '-t', html: bi(titleEn, titleZh) }),
    h('button', { type: 'button', class: 'mf-icon', 'aria-label': pick('Close', '關閉'), onclick: () => d.close() }, '×'));
  const content = h('div', { class: 'mf-dbody' }, typeof body === 'string' ? h('div', { html: body }) : body);
  const foot = h('div', { class: 'mf-dfoot' }, (actions || []).map((a) => h('button', { type: 'button', class: 'mf-btn ' + (a.kind || 'tonal'), html: bi(a.en, a.zh), onclick: (e) => { if (a.onClick) a.onClick(e, d); if (!a.keepOpen) d.close(); } })));
  d.append(head, content, actions && actions.length ? foot : '');
  d.addEventListener('close', () => { if (onClose) onClose(); setTimeout(() => d.remove(), 250); });
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  document.body.append(d);
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  const first = d.querySelector('input,select,textarea,button.mf-btn');
  if (first) setTimeout(() => first.focus(), 30);
  return d;
}

export function download(name, text, type) {
  const blob = new Blob([text], { type: type || 'text/plain' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function readFileText(file, max) {
  return new Promise((res, rej) => {
    if (file.size > (max || 400000)) { rej(new Error('too-big')); return; }
    const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read')); r.readAsText(file);
  });
}
export const prefersReduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
/** True when motion may play: the site setting, the system setting and Low stimulation all agree. */
export const motionOk = () => root.getAttribute('data-motion') === 'full' && !prefersReduced() && !root.hasAttribute('data-mf-lowstim');
export const siteRoot = () => (window.__MAR && window.__MAR.root) || './';
export const pageUrl = () => location.pathname.replace(/\/index\.html$/, '/');
export function loadIndex() {
  return new Promise((res) => {
    if (window.__SEARCH_INDEX) { res(window.__SEARCH_INDEX); return; }
    const s = h('script', { src: (window.__MAR && window.__MAR.index) || siteRoot() + 'search-index.js' });
    s.onload = () => res(window.__SEARCH_INDEX || []); s.onerror = () => res([]);
    document.head.append(s);
  });
}
