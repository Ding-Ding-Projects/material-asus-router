/* Comfort modes: School mode, the five ADHD modes, the dim sum surprise and scheduled settings. */
import { root, h, bi, $, $$, define, get, set, store, lang, setLanguage, pick, say, on, emit, dialog, uid, motionOk, setGuard } from './core.js';
import { MSG, DISHES } from './strings.js';
import { notify, notifyMsg } from './notify.js';
import { play } from './sound.js';
import { applyVocab } from './voice.js';

/* ---------- School mode ---------- */
async function hashSecret(secret, saltHex) {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g).map((x) => parseInt(x, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256));
  const hex = (a) => Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { salt: hex(salt), hash: hex(bits) };
}
export { hashSecret };
export async function checkSecret(secret, rec) { const r = await hashSecret(secret, rec.salt); return r.hash === rec.hash; }

function askSecret(titleEn, titleZh) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'password', class: 'mf-input', autocomplete: 'off', 'aria-label': pick('PIN or password', 'PIN 或密碼') });
    let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
    const d = dialog({ id: 'mf-ask', titleEn, titleZh, body: h('div', {}, inp), actions: [{ en: 'Cancel', zh: '取消', kind: 'text', onClick: () => fin(null) }, { en: 'Confirm', zh: '確定', kind: 'filled', onClick: () => fin(inp.value) }], onClose: () => fin(null) });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { fin(inp.value); d.close(); } });
  });
}
export async function setSchool(on, viaSchedule) {
  if (!!get('school') === on) return true;
  if (!on && !viaSchedule) {
    const rec = store.get('school.pin', null);
    if (rec) { const v = await askSecret('Turn off School mode', '關閉學校模式'); if (v === null) return false; if (!(await checkSecret(v, rec))) { notifyMsg(MSG.wrongCode, 'error', { left: '∞' }); return false; } }
  }
  set('school', on, { force: true }); return true;
}
let prevLang = null;
define({ id: 'school', group: 'comfort', type: 'custom', default: false, label: ['School mode', '學校模式'],
  info: ['Keeps the whole site in plain English: Cantonese, both-languages, funny levels, the word list and the dim sum surprise are left out, not just greyed out. If you set a PIN, turning School mode off asks for it. This is a comfort lock for shared devices, not security: clearing this site’s data removes it.', '令成個網站保持簡單英文：廣東話、雙語、幽默程度、字詞表同點心驚喜都會直接唔出現，而唔係得個灰色。如果你設定咗 PIN，關閉學校模式時會問你。呢個只係共用裝置嘅使用體驗鎖，唔係保安功能：清除呢個網站嘅資料就會移除佢。'],
  read: () => !!get('school'),
  apply(v, o) {
    if (v) {
      root.setAttribute('data-mf-school', '');
      if (lang() !== 'en') { prevLang = lang(); store.set('school.prevlang', prevLang); setLanguage('en'); }
      applyVocab();
      if (!(o && o.boot)) notifyMsg(MSG.schoolOn, 'info');
    } else {
      root.removeAttribute('data-mf-school');
      const p = prevLang || store.get('school.prevlang', null); if (p && !(o && o.boot)) setLanguage(p); store.del('school.prevlang'); prevLang = null;
      applyVocab();
      if (!(o && o.boot)) notifyMsg(MSG.schoolOff, 'info');
    }
  },
  reset() { setSchool(false); },
  render(wrap) {
    const sw = h('button', { type: 'button', class: 'mf-switch', role: 'switch', 'aria-label': pick('School mode', '學校模式') });
    const state = h('p', { class: 'mf-status', role: 'status' });
    const pinBox = h('input', { type: 'password', class: 'mf-input', placeholder: pick('New PIN or password (optional)', '新 PIN 或密碼（可選）'), 'aria-label': pick('New PIN or password', '新 PIN 或密碼'), autocomplete: 'off' });
    const draw = () => { const on2 = !!get('school'); sw.setAttribute('aria-checked', String(on2)); state.innerHTML = (on2 ? bi('On. English only.', '已開，只用英文。') : bi('Off.', '已關。')) + ' ' + (store.get('school.pin', null) ? bi('A PIN is set.', '已設定 PIN。') : bi('No PIN is set.', '未設定 PIN。')); };
    sw.addEventListener('click', async () => { await setSchool(!get('school')); draw(); });
    wrap.append(h('div', { class: 'mf-row' }, sw, h('span', { html: bi('School mode', '學校模式') })), state, h('div', { class: 'mf-row' }, pinBox,
      h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Save PIN', '儲存 PIN'), onclick: async () => { if (!pinBox.value) return; const cur = store.get('school.pin', null); if (cur) { const v = await askSecret('Current PIN', '現時 PIN'); if (v === null || !(await checkSecret(v, cur))) { notifyMsg(MSG.wrongCode, 'error', { left: '∞' }); return; } } store.set('school.pin', await hashSecret(pinBox.value)); pinBox.value = ''; notifyMsg(MSG.saved, 'ok'); draw(); } }),
      h('button', { type: 'button', class: 'mf-btn text', html: bi('Remove PIN', '移除 PIN'), onclick: async () => { const cur = store.get('school.pin', null); if (!cur) return; const v = await askSecret('Current PIN', '現時 PIN'); if (v === null || !(await checkSecret(v, cur))) { notifyMsg(MSG.wrongCode, 'error', { left: '∞' }); return; } store.del('school.pin'); notifyMsg(MSG.reset, 'info'); draw(); } })),
      h('p', { class: 'mf-hint', html: bi('A comfort lock only: this is not security, and clearing this site’s data removes it.', '只係使用體驗鎖，唔係保安功能，清除呢個網站嘅資料就會移除。') }));
    draw(); on('setting', (e) => { if (e.id === 'school') draw(); });
  } });

