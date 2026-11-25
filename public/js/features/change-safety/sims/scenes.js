// Before-and-after pictures, one for each kind of change. Every picture is built
// from the entry's real old and new values and has the same three controls: a
// "Before to after" slider, Play (animates it) and Step (jumps between the two,
// which is also what reduced motion uses). They are visual explanations, not
// a test of the router.
import { s, clamp, lerp } from "./core.js";
import { channelOf, ipToNumber, poolOf, scheduleOf } from "../model.js";

const short = (v, n = 34) => {
  const text = String(v ?? "");
  return text.length > n ? `${text.slice(0, n - 1)}…` : text || "(empty)";
};
const truthy = (v) => /^(1|on|yes|true|enabled?|allow)$/i.test(String(v ?? "").trim());
const isFlag = (a, b) => [a, b].every((v) => /^(0|1|on|off|yes|no|true|false|enabled?|disabled?|)$/i.test(String(v ?? "").trim()));
const nums = (v) => (String(v ?? "").match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const ease = (p) => p * p * (3 - 2 * p);

const FRAME = {
  title: { en: "Before and after", zh: "改動前後" },
  hint: { en: "Drag the slider, press Play, or press Step to jump between before and after. The picture uses this change's real old and new values.", zh: "拖動滑桿、撳「播放」，或者撳「單步」喺改動前後之間跳轉。圖用咗呢項改動真實嘅舊值同新值。" },
};

// The shared shell: p runs from 0 (before) to 1 (after).
function scene(id, data, { title, summary, label, view = [640, 300], build }) {
  return {
    id: `${id}-${Math.random().toString(36).slice(2, 7)}`,
    title: title ?? FRAME.title,
    summary,
    hint: FRAME.hint,
    label,
    view,
    setup(ui) {
      let p = 0;
      let dir = 1;
      let hold = 0;
      const slider = ui.range({ label: { en: "Before to after", zh: "改動前至改動後" }, min: 0, max: 100, value: 0, onInput: (v) => { p = v / 100; render(); }, fmt: (v) => (v < 5 ? "before" : v > 95 ? "after" : `${v}%`) });
      const draw = build(ui, data);
      function render() {
        draw(p, ease(p));
        slider.set(Math.round(p * 100));
      }
      return {
        render,
        tick(dt) {
          if (hold > 0) { hold -= dt; return; }
          p = clamp(p + dir * dt * 0.45, 0, 1);
          if (p >= 1 || p <= 0) { dir = -dir; hold = 0.9; }
          render();
        },
        step() { p = p < 0.5 ? 1 : 0; },
        reset() { p = 0; dir = 1; hold = 0; },
      };
    },
  };
}

const box = (parent, x, y, w, hh, cls = "s-box") => parent.appendChild(s("rect", { x, y, width: w, height: hh, rx: 14, class: cls }));
const frame = (svg, W, H) => svg.append(s("rect", { x: 6, y: 6, width: W - 12, height: H - 12, rx: 22, class: "fc-surface" }));

// ---- a number of everything else: a generic before-and-after ------------------------------------------------

function genericScene(data) {
  return scene("generic", data, {
    summary: { en: `${data.name.en}: from "${short(data.old, 40)}" to "${short(data.new, 40)}".`, zh: `${data.name.yue}：由「${short(data.old, 40)}」改為「${short(data.new, 40)}」。` },
    label: { en: "Before and after values of one setting", zh: "一項設定改動前後嘅值" },
    build(ui) {
      const { svg } = ui;
      const [W, H] = [640, 260];
      frame(svg, W, H);
      const flag = isFlag(data.old, data.new);
      const a = nums(data.old)[0];
      const b = nums(data.new)[0];
      const numeric = a !== undefined && b !== undefined && !flag;
      box(svg, 40, 40, 230, 120);
      box(svg, 370, 40, 230, 120);
      ui.txt(svg, { x: 155, y: 66, class: "s-sm s-mu s-mid" }, "Before", "改動前");
      ui.txt(svg, { x: 485, y: 66, class: "s-sm s-mu s-mid" }, "After", "改動後");
      const oldT = s("text", { x: 155, y: 118, class: "s-text s-mid s-b", "data-maxw": 210 }, short(data.old, 22));
      const newT = s("text", { x: 485, y: 118, class: "s-text s-mid s-b", "data-maxw": 210 }, short(data.new, 22));
      svg.append(oldT, newT);
      const arrow = s("path", { d: "M280 100 H360 M345 86 L360 100 L345 114", class: "wire strong", fill: "none" });
      svg.append(arrow);
      const track = s("rect", { x: 60, y: 200, width: 520, height: 18, rx: 9, class: "fc-primary" });
      const fill = s("rect", { x: 60, y: 200, width: 20, height: 18, rx: 9, class: "f-primary" });
      const knob = s("circle", { cx: 70, cy: 209, r: 14, class: "f-primary" });
      svg.append(track, fill, knob);
      const caption = ui.txt(svg, { x: 320, y: 246, class: "s-sm s-mid" }, "", "");
      return (p, e) => {
        const lo = numeric ? Math.min(a, b, 0) : 0;
        const hi = numeric ? Math.max(a, b, 1) : 1;
        const at = numeric ? lerp(a, b, e) : flag ? (truthy(data.old) ? 1 - e : e) : e;
        const x = 60 + clamp((at - lo) / (hi - lo || 1), 0, 1) * 520;
        fill.setAttribute("width", Math.max(20, x - 50));
        knob.setAttribute("cx", clamp(x, 70, 570));
        oldT.setAttribute("opacity", String(1 - e * 0.6));
        newT.setAttribute("opacity", String(0.4 + e * 0.6));
        ui.set(caption, flag ? (e < 0.5 ? (truthy(data.old) ? "On" : "Off") : truthy(data.new) ? "On" : "Off") : numeric ? `${Math.round(at * 100) / 100}` : e < 0.5 ? "Current value" : "New value", flag ? (e < 0.5 ? (truthy(data.old) ? "開" : "關") : truthy(data.new) ? "開" : "關") : numeric ? `${Math.round(at * 100) / 100}` : e < 0.5 ? "而家嘅值" : "新嘅值");
        ui.say(`${data.name.en}: ${e < 0.5 ? "now" : "after the change"} it is ${short(e < 0.5 ? data.old : data.new, 50)}.`, `${data.name.yue}：${e < 0.5 ? "而家" : "改動後"}係 ${short(e < 0.5 ? data.old : data.new, 50)}。`);
      };
    },
  });
}

// ---- Wi-Fi channel and width -------------------------------------------------------------------------------------

function wifiScene(data) {
  const o = channelOf(data.old);
  const n = channelOf(data.new);
  const five = Math.max(o.channel, n.channel) > 14;
  return scene("wifi", data, {
    summary: { en: `Channel ${o.auto ? "auto" : o.channel} (${o.width} MHz) becomes ${n.auto ? "auto" : n.channel} (${n.width} MHz).`, zh: `頻道 ${o.auto ? "自動" : o.channel}（${o.width} MHz）改為 ${n.auto ? "自動" : n.channel}（${n.width} MHz）。` },
    label: { en: "Wi-Fi channel and width before and after", zh: "Wi-Fi 頻道同頻寬改動前後" },
    view: [640, 300],
    build(ui) {
      const { svg } = ui;
      frame(svg, 640, 300);
      const lo = five ? 30 : 0;
      const hi = five ? 170 : 15;
      const x = (c) => 40 + ((c - lo) / (hi - lo)) * 560;
      const ticks = five ? [36, 52, 100, 116, 132, 149, 165] : [1, 3, 6, 9, 11, 13];
      for (const c of ticks) {
        svg.append(s("line", { x1: x(c), x2: x(c), y1: 50, y2: 230, class: "gridline" }));
        svg.append(s("text", { x: x(c), y: 250, class: "s-sm s-mu s-mid" }, String(c)));
      }
      ui.txt(svg, { x: 320, y: 280, class: "s-sm s-mu s-mid" }, five ? "Channel (5 GHz)" : "Channel (2.4 GHz)", five ? "頻道（5 GHz）" : "頻道（2.4 GHz）");
      const ghost = s("path", { class: "curve nb", d: "" });
      const mine = s("path", { class: "curve mine", d: "" });
      svg.append(ghost, mine);
      const curve = (ch, w) => {
        const half = (w / (five ? 5 : 5)) * (five ? 0.55 : 1) + (five ? 2 : 1.5);
        let d = "";
        for (let c = lo; c <= hi; c += 0.5) {
          const y = 230 - Math.exp(-Math.pow(Math.abs(c - ch) / half, 4)) * 150;
          d += `${c === lo ? "M" : "L"}${x(c).toFixed(1)} ${y.toFixed(1)}`;
        }
        return `${d}L${x(hi)} 230L${x(lo)} 230Z`;
      };
      const label = ui.txt(svg, { x: 320, y: 36, class: "s-text s-mid s-b" }, "", "");
      return (p, e) => {
        const oc = o.auto ? (five ? 36 : 6) : o.channel;
        const nc = n.auto ? (five ? 36 : 6) : n.channel;
        ghost.setAttribute("d", curve(oc, o.width));
        mine.setAttribute("d", curve(lerp(oc, nc, e), lerp(o.width, n.width, e)));
        ui.set(label, `Channel ${Math.round(lerp(oc, nc, e))} · ${Math.round(lerp(o.width, n.width, e))} MHz`, `頻道 ${Math.round(lerp(oc, nc, e))} · ${Math.round(lerp(o.width, n.width, e))} MHz`);
        ui.say(`The faint curve is where Wi-Fi sits now. The solid one is where it moves to. Devices on this band reconnect.`, `淡色曲線係而家嘅位置，實色曲線係改動後嘅位置，呢個頻段嘅裝置會重新連線。`);
      };
    },
  });
}

// ---- DHCP pool and router address ------------------------------------------------------------------------------------

function dhcpScene(data) {
  const pool = poolOf(data, data.all ?? []);
  const lastOctet = (n) => (n === null ? null : n & 255);
  const so = lastOctet(pool.oldStart) ?? lastOctet(ipToNumber(data.old)) ?? 2;
  const eo = lastOctet(pool.oldEnd) ?? 254;
  const sn = lastOctet(pool.newStart) ?? lastOctet(ipToNumber(data.new)) ?? so;
  const en = lastOctet(pool.newEnd) ?? eo;
  const router = /^lan_ipaddr/.test(data.key);
  return scene("dhcp", data, {
    summary: router ? { en: `The router moves from ${short(data.old)} to ${short(data.new)}. Every device has to find it at the new address.`, zh: `路由器由 ${short(data.old)} 搬去 ${short(data.new)}，所有裝置都要用新地址搵佢。` } : { en: `The address pool runs from ${so} to ${eo} and becomes ${sn} to ${en} (last part of the address).`, zh: `地址池由 ${so} 至 ${eo}，改為 ${sn} 至 ${en}（地址最後一段）。` },
    label: { en: "Address pool before and after", zh: "地址池改動前後" },
    view: [640, 240],
    build(ui) {
      const { svg } = ui;
      frame(svg, 640, 240);
      const x = (v) => 40 + (v / 255) * 560;
      svg.append(s("rect", { x: 40, y: 100, width: 560, height: 36, rx: 18, class: "fc-primary" }));
      const ghost = s("rect", { x: 40, y: 100, width: 10, height: 36, rx: 18, class: "f-muted" });
      const live = s("rect", { x: 40, y: 100, width: 10, height: 36, rx: 18, class: "f-primary" });
      svg.append(ghost, live);
      const routerDot = s("circle", { cx: x(1), cy: 118, r: 11, class: "f-warn" });
      svg.append(routerDot);
      ui.txt(svg, { x: 40, y: 168, class: "s-sm s-mu" }, "0", "0");
      ui.txt(svg, { x: 600, y: 168, class: "s-sm s-mu", "text-anchor": "end" }, "255", "255");
      ui.txt(svg, { x: 320, y: 70, class: "s-text s-mid s-b" }, "", "");
      const title = svg.lastChild;
      const count = ui.txt(svg, { x: 320, y: 206, class: "s-sm s-mid" }, "", "");
      return (p, e) => {
        const a = lerp(so, sn, e);
        const b = lerp(eo, en, e);
        ghost.setAttribute("x", x(so)); ghost.setAttribute("width", Math.max(6, x(eo) - x(so)));
        live.setAttribute("x", x(a)); live.setAttribute("width", Math.max(6, x(b) - x(a)));
        ui.set(title, router ? (e < 0.5 ? short(data.old) : short(data.new)) : `${Math.round(a)} to ${Math.round(b)}`, router ? (e < 0.5 ? short(data.old) : short(data.new)) : `${Math.round(a)} 至 ${Math.round(b)}`);
        const size = Math.max(0, Math.round(b - a + 1));
        ui.set(count, `${size} addresses can be handed out`, `可以派發 ${size} 個地址`);
        ui.say(router ? "The grey bar is the old pool, the blue one the new. Changing the router address changes the whole network." : "Devices with an address outside the new pool keep it until the lease ends; new devices get one from the new pool.", router ? "灰色係舊地址池，藍色係新嘅。改路由器地址會改變成個網絡。" : "喺新地址池範圍外嘅裝置會保留地址直至租約完結，新裝置會由新地址池攞地址。");
      };
    },
  });
}

// ---- a rule packet path (port forwarding) --------------------------------------------------------------------------------

function portScene(data) {
  const parts = (v) => String(v ?? "").split(/[<>]/).filter(Boolean);
  const po = parts(data.old);
  const pn = parts(data.new);
  return scene("portforward", data, {
    summary: { en: "A packet from the internet reaches the router and is handed to a device inside, or stopped.", zh: "網上嘅封包到達路由器，之後交畀屋企入面嘅裝置，或者被攔住。" },
    label: { en: "Packet path through a port rule", zh: "封包經過埠規則嘅路徑" },
    view: [640, 260],
    build(ui) {
      const { svg } = ui;
      frame(svg, 640, 260);
      const nodes = [["Internet", "互聯網", 90], ["Router", "路由器", 320], ["Device", "裝置", 550]];
      for (const [en, zh, cx] of nodes) {
        svg.append(s("circle", { cx, cy: 110, r: 38, class: "s-box" }));
        ui.txt(svg, { x: cx, y: 164, class: "s-sm s-mid s-b" }, en, zh);
      }
      svg.append(s("path", { d: "M128 110 H282 M358 110 H512", class: "wire dashed" }));
      const packet = s("circle", { cx: 90, cy: 110, r: 9, class: "pkt" });
      const wall = s("rect", { x: 304, y: 80, width: 32, height: 60, rx: 8, class: "f-err" });
      svg.append(wall, packet);
      const rule = ui.txt(svg, { x: 320, y: 214, class: "s-sm s-mid", "data-maxw": 560 }, "", "");
      const had = po.length > 0;
      const has = pn.length > 0;
      return (p, e) => {
        const open = lerp(had ? 1 : 0, has ? 1 : 0, e);
        const t = (p * 2) % 1;
        const reach = open > 0.5;
        packet.setAttribute("cx", reach ? lerp(90, 550, t) : lerp(90, 282, Math.min(t * 1.4, 1)));
        packet.setAttribute("class", `pkt ${reach ? "ok" : "bad"}`);
        wall.setAttribute("opacity", String(1 - open));
        const text = e < 0.5 ? (had ? po.join(" · ") : "no rule") : has ? pn.join(" · ") : "no rule";
        ui.set(rule, short(text, 70), short(text, 70));
        ui.say(reach ? "With the rule, the packet is passed on to the device." : "Without the rule the router stops the packet at the door.", reach ? "有規則嘅話，封包會交畀裝置。" : "冇規則嘅話，路由器喺門口攔住封包。");
      };
    },
  });
}

// ---- firewall decisions ------------------------------------------------------------------------------------------------------

function firewallScene(data) {
  const oldOn = truthy(data.old);
  const newOn = truthy(data.new);
  const samples = [["A website you open", "你打開嘅網站", true], ["Someone pings the router", "有人 ping 路由器", false], ["Someone tries to log in from outside", "有人由外面試登入", false]];
  return scene("firewall", data, {
    summary: { en: `${data.name.en} goes from ${oldOn ? "on" : "off"} to ${newOn ? "on" : "off"}. Three example packets show who gets in.`, zh: `${data.name.yue}由${oldOn ? "開" : "關"}變成${newOn ? "開" : "關"}。三個例子睇邊個入到嚟。` },
    label: { en: "Firewall decisions before and after", zh: "防火牆決定改動前後" },
    view: [640, 280],
    build(ui) {
      const { svg } = ui;
      frame(svg, 640, 280);
      const rows = samples.map(([en, zh, always], i) => {
        const y = 50 + i * 68;
        box(svg, 40, y, 560, 52);
        ui.txt(svg, { x: 60, y: y + 31, class: "s-text" }, en, zh);
        const verdict = s("rect", { x: 450, y: y + 10, width: 130, height: 32, rx: 16, class: "f-ok" });
        svg.append(verdict);
        const word = ui.txt(svg, { x: 515, y: y + 32, class: "s-sm s-mid s-b on-primary" }, "Allowed", "放行");
        return { always, verdict, word };
      });
      return (p, e) => {
        const on = lerp(oldOn ? 1 : 0, newOn ? 1 : 0, e) > 0.5;
        for (const r of rows) {
          const pass = r.always || !on;
          r.verdict.setAttribute("class", pass ? "f-ok" : "f-err");
          ui.set(r.word, pass ? "Allowed" : "Blocked", pass ? "放行" : "攔住");
        }
        ui.say(on ? "Protection is on: outside tries are stopped, your own traffic still flows." : "Protection is off: the outside can reach the router.", on ? "保護已開：外面嘅嘗試會被攔住，你自己嘅流量照常。" : "保護已關：外面可以接觸到路由器。");
      };
    },
  });
}

// ---- QoS queues -----------------------------------------------------------------------------------------------------------------

function qosScene(data) {
  const a = nums(data.old).slice(0, 5);
  const b = nums(data.new).slice(0, 5);
  const count = Math.max(a.length, b.length, 1);
  return scene("qos", data, {
    summary: { en: "Each bar is one queue or limit, taken from the old and new values. Taller means more of the line.", zh: "每條棒係一個隊列或者上限，數字來自舊值同新值。愈高代表佔用愈多頻寬。" },
    label: { en: "Speed priority queues before and after", zh: "速度優先隊列改動前後" },
    view: [640, 280],
    build(ui) {
      const { svg } = ui;
      frame(svg, 640, 280);
      const top = Math.max(1, ...a, ...b);
      const w = 560 / count;
      const bars = Array.from({ length: count }, (_, i) => {
        const r = s("rect", { x: 50 + i * w + 8, y: 230, width: w - 16, height: 0, rx: 10, class: "f-primary" });
        const g = s("rect", { x: 50 + i * w + 8, y: 230, width: w - 16, height: 0, rx: 10, class: "f-muted" });
        svg.append(g, r);
        ui.txt(svg, { x: 50 + i * w + w / 2, y: 252, class: "s-sm s-mu s-mid" }, `Queue ${i + 1}`, `隊列 ${i + 1}`);
        return { r, g };
      });
      return (p, e) => {
        bars.forEach(({ r, g }, i) => {
          const av = a[i] ?? 0;
          const bv = b[i] ?? 0;
          const hh = (v) => (v / top) * 170;
          g.setAttribute("height", hh(av)); g.setAttribute("y", 230 - hh(av));
          const cur = lerp(av, bv, e);
          r.setAttribute("height", hh(cur)); r.setAttribute("y", 230 - hh(cur));
        });
        ui.say("The grey ghost bars are the old values. The blue ones move to the new values.", "灰色殘影係舊值，藍色棒會移去新值。");
      };
    },
  });
}

// ---- VPN routing ---------------------------------------------------------------------------------------------------------------------

function vpnScene(data) {
  const oldOn = truthy(data.old) || (String(data.old ?? "").length > 0 && !isFlag(data.old, data.old));
  const newOn = truthy(data.new) || (String(data.new ?? "").length > 0 && !isFlag(data.new, data.new));
  return scene("vpn", data, {
    summary: { en: `Traffic goes ${oldOn ? "through the VPN" : "straight out"} now and ${newOn ? "through the VPN" : "straight out"} after the change.`, zh: `流量而家${oldOn ? "經 VPN" : "直接出去"}，改動後${newOn ? "經 VPN" : "直接出去"}。` },
    label: { en: "VPN routing before and after", zh: "VPN 路由改動前後" },
    view: [640, 280],
    build(ui) {
      const { svg } = ui;
      frame(svg, 640, 280);
      for (const [en, zh, cx, cy] of [["Devices", "裝置", 80, 140], ["Router", "路由器", 280, 140], ["Internet", "互聯網", 560, 60], ["VPN provider", "VPN 供應商", 560, 220]]) {
        svg.append(s("circle", { cx, cy, r: 34, class: "s-box" }));
        ui.txt(svg, { x: cx, y: cy + 56, class: "s-sm s-mid s-b" }, en, zh);
      }
      svg.append(s("path", { d: "M114 140 H246", class: "wire strong" }));
      const direct = s("path", { d: "M312 128 C 420 100 470 70 526 62", class: "wire" });
      const tunnel = s("path", { d: "M312 152 C 420 190 470 214 526 220", class: "wire tunnel" });
      svg.append(direct, tunnel);
      const dot = s("circle", { r: 8, class: "pkt" });
      svg.append(dot);
      return (p, e) => {
        const vpn = lerp(oldOn ? 1 : 0, newOn ? 1 : 0, e);
        direct.setAttribute("opacity", String(1 - vpn * 0.7)); tunnel.setAttribute("opacity", String(0.3 + vpn * 0.7));
        const t = (p * 3) % 1;
        const path = vpn > 0.5 ? tunnel : direct;
        const len = path.getTotalLength();
        const pt = path.getPointAtLength(t * len);
        dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y);
        ui.say(vpn > 0.5 ? "Traffic takes the encrypted tunnel to the VPN provider." : "Traffic leaves straight to the internet.", vpn > 0.5 ? "流量走加密隧道去 VPN 供應商。" : "流量直接出去互聯網。");
      };
    },
  });
}

