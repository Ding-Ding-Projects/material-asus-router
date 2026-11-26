// Boards: kick and ban, the public Unkick page, Lock IP with the changes
// panel, saved routers and connection keys, the start-up cards, and the
// router's own page for the add-on. All six are drawn at phone width, because
// that is where these screens are hardest to get right; the styles are in
// theme3.mjs and every one of them also reads at 360 px.
import { ic } from './kit.mjs';
import { IC } from './icons.mjs';
import { S } from './boards1.mjs';

// A phone-width board. bare: a page outside the signed-in app.
const N = (file, name2, page, bn, o) => S(file, name2, page, '', '', Object.assign({ kind: 'phone', bn, pend: 0 }, o));
// A device avatar whose icon comes from a list item (v is the item name).
const dvIcon = (v, tone = '') => `<span class="av${tone ? ' ' + tone : ''}"><svg class="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{${v}.d}}"/></svg></span>`;
const when = (v, body, shown = false) => `<sc-if value="{{${v}}}" hint-placeholder-val="{{ ${shown} }}">${body}</sc-if>`;
const each = (list, as, n, body) => `<sc-for list="{{${list}}}" as="${as}" hint-placeholder-count="${n}">${body}</sc-for>`;

// ---- kick and ban ----
// devs: [name, icon path, address, owner, note]; held: two characters for each
// device, method then duration, or "--" when the device is not paused.
const KICK = {
  devs: [['Living-TV', IC.tv, '198.51.100.40', 'Everyone|全屋', ''], ['Game-Console', IC.game, '198.51.100.60', 'Your brother|阿哥', ''], ['Alex-Tablet', IC.phone, '198.51.100.52', 'Alex', 'Homework first|做完功課先'], ['kitchen-speaker', IC.speaker, '198.51.100.103', 'Everyone|全屋', ''], ['Pixel-9', IC.phone, '198.51.100.83', 'Pat', '']],
  held: '01--15----',
  meth: [
    ['Pause internet|暫停上網', 'The device stays on Wi-Fi and can still reach the printer and the TV. Only the internet stops.|部裝置仲連住 Wi-Fi，照樣用到打印機同電視，淨係上唔到網。'],
    ['Block name lookups|封鎖網址查詢', 'Sites stop opening because their names cannot be looked up. Apps that are already connected may carry on for a while.|查唔到網址，所以開唔到網站。已經連緊線嘅應用程式可能仲用得一陣。'],
    ['Disconnect from Wi-Fi once|斷開 Wi-Fi 一次', 'Drops the device from Wi-Fi one time. It can join again straight away, so this is a nudge, not a pause.|將部裝置踢出 Wi-Fi 一次。佢即刻可以連返，所以只係提一提，唔算暫停。']
  ],
  dur: [[15, '15 min|15 分鐘'], [30, '30 min|30 分鐘'], [60, '1 h|1 個鐘'], [120, '2 h|2 個鐘'], [240, '4 h|4 個鐘'], [0, 'Until lifted (ban)|直到解除（封鎖）']],
  log: [['19:19', 'Living-TV', 'kicked|踢走', 'Pause internet, 30 min, by Pat|暫停上網，30 分鐘，由 Pat'], ['18:02', 'Alex-Tablet', 'banned|封鎖', 'Block name lookups, by Pat|封鎖網址查詢，由 Pat'], ['17:40', 'Pixel-9', 'unkicked|解除暫停', 'Lifted from the Unkick page on that device|喺嗰部裝置嘅解除暫停頁解除'], ['16:15', 'Game-Console', 'disconnected from Wi-Fi|斷開 Wi-Fi', 'Once, by Pat|一次，由 Pat']]
};
function kickLogic(h) {
  const { T, V, set, canWrite, D } = h; const sp = (s) => { const q = String(s).split('|'); return T(q[0], q[1] === undefined ? q[0] : q[1]); };
  const X = D.x, held = V._h || X.held, open = V._ks ?? 3, m = V._km ?? 0, du = V._kd ?? 1;
  const code = (i) => held.slice(i * 2, i * 2 + 2);
  const put = (i, c) => held.slice(0, i * 2) + c + held.slice(i * 2 + 2);
  const until = (k) => { const mins = X.dur[k][0]; if (!mins) return T('until lifted', '直到解除'); const end = 19 * 60 + 19 + mins; const hm = String(Math.floor(end / 60)).padStart(2, '0') + ':' + String(end % 60).padStart(2, '0'); return T('until ' + hm + ', ' + (mins < 60 ? mins + ' min' : mins / 60 + ' h') + ' left', '直到 ' + hm + '，仲有 ' + (mins < 60 ? mins + ' 分鐘' : mins / 60 + ' 個鐘')); };
  const by = T('by Pat', '由 Pat');
  const devs = X.devs.map((d, i) => { const c = code(i), free = c === '--'; return { name: d[0], d: d[1], ip: d[2], owner: T('belongs to', '屬於') + ' ' + sp(d[3]), free, held: !free, state: free ? '' : c[1] === '5' ? T('Banned', '封鎖') : T('Paused', '暫停緊'), style: '--j:' + i, kick: () => set({ _ks: i, _km: 0, _kd: 1 }) }; });
  const paused = [];
  X.devs.forEach((d, i) => { const c = code(i); if (c === '--') return; const ban = c[1] === '5'; paused.push({ name: d[0], d: d[1], kind: ban ? T('Banned', '封鎖') : T('Kicked', '踢走'), tagCls: ban ? 'tag bad' : 'tag warn', line: sp(X.meth[Number(c[0])][0]) + ' · ' + until(Number(c[1])) + ' · ' + by, note: sp(d[4]), liftLabel: ban ? T('Unban', '解除封鎖') : T('Unkick', '解除暫停'), style: '--j:' + paused.length, lift: () => { if (canWrite) set({ _h: put(i, '--'), _msg: (ban ? 'B' : 'K') + i }); } }); });
  const o = open < 0 ? 0 : open, cd = X.devs[o], isBan = m !== 2 && du === 5;
  const mk = V._msg || '', mn = mk ? X.devs[Number(mk.slice(1))][0] : '';
  const MSG = { k: T('Kicked.', '已踢走。'), b: T('Banned until lifted.', '已封鎖，直到解除。'), D: T('Disconnected from Wi-Fi once.', '已斷開 Wi-Fi 一次。'), K: T('Unkicked.', '已解除暫停。'), B: T('Unbanned.', '已解除封鎖。') };
  const VERB = { k: T('kicked', '踢走'), b: T('banned', '封鎖'), D: T('disconnected from Wi-Fi', '斷開 Wi-Fi'), K: T('unkicked', '解除暫停'), B: T('unbanned', '解除封鎖') };
  const log = X.log.map(r => ({ t: r[0], a: r[1] + ' ' + sp(r[2]), b: sp(r[3]) }));
  if (mk) log.unshift({ t: '19:19', a: mn + ' ' + VERB[mk[0]], b: by });
  log.forEach((r, j) => { r.style = '--j:' + j; });
  const copied = !!V._cp;
  return { devs, paused, none: paused.length === 0, log, sheet: open >= 0,
    cur: { name: cd[0], d: cd[1], sub: cd[2] + ' · ' + T('belongs to', '屬於') + ' ' + sp(cd[3]), bro: o === 1, level1: o !== 1 },
    meth: X.meth.map((q, i) => ({ label: sp(q[0]), why: sp(q[1]), pressed: m === i ? 'true' : 'false', pick: () => set({ _km: i }) })),
    durs: X.dur.map((q, i) => ({ label: sp(q[1]), pressed: du === i ? 'true' : 'false', pick: () => set({ _kd: i }) })),
    showDur: m !== 2, isBan, actLabel: m === 2 ? T('Disconnect', '斷開') : isBan ? T('Ban', '封鎖') : T('Kick', '踢走'), actCls: 'btn w ' + (m === 2 ? 'ton' : isBan ? 'dng' : 'fill'),
    act: () => { if (!canWrite) return; if (m === 2) set({ _ks: -1, _kv: 2, _msg: 'D' + o }); else set({ _h: put(o, String(m) + du), _ks: -1, _kv: 0, _msg: (isBan ? 'b' : 'k') + o }); },
    close: () => set({ _ks: -1 }), hasMsg: !!mk, msg: mk ? mn + ': ' + MSG[mk[0]] : '',
    copy: () => set({ _cp: !copied }), copyLabel: copied ? T('Copied', '已複製') : T('Copy the link', '複製連結') };
}