/* ---------- ADHD modes ---------- */
const ADHD = [
  ['focus', 'Focus', '專注', 'Hides the footer, side panels and the floating buttons so only the page you are reading stays on screen.', '隱藏頁尾、側欄同浮動按鈕，畫面只剩下你睇緊嘅內容。'],
  ['lowstim', 'Low stimulation', '低刺激', 'Stops all animation and sounds, softens colours and removes surprises. It also follows your system’s reduced motion setting.', '停止所有動畫同音效、柔和顏色，亦唔會有驚喜。亦會跟你系統嘅減少動態設定。'],
  ['time', 'Time awareness', '時間感', 'Shows how long you have been on this page and a plain reading-time estimate. No scores.', '顯示你喺呢頁用咗幾耐，同埋一個簡單嘅閱讀時間估計。冇分數。'],
  ['one', 'One thing at a time', '一次一件事', 'Shows one section of a guide at a time, with Previous and Next buttons.', '一次只顯示指南嘅一個段落，有上一段同下一段掣。'],
  ['momentum', 'Momentum', '前進感', 'Shows which section you are on and how many remain. Plain facts, never streaks or rewards.', '顯示你喺邊一段同仲有幾段，只係事實，冇連勝同獎勵。'],
];
const sectionsState = { cur: 0, groups: [], bar: null };
function buildSections() {
  clearSections();
  if (!get('adhd.one')) return;
  const wraps = $$('.article .prose'); if (!wraps.length) return;
  wraps.forEach((wrap) => {
    const groups = [[]]; Array.prototype.forEach.call(wrap.children, (c) => { if (c.tagName === 'H2' && groups[groups.length - 1].length) groups.push([]); groups[groups.length - 1].push(c); });
    sectionsState.groups.push(groups);
  });
  if (!sectionsState.groups.length || sectionsState.groups[0].length < 2) { sectionsState.groups = []; return; }
  const bar = h('nav', { class: 'mf-sections', 'aria-label': pick('Sections', '段落') });
  const first = wraps[0]; first.parentNode.insertBefore(bar, first); sectionsState.bar = bar; showSection(0);
}
function clearSections() { sectionsState.groups.forEach((gs) => gs.forEach((g) => g.forEach((n) => n.classList.remove('mf-hidden')))); sectionsState.groups = []; if (sectionsState.bar) { sectionsState.bar.remove(); sectionsState.bar = null; } }
function showSection(i) {
  const gs = sectionsState.groups[0]; if (!gs) return; i = Math.max(0, Math.min(gs.length - 1, i)); sectionsState.cur = i;
  sectionsState.groups.forEach((groups) => groups.forEach((g, k) => g.forEach((n) => n.classList.toggle('mf-hidden', k !== Math.min(i, groups.length - 1)))));
  const bar = sectionsState.bar; bar.textContent = '';
  const head = gs[i][0]; const title = head && /^H[1-6]$/.test(head.tagName) ? head.textContent.replace(/^#\s*/, '').trim() : pick('Introduction', '簡介');
  bar.append(h('button', { type: 'button', class: 'mf-btn tonal', disabled: i === 0, onclick: () => { showSection(i - 1); bar.scrollIntoView({ block: 'nearest' }); }, html: bi('Previous', '上一段') }),
    h('span', { class: 'mf-secinfo' }, h('b', {}, `${i + 1} / ${gs.length}`), ' · ', title),
    h('button', { type: 'button', class: 'mf-btn filled', disabled: i === gs.length - 1, onclick: () => { showSection(i + 1); bar.scrollIntoView({ block: 'nearest' }); }, html: bi('Next', '下一段') }));
  updateMomentum();
}
window.addEventListener('hashchange', () => { if (!sectionsState.groups.length || !location.hash) return; const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (!t) return; const gs = sectionsState.groups[0]; const k = gs.findIndex((g) => g.some((n) => n === t || n.contains(t))); if (k >= 0 && k !== sectionsState.cur) showSection(k); });

let timeChip = null, pageStart = Date.now(), timeTimer = null;
function words() { const el = $('.prose.body-en') || $('.article') || $('main'); return el ? (el.innerText || '').split(/\s+/).filter(Boolean).length : 0; }
function updateTime() {
  if (!timeChip) return; const s = Math.floor((Date.now() - pageStart) / 1000); const mm = String(Math.floor(s / 60)).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
  const w = words(); const mins = Math.max(1, Math.round(w / 200));
  timeChip.innerHTML = bi(`On this page ${mm}:${ss}` + (w > 250 ? ` · about ${mins} min to read` : ''), `喺呢頁 ${mm}:${ss}` + (w > 250 ? ` · 大約要睇 ${mins} 分鐘` : ''));
}
let momentum = null;
function updateMomentum() {
  if (!momentum) return; const heads = $$('.article .prose.body-en h2'); const total = heads.length || 0;
  if (!total) { momentum.innerHTML = bi('This page has no sections to count.', '呢頁冇段落可以計。'); return; }
  let idx = 0; heads.forEach((hd, k) => { if (hd.getBoundingClientRect().top < window.innerHeight * 0.5) idx = k + 1; }); if (sectionsState.groups.length) idx = sectionsState.cur;
  momentum.innerHTML = bi(`Section ${Math.min(idx, total)} of ${total}. ${Math.max(0, total - idx)} left.`, `第 ${Math.min(idx, total)} 段，共 ${total} 段，仲有 ${Math.max(0, total - idx)} 段。`);
}
window.addEventListener('scroll', () => { if (get('adhd.momentum')) updateMomentum(); }, { passive: true });
function setChips() {
  if (get('adhd.time')) { if (!timeChip) { timeChip = h('div', { class: 'mf-chipbar time', 'aria-live': 'off' }); document.body.append(timeChip); timeTimer = setInterval(updateTime, 1000); } updateTime(); } else if (timeChip) { timeChip.remove(); timeChip = null; clearInterval(timeTimer); }
  if (get('adhd.momentum')) { if (!momentum) { momentum = h('div', { class: 'mf-chipbar momentum', role: 'status', 'aria-live': 'off' }); document.body.append(momentum); } updateMomentum(); } else if (momentum) { momentum.remove(); momentum = null; }
}
ADHD.forEach(([k, en, zh, infoEn, infoZh]) => define({
  id: 'adhd.' + k, group: 'comfort', type: 'toggle', default: false, label: [en, zh], info: [infoEn + ' Off by default. This is a reading comfort tool and not medical advice.', infoZh + ' 預設關閉。呢個係閱讀輔助工具，唔係醫療建議。'],
  apply(v) { root.toggleAttribute('data-mf-' + k, !!v); if (k === 'one') buildSections(); setChips(); if (k === 'lowstim' && v) { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } } },
}));

