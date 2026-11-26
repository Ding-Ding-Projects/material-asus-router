// Board kit: every board is written as compact macro calls and emitted as one
// whole canvas HTML file. Text is written 'English|Cantonese'; a string with no
// bar is used for both languages.
import { IC } from './icons.mjs';
import { wavyRing } from './theme.mjs';

export const FONT = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000&amp;display=swap" rel="stylesheet">';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const ic = (n, s = 22, w = 1.9) => `<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IC[n] || IC.info}"/></svg>`;
const smooth = (pts) => { let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1); for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2; d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1); } return d; };
export const wave = (seed, n = 24, lo = 20, hi = 90) => Array.from({ length: n }, (_, i) => Math.round(lo + (hi - lo) * (0.5 + 0.32 * Math.sin(i * 0.55 + seed) + 0.18 * Math.sin(i * 1.7 + seed * 2.3))));

export function mk(spec) {
  const D = { tx: [], sw: {}, sg: {}, num: {}, gr: {} };
  const seen = new Map(); let uid = 0, ti = 0;
  const L = (s) => { if (s == null) return ''; s = String(s); if (s.startsWith('{{') || s.startsWith('<')) return s; if (!s.includes('|')) return esc(s); const cut = s.indexOf('|'); const en = s.slice(0, cut), yue = s.slice(cut + 1); if (!seen.has(s)) { seen.set(s, D.tx.length); D.tx.push([en, yue]); } return '{{t.k' + seen.get(s) + '}}'; };
  const C = { D, L, ic, over: '' };
  const tone = (t) => t ? ' ' + t : '';

  // ---- text and small parts
  C.tag = (s, t = '', icon) => `<span class="tag${tone(t)}">${icon ? ic(icon, 15, 2.2) : ''}${L(s)}</span>`;
  C.num = (v, cls = '') => { const m = String(v).match(/^(\d+)(.*)$/); return m ? `<span class="disp ${cls}" aria-label="${esc(v)}"><span class="cnt" style="--to:${Number(m[1])}"></span>${esc(m[2])}</span>` : `<span class="disp ${cls}">${L(v)}</span>`; };
  C.av = (o, t = '') => `<span class="av${tone(t)}">${IC[o] ? ic(o, 22) : esc(o)}</span>`;
  C.btn = (s, o = {}) => { const cls = `btn ${o.k || 'ton'}${o.sm ? ' sm' : ''}${o.hot ? ' hot dr' : ''}${o.w === false ? '' : ' w'}`; const inner = (o.ic ? ic(o.ic, 20) : '') + `<span>${L(s)}</span>`; return o.href ? `<a class="${cls}" href="${o.href}">${inner}</a>` : `<button class="${cls}"${o.f ? ` onClick="{{${o.f}}}"` : ''}>${inner}</button>`; };
  C.fld = (label, ctl, help) => `<div class="fld"><div class="fl"><div class="t1">${L(label)}</div>${help ? `<div class="t2">${L(help)}</div>` : ''}</div>${ctl}</div>`;
  C.rows = (list) => `<div class="rows">${list.map((r, j) => `<div class="row" style="--j:${j}">${C.av(r[0], r[5] || ['', 't', 's'][j % 3])}<div class="grow"><div class="t1">${L(r[1])}</div>${r[2] ? `<div class="t2">${L(r[2])}</div>` : ''}</div>${r[3] ? (Array.isArray(r[3]) ? C.tag(r[3][0], r[3][1]) : C.tag(r[3])) : ''}${r[4] || ''}</div>`).join('')}</div>`;

  // ---- controls (each one wired to board state)
  C.sw = (k, def, label) => { D.sw[k] = def ? 1 : 0; return `<button class="sw${k[0] === '_' ? '' : ' w'} {{c.${k}}}" role="switch" aria-checked="{{a.${k}}}" aria-label="${L(label)}" onClick="{{f.${k}}}"><i></i></button>`; };
  C.seg = (k, opts, def = 0, label = 'Choose|選擇', cls = '') => { D.sg[k] = [opts.length, def]; return `<div class="seg${k[0] === '_' ? '' : ' w'} ${cls}" role="group" aria-label="${L(label)}" style="--cnt:${opts.length};--idx:{{gi.${k}}}"><i class="ind"></i>${opts.map((o, i) => `<button aria-pressed="{{g.${k}_${i}}}" onClick="{{f.${k}_${i}}}">${L(o)}</button>`).join('')}</div>`; };
  const stepBtns = (k, unit, label) => `<button aria-label="${L('Less|減少')}: ${L(label)}" onClick="{{f.${k}_dn}}">&minus;</button><output>{{n.${k}}}${unit ? `<small>${L(unit)}</small>` : ''}</output><button aria-label="${L('More|增加')}: ${L(label)}" onClick="{{f.${k}_up}}">+</button>`;
  C.step = (k, def, mn, mx, st, unit, label = 'Value|數值', pre) => { D.num[k] = [def, st, mn, mx, pre || []]; return `<div class="stp w">${stepBtns(k, unit, label)}</div>`; };
  C.slider = (k, def, mn, mx, st, unit, label = 'Value|數值') => { D.num[k] = [def, st, mn, mx, []]; return `<div class="sl w" style="--p:{{pc.${k}}}"><input type="range" min="${mn}" max="${mx}" step="${st}" value="{{n.${k}}}" aria-label="${L(label)}" onInput="{{f.${k}_in}}"><output>{{n.${k}}}${unit ? `<small>${L(unit)}</small>` : ''}</output></div>`; };
  C.ip = (k, addr, label = 'Address|地址') => { const p = addr.split('.'); D.num[k] = [Number(p[3]), 1, 1, 254, []]; return `<div class="ipp w" role="group" aria-label="${L(label)}"><span class="oc">${p[0]}</span><span class="dot">.</span><span class="oc">${p[1]}</span><span class="dot">.</span><span class="oc">${p[2]}</span><span class="dot">.</span><div class="stp">${stepBtns(k, '', label)}</div></div>`; };
  C.cidr = (k, def = 24) => { D.num[k] = [def, 1, 8, 30, [], 32]; return `<div class="rowx grow"><div class="stp w">${stepBtns(k, '', 'Prefix length|前綴長度')}</div><div class="bits" role="img" aria-label="${L('Network bits and host bits|網絡位元同主機位元')}"><i style="--p:{{pc.${k}}}"></i></div></div>`; };
  C.port = (k, def, pre = [80, 443, 22, 25565]) => { D.num[k] = [def, 1, 1, 65535, pre]; return `<div class="rowx"><div class="stp w">${stepBtns(k, '', 'Port|端口')}</div>${pre.map((p, i) => `<button class="chip w" onClick="{{f.${k}_p${i}}}">${p}</button>`).join('')}</div>`; };
  C.chips = (k, labels, defs = []) => `<div class="chips">${labels.map((l, i) => { D.sw[k + i] = defs.includes(i) ? 1 : 0; return `<button class="chip${k[0] === '_' ? '' : ' w'} {{c.${k + i}}}" aria-pressed="{{a.${k + i}}}" onClick="{{f.${k + i}}}">${L(l)}</button>`; }).join('')}</div>`;
  C.dev = (k, list, def = 0, label = 'Device|裝置') => { D.sg[k] = [list.length, def]; return `<div class="devp${k[0] === '_' ? '' : ' w'}" role="group" aria-label="${L(label)}">${list.map((d, i) => `<button aria-pressed="{{g.${k}_${i}}}" onClick="{{f.${k}_${i}}}">${C.av(d[2] || 'laptop')}<span><span class="t1">${L(d[0])}</span><span class="t2 mono" style="display:block">${L(d[1])}</span></span></button>`).join('')}</div>`; };
  C.pass = (k, pct = 82, label = 'Password|密碼') => { D.sw['_rv' + k] = 0; return `<div class="pw w" role="group" aria-label="${L(label)}"><div class="pv"><sc-if value="{{b._rv${k}}}" hint-placeholder-val="{{ false }}">maple-river-4207</sc-if><sc-if value="{{nb._rv${k}}}" hint-placeholder-val="{{ true }}">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</sc-if></div><button class="icb" aria-label="${L('Show or hide|顯示或者隱藏')}" aria-pressed="{{a._rv${k}}}" onClick="{{f._rv${k}}}">${ic('eye')}</button>${C.btn('Generate|產生', { k: 'ton', sm: 1, ic: 'spark' })}<div class="str" style="--p:${pct}%"><span><i></i></span>${L(pct > 70 ? 'Strong|夠強' : 'Fair|一般')}</div></div>`; };
  C.name = (value, max = 32, label = 'Name|名稱') => `<label class="nm w"><input type="text" value="${esc(value)}" maxlength="${max}" aria-label="${L(label)}"><span class="cn">${value.length} / ${max}</span></label>`;
  C.grid = (k, rows, cols, bits, presets = [], label = 'Schedule|時間表', unit = 'hours|個鐘') => { D.gr[k] = { r: rows.map(r => r.split('|')), c: cols, d: bits, p: presets.map(p => p[1]) }; return `<div class="colx"><div class="rowx">${`<div class="seg w" role="group" aria-label="${L('Brush|畫筆')}" style="--cnt:2;--idx:{{gi.br_${k}}}"><i class="ind"></i><button aria-pressed="{{g.br_${k}_1}}" onClick="{{f.br_${k}_1}}">${L('Paint|畫上去')}</button><button aria-pressed="{{g.br_${k}_0}}" onClick="{{f.br_${k}_0}}">${L('Erase|抹走')}</button></div>`}${presets.map((p, i) => `<button class="chip w" onClick="{{f.${k}_p${i}}}">${L(p[0])}</button>`).join('')}<span class="tag pri">{{n.${k}_on}} ${L(unit)}</span></div><div class="pg w" role="group" aria-label="${L(label)}" style="--c:${cols}"><div class="pr" aria-hidden="true"><span></span>${Array.from({ length: cols }, (_, i) => `<span class="hr">${i % 3 === 0 ? i : ''}</span>`).join('')}</div><sc-for list="{{gd.${k}}}" as="gr" hint-placeholder-count="${rows.length}"><div class="pr"><span class="pl">{{gr.l}}</span><sc-for list="{{gr.cells}}" as="q" hint-placeholder-count="${cols}"><button class="{{q.cls}}" aria-pressed="{{q.a}}" aria-label="{{q.lb}}" onClick="{{q.f}}"></button></sc-for></div></sc-for></div><div class="t2">${L('Click one cell, then another: everything between them is painted. In the app you drag.|㩒一格，再㩒另一格：中間嗰啲會一次過畫晒。喺應用程式入面係用拖嘅。')}</div></div>`; };

  // ---- visuals
  C.area = (data, o = {}) => { const id = 'g' + (uid++), W = 600, H = o.h || 170, mx = Math.max(...data) * 1.12, pts = data.map((v, i) => [i / (data.length - 1) * W, H - v / mx * (H - 8) - 4]); const d = smooth(pts), last = pts[pts.length - 1], col = o.col || 'var(--primary)'; const d2 = o.b ? smooth(o.b.map((v, i) => [i / (o.b.length - 1) * W, H - v / mx * (H - 8) - 4])) : ''; return `<svg class="ch" viewBox="0 0 ${W} ${H}" height="${H}" preserveAspectRatio="none" role="img" aria-label="${L(o.label || 'Chart|圖表')}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".55"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient><linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="${id}c"><path d="${d}L${W} ${H}L0 ${H}Z"/></clipPath></defs>${[0.25, 0.5, 0.75].map(q => `<path class="gr" d="M0 ${H * q}H${W}"/>`).join('')}<path class="ar" d="${d}L${W} ${H}L0 ${H}Z" fill="url(#${id})"/><g clip-path="url(#${id}c)"><rect class="swp" x="0" y="0" width="${W * 0.4}" height="${H}" fill="url(#${id}s)"/></g>${d2 ? `<path class="ln" pathLength="1" d="${d2}" stroke="${o.col2 || 'var(--tertiary)'}" style="animation-delay:.5s"/>` : ''}<path class="ln" pathLength="1" d="${d}" stroke="${col}"/><path class="dt" d="M${last[0] - 4} ${last[1]}h.01" stroke="${col}" style="color:${col}"/></svg>${o.axis ? `<div class="axis">${o.axis.map(a => `<span>${L(a)}</span>`).join('')}</div>` : ''}`; };
  C.bars = (data, h = 110, lowFrom = 99) => `<div class="bars" style="--h:${h}px" role="img" aria-label="${L('Bar chart|棒形圖')}">${data.map((v, k) => `<i class="${k >= lowFrom ? 'lo' : ''}" style="--b:${v}%;--k:${k}"></i>`).join('')}</div>`;
  C.hbars = (list) => `<div class="hb">${list.map((r, k) => `<div><span style="all:unset" class="t1">${L(r[0])}</span><span><i style="--b:${r[1]}%;--k:${k}"></i></span><b>${L(r[2])}</b></div>`).join('')}</div>`;
  C.gauge = (pct, big, small, o = {}) => `<div class="gauge${o.full ? ' full' : ''}" style="--s:${o.s || 180}px;--p:${pct}" role="img" aria-label="${L(small)} ${esc(big)}"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="42" pathLength="100"/><circle class="val" cx="50" cy="50" r="42" pathLength="100" stroke="${o.col || 'currentColor'}"/></svg><div class="gc">${C.num(big, o.cls || 's')}<small>${L(small)}</small></div></div>`;
  C.heat = (cols, n, seed = 1) => `<div class="heat" style="--c:${cols}" role="img" aria-label="${L('Heat map|熱力圖')}">${Array.from({ length: n }, (_, k) => `<i style="--o:${(0.12 + 0.88 * Math.abs(Math.sin(k * 0.37 + seed) * Math.cos(k * 0.11 + seed * 3)) ** 1.4).toFixed(2)};--k:${k}"></i>`).join('')}</div>`;
  C.spark = (data) => { const mx = Math.max(...data), mn = Math.min(...data); return `<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="${smooth(data.map((v, i) => [i / (data.length - 1) * 100, 36 - (v - mn) / (mx - mn || 1) * 32]))}"/></svg>`; };
  C.radar = (s = 230, blips = [[30, 28, 0], [66, 40, .5], [48, 70, 1.1], [74, 68, 1.6], [24, 58, 2]]) => `<div class="radar dr" style="--s:${s}px" role="img" aria-label="${L('Scanning nearby networks|掃描緊附近嘅網絡')}">${blips.map(b => `<b style="--x:${b[0]}%;--y:${b[1]}%;--d:${b[2]}s"></b>`).join('')}</div>`;
  C.ring = (inner, s = 200) => `<div class="ring" style="--s:${s}px"><svg viewBox="0 0 100 100" aria-hidden="true"><path class="wv2" d="${wavyRing(48, 1.4, 22)}"/><path class="wv" d="${wavyRing(43, 3, 12)}"/></svg><div class="gc" style="text-align:center">${inner}</div></div>`;
  C.qr = (s = 150, seed = 3) => `<div class="qr" style="--s:${s}px" role="img" aria-label="${L('Sample QR code|示範 QR 碼')}">${Array.from({ length: 121 }, (_, k) => { const x = k % 11, y = Math.floor(k / 11); const eye = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7); const on = eye ? !(x % 10 === 1 && y % 10 === 1 ? false : (x === 1 || x === 9) && (y === 1 || y === 9)) : Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453 % 1 > -0.05 && Math.abs(Math.sin(k * 3.1 + seed)) > 0.42; return `<i class="${on ? '' : 'o'}" style="--k:${k}"></i>`; }).join('')}</div>`;
  C.pipe = (steps, now) => `<div class="pipe" role="list">${steps.map((s, i) => `${i ? `<span class="pc ${i <= now ? (i === now ? 'now' : 'done') : ''}"></span>` : ''}<span class="ps ${i < now ? 'done' : i === now ? 'now' : ''}" role="listitem"><span class="pn">${i < now ? ic('check', 20, 2.6) : i + 1}</span>${L(s)}</span>`).join('')}</div>`;
  C.prog = (pct) => `<div class="prog" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="--p:${pct}%"></i></div>`;
  C.term = (lines) => `<div class="term" role="log">${lines.map((l, j) => `<div class="${l[1] || ''}" style="--j:${j}">${esc(l[0])}</div>`).join('')}</div>`;
  // network map: nodes [x,y,kind(0 router,1 node,2 device),icon,label], links [from,to,weak]
  C.map = (nodes, links, o = {}) => { const W = o.w || 1000, H = o.h || 420; const path = (l) => { const a = nodes[l[0]], b = nodes[l[1]]; const mx2 = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 26; return `M${a[0]} ${a[1]}Q${mx2} ${my} ${b[0]} ${b[1]}`; }; return `<svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="${L(o.label || 'Network map|網絡圖')}">${links.map(l => `<path class="lk${l[2] ? ' weak' : ''}" pathLength="1" d="${path(l)}"/>`).join('')}${links.map((l, i) => `<circle class="pk dr" r="5" style="offset-path:path('${path(l)}');--d:${(2 + (i % 4) * 0.5).toFixed(1)}s;--dl:${(i * 0.37 % 2).toFixed(2)}s"/>${i % 2 ? '' : `<circle class="pk dr" r="3.5" style="offset-path:path('${path(l)}');--d:${(2 + (i % 4) * 0.5).toFixed(1)}s;--dl:${(i * 0.37 % 2 + 1.1).toFixed(2)}s"/>`}`).join('')}${nodes.map((n, k) => { const r = n[2] === 0 ? 46 : n[2] === 1 ? 36 : 27; return `<g class="nd" style="--k:${k}"><circle class="n${n[2]}" cx="${n[0]}" cy="${n[1]}" r="${r}"/><g transform="translate(${n[0] - 11} ${n[1] - 11})" style="color:${n[2] === 0 ? '#fff' : 'var(--text)'}">${ic(n[3], 22)}</g><text x="${n[0]}" y="${n[1] + r + 22}">${L(n[4])}</text></g>`; }).join('')}</svg>`; };

  // ---- layout
  C.hero = (o) => `<section class="hero rise${o.one ? ' one' : ''}" style="--i:0"><div class="aurora dr" aria-hidden="true"><i></i><i></i><i></i></div><span class="hshape sh-${o.shape || 'cookie'} morph dr" aria-hidden="true"></span><div class="hero-l">${o.kick ? `<span class="kick">${ic(o.ic || 'spark', 18, 2.2)}${L(o.kick)}</span>` : ''}${o.num ? `<div class="hnum">${C.num(o.num, o.numCls || '')}${o.unit ? `<span class="unit">${L(o.unit)}</span>` : ''}</div>` : ''}${o.title ? `<h2>${L(o.title)}</h2>` : ''}${o.sub ? `<p class="hsub">${L(o.sub)}</p>` : ''}${o.chips ? `<div class="chips">${o.chips.map(c => Array.isArray(c) ? C.tag(c[0], c[1]) : C.tag(c)).join('')}</div>` : ''}${o.acts ? `<div class="acts">${o.acts}</div>` : ''}</div>${o.viz ? `<div class="hero-r">${o.viz}</div>` : ''}</section>`;
  C.glass = (body, style = '') => `<div class="glass" style="${style}">${body}</div>`;
  C.tile = (w, o, body) => `<section class="tile ${String(w).split(' ').map(x => /^\d/.test(x) ? 'w' + x : x).join(' ')}${tone(o.tone)} rise${o.mo ? ' mo' : ''}" style="--i:${++ti}">${o.title ? `<header class="th"><span class="tic${o.shape ? ' sh-' + o.shape : ''}">${ic(o.ic || 'spark')}</span><h3>${L(o.title)}</h3>${o.tag ? (Array.isArray(o.tag) ? C.tag(o.tag[0], o.tag[1]) : o.tag.startsWith('<') ? o.tag : C.tag(o.tag)) : ''}</header>` : ''}${body}${o.mo ? `<div class="molock">${ic('lock')}<span>${L('Needs Asuswrt-Merlin. Stock firmware does not offer this, so it is shown locked instead of hidden.|要 Asuswrt-Merlin 先用到。原廠韌體冇呢樣，所以鎖住俾你睇，唔會收埋。')}</span></div>` : ''}</section>`;
  C.stat = (w, o) => C.tile(w + ' stat', { tone: o.tone }, `<div class="lbl">${o.ic ? ic(o.ic, 18, 2.2) : ''}${L(o.label)}</div><div class="hnum">${C.num(o.num, o.cls || 'm')}${o.unit ? `<span class="unit">${L(o.unit)}</span>` : ''}</div>${o.spark ? C.spark(o.spark) : ''}${o.delta ? `<div class="delta">${L(o.delta)}</div>` : ''}${o.extra || ''}`);
  C.bento = (...tiles) => `<div class="bento">${tiles.join('')}</div>`;
  C.dock = () => `<sc-if value="{{hasPend}}" hint-placeholder-val="{{ false }}"><div class="dock" role="region" aria-label="${L('Pending changes|待套用變更')}"><div class="dn"><b>{{pendN}}</b>${L('changes waiting. Nothing has reached the router yet.|項變更等緊。暫時乜都未寫入路由器。')}</div><button class="btn out" onClick="{{f.discard}}">${L('Discard|唔要')}</button><a class="btn ton" href="Changes.dc.html">${ic('eye', 20)}<span>${L('Preview|預覽')}</span></a><button class="btn fill hot dr" onClick="{{f.apply}}">${ic('shield', 20)}<span>${L('Apply under guard|有守護咁套用')}</span></button></div></sc-if>`;
  C.burst = () => `<span class="burst dr" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--a:${i * 25.7}deg;--r:${70 + (i % 4) * 26}px;--c:${['var(--good)', 'var(--b1)', 'var(--b3)', 'var(--warn)'][i % 4]}"></i>`).join('')}</span>`;
  C.ok = (title, text) => `<div class="banner ok" role="status">${C.burst()}<span class="okmark"><span class="bg dr"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><div class="grow"><h2>${L(title)}</h2><div>${L(text)}</div></div><a class="btn out sm" href="Changes.dc.html">${ic('undo', 18)}<span>${L('Undo|還原')}</span></a></div>`;
  C.no = (title, reason, fix = 'Try again|再試') => `<div class="banner no" role="alert"><span class="nomark dr">${ic('alert', 34, 2.2)}</span><div class="grow"><h2>${L(title)}</h2><div>${L('Nothing was left half-applied. The router is as it was before.|冇嘢係做到一半。路由器同之前一模一樣。')}</div></div><button class="btn dng sm" onClick="{{f.st_ready}}">${ic('refresh', 18)}<span>${L(fix)}</span></button><div class="reason">${ic('info', 20)}<span><b>${L('Reason|原因')}:</b> ${L(reason)}</span></div></div>`;
  C.stageBar = () => `<div class="stagebar"><span>${L('Preview a stage|預覽階段')}</span><div class="seg" role="group" aria-label="${L('Stage|階段')}" style="--cnt:5;--idx:{{stIdx}}"><i class="ind"></i>${[['loading', 'Loading|載入中'], ['empty', 'Empty|空'], ['ready', 'Ready|就緒'], ['success', 'Success|成功'], ['failure', 'Failure|失敗']].map(s => `<button aria-pressed="{{stp.${s[0]}}}" onClick="{{f.st_${s[0]}}}">${L(s[1])}</button>`).join('')}</div></div>`;
  // staged body: o = { empty:[icon,title,text,action], ok:[title,text], no:[title,reason] }
  C.staged = (ready, o) => { const ph = spec.kind === 'phone'; const sk = ph ? [[2, 190], [1, 120], [1, 120], [2, 150]] : [[12, 300], [4, 200], [4, 200], [4, 200], [8, 260], [4, 260]]; return `${C.stageBar()}<sc-if value="{{st.loading}}" hint-placeholder-val="{{ false }}"><div class="bento" aria-busy="true" aria-label="${L('Loading|載入中')}">${sk.map((s, i) => `<div class="sk ${ph ? (s[0] === 1 ? 'half' : '') : 'w' + s[0]}" style="--h:${s[1]}px;--i:${i};grid-column:span ${s[0]}"></div>`).join('')}</div></sc-if><sc-if value="{{st.empty}}" hint-placeholder-val="{{ false }}"><div class="empty rise"><div class="aurora dr" aria-hidden="true" style="opacity:.25"><i></i><i></i><i></i></div><span class="eshape dr">${ic(o.empty[0], 60, 1.6)}</span><h2>${L(o.empty[1])}</h2><p>${L(o.empty[2])}</p>${C.btn(o.empty[3], { k: 'fill', hot: 1, ic: 'plus', f: 'f.st_ready' })}</div></sc-if><sc-if value="{{st.main}}" hint-placeholder-val="{{ true }}"><sc-if value="{{st.success}}" hint-placeholder-val="{{ false }}">${C.ok(o.ok[0], o.ok[1])}</sc-if><sc-if value="{{st.failure}}" hint-placeholder-val="{{ false }}">${C.no(o.no[0], o.no[1])}</sc-if>${ready}</sc-if>`; };
  C.dialog = (cond, body, cls = 'dialog', end = false) => { C.over += `<sc-if value="{{${cond}}}" hint-placeholder-val="{{ false }}"><div class="scrim${end ? ' end' : ''}"><div class="${cls}" role="dialog" aria-modal="true">${body}</div></div></sc-if>`; return ''; };
  C.diff = (list) => list.map((d, j) => `<div class="diff" style="--j:${j}"><span class="dk">${L(d[0])}</span><span class="old">${L(d[1])}</span>${ic('arrow', 18)}<span class="new">${L(d[2])}</span></div>`).join('');
  return C;
}

// The shared runtime that every board carries. LOGIC is the board's own
// function (or null); it receives a helper object and returns values for {{x.*}}.
const RUNTIME = `class Component extends DCLogic {
  renderVals() {
    const D = __D__;
    const p = this.props || {}, s = this.state || {};
    const lang = p.lang ?? 'en', role = p.role ?? 'owner', firmware = p.firmware ?? 'merlin', motion = p.motion ?? 'expressive';
    const accent = p.accent || '#4f5bd5';
    const dark = p.dark === true || p.dark === 'true' || p.dark === 1 || p.dark === '1';
    const T = (en, yue) => (yue === undefined || en === yue || lang === 'en') ? en : lang === 'yue' ? yue : en + ' · ' + yue;
    const canWrite = role !== 'viewer';
    const V = s.v || {};
    const stageP = p.stage ?? D.stage0;
    const stage = (s.stf === stageP && s.st) || stageP;
    const set = (o) => this.setState({ v: Object.assign({}, V, o) });
    const put = (k, val) => { if (k[0] === '_' || canWrite) set({ [k]: val }); };
    const t = {}, c = {}, a = {}, b = {}, nb = {}, f = {}, g = {}, gi = {}, is = {}, n = {}, pc = {}, gd = {}, st = {}, stp = {};
    D.tx.forEach((r, i) => { t['k' + i] = T(r[0], r[1]); });
    Object.keys(D.sw).forEach(k => { const on = k in V ? !!V[k] : !!D.sw[k]; c[k] = on ? 'on' : ''; a[k] = on ? 'true' : 'false'; b[k] = on; nb[k] = !on; f[k] = () => put(k, !on); });
    Object.keys(D.sg).forEach(k => { const cur = k in V ? V[k] : D.sg[k][1]; gi[k] = cur; for (let i = 0; i < D.sg[k][0]; i++) { g[k + '_' + i] = cur === i ? 'true' : 'false'; is[k + '_' + i] = cur === i; f[k + '_' + i] = () => put(k, i); } });
    Object.keys(D.num).forEach(k => { const q = D.num[k], def = q[0], step = q[1], mn = q[2], mx = q[3], pre = q[4] || [], span = q[5]; const cur = k in V ? V[k] : def; const cl = (z) => Math.max(mn, Math.min(mx, z)); n[k] = cur; pc[k] = (span ? cur / span * 100 : mx > mn ? (cur - mn) / (mx - mn) * 100 : 0).toFixed(1) + '%'; f[k + '_up'] = () => put(k, cl(cur + step)); f[k + '_dn'] = () => put(k, cl(cur - step)); f[k + '_in'] = (e) => { const z = Number(e && e.target ? e.target.value : NaN); if (!isNaN(z)) put(k, cl(z)); }; pre.forEach((pv, i) => { f[k + '_p' + i] = () => put(k, pv); }); });
    Object.keys(D.gr).forEach(k => { const G = D.gr[k], Cn = G.c; const cur = V[k] ?? G.d; const br = V['_br_' + k] ?? 1; const an = V['_an_' + k] ?? -1;
      gd[k] = G.r.map((lab, ri) => ({ l: T(lab[0], lab[1]), cells: Array.from({ length: Cn }, (_, ci) => { const idx = ri * Cn + ci, on = cur[idx] === '1'; return { cls: (on ? 'on' : '') + (an === idx ? ' an' : ''), a: on ? 'true' : 'false', lb: T(lab[0], lab[1]) + ' ' + ci + ':00', f: () => { if (!canWrite) return; if (an < 0) { set({ [k]: cur.slice(0, idx) + br + cur.slice(idx + 1), ['_an_' + k]: idx }); return; } const r0 = Math.min(Math.floor(an / Cn), ri), r1 = Math.max(Math.floor(an / Cn), ri), c0 = Math.min(an % Cn, ci), c1 = Math.max(an % Cn, ci); const o = cur.split(''); for (let r = r0; r <= r1; r++) for (let q = c0; q <= c1; q++) o[r * Cn + q] = String(br); set({ [k]: o.join(''), ['_an_' + k]: -1 }); } }; }) }));
      gi['br_' + k] = br === 1 ? 0 : 1; g['br_' + k + '_1'] = br === 1 ? 'true' : 'false'; g['br_' + k + '_0'] = br === 0 ? 'true' : 'false'; f['br_' + k + '_1'] = () => set({ ['_br_' + k]: 1 }); f['br_' + k + '_0'] = () => set({ ['_br_' + k]: 0 });
      (G.p || []).forEach((bits, i) => { f[k + '_p' + i] = () => { if (canWrite) set({ [k]: bits, ['_an_' + k]: -1 }); }; });
      n[k + '_on'] = cur.split('').filter(z => z === '1').length; });
    const SG = ['loading', 'empty', 'ready', 'success', 'failure'];
    SG.forEach(k => { st[k] = stage === k; stp[k] = stage === k ? 'true' : 'false'; f['st_' + k] = () => this.setState({ st: k, stf: stageP }); });
    st.main = stage === 'ready' || stage === 'success' || stage === 'failure';
    const pendKeys = Object.keys(V).filter(k => k[0] !== '_');
    const views = {}; Object.keys(V).forEach(k => { if (k[0] === '_') views[k] = V[k]; });
    f.discard = () => this.setState({ v: views });
    f.apply = () => this.setState({ v: views, st: 'success', stf: stageP });
    const h = { D, p, s, V, set, put, T, lang, role, firmware, canWrite, stage, f, self: this, owner: role === 'owner', merlin: firmware === 'merlin' };
    const LOGIC = __LOGIC__;
    const x = LOGIC ? LOGIC(h) : {};
    const extra = (h.extraPend || 0);
    return {
      accent, dark, darkNum: dark ? 1 : 0, lang, role, firmware, motion,
      motionCls: motion === 'calm' ? 'calm' : motion === 'standard' ? 'std' : '',
      rootCls: 'role-' + role + ' fw-' + firmware + ' lang-' + lang + ' st-' + stage,
      viewer: role === 'viewer', notOwner: role !== 'owner', stock: firmware !== 'merlin', merlin: firmware === 'merlin',
      fwName: firmware === 'merlin' ? 'Asuswrt-Merlin 388.8_4' : T('Stock ASUS 388.24198', '原廠 ASUS 388.24198'),
      readOnly: T('Read-only role: you can look at everything here, but every control that would change the router is switched off.', '唯讀角色：呢度樣樣都睇得，但會改到路由器嘅控制項全部閂咗。'),
      pendCount: D.pend + pendKeys.length + extra, pendN: pendKeys.length + extra, hasPend: pendKeys.length + extra > 0,
      stIdx: SG.indexOf(stage),
      tabsStr: D.tabs[0].split(',').map((e, i) => T(e, D.tabs[1].split(',')[i] || e)).join(','), title: T(D.title[0], D.title[1]),
      t, c, a, b, nb, f, g, gi, is, n, pc, gd, st, stp, x
    };
  }
}`;

export const TWEAKS = (w, h, stage) => { const o = { accent: { editor: 'color', default: '#4f5bd5', options: ['#4f5bd5', '#00897b', '#d81b60', '#f4511e', '#7c4dff'], section: 'Look' }, dark: { editor: 'boolean', default: false, section: 'Look' }, motion: { editor: 'enum', options: ['calm', 'standard', 'expressive'], default: 'expressive', section: 'Look' }, firmware: { editor: 'enum', options: ['merlin', 'stock'], default: 'merlin', section: 'Router' }, role: { editor: 'enum', options: ['owner', 'operator', 'viewer'], default: 'owner', section: 'Router' }, lang: { editor: 'enum', options: ['en', 'yue', 'both'], default: 'en', section: 'Language' } }; if (stage) o.stage = { editor: 'enum', options: ['loading', 'empty', 'ready', 'success', 'failure'], default: stage, section: 'Stage' }; o.$preview = { width: w, height: h }; return o; };
export const attr = (o) => JSON.stringify(o).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
export const page = (title, markup, props, script) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="theme.css">
</head>
<body>
<x-dc>
<helmet>
${FONT}
<style>body{margin:0}</style>
</helmet>
${markup}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='${attr(props)}'>
${script}
</script>
</body>
</html>
`;

