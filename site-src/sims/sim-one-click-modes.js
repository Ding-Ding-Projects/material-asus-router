// One-click modes preview: pick a mode and see the exact settings that would change, then apply or undo it on the demo.
import { s } from './core.js';

const KEYS = [
  { id: 'guest', en: 'Guest Wi-Fi', zh: '訪客 Wi-Fi' },
  { id: 'iot', en: 'Smart-home network', zh: '智能家居網絡' },
  { id: 'qos', en: 'Traffic priority', zh: '流量優先' },
  { id: 'sched', en: 'Parental schedule', zh: '家長時間表' },
  { id: 'vpn', en: 'VPN for chosen devices', zh: '指定裝置使用 VPN' },
  { id: 'leds', en: 'Router lights', zh: '路由器指示燈' },
  { id: 'power', en: 'Wi-Fi transmit power', zh: 'Wi-Fi 發射功率' },
];
const V = {
  on: ['On', '開'], off: ['Off', '關'], game: ['Gaming first', '遊戲優先'], call: ['Calls first', '通話優先'], even: ['Even share', '平均分配'],
  night: ['Dim at night', '夜間調暗'], dim: ['Off', '熄滅'], full: ['Full', '全功率'], low: ['Reduced', '調低'], bed: ['Bedtime hours', '睡眠時段'], none: ['Not set', '未設定'], work: ['Work devices', '工作裝置'],
};
const MODES = {
  home: { en: 'Home', zh: '日常', v: { guest: 'off', iot: 'on', qos: 'even', sched: 'none', vpn: 'off', leds: 'on', power: 'full' } },
  focus: { en: 'Focus', zh: '專注', v: { guest: 'off', iot: 'on', qos: 'call', sched: 'bed', vpn: 'work', leds: 'night', power: 'full' } },
  guests: { en: 'Guests over', zh: '有客到訪', v: { guest: 'on', iot: 'off', qos: 'even', sched: 'none', vpn: 'off', leds: 'on', power: 'full' } },
  gaming: { en: 'Gaming', zh: '打機', v: { guest: 'off', iot: 'on', qos: 'game', sched: 'none', vpn: 'off', leds: 'dim', power: 'full' } },
  away: { en: 'Away', zh: '外出', v: { guest: 'off', iot: 'on', qos: 'even', sched: 'none', vpn: 'off', leds: 'dim', power: 'low' } },
};
const ORDER = Object.keys(MODES);
const vtext = (k) => V[k] || [k, k];
const valueOf = (key, val) => (key === 'leds' && val === 'on' ? ['Always on', '長亮'] : vtext(val));

