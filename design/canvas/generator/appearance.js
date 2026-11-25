const C=require('./common.js');
const {ic,INFO,DOTS,CHK,tile,h2tile,HEAD,SHELL,wrapScript,COOKIE,BLOB1,BLOB2,SCALLOP}=C;

const css=`.axp1{animation:axp1 var(--d) var(--e) var(--dl) both}
.axp2{animation:axp2 var(--d) var(--e) var(--dl) both}
.axp0{animation:none}
@keyframes axp1{from{opacity:0;transform:translateY(var(--dy)) scale(var(--sc))}}
@keyframes axp2{from{opacity:0;transform:translateY(var(--dy)) scale(var(--sc))}}
.swatch{width:44px;height:44px;border-radius:14px;border:2px solid var(--line);flex:none;padding:0}
.swatch[aria-pressed=true]{outline:3px solid var(--link);outline-offset:2px}
.elbtn{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:0 14px;border:0;border-radius:16px;background:transparent;color:var(--text);font:650 14.5px var(--font);text-align:left}
.elbtn:hover{background:var(--surf-high)}
.elbtn[aria-pressed=true]{background:var(--secondary-c);color:var(--on-secondary-c)}
.pvstage{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;padding:20px;border-radius:28px;background:var(--surf-low);border:1px solid var(--line)}
.pvcell{position:relative;display:flex;flex-direction:column;gap:8px;align-items:flex-start;border:0;background:transparent;padding:10px;border-radius:20px;color:var(--text);font:inherit;text-align:left}
.pvcell[aria-pressed=true]{outline:3px dashed var(--primary);outline-offset:0}
.plane{display:grid;grid-template-columns:repeat(14,1fr);gap:3px}
.plane button{height:26px;border:0;border-radius:6px;padding:0}
.huestrip{display:grid;grid-template-columns:repeat(24,1fr);gap:2px}
.huestrip button{height:30px;border:0;border-radius:8px;padding:0}
.trow{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line)}
.trow:first-of-type{border-top:0}
.trow .mono{flex:1;font-size:14px;overflow-wrap:anywhere}
.trow .lb{width:56px;font-size:12px;font-weight:750;color:var(--sub)}
.prev{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.kt{width:100%;border-collapse:collapse}
.kt td{padding:4px 6px;border-top:1px solid var(--line)}
.kind{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;padding:4px 10px 4px 14px;border:0;border-radius:16px;background:transparent;color:var(--text);font:inherit;text-align:left}
.kind[aria-pressed=true]{background:var(--secondary-c);color:var(--on-secondary-c)}
.kind .n{flex:1;font-weight:650;font-size:14.5px}
.kind .m{font:600 12px ui-monospace,Consolas,monospace;opacity:.8}
.mini{display:inline-block;width:10px;height:10px;border-radius:5px;background:var(--sub)}
pre.json{margin:0;padding:16px;border-radius:20px;background:var(--surf-low);font:12.5px/1.55 ui-monospace,Consolas,monospace;max-height:260px;overflow:auto;white-space:pre-wrap;color:var(--text)}
textarea.json{width:100%;min-height:200px;border-radius:20px;border:1.5px solid var(--line);background:var(--surf);color:var(--text);padding:14px;font:12.5px/1.5 ui-monospace,Consolas,monospace;resize:vertical}
.lgrid{display:flex;gap:16px;flex-wrap:wrap;align-items:center}
.logo-big{width:132px;height:132px;display:inline-grid;place-items:center;flex:none}
.logo-big svg.sh{grid-area:1/1;width:100%;height:100%;fill:currentColor}
.logo-big .gl{grid-area:1/1}`;

let html=HEAD('Appearance and motion editor',css);

const rangeRow=(label,hole,val,min,max,step,setter,unit)=>`<div><div class="cols"><label class="lbl grow" for="${hole}">{{${label}}}</label><span class="mono lbl">{{${val}}}${unit||''}</span></div><input id="${hole}" class="rng" type="range" min="${min}" max="${max}" step="${step}" value="{{${val}}}" onInput="{{${setter}}}"></div>`;