/* ---------- dim sum surprise ---------- */
export function dishSvg(id) {
  const base = '<ellipse cx="60" cy="74" rx="52" ry="14" fill="#c9954c"/><ellipse cx="60" cy="68" rx="48" ry="11" fill="#e3b86b"/><path d="M14 68q46 24 92 0" fill="none" stroke="#a9792f" stroke-width="2"/>';
  const art = {
    'har-gow': '<path d="M26 62q6-30 34-30t34 30q-34 8-68 0z" fill="#fbe9e2" stroke="#e0a493" stroke-width="2"/><path d="M34 55l6 5M44 48l5 7M56 44l3 8M68 46l-1 8M78 52l-3 7" stroke="#e0a493" stroke-width="2" stroke-linecap="round"/><ellipse cx="60" cy="58" rx="13" ry="5" fill="#f0a58e" opacity=".55"/>',
    'siu-mai': '<path d="M36 64l3-22q21-8 42 0l3 22q-24 6-48 0z" fill="#f1c24d" stroke="#c9961f" stroke-width="2"/><circle cx="60" cy="40" r="9" fill="#f0885a"/><circle cx="52" cy="41" r="3" fill="#7bbf5a"/><circle cx="68" cy="41" r="3" fill="#7bbf5a"/>',
    bao: '<path d="M24 64q0-34 36-34t36 34q-36 8-72 0z" fill="#fffaf0" stroke="#d9c9a8" stroke-width="2"/><path d="M60 32q-8 14-4 24M60 32q8 14 4 24M60 32v26" fill="none" stroke="#d9c9a8" stroke-width="2" stroke-linecap="round"/>',
    'egg-tart': '<path d="M28 52l5 14h54l5-14z" fill="#e1a050"/><path d="M28 52q32-12 64 0z" fill="#e8b560"/><ellipse cx="60" cy="50" rx="30" ry="9" fill="#f7d96a"/><ellipse cx="60" cy="49" rx="20" ry="5" fill="#fbe98e"/>',
    'cheung-fun': '<rect x="22" y="48" width="76" height="16" rx="8" fill="#f6f1e7" stroke="#d6cfbf" stroke-width="2"/><rect x="28" y="36" width="64" height="16" rx="8" fill="#fbf8f0" stroke="#d6cfbf" stroke-width="2"/><path d="M34 46h52" stroke="#c46a3a" stroke-width="3" stroke-linecap="round"/><path d="M40 58h40" stroke="#c46a3a" stroke-width="3" stroke-linecap="round"/>',
    'lo-bak-go': '<rect x="26" y="46" width="30" height="20" rx="3" fill="#efe2c0" stroke="#c8b27e" stroke-width="2"/><rect x="62" y="46" width="30" height="20" rx="3" fill="#efe2c0" stroke="#c8b27e" stroke-width="2"/><rect x="44" y="32" width="30" height="20" rx="3" fill="#f4e9ca" stroke="#c8b27e" stroke-width="2"/><circle cx="35" cy="56" r="2" fill="#b4573a"/><circle cx="76" cy="54" r="2" fill="#b4573a"/><circle cx="57" cy="42" r="2" fill="#b4573a"/>',
  };
  return `<svg viewBox="0 0 120 90" role="img" aria-label="${(DISHES.find((d) => d.id === id) || {}).en || 'Dim sum'}" class="mf-dish">${base}${art[id] || ''}</svg>`;
}
let shownDim = false;
export function showDimsum(force) {
  if (root.hasAttribute('data-mf-school') || root.hasAttribute('data-mf-lowstim')) return false;
  if (!force && shownDim) return false; shownDim = true;
  const d = DISHES[Math.floor(Math.random() * DISHES.length)];
  const card = h('div', { class: 'mf-dimsum' + (motionOk() ? ' anim' : ''), role: 'status' }, h('div', { class: 'mf-dsart', html: dishSvg(d.id) }),
    h('div', {}, h('b', { html: bi('A dim sum surprise', '點心驚喜') }), h('div', { html: bi(d.en, d.zh) })),
    h('button', { type: 'button', class: 'mf-icon', 'aria-label': pick('Dismiss', '關閉'), onclick: () => card.remove() }, '×'));
  document.body.append(card); setTimeout(() => card.remove(), 9000); play('notify'); return true;
}
define({ id: 'dimsum.off', group: 'comfort', type: 'toggle', default: false, label: ['Turn the dim sum surprise off', '關閉點心驚喜'],
  info: ['The surprise has a 10% chance once per visit, never during an error or while you are busy. You cannot switch it off: this switch springs back on, which is the joke. School mode and Low stimulation do hide it.', '每次到訪有 10% 機會出現一次，錯誤或者你忙緊嗰陣唔會出現。你關唔到佢：呢個掣會彈返開，呢個係個笑話。學校模式同低刺激模式會隱藏佢。'],
  apply(v, o) { if (v && !(o && o.boot)) { setTimeout(() => { set('dimsum.off', false, { force: true }); notify({ en: 'Nice try. The dim sum surprise stays on.', zh: '好嘗試，不過點心驚喜會繼續喺度。' }, 'info'); }, 1200); } else if (v) { set('dimsum.off', false, { force: true }); } } });
