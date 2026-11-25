// Subnet calculator visual: 32 bits, a draggable prefix boundary, and the address range it produces.
import { s, clamp } from './core.js';

const BW = 17; const BX = 34; const gapAt = (i) => Math.floor(i / 8) * 10;
const bx = (i) => BX + i * BW + gapAt(i);
const dotted = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
const maskOf = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);

export default {
  id: 'subnet-calculator',
  title: { en: 'Subnet calculator', zh: '子網計算器' },
  summary: { en: 'Slide the prefix boundary across 32 bits. Bits on the left name the network; bits on the right are left for devices.', zh: '喺 32 個位元之間移動前綴界線。左邊嘅位元代表網絡，右邊嘅位元留畀裝置。' },
  hint: { en: 'Drag the boundary handle, focus it and use the left and right arrow keys, or type your own address. The default 198.51.100.77 is a documentation example address.', zh: '拖動界線控點、聚焦後用左右方向鍵，或者自己輸入位址。預設嘅 198.51.100.77 係文件示範位址。' },
  label: { en: 'Thirty-two address bits with a movable boundary between network and host bits', zh: '三十二個位址位元，網絡位元同主機位元之間有可移動嘅界線' },
  view: [640, 340],
  setup(ui) {
    const svg = ui.svg;
    let oct = [198, 51, 100, 77]; let prefix = 24; let dir = 1;
    svg.append(s('rect', { x: 8, y: 8, width: 624, height: 324, rx: 24, class: 'fc-surface' }));
    const rowsY = [60, 108]; ui.txt(svg, { x: 34, y: 38, class: 's-sm s-b' }, 'Address bits', '位址位元'); ui.txt(svg, { x: 34, y: 150, class: 's-sm s-b' }, 'Mask bits', '遮罩位元');
    const addr = []; const mask = [];
    for (let i = 0; i < 32; i++) {
      const a = s('g'); a.append(s('rect', { x: bx(i), y: rowsY[0], width: BW - 2, height: 30, rx: 5, class: 'bit' })); const at = s('text', { x: bx(i) + (BW - 2) / 2, y: rowsY[0] + 20, class: 's-sm s-mid bitnum' }); a.append(at); svg.append(a); addr.push([a.firstChild, at]);
      const m = s('g'); m.append(s('rect', { x: bx(i), y: 160, width: BW - 2, height: 24, rx: 5, class: 'bit' })); const mt = s('text', { x: bx(i) + (BW - 2) / 2, y: 177, class: 's-sm s-mid bitnum' }); m.append(mt); svg.append(m); mask.push([m.firstChild, mt]);
    }
    const octT = [0, 1, 2, 3].map((k) => s('text', { x: bx(k * 8) + 4 * BW, y: 108, class: 's-sm s-mu s-mid' }));
    octT.forEach((t) => svg.append(t));
    const handle = s('g'); handle.append(s('rect', { x: -3, y: -8, width: 6, height: 150, rx: 3, class: 'f-primary' }), s('circle', { cy: 150, r: 12, class: 'f-primary' }), s('path', { d: 'M-5 150l-4 0M5 150l4 0', class: 'ap-wifi inv' }));
    svg.append(handle);
    ui.drag(handle, {
      move(p) { let best = 8; let d = 1e9; for (let k = 8; k <= 30; k++) { const x = bx(k) - 1 - (k % 8 === 0 ? 5 : 0); if (Math.abs(x - p.x) < d) { d = Math.abs(x - p.x); best = k; } } setPrefix(best); },
      nudge(dx) { setPrefix(prefix + Math.sign(dx)); },
    });
    handle.setAttribute('aria-label', 'Prefix boundary');
    const rangeBar = s('rect', { x: 34, y: 262, width: 572, height: 18, rx: 9, class: 'fc-primary' });
    const hostBar = s('rect', { x: 34, y: 262, width: 572, height: 18, rx: 9, class: 'f-ok' });
    const you = s('circle', { cy: 271, r: 8, class: 'f-warn' });
    svg.append(rangeBar, hostBar, you);
    const lines = [0, 1, 2].map((i) => ui.txt(svg, { x: 34 + i * 200, y: 308, class: 's-sm' }, '', ''));
    const lines2 = [0, 1, 2].map((i) => ui.txt(svg, { x: 34 + i * 200, y: 326, class: 's-sm s-mu' }, '', ''));
    ui.txt(svg, { x: 34, y: 252, class: 's-sm s-b' }, 'Where your address sits in its subnet', '你嘅位址喺子網入面嘅位置');
    const inputs = oct.map((v, k) => ui.number({ label: { en: `Octet ${k + 1}`, zh: `第 ${k + 1} 段` }, min: 0, max: 255, value: v, onInput: (n) => { oct[k] = n; render(); } }));
    const pr = ui.range({ label: { en: 'Prefix length', zh: '前綴長度' }, min: 8, max: 30, value: prefix, fmt: (v) => `/${v}`, onInput: (v) => { prefix = v; render(); } });
    function setPrefix(v) { prefix = clamp(v, 8, 30); pr.set(prefix); render(); }

    function render() {
      const ip = ((oct[0] << 24) | (oct[1] << 16) | (oct[2] << 8) | oct[3]) >>> 0; const m = maskOf(prefix); const net = (ip & m) >>> 0; const bc = (net | (~m >>> 0)) >>> 0;
      for (let i = 0; i < 32; i++) {
        const bit = (ip >>> (31 - i)) & 1; const mb = (m >>> (31 - i)) & 1;
        addr[i][0].setAttribute('class', 'bit ' + (i < prefix ? 'net' : 'host')); addr[i][1].textContent = String(bit);
        mask[i][0].setAttribute('class', 'bit ' + (mb ? 'net' : 'host')); mask[i][1].textContent = String(mb);
      }
      octT.forEach((t, k) => { t.textContent = String(oct[k]); });
      handle.setAttribute('transform', `translate(${bx(prefix) - 1 - (prefix % 8 === 0 ? 5 : 0)} ${rowsY[0] - 4})`);
      const size = 2 ** (32 - prefix); const usable = Math.max(0, size - 2);
      const f = (n) => (n - net) / (size - 1 || 1);
      hostBar.setAttribute('x', String(34 + 572 * (1 / size))); hostBar.setAttribute('width', String(572 * ((size - 2) / size)));
      you.setAttribute('cx', String(34 + 572 * clamp(f(ip), 0.02, 0.98)));
      const kind = (ip >>> 24) === 10 || (ip >>> 20) === 0xac1 || (ip >>> 16) === 0xc0a8 ? ['private range', '私人位址範圍'] : ['public or documentation range', '公開或者文件示範範圍'];
      ui.set(lines[0], `Mask ${dotted(m)}`, `遮罩 ${dotted(m)}`); ui.set(lines[1], `Network ${dotted(net)}/${prefix}`, `網絡 ${dotted(net)}/${prefix}`); ui.set(lines[2], `Broadcast ${dotted(bc)}`, `廣播 ${dotted(bc)}`);
      ui.set(lines2[0], `First host ${dotted((net + 1) >>> 0)}`, `第一部主機 ${dotted((net + 1) >>> 0)}`); ui.set(lines2[1], `Last host ${dotted((bc - 1) >>> 0)}`, `最後一部主機 ${dotted((bc - 1) >>> 0)}`); ui.set(lines2[2], `${usable.toLocaleString('en')} usable hosts`, `${usable.toLocaleString('en')} 個可用主機`);
      ui.say(`/${prefix} leaves ${32 - prefix} host bits, so ${usable.toLocaleString('en')} devices can share this subnet. The address ${dotted(ip)} is in the ${kind[0]}.`, `/${prefix} 留低 ${32 - prefix} 個主機位元，所以呢個子網可以有 ${usable.toLocaleString('en')} 部裝置。位址 ${dotted(ip)} 屬於${kind[1]}。`);
    }
    return {
      tick(dt) { acc += dt; if (acc > 0.7) { acc = 0; if (prefix >= 30) dir = -1; if (prefix <= 8) dir = 1; setPrefix(prefix + dir); } },
      step() { setPrefix(prefix >= 30 ? 8 : prefix + 1); },
      reset() { oct = [198, 51, 100, 77]; inputs.forEach((i, k) => i.set(oct[k])); setPrefix(24); },
      render,
    };
  },
};
let acc = 0;
