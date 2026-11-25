const C=require('./common.js');
const {ic,INFO,DOTS,CHK,tile,h2tile,HEAD,SHELL,wrapScript,COOKIE,BLOB1,BLOB2,SCALLOP}=C;

const css=`.stage{position:relative;min-height:470px;border-radius:28px;background:var(--surf-low);overflow:hidden;border:1px solid var(--line)}
.ghostui{position:absolute;inset:18px;display:grid;grid-template-columns:90px 1fr;gap:12px;opacity:.7}
.ghostui i{display:block;border-radius:14px;background:var(--surf-high)}
.ghostui .g1{grid-row:1/4}
.toasts{position:absolute;inset:16px;display:flex;flex-direction:column;gap:10px;pointer-events:none}
.toast{pointer-events:auto;width:min(380px,100%);border-radius:24px;padding:14px 14px 12px;display:flex;gap:12px;align-items:flex-start;box-shadow:var(--e3);position:relative;overflow:hidden}
.toast .tx{flex:1;min-width:0}
.toast .tt{font-weight:750;font-size:14.5px}
.toast .tb{font-size:13px;color:var(--sub);margin-top:2px;line-height:1.35}
.toast .tbar{position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--surf-high)}
.toast .tbar i{display:block;height:100%;background:var(--primary);border-radius:0 2px 2px 0}
.nbadge{width:44px;height:44px;flex:none;color:var(--primary-c);display:inline-grid;place-items:center}
.nbadge>svg{grid-area:1/1}
.nbadge>svg:first-child{width:100%;height:100%}
.nbadge.w{color:var(--warn-c)}.nbadge.b{color:var(--bad-c)}.nbadge.g{color:var(--good-c)}
.nbadge>svg:first-child{fill:currentColor}
.nbadge .in{width:22px;height:22px;color:var(--text)}
.unread{width:10px;height:10px;border-radius:5px;background:var(--primary);flex:none}
.read{width:10px;height:10px;border-radius:5px;border:2px solid var(--line);flex:none}
.nrow{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--line);position:relative;flex-wrap:wrap}
.nrow:first-of-type{border-top:0}
.nrow.isread .t1{font-weight:550;color:var(--sub)}
.src{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:12px;background:var(--surf-high);font-size:11.5px;font-weight:700;color:var(--sub)}
.sear{display:flex;align-items:center;gap:8px;flex:1 1 220px;height:48px;border-radius:24px;background:var(--surf-high);padding:0 6px 0 16px;color:var(--sub)}
.sear input{flex:1;min-width:0;border:0;background:none;outline:none;font:inherit;font-size:15px;color:var(--text)}
.empty{display:grid;place-items:center;gap:8px;padding:40px 12px;text-align:center;color:var(--sub)}`;

const cookieBadge=(cls,dpath)=>`<span class="nbadge ${cls}" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg><svg class="in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${dpath}"/></svg></span>`;

