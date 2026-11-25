/* Navigation: browser-style tabs, the New tab catalog, the command palette, context menus, shortcuts and the floating tool dock. */
import { root, h, bi, $, $$, define, get, set, allSettings, settingDef, store, lang, pick, on, emit, esc, dialog, loadIndex, siteRoot, motionOk, setLanguage } from './core.js';
import { MSG } from './strings.js';
import { notify, notifyMsg, openCentre, unreadCount, refreshBadge } from './notify.js';
import { play } from './sound.js';
import { searchBox } from './rx.js';
import { pageKey, pageTitle, toggleBookmark, isBookmarked, openExport, openSaved, openHistory, openChangelog, openUpdate, bookmarks } from './records.js';
import { toggleReading, startReading, isReading } from './voice.js';
import { setSchool } from './modes.js';
import { pickElement, lockWizard, settingLockedBy } from './locks.js';

const abs = (k) => new URL(siteRoot() + (k === 'index.html' ? '' : k), location.href).href;
export const settingsHref = (id) => siteRoot() + 'settings.html' + (id ? '#setting-' + encodeURIComponent(id) : '');

/* ---------- every destination on the site ---------- */
let dests = null;
export async function destinations() {
  if (dests) return dests;
  const idx = await loadIndex(); const out = [
    { k: 'index.html', en: 'Home', zh: '首頁', kind: 'page', sec: { en: 'Pages', zh: '頁面' }, text: '' },
    { k: 'articles/index.html', en: 'Guides', zh: '指南', kind: 'page', sec: { en: 'Pages', zh: '頁面' }, text: '' },
    { k: 'wiki/index.html', en: 'Wiki', zh: '維基', kind: 'page', sec: { en: 'Pages', zh: '頁面' }, text: '' },
    { k: 'settings.html', en: 'Settings', zh: '設定', kind: 'page', sec: { en: 'Pages', zh: '頁面' }, text: 'language funny sound narrator appearance accessibility school adhd lock schedule' },
  ];
  idx.forEach((e) => { if (e.k === 'article' || e.k === 'wiki') out.push({ k: e.u, en: e.t, zh: e.z || e.t, kind: e.k, sec: e.c || { en: '', zh: '' }, text: (e.s || '') + ' ' + (e.x || '').slice(0, 3000) }); });
  dests = out; return out;
}
const ICON = { article: '📘', wiki: '📚', page: '🏠', setting: '⚙️', command: '⚡' };

