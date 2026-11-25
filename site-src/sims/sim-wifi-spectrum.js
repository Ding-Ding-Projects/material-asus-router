// Wi-Fi channel spectrum: neighbouring networks as bell curves, drag your own channel and width, read the overlap.
import { s, clamp, rng } from './core.js';

const F0 = 2390; const F1 = 2490;
const X0 = 40; const X1 = 600; const Y0 = 40; const Y1 = 240;
const fx = (f) => X0 + ((f - F0) / (F1 - F0)) * (X1 - X0);
const centre = (ch) => 2412 + (ch - 1) * 5;
const shape = (f, fc, w) => Math.exp(-Math.pow(Math.abs(f - fc) / (w * 0.56), 4));
const level = (p) => clamp((p + 95) / 60, 0, 1);

export default {
  id: 'wifi-spectrum',
  title: { en: 'Wi-Fi channel spectrum', zh: 'Wi-Fi 頻道頻譜' },
  summary: { en: 'Neighbouring networks appear as bell curves. Slide your own network along the band and watch the interference score fall or rise.', zh: '鄰居嘅網絡以鐘形曲線顯示。喺頻段上移動你自己嘅網絡，睇干擾分數升定跌。' },
  hint: { en: 'Drag the handle on top of your curve, or focus it and press the left and right arrow keys. Neighbours and power levels are invented for this demonstration.', zh: '拖動曲線頂嘅控點，或者聚焦後按左右方向鍵。鄰居同訊號強度都係為示範而虛構。' },
  label: { en: 'Chart of the 2.4 GHz band with neighbouring networks and your own channel', zh: '顯示 2.4 GHz 頻段、鄰近網絡同你自己頻道嘅圖表' },
  view: [640, 350],
  setup(ui) {
    const svg = ui.svg;
    let ch = 6; let width = 20; let seed = 7; let phase = 0;
    let nb = [];
    const reroll = () => {
      const r = rng(seed); const picks = [1, 3, 6, 6, 9, 11, 11, 4];
      nb = picks.slice(0, 5 + Math.floor(r() * 3)).map((c) => ({ ch: c, w: r() > 0.8 ? 40 : 20, p: -45 - Math.floor(r() * 35), ph: r() * 6 }));
    };
    reroll();
    svg.append(s('rect', { x: 8, y: 8, width: 624, height: 334, rx: 24, class: 'fc-surface' }));
    const grid = s('g'); svg.append(grid);
    for (let c = 1; c <= 13; c++) {
      grid.append(s('line', { x1: fx(centre(c)), x2: fx(centre(c)), y1: Y0, y2: Y1, class: 'gridline' }));
      grid.append(s('text', { x: fx(centre(c)), y: Y1 + 18, class: 's-sm s-mu s-mid' }, String(c)));
    }
    ui.txt(svg, { x: 320, y: Y1 + 38, class: 's-sm s-mu s-mid' }, 'Channel (2.4 GHz band)', '頻道（2.4 GHz 頻段）');
    const neighbourPaths = nb.concat(Array(4).fill(null)).map(() => s('path', { class: 'curve nb' }));
    for (const p of neighbourPaths) svg.append(p);
    const mine = s('path', { class: 'curve mine' }); const mineLine = s('path', { class: 'curve-line' });
    svg.append(mine, mineLine);
    const handle = s('g'); const hc = s('circle', { r: 11, class: 'f-primary' });
    handle.append(hc, s('path', { d: 'M-4 -3l-4 3 4 3M4 -3l4 3-4 3', class: 'ap-wifi inv' }));
    svg.append(handle);
    const gauge = s('rect', { x: 40, y: 316, width: 0, height: 14, rx: 7, class: 'f-ok' });
    svg.append(s('rect', { x: 40, y: 316, width: 560, height: 14, rx: 7, class: 'fc-primary' }), gauge);
    const gaugeT = ui.txt(svg, { x: 40, y: 308, class: 's-sm s-b' }, '', '');

    const heights = (f, t) => nb.reduce((a, n) => a + shape(f, centre(n.ch), n.w) * level(n.p + 3 * Math.sin(t + n.ph)), 0);
    const score = (c, w, t) => {
      let num = 0; let den = 0;
      for (let f = F0; f <= F1; f++) { const m = shape(f, centre(c), w); num += m * Math.min(1, heights(f, t)); den += m; }
      return Math.round((num / den) * 100);
    };
    const pathFor = (fn) => { let d = ''; for (let f = F0; f <= F1; f += 1) { const y = Y1 - fn(f) * (Y1 - Y0); d += `${f === F0 ? 'M' : 'L'}${fx(f).toFixed(1)} ${y.toFixed(1)}`; } return d; };
    const ctl = {
      channel: ui.range({ label: { en: 'Your channel', zh: '你嘅頻道' }, min: 1, max: 13, value: ch, onInput: (v) => { ch = v; render(); } }),
      width: ui.select({ label: { en: 'Width', zh: '頻寬' }, value: String(width), options: [['20', '20 MHz', '20 MHz'], ['40', '40 MHz', '40 MHz']], onChange: (v) => { width = Number(v); render(); } }),
    };
    ui.button({ label: { en: 'Use the quietest channel', zh: '轉去最靜頻道' }, onClick: () => { ch = best().c; ctl.channel.set(ch); render(); } });
    ui.button({ label: { en: 'Shuffle neighbours', zh: '重新排列鄰居' }, onClick: () => { seed += 1; reroll(); render(); } });
    function best() { let b = { c: 1, v: 999 }; for (let c = 1; c <= 13; c++) { const v = score(c, width, phase); if (v < b.v) b = { c, v }; } return b; }
    ui.drag(handle, {
      move(p) { ch = clamp(Math.round(((p.x - X0) / (X1 - X0) * (F1 - F0) + F0 - 2412) / 5) + 1, 1, 13); ctl.channel.set(ch); render(); },
      nudge(dx) { ch = clamp(ch + Math.sign(dx), 1, 13); ctl.channel.set(ch); render(); },
    });
    handle.setAttribute('aria-label', 'Your channel handle');

    function render() {
      neighbourPaths.forEach((p, i) => { const n = nb[i]; if (!n) { p.setAttribute('d', ''); return; } p.setAttribute('d', pathFor((f) => shape(f, centre(n.ch), n.w) * level(n.p + 3 * Math.sin(phase + n.ph))) + `L${X1} ${Y1}L${X0} ${Y1}Z`); });
      const mf = (f) => shape(f, centre(ch), width) * 0.9;
      mine.setAttribute('d', pathFor(mf) + `L${X1} ${Y1}L${X0} ${Y1}Z`); mineLine.setAttribute('d', pathFor(mf));
      handle.setAttribute('transform', `translate(${fx(centre(ch))} ${Y1 - 0.9 * (Y1 - Y0)})`);
      const sc = score(ch, width, phase); const b = best();
      gauge.setAttribute('width', String(560 * sc / 100)); gauge.setAttribute('class', sc < 25 ? 'f-ok' : sc < 55 ? 'f-warn' : 'f-err');
      const word = sc < 25 ? ['clean', '好清靜'] : sc < 55 ? ['busy', '幾繁忙'] : ['crowded', '好擠迫'];
      ui.set(gaugeT, `Interference score ${sc} of 100 (${word[0]})`, `干擾分數 ${sc} / 100（${word[1]}）`);
      const lo = ch - (width === 40 ? 4 : 2); const hi = ch + (width === 40 ? 4 : 2);
      ui.say(`Channel ${ch}, ${width} MHz covers about channels ${Math.max(1, lo)} to ${Math.min(13, hi)}. Score ${sc}: ${word[0]}. ${b.c === ch ? 'This is already the quietest channel.' : `Channel ${b.c} scores ${b.v}, which is quieter.`}`,
        `頻道 ${ch}、${width} MHz 約覆蓋頻道 ${Math.max(1, lo)} 至 ${Math.min(13, hi)}。分數 ${sc}：${word[1]}。${b.c === ch ? '呢個已經係最靜嘅頻道。' : `頻道 ${b.c} 分數 ${b.v}，更加靜。`}`);
    }
    return {
      tick(dt) { phase += dt * 0.8; render(); },
      step() { ch = ch % 13 + 1; ctl.channel.set(ch); },
      reset() { ch = 6; width = 20; seed = 7; phase = 0; reroll(); ctl.channel.set(ch); ctl.width.set('20'); },
      render,
    };
  },
};
