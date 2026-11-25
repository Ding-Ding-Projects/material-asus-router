import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mk, emit } from './lib.mjs';
import { CSS, MARK } from './css.mjs';
import { A } from './boardsA.mjs';
import { B } from './boardsB.mjs';
import { Cc } from './boardsC.mjs';
import { OLD, PAGES } from './meta.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(here, '..', 'project');
const PREV = path.join(here, '..', 'preview');
fs.mkdirSync(PREV, { recursive: true });
const NEW = [...A, ...B, ...Cc];
const errors = [];

// 1. theme
let theme = fs.readFileSync(PROJ + '/theme.css', 'utf8');
const cut = theme.indexOf(MARK);
if (cut >= 0) theme = theme.slice(0, cut);
fs.writeFileSync(PROJ + '/theme.css', theme.trimEnd() + '\n\n' + CSS);

// 2. shared shell components: motion Tweak, links to the new boards, catalogue wording
const MOTION = '"motion":{"editor":"enum","options":["calm","standard","expressive"],"default":"expressive","section":"Look"},';
let rail = fs.readFileSync(PROJ + '/Rail.dc.html', 'utf8');
const href = { aimesh: 'Mesh', lan: 'Lan', forwarding: 'Lan', firewall: 'Firewall', qos: 'Qos', vpn: 'Vpn', parental: 'Parental', usb: 'Storage', jobs: 'Jobs', firmware: 'Firmware', system: 'System', maintenance: 'System', backup: 'Backup', help: 'Help' };
for (const [id, f] of Object.entries(href)) rail = rail.replace(new RegExp("(\\['" + id + "', '[^']*', '[^']*', ')[^']*'"), '$1' + f + ".dc.html'");
rail = rail.replace("'區域網絡'", "'本地網絡'").replace("'流量優先次序'", "'流量優先'").replace("'家長監護'", "'家長控制'").replace("'Merlin 擴充功能'", "'Merlin 附加功能'");
if (!rail.includes("['speedlab'")) rail = rail.replace("      ['jobs',", "      ['speedlab', 'Speed lab', '速度實驗室', 'SpeedLab.dc.html', 'qos', 0],\n      ['utilities', 'Router utilities', '路由器工具', 'Utilities.dc.html', 'box', 0],\n      ['jobs',");
if (!rail.includes("['updates'")) rail = rail.replace("      ['toolbox',", "      ['regex', 'Regex builder', '正則表達式產生器', 'Regex.dc.html', 'code', 0],\n      ['updates', 'Updates', '更新', 'Updates.dc.html', 'spark', 0],\n      ['toolbox',");
if (!rail.includes('"motion"')) {
  rail = rail.replace('"lang":{"editor":"enum"', MOTION + '"lang":{"editor":"enum"');
  rail = rail.replace('<nav class="mx rail"', '<nav class="mx rail {{motionCls}}"');
  rail = rail.replace("const page = p.page || 'overview';", "const page = p.page || 'overview';\n    const motion = p.motion ?? 'expressive';");
  rail = rail.replace('accent, darkNum: dark ? 1 : 0, pending,', "accent, darkNum: dark ? 1 : 0, motionCls: motion === 'calm' ? 'calm' : motion === 'standard' ? 'std' : '', pending,");
}
fs.writeFileSync(PROJ + '/Rail.dc.html', rail);
let top = fs.readFileSync(PROJ + '/TopBar.dc.html', 'utf8');
if (!top.includes('"motion"')) {
  top = top.replace('"lang":{"editor":"enum"', MOTION + '"lang":{"editor":"enum"');
  top = top.replace('<header class="mx topbar"', '<header class="mx topbar {{motionCls}}"');
  top = top.replace("const accent = p.accent || '#4f5bd5';", "const accent = p.accent || '#4f5bd5';\n    const motion = p.motion ?? 'expressive';");
  top = top.replace("accent, darkNum: dark ? 1 : 0, title:", "accent, darkNum: dark ? 1 : 0, motionCls: motion === 'calm' ? 'calm' : motion === 'standard' ? 'std' : '', title:");
}
fs.writeFileSync(PROJ + '/TopBar.dc.html', top);