/* ---------- tabs ---------- */
const COLORS = ['#3a6ea5', '#a5533a', '#3a8f5c', '#8a3aa5', '#a58a3a', '#3a9aa5', '#a53a6e'];
let tabs = store.get('tabs', []); let groups = store.get('tabgroups', {}); let offered = new Set(store.get('tabsoffered', []));
const saveTabs = () => { store.set('tabs', tabs); store.set('tabgroups', groups); store.set('tabsoffered', Array.from(offered)); };
let strip = null; let tabFilter = '';
define({ id: 'tabs.on', group: 'navigation', type: 'toggle', default: true, label: ['Show the tab strip', '顯示分頁列'], info: ['Keeps every guide, wiki page and settings page as a tab, like a browser. On a fresh visit every page is open. Closed tabs stay closed, and new pages that appear after an update open once.', '將每篇指南、維基頁同設定頁當作分頁，好似瀏覽器咁。首次到訪全部頁面都開咗，關閉咗嘅分頁會保持關閉，更新後新增嘅頁面只會開一次。'], apply(v) { root.toggleAttribute('data-mf-tabs', !!v); build(); } });
define({ id: 'tabs.dock', group: 'navigation', type: 'select', default: 'left', label: ['Tab strip position', '分頁列位置'], info: ['Dock the strip to the left, right, top or bottom edge. On narrow screens it becomes a drawer.', '將分頁列固定喺左、右、上或下邊。細螢幕會變成抽屜。'], options: [['left', 'Left', '左'], ['right', 'Right', '右'], ['top', 'Top', '上'], ['bottom', 'Bottom', '下']], apply(v) { root.setAttribute('data-mf-dock', v); build(); } });
define({ id: 'tabs.collapsed', group: 'navigation', type: 'toggle', default: false, label: ['Collapse the tab strip to icons', '分頁列收埋成圖示'], info: ['Shrinks the strip so it takes little space; hover or focus a tab to see its name.', '令分頁列縮細，佔位少啲；滑過或聚焦分頁就睇到名稱。'], apply(v) { root.toggleAttribute('data-mf-tabs-collapsed', !!v); } });
const titleOf = (t, d) => (d ? pick(d.en, d.zh) : t.title);
async function ensureOffered() {
  const all = await destinations(); let changed = false;
  all.forEach((d) => { if (!offered.has(d.k)) { offered.add(d.k); if (!tabs.some((t) => t.k === d.k)) { tabs.push({ k: d.k, title: d.en, pinned: d.k === 'index.html', group: d.kind === 'page' ? 'pages' : (d.sec.en || 'Other') }); } changed = true; } });
  const k = pageKey(); if (!tabs.some((t) => t.k === k) && !(tabs.length === 0 && false)) { const d = all.find((x) => x.k === k); tabs.push({ k, title: d ? d.en : pageTitle(), pinned: false, group: d ? (d.kind === 'page' ? 'pages' : d.sec.en) : 'Other' }); changed = true; }
  // groups are created for every group name that tabs refer to
  tabs.forEach((t) => { if (t.group && !groups[t.group]) { groups[t.group] = { name: t.group === 'pages' ? 'Pages' : t.group, zh: t.group === 'pages' ? '頁面' : (all.find((x) => x.sec && x.sec.en === t.group) || { sec: { zh: t.group } }).sec.zh, color: COLORS[Object.keys(groups).length % COLORS.length], collapsed: t.group !== 'pages' }; changed = true; } });
  if (changed) saveTabs();
}
function build() {
  if (!get('tabs.on')) { if (strip) { strip.remove(); strip = null; } return; }
  if (!strip) { strip = h('nav', { class: 'mf-tabs', 'aria-label': pick('Open pages', '開啟嘅頁面') }); document.body.append(strip); }
  draw();
}
function currentKey() { return pageKey(); }
async function draw() {
  if (!strip) return; const all = await destinations(); const cur = currentKey(); const vertical = get('tabs.dock') === 'left' || get('tabs.dock') === 'right';
  strip.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal'); strip.textContent = '';
  const head = h('div', { class: 'mf-tabhead' }, h('button', { type: 'button', class: 'mf-icon', 'aria-label': pick('New tab: open the catalog', '新分頁：開啟目錄'), title: pick('New tab', '新分頁'), onclick: () => openCatalog() }, '+'),
    h('input', { type: 'search', class: 'mf-input small', placeholder: pick('Filter tabs', '篩選分頁'), 'aria-label': pick('Filter open tabs', '篩選已開分頁'), value: tabFilter, oninput: (e) => { tabFilter = e.target.value; drawList(); } }),
    h('button', { type: 'button', class: 'mf-icon', 'aria-label': pick('Tab menu', '分頁選單'), onclick: (e) => tabMenuAt(e.currentTarget.getBoundingClientRect(), null) }, '⋯'),
    h('button', { type: 'button', class: 'mf-icon mf-collapse', 'aria-label': pick('Collapse or expand the strip', '收埋或展開分頁列'), onclick: () => set('tabs.collapsed', !get('tabs.collapsed')) }, '↔'));
  const list = h('div', { class: 'mf-tablist', role: 'tablist', 'aria-orientation': vertical ? 'vertical' : 'horizontal' }); strip.append(head, list);
  function drawList() {
    list.textContent = ''; const q = tabFilter.trim().toLowerCase(); const match = (t) => { const d = all.find((x) => x.k === t.k); return !q || (titleOf(t, d) + ' ' + t.k).toLowerCase().indexOf(q) >= 0; };
    const order = []; const seen = {}; tabs.filter((t) => t.pinned).forEach((t) => order.push(['', t])); tabs.filter((t) => !t.pinned).forEach((t) => { const g = t.group || ''; if (!(g in seen)) { seen[g] = []; order.push([g, null, seen[g]]); } seen[g].push(t); });
    order.forEach(([g, t, arr]) => {
      if (t) { if (match(t)) list.append(tabEl(t)); return; }
      const grp = groups[g]; const vis = arr.filter(match); if (!vis.length) return;
      if (grp) { list.append(h('button', { type: 'button', class: 'mf-grouphead', style: { '--gc': grp.color }, 'aria-expanded': String(!grp.collapsed), onclick: () => { grp.collapsed = !grp.collapsed; saveTabs(); drawList(); }, oncontextmenu: (e) => { e.preventDefault(); groupMenu(g, e.clientX, e.clientY); } }, h('span', { class: 'mf-gdot' }), h('span', { html: bi(grp.name, grp.zh || grp.name) }), h('span', { class: 'mf-gn' }, String(vis.length)))); }
      if (!grp || !grp.collapsed || q || vis.some((x) => x.k === cur)) vis.forEach((x) => list.append(tabEl(x, grp)));
    });
    const sel = list.querySelector('[aria-selected="true"]'); if (sel && !q) { try { sel.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* ignore */ } }
  }
  function tabEl(t, grp) {
    const d = all.find((x) => x.k === t.k); const title = titleOf(t, d);
    const el = h('a', { class: 'mf-tab' + (t.pinned ? ' pinned' : ''), role: 'tab', 'aria-selected': String(t.k === cur), href: abs(t.k), draggable: 'true', title, 'data-k': t.k, style: grp ? { '--gc': grp.color } : {} },
      h('span', { class: 'mf-ticon2', 'aria-hidden': 'true' }, t.pinned ? '📌' : ICON[d ? d.kind : 'page']), h('span', { class: 'mf-tlabel' }, title),
      t.pinned ? '' : h('button', { type: 'button', class: 'mf-tclose', 'aria-label': pick('Close tab: ', '關閉分頁：') + title, onclick: (e) => { e.preventDefault(); e.stopPropagation(); closeTab(t.k); } }, '×'));
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); tabMenuAt({ left: e.clientX, bottom: e.clientY }, t); });
    el.addEventListener('keydown', (e) => { if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = el.getBoundingClientRect(); tabMenuAt(r, t); } else if (e.key === 'Delete' && !t.pinned) closeTab(t.k); else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) { e.preventDefault(); moveTab(t.k, -1); } else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) { e.preventDefault(); moveTab(t.k, 1); } });
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-mar-tab', t.k); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragover', (e) => { if (Array.prototype.indexOf.call(e.dataTransfer.types, 'text/x-mar-tab') >= 0) { e.preventDefault(); el.classList.add('over'); } });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); const from = e.dataTransfer.getData('text/x-mar-tab'); if (!from || from === t.k) return; const a = tabs.findIndex((x) => x.k === from); const [m] = tabs.splice(a, 1); const b = tabs.findIndex((x) => x.k === t.k); m.group = t.group; m.pinned = t.pinned; tabs.splice(b, 0, m); saveTabs(); drawList(); play('click'); });
    el.addEventListener('click', () => play('click'));
    return el;
  }
  drawList(); strip._redraw = drawList;
}
export function openTab(k, go) { if (!tabs.some((t) => t.k === k)) { tabs.push({ k, title: k, pinned: false, group: 'Other' }); saveTabs(); } if (strip) draw(); if (go) location.href = abs(k); }
export function closeTab(k) {
  const i = tabs.findIndex((t) => t.k === k); if (i < 0 || tabs[i].pinned) return; tabs.splice(i, 1); saveTabs(); notifyMsg(MSG.tabClosed, 'info', null, { quiet: true });
  if (k === pageKey()) { const n = tabs[Math.min(i, tabs.length - 1)]; if (n) { location.href = abs(n.k); return; } } draw();
}
function moveTab(k, d) { const i = tabs.findIndex((t) => t.k === k); const j = i + d; if (i < 0 || j < 0 || j >= tabs.length) return; const [m] = tabs.splice(i, 1); tabs.splice(j, 0, m); saveTabs(); draw().then(() => { const el = strip && strip.querySelector('[data-k="' + CSS.escape(k) + '"]'); if (el) el.focus(); }); }
export function openEveryTab() { destinations().then((all) => { all.forEach((d) => { offered.add(d.k); if (!tabs.some((t) => t.k === d.k)) tabs.push({ k: d.k, title: d.en, pinned: false, group: d.kind === 'page' ? 'pages' : d.sec.en }); }); saveTabs(); draw(); notify({ en: `Every page is open as a tab (${tabs.length}).`, zh: `所有頁面都已經用分頁開咗（${tabs.length}）。` }, 'ok'); }); }
on('open-tabs', (keys) => { keys.forEach((k) => { if (!tabs.some((t) => t.k === k)) tabs.push({ k, title: k, pinned: false, group: 'Other' }); }); saveTabs(); draw(); });

