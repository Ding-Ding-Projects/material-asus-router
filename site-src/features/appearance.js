/* Appearance: the element editor, colour picker and translator, logo, animation editor and accessibility sizing. */
import { root, h, bi, $, $$, define, get, set, store, lang, pick, on, emit, download, readFileText, motionOk, prefersReduced, clamp } from './core.js';
import { MSG } from './strings.js';
import { notify, notifyMsg } from './notify.js';
import { play } from './sound.js';

/* ---------- colour maths ---------- */
let cvs = null;
export function parseColor(str) {
  try {
    cvs = cvs || document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    cvs.fillStyle = '#010203'; cvs.fillStyle = str; const a = cvs.fillStyle;
    cvs.fillStyle = '#040506'; cvs.fillStyle = str; const b = cvs.fillStyle; if (a !== b) return null;
    cvs.clearRect(0, 0, 1, 1); cvs.fillRect(0, 0, 1, 1); const d = cvs.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2] };
  } catch (e) { return null; }
}
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
export const toHex = (c) => '#' + hex2(c.r) + hex2(c.g) + hex2(c.b);
export function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hh = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; }
  return { h: Math.round(hh), s: Math.round(s * 100), l: Math.round(l * 100) };
}
export function fromHsl(hh, s, l) { s /= 100; l /= 100; const k = (n) => (n + hh / 30) % 12; const a = s * Math.min(l, 1 - l); const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 }; }
export function toOklch({ r, g, b }) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + Bb * Bb); let H = Math.atan2(Bb, A) * 180 / Math.PI; if (H < 0) H += 360; return { l: +L.toFixed(3), c: +C.toFixed(3), h: C < 0.002 ? 0 : Math.round(H) };
}
export function toCmyk({ r, g, b }) { r /= 255; g /= 255; b /= 255; const k = 1 - Math.max(r, g, b); if (k === 1) return { c: 0, m: 0, y: 0, k: 100 }; return { c: Math.round((1 - r - k) / (1 - k) * 100), m: Math.round((1 - g - k) / (1 - k) * 100), y: Math.round((1 - b - k) / (1 - k) * 100), k: Math.round(k * 100) }; }
export function luminance({ r, g, b }) { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
export function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
export function hueOf(c) { return toOklch(c).h; }

/* ---------- accessibility sizing ---------- */
define({ id: 'a11y.text', group: 'access', type: 'range', min: 85, max: 170, step: 5, default: 100, unit: '%', label: ['Text size', '文字大小'], info: ['Scales all text on this site. 100% follows your browser setting.', '放大或縮細本網站所有文字。100% 即跟你瀏覽器嘅設定。'], apply(v) { root.style.fontSize = Number(v) === 100 ? '' : v + '%'; } });
define({ id: 'a11y.density', group: 'access', type: 'select', default: 'comfortable', label: ['Spacing density', '間距密度'], info: ['Compact fits more on screen. Spacious adds air between lines and blocks.', '緊湊可以一版容納多啲內容，寬鬆就加大行距同區塊間距。'], options: [['compact', 'Compact', '緊湊'], ['comfortable', 'Comfortable', '舒適'], ['spacious', 'Spacious', '寬鬆']], apply(v) { root.setAttribute('data-mf-density', v); } });
define({ id: 'a11y.contrast', group: 'access', type: 'toggle', default: false, label: ['High contrast', '高對比'], info: ['Uses stronger text and border colours. Every colour pair on this site already meets 4.5:1; this goes further.', '用更強嘅文字同邊框顏色。本網站所有顏色組合已達 4.5:1，呢個選項再進一步。'], apply(v) { root.toggleAttribute('data-mf-contrast', !!v); } });
define({ id: 'a11y.targets', group: 'access', type: 'toggle', default: false, label: ['Large touch targets', '大型觸控目標'], info: ['Makes buttons and links at least 48 pixels tall, easier on phones and for steady-hand difficulties.', '令按鈕同連結最少 48 像素高，手機同手部控制困難嘅人更易使用。'], apply(v) { root.toggleAttribute('data-mf-targets', !!v); } });

/* ---------- appearance editor ---------- */
const PARTS = [
  ['bg', 'Page background', '頁面背景', '--surface'], ['cards', 'Cards and panels', '卡片同面板', '--surface-mid'], ['bar', 'Top bar and dialogs', '頂部列同對話框', '--surface-high'],
  ['accent', 'Buttons and accent', '按鈕同強調色', '--primary'], ['link', 'Links', '連結', '--mf-link'], ['text', 'Text', '文字', '--on-surface'],
];
const APP0 = { colors: {}, radius: null, size: 100, space: 100 };
let app = Object.assign({}, APP0, store.get('s.appearance', null) || {}, {});
function applyAppearance(boot) {
  const keys = ['--surface', '--surface-mid', '--surface-high', '--primary', '--mf-link', '--on-surface', '--surface-low', '--on-primary', '--r-s', '--r-m', '--r-l', '--mf-size', '--mf-space'];
  keys.forEach((k) => root.style.removeProperty(k));
  const c = app.colors || {};
  PARTS.forEach(([id, , , v]) => { if (c[id]) root.style.setProperty(v, c[id]); });
  if (c.bg) root.style.setProperty('--surface-low', c.bg);
  if (c.accent) { const rgb = parseColor(c.accent); if (rgb) root.style.setProperty('--on-primary', contrast(rgb, { r: 255, g: 255, b: 255 }) >= 4.5 ? '#ffffff' : '#000000'); }
  if (app.radius !== null && app.radius !== undefined) { const f = app.radius / 20; root.style.setProperty('--r-s', Math.round(12 * f) + 'px'); root.style.setProperty('--r-m', Math.round(20 * f) + 'px'); root.style.setProperty('--r-l', Math.round(28 * f) + 'px'); }
  if (app.size !== 100) root.style.setProperty('--mf-size', String(app.size / 100));
  if (app.space !== 100) root.style.setProperty('--mf-space', String(app.space / 100));
  root.toggleAttribute('data-mf-app', !!(Object.keys(c).length || app.radius !== null || app.size !== 100 || app.space !== 100));
  if (!boot) { store.set('s.appearance', app); emit('setting', { id: 'appearance', value: app }); }
}
export function setAccentColor(hex) { app.colors = Object.assign({}, app.colors, { accent: hex }); applyAppearance(); const rgb = parseColor(hex); if (rgb) { root.style.setProperty('--h', String(hueOf(rgb))); try { localStorage.setItem('mar.hue', String(hueOf(rgb))); } catch (e) { /* ignore */ } } }
define({ id: 'appearance', group: 'appearance', type: 'custom', default: APP0, label: ['Element appearance editor', '元素外觀編輯器'],
  info: ['Change the colour of each part of the site, the roundness of corners, the size of buttons and the spacing, with a live preview. Everything is saved in this browser. Export gives you a JSON file to keep or share, and Import loads one. The contrast line warns you when text would be hard to read.', '逐個部分改顏色、轉角圓度、按鈕大小同間距，並有即時預覽。全部儲存喺呢個瀏覽器。匯出會俾你一個 JSON 檔案保存或分享，匯入就載入一個。對比度一行會喺文字難讀時提醒你。'],
  read: () => Object.keys(app.colors || {}).length, apply(v, o) { if (o && o.boot) applyAppearance(true); }, reset() { app = Object.assign({}, APP0, { colors: {} }); store.del('s.appearance'); applyAppearance(true); emit('setting', { id: 'appearance', reset: true }); },
  render(wrap) {
    const preview = h('div', { class: 'mf-prev', 'aria-label': pick('Live preview', '即時預覽'), role: 'group' },
      h('div', { class: 'mf-prevbar', html: bi('Top bar', '頂部列') }), h('div', { class: 'mf-prevcard' }, h('b', {}, pick('A card', '一張卡片')), h('p', {}, pick('Body text sits here with a ', '內文會喺呢度，配一個 '), h('a', { href: '#', onclick: (e) => e.preventDefault() }, pick('link', '連結')), '.'), h('button', { type: 'button', class: 'mf-btn filled', html: bi('Button', '按鈕') })));
    const ratio = h('p', { class: 'mf-status', role: 'status' });
    const upd = () => {
      const t = parseColor(getComputedStyle(root).getPropertyValue('--on-surface').trim() || '#000') || parseColor(getComputedStyle(document.body).color); const b = parseColor(getComputedStyle(document.body).backgroundColor);
      if (t && b) { const r = contrast(t, b); ratio.className = 'mf-status' + (r < 4.5 ? ' bad' : ''); ratio.innerHTML = bi(`Text on background contrast ${r.toFixed(2)}:1 ${r >= 4.5 ? '(good, 4.5:1 or more)' : '(too low, below 4.5:1)'}`, `文字同背景對比 ${r.toFixed(2)}:1 ${r >= 4.5 ? '（良好，達 4.5:1）' : '（太低，低於 4.5:1）'}`); }
    };
    const rows = PARTS.map(([id, en, zh]) => {
      const cur = () => (app.colors || {})[id] || '';
      const text = h('input', { type: 'text', class: 'mf-input small', placeholder: pick('default', '預設'), value: cur(), 'aria-label': pick(en, zh) + ' (CSS colour)', spellcheck: 'false' });
      const pickr = h('input', { type: 'color', class: 'mf-colorbox', 'aria-label': pick(en, zh), value: toHex(parseColor(cur() || getComputedStyle(root).getPropertyValue(PARTS.find((p) => p[0] === id)[3]).trim() || '#808080') || { r: 128, g: 128, b: 128 }) });
      const commit = (val) => { const c = Object.assign({}, app.colors); if (val) c[id] = val; else delete c[id]; app.colors = c; applyAppearance(); setTimeout(upd, 30); };
      text.addEventListener('change', () => { if (!text.value.trim()) { commit(''); return; } const p = parseColor(text.value.trim()); if (!p) { notifyMsg(MSG.invalid, 'error'); text.value = cur(); return; } commit(toHex(p)); text.value = toHex(p); pickr.value = toHex(p); });
      pickr.addEventListener('input', () => { text.value = pickr.value; commit(pickr.value); });
      return h('div', { class: 'mf-arow' }, h('span', { class: 'mf-alab', html: bi(en, zh) }), pickr, text, h('button', { type: 'button', class: 'mf-btn text', html: bi('Reset', '重設'), onclick: () => { commit(''); text.value = ''; } }));
    });
    const slider = (key, minV, maxV, en, zh, unit, nullable) => {
      const out = h('output', {}, ''); const inp = h('input', { type: 'range', min: minV, max: maxV, step: 1, 'aria-label': pick(en, zh), value: app[key] === null ? 20 : app[key] });
      const draw = () => { out.textContent = (nullable && app[key] === null ? pick('default', '預設') : inp.value + unit); };
      inp.addEventListener('input', () => { app[key] = Number(inp.value); applyAppearance(); draw(); setTimeout(upd, 30); });
      draw(); return h('div', { class: 'mf-arow' }, h('span', { class: 'mf-alab', html: bi(en, zh) }), inp, out, h('button', { type: 'button', class: 'mf-btn text', html: bi('Reset', '重設'), onclick: () => { app[key] = nullable ? null : 100; inp.value = nullable ? 20 : 100; applyAppearance(); draw(); } }));
    };
    const imp = h('input', { type: 'file', accept: '.json,application/json', class: 'mf-visually-hidden', id: 'mf-app-import', onchange: () => { const f = imp.files[0]; if (!f) return; readFileText(f, 20000).then((t) => { const j = JSON.parse(t); if (!j || typeof j !== 'object' || (j.colors && typeof j.colors !== 'object')) throw new Error('bad'); const colors = {}; Object.keys(j.colors || {}).forEach((k) => { if (PARTS.some((p) => p[0] === k) && parseColor(String(j.colors[k]))) colors[k] = toHex(parseColor(String(j.colors[k]))); }); app = { colors, radius: j.radius === null || j.radius === undefined ? null : clamp(Number(j.radius) || 0, 0, 40), size: clamp(Number(j.size) || 100, 80, 140), space: clamp(Number(j.space) || 100, 60, 160) }; applyAppearance(); notifyMsg(MSG.imported, 'ok'); emit('setting', { id: 'appearance', reset: true }); }).catch(() => notifyMsg(MSG.invalid, 'error')); imp.value = ''; } });
    wrap.append(preview, ratio, ...rows, slider('radius', 0, 40, 'Corner roundness', '轉角圓度', ' px', true), slider('size', 80, 140, 'Button and chip size', '按鈕同標籤大小', '%'), slider('space', 60, 160, 'Spacing between blocks', '區塊間距', '%'),
      h('div', { class: 'mf-row' },
        h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Export JSON', '匯出 JSON'), onclick: () => { download('appearance.json', JSON.stringify(app, null, 2), 'application/json'); notifyMsg(MSG.exported, 'ok', { name: 'appearance.json' }); } }),
        h('label', { class: 'mf-btn tonal', for: 'mf-app-import', tabindex: '0', role: 'button', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); imp.click(); } } }, h('span', { html: bi('Import JSON', '匯入 JSON') })), imp,
        h('button', { type: 'button', class: 'mf-btn text', html: bi('Fix text contrast', '修正文字對比'), onclick: () => { const b = parseColor(getComputedStyle(document.body).backgroundColor); if (!b) return; const col = contrast({ r: 0, g: 0, b: 0 }, b) >= contrast({ r: 255, g: 255, b: 255 }, b) ? '#000000' : '#ffffff'; app.colors = Object.assign({}, app.colors, { text: col }); applyAppearance(); setTimeout(upd, 30); notifyMsg(MSG.saved, 'ok'); } })));
    setTimeout(upd, 60);
  } });