// ---- the public Unkick page ----
function unkickLogic(h) {
  const { T, V, set } = h; const s = V._us ?? 0;
  const title = [T('Your internet is paused', '你嘅網絡被暫停咗'), T('Your internet is paused', '你嘅網絡被暫停咗'), T('This device is not paused', '呢部裝置冇被暫停'), T('This device is not paused', '呢部裝置冇被暫停'), T('Unkicked. You are back online.', '已解除，你可以再上網。')][s];
  const lede = [T('Someone paused this device to share the connection. You can lift it yourself; it is recorded that you did.', '有人為咗分享網絡而暫停咗呢部裝置。你可以自己解除，系統會記低係你解除。'), T('Someone paused this device to share the connection. You can lift it yourself; it is recorded that you did.', '有人為咗分享網絡而暫停咗呢部裝置。你可以自己解除，系統會記低係你解除。'), T('Nothing here is paused for the address you are using.', '你而家用緊嘅位址冇被暫停。'), T('The router does not know this device yet. If the internet is not working, ask the person who runs the router.', '路由器未認得呢部裝置。如果上唔到網，問下管路由器嗰個人。'), T('It can take a few seconds for pages to load again.', '網頁可能要等幾秒先載得返。')][s];
  return { title, lede, hold: s < 2, clear: s === 2 || s === 3, lifted: s === 4, icCls: 'ukic dr' + (s === 4 ? ' ok' : s >= 2 ? ' off' : ''),
    head: s === 1 ? T('Banned: Block name lookups', '封鎖：封鎖網址查詢') : T('Kicked: Pause internet', '踢走：暫停上網'),
    info: (s === 1 ? T('until someone lifts it', '直到有人解除') : T('until 19:49 (30 min left)', '直到 19:49（仲有 30 分鐘）')) + T(', by Pat', '，由 Pat'), note: T('Homework first', '做完功課先'),
    btn: s === 1 ? T('Unban me', '解除我嘅封鎖') : T('Unkick me', '解除我嘅暫停'), lift: () => set({ _us: 4 }), again: () => set({ _us: s === 4 ? 2 : 0 }) };
}

// ---- Lock IP ----
// devs: [name, icon path, address]; base: which addresses are locked already.
const LOCK = { devs: [['Pat-Laptop', IC.laptop, '198.51.100.21'], ['Living-TV', IC.tv, '198.51.100.40'], ['kitchen-speaker', IC.speaker, '198.51.100.103'], ['Game-Console', IC.game, '198.51.100.60']], base: '1001' };
function lockLogic(h) {
  const { T, V, set, canWrite, D } = h; const X = D.x;
  const base = V._base || X.base, lk = V._lk || '1011', sel = V._sel || '0110', ed = V._ed ?? -1, alt = V._alt ?? -1, altn = V._altn ?? 103;
  const flip = (s, i, v) => s.slice(0, i) + v + s.slice(i + 1);
  const ipOf = (i) => alt === i ? '198.51.100.' + altn : X.devs[i][2];
  const moved = (i) => alt === i && lk[i] === '1' && !(V._alt0 === i && V._altn0 === altn);
  const pend = []; X.devs.forEach((d, i) => { if (lk[i] !== base[i] || moved(i)) pend.push(i); });
  const fresh = { _k1: false, _k2: '', _k3: false, _k4: false, _tn: 1, _done: false };
  const rows = X.devs.map((d, i) => { const on = lk[i] === '1', sl = sel[i] === '1'; return { name: d[0], d: d[1], ip: ipOf(i), locked: on, btnLabel: on ? T('Unlock IP', '解除鎖定 IP') : T('Lock IP', '鎖定 IP'), btnCls: 'btn sm w ' + (on ? 'out' : 'fill'), style: '--j:' + i,
    sel: sl ? 'true' : 'false', selLabel: T('Select ', '揀選 ') + d[0], pick: () => set({ _sel: flip(sel, i, sl ? '0' : '1') }),
    toggle: () => { if (canWrite) set(Object.assign({ _lk: flip(lk, i, on ? '0' : '1'), _alt: alt === i ? -1 : alt }, fresh)); },
    ed: ed === i, edPressed: ed === i ? 'true' : 'false', edit: () => set({ _ed: ed === i ? -1 : i }),
    useAlt: () => { if (canWrite) set(Object.assign({ _lk: flip(lk, i, '1'), _alt: i, _altn: V._lip ?? 103, _ed: -1 }, fresh)); } }; });
  const selN = sel.split('').filter(c => c === '1').length;
  const all = (v) => () => { if (canWrite) set(Object.assign({ _lk: lk.split('').map((c, i) => sel[i] === '1' ? v : c).join(''), _sel: '0000' }, fresh)); };
  const target = pend.length ? X.devs[pend[0]][0] : '';
  const k1 = !!V._k1, typed = V._k2 || '', k2 = !!target && typed.trim() === target, k3 = !!V._k3, k4 = !!V._k4, tn = V._tn ?? 1;
  const count = [k1, k2, k3, k4].filter(Boolean).length, ready = count === 4 && pend.length > 0;
  const kc = (on) => 'key9' + (on ? ' on' : '');
  return { rows, hasSel: selN > 0, selTxt: selN + ' ' + T('selected', '部已揀'), lockSel: all('1'), unlockSel: all('0'), clearSel: () => set({ _sel: '0000' }),
    chg: pend.map((i, j) => ({ text: (lk[i] === '1' ? T('Lock IP', '鎖定 IP') : T('Unlock IP', '解除鎖定 IP')) + ' ' + ipOf(i) + ' → ' + X.devs[i][0], style: '--j:' + j, drop: () => set(Object.assign({ _lk: flip(lk, i, base[i]), _alt: alt === i ? -1 : alt }, fresh)) })),
    dockN: pend.length + ' ' + (pend.length === 1 ? T('change waiting. Nothing has reached the router yet.', '項改動等緊。暫時乜都未寫入路由器。') : T('changes waiting. Nothing has reached the router yet.', '項改動等緊。暫時乜都未寫入路由器。')), dockTxt: pend.length ? (lk[pend[0]] === '1' ? T('Lock IP', '鎖定 IP') : T('Unlock IP', '解除鎖定 IP')) + ' ' + ipOf(pend[0]) + ' → ' + X.devs[pend[0]][0] + (pend.length > 1 ? ' +' + (pend.length - 1) : '') : '', review: () => set({ _lv: 1 }),
    hasChg: pend.length > 0, noChg: pend.length === 0 && !V._done, chgN: String(pend.length), done: !!V._done && pend.length === 0, target, typed,
    c1: kc(k1), c2: kc(k2), c3: kc(k3), c4: kc(k4), s1: 'sw' + (k1 ? ' on' : ''), a1: k1 ? 'true' : 'false', flip1: () => set({ _k1: !k1 }), type2: (e) => set({ _k2: e && e.target ? String(e.target.value) : '' }),
    hold3: () => set({ _k3: !k3 }), h3Cls: 'btn sm ' + (k3 ? 'okk' : 'ton'), h3Label: k3 ? T('Held long enough', '撳得夠耐') : T('Press and hold', '撳住唔好放'),
    k4Label: k4 ? T('Pressed', '已撳') : T('Waiting for the keys', '等緊組合鍵'), k4Cls: k4 ? 'tag good' : 'tag', tapShow: !k4,
    taps: [3, 1, 2].map(n => ({ n: String(n), label: T('Tap ', '撳 ') + n, cls: 'btn sm ' + (tn > n ? 'okk' : 'out'), tap: () => { const nx = n === tn ? tn + 1 : n === 1 ? 2 : 1; set({ _tn: nx, _k4: nx > 3 }); } })),
    keyTxt: count + ' ' + T('of 4 keys turned', '把匙轉咗，共 4 把'), goCls: 'btn w ' + (ready ? 'fill hot dr' : 'out'), goDis: ready ? 'false' : 'true',
    turn: () => { if (ready && canWrite) set(Object.assign({}, fresh, { _base: lk, _alt0: alt, _altn0: altn, _done: true })); }, discard: () => set(Object.assign({ _lk: base, _alt: V._alt0 ?? -1, _altn: V._altn0 ?? 103 }, fresh)) };
}

