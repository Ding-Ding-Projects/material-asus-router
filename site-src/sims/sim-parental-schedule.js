// Parental schedule painting: paint blocked hours on a week grid and watch a live clock cross them.
import { s, clamp, pad2 } from './core.js';

const DAYS = [['Mon', '一'], ['Tue', '二'], ['Wed', '三'], ['Thu', '四'], ['Fri', '五'], ['Sat', '六'], ['Sun', '日']];
const GX = 92; const GY = 46; const CW = 21; const RH = 30;
const preset = {
  school: (d, hr) => (d <= 3 || d === 6 ? hr >= 21 || hr < 7 : hr >= 23 || hr < 8),
  weekend: (d, hr) => (d >= 5 ? hr >= 1 && hr < 9 : hr >= 22 || hr < 7),
  homework: (d, hr) => d < 5 && hr >= 16 && hr < 18,
  none: () => false,
  all: () => true,
};

export default {
  id: 'parental-schedule',
  title: { en: 'Parental schedule painting', zh: '家長時間表塗畫' },
  summary: { en: 'Paint the hours when a child\'s tablet should be offline. A live clock crosses the week and shows whether the internet is on or off right now.', zh: '塗出小朋友平板電腦要離線嘅時段。即時時鐘橫過一星期，顯示而家上網開定關。' },
  hint: { en: 'Drag across cells to paint. With the keyboard, move with the arrow keys and press Space to flip a cell; hold Shift while moving to paint. Click a day name to flip the whole day. Example schedule for Alex, not saved anywhere.', zh: '拖過格仔塗畫。用鍵盤就用方向鍵移動、按空白鍵切換；按住 Shift 移動即塗畫。點擊星期名切換成日。呢個係 Alex 嘅示範時間表，唔會儲存。' },
  label: { en: 'Week grid of seven days by twenty-four hours, painted where the tablet is blocked', zh: '七日乘二十四小時嘅星期格仔，塗色位置代表平板電腦被封鎖' },
  view: [640, 360],
  setup(ui) {
    const svg = ui.svg;
    const blocked = DAYS.map((_, d) => Array.from({ length: 24 }, (__, hr) => preset.school(d, hr)));
    let clock = 0 * 24 * 60 + 20 * 60 + 30; let cur = [0, 21]; let mode = true; let painting = false;
    svg.append(s('rect', { x: 8, y: 8, width: 624, height: 344, rx: 24, class: 'fc-surface' }));
    for (let hr = 0; hr < 24; hr += 3) svg.append(s('text', { x: GX + hr * CW + 1, y: GY - 10, class: 's-sm s-mu' }, pad2(hr)));
    const cells = []; const grid = s('g', { 'aria-roledescription': 'schedule grid', 'aria-label': 'Schedule grid' });
    DAYS.forEach((dn, d) => {
      const lab = ui.txt(svg, { x: 24, y: GY + d * RH + 20, class: 's-sm s-b day-lab', tabindex: '0', role: 'button' }, dn[0], `星期${dn[1]}`);
      const flip = () => { const all = blocked[d].every(Boolean); blocked[d].fill(!all); render(); };
      lab.addEventListener('click', flip); lab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
      for (let hr = 0; hr < 24; hr++) {
        const c = s('rect', { x: GX + hr * CW, y: GY + d * RH, width: CW - 1.5, height: RH - 3, rx: 5, class: 'cell' });
        c.addEventListener('pointerdown', (e) => { c.releasePointerCapture?.(e.pointerId); painting = true; cur = [d, hr]; mode = !blocked[d][hr]; blocked[d][hr] = mode; grid.focus({ preventScroll: true }); render(); e.preventDefault(); });
        c.addEventListener('pointerenter', () => { if (painting) { blocked[d][hr] = mode; cur = [d, hr]; render(); } });
        grid.append(c); cells.push(c);
      }
    });
    window.addEventListener('pointerup', () => { painting = false; });
    grid.setAttribute('tabindex', '0'); grid.setAttribute('role', 'application');
    grid.addEventListener('keydown', (e) => {
      const m = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
      if (m) {
        e.preventDefault();
        cur = [clamp(cur[0] + m[0], 0, 6), clamp(cur[1] + m[1], 0, 23)];
        if (e.shiftKey) blocked[cur[0]][cur[1]] = mode;
        render();
      }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); mode = !blocked[cur[0]][cur[1]]; blocked[cur[0]][cur[1]] = mode; render(); }
    });
    svg.append(grid);
    const cursor = s('rect', { width: CW + 1, height: RH - 1, rx: 7, class: 'cursor' }); svg.append(cursor);
    const now = s('line', { y1: GY - 4, y2: GY + 7 * RH, class: 'nowline' }); svg.append(now);
    const dev = s('g'); svg.append(dev);
    dev.append(s('rect', { x: 24, y: 276, width: 592, height: 62, rx: 18, class: 'devbtn' }));
    const tablet = s('rect', { x: 40, y: 288, width: 30, height: 38, rx: 6, class: 'f-primary' }); dev.append(tablet);
    const clockT = ui.txt(dev, { x: 86, y: 301, class: 's-text s-b' }, '', '');
    const stateT = ui.txt(dev, { x: 86, y: 322, class: 's-sm' }, '', '');
    ui.select({ label: { en: 'Start from', zh: '由此開始' }, value: 'school', options: [['school', 'School nights', '上學晚上'], ['weekend', 'Weekend lie-in', '週末賴床'], ['homework', 'Homework hours', '做功課時段'], ['none', 'Nothing blocked', '全部放行'], ['all', 'Everything blocked', '全部封鎖']], onChange: (v) => { for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) blocked[d][h] = preset[v](d, h); render(); } });

    function render() {
      cells.forEach((c, i) => { const d = Math.floor(i / 24); const hr = i % 24; c.setAttribute('class', `cell ${blocked[d][hr] ? 'f-err' : 'f-ok soft'}`); });
      const ck = Math.floor(clock); const day = Math.floor(ck / 1440) % 7; const min = ck % 1440; const hr = Math.floor(min / 60);
      const x = GX + (min / 60) * CW; now.setAttribute('x1', x); now.setAttribute('x2', x); now.setAttribute('y1', GY + day * RH - 3); now.setAttribute('y2', GY + day * RH + RH - 1);
      cursor.setAttribute('x', GX + cur[1] * CW - 0.5); cursor.setAttribute('y', GY + cur[0] * RH - 0.5);
      const off = blocked[day][hr]; const t = `${DAYS[day][0]} ${pad2(hr)}:${pad2(min % 60)}`;
      ui.set(clockT, `Demo clock ${t}`, `示範時鐘 星期${DAYS[day][1]} ${pad2(hr)}:${pad2(min % 60)}`);
      ui.set(stateT, off ? 'Alex\'s tablet: internet is OFF in this hour' : 'Alex\'s tablet: internet is ON in this hour', off ? 'Alex 嘅平板電腦：呢個時段冇網絡' : 'Alex 嘅平板電腦：呢個時段可以上網');
      tablet.setAttribute('class', off ? 'f-err' : 'f-ok');
      const total = blocked.flat().filter(Boolean).length;
      ui.say(`${t}: Alex's tablet is ${off ? 'offline' : 'online'}. ${total} of 168 hours are blocked this week. Selected cell: ${DAYS[cur[0]][0]} ${pad2(cur[1])}:00, ${blocked[cur[0]][cur[1]] ? 'blocked' : 'allowed'}.`,
        `星期${DAYS[day][1]} ${pad2(hr)}:${pad2(min % 60)}：Alex 嘅平板電腦${off ? '離線' : '在線'}。今個星期 168 個鐘有 ${total} 個鐘封鎖。選中嘅格仔：星期${DAYS[cur[0]][1]} ${pad2(cur[1])}:00，${blocked[cur[0]][cur[1]] ? '封鎖' : '放行'}。`);
    }
    return {
      tick(dt) { clock = (clock + dt * 50) % (7 * 1440); render(); },
      step() { clock = (Math.floor(clock / 60) + 1) * 60 % (7 * 1440); },
      reset() { for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) blocked[d][h] = preset.school(d, h); clock = 20 * 60 + 30; cur = [0, 21]; },
      render,
    };
  },
};