/* ---------- infinite colour picker and translator ---------- */
define({ id: 'colorpicker', group: 'appearance', type: 'custom', default: '#3a6ea5', label: ['Colour picker and translator', '調色盤同顏色轉換'],
  info: ['Pick any colour with continuous hue, saturation and lightness sliders, type a colour in any CSS form, or use the eyedropper where your browser has one. The translator shows HEX, RGB, HSL, OKLCH and CMYK with copy buttons, and the contrast against white and black. Use as accent applies it to the site.', '用連續嘅色相、飽和度同亮度滑桿揀任何顏色，或者用任何 CSS 格式輸入，如果瀏覽器支援亦可以用滴管。轉換器會顯示 HEX、RGB、HSL、OKLCH 同 CMYK 並附複製掣，同埋同白色同黑色嘅對比。「用作強調色」會套用到網站。'],
  read: () => get('colorpicker'), apply() { },
  render(wrap) {
    let cur = parseColor(get('colorpicker')) || { r: 58, g: 110, b: 165 }; let hsl = toHsl(cur);
    const swatch = h('div', { class: 'mf-swatch', 'aria-hidden': 'true' });
    const mk = (min, max, key, en, zh) => { const i = h('input', { type: 'range', min, max, step: 1, 'aria-label': pick(en, zh) }); i.addEventListener('input', () => { hsl[key] = Number(i.value); cur = fromHsl(hsl.h, hsl.s, hsl.l); draw(true); }); return [i, h('label', { class: 'mf-lab', html: bi(en, zh) })]; };
    const [hs, hl] = mk(0, 360, 'h', 'Hue', '色相'), [ss, sl] = mk(0, 100, 's', 'Saturation', '飽和度'), [ls, ll] = mk(0, 100, 'l', 'Lightness', '亮度');
    const input = h('input', { type: 'text', class: 'mf-input mono', 'aria-label': pick('Colour in any CSS form', '任何 CSS 格式嘅顏色'), spellcheck: 'false', placeholder: 'oklch(0.6 0.15 250), #3a6ea5, hsl(210 50% 40%), teal' });
    const out = h('dl', { class: 'mf-colors' }); const bad = h('p', { class: 'mf-status bad', role: 'alert', hidden: true }, pick('That is not a colour I can read.', '呢個唔係我睇得明嘅顏色。'));
    function draw(fromSliders) {
      const r = { r: Math.round(cur.r), g: Math.round(cur.g), b: Math.round(cur.b) }; cur = r; if (!fromSliders) hsl = toHsl(r);
      hs.value = hsl.h; ss.value = hsl.s; ls.value = hsl.l; swatch.style.background = toHex(r); store.set('s.colorpicker', toHex(r)); set('colorpicker', toHex(r), { force: true });
      const ok = toOklch(r), cm = toCmyk(r); const hx = toHex(r);
      const rows = [['HEX', hx], ['RGB', `rgb(${r.r} ${r.g} ${r.b})`], ['HSL', `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`], ['OKLCH', `oklch(${ok.l} ${ok.c} ${ok.h})`], ['CMYK', `${cm.c}% ${cm.m}% ${cm.y}% ${cm.k}%`]];
      out.textContent = ''; rows.forEach(([k, v]) => out.append(h('dt', {}, k), h('dd', {}, h('code', {}, v), h('button', { type: 'button', class: 'mf-btn text', 'aria-label': pick('Copy ', '複製 ') + k, html: bi('Copy', '複製'), onclick: () => { try { navigator.clipboard.writeText(v).then(() => notifyMsg(MSG.copied, 'ok')); } catch (e) { notifyMsg(MSG.error, 'error', { why: 'clipboard' }); } } }))));
      out.append(h('dt', {}, pick('Contrast', '對比')), h('dd', {}, pick(`${contrast(r, { r: 255, g: 255, b: 255 }).toFixed(2)}:1 with white, ${contrast(r, { r: 0, g: 0, b: 0 }).toFixed(2)}:1 with black`, `同白色 ${contrast(r, { r: 255, g: 255, b: 255 }).toFixed(2)}:1，同黑色 ${contrast(r, { r: 0, g: 0, b: 0 }).toFixed(2)}:1`)));
    }
    input.addEventListener('input', () => { const p = parseColor(input.value.trim()); bad.hidden = !input.value.trim() || !!p; if (p) { cur = p; draw(false); } });
    const eye = 'EyeDropper' in window ? h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Eyedropper', '滴管'), onclick: async () => { try { const r = await new window.EyeDropper().open(); const p = parseColor(r.sRGBHex); if (p) { cur = p; draw(false); } } catch (e) { /* cancelled */ } } }) : h('span', { class: 'mf-hint', html: bi('Eyedropper is not available in this browser.', '呢個瀏覽器冇滴管功能。') });
    wrap.append(swatch, h('div', { class: 'mf-sliders' }, hl, hs, sl, ss, ll, ls), input, bad, out, h('div', { class: 'mf-row' }, eye, h('button', { type: 'button', class: 'mf-btn filled', html: bi('Use as accent', '用作強調色'), onclick: () => { setAccentColor(toHex(cur)); notifyMsg(MSG.saved, 'ok'); } })));
    draw(false);
  } });