let html=HEAD('Notifications and toasts',css);
const inner=`
      <section class="card hero rise" aria-label="{{t.heroLabel}}" style="min-height:200px">
        <svg class="deco a" viewBox="0 0 200 200" aria-hidden="true" style="right:-70px;top:-80px;width:320px;height:320px"><path d="${SCALLOP}"/></svg>
        <svg class="deco b" viewBox="0 0 200 200" aria-hidden="true" style="right:230px;bottom:-120px;width:240px;height:240px"><path d="${BLOB1}"/></svg>
        <div class="cookie" style="position:absolute;right:64px;top:34px;width:120px;height:120px;color:var(--tertiary-c)" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--on-tertiary-c)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:52px;height:52px;grid-area:1/1;fill:none"><path d="{{d.bell}}"/></svg></div>
        <div style="position:relative;display:flex;flex-wrap:wrap;gap:8px"><span class="tag onp">{{t.nonblock}}</span><span class="tag onp">{{t.unreadChip}}</span></div>
        <h1 class="disp" style="position:relative;max-width:16ch">{{t.headline}}</h1>
        <p class="lede" style="position:relative;color:color-mix(in srgb,var(--on-primary) 86%,transparent)">{{t.lede}}</p>
      </section>

      <div class="grid">
        <section class="card rise {{cc.unread}}" aria-label="{{t.kUnread}}">
          ${tile('t.kUnread','unread')}
          <div class="big">{{unreadN}}<small>{{t.items}}</small></div>
          <div class="muted">{{t.unreadSub}}</div>
        </section>
        <section class="card ter rise {{cc.today}}" aria-label="{{t.kToday}}">
          ${tile('t.kToday','today')}
          <div class="big">{{todayN}}<small>{{t.items}}</small></div>
          <div class="muted" style="color:inherit;opacity:.85">{{t.todaySub}}</div>
        </section>
        <section class="card sec rise {{cc.muted}}" aria-label="{{t.kMuted}}">
          ${tile('t.kMuted','muted')}
          <div class="big">{{mutedN}}<small>{{t.sources}}</small></div>
          <div class="muted" style="color:inherit;opacity:.85">{{t.mutedSub}}</div>
        </section>
        <section class="card rise {{cc.rate}}" aria-label="{{t.kRate}}">
          ${tile('t.kRate','rate')}
          <div class="big">98<small>%</small></div>
          <svg width="100%" height="26" viewBox="0 0 220 26" role="img" aria-label="{{t.rateAlt}}" style="display:block"><svg x="0" y="0" width="214" height="26" overflow="hidden"><path class="wavy" d="M0 13 ${'q4 -6 8 0 t8 0 '.repeat(15)}" fill="none" stroke="var(--primary)" stroke-width="3.5" stroke-linecap="round"/></svg></svg>
          <div class="muted">{{t.rateSub}}</div>
        </section>
      </div>

      <div class="dash">
        <section class="card ov span2 rise {{cc.stage}}" aria-label="{{t.stageTitle}}">
          <div class="cols">
            ${h2tile('t.stageTitle','stage').replace('<div class="tilehead">','<div class="tilehead grow" style="min-width:200px">')}
            <div class="bgroup" role="group" aria-label="{{t.fire}}">
              <sc-for list="{{fires}}" as="f" hint-placeholder-count="4"><button class="btn sm" onClick="{{f.fire}}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{f.d}}"/></svg>{{f.label}}</button></sc-for>
            </div>
          </div>
          <div class="muted">{{t.stageSub}}</div>
          <div class="stage" style="{{stageStyle}}">
            <div class="ghostui" aria-hidden="true"><i class="g1"></i><i style="height:70px"></i><i style="height:150px"></i><i style="height:150px"></i></div>
            <div class="toasts" role="region" aria-live="polite" aria-label="{{t.toastRegion}}" style="{{toastsStyle}}">
              <sc-for list="{{toasts}}" as="x" hint-placeholder-count="3">
                <div class="toast glass rise" role="status" style="{{x.style}}">
                  <span class="nbadge {{x.cls}}" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg><svg class="in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="{{x.d}}"/></svg></span>
                  <div class="tx"><div class="tt">{{x.title}}</div><div class="tb">{{x.body}}</div>
                    <sc-if value="{{x.hasAct}}" hint-placeholder-val="{{ true }}"><button class="btn t sm" style="margin-top:8px" onClick="{{x.act}}">{{x.actLabel}}</button></sc-if>
                  </div>
                  <button class="icb" style="width:36px;height:36px" aria-label="{{t.dismiss}}" onClick="{{x.close}}">${ic('M6 6l12 12M18 6L6 18',18)}</button>
                  <sc-if value="{{x.timed}}" hint-placeholder-val="{{ true }}"><div class="tbar" aria-hidden="true"><i style="{{x.barStyle}}"></i></div></sc-if>
                </div>
              </sc-for>
            </div>
            <sc-if value="{{noToasts}}" hint-placeholder-val="{{ false }}"><div class="empty" style="position:absolute;inset:0">{{t.noToasts}}</div></sc-if>
          </div>
          <div class="cols">
            <span class="area-note">{{t.stageNote}}</span><span class="sp"></span>
            <button class="btn o sm" onClick="{{clearToasts}}">{{t.clearToasts}}</button>
          </div>
        </section>

        <section class="card rise {{cc.prefs}}" aria-label="{{t.prefsTitle}}">
          ${h2tile('t.prefsTitle','prefs')}
          <div class="row"><div class="grow"><div class="t1">{{t.dnd}}</div><div class="t2">{{t.dndSub}}</div></div><button class="sw" role="switch" aria-pressed="{{dndP}}" aria-label="{{t.dnd}}" onClick="{{toggleDnd}}"><i></i></button></div>
          <div class="row"><div class="grow"><div class="t1">{{t.sound}}</div><div class="t2">{{t.soundSub}}</div></div><button class="sw" role="switch" aria-pressed="{{soundP}}" aria-label="{{t.sound}}" onClick="{{toggleSound}}"><i></i></button></div>
          <div class="row"><div class="grow"><div class="t1">{{t.group}}</div><div class="t2">{{t.groupSub}}</div></div><button class="sw" role="switch" aria-pressed="{{groupP}}" aria-label="{{t.group}}" onClick="{{toggleGroup}}"><i></i></button></div>
          <div><div class="lbl" style="margin:6px 0">{{t.dur}}</div>
            <div class="seg" role="group" aria-label="{{t.dur}}"><sc-for list="{{durs}}" as="o" hint-placeholder-count="3"><button aria-pressed="{{o.pressed}}" onClick="{{o.pick}}">{{o.label}}</button></sc-for></div></div>
          <div><div class="lbl" style="margin:6px 0">{{t.pos}}</div>
            <div class="seg" role="group" aria-label="{{t.pos}}"><sc-for list="{{poss}}" as="o" hint-placeholder-count="3"><button aria-pressed="{{o.pressed}}" onClick="{{o.pick}}">{{o.label}}</button></sc-for></div></div>
          <div class="row" style="align-items:flex-end"><div class="grow"><label class="lbl" for="qh1">{{t.quiet}}</label><div class="cols" style="margin-top:6px"><input id="qh1" class="field mono" style="width:104px" value="22:00"><span class="muted">{{t.to}}</span><input class="field mono" style="width:104px" value="07:00" aria-label="{{t.quietEnd}}"></div></div></div>
        </section>
      </div>

      <section class="card ov rise {{cc.centre}}" aria-label="{{t.centre}}">
        <div class="cols">
          <div class="grow" style="min-width:200px">${h2tile('t.centre','centre').replace('<div class="tilehead">','<div class="tilehead">')}<div class="muted">{{t.centreSub}}</div></div>
          <div class="seg" role="group" aria-label="{{t.view}}"><sc-for list="{{views}}" as="v" hint-placeholder-count="2"><button aria-pressed="{{v.pressed}}" onClick="{{v.pick}}">{{v.label}}</button></sc-for></div>
        </div>
        <div class="cols">
          <div class="sear">${ic('M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z M21 21l-4.3-4.3',20)}<input type="text" value="{{q}}" onInput="{{onQ}}" placeholder="{{t.searchPh}}" aria-label="{{t.searchPh}}"><button class="rxbtn" aria-pressed="{{rxP}}" aria-label="{{t.rxLabel}}" onClick="{{toggleRx}}">.*</button></div>
          <sc-if value="{{rxBad}}" hint-placeholder-val="{{ false }}"><span class="tag bad">{{t.rxBad}}</span></sc-if>
          <button class="btn t sm" onClick="{{markAll}}">{{t.markAll}}</button>
          <button class="btn o sm" onClick="{{selectAll}}">{{t.selectAll}}</button>
        </div>
        <div class="cols" role="group" aria-label="{{t.filters}}">
          <sc-for list="{{chips}}" as="c" hint-placeholder-count="6"><button class="chip" aria-pressed="{{c.pressed}}" onClick="{{c.pick}}">{{c.label}}<span class="badge" style="height:18px;min-width:18px;font-size:11px">{{c.n}}</span></button></sc-for>
        </div>
        <sc-if value="{{hasSel}}" hint-placeholder-val="{{ false }}">
          <div class="glass" role="region" aria-label="{{t.bulk}}" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-radius:22px;padding:8px 8px 8px 20px">
            <b style="flex:1;min-width:140px">{{selText}}</b>
            <button class="btn t sm" onClick="{{bulkRead}}">{{t.bulkRead}}</button>
            <button class="btn t sm" onClick="{{bulkSnooze}}">{{t.snooze}}</button>
            <button class="btn o sm" onClick="{{bulkDelete}}">{{t.del}}</button>
            <button class="btn o sm" onClick="{{clearSel}}">{{t.clear}}</button>
          </div>
        </sc-if>
        <div>
          <sc-for list="{{rows}}" as="n" hint-placeholder-count="6">
            <div class="{{n.cls}}">
              <button class="cbw" role="checkbox" aria-checked="{{n.checked}}" aria-label="{{n.selLabel}}" onClick="{{n.toggle}}"><span class="{{n.cbCls}}">${CHK}</span></button>
              <span class="{{n.dotCls}}" aria-hidden="true"></span>
              <span class="nbadge {{n.badge}}" style="width:40px;height:40px" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg><svg class="in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="{{n.d}}"/></svg></span>
              <div class="grow" style="min-width:200px"><div class="t1">{{n.title}}</div><div class="t2">{{n.body}}</div><div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap"><span class="src">{{n.src}}</span><span class="area-note" style="align-self:center">{{n.time}}</span></div></div>
              <a class="btn o sm" href="{{n.link}}">{{t.jump}}</a>
              <button class="info" aria-label="{{t.rowMenu}}" aria-haspopup="menu" aria-expanded="{{n.menuOpen}}" onClick="{{n.more}}">${DOTS}</button>
              <sc-if value="{{n.menuOpen}}" hint-placeholder-val="{{ false }}">
                <div class="menu" role="menu" style="right:8px;top:58px">
                  <button class="mi" role="menuitem" onClick="{{n.flip}}">${ic('M5 12.5l4.5 4.5L19 7.5',18)}{{n.flipLabel}}</button>
                  <button class="mi" role="menuitem" onClick="{{n.snz}}">${ic('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',18)}{{t.snooze}}</button>
                  <button class="mi" role="menuitem" onClick="{{n.mute}}">${ic('M4 9v6h4l5 4V5L8 9z M17 9l4 6 M21 9l-4 6',18)}{{t.muteSrc}}</button>
                  <button class="mi" role="menuitem" onClick="{{n.more}}">${ic('M9 9h11v11H9z M5 15V4h11',18)}{{t.copyDetails}}</button>
                  <button class="mi" role="menuitem" onClick="{{n.del}}">${ic('M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',18)}{{t.del}}</button>
                </div>
              </sc-if>
            </div>
          </sc-for>
          <sc-if value="{{noRows}}" hint-placeholder-val="{{ false }}"><div class="empty"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{d.bell}}"/></svg><b>{{t.emptyTitle}}</b><span>{{t.emptySub}}</span></div></sc-if>
        </div>
        <div class="area-note">{{t.centreNote}}</div>
      </section>
`;
html+=SHELL('changes','t.title',0,inner);

