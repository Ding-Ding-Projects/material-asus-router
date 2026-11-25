// Traffic priority queues: game, call and download flows share one link, with and without priority.
import { s, clamp, lerp, rng } from './core.js';

const FLOWS = [
  { id: 'game', en: 'Game', zh: '遊戲', mbps: 3, cls: 'f-ok', dy: -22 },
  { id: 'call', en: 'Video call', zh: '視像通話', mbps: 4, cls: 'f-tert', dy: 0 },
  { id: 'dl', en: 'Big download', zh: '大型下載', mbps: 0, cls: 'f-warn', dy: 22 },
];
const PANEL = [{ y: 18, en: 'Without priority: one shared line', zh: '冇優先次序：共用一條隊' }, { y: 192, en: 'With priority: game and call go first', zh: '有優先次序：遊戲同通話先行' }];
const BASE = 8;

export default {
  id: 'qos-queues',
  title: { en: 'Traffic priority queues', zh: '流量優先隊列' },
  summary: { en: 'A game, a call and a big download share one internet link. Compare one shared queue with a priority queue, side by side.', zh: '遊戲、通話同大型下載共用一條上網線路。並排比較共用隊列同優先隊列。' },
  hint: { en: 'Slow the link or start the download and watch the delay numbers. Delays here come from a simple model, not from measuring a real router.', zh: '調慢線路或者開始下載，睇延遲數字點變。呢度嘅延遲來自簡單模型，並非量度真實路由器。' },
  label: { en: 'Two queue diagrams comparing delay for game, call and download flows', zh: '兩幅隊列圖，比較遊戲、通話同下載嘅延遲' },
  view: [640, 380],
  setup(ui) {
    const svg = ui.svg;
    let cap = 50; let dlOn = true; const r = rng(5);
    const model = [{ q: 0 }, { q: 0 }];
    const delays = [{ game: BASE, call: BASE, dl: BASE }, { game: BASE, call: BASE, dl: BASE }];
    const loss = [{ game: 0, call: 0, dl: 0 }, { game: 0, call: 0, dl: 0 }];
    const parts = [[], []]; const acc = [{}, {}];
    svg.append(s('rect', { x: 8, y: 8, width: 624, height: 364, rx: 24, class: 'fc-surface' }));
    const panels = PANEL.map((p, i) => {
      ui.txt(svg, { x: 28, y: p.y + 18, class: 's-text s-b' }, p.en, p.zh);
      const cy = p.y + 100;
      svg.append(s('rect', { x: 180, y: cy - 44, width: 90, height: 88, rx: 14, class: 's-box' }));
      const fill = s('rect', { x: 184, y: cy + 40, width: 82, height: 0, rx: 8, class: 'f-warn queue-fill' });
      svg.append(fill);
      ui.txt(svg, { x: 225, y: cy - 52, class: 's-sm s-mu s-mid' }, 'Queue', '隊列');
      svg.append(s('line', { x1: 40, y1: cy, x2: 180, y2: cy, class: 'wire' }), s('line', { x1: 270, y1: cy, x2: 410, y2: cy, class: 'wire strong' }));
      FLOWS.forEach((f) => { svg.append(s('circle', { cx: 34, cy: cy + f.dy, r: 5, class: f.cls })); });
      const g = s('g'); svg.append(g);
      const lines = FLOWS.map((f, k) => ({ f, t: ui.txt(svg, { x: 420, y: p.y + 70 + k * 34, class: 's-sm' }, '', ''), bar: s('rect', { x: 420, y: p.y + 76 + k * 34, height: 8, rx: 4, width: 0, class: f.cls }) }));
      lines.forEach((l) => svg.append(l.bar));
      return { cy, fill, g, lines, verdict: ui.txt(svg, { x: 420, y: p.y + 178 - 6, class: 's-sm s-b' }, '', '') };
    });
    ui.range({ label: { en: 'Link speed', zh: '線路速度' }, min: 20, max: 100, step: 5, value: cap, fmt: (v) => `${v} Mbps`, onInput: (v) => { cap = v; ui.rerender(); } });
    ui.toggle({ label: { en: 'Big download running', zh: '大型下載進行中' }, value: dlOn, onChange: (v) => { dlOn = v; ui.rerender(); } });

    const rate = (m) => 1 + m * 0.05;
    function target() {
      const dl = dlOn ? cap * 1.6 : 0; const hi = FLOWS[0].mbps + FLOWS[1].mbps; const inAll = hi + dl;
      const B = cap * 0.25; const full = inAll > cap; const qd = full ? (B / cap) * 1000 : 0;
      const l0 = full ? (inAll - cap) / inAll : 0;
      const dlShare = clamp(cap - hi, 0, cap);
      return [
        { d: { game: BASE + qd, call: BASE + qd, dl: BASE + qd }, l: { game: l0, call: l0, dl: l0 } },
        { d: { game: BASE + 2, call: BASE + 2, dl: BASE + (dl > dlShare ? qd : 0) }, l: { game: 0, call: 0, dl: dl > dlShare ? (dl - dlShare) / dl : 0 } },
      ];
    }
    function spawn(i, dt) {
      const dl = dlOn ? cap * 1.6 : 0;
      FLOWS.forEach((f) => {
        const mb = f.id === 'dl' ? dl : f.mbps; if (!mb) return;
        acc[i][f.id] = (acc[i][f.id] || 0) + dt * rate(mb);
        while (acc[i][f.id] >= 1) { acc[i][f.id] -= 1; parts[i].push({ f, t: 0, lost: r() < loss[i][f.id], c: s('circle', { r: 4.5, class: f.cls }) }); panels[i].g.append(parts[i][parts[i].length - 1].c); }
      });
    }
    function move(i, dt) {
      const cy = panels[i].cy;
      for (let k = parts[i].length - 1; k >= 0; k--) {
        const p = parts[i][k]; const dwellS = (delays[i][p.f.id] - BASE) / 1000 * 4;
        const total = 1.2 + dwellS + 1.2; p.t += dt;
        let x; let o = 1;
        if (p.t < 1.2) x = lerp(44, 210, p.t / 1.2);
        else if (p.t < 1.2 + dwellS) x = 210 + ((p.t * 7) % 12) - 6 + (k % 3) * 4;
        else x = lerp(230, 410, (p.t - 1.2 - dwellS) / 1.2);
        if (p.lost && p.t > 1.2) { o = clamp(1 - (p.t - 1.2) / 0.4, 0, 1); x = 210; }
        p.c.setAttribute('cx', x); p.c.setAttribute('cy', cy + p.f.dy + (p.t >= 1.2 && p.t < 1.2 + dwellS ? ((k % 5) - 2) * 3 : 0)); p.c.style.opacity = String(o);
        if (p.t > total || (p.lost && o <= 0)) { p.c.remove(); parts[i].splice(k, 1); }
      }
    }
    function render() {
      panels.forEach((pn, i) => {
        const h = clamp(((delays[i].dl - BASE) / (cap * 0.25 / cap * 1000)) * 80, 0, 80);
        pn.fill.setAttribute('height', String(h)); pn.fill.setAttribute('y', String(pn.cy + 40 - h));
        pn.lines.forEach((l, k) => {
          const dly = Math.round(delays[i][l.f.id]);
          ui.set(l.t, `${l.f.en}: ${dly} ms${loss[i][l.f.id] > 0.02 ? `, ${Math.round(loss[i][l.f.id] * 100)}% lost` : ''}`, `${l.f.zh}：${dly} 毫秒${loss[i][l.f.id] > 0.02 ? `，丟失 ${Math.round(loss[i][l.f.id] * 100)}%` : ''}`);
          l.bar.setAttribute('width', String(clamp(dly / 260, 0, 1) * 130));
        });
        const lag = delays[i].game > 60 || loss[i].game > 0.02;
        ui.set(pn.verdict, lag ? 'Game and call feel laggy' : 'Game and call feel smooth', lag ? '遊戲同通話有延遲' : '遊戲同通話流暢');
      });
      ui.say(`Without priority the game waits ${Math.round(delays[0].game)} ms and the call ${Math.round(delays[0].call)} ms. With priority they wait ${Math.round(delays[1].game)} ms and ${Math.round(delays[1].call)} ms, while only the download queues.`,
        `冇優先次序，遊戲等 ${Math.round(delays[0].game)} 毫秒，通話等 ${Math.round(delays[0].call)} 毫秒；有優先次序就只需 ${Math.round(delays[1].game)} 同 ${Math.round(delays[1].call)} 毫秒，只有下載要排隊。`);
    }
    function ease(dt, snap) {
      const tg = target();
      for (let i = 0; i < 2; i++) for (const id of ['game', 'call', 'dl']) {
        delays[i][id] = snap ? tg[i].d[id] : delays[i][id] + (tg[i].d[id] - delays[i][id]) * clamp(dt * 4, 0, 1);
        loss[i][id] = tg[i].l[id];
      }
    }
    return {
      tick(dt) { ease(dt, false); for (let i = 0; i < 2; i++) { spawn(i, dt); move(i, dt); } render(); },
      step() { dlOn = !dlOn; extraToggle().checked = dlOn; },
      reset() { cap = 50; dlOn = true; for (let i = 0; i < 2; i++) { parts[i].forEach((p) => p.c.remove()); parts[i].length = 0; } ease(0, true); },
      render() { if (!ui.motion) ease(0, true); render(); },
      settle() { ease(0, true); },
    };
    function extraToggle() { return svg.closest('figure').querySelector('.sim-check input'); }
  },
};