// ---- saved routers and connection keys ----
// [name, kind (0 Main, 1 Testing), model, address]
const ROUTERS = [['Home', 0, 'RT-AX86U', '198.51.100.1'], ['Bench', 1, 'RT-AX58U', '198.51.100.2'], ['Garage spare', 1, 'RT-AC68U', '198.51.100.3']];
function routerLogic(h) {
  const { T, V, set, canWrite, D } = h; const X = D.x;
  const act = V._act ?? 1, kinds = V._kinds || X.map(r => r[1]).join(''), gone = V._gone || '000';
  const names = (V._names || X.map(r => r[0]).join('\n')).split('\n');
  const draft = V._nm ?? names[act], dk = V._dk ?? Number(kinds[act]);
  const flip = (s, i, v) => s.slice(0, i) + v + s.slice(i + 1);
  const kindName = (k) => k === '1' ? T('Testing', '測試') : T('Main', '主要');
  const list = []; X.forEach((r, i) => { if (gone[i] === '1') return; const use = i === act; list.push({ name: names[i], line: r[2] + ' · ' + r[3], kind: kindName(kinds[i]), kindCls: kinds[i] === '1' ? 'tag warn' : 'tag pri', inUse: use, other: !use, avCls: use ? 'av' : 'av s', style: '--j:' + list.length, rmLabel: T('Remove ', '移除 ') + names[i],
    use: () => set({ _act: i, _nm: null, _dk: null, _saved: false }), remove: () => { if (canWrite && !use) set({ _gone: flip(gone, i, '1') }); } }); });
  const kc = V._kc ?? 2, asked = !!V._ask, made = !!V._made, kf = V._kf ?? 1;
  return { list, testing: kinds[act] === '1', mainInUse: kinds[act] !== '1', refusal: T('This key is protected by a passphrase. Remove the passphrase (ssh-keygen -p -f <file>) or use this app\'s own key.', '呢條金鑰有密碼短語保護。請移除密碼短語（ssh-keygen -p -f <file>），或者用呢個應用程式自己嘅金鑰。'), badge: T('Testing router: ', '測試用路由器：') + names[act], cur: { name: draft, count: String(draft.length) + ' / 24', line: X[act][2] + ' · ' + X[act][3] },
    kindIdx: dk, isMain: dk === 0 ? 'true' : 'false', isTest: dk === 1 ? 'true' : 'false', setMain: () => set({ _dk: 0, _saved: false }), setTest: () => set({ _dk: 1, _saved: false }),
    rename: (e) => set({ _nm: e && e.target ? String(e.target.value).slice(0, 24) : draft, _saved: false }),
    save: () => { if (!canWrite) return; const nn = names.slice(); nn[act] = draft.trim() || names[act]; set({ _names: nn.join('\n'), _kinds: flip(kinds, act, String(dk)), _nm: null, _dk: null, _saved: true }); }, saved: !!V._saved,
    opts: [[T('Create a key', '建立金鑰'), T('The app makes a key and shows the public half to paste into the router.', '應用程式會建立金鑰，再顯示公開部分俾你貼入路由器。')], [T('Make a new key', '建立新金鑰'), T('Replaces the key this app made. It asks first.', '取代呢個應用程式建立嘅金鑰。會問咗你先。')], [T('Use a key I already have', '用我已有嘅金鑰'), T('Choose a private key file. It goes straight into the vault.', '揀一個私人金鑰檔案，會直接放入保險庫。')]].map((q, i) => ({ label: q[0], why: q[1], pressed: kc === i ? 'true' : 'false', pick: () => set({ _kc: i, _ask: false }) })),
    isCreate: kc === 0, isNew: kc === 1, isOwn: kc === 2, newIdle: kc === 1 && !asked && !made, asking: kc === 1 && asked, made: kc === 1 && made && !asked,
    ask: () => set({ _ask: true }), confirm: () => { if (canWrite) set({ _ask: false, _made: true }); }, cancel: () => set({ _ask: false }),
    fileIdx: kf, f0: kf === 0 ? 'true' : 'false', f1: kf === 1 ? 'true' : 'false', pickPlain: () => set({ _kf: 0 }), pickLocked: () => set({ _kf: 1 }), accepted: kc === 2 && kf === 0, refused: kc === 2 && kf === 1 };
}

// ---- start-up ----
function bootLogic(h) {
  const { T, V, set } = h; const s = V._bs ?? 0, n = V._ld ?? 120, total = 182, cleared = !!V._cl;
  return { loading: s === 0, failed: s === 1, cleared, line: T('Loading features: ' + n + ' of ' + total, '載入緊功能：' + total + ' 個入面第 ' + n + ' 個'), pct: (n / total * 100).toFixed(1) + '%', now: String(n), total: String(total),
    again: () => set({ _bs: 0, _ld: 0, _cl: false }), clear: () => set({ _bs: 0, _ld: 0, _cl: true }) };
}

