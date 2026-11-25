/* Toy element locks and the unlock ladder. Just for fun: this is a comfort feature and never real security. */
import { root, h, bi, $, $$, define, get, set, store, pick, on, emit, dialog, uid, setGuard, motionOk } from './core.js';
import { MSG, DISHES } from './strings.js';
import { notify, notifyMsg } from './notify.js';
import { play } from './sound.js';
import { hashSecret, checkSecret, dishSvg } from './modes.js';

/* ---------- TOTP (RFC 6238) ---------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32encode(bytes) { let bits = '', out = ''; bytes.forEach((b) => { bits += b.toString(2).padStart(8, '0'); }); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; }
function b32decode(s) { let bits = ''; s.replace(/=+$/, '').toUpperCase().split('').forEach((c) => { const i = B32.indexOf(c); if (i >= 0) bits += i.toString(2).padStart(5, '0'); }); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return new Uint8Array(out); }
export async function totp(secret, step) {
  const key = await crypto.subtle.importKey('raw', b32decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const buf = new ArrayBuffer(8); const dv = new DataView(buf); dv.setUint32(0, Math.floor(step / 4294967296)); dv.setUint32(4, step >>> 0);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf)); const o = sig[19] & 15;
  const code = ((sig[o] & 127) << 24 | sig[o + 1] << 16 | sig[o + 2] << 8 | sig[o + 3]) % 1000000; return String(code).padStart(6, '0');
}
async function totpOk(secret, code) { const now = Math.floor(Date.now() / 30000); for (const d of [0, -1, 1]) if ((await totp(secret, now + d)) === String(code).trim()) return true; return false; }

/* ---------- lock records ---------- */
const MIXES = [['pin', 'PIN', 'PIN', ['pin']], ['pw', 'Password', '密碼', ['pw']], ['pinpw', 'PIN and password', 'PIN 同密碼', ['pin', 'pw']], ['pwtotp', 'Password and authenticator code', '密碼同驗證碼', ['pw', 'totp']], ['pintotp', 'PIN and authenticator code', 'PIN 同驗證碼', ['pin', 'totp']], ['all', 'PIN, password and authenticator code', 'PIN、密碼同驗證碼', ['pin', 'pw', 'totp']]];
let locks = store.get('locks', []);
let wait = store.get('lockwait', {}); // lockId -> { fails, until }
let ladderLog = store.get('ladderlog', []); // timestamps of waiting periods cleared
const unlocked = new Set((function () { try { return JSON.parse(sessionStorage.getItem('mar.unlocked') || '[]'); } catch (e) { return []; } })());
const saveLocks = () => store.set('locks', locks);
const isLocked = (l) => !unlocked.has(l.id);

function selectorFor(el) {
  if (el.id) return '#' + CSS.escape(el.id); const parts = []; let n = el;
  while (n && n !== document.body && parts.length < 6) { if (n.id) { parts.unshift('#' + CSS.escape(n.id)); break; } const p = n.parentElement; const i = p ? Array.prototype.indexOf.call(p.children, n) + 1 : 1; parts.unshift(n.tagName.toLowerCase() + ':nth-child(' + i + ')'); n = p; }
  return parts.join(' > ');
}
function labelFor(el) { return (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 50) || el.tagName.toLowerCase(); }

