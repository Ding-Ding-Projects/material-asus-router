// Board generator library. Each board is authored as compact macro calls and
// emitted as one whole canvas HTML file with a shared runtime.
export const FONT = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000&amp;display=swap" rel="stylesheet">';

const IC = {
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', check: 'M5 12.5l4.5 4.5L19 7.5', x: 'M6 6l12 12M18 6L6 18',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 11v6 M12 7.5h.01',
  chev: 'M9 6l6 6-6 6', down: 'M6 9l6 6 6-6', back: 'M15 6l-6 6 6 6', more: 'M12 5h.01M12 12h.01M12 19h.01',
  wifi: 'M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h.01',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', play: 'M7 4l13 8-13 8z', pause: 'M7 5v14M17 5v14', stop: 'M6 6h12v12H6z',
  refresh: 'M20 12a8 8 0 1 1-2.5-5.8 M20 4v5h-5', download: 'M12 4v11M7 10l5 5 5-5 M4 19h16', upload: 'M12 16V4M7 9l5-5 5 5 M4 19h16',
  usb: 'M12 21V6 M9 8l3-5 3 5z M7 11v3l5 3 M17 9v4l-5 3 M15.5 7h3v2h-3z', drive: 'M3 14l3-8h12l3 8v5H3z M3 14h18 M17 17h.01',
  folder: 'M3 6h6l2 3h10v10H3z', file: 'M6 3h9l4 4v14H6z M14 3v5h5', trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  qr: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h3v3h-3z M20 17v3h-3 M17 20h.01 M20 14h.01',
  power: 'M12 3v9 M6.4 6.6a8 8 0 1 0 11.2 0', wrench: 'M15 4a5 5 0 0 0-4.5 6.8L4 17.3 6.7 20l6.5-6.5A5 5 0 0 0 20 9l-3 3-3-1-1-3z',
  chip: 'M7 7h10v10H7z M9 3v4 M15 3v4 M9 17v4 M15 17v4 M3 9h4 M3 15h4 M17 9h4 M17 15h4',
  alert: 'M12 3l10 18H2z M12 10v5 M12 18h.01', bell: 'M6 17V11a6 6 0 0 1 12 0v6l2 2H4z M10 21h4',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M20 20l-3.5-3.5', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21c0-4 3.6-7 8-7s8 3 8 7',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6 M17 8a2.5 2.5 0 1 1 0 5 M17.5 14.2c2.3.4 3.5 2.4 3.5 5.8',
  key: 'M15 8a4 4 0 1 1-3.5 6L4 21.5V18h3v-3h3l1.3-1.3A4 4 0 0 1 15 8z M16 9h.01',
  phone: 'M7 3h10v18H7z M11 18h2', laptop: 'M5 5h14v10H5z M2 19h20', tv: 'M3 5h18v12H3z M8 21h8',
  game: 'M6 9h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.5 1.6L15 15H9l-1.5 1.6A3 3 0 0 1 2 15v-2a4 4 0 0 1 4-4z M7 12v3 M5.5 13.5h3 M16 13h.01',
  speaker: 'M7 3h10v18H7z M12 15a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5 M12 6.5h.01', cam: 'M3 8h13v10H3z M16 11l5-3v10l-5-3',
  printer: 'M7 8V3h10v5 M5 8h14v9h-2v4H7v-4H5z M9 15h6', home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01', grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  sliders: 'M4 7h10 M18 7h2 M4 17h2 M10 17h10 M16 5v4 M8 15v4', star: 'M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8z',
  moon: 'M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z', sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19',
  book: 'M4 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4z M20 4h-3a3 3 0 0 0-3 3', code: 'M8 6l-5 6 5 6 M16 6l5 6-5 6 M14 4l-4 16',
  box: 'M3 8h18v12H3z M8 8V5h8v3 M3 13h18', cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5 M12 12v9 M12 12L4 7.5',
  term: 'M3 5h18v14H3z M7 10l3 2-3 2 M12 15h5', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M8 17h6a4 4 0 0 0 0-8h-4a3 3 0 0 1 0-6h6',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 12h.01', gauge: 'M4 17a8 8 0 1 1 16 0 M12 17l4-5',
  pulse: 'M2 12h4l3-8 4 16 3-8h6', calc: 'M5 3h14v18H5z M8 7h8 M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01',
  layers: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5 M3 17l9 5 9-5', undo: 'M4 9h10a6 6 0 0 1 0 12H8 M8 5L4 9l4 4',
  history: 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 8v4l3 2', send: 'M3 11l18-8-8 18-2-8z', mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M5 11a7 7 0 0 0 14 0 M12 18v3',
  vol: 'M4 9h4l5-4v14l-5-4H4z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11', focus: 'M4 8V4h4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  school: 'M2 9l10-5 10 5-10 5z M6 11.5V16c2 2 10 2 12 0v-4.5 M22 9v6', heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
  flag: 'M5 21V4 M5 4h13l-2.5 4.5L18 13H5', menu: 'M4 6h16M4 12h16M4 18h16', arrow: 'M4 12h15 M13 6l6 6-6 6',
  server: 'M4 4h16v6H4z M4 14h16v6H4z M8 7h.01 M8 17h.01', cloud: 'M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 10.2 4 4 0 0 1 17.5 18z',
  palette: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.7-1.6 0-2.5c1.2-1.5 7 .5 7-4.5a9 9 0 0 0-9-9z M7.5 11h.01M10 7.5h.01M15 7.5h.01',
  lang: 'M4 5h9 M8.5 3v2 M5 5c.5 4 3.5 7 7 8 M12 5c-.5 4-3.5 7-7 8 M13 21l4-10 4 10 M14.5 17.5h5', tabs: 'M3 8h18v12H3z M3 8V4h7l2 4',
  mesh: 'M12 3a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 12 3z M5 16a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 5 16z M19 16a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 19 16z M11 7l-5 9 M13 7l5 9 M7.2 18.2h9.6',
  family: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6 M17 8a2.5 2.5 0 1 1 0 5 M17.5 14.2c2.3.4 3.5 2.4 3.5 5.8',
  qos: 'M5 20v-6 M12 20V6 M19 20v-10', fwd: 'M3 12h14 M12 6l6 6-6 6 M21 4v16', spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M19 12l2-1.5-2-3.4-2.3 1-2-1.2L14.3 3h-4l-.4 2.7-2 1.2-2.3-1-2 3.4L5 12l-2 1.5 2 3.4 2.3-1 2 1.2.4 2.7h4l.4-2.7 2-1.2 2.3 1 2-3.4z',
  backup: 'M12 16V4 M7 9l5-5 5 5 M4 15v5h16v-5', help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7 M12 17h.01',
  timer: 'M12 6a8 8 0 1 0 0 16 8 8 0 0 0 0-16 M12 10v4 M9 2h6', pen: 'M4 20l4-1L20 7l-3-3L5 16z M14 6l3 3', swap: 'M4 8h14l-3-3 M20 16H6l3 3'
};
export const ico = (n, sz = 20, sw = 1.9) => { if (!IC[n]) throw new Error('icon ' + n); return `<svg class="u-i" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IC[n]}"/></svg>`; };