// 3. new boards
for (const spec of NEW) {
  const C = mk(); C._st = spec.stage || 'ready';
  if (spec.pre) spec.pre(C);
  const body = spec.build(C);
  const html = emit(spec, C, body);
  fs.writeFileSync(PROJ + '/' + spec.file, html);
  // tag balance
  const mkp = html.match(/<x-dc>([\s\S]*)<\/x-dc>/)[1];
  const VOID = new Set(['input', 'br', 'img', 'meta', 'link', 'hr', 'stop']);
  const stack = []; const re = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|[^>"])*)>/g; let mm;
  while ((mm = re.exec(mkp))) { const [, close, tag, rest] = mm; if (VOID.has(tag) || rest.trimEnd().endsWith('/')) continue; if (!close) stack.push(tag); else { const topTag = stack.pop(); if (topTag !== tag) { errors.push(`${spec.file}: tag mismatch </${tag}> closes <${topTag}> near ${mkp.slice(Math.max(0, mm.index - 80), mm.index + 20).replace(/\n/g, ' ')}`); break; } } }
  if (stack.length && !errors.some(e => e.startsWith(spec.file))) errors.push(`${spec.file}: unclosed ${stack.join(',')}`);
}

// 4. static pre-render of every board (old and new) for hole checks and height measurement
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cache = {};
function load(file) {
  if (cache[file]) return cache[file];
  const src = fs.readFileSync(PROJ + '/' + file, 'utf8');
  let mkp = src.match(/<x-dc>([\s\S]*)<\/x-dc>/)[1];
  const helm = (mkp.match(/<helmet>([\s\S]*?)<\/helmet>/) || [])[1] || '';
  mkp = mkp.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const sm = src.match(/<script type="text\/x-dc"[^>]*data-props='([^']*)'[^>]*>([\s\S]*?)<\/script>/);
  const propsDef = JSON.parse(sm[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
  const Comp = new Function('DCLogic', sm[2] + '\nreturn Component;')(class { setState() {} });
  return (cache[file] = { mkp, helm, propsDef, Comp });
}
function render(file, props, miss) {
  const c = load(file); const defs = {};
  for (const k of Object.keys(c.propsDef)) if (k[0] !== '$') defs[k] = c.propsDef[k].default;
  const inst = new c.Comp(); inst.props = Object.assign(defs, props); inst.state = {};
  const vals = inst.renderVals();
  const get = (p, scope) => { let o = scope; for (const part of p.split('.')) { if (o == null) return undefined; o = o[part]; } return o; };
  let h = c.mkp, styles = c.helm.replace(/<link[^>]*>/g, '');
  const forRe = /<sc-for list="\{\{([^}]+)\}\}" as="(\w+)"[^>]*>((?:(?!<sc-for)[\s\S])*?)<\/sc-for>/;
  let m2, guard = 0;
  while ((m2 = forRe.exec(h)) && guard++ < 5000) {
    const list = get(m2[1].trim(), vals); const as = m2[2];
    const out = (Array.isArray(list) ? list : []).map(item => m2[3].replace(new RegExp('\\{\\{\\s*' + as + '((?:\\.[\\w$]+)*)\\s*\\}\\}', 'g'), (_, pth) => { const v = pth ? get(pth.slice(1), item) : item; return typeof v === 'function' ? '' : v === undefined || v === null ? '' : esc(v); })).join('');
    h = h.slice(0, m2.index) + out + h.slice(m2.index + m2[0].length);
  }
  const ifRe = /<sc-if value="([^"]*)"[^>]*>((?:(?!<sc-if)[\s\S])*?)<\/sc-if>/;
  while ((m2 = ifRe.exec(h)) && guard++ < 20000) {
    let v = m2[1].trim(); const hm = v.match(/^\{\{\s*([\w.$]+)\s*\}\}$/);
    if (hm) { v = get(hm[1], vals); if (v === undefined) miss.add(file + ' sc-if ' + hm[1]); } else v = !(v === '' || v === 'false' || v === '0' || v === 'undefined');
    h = h.slice(0, m2.index) + (v ? m2[2] : '') + h.slice(m2.index + m2[0].length);
  }
  h = h.replace(/<dc-import name="(\w+)"([^>]*)><\/dc-import>/g, (_, name, attrs) => {
    const cp = {}; attrs.replace(/([\w-]+)="([^"]*)"/g, (_2, k, v) => { const hm = v.match(/^\{\{\s*([\w.$]+)\s*\}\}$/); cp[k] = hm ? get(hm[1], vals) : v; return ''; });
    delete cp['hint-size'];
    const r = render(name + '.dc.html', cp, miss); styles += r.styles; return r.html;
  });
  h = h.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (_, p) => { const v = get(p, vals); if (v === undefined) { miss.add(file + ' ' + p); return ''; } return typeof v === 'function' ? '' : esc(v); });
  return { html: h, styles };
}
const all = fs.readdirSync(PROJ).filter(f => f.endsWith('.dc.html'));
const themeUrl = 'file:///' + PROJ + '/theme.css';
const newFiles = new Set(NEW.map(s => s.file));
const variants = { '': {}, '_yue_dark_stock_viewer': { lang: 'yue', dark: true, firmware: 'stock', role: 'viewer', motion: 'calm' } };
for (const f of all) {
  for (const [suffix, props] of Object.entries(variants)) {
    const miss = new Set();
    try {
      const r = render(f, props, miss);
      if (miss.size && newFiles.has(f)) errors.push(`${f}${suffix}: unresolved ${[...miss].slice(0, 8).join(' | ')}`);
      else if (miss.size) console.log(`note (older board) ${f}${suffix}: unresolved ${[...miss].slice(0, 4).join(' | ')}`);
      fs.writeFileSync(path.join(PREV, f.replace('.dc.html', suffix + '.html')), `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${themeUrl}"><link href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000&display=swap" rel="stylesheet">${r.styles}</head><body style="margin:0">${r.html}<script>addEventListener('load',()=>setTimeout(()=>{const e=document.body.firstElementChild;document.documentElement.setAttribute('data-h',Math.ceil(e.getBoundingClientRect().height));document.documentElement.setAttribute('data-sw',document.documentElement.scrollWidth)},400))</script></body></html>`);
    } catch (e) { (newFiles.has(f) ? errors : []).push(`${f}${suffix}: render failed ${e.message}`); console.log('render failed', f, suffix, e.message); }
  }
}
// stage variants of staged boards for visual checks
for (const spec of NEW.filter(s => s.hasStage)) for (const stg of ['loading', 'empty', 'ready', 'success', 'failure']) { const miss = new Set(); const r = render(spec.file, { stage: stg }, miss); if (miss.size) errors.push(`${spec.file} stage ${stg}: unresolved ${[...miss].slice(0, 5).join(' | ')}`); fs.writeFileSync(path.join(PREV, spec.file.replace('.dc.html', '_st_' + stg + '.html')), `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${themeUrl}"><link href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000&display=swap" rel="stylesheet">${r.styles}</head><body style="margin:0">${r.html}<script>addEventListener('load',()=>setTimeout(()=>{const e=document.body.firstElementChild;document.documentElement.setAttribute('data-h',Math.ceil(e.getBoundingClientRect().height))},400))</script></body></html>`); }

