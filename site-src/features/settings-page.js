/* The Settings page: task-oriented groups, its own search with an adjacent regex builder, an info button, a star and a reset on every control. */
import { root, h, bi, $, $$, allSettings, settingDef, get, set, reset, resetAll, store, pick, on, say, dialog, download, readFileText, clamp, motionOk } from './core.js';
import { MSG } from './strings.js';
import { notify, notifyMsg } from './notify.js';
import { searchBox } from './rx.js';
import { play } from './sound.js';
import { teleport } from './nav.js';

const GROUPS = [
  ['voice', 'Language and voice', '語言同語氣', 'Choose how the site speaks: language, how playful it sounds, your own wording and the product name.', '決定網站點樣講嘢：語言、幾好玩、你自己嘅用字同產品名稱。'],
  ['narration', 'Reading aloud', '朗讀', 'Have pages read to you in English, Cantonese or both.', '等頁面讀俾你聽，可以用英文、廣東話或者兩種。'],
  ['sound', 'Sounds', '音效', 'Short, quiet sounds for actions.', '操作嗰陣有簡短輕柔嘅音效。'],
  ['comfort', 'Comfort and focus', '舒適同專注', 'School mode, the five reading comfort modes and the dim sum surprise.', '學校模式、五個閱讀舒適模式同點心驚喜。'],
  ['schedule', 'Schedules', '定時設定', 'Switch comfort settings on and off by time.', '按時間自動開關舒適設定。'],
  ['appearance', 'Look and colours', '外觀同顏色', 'Edit colours, shapes and spacing, pick or translate any colour, and change the logo.', '改顏色、形狀同間距，揀或者轉換任何顏色，同埋更換標誌。'],
  ['motion', 'Motion', '動態', 'Tune every animation and transition.', '調校每一個動畫同過渡。'],
  ['access', 'Reading and accessibility', '閱讀同無障礙', 'Text size, spacing, contrast and touch targets.', '文字大小、間距、對比同觸控目標。'],
  ['navigation', 'Tabs and navigation', '分頁同導航', 'Tabs, the command palette and shortcuts.', '分頁、命令面板同快速鍵。'],
  ['records', 'Saved things and exports', '儲存同匯出', 'History, bookmarks, exports, the changelog and update status.', '記錄、書籤、匯出、更新記錄同更新狀態。'],
  ['safety', 'Locks', '鎖', 'Toy locks for buttons, panels and settings, with the unlock ladder.', '用玩具鎖鎖住掣、面板同設定，連同解鎖階梯。'],
];
const UNITS = { '%': '%', ' px': ' px' };
let favs = store.get('favs', []);

function control(d, wrap) {
  const read = () => (d.read ? d.read() : get(d.id));
  if (d.type === 'toggle') {
    const b = h('button', { type: 'button', class: 'mf-switch', role: 'switch', 'aria-label': pick(d.label[0], d.label[1]), 'aria-checked': String(!!read()), onclick: () => { set(d.id, !read()); } });
    wrap.append(h('div', { class: 'mf-row' }, b)); return () => b.setAttribute('aria-checked', String(!!read()));
  }
  if (d.type === 'range') {
    const o = h('output', { class: 'mf-out' }); const i = h('input', { type: 'range', min: d.min, max: d.max, step: d.step || 1, value: read(), 'aria-label': pick(d.label[0], d.label[1]), oninput: () => { o.textContent = i.value + (d.unit || ''); set(d.id, Number(i.value)); prev(); } });
    const pv = h('p', { class: 'mf-preview', 'aria-live': 'polite' }); const prev = () => { if (d.preview) { const m = say(MSG.saved); pv.textContent = d.preview === 'zh' ? m.zh : m.en; pv.setAttribute('lang', d.preview === 'zh' ? 'zh-HK' : 'en'); } };
    o.textContent = i.value + (d.unit || ''); wrap.append(h('div', { class: 'mf-row' }, i, o), d.preview ? pv : ''); prev(); return () => { i.value = read(); o.textContent = i.value + (d.unit || ''); prev(); };
  }
  if (d.type === 'select') {
    const s = h('select', { class: 'mf-input', 'aria-label': pick(d.label[0], d.label[1]), onchange: () => set(d.id, s.value) });
    const fill = () => { const cur = read(); s.textContent = ''; (typeof d.options === 'function' ? d.options() : d.options).forEach(([v, en, zh]) => s.append(h('option', { value: v, selected: v === cur }, pick(en, zh)))); s.value = cur; };
    fill(); wrap.append(h('div', { class: 'mf-row' }, s)); on('voices', fill); return fill;
  }
  if (d.type === 'text') {
    const i = h('input', { type: 'text', class: 'mf-input', maxlength: d.maxlength || 60, placeholder: d.placeholder || '', value: read() || '', 'aria-label': pick(d.label[0], d.label[1]) });
    wrap.append(h('div', { class: 'mf-row' }, i, h('button', { type: 'button', class: 'mf-btn filled', html: bi('Apply', '套用'), onclick: () => { set(d.id, i.value.trim()); notifyMsg(MSG.saved, 'ok'); } }))); return () => { i.value = read() || ''; };
  }
  if (d.type === 'action') { wrap.append(h('div', { class: 'mf-row' }, h('button', { type: 'button', class: 'mf-btn filled', html: bi(d.label[0], d.label[1]), onclick: () => d.run() }))); return null; }
  if (d.type === 'custom' && d.render) { d.render(wrap); return null; }
  return null;
}

