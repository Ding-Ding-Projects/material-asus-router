// Firewall packet decisions: rules are checked top to bottom and the first match decides.
import { s, clamp, lerp } from './core.js';

const RULES = [
  { id: 'est', en: '1  Allow replies to connections you started', zh: '1  允許你發起連線嘅回覆' },
  { id: 'out', en: '2  Allow devices to reach the internet', zh: '2  允許裝置上網' },
  { id: 'ping', en: '3  Answer pings from the internet', zh: '3  回應來自互聯網嘅 ping' },
  { id: 'guest', en: '4  Block guest devices from the home network', zh: '4  禁止訪客裝置接觸家庭網絡' },
  { id: 'deny', en: '5  Drop anything else arriving from the internet', zh: '5  丟棄其他來自互聯網嘅封包' },
];
const KINDS = {
  out: { en: 'Web request from a laptop', zh: '手提電腦嘅網頁請求', from: 'lan', dir: 'out', flow: 'web' },
  reply: { en: 'Reply from the web server', zh: '網頁伺服器嘅回覆', from: 'net', dir: 'in', flow: 'web' },
  probe: { en: 'Unrequested connection to port 22', zh: '未有人要求嘅 22 埠連線', from: 'net', dir: 'in', flow: 'probe' },
  ping: { en: 'Ping from the internet', zh: '來自互聯網嘅 ping', from: 'net', dir: 'in', flow: 'ping' },
  guest: { en: 'Guest phone to a home device', zh: '訪客手機去家中裝置', from: 'guest', dir: 'lan', flow: 'guest' },
};
const ORDER = ['out', 'reply', 'probe', 'ping', 'guest'];
const START = { net: [90, 130], lan: [550, 100], guest: [550, 240] };