function groupMenu(g, x, y) { const grp = groups[g]; if (!grp) return; ctxMenu(x, y, [{ en: 'Rename group', zh: '重新命名群組', run: () => { const n = prompt(pick('Group name', '群組名稱'), grp.name); if (n) { grp.name = n.slice(0, 30); grp.zh = n.slice(0, 30); saveTabs(); draw(); } } }, { en: 'Change colour', zh: '更改顏色', run: () => { grp.color = COLORS[(COLORS.indexOf(grp.color) + 1) % COLORS.length]; saveTabs(); draw(); } }, { en: 'Close all tabs in group', zh: '關閉群組內所有分頁', run: () => { tabs = tabs.filter((t) => t.group !== g || t.pinned); saveTabs(); draw(); } }]); }
function tabMenuAt(rect, t) {
  const x = rect.left, y = rect.bottom; const items = [];
  if (t) { items.push({ en: t.pinned ? 'Unpin tab' : 'Pin tab', zh: t.pinned ? '取消固定分頁' : '固定分頁', run: () => { t.pinned = !t.pinned; saveTabs(); draw(); } }, { en: 'Move into group...', zh: '移入群組…', run: () => moveToGroup(t) }, { en: 'Move up or left', zh: '向上或向左移', key: 'Alt+↑', run: () => moveTab(t.k, -1) }, { en: 'Move down or right', zh: '向下或向右移', key: 'Alt+↓', run: () => moveTab(t.k, 1) }, { en: 'Close tab', zh: '關閉分頁', key: 'Del', disabled: t.pinned, run: () => closeTab(t.k) }, { en: 'Close other tabs', zh: '關閉其他分頁', run: () => { tabs = tabs.filter((x) => x === t || x.pinned); saveTabs(); draw(); } }, { sep: true }); }
  items.push({ en: 'Close tabs by text...', zh: '按文字關閉分頁…', run: closeByText }, { en: 'Open every tab', zh: '開啟所有分頁', run: openEveryTab }, { en: 'Find tabs...', zh: '搜尋分頁…', run: () => openCatalog() }, { en: 'Dock strip: ' + ['left', 'right', 'top', 'bottom'][(['left', 'right', 'top', 'bottom'].indexOf(get('tabs.dock')) + 1) % 4], zh: '更改分頁列位置', run: () => set('tabs.dock', ['left', 'right', 'top', 'bottom'][(['left', 'right', 'top', 'bottom'].indexOf(get('tabs.dock')) + 1) % 4]) });
  ctxMenu(x, y, items);
}
function moveToGroup(t) {
  const names = Object.keys(groups); const body = h('div', { class: 'mf-col' }, names.map((g) => h('button', { type: 'button', class: 'mf-btn tonal', style: { borderColor: groups[g].color }, html: bi(groups[g].name, groups[g].zh || groups[g].name), onclick: () => { t.group = g; saveTabs(); draw(); $('#mf-grp').close(); } })),
    h('div', { class: 'mf-row' }, h('input', { type: 'text', class: 'mf-input', id: 'mf-newgrp', placeholder: pick('New group name', '新群組名稱'), 'aria-label': pick('New group name', '新群組名稱'), maxlength: 30 }), h('button', { type: 'button', class: 'mf-btn filled', html: bi('Create group', '建立群組'), onclick: () => { const n = $('#mf-newgrp').value.trim(); if (!n) return; groups[n] = { name: n, zh: n, color: COLORS[Object.keys(groups).length % COLORS.length], collapsed: false }; t.group = n; saveTabs(); draw(); $('#mf-grp').close(); } })));
  dialog({ id: 'mf-grp', titleEn: 'Move into group', titleZh: '移入群組', body, actions: [{ en: 'Cancel', zh: '取消', kind: 'text' }] });
}
function closeByText() {
  let mode = 'with'; const inp = h('input', { type: 'text', class: 'mf-input', 'aria-label': pick('Text to match', '要符合嘅文字') }); const prev = h('ul', { class: 'mf-notelist' }); const cnt = h('p', { class: 'mf-status', role: 'status' });
  const list = () => { const q = inp.value.trim().toLowerCase(); if (!q) return []; return tabs.filter((t) => !t.pinned && ((t.title + ' ' + t.k).toLowerCase().indexOf(q) >= 0) === (mode === 'with')); };
  const draw = () => { const l = list(); prev.textContent = ''; l.slice(0, 40).forEach((t) => prev.append(h('li', { class: 'mf-note' }, t.title))); cnt.innerHTML = bi(`${l.length} tab(s) would close. Pinned tabs are never closed.`, `會關閉 ${l.length} 個分頁，固定分頁唔會關閉。`); };
  inp.addEventListener('input', draw);
  dialog({ id: 'mf-cbt', titleEn: 'Close tabs by text', titleZh: '按文字關閉分頁', body: h('div', {}, h('label', { class: 'mf-flag' }, h('input', { type: 'radio', name: 'cbt', checked: true, onchange: () => { mode = 'with'; draw(); } }), pick('Containing', '包含')), h('label', { class: 'mf-flag' }, h('input', { type: 'radio', name: 'cbt', onchange: () => { mode = 'without'; draw(); } }), pick('Not containing', '唔包含')), inp, cnt, prev), actions: [{ en: 'Cancel', zh: '取消', kind: 'text' }, { en: 'Close these tabs', zh: '關閉呢啲分頁', kind: 'filled', onClick: () => { const l = list(); const cur = pageKey(); tabs = tabs.filter((t) => l.indexOf(t) < 0); saveTabs(); if (l.some((t) => t.k === cur) && tabs[0]) location.href = abs(tabs[0].k); else draw(); } }] }); draw();
}

