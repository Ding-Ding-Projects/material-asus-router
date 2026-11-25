const C=require('./common.js');
const {ic,INFO,DOTS,CHK,tile,h2tile,HEAD,SHELL,wrapScript,COOKIE,BLOB1,BLOB2,SCALLOP}=C;

const css=`.main{position:relative}
.scrim{z-index:40}
.scrim .sheet{position:sticky;top:72px;width:min(980px,100%);max-height:none}
.wstrip{display:flex;align-items:flex-end;gap:4px;padding:10px 12px 0;border-radius:24px 24px 0 0;background:var(--surf-high);flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin}
.wtab{display:flex;align-items:center;gap:8px;height:42px;padding:0 6px 0 14px;border-radius:14px 14px 0 0;border:0;background:transparent;color:var(--sub);font:650 13.5px var(--font);white-space:nowrap;flex:none}
.wtab[aria-selected=true]{background:var(--surf);color:var(--text)}
.wtab .x{width:28px;height:28px;border-radius:14px;display:grid;place-items:center;background:transparent;border:0;color:inherit;padding:0}
.wtab .x:hover{background:var(--surf-high)}
.wbody{padding:16px;border-radius:0 0 24px 24px;background:var(--surf);border:1px solid var(--line);border-top:0}
.rt{display:flex;align-items:center;gap:14px;padding:12px 0;border-top:1px solid var(--line);flex-wrap:wrap}
.rt:first-of-type{border-top:0}
.catgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;max-height:350px;overflow-y:auto;padding:2px}
.dest{display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 12px;border:1.5px solid var(--line);border-radius:18px;background:var(--surf);color:var(--text);font:inherit;text-align:left;position:relative}
.dest:hover{background:var(--surf-high)}
.dest.isopen{border-color:var(--primary);background:var(--primary-c);color:var(--on-primary-c)}
.dest .ico{width:36px;height:36px;flex:none;color:var(--primary);display:inline-grid;place-items:center}
.dest.isopen .ico{color:var(--on-primary-c)}
.dest .ico svg:first-child{grid-area:1/1;width:100%;height:100%;fill:currentColor;opacity:.18}
.dest .ico svg:last-child{grid-area:1/1;width:18px;height:18px;opacity:1}
.dest .nm{flex:1;min-width:0;font-weight:650;font-size:14px;line-height:1.25}
.dest .gp{display:block;font-size:11.5px;font-weight:600;opacity:.72}
.rxpanel{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:20px;background:var(--surf-low);border:1px solid var(--line)}
.hl{background:color-mix(in srgb,var(--warn) 45%,transparent);border-radius:4px}
.allgrid{display:flex;flex-wrap:wrap;gap:6px;max-height:210px;overflow-y:auto}
.ochip{display:inline-flex;align-items:center;gap:4px;height:36px;padding:0 4px 0 12px;border-radius:12px;background:var(--surf-high);font-size:13px;font-weight:650}
.ochip button{width:28px;height:28px;border:0;border-radius:14px;background:transparent;color:var(--sub);display:grid;place-items:center;padding:0}`;

let html=HEAD('New tab catalog and workspace tabs',css);

