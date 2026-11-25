// Network map: drag devices and mesh nodes, see which node each device joins, on which band, and how strong.
import { s, clamp } from './core.js';

const rssi5 = (d) => -35 - d * 0.2333;
const rssi24 = (d) => -35 - d * 0.12;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export default {
  id: 'network-map',
  title: { en: 'Network map with mesh nodes', zh: '網絡地圖同 AiMesh 節點' },
  summary: { en: 'Drag a device or a mesh node. Each device joins the node with the strongest signal, and falls back to 2.4 GHz when 5 GHz gets too weak.', zh: '拖動裝置或者網狀節點。每部裝置會連去訊號最強嘅節點；5 GHz 太弱就轉用 2.4 GHz。' },
  hint: { en: 'Click or Tab to a device or node, then drag it or use the arrow keys (hold Shift for bigger steps). Throughput numbers are made-up demonstration values.', zh: '點擊或者用 Tab 揀裝置或節點，再拖動或用方向鍵移動（按住 Shift 移動得遠啲）。速度數字只係示範用嘅虛構數值。' },
  label: { en: 'Map of a router, two mesh nodes and five devices with signal rings', zh: '顯示路由器、兩個網狀節點同五部裝置訊號圈嘅地圖' },
  view: [640, 400],
  setup(ui) {
    const svg = ui.svg;
    const aps = [
      { id: 'router', x: 120, y: 200, name: ['Router', '路由器'], wired: true },
      { id: 'a', x: 330, y: 100, name: ['Node A (cable)', '節點 A（網線）'], wired: true },
      { id: 'b', x: 500, y: 290, name: ['Node B (wireless)', '節點 B（無線）'], wired: false },
    ];
    const devs = [
      { id: 'phone', x: 250, y: 310, name: ['Phone', '手機'] },
      { id: 'laptop', x: 400, y: 190, name: ['Laptop', '手提電腦'] },
      { id: 'tv', x: 570, y: 120, name: ['TV', '電視'] },
      { id: 'speaker', x: 560, y: 330, name: ['Speaker', '喇叭'] },
      { id: 'printer', x: 170, y: 90, name: ['Printer', '打印機'] },
    ];
    svg.append(s('rect', { x: 8, y: 8, width: 624, height: 384, rx: 24, class: 'fc-surface' }));
    const rings = s('g'); const links = s('g'); const packets = s('g'); const pieces = s('g');
    svg.append(rings, links, packets, pieces);

    const bhLine = s('line', { class: 'wire dashed' });
    const wiredLine = s('line', { class: 'wire strong' });
    links.append(wiredLine, bhLine);
    for (const ap of aps) {
      ap.ring5 = s('circle', { r: 150, class: 'ring5' }); ap.ring24 = s('circle', { r: 292, class: 'ring24' });
      rings.append(ap.ring24, ap.ring5);
      ap.g = s('g', { 'aria-label': `${ap.name[0]}` });
      ap.g.append(s('rect', { x: -26, y: -16, width: 52, height: 32, rx: 12, class: 'f-primary' }), s('path', { d: 'M-10 3a14 14 0 0120 0M-6 8a8 8 0 0112 0', class: 'ap-wifi' }));
      ap.lab = ui.txt(ap.g, { y: 34, class: 's-sm s-b s-mid' }, ap.name[0], ap.name[1]);
      pieces.append(ap.g);
      ui.drag(ap.g, { start() { sel = ap; ui.rerender(); }, move(p) { place(ap, p.x, p.y); }, nudge(dx, dy) { place(ap, ap.x + dx, ap.y + dy); } });
      ap.g.setAttribute('aria-label', `${ap.name[0]}, draggable`);
    }
    for (const d of devs) {
      d.line = s('line', { class: 'wire dev' }); links.append(d.line);
      d.dot = s('circle', { r: 4, class: 'f-tert' }); packets.append(d.dot);
      d.t = Math.random();
      d.g = s('g');
      d.g.append(s('circle', { r: 17, class: 'dev-c' }), s('text', { y: 5, class: 's-text s-b s-mid', 'aria-hidden': 'true' }, d.name[0][0]));
      d.lab = ui.txt(d.g, { y: 34, class: 's-sm s-mid' }, d.name[0], d.name[1]);
      d.badge = ui.txt(d.g, { y: 48, class: 's-sm s-b s-mid' }, '', '');
      pieces.append(d.g);
      ui.drag(d.g, { start() { sel = d; ui.rerender(); }, move(p) { place(d, p.x, p.y); }, nudge(dx, dy) { place(d, d.x + dx, d.y + dy); } });
      d.g.setAttribute('aria-label', `${d.name[0]}, draggable`);
    }
    let sel = devs[0];
    function place(o, x, y) { o.x = clamp(x, 30, 610); o.y = clamp(y, 40, 335); ui.rerender(); }

    function compute() {
      for (const ap of aps) ap.bh = null;
      const b = aps[2];
      const toR = dist(b, aps[0]); const toA = dist(b, aps[1]);
      b.via = toR <= toA ? aps[0] : aps[1]; b.bh = rssi5(Math.min(toR, toA));
      b.bhFactor = clamp((b.bh + 85) / 40, 0.1, 1);
      for (const d of devs) {
        let best = null;
        for (const ap of aps) { const r = rssi5(dist(d, ap)); if (!best || r > best.r5) best = { ap, r5: r, r24: rssi24(dist(d, ap)) }; }
        d.ap = best.ap;
        if (best.r5 >= -70) { d.band = '5'; d.r = best.r5; } else if (best.r24 >= -82) { d.band = '2.4'; d.r = best.r24; } else { d.band = 'none'; d.r = -100; }
        const base = d.band === '5' ? 600 : d.band === '2.4' ? 140 : 0;
        d.mbps = Math.round(base * clamp((d.r + 85) / 40, 0.1, 1) * (best.ap.id === 'b' ? b.bhFactor : 1));
      }
    }
    function render() {
      compute();
      const [r, a, b] = aps;
      for (const ap of aps) {
        ap.g.setAttribute('transform', `translate(${ap.x} ${ap.y})`);
        for (const c of [ap.ring5, ap.ring24]) { c.setAttribute('cx', ap.x); c.setAttribute('cy', ap.y); }
        ap.g.classList.toggle('sel', sel === ap);
      }
      wiredLine.setAttribute('x1', r.x); wiredLine.setAttribute('y1', r.y); wiredLine.setAttribute('x2', a.x); wiredLine.setAttribute('y2', a.y);
      bhLine.setAttribute('x1', b.via.x); bhLine.setAttribute('y1', b.via.y); bhLine.setAttribute('x2', b.x); bhLine.setAttribute('y2', b.y);
      bhLine.setAttribute('class', 'wire dashed ' + (b.bh >= -60 ? 'good' : b.bh >= -70 ? 'ok' : 'bad'));
      for (const d of devs) {
        d.g.setAttribute('transform', `translate(${d.x} ${d.y})`);
        d.g.classList.toggle('sel', sel === d);
        d.g.firstChild.setAttribute('class', 'dev-c ' + (d.band === '5' ? 'b5' : d.band === '2.4' ? 'b24' : 'b0'));
        d.line.setAttribute('x1', d.x); d.line.setAttribute('y1', d.y); d.line.setAttribute('x2', d.ap.x); d.line.setAttribute('y2', d.ap.y);
        d.line.setAttribute('class', 'wire dev ' + (d.band === '5' ? 'good' : d.band === '2.4' ? 'ok' : 'bad'));
        ui.set(d.badge, d.band === 'none' ? 'no signal' : `${d.band} GHz`, d.band === 'none' ? '冇訊號' : `${d.band} GHz`);
        placeDot(d);
      }
      const d = devs.includes(sel) ? sel : null;
      if (d) ui.say(`${d.name[0]} joins ${d.ap.name[0]} on ${d.band === 'none' ? 'no band (out of range)' : d.band + ' GHz'}, about ${d.r.toFixed(0)} dBm and ${d.mbps} Mbps in this demonstration.${d.ap.id === 'b' && d.ap.bh < -70 ? ' Node B backhaul is weak, which caps the speed.' : ''}`,
        `${d.name[1]}連去${d.ap.name[1]}，${d.band === 'none' ? '超出範圍' : d.band + ' GHz'}，約 ${d.r.toFixed(0)} dBm，示範速度 ${d.mbps} Mbps。${d.ap.id === 'b' && d.ap.bh < -70 ? '節點 B 回程訊號弱，限制咗速度。' : ''}`);
      else ui.say(`${sel.name[0]}: ${sel.id === 'b' ? `wireless backhaul to ${sel.via.name[0]} at about ${sel.bh.toFixed(0)} dBm.` : 'wired to the router, so the backhaul is solid.'}`,
        `${sel.name[1]}：${sel.id === 'b' ? `無線回程連去${sel.via.name[1]}，約 ${sel.bh.toFixed(0)} dBm。` : '用網線接駁，回程穩定。'}`);
    }
    function placeDot(d) {
      const t = ui.motion ? d.t : 0.5;
      d.dot.setAttribute('cx', d.x + (d.ap.x - d.x) * t); d.dot.setAttribute('cy', d.y + (d.ap.y - d.y) * t);
      d.dot.style.opacity = d.band === 'none' ? 0 : 1;
    }
    return {
      tick(dt) { for (const d of devs) { d.t = (d.t + dt * (d.band === '5' ? 0.9 : 0.45)) % 1; placeDot(d); } },
      step() { const all = [...devs, ...aps]; sel = all[(all.indexOf(sel) + 1) % all.length]; for (const d of devs) d.t = (d.t + 0.25) % 1; },
      reset() { aps[0].x = 120; aps[0].y = 200; aps[1].x = 330; aps[1].y = 100; aps[2].x = 500; aps[2].y = 290;
        [[250, 310], [400, 190], [570, 120], [560, 330], [170, 90]].forEach(([x, y], i) => { devs[i].x = x; devs[i].y = y; }); sel = devs[0]; },
      render,
    };
  },
};
