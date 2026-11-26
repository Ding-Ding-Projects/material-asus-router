// Generates the whole design canvas: theme.css, every board, canvas.json and
// HANDOFF.md. Run: node gen.mjs  (set PREVIEW_DIR to also write static
// pre-renders of every board for screenshots).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { emit } from './kit.mjs';
import { CSS } from './theme.mjs';
import { rail, topbar } from './shell.mjs';
import { B1 } from './boards1.mjs';
import { B2 } from './boards2.mjs';
import { B3 } from './boards3.mjs';
import { B4 } from './boards4.mjs';
import { B5 } from './boards5.mjs';
import { B6 } from './boards6.mjs';
import { B7 } from './boards7.mjs';
import { B8 } from './boards8.mjs';
import { B9 } from './boards9.mjs';
import { CSS2 } from './theme2.mjs';
import { CSS3 } from './theme3.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(here, '..', 'project');
const PREV = process.env.PREVIEW_DIR || '';
const SPECS = [...B1, ...B2, ...B3, ...B4, ...B5, ...B6, ...B7, ...B8, ...B9];
const errors = [];

fs.writeFileSync(path.join(PROJ, 'theme.css'), CSS + CSS2 + CSS3);
fs.writeFileSync(path.join(PROJ, 'Rail.dc.html'), rail());
fs.writeFileSync(path.join(PROJ, 'TopBar.dc.html'), topbar());
const keep = new Set(['Rail.dc.html', 'TopBar.dc.html', ...SPECS.map(s => s.file)]);
for (const f of fs.readdirSync(PROJ)) if (f.endsWith('.dc.html') && !keep.has(f)) fs.unlinkSync(path.join(PROJ, f));
for (const spec of SPECS) {
  let html;
  try { html = emit(spec); } catch (e) { errors.push(`${spec.file}: build failed ${e.stack.split('\n').slice(0, 3).join(' ')}`); continue; }
  fs.writeFileSync(path.join(PROJ, spec.file), html);
  const mkp = html.match(/<x-dc>([\s\S]*)<\/x-dc>/)[1];
  const VOID = new Set(['input', 'br', 'img', 'meta', 'link', 'hr', 'stop', 'path', 'circle', 'rect']);
  const stack = []; const re = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|[^>"])*)>/g; let mm;
  while ((mm = re.exec(mkp))) { const [, close, tag, rest] = mm; if (rest.trimEnd().endsWith('/')) continue; if (VOID.has(tag) && !close) { if (['path', 'circle', 'rect'].includes(tag)) errors.push(`${spec.file}: <${tag}> not self-closed`); continue; } if (!close) stack.push(tag); else { const top = stack.pop(); if (top !== tag) { errors.push(`${spec.file}: </${tag}> closes <${top}> near ${mkp.slice(Math.max(0, mm.index - 90), mm.index + 20).replace(/\n/g, ' ')}`); break; } } }
  if (stack.length && !errors.some(e => e.startsWith(spec.file))) errors.push(`${spec.file}: unclosed ${stack.join(',')}`);
  if (/<dc-import[^>]*\/>/.test(mkp) || /<dc-import[^>]* name="\w+"[^>]* name=/.test(mkp)) errors.push(`${spec.file}: bad dc-import`);
}

// ---- static renderer (a small stand-in for the canvas runtime) ----
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cache = {};
function load(file) {
  if (cache[file]) return cache[file];
  const src = fs.readFileSync(path.join(PROJ, file), 'utf8');
  const mkp = src.match(/<x-dc>([\s\S]*)<\/x-dc>/)[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const sm = src.match(/<script type="text\/x-dc"[^>]*data-props='([^']*)'[^>]*>([\s\S]*?)<\/script>/);
  const propsDef = JSON.parse(sm[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
  const Comp = new Function('DCLogic', sm[2] + '\nreturn Component;')(class { setState(o) { this.state = Object.assign({}, this.state, o); this._set = (this._set || 0) + 1; } });
  return (cache[file] = { mkp, propsDef, Comp });
}
function instance(file, props) { const c = load(file); const defs = {}; for (const k of Object.keys(c.propsDef)) if (k[0] !== '$') defs[k] = c.propsDef[k].default; const inst = new c.Comp(); inst.props = Object.assign(defs, props); inst.state = {}; return inst; }
function render(file, props, miss, state) {
  const c = load(file); const inst = instance(file, props); if (state) inst.state = state;
  const vals = inst.renderVals();
  const get = (p, sc) => { const parts = p.split('.'); let o; for (let i = sc.length - 1; i >= 0; i--) if (parts[0] in sc[i]) { o = sc[i]; break; } if (!o) return undefined; for (const part of parts) { if (o == null) return undefined; o = o[part]; } return o; };
  const fill = (h, sc) => h.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (_, p) => { const v = get(p, sc); if (v === undefined) { miss.add(file + ' ' + p); return ''; } return typeof v === 'function' ? '' : esc(v); });
  const walk = (h, sc) => {
    let out = '', i = 0;
    for (;;) {
      const m = /<(sc-for|sc-if|dc-import)\b([^>]*)>/g; m.lastIndex = i; const r = m.exec(h);
      if (!r) { out += fill(h.slice(i), sc); break; }
      out += fill(h.slice(i, r.index), sc);
      const tag = r[1]; const re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'g'); re.lastIndex = m.lastIndex; let depth = 1, e;
      while ((e = re.exec(h))) { depth += e[1] ? -1 : 1; if (!depth) break; }
      if (!e) throw new Error('unclosed ' + tag);
      const inner = h.slice(m.lastIndex, e.index); i = re.lastIndex;
      const at = {}; r[2].replace(/([\w-]+)="([^"]*)"/g, (_2, k, v) => { at[k] = v; return ''; });
      const val = (v) => { const hm = v.match(/^\{\{\s*([\w.$]+)\s*\}\}$/); if (!hm) return fill(v, sc); const q = get(hm[1], sc); if (q === undefined) miss.add(file + ' ' + tag + ' ' + hm[1]); return q; };
      if (tag === 'sc-if') { const v = val(at.value); if (v && v !== 'false' && v !== '0') out += walk(inner, sc); }
      else if (tag === 'sc-for') { const list = val(at.list); (Array.isArray(list) ? list : []).forEach(item => { out += walk(inner, [...sc, { [at.as]: item }]); }); }
      else { const cp = {}; for (const k of Object.keys(at)) if (k !== 'name' && !k.startsWith('hint-')) cp[k] = val(at[k]); out += render(at.name + '.dc.html', cp, miss); }
    }
    return out;
  };
  return walk(c.mkp, [vals]);
}