/* ---------- New tab catalog ---------- */
export async function openCatalog() {
  const all = await destinations(); let scope = 'title'; const list = h('ul', { class: 'mf-pagelist' });
  const sb = searchBox({ key: 'catalog', placeholder: pick('Search every page', '搜尋所有頁面'), onChange: () => draw() });
  const scopeSel = h('select', { class: 'mf-input small', 'aria-label': pick('Search in', '搜尋範圍'), onchange: (e) => { scope = e.target.value; draw(); } }, [['title', 'Titles', '標題'], ['group', 'Group names', '群組名稱'], ['text', 'Page text', '頁面文字'], ['url', 'Addresses', '位址']].map(([v, en, zh]) => h('option', { value: v }, pick(en, zh))));
  function draw() {
    list.textContent = ''; let n = 0;
    all.forEach((d) => { const hay = scope === 'title' ? d.en + ' ' + d.zh : scope === 'group' ? d.sec.en + ' ' + d.sec.zh : scope === 'text' ? d.text : d.k; if (!sb.test(hay) || n > 160) return; n++; const open = tabs.some((t) => t.k === d.k);
      list.append(h('li', { class: 'mf-pagerow' }, h('span', { class: 'mf-ticon2', 'aria-hidden': 'true' }, ICON[d.kind]), h('a', { href: abs(d.k), class: 'mf-pagelink', onclick: () => { offered.add(d.k); if (!open) { tabs.push({ k: d.k, title: d.en, pinned: false, group: d.kind === 'page' ? 'pages' : d.sec.en }); saveTabs(); } } }, h('span', { html: bi(d.en, d.zh) })), h('span', { class: 'mf-hint' }, pick(d.sec.en, d.sec.zh)), open ? h('span', { class: 'mf-pill' }, pick('open', '已開')) : '')); });
    if (!n) list.append(h('li', { class: 'mf-empty', html: bi('No page matches.', '冇頁面符合。') }));
  }
  dialog({ id: 'mf-catalog', titleEn: 'New tab', titleZh: '新分頁', wide: true, body: h('div', {}, h('div', { class: 'mf-row' }, scopeSel), sb.el, h('p', { class: 'mf-hint', html: bi(`${all.length} pages and destinations. Choose one to open it as a tab.`, `共 ${all.length} 個頁面同目的地，揀一個用分頁開啟。`) }), list), actions: [{ en: 'Open every tab', zh: '開啟所有分頁', kind: 'tonal', onClick: openEveryTab }, { en: 'Close', zh: '關閉', kind: 'filled' }] }); draw(); play('open');
}