const inner=`
      <section class="card hero rise" aria-label="{{t.heroLabel}}" style="min-height:220px">
        <svg class="deco a" viewBox="0 0 200 200" aria-hidden="true" style="right:-70px;top:-85px;width:330px;height:330px"><path d="${SCALLOP}"/></svg>
        <svg class="deco b" viewBox="0 0 200 200" aria-hidden="true" style="right:290px;bottom:-125px;width:250px;height:250px"><path d="${BLOB1}"/></svg>
        <div class="cookie" style="position:absolute;right:66px;top:42px;width:124px;height:124px;color:var(--tertiary-c)" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--on-tertiary-c)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:52px;height:52px;grid-area:1/1;fill:none"><path d="{{d.plus}}"/></svg></div>
        <div style="position:relative;display:flex;flex-wrap:wrap;gap:8px"><span class="tag onp">{{openCount}}</span><span class="tag onp">{{t.chipWs}}</span><span class="tag onp">{{t.chipDest}}</span></div>
        <h1 class="disp" style="position:relative;max-width:16ch">{{t.headline}}</h1>
        <p class="lede" style="position:relative;color:color-mix(in srgb,var(--on-primary) 86%,transparent)">{{t.lede}}</p>
        <div class="cols" style="position:relative;margin-top:4px">
          <button class="btn sm" style="background:var(--surf);color:var(--text)" onClick="{{openDlg}}">${ic('M12 5v14M5 12h14',18)}{{t.newTab}}</button>
          <button class="btn sm" style="background:color-mix(in srgb,var(--on-primary) 18%,transparent);color:inherit" onClick="{{openEvery}}">{{t.openEvery}}</button>
        </div>
      </section>

      <div class="dash">
        <section class="card span2 ov rise {{cc.strip}}" aria-label="{{t.stripTitle}}">
          ${h2tile('t.stripTitle','strip')}
          <div class="muted">{{t.stripSub}}</div>
          <div>
            <div class="wstrip" role="tablist" aria-label="{{t.stripTitle}}">
              <sc-for list="{{strip}}" as="w" hint-placeholder-count="6"><div class="wtab" role="tab" aria-selected="{{w.sel}}"><button style="all:unset;cursor:pointer;display:flex;align-items:center;gap:8px;min-height:40px" onClick="{{w.focus}}">{{w.name}}</button><button class="x" aria-label="{{w.closeLabel}}" onClick="{{w.close}}">${ic('M6 6l12 12M18 6L6 18',14,2.2)}</button></div></sc-for>
              <button class="wtab" style="padding:0 10px;font-size:20px" aria-label="{{t.newTab}}" onClick="{{openDlg}}">${ic('M12 5v14M5 12h14',20,2.2)}</button>
              <button class="wtab" onClick="{{toggleAll}}" aria-expanded="{{allOpenList}}">{{moreText}}</button>
            </div>
            <div class="wbody"><div class="t1">{{activeName}}</div><div class="muted">{{t.activeSub}}</div></div>
          </div>
          <sc-if value="{{showAll}}" hint-placeholder-val="{{ false }}">
            <div class="cols"><b class="t1 grow">{{t.allOpen}}</b><button class="btn o sm" onClick="{{closeOthers}}">{{t.closeOthers}}</button></div>
            <div class="allgrid" role="list"><sc-for list="{{allOpen}}" as="o" hint-placeholder-count="12"><span class="ochip" role="listitem"><button style="all:unset;cursor:pointer;min-height:36px" onClick="{{o.focus}}">{{o.name}}</button><button aria-label="{{o.closeLabel}}" onClick="{{o.close}}">${ic('M6 6l12 12M18 6L6 18',14,2.2)}</button></span></sc-for></div>
          </sc-if>
          <div class="cols"><b class="t1">{{t.recent}}</b>
            <sc-for list="{{closed}}" as="c" hint-placeholder-count="3"><button class="chip" onClick="{{c.restore}}">${ic('M20 12a8 8 0 1 1-2.5-5.8 M20 4v5h-5',16)}{{c.name}}</button></sc-for>
            <sc-if value="{{noClosed}}" hint-placeholder-val="{{ false }}"><span class="muted">{{t.noClosed}}</span></sc-if>
            <span class="sp"></span><button class="btn t sm {{restoreDis}}" onClick="{{restoreLast}}">{{t.restoreLast}}</button></div>
        </section>

        <section class="card ov rise {{cc.ws}}" aria-label="{{t.wsTitle}}">
          ${h2tile('t.wsTitle','ws')}
          <div class="muted">{{t.wsSub}}</div>
          <sc-for list="{{routers}}" as="r" hint-placeholder-count="3">
            <div class="rt"><span class="cookie" style="width:44px;height:44px;color:{{r.color}}" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg>${ic('M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h.01',20,2.2).replace('<svg ','<svg style="color:#fff" ')}</span>
              <div class="grow" style="min-width:140px"><div class="t1">{{r.name}}</div><div class="t2">{{r.sub}}</div></div>
              <span class="tag {{r.tagCls}}">{{r.tag}}</span>
              <button class="btn t sm" onClick="{{r.open}}">{{r.btn}}</button></div>
          </sc-for>
          <sc-if value="{{wsMsg}}" hint-placeholder-val="{{ false }}"><div class="tag good" role="status" style="align-self:flex-start">{{wsMsgText}}</div></sc-if>
          <div class="area-note">{{t.wsNote}}</div>
        </section>
      </div>

      <section class="card ov rise {{cc.manage}}" aria-label="{{t.manageTitle}}">
        <div class="cols"><div class="grow" style="min-width:220px">${h2tile('t.manageTitle','manage')}<div class="muted">{{t.manageSub}}</div></div>
          <button class="btn o sm" onClick="{{selectAllTabs}}">{{t.selectAll}}</button></div>
        <sc-if value="{{hasSel}}" hint-placeholder-val="{{ false }}"><div class="glass" role="region" aria-label="{{t.bulk}}" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-radius:22px;padding:8px 8px 8px 20px"><b style="flex:1;min-width:140px">{{selText}}</b><button class="btn t sm" onClick="{{bulkPin}}">{{t.pin}}</button><button class="btn t sm" onClick="{{bulkClose}}">{{t.closeSel}}</button><button class="btn o sm" onClick="{{clearSel}}">{{t.clear}}</button></div></sc-if>
        <div style="max-height:360px;overflow-y:auto">
          <sc-for list="{{manage}}" as="m" hint-placeholder-count="8">
            <div class="row pos">
              <button class="cbw" role="checkbox" aria-checked="{{m.checked}}" aria-label="{{m.selLabel}}" onClick="{{m.toggle}}"><span class="{{m.cbCls}}">${CHK}</span></button>
              <span class="cookie" style="width:36px;height:36px;color:var(--primary-c)" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg><svg viewBox="0 0 24 24" fill="none" stroke="var(--on-primary-c)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;grid-area:1/1;fill:none"><path d="{{m.d}}"/></svg></span>
              <div class="grow"><div class="t1">{{m.name}}</div><div class="t2">{{m.group}}</div></div>
              <sc-if value="{{m.pinned}}" hint-placeholder-val="{{ false }}"><span class="tag">{{t.pinned}}</span></sc-if>
              <button class="info" aria-label="{{t.rowMenu}}" aria-haspopup="menu" aria-expanded="{{m.menuOpen}}" onClick="{{m.more}}">${DOTS}</button>
              <sc-if value="{{m.menuOpen}}" hint-placeholder-val="{{ false }}"><div class="menu" role="menu" style="right:0;top:50px"><button class="mi" role="menuitem" onClick="{{m.pin}}">{{m.pinLabel}}</button><button class="mi" role="menuitem" onClick="{{m.focus}}">{{t.focusTab}}</button><button class="mi" role="menuitem" onClick="{{m.close}}">{{t.closeTab}}</button></div></sc-if>
            </div>
          </sc-for>
        </div>
      </section>
`;
const dlg=`    <sc-if value="{{dlg}}" hint-placeholder-val="{{ true }}">
      <div class="scrim" role="presentation"><div class="sheet" role="dialog" aria-modal="true" aria-label="{{t.dlgTitle}}">
        <div class="cols"><div class="grow"><h2 class="h2" style="font-size:26px">{{t.dlgTitle}}</h2><div class="muted">{{t.dlgSub}}</div></div><button class="icb" aria-label="{{t.close}}" onClick="{{closeDlg}}">${ic('M6 6l12 12M18 6L6 18',22)}</button></div>
        <div class="cols">
          <div class="search" style="flex:1 1 300px">${ic('M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z M21 21l-4.3-4.3',20)}<input type="text" value="{{q}}" onInput="{{onQ}}" placeholder="{{t.searchPh}}" aria-label="{{t.searchPh}}"><button class="rxbtn" aria-pressed="{{rxP}}" aria-label="{{t.rxLabel}}" aria-expanded="{{rxP}}" onClick="{{toggleRx}}">.*</button></div>
          <span class="tag">{{resultText}}</span>
        </div>
        <sc-if value="{{rx}}" hint-placeholder-val="{{ false }}">
          <div class="rxpanel" role="group" aria-label="{{t.rxLabel}}">
            <div class="cols"><b class="t1">{{t.rxLabel}}</b><span class="tag {{rxCls}}">{{rxMsg}}</span><span class="sp"></span>
              <button class="chip" aria-pressed="{{flagI}}" onClick="{{toggleI}}"><span class="mono">i</span> {{t.ignoreCase}}</button></div>
            <div class="cols"><label class="lbl" for="rxp">{{t.pattern}}</label><input id="rxp" class="field mono" style="flex:1;height:44px;min-width:220px" value="{{q}}" onInput="{{onQ}}"><span class="mono lbl">{{rxShown}}</span></div>
            <div class="cols"><span class="lbl">{{t.insert}}</span><sc-for list="{{tokens}}" as="k" hint-placeholder-count="6"><button class="chip mono" onClick="{{k.add}}" title="{{k.tip}}" aria-label="{{k.tip}}">{{k.label}}</button></sc-for></div>
            <div class="area-note">{{rxExplain}}</div>
          </div>
        </sc-if>
        <div class="cols" role="group" aria-label="{{t.filters}}"><sc-for list="{{groups}}" as="g" hint-placeholder-count="5"><button class="chip" aria-pressed="{{g.pressed}}" onClick="{{g.pick}}">{{g.label}}<span class="badge" style="height:18px;min-width:18px;font-size:11px">{{g.n}}</span></button></sc-for></div>
        <div class="catgrid" role="listbox" aria-label="{{t.dlgTitle}}">
          <sc-for list="{{items}}" as="i" hint-placeholder-count="12"><button class="{{i.cls}}" role="option" aria-selected="{{i.isOpen}}" onClick="{{i.pick}}"><span class="ico"><svg viewBox="0 0 200 200" aria-hidden="true"><path d="${COOKIE}"/></svg><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{i.d}}"/></svg></span><span class="nm">{{i.name}}<span class="gp">{{i.group}}</span></span><sc-if value="{{i.isOpen}}" hint-placeholder-val="{{ false }}"><span aria-label="{{t.alreadyOpen}}">${ic('M5 12.5l4.5 4.5L19 7.5',18,2.4)}</span></sc-if></button></sc-for>
          <sc-if value="{{noItems}}" hint-placeholder-val="{{ false }}"><div class="muted" style="grid-column:1/-1;padding:28px;text-align:center">{{t.noMatch}}</div></sc-if>
        </div>
        <div class="cols"><span class="area-note">{{t.dlgKeys}}</span><span class="sp"></span><button class="btn t sm" onClick="{{openAllShown}}">{{t.openShown}}</button><button class="btn f sm" onClick="{{closeDlg}}">{{t.done}}</button></div>
      </div></div>
    </sc-if>`;