// ---- the router's own page for the add-on ----
function addonLogic(h) {
  const { T, V, set, canWrite } = h; const on = (V._on ?? 1) === 1, port = V._pt ?? 8790, adv = (V._ver ?? 0) === 1;
  const put = (o) => { if (canWrite) set(Object.assign({ _ap: false }, o)); };
  return { on: on ? 'true' : 'false', off: on ? 'false' : 'true', setOn: () => put({ _on: 1 }), setOff: () => put({ _on: 0 }), port: String(port), up: () => put({ _pt: Math.min(65535, port + 1) }), dn: () => put({ _pt: Math.max(1024, port - 1) }),
    mat: adv ? 'false' : 'true', adv: adv ? 'true' : 'false', pickMat: () => set({ _ver: 0 }), pickAdv: () => set({ _ver: 1 }), showLink: on,
    link: adv ? T('Open the Advanced version', '打開進階版') : T('Open the Material version', '打開 Material 版'), url: 'http://198.51.100.1:' + port + '/' + (adv ? '#/ssh-actions' : ''),
    apply: () => { if (canWrite) set({ _ap: true }); }, applied: !!V._ap, appliedTxt: on ? T('Saved. Only this app restarted; it now answers on port ' + port + '.', '已儲存。淨係呢個應用程式重啟咗，而家用 ' + port + ' 端口。') : T('Saved. The app is switched off. Nothing else on the router changed.', '已儲存。應用程式已經閂咗，路由器其他嘢冇變。') };
}