let overlays = new Map();
export function applyLocks() {
  overlays.forEach((o) => o.remove()); overlays = new Map(); $$('.mf-locked').forEach((e) => { e.inert = false; e.classList.remove('mf-locked'); e.removeAttribute('aria-disabled'); });
  locks.forEach((l) => {
    if (!isLocked(l)) return; let el = null; try { el = document.querySelector(l.sel); } catch (e) { /* bad selector */ } if (!el) return;
    el.inert = true; el.classList.add('mf-locked'); el.setAttribute('aria-disabled', 'true');
    const btn = h('button', { type: 'button', class: 'mf-lockbtn', 'aria-label': pick(`Locked: ${l.label}. Open the unlock prompt.`, `已鎖：${l.label}。開啟解鎖視窗。`), onclick: () => openUnlock(l) }, h('span', { 'aria-hidden': 'true' }, '🔒'));
    document.body.append(btn); overlays.set(l.id, btn); btn._el = el;
  });
  place();
}
function place() { overlays.forEach((b) => { const r = b._el.getBoundingClientRect(); Object.assign(b.style, { left: r.left + window.scrollX + 'px', top: r.top + window.scrollY + 'px', width: Math.max(r.width, 28) + 'px', height: Math.max(r.height, 28) + 'px' }); b.hidden = r.width === 0 && r.height === 0; }); }
let placeT = 0; const placeSoon = () => { cancelAnimationFrame(placeT); placeT = requestAnimationFrame(place); };
window.addEventListener('resize', placeSoon); window.addEventListener('scroll', placeSoon, { passive: true });

/* A locked setting cannot be changed by the palette, a shortcut or a script either. */
export function settingLockedBy(id) { return locks.find((l) => isLocked(l) && l.sel.indexOf('data-setting="' + id + '"') >= 0) || null; }
setGuard((id) => { const l = settingLockedBy(id); if (l) { notify({ en: `"${l.label}" is locked. Unlock it first.`, zh: `「${l.label}」已鎖，請先解鎖。` }, 'warn'); play('invalid'); return false; } return true; });

