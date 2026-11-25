// The two shared shell components every desktop board imports.
import { ic, page, TWEAKS } from './kit.mjs';
import { IC } from './icons.mjs';

// [id, English, Cantonese, file, icon, count, merlinOnly] ; a two-entry row is a section heading
export const NAV = [
  ['overview', 'Overview', '概覽', 'Main', 'home', 0], ['modes', 'One-click modes', '一㩒模式', 'Modes', 'bolt', 7], ['devices', 'Devices', '裝置', 'Devices', 'laptop', 31], ['wifi', 'Wi-Fi', 'Wi-Fi', 'WiFi', 'wifi', 0], ['aimesh', 'AiMesh', 'AiMesh', 'Mesh', 'mesh', 3],
  ['Network', '網絡'],
  ['internet', 'Internet', '互聯網', 'Network', 'globe', 0], ['lan', 'Local network', '本地網絡', 'Lan', 'route', 0], ['firewall', 'Firewall', '防火牆', 'Firewall', 'shield', 0], ['qos', 'Traffic priority', '流量優先', 'Qos', 'qos', 0], ['vpn', 'VPN', 'VPN', 'Vpn', 'lock', 0], ['parental', 'Parental controls', '家長控制', 'Parental', 'family', 0],
  ['Visual editors', '視覺編輯器'],
  ['edmap', 'Network map', '網絡圖', 'MapEditor', 'mesh', 0], ['edrules', 'Rule canvas', '規則畫布', 'RuleCanvas', 'fwd', 0], ['edsched', 'Paint schedules', '畫時間表', 'SchedulePaint', 'clock', 0], ['edprio', 'Priority board', '優先次序板', 'PriorityBoard', 'layers', 0], ['edspec', 'Channel spectrum', '頻道頻譜', 'Spectrum', 'pulse', 0], ['edports', 'Ports and VLAN', '端口同 VLAN', 'PortCanvas', 'server', 0], ['edvpn', 'VPN Director', 'VPN Director', 'VpnDirector', 'swap', 0, 1], ['eddhcp', 'Address map', '地址地圖', 'DhcpMap', 'grid', 0],
  ['Router', '路由器'],
  ['usb', 'USB and storage', 'USB 同儲存', 'Storage', 'usb', 0], ['tools', 'Logs and tools', '記錄同工具', 'Tools', 'term', 0], ['speedlab', 'Speed lab', '速度實驗室', 'SpeedLab', 'gauge', 0], ['utilities', 'Router utilities', '路由器工具', 'Utilities', 'wrench', 0], ['jobs', 'Scheduled jobs', '排程工作', 'Jobs', 'timer', 0], ['firmware', 'Firmware', '韌體', 'Firmware', 'chip', 1], ['system', 'System', '系統', 'System', 'gear', 0], ['backup', 'Backup and restore', '備份同還原', 'Backup', 'backup', 0], ['advanced', 'Advanced', '進階', 'Advanced', 'list', 0],
  ['App', '應用程式'],
  ['history', 'Change history', '變更記錄', 'Changes', 'history', 0], ['notifications', 'Notifications', '通知', 'Notifications', 'bell', 4], ['settings', 'Settings', '設定', 'Settings', 'sliders', 0], ['toolbox', 'Toolbox', '工具箱', 'Toolbox', 'box', 0], ['help', 'Help and docs', '說明同文件', 'Help', 'help', 0]
];
const PR = (w, h, extra) => Object.assign(extra, TWEAKS(w, h, null));
const HEAD = `const p = this.props || {};
    const lang = p.lang ?? 'en', role = p.role ?? 'owner', firmware = p.firmware ?? 'merlin', motion = p.motion ?? 'expressive';
    const accent = p.accent || '#4f5bd5';
    const dark = p.dark === true || p.dark === 'true' || p.dark === 1 || p.dark === '1';
    const T = (en, yue) => (en === yue || lang === 'en') ? en : lang === 'yue' ? yue : en + ' · ' + yue;
    const base = { accent, darkNum: dark ? 1 : 0, motionCls: motion === 'calm' ? 'calm' : motion === 'standard' ? 'std' : '' };`;
const NAVH = 1200;