export const B9 = [
  N('KickBan', 'Kick and ban|踢走同封鎖', 'kick', 1, {
    data: KICK, logic: kickLogic,
    st: { empty: ['pause', 'Nobody is paused|冇人被暫停', 'Pick a device to pause its internet for a while. The person on it can always lift the pause from the Unkick page.|揀一部裝置，暫停佢上網一陣。用緊嗰部裝置嘅人隨時可以喺解除暫停頁自己解除。', 'Show the devices|顯示裝置'], ok: ['Kicked: kitchen-speaker|已踢走：kitchen-speaker', 'Its internet is paused until 19:49. Nobody else is affected, and the pause is in the log.|佢上唔到網，直到 19:49。其他人唔受影響，暫停亦已經記低。'], no: ['The device was not paused|暫停唔到部裝置', 'The router did not accept the rule, so nothing was changed. The device is still online.|路由器冇接受條規則，所以乜都冇改。部裝置仲在線。'] },
    shows: 'The Kick and ban screen at phone width. A card for the person who was paused, with the link to the Unkick page. A Paused now list where each row says how the device is held, until when ("until 19:49, 30 min left"), who did it and the note, with an Unkick or Unban button. The device list, each row with its owner ("belongs to Your brother") and a Kick button. The Kick sheet: the impact line, the three ways to pause with an explanation under each, a dashed box that points to the speed limiter instead, the duration choices from 15 minutes to "Until lifted (ban)", a note for the person, and one action that reads Kick, Ban or Disconnect. A Recent log.',
    tryIt: 'the three section buttons (Paused now, Devices, Recent); Unkick on Living-TV and Unban on Alex-Tablet (the row leaves and the log gains a line); Kick on Game-Console (the impact line turns into the brother warning and shakes once); in the sheet pick each way to pause (Disconnect hides the duration and renames the action), pick "Until lifted (ban)" (the action becomes Ban and the ban note appears), then Kick (the device moves to Paused now); Copy the link; Tweaks > role viewer (nothing can be kicked), motion standard (the warning stops shaking), lang, dark, stage.',
    real: 'the Kick and ban screen in the app, including the sheet opened from the device list.', unbuilt: 'Nothing on this board is missing from the app. The brother wording follows the household setting, which this board fixes to one name.',
    dram: 'The brother warning in the Kick sheet shakes once when it appears.', norm: 'The sheet springs up over a scrim; rows cascade in; the section indicator slides; chips and option cards change shape when chosen; the result line pops in.',
    build: (C) => {
      C.over += when('x.sheet', `<div class="scrim" style="place-items:end stretch;padding:0"><div class="bsheet ksheet" role="dialog" aria-modal="true" aria-label="Kick this device|踢走呢部裝置">`
        + `<div class="rowx" style="flex-wrap:nowrap">${dvIcon('x.cur', 'ink sh-cookie')}<div class="grow"><div class="t1" style="font-size:20px">{{x.cur.name}}</div><div class="t2">{{x.cur.sub}}</div></div><button class="icb" aria-label="Close|關閉" onClick="{{x.close}}">${ic('x')}</button></div>`
        + when('x.cur.level1', `<div class="imp9" role="status">${ic('shield', 20)}<span>Level 1: one device, nobody else is affected.|1 級：得一部裝置，其他人唔受影響。</span></div>`, true)
        + when('x.cur.bro', `<div class="imp9 bro dr" role="alert">${ic('alert', 20)}<span>Level 2: this is Your brother's device and he is using it now. He will notice.|2 級：呢部係阿哥嘅裝置，佢而家用緊，一定會發現。</span></div>`)
        + `<div class="lab9">How to pause|點樣暫停</div><div class="devp one w" role="group" aria-label="How to pause|點樣暫停">${each('x.meth', 'me', 3, `<button aria-pressed="{{me.pressed}}" onClick="{{me.pick}}"><span><span class="t1">{{me.label}}</span><span class="t2" style="display:block;margin-top:3px">{{me.why}}</span></span></button>`)}</div>`
        + `<div class="dash9"><div class="t2">Want to slow it down instead of pausing it? That uses the router's bandwidth limiter, which turns on QoS for the whole network.|想減慢佢而唔係暫停？要用路由器嘅頻寬限制，會為成個網絡開啟 QoS。</div><a class="btn out sm" href="Qos.dc.html">${ic('gauge', 18)}<span>Set a speed limit|設定速度上限</span></a></div>`
        + when('x.showDur', `<div class="lab9">For how long|幾耐</div><div class="chips w" role="group" aria-label="For how long|幾耐">${each('x.durs', 'du', 6, `<button class="chip" aria-pressed="{{du.pressed}}" onClick="{{du.pick}}">{{du.label}}</button>`)}</div>` + when('x.isBan', `<div class="t2">A ban stays after the router restarts. The person on that device can still lift it from the Unkick page.|封鎖喺路由器重啟之後都會保留。用緊嗰部裝置嘅人仍然可以喺解除暫停頁自己解除。</div>`), true)
        + `<div class="lab9">Note for them (optional)|俾佢嘅留言（可選）</div>${C.name('Homework first', 40, 'Note for them (optional)|俾佢嘅留言（可選）')}`
        + `<div class="rowx" style="flex-wrap:nowrap"><button class="btn out" onClick="{{x.close}}"><span>Cancel|取消</span></button><button class="{{x.actCls}}" style="flex:1" onClick="{{x.act}}">${ic('pause', 20)}<span>{{x.actLabel}}</span></button></div>`
        + `</div></div>`, true);
      return `<div class="b9">`
        + C.tile('', { title: 'For the person who was paused|俾被暫停嘅人', ic: 'link', tone: 'pri' }, `<div class="sub">Open this page on the paused device. It lifts the pause on that device only, and the lift is recorded.|喺被暫停嘅裝置打開呢頁，佢淨係會解除嗰部裝置嘅暫停，並會記錄低。</div><div class="url9">${ic('lock', 16, 2.2)}<span>http://198.51.100.1:8790/unkick</span></div><div class="pair9"><a class="btn fill sm" href="Unkick.dc.html">${ic('globe', 18)}<span>Open the Unkick page|打開解除暫停頁</span></a><button class="btn out sm" onClick="{{x.copy}}">${ic('copy', 18)}<span>{{x.copyLabel}}</span></button></div>`)
        + when('x.hasMsg', `<div class="note9" role="status">${ic('check', 20, 2.4)}<span>{{x.msg}}</span></div>`)
        + C.seg('_kv', ['Paused now|而家暫停緊', 'Devices|裝置', 'Recent|最近'], 0, 'Section|部分')
        + when('is._kv_0', `<div class="rows">${each('x.paused', 'pz', 2, `<div class="row" style="{{pz.style}}">${dvIcon('pz', 'w')}<div class="grow"><div class="t1">{{pz.name}} <span class="{{pz.tagCls}}">{{pz.kind}}</span></div><div class="t2">{{pz.line}}</div><div class="t2">{{pz.note}}</div></div><button class="btn ton sm w" onClick="{{pz.lift}}"><span>{{pz.liftLabel}}</span></button></div>`)}</div>` + when('x.none', `<div class="sub">Nobody is paused.|冇人被暫停。</div>`), true)
        + when('is._kv_1', `<div class="rows">${each('x.devs', 'dv', 5, `<div class="row" style="{{dv.style}}">${dvIcon('dv')}<div class="grow"><div class="t1">{{dv.name}}</div><div class="t2"><span class="mono">{{dv.ip}}</span> · {{dv.owner}}</div></div>${when('dv.free', `<button class="btn ton sm w" onClick="{{dv.kick}}">${ic('pause', 18)}<span>Kick|踢走</span></button>`, true)}${when('dv.held', `<span class="tag warn">{{dv.state}}</span>`)}</div>`)}</div>`)
        + when('is._kv_2', `<div class="rows log9">${each('x.log', 'lg', 4, `<div class="row" style="{{lg.style}}"><span class="tm">{{lg.t}}</span><div class="grow"><div class="t1">{{lg.a}}</div><div class="t2">{{lg.b}}</div></div></div>`)}</div>`)
        + `</div>`;
    }
  }),
  N('Unkick', 'The Unkick page|解除暫停頁', 'kick', 0, {
    name: 'The Unkick page (public, no sign-in)', bare: true, hasStage: false, logic: unkickLogic,
    shows: 'The public Unkick page, which needs no sign-in: the page a paused person opens on their own device. A breathing circle, "Your internet is paused", why and the note that was left, "until 19:49 (30 min left), by Pat", and one big "Unkick me" button (it reads "Unban me" for a ban). Under it, the line that says the page can only lift a pause on the device you are using now and never shows anyone else\'s devices. The other states are here too: not paused, the router does not know this device, and lifted ("Unkicked. You are back online.").',
    tryIt: 'the five state buttons (Paused, Banned, Not paused, Unknown, Lifted); Unkick me (the circle turns into a green tick and the title changes); Check again; Tweaks > lang (the page follows the language of the browser), dark, accent, motion standard and calm (the circle stops breathing).',
    real: 'the Unkick page the app serves without sign-in, opened from the link on the Kick and ban screen.', unbuilt: 'Nothing on this board is missing from the app. The state buttons at the top are for the canvas only.',
    dram: 'The circle breathes and sends out two slow rings while the device is paused; the green tick pops in when the pause is lifted.', norm: 'The card rises in; the button lifts on hover and presses in.',
    build: (C) => `<div class="b9">`
      + `<div class="stagebar"><span>Preview a state|預覽狀態</span>${C.seg('_us', ['Paused|暫停', 'Banned|封鎖', 'Not paused|冇暫停', 'Unknown|唔認得', 'Lifted|已解除'], 0, 'State|狀態')}</div>`
      + `<div class="url9" style="background:var(--surf-high)">${ic('lock', 16, 2.2)}<span>198.51.100.1:8790/unkick</span></div>`
      + `<section class="uk" aria-live="polite"><div class="{{x.icCls}}" aria-hidden="true">${when('x.hold', ic('pause', 44, 2), true)}${when('x.clear', ic('wifi', 44, 2))}${when('x.lifted', ic('check', 48, 2.6))}</div><h1>{{x.title}}</h1><p>{{x.lede}}</p>`
      + when('x.hold', `<div class="ukl"><b>{{x.head}}</b> {{x.info}} · {{x.note}}</div><button class="btn fill ukbig" onClick="{{x.lift}}"><span>{{x.btn}}</span></button>`, true)
      + when('x.clear', `<button class="btn out" onClick="{{x.again}}">${ic('refresh', 20)}<span>Check again|再檢查</span></button>`)
      + when('x.lifted', `<button class="btn out" onClick="{{x.again}}">${ic('refresh', 20)}<span>Check again|再檢查</span></button>`)
      + `<p class="uknote">This page can only lift a pause on the device you are using now. It never shows anyone else's devices.|呢頁淨係可以解除你而家用緊嗰部裝置嘅暫停，唔會顯示其他人嘅裝置。</p></section></div>`
  }),
  N('LockIp', 'Lock IP|鎖定 IP', 'devices', 1, {
    name: 'Lock IP on the device list', data: LOCK, logic: lockLogic,
    st: { empty: ['laptop', 'No devices to lock yet|未有裝置可以鎖定', 'Devices appear a few seconds after they join. Lock IP keeps a device on the same address every time.|裝置連上幾秒後就會出現。鎖定 IP 會令部裝置每次都攞到同一個地址。', 'Show the devices|顯示裝置'], ok: ['IP locked for kitchen-speaker|kitchen-speaker 嘅 IP 已鎖定', '198.51.100.103 now always goes to kitchen-speaker. The router confirmed it, and it can be undone from the change history.|198.51.100.103 以後一定派俾 kitchen-speaker。路由器已經確認，可以喺改動記錄還原。'], no: ['The address was not locked|鎖定唔到個地址', '198.51.100.103 is outside the range the router hands out, so the router refused it. Choose an address inside the range.|198.51.100.103 唔喺路由器派發嘅範圍入面，所以路由器拒絕咗。請揀範圍內嘅地址。'] },
    shows: 'Lock IP on the device list at phone width. Each row has a one-tap Lock IP or Unlock IP button, the words "IP locked" as a tag beside the address (not a colour alone), an icon button to lock the device to a different address, and a Kick shortcut. Ticking rows brings up the selection bar with Lock IPs and Unlock IPs. Docked at the bottom of the list is the waiting change, written out ("Lock IP 198.51.100.103 → kitchen-speaker"), with Review. Review opens the Changes waiting section: the changes panel and the four-key confirmation. Key 4 offers "No keyboard? Tap in order:" with the buttons 3, 1, 2, which is the touch form of the key combination.',
    tryIt: 'Lock IP on Living-TV (the docked line counts a second change); Unlock IP on Pat-Laptop; the pencil on a row (an address stepper opens; Lock to this address queues it); tick and untick rows, then Lock IPs or Unlock IPs in the selection bar; Review, or the Changes waiting section button; in the panel turn key 1, type kitchen-speaker for key 2, tap Press and hold for key 3, then tap 1, 2, 3 in order for key 4 (the buttons are laid out 3, 1, 2, and a wrong tap starts again); Turn all four keys; Discard; Tweaks > role viewer, stage success and failure, lang, dark.',
    real: 'the device list with Lock IP, the pending changes panel and the four-key confirmation, as the app shows them on a phone.', unbuilt: 'Nothing on this board is missing from the app. In the app key 3 is a real press and hold; on this board one tap stands in for it.',
    dram: 'When all four keys are on, the Turn all four keys button gets a rotating conic border.', norm: 'Rows cascade in; the selection bar and the address editor pop in; each key card turns green and its mark spins once when the key is on; tapped numbers turn green.',
    build: (C) => `<div class="b9">`
      + C.seg('_lv', ['Devices|裝置', 'Changes waiting|等緊嘅改動'], 0, 'Section|部分')
      + when('is._lv_0', when('x.hasSel', `<div class="selbar" role="region" aria-label="Selection|已揀選"><span class="t1 grow">{{x.selTxt}}</span><button class="btn fill sm w" onClick="{{x.lockSel}}">${ic('lock', 18)}<span>Lock IPs|鎖定 IP</span></button><button class="btn out sm w" onClick="{{x.unlockSel}}"><span>Unlock IPs|解除鎖定 IP</span></button><button class="icb" aria-label="Clear the selection|清除揀選" onClick="{{x.clearSel}}">${ic('x')}</button></div>`, true)
      + `<div class="rows">${each('x.rows', 'dv', 4, `<div class="row lrow" style="{{dv.style}}"><button class="selb" role="checkbox" aria-checked="{{dv.sel}}" aria-label="{{dv.selLabel}}" onClick="{{dv.pick}}">${ic('check', 22, 2.6)}</button>${dvIcon('dv')}<div class="grow"><div class="t1">{{dv.name}}</div><div class="rowx" style="gap:6px"><span class="t2 mono">{{dv.ip}}</span>${when('dv.locked', `<span class="tag pri">${ic('lock', 15, 2.2)}IP locked|IP 已鎖定</span>`, true)}</div></div>`
        + `<div class="acts9"><button class="{{dv.btnCls}}" onClick="{{dv.toggle}}"><span>{{dv.btnLabel}}</span></button><button class="icb w" aria-label="Lock to a different address|鎖定去另一個地址" aria-pressed="{{dv.edPressed}}" onClick="{{dv.edit}}">${ic('edit')}</button><a class="icb" href="KickBan.dc.html" aria-label="Kick this device|踢走呢部裝置">${ic('pause')}</a></div>`
        + when('dv.ed', `<div class="ed9">${C.ip('_lip', '198.51.100.103', 'Address to lock|要鎖定嘅地址')}<button class="btn ton sm w" onClick="{{dv.useAlt}}"><span>Lock to this address|鎖定去呢個地址</span></button></div>`)
        + `</div>`)}</div>`
        + when('x.hasChg', `<div class="dockbar9" role="region" aria-label="Changes waiting|等緊嘅改動"><div class="grow"><div class="t2">{{x.dockN}}</div><div class="t1">{{x.dockTxt}}</div></div><button class="btn fill sm" onClick="{{x.review}}">${ic('key', 18)}<span>Review|檢查</span></button></div>`, true), true)
      + when('is._lv_1', `<section class="chg9" aria-label="Changes|改動"><header class="th"><span class="tic">${ic('history')}</span><h3>Changes waiting|等緊嘅改動</h3><span class="tag pri">{{x.chgN}}</span></header>`
      + when('x.noChg', `<div class="sub">Nothing is waiting. Lock or unlock an address and it appears here before it reaches the router.|冇嘢等緊。鎖定或者解除鎖定一個地址，寫入路由器之前會喺呢度出現。</div>`)
      + when('x.done', `<div class="note9" role="status">${ic('check', 20, 2.4)}<span>Applied and verified. The router has the new settings and still answers.|已套用同驗證。路由器已經用緊新設定，而且有回應。</span></div>`)
      + when('x.hasChg', `<div class="rows">${each('x.chg', 'ch', 1, `<div class="row" style="{{ch.style}}"><span class="av g">${ic('lock')}</span><div class="grow"><div class="t1">{{ch.text}}</div><div class="t2">Level 1: one device, nobody else is affected.|1 級：得一部裝置，其他人唔受影響。</div></div><button class="icb" aria-label="Remove this change|移除呢項改動" onClick="{{ch.drop}}">${ic('x')}</button></div>`)}</div>`
        + `<div class="rowx"><span class="lab9 grow">Four keys to turn|要轉四把匙</span><span class="tag">{{x.keyTxt}}</span></div>`
        + `<div class="{{x.c1}}"><div class="kh"><span class="km9"></span><span>Key 1 · Acknowledge|第 1 把 · 確認</span></div><div class="rowx" style="flex-wrap:nowrap"><div class="t2 grow">I know everyone at home may be affected.|我知道屋企所有人都可能受影響。</div><button class="{{x.s1}}" role="switch" aria-checked="{{x.a1}}" aria-label="I know everyone at home may be affected|我知道屋企所有人都可能受影響" onClick="{{x.flip1}}"><i></i></button></div></div>`
        + `<div class="{{x.c2}}"><div class="kh"><span class="km9"></span><span>Key 2 · Type the name|第 2 把 · 輸入名稱</span></div><div class="t2"><span>Type exactly:|請原字輸入：</span> <span class="mono">{{x.target}}</span></div><label class="nm"><input type="text" value="{{x.typed}}" maxlength="32" autocomplete="off" spellcheck="false" aria-label="Type the device name|輸入裝置名稱" onInput="{{x.type2}}"></label></div>`
        + `<div class="{{x.c3}}"><div class="kh"><span class="km9"></span><span>Key 3 · Hold|第 3 把 · 撳住</span></div><div class="t2">Hold for 1.5 seconds. On this board one tap stands in for the hold.|撳住 1.5 秒。喺呢塊板㩒一下就當撳住咗。</div><button class="{{x.h3Cls}}" onClick="{{x.hold3}}">${ic('clock', 18)}<span>{{x.h3Label}}</span></button></div>`
        + `<div class="{{x.c4}}"><div class="kh"><span class="km9"></span><span>Key 4 · Key combination|第 4 把 · 組合鍵</span></div><div class="rowx" style="gap:6px"><span class="t2">Press|撳</span><span class="kbd9">Ctrl+Shift+Enter</span><span class="t2">together.|一齊。</span><span class="{{x.k4Cls}}">{{x.k4Label}}</span></div>${when('x.tapShow', `<div class="tap9" role="group" aria-label="On a touch screen: tap 1, 2 and 3 in order|觸控螢幕：順序撳 1、2、3"><span class="t2">No keyboard? Tap in order:|冇鍵盤？順序撳：</span>${each('x.taps', 'tp', 3, `<button class="{{tp.cls}}" aria-label="{{tp.label}}" onClick="{{tp.tap}}"><span>{{tp.n}}</span></button>`)}</div>`, true)}</div>`
        + `<div class="rowx" style="flex-wrap:nowrap"><button class="btn out" onClick="{{x.discard}}"><span>Discard|放棄</span></button><button class="{{x.goCls}}" style="flex:1" aria-disabled="{{x.goDis}}" onClick="{{x.turn}}">${ic('key', 20)}<span>Turn all four keys|四把匙一齊轉</span></button></div>`, true)
      + `</section>`)
      + `</div>`
  }),
  N('Routers', 'Saved routers|已儲存嘅路由器', 'routers', 4, {
    name: 'Saved routers and connection keys', data: ROUTERS, logic: routerLogic,
    st: { empty: ['server', 'No router saved yet|未儲存任何路由器', 'Connect to a router and it is saved here. Keep more than one, for example the main one and a Testing router, and switch between them.|連接一部路由器就會儲存喺呢度。可以儲多過一部，例如主要嗰部同一部測試用嘅，再喺佢哋之間切換。', 'Connect a router|連接路由器'], ok: ['Now using Home|而家用緊 Home', 'The app signed in to Home with its own saved sign-in and approved host key. The Testing badge is gone.|應用程式用 Home 自己儲存嘅登入資料同已批准嘅主機金鑰登入咗。「測試」標記已經消失。'], no: ['Could not switch routers|切換唔到路由器', 'Bench did not answer on 198.51.100.2, so the app stayed on the router it was using.|Bench 喺 198.51.100.2 冇回應，所以應用程式留喺原本用緊嗰部路由器。'] },
    shows: 'Saved routers at phone width. At the top, the badge that sits on the top bar of the whole app for as long as a Testing router is in use ("Testing router: Bench"), so a change meant for the bench is never made at home by mistake. "The router in use" card with a name field, a Main or Testing choice and Save. The list of saved routers with Main and Testing chips, "In use" on the current one, "Use this router" on the others, and remove. The second section is the key choice on the connect screen: Create a key, Make a new key (asks first) and Use a key I already have, with the refusal for a key that is protected by a passphrase.',
    tryIt: 'Use this router on Home (the Testing badge leaves); switch the router in use between Main and Testing and Save (the chip and the badge follow); type a new name and Save; remove a router that is not in use; the Connection keys section: each of the three choices, Make a new key then Cancel or confirm, and the two sample key files (the one with a passphrase is refused with the reason); Tweaks > role viewer, lang, dark, stage.',
    real: 'the saved routers screen, the Testing badge on the top bar and the key choices on the connect screen.', unbuilt: 'Nothing on this board is missing from the app. The two sample key files stand in for the file chooser.',
    dram: 'The dot on the Testing badge pulses for as long as a Testing router is in use.', norm: 'The badge pops in and out; the Main or Testing indicator slides; rows cascade in; option cards change shape when chosen; the question and the refusal pop in.',
    build: (C) => `<div class="b9">`
      + `<div class="tbar9" role="status"><span class="t2 grow">On the top bar of every screen|喺每個畫面嘅頂欄</span>${when('x.testing', `<span class="tbadge"><i class="dr"></i><span>{{x.badge}}</span></span>`, true)}${when('x.mainInUse', `<span class="tag good">Main router in use|用緊主要路由器</span>`)}</div>`
      + C.seg('_rv', ['Saved routers|已儲存路由器', 'Connection keys|連接金鑰'], 0, 'Section|部分')
      + when('is._rv_0', C.tile('', { title: 'The router in use|而家用緊嘅路由器', ic: 'server', tone: 'pri' }, `<div class="t2 mono">{{x.cur.line}}</div><label class="nm w"><input type="text" value="{{x.cur.name}}" maxlength="24" aria-label="Router name|路由器名稱" onInput="{{x.rename}}"><span class="cn">{{x.cur.count}}</span></label>`
          + `<div class="seg w" role="group" aria-label="Kind of router|路由器類型" style="--cnt:2;--idx:{{x.kindIdx}}"><i class="ind"></i><button aria-pressed="{{x.isMain}}" onClick="{{x.setMain}}">Main|主要</button><button aria-pressed="{{x.isTest}}" onClick="{{x.setTest}}">Testing|測試</button></div>`
          + `<div class="rowx"><button class="btn fill sm w" onClick="{{x.save}}">${ic('check', 18)}<span>Save|儲存</span></button>${when('x.saved', `<span class="tag good">Saved|已儲存</span>`)}</div>`)
        + `<div class="rows">${each('x.list', 'rt', 3, `<div class="row" style="{{rt.style}}"><span class="{{rt.avCls}}">${ic('wifi')}</span><div class="grow"><div class="t1">{{rt.name}} <span class="{{rt.kindCls}}">{{rt.kind}}</span></div><div class="t2 mono">{{rt.line}}</div></div>${when('rt.inUse', `<span class="tag good live">In use|使用緊</span>`, true)}${when('rt.other', `<div class="acts9"><button class="btn ton sm" onClick="{{rt.use}}"><span>Use this router|用呢部路由器</span></button><button class="icb w" aria-label="{{rt.rmLabel}}" onClick="{{rt.remove}}">${ic('trash')}</button></div>`)}</div>`)}</div>`
        + `<div class="sub">Each saved router keeps its own sign-in and approved host key.|每部已儲存嘅路由器都有自己嘅登入資料同已批准嘅主機金鑰。</div>`, true)
      + when('is._rv_1', C.tile('', { title: 'How the app signs in to the router|應用程式點樣登入路由器', ic: 'key' }, `<div class="devp one" role="group" aria-label="Key choice|金鑰選擇">${each('x.opts', 'op', 3, `<button aria-pressed="{{op.pressed}}" onClick="{{op.pick}}"><span><span class="t1">{{op.label}}</span><span class="t2" style="display:block;margin-top:3px">{{op.why}}</span></span></button>`)}</div>`
          + when('x.isCreate', `<div class="sub">Create a key here, then paste its public half into the router: Administration, System, Authorized Keys.|喺度建立金鑰，再將公開部分貼入路由器：「管理」→「系統」→「Authorized Keys」。</div><div class="pub9">ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExamplePublicHalfOnly material-router</div><button class="btn ton sm">${ic('copy', 18)}<span>Copy the public half|複製公開部分</span></button>`)
          + when('x.newIdle', `<button class="btn out sm w" onClick="{{x.ask}}">${ic('refresh', 18)}<span>Make a new key|建立新金鑰</span></button>`)
          + when('x.asking', `<div class="ask9" role="alertdialog" aria-label="Make a new key?|建立新金鑰？"><div class="t1">Make a new key?|建立新金鑰？</div><div>The router will stop accepting the current key until you paste the new public half into Authorized Keys.|要將新嘅公開部分貼入 Authorized Keys，路由器先會再接受。之前條金鑰會停用。</div><div class="rowx"><button class="btn out sm" onClick="{{x.cancel}}"><span>Cancel|取消</span></button><button class="btn dng sm w" onClick="{{x.confirm}}"><span>Make a new key|建立新金鑰</span></button></div></div>`)
          + when('x.made', `<div class="note9" role="status">${ic('check', 20, 2.4)}<span>New key made. Paste its public half into the router before the next connection.|已建立新金鑰。下次連接之前，將公開部分貼入路由器。</span></div><button class="btn out sm w" onClick="{{x.ask}}">${ic('refresh', 18)}<span>Make a new key|建立新金鑰</span></button>`)
          + when('x.isOwn', `<div class="lab9">Sample key file|示範金鑰檔案</div><div class="seg" role="group" aria-label="Sample key file|示範金鑰檔案" style="--cnt:2;--idx:{{x.fileIdx}}"><i class="ind"></i><button aria-pressed="{{x.f0}}" onClick="{{x.pickPlain}}">No passphrase|冇密碼短語</button><button aria-pressed="{{x.f1}}" onClick="{{x.pickLocked}}">With a passphrase|有密碼短語</button></div>`
            + when('x.accepted', `<div class="note9" role="status">${ic('check', 20, 2.4)}<span>Key accepted. It is stored only in the vault.|已接受金鑰，只會儲存喺保險庫。</span></div>`)
            + when('x.refused', `<div class="note9 bad" role="alert">${ic('alert', 20)}<span>{{x.refusal}}</span></div>`, true), true)))
      + `</div>`
  }),
  N('Startup', 'Start-up|啟動', 'setup', 0, {
    name: 'Start-up: loading and the start-up error', bare: true, hasStage: false, logic: bootLogic,
    shows: 'The two cards a person can see between signing in and the app being ready. The loading card: "Opening your router", a spinner, a progress bar and the count "Loading features: 120 of 182", so a slow start is visibly still moving. The start-up error card: "The app could not start", the error text in a monospace box so it can be copied into a report, and two ways out, "Clear saved settings and retry" and "Try again".',
    tryIt: 'the two state buttons (Loading, Could not start); the slider under the loading card (the bar and the count follow); Try again and Clear saved settings and retry (both go back to loading from zero; the second one says what was cleared); Tweaks > motion calm (the spinner stops and the count still tells you where it is), lang, dark, accent.',
    real: 'the loading card and the start-up error card the app shows after sign-in.', unbuilt: 'Nothing on this board is missing from the app. The slider is for the canvas only.',
    dram: 'The error card shakes once when it appears.', norm: 'The spinner turns; the progress bar grows with a spring and shimmers; the card rises in.',
    build: (C) => `<div class="b9">`
      + `<div class="stagebar"><span>Preview a state|預覽狀態</span>${C.seg('_bs', ['Loading|載入中', 'Could not start|啟動唔到'], 0, 'State|狀態')}</div>`
      + when('x.loading', `<section class="boot9" aria-live="polite" aria-busy="true"><span class="spin9" aria-hidden="true"></span><h1>Opening your router|打開緊你嘅路由器</h1><div class="prog" role="progressbar" aria-label="Loading features|載入緊功能" aria-valuemin="0" aria-valuemax="{{x.total}}" aria-valuenow="{{x.now}}"><i style="--p:{{x.pct}}"></i></div><div class="t1">{{x.line}}</div>${when('x.cleared', `<div class="t2">Saved settings on this browser were cleared. Your sign-in and the router were not touched.|呢個瀏覽器儲存嘅設定已經清除。你嘅登入同路由器冇受影響。</div>`)}</section>`
        + `<div class="colx" style="gap:4px"><span class="t2">Canvas only: move the count|只限畫布：郁個數目</span>${C.slider('_ld', 120, 0, 182, 1, '', 'Features loaded|已載入功能')}</div>`, true)
      + when('x.failed', `<section class="boot9 bad dr" role="alert"><span class="av b" style="width:64px;height:64px;border-radius:22px;background:var(--bad-c);color:var(--on-bad-c)">${ic('alert', 34, 2.2)}</span><h1>The app could not start|應用程式啟動唔到</h1><div class="err9">TypeError: Cannot read properties of undefined (reading 'tabs')
    at restoreTabs (main.js:212:18)</div><div class="acts9"><button class="btn fill" onClick="{{x.clear}}">${ic('trash', 20)}<span>Clear saved settings and retry|清除已儲存設定再試</span></button><button class="btn out" onClick="{{x.again}}">${ic('refresh', 20)}<span>Try again|再試</span></button></div></section>`)
      + `</div>`
  }),
  N('RouterAddon', 'Router add-on page|路由器附加元件頁', 'addon', 0, {
    name: 'The router\'s own page for the add-on', bare: true, hasStage: false, logic: addonLogic,
    shows: 'The page the add-on adds to the router\'s own web interface, drawn in the style of the Asuswrt-Merlin administration pages (the dark grey #4D595D panel) and not in the app\'s style, because that is where it lives. Title "Material Router", On and Off, the port (8790), "Which version opens (remembered by this browser)" with a Material version card and an Advanced version card, the Open link, and the note that switching it on or off restarts only this app.',
    tryIt: 'On and Off (the Open link leaves when it is off); the port buttons (the link follows); the two version cards (the link text and address follow); Apply; Tweaks > lang, accent (only the Open link takes the accent), role viewer. Dark has no effect here on purpose: the router page has one look.',
    real: 'the add-on page on the router (addon/webui), reached from the router\'s own menu.', unbuilt: 'Nothing on this board is missing from the add-on.',
    dram: 'None; this page only carries normal motion.', norm: 'The page fades in; the chosen version card lifts; the Open link and the saved line pop in.',
    build: () => `<div class="b9">`
      + `<div class="url9" style="background:var(--surf-high)">${ic('lock', 16, 2.2)}<span>198.51.100.1/user1.asp</span></div>`
      + `<section class="mer" aria-label="Router page|路由器頁面"><div class="mtab">Material Router</div><div class="mpn"><h1>Material Router</h1><div class="msub">A modern app for this router, running on the router itself. It is off unless you switch it on here. Every feature lives in the app, not on these pages.|俾呢部路由器用嘅新式應用程式，喺路由器自己度行。唔喺呢度開就係閂住。所有功能都喺應用程式入面，唔喺呢啲頁面。</div>`
      + `<div><div class="mhd">Basic settings|基本設定</div>`
      + `<div class="mrow"><div class="ml">Material Router</div><div class="mv" role="radiogroup" aria-label="Material Router"><button class="mrad" role="radio" aria-checked="{{x.on}}" onClick="{{x.setOn}}"><i></i><span>On|開</span></button><button class="mrad" role="radio" aria-checked="{{x.off}}" onClick="{{x.setOff}}"><i></i><span>Off|閂</span></button></div></div>`
      + `<div class="mrow"><div class="ml">Port|端口</div><div class="mv"><div class="mport"><button aria-label="Port down|端口減一" onClick="{{x.dn}}">&minus;</button><output>{{x.port}}</output><button aria-label="Port up|端口加一" onClick="{{x.up}}">+</button></div></div></div></div>`
      + `<div><div class="mhd">Which version opens (remembered by this browser)|打開邊個版本（呢個瀏覽器會記住）</div><div class="mrow"><div class="mv" style="padding:10px"><div class="mpick" role="radiogroup" aria-label="Which version opens|打開邊個版本"><button role="radio" aria-checked="{{x.mat}}" onClick="{{x.pickMat}}"><b><i></i><span>Material version|Material 版</span></b><span class="msub">The full modern app.|完整嘅新式應用程式。</span></button><button role="radio" aria-checked="{{x.adv}}" onClick="{{x.pickAdv}}"><b><i></i><span>Advanced version|進階版</span></b><span class="msub">Every control, the action catalogue and the terminal.|所有控制項、動作目錄同終端機。</span></button></div></div></div></div>`
      + when('x.showLink', `<a class="mopen" href="Main.dc.html" title="{{x.url}}">${ic('arrow', 18)}<span>{{x.link}}</span></a><div class="msub mono">{{x.url}}</div>`, true)
      + `<div class="mnote">Switching it on or off restarts only this app. The router, Wi-Fi and internet are not touched. The router's own pages still allow one administrator at a time; the app allows many people signed in at once.|開或者閂只會重啟呢個應用程式，唔會掂到路由器、Wi-Fi 同上網。路由器自己嘅頁面仍然一次只容許一個管理員；應用程式就可以好多人同時登入。</div>`
      + when('x.applied', `<div class="mdone" role="status">{{x.appliedTxt}}</div>`)
      + `<button class="mapply" onClick="{{x.apply}}">Apply|套用</button></div></section></div>`
  })
];
