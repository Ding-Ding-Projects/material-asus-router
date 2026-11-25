/* Voice features: language mode, funny levels, personal word list, display name and the spoken narrator. */
import { root, h, bi, $, $$, define, get, set, store, lang, setLanguage, say, sayText, pick, on, emit, esc, readFileText, download, motionOk, siteRoot } from './core.js';
import { MSG } from './strings.js';
import { notify, notifyMsg } from './notify.js';
import { play } from './sound.js';

/* ---------- language mode ---------- */
define({
  id: 'language', group: 'voice', type: 'select', default: 'en', label: ['Language', '語言'],
  info: ['English, Hong Kong Cantonese, or both together. Both shows the English line first and a compact Cantonese line beside or under it. The choice is remembered in this browser.', '英文、香港廣東話，或者兩種一齊顯示。兩種並列時會先顯示英文，再顯示精簡嘅廣東話。選擇會記喺呢個瀏覽器。'],
  options: [['en', 'English', 'English'], ['zh', 'Cantonese', '廣東話'], ['both', 'English and Cantonese', '英文同廣東話']],
  read: () => lang(),
  apply(v, o) { if (o && o.boot) return; if (root.hasAttribute('data-mf-school') && v !== 'en') { notify({ en: 'School mode keeps the site in English.', zh: '學校模式會保持英文。' }, 'warn'); return; } setLanguage(v); },
  reset() { setLanguage(/^zh/i.test(navigator.language || '') ? 'zh' : 'en'); },
});

/* ---------- funny levels ---------- */
define({ id: 'funny.en', group: 'voice', type: 'range', min: 1, max: 5, step: 1, default: 5, label: ['Funny level, English', '英文幽默程度'],
  info: ['1 is plain and 5 is playful. It changes the tone of messages, dialogs and errors, never the facts, numbers or steps. Turned off in School mode.', '1 係平實，5 係好玩。只會改變訊息、對話框同錯誤提示嘅語氣，唔會改變事實、數字同步驟。學校模式會關閉。'], preview: 'en' });
define({ id: 'funny.zh', group: 'voice', type: 'range', min: 1, max: 5, step: 1, default: 5, label: ['Funny level, Cantonese', '廣東話幽默程度'],
  info: ['The same scale for the Cantonese text. The two sliders are independent.', '廣東話文字用同一把尺，兩個滑桿各自獨立。'], preview: 'zh' });
define({ id: 'dialog.emoji', group: 'voice', type: 'toggle', default: true, label: ['Show an emoji in dialogs', '對話框顯示表情符號'],
  info: ['Adds one decorative emoji to the title of a dialog. Never in buttons, labels or accessible names. Disclosed here and on first visit.', '喺對話框標題加一個裝飾表情。唔會出現喺按鈕、標籤或無障礙名稱。首次到訪同呢度都有說明。'] });

/* ---------- display name ---------- */
const SHIPPED = 'Material Asus Router';
function applyName() {
  const name = (get('name') || '').trim() || SHIPPED;
  $$('.brand-name, .footer-title').forEach((el) => {
    if (!el.dataset.mfOrig) el.dataset.mfOrig = el.textContent;
    if (el.dataset.mfOrig === SHIPPED) el.textContent = name;
  });
}
function nameHistory() { return store.get('name.history', []); }
function logName(kind, value) { const l = nameHistory(); l.push({ t: Date.now(), kind, value }); store.set('name.history', l.slice(-200)); }
define({ id: 'name', group: 'voice', type: 'text', default: '', maxlength: 40, placeholder: SHIPPED, label: ['Displayed product name', '顯示嘅產品名稱'],
  info: ['Changes only what you see in the header and footer of this site. Page addresses, downloads and the real project name stay the same. Every change is recorded in the list below, and Reset returns to Material Asus Router.', '只改變你喺呢個網站頁首同頁尾睇到嘅名稱，頁面網址、下載同真正嘅項目名稱唔變。每次更改都會記錄喺下面嘅清單，重設會返回 Material Asus Router。'],
  apply(v, o) { applyName(); if (!(o && (o.boot || o.reset))) logName('rename', v); },
  reset() { applyName(); logName('reset', ''); },
  extra(wrap) {
    const ul = h('ul', { class: 'mf-log' });
    const draw = () => { ul.textContent = ''; const l = nameHistory().slice(-6).reverse(); if (!l.length) ul.append(h('li', { html: bi('No renames yet.', '未改過名。') })); l.forEach((e) => ul.append(h('li', {}, new Date(e.t).toLocaleString(), ' · ', e.kind === 'reset' ? pick('reset', '重設') : e.value))); };
    draw(); on('setting', (e) => { if (e.id === 'name') draw(); }); wrap.append(h('p', { class: 'mf-sub', html: bi('Rename history (append only)', '改名記錄（只增不減）') }), ul);
  } });