/* ---------- logo customisation ---------- */
const LOGO0 = { mode: 'default', text: '', bg: '', fg: '#ffffff', shape: 'squircle', img: '' };
let logo = Object.assign({}, LOGO0, store.get('s.logo', null) || {});
function applyLogo() {
  $$('.brand').forEach((a) => {
    let mark = a.querySelector('.brand-mark'); a.querySelectorAll('.mf-logo').forEach((n) => n.remove()); if (mark) mark.hidden = false;
    if (logo.mode === 'default') return; if (mark) mark.hidden = true;
    const el = h('span', { class: 'mf-logo shape-' + logo.shape, 'aria-hidden': 'true', style: logo.mode === 'image' ? {} : { background: logo.bg || 'var(--primary)', color: logo.fg } });
    if (logo.mode === 'image' && logo.img) el.append(h('img', { src: logo.img, alt: '' })); else el.textContent = (logo.text || 'M').slice(0, 3);
    a.insertBefore(el, a.firstChild);
  });
}
define({ id: 'logo', group: 'appearance', type: 'custom', default: LOGO0, label: ['Logo', '標誌'],
  info: ['Replace the small logo in the header with your own letters or emoji on a colour, or a small image from your device (up to 150 KB). It only changes what you see in this browser.', '將頁首細標誌換成你自己嘅文字或表情符號配顏色，或者你裝置上一張細圖片（最大 150 KB）。只會改變你呢個瀏覽器見到嘅樣。'],
  read: () => logo.mode, apply(v, o) { if (o && o.boot) applyLogo(); }, reset() { logo = Object.assign({}, LOGO0); store.del('s.logo'); applyLogo(); emit('setting', { id: 'logo', reset: true }); },
  render(wrap) {
    const save = () => { store.set('s.logo', logo); applyLogo(); };
    const mode = h('select', { class: 'mf-input', 'aria-label': pick('Logo type', '標誌類型') }, [['default', 'Default', '預設'], ['text', 'Letters or emoji', '文字或表情'], ['image', 'Image', '圖片']].map(([v, en, zh]) => h('option', { value: v, selected: logo.mode === v }, pick(en, zh))));
    const text = h('input', { type: 'text', class: 'mf-input small', maxlength: 3, value: logo.text, 'aria-label': pick('Letters or emoji', '文字或表情') });
    const bg = h('input', { type: 'color', class: 'mf-colorbox', value: logo.bg || '#3a6ea5', 'aria-label': pick('Background colour', '背景顏色') });
    const fg = h('input', { type: 'color', class: 'mf-colorbox', value: logo.fg, 'aria-label': pick('Letter colour', '文字顏色') });
    const shape = h('select', { class: 'mf-input', 'aria-label': pick('Shape', '形狀') }, [['squircle', 'Rounded square', '圓角方形'], ['circle', 'Circle', '圓形'], ['square', 'Square', '方形']].map(([v, en, zh]) => h('option', { value: v, selected: logo.shape === v }, pick(en, zh))));
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml', class: 'mf-input', 'aria-label': pick('Choose an image', '揀選圖片') });
    mode.addEventListener('change', () => { logo.mode = mode.value; save(); }); text.addEventListener('input', () => { logo.text = text.value; if (logo.mode === 'default') logo.mode = 'text'; mode.value = logo.mode; save(); });
    bg.addEventListener('input', () => { logo.bg = bg.value; save(); }); fg.addEventListener('input', () => { logo.fg = fg.value; save(); }); shape.addEventListener('change', () => { logo.shape = shape.value; save(); });
    file.addEventListener('change', () => { const f = file.files[0]; if (!f) return; if (f.size > 150000 || !/^image\//.test(f.type)) { notifyMsg(MSG.invalid, 'error'); file.value = ''; return; } const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { logo.img = String(r.result); logo.mode = 'image'; mode.value = 'image'; save(); }; img.onerror = () => notifyMsg(MSG.invalid, 'error'); img.src = String(r.result); }; r.readAsDataURL(f); });
    wrap.append(h('div', { class: 'mf-form' }, mode, h('div', { class: 'mf-row' }, text, bg, fg, shape), file));
  } });

/* ---------- animation and transition editor ---------- */
const KINDS = [['page', 'Page entry', '頁面進場'], ['list', 'List stagger', '清單逐項進場'], ['cards', 'Cards and hover lift', '卡片同懸浮'], ['dialogs', 'Dialogs, menus and sheets', '對話框同選單'], ['toasts', 'Notifications and tooltips', '通知同提示'], ['charts', 'Charts and live pulses', '圖表同脈動'], ['tabs', 'Tab changes', '分頁切換']];
const EASE = { standard: 'cubic-bezier(0.2,0,0,1)', emphasized: 'cubic-bezier(0.05,0.7,0.1,1)', spring: 'cubic-bezier(0.34,1.56,0.64,1)', linear: 'linear' };
const mkKind = (dur, delay, stagger, ease, dist) => ({ on: true, dur, delay, stagger, ease, dist, bez: [0.2, 0, 0, 1] });
const PROFILES = {
  calm: { name: ['Calm', '平靜'], speed: 0.8, kinds: { page: mkKind(350, 0, 0, 'standard', 8), list: mkKind(300, 0, 30, 'standard', 6), cards: mkKind(250, 0, 0, 'standard', 2), dialogs: mkKind(220, 0, 0, 'standard', 8), toasts: mkKind(220, 0, 0, 'standard', 8), charts: mkKind(600, 0, 40, 'standard', 0), tabs: mkKind(200, 0, 0, 'standard', 0) } },
  standard: { name: ['Standard', '標準'], speed: 1, kinds: { page: mkKind(500, 0, 0, 'emphasized', 16), list: mkKind(420, 0, 55, 'emphasized', 14), cards: mkKind(280, 0, 0, 'standard', 4), dialogs: mkKind(300, 0, 0, 'emphasized', 16), toasts: mkKind(300, 0, 0, 'emphasized', 12), charts: mkKind(900, 0, 70, 'emphasized', 0), tabs: mkKind(260, 0, 0, 'standard', 0) } },
  expressive: { name: ['Expressive', '豐富'], speed: 1.1, kinds: { page: mkKind(700, 0, 0, 'spring', 28), list: mkKind(600, 0, 80, 'spring', 26), cards: mkKind(380, 0, 0, 'spring', 8), dialogs: mkKind(420, 0, 0, 'spring', 28), toasts: mkKind(420, 0, 0, 'spring', 24), charts: mkKind(1100, 0, 90, 'emphasized', 0), tabs: mkKind(320, 0, 0, 'spring', 0) } },
  playful: { name: ['Playful', '好玩'], speed: 1.25, kinds: { page: mkKind(800, 0, 0, 'spring', 40), list: mkKind(700, 0, 110, 'spring', 38), cards: mkKind(460, 0, 0, 'spring', 12), dialogs: mkKind(520, 0, 0, 'spring', 40), toasts: mkKind(520, 0, 0, 'spring', 36), charts: mkKind(1200, 0, 110, 'spring', 0), tabs: mkKind(380, 0, 0, 'spring', 0) } },
};
let anim = store.get('s.anim', null) || { master: true, profile: 'standard', speed: PROFILES.standard.speed, kinds: JSON.parse(JSON.stringify(PROFILES.standard.kinds)) };
const easeOf = (k) => (k.ease === 'custom' ? `cubic-bezier(${k.bez.join(',')})` : EASE[k.ease] || EASE.standard);
function applyAnim() {
  KINDS.forEach(([id]) => {
    const k = anim.kinds[id]; if (!k) return;
    root.style.setProperty(`--mf-${id}-dur`, (anim.master && k.on ? Math.round(k.dur / anim.speed) : 0) + 'ms');
    root.style.setProperty(`--mf-${id}-delay`, k.delay + 'ms'); root.style.setProperty(`--mf-${id}-stagger`, k.stagger + 'ms');
    root.style.setProperty(`--mf-${id}-ease`, easeOf(k)); root.style.setProperty(`--mf-${id}-dist`, k.dist + 'px');
  });
  root.toggleAttribute('data-mf-anim-off', !anim.master);
  if (root.getAttribute('data-motion') === 'full') root.style.setProperty('--dur', anim.master ? String(1 / anim.speed) : '0'); else root.style.removeProperty('--dur');
}
document.addEventListener('mar:lang', () => { /* keeps --dur honest when the site motion setting changed */ applyAnim(); });
new MutationObserver(() => applyAnim()).observe(root, { attributes: true, attributeFilter: ['data-motion'] });
define({ id: 'anim', group: 'motion', type: 'custom', default: null, label: ['Animation and transition editor', '動畫同過渡編輯器'],
  info: ['Tune how the site moves: a master switch, a speed multiplier, ready-made profiles and, for each kind of motion, on or off, duration, delay, stagger, easing curve and distance, each with a live preview. Reduced motion always wins: when your system or the Motion setting asks for less movement, nothing here can switch movement back on.', '調校網站點樣郁：總開關、速度倍數、現成方案，同埋每種動態嘅開關、時長、延遲、逐項間隔、緩動曲線同距離，全部有即時預覽。減少動態永遠優先：當你嘅系統或者「動態」設定要求少啲郁，呢度任何設定都唔可以重新開啟動態。'],
  read: () => anim.profile, apply(v, o) { if (o && o.boot) applyAnim(); }, reset() { store.del('s.anim'); anim = { master: true, profile: 'standard', speed: 1, kinds: JSON.parse(JSON.stringify(PROFILES.standard.kinds)) }; applyAnim(); emit('setting', { id: 'anim', reset: true }); },
  render(wrap) {
    const save = () => { store.set('s.anim', anim); applyAnim(); };
    const note = h('p', { class: 'mf-status', role: 'status' }); const noteDraw = () => { const off = !motionOk(); note.className = 'mf-status' + (off ? ' bad' : ''); note.innerHTML = off ? bi('Motion is currently stilled by reduced motion, the Motion setting or Low stimulation. Your choices are saved but have no effect until motion is allowed.', '動態而家被減少動態、「動態」設定或低刺激模式停咗。你嘅選擇會儲存，但要等到容許動態先會生效。') : bi('Motion is allowed.', '動態已容許。'); };
    noteDraw(); on('setting', noteDraw);
    const master = h('label', { class: 'mf-flag' }, h('input', { type: 'checkbox', checked: anim.master, onchange: (e) => { anim.master = e.target.checked; save(); } }), h('b', { html: bi('All animations', '全部動畫') }));
    const speedOut = h('output', {}, anim.speed + '×'); const speed = h('input', { type: 'range', min: 0.4, max: 2, step: 0.05, value: anim.speed, 'aria-label': pick('Speed multiplier', '速度倍數'), oninput: (e) => { anim.speed = Number(e.target.value); speedOut.textContent = anim.speed + '×'; save(); } });
    const prof = h('select', { class: 'mf-input', 'aria-label': pick('Profile', '方案') }, Object.keys(PROFILES).map((k) => h('option', { value: k, selected: anim.profile === k }, pick(PROFILES[k].name[0], PROFILES[k].name[1]))), h('option', { value: 'custom', selected: anim.profile === 'custom' }, pick('My profile', '我嘅方案')));
    const body = h('div', { class: 'mf-kinds' });
    const rebuild = () => { body.textContent = ''; KINDS.forEach(([id, en, zh]) => body.append(kindCard(id, en, zh))); speed.value = anim.speed; speedOut.textContent = anim.speed + '×'; };
    function markCustom() { anim.profile = 'custom'; prof.value = 'custom'; save(); }
    function kindCard(id, en, zh) {
      const k = anim.kinds[id]; const box = h('div', { class: 'mf-kind' }); const demo = h('div', { class: 'mf-demo', 'aria-hidden': 'true' }, h('span', {})); const ctl = (label, min, max, step, key, unit) => { const o = h('output', {}, k[key] + unit); return h('label', { class: 'mf-kctl' }, h('span', { html: bi(label[0], label[1]) }), h('input', { type: 'range', min, max, step, value: k[key], oninput: (e) => { k[key] = Number(e.target.value); o.textContent = k[key] + unit; markCustom(); } }), o); };
      const ease = h('select', { class: 'mf-input small', 'aria-label': pick('Easing', '緩動') }, [['standard', 'Standard', '標準'], ['emphasized', 'Emphasized', '強調'], ['spring', 'Spring', '彈簧'], ['linear', 'Linear', '線性'], ['custom', 'Custom curve', '自訂曲線']].map(([v, a, b]) => h('option', { value: v, selected: k.ease === v }, pick(a, b))));
      const curve = h('span', { class: 'mf-curve', 'aria-hidden': 'true' }); const drawCurve = () => { const [x1, y1, x2, y2] = k.ease === 'custom' ? k.bez : ((/\(([^)]+)\)/.exec(EASE[k.ease]) || [0, '0,0,1,1'])[1].split(',')).map(Number); curve.innerHTML = `<svg viewBox="-4 -4 108 108"><path d="M0 100 C ${x1 * 100} ${100 - y1 * 100}, ${x2 * 100} ${100 - y2 * 100}, 100 0" fill="none" stroke="currentColor" stroke-width="3"/><path d="M0 100L${x1 * 100} ${100 - y1 * 100}M100 0L${x2 * 100} ${100 - y2 * 100}" stroke="currentColor" stroke-width="1" opacity=".5"/></svg>`; };
      const bez = h('div', { class: 'mf-bez', hidden: k.ease !== 'custom' }, k.bez.map((v, i) => h('input', { type: 'number', class: 'mf-input small', step: 0.05, min: i % 2 ? -1 : 0, max: i % 2 ? 2 : 1, value: v, 'aria-label': ['x1', 'y1', 'x2', 'y2'][i], oninput: (e) => { k.bez[i] = clamp(Number(e.target.value) || 0, i % 2 ? -1 : 0, i % 2 ? 2 : 1); markCustom(); drawCurve(); } })));
      ease.addEventListener('change', () => { k.ease = ease.value; bez.hidden = k.ease !== 'custom'; markCustom(); drawCurve(); });
      const play2 = () => { const el = demo.firstChild; if (!motionOk()) { el.style.transform = 'translateX(0)'; return; } el.animate([{ transform: 'translateX(0)', opacity: 0.2 }, { transform: 'translateX(180px)', opacity: 1 }], { duration: Math.max(60, k.dur / anim.speed), delay: k.delay, easing: easeOf(k), fill: 'both' }); };
      drawCurve();
      box.append(h('div', { class: 'mf-khead' }, h('label', { class: 'mf-flag' }, h('input', { type: 'checkbox', checked: k.on, onchange: (e) => { k.on = e.target.checked; markCustom(); } }), h('b', { html: bi(en, zh) })), h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Preview', '預覽'), onclick: play2 }), h('button', { type: 'button', class: 'mf-btn text', html: bi('Reset', '重設'), onclick: () => { anim.kinds[id] = JSON.parse(JSON.stringify(PROFILES.standard.kinds[id])); markCustom(); rebuild(); } })),
        h('div', { class: 'mf-kgrid' }, ctl(['Duration', '時長'], 0, 1500, 10, 'dur', ' ms'), ctl(['Delay', '延遲'], 0, 800, 10, 'delay', ' ms'), ctl(['Stagger', '逐項間隔'], 0, 250, 5, 'stagger', ' ms'), ctl(['Distance', '距離'], 0, 80, 2, 'dist', ' px'), h('label', { class: 'mf-kctl' }, h('span', { html: bi('Easing', '緩動') }), ease, curve), bez), demo);
      return box;
    }
    prof.addEventListener('change', () => { if (prof.value === 'custom') return; const p = PROFILES[prof.value]; anim.profile = prof.value; anim.speed = p.speed; anim.kinds = JSON.parse(JSON.stringify(p.kinds)); save(); rebuild(); });
    const imp = h('input', { type: 'file', accept: '.json,application/json', class: 'mf-visually-hidden', id: 'mf-anim-import', onchange: () => { const f = imp.files[0]; if (!f) return; readFileText(f, 30000).then((t) => { const j = JSON.parse(t); if (!j || !j.kinds || typeof j.speed !== 'number') throw new Error('bad'); const kinds = {}; KINDS.forEach(([id]) => { const s = j.kinds[id] || {}; const d = PROFILES.standard.kinds[id]; kinds[id] = { on: s.on !== false, dur: clamp(Number(s.dur) || d.dur, 0, 1500), delay: clamp(Number(s.delay) || 0, 0, 800), stagger: clamp(Number(s.stagger) || 0, 0, 250), ease: ['standard', 'emphasized', 'spring', 'linear', 'custom'].indexOf(s.ease) >= 0 ? s.ease : 'standard', dist: clamp(Number(s.dist) || 0, 0, 80), bez: Array.isArray(s.bez) && s.bez.length === 4 ? s.bez.map((n, i) => clamp(Number(n) || 0, i % 2 ? -1 : 0, i % 2 ? 2 : 1)) : [0.2, 0, 0, 1] }; }); anim = { master: j.master !== false, profile: 'custom', speed: clamp(j.speed, 0.4, 2), kinds }; save(); prof.value = 'custom'; rebuild(); notifyMsg(MSG.imported, 'ok'); }).catch(() => notifyMsg(MSG.invalid, 'error')); imp.value = ''; } });
    wrap.append(note, h('div', { class: 'mf-row' }, master, h('label', { class: 'mf-kctl' }, h('span', { html: bi('Speed', '速度') }), speed, speedOut), h('label', { class: 'mf-kctl' }, h('span', { html: bi('Profile', '方案') }), prof)), body,
      h('div', { class: 'mf-row' }, h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Export profile', '匯出方案'), onclick: () => { download('animation-profile.json', JSON.stringify(anim, null, 2), 'application/json'); notifyMsg(MSG.exported, 'ok', { name: 'animation-profile.json' }); } }), h('label', { class: 'mf-btn tonal', for: 'mf-anim-import', tabindex: '0', role: 'button', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); imp.click(); } } }, h('span', { html: bi('Import profile', '匯入方案') })), imp));
    rebuild();
  } });

export function initAppearance() { applyAppearance(true); applyLogo(); applyAnim(); document.addEventListener('mar:lang', applyLogo); }