// ---- checks: every hole resolves, every handler runs, every staged board renders every stage ----
const VAR = { '': {}, _alt: { lang: 'yue', dark: true, firmware: 'stock', role: 'viewer', motion: 'calm' } };
const shell = (inner, extra = '') => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(PROJ, 'theme.css')).href}"><link href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000&display=swap" rel="stylesheet"><style>body{margin:0}${extra}</style></head><body>${inner}</body></html>`;
if (PREV) fs.mkdirSync(PREV, { recursive: true });
const jobs = [];
for (const spec of [...SPECS, { file: 'Rail.dc.html' }, { file: 'TopBar.dc.html' }]) {
  if (errors.some(e => e.startsWith(spec.file))) continue;
  const base = spec.file.replace('.dc.html', '');
  const runs = Object.entries(VAR).map(([sfx, props]) => [sfx, props]);
  if (spec.hasStage) for (const stg of ['loading', 'empty', 'ready', 'success', 'failure']) if (stg !== (spec.stage || 'ready')) runs.push(['_' + stg, { stage: stg }]);
  for (const [sfx, props] of runs) {
    const miss = new Set();
    try { const html = render(spec.file, props, miss); const raw = html.match(/[A-Za-z.!?)]\|[㐀-鿿]/); if (raw) errors.push(`${spec.file}${sfx}: untranslated text near ${html.slice(Math.max(0, raw.index - 60), raw.index + 20)}`); if (miss.size) errors.push(`${spec.file}${sfx}: unresolved ${[...miss].slice(0, 8).join(' | ')}`); if (PREV) { fs.writeFileSync(path.join(PREV, base + sfx + '.html'), shell(html)); jobs.push({ name: base + sfx, w: spec.kind === 'phone' ? 390 : spec.file === 'Rail.dc.html' ? 272 : spec.file === 'TopBar.dc.html' ? 1168 : 1440, phone: spec.kind === 'phone' }); } } catch (e) { errors.push(`${spec.file}${sfx}: render failed ${e.message}`); }
  }
  // operate every handler once, from a fresh state each time, and re-render
  try {
    const collect = (o, pre, out, depth) => { if (!o || depth > 4) return out; for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'function') out.push(pre + k); else if (v && typeof v === 'object') collect(v, pre + k + '.', out, depth + 1); } return out; };
    const names = collect(instance(spec.file, {}).renderVals(), '', [], 0);
    let ran = 0, changed = 0;
    for (const nm of names) { const inst = instance(spec.file, {}); let fn = inst.renderVals(); for (const part of nm.split('.')) fn = fn[part]; fn({ target: { value: '7' } }); ran++; if (inst._set) { changed++; inst.renderVals(); const miss = new Set(); render(spec.file, {}, miss, inst.state); if (miss.size) errors.push(`${spec.file} after ${nm}: unresolved ${[...miss].slice(0, 4).join(' | ')}`); } }
    spec._handlers = ran; spec._live = changed;
    if (spec.build && ran && !changed) errors.push(`${spec.file}: no handler changes state`);
  } catch (e) { errors.push(`${spec.file}: handler failed ${e.stack.split('\n').slice(0, 2).join(' ')}`); }
}
if (PREV) fs.writeFileSync(path.join(PREV, 'jobs.json'), JSON.stringify(jobs));

// ---- hard rules over every file in the canvas folder ----
const bad = [[/\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/, 'private address'], [/\bcat\b/i, 'forbidden word'], [/\b(admin|root|docker)@/i, 'account prefix'], [new RegExp(String.fromCharCode(0x2014)), 'em dash'], [/[A-Za-z]:\\\\?Users|\/Users\/|\/home\/\w/, 'machine path'], [/<input(?![^>]*type="(range|text)")/, 'bare input'], [/<textarea|<select/, 'bare form control']];
const scan = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const fp = path.join(dir, f.name); if (f.isDirectory()) { scan(fp); continue; } const src = fs.readFileSync(fp, 'utf8'); for (const [re, why] of bad) { if (f.name === 'gen.mjs' && why !== 'em dash') continue; const mm = src.match(re); if (mm) errors.push(`${f.name}: ${why}: ${src.slice(Math.max(0, mm.index - 40), mm.index + 40).replace(/\n/g, ' ')}`); } } };
scan(path.join(here, '..'));

// ---- canvas.json ----
const PAGES = [
  ['setup', 'Setup, onboarding and start-up', 'blue', ['Setup', 'Startup']], ['routers', 'Saved routers and connection keys', 'blue', ['Routers']], ['overview', 'Overview and notifications', 'blue', ['Main', 'Notifications']],
  ['modes', 'One-click modes', 'pink', ['Modes', 'ModeBuilder']], ['devices', 'Devices and Lock IP', 'teal', ['Devices', 'LockIp']], ['kick', 'Kick, ban and the public Unkick page', 'red', ['KickBan', 'Unkick']], ['wifi', 'Wi-Fi and AiMesh', 'teal', ['WiFi', 'Mesh']],
  ['network', 'Internet, local network, ports, traffic priority', 'green', ['Network', 'Lan', 'Qos']], ['security', 'Firewall, parental controls, VPN', 'red', ['Security', 'Firewall', 'Parental', 'Vpn']],
  ['editors', 'Visual editors', 'purple', ['MapEditor', 'RuleCanvas', 'SchedulePaint', 'PriorityBoard', 'Spectrum', 'PortCanvas', 'VpnDirector', 'DhcpMap']],
  ['storage', 'USB and storage', 'orange', ['Storage']], ['tools', 'Logs, network tools, router tools, scheduled jobs', 'purple', ['Tools', 'SpeedLab', 'Utilities', 'Jobs']],
  ['router', 'Firmware, system, maintenance, backup, advanced, Merlin', 'orange', ['Firmware', 'System', 'Backup', 'Advanced']], ['changes', 'Change history, write stages, takeovers, exports', 'pink', ['Changes', 'Takeover', 'Records']],
  ['app', 'Settings, tabs, appearance, language, modes, locks, regex, updates', 'purple', ['Settings', 'Tabs', 'Appearance', 'Language', 'Focus', 'Locks', 'Regex', 'Updates']],
  ['toolbox', 'Toolbox and server manager', 'green', ['Toolbox', 'ServerManager']], ['deploy', 'Deploy assistant and instances', 'gray', ['Deploy']], ['docs', 'Documentation website and offline docs', 'gray', ['Docs', 'Help']],
  ['ssh', 'SSH action catalogue, owner terminal, Entware, flash backup', 'red', ['SshActions', 'Terminal', 'Entware', 'FlashBackup']], ['fwup', 'Firmware upload, the dim sum moment and the three-word screen', 'orange', ['FirmwareUpload', 'DimSumOnly']],
  ['live', 'Live mode and the History manager', 'pink', ['LiveMode', 'HistoryManager']], ['danger', 'Four keys, the Level 3 warning, the reboot launch and its live timeline', 'red', ['FourKey', 'BrotherMad', 'MissileLaunch', 'RebootTimeline']],
  ['household', 'Household and who is using the most', 'teal', ['Household', 'Leaderboard']], ['wdiag', 'Wi-Fi diagnostics', 'teal', ['WifiDiag']], ['hardware', 'Ports and hardware', 'orange', ['PortsHardware']],
  ['services', 'Network services, web access and cloud', 'green', ['Services', 'Cloud']], ['fwint', 'Firewall internals', 'red', ['FirewallInternals']], ['guest', 'Guest Pro and captive portal', 'purple', ['GuestPro']], ['dsl', 'DSL', 'gray', ['Dsl']], ['addon', 'The router add-on page', 'orange', ['RouterAddon']],
  ['phone', 'Phone boards: where every desktop feature lands', 'pink', ['Phone', 'PhoneWifi', 'PhoneNav', 'PhoneDevices', 'PhoneGuard', 'PhoneTools', 'PhoneSetup', 'PhoneSettings']], ['components', 'Shared shell components', 'gray', ['Rail', 'TopBar']]
];
const heights = fs.existsSync(path.join(here, 'heights.json')) ? JSON.parse(fs.readFileSync(path.join(here, 'heights.json'), 'utf8')) : {};
const meta = {
  Rail: { file: 'Rail.dc.html', name: 'Navigation rail (shared component)', comp: 272, h: 1680, shows: 'The frosted navigation rail every desktop board imports: brand mark in a cookie shape, the Review changes action with its pending count, and every area grouped as Network, Visual editors, Router and App.', tryIt: 'Tweaks > page (any id such as wifi, edmap, history) to move the active pill, pending (0 hides the badge and stops the rotating border), firmware stock (VPN Director shows Merlin only), lang, dark, accent, motion.', real: 'the app navigation list in the left column.', unbuilt: 'The Visual editors group and One-click modes entries do not exist in the app yet.', dram: 'A conic-gradient border rotates round Review changes while changes are pending.', norm: 'Items shift and tint on hover; the active marker grows in.' },
  TopBar: { file: 'TopBar.dc.html', name: 'Top bar (shared component)', comp: 1168, h: 150, shows: 'The top bar every desktop board imports: a large condensed page title, the search-everything button (a button that opens the palette, not a text box), firmware chip, language, notifications with an unread badge, the signed-in person, and the page tabs.', tryIt: 'click the tabs (the indicator springs across), Tweaks > title, tabs (comma separated), active, role, firmware, lang, dark.', real: 'the app header.', unbuilt: 'The search palette and per-page tabs are design only.', dram: 'None; this component only carries normal motion.', norm: 'The tab indicator travels with a spring; icon buttons morph from circle to squircle on hover.' }
};
for (const s of SPECS) meta[s.file.replace('.dc.html', '')] = s;
const prev = fs.existsSync(path.join(PROJ, 'canvas.json')) ? JSON.parse(fs.readFileSync(path.join(PROJ, 'canvas.json'), 'utf8')) : {};
const canvas = { v: 3, createdOnFiles: prev.createdOnFiles || { v: 1, at: '2026-11-25T17:10:00Z' }, title: 'Material Asus Router', launch: { view: 'canvas', page: 'overview' }, pages: PAGES.map(p => ({ id: p[0], name: p[1] })), boards: {}, order: [], notes: {}, designSystems: [] };
const sticky = (b) => `${b.shows} Try: ${b.tryIt} Stands for: ${b.real} Unbuilt in the app: ${b.unbuilt}`;
const NOTE = 440, GAP = 60, CELL = 140;
for (const [id, name, fill, list] of PAGES) {
  const bs = list.map(k => meta[k]); if (bs.some(b => !b)) { errors.push('page ' + id + ': missing board ' + list.filter(k => !meta[k]).join(',')); continue; }
  const per = bs[0].kind === 'phone' ? 4 : bs[0].comp ? 2 : 3;
  let y = 0, maxX = 0;
  for (let i = 0; i < bs.length; i += per) {
    const row = bs.slice(i, i + per); let x = 0, mh = 0;
    for (const b of row) {
      const w = b.comp || (b.kind === 'phone' ? 390 : 1440); const h = b.kind === 'phone' ? 844 : heights[b.file] || b.h || 1600; mh = Math.max(mh, h);
      const e = { x, y, w, h, title: b.name, page: id, is_interactive: true }; if (!b.comp && b.kind !== 'phone') e.expand = 'fill';
      canvas.boards[b.file] = e; canvas.order.push(b.file);
      canvas.notes['s_' + b.file.replace('.dc.html', '').toLowerCase()] = { x: x + w + GAP, y, w: NOTE, page: id, fill, text: sticky(b) };
      x += w + GAP + NOTE + CELL; maxX = Math.max(maxX, x - CELL);
    }
    y += Math.max(mh, 1100) + 200;
  }
  canvas.notes['t_' + id] = { kind: 'title1', x: 0, y: -300, w: Math.min(maxX, 1900), maxW: maxX, page: id, text: name };
}
fs.writeFileSync(path.join(PROJ, 'canvas.json'), JSON.stringify(canvas, null, 2) + '\n');

// ---- HANDOFF.md ----
let md = fs.readFileSync(path.join(here, 'handoff-head.md'), 'utf8');
md += '\n## Pages and boards\n';
for (const [id, name, , list] of PAGES) {
  md += `\n### ${name} (page id \`${id}\`)\n`;
  for (const k of list) { const b = meta[k]; if (!b) continue; md += `\n**${b.name}** (\`${b.file}\`, ${b.comp ? b.comp + ' px wide component' : b.kind === 'phone' ? '390 by 844, fixed root' : '1440 wide, fills'}, interactive)\n\n- Shows: ${b.shows}\n- Try: ${b.tryIt}\n- Tweaks: accent, dark, motion, firmware, role, lang${b.hasStage ? ', plus `stage` (loading, empty, ready, success, failure; default ' + (b.stage || 'ready') + ')' : ''}${b.comp ? ', plus its content props' : ''}.\n- Dramatic motion: ${b.dram}\n- Normal motion: ${b.norm || 'staggered spring entrances for every tile and row, hover lift and tilt, press ripple and scale, spring switch thumbs, sliding segmented indicators, expanding chips, animated focus rings.'}\n- Stands for: ${b.real}\n- Still unbuilt in the real app: ${b.unbuilt}\n`; }
}
md += '\n' + fs.readFileSync(path.join(here, 'handoff-tail.md'), 'utf8');
fs.writeFileSync(path.join(here, '..', 'HANDOFF.md'), md);

console.log('boards:', SPECS.length + 2, '| staged:', SPECS.filter(s => s.hasStage).length, '| handlers operated:', SPECS.reduce((a, s) => a + (s._handlers || 0), 0));
if (errors.length) { console.log('ERRORS\n' + errors.join('\n')); process.exitCode = 1; } else console.log('all checks passed');