/* ---------- context menus ---------- */
let menu = null;
function ctxMenu(x, y, items) {
  closeMenu(); menu = h('div', { class: 'mf-menu', role: 'menu', tabindex: '-1' });
  items.forEach((it) => { if (it.sep) { menu.append(h('div', { class: 'mf-sep', role: 'separator' })); return; } menu.append(h('button', { type: 'button', role: 'menuitem', class: 'mf-mitem', disabled: it.disabled, onclick: () => { closeMenu(); it.run(); } }, h('span', { html: bi(it.en, it.zh) }), it.key ? h('kbd', {}, it.key) : '')); });
  document.body.append(menu); const r = menu.getBoundingClientRect(); menu.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px'; menu.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
  const first = menu.querySelector('button:not(:disabled)'); if (first) first.focus({ preventScroll: true });
  menu.addEventListener('keydown', (e) => { const b = $$('button:not(:disabled)', menu); const i = b.indexOf(document.activeElement); if (e.key === 'ArrowDown') { e.preventDefault(); b[(i + 1) % b.length].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); b[(i - 1 + b.length) % b.length].focus(); } else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); } else if (e.key === 'Home') { e.preventDefault(); b[0].focus(); } else if (e.key === 'End') { e.preventDefault(); b[b.length - 1].focus(); } });
  play('open');
}
function closeMenu() { if (menu) { menu.remove(); menu = null; } }
document.addEventListener('mousedown', (e) => { if (menu && !menu.contains(e.target)) closeMenu(); }); window.addEventListener('blur', closeMenu); document.addEventListener('scroll', closeMenu, true);
export const SHORTCUTS = [['Ctrl+Shift+F', 'Command palette', '命令面板'], ['Ctrl+K', 'Command palette', '命令面板'], ['Alt+Shift+B', 'Bookmark this page', '收藏呢頁'], ['Alt+Shift+N', 'Read aloud or stop', '朗讀或停止'], ['Alt+Shift+E', 'Export', '匯出'], ['Alt+Shift+T', 'New tab catalog', '新分頁目錄'], ['Alt+Shift+W', 'Close this tab', '關閉呢個分頁'], ['Alt+Shift+S', 'Saved articles', '已儲存文章'], ['Alt+Shift+H', 'Reading history', '閱讀記錄'], ['Alt+Shift+O', 'Settings', '設定'], ['Shift+F10', 'Context menu', '內容選單'], ['?', 'Show shortcuts', '顯示快速鍵']];
export function showShortcuts() { dialog({ id: 'mf-keys', titleEn: 'Keyboard shortcuts', titleZh: '鍵盤快速鍵', body: h('table', { class: 'mf-keytable' }, SHORTCUTS.map(([k, en, zh]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', { html: bi(en, zh) })))), actions: [{ en: 'Close', zh: '關閉', kind: 'filled' }] }); }
function pageMenu(x, y, target) {
  const link = target && target.closest ? target.closest('a[href]') : null; const sel = String(getSelection());
  const items = []; if (sel) items.push({ en: 'Copy selection', zh: '複製選取內容', key: 'Ctrl+C', run: () => { try { navigator.clipboard.writeText(sel); notifyMsg(MSG.copied, 'ok'); } catch (e) { /* ignore */ } } });
  if (link && link.href.indexOf(location.origin) === 0) items.push({ en: 'Open in a new tab', zh: '用新分頁開啟', run: () => { window.open(link.href, '_blank', 'noopener'); } });
  items.push({ en: isReading() ? 'Stop reading' : 'Read aloud from here', zh: isReading() ? '停止朗讀' : '由呢度開始朗讀', key: 'Alt+Shift+N', run: () => { if (isReading()) toggleReading(); else startReading(target); } },
    { en: isBookmarked() ? 'Remove bookmark' : 'Bookmark this page', zh: isBookmarked() ? '移除書籤' : '收藏呢頁', key: 'Alt+Shift+B', run: toggleBookmark }, { en: 'Export...', zh: '匯出…', key: 'Alt+Shift+E', run: openExport }, { sep: true },
    { en: 'Lock this element...', zh: '鎖住呢個元素…', run: () => lockWizard(target && target.closest ? target.closest('button,a,section,nav,aside,figure,h1,h2,h3,p,li,input,select') || target : target) }, { en: 'Command palette', zh: '命令面板', key: 'Ctrl+Shift+F', run: openPalette }, { en: 'Notifications', zh: '通知', run: openCentre }, { en: 'Settings', zh: '設定', key: 'Alt+Shift+O', run: () => { location.href = settingsHref(); } }, { en: 'Keyboard shortcuts', zh: '鍵盤快速鍵', key: '?', run: showShortcuts });
  ctxMenu(x, y, items);
}
document.addEventListener('contextmenu', (e) => { if (e.defaultPrevented || e.target.closest('input,textarea,select,[contenteditable],.mf-menu,dialog')) return; e.preventDefault(); pageMenu(e.clientX, e.clientY, e.target); });
document.addEventListener('keydown', (e) => { if ((e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) && !e.target.closest('input,textarea,select,.mf-tab,.mf-menu')) { e.preventDefault(); const t = document.activeElement && document.activeElement !== document.body ? document.activeElement : $('main'); const r = t.getBoundingClientRect(); pageMenu(r.left + 8, r.top + Math.min(r.height, 24), t); } });

/* ---------- command palette ---------- */
define({ id: 'palette.size', group: 'navigation', type: 'select', default: 'card', label: ['Command palette size', '命令面板大小'], info: ['Card is a compact panel; Full window uses the whole screen. The size is remembered.', '卡片係精簡面板，全視窗會用晒整個螢幕。大小會被記住。'], options: [['card', 'Card', '卡片'], ['full', 'Full window', '全視窗']] });
const COMMANDS = [
  ['Toggle School mode', '切換學校模式', () => setSchool(!get('school'))], ['Read this page aloud or stop', '朗讀或停止朗讀呢頁', () => toggleReading()], ['Bookmark or unbookmark this page', '收藏或取消收藏呢頁', toggleBookmark],
  ['Export...', '匯出…', openExport], ['Saved articles', '已儲存文章', openSaved], ['Reading history', '閱讀記錄', openHistory], ['Notification centre', '通知中心', openCentre], ['Changelog', '更新記錄', openChangelog], ['Update status', '更新狀態', openUpdate],
  ['New tab catalog', '新分頁目錄', () => openCatalog()], ['Open every tab', '開啟所有分頁', openEveryTab], ['Close tabs by text', '按文字關閉分頁', closeByText], ['Close this tab', '關閉呢個分頁', () => closeTab(pageKey())], ['Lock an element', '鎖住元素', pickElement], ['Show keyboard shortcuts', '顯示鍵盤快速鍵', showShortcuts],
  ['Switch to English', '轉做英文', () => setLanguage('en')], ['Switch to Cantonese', '轉做廣東話', () => setLanguage('zh')], ['Show both languages', '同時顯示兩種語言', () => setLanguage('both')], ['Open Settings', '開啟設定', () => { location.href = settingsHref(); }],
];
let palette = null;
export async function openPalette() {
  if (palette && palette.open) return; const all = await destinations();
  const rows = []; COMMANDS.forEach(([en, zh, run]) => rows.push({ kind: 'command', en, zh, sec: ['Command', '命令'], run }));
  allSettings().forEach((d) => rows.push({ kind: 'setting', en: d.label[0], zh: d.label[1], sec: ['Setting', '設定'], id: d.id, def: d, extra: d.id + ' ' + (d.group || '') }));
  all.forEach((d) => rows.push({ kind: d.kind, en: d.en, zh: d.zh, sec: [d.sec.en || 'Page', d.sec.zh || '頁面'], href: abs(d.k), extra: d.k + ' ' + d.text.slice(0, 300) }));
  let sel = 0; let shown = []; const ul = h('ul', { class: 'mf-palrows', role: 'listbox', 'aria-label': pick('Results', '結果') });
  const sb = searchBox({ key: 'palette', placeholder: pick('Search commands, pages and settings', '搜尋命令、頁面同設定'), onChange: () => draw() });
  function activate(r) {
    if (r.kind === 'command') { palette.close(); setTimeout(r.run, 30); }
    else if (r.kind === 'setting') { palette.close(); teleport(r.id); }
    else { palette.close(); location.href = r.href; }
  }
  function draw() {
    ul.textContent = ''; shown = rows.filter((r) => sb.test(r.en + ' ' + r.zh + ' ' + (r.extra || '') + ' ' + r.sec[0])).slice(0, 80); if (sel >= shown.length) sel = 0;
    if (!shown.length) ul.append(h('li', { class: 'mf-empty', html: bi('Nothing matches.', '冇符合嘅結果。') }));
    shown.forEach((r, i) => {
      const locked = r.kind === 'setting' && settingLockedBy(r.id); const li = h('li', { class: 'mf-palrow' + (i === sel ? ' sel' : ''), role: 'option', 'aria-selected': String(i === sel), id: 'mf-pr-' + i });
      li.append(h('span', { class: 'mf-ticon2', 'aria-hidden': 'true' }, ICON[r.kind] || ICON.page), h('span', { class: 'mf-prlabel', html: bi(r.en, r.zh) }), h('span', { class: 'mf-hint' }, (locked ? '🔒 ' : '') + pick(r.sec[0], r.sec[1])));
      if (r.kind === 'setting' && !locked) { const d = r.def; const cur = d.read ? d.read() : get(d.id); if (d.type === 'toggle') li.append(h('input', { type: 'checkbox', class: 'mf-livecb', checked: !!cur, 'aria-label': pick(d.label[0], d.label[1]), onclick: (e) => e.stopPropagation(), onchange: (e) => set(d.id, e.target.checked) })); else if (d.type === 'select' && typeof d.options !== 'function') li.append(h('select', { class: 'mf-input small', 'aria-label': pick(d.label[0], d.label[1]), onclick: (e) => e.stopPropagation(), onchange: (e) => set(d.id, e.target.value) }, d.options.map(([v, en, zh]) => h('option', { value: v, selected: v === cur }, pick(en, zh))))); }
      li.addEventListener('click', () => activate(r)); li.addEventListener('mousemove', () => { if (sel !== i) { sel = i; mark(); } }); ul.append(li);
    });
  }
  function mark() { $$('.mf-palrow', ul).forEach((li, i) => { li.classList.toggle('sel', i === sel); li.setAttribute('aria-selected', String(i === sel)); }); const s = $('.mf-palrow.sel', ul); if (s) { sb.input.setAttribute('aria-activedescendant', s.id); s.scrollIntoView({ block: 'nearest' }); } }
  const sizeBtn = h('button', { type: 'button', class: 'mf-btn text', html: bi('Card / full window', '卡片 / 全視窗'), onclick: () => { set('palette.size', get('palette.size') === 'full' ? 'card' : 'full'); palette.classList.toggle('full', get('palette.size') === 'full'); } });
  palette = dialog({ id: 'mf-palette', titleEn: 'Command palette', titleZh: '命令面板', wide: true, body: h('div', {}, sb.el, ul, h('div', { class: 'mf-row' }, sizeBtn, h('span', { class: 'mf-hint', html: bi('Up and Down to move, Enter to go there, Esc to close.', '上下鍵移動，Enter 前往，Esc 關閉。') }))), actions: [] });
  palette.classList.add('mf-palette'); palette.classList.toggle('full', get('palette.size') === 'full');
  palette.addEventListener('keydown', (e) => { if (e.target.closest('.mf-rx') || e.target.tagName === 'SELECT' && e.key.length > 1 && e.key !== 'Enter') { if (e.key !== 'Enter') return; } if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); } else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); } else if (e.key === 'Enter' && e.target === sb.input && shown[sel]) { e.preventDefault(); activate(shown[sel]); } });
  draw(); sb.focus(); play('open');
}
/** Take the reader to the exact element: the settings page, then scroll, focus and highlight. */
export function teleport(id) {
  const row = document.getElementById('setting-' + id);
  if (!row) { location.href = settingsHref(id); return; }
  const tab = row.closest('[data-pane]'); if (tab) emit('show-pane', tab.getAttribute('data-pane'));
  row.scrollIntoView({ block: 'center', behavior: motionOk() ? 'smooth' : 'auto' }); row.classList.add('mf-hl'); setTimeout(() => row.classList.remove('mf-hl'), 2600);
  const f = row.querySelector('input,select,button,textarea'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 120);
}

/* ---------- shortcuts ---------- */
document.addEventListener('keydown', (e) => {
  const typing = e.target.closest && e.target.closest('input,textarea,select,[contenteditable]'); const k = e.key.toLowerCase();
  if (((e.ctrlKey || e.metaKey) && e.shiftKey && k === 'f') || ((e.ctrlKey || e.metaKey) && !e.shiftKey && k === 'k')) { e.preventDefault(); e.stopImmediatePropagation(); openPalette(); return; }
  if (e.altKey && e.shiftKey && !e.ctrlKey) { const map = { b: toggleBookmark, n: toggleReading, e: openExport, t: () => openCatalog(), w: () => closeTab(pageKey()), s: openSaved, h: openHistory, o: () => { location.href = settingsHref(); } }; if (map[k]) { e.preventDefault(); map[k](); return; } }
  if (!typing && e.key === '?' && !e.ctrlKey && !e.altKey) { e.preventDefault(); showShortcuts(); }
}, true);

/* ---------- the floating tool dock ---------- */
function dock() {
  const bell = h('span', { class: 'mf-bell' }, '🔔', h('span', { id: 'mf-bell-count', class: 'mf-badge', hidden: true }));
  const items = [
    [bell, 'Notifications', '通知', openCentre], ['⌨️', 'Command palette', '命令面板', openPalette], ['⚙️', 'Settings', '設定', () => { location.href = settingsHref(); }],
    ['🔊', 'Read aloud', '朗讀', toggleReading], ['🔖', 'Bookmark', '收藏', toggleBookmark], ['📤', 'Export', '匯出', openExport], ['🗂️', 'Saved articles', '已儲存文章', openSaved], ['🕓', 'History', '記錄', openHistory],
    ['➕', 'New tab', '新分頁', () => openCatalog()], ['📋', 'Changelog', '更新記錄', openChangelog], ['🔄', 'Update status', '更新狀態', openUpdate], ['📑', 'Show or hide tabs', '顯示或隱藏分頁列', () => { const s = $('.mf-tabs'); if (s) s.classList.toggle('open'); else set('tabs.on', true); }],
  ];
  const list = h('div', { class: 'mf-dockitems', id: 'mf-dockitems', hidden: true }, items.map(([ic, en, zh, run]) => h('button', { type: 'button', class: 'mf-dockbtn', onclick: () => { run(); } }, h('span', { class: 'mf-dockic', 'aria-hidden': 'true' }, ic), h('span', { class: 'mf-docklab', html: bi(en, zh) }))));
  const main = h('button', { type: 'button', class: 'mf-dockmain', 'aria-expanded': 'false', 'aria-controls': 'mf-dockitems', 'aria-label': pick('Site tools', '網站工具'), onclick: () => { const open = list.hidden; list.hidden = !open; main.setAttribute('aria-expanded', String(open)); play(open ? 'open' : 'close'); } }, h('span', { 'aria-hidden': 'true' }, '✨'));
  const el = h('div', { class: 'mf-dock' }, list, main); document.body.append(el);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !list.hidden) { list.hidden = true; main.setAttribute('aria-expanded', 'false'); main.focus(); } });
  document.addEventListener('click', (e) => { if (!el.contains(e.target) && !list.hidden) { list.hidden = true; main.setAttribute('aria-expanded', 'false'); } });
  refreshBadge();
}
export async function initNav() {
  dock(); await ensureOffered(); root.toggleAttribute('data-mf-tabs', !!get('tabs.on')); root.setAttribute('data-mf-dock', get('tabs.dock')); build();
  document.addEventListener('mar:lang', () => { if (strip) draw(); });
  on('bookmarks', () => { /* dock icons are static; the menu reads fresh state */ });
}