// ---- parental schedule ---------------------------------------------------------------------------------------------------------------

function parentalScene(data) {
  const slotsOf = (v) => scheduleOf(v);
  const so = slotsOf(data.old);
  const sn = slotsOf(data.new);
  const grid = (slots) => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(false));
    for (const sl of slots) {
      const days = sl.days.split("").map(Number);
      const from = Number(sl.from.slice(0, 2));
      const to = Number(sl.to.slice(0, 2)) || 24;
      for (const d of days.length ? days : [0, 1, 2, 3, 4, 5, 6]) for (let h2 = from; h2 < to; h2 += 1) if (g[d % 7]) g[d % 7][h2 % 24] = true;
    }
    return g;
  };
  const go = grid(so);
  const gn = grid(sn);
  return scene("parental", data, {
    summary: { en: "A week of hours. Filled squares are when the rule applies; the picture blends the old week into the new one.", zh: "一個星期嘅每個鐘數。有顏色嘅格代表規則生效時間，圖會由舊安排慢慢變成新安排。" },
    label: { en: "Weekly schedule before and after", zh: "每週時間表改動前後" },
    view: [640, 260],
    build(ui) {
      const { svg } = ui;
      frame(svg, 640, 260);
      const days = [["Sun", "日"], ["Mon", "一"], ["Tue", "二"], ["Wed", "三"], ["Thu", "四"], ["Fri", "五"], ["Sat", "六"]];
      const cells = [];
      days.forEach(([en, zh], d) => {
        ui.txt(svg, { x: 30, y: 60 + d * 26 + 16, class: "s-sm s-mu" }, en, zh);
        for (let hr = 0; hr < 24; hr += 1) {
          const c = s("rect", { x: 70 + hr * 22, y: 50 + d * 26, width: 20, height: 22, rx: 5, class: "cell f-muted" });
          svg.append(c);
          cells.push({ c, d, hr });
        }
      });
      ui.txt(svg, { x: 320, y: 246, class: "s-sm s-mu s-mid" }, "Hours of the day, 0 to 23", "每日鐘數，0 至 23");
      return (p, e) => {
        for (const { c, d, hr } of cells) {
          const v = lerp(go[d][hr] ? 1 : 0, gn[d][hr] ? 1 : 0, e);
          c.setAttribute("class", `cell ${v > 0.5 ? (go[d][hr] && gn[d][hr] ? "f-primary" : gn[d][hr] ? "f-ok" : "f-err") : go[d][hr] ? "f-err" : "f-muted"}`);
          c.setAttribute("opacity", String(v > 0.5 || go[d][hr] ? 1 : 0.55));
        }
        ui.say("Green squares are new times, red ones are times that no longer apply, blue ones stay the same.", "綠色格係新增時間，紅色格係唔再生效嘅時間，藍色格維持不變。");
      };
    },
  });
}

