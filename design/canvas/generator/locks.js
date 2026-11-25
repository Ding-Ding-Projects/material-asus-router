const C=require('./common.js');
const {ic,INFO,DOTS,CHK,tile,h2tile,HEAD,SHELL,wrapScript,COOKIE,BLOB1,BLOB2,SCALLOP}=C;

const css=`.main{position:relative}
.scrim{z-index:40}
.scrim .sheet{position:sticky;top:96px}
.toyl{position:relative;border-radius:28px;padding:20px;background:var(--surf-low);display:flex;flex-direction:column;gap:8px;border:2px solid transparent;min-height:200px}
.toyl.locked{border-color:var(--primary);background:var(--primary-c);color:var(--on-primary-c)}
.toyl.locked .muted{color:inherit;opacity:.85}
.toyl .shine{position:absolute;right:12px;top:12px;width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:var(--surf);color:var(--text);border:0;padding:0;box-shadow:var(--e1)}
.toyl.locked .shine{background:var(--primary);color:var(--on-primary)}
.ladder{display:flex;flex-direction:column;gap:6px;position:relative}
.rung{display:flex;gap:12px;align-items:center;width:100%;min-height:64px;padding:10px 14px;border:2px solid var(--line);border-radius:22px;background:var(--surf);color:var(--text);font:inherit;text-align:left}
.rung[aria-pressed=true]{border-color:var(--primary);background:var(--secondary-c);color:var(--on-secondary-c)}
.rung .num{width:36px;height:36px;border-radius:18px;background:var(--surf-high);display:grid;place-items:center;font-weight:850;flex:none;color:var(--text)}
.rung[aria-pressed=true] .num{background:var(--primary);color:var(--on-primary)}
.keyslot{display:flex;align-items:center;gap:12px;padding:14px;border-radius:20px;background:var(--surf-low);border:2px solid var(--line)}
.keyslot.turned{border-color:var(--good);background:var(--good-c)}
.codebox{display:flex;align-items:center;gap:16px;padding:16px;border-radius:24px;background:var(--surf-low)}
.ring{width:56px;height:56px;flex:none}
.ring circle{fill:none;stroke-width:5}
.ring .bg{stroke:var(--surf-high)}
.ring .fg{stroke:var(--primary);stroke-linecap:round;stroke-dasharray:100;animation:ringt 30s linear infinite;transform:rotate(-90deg);transform-origin:50% 50%}
@keyframes ringt{from{stroke-dashoffset:0}to{stroke-dashoffset:100}}
.calm .ring .fg{animation:none}
@media (prefers-reduced-motion:reduce){.ring .fg{animation:none}}
.qr{display:block;background:#fff;border-radius:20px;padding:12px;box-shadow:var(--e1)}
.tkt{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--line);flex-wrap:wrap;position:relative}
.tkt:first-of-type{border-top:0}
.prog{height:8px;border-radius:4px;background:var(--surf-high);overflow:hidden}
.prog i{display:block;height:100%;background:var(--primary);border-radius:4px}`;

// QR-like grid
let seed=7;const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
const N=25;const cells=[];
const inFinder=(x,y)=>[[0,0],[N-7,0],[0,N-7]].some(([fx,fy])=>x>=fx-1&&x<=fx+7&&y>=fy-1&&y<=fy+7);
let qrPath='';
for(let y=0;y<N;y++)for(let x=0;x<N;x++){if(inFinder(x,y))continue;if(rnd()>0.52)qrPath+=`M${x} ${y}h1v1h-1z`;}
[[0,0],[N-7,0],[0,N-7]].forEach(([fx,fy])=>{qrPath+=`M${fx} ${fy}h7v7h-7zM${fx+1} ${fy+1}v5h5v-5z`;qrPath+=`M${fx+2} ${fy+2}h3v3h-3z`;});

