const fs=require('fs');
const PROJ=require('path').join(__dirname,'..','project');
const main=fs.readFileSync(PROJ+'/Main.dc.html','utf8');
const paths=[...main.matchAll(/<path d="(M[^"]{200,})"/g)].map(m=>m[1]);
const COOKIE=main.match(/class="cookie"[^>]*>\s*<svg viewBox="0 0 200 200"><path d="([^"]+)"/)[1];
const BLOB1=paths[1], BLOB2=paths[2], SCALLOP=paths[0];
const ic=(d,s=20,w=1.9)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const INFO=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 11v6M12 7.5h.01"/></svg>`;
const DOTS=`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>`;
const CHK=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const tile=(titleHole,id,tag='span class="k"',close='span')=>`<div class="tilehead"><${tag}>{{${titleHole}}}</${close}>
  <button class="info" aria-label="{{tips.${id}.label}}" aria-expanded="{{tips.${id}.on}}" onClick="{{tips.${id}.toggle}}">${INFO}</button>
  <button class="lock" aria-label="{{lk.${id}.label}}" aria-pressed="{{lk.${id}.pressed}}" onClick="{{lk.${id}.toggle}}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{lk.${id}.d}}"/></svg></button>
</div>
<sc-if value="{{tips.${id}.on}}" hint-placeholder-val="{{ false }}"><div class="tip" role="tooltip" style="top:52px;right:16px">{{tips.${id}.text}}</div></sc-if>`;
const h2tile=(titleHole,id)=>tile(titleHole,id,'h2 class="h2"','h2');
const COMMONCSS=`body{margin:0}
.onp{background:color-mix(in srgb,var(--on-primary) 18%,transparent);color:var(--on-primary)}
.card.ov{overflow:visible}
.cbw{width:44px;height:44px;border:0;background:none;display:grid;place-items:center;flex:none;padding:0}
.cb2{width:22px;height:22px;border-radius:7px;border:2px solid var(--sub);display:grid;place-items:center;color:var(--on-primary)}
.cb2 svg{opacity:0}
.cb2.on{background:var(--primary);border-color:var(--primary)}
.cb2.on svg{opacity:1}
.struck{text-decoration:line-through;opacity:.6}
.lockedcard{outline:3px solid var(--primary);outline-offset:-3px}
.tilehead{display:flex;align-items:center;gap:4px}
.tilehead .k,.tilehead .h2{flex:1}
.legend{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--sub)}
.legend i{width:12px;height:12px;border-radius:6px;display:inline-block}
.pos{position:relative}
.dis{opacity:.5;cursor:not-allowed}
.rng{width:100%;min-width:120px;height:44px;accent-color:var(--primary);margin:0}
.lbl{font-size:12.5px;font-weight:750;color:var(--sub);letter-spacing:.3px}
.sel{height:44px;border-radius:14px;border:1.5px solid var(--line);background:var(--surf);color:var(--text);font:inherit;font-size:14px;padding:0 12px}
.kbd{font:700 12px ui-monospace,Consolas,monospace;padding:3px 8px;border-radius:8px;background:var(--surf-high);color:var(--text)}
.sw[aria-pressed=true]{background:var(--primary);border-color:var(--primary)}
.sw[aria-pressed=true] i{left:26px;top:2px;width:24px;height:24px;border-radius:12px;background:#fff}
.seg button[aria-pressed=true],.seg .on{background:var(--surf);color:var(--text);box-shadow:var(--e1)}
.chip[aria-pressed=true]{background:var(--secondary-c);color:var(--on-secondary-c);border-color:transparent}
.rowbtn{display:flex;align-items:center;gap:14px;padding:12px 0;border:0;border-top:1px solid var(--line);background:none;color:var(--text);text-align:left;font:inherit;width:100%;min-height:44px}`;
const HEAD=(title,css)=>`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="theme.css">
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000&amp;display=swap" rel="stylesheet">
<style>
${COMMONCSS}
${css||''}
</style>
</helmet>
`;
const SHELL=(rail,titleHole,active,inner,extraMain='')=>`<div class="mx shell {{motionCls}}" style="--accent:{{accent}};--dark:{{darkNum}}">
  <div class="railwrap"><dc-import name="Rail" page="${rail}" lang="{{lang}}" role="{{role}}" firmware="{{firmware}}" pending="{{pendCount}}" accent="{{accent}}" dark="{{dark}}" hint-size="288px,900px"></dc-import></div>
  <div class="main">
    <dc-import name="TopBar" title="{{${titleHole}}}" lang="{{lang}}" role="{{role}}" firmware="{{firmware}}" tabs="{{tabsStr}}" active="${active}" accent="{{accent}}" dark="{{dark}}" hint-size="1152px,170px"></dc-import>
    <main class="page">
${inner}
    </main>
${extraMain}
  </div>
</div>
</x-dc>
`;
const PROPS=`{"accent":{"editor":"color","default":"#4f5bd5","options":["#4f5bd5","#00897b","#d81b60","#f4511e","#7c4dff"],"section":"Look"},"dark":{"editor":"boolean","default":false,"section":"Look"},"motion":{"editor":"enum","options":["calm","standard","expressive"],"default":"expressive","section":"Look"},"firmware":{"editor":"enum","options":["merlin","stock"],"default":"merlin","section":"Router"},"role":{"editor":"enum","options":["owner","operator","viewer"],"default":"owner","section":"Router"},"lang":{"editor":"enum","options":["en","yue","both"],"default":"en","section":"Language"},"$preview":{"width":1440,"height":900}}`;
const PRE=`
    const p = this.props;
    const s = this.state || {};
    const lang = p.lang ?? 'en';
    const role = p.role ?? 'owner';
    const firmware = p.firmware ?? 'merlin';
    const motion = p.motion ?? 'expressive';
    const accent = p.accent || '#4f5bd5';
    const dark = p.dark === true || p.dark === 'true' || p.dark === 1 || p.dark === '1';
    const T = (en, yue) => lang === 'en' ? en : lang === 'yue' ? yue : en + ' · ' + yue;
    const canWrite = role !== 'viewer';
    const set = (o) => this.setState(o);
    const tg = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : arr.concat([v]);
    const num = (e, d) => { const v = e && e.target ? parseFloat(e.target.value) : NaN; return isNaN(v) ? d : v; };
    const txt = (e) => e && e.target ? String(e.target.value) : '';
    const locks = s.locks || [];
    const tipOn = s.tip || '';
    const mk = (defs) => {
      const lk = {}, tips = {}, cc = {};
      Object.keys(defs).forEach(id => {
        const on = locks.includes(id);
        lk[id] = { d: on ? 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4' : 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 7.5-2', pressed: on ? 'true' : 'false',
          label: (on ? T('Unlock ', '解鎖 ') : T('Lock ', '鎖定 ')) + defs[id][0], toggle: () => set({ locks: tg(locks, id) }) };
        tips[id] = { label: T('About ', '關於 ') + defs[id][0], text: defs[id][1], on: tipOn === id, toggle: () => set({ tip: tipOn === id ? '' : id }) };
        cc[id] = on ? 'lockedcard' : '';
      });
      return { lk, tips, cc };
    };
    const base = (tabs) => ({ accent, dark, darkNum: dark ? 1 : 0, lang, role, firmware, motionCls: motion === 'calm' ? 'calm' : motion === 'standard' ? 'std' : '', pendCount: 2, viewer: !canWrite, tabsStr: tabs.map(x => x.replace(/,/g, ' ')).join(',') });
    const D = { bell: 'M6 9a6 6 0 0 1 12 0c0 6 2 7 2 8H4c0-1 2-2 2-8 M10 20a2 2 0 0 0 4 0', check: 'M5 12.5l4.5 4.5L19 7.5', x: 'M6 6l12 12M18 6L6 18', warn: 'M12 4l9 16H3z M12 10v4 M12 17.5h.01',
      info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 8h.01', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', wifi: 'M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h.01',
      dl: 'M12 4v11M7 10l5 5 5-5M4 19h16', ul: 'M12 20V9M7 14l5-5 5 5M4 5h16', lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4', search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z M21 21l-4.3-4.3', trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
      clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2', play: 'M7 5l12 7-12 7z', refresh: 'M20 12a8 8 0 1 1-2.5-5.8 M20 4v5h-5', device: 'M4 5h16v11H4z M8 20h8 M12 16v4', bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
      globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18', palette: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.5-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z', key: 'M15 8a4 4 0 1 1-3.5 6L4 21v-3l2-2v-2l2-1 3.5-3.5A4 4 0 0 1 15 8z',
      plus: 'M12 5v14M5 12h14', copy: 'M9 9h11v11H9z M5 15V4h11', up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M5 11a7 7 0 0 0 14 0 M12 18v3',
      sound: 'M4 9v6h4l5 4V5L8 9z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11', moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z', box: 'M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5 M12 13v8',
      gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
      list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', tool: 'M14 6a4 4 0 0 0 5 5l-9 9-4-4 9-9a4 4 0 0 0-1-1z', route: 'M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M9 16h5a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h4', menu: 'M4 7h16M4 12h16M4 17h16', ticket: 'M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z M13 6v12', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c1-4 4-6 8-6s7 2 8 6' };
`;
const wrapScript=(body)=>`<script type="text/x-dc" data-dc-script data-props='${PROPS}'>
class Component extends DCLogic {
  renderVals() {${PRE}
${body}
  }
}
</script>
</body>
</html>
`;
const write=(name,html)=>{fs.writeFileSync(PROJ+'/'+name,html);};
module.exports={COOKIE,BLOB1,BLOB2,SCALLOP,ic,INFO,DOTS,CHK,tile,h2tile,HEAD,SHELL,wrapScript,write,PROPS,PROJ};
