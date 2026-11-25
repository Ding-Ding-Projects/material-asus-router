/* Records: reading history, bookmarks with bulk actions, exports in four formats, changelog, update progress and provenance. */
import { root, h, bi, $, $$, define, get, set, store, lang, pick, say, on, emit, esc, dialog, download, readFileText, loadIndex, siteRoot, motionOk } from './core.js';
import { MSG } from './strings.js';
import { notify, notifyMsg } from './notify.js';
import { play } from './sound.js';
import { searchBox } from './rx.js';

const REPO = 'Ding-Ding-Projects/material-asus-router';
const base = () => new URL(siteRoot(), location.href).pathname;
export const pageKey = () => { let p = location.pathname; const b = base(); if (p.indexOf(b) === 0) p = p.slice(b.length); p = p.replace(/index\.html$/, ''); return p || 'index.html'; };
export const pageTitle = () => (document.title || '').replace(/\s*\|\s*Material Asus Router\s*$/, '') || 'Material Asus Router';

/* ---------- history, reading position ---------- */
define({ id: 'history.on', group: 'records', type: 'toggle', default: true, label: ['Keep a reading history', '保留閱讀記錄'], info: ['Remembers which pages you opened, only in this browser. Turn it off to stop recording; existing entries stay until you clear them.', '只喺呢個瀏覽器記住你開過邊啲頁面。關閉就唔再記錄，已有記錄會保留直到你清除。'] });
define({ id: 'history.restore', group: 'records', type: 'toggle', default: true, label: ['Offer to continue where I stopped', '提示我由上次位置繼續睇'], info: ['When you return to a guide, offers to jump to the place you reached. Nothing scrolls by itself.', '返到某篇指南時，提示你跳去上次睇到嘅位置，唔會自己捲動。'] });
export const history = () => store.get('history', []);
function recordVisit() {
  if (!get('history.on') || /settings\.html$/.test(location.pathname)) return;
  const l = history(); const k = pageKey(); if (l.length && l[0].k === k) { l[0].t = Date.now(); } else { l.unshift({ k, title: pageTitle(), t: Date.now() }); }
  store.set('history', l.slice(0, 200));
}
function savePos() { const k = pageKey(); if (!$('.article')) return; const max = document.documentElement.scrollHeight - innerHeight; if (max < 400) return; const f = scrollY / max; if (f > 0.05 && f < 0.97) store.set('pos.' + k, f); else store.del('pos.' + k); }
window.addEventListener('pagehide', savePos); document.addEventListener('visibilitychange', () => { if (document.hidden) savePos(); });
function offerRestore() {
  if (!get('history.restore') || location.hash || !$('.article')) return; const f = store.get('pos.' + pageKey(), 0); if (!f) return;
  const card = h('div', { class: 'mf-resume', role: 'status' }, h('span', { html: bi(`Continue where you stopped (${Math.round(f * 100)}%)?`, `由上次位置（${Math.round(f * 100)}%）繼續睇？`) }),
    h('button', { type: 'button', class: 'mf-btn filled', html: bi('Continue', '繼續'), onclick: () => { scrollTo({ top: f * (document.documentElement.scrollHeight - innerHeight), behavior: motionOk() ? 'smooth' : 'auto' }); card.remove(); } }),
    h('button', { type: 'button', class: 'mf-btn text', html: bi('Dismiss', '關閉'), onclick: () => card.remove() }));
  document.body.append(card); setTimeout(() => card.remove(), 12000);
}

/* ---------- bookmarks ---------- */
export const bookmarks = () => store.get('bookmarks', []);
export const isBookmarked = (k) => bookmarks().some((b) => b.k === (k || pageKey()));
export function toggleBookmark() {
  const l = bookmarks(); const k = pageKey(); const i = l.findIndex((b) => b.k === k);
  if (i >= 0) { l.splice(i, 1); notifyMsg(MSG.bookmarkOff, 'info'); } else { l.unshift({ k, title: pageTitle(), t: Date.now() }); notifyMsg(MSG.bookmarkOn, 'ok'); }
  store.set('bookmarks', l); emit('bookmarks'); return i < 0;
}
const urlOf = (k) => siteRoot() + (k === 'index.html' ? '' : k);