// 5. hard-rule scan over every project file
const bad = [[/\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/, 'private address'], [/\bcat\b/i, 'forbidden word'], [/\b(admin|root|docker)@/i, 'account prefix'], [/\u2014/, 'em dash']];
for (const f of fs.readdirSync(PROJ)) { const src = fs.readFileSync(PROJ + '/' + f, 'utf8'); for (const [re, why] of bad) { const mm = src.match(re); if (mm) errors.push(`${f}: ${why}: ${src.slice(Math.max(0, mm.index - 40), mm.index + 40).replace(/\n/g, ' ')}`); } }

// 6. canvas.json and HANDOFF.md
const heights = fs.existsSync(path.join(here, 'heights.json')) ? JSON.parse(fs.readFileSync(path.join(here, 'heights.json'), 'utf8')) : {};
const meta = {};
for (const o of OLD) meta[o.file] = o;
for (const s of NEW) meta[s.file] = { file: s.file, page: s.page, title: s.name, note: s.note, dram: s.dram, unbuilt: s.unbuilt, phone: s.kind === 'phone', stage: !!s.hasStage, h: s.h, isNew: true };
const prevCanvas = JSON.parse(fs.readFileSync(PROJ + '/canvas.json', 'utf8'));
const canvas = { v: 3, createdOnFiles: prevCanvas.createdOnFiles, title: 'Material Asus Router', launch: { view: 'canvas', page: 'overview' }, pages: PAGES.map(p => ({ id: p.id, name: p.name })), boards: {}, order: [], notes: {}, designSystems: [] };
const GAP = 80, ROWGAP = 120, NOTEH = 620;
for (const pg of PAGES) {
  const list = pg.boards.map(f => meta[f]); if (list.some(b => !b)) throw new Error('missing meta on page ' + pg.id);
  let y = 0, rowW = 0;
  for (let i = 0; i < list.length; i += 4) {
    const row = list.slice(i, i + 4); let x = 0, maxH = 0;
    row.forEach(b => { const w = b.comp ? b.w : b.phone ? 390 : 1440; const h = heights[b.file] || b.h || 900; b._w = w; b._h = h; maxH = Math.max(maxH, h); });
    row.forEach((b, j) => {
      const e = { x, y, w: b._w, h: b._h, title: b.title, page: pg.id };
      if (!b.phone && !b.comp) e.expand = 'fill';
      if (!b.static) e.is_interactive = true;
      canvas.boards[b.file] = e; canvas.order.push(b.file);
      const last = j === row.length - 1;
      const nw = 420; const nx = last ? x + b._w + GAP : x; const ny = last ? y : y + maxH + 40;
      canvas.notes['s_' + b.file.replace('.dc.html', '').toLowerCase()] = { x: nx, y: ny, w: nw, page: pg.id, fill: pg.fill, text: b.note };
      x += b._w + GAP;
    });
    if (i === 0) rowW = x - GAP;
    y += maxH + 40 + (row.length > 1 ? NOTEH : 0) + ROWGAP;
  }
  canvas.notes['t_' + pg.id] = { kind: 'title1', x: 0, y: -300, w: rowW, maxW: rowW, page: pg.id, text: pg.name };
}
fs.writeFileSync(PROJ + '/canvas.json', JSON.stringify(canvas, null, 2) + '\n');