/* ---------- wizard ---------- */
export function lockWizard(el) {
  if (!el) return; const sel = selectorFor(el); const label = labelFor(el); let mix = 'pin'; let step = 0; const cred = { pin: '', pw: '', secret: b32encode(crypto.getRandomValues(new Uint8Array(10))), code: '' };
  const body = h('div', { class: 'mf-wiz' }); let d;
  const needs = () => MIXES.find((m) => m[0] === mix)[3];
  function draw() {
    body.textContent = '';
    body.append(h('p', { class: 'mf-hint', html: bi('Toy lock, just for fun. It is not security. If you forget it, clear this site’s data in your browser.', '玩具鎖，只係好玩，唔係保安功能。如果你唔記得，喺瀏覽器清除呢個網站嘅資料就得。') }));
    if (step === 0) {
      body.append(h('p', {}, h('b', {}, pick('Element: ', '元素：')), label, h('br'), h('code', {}, sel)), h('fieldset', { class: 'mf-fs' }, h('legend', { html: bi('Choose the credentials', '揀選憑證') }), MIXES.map(([id, en, zh]) => h('label', { class: 'mf-flag' }, h('input', { type: 'radio', name: 'mf-mix', value: id, checked: id === mix, onchange: () => { mix = id; } }), pick(en, zh)))));
    } else {
      const n = needs();
      if (n.indexOf('pin') >= 0) body.append(h('label', { class: 'mf-lab', html: bi('PIN (4 to 12 digits)', 'PIN（4 至 12 位數字）') }), h('input', { type: 'password', class: 'mf-input', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', value: cred.pin, 'data-k': 'pin', 'aria-label': 'PIN' }));
      if (n.indexOf('pw') >= 0) body.append(h('label', { class: 'mf-lab', html: bi('Password (8 or more characters)', '密碼（8 個字元或以上）') }), h('input', { type: 'password', class: 'mf-input', autocomplete: 'new-password', value: cred.pw, 'data-k': 'pw', 'aria-label': pick('Password', '密碼') }));
      if (n.indexOf('totp') >= 0) body.append(h('p', { class: 'mf-lab', html: bi('Add this secret to your authenticator app, then type the 6 digit code it shows.', '將呢個密鑰加入你嘅驗證器 App，再輸入佢顯示嘅 6 位數字。') }), h('code', { class: 'mf-secret' }, cred.secret), h('p', { class: 'mf-hint' }, 'otpauth://totp/Docs%20lock?secret=' + cred.secret + '&issuer=Material%20Asus%20Router'), h('input', { type: 'text', class: 'mf-input', inputmode: 'numeric', maxlength: 6, autocomplete: 'off', value: cred.code, 'data-k': 'code', 'aria-label': pick('Authenticator code', '驗證碼') }));
      body.querySelectorAll('input[data-k]').forEach((i) => i.addEventListener('input', () => { cred[i.dataset.k] = i.value; }));
    }
    nav();
  }
  const err = h('p', { class: 'mf-status bad', role: 'alert', hidden: true });
  function nav() {
    d.querySelector('.mf-dfoot').textContent = '';
    d.querySelector('.mf-dfoot').append(h('button', { type: 'button', class: 'mf-btn text', html: bi('Cancel', '取消'), onclick: () => d.close() }), step > 0 ? h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Back', '返回'), onclick: () => { step = 0; err.hidden = true; draw(); } }) : '', h('button', { type: 'button', class: 'mf-btn filled', html: step === 0 ? bi('Next', '下一步') : bi('Lock it', '鎖上'), onclick: finish }));
  }
  async function finish() {
    if (step === 0) { const r = body.querySelector('input[name="mf-mix"]:checked'); if (r) mix = r.value; step = 1; draw(); return; }
    const n = needs(); const fail = (en, zh) => { err.innerHTML = bi(en, zh); err.hidden = false; play('invalid'); };
    if (n.indexOf('pin') >= 0 && !/^\d{4,12}$/.test(cred.pin)) return fail('The PIN needs 4 to 12 digits.', 'PIN 要 4 至 12 位數字。');
    if (n.indexOf('pw') >= 0 && cred.pw.length < 8) return fail('The password needs at least 8 characters.', '密碼最少要 8 個字元。');
    if (n.indexOf('totp') >= 0 && !(await totpOk(cred.secret, cred.code))) return fail('That code did not match. Check the app and try again.', '驗證碼唔啱，請檢查個 App 再試。');
    const rec = { id: uid(), sel, label, mix, created: Date.now() };
    if (n.indexOf('pin') >= 0) rec.pin = await hashSecret(cred.pin); if (n.indexOf('pw') >= 0) rec.pw = await hashSecret(cred.pw); if (n.indexOf('totp') >= 0) rec.totp = cred.secret;
    locks.push(rec); saveLocks(); unlocked.delete(rec.id); persistUnlocked(); applyLocks(); play('lock'); notifyMsg(MSG.locked, 'ok'); emit('locks'); d.close();
  }
  d = dialog({ id: 'mf-wizard', titleEn: 'Lock this element', titleZh: '鎖住呢個元素', body: h('div', {}, body, err), actions: [{ en: 'x', zh: 'x' }] }); draw();
}
const persistUnlocked = () => { try { sessionStorage.setItem('mar.unlocked', JSON.stringify(Array.from(unlocked))); } catch (e) { /* ignore */ } };

/* ---------- unlock prompt ---------- */
const MAX_FAILS = 5, WAIT_MS = 10 * 60 * 1000;
export function openUnlock(l) {
  const w = () => wait[l.id] || { fails: 0, until: 0 }; const n = MIXES.find((m) => m[0] === l.mix)[3];
  const fields = {}; const msg = h('p', { class: 'mf-status', role: 'status', 'aria-live': 'polite' });
  const body = h('div', {}, h('p', { class: 'mf-hint', html: bi('Toy lock, just for fun. If you forget it, clear this site’s data in your browser to remove it.', '玩具鎖，只係好玩。如果你唔記得，喺瀏覽器清除呢個網站嘅資料就可以移除。') }),
    n.map((k) => { const i = h('input', { type: k === 'totp' ? 'text' : 'password', class: 'mf-input', autocomplete: 'off', inputmode: k === 'pw' ? 'text' : 'numeric', 'aria-label': { pin: 'PIN', pw: pick('Password', '密碼'), totp: pick('Authenticator code', '驗證碼') }[k] }); fields[k] = i; return h('label', { class: 'mf-lab' }, h('span', { html: bi({ pin: 'PIN', pw: 'Password', totp: 'Authenticator code' }[k], { pin: 'PIN', pw: '密碼', totp: '驗證碼' }[k]) }), i); }), msg);
  let tick = null;
  const ladderBtn = h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Waiting? Try the unlock ladder', '等緊？試吓解鎖階梯'), hidden: true, onclick: () => { runLadder(l).then((ok) => { if (ok) { wait[l.id] = { fails: 0, until: 0 }; store.set('lockwait', wait); ladderLog.push(Date.now()); store.set('ladderlog', ladderLog.slice(-20)); check(); } }); } });
  const check = () => { const ww = w(); const left = ww.until - Date.now(); if (left > 0) { msg.className = 'mf-status bad'; msg.innerHTML = bi(`Too many wrong tries. Wait ${Math.ceil(left / 60000)} min, or clear the wait with the unlock ladder. The ladder never reveals or removes the credential.`, `錯咗太多次，請等 ${Math.ceil(left / 60000)} 分鐘，或者用解鎖階梯清除等待。階梯唔會洩漏或移除憑證。`); ladderBtn.hidden = false; } else { msg.className = 'mf-status'; msg.textContent = ''; ladderBtn.hidden = true; } };
  let d; const submit = async () => {
    const ww = w(); if (ww.until > Date.now()) { check(); return; }
    let ok = true; if (n.indexOf('pin') >= 0 && !(await checkSecret(fields.pin.value, l.pin))) ok = false; if (n.indexOf('pw') >= 0 && !(await checkSecret(fields.pw.value, l.pw))) ok = false; if (n.indexOf('totp') >= 0 && !(await totpOk(l.totp, fields.totp.value))) ok = false;
    if (ok) { wait[l.id] = { fails: 0, until: 0 }; store.set('lockwait', wait); unlocked.add(l.id); persistUnlocked(); applyLocks(); play('unlock'); notifyMsg(MSG.unlocked, 'ok'); emit('locks'); d.close(); return; }
    const f = ww.fails + 1; wait[l.id] = { fails: f >= MAX_FAILS ? 0 : f, until: f >= MAX_FAILS ? Date.now() + WAIT_MS : 0 }; store.set('lockwait', wait); play('invalid');
    if (f >= MAX_FAILS) check(); else { msg.className = 'mf-status bad'; msg.innerHTML = say2(MSG.wrongCode, { left: MAX_FAILS - f }); }
  };
  d = dialog({ id: 'mf-unlock', titleEn: 'Unlock: ' + l.label, titleZh: '解鎖：' + l.label, body, actions: [{ en: 'Cancel', zh: '取消', kind: 'text' }] });
  d.querySelector('.mf-dfoot').append(ladderBtn, h('button', { type: 'button', class: 'mf-btn filled', html: bi('Unlock', '解鎖'), onclick: submit }));
  body.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }); check(); tick = setInterval(check, 15000); d.addEventListener('close', () => clearInterval(tick));
  return d;
}
import { sayHtml } from './core.js';
const say2 = (m, v) => sayHtml(m, v);

/* ---------- the unlock ladder: dim sum, ten sums, whack-a-mole, the clock ---------- */
function runLadder(l) {
  return new Promise((resolve) => {
    const hourAgo = Date.now() - 3600000; const recent = ladderLog.filter((t) => t > hourAgo);
    if (recent.length >= 3) { notify({ en: 'The ladder can clear the wait 3 times an hour. Try again later.', zh: '階梯每小時最多清除等待 3 次，請稍後再試。' }, 'warn'); resolve(false); return; }
    const nonce = uid() + uid(); const startedAt = Date.now(); let used = false;
    const rungs = [rungDimsum, rungSums, rungMole, rungClock]; if (root.hasAttribute('data-mf-school')) rungs.shift();
    let i = 0; const body = h('div', { class: 'mf-ladder' }); const head = h('p', { class: 'mf-hint' });
    const d = dialog({ id: 'mf-ladder', titleEn: 'The unlock ladder', titleZh: '解鎖階梯', body: h('div', {}, head, body, h('p', { class: 'mf-hint', html: bi('Clearing the wait never reveals or removes the credential. Grading happens in this browser because a static site has no server.', '清除等待唔會洩漏或移除憑證。呢個網站冇伺服器，所以喺瀏覽器內評分。') })), actions: [{ en: 'Give up', zh: '放棄', kind: 'text', onClick: () => resolve(false) }], onClose: () => resolve(false) });
    const next = () => { if (i >= rungs.length) { if (used || Date.now() - startedAt < 4000) { notifyMsg(MSG.invalid, 'error'); resolve(false); d.close(); return; } used = true; play('tada'); notify({ en: 'Ladder complete. The wait is cleared. You still need the credential.', zh: '階梯完成，等待已清除，但你仍然需要憑證。' }, 'ok'); resolve(true); d.close(); return; } head.innerHTML = bi(`Rung ${i + 1} of ${rungs.length}`, `第 ${i + 1} 級，共 ${rungs.length} 級`); body.textContent = ''; rungs[i](body, () => { i++; play('success'); next(); }); };
    d.addEventListener('close', () => { /* resolved above */ }); next();
  });
}
function rungDimsum(box, done) {
  const dish = DISHES[Math.floor(Math.random() * DISHES.length)]; const opts = DISHES.slice().sort(() => Math.random() - 0.5).filter((x) => x.id !== dish.id).slice(0, 3).concat(dish).sort(() => Math.random() - 0.5);
  box.append(h('p', { html: bi('Which dim sum is this?', '呢款係邊款點心？') }), h('div', { class: 'mf-dsart big', html: dishSvg(dish.id) }), h('div', { class: 'mf-col' }, opts.map((o) => h('button', { type: 'button', class: 'mf-btn tonal', html: bi(o.en, o.zh), onclick: () => { if (o.id === dish.id) done(); else { play('invalid'); box.querySelector('p').innerHTML = bi('Not that one. Look again.', '唔係呢款，再睇清楚啲。'); } } }))));
}
function rungSums(box, done) {
  const qs = Array.from({ length: 10 }, () => { const a = 2 + Math.floor(Math.random() * 18), b = 2 + Math.floor(Math.random() * 18); return { a, b, ans: a + b }; }); let k = 0;
  const q = h('p', { class: 'mf-bigq' }), inp = h('input', { type: 'text', inputmode: 'numeric', class: 'mf-input', 'aria-label': pick('Answer', '答案') }), fb = h('p', { class: 'mf-status', role: 'status' });
  const show = () => { q.textContent = `${k + 1}/10:  ${qs[k].a} + ${qs[k].b} = ?`; inp.value = ''; inp.focus(); };
  const go = () => { if (Number(inp.value) === qs[k].ans) { k++; fb.textContent = ''; if (k === 10) { done(); return; } show(); } else { fb.className = 'mf-status bad'; fb.textContent = pick('Not quite. Try this one again.', '唔啱，再試呢題。'); play('invalid'); } };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); box.append(q, inp, h('button', { type: 'button', class: 'mf-btn filled', html: bi('Check', '檢查'), onclick: go }), fb); show();
}
function rungMole(box, done) {
  let hits = 0, active = -1, left = 25; const need = 8; const info = h('p', { class: 'mf-status', role: 'status' }); const cells = Array.from({ length: 9 }, (_, n) => h('button', { type: 'button', class: 'mf-cell', 'aria-label': pick('Hole ' + (n + 1), '洞 ' + (n + 1)), onclick: () => { if (n === active) { hits++; active = -1; sync(); play('click'); if (hits >= need) { clearInterval(t1); clearInterval(t2); done(); } } } }));
  const grid = h('div', { class: 'mf-grid' }, cells); const sync = () => { cells.forEach((c, n) => { c.textContent = n === active ? '🐹' : ''; c.setAttribute('aria-pressed', String(n === active)); }); info.textContent = pick(`Hit ${hits} of ${need}. ${left} seconds left.`, `打中 ${hits} / ${need}，仲有 ${left} 秒。`); };
  const t1 = setInterval(() => { active = Math.floor(Math.random() * 9); sync(); }, motionOk() ? 800 : 1400);
  const t2 = setInterval(() => { left--; if (left <= 0) { clearInterval(t1); clearInterval(t2); box.textContent = ''; box.append(h('p', { html: bi('Time is up. Try the rung again.', '時間到，再試呢一級。') }), h('button', { type: 'button', class: 'mf-btn filled', html: bi('Again', '再嚟'), onclick: () => { box.textContent = ''; rungMole(box, done); } })); } else sync(); }, 1000);
  box.append(h('p', { html: bi('Whack the hamster when it appears. Use the mouse, touch, or Tab and Enter.', '倉鼠出現就撳佢。可用滑鼠、觸控，或者 Tab 同 Enter。') }), grid, info); sync();
  new MutationObserver((m, o) => { if (!document.body.contains(grid)) { clearInterval(t1); clearInterval(t2); o.disconnect(); } }).observe(document.body, { childList: true, subtree: true });
}
function rungClock(box, done) {
  const hh = Math.floor(Math.random() * 12), mm = [0, 15, 30, 45][Math.floor(Math.random() * 4)]; const fmt = (a, b) => `${a === 0 ? 12 : a}:${String(b).padStart(2, '0')}`; const right = fmt(hh, mm);
  const opts = new Set([right]); while (opts.size < 4) opts.add(fmt(Math.floor(Math.random() * 12), [0, 15, 30, 45][Math.floor(Math.random() * 4)]));
  const ha = (hh % 12 + mm / 60) * 30, ma = mm * 6; const tick = Array.from({ length: 12 }, (_, i) => `<line x1="50" y1="8" x2="50" y2="${i % 3 === 0 ? 15 : 12}" transform="rotate(${i * 30} 50 50)" stroke="currentColor" stroke-width="2"/>`).join('');
  box.append(h('p', { html: bi('What time does the clock show?', '個鐘顯示幾點？') }), h('span', { class: 'mf-clock', role: 'img', 'aria-label': pick('An analogue clock', '一個指針鐘'), html: `<svg viewBox="0 0 100 100" width="160" height="160"><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="3"/>${tick}<line x1="50" y1="50" x2="50" y2="26" transform="rotate(${ha} 50 50)" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><line x1="50" y1="50" x2="50" y2="14" transform="rotate(${ma} 50 50)" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="50" cy="50" r="3" fill="currentColor"/></svg>` }),
    h('div', { class: 'mf-col' }, Array.from(opts).sort(() => Math.random() - 0.5).map((o) => h('button', { type: 'button', class: 'mf-btn tonal', onclick: () => { if (o === right) done(); else { play('invalid'); box.querySelector('p').innerHTML = bi('Not that time. Look again.', '唔係呢個時間，再睇清楚啲。'); } } }, o))));
}

define({ id: 'locks', group: 'safety', type: 'custom', default: [], label: ['Toy element locks', '玩具元素鎖'],
  info: ['Lock almost any button, panel or setting with a PIN, a password, or an authenticator code, in six combinations. A locked element is disabled and only offers its own unlock prompt: the palette, shortcuts and settings cannot bypass it. It is a toy lock just for fun, not security. If you forget a credential, clearing this site’s data removes the lock. Too many wrong tries start a waiting period, which the unlock ladder (dim sum, ten sums, whack-a-mole, the clock) can clear, up to 3 times an hour.', '用 PIN、密碼或者驗證碼，以六種組合鎖住差唔多任何掣、面板或者設定。被鎖嘅元素會停用，只會顯示自己嘅解鎖視窗：命令面板、快速鍵同設定都繞唔過。呢個只係玩具鎖，好玩而已，唔係保安功能。如果你唔記得憑證，清除呢個網站嘅資料就可以移除鎖。錯太多次會有等待時間，解鎖階梯（點心、十條數、打地鼠、時鐘）可以清除，每小時最多 3 次。'],
  read: () => locks.length, apply() { }, reset() { locks = []; saveLocks(); wait = {}; store.del('lockwait'); unlocked.clear(); persistUnlocked(); applyLocks(); emit('locks'); },
  render(wrap) {
    const list = h('ul', { class: 'mf-rules' });
    const draw = () => { list.textContent = ''; if (!locks.length) list.append(h('li', { class: 'mf-empty', html: bi('Nothing is locked.', '冇鎖住任何嘢。') })); locks.forEach((l) => list.append(h('li', { class: 'mf-rule' }, h('b', {}, l.label), h('span', { class: 'mf-hint' }, pick(MIXES.find((m) => m[0] === l.mix)[1], MIXES.find((m) => m[0] === l.mix)[2]) + ' · ' + (isLocked(l) ? pick('locked', '已鎖') : pick('unlocked for this visit', '今次到訪已解鎖'))),
      isLocked(l) ? h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Unlock', '解鎖'), onclick: () => openUnlock(l) }) : h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Lock again', '再鎖上'), onclick: () => { unlocked.delete(l.id); persistUnlocked(); applyLocks(); draw(); play('lock'); } }),
      h('button', { type: 'button', class: 'mf-btn text', html: bi('Remove', '移除'), onclick: () => { if (isLocked(l)) { openUnlock(l); return; } locks = locks.filter((x) => x !== l); saveLocks(); applyLocks(); draw(); } })))); };
    const pickBtn = h('button', { type: 'button', class: 'mf-btn filled', html: bi('Pick an element to lock', '揀要鎖嘅元素'), onclick: () => pickElement() });
    wrap.append(list, pickBtn, h('p', { class: 'mf-hint', html: bi('You can also right-click any element and choose Lock this element, or press Shift+F10 on it.', '你亦可以喺任何元素按右鍵揀「鎖住呢個元素」，或者聚焦後按 Shift+F10。') }));
    draw(); on('locks', draw);
  } });
