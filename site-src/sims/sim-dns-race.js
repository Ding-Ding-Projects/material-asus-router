// DNS lookup race: the same question goes to four resolvers and the first answer wins.
import { s, clamp, rng } from './core.js';

const RES = [
  { id: 'cache', en: 'Router cache', zh: '路由器快取', base: 3, miss: 30 },
  { id: 'isp', en: 'Internet provider resolver', zh: '網絡供應商解析器', base: 28 },
  { id: 'pubA', en: 'Public resolver A', zh: '公共解析器 A', base: 14 },
  { id: 'pubB', en: 'Public resolver B (filtering)', zh: '公共解析器 B（過濾）', base: 19 },
];
const X0 = 230; const X1 = 600; const MAXMS = 80;

export default {
  id: 'dns-race',
  title: { en: 'DNS lookup race', zh: 'DNS 查詢競賽' },
  summary: { en: 'One question, four resolvers. The router cache is fastest when it already knows the answer, and slowest of all when it has to ask upstream.', zh: '同一條問題問四個解析器。路由器快取知道答案時最快；要向上游查詢時就未必。' },
  hint: { en: 'Change the cache hit chance or the network jitter, then run another race. Latencies are simulated from fixed averages, not measured on your network.', zh: '改快取命中率或者網絡抖動，再跑多一場。延遲由固定平均值模擬，並非量度你嘅網絡。' },
  label: { en: 'Four horizontal lanes showing resolvers answering the same lookup at different speeds', zh: '四條橫向跑道，顯示解析器以不同速度回應同一個查詢' },
  view: [640, 340],
  setup(ui) {
    const svg = ui.svg;
    let hit = 50; let jitter = 8; let seed = 3; let r = rng(seed); let t = -1; let runs = 0; let idle = 0;
    const wins = { cache: 0, isp: 0, pubA: 0, pubB: 0 };
    let lat = null; let winner = null;
    svg.append(s('rect', { x: 8, y: 8, width: 624, height: 324, rx: 24, class: 'fc-surface' }));
    ui.txt(svg, { x: 24, y: 36, class: 's-text s-b' }, 'Lookup: example.com', '查詢：example.com');
    const lanes = RES.map((x, i) => {
      const y = 70 + i * 58;
      ui.txt(svg, { x: 24, y: y + 4, class: 's-sm s-b' }, x.en, x.zh);
      const wl = ui.txt(svg, { x: 24, y: y + 22, class: 's-sm s-mu' }, '', '');
      svg.append(s('rect', { x: X0, y: y - 10, width: X1 - X0, height: 22, rx: 11, class: 'fc-primary' }));
      const bar = s('rect', { x: X0, y: y - 10, width: 0, height: 22, rx: 11, class: 'f-primary' }); svg.append(bar);
      const lab = ui.txt(svg, { x: X1 + 2, y: y + 5, class: 's-sm s-b', 'text-anchor': 'end' }, '', '');
      return { x, y, bar, lab, wl };
    });
    ui.txt(svg, { x: X0, y: 312, class: 's-sm s-mu' }, '0 ms', '0 毫秒'); ui.txt(svg, { x: X1, y: 312, class: 's-sm s-mu', 'text-anchor': 'end' }, `${MAXMS} ms`, `${MAXMS} 毫秒`);
    ui.range({ label: { en: 'Router cache hit chance', zh: '路由器快取命中率' }, min: 0, max: 100, step: 10, value: hit, fmt: (v) => `${v}%`, onInput: (v) => { hit = v; } });
    ui.range({ label: { en: 'Network jitter', zh: '網絡抖動' }, min: 0, max: 30, value: jitter, fmt: (v) => `${v} ms`, onInput: (v) => { jitter = v; } });
    ui.button({ label: { en: 'Run a race', zh: '跑一場' }, onClick: () => { race(); if (!ui.motion) t = 99; ui.rerender(); } });

    function race() {
      const cacheHit = r() * 100 < hit;
      lat = {};
      for (const x of RES) {
        const j = (r() - 0.35) * jitter;
        lat[x.id] = Math.max(1, Math.round(x.id === 'cache' ? (cacheHit ? x.base + j * 0.2 : x.miss + j) : x.base + j));
      }
      lat._hit = cacheHit;
      winner = RES.reduce((a, b) => (lat[a.id] <= lat[b.id] ? a : b)).id; wins[winner]++; runs++; t = 0;
    }
    function render() {
      lanes.forEach((l) => {
        const v = lat ? lat[l.x.id] : 0; const prog = lat ? clamp(t * 1000 / 50 / v, 0, 1) : 0;
        const shown = lat ? Math.min(v, t * 1000 / 50) : 0;
        l.bar.setAttribute('width', String((X1 - X0) * clamp((lat ? (prog >= 1 ? v : shown) : 0) / MAXMS, 0, 1)));
        l.bar.setAttribute('class', l.x.id === winner && t * 1000 / 50 >= (lat ? lat[winner] : 1e9) ? 'f-ok' : 'f-primary');
        ui.set(l.lab, lat && prog >= 1 ? `${v} ms` : '', lat && prog >= 1 ? `${v} 毫秒` : '');
        ui.set(l.wl, `Wins: ${wins[l.x.id]} of ${runs}`, `勝出：${runs} 場中 ${wins[l.x.id]} 場`);
      });
      if (!lat) { ui.say('Press Run a race, or Play, to start.', '按「跑一場」或者「播放」開始。'); return; }
      const w = RES.find((x) => x.id === winner);
      ui.say(`${w.en} answered first in ${lat[winner]} ms.${lat._hit ? ' The router cache had the answer already.' : ' The router cache had to ask upstream this time.'} Races so far: ${runs}.`,
        `${w.zh}最快，用咗 ${lat[winner]} 毫秒。${lat._hit ? '路由器快取已有答案。' : '今次路由器快取要向上游查詢。'}目前已跑 ${runs} 場。`);
    }
    race(); t = 99;
    return {
      tick(dt) { if (t >= 0 && t < 50) { t += dt; if (t > 3.2) { t = 99; idle = 0.9; } } else { idle -= dt; if (idle <= 0) race(); } render(); },
      step() { race(); t = 99; },
      reset() { seed += 1; r = rng(seed); for (const k in wins) wins[k] = 0; runs = 0; lat = null; winner = null; t = -1; },
      render,
    };
  },
};