const TWEAKS = 'accent (colour, default #4f5bd5, five swatches), dark (boolean, default false), motion (calm, standard, expressive; default expressive), firmware (merlin, stock; default merlin), role (owner, operator, viewer; default owner), lang (en, yue, both; default en)';
let md = `# Material Asus Router: design handoff\n\nThis folder holds the design canvas for Material Asus Router, a self-hosted web app and Windows desktop app that manages an Asus router (stock ASUS or Asuswrt-Merlin) over SSH. The canvas project is in \`design/canvas/project\`. Every board is one whole HTML file; \`theme.css\` is the shared expressive Material 3 theme; \`Rail.dc.html\` and \`TopBar.dc.html\` are the shared shell that every desktop board imports.\n\nDemo data throughout: an RT-AX86U at 198.51.100.1 on the documentation network 198.51.100.0/24, outside addresses in 203.0.113.0/24 and 192.0.2.0/24, people named Pat and Alex.\n\n## Tweaks carried by every board\n\nEvery board, including the two shell components, declares the same Tweaks with the same names and defaults: ${TWEAKS}. Boards with stages add \`stage\` (loading, empty, ready, success, failure). The shell components add their own content props (page, pending, title, tabs, active).\n\nWhat each Tweak does on every board:\n\n- **accent** re-tones every colour role; all roles are derived from the one accent in \`theme.css\`.\n- **dark** flips every surface and text role.\n- **motion** calm stills every animation and transition, standard keeps normal motion and removes the dramatic set, expressive plays everything. The operating system reduced-motion setting also stills everything. The resting frame is the designed frame, so a still board reads on its own.\n- **firmware** changes the firmware name in the rail, top bar and hero, hides or locks Merlin-only areas and shows the reason on stock.\n- **role** viewer dims and disables every control that would change the router and shows a read-only strip; operator locks owner-only actions with the reason; owner sees everything.\n- **lang** switches every string between English, Hong Kong Cantonese and both side by side.\n\n## Motion system\n\n**Normal motion, on every board:** staggered card entrances (\`.rise\`), hover lift on cards, press squash and shape morph on buttons, chips and steppers, switch thumb spring, meter bars growing from the left, focus rings, navigation rail hover shift, bottom sheets springing from the edge on phones.\n\n**Dramatic motion, only where it carries meaning:** listed per board below. The dramatic set uses the classes \`dr\`, \`u-spin\`, \`u-float\`, \`u-rip\`, \`u-pop\`, \`u-conf\`, \`u-shake\`, \`u-count\`, \`u-draw\`, \`u-ringv\` and \`u-needle\`.\n\n## Control library (theme.css, classes starting with u-)\n\nSwitch, segmented buttons, select with a description line, thick slider with value bubble, stepper, four-part IPv4 picker, prefix stepper with a network and host bar, port picker with presets, device picker (name, MAC, address), paintable weekly schedule grid (one toggle per hour), two-handle address-range bar with reservation dots, password field with reveal and strength meter, toggle chips, file drop zone, split button, sticky action dock, extended FAB. Graphics: gradient area chart, bar chart, horizontal bars, ring, gauge with needle, wavy progress, step pipeline, sparkline, sample QR pattern, confetti.\n\nIn the generated boards every one of these controls is wired to board state, so it can be operated on the canvas.\n\n## Pages and boards\n`;
for (const pg of PAGES) {
  md += `\n### ${pg.name} (page id \`${pg.id}\`)\n`;
  for (const f of pg.boards) { const b = meta[f]; md += `\n**${b.title}** (\`${f}\`, ${b.comp ? b.w + ' px wide component' : b.phone ? '390 by 844, fixed root' : '1440 wide, fills'}${b.static ? '' : ', interactive'})\n\n- Shows: ${b.note}\n- Tweaks: the six shared Tweaks${b.stage ? ' plus `stage` (loading, empty, ready, success, failure)' : ''}${b.comp ? ' plus its content props' : ''}.\n- Dramatic motion: ${b.dram}\n- Normal motion: staggered entrances, hover, press and focus transitions on every control.\n- Still unbuilt in the real app: ${b.unbuilt}\n`; }
}
md += `\n## What the real app has today\n\nThe app in \`public/\` and \`server/\` has: first-run owner account, connect and host key approval; overview; devices; a settings catalogue rendered as switches, selects, sliders, number, IPv4, host name and password fields across Wi-Fi, internet, local network, firewall, port forwarding, parental controls, traffic priority, VPN and USB; logs; ping, traceroute and name lookup run on the router; the read-only scheduled jobs table; the advanced table; change history with undo; and the write path (preview, connection-loss guard for network changes, two-key confirmation for destructive actions). Everything else on the canvas is design only, as stated per board above.\n\n## Known gaps in the canvas itself\n\n- The older boards (Setup, Devices, Wi-Fi, Network, Security, Locks, Toolbox, Server manager, Language, Appearance) still show some typed fields where the newer boards show pickers. The pickers on Addresses and ports, Firewall, VPN and System are the reference to follow when those boards are next revised.\n- Board heights in \`canvas.json\` were measured from a static pre-render of each board at 1440 px in a desktop browser, not inside the canvas runtime. Desktop boards use \`expand: fill\`, so a small difference only changes the empty space under a board.\n- The boards were checked by static pre-render (every value hole resolves, tags balance, both languages, dark, stock firmware and viewer role render). They were not operated inside the live canvas runtime in this pass.\n- The regex builder board lists its own parity gaps; it is not at full parity with the reference tool.\n- The weekly schedule grid uses 30 px hour cells, below the 44 px target size; the day chips and quick-fill chips beside it are the full-size route.\n- Captures on the documentation website board are placeholders until real captures of a built release exist.\n`;
fs.writeFileSync(PROJ + '/../HANDOFF.md', md);

console.log('boards written:', NEW.length, 'total dc files:', all.length);
if (errors.length) { console.log('ERRORS\n' + errors.join('\n')); process.exitCode = 1; } else console.log('all checks passed');