/* ---------- markdown conversion and export ---------- */
function inline(n) {
  if (n.nodeType === 3) return n.nodeValue.replace(/\s+/g, ' ');
  if (n.nodeType !== 1) return ''; const t = n.tagName.toLowerCase(); const kids = () => Array.prototype.map.call(n.childNodes, inline).join('');
  if (t === 'code') return '`' + n.textContent + '`'; if (t === 'strong' || t === 'b') return '**' + kids() + '**'; if (t === 'em' || t === 'i') return '*' + kids() + '*';
  if (t === 'a') return '[' + kids() + '](' + (n.href || '') + ')'; if (t === 'br') return '  \n'; if (t === 'img') return '![' + (n.alt || '') + '](' + (n.src || '') + ')';
  if (n.classList && (n.classList.contains('copy') || n.hasAttribute('data-copy-code'))) return ''; return kids();
}
function block(n, depth) {
  const t = n.tagName.toLowerCase(); const txt = () => Array.prototype.map.call(n.childNodes, inline).join('').trim();
  if (/^h[1-6]$/.test(t)) return '#'.repeat(Number(t[1])) + ' ' + txt() + '\n\n';
  if (t === 'p') return txt() + '\n\n'; if (t === 'hr') return '---\n\n'; if (t === 'blockquote') return txt().split('\n').map((l) => '> ' + l).join('\n') + '\n\n';
  if (t === 'pre') { const c = n.querySelector('code'); return '```\n' + (c || n).textContent.replace(/\n$/, '') + '\n```\n\n'; }
  if (t === 'ul' || t === 'ol') return Array.prototype.map.call(n.children, (li, i) => '  '.repeat(depth) + (t === 'ol' ? i + 1 + '. ' : '- ') + Array.prototype.map.call(li.childNodes, (c) => (c.nodeType === 1 && /^(ul|ol)$/i.test(c.tagName) ? '\n' + block(c, depth + 1).replace(/\n+$/, '') : inline(c))).join('').trim()).join('\n') + '\n\n';
  if (t === 'table') { const rows = Array.prototype.map.call(n.querySelectorAll('tr'), (r) => '| ' + Array.prototype.map.call(r.children, (c) => c.textContent.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')).join(' | ') + ' |'); if (rows.length) { const cols = (rows[0].match(/\|/g) || []).length - 1; rows.splice(1, 0, '|' + ' --- |'.repeat(cols)); } return rows.join('\n') + '\n\n'; }
  if (t === 'figure') { const c = n.querySelector('pre'); return c ? block(c, depth) : Array.prototype.map.call(n.children, (x) => block(x, depth)).join(''); }
  if (t === 'div' || t === 'section' || t === 'details') return Array.prototype.map.call(n.children, (x) => block(x, depth)).join('');
  return txt() ? txt() + '\n\n' : '';
}
export function toMarkdown(container) { return Array.prototype.map.call(container.children, (x) => block(x, 0)).join('').replace(/\n{3,}/g, '\n\n').trim() + '\n'; }

function currentDoc() {
  const h1 = $('.article h1') || $('h1'); const title = (h1 ? ((h1.querySelector('.en') || h1).textContent) : pageTitle()).replace(/\s+/g, ' ').trim();
  const en = $('.prose.body-en'), zh = $('.prose.body-zh'); const bodies = [];
  if (en) bodies.push({ code: 'en', node: en }); if (zh) bodies.push({ code: 'zh-HK', node: zh });
  if (!bodies.length) { const m = $('main'); if (m) bodies.push({ code: 'en', node: m }); }
  return { key: pageKey(), title, url: location.href.split('#')[0], bodies };
}
function docMarkdown(d) { return '# ' + d.title + '\n\n' + 'Source: ' + d.url + '\n\n' + d.bodies.map((b, i) => (d.bodies.length > 1 ? '<!-- ' + b.code + ' -->\n\n' : '') + toMarkdown(b.node)).join('\n---\n\n'); }
const PAGE_CSS = 'body{font:16px/1.6 system-ui,"Microsoft JhengHei",sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#1b1b1f}pre,code{font-family:ui-monospace,Consolas,monospace}pre{background:#f1f1f4;padding:.8rem;overflow:auto;border-radius:8px}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:.3rem .6rem}img{max-width:100%}h1,h2,h3{line-height:1.25}article{break-after:page}@media print{body{margin:0}pre{white-space:pre-wrap}}';
function docHtml(list, title) { return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title><style>' + PAGE_CSS + '</style></head><body>' + list.map((d) => '<article><h1>' + esc(d.title) + '</h1><p><a href="' + esc(d.url) + '">' + esc(d.url) + '</a></p>' + d.bodies.map((b) => '<div lang="' + b.code + '">' + b.node.innerHTML + '</div>').join('<hr>') + '</article>').join('') + '</body></html>'; }
function docJson(list) { return JSON.stringify({ exportedAt: new Date().toISOString(), source: 'Material Asus Router documentation', documents: list.map((d) => ({ key: d.key, title: d.title, url: d.url, languages: d.bodies.map((b) => ({ lang: b.code, markdown: toMarkdown(b.node), text: b.node.textContent.replace(/\s+/g, ' ').trim() })) })) }, null, 2); }
function printHtml(html) {
  const f = h('iframe', { class: 'mf-printframe', 'aria-hidden': 'true', tabindex: '-1', srcdoc: html }); document.body.append(f);
  f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { notifyMsg(MSG.error, 'error', { why: 'print' }); } setTimeout(() => f.remove(), 60000); };
}
export function deliver(list, format, nameBase) {
  if (!list.length) { notify({ en: 'Nothing to export.', zh: '冇嘢可以匯出。' }, 'warn'); return; }
  const stamp = new Date().toISOString().slice(0, 10); let name;
  if (format === 'md') { name = nameBase + '.md'; download(name, list.map(docMarkdown).join('\n\n---\n\n'), 'text/markdown'); }
  else if (format === 'html') { name = nameBase + '.html'; download(name, docHtml(list, nameBase), 'text/html'); }
  else if (format === 'json') { name = nameBase + '.json'; download(name, docJson(list), 'application/json'); }
  else { name = nameBase + '.pdf (print dialog)'; printHtml(docHtml(list, nameBase)); notify({ en: 'In the print dialog, choose Save as PDF.', zh: '喺列印視窗揀「儲存為 PDF」。' }, 'info', { quiet: true }); }
  notifyMsg(MSG.exported, 'ok', { name: name + ' ' + stamp }); play('success');
}
async function fetchDoc(entry) {
  const r = await fetch(siteRoot() + entry.u); if (!r.ok) throw new Error('HTTP ' + r.status); const dom = new DOMParser().parseFromString(await r.text(), 'text/html'); const bodies = [];
  const en = dom.querySelector('.prose.body-en'), zh = dom.querySelector('.prose.body-zh'); if (en) bodies.push({ code: 'en', node: en }); if (zh) bodies.push({ code: 'zh-HK', node: zh });
  return { key: entry.u, title: entry.t, url: new URL(entry.u, new URL(siteRoot(), location.href)).href, bodies };
}
export async function exportEverything(format) {
  const idx = (await loadIndex()).filter((e) => e.k === 'article' || e.k === 'wiki'); const out = []; let n = 0; const total = idx.length;
  notify({ en: `Collecting ${total} pages...`, zh: `正在收集 ${total} 頁...` }, 'info', { quiet: true });
  try { for (let i = 0; i < idx.length; i += 6) { const part = await Promise.all(idx.slice(i, i + 6).map(fetchDoc)); part.forEach((p) => { if (p.bodies.length) out.push(p); }); n += part.length; } } catch (e) { notifyMsg(MSG.error, 'error', { why: 'could not load every page (' + (e.message || 'error') + '). This works from the published site, not from a local file.' }); return; }
  deliver(out, format, 'material-asus-router-docs-all');
}
export async function exportBookmarked(format, keys) {
  const idx = await loadIndex(); const sel = (keys || bookmarks().map((b) => b.k)); const list = [];
  for (const k of sel) { const e = idx.find((x) => x.u === k); if (!e) continue; try { list.push(await fetchDoc(e)); } catch (er) { /* skip unreachable page */ } }
  deliver(list, format, 'material-asus-router-saved');
}
export function openExport() {
  let scope = 'page', fmt = 'md';
  const radio = (name, val, en, zh, checked, cb) => h('label', { class: 'mf-flag' }, h('input', { type: 'radio', name, value: val, checked, onchange: () => cb(val) }), h('span', { html: bi(en, zh) }));
  dialog({ id: 'mf-export', titleEn: 'Export', titleZh: '匯出', body: h('div', {}, h('fieldset', { class: 'mf-fs' }, h('legend', { html: bi('What to export', '匯出咩') }), radio('sc', 'page', 'This page', '呢一頁', true, (v) => { scope = v; }), radio('sc', 'saved', 'My saved articles', '我儲存嘅文章', false, (v) => { scope = v; }), radio('sc', 'all', 'All guides and wiki pages', '所有指南同維基頁面', false, (v) => { scope = v; })),
    h('fieldset', { class: 'mf-fs' }, h('legend', { html: bi('Format', '格式') }), radio('fm', 'md', 'Markdown', 'Markdown', true, (v) => { fmt = v; }), radio('fm', 'html', 'HTML', 'HTML', false, (v) => { fmt = v; }), radio('fm', 'json', 'JSON', 'JSON', false, (v) => { fmt = v; }), radio('fm', 'pdf', 'PDF (through your print dialog)', 'PDF（經列印視窗）', false, (v) => { fmt = v; })),
    h('p', { class: 'mf-hint', html: bi('Everything is made in your browser. Nothing is uploaded.', '全部喺你嘅瀏覽器製作，唔會上傳任何嘢。') })),
    actions: [{ en: 'Cancel', zh: '取消', kind: 'text' }, { en: 'Export', zh: '匯出', kind: 'filled', onClick: () => { if (scope === 'page') deliver([currentDoc()], fmt, 'material-asus-router-' + pageKey().replace(/[^\w-]+/g, '-').replace(/-+$/, '')); else if (scope === 'saved') exportBookmarked(fmt); else exportEverything(fmt); } }] });
}
define({ id: 'export.open', group: 'records', type: 'action', label: ['Export articles', '匯出文章'], info: ['Export this page, your saved articles or every guide and wiki page as Markdown, HTML, JSON or PDF. All of it is made in this browser.', '將呢頁、你儲存嘅文章或者全部指南同維基頁面匯出為 Markdown、HTML、JSON 或 PDF。全部喺呢個瀏覽器入面製作。'], run: openExport });

/* ---------- saved articles dialog with bulk actions ---------- */
export function openSaved() {
  const sel = new Set(); const rows = h('ul', { class: 'mf-notelist' });
  const sb = searchBox({ key: 'saved', placeholder: pick('Search saved articles', '搜尋已儲存文章'), onChange: () => draw() });
  function draw() {
    rows.textContent = ''; const l = bookmarks().filter((b) => sb.test(b.title + ' ' + b.k));
    if (!l.length) rows.append(h('li', { class: 'mf-empty', html: bi('No saved articles. Press Alt+B on a page to save it.', '冇已儲存文章。喺頁面按 Alt+B 就可以儲存。') }));
    l.forEach((b) => rows.append(h('li', { class: 'mf-note' }, h('input', { type: 'checkbox', checked: sel.has(b.k), 'aria-label': pick('Select ', '選取 ') + b.title, onchange: (e) => { if (e.target.checked) sel.add(b.k); else sel.delete(b.k); } }), h('div', { class: 'mf-notebody' }, h('a', { href: urlOf(b.k) }, b.title), h('time', { datetime: new Date(b.t).toISOString() }, new Date(b.t).toLocaleString())))));
  }
  const chosen = () => (sel.size ? Array.from(sel) : bookmarks().map((b) => b.k));
  const tb = h('div', { class: 'mf-row' },
    h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Select all', '全選'), onclick: () => { bookmarks().forEach((b) => sel.add(b.k)); draw(); } }), h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Select none', '全不選'), onclick: () => { sel.clear(); draw(); } }),
    h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Open in tabs', '用分頁開啟'), onclick: () => { emit('open-tabs', chosen()); notify({ en: 'Opened in tabs.', zh: '已用分頁開啟。' }, 'ok'); } }),
    h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Export Markdown', '匯出 Markdown'), onclick: () => exportBookmarked('md', chosen()) }), h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Export JSON', '匯出 JSON'), onclick: () => exportBookmarked('json', chosen()) }),
    h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Copy links', '複製連結'), onclick: () => { const t = chosen().map((k) => new URL(urlOf(k), location.href).href).join('\n'); try { navigator.clipboard.writeText(t).then(() => notifyMsg(MSG.copied, 'ok')); } catch (e) { /* ignore */ } } }),
    h('button', { type: 'button', class: 'mf-btn text', html: bi('Remove selected', '移除已選取'), onclick: () => { store.set('bookmarks', bookmarks().filter((b) => !sel.has(b.k))); sel.clear(); emit('bookmarks'); draw(); } }));
  dialog({ id: 'mf-saved', titleEn: 'Saved articles', titleZh: '已儲存文章', wide: true, body: h('div', {}, sb.el, tb, rows), actions: [{ en: 'Close', zh: '關閉', kind: 'filled' }] }); draw();
}
export function openHistory() {
  const rows = h('ul', { class: 'mf-notelist' }); const sb = searchBox({ key: 'history', placeholder: pick('Search history', '搜尋記錄'), onChange: () => draw() });
  function draw() { rows.textContent = ''; const l = history().filter((b) => sb.test(b.title + ' ' + b.k)); if (!l.length) rows.append(h('li', { class: 'mf-empty', html: bi('Nothing in the history yet.', '暫時冇閱讀記錄。') })); l.slice(0, 120).forEach((b) => rows.append(h('li', { class: 'mf-note' }, h('div', { class: 'mf-notebody' }, h('a', { href: urlOf(b.k) }, b.title), h('time', { datetime: new Date(b.t).toISOString() }, new Date(b.t).toLocaleString()))))); }
  const imp = h('input', { type: 'file', accept: '.json,application/json', class: 'mf-visually-hidden', id: 'mf-restore', onchange: () => { const f = imp.files[0]; if (!f) return; readFileText(f, 400000).then((t) => { const j = JSON.parse(t); if (!j || (!Array.isArray(j.history) && !Array.isArray(j.bookmarks))) throw new Error('bad'); const clean = (a) => (Array.isArray(a) ? a.filter((x) => x && typeof x.k === 'string' && typeof x.title === 'string').slice(0, 300).map((x) => ({ k: x.k.slice(0, 200), title: x.title.slice(0, 200), t: Number(x.t) || Date.now() })) : null); const hh = clean(j.history), bb = clean(j.bookmarks); if (hh) store.set('history', hh); if (bb) store.set('bookmarks', bb); emit('bookmarks'); draw(); notifyMsg(MSG.imported, 'ok'); }).catch(() => notifyMsg(MSG.invalid, 'error')); imp.value = ''; } });
  dialog({ id: 'mf-history', titleEn: 'Reading history', titleZh: '閱讀記錄', wide: true, body: h('div', {}, sb.el, h('div', { class: 'mf-row' },
    h('button', { type: 'button', class: 'mf-btn tonal', html: bi('Back up history and bookmarks', '備份記錄同書籤'), onclick: () => { download('reading-backup.json', JSON.stringify({ version: 1, history: history(), bookmarks: bookmarks() }, null, 2), 'application/json'); notifyMsg(MSG.exported, 'ok', { name: 'reading-backup.json' }); } }),
    h('label', { class: 'mf-btn tonal', for: 'mf-restore', tabindex: '0', role: 'button', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); imp.click(); } } }, h('span', { html: bi('Restore from a backup', '由備份還原') })), imp,
    h('button', { type: 'button', class: 'mf-btn text', html: bi('Clear history', '清除記錄'), onclick: () => { store.set('history', []); notifyMsg(MSG.historyCleared, 'info'); draw(); } })), rows), actions: [{ en: 'Close', zh: '關閉', kind: 'filled' }] }); draw();
}
define({ id: 'saved.open', group: 'records', type: 'action', label: ['Open saved articles', '開啟已儲存文章'], info: ['Lists your bookmarks with search, select all or some, open as tabs, export, copy links and remove.', '列出你嘅書籤，可以搜尋、全選或者部分選取、用分頁開啟、匯出、複製連結同移除。'], run: openSaved });
define({ id: 'history.open', group: 'records', type: 'action', label: ['Open reading history', '開啟閱讀記錄'], info: ['Shows pages you read, with search and a backup and restore file for history and bookmarks.', '顯示你睇過嘅頁面，附搜尋，同埋記錄同書籤嘅備份同還原檔案。'], run: openHistory });