const PNAV = [['home', 'Home|主頁', 'Phone.dc.html'], ['laptop', 'Devices|裝置', 'PhoneDevices.dc.html'], ['wifi', 'Wi-Fi', 'PhoneWifi.dc.html'], ['history', 'Changes|變更', 'PhoneGuard.dc.html'], ['menu', 'More|更多', 'PhoneNav.dc.html']];

export function emit(spec) {
  const C = mk(spec);
  const DEF = { empty: ['box', 'Nothing here yet|呢度暫時乜都冇', 'Connect the router or add the first item and this page fills in.|連接路由器或者加第一項，呢頁就會有嘢。', 'Get started|開始'], ok: ['Applied and verified|已套用同驗證', 'The router confirmed the change. You can undo it from change history.|路由器確認咗變更。可以喺變更記錄度還原。'], no: ['The change did not go through|變更未成功', 'The router closed the SSH session before confirming, so the guard put the old values back.|路由器未確認就斷咗 SSH，守護功能已經放返舊數值。'] };
  let body = spec.build(C);
  if (spec.hasStage) body = C.staged(body, Object.assign({}, DEF, spec.st || {}));
  const L = C.L, D = C.D;
  if (spec.data) D.x = spec.data;
  // any text node or label still written 'English|Cantonese' becomes a bilingual hole
  const bi = (h) => h.replace(/>([^<>{}]*\|[^<>{}]*)</g, (m, t) => /[㐀-鿿]/.test(t) || /\|/.test(t.trim().slice(1, -1)) ? '>' + L(t.trim()) + '<' : m).replace(/aria-label="([^"{}]*\|[^"{}]*)"/g, (m, t) => 'aria-label="' + L(t) + '"');
  body = bi(body); C.over = bi(C.over);
  const [ten, tyue] = spec.name2 ? spec.name2.split('|') : [spec.name, spec.name];
  const tabs = (spec.tabs || 'Overview|概覽').split('|');
  Object.assign(D, { stage0: spec.stage || 'ready', pend: spec.pend ?? 2, tabs: [tabs[0], tabs[1] || tabs[0]], title: [ten, tyue || ten] });
  const root = 'style="position:relative;--accent:{{accent}};--dark:{{darkNum}}"';
  const ro = `<sc-if value="{{viewer}}" hint-placeholder-val="{{ false }}"><div class="ro" role="status">${ic('eye')}<span>{{readOnly}}</span></div></sc-if>`;
  let markup;
  if (spec.kind === 'phone') {
    // spec.bare: a page outside the signed-in app, so no app bar, bottom bar or read-only banner
    const sb = `<div class="sb" aria-hidden="true"><span>9:41</span><span style="display:flex;gap:6px;align-items:center">${ic('wifi', 16, 2.4)}<svg width="26" height="13" viewBox="0 0 26 13"><rect x=".7" y=".7" width="22" height="11.6" rx="3.5" fill="none" stroke="currentColor" stroke-opacity=".5"/><rect x="2.4" y="2.4" width="15" height="8.2" rx="2" fill="currentColor"/></svg></span></div>`;
    const ab = `<header class="ab"><h1>{{title}}</h1><a class="icb" href="PhoneNav.dc.html" aria-label="${L('Search everything|搜尋所有嘢')}">${ic('search')}</a><a class="icb" href="PhoneSettings.dc.html" aria-label="${L('Notifications, 4 unread|通知，4 則未讀')}">${ic('bell')}<span class="dotb">4</span></a></header>`;
    const bn = `<nav class="bn" aria-label="${L('Main areas|主要功能')}">${PNAV.map((n, i) => `<a class="${i === spec.bn ? 'on' : ''}" href="${n[2]}"${i === spec.bn ? ' aria-current="page"' : ''}><span class="pl">${ic(n[0], 22)}</span>${L(n[1])}</a>`).join('')}</nav>`;
    markup = `<div class="mx ph {{motionCls}} {{rootCls}}" ${root}>${sb}${spec.bare ? '' : ab}<main class="pc">${spec.bare ? '' : ro}${body}</main>${spec.noNav || spec.bare ? '' : bn}${C.over}</div>`;
  } else {
    const imp = 'lang="{{lang}}" role="{{role}}" firmware="{{firmware}}" motion="{{motion}}" accent="{{accent}}" dark="{{dark}}"';
    markup = `<div class="mx shell {{motionCls}} {{rootCls}}" ${root}>
<div class="railwrap"><dc-import name="Rail" page="${spec.nav}" pending="{{pendCount}}" ${imp} hint-size="272px,900px"></dc-import></div>
<div class="main"><dc-import name="TopBar" title="{{title}}" tabs="{{tabsStr}}" active="0" ${imp} hint-size="1168px,150px"></dc-import>
<main class="content">${ro}${body}</main></div>${C.over}
</div>`;
  }
  const logic = spec.logic ? spec.logic.toString() : 'null';
  const script = RUNTIME.replace('__D__', JSON.stringify(D)).replace('__LOGIC__', () => logic);
  const ph = spec.kind === 'phone';
  return page(spec.name, markup, TWEAKS(ph ? 390 : 1440, ph ? 844 : spec.h || 1600, spec.hasStage ? (spec.stage || 'ready') : null), script);
}