const inner=`
      <section class="card hero rise" aria-label="{{t.heroLabel}}" style="min-height:230px">
        <svg class="deco a" viewBox="0 0 200 200" aria-hidden="true" style="right:-70px;top:-90px;width:340px;height:340px"><path d="${SCALLOP}"/></svg>
        <svg class="deco b" viewBox="0 0 200 200" aria-hidden="true" style="right:300px;bottom:-130px;width:260px;height:260px"><path d="${BLOB2}"/></svg>
        <div class="cookie" style="position:absolute;right:70px;top:46px;width:128px;height:128px;color:var(--tertiary-c)" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--on-tertiary-c)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:54px;height:54px;grid-area:1/1;fill:none"><path d="{{d.palette}}"/></svg></div>
        <div style="position:relative;display:flex;flex-wrap:wrap;gap:8px"><span class="tag onp">{{t.chipLive}}</span><span class="tag onp">{{t.chipSync}}</span></div>
        <h1 class="disp" style="position:relative;max-width:15ch">{{t.headline}}</h1>
        <p class="lede" style="position:relative;color:color-mix(in srgb,var(--on-primary) 86%,transparent)">{{t.lede}}</p>
        <div class="cols" style="position:relative;margin-top:6px">
          <div class="seg" role="group" aria-label="{{t.profile}}" style="background:color-mix(in srgb,var(--on-primary) 18%,transparent)"><sc-for list="{{profiles}}" as="o" hint-placeholder-count="4"><button aria-pressed="{{o.pressed}}" onClick="{{o.pick}}" style="color:inherit">{{o.label}}</button></sc-for></div>
          <button class="btn sm" style="background:var(--surf);color:var(--text)" onClick="{{exportNow}}">${ic('M12 4v11M7 10l5 5 5-5M4 19h16',18)}{{t.exportJson}}</button>
          <button class="btn sm" style="background:var(--surf);color:var(--text)" onClick="{{scrollImport}}">${ic('M12 20V9M7 14l5-5 5 5M4 5h16',18)}{{t.importJson}}</button>
        </div>
      </section>

      <section class="card sec rise {{cc.rm}}" aria-label="{{t.rmTitle}}">
        <div class="cols">
          <span class="cookie" style="width:48px;height:48px;color:var(--secondary-c);filter:brightness(.92)" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;grid-area:1/1;fill:none;color:var(--on-secondary-c)"><path d="{{d.eye}}"/></svg></span>
          <div class="grow" style="min-width:240px"><div class="tilehead"><b class="t1" style="flex:1">{{t.rmTitle}}</b><button class="info" aria-label="{{tips.rm.label}}" aria-expanded="{{tips.rm.on}}" onClick="{{tips.rm.toggle}}">${INFO}</button><button class="lock" aria-label="{{lk.rm.label}}" aria-pressed="{{lk.rm.pressed}}" onClick="{{lk.rm.toggle}}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{lk.rm.d}}"/></svg></button></div>
            <div class="muted" style="color:inherit;opacity:.88">{{t.rmSub}}</div></div>
          <label class="cols" style="gap:10px"><span class="t1">{{t.rmSim}}</span><button class="sw" role="switch" aria-pressed="{{rmP}}" aria-label="{{t.rmSim}}" onClick="{{toggleRm}}"><i></i></button></label>
          <span class="tag {{rmTagCls}}">{{rmTag}}</span>
        </div>
        <sc-if value="{{tips.rm.on}}" hint-placeholder-val="{{ false }}"><div class="tip" role="tooltip" style="top:60px;right:20px">{{tips.rm.text}}</div></sc-if>
      </section>

      <div class="dash">
        <section class="card ov rise {{cc.el}}" aria-label="{{t.elTitle}}">
          ${h2tile('t.elTitle','el')}
          <div class="muted">{{t.elSub}}</div>
          <div role="group" aria-label="{{t.elTitle}}" style="display:flex;flex-direction:column;gap:2px">
            <sc-for list="{{els}}" as="e" hint-placeholder-count="7"><button class="elbtn" aria-pressed="{{e.pressed}}" onClick="{{e.pick}}"><span style="width:22px;height:22px;border-radius:7px;flex:none;{{e.sw}}"></span>{{e.label}}<span class="sp"></span><span class="area-note mono">{{e.sum}}</span></button></sc-for>
          </div>
          <div class="sample" style="margin-top:auto;padding:14px 16px;border-radius:20px;background:var(--surf-low)"><span class="k">{{t.tipK}}</span><div class="muted" style="margin-top:4px">{{t.tipText}}</div></div>
          <button class="btn o sm" style="align-self:flex-start" onClick="{{resetAllEls}}">{{t.resetEls}}</button>
        </section>
        <section class="card span2 ov rise {{cc.pv}}" aria-label="{{t.pvTitle}}">
          ${h2tile('t.pvTitle','pv')}
          <div class="pvstage" role="group" aria-label="{{t.pvTitle}}">
            <button class="pvcell" aria-pressed="{{pvp.card}}" aria-label="{{t.editCard}}" onClick="{{pick.card}}"><span class="k">{{t.elCard}}</span><div style="{{pv.card}}"><div style="font-weight:750">{{t.sampleCardTitle}}</div><div style="opacity:.8;font-size:.86em">{{t.sampleCardSub}}</div></div></button>
            <button class="pvcell" aria-pressed="{{pvp.button}}" aria-label="{{t.editButton}}" onClick="{{pick.button}}"><span class="k">{{t.elButton}}</span><span style="{{pv.button}}">{{t.sampleBtn}}</span></button>
            <button class="pvcell" aria-pressed="{{pvp.chip}}" aria-label="{{t.editChip}}" onClick="{{pick.chip}}"><span class="k">{{t.elChip}}</span><span style="{{pv.chip}}">Wi-Fi 6</span></button>
            <button class="pvcell" aria-pressed="{{pvp.switch}}" aria-label="{{t.editSwitch}}" onClick="{{pick.switch}}"><span class="k">{{t.elSwitch}}</span><span style="{{pv.switch}}"><i style="{{pv.knob}}"></i></span></button>
            <button class="pvcell" aria-pressed="{{pvp.tab}}" aria-label="{{t.editTab}}" onClick="{{pick.tab}}"><span class="k">{{t.elTab}}</span><span style="{{pv.tab}}">${ic('M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h.01',16)}&nbsp;{{t.sampleTab}}</span></button>
            <button class="pvcell" aria-pressed="{{pvp.input}}" aria-label="{{t.editInput}}" onClick="{{pick.input}}"><span class="k">{{t.elInput}}</span><span style="{{pv.input}}">198.51.100.1</span></button>
            <button class="pvcell" aria-pressed="{{pvp.toast}}" aria-label="{{t.editToast}}" onClick="{{pick.toast}}" style="grid-column:1/-1"><span class="k">{{t.elToast}}</span><div style="{{pv.toast}}">${ic('M5 12.5l4.5 4.5L19 7.5',20,2.4)}<span>{{t.sampleToast}}</span></div></button>
          </div>
          <div class="muted">{{t.editing}}: <b>{{edLabel}}</b></div>
          <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
            <div><div class="lbl" style="margin-bottom:6px">{{t.role}}</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap" role="group" aria-label="{{t.role}}"><sc-for list="{{roles}}" as="r" hint-placeholder-count="5"><button class="swatch" aria-pressed="{{r.pressed}}" aria-label="{{r.label}}" title="{{r.label}}" style="{{r.style}}" onClick="{{r.pick}}"></button></sc-for></div></div>
            ${rangeRow('t.radius','radius','ed.r',0,40,1,'ed.setR',' px')}
            ${rangeRow('t.size','size','ed.size',70,140,1,'ed.setSize',' %')}
            ${rangeRow('t.spacing','spacing','ed.pad',2,32,1,'ed.setPad',' px')}
            ${rangeRow('t.elev','elev','ed.elev',0,3,1,'ed.setElev','')}
            <div class="cols" style="align-self:end"><button class="btn t sm" onClick="{{useColour}}">{{t.useColour}}</button><button class="btn o sm" onClick="{{resetEl}}">{{t.resetEl}}</button></div>
          </div>
        </section>
      </div>

      <div class="dash">
        <section class="card span2 ov rise {{cc.pick}}" aria-label="{{t.pickTitle}}">
          ${h2tile('t.pickTitle','pick')}
          <div class="muted">{{t.pickSub}}</div>
          <div class="cols" style="align-items:stretch;gap:20px">
            <div style="flex:1 1 360px;min-width:0;display:flex;flex-direction:column;gap:10px">
              <div class="plane" role="group" aria-label="{{t.plane}}"><sc-for list="{{plane}}" as="c" hint-placeholder-count="14"><button style="{{c.style}}" aria-label="{{c.label}}" onClick="{{c.pick}}"></button></sc-for></div>
              <div class="huestrip" role="group" aria-label="{{t.hueStrip}}"><sc-for list="{{hues}}" as="c" hint-placeholder-count="24"><button style="{{c.style}}" aria-label="{{c.label}}" onClick="{{c.pick}}"></button></sc-for></div>
              ${rangeRow('t.light','lgt','pk.L',0,100,1,'pk.setL',' %')}
              ${rangeRow('t.chroma','chr','pk.C',0,40,1,'pk.setC','')}
              ${rangeRow('t.hue','hue','pk.H',0,360,1,'pk.setH',' °')}
            </div>
            <div style="flex:1 1 320px;min-width:0">
              <div style="height:112px;border-radius:24px;display:flex;align-items:flex-end;padding:14px;font-weight:800;font-size:20px;font-stretch:90%;{{pk.swatchStyle}}">{{pk.hex}}</div>
              <div class="cols" style="margin:10px 0 4px"><span class="tag {{pk.aaCls}}">{{pk.aa}}</span><span class="tag">{{pk.cw}}</span><sc-if value="{{pk.clipped}}" hint-placeholder-val="{{ false }}"><span class="tag warn">{{t.clipped}}</span></sc-if></div>
              <sc-for list="{{pk.rows}}" as="r" hint-placeholder-count="5"><div class="trow"><span class="lb">{{r.k}}</span><span class="mono">{{r.v}}</span><button class="btn t sm" onClick="{{r.copy}}" aria-label="{{r.copyLabel}}">{{r.copyText}}</button></div></sc-for>
              <div class="trow"><label class="lb" for="hexin" style="width:84px">{{t.typeHex}}</label><input id="hexin" class="field mono" style="flex:1;height:44px" value="{{pk.hex}}" onChange="{{pk.typed}}"><sc-if value="{{pk.hasHexMsg}}" hint-placeholder-val="{{ false }}"><span class="tag {{pk.hexCls}}">{{pk.hexMsg}}</span></sc-if></div>
            </div>
          </div>
          <div class="lbl" style="margin-top:6px">{{t.liveAccent}}</div>
          <div class="mx prev" style="--accent:{{pk.hex}};--dark:{{darkNum}};padding:16px;border-radius:24px;border:1px solid var(--line)">
            <button class="btn f sm">{{t.sampleBtn}}</button><button class="btn t sm">{{t.sampleTonal}}</button><span class="chip on">Wi-Fi 6</span><span class="tag good">{{t.sampleOk}}</span>
            <span class="meter" style="width:140px"><i style="width:68%"></i></span><span class="pill p">${ic('M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h.01',16)}RT-AX86U</span>
          </div>
        </section>

        <section class="card ov rise {{cc.logo}}" aria-label="{{t.logoTitle}}">
          ${h2tile('t.logoTitle','logo')}
          <div class="muted">{{t.logoSub}}</div>
          <div class="lgrid">
            <span class="logo-big" aria-hidden="true" style="{{logo.style}}"><svg class="sh" viewBox="0 0 200 200"><path d="{{logo.shape}}"/></svg><svg class="gl" viewBox="0 0 24 24" fill="none" stroke="{{logo.fg}}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="{{logo.glStyle}}"><path d="{{logo.glyph}}"/></svg></span>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div class="prev" aria-label="{{t.logoSizes}}">
                <span class="logo-big" aria-hidden="true" style="width:64px;height:64px;{{logo.style}}"><svg class="sh" viewBox="0 0 200 200"><path d="{{logo.shape}}"/></svg><svg class="gl" viewBox="0 0 24 24" fill="none" stroke="{{logo.fg}}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="width:50%;height:50%"><path d="{{logo.glyph}}"/></svg></span>
                <span class="logo-big" aria-hidden="true" style="width:32px;height:32px;{{logo.style}}"><svg class="sh" viewBox="0 0 200 200"><path d="{{logo.shape}}"/></svg><svg class="gl" viewBox="0 0 24 24" fill="none" stroke="{{logo.fg}}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:56%;height:56%"><path d="{{logo.glyph}}"/></svg></span>
                <span class="logo-big" aria-hidden="true" style="width:16px;height:16px;color:var(--text)"><svg class="sh" viewBox="0 0 200 200"><path d="{{logo.shape}}"/></svg></span>
              </div>
              <div class="pill" style="align-self:flex-start"><span class="logo-big" aria-hidden="true" style="width:24px;height:24px;{{logo.style}}"><svg class="sh" viewBox="0 0 200 200"><path d="{{logo.shape}}"/></svg></span>{{logo.name}}</div>
            </div>
          </div>
          <div><div class="lbl" style="margin-bottom:6px">{{t.logoShape}}</div><div class="seg" role="group" aria-label="{{t.logoShape}}"><sc-for list="{{logoShapes}}" as="o" hint-placeholder-count="4"><button aria-pressed="{{o.pressed}}" onClick="{{o.pick}}">{{o.label}}</button></sc-for></div></div>
          <div><div class="lbl" style="margin-bottom:6px">{{t.logoGlyph}}</div><div class="seg" role="group" aria-label="{{t.logoGlyph}}"><sc-for list="{{logoGlyphs}}" as="o" hint-placeholder-count="4"><button aria-pressed="{{o.pressed}}" onClick="{{o.pick}}">{{o.label}}</button></sc-for></div></div>
          ${rangeRow('t.logoScale','lsc','logo.scale',60,110,1,'logo.setScale',' %')}
          <div class="cols"><label class="lbl" for="lname">{{t.logoName}}</label><input id="lname" class="field" style="flex:1;height:44px" value="{{logo.name}}" onInput="{{logo.setName}}"></div>
          <div class="cols"><button class="btn t sm" onClick="{{logo.export}}">{{t.logoExport}} SVG</button><button class="btn t sm" onClick="{{logo.export}}">PNG</button><button class="btn t sm" onClick="{{logo.export}}">ICO</button><sc-if value="{{logo.exported}}" hint-placeholder-val="{{ false }}"><span class="tag good">{{t.logoExported}}</span></sc-if></div>
          <div class="cols"><label class="cols" style="gap:10px"><span class="t1">{{t.logoPick}}</span><button class="sw" role="switch" aria-pressed="{{logo.usePickP}}" aria-label="{{t.logoPick}}" onClick="{{logo.togglePick}}"><i></i></button></label></div>
        </section>
      </div>

      <section class="card ov rise {{cc.anim}}" aria-label="{{t.animTitle}}">
        <div class="cols">
          <div class="grow" style="min-width:240px">${h2tile('t.animTitle','anim')}<div class="muted">{{t.animSub}}</div></div>
          <label class="cols" style="gap:10px"><span class="t1">{{t.master}}</span><button class="sw" role="switch" aria-pressed="{{masterP}}" aria-label="{{t.master}}" onClick="{{toggleMaster}}"><i></i></button></label>
          <button class="btn o sm" onClick="{{resetAll}}">{{t.resetAll}}</button>
        </div>
        <div class="cols" style="gap:20px">
          <div style="flex:1 1 280px;min-width:240px"><div class="cols"><label class="lbl grow" for="spd">{{t.speed}}</label><span class="mono lbl">{{speedText}}</span></div><input id="spd" class="rng" type="range" min="0.25" max="2" step="0.05" value="{{speed}}" onInput="{{setSpeed}}"></div>
          <div class="seg" role="group" aria-label="{{t.profile}}"><sc-for list="{{profiles}}" as="o" hint-placeholder-count="4"><button aria-pressed="{{o.pressed}}" onClick="{{o.pick}}">{{o.label}}</button></sc-for></div>
        </div>
        <div class="cols" style="align-items:flex-start;gap:20px">
          <div role="group" aria-label="{{t.kinds}}" style="flex:1 1 300px;min-width:260px;max-width:430px;display:flex;flex-direction:column;gap:2px">
            <sc-for list="{{kinds}}" as="k" hint-placeholder-count="14"><button class="kind" aria-pressed="{{k.pressed}}" onClick="{{k.pick}}"><span class="mini" style="{{k.dotStyle}}"></span><span class="n">{{k.label}}</span><span class="m">{{k.sum}}</span></button></sc-for>
          </div>
          <div style="flex:2 1 420px;min-width:0;display:flex;flex-direction:column;gap:14px">
            <div class="cols"><h3 class="h2 grow" style="font-size:19px;margin:0">{{kd.label}}</h3><label class="cols" style="gap:10px"><span class="t1">{{t.kindOn}}</span><button class="sw" role="switch" aria-pressed="{{kd.onP}}" aria-label="{{t.kindOn}}" onClick="{{kd.toggle}}"><i></i></button></label><button class="btn f sm" onClick="{{play}}">${ic('M7 5l12 7-12 7z',18)}{{t.play}}</button></div>
            <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;padding:20px;border-radius:24px;background:var(--surf-low);min-height:120px;overflow:hidden" aria-label="{{t.previewOf}}">
              <sc-for list="{{kd.boxes}}" as="b" hint-placeholder-count="3"><div class="{{b.cls}}" style="{{b.style}}"><b>{{b.label}}</b><span class="muted">{{kd.label}}</span></div></sc-for>
            </div>
            <sc-if value="{{rmP2}}" hint-placeholder-val="{{ false }}"><div class="tag warn" style="align-self:flex-start">{{t.rmStopped}}</div></sc-if>
            <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
              ${rangeRow('t.dur','kdur','kd.dur',0,1500,10,'kd.setDur',' ms')}
              ${rangeRow('t.delay','kdel','kd.delay',0,800,10,'kd.setDelay',' ms')}
              ${rangeRow('t.stagger','kstg','kd.stagger',0,150,5,'kd.setStagger',' ms')}
              ${rangeRow('t.dist','kdis','kd.dist',0,60,1,'kd.setDist',' px')}
              ${rangeRow('t.scale','ksc','kd.scale',0.8,1.1,0.01,'kd.setScale','')}
            </div>
            <div class="cols" style="align-items:flex-start;gap:20px">
              <div style="display:flex;flex-direction:column;gap:8px">
                <div class="lbl">{{t.curve}}</div>
                <svg viewBox="-12 -12 184 184" width="190" height="190" role="img" aria-label="{{kd.curveAlt}}" style="background:var(--surf-low);border-radius:20px;flex:none">
                  <rect x="0" y="0" width="160" height="160" fill="none" stroke="var(--line)"/>
                  <line x1="0" y1="160" x2="160" y2="0" stroke="var(--line)" stroke-dasharray="4 4"/>
                  <line x1="0" y1="160" x2="{{kd.hx1}}" y2="{{kd.hy1}}" stroke="var(--tertiary)" stroke-width="2"/><line x1="160" y1="0" x2="{{kd.hx2}}" y2="{{kd.hy2}}" stroke="var(--tertiary)" stroke-width="2"/>
                  <path d="{{kd.curve}}" fill="none" stroke="var(--primary)" stroke-width="4" stroke-linecap="round"/>
                  <circle cx="{{kd.hx1}}" cy="{{kd.hy1}}" r="7" fill="var(--tertiary)"/><circle cx="{{kd.hx2}}" cy="{{kd.hy2}}" r="7" fill="var(--tertiary)"/>
                </svg>
                <div class="mono lbl">{{kd.bezText}}</div>
              </div>
              <div style="flex:1 1 260px;min-width:220px;display:flex;flex-direction:column;gap:6px">
                <div class="lbl">{{t.presets}}</div>
                <div class="cols" role="group" aria-label="{{t.presets}}"><sc-for list="{{kd.easeBtns}}" as="o" hint-placeholder-count="6"><button class="chip" aria-pressed="{{o.pressed}}" onClick="{{o.pick}}">{{o.label}}</button></sc-for></div>
                ${rangeRow('t.x1','bx1','kd.x1',0,1,0.01,'kd.setX1','')}
                ${rangeRow('t.y1','by1','kd.y1',-0.5,1.8,0.01,'kd.setY1','')}
                ${rangeRow('t.x2','bx2','kd.x2',0,1,0.01,'kd.setX2','')}
                ${rangeRow('t.y2','by2','kd.y2',-0.5,1.8,0.01,'kd.setY2','')}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="card ov rise {{cc.json}}" id="importexport" aria-label="{{t.jsonTitle}}">
        ${h2tile('t.jsonTitle','json')}
        <div class="muted">{{t.jsonSub}}</div>
        <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
          <div style="display:flex;flex-direction:column;gap:10px"><div class="cols"><b class="t1 grow">{{t.export}}</b><button class="btn t sm" onClick="{{copyJson}}">{{copyText}}</button></div><pre class="json" tabindex="0" aria-label="{{t.export}}">{{json}}</pre></div>
          <div style="display:flex;flex-direction:column;gap:10px"><div class="cols"><b class="t1 grow">{{t.import}}</b><button class="btn f sm" onClick="{{doImport}}">{{t.doImport}}</button></div><textarea class="json" aria-label="{{t.import}}" onInput="{{onJson}}">{{jsonIn}}</textarea>
            <sc-if value="{{importOk}}" hint-placeholder-val="{{ false }}"><span class="tag good" style="align-self:flex-start">{{t.imported}}</span></sc-if>
            <sc-if value="{{importBad}}" hint-placeholder-val="{{ false }}"><span class="tag bad" style="align-self:flex-start">{{t.importBad}}</span></sc-if></div>
        </div>
      </section>
`;
const dock=`    <sc-if value="{{dirty}}" hint-placeholder-val="{{ true }}">
      <div class="dock" role="region" aria-label="{{t.dockLabel}}"><b>{{t.dockText}}</b><button class="btn t sm" onClick="{{discard}}">{{t.discard}}</button><button class="btn f sm" onClick="{{save}}">{{t.save}}</button></div>
    </sc-if>`;