define({ id: 'dimsum.now', group: 'comfort', type: 'action', label: ['Show a dim sum now', '即刻顯示點心'], info: ['Shows one dish with its English and Cantonese names. Not available in School mode or Low stimulation.', '顯示一款點心同佢嘅中英文名稱。學校模式同低刺激模式下用唔到。'], run() { if (!showDimsum(true)) notify({ en: 'The dim sum surprise is hidden in School mode and Low stimulation.', zh: '學校模式同低刺激模式下會隱藏點心驚喜。' }, 'info'); } });

/* ---------- scheduled settings ---------- */
const ACTS = {
  lowstim: { en: 'Low stimulation on', zh: '開啟低刺激', key: 'adhd.lowstim', val: true },
  focus: { en: 'Focus on', zh: '開啟專注', key: 'adhd.focus', val: true },
  school: { en: 'School mode on', zh: '開啟學校模式', key: 'school', val: true },
  mute: { en: 'Sounds off', zh: '關閉音效', key: 'sound.on', val: false },
  narroff: { en: 'Spoken notifications off', zh: '關閉朗讀通知', key: 'narr.events', val: false },
};
let rules = store.get('sched.rules', []);
let snaps = store.get('sched.snaps', {});
const ext = { api: store.get('sched.api', ''), haUrl: store.get('sched.ha.url', ''), haEntity: store.get('sched.ha.entity', ''), haOn: false, apiRules: store.get('sched.apirules', []), fails: 0 };
const toMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
export function ruleActive(r, now) {
  if (!r.enabled) return false; const a = toMin(r.start), b = toMin(r.end); if (a === null || b === null) return false;
  const utc = r.tz === 'utc'; const day = utc ? now.getUTCDay() : now.getDay(); const t = (utc ? now.getUTCHours() : now.getHours()) * 60 + (utc ? now.getUTCMinutes() : now.getMinutes());
  const days = r.days && r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6]; const prev = (day + 6) % 7;
  if (a === b) return days.indexOf(day) >= 0;
  if (a < b) return days.indexOf(day) >= 0 && t >= a && t < b;
  return (days.indexOf(day) >= 0 && t >= a) || (days.indexOf(prev) >= 0 && t < b);
}
const lastOn = {}; let firstEval = true;
function evaluate() {
  const now = new Date(); const want = {}; const all = rules.concat(ext.apiRules.map((r) => Object.assign({ api: true, enabled: true }, r)));
  all.forEach((r) => { const on2 = ruleActive(r, now); if (on2 !== !!lastOn[r.id]) { lastOn[r.id] = on2; if (!firstEval) notifyMsg(on2 ? MSG.scheduleOn : MSG.scheduleOff, 'info', { name: r.name || 'Schedule' }, { quiet: true }); } if (on2) (r.acts || []).forEach((a) => { if (ACTS[a]) want[a] = true; }); });
  if (ext.haOn) store.get('sched.ha.acts', ['lowstim']).forEach((a) => { if (ACTS[a]) want[a] = true; });
  Object.keys(ACTS).forEach((a) => {
    const def = ACTS[a];
    if (want[a] && !(a in snaps)) { snaps[a] = get(def.key); store.set('sched.snaps', snaps); if (a === 'school') setSchool(true, true); else set(def.key, def.val, { force: true }); }
    else if (!want[a] && a in snaps) { const prev = snaps[a]; delete snaps[a]; store.set('sched.snaps', snaps); if (a === 'school') setSchool(!!prev, true); else set(def.key, prev, { force: true }); }
  });
}
function validRules(list) {
  if (!Array.isArray(list) || list.length > 20) return null; const out = [];
  for (const r of list) { if (!r || typeof r !== 'object' || toMin(r.start) === null || toMin(r.end) === null) return null; out.push({ id: 'api-' + String(r.id || out.length).slice(0, 20), name: String(r.name || 'Schedule').slice(0, 40), start: r.start, end: r.end, days: (Array.isArray(r.days) ? r.days : []).filter((d) => d >= 0 && d <= 6), tz: r.tz === 'utc' ? 'utc' : 'local', acts: (Array.isArray(r.acts) ? r.acts : []).filter((a) => ACTS[a]) }); }
  return out;
}
async function refreshExternal(manual) {
  const failed = (why) => { ext.fails++; if (manual || ext.fails === 1) notify({ en: 'Schedule source failed (' + why + '). Keeping the last good rules.', zh: '排程來源失敗（' + why + '），保留上次有效嘅規則。' }, 'warn'); };
  if (ext.api) {
    try { if (!/^https:\/\//i.test(ext.api)) throw new Error('needs https'); const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 6000); const r = await fetch(ext.api, { signal: ctl.signal, credentials: 'omit' }); clearTimeout(tm); if (!r.ok) throw new Error('HTTP ' + r.status); const txt = await r.text(); if (txt.length > 20000) throw new Error('too large'); const v = validRules(JSON.parse(txt).rules); if (!v) throw new Error('invalid rules'); ext.apiRules = v; store.set('sched.apirules', v); ext.fails = 0; } catch (e) { failed(e.message || 'error'); }
  }
  if (ext.haUrl && ext.haEntity) {
    const tok = (function () { try { return sessionStorage.getItem('mar.ha.token') || ''; } catch (e) { return ''; } })();
    try { if (!/^https:\/\//i.test(ext.haUrl) || !tok) throw new Error('needs https and a token'); const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 6000); const r = await fetch(ext.haUrl.replace(/\/$/, '') + '/api/states/' + encodeURIComponent(ext.haEntity), { headers: { Authorization: 'Bearer ' + tok }, signal: ctl.signal }); clearTimeout(tm); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); ext.haOn = j.state === 'on'; ext.fails = 0; } catch (e) { failed(e.message || 'error'); }
  }
  evaluate(); emit('sched');
}
define({ id: 'sched', group: 'schedule', type: 'custom', default: [], label: ['Scheduled settings', '定時設定'],
  info: ['Switch comfort settings on and off by time, for example Low stimulation every evening. Times use your device clock (or UTC), weekdays can be picked, and a window may cross midnight. When a window ends, your earlier settings come back. Optional sources: a JSON file at an https address, or a Home Assistant on/off entity. If a source fails, the last good rules stay and you get a notification.', '按時間自動開關舒適設定，例如逢夜晚開低刺激。時間用你裝置時鐘（或 UTC），可以揀星期幾，時段可以跨越午夜。時段完結後，你之前嘅設定會返嚟。可選來源：https 位址嘅 JSON 檔案，或者 Home Assistant 開關實體。如果來源失敗，會保留上次有效嘅規則並通知你。'],
  read: () => rules.length, apply() { }, reset() { rules = []; store.set('sched.rules', rules); evaluate(); emit('sched'); },
  render(wrap) {
    const list = h('ul', { class: 'mf-rules' });
    const draw = () => {
      list.textContent = ''; if (!rules.length) list.append(h('li', { class: 'mf-empty', html: bi('No schedules yet.', '未有定時設定。') }));
      rules.forEach((r) => list.append(h('li', { class: 'mf-rule' + (ruleActive(r, new Date()) ? ' on' : '') },
        h('label', { class: 'mf-flag' }, h('input', { type: 'checkbox', checked: r.enabled, onchange: (e) => { r.enabled = e.target.checked; store.set('sched.rules', rules); evaluate(); draw(); } }), h('b', {}, r.name)),
        h('span', { class: 'mf-hint' }, `${r.start}–${r.end} · ${r.tz === 'utc' ? 'UTC' : pick('local', '本地')} · ${(r.days && r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6]).map((d) => pick(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d], ['日', '一', '二', '三', '四', '五', '六'][d])).join(' ')} · ${(r.acts || []).map((a) => pick(ACTS[a].en, ACTS[a].zh)).join(', ')}`),
        h('button', { type: 'button', class: 'mf-btn text', html: bi('Delete', '刪除'), onclick: () => { rules = rules.filter((x) => x !== r); store.set('sched.rules', rules); evaluate(); draw(); } }))));
    };
    const name = h('input', { type: 'text', class: 'mf-input', placeholder: pick('Name, for example Evening', '名稱，例如：夜晚'), 'aria-label': pick('Schedule name', '定時設定名稱'), maxlength: 30 });
    const start = h('input', { type: 'time', class: 'mf-input', value: '20:00', 'aria-label': pick('Start time', '開始時間') });
    const end = h('input', { type: 'time', class: 'mf-input', value: '07:00', 'aria-label': pick('End time', '結束時間') });
    const tz = h('select', { class: 'mf-input', 'aria-label': pick('Time zone', '時區') }, h('option', { value: 'local' }, pick('Device time', '裝置時間')), h('option', { value: 'utc' }, 'UTC'));
    const days = h('div', { class: 'mf-days', role: 'group', 'aria-label': pick('Days', '星期') }, [1, 2, 3, 4, 5, 6, 0].map((d) => h('label', { class: 'mf-flag' }, h('input', { type: 'checkbox', value: d, checked: true }), pick(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d], ['日', '一', '二', '三', '四', '五', '六'][d]))));
    const acts = h('div', { class: 'mf-days', role: 'group', 'aria-label': pick('What to change', '要改變咩') }, Object.keys(ACTS).map((a) => h('label', { class: 'mf-flag' }, h('input', { type: 'checkbox', value: a, checked: a === 'lowstim' }), pick(ACTS[a].en, ACTS[a].zh))));
    const add = h('button', { type: 'button', class: 'mf-btn filled', html: bi('Add schedule', '加入定時設定'), onclick: () => {
      if (toMin(start.value) === null || toMin(end.value) === null) { notifyMsg(MSG.invalid, 'error'); return; }
      const ch = (box) => Array.prototype.map.call(box.querySelectorAll('input:checked'), (i) => i.value);
      const r = { id: uid(), name: name.value.trim() || pick('Schedule', '定時設定'), start: start.value, end: end.value, tz: tz.value, days: ch(days).map(Number), acts: ch(acts), enabled: true };
      if (!r.acts.length) { notify({ en: 'Pick at least one thing to change.', zh: '請至少揀一樣要改變嘅設定。' }, 'warn'); return; }
      rules.push(r); store.set('sched.rules', rules); name.value = ''; evaluate(); draw(); notifyMsg(MSG.saved, 'ok');
    } });
    const api = h('input', { type: 'url', class: 'mf-input', placeholder: 'https://example.net/schedule.json', value: ext.api, 'aria-label': pick('JSON schedule address (https)', 'JSON 排程位址（https）') });
    const haUrl = h('input', { type: 'url', class: 'mf-input', placeholder: 'https://home.example.net', value: ext.haUrl, 'aria-label': pick('Home Assistant address (https)', 'Home Assistant 位址（https）') });
    const haEnt = h('input', { type: 'text', class: 'mf-input', placeholder: 'input_boolean.quiet_time', value: ext.haEntity, 'aria-label': pick('Home Assistant entity', 'Home Assistant 實體') });
    const haTok = h('input', { type: 'password', class: 'mf-input', placeholder: pick('Access token (this tab only)', '存取憑證（只限呢個分頁）'), autocomplete: 'off', 'aria-label': pick('Home Assistant access token', 'Home Assistant 存取憑證') });
    const status = h('p', { class: 'mf-status', role: 'status' });
    const saveSrc = () => { ext.api = api.value.trim(); ext.haUrl = haUrl.value.trim(); ext.haEntity = haEnt.value.trim(); store.set('sched.api', ext.api); store.set('sched.ha.url', ext.haUrl); store.set('sched.ha.entity', ext.haEntity); try { if (haTok.value) sessionStorage.setItem('mar.ha.token', haTok.value); } catch (e) { /* ignore */ } haTok.value = ''; refreshExternal(true).then(() => { status.innerHTML = ext.fails ? bi('Last refresh failed. Keeping the last good rules.', '上次更新失敗，保留上次有效嘅規則。') : bi('Sources refreshed. ' + ext.apiRules.length + ' rule(s) from the address; Home Assistant is ' + (ext.haOn ? 'on' : 'off') + '.', '來源已更新。位址提供 ' + ext.apiRules.length + ' 條規則；Home Assistant 目前' + (ext.haOn ? '開' : '關') + '。'); }); };
    wrap.append(list, h('div', { class: 'mf-form' }, name, h('div', { class: 'mf-row' }, h('label', {}, pick('From', '由'), ' ', start), h('label', {}, pick('To', '至'), ' ', end), tz), days, acts, add),
      h('details', { class: 'mf-more' }, h('summary', { html: bi('Optional sources', '可選來源') }), h('div', { class: 'mf-form' }, h('p', { class: 'mf-hint', html: bi('The token is kept only in this tab and is never saved. API values never overwrite your own rules; they are applied on top while they are in force.', '憑證只留喺呢個分頁，唔會儲存。外部數值唔會覆蓋你自己嘅規則，只會喺生效期間疊加。') }), api, haUrl, haEnt, haTok, h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Save and refresh sources', '儲存並更新來源'), onclick: saveSrc }), status)));
    draw(); on('sched', draw);
  } });
export function initModes() {
  setTimeout(() => { evaluate(); firstEval = false; }, 300); setInterval(evaluate, 30000);
  setInterval(() => { if (ext.api || (ext.haUrl && ext.haEntity)) refreshExternal(false); }, 300000);
  if (ext.api || (ext.haUrl && ext.haEntity)) setTimeout(() => refreshExternal(false), 1500);
  buildSections(); setChips();
  // The dim sum surprise: 10% chance per visit, once, never on first run, errors or while another dialog is open.
  let seen = false; try { seen = sessionStorage.getItem('mar.dimsum') === '1'; sessionStorage.setItem('mar.dimsum', '1'); } catch (e) { /* ignore */ }
  const firstRun = !store.get('onboarded', false);
  if (!seen && !firstRun && Math.random() < 0.1) setTimeout(() => { if (!$('dialog[open]') && !$('.mf-toast.error')) showDimsum(false); }, 4000);
}
export { notify };
