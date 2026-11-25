// Change guard timeline: preview, arm, apply, then either reconnect and keep, or time out and revert.
import { s, boundaries, clamp } from './core.js';

export default {
  id: 'change-guard',
  title: { en: 'Change guard timeline', zh: '連線守護時間線' },
  summary: { en: 'Follow one change through preview, arm, apply and check. Break the connection and watch the guard put the old setting back.', zh: '跟住一次更改行過預覽、佈防、套用同檢查；斷咗線就睇守護點樣還原舊設定。' },
  hint: { en: 'Change the guard time or the failure option, then press Play or Step. The demo clock runs four times faster than real time.', zh: '改守護時間或者故障選項，再按「播放」或「單步」。示範時鐘比真實時間快四倍。' },
  label: { en: 'Timeline of a guarded change with five stages and a countdown', zh: '有五個階段同倒數嘅受守護更改時間線' },
  view: [640, 330],
  setup(ui) {
    const svg = ui.svg;
    let guard = 20; let failure = 'lost'; let clock = 0;
    const ACCEL = 4;
    const stages = [
      { en: 'Preview', zh: '預覽' }, { en: 'Arm guard', zh: '啟動守護' }, { en: 'Apply', zh: '套用' }, { en: 'Check', zh: '檢查' }, { en: 'Result', zh: '結果' },
    ];
    const plan = () => boundaries([{ dur: 2 }, { dur: 1.5 }, { dur: 2 }, { dur: failure === 'lost' ? guard / ACCEL : 3 }, { dur: 3 }]);
    const xs = stages.map((_, i) => 70 + i * 125);
    const link = s('g'); const dots = s('g'); const labels = s('g');
    svg.append(s('rect', { x: 10, y: 10, width: 620, height: 310, rx: 24, class: 'fc-surface' }), link, dots, labels);
    const nodes = stages.map((st, i) => {
      const g = s('g'); const c = s('circle', { cx: xs[i], cy: 70, r: 26, class: 'node' });
      g.append(c); ui.txt(g, { x: xs[i], y: 76, class: 's-text s-b s-mid' }, String(i + 1), String(i + 1));
      ui.txt(labels, { x: xs[i], y: 120, class: 's-text s-mid' }, st.en, st.zh);
      dots.append(g); return c;
    });
    for (let i = 0; i < 4; i++) link.append(s('line', { x1: xs[i] + 28, x2: xs[i + 1] - 28, y1: 70, y2: 70, class: 'wire' }));
    const bar = s('rect', { x: 70, y: 150, width: 500, height: 16, rx: 8, class: 'fc-primary' });
    const fill = s('rect', { x: 70, y: 150, width: 0, height: 16, rx: 8, class: 'f-primary' });
    svg.append(bar, fill);
    const barLabel = ui.txt(svg, { x: 70, y: 188, class: 's-sm s-mu' }, '', '');
    const settingBox = s('rect', { x: 70, y: 214, width: 500, height: 84, rx: 18, class: 's-box' });
    svg.append(settingBox);
    ui.txt(svg, { x: 90, y: 240, class: 's-sm s-mu' }, 'Example setting: guest Wi-Fi', '示範設定：訪客 Wi-Fi');
    const before = ui.txt(svg, { x: 90, y: 276, class: 's-text s-b' }, '', '');
    const after = ui.txt(svg, { x: 300, y: 276, class: 's-text s-b' }, '', '');
    const verdict = s('rect', { x: 452, y: 222, width: 106, height: 28, rx: 14, class: 'fc-ok' });
    svg.append(verdict);
    const verdictT = ui.txt(svg, { x: 505, y: 241, class: 's-sm s-b s-mid' }, '', '');
    const pulse = s('circle', { cx: xs[0], cy: 70, r: 34, class: 'ring' });
    svg.insertBefore(pulse, dots);

    function render() {
      const p = plan(); const total = p[p.length - 1].to; clock = clamp(clock, 0, total);
      let idx = p.findIndex((b) => clock < b.to); if (idx < 0) idx = p.length - 1;
      const done = clock >= total;
      nodes.forEach((c, i) => { c.setAttribute('class', 'node' + (i < idx || done ? ' done' : '') + (i === idx && !done ? ' now' : '')); });
      pulse.setAttribute('cx', xs[idx]); pulse.style.opacity = done ? 0 : 1;
      const inCheck = idx === 3; const reverted = failure === 'lost';
      const into = clock - p[3].from;
      let frac = 0; let seconds = guard;
      if (idx >= 3) { frac = clamp(into / p[3].dur, 0, 1); seconds = Math.max(0, Math.ceil((p[3].dur - into) * (idx === 3 ? ACCEL : 0))); }
      if (idx > 3) frac = 1;
      fill.setAttribute('width', String(idx < 3 ? 0 : 500 * (reverted ? 1 - frac : frac)));
      fill.setAttribute('class', reverted ? 'f-warn' : 'f-ok');
      const applied = idx >= 2 && !(done && reverted) && !(idx === 4 && reverted && clock > p[4].from + 0.8);
      ui.set(before, 'Before: guest Wi-Fi off', '之前：訪客 Wi-Fi 關');
      ui.set(after, applied ? 'Now: guest Wi-Fi on' : (idx >= 4 && reverted ? 'Now: guest Wi-Fi off (reverted)' : 'Now: guest Wi-Fi off'), applied ? '而家：訪客 Wi-Fi 開' : (idx >= 4 && reverted ? '而家：訪客 Wi-Fi 關（已還原）' : '而家：訪客 Wi-Fi 關'));
      if (inCheck && reverted) ui.set(barLabel, `Waiting for you to reconnect: ${seconds} s left on a ${guard} s guard`, `等緊你重新連線：${guard} 秒守護仲有 ${seconds} 秒`);
      else if (inCheck) ui.set(barLabel, 'Router answered again, confirming the change', '路由器重新回應，確認緊更改');
      else if (idx < 3) ui.set(barLabel, 'The guard countdown starts after the change is applied', '更改套用後先開始守護倒數');
      else ui.set(barLabel, reverted ? 'Guard expired, old setting restored' : 'Change confirmed, guard released', reverted ? '守護屆滿，已還原舊設定' : '更改已確認，守護解除');
      verdict.setAttribute('class', idx >= 4 ? (reverted ? 'fc-warn' : 'fc-ok') : 'fc-surface');
      ui.set(verdictT, idx >= 4 ? (reverted ? 'Reverted' : 'Kept') : '', idx >= 4 ? (reverted ? '已還原' : '已保留') : '');
      const names = [['Previewing the diff without touching the router.', '只預覽差異，唔會改路由器。'], ['Guard armed: a timer is set and the old value is remembered.', '守護已啟動：計時器已設定，舊數值已記低。'], ['Applying the change to the demo router.', '正在套用更改到示範路由器。'],
        reverted ? [`Connection lost. Counting down ${seconds} s before the guard restores the old setting.`, `連線中斷。守護仲有 ${seconds} 秒就會還原舊設定。`] : ['Connection held. The router answers, so the change is confirmed.', '連線穩定。路由器有回應，更改獲確認。'],
        reverted ? ['Guard expired: the old setting is back, and you can try again.', '守護屆滿：舊設定已返嚟，可以再試。'] : ['Change kept and the guard is released.', '更改已保留，守護解除。']];
      ui.say(...names[idx]);
    }
    return {
      tick(dt) { const p = plan(); clock += dt; if (clock > p[4].to + 1.5) clock = 0; render(); },
      step() { const p = plan(); const total = p[4].to; if (clock >= total - 1e-6) { clock = 0; return; } clock = p.find((b) => b.to > clock + 1e-6).to; },
      reset() { clock = 0; },
      render,
      _ctl: (() => {
        ui.range({ label: { en: 'Guard time', zh: '守護時間' }, min: 5, max: 60, step: 5, value: guard, fmt: (v) => `${v} s`, onInput: (v) => { guard = v; clock = 0; ui.rerender(); } });
        ui.select({ label: { en: 'What happens', zh: '會發生咩事' }, value: failure, options: [['lost', 'Connection lost after apply', '套用後斷線'], ['ok', 'Router stays reachable', '路由器保持連線']], onChange: (v) => { failure = v; clock = 0; ui.rerender(); } });
      })(),
    };
  },
};
