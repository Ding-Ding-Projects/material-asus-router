// VPN routing by device: each device goes straight to the internet or through a VPN tunnel.
import { s, clamp, lerp } from './core.js';

const DEVS = [
  { id: 'laptop', en: 'Laptop', zh: '手提電腦', vpn: false },
  { id: 'phone', en: 'Phone', zh: '手機', vpn: true },
  { id: 'tv', en: 'TV', zh: '電視', vpn: false },
  { id: 'work', en: 'Work PC', zh: '公司電腦', vpn: true },
  { id: 'console', en: 'Game console', zh: '遊戲機', vpn: false },
];
const R = { x: 310, y: 175 }; const WAN = { x: 540, y: 70 }; const VPN = { x: 540, y: 280 };

export default {
  id: 'vpn-director',
  title: { en: 'VPN routing by device', zh: '按裝置分流嘅 VPN 路由' },
  summary: { en: 'Choose, device by device, which traffic goes through the VPN tunnel and which goes straight out. Then drop the tunnel and see what the kill switch does.', zh: '逐部裝置揀走 VPN 隧道定直接上網。然後切斷隧道，睇斷網保護做咩。' },
  hint: { en: 'Click a device, or focus it and press Enter, to flip its route. Turn the tunnel off with the kill switch on and off to compare.', zh: '點擊裝置，或者聚焦後按 Enter 轉換路線。關閉隧道，並比較斷網保護開同關。' },
  label: { en: 'Five devices connected to a router with a direct route to the internet and a VPN tunnel route', zh: '五部裝置連去路由器，有直接上網同 VPN 隧道兩條路線' },
  view: [640, 350],
  setup(ui) {
    const svg = ui.svg;
    let tunnel = true; let kill = true; const route = Object.fromEntries(DEVS.map((d) => [d.id, d.vpn]));
    svg.append(s('rect', { x: 8, y: 8, width: 624, height: 334, rx: 24, class: 'fc-surface' }));
    const wires = s('g'); const dots = s('g'); svg.append(wires, dots);
    svg.append(s('rect', { x: R.x - 50, y: R.y - 36, width: 100, height: 72, rx: 18, class: 'f-primary' }));
    ui.txt(svg, { x: R.x, y: R.y + 5, class: 's-text s-b s-mid on-primary' }, 'Router', '路由器');
    const mk = (n, en, zh, cls) => { svg.append(s('rect', { x: n.x - 70, y: n.y - 30, width: 140, height: 60, rx: 16, class: cls })); ui.txt(svg, { x: n.x, y: n.y + 5, class: 's-sm s-b s-mid' }, en, zh); };
    mk(WAN, 'Internet, direct', '互聯網（直接）', 's-box'); const vpnBox = mk(VPN, 'VPN server', 'VPN 伺服器', 's-box');
    const wanLine = s('line', { x1: R.x + 50, y1: R.y - 12, x2: WAN.x - 70, y2: WAN.y, class: 'wire strong' });
    const vpnLine = s('line', { x1: R.x + 50, y1: R.y + 12, x2: VPN.x - 70, y2: VPN.y, class: 'wire strong tunnel' });
    wires.append(wanLine, vpnLine);
    const tunnelLab = ui.txt(svg, { x: 540, y: 328, class: 's-sm s-b s-mid' }, '', '');
    const items = DEVS.map((d, i) => {
      const y = 50 + i * 62; const g = s('g', { role: 'switch', tabindex: '0' });
      const bg = s('rect', { x: 28, y: y - 24, width: 182, height: 48, rx: 16, class: 'devbtn' });
      g.append(bg); ui.txt(g, { x: 44, y: y - 3, class: 's-sm s-b', 'data-maxw': 158 }, d.en, d.zh);
      const tag = ui.txt(g, { x: 44, y: y + 14, class: 's-sm', 'data-maxw': 158 }, '', '');
      svg.append(g);
      const flip = () => { route[d.id] = !route[d.id]; ui.rerender(); };
      g.addEventListener('click', flip); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
      const line = s('line', { x1: 210, y1: y, x2: R.x - 50, y2: R.y, class: 'wire' }); wires.append(line);
      const dot = s('circle', { r: 4.5, class: 'pkt' }); dots.append(dot);
      return { d, y, g, bg, tag, line, dot, t: i * 0.2 };
    });
    ui.toggle({ label: { en: 'VPN tunnel is up', zh: 'VPN 隧道連線中' }, value: tunnel, onChange: (v) => { tunnel = v; ui.rerender(); } });
    ui.toggle({ label: { en: 'Kill switch on', zh: '斷網保護開啟' }, value: kill, onChange: (v) => { kill = v; ui.rerender(); } });

    const status = (d) => (!route[d] ? 'direct' : tunnel ? 'tunnel' : kill ? 'blocked' : 'leak');
    function pos(it) {
      const st = status(it.d.id); const t = ui.motion ? it.t : 0.55;
      if (t < 0.45) return [lerp(210, R.x - 50, t / 0.45), lerp(it.y, R.y, t / 0.45), 'ok'];
      const f = (t - 0.45) / 0.55;
      if (st === 'direct' || st === 'leak') return [lerp(R.x + 50, WAN.x - 70, f), lerp(R.y - 12, WAN.y, f), st === 'leak' ? 'bad' : 'ok'];
      if (st === 'tunnel') return [lerp(R.x + 50, VPN.x - 70, f), lerp(R.y + 12, VPN.y, f), 'ok'];
      return [R.x - 50 + Math.min(f, 0.1) * 40, R.y, 'bad'];
    }
    function render() {
      const counts = { direct: 0, tunnel: 0, blocked: 0, leak: 0 };
      for (const it of items) {
        const st = status(it.d.id); counts[st]++;
        it.bg.setAttribute('class', `devbtn ${st}`); it.g.setAttribute('aria-checked', String(route[it.d.id]));
        it.g.setAttribute('aria-label', `${it.d.en}: ${st}`);
        const labels = { direct: ['Direct to the internet', '直接上網'], tunnel: ['Through the VPN tunnel', '經 VPN 隧道'], blocked: ['Blocked by the kill switch', '被斷網保護攔截'], leak: ['Leaking: tunnel down, goes direct', '洩漏：隧道斷咗，直接上網'] }[st];
        ui.set(it.tag, labels[0], labels[1]);
        const [x, y, k] = pos(it); it.dot.setAttribute('cx', x); it.dot.setAttribute('cy', y); it.dot.setAttribute('class', `pkt ${k}`);
        it.line.setAttribute('class', `wire ${st === 'blocked' ? 'bad' : ''}`);
      }
      vpnLine.setAttribute('class', `wire strong tunnel ${tunnel ? '' : 'down'}`);
      ui.set(tunnelLab, tunnel ? 'Tunnel up' : 'Tunnel down', tunnel ? '隧道已連線' : '隧道已中斷');
      ui.say(`${counts.tunnel} on the tunnel, ${counts.direct} direct${counts.blocked ? `, ${counts.blocked} blocked by the kill switch` : ''}${counts.leak ? `, ${counts.leak} leaking because the tunnel is down and the kill switch is off` : ''}.`,
        `${counts.tunnel} 部經隧道，${counts.direct} 部直接上網${counts.blocked ? `，${counts.blocked} 部被斷網保護攔截` : ''}${counts.leak ? `，${counts.leak} 部因隧道斷咗又冇開斷網保護而洩漏` : ''}。`);
    }
    return {
      tick(dt) { for (const it of items) it.t = (it.t + dt * 0.45) % 1; render(); },
      step() { const i = items.findIndex((it) => !route[it.d.id]); const it = items[i < 0 ? 0 : i]; route[it.d.id] = !route[it.d.id]; },
      reset() { for (const d of DEVS) route[d.id] = d.vpn; tunnel = true; kill = true; const boxes = svg.closest('figure').querySelectorAll('.sim-check input'); boxes[0].checked = true; boxes[1].checked = true; },
      render,
    };
  },
};