const script=`
    const defs = {
      unread: [T('unread count', '未讀數量'), T('Unread items across every router. Counts drop as you read them or jump to the source.', '所有路由器嘅未讀項目。讀咗或者跳去來源就會減少。')],
      today: [T('today count', '今日數量'), T('Everything that raised a toast or landed in the centre since midnight.', '凌晨起計，所有彈出提示同進入通知中心嘅項目。')],
      muted: [T('muted sources', '已靜音來源'), T('Sources you muted still log to history, they just never raise a toast.', '已靜音嘅來源仍然會記錄喺歷史，只係唔會彈出提示。')],
      rate: [T('delivery rate', '送達率'), T('Share of events that reached you without being dropped by quiet hours.', '冇被靜音時段攔截而送到你面前嘅事件比例。')],
      stage: [T('toast preview', '彈出提示預覽'), T('Toasts never take focus and never block the page behind them. Each one has a timer you can pause by hovering.', '彈出提示唔會搶焦點，亦唔會擋住後面嘅頁面。游標停喺上面可以暫停倒數。')],
      prefs: [T('notification settings', '通知設定'), T('Do not disturb holds toasts back and keeps them in the centre. Quiet hours repeat every night.', '勿擾會暫時唔彈出提示，並保留喺通知中心。靜音時段每晚重複。')],
      centre: [T('notification centre', '通知中心'), T('Every toast also lands here. Filters, search and the regex builder work on the title, body and source.', '每個彈出提示都會記錄喺呢度。篩選、搜尋同正則表達式生成器可以搜尋標題、內容同來源。')]
    };
    const { lk, tips, cc } = mk(defs);

    const kindMap = {
      good: { badge: 'g', d: D.check, cls: 'g' }, warn: { badge: 'w', d: D.warn, cls: 'w' }, bad: { badge: 'b', d: D.x, cls: 'b' }, info: { badge: '', d: D.info, cls: '' }
    };
    const SRC = { wifi: ['Wi-Fi', 'Wi-Fi'], sec: [T('Security', '保安'), T('Security', '保安')], dev: [T('Devices', '裝置'), T('Devices', '裝置')], upd: [T('Updates', '更新'), T('Updates', '更新')], bak: [T('Backup', '備份'), T('Backup', '備份')], net: [T('Network', '網絡'), T('Network', '網絡')] };
    const N = [
      ['n1', 'good', 'wifi', T('Guest Wi-Fi turned on', '開咗訪客 Wi-Fi'), T('Pat enabled Guest-Home on 2.4 GHz with a 4 hour timer.', 'Pat 喺 2.4 GHz 開咗 Guest-Home，定時 4 小時。'), T('2 min ago', '2 分鐘前'), 'WiFi.dc.html', 0],
      ['n2', 'warn', 'sec', T('Unknown device joined', '有陌生裝置加入'), T('Device f0:18:98:aa:bb:07 asked for 198.51.100.131 on the main network.', '裝置 f0:18:98:aa:bb:07 喺主網絡要求 198.51.100.131。'), T('9 min ago', '9 分鐘前'), 'Devices.dc.html', 0],
      ['n3', 'info', 'upd', T('Firmware 388.8_4 is ready', '韌體 388.8_4 已經可以更新'), T('Asuswrt-Merlin release notes list 14 fixes. Nothing is installed until you approve.', 'Asuswrt-Merlin 更新說明列出 14 項修正，你批准之前唔會安裝。'), T('34 min ago', '34 分鐘前'), 'Changes.dc.html', 0],
      ['n4', 'bad', 'net', T('WAN link dropped for 11 s', '外網斷線 11 秒'), T('The connection came back on its own. DHCP lease renewed from 203.0.113.9.', '連線已自動恢復，DHCP 租約由 203.0.113.9 更新。'), T('1 h ago', '1 小時前'), 'Network.dc.html', 1],
      ['n5', 'good', 'bak', T('Settings backup saved', '設定備份已儲存'), T('RT-AX86U-2026-11-25.cfg, 38 KB, copied to the NAS at 198.51.100.20.', 'RT-AX86U-2026-11-25.cfg，38 KB，已複製去 198.51.100.20 NAS。'), T('3 h ago', '3 小時前'), 'Tools.dc.html', 1],
      ['n6', 'warn', 'wifi', T('5 GHz channel changed', '5 GHz 頻道已更改'), T('Channel 36 to 44 after radar detection. 3 devices reconnected.', '偵測到雷達訊號，頻道由 36 改做 44，3 部裝置已重新連線。'), T('Yesterday 22:10', '尋日 22:10'), 'WiFi.dc.html', 1],
      ['n7', 'info', 'dev', T('Alex-Laptop is back online', 'Alex-Laptop 重新上線'), T('Connected to the living room node, -58 dBm.', '已連接客廳節點，-58 dBm。'), T('Yesterday 18:42', '尋日 18:42'), 'Devices.dc.html', 1],
      ['n8', 'good', 'sec', T('Firewall blocked 31 probes', '防火牆攔截 31 次探測'), T('All came from one address in the last hour. Nothing reached the LAN.', '最近一小時全部來自同一個地址，冇一個去到內網。'), T('Yesterday 14:03', '尋日 14:03'), 'Security.dc.html', 1]
    ];
    const read = s.read || ['n5', 'n6', 'n7', 'n8'];
    const gone = s.gone || [];
    const muted = s.muted || ['bak'];
    const snoozed = s.snoozed || [];
    const sel = s.sel || [];
    const filter = s.filter || 'all';
    const view = s.view || 'inbox';
    const q = s.q || '';
    const rx = !!s.rx;
    const dnd = !!s.dnd, sound = s.sound !== false, group = s.group !== false;
    const dur = s.dur || '8';
    const pos = s.pos || 'br';
    const rowMenu = s.rowMenu || '';

    let re = null, rxBad = false;
    if (q) {
      try { re = rx ? new RegExp(q, 'i') : null; } catch (err) { rxBad = true; }
    }
    const match = (n) => {
      if (!q) return true;
      const hay = [n[3], n[4], SRC[n[2]][0]].join(' ');
      if (rx) return re ? re.test(hay) : false;
      return hay.toLowerCase().includes(q.toLowerCase());
    };
    const alive = N.filter(n => !gone.includes(n[0]));
    const isRead = (id) => read.includes(id);
    const histOnly = (n) => n[7] === 1;
    const inView = (n) => view === 'history' ? true : !snoozed.includes(n[0]) && !histOnly(n) || !isRead(n[0]);
    const visible = alive.filter(n => match(n) && (filter === 'all' || (filter === 'unread' ? !isRead(n[0]) : n[2] === filter)) && inView(n));
    const unreadN = alive.filter(n => !isRead(n[0])).length;

    const chipDefs = [['all', T('All', '全部'), alive.length], ['unread', T('Unread', '未讀'), unreadN]].concat(Object.keys(SRC).map(k => [k, SRC[k][0], alive.filter(n => n[2] === k).length]));
    const chips = chipDefs.map(([id, label, n]) => ({ label, n, pressed: filter === id ? 'true' : 'false', pick: () => set({ filter: id }) }));

    const rows = visible.map(n => {
      const id = n[0], on = sel.includes(id), rd = isRead(id), k = kindMap[n[1]];
      return {
        title: n[3], body: n[4], time: n[5], src: SRC[n[2]][0], link: n[6], badge: k.badge, d: k.d,
        cls: 'nrow' + (rd ? ' isread' : ''), dotCls: rd ? 'read' : 'unread',
        checked: on ? 'true' : 'false', cbCls: 'cb2' + (on ? ' on' : ''), selLabel: T('Select: ', '揀選：') + n[3],
        menuOpen: rowMenu === id,
        flipLabel: rd ? T('Mark as unread', '標記未讀') : T('Mark as read', '標記已讀'),
        toggle: () => set({ sel: tg(sel, id) }),
        more: () => set({ rowMenu: rowMenu === id ? '' : id }),
        flip: () => set({ read: tg(read, id), rowMenu: '' }),
        snz: () => set({ snoozed: snoozed.concat([id]), read: read.includes(id) ? read : read.concat([id]), rowMenu: '' }),
        mute: () => set({ muted: muted.includes(n[2]) ? muted : muted.concat([n[2]]), rowMenu: '' }),
        del: () => set({ gone: gone.concat([id]), sel: sel.filter(x => x !== id), rowMenu: '' })
      };
    });
    const hasSel = sel.length > 0;

    // toast stage
    const TDEF = {
      success: { kind: 'good', title: T('Changes applied', '已套用變更'), body: T('Guest Wi-Fi is on. It will switch off at 21:00.', '訪客 Wi-Fi 已開啟，21:00 自動關閉。'), act: T('Undo', '復原') },
      warning: { kind: 'warn', title: T('Weak signal in the bedroom', '睡房訊號偏弱'), body: T('The bedroom node dropped to -78 dBm.', '睡房節點跌到 -78 dBm。'), act: T('Open AiMesh', '開啟 AiMesh') },
      error: { kind: 'bad', title: T('Could not reach 198.51.100.20', '連唔到 198.51.100.20'), body: T('The NAS did not answer the wake request.', 'NAS 冇回應喚醒要求。'), act: T('Retry', '重試') },
      info: { kind: 'info', title: T('Speed test finished', '速度測試完成'), body: T('892 Mbps down, 47 Mbps up, 4 ms.', '下載 892 Mbps，上傳 47 Mbps，延遲 4 ms。'), act: '' }
    };
    const toasts0 = s.toasts || [{ id: 1, k: 'success' }, { id: 2, k: 'warning' }, { id: 3, k: 'info' }];
    const nextId = s.nextId || 4;
    const durMs = dur === 'sticky' ? 0 : parseInt(dur, 10);
    const toasts = toasts0.slice(-4).reverse().map((x, i) => {
      const d = TDEF[x.k], km = kindMap[d.kind];
      return {
        title: d.title, body: d.body, d: km.d, cls: km.cls, hasAct: !!d.act, actLabel: d.act, timed: durMs > 0,
        style: 'opacity:' + (1 - i * 0.08) + ';' + (dnd ? 'filter:grayscale(1);' : ''),
        barStyle: 'width:' + (88 - i * 22) + '%',
        act: () => set({ toasts: toasts0.filter(y => y.id !== x.id) }),
        close: () => set({ toasts: toasts0.filter(y => y.id !== x.id) })
      };
    });
    const fireDefs = [['success', D.check, T('Success', '成功')], ['warning', D.warn, T('Warning', '警告')], ['error', D.x, T('Error', '錯誤')], ['info', D.info, T('Info', '資訊')]];
    const fires = fireDefs.map(([k, d, label]) => ({ d, label, fire: () => set({ toasts: toasts0.concat([{ id: nextId, k }]), nextId: nextId + 1 }) }));
    const toastsStyle = pos === 'br' ? 'justify-content:flex-end;align-items:flex-end;flex-direction:column-reverse' : pos === 'bl' ? 'justify-content:flex-end;align-items:flex-start;flex-direction:column-reverse' : 'justify-content:flex-start;align-items:flex-end;flex-direction:column';

    const durs = [['4', '4 s'], ['8', '8 s'], ['sticky', T('Stay until closed', '手動關閉')]].map(([id, label]) => ({ label, pressed: dur === id ? 'true' : 'false', pick: () => set({ dur: id }) }));
    const poss = [['br', T('Bottom right', '右下')], ['bl', T('Bottom left', '左下')], ['tr', T('Top right', '右上')]].map(([id, label]) => ({ label, pressed: pos === id ? 'true' : 'false', pick: () => set({ pos: id }) }));
    const views = [['inbox', T('Inbox', '收件匣')], ['history', T('History', '歷史')]].map(([id, label]) => ({ label, pressed: view === id ? 'true' : 'false', pick: () => set({ view: id }) }));

    const t = {
      title: T('Notifications', '通知'),
      heroLabel: T('Notification summary', '通知摘要'),
      nonblock: T('Never blocks the page', '永不擋住頁面'), unreadChip: unreadN + T(' unread', ' 則未讀'),
      headline: dnd ? T('Do not disturb is on', '勿擾已開啟') : T('Quiet and in control', '安靜而且盡在掌握'),
      lede: T('Toasts slide in without stealing focus, then settle into the notification centre where you can filter, search, snooze and jump straight to the page that raised them.', '提示會滑入畫面但唔搶焦點，之後留喺通知中心，你可以篩選、搜尋、延後，同埋一下跳去相關頁面。'),
      kUnread: T('Unread', '未讀'), kToday: T('Today', '今日'), kMuted: T('Muted', '已靜音'), kRate: T('Delivered', '送達'),
      items: T(' items', ' 項'), sources: T(' sources', ' 個來源'),
      unreadSub: T('Across RT-AX86U and 2 mesh nodes', '涵蓋 RT-AX86U 同 2 個 Mesh 節點'),
      todaySub: T('7 toasts, 1 needed action', '7 個提示，1 個要處理'),
      mutedSub: T('Backup still logs to history', '備份仍然記錄喺歷史'),
      rateSub: T('Quiet hours held back 2 toasts', '靜音時段攔截咗 2 個提示'), rateAlt: T('Delivery rate 98 percent', '送達率 98%'),
      stageTitle: T('Toast preview', '彈出提示預覽'), fire: T('Fire a test toast', '發送測試提示'),
      stageSub: T('Stacked newest first. The page behind stays clickable.', '最新嘅排最上，後面嘅頁面照樣可以撳。'),
      toastRegion: T('Toast notifications', '彈出提示'), dismiss: T('Dismiss notification', '關閉提示'),
      noToasts: T('No toasts right now', '暫時冇提示'), stageNote: T('Hover pauses the timer. Esc closes the newest toast.', '游標停留會暫停倒數，按 Esc 關閉最新一個。'), clearToasts: T('Clear all toasts', '清除全部提示'),
      prefsTitle: T('Toast settings', '提示設定'), dnd: T('Do not disturb', '勿擾'), dndSub: T('Hold toasts, keep them in the centre', '暫停彈出，改為記錄喺通知中心'),
      sound: T('Action sounds', '動作音效'), soundSub: T('Soft tick on success, tone on errors', '成功輕輕一響，錯誤有提示音'),
      group: T('Group by source', '按來源分組'), groupSub: T('Stack repeats from the same source', '同一來源嘅重複提示疊埋一齊'),
      dur: T('Toast duration', '提示顯示時間'), pos: T('Position', '位置'), quiet: T('Quiet hours', '靜音時段'), quietEnd: T('Quiet hours end', '靜音結束時間'), to: T('to', '至'),
      centre: T('Notification centre', '通知中心'), centreSub: T('Router, security, device and update events in one place.', '路由器、保安、裝置同更新事件集中喺度。'),
      view: T('Inbox or history', '收件匣或歷史'),
      searchPh: T('Search notifications', '搜尋通知'), rxLabel: T('Regex builder', '正則表達式生成器'), rxBad: T('Pattern is not valid', '表達式無效'),
      markAll: T('Mark all read', '全部標記已讀'), selectAll: T('Select all', '全選'), filters: T('Filters', '篩選'),
      bulk: T('Bulk actions', '批量操作'), bulkRead: T('Mark read', '標記已讀'), snooze: T('Snooze 1 hour', '延後 1 小時'), del: T('Delete', '刪除'), clear: T('Clear', '清除'),
      jump: T('Jump to source', '跳去來源'), rowMenu: T('Row actions', '列操作'), muteSrc: T('Mute this source', '靜音呢個來源'), copyDetails: T('Copy details', '複製詳情'),
      emptyTitle: T('Nothing matches', '冇符合嘅通知'), emptySub: T('Try a different filter or clear the search.', '試下換個篩選或者清除搜尋。'),
      centreNote: T('Not in the real app yet: delivery to a phone through the status relay.', '真實應用程式未有：經狀態轉送傳送去手機。')
    };

    return Object.assign(base([T('Overview', '概覽'), T('Notifications', '通知'), T('Changes', '變更')]), {
      lk, tips, cc, t, d: D, rows, chips, hasSel, selText: sel.length + T(' selected', ' 項已選'), noRows: rows.length === 0,
      unreadN, todayN: 7, mutedN: muted.length,
      q, rxP: rx ? 'true' : 'false', rxBad,
      onQ: (e) => set({ q: txt(e) }), toggleRx: () => set({ rx: !rx }),
      markAll: () => set({ read: N.map(n => n[0]) }), selectAll: () => set({ sel: visible.map(n => n[0]) }), clearSel: () => set({ sel: [] }),
      bulkRead: () => set({ read: read.concat(sel.filter(x => !read.includes(x))), sel: [] }),
      bulkSnooze: () => set({ snoozed: snoozed.concat(sel), read: read.concat(sel.filter(x => !read.includes(x))), sel: [] }),
      bulkDelete: () => set({ gone: gone.concat(sel), sel: [] }),
      toasts, noToasts: toasts.length === 0, fires, clearToasts: () => set({ toasts: [] }),
      stageStyle: '', toastsStyle,
      dndP: dnd ? 'true' : 'false', soundP: sound ? 'true' : 'false', groupP: group ? 'true' : 'false',
      toggleDnd: () => set({ dnd: !dnd }), toggleSound: () => set({ sound: !sound }), toggleGroup: () => set({ group: !group }),
      durs, poss, views
    });`;
html+=wrapScript(script);
C.write('Notifications.dc.html',html);
console.log('ok',html.length);