export default {
  id: 'one-click-modes',
  title: { en: 'One-click modes preview', zh: '一鍵模式預覽' },
  summary: { en: 'A mode is a named bundle of settings. Pick one to see exactly what would change before anything is applied, then apply it to the demo or undo it.', zh: '模式係一組有名稱嘅設定。揀一個，套用之前就睇到會改邊啲設定，之後可以套用到示範或者還原。' },
  hint: { en: 'Choose a mode to preview, then press Apply to demo. Undo restores the previous mode. These settings are examples, and nothing here changes a real router.', zh: '揀一個模式預覽，再按「套用到示範」。「還原」會返去上一個模式。呢啲設定只係例子，唔會改動任何真實路由器。' },
  label: { en: 'Table of seven settings showing current and new values for the chosen mode', zh: '七項設定嘅表格，顯示所揀模式嘅目前同新數值' },
  view: [640, 400],
  setup(ui) {
    const svg = ui.svg;
    let current = 'home'; let pending = 'focus'; const history = []; let pulse = false; let acc = 0;
    svg.append(s('rect', { x: 8, y: 8, width: 624, height: 384, rx: 24, class: 'fc-surface' }));
    const chips = ORDER.map((id, i) => {
      const g = s('g', { role: 'radio', tabindex: '0' }); const y = 30 + i * 52;
      const bg = s('rect', { x: 24, y, width: 138, height: 42, rx: 21, class: 'chip' }); g.append(bg);
      ui.txt(g, { x: 93, y: y + 26, class: 's-text s-b s-mid' }, MODES[id].en, MODES[id].zh);
      const pick = () => { pending = id; ui.rerender(); };
      g.addEventListener('click', pick); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      svg.append(g); return { id, g, bg };
    });
    const rows = KEYS.map((k, i) => {
      const y = 56 + i * 44; const g = s('g');
      g.append(s('rect', { x: 184, y: y - 18, width: 432, height: 38, rx: 12, class: 'rowbg' }));
      ui.txt(g, { x: 198, y: y + 5, class: 's-sm s-b' }, k.en, k.zh);
      const cur = ui.txt(g, { x: 372, y: y + 5, class: 's-sm', 'text-anchor': 'end' }, '', '');
      g.append(s('path', { d: `M386 ${y + 1}h22m-6 -6l6 6l-6 6`, class: 'arrow' }));
      const nxt = ui.txt(g, { x: 424, y: y + 5, class: 's-sm s-b' }, '', '');
      svg.append(g); return { k, g, cur, nxt, bg: g.firstChild };
    });
    const leds = ['guest', 'iot', 'vpn'].map((id, i) => ({ id, c: s('circle', { cx: 468 + i * 24, cy: 378, r: 6, class: 'led' }) }));
    leds.forEach((l) => svg.append(l.c)); ui.txt(svg, { x: 184, y: 382, class: 's-sm s-mu' }, 'Demo router lights', '示範路由器指示燈');
    const note = ui.txt(svg, { x: 368, y: 30, class: 's-sm s-b', 'text-anchor': 'middle' }, '', ''); note.setAttribute('x', 400); note.setAttribute('y', 22);
    ui.button({ label: { en: 'Apply to demo', zh: '套用到示範' }, onClick: () => { if (pending === current) return; history.push(current); current = pending; pulse = true; ui.rerender(); setTimeout(() => { pulse = false; ui.rerender(); }, 700); } });
    ui.button({ label: { en: 'Undo', zh: '還原' }, onClick: () => { if (!history.length) return; current = history.pop(); pending = current; ui.rerender(); } });

    function render() {
      chips.forEach((c) => { c.bg.setAttribute('class', 'chip' + (c.id === pending ? ' pend' : '') + (c.id === current ? ' cur' : '')); c.g.setAttribute('aria-checked', String(c.id === pending)); c.g.setAttribute('aria-label', `${MODES[c.id].en}${c.id === current ? ' (current)' : ''}`); });
      let changed = 0;
      rows.forEach((r) => {
        const a = MODES[current].v[r.k.id]; const b = MODES[pending].v[r.k.id]; const diff = a !== b; if (diff) changed++;
        const av = valueOf(r.k.id, a); const bv = valueOf(r.k.id, b);
        ui.set(r.cur, av[0], av[1]); ui.set(r.nxt, diff ? bv[0] : 'No change', diff ? bv[1] : '冇改變');
        r.bg.setAttribute('class', 'rowbg' + (diff ? ' diff' : '') + (diff && pulse ? ' flip' : ''));
        r.nxt.setAttribute('class', 's-sm ' + (diff ? 's-b' : 's-mu'));
      });
      const v = MODES[current].v;
      leds.forEach((l) => l.c.setAttribute('class', 'led ' + ((l.id === 'guest' && v.guest === 'on') || (l.id === 'iot' && v.iot === 'on') || (l.id === 'vpn' && v.vpn !== 'off') ? 'lit' : '') + (v.leds === 'dim' ? ' faint' : '')));
      ui.set(note, pending === current ? 'Already in this mode' : `Preview: ${MODES[current].en} to ${MODES[pending].en}`, pending === current ? '已經喺呢個模式' : `預覽：${MODES[current].zh}轉${MODES[pending].zh}`);
      ui.say(pending === current ? `The demo router is in ${MODES[current].en} mode. Pick another mode to preview its changes.` : `Switching from ${MODES[current].en} to ${MODES[pending].en} would change ${changed} of ${KEYS.length} settings. Nothing is applied until you press Apply to demo.`,
        pending === current ? `示範路由器而家係「${MODES[current].zh}」模式。揀另一個模式預覽改動。` : `由「${MODES[current].zh}」轉去「${MODES[pending].zh}」會改動 ${KEYS.length} 項入面嘅 ${changed} 項。未按「套用到示範」之前，冇任何設定會改變。`);
    }
    return {
      tick(dt) { acc += dt; if (acc > 3) { acc = 0; pending = ORDER[(ORDER.indexOf(pending) + 1) % ORDER.length]; render(); } },
      step() { pending = ORDER[(ORDER.indexOf(pending) + 1) % ORDER.length]; },
      reset() { current = 'home'; pending = 'focus'; history.length = 0; },
      render,
    };
  },
};
