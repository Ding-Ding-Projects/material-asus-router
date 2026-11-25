/* Non-blocking notifications and a notification centre. Nothing here steals focus. */
import { h, bi, store, say, pick, emit, dialog, motionOk } from './core.js';
import { play } from './sound.js';
import { searchBox } from './rx.js';

let list = store.get('notes', []);
let box = null;
const icons = { ok: '✓', warn: '!', error: '×', info: 'i' };

function ensureBox() {
  if (box && box.isConnected) return box;
  box = h('div', { class: 'mf-toasts', role: 'region', 'aria-label': 'Notifications', popover: 'manual' });
  document.body.append(box);
  try { box.showPopover(); } catch (e) { /* older browsers use a plain fixed layer */ }
  return box;
}
function badge() {
  const b = document.getElementById('mf-bell-count'); if (!b) return;
  const n = list.filter((x) => !x.read).length; b.textContent = n > 99 ? '99+' : String(n); b.hidden = n === 0;
}

/** msg is the result of say() or { en, zh }. kind is ok, info, warn or error. */
export function notify(msg, kind, opts) {
  kind = kind || 'info'; const o = opts || {};
  const item = { id: Date.now() + Math.random(), t: Date.now(), en: msg.en, zh: msg.zh, kind, read: false };
  list.unshift(item); list = list.slice(0, 100); store.set('notes', list);
  badge();
  const wrap = ensureBox();
  try { if (box.matches && !box.matches(':popover-open')) box.showPopover(); } catch (e) { /* ignore */ }
  let timer = null;
  const gone = () => { clearTimeout(timer); toast.classList.add('out'); setTimeout(() => toast.remove(), motionOk() ? 220 : 0); };
  const toast = h('div', { class: 'mf-toast ' + kind + (motionOk() ? ' anim' : ''), role: kind === 'error' ? 'alert' : 'status' },
    h('span', { class: 'mf-ticon', 'aria-hidden': 'true' }, icons[kind] || 'i'),
    h('span', { class: 'mf-ttext', html: bi(msg.en, msg.zh) }),
    h('button', { type: 'button', class: 'mf-icon', 'aria-label': pick('Dismiss', '關閉'), onclick: gone }, '×'));
  wrap.append(toast);
  while (wrap.children.length > 4) wrap.firstChild.remove();
  timer = setTimeout(gone, o.sticky ? 60000 : kind === 'error' ? 9000 : 5200);
  toast.addEventListener('mouseenter', () => clearTimeout(timer));
  toast.addEventListener('mouseleave', () => { timer = setTimeout(gone, 2500); });
  if (!o.quiet) play(kind === 'error' || kind === 'warn' ? 'invalid' : kind === 'ok' ? 'success' : 'notify');
  emit('notify', item);
  return item;
}
export const notifyMsg = (msgDef, kind, vars, opts) => notify(say(msgDef, vars), kind, opts);

export function openCentre() {
  let filter = 'all';
  const rows = h('ul', { class: 'mf-notelist' });
  const sb = searchBox({ key: 'notes', placeholder: pick('Search notifications', '搜尋通知'), onChange: () => draw() });
  const names = { all: ['All', '全部'], unread: ['Unread', '未讀'], error: ['Errors', '錯誤'], warn: ['Warnings', '警告'] };
  const tabs = h('div', { class: 'mf-seg', role: 'group', 'aria-label': pick('Filter', '篩選') }, Object.keys(names).map((f) => h('button', {
    type: 'button', class: 'mf-segbtn', 'aria-pressed': String(f === filter), 'data-f': f,
    onclick: () => { filter = f; tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === f))); draw(); },
  }, h('span', { html: bi(names[f][0], names[f][1]) }))));
  function draw() {
    rows.textContent = '';
    const shown = list.filter((n) => (filter === 'all' || (filter === 'unread' ? !n.read : n.kind === filter)) && sb.test(n.en + ' ' + n.zh));
    if (!shown.length) rows.append(h('li', { class: 'mf-empty', html: bi('Nothing here.', '呢度冇嘢。') }));
    shown.forEach((n) => rows.append(h('li', { class: 'mf-note ' + n.kind + (n.read ? ' read' : '') },
      h('span', { class: 'mf-ticon', 'aria-hidden': 'true' }, icons[n.kind] || 'i'),
      h('div', { class: 'mf-notebody' }, h('div', { html: bi(n.en, n.zh) }), h('time', { datetime: new Date(n.t).toISOString() }, new Date(n.t).toLocaleString())),
      h('button', { type: 'button', class: 'mf-btn text', onclick: () => { n.read = !n.read; store.set('notes', list); badge(); draw(); } }, h('span', { html: n.read ? bi('Mark unread', '標為未讀') : bi('Mark read', '標為已讀') })),
      h('button', { type: 'button', class: 'mf-icon', 'aria-label': pick('Delete', '刪除'), onclick: () => { list = list.filter((x) => x !== n); store.set('notes', list); badge(); draw(); } }, '×'))));
  }
  const d = dialog({ id: 'mf-centre', titleEn: 'Notification centre', titleZh: '通知中心', wide: true, body: h('div', {}, sb.el, tabs, rows), actions: [
    { en: 'Mark all read', zh: '全部標為已讀', kind: 'tonal', keepOpen: true, onClick: () => { list.forEach((n) => { n.read = true; }); store.set('notes', list); badge(); draw(); } },
    { en: 'Clear all', zh: '全部清除', kind: 'text', keepOpen: true, onClick: () => { list = []; store.set('notes', list); badge(); draw(); } },
    { en: 'Close', zh: '關閉', kind: 'filled' }] });
  draw(); badge(); play('open');
  return d;
}
export const unreadCount = () => list.filter((n) => !n.read).length;
export const refreshBadge = badge;