// decorative shapes
const f1 = (v) => Math.round(v * 10) / 10;
export const scallop = (n, R = 86, r = 9, pts = 96) => { let d = ''; for (let i = 0; i < pts; i++) { const a = i / pts * Math.PI * 2; const rr = R + r * Math.cos(n * a); d += (i ? 'L' : 'M') + f1(100 + rr * Math.cos(a)) + ' ' + f1(100 + rr * Math.sin(a)); } return d + 'Z'; };
export const superell = (e = 4, R = 90, pts = 64) => { let d = ''; for (let i = 0; i < pts; i++) { const a = i / pts * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a); const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * R, y = Math.sign(s) * Math.pow(Math.abs(s), 2 / e) * R; d += (i ? 'L' : 'M') + f1(100 + x) + ' ' + f1(100 + y); } return d + 'Z'; };
const SH = { c12: scallop(12), c8: scallop(8, 82, 12), f4: scallop(4, 70, 24), f6: scallop(6, 76, 16), sq: superell(4), pill: superell(2.6, 92), burst: scallop(16, 84, 7) };
export const shape = (k, style, cls = '') => `<svg class="u-shape ${cls}" viewBox="0 0 200 200" aria-hidden="true" style="${style}"><path d="${SH[k]}"/></svg>`;
export const badge = (k, size, inner, style = '', cls = '') => `<span class="cookie ${cls}" style="width:${size}px;height:${size}px;${style}" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${SH[k]}"/></svg><span style="display:grid;place-items:center">${inner}</span></span>`;

export const DEV = [
  ['Pat-Laptop', '3C:22:FB:10:4A:01', '198.51.100.21', 'laptop'], ['Alex-Tablet', 'A4:83:E7:5C:19:22', '198.51.100.34', 'phone'],
  ['Living-Room-TV', '70:2A:D5:0B:77:C3', '198.51.100.40', 'tv'], ['NAS', '00:11:32:AA:5E:04', '198.51.100.20', 'server'],
  ['Game-Console', '98:B6:E9:42:D0:15', '198.51.100.52', 'game'], ['Doorbell-Cam', 'D8:1F:12:6E:03:A6', '198.51.100.61', 'cam'],
  ['Office-Printer', '00:1B:A9:C4:28:07', '198.51.100.70', 'printer'], ['Pixel-9', 'DA:A1:19:3F:8B:08', '198.51.100.83', 'phone']
];

