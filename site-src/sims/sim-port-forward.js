// Port forwarding packet path: packets arrive from the internet, the router checks its rules, and either forwards or drops.
import { s, clamp, lerp } from './core.js';

const WAN = '203.0.113.7';
const RULES = [
  { id: 'web', port: 8080, to: 0, toPort: 80, en: 'TCP 8080 to web server, port 80', zh: 'TCP 8080 轉去網頁伺服器嘅 80 埠' },
  { id: 'game', port: 25565, to: 1, toPort: 25565, en: 'TCP 25565 to game server', zh: 'TCP 25565 轉去遊戲伺服器' },
  { id: 'ssh', port: 22, to: 2, toPort: 22, en: 'TCP 22 to file server (risky)', zh: 'TCP 22 轉去檔案伺服器（直接開放好危險）' },
];
const TARGETS = [
  { y: 70, en: 'Web server .20', zh: '網頁伺服器 .20' },
  { y: 160, en: 'Game server .30', zh: '遊戲伺服器 .30' },
  { y: 250, en: 'File server .40', zh: '檔案伺服器 .40' },
];
const PORTS = [8080, 25565, 443, 22, 3389];

export default {
  id: 'port-forward',
  title: { en: 'Port forwarding packet path', zh: '連接埠轉發封包路徑' },
  summary: { en: 'Packets from the internet reach the router first. A matching rule forwards them to one device; no rule means the packet stops at the router.', zh: '互聯網嘅封包先去到路由器。有符合嘅規則就轉去指定裝置；冇規則就喺路由器停低。' },
  hint: { en: 'Switch rules on and off, pick a port and press Send. A rule that is off behaves exactly like a rule that was never written.', zh: '開關規則、揀一個埠再按「發送」。關咗嘅規則同從未寫過嘅規則一樣。' },
  label: { en: 'Diagram of packets travelling from the internet through a router to three devices', zh: '顯示封包由互聯網經路由器去三部裝置嘅圖' },
  view: [640, 320],
  setup(ui) {
    const svg = ui.svg;
    const on = { web: true, game: true, ssh: false };
    let sendPort = 8080; let n = 0; let spawn = 0.4; let cycle = 0;
    const packets = []; let last = null;
    svg.append(s('rect', { x: 8, y: 8, width: 624, height: 304, rx: 24, class: 'fc-surface' }));
    svg.append(s('path', { d: 'M40 175a24 24 0 0138-20 30 30 0 0158 8 22 22 0 01-4 40H62a22 22 0 01-22-28z', class: 'f-muted cloud' }));
    ui.txt(svg, { x: 92, y: 140, class: 's-sm s-b s-mid' }, 'Internet', '互聯網');
    ui.txt(svg, { x: 92, y: 232, class: 's-sm s-mu s-mid' }, `Public address ${WAN}`, `公開位址 ${WAN}`);
    svg.append(s('rect', { x: 200, y: 40, width: 240, height: 240, rx: 24, class: 's-box' }));
    ui.txt(svg, { x: 320, y: 66, class: 's-text s-b s-mid' }, 'Router', '路由器');
    const ruleT = RULES.map((r, i) => ui.txt(svg, { x: 214, y: 100 + i * 52, class: 's-sm' }, '', ''));
    const ruleS = RULES.map((r, i) => ui.txt(svg, { x: 214, y: 116 + i * 52, class: 's-sm s-mu' }, '', ''));
    TARGETS.forEach((t, i) => {
      svg.append(s('rect', { x: 500, y: t.y - 24, width: 120, height: 48, rx: 14, class: 's-box' }));
      ui.txt(svg, { x: 560, y: t.y + 5, class: 's-sm s-b s-mid' }, t.en, t.zh);
      svg.append(s('line', { x1: 440, y1: 160, x2: 500, y2: t.y, class: 'wire' }));
    });
    svg.append(s('line', { x1: 140, y1: 160, x2: 200, y2: 160, class: 'wire' }));
    const layer = s('g'); svg.append(layer);
    const stats = ui.txt(svg, { x: 40, y: 292, class: 's-sm s-b' }, '', '');

    function ruleFor(port) { return RULES.find((r) => on[r.id] && r.port === port); }
    let fwd = 0; let dropped = 0;
    function launch(port, instant) {
      const rule = ruleFor(port);
      const p = { port, rule, t: 0, hold: 0, done: false, counted: false, g: s('g') };
      p.dot = s('circle', { r: 9, class: 'pkt' }); p.lab = s('text', { class: 's-sm s-b s-mid', y: -14 }); p.lab.textContent = String(port);
      p.g.append(p.dot, p.lab); layer.append(p.g);
      packets.push(p); last = p;
      if (instant) { p.t = p.rule ? 2 : 1; p.done = true; }
      place(p);
    }
    function place(p) {
      let x = 200; let y = 160;
      if (p.t <= 1) x = lerp(140, 200, clamp(p.t, 0, 1));
      else if (p.rule) { const f = clamp(p.t - 1, 0, 1); x = lerp(440, 500, f); y = lerp(160, TARGETS[p.rule.to].y, f); }
      if (p.t >= 1 && !p.counted) { p.counted = true; if (p.rule) fwd++; else dropped++; }
      p.g.setAttribute('transform', `translate(${x} ${y})`);
      p.g.setAttribute('class', p.done ? (p.rule ? 'pkt-ok' : 'pkt-drop') : '');
      p.dot.setAttribute('class', 'pkt ' + (p.t >= 1 ? (p.rule ? 'ok' : 'bad') : ''));
    }
    function describe() {
      if (!last) { ui.say('Press Send or Play to start sending packets.', '按「發送」或「播放」開始發送封包。'); return; }
      const p = last; const out = p.rule
        ? [`Port ${p.port} matched a rule, so the router forwarded it to ${TARGETS[p.rule.to].en} on port ${p.rule.toPort}.`, `${p.port} 埠符合規則，路由器轉發去${TARGETS[p.rule.to].zh}嘅 ${p.rule.toPort} 埠。`]
        : [`No rule for port ${p.port}, so the router dropped the packet. Nothing behind it was reached.`, `${p.port} 埠冇對應規則，路由器丟棄咗封包，後面嘅裝置完全冇接觸到。`];
      ui.say(out[0], out[1]);
    }
    ui.select({ label: { en: 'Send to port', zh: '發送去埠' }, value: String(sendPort), options: PORTS.map((p) => [String(p), String(p), String(p)]), onChange: (v) => { sendPort = Number(v); } });
    ui.button({ label: { en: 'Send a packet', zh: '發送封包' }, onClick: () => { launch(sendPort, !ui.motion); render(); } });
    for (const r of RULES) ui.toggle({ label: { en: `Rule: port ${r.port}`, zh: `規則：${r.port} 埠` }, value: on[r.id], onChange: (v) => { on[r.id] = v; render(); } });

    function render() {
      RULES.forEach((r, i) => {
        ui.set(ruleT[i], `${on[r.id] ? 'On' : 'Off'}: ${r.en}`, `${on[r.id] ? '開' : '關'}：${r.zh}`);
        ruleT[i].setAttribute('class', 's-sm' + (on[r.id] ? ' s-b' : ' s-mu'));
        ui.set(ruleS[i], on[r.id] ? 'Forwarding' : 'Not forwarding', on[r.id] ? '轉發中' : '未轉發');
      });
      ui.set(stats, `Forwarded ${fwd}, dropped ${dropped} so far`, `暫時已轉發 ${fwd}，已丟棄 ${dropped}`);
      describe();
    }
    launch(8080, true); cycle = 1;
    return {
      tick(dt) {
        spawn -= dt; if (spawn <= 0) { spawn = 1.6; launch(PORTS[cycle++ % PORTS.length]); }
        for (let i = packets.length - 1; i >= 0; i--) {
          const p = packets[i]; const end = p.rule ? 2 : 1;
          if (!p.done) { p.t = Math.min(end, p.t + dt * (p.t < 1 ? 0.9 : 1.1)); if (p.t >= end) p.done = true; } else p.hold += dt;
          place(p);
          if (p.done && p.hold > 1.2 && p !== last) { p.g.remove(); packets.splice(i, 1); }
        }
        render();
      },
      step() { launch(PORTS[cycle++ % PORTS.length], true); },
      reset() { for (const p of packets) p.g.remove(); packets.length = 0; last = null; n = 0; cycle = 0; fwd = 0; dropped = 0; },
      render,
    };
  },
};