/* ---------- changelog ---------- */
const mdLite = (t) => esc(t).replace(/^### (.*)$/gm, '<h4>$1</h4>').replace(/^## (.*)$/gm, '<h3>$1</h3>').replace(/^# (.*)$/gm, '<h3>$1</h3>').replace(/^[-*] (.*)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, (m) => '<ul>' + m + '</ul>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n{2,}/g, '<br><br>');
async function getJson(url, ttl) {
  const ck = 'api.' + url; const c = store.get(ck, null); if (c && Date.now() - c.t < (ttl || 300000)) return { data: c.d, cached: true };
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 7000);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' }, credentials: 'omit' }); clearTimeout(tm); if (r.status === 403 || r.status === 429) { const e = new Error('limit'); e.kind = 'limit'; throw e; } if (!r.ok) { const e = new Error('HTTP ' + r.status); e.kind = 'http'; throw e; } const d = await r.json(); store.set(ck, { t: Date.now(), d }); return { data: d }; }
  catch (e) { clearTimeout(tm); if (e.kind) throw e; const err = new Error('offline'); err.kind = 'offline'; err.stale = c; throw err; }
}
export function openChangelog() {
  const box = h('div', { class: 'mf-changelog', 'aria-live': 'polite' }, h('p', { html: bi('Loading...', '載入中...') }));
  dialog({ id: 'mf-changelog', titleEn: 'Changelog', titleZh: '更新記錄', wide: true, body: box, actions: [{ en: 'Close', zh: '關閉', kind: 'filled' }] });
  (async () => {
    try {
      const r = await fetch('https://raw.githubusercontent.com/' + REPO + '/main/CHANGELOG.md', { credentials: 'omit' });
      if (r.ok) { const t = await r.text(); box.innerHTML = '<div class="mf-md">' + mdLite(t.slice(0, 60000)) + '</div>'; return; }
    } catch (e) { /* fall through to releases */ }
    try {
      const { data } = await getJson('https://api.github.com/repos/' + REPO + '/releases?per_page=10');
      if (!data.length) { box.innerHTML = bi('There is no CHANGELOG.md and no published release yet. Updates will be listed here once they exist.', '暫時冇 CHANGELOG.md，亦未有已發佈版本。有更新後會列喺呢度。'); return; }
      box.innerHTML = data.map((x) => `<section class="mf-rel"><h3>${esc(x.name || x.tag_name)} <small>${esc(x.tag_name)} · ${new Date(x.published_at).toLocaleDateString()}</small></h3><div class="mf-md">${mdLite((x.body || '').slice(0, 4000))}</div></section>`).join('');
    } catch (e) {
      const stale = e.stale && e.stale.d; if (stale && stale.length) { box.innerHTML = '<p class="mf-status bad">' + bi('No connection. Showing the list saved earlier.', '冇網絡，顯示之前儲存嘅清單。') + '</p>' + stale.map((x) => `<section class="mf-rel"><h3>${esc(x.name || x.tag_name)}</h3></section>`).join(''); return; }
      box.innerHTML = '<p class="mf-status bad">' + (e.kind === 'limit' ? bi('GitHub is limiting requests from this network right now. Try again later.', '而家 GitHub 限制緊呢個網絡嘅請求，請稍後再試。') : bi('No connection, so the changelog cannot be loaded. Nothing is invented while offline.', '冇網絡，載入唔到更新記錄。離線時唔會亂作內容。')) + '</p><p><a href="https://github.com/' + REPO + '/releases" rel="noopener noreferrer">' + bi('Open releases on GitHub', '喺 GitHub 開啟版本頁') + '</a></p>';
    }
  })();
}
define({ id: 'changelog.open', group: 'records', type: 'action', label: ['Open the changelog', '開啟更新記錄'], info: ['Shows CHANGELOG.md from the project, or the published releases when there is no such file. Needs a connection.', '顯示項目嘅 CHANGELOG.md，冇呢個檔案就顯示已發佈版本。需要網絡。'], run: openChangelog });