export function pickElement() {
  const veil = h('div', { class: 'mf-picking', role: 'status' }, pick('Click the element to lock. Press Escape to cancel.', '點擊要鎖嘅元素，按 Esc 取消。')); document.body.append(veil); let last = null;
  const over = (e) => { if (last) last.classList.remove('mf-pickhl'); last = e.target.closest('.mf-picking') ? null : e.target; if (last) last.classList.add('mf-pickhl'); };
  const end = () => { document.removeEventListener('mouseover', over, true); document.removeEventListener('click', click, true); document.removeEventListener('keydown', key, true); veil.remove(); if (last) last.classList.remove('mf-pickhl'); };
  const click = (e) => { e.preventDefault(); e.stopPropagation(); const t = last; end(); if (t && !t.closest('dialog')) lockWizard(t); }; const key = (e) => { if (e.key === 'Escape') end(); };
  document.addEventListener('mouseover', over, true); document.addEventListener('click', click, true); document.addEventListener('keydown', key, true);
  $$('dialog[open]').forEach((d) => d.close());
}
export function initLocks() { applyLocks(); try { new MutationObserver((() => { let t; return () => { clearTimeout(t); t = setTimeout(() => { const need = locks.some((l) => isLocked(l) && !overlays.has(l.id) && document.querySelector(l.sel)); if (need) applyLocks(); else place(); }, 300); }; })()).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* ignore */ } }