html+=SHELL('toolbox','t.title',1,inner,dlg);

const script=`
    const defs = {
      strip: [T('workspace tabs', '工作區分頁'), T('One tab per page, tool or destination. Reselecting something already open focuses its tab instead of adding another.', '每個頁面、工具或目的地一個分頁。再次揀已經打開嘅項目只會跳去佢嘅分頁，唔會重複開。')],
      ws: [T('router workspaces', '路由器工作區'), T('Each router gets exactly one workspace tab, keyed by its identity.', '每部路由器只有一個工作區分頁，以路由器身份識別。')],
      manage: [T('open tabs', '已開分頁'), T('Pin, focus or close any tab. Closed tabs can be restored.', '可以釘選、跳轉或者關閉任何分頁，關閉咗嘅分頁可以還原。')]
    };
    const { lk, tips, cc } = mk(defs);

    // ---- catalog ----
    const G = { page: T('Pages', '頁面'), setting: T('Settings', '設定'), tool: T('Tools', '工具'), action: T('Actions', '動作') };
    const DESTS = [
      ['overview', 'page', T('Overview', '概覽'), D.gauge || 'M4 17a8 8 0 1 1 16 0 M12 17l4-5'], ['devices', 'page', T('Devices', '裝置'), D.device], ['wifi', 'page', 'Wi-Fi', D.wifi], ['aimesh', 'page', 'AiMesh', D.route],
      ['internet', 'page', T('Internet', '網絡連線'), D.globe], ['lan', 'page', T('Local network', '區域網絡'), D.box], ['pf', 'page', T('Port forwarding', '端口轉發'), D.ul], ['fw', 'page', T('Firewall', '防火牆'), D.shield],
      ['qos', 'page', T('Traffic priority', '流量優先'), D.bolt], ['vpn', 'page', 'VPN', D.lock], ['parental', 'page', T('Parental controls', '家長監護'), D.user], ['usb', 'page', T('USB and storage', 'USB 同儲存'), D.box],
      ['logs', 'page', T('Logs', '記錄'), D.list], ['nettools', 'page', T('Network tools', '網絡工具'), D.tool], ['jobs', 'page', T('Scheduled jobs', '排程工作'), D.clock], ['firmware', 'page', T('Firmware', '韌體'), D.dl],
      ['system', 'page', T('System', '系統'), D.gear], ['maint', 'page', T('Maintenance', '維護'), D.tool], ['backup', 'page', T('Backup and restore', '備份同還原'), D.refresh], ['merlin', 'page', T('Merlin extras', 'Merlin 擴充'), D.plus],
      ['advanced', 'page', T('Advanced', '進階'), D.list], ['history', 'page', T('Change history', '變更記錄'), D.clock],
      ['appearance', 'setting', T('Appearance and motion', '外觀同動態'), D.palette], ['language', 'setting', T('Language', '語言'), D.globe], ['notif', 'setting', T('Notifications', '通知'), D.bell], ['locks', 'setting', T('Locks and recovery', '鎖同復原'), D.lock],
      ['auth', 'setting', T('Authenticator', '驗證器'), D.key], ['dname', 'setting', T('Display name', '顯示名稱'), D.user], ['sounds', 'setting', T('Action sounds', '動作音效'), D.sound], ['access', 'setting', T('Accessibility', '無障礙'), D.eye],
      ['ping', 'tool', 'Ping', D.route], ['trace', 'tool', 'Traceroute', D.route], ['lookup', 'tool', T('Name lookup', '域名查詢'), D.search], ['speed', 'tool', T('Speed test', '速度測試'), D.bolt],
      ['wol', 'tool', T('Wake on LAN', '網絡喚醒'), D.bolt], ['capture', 'tool', T('Packet capture', '封包擷取'), D.box], ['regex', 'tool', T('Regex builder', '正則表達式生成器'), D.search],
      ['restartwifi', 'action', T('Restart Wi-Fi radios', '重啟 Wi-Fi 無線電'), D.refresh], ['reboot', 'action', T('Reboot router (two keys)', '重啟路由器（雙重確認）'), D.refresh], ['export', 'action', T('Export settings', '匯出設定'), D.dl],
      ['import', 'action', T('Import settings', '匯入設定'), D.ul], ['palette', 'action', T('Open command palette', '開啟指令面板'), D.search], ['guest', 'action', T('Toggle guest Wi-Fi', '切換訪客 Wi-Fi'), D.wifi]
    ];
    const initClosed = ['wol', 'capture', 'import'];
    const open = s.open || DESTS.map(c => c[0]).filter(id => !initClosed.includes(id));
    const pinned = s.pinned || ['overview'];
    const closed = s.closed || initClosed;
    const active = s.active || 'overview';
    const sel = s.sel || [];
    const mmenu = s.mmenu || '';
    const dlgOpen = s.dlg !== false;
    const q = s.q || '';
    const rx = !!s.rx;
    const flagI = s.flagI !== false;
    const grp = s.grp || 'all';
    const showAll = !!s.showAll;
    const nameOf = (id) => DESTS.find(c => c[0] === id)[2];
    const byId = (id) => DESTS.find(c => c[0] === id);

    let re = null, rxBad = false;
    if (rx && q) { try { re = new RegExp(q, flagI ? 'i' : ''); } catch (err) { rxBad = true; } }
    const match = (c) => { if (!q) return true; const hay = c[2] + ' ' + G[c[1]]; if (rx) return re ? re.test(hay) : false; return hay.toLowerCase().includes(q.toLowerCase()); };
    const shown = DESTS.filter(c => match(c) && (grp === 'all' || c[1] === grp));
    const openIt = (id) => { if (open.includes(id)) set({ active: id, wsMsg: '' }); else set({ open: open.concat([id]), active: id, closed: closed.filter(x => x !== id) }); };
    const closeIt = (id) => { const rest = open.filter(x => x !== id); set({ open: rest, closed: [id].concat(closed.filter(x => x !== id)).slice(0, 8), active: active === id ? (rest[0] || '') : active, sel: sel.filter(x => x !== id) }); };
    const items = shown.map(c => ({ d: c[3], name: c[2], group: G[c[1]], isOpen: open.includes(c[0]), cls: 'dest' + (open.includes(c[0]) ? ' isopen' : ''), pick: () => openIt(c[0]) }));
    const groups = [['all', T('All', '全部'), DESTS.length]].concat(Object.keys(G).map(k => [k, G[k], DESTS.filter(c => c[1] === k).length])).map(([id, label, n]) => ({ label, n, pressed: grp === id ? 'true' : 'false', pick: () => set({ grp: id }) }));
    const tokens = [['\\\\w+', T('A word', '一個字')], ['\\\\d+', T('Digits', '數字')], ['.*', T('Anything', '任何字元')], ['^', T('Start of text', '開頭')], ['$', T('End of text', '結尾')], ['(a|b)', T('Either or', '二選一')]].map(([label, tip]) => ({ label, tip, add: () => set({ q: q + label, rx: true }) }));
    const rxMsg = rxBad ? T('Pattern is not valid', '表達式無效') : q ? shown.length + T(' matches', ' 項符合') : T('Type a pattern', '輸入表達式');

    // ---- strip ----
    const stripIds = open.slice(0, 6);
    const strip = stripIds.map(id => ({ name: nameOf(id), sel: active === id ? 'true' : 'false', focus: () => set({ active: id }), closeLabel: T('Close ', '關閉 ') + nameOf(id), close: () => closeIt(id) }));
    const rest = open.length - stripIds.length;
    const allOpen = open.map(id => ({ name: nameOf(id), focus: () => set({ active: id, showAll: false }), closeLabel: T('Close ', '關閉 ') + nameOf(id), close: () => closeIt(id) }));
    const closedList = closed.slice(0, 4).map(id => ({ name: nameOf(id), restore: () => openIt(id) }));

    // ---- router workspaces ----
    const RT = [['home', 'Home RT-AX86U', '198.51.100.1', 'var(--primary)'], ['office', 'Office RT-AC68U', '198.51.100.2', 'var(--tertiary)'], ['cabin', 'Cabin ZenWiFi XD4', '198.51.100.3', '#8a5a00']];
    const wsOpen = s.wsOpen || ['home'];
    const wsMsg = s.wsMsg || '';
    const routers = RT.map(([id, name, ip, color]) => {
      const isO = wsOpen.includes(id);
      return { name, sub: ip, color, tag: isO ? T('Tab open', '分頁已開') : T('No tab', '未開分頁'), tagCls: isO ? 'good' : '', btn: isO ? T('Focus tab', '跳去分頁') : T('Open', '開啟'),
        open: () => isO ? set({ wsMsg: T('Focused the existing tab for ', '已跳去現有分頁：') + name }) : set({ wsOpen: wsOpen.concat([id]), wsMsg: T('Opened a new tab for ', '已開新分頁：') + name }) };
    });

    // ---- manage list ----
    const manage = open.map(id => { const c = byId(id); const on = sel.includes(id), pn = pinned.includes(id); return {
      name: c[2], group: G[c[1]], d: c[3], pinned: pn, checked: on ? 'true' : 'false', cbCls: 'cb2' + (on ? ' on' : ''), selLabel: T('Select tab ', '揀選分頁 ') + c[2],
      menuOpen: mmenu === id, pinLabel: pn ? T('Unpin tab', '取消釘選') : T('Pin tab', '釘選分頁'),
      toggle: () => set({ sel: tg(sel, id) }), more: () => set({ mmenu: mmenu === id ? '' : id }), pin: () => set({ pinned: tg(pinned, id), mmenu: '' }), focus: () => set({ active: id, mmenu: '' }), close: () => { closeIt(id); } }; });

    const t = {
      title: T('New tab and workspaces', '新分頁同工作區'), heroLabel: T('Tabs summary', '分頁摘要'),
      chipWs: T('One tab per router', '每部路由器一個分頁'), chipDest: T(DESTS.length + ' destinations in the catalog', '目錄入面有 ' + DESTS.length + ' 個目的地'),
      headline: T('Everything one click away', '一撳即達'),
      lede: T('Every page, setting, tool and action lives in the New tab catalog. Open as many as you like, close what you do not need, and bring it all back with one click.', '所有頁面、設定、工具同動作都喺「新分頁」目錄入面。想開幾多就開幾多，唔需要就關，一撳就可以全部還原。'),
      newTab: T('New tab', '新分頁'), openEvery: T('Open every tab', '開啟所有分頁'),
      stripTitle: T('Workspace tabs', '工作區分頁'), stripSub: T('Tabs are never opened behind your back. Use New tab or the catalog.', '分頁唔會喺你唔知情下自動開啟，請用「新分頁」或者目錄。'),
      activeSub: T('This is the page you are looking at. Reselecting a tab never creates a duplicate.', '呢個係你而家睇緊嘅頁面，再次揀同一分頁唔會重複建立。'),
      allOpen: T('All open tabs', '全部已開分頁'), closeOthers: T('Close all except active', '關閉除目前以外嘅分頁'),
      recent: T('Recently closed', '最近關閉'), noClosed: T('Nothing closed yet', '暫時冇關閉嘅分頁'), restoreLast: T('Restore last closed', '還原最後關閉'),
      wsTitle: T('Router workspaces', '路由器工作區'), wsSub: T('Open the same router twice and you land on its existing tab.', '重複開同一部路由器，會跳去佢現有嘅分頁。'), wsNote: T('Not in the real app yet: workspace tabs synced across devices.', '真實應用程式未有：跨裝置同步工作區分頁。'),
      manageTitle: T('Manage open tabs', '管理已開分頁'), manageSub: T('Select several tabs to pin or close them together.', '揀多個分頁一次過釘選或者關閉。'),
      selectAll: T('Select all', '全選'), bulk: T('Bulk actions', '批量操作'), pin: T('Pin', '釘選'), closeSel: T('Close selected', '關閉所選'), clear: T('Clear', '清除'),
      pinned: T('Pinned', '已釘選'), rowMenu: T('Tab actions', '分頁操作'), focusTab: T('Focus tab', '跳去分頁'), closeTab: T('Close tab', '關閉分頁'),
      dlgTitle: T('New tab', '新分頁'), dlgSub: T('Every page, setting, tool and action, in one list.', '所有頁面、設定、工具同動作，集中喺一個清單。'),
      close: T('Close dialog', '關閉對話框'), searchPh: T('Search pages, settings, tools and actions', '搜尋頁面、設定、工具同動作'), rxLabel: T('Regex builder', '正則表達式生成器'),
      ignoreCase: T('Ignore case', '忽略大細楷'), pattern: T('Pattern', '表達式'), insert: T('Insert', '插入'), filters: T('Filter by kind', '按類別篩選'),
      alreadyOpen: T('Already open', '已開啟'), noMatch: T('Nothing matches this search.', '冇符合呢個搜尋嘅項目。'), dlgKeys: T('Enter opens the highlighted item. Esc closes this dialog.', '按 Enter 開啟已標示項目，按 Esc 關閉對話框。'),
      openShown: T('Open all shown', '開啟所有顯示項目'), done: T('Done', '完成')
    };
    const sw = (re ? '/' + q + '/' + (flagI ? 'i' : '') : '');
    const rxExplain = rxBad ? T('The pattern has an unclosed group or a bad escape.', '表達式有未關閉嘅括號或者錯誤嘅跳脫字元。') : q ? T('Matches names or kinds that fit the pattern. Insert tokens above to build it step by step.', '符合名稱或者類別嘅表達式。可以用上面嘅符號逐步組合。') : T('Start typing, or insert a token. The list filters as you build.', '開始輸入或者插入符號，清單會隨著組合即時篩選。');

    return Object.assign(base([T('Overview', '概覽'), T('New tab', '新分頁'), T('Settings', '設定')]), {
      lk, tips, cc, t, d: D, openCount: open.length + T(' tabs open', ' 個分頁已開'), openDlg: () => set({ dlg: true }), closeDlg: () => set({ dlg: false }), dlg: dlgOpen,
      openEvery: () => set({ open: DESTS.map(c => c[0]), closed: [] }),
      strip, activeName: active ? nameOf(active) : T('No tab selected', '未揀分頁'), moreText: rest > 0 ? '+' + rest + T(' more', ' 個更多') : T('All tabs', '全部分頁'), toggleAll: () => set({ showAll: !showAll }), showAll, allOpenList: showAll ? 'true' : 'false',
      allOpen, closeOthers: () => set({ open: active ? [active] : [], closed: open.filter(x => x !== active).slice(0, 8) }),
      closed: closedList, noClosed: closedList.length === 0, restoreDis: closed.length ? '' : 'dis', restoreLast: () => { if (closed.length) openIt(closed[0]); },
      routers, wsMsg: !!wsMsg, wsMsgText: wsMsg,
      manage, hasSel: sel.length > 0, selText: sel.length + T(' selected', ' 項已選'), selectAllTabs: () => set({ sel: open.slice() }), clearSel: () => set({ sel: [] }),
      bulkPin: () => set({ pinned: pinned.concat(sel.filter(x => !pinned.includes(x))), sel: [] }),
      bulkClose: () => { const rest2 = open.filter(x => !sel.includes(x)); set({ open: rest2, closed: sel.concat(closed).slice(0, 8), active: sel.includes(active) ? (rest2[0] || '') : active, sel: [] }); },
      q, onQ: (e) => set({ q: txt(e) }), rx, rxP: rx ? 'true' : 'false', toggleRx: () => set({ rx: !rx }), flagI: flagI ? 'true' : 'false', toggleI: () => set({ flagI: !flagI }),
      rxCls: rxBad ? 'bad' : 'good', rxMsg, rxShown: sw, rxExplain, tokens, groups, items, noItems: items.length === 0,
      resultText: shown.length + T(' of ', ' / ') + DESTS.length, openAllShown: () => set({ open: open.concat(shown.map(c => c[0]).filter(id => !open.includes(id))) })
    });`;
html+=wrapScript(script);
C.write('Tabs.dc.html',html);
console.log('ok',html.length);