export default {
  id: 'firewall',
  title: { en: 'Firewall packet decisions', zh: '防火牆封包決定' },
  summary: { en: 'Five demo rules sit in a fixed order. Each packet is tested from the top, and the first rule that matches decides whether it passes.', zh: '五條示範規則按固定次序排列。每個封包由上而下檢查，第一條符合嘅規則決定放行定丟棄。' },
  hint: { en: 'Send the packets in order to see why a reply is welcome only after a request went out. Try the ping rule on and off.', zh: '依次序發送封包，就明點解要先有請求，回覆先會被放行。試吓開關 ping 規則。' },
  label: { en: 'Firewall with five ordered rules and packets from the internet, the home network and a guest device', zh: '有五條按次序規則嘅防火牆，同來自互聯網、家庭網絡同訪客裝置嘅封包' },
  view: [640, 330],
  setup(ui) {
    const svg = ui.svg;
    let pingOn = false; let pick = 'out'; let next = 0; let spawn = 0.3;
    const table = new Set(); const live = []; let last = null;
    svg.append(s('rect', { x: 8, y: 8, width: 624, height: 314, rx: 24, class: 'fc-surface' }));
    svg.append(s('rect', { x: 170, y: 24, width: 300, height: 282, rx: 22, class: 's-box' }));
    ui.txt(svg, { x: 320, y: 50, class: 's-text s-b s-mid' }, 'Router firewall', '路由器防火牆');
    const rows = RULES.map((r, i) => {
      const g = s('g'); g.append(s('rect', { x: 182, y: 62 + i * 40, width: 276, height: 32, rx: 10, class: 'rule' }));
      const tx = ui.txt(g, { x: 192, y: 83 + i * 40, class: 's-sm', 'data-maxw': 262 }, r.en, r.zh); svg.append(g); return { g, tx, bg: g.firstChild };
    });
    const tbl = ui.txt(svg, { x: 182, y: 272, class: 's-sm s-mu' }, '', '');
    const verdict = ui.txt(svg, { x: 182, y: 294, class: 's-sm s-b' }, '', '');
    const nodes = [['net', 90, 130, 'Internet', '互聯網'], ['lan', 550, 100, 'Home network', '家庭網絡'], ['guest', 550, 240, 'Guest network', '訪客網絡']];
    for (const [id, x, y, en, zh] of nodes) { svg.append(s('rect', { x: x - 60, y: y - 24, width: 120, height: 48, rx: 14, class: 's-box' })); ui.txt(svg, { x, y: y + 5, class: 's-sm s-b s-mid' }, en, zh); }
    svg.append(s('line', { x1: 150, y1: 130, x2: 170, y2: 130, class: 'wire strong' }), s('line', { x1: 470, y1: 100, x2: 490, y2: 100, class: 'wire strong' }), s('line', { x1: 470, y1: 240, x2: 490, y2: 240, class: 'wire' }));
    const layer = s('g'); svg.append(layer);

    function decide(kind) {
      const k = KINDS[kind];
      if (k.dir === 'in' && table.has(k.flow)) return { rule: 0, allow: true };
      if (k.dir === 'out') return { rule: 1, allow: true };
      if (kind === 'ping' && pingOn) return { rule: 2, allow: true };
      if (k.from === 'guest') return { rule: 3, allow: false };
      return { rule: 4, allow: false };
    }
    function launch(kind, instant) {
      const d = decide(kind); const k = KINDS[kind];
      if (d.allow && k.dir === 'out') table.add(k.flow);
      const p = { kind, d, t: 0, hold: 0, done: false, g: s('g'), from: START[k.from] };
      p.dot = s('circle', { r: 9, class: 'pkt' }); p.g.append(p.dot); layer.append(p.g);
      live.push(p); last = p;
      if (instant) { p.t = 1; p.done = true; }
      place(p);
    }
    function place(p) {
      const k = KINDS[p.kind]; const [x0, y0] = p.from;
      const edge = k.from === 'net' ? [170, 160] : [470, y0 < 160 ? 120 : 200];
      const dest = k.from === 'lan' ? [152, 130] : [488, 100];
      let x; let y;
      if (p.t < 0.5) { const f = p.t / 0.5; x = lerp(x0, edge[0], f); y = lerp(y0, edge[1], f); }
      else if (p.d.allow) { const f = (p.t - 0.5) / 0.5; x = lerp(edge[0], dest[0], f); y = lerp(edge[1], dest[1], f); }
      else { x = edge[0]; y = edge[1]; }
      p.g.setAttribute('transform', `translate(${x} ${y})`);
      p.g.setAttribute('class', p.done && !p.d.allow ? 'pkt-drop' : p.done ? 'pkt-ok' : '');
      p.dot.setAttribute('class', 'pkt ' + (p.t >= 0.5 ? (p.d.allow ? 'ok' : 'bad') : ''));
    }
    ui.select({ label: { en: 'Packet', zh: '封包' }, value: pick, options: ORDER.map((k) => [k, KINDS[k].en, KINDS[k].zh]), onChange: (v) => { pick = v; } });
    ui.button({ label: { en: 'Send this packet', zh: '發送呢個封包' }, onClick: () => { launch(pick, !ui.motion); render(); } });
    ui.toggle({ label: { en: 'Answer pings (rule 3)', zh: '回應 ping（規則 3）' }, value: pingOn, onChange: (v) => { pingOn = v; render(); } });

    function render() {
      const m = last ? last.d.rule : -1;
      rows.forEach((r, i) => {
        r.bg.setAttribute('class', 'rule' + (i === m ? (last.d.allow ? ' hit-ok' : ' hit-bad') : '') + (i === 2 && !pingOn ? ' off' : ''));
        ui.set(r.tx, RULES[i].en + (i === 2 ? (pingOn ? ' (on)' : ' (off)') : ''), RULES[i].zh + (i === 2 ? (pingOn ? '（開）' : '（關）') : ''));
      });
      ui.set(tbl, `Connections remembered: ${table.size ? [...table].join(', ') : 'none'}`, `已記住嘅連線：${table.size ? [...table].join('、') : '冇'}`);
      if (last) {
        const k = KINDS[last.kind];
        ui.set(verdict, `${last.d.allow ? 'Allowed' : 'Dropped'} by rule ${last.d.rule + 1}`, `${last.d.allow ? '放行' : '丟棄'}，依據規則 ${last.d.rule + 1}`);
        ui.say(`${k.en}: ${last.d.allow ? 'allowed' : 'dropped'} by rule ${last.d.rule + 1}. ${last.kind === 'reply' && !last.d.allow ? 'No request went out first, so this reply looks unsolicited.' : ''}`,
          `${k.zh}：${last.d.allow ? '放行' : '丟棄'}，依據規則 ${last.d.rule + 1}。${last.kind === 'reply' && !last.d.allow ? '冇先發出請求，所以呢個回覆當作未被要求。' : ''}`);
      } else { ui.set(verdict, 'No packet yet', '未有封包'); ui.say('Send a packet to see which rule decides.', '發送一個封包睇邊條規則作決定。'); }
    }
    launch('out', true); launch('reply', true); next = 2;
    return {
      tick(dt) {
        spawn -= dt; if (spawn <= 0) { spawn = 2.1; const kind = ORDER[next++ % ORDER.length]; if (kind === 'out' && next > 1) table.clear(); launch(kind); }
        for (let i = live.length - 1; i >= 0; i--) {
          const p = live[i];
          if (!p.done) { p.t = Math.min(1, p.t + dt * 0.6); if (p.t >= 1) p.done = true; } else p.hold += dt;
          place(p); if (p.done && p.hold > 1.2 && p !== last) { p.g.remove(); live.splice(i, 1); }
        }
        render();
      },
      step() { const kind = ORDER[next++ % ORDER.length]; if (kind === 'out') table.clear(); launch(kind, true); },
      reset() { for (const p of live) p.g.remove(); live.length = 0; table.clear(); last = null; next = 0; },
      render,
    };
  },
};