/* ---------- Update coming soon ---------- */
const fmt24 = (d) => d.toLocaleString(undefined, { hour12: false, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
const mins = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s'; };
export async function loadUpdateState() {
  try {
    const runs = (await getJson('https://api.github.com/repos/' + REPO + '/actions/runs?branch=main&per_page=12', 60000)).data.workflow_runs || [];
    let rel = null; try { rel = (await getJson('https://api.github.com/repos/' + REPO + '/releases/latest')).data; } catch (e) { /* no release yet */ }
    const live = runs.find((r) => r.status === 'in_progress' || r.status === 'queued' || r.status === 'waiting');
    const done = runs.filter((r) => r.status === 'completed' && r.conclusion === 'success' && r.run_started_at).slice(0, 5);
    const est = done.length ? done.map((r) => new Date(r.updated_at) - new Date(r.run_started_at)).sort((a, b) => a - b)[Math.floor(done.length / 2)] : null;
    if (live) { let jobs = []; try { jobs = (await getJson('https://api.github.com/repos/' + REPO + '/actions/runs/' + live.id + '/jobs', 30000)).data.jobs || []; } catch (e) { /* stages unknown */ } return { kind: 'building', run: live, jobs, est, nEst: done.length, rel }; }
    const last = runs[0]; if (last && last.conclusion === 'failure') return { kind: 'failed', run: last, rel };
    if (last && last.conclusion === 'cancelled' && runs[1] && runs[1].run_number > last.run_number) return { kind: 'replaced', run: last, rel };
    return { kind: 'idle', rel, last };
  } catch (e) { return { kind: e.kind === 'limit' ? 'unknown' : 'offline' }; }
}
export function renderUpdate(st, box) {
  const ver = (($('.provenance strong') || {}).textContent || '').replace(/^v/, ''); box.textContent = '';
  const add = (n) => box.append(n); const say2 = (m) => h('p', { class: 'mf-status', role: 'status', html: m });
  if (st.kind === 'offline') return add(say2(bi('No connection, so build progress cannot be checked. Nothing is guessed.', '冇網絡，查唔到建置進度，所以唔會估。')));
  if (st.kind === 'unknown') return add(say2(bi('GitHub did not give an answer (probably a request limit). The state of the next update is unknown.', 'GitHub 冇回應（可能係請求次數限制），下一個更新嘅狀態未知。')));
  if (st.kind === 'failed') add(say2(bi('The newest build failed, so no update is coming from it. Run #' + st.run.run_number + '.', '最新嘅建置失敗，所以呢次唔會有更新。第 ' + st.run.run_number + ' 次運行。')));
  else if (st.kind === 'replaced') add(say2(bi('The latest build was replaced by a newer one.', '最新嘅建置已經被更新嘅一次取代。')));
  else if (st.kind === 'idle') add(say2(sayHtmlLocal(MSG.updateIdle)));
  if (st.kind === 'building') {
    const r = st.run; const started = r.run_started_at ? new Date(r.run_started_at) : null; const elapsed = started ? Date.now() - started.getTime() : null;
    add(h('div', { class: 'mf-updatehead' }, h('b', { html: bi('Update coming soon', '更新即將推出') }), h('span', { class: 'mf-pill' }, 'build #' + r.run_number)));
    add(h('dl', { class: 'mf-colors' }, h('dt', {}, pick('Started', '開始')), h('dd', {}, started ? fmt24(started) : pick('unknown', '未知')), h('dt', {}, pick('Elapsed', '已用時間')), h('dd', {}, elapsed !== null ? mins(elapsed) : pick('unknown', '未知')),
      h('dt', {}, pick('Estimate', '預計')), h('dd', {}, st.est ? pick(`about ${mins(st.est)} in total, based on the last ${st.nEst} build(s). This is an estimate, not a promise.`, `總共約 ${mins(st.est)}，根據最近 ${st.nEst} 次建置。呢個只係估計，唔係承諾。`) : pick('no estimate yet: there are no earlier builds to compare', '暫時冇估計：未有之前嘅建置可以比較')),
      h('dt', {}, pick('Contents', '內容')), h('dd', {}, (r.head_commit && r.head_commit.message ? r.head_commit.message.split('\n')[0] : pick('unknown', '未知')) + ' (' + (r.head_sha || '').slice(0, 7) + ')')));
    const stages = (st.jobs || []).flatMap((j) => (j.steps || []).map((s) => ({ job: j.name, name: s.name, status: s.status, conclusion: s.conclusion })));
    const label = (s) => (s.status === 'completed' ? (s.conclusion === 'success' ? pick('done', '完成') : s.conclusion === 'skipped' ? pick('skipped', '略過') : pick('failed', '失敗')) : s.status === 'in_progress' ? pick('running', '進行中') : pick('waiting', '等待中'));
    if (stages.length) add(h('ol', { class: 'mf-stages' }, stages.slice(0, 30).map((s) => h('li', { class: s.status }, h('span', { class: 'mf-stagestate' }, label(s)), ' ', s.name))));
    else add(say2(bi('The stages of this build are not available yet.', '呢次建置嘅各個階段暫時睇唔到。')));
    add(h('p', { class: 'mf-hint', html: bi('This only tells you an update is being made. It never installs anything by itself.', '呢度只係話你知有更新製作緊，唔會自己安裝任何嘢。') }));
  }
  if (st.rel) { const tag = st.rel.tag_name; add(h('p', {}, h('span', { html: bi('Latest published release: ', '最新已發佈版本：') }), h('a', { href: st.rel.html_url, rel: 'noopener noreferrer' }, tag), ' · ' + new Date(st.rel.published_at).toLocaleDateString(), ver && tag.replace(/^v/, '') !== ver ? ' · ' + pick('different from this site (v' + ver + ')', '同呢個網站（v' + ver + '）唔同') : '')); }
}
import { sayHtml as sayHtmlLocal } from './core.js';
export function openUpdate() {
  const box = h('div', {}, h('p', { html: bi('Checking...', '檢查中...') }));
  dialog({ id: 'mf-update', titleEn: 'Update status', titleZh: '更新狀態', wide: true, body: box, actions: [{ en: 'Close', zh: '關閉', kind: 'filled' }] });
  loadUpdateState().then((s) => renderUpdate(s, box));
}
define({ id: 'update.open', group: 'records', type: 'action', label: ['Check update status', '查看更新狀態'], info: ['Reads the public build status from GitHub and shows build number, stages, 24-hour start time, elapsed time, an estimate and what the build contains. It says plainly when it is offline or rate limited and never invents progress.', '由 GitHub 讀取公開嘅建置狀態，顯示建置編號、各階段、24 小時制開始時間、已用時間、預計時間同內容。離線或者受限制時會直接講明，唔會作出進度。'], run: openUpdate });

/* ---------- front-screen provenance and update chip ---------- */
function provenance() {
  const t = $('.provenance time'); const v = $('.provenance strong'); const main = $('main'); if (!main || $('.mf-prov')) return;
  const d = t && t.getAttribute('datetime') ? new Date(t.getAttribute('datetime')) : null; const ok = d && !isNaN(d);
  const bar = h('div', { class: 'mf-prov', role: 'note' }, h('span', { class: 'mf-pill' }, v ? v.textContent : pick('version unavailable', '版本未知')), ' ', h('span', { html: ok ? bi('Updated ' + fmt24(d) + ' (' + d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC)', '更新於 ' + fmt24(d) + '（' + d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC）') : bi('Update time unavailable', '更新時間未知') }),
    h('button', { type: 'button', class: 'mf-btn text', html: bi('Update status', '更新狀態'), onclick: openUpdate }));
  main.insertBefore(bar, main.firstChild);
}
async function updateChip() {
  if (!$('.hero') || $('.mf-updatechip')) return; const s = await loadUpdateState(); if (s.kind !== 'building') return;
  const chip = h('button', { type: 'button', class: 'mf-updatechip', onclick: openUpdate }, h('span', { class: 'mf-pulse', 'aria-hidden': 'true' }), h('span', { html: bi('Update coming soon: build #' + s.run.run_number, '更新即將推出：第 #' + s.run.run_number + ' 次建置') }));
  const hero = $('.hero-copy') || $('.hero'); hero.insertBefore(chip, hero.firstChild);
}
export function initRecords() { recordVisit(); provenance(); setTimeout(offerRestore, 800); setTimeout(updateChip, 1200); }