export function mk() {
  const tx = [], txm = new Map(), sw = {}, sg = {}, num = {}, sel = {};
  let uid = 0; const nid = (p) => p + (uid++);
  const pair = (str0) => { const str = str0.replace(/&lt;/g, '<').replace(/&gt;/g, '>'); const j = str.indexOf('|'); return j < 0 ? [str, str] : [str.slice(0, j), str.slice(j + 1)]; };
  const x = (str) => { let i = txm.get(str); if (i === undefined) { i = tx.length; tx.push(pair(str)); txm.set(str, i); } return `{{t.k${i}}}`; };
  const when = (hole, html, ph = true) => `<sc-if value="{{${hole}}}" hint-placeholder-val="{{ ${ph} }}">${html}</sc-if>`;
  const C = {};
  C.x = x; C.when = when; C.ico = ico; C.shape = shape; C.badge = badge;
  C.sw = (on, label, o = {}) => { const id = o.id || nid('s'); sw[id] = [on ? 1 : 0, o.view ? 1 : 0]; return `<button class="sw ${o.view ? '' : 'w'} {{c.${id}}}" role="switch" aria-checked="{{a.${id}}}" aria-label="${x(label)}" onClick="{{f.${id}}}"><i></i></button>`; };
  C.chip = (label, on, o = {}) => { const id = o.id || nid('s'); sw[id] = [on ? 1 : 0, o.view ? 1 : 0]; return `<button class="chip u-chip ${o.view ? '' : 'w'} {{c.${id}}}" aria-pressed="{{a.${id}}}" onClick="{{f.${id}}}">${o.icon ? ico(o.icon, 16) : ''}${x(label)}</button>`; };
  C.chips = (list, o = {}) => `<div class="u-chips" role="group" aria-label="${x(o.label || 'Options|選項')}">${list.map(l => Array.isArray(l) ? C.chip(l[0], l[1], Object.assign({ icon: l[2] }, o)) : C.chip(l, false, o)).join('')}</div>`;
  C.seg = (opts, cur, o = {}) => { const id = o.id || nid('g'); sg[id] = [opts.length, cur, o.view ? 1 : 0]; return `<div class="seg ${o.view ? '' : 'w'}" role="group" aria-label="${x(o.label || 'Choose one|揀一個')}" style="flex-wrap:wrap;${o.style || ''}">${opts.map((l, i) => `<button aria-pressed="{{g.${id}_${i}}}" onClick="{{f.${id}_${i}}}">${x(l)}</button>`).join('')}</div>`; };
  C.is = (id, i, html, ph) => when(`is.${id}_${i}`, html, ph === undefined ? i === (sg[id] || [0, 0])[1] : ph);
  C.on = (id, html) => when(`b.${id}`, html, !!(sw[id] || [0])[0]);
  C.off = (id, html) => when(`nb.${id}`, html, !(sw[id] || [0])[0]);
  C.step = (val, o = {}) => { const id = o.id || nid('n'); num[id] = [val, o.step || 1, o.min ?? 0, o.max ?? 999]; return `<div class="u-step w" role="group" aria-label="${x(o.label || 'Value|數值')}"><button aria-label="${x('Decrease|減少')}" onClick="{{f.${id}_dn}}">${ico('minus', 18, 2.4)}</button><output>{{n.${id}}}</output>${o.unit ? `<small>${x(o.unit)}</small>` : ''}<button aria-label="${x('Increase|增加')}" onClick="{{f.${id}_up}}">${ico('plus', 18, 2.4)}</button></div>`; };
  C.slider = (val, o = {}) => { const id = o.id || nid('n'); num[id] = [val, o.step || 1, o.min ?? 0, o.max ?? 100]; return `<div class="u-range w"><input type="range" min="${o.min ?? 0}" max="${o.max ?? 100}" step="${o.step || 1}" value="{{n.${id}}}" onInput="{{f.${id}_in}}" aria-label="${x(o.label || 'Level|程度')}" style="--v:{{pc.${id}}}"><output class="u-bub">{{n.${id}}}${o.unit ? `<small>${x(o.unit)}</small>` : ''}</output></div>`; };
  C.select = (opts, cur, o = {}) => { const id = o.id || nid('v'); sel[id] = [cur, opts.map(op => pair(Array.isArray(op) ? (op[1] || '') : ''))]; const has = opts.some(op => Array.isArray(op) && op[1]); return `<div class="u-selw"><select class="u-sel w" value="{{v.${id}}}" onChange="{{f.${id}}}" aria-label="${x(o.label || 'Choose|選擇')}">${opts.map((op, i) => `<option value="${i}">${x(Array.isArray(op) ? op[0] : op)}</option>`).join('')}</select>${has ? `<div class="u-seld">{{d.${id}}}</div>` : ''}</div>`; };
  C.devpick = (cur, o = {}) => `<div class="u-dev"><span class="u-av">${ico(DEV[cur][3], 22)}</span>${C.select(DEV.map(dv => [dv[0], dv[1] + ' · ' + dv[2]]), cur, { label: o.label || 'Device|裝置' })}</div>`;
  C.ip = (addr, o = {}) => { const parts = addr.split('.').map(Number); const lk = o.lock ?? 0; let h = `<div class="u-ip w" role="group" aria-label="${x(o.label || 'IPv4 address|IPv4 地址')}">`; parts.forEach((v, i) => { if (i) h += '<b>.</b>'; if (i < lk) h += `<span class="u-oct">${v}</span>`; else { const id = nid('n'); num[id] = [v, 1, 0, 255]; h += `<input class="u-oct" inputmode="numeric" maxlength="3" value="{{n.${id}}}" onInput="{{f.${id}_in}}" aria-label="${x('Part|第')} ${i + 1}">`; } }); return h + '</div>'; };
  C.cidr = (prefix, o = {}) => { const id = o.id || nid('n'); num[id] = [prefix, 1, 8, 30]; return { id, step: `<div class="u-step w" role="group" aria-label="${x('Prefix length|前綴長度')}"><button aria-label="${x('Shorter prefix, bigger network|前綴短啲，網絡大啲')}" onClick="{{f.${id}_dn}}">${ico('minus', 18, 2.4)}</button><output>/{{n.${id}}}</output><button aria-label="${x('Longer prefix, smaller network|前綴長啲，網絡細啲')}" onClick="{{f.${id}_up}}">${ico('plus', 18, 2.4)}</button></div>`, bar: `<div class="u-netbar" role="img" aria-label="${x('Network bits and host bits|網絡位元同主機位元')}"><i style="width:calc(({{n.${id}}} - 0) / 32 * 100%)">${x('network|網絡')} /{{n.${id}}}</i><i>${x('hosts|主機')}</i></div>` }; };
  C.port = (val, presets = [], o = {}) => { const id = o.id || nid('n'); num[id] = [val, 1, 1, 65535, presets.map(pp => pp[1])]; return `<div class="u-port"><div class="u-ip w"><input class="u-oct p" inputmode="numeric" maxlength="5" value="{{n.${id}}}" onInput="{{f.${id}_in}}" aria-label="${x(o.label || 'Port number|端口號碼')}"></div>${presets.length ? `<div class="u-chips">${presets.map((pp, i) => `<button class="chip u-chip w" onClick="{{f.${id}_p${i}}}">${x(pp[0])} <span class="mono">${pp[1]}</span></button>`).join('')}</div>` : ''}</div>`; };
  C.pw = (strength, o = {}) => { const id = nid('s'); sw[id] = [0, 1]; const names = ['Too short|太短', 'Weak|弱', 'Fair|一般', 'Strong|強', 'Very strong|好強']; return `<div><div class="u-pw w"><input type="{{pt.${id}}}" value="${o.value || 'tide-lantern-47-maple'}" onInput="{{noop}}" aria-label="${x(o.label || 'Password|密碼')}"><button class="icb" aria-pressed="{{a.${id}}}" aria-label="${x('Show or hide the password|顯示或者隱藏密碼')}" onClick="{{f.${id}}}">${ico('eye', 22)}</button></div><div class="u-str s${strength}" role="img" aria-label="${x('Password strength|密碼強度')}"><i></i><i></i><i></i><i></i><b>${x(names[strength])}</b></div></div>`; };
  C.sched = (fn, o = {}) => { const stepH = o.step || 1; const days = ['Mon|一', 'Tue|二', 'Wed|三', 'Thu|四', 'Fri|五', 'Sat|六', 'Sun|日']; const en = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; let h = `<div class="u-sch ${stepH === 2 ? 'h12' : ''} w" role="group" aria-label="${x(o.label || 'Weekly schedule, one cell per hour|每週時間表，每格一個鐘')}"><span></span>`; for (let hr = 0; hr < 24; hr += stepH) h += `<span class="hh">${hr % (stepH === 2 ? 4 : 3) === 0 ? String(hr).padStart(2, '0') : ''}</span>`; days.forEach((dname, di) => { h += `<span class="dd">${x(dname)}</span>`; for (let hr = 0; hr < 24; hr += stepH) { const id = nid('s'); sw[id] = [fn(di, hr) ? 1 : 0, 0]; h += `<button class="u-hc {{c.${id}}}" aria-pressed="{{a.${id}}}" aria-label="${en[di]} ${String(hr).padStart(2, '0')}:00" onClick="{{f.${id}}}"></button>`; } }); return h + '</div>'; };
  C.rangebar = (a, b, o = {}) => { const ia = nid('n'), ib = nid('n'); num[ia] = [a, 1, 2, 254]; num[ib] = [b, 1, 2, 254]; const res = (o.res || []).map(r => `<i class="u-rbd" style="left:${f1((r - 2) / 252 * 100)}%" title=".${r}"></i>`).join(''); return { ia, ib, html: `<div class="u-rb w"><div class="u-rbt"><i class="u-rbf" style="left:{{pc.${ia}}};right:{{pq.${ib}}}"></i></div>${res}<input type="range" min="2" max="254" value="{{n.${ia}}}" onInput="{{f.${ia}_in}}" aria-label="${x('First address handed out|派出嘅第一個地址')}"><input type="range" min="2" max="254" value="{{n.${ib}}}" onInput="{{f.${ib}_in}}" aria-label="${x('Last address handed out|派出嘅最後一個地址')}"></div>` }; };
  C.drop = (label, hint, icon = 'upload') => `<label class="u-drop w"><input type="file" class="u-vh" aria-label="${x(label)}">${ico(icon, 34)}<b>${x(label)}</b><span>${x(hint)}</span></label>`;

  // graphics
  let gid = 0;
  const curve = (pts) => { let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const mx = (x0 + x1) / 2; d += `C${f1(mx)} ${f1(y0)} ${f1(mx)} ${f1(y1)} ${f1(x1)} ${f1(y1)}`; } return d; };
  C.area = (series, o = {}) => { const W = 600, H = o.h || 180, max = o.max || Math.max(...series.flat()) * 1.15; const cols = o.colors || ['var(--primary)', 'var(--tertiary)', 'var(--good)']; let defs = '', body = ''; for (let gy = 1; gy < 4; gy++) body += `<path class="gridline" d="M0 ${f1(H * gy / 4)}H${W}"/>`; series.forEach((sv, si) => { const id = 'gr' + (gid++); const pts = sv.map((v, i) => [i / (sv.length - 1) * W, H - 6 - v / max * (H - 16)]); const line = curve(pts); defs += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cols[si % cols.length]}" stop-opacity=".46"/><stop offset="1" stop-color="${cols[si % cols.length]}" stop-opacity="0"/></linearGradient>`; body += `<path class="u-fadein" d="${line}L${W} ${H}L0 ${H}Z" fill="url(#${id})"/><path class="u-draw dr" d="${line}" pathLength="1" fill="none" stroke="${cols[si % cols.length]}" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`; }); const ax = o.axis ? `<div class="axis">${o.axis.map(l => `<span>${l}</span>`).join('')}</div>` : ''; return `<div class="u-chart"><svg viewBox="0 0 ${W} ${H}" height="${H}" preserveAspectRatio="none" role="img" aria-label="${x(o.label || 'Chart|圖表')}"><defs>${defs}</defs>${body}</svg>${ax}</div>`; };
  C.bars = (vals, o = {}) => { const max = o.max || Math.max(...vals.map(v => Array.isArray(v) ? v[0] : v)); return `<div><div class="u-bars" role="img" aria-label="${x(o.label || 'Bar chart|棒形圖')}" style="height:${o.h || 150}px">${vals.map((v, i) => { const val = Array.isArray(v) ? v[0] : v, cls = Array.isArray(v) ? v[1] : ''; return `<i class="${cls}" style="height:${Math.max(3, Math.round(val / max * 100))}%;animation-delay:${(i * 0.035).toFixed(2)}s" title="${val}"></i>`; }).join('')}</div>${o.axis ? `<div class="u-barl">${o.axis.map(l => `<span>${l}</span>`).join('')}</div>` : ''}</div>`; };
  C.hbars = (rows) => rows.map(r => `<div class="u-hb"><b>${r[0]}</b><div class="meter"><i style="width:${r[1]}%;${r[3] ? 'background:' + r[3] : ''}"></i></div><span>${r[2]}</span></div>`).join('');
  C.ring = (pct, inner, o = {}) => { const sz = o.size || 180, sw2 = o.sw || 16; return `<div style="position:relative;width:${sz}px;height:${sz}px;display:grid;place-items:center;flex:none"><svg width="${sz}" height="${sz}" viewBox="0 0 100 100" style="position:absolute;transform:rotate(-90deg)" role="img" aria-label="${x(o.label || 'Progress|進度')} ${pct}%"><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width="${sw2 / sz * 100}"/><circle class="u-ringv dr ${o.cls || ''}" cx="50" cy="50" r="42" fill="none" stroke="${o.color || 'currentColor'}" stroke-width="${sw2 / sz * 100}" stroke-linecap="round" pathLength="100" stroke-dasharray="${pct} 100" ${o.style ? `style="${o.style}"` : ''}/></svg><div style="position:relative;text-align:center">${inner}</div></div>`; };
  C.gauge = (pct, val, unit, o = {}) => { const ang = -118 + pct / 100 * 236; return `<div style="position:relative;width:${o.size || 280}px;max-width:100%"><svg viewBox="0 0 200 150" style="display:block;width:100%" role="img" aria-label="${x(o.label || 'Speed gauge|速度錶')}"><path d="M30 140A82 82 0 1 1 170 140" fill="none" stroke="currentColor" stroke-opacity=".2" stroke-width="16" stroke-linecap="round"/><path class="u-ringv dr" d="M30 140A82 82 0 1 1 170 140" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" pathLength="100" stroke-dasharray="${pct} 100"/><g class="u-needle dr" style="transform:rotate(${f1(ang)}deg)"><path d="M100 100L100 34" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></g><circle cx="100" cy="100" r="9" fill="currentColor"/></svg><div style="position:absolute;left:0;right:0;bottom:0;text-align:center"><span class="u-num" style="font-size:54px">${val}<small>${unit}</small></span></div></div>`; };
  C.wavy = (pct, o = {}) => { const W = o.w || 520; let d = 'M0 12'; for (let i = 0; i < W / 16 + 2; i++) d += ' q4 -6 8 0 t8 0'; return `<svg width="100%" height="24" viewBox="0 0 ${W} 24" preserveAspectRatio="none" role="img" aria-label="${x(o.label || 'Progress|進度')} ${pct}%" style="display:block;max-width:${W}px"><path d="M0 12H${W}" stroke="currentColor" stroke-opacity=".25" stroke-width="6" stroke-linecap="round" fill="none"/><svg x="0" y="0" width="${Math.round(W * pct / 100)}" height="24" overflow="hidden"><path class="wavy" d="${d}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg></svg>`; };
  C.pipe = (steps, act, o = {}) => `<div class="u-pipe dr" role="list" aria-label="${x(o.label || 'Steps|步驟')}">${steps.map((st, i) => { const cls = i < act ? 'done' : i === act ? (o.fail ? 'fail' : 'act') : ''; return `<div class="u-pn ${cls}" role="listitem"><span class="u-pd">${ico(i < act ? 'check' : (i === act && o.fail ? 'x' : st[1]), 22, 2.2)}</span><span>${x(st[0])}</span>${st[2] ? `<small>${x(st[2])}</small>` : ''}</div>`; }).join('')}</div>`;
  C.spark = (vals, color = 'currentColor') => { const max = Math.max(...vals), min = Math.min(...vals); const pts = vals.map((v, i) => [i / (vals.length - 1) * 100, 26 - (v - min) / (max - min || 1) * 22]); return `<svg width="100" height="28" viewBox="0 0 100 28" aria-hidden="true" style="flex:none"><path class="u-draw" d="${curve(pts)}" pathLength="1" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/></svg>`; };
  C.qr = (seed = 7, size = 150) => { const N = 25; let r = ''; let st = seed * 9301 + 49297; const rnd = () => { st = (st * 9301 + 49297) % 233280; return st / 233280; }; const fin = (cx, cy) => { r += `<path d="M${cx} ${cy}h7v7h-7z M${cx + 1} ${cy + 1}v5h5v-5z M${cx + 2} ${cy + 2}h3v3h-3z" fill-rule="evenodd"/>`; }; for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) { const inF = (xx < 8 && yy < 8) || (xx > 16 && yy < 8) || (xx < 8 && yy > 16); if (!inF && rnd() > 0.52) r += `<path d="M${xx} ${yy}h1v1h-1z"/>`; } fin(0, 0); fin(18, 0); fin(0, 18); return `<svg class="u-qr" width="${size}" height="${size}" viewBox="-1 -1 27 27" role="img" aria-label="${x('QR code (sample pattern)|QR code（示範圖案）')}" fill="#111" shape-rendering="crispEdges">${r}</svg>`; };
  C.conf = (n = 22) => { const cols = ['var(--tertiary)', 'var(--primary-c)', '#fff', 'var(--warn)', 'var(--good)']; let h = '<div class="u-conf dr" aria-hidden="true">'; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + (i % 3) * 0.2, d = 170 + (i * 53) % 190; h += `<i style="--dx:${Math.round(Math.cos(a) * d * 1.5)}px;--dy:${Math.round(Math.sin(a) * d * 0.7)}px;--r:${(i * 67) % 360}deg;background:${cols[i % cols.length]};animation-delay:${(i % 5) * 0.12}s"></i>`; } return h + '</div>'; };

  // layout
  C.card = (title, body, o = {}) => `<section class="card rise u-c${o.c || 6} ${o.cls || ''}" aria-label="${x(title)}"${o.style ? ` style="${o.style}"` : ''}><div class="u-ch">${o.icon ? `<span class="u-av ${o.av || 'p'}">${ico(o.icon, 22)}</span>` : ''}<h2 class="h2">${x(title)}</h2>${o.act || ''}</div>${o.sub ? `<div class="muted">${x(o.sub)}</div>` : ''}${body}</section>`;
  C.set = (label, help, ctl, o = {}) => `<div class="u-set ${o.wd ? 'wd' : ''}"><div><div class="t1">${x(label)}</div>${help ? `<div class="t2">${x(help)}</div>` : ''}</div><div class="u-ctl">${ctl}</div></div>`;
  C.li = (icon, title, sub, end = '', av = '') => `<div class="u-li"><span class="u-av ${av}">${typeof icon === 'string' && IC[icon] ? ico(icon, 22) : icon}</span><div class="grow"><div class="t1">${title}</div>${sub ? `<div class="t2">${sub}</div>` : ''}</div>${end}</div>`;
  C.kpis = (list) => `<div class="u-kpis">${list.map(k => `<div class="u-kpi"><div class="k">${x(k[0])}</div><div class="big">${k[1]}<small>${k[2] ? x(k[2]) : ''}</small></div>${k[3] ? `<div class="t2">${k[3]}</div>` : ''}</div>`).join('')}</div>`;
  C.tbl = (heads, rows) => `<div class="u-scroll"><table class="u-tbl"><thead><tr>${heads.map(h => `<th scope="col">${x(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c2 => `<td>${c2}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  C.btn = (label, cls = 'f', icon, o = {}) => o.href ? `<a class="btn ${cls}" href="${o.href}">${icon ? ico(icon, 20) : ''}${x(label)}</a>` : `<button class="btn ${cls}"${o.on ? ` onClick="{{${o.on}}}"` : ''}>${icon ? ico(icon, 20) : ''}${x(label)}</button>`;
  C.split = (label, icon) => `<span class="split w"><button class="btn f">${icon ? ico(icon, 20) : ''}${x(label)}</button><button class="btn f drop" aria-label="${x('More ways to do this|更多做法')}">${ico('down', 18, 2.4)}</button></span>`;
  C.tag = (label, cls = '') => `<span class="tag ${cls}">${x(label)}</span>`;
  C.hero = (o) => `<section class="u-hero rise ${o.cls || ''}" aria-label="${x(o.title)}">${o.shapes || shape('c12', 'right:-70px;top:-90px;width:340px;height:340px', 'u-spin') + shape('f4', 'left:38%;bottom:-130px;width:260px;height:260px', 'u-spin r') + shape('pill', 'left:-80px;top:-60px;width:200px;height:200px', 'u-float')}<div><div class="u-eye">${(o.tags || []).map(tg => `<span class="tag">${tg.startsWith('{{') || tg.startsWith('<') ? tg : x(tg)}</span>`).join('')}<span class="tag">{{fwName}}</span><span class="tag">{{roleName}}</span></div><h1 class="disp">${x(o.title)}</h1><p class="lede">${x(o.lede)}</p>${o.stats ? `<div class="u-stats">${o.stats.map(sv => `<div><div class="k">${x(sv[0])}</div><div class="big">${sv[1]}<small>${sv[2] ? x(sv[2]) : ''}</small></div></div>`).join('')}</div>` : ''}${o.act ? `<div class="u-acts">${o.act}</div>` : ''}</div><div class="u-art">${o.art || ''}</div></section>`;
  C.mer = (html, why = 'Needs Asuswrt-Merlin. Stock ASUS firmware does not offer this.|要用 Asuswrt-Merlin。原廠 ASUS 韌體冇呢個功能。') => `<div><div class="u-merb">${html}</div>${when('stock', `<div class="u-why" role="note">${ico('lock', 18)}<span>${x(why)}</span></div>`, false)}</div>`;
  C.own = (html, why = 'Only the owner can do this.|淨係擁有人先做到。') => `<div><div class="u-ownb">${html}</div>${when('notOwner', `<div class="u-why" role="note">${ico('lock', 18)}<span>${x(why)}</span></div>`, false)}</div>`;
  C.stageBar = (names) => `<div class="u-stage"><span class="k">${x('Stage|階段')}</span><div class="seg" role="group" aria-label="${x('Board stage|畫板階段')}" style="flex-wrap:wrap">${STAGES.map((k, i) => `<button aria-pressed="{{stp.${k}}}" onClick="{{f.st_${k}}}">${x(names[i])}</button>`).join('')}</div></div>`;
  C.stg = (k, html) => when('st.' + k, html, k === (C._st || 'ready'));
  C.dock = (text, btns) => `<div class="dock glass rise" role="region" aria-label="${x('Pending changes|未套用嘅變更')}" style="color:var(--text);margin:0"><b>${x(text)}</b>${btns}</div>`;
  C.data = () => ({ tx, sw, sg, num, sel });
  return C;
}

export const STAGES = ['loading', 'empty', 'ready', 'success', 'failure'];
const RUNTIME = `class Component extends DCLogic {
  renderVals() {
    const D = __DATA__;
    const p = this.props || {}, s = this.state || {};
    const lang = p.lang ?? 'en', role = p.role ?? 'owner', firmware = p.firmware ?? 'merlin', motion = p.motion ?? 'expressive';
    const accent = p.accent || '#4f5bd5';
    const dark = p.dark === true || p.dark === 'true' || p.dark === 1 || p.dark === '1';
    const T = (en, yue) => (en === yue || lang === 'en') ? en : lang === 'yue' ? yue : en + ' · ' + yue;
    const canWrite = role !== 'viewer';
    const V = s.v || {};
    const put = (k, val, view) => { if (view || canWrite) this.setState({ v: Object.assign({}, V, { [k]: val }) }); };
    const t = {}, c = {}, a = {}, b = {}, nb = {}, f = {}, pt = {}, g = {}, is = {}, n = {}, pc = {}, pq = {}, v = {}, d = {}, st = {}, stp = {};
    D.tx.forEach((r, i) => { t['k' + i] = T(r[0], r[1]); });
    Object.keys(D.sw).forEach(k => { const def = D.sw[k][0], view = D.sw[k][1]; const on = k in V ? !!V[k] : !!def; c[k] = on ? 'on' : ''; a[k] = on ? 'true' : 'false'; b[k] = on; nb[k] = !on; pt[k] = on ? 'text' : 'password'; f[k] = () => put(k, !on, view); });
    Object.keys(D.sg).forEach(k => { const cnt = D.sg[k][0], view = D.sg[k][2]; const cur = k in V ? V[k] : D.sg[k][1]; for (let i = 0; i < cnt; i++) { g[k + '_' + i] = cur === i ? 'true' : 'false'; is[k + '_' + i] = cur === i; f[k + '_' + i] = () => put(k, i, view); } });
    Object.keys(D.num).forEach(k => { const def = D.num[k][0], stp2 = D.num[k][1], mn = D.num[k][2], mx = D.num[k][3], pre = D.num[k][4] || []; const cur = k in V ? V[k] : def; const cl = (q) => Math.max(mn, Math.min(mx, q)); const pr = mx > mn ? (cur - mn) / (mx - mn) * 100 : 0; n[k] = cur; pc[k] = pr.toFixed(1) + '%'; pq[k] = (100 - pr).toFixed(1) + '%'; f[k + '_up'] = () => put(k, cl(cur + stp2)); f[k + '_dn'] = () => put(k, cl(cur - stp2)); f[k + '_in'] = (e) => { const q = Number(e && e.target ? e.target.value : NaN); if (!isNaN(q)) put(k, cl(Math.round(q))); }; pre.forEach((pv, i) => { f[k + '_p' + i] = () => put(k, pv); }); });
    Object.keys(D.sel).forEach(k => { const cur = k in V ? V[k] : D.sel[k][0]; const dd = D.sel[k][1][cur] || ['', '']; v[k] = String(cur); d[k] = T(dd[0], dd[1]); f[k] = (e) => { const q = Number(e && e.target ? e.target.value : NaN); if (!isNaN(q)) put(k, q); }; });
    const stageP = p.stage ?? D.stage0;
    const stage = (s.stf === stageP && s.st) || stageP;
    D.stages.forEach(k => { st[k] = stage === k; stp[k] = stage === k ? 'true' : 'false'; f['st_' + k] = () => this.setState({ st: k, stf: stageP }); });
    return {
      accent, dark, darkNum: dark ? 1 : 0, lang, role, firmware, motion,
      motionCls: motion === 'calm' ? 'calm' : motion === 'standard' ? 'std' : '',
      rootCls: 'role-' + role + ' fw-' + firmware + ' lang-' + lang,
      viewer: role === 'viewer', notOwner: role !== 'owner', stock: firmware !== 'merlin', merlin: firmware === 'merlin',
      fwName: firmware === 'merlin' ? 'Asuswrt-Merlin 388.8_4' : T('Stock ASUS 388.24198', '原廠 ASUS 388.24198'),
      roleName: role === 'owner' ? T('Pat · Owner', 'Pat · 擁有人') : role === 'operator' ? T('Pat · Operator', 'Pat · 操作員') : T('Pat · Viewer, read only', 'Pat · 檢視者（唯讀）'),
      readOnly: T('Read-only role: you can look at everything here, but every control that would change the router is switched off.', '唯讀角色：呢度樣樣都睇得，但會改到路由器嘅控制項全部閂咗。'),
      pendCount: D.pend, tabsStr: D.tabs[0].split(',').map((e, i) => T(e, D.tabs[1].split(',')[i] || e)).join(','), title: T(D.title[0], D.title[1]),
      noop: () => {}, t, c, a, b, nb, f, pt, g, is, n, pc, pq, v, d, st, stp
    };
  }
}`;

const TW = (h, w, stage) => { const o = { accent: { editor: 'color', default: '#4f5bd5', options: ['#4f5bd5', '#00897b', '#d81b60', '#f4511e', '#7c4dff'], section: 'Look' }, dark: { editor: 'boolean', default: false, section: 'Look' }, motion: { editor: 'enum', options: ['calm', 'standard', 'expressive'], default: 'expressive', section: 'Look' }, firmware: { editor: 'enum', options: ['merlin', 'stock'], default: 'merlin', section: 'Router' }, role: { editor: 'enum', options: ['owner', 'operator', 'viewer'], default: 'owner', section: 'Router' }, lang: { editor: 'enum', options: ['en', 'yue', 'both'], default: 'en', section: 'Language' } }; if (stage) o.stage = { editor: 'enum', options: STAGES, default: stage, section: 'Board' }; o.$preview = { width: w, height: h }; return JSON.stringify(o).replace(/&/g, '&amp;').replace(/'/g, '&#39;'); };

const pairOf = (str) => { const j = str.indexOf('|'); return j < 0 ? [str, str] : [str.slice(0, j), str.slice(j + 1)]; };

export function emit(spec, C, body) {
  const data = Object.assign(C.data(), { stage0: spec.stage || 'ready', stages: STAGES, pend: spec.pend ?? 2, tabs: pairOf(spec.tabs || spec.title), title: pairOf(spec.title) });
  const phone = spec.kind === 'phone';
  const ro = C.when('viewer', `<div class="u-ro rise" role="status">${ico('eye', 20)}<span>{{readOnly}}</span></div>`, false);
  let markup;
  if (phone) {
    const nav = [['home', 'Home|主頁', 'Phone.dc.html'], ['laptop', 'Devices|裝置', 'PhoneDevices.dc.html'], ['wifi', 'Wi-Fi|Wi-Fi', 'PhoneWifi.dc.html'], ['history', 'Changes|變更', 'PhoneGuard.dc.html'], ['grid', 'More|更多', 'PhoneNav.dc.html']];
    markup = `<div class="mx u-ph {{motionCls}} {{rootCls}}" style="--accent:{{accent}};--dark:{{darkNum}}">
<div class="u-sb" aria-hidden="true"><span>9:41</span><span style="display:flex;gap:6px;align-items:center">${ico('wifi', 16, 2.4)}<svg width="26" height="13" viewBox="0 0 26 13" aria-hidden="true"><rect x=".7" y=".7" width="22" height="11.6" rx="3.5" fill="none" stroke="currentColor" stroke-opacity=".5"/><rect x="2.4" y="2.4" width="15" height="8.2" rx="2" fill="currentColor"/><path d="M24.4 4.5v4" stroke="currentColor" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round"/></svg></span></div>
<header class="u-ab">${spec.back ? `<a class="icb" href="${spec.back}" aria-label="${C.x('Back|返回')}" style="margin-left:-12px">${ico('back', 24, 2.2)}</a>` : ''}<h1>{{title}}</h1><a class="icb" href="PhoneNav.dc.html" aria-label="${C.x('Search everything|搜尋所有嘢')}">${ico('search', 24)}</a><a class="icb" href="PhoneSettings.dc.html" aria-label="${C.x('Notifications, 4 unread|通知，4 則未讀')}">${ico('bell', 24)}<span class="dotb">4</span></a></header>
<main class="u-pc">${ro}${body.main}</main>
${body.fab || ''}
<nav class="u-bn" aria-label="${C.x('Main areas|主要功能')}">${nav.map((nv, i) => `<a href="${nv[2]}" class="${i === spec.nav ? 'on' : ''}"${i === spec.nav ? ' aria-current="page"' : ''}><span class="p">${ico(nv[0], 22)}${i === 3 ? '<span class="badge">2</span>' : ''}</span>${C.x(nv[1])}</a>`).join('')}</nav>
${body.over || ''}
</div>`;
  } else {
    markup = `<div class="mx shell {{motionCls}} {{rootCls}}" style="position:relative;--accent:{{accent}};--dark:{{darkNum}}">
  <div class="railwrap">
    <dc-import name="Rail" page="${spec.rail}" lang="{{lang}}" role="{{role}}" firmware="{{firmware}}" motion="{{motion}}" pending="{{pendCount}}" accent="{{accent}}" dark="{{dark}}" hint-size="288px,900px"></dc-import>
  </div>
  <div class="main">
    <dc-import name="TopBar" title="{{title}}" lang="{{lang}}" role="{{role}}" firmware="{{firmware}}" motion="{{motion}}" tabs="{{tabsStr}}" active="${spec.active ?? 0}" accent="{{accent}}" dark="{{dark}}" hint-size="1152px,170px"></dc-import>
    <main class="page">
${ro}
${body.main}
    </main>
  </div>
${body.over || ''}
</div>`;
  }
  data.tx = C.data().tx; // texts registered while building the frame
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${spec.name}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="theme.css">
</head>
<body>
<x-dc>
<helmet>
${FONT}
<style>body{margin:0}${spec.css || ''}</style>
</helmet>
${markup}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='${TW(spec.h, phone ? 390 : 1440, spec.hasStage ? (spec.stage || 'ready') : null)}'>
${RUNTIME.replace('__DATA__', () => JSON.stringify(data))}
</script>
</body>
</html>
`;
  return html;
}