export function rail() {
  const icons = {}; NAV.forEach(n => { if (n.length > 2) icons[n[4]] = IC[n[4]]; });
  const markup = `<nav class="mx rail {{motionCls}}" aria-label="{{navLabel}}" style="--accent:{{accent}};--dark:{{darkNum}}">
<div class="brandrow"><span class="logo">${ic('wifi', 24, 2.2)}</span><div class="brand">Material Asus Router<small>RT-AX86U · {{fwShort}}</small></div></div>
<a class="fab {{fabCls}}" href="Changes.dc.html" aria-label="{{review}}">${ic('pen', 22)}<span>{{review}}</span><sc-if value="{{hasPending}}" hint-placeholder-val="{{ true }}"><span class="badge">{{pending}}</span></sc-if></a>
<sc-for list="{{nav}}" as="n" hint-placeholder-count="12"><sc-if value="{{n.isSec}}" hint-placeholder-val="{{ false }}"><div class="navsec">{{n.label}}</div></sc-if><sc-if value="{{n.isItem}}" hint-placeholder-val="{{ true }}"><a class="{{n.cls}}" href="{{n.href}}" aria-current="{{n.cur}}"><svg class="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{n.d}}"/></svg><span>{{n.label}}</span><sc-if value="{{n.hasCt}}" hint-placeholder-val="{{ false }}"><span class="ct">{{n.ct}}</span></sc-if></a></sc-if></sc-for>
<div class="sp"></div>
<a class="navi" href="Deploy.dc.html">${ic('cube')}<span>{{deploy}}</span></a>
<div class="t2" style="padding:10px 14px 0">{{version}}</div>
</nav>`;
  const script = `class Component extends DCLogic {
  renderVals() {
    ${HEAD}
    const page = p.page || 'overview';
    const pending = Number(p.pending ?? 2) || 0;
    const I = ${JSON.stringify(icons)};
    const N = ${JSON.stringify(NAV)};
    const groups = []; let cur = { sec: null, items: [] }; groups.push(cur);
    N.forEach(r => { if (r.length === 2) { cur = { sec: r, items: [] }; groups.push(cur); } else cur.items.push(r); });
    let open = groups.findIndex(g => g.items.some(r => r[0] === page)); if (open <= 0) open = 1;
    const NN = [];
    groups.forEach((g, i) => { if (i === 0 || i === open) { if (g.sec) NN.push(g.sec); g.items.forEach(r => NN.push(r)); } else { const f = g.items[0]; NN.push([f[0] + '-group', g.sec[0], g.sec[1], f[3], f[4], g.items.length]); } });
    const nav = NN.map(r => r.length === 2 ? { isSec: true, isItem: false, label: T(r[0], r[1]) } : { isSec: false, isItem: true, label: T(r[1], r[2]) + (r[6] && firmware !== 'merlin' ? ' · ' + T('Merlin only', '只限 Merlin') : ''), href: r[3] + '.dc.html', d: I[r[4]], cls: 'navi' + (r[0] === page ? ' on' : '') + (r[6] && firmware !== 'merlin' ? ' dis' : ''), cur: r[0] === page ? 'page' : 'false', hasCt: r[5] > 0, ct: r[5] });
    return Object.assign(base, { nav, pending, hasPending: pending > 0, fabCls: pending > 0 && motion === 'expressive' ? 'hot' : '',
      navLabel: T('Main navigation', '主導覽'), review: role === 'viewer' ? T('Pending changes', '待套用變更') : T('Review changes', '檢視變更'),
      fwShort: firmware === 'merlin' ? 'Merlin 388.8_4' : T('Stock 388.24198', '原廠 388.24198'), deploy: T('Deploy assistant', '部署助手'), version: T('App 0.4.0 · design canvas', '應用程式 0.4.0 · 設計畫布') });
  }
}`;
  return page('Navigation rail', markup, PR(272, NAVH, { page: { editor: 'string', default: 'overview', section: 'Navigation' }, pending: { editor: 'number', default: 2, section: 'Navigation' } }), script);
}

export function topbar() {
  const markup = `<header class="mx topbar {{motionCls}}" style="--accent:{{accent}};--dark:{{darkNum}};background:transparent">
<div class="tb1"><h1>{{title}}</h1>
<button class="srch" aria-label="{{search}}">${ic('search', 20)}<span>{{search}}</span><kbd>Ctrl K</kbd></button>
<span class="tag pri">${ic('chip', 15, 2.2)}{{fw}}</span>
<a class="icb" href="Language.dc.html" aria-label="{{langLabel}}">${ic('lang')}</a>
<a class="icb" href="Notifications.dc.html" aria-label="{{bell}}">${ic('bell')}<span class="dotb">4</span></a>
<span class="who"><b>P</b>{{who}}</span></div>
<div class="tabs eq" role="tablist" aria-label="{{title}}" style="--cnt:{{cnt}};--idx:{{idx}};max-width:{{maxw}}"><sc-for list="{{tabs}}" as="tb" hint-placeholder-count="3"><button role="tab" aria-selected="{{tb.sel}}" onClick="{{tb.pick}}">{{tb.label}}</button></sc-for><i class="tind"></i></div>
</header>`;
  const script = `class Component extends DCLogic {
  renderVals() {
    ${HEAD}
    const s = this.state || {};
    const list = String(p.tabs || 'Overview').split(',');
    const idx = s.i ?? (Number(p.active) || 0);
    const tabs = list.map((label, i) => ({ label, sel: i === idx ? 'true' : 'false', pick: () => this.setState({ i }) }));
    return Object.assign(base, { title: p.title || 'Overview', tabs, cnt: list.length, idx, maxw: (list.length * 190) + 'px',
      search: T('Search everything', '搜尋所有嘢'), langLabel: T('Language', '語言'), bell: T('Notifications, 4 unread', '通知，4 則未讀'),
      fw: firmware === 'merlin' ? 'Asuswrt-Merlin' : T('Stock ASUS', '原廠 ASUS'),
      who: role === 'owner' ? T('Pat · Owner', 'Pat · 擁有人') : role === 'operator' ? T('Pat · Operator', 'Pat · 操作員') : T('Pat · Viewer', 'Pat · 檢視者') });
  }
}`;
  return page('Top bar', markup, PR(1168, 150, { title: { editor: 'string', default: 'Overview', section: 'Content' }, tabs: { editor: 'string', default: 'Overview,Traffic,Health', section: 'Content' }, active: { editor: 'number', default: 0, section: 'Content' } }), script);
}