let html=HEAD('Locks, recovery and authenticator',css);
const inner=`
      <section class="card hero rise" aria-label="{{t.heroLabel}}" style="min-height:220px">
        <svg class="deco a" viewBox="0 0 200 200" aria-hidden="true" style="right:-70px;top:-80px;width:330px;height:330px"><path d="${SCALLOP}"/></svg>
        <svg class="deco b" viewBox="0 0 200 200" aria-hidden="true" style="right:280px;bottom:-125px;width:250px;height:250px"><path d="${BLOB2}"/></svg>
        <div class="cookie" style="position:absolute;right:66px;top:42px;width:124px;height:124px;color:var(--tertiary-c)" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--on-tertiary-c)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:52px;height:52px;grid-area:1/1;fill:none"><path d="{{d.lock}}"/></svg></div>
        <div style="position:relative;display:flex;flex-wrap:wrap;gap:8px"><span class="tag onp">{{t.chipLocked}}</span><span class="tag onp">{{t.chipTwoKey}}</span><span class="tag onp">{{t.chipTotp}}</span></div>
        <h1 class="disp" style="position:relative;max-width:16ch">{{t.headline}}</h1>
        <p class="lede" style="position:relative;color:color-mix(in srgb,var(--on-primary) 86%,transparent)">{{t.lede}}</p>
      </section>

      <div class="dash">
        <section class="card span2 ov rise {{cc.toys}}" aria-label="{{t.toysTitle}}">
          <div class="cols">
            <div class="grow" style="min-width:220px">${h2tile('t.toysTitle','toys')}<div class="muted">{{t.toysSub}}</div></div>
            <button class="btn t sm {{lockAllDis}}" onClick="{{lockAll}}">${ic('M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',18)}{{t.lockAll}}</button>
            <button class="btn o sm {{lockAllDis}}" onClick="{{unlockAll}}">{{t.unlockAll}}</button>
          </div>
          <sc-if value="{{viewer}}" hint-placeholder-val="{{ false }}"><div class="tag warn" style="align-self:flex-start">{{t.viewerNote}}</div></sc-if>
          <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
            <sc-for list="{{toys}}" as="x" hint-placeholder-count="4">
              <div class="{{x.cls}}">
                <button class="shine" aria-pressed="{{x.pressed}}" aria-label="{{x.lockLabel}}" onClick="{{x.toggle}}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{x.d}}"/></svg></button>
                <span class="k">{{x.level}}</span>
                <div class="t1" style="font-size:18px;padding-right:44px">{{x.name}}</div>
                <div class="muted">{{x.sub}}</div>
                <sc-if value="{{x.isHold}}" hint-placeholder-val="{{ false }}"><div style="display:flex;flex-direction:column;gap:6px"><div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{{x.holdN}}" aria-label="{{x.holdLabel}}"><i style="width:{{x.holdN}}%"></i></div><button class="btn f sm" onClick="{{x.hold}}">{{x.holdLabel}}</button></div></sc-if>
                <sc-if value="{{x.isPass}}" hint-placeholder-val="{{ false }}"><div class="cols"><input class="field" style="flex:1;height:44px;min-width:140px" type="password" aria-label="{{x.passLabel}}" placeholder="{{x.passLabel}}" value="" onInput="{{x.onPass}}"><button class="btn f sm" onClick="{{x.passGo}}">{{x.passBtn}}</button></div></sc-if>
                <div class="cols" style="margin-top:auto"><button class="{{x.editCls}}" onClick="{{x.edit}}">{{x.editLabel}}</button><span class="tag {{x.tagCls}}">{{x.tag}}</span></div>
              </div>
            </sc-for>
          </div>
        </section>

        <section class="card ov rise {{cc.ladder}}" aria-label="{{t.ladderTitle}}">
          ${h2tile('t.ladderTitle','ladder')}
          <div class="muted">{{t.ladderSub}}</div>
          <div class="ladder" role="group" aria-label="{{t.ladderTitle}}">
            <sc-for list="{{rungs}}" as="r" hint-placeholder-count="5"><button class="rung" aria-pressed="{{r.pressed}}" onClick="{{r.pick}}"><span class="num">{{r.n}}</span><span class="grow"><b style="font-size:15px">{{r.name}}</b><span class="t2" style="display:block;margin:0">{{r.sub}}</span></span></button></sc-for>
          </div>
          <div class="sample" style="padding:14px 16px;border-radius:20px;background:var(--surf-low)"><span class="k">{{t.ladderNeeds}}</span><div class="t1" style="margin-top:4px">{{rungNeeds}}</div></div>
        </section>
      </div>

      <div class="dash">
        <section class="card ter ov rise {{cc.reboot}}" aria-label="{{t.rebootTitle}}">
          ${h2tile('t.rebootTitle','reboot').replace('class="info"','class="info" style="background:color-mix(in srgb,var(--on-tertiary-c) 14%,transparent);color:inherit"').replace('class="lock"','class="lock" style="color:inherit"')}
          <div class="muted" style="color:inherit;opacity:.88">{{t.rebootSub}}</div>
          <div class="big" style="font-size:40px">{{t.rebootBig}}</div>
          <div class="muted" style="color:inherit;opacity:.88">{{t.rebootEffects}}</div>
          <button class="btn f {{rebootDis}}" style="align-self:flex-start;background:var(--bad);color:#fff" onClick="{{openDlg}}">${ic('M20 12a8 8 0 1 1-2.5-5.8 M20 4v5h-5',20)}{{t.rebootBtn}}</button>
          <sc-if value="{{rebooted}}" hint-placeholder-val="{{ false }}"><div class="tag good" style="align-self:flex-start">{{t.rebooted}}</div></sc-if>
          <div class="row" style="border-color:color-mix(in srgb,currentColor 20%,transparent)"><div class="grow"><div class="t1">{{t.lastReboot}}</div><div class="t2" style="color:inherit;opacity:.8">{{t.lastRebootSub}}</div></div></div>
          <div class="row" style="border-color:color-mix(in srgb,currentColor 20%,transparent)"><div class="grow"><div class="t1">{{t.needs}}</div><div class="t2" style="color:inherit;opacity:.8">{{t.needsSub}}</div></div><span class="badge">3</span></div>
        </section>

        <section class="card span2 ov rise {{cc.auth}}" aria-label="{{t.authTitle}}">
          <div class="cols">
            <div class="grow" style="min-width:220px">${h2tile('t.authTitle','auth')}<div class="muted">{{t.authSub}}</div></div>
            <button class="btn t sm" onClick="{{togglePair}}">${ic('M12 5v14M5 12h14',18)}{{pairBtn}}</button>
          </div>
          <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
            <sc-for list="{{codes}}" as="c" hint-placeholder-count="3">
              <div class="codebox">
                <svg class="ring" viewBox="0 0 40 40" aria-hidden="true"><circle class="bg" cx="20" cy="20" r="16"/><circle class="fg" cx="20" cy="20" r="16" pathLength="100" style="{{c.ringStyle}}"/></svg>
                <div class="grow" style="min-width:0"><div class="t2" style="margin:0">{{c.who}}</div><div class="big mono" style="font-size:34px;letter-spacing:2px;font-stretch:100%">{{c.code}}</div><div class="area-note">{{c.left}}</div></div>
                <button class="btn t sm" onClick="{{c.copy}}" aria-label="{{c.copyLabel}}">{{c.copyText}}</button>
              </div>
            </sc-for>
          </div>
          <sc-if value="{{pairing}}" hint-placeholder-val="{{ true }}">
            <div class="cols" style="align-items:flex-start;gap:24px;padding:20px;border-radius:28px;background:var(--surf-low)">
              <svg class="qr" width="196" height="196" viewBox="-1 -1 ${N+2} ${N+2}" role="img" aria-label="{{t.qrAlt}}"><path d="${qrPath}" fill="#14161f" fill-rule="evenodd"/></svg>
              <div style="flex:1 1 260px;min-width:240px;display:flex;flex-direction:column;gap:10px">
                <h3 class="h2" style="font-size:19px;margin:0">{{t.pairTitle}}</h3>
                <ol class="muted" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px"><li>{{t.pair1}}</li><li>{{t.pair2}}</li><li>{{t.pair3}}</li></ol>
                <div class="cols"><span class="mono t1" style="letter-spacing:1px">{{secretShown}}</span><button class="btn o sm" onClick="{{toggleReveal}}">{{revealBtn}}</button></div>
                <div class="cols"><label class="lbl" for="vcode">{{t.verify}}</label><input id="vcode" class="field mono" inputmode="numeric" maxlength="7" style="width:140px;height:44px" placeholder="000 000" value="{{vin}}" onInput="{{onVin}}"><button class="btn f sm" onClick="{{doVerify}}">{{t.verifyBtn}}</button></div>
                <sc-if value="{{verOk}}" hint-placeholder-val="{{ false }}"><span class="tag good" style="align-self:flex-start">{{t.verOk}}</span></sc-if>
                <sc-if value="{{verBad}}" hint-placeholder-val="{{ false }}"><span class="tag bad" style="align-self:flex-start">{{t.verBad}}</span></sc-if>
              </div>
            </div>
          </sc-if>
        </section>
      </div>

      <section class="card ov rise {{cc.desk}}" aria-label="{{t.deskTitle}}">
        <div class="cols">
          <div class="grow" style="min-width:220px">${h2tile('t.deskTitle','desk')}<div class="muted">{{t.deskSub}}</div></div>
          <button class="btn o sm" onClick="{{selectAllT}}">{{t.selectAll}}</button>
        </div>
        <sc-if value="{{hasSel}}" hint-placeholder-val="{{ false }}"><div class="glass" role="region" aria-label="{{t.bulk}}" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-radius:22px;padding:8px 8px 8px 20px"><b style="flex:1;min-width:140px">{{selText}}</b><button class="btn t sm" onClick="{{bulkClose}}">{{t.closeT}}</button><button class="btn o sm" onClick="{{clearSel}}">{{t.clear}}</button></div></sc-if>
        <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(420px,1fr));align-items:flex-start;gap:24px">
          <div>
            <sc-for list="{{tickets}}" as="k" hint-placeholder-count="3">
              <div class="tkt">
                <button class="cbw" role="checkbox" aria-checked="{{k.checked}}" aria-label="{{k.selLabel}}" onClick="{{k.toggle}}"><span class="{{k.cbCls}}">${CHK}</span></button>
                <div class="grow" style="min-width:180px"><div class="t1">{{k.subject}}</div><div class="t2">{{k.id}} · {{k.when}} · {{k.who}}</div></div>
                <span class="tag {{k.cls}}">{{k.status}}</span>
                <button class="info" aria-label="{{t.rowMenu}}" aria-haspopup="menu" aria-expanded="{{k.menuOpen}}" onClick="{{k.more}}">${DOTS}</button>
                <sc-if value="{{k.menuOpen}}" hint-placeholder-val="{{ false }}"><div class="menu" role="menu" style="right:0;top:52px"><button class="mi" role="menuitem" onClick="{{k.advance}}">{{k.advLabel}}</button><button class="mi" role="menuitem" onClick="{{k.more}}">{{t.copyId}}</button><button class="mi" role="menuitem" onClick="{{k.close}}">{{t.closeT}}</button></div></sc-if>
              </div>
            </sc-for>
            <sc-if value="{{noTickets}}" hint-placeholder-val="{{ false }}"><div class="muted" style="padding:24px 0">{{t.noTickets}}</div></sc-if>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;padding:20px;border-radius:28px;background:var(--surf-low)">
            <h3 class="h2" style="font-size:19px;margin:0">{{t.newTicket}}</h3>
            <div><div class="lbl" style="margin-bottom:6px">{{t.reason}}</div><div class="seg" role="group" aria-label="{{t.reason}}" style="flex-wrap:wrap"><sc-for list="{{reasons}}" as="o" hint-placeholder-count="4"><button aria-pressed="{{o.pressed}}" onClick="{{o.pick}}">{{o.label}}</button></sc-for></div></div>
            <div style="display:flex;flex-direction:column;gap:6px"><label class="lbl" for="tmsg">{{t.message}}</label><textarea id="tmsg" class="field" style="height:96px;padding:12px 16px;resize:vertical" onInput="{{onMsg}}">{{msg}}</textarea></div>
            <div class="cols"><button class="btn f sm {{submitCls}}" onClick="{{submitTicket}}">{{t.submit}}</button><span class="area-note">{{t.deskNote}}</span></div>
            <sc-if value="{{justSent}}" hint-placeholder-val="{{ false }}"><span class="tag good" style="align-self:flex-start">{{t.sent}}</span></sc-if>
          </div>
        </div>
      </section>
`;
const dlg=`    <sc-if value="{{dlg}}" hint-placeholder-val="{{ false }}">
      <div class="scrim" role="presentation"><div class="sheet" role="dialog" aria-modal="true" aria-label="{{t.dlgTitle}}">
        <div class="cols"><span class="cookie" style="width:56px;height:56px;color:var(--bad-c)" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg><svg viewBox="0 0 24 24" fill="none" stroke="var(--bad)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px;grid-area:1/1;fill:none"><path d="{{d.warn}}"/></svg></span>
          <div class="grow"><h2 class="h2">{{t.dlgTitle}}</h2><div class="muted">{{t.dlgSub}}</div></div>
          <button class="icb" aria-label="{{t.cancel}}" onClick="{{closeDlg}}">${ic('M6 6l12 12M18 6L6 18',22)}</button></div>
        <div class="keyslot {{k1cls}}"><span class="cookie" style="width:44px;height:44px;color:var(--primary)" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg>${ic('M15 8a4 4 0 1 1-3.5 6L4 21v-3l2-2v-2l2-1 3.5-3.5A4 4 0 0 1 15 8z',20,2.2).replace('<svg ','<svg style="color:#fff" ')}</span><div class="grow"><div class="t1">{{t.key1}}</div><div class="t2">{{t.key1Sub}}</div></div><button class="btn t sm" onClick="{{turn1}}">{{k1btn}}</button></div>
        <div class="keyslot {{k2cls}}"><span class="cookie" style="width:44px;height:44px;color:var(--tertiary)" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg>${ic('M15 8a4 4 0 1 1-3.5 6L4 21v-3l2-2v-2l2-1 3.5-3.5A4 4 0 0 1 15 8z',20,2.2).replace('<svg ','<svg style="color:#fff" ')}</span><div class="grow"><div class="t1">{{t.key2}}</div><div class="t2">{{t.key2Sub}}</div></div><button class="btn t sm" onClick="{{turn2}}">{{k2btn}}</button></div>
        <div class="cols"><label class="lbl" for="ph">{{t.phrase}}</label><input id="ph" class="field mono" style="flex:1;height:48px;min-width:200px" placeholder="REBOOT 198.51.100.1" value="{{phrase}}" onInput="{{onPhrase}}"><span class="tag {{phraseCls}}">{{phraseTag}}</span></div>
        <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="3" aria-valuenow="{{stepsDone}}" aria-label="{{t.dlgProgress}}"><i style="width:{{stepsPct}}%"></i></div>
        <div class="cols" style="justify-content:flex-end"><button class="btn o" onClick="{{closeDlg}}">{{t.cancel}}</button><button class="btn f {{goDis}}" style="background:var(--bad);color:#fff" onClick="{{go}}">{{t.rebootNow}}</button></div>
      </div></div>
    </sc-if>`;