/* ---------- personal word list ---------- */
const SKIP = 'script,style,code,pre,kbd,textarea,input,select,[contenteditable],.mf-dialog,.mf-search,.mf-dock,.mf-palette,.mf-tabs,svg';
let originals = new WeakMap();
const touched = new Set();
let vocab = store.get('vocab', null);
export function validateVocab(text) {
  let data; try { data = JSON.parse(text); } catch (e) { return { ok: false, why: 'not JSON' }; }
  let entries = Array.isArray(data) ? data : data && Array.isArray(data.entries) ? data.entries : data && typeof data === 'object' ? Object.keys(data).filter((k) => k !== 'version').map((k) => ({ from: k, to: data[k] })) : null;
  if (!entries || !entries.length) return { ok: false, why: 'no entries' };
  if (entries.length > 500) return { ok: false, why: 'more than 500 entries' };
  const clean = [];
  for (const e of entries) {
    if (!e || typeof e.from !== 'string' || typeof e.to !== 'string') return { ok: false, why: 'each entry needs "from" and "to" text' };
    const from = e.from.trim(), to = e.to.trim();
    if (!from || from.length > 60 || to.length > 80) return { ok: false, why: 'an entry is empty or too long' };
    if (/[<>]/.test(from + to)) return { ok: false, why: 'markup is not allowed' };
    clean.push({ from, to, cs: !!e.caseSensitive });
  }
  return { ok: true, entries: clean };
}
function vocabRegex() {
  if (!vocab || !vocab.entries || !vocab.entries.length) return null;
  const list = vocab.entries.slice().sort((a, b) => b.from.length - a.from.length);
  const map = new Map(list.map((e) => [e.cs ? e.from : e.from.toLowerCase(), e]));
  const body = list.map((e) => e.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp('(?<![\\p{L}\\p{N}])(' + body + ')(?![\\p{L}\\p{N}])', 'giu');
  return { re, map };
}
function walkText(rootEl, fn) {
  const w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, { acceptNode(n) { return n.parentElement && !n.parentElement.closest(SKIP) && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
  const nodes = []; let n; while ((n = w.nextNode())) nodes.push(n); nodes.forEach(fn);
}
function matchCase(src, to) { if (src.length > 1 && src === src.toUpperCase() && /[A-Z]/.test(src)) return to.toUpperCase(); if (/^\p{Lu}/u.test(src) && /^\p{Ll}/u.test(to)) return to[0].toUpperCase() + to.slice(1); return to; }
export function applyVocab() {
  revertVocab();
  if (root.hasAttribute('data-mf-school')) return 0;
  const rx = vocabRegex(); if (!rx) return 0; let count = 0;
  ['main', '.footer', '.appbar'].forEach((sel) => $$(sel).forEach((el) => walkText(el, (node) => {
    const v = node.nodeValue; let changed = false;
    const next = v.replace(rx.re, (m) => { const e = rx.map.get(m.toLowerCase()) || rx.map.get(m); if (!e || (e.cs && e.from !== m)) return m; changed = true; count++; return e.cs ? e.to : matchCase(m, e.to); });
    if (changed) { originals.set(node, v); touched.add(node); node.nodeValue = next; }
  })));
  return count;
}
function revertVocab() { touched.forEach((n) => { if (originals.has(n)) n.nodeValue = originals.get(n); }); touched.clear(); originals = new WeakMap(); }
export function loadVocabText(text, source) {
  const r = validateVocab(text);
  if (!r.ok) { notifyMsg(MSG.invalid, 'error'); notify({ en: 'Reason: ' + r.why, zh: '原因：' + r.why }, 'info', { quiet: true }); return false; }
  vocab = { entries: r.entries, at: Date.now(), source: source || 'file' }; store.set('vocab', vocab);
  const n = applyVocab(); notifyMsg(MSG.vocabOn, 'ok', { n: r.entries.length }, { quiet: true }); celebrate(); play('tada'); emit('vocab'); return n >= 0;
}
export function clearVocab() { vocab = null; store.del('vocab'); revertVocab(); notifyMsg(MSG.vocabOff, 'info'); emit('vocab'); }
export const vocabInfo = () => vocab;
function celebrate() {
  if (!motionOk()) return;
  const layer = h('div', { class: 'mf-confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 28; i++) { const s = h('span', { style: { left: Math.random() * 100 + '%', background: `hsl(${Math.round(Math.random() * 360)} 80% 60%)`, animationDelay: Math.random() * 0.4 + 's', transform: `rotate(${Math.round(Math.random() * 360)}deg)` } }); layer.append(s); }
  document.body.append(layer); setTimeout(() => layer.remove(), 2600);
}
define({ id: 'vocab', group: 'voice', type: 'custom', default: null, label: ['Personal word list', '個人字詞表'],
  info: ['Load a small JSON file of word replacements and this browser will show your wording on every page. The file stays on this device, is checked before use and is never uploaded. You can also drop a file anywhere on the page. Clear restores the original wording. School mode ignores it.', '載入一個細細嘅 JSON 字詞替換檔，呢個瀏覽器就會喺每一頁顯示你嘅用字。檔案只留喺你嘅裝置，用之前會先檢查，絕對唔會上傳。你亦可以將檔案拖放到頁面任何位置。清除會還原原文。學校模式會忽略佢。'],
  read: () => (vocab ? vocab.entries.length : 0),
  apply() { }, reset() { clearVocab(); },
  render(wrap) {
    const status = h('p', { class: 'mf-status', role: 'status' });
    const draw = () => { status.innerHTML = vocab ? bi(`Active: ${vocab.entries.length} entries, loaded ${new Date(vocab.at).toLocaleString()}.`, `使用中：${vocab.entries.length} 項，載入於 ${new Date(vocab.at).toLocaleString()}。`) : bi('No word list loaded.', '未載入字詞表。'); };
    const fi = h('input', { type: 'file', accept: '.json,application/json', class: 'mf-visually-hidden', id: 'mf-vocab-file', onchange: () => { if (fi.files[0]) readFileText(fi.files[0], 100000).then((t) => loadVocabText(t, 'file')).catch(() => notifyMsg(MSG.invalid, 'error')); fi.value = ''; } });
    wrap.append(status, fi,
      h('div', { class: 'mf-row' },
        h('label', { class: 'mf-btn filled', for: 'mf-vocab-file', tabindex: '0', role: 'button', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } } }, h('span', { html: bi('Choose a JSON file', '揀選 JSON 檔案') })),
        h('button', { type: 'button', class: 'mf-btn tonal', onclick: () => clearVocab(), html: bi('Clear and restore wording', '清除並還原原文') }),
        h('button', { type: 'button', class: 'mf-btn text', onclick: () => download('word-list-sample.json', JSON.stringify({ version: 1, entries: [{ from: 'router', to: 'box' }, { from: 'guest network', to: 'visitor Wi-Fi' }] }, null, 2), 'application/json'), html: bi('Download a sample', '下載範例') })),
      h('div', { class: 'mf-drop', 'aria-hidden': 'true', html: bi('Tip: drop a .json file anywhere on this page.', '提示：可以將 .json 檔案拖放到頁面任何位置。') }));
    draw(); on('vocab', draw);
  } });

function initDrop() {
  let depth = 0; const veil = h('div', { class: 'mf-dropveil', 'aria-hidden': 'true', hidden: true, html: bi('Drop the word list file to apply it', '放開字詞表檔案即可套用') }); document.body.append(veil);
  const has = (e) => e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0;
  window.addEventListener('dragenter', (e) => { if (has(e)) { depth++; veil.hidden = false; } });
  window.addEventListener('dragleave', (e) => { if (has(e)) { depth = Math.max(0, depth - 1); if (!depth) veil.hidden = true; } });
  window.addEventListener('dragover', (e) => { if (has(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!has(e)) return; e.preventDefault(); depth = 0; veil.hidden = true;
    const f = e.dataTransfer.files[0]; if (!f) return;
    if (!/\.json$/i.test(f.name) && f.type !== 'application/json') { play('invalid'); notifyMsg(MSG.invalid, 'error'); return; }
    readFileText(f, 100000).then((t) => loadVocabText(t, 'drop')).catch(() => { play('invalid'); notifyMsg(MSG.invalid, 'error'); });
  });
}

/* ---------- spoken narrator ---------- */
const synth = window.speechSynthesis;
let voices = [];
function refreshVoices() { try { voices = synth ? synth.getVoices() : []; } catch (e) { voices = []; } emit('voices'); }
if (synth) { refreshVoices(); try { synth.addEventListener('voiceschanged', refreshVoices); } catch (e) { synth.onvoiceschanged = refreshVoices; } }
const voiceKey = (v) => v.voiceURI + '|' + v.name;
function voiceOptions(code) {
  const ok = (v) => (code === 'zh' ? /^(zh|yue|cmn)/i.test(v.lang) : /^en/i.test(v.lang));
  return [['', 'Choose automatically', '自動選擇']].concat(voices.filter(ok).map((v) => [voiceKey(v), v.name + ' (' + v.lang + ')', v.name + '（' + v.lang + '）']));
}
export function effectiveVoice(code) {
  const chosen = get('narr.voice.' + code);
  if (chosen) { const v = voices.find((x) => voiceKey(x) === chosen); if (v) return v; }
  if (code === 'zh') return voices.find((v) => /zh[-_]HK|yue/i.test(v.lang)) || voices.find((v) => /zh[-_]TW/i.test(v.lang)) || voices.find((v) => /^zh/i.test(v.lang)) || null;
  return voices.find((v) => /^en[-_]GB/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || null;
}
define({ id: 'narr.mode', group: 'narration', type: 'select', default: 'follow', label: ['Narrator language', '朗讀語言'], info: ['Follow the site language, or always read in English, Cantonese, or both one after the other.', '跟隨網站語言，或者固定用英文、廣東話，或者先英文後廣東話。'], options: [['follow', 'Follow the site language', '跟隨網站語言'], ['en', 'English', '英文'], ['zh', 'Cantonese', '廣東話'], ['both', 'Both, one after the other', '兩種輪流']] });
['en', 'zh'].forEach((code) => define({ id: 'narr.voice.' + code, group: 'narration', type: 'select', default: '', label: [code === 'en' ? 'English voice' : 'Cantonese voice', code === 'en' ? '英文語音' : '廣東話語音'],
  info: ['Lists the voices installed on this device. Choose automatically picks the best match and the line below says which voice is really used. A Hong Kong Cantonese voice may not exist on every device.', '列出你裝置已安裝嘅語音。自動選擇會揀最合適嘅，下面一行會講明實際用咗邊個語音。唔係每部裝置都有香港廣東話語音。'],
  options: () => voiceOptions(code),
  extra(wrap) { const p = h('p', { class: 'mf-sub' }); const d = () => { const v = effectiveVoice(code); p.innerHTML = v ? bi('Voice in use: ' + v.name + ' (' + v.lang + ')', '實際使用：' + v.name + '（' + v.lang + '）') : bi('No matching voice is installed here.', '呢部裝置冇合適嘅語音。'); }; d(); on('voices', d); on('setting', (e) => { if (e.id === 'narr.voice.' + code) d(); }); wrap.append(p); } }));
define({ id: 'narr.rate', group: 'narration', type: 'range', min: 0.6, max: 1.6, step: 0.1, default: 1, label: ['Speaking speed', '朗讀速度'], info: ['1 is normal speed.', '1 係正常速度。'] });
define({ id: 'narr.pitch', group: 'narration', type: 'range', min: 0.6, max: 1.6, step: 0.1, default: 1, label: ['Voice pitch', '音調'], info: ['1 is the voice’s normal pitch.', '1 係語音嘅正常音調。'] });
define({ id: 'narr.events', group: 'narration', type: 'toggle', default: false, label: ['Speak notifications', '朗讀通知'], info: ['Speaks new notifications aloud, one at a time, at most one every few seconds. Errors are always spoken. If you use a screen reader, leave this off so the two do not talk over each other.', '朗讀新通知，一次一個，每隔幾秒最多一個。錯誤一定會朗讀。如果你用緊螢幕閱讀器，請保持關閉，免得兩把聲互相蓋過。'] });

const player = { units: [], i: 0, playing: false, paused: false, bar: null };
function unitsForPage() {
  const mode = get('narr.mode') === 'follow' ? (lang() === 'zh' ? 'zh' : lang() === 'both' ? 'both' : 'en') : get('narr.mode');
  const out = [];
  const grab = (sel, code) => $$(sel).forEach((body) => $$('h1,h2,h3,h4,p,li,blockquote', body).forEach((el) => { const t = el.innerText.replace(/\s+/g, ' ').trim(); if (t && !el.closest('pre') && !el.closest('.mf-dialog')) out.push({ el, text: t, code }); }));
  const root1 = $('.article') ? '.article ' : 'main ';
  if (mode !== 'zh') { if ($('.prose.body-en')) grab('.prose.body-en', 'en'); else { $$(root1 + 'h1,' + root1 + 'h2,' + root1 + 'p').forEach((el) => { const t = (el.querySelector('.en') || el).innerText.replace(/\s+/g, ' ').trim(); if (t) out.push({ el, text: t, code: 'en' }); }); } }
  if (mode !== 'en' && $('.prose.body-zh')) grab('.prose.body-zh', 'zh');
  return out;
}
function speakUnit() {
  if (!player.playing) return;
  const u = player.units[player.i]; if (!u) { stopReading(true); return; }
  $$('.mf-reading').forEach((e) => e.classList.remove('mf-reading')); u.el.classList.add('mf-reading');
  try { u.el.scrollIntoView({ block: 'center', behavior: motionOk() ? 'smooth' : 'auto' }); } catch (e) { /* ignore */ }
  const ut = new SpeechSynthesisUtterance(u.text.slice(0, 900)); const v = effectiveVoice(u.code);
  if (v) { ut.voice = v; ut.lang = v.lang; } else ut.lang = u.code === 'zh' ? 'zh-HK' : 'en-GB';
  ut.rate = Number(get('narr.rate')) || 1; ut.pitch = Number(get('narr.pitch')) || 1;
  ut.onend = () => { if (player.playing && !player.paused) { player.i++; updateBar(); speakUnit(); } };
  ut.onerror = (e) => { if (e.error !== 'canceled' && e.error !== 'interrupted') { player.i++; speakUnit(); } };
  synth.speak(ut); updateBar();
}
export function startReading(fromEl) {
  if (!synth || !voices.length) { notifyMsg(MSG.narrationNone, 'warn'); refreshVoices(); if (!synth || !voices.length) return false; }
  stopReading(true, true);
  player.units = unitsForPage(); if (!player.units.length) { notify({ en: 'There is nothing to read on this page.', zh: '呢一頁冇嘢可以朗讀。' }, 'info'); return false; }
  player.i = 0; if (fromEl) { const k = player.units.findIndex((u) => u.el === fromEl || u.el.contains(fromEl)); if (k >= 0) player.i = k; }
  player.playing = true; player.paused = false; showBar(); notifyMsg(MSG.narrationOn, 'info', null, { quiet: true }); speakUnit(); return true;
}
export function stopReading(silent, noMsg) {
  if (synth) synth.cancel(); const was = player.playing; player.playing = false; player.paused = false;
  $$('.mf-reading').forEach((e) => e.classList.remove('mf-reading')); if (player.bar) { player.bar.remove(); player.bar = null; }
  if (was && !silent && !noMsg) notifyMsg(MSG.narrationOff, 'info', null, { quiet: true });
}
export const isReading = () => player.playing;
function step(d) { if (!player.playing) return; synth.cancel(); player.i = Math.max(0, Math.min(player.units.length - 1, player.i + d)); player.paused = false; speakUnit(); }
function showBar() {
  if (player.bar) return;
  const pp = h('button', { type: 'button', class: 'mf-icon', 'aria-label': pick('Pause or resume', '暫停或繼續'), onclick: () => { if (player.paused) { synth.resume(); player.paused = false; } else { synth.pause(); player.paused = true; } updateBar(); } }, '⏯');
  player.bar = h('div', { class: 'mf-player', role: 'region', 'aria-label': pick('Narrator', '朗讀') },
    h('button', { type: 'button', class: 'mf-icon', 'aria-label': pick('Previous paragraph', '上一段'), onclick: () => step(-1) }, '⏮'), pp,
    h('button', { type: 'button', class: 'mf-icon', 'aria-label': pick('Next paragraph', '下一段'), onclick: () => step(1) }, '⏭'),
    h('button', { type: 'button', class: 'mf-icon', 'aria-label': pick('Stop reading', '停止朗讀'), onclick: () => stopReading() }, '⏹'),
    h('span', { class: 'mf-ptext', 'aria-live': 'off' }));
  document.body.append(player.bar); updateBar();
}
function updateBar() { if (!player.bar) return; const t = player.bar.querySelector('.mf-ptext'); const v = player.units[player.i] && effectiveVoice(player.units[player.i].code); t.textContent = `${Math.min(player.i + 1, player.units.length)} / ${player.units.length}${player.paused ? ' · ' + pick('paused', '已暫停') : ''}${v ? ' · ' + v.name : ''}`; }
export function toggleReading() { return player.playing ? (stopReading(), false) : startReading(); }

let lastSpoken = 0, pending = null;
on('notify', (n) => {
  if (!get('narr.events') || !synth || !voices.length) return;
  if (player.playing && n.kind !== 'error') return;
  const now = Date.now(); const speak = () => { lastSpoken = Date.now(); const code = lang() === 'zh' ? 'zh' : 'en'; const ut = new SpeechSynthesisUtterance(code === 'zh' ? n.zh : n.en); const v = effectiveVoice(code); if (v) { ut.voice = v; ut.lang = v.lang; } ut.rate = Number(get('narr.rate')) || 1; if (n.kind !== 'error' && synth.speaking) return; synth.speak(ut); };
  clearTimeout(pending); if (n.kind === 'error' || now - lastSpoken > 3000) pending = setTimeout(speak, 400); else pending = setTimeout(speak, 3000 - (now - lastSpoken));
});

export function initVoice() {
  applyName(); initDrop();
  if (vocab) setTimeout(applyVocab, 50);
  try { new MutationObserver((() => { let t; return () => { clearTimeout(t); t = setTimeout(() => { if (vocab) applyVocab(); applyName(); }, 250); }; })()).observe($('main') || document.body, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
  document.addEventListener('mar:lang', () => { if (player.playing) stopReading(true); });
  window.addEventListener('beforeunload', () => { if (synth) synth.cancel(); });
}