export function renderSettings(host) {
  host.textContent = ''; const updaters = new Map();
  const rows = []; let showPane = 'all';
  const sb = searchBox({ key: 'settings', placeholder: pick('Search every setting', '搜尋所有設定'), onChange: () => filter() });
  const summary = h('p', { class: 'mf-status', role: 'status', 'aria-live': 'polite' });
  const tabList = h('div', { class: 'mf-tabbar', role: 'tablist', 'aria-label': pick('Setting groups', '設定群組') });
  const pane = (id, en, zh) => h('button', { type: 'button', role: 'tab', class: 'mf-tabbtn', 'data-p': id, 'aria-selected': String(id === showPane), onclick: () => select(id) }, h('span', { html: bi(en, zh) }));
  tabList.append(pane('all', 'All', '全部'), pane('fav', 'Favourites', '最愛'), ...GROUPS.map((g) => pane(g[0], g[1], g[2])));
  function select(id) { showPane = id; $$('.mf-tabbtn', tabList).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.p === id))); filter(); }
  on('show-pane', (id) => select('all'));
  const body = h('div', { class: 'mf-groups' });
  const defs = allSettings();
  GROUPS.forEach(([gid, en, zh, ien, izh]) => {
    const list = defs.filter((d) => d.group === gid); if (!list.length) return;
    const sec = h('section', { class: 'mf-group reveal in', 'data-pane': gid, 'aria-labelledby': 'g-' + gid }, h('h2', { id: 'g-' + gid, html: bi(en, zh) }), h('p', { class: 'mf-hint', html: bi(ien, izh, true) }));
    list.forEach((d) => {
      const infoId = 'info-' + d.id.replace(/\W/g, '-');
      const infoBtn = h('button', { type: 'button', class: 'mf-icon', 'aria-expanded': 'false', 'aria-controls': infoId, 'aria-label': pick('About: ', '關於：') + pick(d.label[0], d.label[1]), title: pick('What does this do?', '呢個有咩用？'), onclick: () => { const p = $('#' + infoId); p.hidden = !p.hidden; infoBtn.setAttribute('aria-expanded', String(!p.hidden)); } }, 'i');
      const star = h('button', { type: 'button', class: 'mf-icon', 'aria-pressed': String(favs.indexOf(d.id) >= 0), 'aria-label': pick('Favourite: ', '最愛：') + pick(d.label[0], d.label[1]), title: pick('Add to Favourites', '加入最愛'), onclick: () => { favs = favs.indexOf(d.id) >= 0 ? favs.filter((x) => x !== d.id) : favs.concat(d.id); store.set('favs', favs); star.setAttribute('aria-pressed', String(favs.indexOf(d.id) >= 0)); filter(); } }, '★');
      const rst = d.type === 'action' ? '' : h('button', { type: 'button', class: 'mf-btn text', html: bi('Reset', '重設'), 'aria-label': pick('Reset: ', '重設：') + pick(d.label[0], d.label[1]), onclick: () => { reset(d.id); notifyMsg(MSG.reset, 'info'); const u = updaters.get(d.id); if (u) u(); } });
      const row = h('div', { class: 'mf-set', id: 'setting-' + d.id, 'data-setting': d.id }, h('div', { class: 'mf-sethead' }, h('h3', { html: bi(d.label[0], d.label[1]) }), h('span', { class: 'mf-setbtns' }, infoBtn, star, rst)), h('p', { class: 'mf-info', id: infoId, hidden: true, html: bi(d.info[0], d.info[1], true) }));
      const u = control(d, row); if (u) updaters.set(d.id, u); sec.append(row);
      rows.push({ d, row, sec, text: d.label.join(' ') + ' ' + d.info.join(' ') + ' ' + d.id + ' ' + gid + ' ' + en + ' ' + zh });
    });
    body.append(sec);
  });
  on('setting', (e) => { const u = updaters.get(e.id); if (u) u(); });
  function filter() {
    const q = sb.state.q.trim(); let shown = 0; const secs = new Set();
    rows.forEach((r) => {
      const inPane = showPane === 'all' || (showPane === 'fav' ? favs.indexOf(r.d.id) >= 0 : r.d.group === showPane); const hit = sb.test(r.text);
      const vis = inPane && hit; r.row.hidden = !vis; if (vis) { shown++; secs.add(r.sec); }
    });
    $$('.mf-group', body).forEach((s) => { s.hidden = !secs.has(s); });
    summary.innerHTML = bi(`${shown} of ${rows.length} settings shown${q ? ' for your search' : ''}.`, `顯示 ${shown} / ${rows.length} 項設定${q ? '（符合搜尋）' : ''}。`);
    if (!shown) summary.innerHTML += ' ' + bi('Nothing matches. Clear the search or pick another group.', '冇符合嘅設定，請清除搜尋或者揀另一個群組。');
  }
  const impInput = h('input', { type: 'file', accept: '.json,application/json', class: 'mf-visually-hidden', id: 'mf-set-import', onchange: () => { const f = impInput.files[0]; if (f) importAll(f); impInput.value = ''; } });
  const tools = h('div', { class: 'mf-row' },
    h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Export all settings', '匯出全部設定'), onclick: exportAll }),
    h('label', { class: 'mf-btn tonal', for: 'mf-set-import', tabindex: '0', role: 'button', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); impInput.click(); } } }, h('span', { html: bi('Import settings', '匯入設定') })), impInput,
    h('button', { type: 'button', class: 'mf-btn text', html: bi('Reset every setting', '重設所有設定'), onclick: () => dialog({ id: 'mf-resetall', titleEn: 'Reset every setting?', titleZh: '重設所有設定？', body: h('p', { html: bi('This puts every setting on this page back to its default in this browser. History, bookmarks and locks are not touched.', '呢個會將呢頁所有設定還原做預設值（只限呢個瀏覽器）。閱讀記錄、書籤同鎖唔會受影響。') }), actions: [{ en: 'Cancel', zh: '取消', kind: 'text' }, { en: 'Reset everything', zh: '全部重設', kind: 'filled', onClick: () => { allSettings().filter((d) => d.group !== 'safety' && d.type !== 'action').forEach((d) => reset(d.id)); notifyMsg(MSG.reset, 'info'); renderSettings(host); } }] }) }));
  host.append(h('div', { class: 'mf-settop' }, sb.el, tools, tabList, summary), body); filter();
  if (location.hash.indexOf('#setting-') === 0) { const id = decodeURIComponent(location.hash.slice(9)); setTimeout(() => teleport(id), 250); }
}
const SKIP_EXPORT = ['locks', 'school', 'sched', 'vocab', 'colorpicker'];
function exportAll() {
  const out = { version: 1, exportedAt: new Date().toISOString(), settings: {} };
  allSettings().forEach((d) => { if (d.type === 'action' || SKIP_EXPORT.indexOf(d.id) >= 0) return; const v = store.get('s.' + d.id, undefined); if (v !== undefined) out.settings[d.id] = v; });
  download('site-settings.json', JSON.stringify(out, null, 2), 'application/json'); notifyMsg(MSG.exported, 'ok', { name: 'site-settings.json' });
}
function importAll(file) {
  readFileText(file, 200000).then((t) => {
    const j = JSON.parse(t); if (!j || typeof j.settings !== 'object') throw new Error('bad'); let n = 0; let reload = false;
    Object.keys(j.settings).forEach((id) => { const d = settingDef(id); const v = j.settings[id]; if (!d || d.type === 'action' || SKIP_EXPORT.indexOf(id) >= 0) return;
      if (d.type === 'toggle' && typeof v === 'boolean') { set(id, v, { force: true }); n++; }
      else if (d.type === 'range' && typeof v === 'number') { set(id, clamp(v, d.min, d.max), { force: true }); n++; }
      else if (d.type === 'select' && typeof d.options !== 'function' && d.options.some((o) => o[0] === v)) { set(id, v, { force: true }); n++; }
      else if (d.type === 'select' && typeof v === 'string' && v.length < 200) { set(id, v, { force: true }); n++; }
      else if (d.type === 'text' && typeof v === 'string' && v.length <= (d.maxlength || 60)) { set(id, v, { force: true }); n++; }
      else if (d.type === 'custom' && ['appearance', 'anim', 'logo'].indexOf(id) >= 0 && v && typeof v === 'object') { store.set('s.' + id, v); reload = true; n++; } });
    if (!n) throw new Error('empty'); notifyMsg(MSG.imported, 'ok'); if (reload) setTimeout(() => location.reload(), 600);
  }).catch(() => notifyMsg(MSG.invalid, 'error'));
}
