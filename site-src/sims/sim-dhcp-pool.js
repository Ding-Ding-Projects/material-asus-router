// DHCP address pool: a 16 by 16 grid of addresses showing leased, reserved and free cells, with lease expiry.
import { s, clamp, rng } from './core.js';

const CELL = 21; const GX = 24; const GY = 22;
const PREFIX = '198.51.100.';
const NAMES = ['Phone', 'Laptop', 'Tablet', 'TV', 'Speaker', 'Console', 'Camera', 'Watch', 'Lamp', 'Guest phone', 'Work PC', 'Thermostat'];

export default {
  id: 'dhcp-pool',
  title: { en: 'DHCP address pool', zh: 'DHCP 位址池' },
  summary: { en: 'Each cell is one address on the demo network. Move the pool, shorten the lease, and watch devices take and lose addresses.', zh: '每格係示範網絡入面一個位址。調整位址池、縮短租期，睇裝置攞到同失去位址。' },
  hint: { en: 'Click a cell, or focus the grid and use the arrow keys. Press Enter to reserve or release the selected address. Lease times run ten times faster than real time.', zh: '點擊一格，或者聚焦格仔後用方向鍵。按 Enter 保留或者釋放揀咗嘅位址。租期比真實時間快十倍。' },
  label: { en: 'Grid of 256 addresses coloured by state: free, leased, reserved or outside the pool', zh: '256 個位址嘅格仔，按狀態上色：空閒、已租、已保留或者池外' },
  view: [640, 390],
  setup(ui) {
    const svg = ui.svg;
    let start = 100; let end = 199; let lease = 120; let cur = 100; let joinTimer = 1.2; let nameN = 0; let full = false; let flash = -1;
    const leases = new Map(); const reserved = new Map([[110, 'Printer'], [150, 'NAS']]);
    const r = rng(11);
    const rows = [];
    svg.append(s('rect', { x: 8, y: 8, width: 624, height: 374, rx: 24, class: 'fc-surface' }));
    const grid = s('g', { 'aria-label': 'Address grid', 'aria-roledescription': 'grid of addresses' });
    for (let i = 0; i < 256; i++) {
      const c = s('rect', { x: GX + (i % 16) * CELL, y: GY + Math.floor(i / 16) * CELL, width: CELL - 2, height: CELL - 2, rx: 5, class: 'cell' });
      c.addEventListener('click', () => { cur = i; grid.focus({ preventScroll: true }); render(); });
      grid.append(c); rows.push(c);
    }
    const cursor = s('rect', { width: CELL + 2, height: CELL + 2, rx: 7, class: 'cursor' });
    grid.setAttribute('tabindex', '0'); grid.setAttribute('role', 'application');
    grid.addEventListener('keydown', (ev) => {
      const m = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -16, ArrowDown: 16 }[ev.key];
      if (m) { ev.preventDefault(); cur = clamp(cur + m, 0, 255); render(); }
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleReserve(); }
    });
    svg.append(grid, cursor);
    const px = 390;
    const legend = [['f-ok', 'Free in the pool', '池內空閒'], ['f-primary', 'Leased', '已租出'], ['f-tert', 'Reserved', '已保留'], ['f-warn', 'Router (gateway)', '路由器（閘道）'], ['f-muted', 'Outside the pool', '池外']];
    legend.forEach(([cls, en, zh], i) => { svg.append(s('rect', { x: px, y: 30 + i * 24, width: 16, height: 16, rx: 5, class: cls })); ui.txt(svg, { x: px + 26, y: 43 + i * 24, class: 's-sm' }, en, zh); });
    const stat1 = ui.txt(svg, { x: px, y: 178, class: 's-text s-b' }, '', '');
    const stat2 = ui.txt(svg, { x: px, y: 200, class: 's-sm s-mu' }, '', '');
    const sel1 = ui.txt(svg, { x: px, y: 250, class: 's-text s-b' }, '', '');
    const sel2 = ui.txt(svg, { x: px, y: 272, class: 's-sm' }, '', '');
    svg.append(s('rect', { x: px, y: 286, width: 220, height: 12, rx: 6, class: 'fc-primary' }));
    const leaseBar = s('rect', { x: px, y: 286, width: 0, height: 12, rx: 6, class: 'f-primary' });
    svg.append(leaseBar);
    const note = ui.txt(svg, { x: px, y: 330, class: 's-sm s-b' }, '', '');

    const inPool = (i) => i >= start && i <= end;
    const freeIn = () => { for (let i = start; i <= end; i++) if (!leases.has(i) && !reserved.has(i) && i !== 1) return i; return -1; };
    function join() {
      const i = freeIn(); const name = NAMES[nameN++ % NAMES.length];
      if (i < 0) { full = true; flash = -1; return false; }
      full = false; leases.set(i, { name, left: lease * (0.5 + r() * 0.5) }); flash = i; return true;
    }
    function toggleReserve() {
      if (cur <= 1 || cur >= 255) return;
      if (reserved.has(cur)) reserved.delete(cur); else { leases.delete(cur); reserved.set(cur, 'Reserved device'); }
      render();
    }
    function seed() { leases.clear(); for (let k = 0; k < 7; k++) join(); full = false; }
    seed();
    const ctl = {
      a: ui.range({ label: { en: 'Pool starts at', zh: '位址池由' }, min: 2, max: 253, value: start, fmt: (v) => `.${v}`, onInput: (v) => { start = Math.min(v, end); ctl.a.set(start); prune(); render(); } }),
      b: ui.range({ label: { en: 'Pool ends at', zh: '位址池去到' }, min: 2, max: 253, value: end, fmt: (v) => `.${v}`, onInput: (v) => { end = Math.max(v, start); ctl.b.set(end); prune(); render(); } }),
      l: ui.range({ label: { en: 'Lease time', zh: '租期' }, min: 30, max: 600, step: 30, value: lease, fmt: (v) => `${v} s`, onInput: (v) => { lease = v; for (const l of leases.values()) l.left = Math.min(l.left, v); render(); } }),
    };
    ui.button({ label: { en: 'A new device joins', zh: '有新裝置加入' }, onClick: () => { join(); render(); } });
    ui.button({ label: { en: 'Reserve or release selected', zh: '保留或釋放所選位址' }, onClick: toggleReserve });
    function prune() { for (const k of [...leases.keys()]) if (!inPool(k)) leases.delete(k); }

    function render() {
      let leased = 0; let res = 0;
      rows.forEach((c, i) => {
        let cls = 'f-muted';
        if (i === 1) cls = 'f-warn'; else if (i === 0 || i === 255) cls = 'f-muted dim';
        else if (reserved.has(i)) { cls = 'f-tert'; res++; } else if (leases.has(i)) { cls = 'f-primary'; leased++; } else if (inPool(i)) cls = 'f-ok';
        c.setAttribute('class', `cell ${cls}`);
        const l = leases.get(i); c.style.opacity = l ? String(0.45 + 0.55 * clamp(l.left / lease, 0, 1)) : '';
        c.classList.toggle('pop', i === flash);
      });
      cursor.setAttribute('x', GX + (cur % 16) * CELL - 1); cursor.setAttribute('y', GY + Math.floor(cur / 16) * CELL - 1);
      const size = end - start + 1; const free = size - leased - [...reserved.keys()].filter(inPool).length;
      ui.set(stat1, `Pool .${start} to .${end}: ${size} addresses`, `位址池 .${start} 至 .${end}：${size} 個位址`);
      ui.set(stat2, `${leased} leased, ${[...reserved.keys()].filter(inPool).length} reserved, ${free} free`, `${leased} 已租，${[...reserved.keys()].filter(inPool).length} 已保留，${free} 空閒`);
      const l = leases.get(cur); const addr = `${PREFIX}${cur}`;
      let state = ['free', '空閒']; let who = ['Nobody has this address.', '冇人使用呢個位址。'];
      if (cur === 0) { state = ['network address', '網絡位址']; who = ['Never given to a device.', '唔會分配畀裝置。']; }
      else if (cur === 255) { state = ['broadcast address', '廣播位址']; who = ['Never given to a device.', '唔會分配畀裝置。']; }
      else if (cur === 1) { state = ['the router', '路由器']; who = ['The gateway for the demo network.', '示範網絡嘅閘道。']; }
      else if (reserved.has(cur)) { state = ['reserved', '已保留']; who = [`${reserved.get(cur)} always gets this address.`, `${reserved.get(cur)}永遠攞呢個位址。`]; }
      else if (l) { state = ['leased', '已租出']; who = [`${l.name}, ${Math.ceil(l.left)} s left on the lease.`, `${l.name}，租期仲有 ${Math.ceil(l.left)} 秒。`]; }
      else if (!inPool(cur)) { state = ['outside the pool', '池外']; who = ['Safe for static addresses.', '適合設定固定位址。']; }
      ui.set(sel1, `${addr} (${state[0]})`, `${addr}（${state[1]}）`); ui.set(sel2, who[0], who[1]);
      leaseBar.setAttribute('width', String(l ? 220 * clamp(l.left / lease, 0, 1) : 0));
      ui.set(note, full ? 'Pool full: a new device got no address' : '', full ? '位址池已滿：新裝置攞唔到位址' : '');
      ui.say(`${addr} is ${state[0]}. ${who[0]} ${full ? 'The pool is full, so the latest device could not get an address.' : ''}`, `${addr}：${state[1]}。${who[1]}${full ? '位址池已滿，最新嘅裝置攞唔到位址。' : ''}`);
    }
    return {
      tick(dt) {
        for (const [k, l] of leases) { l.left -= dt * 10; if (l.left <= 0) { if (r() < 0.6) l.left = lease; else leases.delete(k); } }
        joinTimer -= dt; if (joinTimer <= 0) { joinTimer = 1.5 + r() * 2; join(); }
        render();
      },
      step() { join(); for (const l of leases.values()) l.left = Math.max(1, l.left - lease * 0.25); for (const [k, l] of leases) if (l.left <= 1 && r() < 0.5) leases.delete(k); },
      reset() { start = 100; end = 199; lease = 120; cur = 100; full = false; reserved.clear(); reserved.set(110, 'Printer'); reserved.set(150, 'NAS'); ctl.a.set(start); ctl.b.set(end); ctl.l.set(lease); seed(); },
      render,
    };
  },
};