// ---- devices on the network map --------------------------------------------------------------------------------------------------------

function devicesScene(data) {
  const ips = (v) => String(v ?? "").match(/\d{1,3}(?:\.\d{1,3}){3}/g) ?? [];
  const io = ips(data.old);
  const inn = ips(data.new);
  const names = (v) => String(v ?? "").split(/[<>]/).filter((x) => x && !/^[0-9A-Fa-f:.]+$/.test(x)).slice(0, 4);
  return scene("devices", data, {
    summary: { en: `A device entry changes from "${short(data.old, 36)}" to "${short(data.new, 36)}".`, zh: `一項裝置設定由「${short(data.old, 36)}」改為「${short(data.new, 36)}」。` },
    label: { en: "Devices on the network before and after", zh: "網絡上嘅裝置改動前後" },
    view: [640, 280],
    build(ui) {
      const { svg } = ui;
      frame(svg, 640, 280);
      svg.append(s("circle", { cx: 320, cy: 140, r: 36, class: "f-primary" }));
      ui.txt(svg, { x: 320, y: 146, class: "s-sm s-mid s-b on-primary" }, "Router", "路由器");
      const spots = [[110, 70], [110, 210], [530, 70], [530, 210]];
      const nodes = spots.map(([x, y], i) => {
        const line = s("line", { x1: 320, y1: 140, x2: x, y2: y, class: "wire dev" });
        const dot = s("circle", { cx: x, cy: y, r: 22, class: "dev-c b5" });
        svg.append(line, dot);
        const label = ui.txt(svg, { x, y: y + 42, class: "s-sm s-mid", "data-maxw": 150 }, "", "");
        return { line, dot, label, i };
      });
      const oldList = io.length ? io : names(data.old);
      const newList = inn.length ? inn : names(data.new);
      return (p, e) => {
        nodes.forEach(({ line, dot, label, i }) => {
          const a = oldList[i];
          const b = newList[i];
          const present = lerp(a ? 1 : 0, b ? 1 : 0, e);
          dot.setAttribute("opacity", String(Math.max(present, 0.15)));
          line.setAttribute("opacity", String(Math.max(present, 0.1)));
          dot.setAttribute("class", `dev-c ${a && b ? (a === b ? "b5" : "b24") : b ? "b5" : "b0"}`);
          const text = e < 0.5 ? a : b;
          ui.set(label, text ? short(text, 18) : "", text ? short(text, 18) : "");
        });
        ui.say("Devices that appear are green, changed ones amber and removed ones fade.", "新增嘅裝置係綠色，有改動嘅係橙色，移除嘅會淡出。");
      };
    },
  });
}

const BUILDERS = { wifi: wifiScene, dhcp: dhcpScene, portforward: portScene, firewall: firewallScene, qos: qosScene, vpn: vpnScene, parental: parentalScene, devices: devicesScene, generic: genericScene };
export function buildScene(kind, data) {
  return (BUILDERS[kind] ?? genericScene)(data);
}
export const SCENE_KINDS = Object.keys(BUILDERS);