html+=SHELL('settings','t.title',0,inner,dock);

const script=`
    const defs = {
      rm: [T('reduced motion rule', '減少動態規則'), T('When your operating system or this app asks for reduced motion, every animation stops, whatever the editor says.', '當作業系統或者本應用程式要求減少動態，無論編輯器點設定，所有動畫都會停止。')],
      el: [T('element list', '元素清單'), T('Pick any element. Its colour, shape, size and spacing apply everywhere that element appears.', '揀任何元素，佢嘅顏色、形狀、大細同間距會套用喺所有出現嘅地方。')],
      pv: [T('live preview', '即時預覽'), T('Samples update as you drag. Click a sample to edit it.', '拖動時樣本即時更新，撳樣本即可編輯。')],
      pick: [T('colour picker', '顏色選擇器'), T('Pick any colour. Lightness and chroma change across the grid, hue changes along the strip.', '可以揀任何顏色。格仔橫向係色度、縱向係亮度，下面一條係色相。')],
      logo: [T('logo', '標誌'), T('The logo appears in the rail, the browser tab and exports. It can follow the picker colour.', '標誌會出現喺側欄、瀏覽器分頁同匯出檔案，可以跟隨選色器嘅顏色。')],
      anim: [T('animation editor', '動畫編輯器'), T('Every animated element kind has its own timing. Reduced motion always wins.', '每種動畫元素都有自己嘅時間設定，減少動態永遠優先。')],
      json: [T('import and export', '匯入同匯出'), T('Share a motion profile as JSON. Imports are checked before anything changes.', '用 JSON 分享動畫設定檔，匯入前會先檢查，唔會亂改。')]
    };
    const { lk, tips, cc } = mk(defs);
    const chg = (o) => set(Object.assign({ dirty: true }, o));

    // ---- colour maths (OKLCH <-> sRGB) ----
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const toRgb = (L, Cc, H) => {
      const a = Cc * Math.cos(H * Math.PI / 180), b = Cc * Math.sin(H * Math.PI / 180);
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
      const l = l_ ** 3, m = m_ ** 3, sx = s_ ** 3;
      const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * sx, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * sx, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * sx];
      const gm = (v) => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
      const raw = lin.map(gm);
      const clip = raw.some(v => v < -0.002 || v > 1.002);
      return { rgb: raw.map(v => Math.round(clamp01(v) * 255)), clip };
    };
    const fromHex = (hex) => {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
      if (!m) return null;
      const n = parseInt(m[1], 16);
      const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255);
      const lin = c.map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
      const l = 0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2];
      const mm = 0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2];
      const sx = 0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2];
      const l_ = Math.cbrt(l), m_ = Math.cbrt(mm), s_ = Math.cbrt(sx);
      const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
      const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
      const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
      let H = Math.atan2(bb, a) * 180 / Math.PI; if (H < 0) H += 360;
      return [L, Math.hypot(a, bb), H];
    };
    const hex2 = (n) => n.toString(16).padStart(2, '0');
    const rgbHex = (r) => '#' + r.map(hex2).join('');
    const hsl = (r) => {
      const [R, G, B] = r.map(v => v / 255); const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
      let h = 0; const l = (mx + mn) / 2; const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      if (d) h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
      h = Math.round(((h * 60) + 360) % 360); return 'hsl(' + h + ' ' + Math.round(sat * 100) + '% ' + Math.round(l * 100) + '%)';
    };
    const lumi = (r) => { const c = r.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const ratio = (a, b) => { const x = lumi(a), y = lumi(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const NAMES = [['black', [0, 0, 0]], ['white', [255, 255, 255]], ['red', [220, 38, 38]], ['crimson', [220, 20, 60]], ['orange', [249, 115, 22]], ['gold', [234, 179, 8]], ['yellow', [250, 204, 21]], ['olive', [128, 128, 0]], ['green', [34, 160, 80]], ['seagreen', [46, 139, 87]], ['teal', [0, 137, 123]], ['turquoise', [64, 224, 208]], ['skyblue', [135, 206, 235]], ['dodgerblue', [30, 144, 255]], ['royalblue', [65, 105, 225]], ['slateblue', [106, 90, 205]], ['indigo', [75, 0, 130]], ['rebeccapurple', [102, 51, 153]], ['violet', [180, 100, 220]], ['orchid', [218, 112, 214]], ['hotpink', [255, 105, 180]], ['deeppink', [216, 27, 96]], ['brown', [140, 80, 40]], ['gray', [128, 128, 128]], ['silver', [192, 192, 192]], ['slategray', [112, 128, 144]]];
    const nearest = (r) => NAMES.map(([n, c]) => [n, Math.hypot(c[0] - r[0], c[1] - r[1], c[2] - r[2])]).sort((a, b) => a[1] - b[1])[0][0];

    const accentLch = fromHex(accent) || [0.55, 0.16, 275];
    const lch = s.lch || accentLch;
    const pkOut = toRgb(lch[0], lch[1], lch[2]);
    const pkHex = rgbHex(pkOut.rgb);
    const copied = s.copied || '';
    const rowsDef = [['HEX', pkHex], ['RGB', 'rgb(' + pkOut.rgb.join(' ') + ')'], ['HSL', hsl(pkOut.rgb)], ['OKLCH', 'oklch(' + (lch[0] * 100).toFixed(1) + '% ' + lch[1].toFixed(3) + ' ' + lch[2].toFixed(1) + ')'], [T('Name', '名稱'), T('closest: ', '最接近：') + nearest(pkOut.rgb)]];
    const cR = ratio(pkOut.rgb, [255, 255, 255]), cB = ratio(pkOut.rgb, [0, 0, 0]);
    const onPick = lumi(pkOut.rgb) > 0.4 ? '#0b0d1a' : '#ffffff';
    const hexMsg = s.hexMsg || '';
    const pk = {
      L: Math.round(lch[0] * 100), C: Math.round(lch[1] * 100), H: Math.round(lch[2]), hex: pkHex,
      swatchStyle: 'background:' + pkHex + ';color:' + onPick,
      clipped: pkOut.clip,
      aa: (Math.max(cR, cB) >= 7 ? 'AAA' : Math.max(cR, cB) >= 4.5 ? 'AA' : T('Low contrast', '對比偏低')),
      aaCls: Math.max(cR, cB) >= 4.5 ? 'good' : 'warn',
      cw: T('White text ', '白字 ') + cR.toFixed(1) + ':1 · ' + T('black text ', '黑字 ') + cB.toFixed(1) + ':1',
      rows: rowsDef.map(([k, v]) => ({ k, v, copyText: copied === k ? T('Copied', '已複製') : T('Copy', '複製'), copyLabel: T('Copy ', '複製 ') + k, copy: () => set({ copied: k }) })),
      setL: (e) => set({ lch: [num(e, lch[0] * 100) / 100, lch[1], lch[2]], copied: '' }),
      setC: (e) => set({ lch: [lch[0], num(e, lch[1] * 100) / 100, lch[2]], copied: '' }),
      setH: (e) => set({ lch: [lch[0], lch[1], num(e, lch[2])], copied: '' }),
      hexMsg: hexMsg === 'bad' ? T('Not a valid hex', '唔係有效嘅十六進制') : hexMsg === 'ok' ? T('Applied', '已套用') : '',
      hexCls: hexMsg === 'bad' ? 'bad' : 'good', hasHexMsg: !!hexMsg,
      typed: (e) => { const v = fromHex(txt(e)); set(v ? { lch: v, hexMsg: 'ok' } : { hexMsg: 'bad' }); }
    };
    const plane = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 14; c++) {
      const L = 0.95 - r * 0.12, Cc = c * 0.02;
      plane.push({ style: 'background:oklch(' + L.toFixed(2) + ' ' + Cc.toFixed(2) + ' ' + lch[2].toFixed(0) + ')', label: T('Lightness ', '亮度 ') + Math.round(L * 100) + T(', chroma ', '，色度 ') + Cc.toFixed(2), pick: () => set({ lch: [L, Cc, lch[2]], copied: '' }) });
    }
    const hues = [];
    for (let h = 0; h < 24; h++) hues.push({ style: 'background:oklch(0.7 0.16 ' + (h * 15) + ')', label: T('Hue ', '色相 ') + (h * 15) + '°', pick: () => set({ lch: [lch[0], Math.max(lch[1], 0.1), h * 15], copied: '' }) });

    // ---- per-element appearance ----
    const EL = [
      ['card', T('Card', '卡片'), { role: 'surface', r: 28, size: 100, pad: 20, elev: 1 }],
      ['button', T('Button', '按鈕'), { role: 'primary', r: 24, size: 100, pad: 12, elev: 1 }],
      ['chip', T('Chip', '標籤'), { role: 'secondary', r: 10, size: 100, pad: 7, elev: 0 }],
      ['switch', T('Switch', '開關'), { role: 'primary', r: 16, size: 100, pad: 4, elev: 0 }],
      ['tab', T('Tab', '分頁'), { role: 'surface', r: 14, size: 100, pad: 10, elev: 0 }],
      ['input', T('Input field', '輸入欄'), { role: 'surface', r: 14, size: 100, pad: 14, elev: 0 }],
      ['toast', T('Toast', '彈出提示'), { role: 'tertiary', r: 24, size: 100, pad: 14, elev: 3 }]
    ];
    const elov = s.elov || {};
    const sel = s.el || 'card';
    const gv = (id) => Object.assign({}, EL.find(e => e[0] === id)[2], elov[id] || {});
    const setEl = (o) => chg({ elov: Object.assign({}, elov, { [sel]: Object.assign({}, elov[sel] || {}, o) }) });
    const ROLES = [['primary', T('Primary', '主色'), 'background:var(--primary)'], ['secondary', T('Secondary', '次色'), 'background:var(--secondary-c)'], ['tertiary', T('Tertiary', '第三色'), 'background:var(--tertiary-c)'], ['surface', T('Surface', '表面'), 'background:var(--surf-high)'], ['custom', T('Picker colour', '選色器顏色'), 'background:' + pkHex]];
    const roleCss = (g) => {
      const r = g.role;
      if (r === 'primary') return 'background:var(--primary);color:var(--on-primary)';
      if (r === 'secondary') return 'background:var(--secondary-c);color:var(--on-secondary-c)';
      if (r === 'tertiary') return 'background:var(--tertiary-c);color:var(--on-tertiary-c)';
      if (r === 'custom') return 'background:' + (g.hex || pkHex) + ';color:' + (lumi(fromHexRgb(g.hex || pkHex)) > 0.4 ? '#0b0d1a' : '#fff');
      return 'background:var(--surf-high);color:var(--text)';
    };
    function fromHexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    const shadow = (n) => n === 0 ? 'none' : n === 1 ? 'var(--e1)' : n === 2 ? 'var(--e2)' : 'var(--e3)';
    const css = (id, extra) => { const g = gv(id); return roleCss(g) + ';border-radius:' + g.r + 'px;padding:' + g.pad + 'px ' + Math.round(g.pad * 1.6) + 'px;font-size:' + (14 * g.size / 100).toFixed(1) + 'px;box-shadow:' + shadow(g.elev) + ';display:inline-flex;align-items:center;gap:8px;font-weight:700;' + (extra || ''); };
    const sw = gv('switch');
    const pvp = {}, pick = {};
    EL.forEach(e => { pvp[e[0]] = sel === e[0] ? 'true' : 'false'; pick[e[0]] = () => set({ el: e[0] }); });
    const pv = {
      card: css('card', 'flex-direction:column;align-items:flex-start;gap:2px;width:100%'), button: css('button'), chip: css('chip', 'font-weight:650'),
      switch: roleCss(sw) + ';display:inline-block;position:relative;width:' + (56 * sw.size / 100) + 'px;height:' + (32 * sw.size / 100) + 'px;border-radius:' + sw.r * sw.size / 100 + 'px;box-shadow:' + shadow(sw.elev),
      knob: 'position:absolute;top:' + (4 * sw.size / 100) + 'px;right:' + (4 * sw.size / 100) + 'px;width:' + (24 * sw.size / 100) + 'px;height:' + (24 * sw.size / 100) + 'px;border-radius:50%;background:#fff;display:block',
      tab: css('tab'), input: css('input', 'min-width:150px;font-family:ui-monospace,Consolas,monospace;border:1.5px solid var(--line)'), toast: css('toast', 'width:100%')
    };
    const cur = gv(sel);
    const ed = {
      r: cur.r, size: cur.size, pad: cur.pad, elev: cur.elev,
      setR: (e) => setEl({ r: num(e, cur.r) }), setSize: (e) => setEl({ size: num(e, cur.size) }), setPad: (e) => setEl({ pad: num(e, cur.pad) }), setElev: (e) => setEl({ elev: num(e, cur.elev) })
    };
    const els = EL.map(e => { const g = gv(e[0]); return { label: e[1], pressed: sel === e[0] ? 'true' : 'false', pick: () => set({ el: e[0] }), sw: roleCss(g).split(';')[0] + ';border-radius:' + Math.min(g.r, 11) + 'px', sum: g.r + 'px · ' + g.size + '%' }; });
    const roles = ROLES.map(([id, label, style]) => ({ label, style, pressed: cur.role === id ? 'true' : 'false', pick: () => setEl({ role: id, hex: id === 'custom' ? pkHex : undefined }) }));

    // ---- logo ----
    const lg = s.logo || {};
    const shape = lg.shape || 'cookie', glyph = lg.glyph || 'wifi', lscale = lg.scale || 78, lname = lg.name === undefined ? 'RT-AX86U home' : lg.name, usePick = !!lg.usePick;
    const SH = { cookie: '${COOKIE}', circle: 'M100 10a90 90 0 1 0 0.1 0z', squircle: 'M64 12h72c36 0 52 16 52 52v72c0 36-16 52-52 52H64c-36 0-52-16-52-52V64c0-36 16-52 52-52z', blob: '${BLOB1}' };
    const GL = { wifi: D.wifi, bolt: D.bolt, shield: D.shield, router: 'M3 14h18v6H3z M7 17h.01 M11 17h.01 M7 14V6 M17 14V6' };
    const setLg = (o) => chg({ logo: Object.assign({}, lg, o) });
    const logo = {
      shape: SH[shape], glyph: GL[glyph], scale: lscale, name: lname, usePickP: usePick ? 'true' : 'false',
      style: 'color:' + (usePick ? pkHex : 'var(--primary)'), fg: usePick ? onPick : '#fff',
      glStyle: 'width:' + lscale * 0.5 + '%;height:' + lscale * 0.5 + '%',
      exported: !!lg.exported, export: () => setLg({ exported: true }), setScale: (e) => setLg({ scale: num(e, lscale) }), setName: (e) => setLg({ name: txt(e) }), togglePick: () => setLg({ usePick: !usePick })
    };
    const logoShapes = [['cookie', T('Cookie', '曲奇')], ['circle', T('Circle', '圓形')], ['squircle', T('Squircle', '圓角方')], ['blob', T('Blob', '雲朵')]].map(([id, label]) => ({ label, pressed: shape === id ? 'true' : 'false', pick: () => setLg({ shape: id }) }));
    const logoGlyphs = [['wifi', 'Wi-Fi'], ['bolt', T('Bolt', '閃電')], ['shield', T('Shield', '盾牌')], ['router', T('Router', '路由器')]].map(([id, label]) => ({ label, pressed: glyph === id ? 'true' : 'false', pick: () => setLg({ glyph: id }) }));

    // ---- animation editor ----
    const BZ = { standard: [0.2, 0, 0, 1], emphasized: [0.05, 0.7, 0.1, 1], decelerate: [0, 0, 0, 1], accelerate: [0.3, 0, 1, 1], spring: [0.34, 1.56, 0.64, 1], linear: [0, 0, 1, 1] };
    const BZN = { standard: T('Standard', '標準'), emphasized: T('Emphasized', '強調'), decelerate: T('Decelerate', '減速'), accelerate: T('Accelerate', '加速'), spring: T('Spring', '彈簧'), linear: T('Linear', '線性') };
    const KINDS = [
      ['page', T('Page entry', '頁面進場'), 450, 0, 0, 16, 0.98], ['list', T('List stagger', '清單逐項進場'), 380, 0, 45, 12, 1], ['card', T('Cards', '卡片'), 420, 0, 60, 14, 0.98],
      ['dialog', T('Dialogs', '對話框'), 320, 0, 0, 24, 0.94], ['menu', T('Menus', '選單'), 180, 0, 0, 8, 0.96], ['sheet', T('Sheets', '底部面板'), 360, 0, 0, 40, 1],
      ['tip', T('Tooltips', '提示氣泡'), 140, 60, 0, 4, 0.98], ['toast', T('Toasts', '彈出提示'), 340, 0, 0, 24, 0.96], ['sw', T('Switches', '開關'), 260, 0, 0, 0, 1],
      ['chart', T('Charts draw in', '圖表繪製'), 900, 100, 0, 0, 1], ['prog', T('Progress shimmer', '進度閃爍'), 1400, 0, 0, 0, 1], ['pulse', T('Live pulses', '即時脈衝'), 2400, 0, 0, 0, 0.85],
      ['tab', T('Tab changes', '分頁切換'), 240, 0, 0, 8, 1], ['hover', T('Hover lift', '游標浮起'), 160, 0, 0, 3, 1.02]
    ];
    const PROF = { calm: { n: T('Calm', '平靜'), dur: 1.3, dist: 0.5, sc: 0.4, stg: 0.5, ease: 'standard' }, standard: { n: T('Standard', '標準'), dur: 1, dist: 1, sc: 1, stg: 1, ease: 'standard' }, expressive: { n: T('Expressive', '表現'), dur: 1.1, dist: 1.2, sc: 1.2, stg: 1.2, ease: 'emphasized' }, playful: { n: T('Playful', '活潑'), dur: 1.15, dist: 1.6, sc: 2.2, stg: 1.5, ease: 'spring' } };
    const prof = s.prof || 'expressive';
    const ov = s.ov || {};
    const master = s.master !== false;
    const speed = s.speed || 1;
    const rm = !!s.rm;
    const kdef = (k) => { const P = PROF[prof]; return { on: true, dur: Math.round(k[2] * P.dur), delay: k[3], stagger: Math.round(k[4] * P.stg), dist: Math.round(k[5] * P.dist), scale: Math.round((1 - (1 - k[6]) * P.sc) * 100) / 100, ease: P.ease, bz: null }; };
    const kget = (k) => Object.assign(kdef(k), ov[k[0]] || {});
    const ksel = s.kind || 'card';
    const kk = KINDS.find(k => k[0] === ksel);
    const kv = kget(kk);
    const bzOf = (v) => v.bz || BZ[v.ease];
    const setK = (o) => chg({ ov: Object.assign({}, ov, { [ksel]: Object.assign({}, ov[ksel] || {}, o) }) });
    const bz = bzOf(kv);
    const setBz = (i, v) => { const n = bz.slice(); n[i] = v; setK({ bz: n, ease: 'custom' }); };
    const replay = s.replay || 1;
    const animating = master && kv.on && !rm;
    const boxes = [0, 1, 2].map(i => ({
      label: 'Wi-Fi ' + (i + 1), cls: animating ? 'axp' + (replay % 2 === 0 ? 2 : 1) : 'axp0',
      style: '--d:' + Math.round(kv.dur / speed) + 'ms;--dl:' + Math.round((kv.delay + i * kv.stagger) / speed) + 'ms;--e:cubic-bezier(' + bz.join(',') + ');--dy:' + kv.dist + 'px;--sc:' + kv.scale + ';padding:14px 18px;border-radius:20px;background:var(--surf);box-shadow:var(--e1);display:flex;flex-direction:column;min-width:120px'
    }));
    const kd = {
      label: kk[1], onP: kv.on ? 'true' : 'false', toggle: () => setK({ on: !kv.on }), boxes,
      dur: kv.dur, delay: kv.delay, stagger: kv.stagger, dist: kv.dist, scale: kv.scale,
      setDur: (e) => setK({ dur: num(e, kv.dur) }), setDelay: (e) => setK({ delay: num(e, kv.delay) }), setStagger: (e) => setK({ stagger: num(e, kv.stagger) }), setDist: (e) => setK({ dist: num(e, kv.dist) }), setScale: (e) => setK({ scale: num(e, kv.scale) }),
      x1: bz[0], y1: bz[1], x2: bz[2], y2: bz[3], setX1: (e) => setBz(0, num(e, bz[0])), setY1: (e) => setBz(1, num(e, bz[1])), setX2: (e) => setBz(2, num(e, bz[2])), setY2: (e) => setBz(3, num(e, bz[3])),
      curve: 'M0 160 C' + (bz[0] * 160) + ' ' + (160 - bz[1] * 160) + ' ' + (bz[2] * 160) + ' ' + (160 - bz[3] * 160) + ' 160 0',
      hx1: bz[0] * 160, hy1: 160 - bz[1] * 160, hx2: bz[2] * 160, hy2: 160 - bz[3] * 160,
      bezText: 'cubic-bezier(' + bz.map(v => Math.round(v * 100) / 100).join(', ') + ')',
      curveAlt: T('Easing curve for ', '緩動曲線：') + kk[1],
      easeBtns: Object.keys(BZ).map(id => ({ label: BZN[id], pressed: kv.ease === id && !kv.bz ? 'true' : 'false', pick: () => setK({ ease: id, bz: null }) }))
    };
    const kinds = KINDS.map(k => { const v = kget(k); return { label: k[1], pressed: ksel === k[0] ? 'true' : 'false', pick: () => set({ kind: k[0] }), sum: (v.on ? Math.round(v.dur / speed) + ' ms' : T('off', '關')), dotStyle: 'background:' + (v.on ? 'var(--primary)' : 'var(--line)') }; });
    const profiles = Object.keys(PROF).map(id => ({ label: PROF[id].n, pressed: prof === id ? 'true' : 'false', pick: () => chg({ prof: id, ov: {} }) }));

    const exportObj = { profile: prof, speed, enabled: master, reducedMotionWins: true, kinds: {} };
    KINDS.forEach(k => { const v = kget(k); exportObj.kinds[k[0]] = { on: v.on, duration: v.dur, delay: v.delay, stagger: v.stagger, distance: v.dist, scale: v.scale, easing: bzOf(v).map(n => Math.round(n * 100) / 100) }; });
    const json = JSON.stringify(exportObj, null, 2);
    const jsonIn = s.jsonIn === undefined ? json : s.jsonIn;
    const doImport = () => {
      try {
        const o = JSON.parse(jsonIn);
        if (!o || typeof o !== 'object' || !o.kinds) throw new Error('shape');
        const nov = {};
        Object.keys(o.kinds).forEach(id => { const v = o.kinds[id]; if (KINDS.some(k => k[0] === id) && v) nov[id] = { on: v.on !== false, dur: +v.duration || 0, delay: +v.delay || 0, stagger: +v.stagger || 0, dist: +v.distance || 0, scale: +v.scale || 1, ease: 'custom', bz: Array.isArray(v.easing) && v.easing.length === 4 ? v.easing.map(Number) : null }; });
        chg({ ov: nov, prof: PROF[o.profile] ? o.profile : prof, speed: +o.speed || 1, master: o.enabled !== false, importState: 'ok' });
      } catch (err) { set({ importState: 'bad' }); }
    };

    const t = {
      title: T('Appearance and motion', '外觀同動態'), heroLabel: T('Appearance editor summary', '外觀編輯器摘要'),
      chipLive: T('Live preview', '即時預覽'), chipSync: T('Synced to your other settings', '同其他設定同步'),
      headline: T('Make it yours', '照你心意設計'),
      lede: T('Restyle any element, mix any colour, redraw the logo and tune every animation. Changes show instantly and stay local until you save.', '任何元素都可以改樣式，任何顏色都可以調，標誌可以重畫，每個動畫都可以微調。改動即時顯示，儲存之前只留喺本機。'),
      profile: T('Motion profile', '動態設定檔'), exportJson: T('Export JSON', '匯出 JSON'), importJson: T('Import JSON', '匯入 JSON'),
      rmTitle: T('Reduced motion always wins', '減少動態永遠優先'),
      rmSub: T('If your system or this app asks for reduced motion, every animation below stops, even when it is switched on here.', '如果系統或者本應用程式要求減少動態，下面所有動畫即使喺呢度開咗都會停止。'),
      rmSim: T('Simulate reduced motion', '模擬減少動態'),
      elTitle: T('Elements', '元素'), elSub: T('Pick the element you want to restyle.', '揀你想改樣式嘅元素。'),
      pvTitle: T('Live preview', '即時預覽'), editing: T('Editing', '正在編輯'),
      elCard: T('Card', '卡片'), elButton: T('Button', '按鈕'), elChip: T('Chip', '標籤'), elSwitch: T('Switch', '開關'), elTab: T('Tab', '分頁'), elInput: T('Input field', '輸入欄'), elToast: T('Toast', '彈出提示'),
      editCard: T('Edit card', '編輯卡片'), editButton: T('Edit button', '編輯按鈕'), editChip: T('Edit chip', '編輯標籤'), editSwitch: T('Edit switch', '編輯開關'), editTab: T('Edit tab', '編輯分頁'), editInput: T('Edit input field', '編輯輸入欄'), editToast: T('Edit toast', '編輯彈出提示'),
      sampleCardTitle: T('Living room node', '客廳節點'), sampleCardSub: T('5 clients · 866 Mbps', '5 部裝置 · 866 Mbps'), sampleBtn: T('Apply changes', '套用變更'), sampleTab: T('Wi-Fi', 'Wi-Fi'), sampleToast: T('Guest Wi-Fi turned on', '已開啟訪客 Wi-Fi'), sampleTonal: T('Review', '檢視'), sampleOk: T('Online', '在線'),
      role: T('Colour role', '顏色角色'), radius: T('Corner radius', '圓角'), size: T('Size', '大細'), spacing: T('Spacing', '間距'), elev: T('Elevation (0 to 3)', '立體感（0 至 3）'),
      useColour: T('Use picker colour', '用選色器顏色'), resetEl: T('Reset this element', '重設呢個元素'),
      pickTitle: T('Colour picker', '顏色選擇器'), pickSub: T('Any colour, translated to every format. Works with the accent you set in Tweaks.', '任何顏色都會轉換成各種格式，亦配合你喺 Tweaks 設定嘅主色。'),
      plane: T('Lightness and chroma grid', '亮度同色度格仔'), hueStrip: T('Hue strip', '色相條'),
      light: T('Lightness', '亮度'), chroma: T('Chroma', '色度'), hue: T('Hue', '色相'), typeHex: T('Type a hex', '輸入十六進制'),
      clipped: T('Clipped to sRGB', '已限制喺 sRGB 範圍'), liveAccent: T('This colour as the app accent', '呢個顏色作為應用程式主色'),
      logoTitle: T('Logo', '標誌'), logoSub: T('Shape, glyph, size and name. Shown in the rail, tab and exports.', '形狀、圖案、大細同名稱，會顯示喺側欄、分頁同匯出。'),
      logoSizes: T('Logo at 64, 32 and 16 pixels', '標誌 64、32、16 像素'), logoShape: T('Shape', '形狀'), logoGlyph: T('Glyph', '圖案'), logoScale: T('Glyph size', '圖案大細'), logoName: T('App name', '應用程式名稱'), logoPick: T('Use the picker colour', '用選色器顏色'), logoExport: T('Export as', '匯出為'), logoExported: T('Exported', '已匯出'), tipK: T('Tip', '提示'), tipText: T('Click a sample in the live preview to edit it. Every element keeps its own radius, size and spacing.', '喺即時預覽撳一個樣本就可以編輯。每個元素都有自己嘅圓角、大細同間距。'), resetEls: T('Reset all elements', '重設所有元素'),
      animTitle: T('Animation and transition editor', '動畫同轉場編輯器'), animSub: T('Every animated element kind, with its own timing, easing and a live preview.', '每種動畫元素都有自己嘅時間、緩動同即時預覽。'),
      master: T('Animations on', '動畫開啟'), resetAll: T('Reset all', '全部重設'), speed: T('Global speed', '整體速度'),
      kinds: T('Animated element kinds', '動畫元素種類'), kindOn: T('Enabled', '啟用'), play: T('Play', '播放'), previewOf: T('Live preview', '即時預覽'),
      rmStopped: T('Motion stopped by the reduced motion setting', '減少動態設定已停止動畫'),
      dur: T('Duration', '時長'), delay: T('Delay', '延遲'), stagger: T('Stagger', '逐項間隔'), dist: T('Distance', '距離'), scale: T('Start scale', '起始縮放'),
      curve: T('Easing curve', '緩動曲線'), presets: T('Easing presets', '緩動預設'), x1: T('Control 1 x', '控制點 1 x'), y1: T('Control 1 y', '控制點 1 y'), x2: T('Control 2 x', '控制點 2 x'), y2: T('Control 2 y', '控制點 2 y'),
      jsonTitle: T('Import and export', '匯入同匯出'), jsonSub: T('Share the whole motion profile as JSON. A bad file never changes anything.', '用 JSON 分享成套動態設定，無效檔案唔會改動任何嘢。'),
      export: T('Export', '匯出'), import: T('Import', '匯入'), doImport: T('Import this JSON', '匯入呢段 JSON'), imported: T('Imported and applied', '已匯入同套用'), importBad: T('That is not a valid motion profile', '呢個唔係有效嘅動態設定檔'),
      dockLabel: T('Unsaved appearance changes', '未儲存嘅外觀改動'), dockText: T('Appearance changes are not saved yet', '外觀改動未儲存'), discard: T('Discard', '放棄'), save: T('Save appearance', '儲存外觀')
    };
    const importState = s.importState || '';
    const copyState = s.copyJson;

    return Object.assign(base([T('Settings', '設定'), T('Appearance', '外觀'), T('Language', '語言')]), {
      lk, tips, cc, t, d: D, profiles, els, pv, pvp, pick, roles, ed, edLabel: EL.find(e => e[0] === sel)[1],
      resetAllEls: () => chg({ elov: {} }), useColour: () => setEl({ role: 'custom', hex: pkHex }), resetEl: () => chg({ elov: Object.assign({}, elov, { [sel]: {} }) }),
      pk, plane, hues, logo, logoShapes, logoGlyphs,
      rmP: rm ? 'true' : 'false', rmP2: rm, toggleRm: () => set({ rm: !rm }),
      rmTag: rm ? T('Reduced motion is on', '減少動態已開啟') : T('Motion allowed', '允許動態'), rmTagCls: rm ? 'warn' : 'good',
      masterP: master ? 'true' : 'false', toggleMaster: () => chg({ master: !master }), speed, speedText: speed.toFixed(2) + '×', setSpeed: (e) => chg({ speed: num(e, 1) }),
      kinds, kd, play: () => set({ replay: replay + 1 }),
      resetAll: () => chg({ ov: {}, speed: 1, master: true }),
      json, jsonIn, onJson: (e) => set({ jsonIn: txt(e), importState: '' }), doImport, importOk: importState === 'ok', importBad: importState === 'bad',
      copyText: copyState ? T('Copied', '已複製') : T('Copy JSON', '複製 JSON'), copyJson: () => set({ copyJson: true }),
      exportNow: () => set({ copyJson: true }), scrollImport: () => set({ jsonIn: json }),
      dirty: !!s.dirty, save: () => set({ dirty: false }), discard: () => set({ dirty: false, elov: {}, ov: {}, logo: {}, speed: 1, master: true, prof: 'expressive', lch: undefined })
    });`;
html+=wrapScript(script);
C.write('Appearance.dc.html',html);
console.log('ok',html.length);