html+=SHELL('settings','t.title',0,inner,dlg);

const script=`
    const defs = {
      toys: [T('element locks', '元素鎖'), T('Lock any card to stop accidental edits. A locked card keeps showing its data but its controls are disabled.', '鎖住任何卡片可以避免誤改。上鎖嘅卡片仍然顯示資料，但控制項會停用。')],
      ladder: [T('unlock ladder', '解鎖階梯'), T('The riskier the change, the more steps are needed to unlock it.', '變更風險越高，解鎖需要嘅步驟越多。')],
      reboot: [T('router reboot', '路由器重啟'), T('Rebooting drops every connection, so it needs two different people to confirm.', '重啟會中斷所有連線，所以需要兩個唔同嘅人確認。')],
      auth: [T('built-in authenticator', '內置驗證器'), T('Time-based codes that refresh every 30 seconds. Secrets never leave this device.', '每 30 秒更新一次嘅限時驗證碼，密鑰唔會離開呢部裝置。')],
      desk: [T('recovery desk', '復原服務台'), T('Locked out? Open a ticket. A second owner must approve before access returns.', '被鎖喺外面？開一張工單，另一位擁有人批准之後先會恢復存取。')]
    };
    const { lk, tips, cc } = mk(defs);
    const hashN = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

    // ---- toy element locks ----
    const dl = s.dl || { wifi: false, fw: true, pf: false, dns: true };
    const hold = s.hold || {};
    const passOk = s.passOk || {};
    const passIn = s.passIn || {};
    const TOY = [
      ['wifi', 'toy', T('Wi-Fi password', 'Wi-Fi 密碼'), T('Home-5G · WPA3 · last changed 12 days ago', 'Home-5G · WPA3 · 12 日前更改'), T('Toy lock: one click', '輕量鎖：撳一下')],
      ['fw', 'hold', T('Firewall rules', '防火牆規則'), T('14 rules · 2 block lists · IPv6 on', '14 條規則 · 2 個封鎖清單 · IPv6 已開'), T('Hold to unlock', '長按解鎖')],
      ['pf', 'pass', T('Port forwards', '端口轉發'), T('32400 to NAS 198.51.100.20 · 8 rules', '32400 轉去 NAS 198.51.100.20 · 8 條規則'), T('Owner password', '擁有人密碼')],
      ['dns', 'toy', T('DNS servers', 'DNS 伺服器'), T('198.51.100.2 with DNS over TLS', '198.51.100.2，DNS over TLS'), T('Toy lock: one click', '輕量鎖：撳一下')]
    ];
    const toys = TOY.map(([id, kind, name, sub, level]) => {
      const locked = !!dl[id];
      const hN = hold[id] || 0;
      const ok = !!passOk[id];
      const setDl = (v) => canWrite && set({ dl: Object.assign({}, dl, { [id]: v }), hold: Object.assign({}, hold, { [id]: 0 }), passOk: Object.assign({}, passOk, { [id]: false }) });
      return {
        name, sub, level, cls: 'toyl' + (locked ? ' locked' : ''), pressed: locked ? 'true' : 'false', d: locked ? 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4' : 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 7.5-2',
        lockLabel: (locked ? T('Unlock ', '解鎖 ') : T('Lock ', '鎖定 ')) + name,
        toggle: () => { if (!canWrite) return; if (!locked) return setDl(true); if (kind === 'toy') return setDl(false); set({ hold: Object.assign({}, hold, { [id]: 0 }) }); },
        isHold: locked && kind === 'hold', holdN: hN, holdLabel: T('Hold to unlock ', '長按解鎖 ') + hN + '%',
        hold: () => { if (!canWrite) return; const n = Math.min(100, hN + 34); if (n >= 100) setDl(false); else set({ hold: Object.assign({}, hold, { [id]: n }) }); },
        isPass: locked && kind === 'pass', passLabel: T('Owner password', '擁有人密碼'), passBtn: T('Unlock', '解鎖'),
        onPass: (e) => set({ passIn: Object.assign({}, passIn, { [id]: txt(e) }) }),
        passGo: () => { if ((passIn[id] || '').length >= 8) setDl(false); },
        editLabel: T('Edit', '編輯'), editCls: 'btn f sm' + (locked || !canWrite ? ' dis' : ''), edit: () => {},
        tag: locked ? T('Locked', '已鎖定') : T('Editable', '可編輯'), tagCls: locked ? 'warn' : 'good'
      };
    });
    const nLocked = Object.keys(dl).filter(k => dl[k]).length;

    // ---- ladder ----
    const rung = s.rung === undefined ? 1 : s.rung;
    const RUNGS = [
      [T('Toy lock', '輕量鎖'), T('One click. Stops accidental edits.', '撳一下，防止誤改。'), T('Wi-Fi password, DNS servers, display names', 'Wi-Fi 密碼、DNS 伺服器、顯示名稱')],
      [T('Hold to unlock', '長按解鎖'), T('Press and hold for two seconds.', '長按兩秒。'), T('Firewall rules, parental schedules, QoS', '防火牆規則、家長監護時間表、QoS')],
      [T('Owner password', '擁有人密碼'), T('Type the owner password again.', '再輸入一次擁有人密碼。'), T('Port forwards, VPN keys, remote access', '端口轉發、VPN 密鑰、遠端存取')],
      [T('Two keys', '雙重確認'), T('Two different people confirm.', '兩個唔同嘅人確認。'), T('Reboot, firmware update, factory reset', '重啟、韌體更新、還原出廠設定')],
      [T('Recovery desk', '復原服務台'), T('Open a ticket and wait for approval.', '開工單等待批准。'), T('Lost owner password or authenticator', '遺失擁有人密碼或者驗證器')]
    ];
    const rungs = RUNGS.map((r, i) => ({ n: i, name: r[0], sub: r[1], pressed: rung === i ? 'true' : 'false', pick: () => set({ rung: i }) }));

    // ---- two-key reboot ----
    const dlg = !!s.dlg, k1 = !!s.k1, k2 = !!s.k2, phrase = s.phrase || '';
    const phraseOk = phrase.trim().toUpperCase() === 'REBOOT 198.51.100.1';
    const stepsDone = (k1 ? 1 : 0) + (k2 ? 1 : 0) + (phraseOk ? 1 : 0);
    const canGo = stepsDone === 3 && canWrite;
    const rebooted = !!s.rebooted;

    // ---- authenticator ----
    const step = Math.floor(Date.now() / 30000);
    const left = 30 - (Math.floor(Date.now() / 1000) % 30);
    const fmt6 = (n) => { const v = String(n % 1000000).padStart(6, '0'); return v.slice(0, 3) + ' ' + v.slice(3); };
    const copiedCode = s.cc || '';
    const accts = [['pat', T('Owner · Pat', '擁有人 · Pat')], ['alex', T('Operator · Alex', '操作員 · Alex')], ['ssh', T('SSH admin key', 'SSH 管理金鑰')]];
    const codes = accts.map(([id, who]) => ({
      who, code: fmt6(hashN(id + ':' + step)), left: T('Refreshes in ' + left + ' s', left + ' 秒後更新'),
      ringStyle: 'animation-delay:-' + (30 - left) + 's', copyText: copiedCode === id ? T('Copied', '已複製') : T('Copy', '複製'), copyLabel: T('Copy code for ', '複製驗證碼：') + who, copy: () => set({ cc: id })
    }));
    const pairing = s.pairing !== false;
    const reveal = !!s.reveal;
    const SECRET = 'JBSW Y3DP EHPK 3PXP';
    const pairCode = fmt6(hashN('new:' + step));
    const vin = s.vin || '';
    const vstate = s.vstate || '';

    // ---- recovery desk ----
    const tk = s.tk || [
      { id: 'T-1042', subject: T('Lost owner authenticator', '遺失擁有人驗證器'), when: T('Today 08:14', '今日 08:14'), who: 'Pat', st: 1 },
      { id: 'T-1039', subject: T('Locked out after 5 wrong passwords', '輸入 5 次錯誤密碼被鎖'), when: T('Yesterday', '尋日'), who: 'Alex', st: 2 },
      { id: 'T-1031', subject: T('Suspected intrusion on SSH', '懷疑 SSH 被入侵'), when: T('3 days ago', '3 日前'), who: 'Pat', st: 2 }
    ];
    const tsel = s.tsel || [];
    const tmenu = s.tmenu || '';
    const reason = s.reason || 0;
    const msg = s.msg || '';
    const ST = [[T('Open', '處理中'), 'warn'], [T('Awaiting second key', '等待第二把鑰匙'), 'warn'], [T('Resolved', '已解決'), 'good']];
    const nextAdv = (st) => st >= 2 ? 2 : st + 1;
    const tickets = tk.map(k => ({
      id: k.id, subject: k.subject, when: k.when, who: k.who, status: ST[k.st][0], cls: ST[k.st][1],
      checked: tsel.includes(k.id) ? 'true' : 'false', cbCls: 'cb2' + (tsel.includes(k.id) ? ' on' : ''), selLabel: T('Select ticket ', '揀選工單 ') + k.id,
      menuOpen: tmenu === k.id, advLabel: k.st >= 2 ? T('Reopen', '重新開啟') : T('Advance status', '推進狀態'),
      toggle: () => set({ tsel: tg(tsel, k.id) }), more: () => set({ tmenu: tmenu === k.id ? '' : k.id }),
      advance: () => set({ tk: tk.map(x => x.id === k.id ? Object.assign({}, x, { st: x.st >= 2 ? 0 : nextAdv(x.st) }) : x), tmenu: '' }),
      close: () => set({ tk: tk.filter(x => x.id !== k.id), tmenu: '', tsel: tsel.filter(x => x !== k.id) })
    }));
    const REAS = [T('Lost password', '遺失密碼'), T('Lost authenticator', '遺失驗證器'), T('Locked out', '被鎖喺外'), T('Intrusion', '懷疑入侵')];
    const reasons = REAS.map((label, i) => ({ label, pressed: reason === i ? 'true' : 'false', pick: () => set({ reason: i }) }));

    const t = {
      title: T('Locks and recovery', '鎖同復原'), heroLabel: T('Locks summary', '鎖摘要'),
      chipLocked: nLocked + T(' cards locked', ' 張卡片已鎖'), chipTwoKey: T('Two-key reboot', '雙重確認重啟'), chipTotp: T('Authenticator built in', '內置驗證器'),
      headline: T('Lock what matters', '鎖住重要嘅設定'),
      lede: T('Toy locks stop slips, the unlock ladder asks for more as the risk grows, and risky actions like a reboot need two different people. Locked out? The recovery desk gets you back in.', '輕量鎖防止手滑，風險越高解鎖步驟越多，重啟呢類高風險動作需要兩個唔同嘅人確認。被鎖喺外面？復原服務台幫你返入去。'),
      toysTitle: T('Element locks', '元素鎖'), toysSub: T('Try the locks: each card needs a different way to unlock.', '試下啲鎖：每張卡片有唔同嘅解鎖方式。'), lockAll: T('Lock all', '全部鎖定'), unlockAll: T('Unlock all', '全部解鎖'),
      viewerNote: T('Read-only role: locks cannot be changed.', '唯讀角色：唔可以更改鎖。'),
      ladderTitle: T('Unlock ladder', '解鎖階梯'), ladderSub: T('Pick a rung to see what it protects.', '揀一級睇睇佢保護咩。'), ladderNeeds: T('Protects', '保護範圍'),
      rebootTitle: T('Reboot the router', '重啟路由器'), rebootSub: T('A two-key action.', '需要雙重確認嘅動作。'), rebootBig: T('2 keys', '2 把鑰匙'), rebootEffects: T('Drops Wi-Fi for about 90 seconds and ends 12 sessions.', 'Wi-Fi 會中斷約 90 秒，並結束 12 個連線。'), rebootBtn: T('Reboot router', '重啟路由器'), lastReboot: T('Last reboot', '上次重啟'), lastRebootSub: T('3 days 5 hours ago, confirmed by Pat and Alex', '3 日 5 個鐘前，由 Pat 同 Alex 確認'), needs: T('Needs', '需要'), needsSub: T('Two keys and the typed phrase', '兩把鑰匙同輸入確認字句'), rebooted: T('Reboot sent. Wi-Fi returns in about 90 seconds.', '已發出重啟，約 90 秒後 Wi-Fi 恢復。'),
      dlgTitle: T('Reboot RT-AX86U?', '要重啟 RT-AX86U 嗎？'), dlgSub: T('Two different people must turn a key, then type the phrase.', '兩個唔同嘅人要各轉一把鑰匙，再輸入確認字句。'),
      key1: T('Key 1: Pat (owner)', '鑰匙 1：Pat（擁有人）'), key1Sub: T('Confirm with your authenticator code', '用驗證器代碼確認'), key2: T('Key 2: Alex (operator)', '鑰匙 2：Alex（操作員）'), key2Sub: T('Must be a different person from key 1', '必須同鑰匙 1 唔同人'),
      phrase: T('Type to confirm', '輸入確認'), dlgProgress: T('Confirmation progress', '確認進度'), cancel: T('Cancel', '取消'), rebootNow: T('Reboot now', '即時重啟'),
      authTitle: T('Authenticator', '驗證器'), authSub: T('Codes for the owner, the operator and the SSH key.', '擁有人、操作員同 SSH 金鑰嘅驗證碼。'),
      qrAlt: T('QR code for pairing an authenticator app', '配對驗證器應用程式嘅 QR 碼'), pairTitle: T('Pair a new authenticator', '配對新驗證器'),
      pair1: T('Open your authenticator app and choose Add account.', '打開驗證器應用程式，揀「加入帳戶」。'), pair2: T('Scan the QR code, or type the key.', '掃描 QR 碼，或者輸入密鑰。'), pair3: T('Enter the 6-digit code it shows to finish.', '輸入佢顯示嘅 6 位數字完成配對。'),
      verify: T('Check code', '驗證碼'), verifyBtn: T('Verify', '驗證'), verOk: T('Paired. Codes will now match.', '配對成功，驗證碼已經同步。'), verBad: T('That code does not match. Try the next one.', '驗證碼唔符，試下下一個。'),
      deskTitle: T('Recovery desk', '復原服務台'), deskSub: T('Support tickets for lost passwords, lost authenticators and lockouts.', '遺失密碼、遺失驗證器同被鎖喺外嘅支援工單。'),
      selectAll: T('Select all', '全選'), bulk: T('Bulk actions', '批量操作'), closeT: T('Close ticket', '關閉工單'), clear: T('Clear', '清除'), rowMenu: T('Ticket actions', '工單操作'), copyId: T('Copy ticket number', '複製工單編號'),
      noTickets: T('No open tickets. Everything is recovered.', '冇未處理工單，全部已復原。'), newTicket: T('New recovery ticket', '新增復原工單'), reason: T('What happened', '發生咗乜事'), message: T('Details', '詳情'),
      submit: T('Send to the second owner', '送交第二位擁有人'), deskNote: T('Not in the real app yet: email approval links.', '真實應用程式未有：電郵批准連結。'), sent: T('Ticket sent. Waiting for the second key.', '工單已送出，等待第二把鑰匙。')
    };
    const speakStep = Math.max(stepsDone, 0);
    const submit = () => { if (!canWrite) return; set({ tk: [{ id: 'T-' + (1043 + tk.length), subject: REAS[reason] + (msg ? ': ' + msg.slice(0, 30) : ''), when: T('Just now', '啱啱'), who: 'Pat', st: 1 }].concat(tk), msg: '', justSent: true }); };

    return Object.assign(base([T('Settings', '設定'), T('Locks', '鎖'), T('Recovery', '復原')]), {
      lk, tips, cc, t, d: D, toys, lockAllDis: canWrite ? '' : 'dis',
      lockAll: () => canWrite && set({ dl: { wifi: true, fw: true, pf: true, dns: true } }), unlockAll: () => canWrite && set({ dl: { wifi: false, fw: false, pf: false, dns: false }, hold: {}, passOk: {} }),
      rungs, rungNeeds: RUNGS[rung][2],
      rebootDis: canWrite ? '' : 'dis', openDlg: () => canWrite && set({ dlg: true, rebooted: false }), closeDlg: () => set({ dlg: false, k1: false, k2: false, phrase: '' }), dlg,
      k1cls: k1 ? 'turned' : '', k2cls: k2 ? 'turned' : '', k1btn: k1 ? T('Turned', '已轉') : T('Turn key 1', '轉鑰匙 1'), k2btn: k2 ? T('Turned', '已轉') : T('Turn key 2', '轉鑰匙 2'),
      turn1: () => set({ k1: !k1 }), turn2: () => set({ k2: !k2 }), phrase, onPhrase: (e) => set({ phrase: txt(e) }),
      phraseCls: phraseOk ? 'good' : '', phraseTag: phraseOk ? T('Matches', '符合') : T('Not yet', '未符合'),
      stepsDone, stepsPct: Math.round(stepsDone / 3 * 100), goDis: canGo ? '' : 'dis', go: () => { if (canGo) set({ dlg: false, k1: false, k2: false, phrase: '', rebooted: true }); }, rebooted,
      codes, pairing, togglePair: () => set({ pairing: !pairing }), pairBtn: pairing ? T('Hide pairing', '隱藏配對') : T('Pair a new authenticator', '配對新驗證器'),
      secretShown: reveal ? SECRET : '•••• •••• •••• ••••', toggleReveal: () => set({ reveal: !reveal }), revealBtn: reveal ? T('Hide key', '隱藏密鑰') : T('Show key', '顯示密鑰'),
      vin, onVin: (e) => set({ vin: txt(e), vstate: '' }), doVerify: () => set({ vstate: vin.replace(/\\s/g, '') === pairCode.replace(' ', '') ? 'ok' : 'bad' }), verOk: vstate === 'ok', verBad: vstate === 'bad',
      tickets, noTickets: tickets.length === 0, hasSel: tsel.length > 0, selText: tsel.length + T(' selected', ' 項已選'),
      selectAllT: () => set({ tsel: tk.map(k => k.id) }), clearSel: () => set({ tsel: [] }), bulkClose: () => set({ tk: tk.filter(k => !tsel.includes(k.id)), tsel: [] }),
      reasons, msg, onMsg: (e) => set({ msg: txt(e), justSent: false }), submitTicket: submit, submitCls: canWrite ? '' : 'dis', justSent: !!s.justSent
    });`;
html+=wrapScript(script);
C.write('Locks.dc.html',html);
console.log('ok',html.length);
