const C=require('./common.js');
const {ic,INFO,DOTS,CHK,tile,h2tile,HEAD,SHELL,wrapScript,COOKIE,BLOB1,BLOB2,SCALLOP}=C;

const css=`.mode{display:flex;flex-direction:column;gap:6px;text-align:left;padding:18px;border-radius:24px;border:2px solid var(--line);background:var(--surf);color:var(--text);font:inherit;min-height:120px;flex:1 1 180px}
.mode[aria-pressed=true]{border-color:var(--primary);background:var(--primary-c);color:var(--on-primary-c)}
.mode .big{font-size:34px}
.sample{padding:16px 18px;border-radius:20px;background:var(--surf-low);display:flex;flex-direction:column;gap:6px}
.drop{position:relative;border:2.5px dashed var(--line);border-radius:28px;padding:28px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;background:var(--surf-low);min-height:230px;justify-content:center;overflow:hidden}
.drop.over{border-color:var(--primary);background:var(--primary-c);color:var(--on-primary-c)}
.drop.ok{border-color:var(--good);background:var(--good-c)}
.drop.bad{border-color:var(--bad);background:var(--bad-c)}
.conf i{position:absolute;top:-20px;width:12px;height:12px;border-radius:4px;animation:fall 2.2s ease-in both}
.conf i:nth-child(3n){border-radius:6px;background:var(--primary)}
.conf i:nth-child(3n+1){background:var(--tertiary)}
.conf i:nth-child(3n+2){background:var(--warn)}
@keyframes fall{to{transform:translateY(260px) rotate(540deg);opacity:0}}
.calm .conf i,.calm .shake{animation:none}
.shake{animation:shake .4s}
@keyframes shake{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
@media (prefers-reduced-motion:reduce){.conf i,.shake{animation:none}}
.vopt{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:6px 14px;border:0;border-radius:16px;background:transparent;color:var(--text);font:inherit;text-align:left}
.vopt[aria-checked=true]{background:var(--secondary-c);color:var(--on-secondary-c)}
.radio{width:22px;height:22px;border-radius:11px;border:2px solid var(--sub);display:grid;place-items:center;flex:none}
.radio i{width:10px;height:10px;border-radius:5px;background:var(--primary);opacity:0}
.vopt[aria-checked=true] .radio{border-color:var(--primary)}
.vopt[aria-checked=true] .radio i{opacity:1}
.dlg{border-radius:28px;padding:20px;background:var(--surf);box-shadow:var(--e3);display:flex;flex-direction:column;gap:10px}
.fl{display:flex;gap:6px;align-items:center}
.fl i{flex:1;height:6px;border-radius:3px;background:var(--surf-high)}
.fl i.on{background:var(--primary)}
.rail-demo{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:20px;background:var(--surf-low)}
.tabdemo{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:12px 12px 0 0;background:var(--surf-high);font-weight:650;font-size:13px;width:max-content;max-width:100%}`;

const sm=(d)=>`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0 M9 9.5h.01 M15 9.5h.01"/></svg>`;

let html=HEAD('Language and accessibility',css);
const inner=`
      <section class="card hero rise" aria-label="{{t.heroLabel}}" style="min-height:220px">
        <svg class="deco a" viewBox="0 0 200 200" aria-hidden="true" style="right:-60px;top:-80px;width:320px;height:320px"><path d="${SCALLOP}"/></svg>
        <svg class="deco b" viewBox="0 0 200 200" aria-hidden="true" style="right:260px;bottom:-120px;width:240px;height:240px"><path d="${BLOB1}"/></svg>
        <div class="cookie" style="position:absolute;right:66px;top:42px;width:124px;height:124px;color:var(--tertiary-c)" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--on-tertiary-c)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:52px;height:52px;grid-area:1/1;fill:none"><path d="{{d.globe}}"/></svg></div>
        <div style="position:relative;display:flex;flex-wrap:wrap;gap:8px"><span class="tag onp">{{t.chipMode}}</span><span class="tag onp">{{t.chipFun}}</span><span class="tag onp">{{t.chipLocal}}</span></div>
        <h1 class="disp" style="position:relative;max-width:16ch">{{t.headline}}</h1>
        <p class="lede" style="position:relative;color:color-mix(in srgb,var(--on-primary) 86%,transparent)">{{t.lede}}</p>
      </section>

      <div class="dash">
        <section class="card span2 ov rise {{cc.modes}}" aria-label="{{t.modesTitle}}">
          ${h2tile('t.modesTitle','modes')}
          <div class="muted">{{t.modesSub}}</div>
          <div class="cols" style="align-items:stretch" role="group" aria-label="{{t.modesTitle}}">
            <sc-for list="{{modes}}" as="m" hint-placeholder-count="3"><button class="mode" aria-pressed="{{m.pressed}}" onClick="{{m.pick}}"><span class="big">{{m.big}}</span><b>{{m.name}}</b><span style="font-size:13px;opacity:.85">{{m.sub}}</span></button></sc-for>
          </div>
          <div class="sample" aria-live="polite"><span class="k">{{t.previewLabel}}</span><div class="t1">{{pr.title}}</div><div class="muted">{{pr.body}}</div><div class="cols"><span class="btn f sm">{{pr.btn}}</span><span class="tag good">{{pr.tag}}</span></div></div>
        </section>

        <section class="card ov rise {{cc.fun}}" aria-label="{{t.funTitle}}">
          ${h2tile('t.funTitle','fun')}
          <div class="muted">{{t.funSub}}</div>
          <sc-for list="{{funs}}" as="f" hint-placeholder-count="4">
            <div><div class="cols"><label class="lbl grow" for="{{f.id}}">{{f.label}}</label><span class="tag">{{f.levelName}}</span></div>
              <input id="{{f.id}}" class="rng" type="range" min="0" max="4" step="1" value="{{f.value}}" onInput="{{f.set}}" aria-valuetext="{{f.levelName}}">
              <div class="fl" aria-hidden="true"><i class="{{f.s0}}"></i><i class="{{f.s1}}"></i><i class="{{f.s2}}"></i><i class="{{f.s3}}"></i><i class="{{f.s4}}"></i></div>
              <div class="t2" style="margin-top:6px">{{f.sample}}</div></div>
          </sc-for>
        </section>
      </div>

      <div class="dash">
        <section class="card span2 ov rise {{cc.vocab}}" aria-label="{{t.vocabTitle}}">
          ${h2tile('t.vocabTitle','vocab')}
          <div class="muted">{{t.vocabSub}}</div>
          <div class="{{dropCls}}" role="group" aria-label="{{t.dropLabel}}">
            <sc-if value="{{celebrate}}" hint-placeholder-val="{{ false }}"><div class="conf" aria-hidden="true"><sc-for list="{{confetti}}" as="c" hint-placeholder-count="18"><i style="{{c.style}}"></i></sc-for></div></sc-if>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{dropIcon}}"/></svg>
            <div class="disp s" style="font-size:30px;letter-spacing:-.4px">{{dropTitle}}</div>
            <div class="muted" style="color:inherit;opacity:.85;max-width:52ch">{{dropSub}}</div>
            <div class="cols" style="justify-content:center">
              <button class="btn f sm" onClick="{{pickFile}}">${ic('M12 20V9M7 14l5-5 5 5M4 5h16',18)}{{t.chooseFile}}</button>
              <button class="btn o sm" onClick="{{dropValid}}">{{t.demoValid}}</button>
              <button class="btn o sm" onClick="{{dropBad}}">{{t.demoBad}}</button>
              <button class="btn o sm" onClick="{{dropBig}}">{{t.demoBig}}</button>
            </div>
          </div>
          <div class="cols"><span class="tag {{wordsCls}}">{{wordsText}}</span><span class="tag">{{t.localOnly}}</span><span class="sp"></span>
            <button class="btn t sm" onClick="{{clearVocab}}">{{t.clearVocab}}</button></div>
          <div class="cols" style="align-items:flex-start;gap:16px"><pre class="mono" style="margin:0;flex:1 1 260px;min-width:0;padding:14px 16px;border-radius:18px;background:var(--surf-low);font-size:12.5px;line-height:1.55;overflow:auto">{ "version": 1,
  "words": {
    "router": "wifi box",
    "guest network": "visitor lane"
  } }</pre><div style="flex:1 1 220px;display:flex;flex-direction:column;gap:6px"><b class="t1">{{t.tplTitle}}</b><div class="muted">{{t.tplSub}}</div><button class="btn o sm" style="align-self:flex-start">{{t.tplBtn}}</button></div></div>
          <div class="area-note">{{t.vocabNote}}</div>
        </section>

        <section class="card ov rise {{cc.school}}" aria-label="{{t.schoolTitle}}">
          ${h2tile('t.schoolTitle','school')}
          <div class="row"><div class="grow"><div class="t1">{{t.schoolOn}}</div><div class="t2">{{t.schoolSub}}</div></div><button class="sw" role="switch" aria-pressed="{{schoolP}}" aria-label="{{t.schoolOn}}" onClick="{{toggleSchool}}"><i></i></button></div>
          <div class="muted">{{t.schoolEffects}}</div>
          <sc-for list="{{schoolEff}}" as="e" hint-placeholder-count="3"><div class="row" style="padding:8px 0"><span class="dot" style="{{e.dot}}"></span><div class="grow t2" style="margin:0">{{e.text}}</div></div></sc-for>
          <div class="row"><div class="grow"><div class="t1">{{t.emoji}}</div><div class="t2">{{t.emojiSub}}</div></div><button class="sw" role="switch" aria-pressed="{{emojiP}}" aria-label="{{t.emoji}}" onClick="{{toggleEmoji}}"><i></i></button></div>
          <div class="dlg"><div class="cols"><sc-if value="{{emojiOn}}" hint-placeholder-val="{{ true }}">${sm()}</sc-if><b class="grow" style="font-size:16px">{{t.dlgTitle}}</b></div><div class="muted">{{t.dlgBody}}</div><div class="cols"><span class="btn t sm">{{t.dlgCancel}}</span><span class="btn f sm">{{t.dlgOk}}</span></div></div>
        </section>
      </div>

      <div class="dash">
        <section class="card ov rise {{cc.adhd}}" aria-label="{{t.adhdTitle}}">
          ${h2tile('t.adhdTitle','adhd')}
          <div class="muted">{{t.adhdSub}}</div>
          <div class="seg" role="group" aria-label="{{t.adhdTitle}}" style="flex-wrap:wrap"><sc-for list="{{adhdModes}}" as="o" hint-placeholder-count="4"><button aria-pressed="{{o.pressed}}" onClick="{{o.pick}}">{{o.label}}</button></sc-for></div>
          <sc-for list="{{adhdOpts}}" as="o" hint-placeholder-count="4"><div class="row"><div class="grow"><div class="t1">{{o.label}}</div><div class="t2">{{o.sub}}</div></div><button class="sw" role="switch" aria-pressed="{{o.on}}" aria-label="{{o.label}}" onClick="{{o.toggle}}"><i></i></button></div></sc-for>
          <div class="sample" style="position:relative;overflow:hidden;min-height:112px">
            <sc-if value="{{adhdDeco}}" hint-placeholder-val="{{ true }}"><svg viewBox="0 0 200 200" aria-hidden="true" style="position:absolute;right:-30px;top:-30px;width:130px;height:130px;fill:var(--primary-c)"><path d="${COOKIE}"/></svg></sc-if>
            <span class="k">{{t.adhdPreview}}</span><div class="t1" style="position:relative">{{adhdCardTitle}}</div><div class="muted" style="position:relative">{{adhdCardBody}}</div>
          </div>
        </section>

        <section class="card ov rise {{cc.narr}}" aria-label="{{t.narrTitle}}">
          ${h2tile('t.narrTitle','narr')}
          <div class="row"><div class="grow"><div class="t1">{{t.narrOn}}</div><div class="t2">{{t.narrSub}}</div></div><button class="sw" role="switch" aria-pressed="{{narrP}}" aria-label="{{t.narrOn}}" onClick="{{toggleNarr}}"><i></i></button></div>
          <div role="radiogroup" aria-label="{{t.voice}}"><sc-for list="{{voices}}" as="v" hint-placeholder-count="4"><button class="vopt" role="radio" aria-checked="{{v.checked}}" onClick="{{v.pick}}"><span class="radio"><i></i></span><span class="grow"><b style="font-size:14.5px">{{v.name}}</b><span class="t2" style="display:block;margin:0">{{v.sub}}</span></span></button></sc-for></div>
          <div><div class="cols"><label class="lbl grow" for="rate">{{t.rate}}</label><span class="mono lbl">{{rateText}}</span></div><input id="rate" class="rng" type="range" min="0.6" max="1.6" step="0.1" value="{{rate}}" onInput="{{setRate}}"></div>
          <div class="cols"><button class="btn f sm" onClick="{{speak}}">${ic('M4 9v6h4l5 4V5L8 9z M16 9a4 4 0 0 1 0 6',18)}{{speakLabel}}</button>
            <svg width="120" height="24" viewBox="0 0 120 24" aria-hidden="true"><svg x="0" y="0" width="114" height="24" overflow="hidden"><path class="{{waveCls}}" d="M0 12 ${'q4 -6 8 0 t8 0 '.repeat(10)}" fill="none" stroke="var(--primary)" stroke-width="3.5" stroke-linecap="round"/></svg></svg></div>
          <div class="muted" aria-live="polite">{{speakSample}}</div>
        </section>

        <section class="card ov rise {{cc.snd}}" aria-label="{{t.sndTitle}}">
          ${h2tile('t.sndTitle','snd')}
          <div class="row"><div class="grow"><div class="t1">{{t.sndOn}}</div><div class="t2">{{t.sndSub}}</div></div><button class="sw" role="switch" aria-pressed="{{sndP}}" aria-label="{{t.sndOn}}" onClick="{{toggleSnd}}"><i></i></button></div>
          <div><div class="cols"><label class="lbl grow" for="vol">{{t.volume}}</label><span class="mono lbl">{{volText}}</span></div><input id="vol" class="rng" type="range" min="0" max="100" step="5" value="{{vol}}" onInput="{{setVol}}"></div>
          <sc-for list="{{cues}}" as="c" hint-placeholder-count="4"><div class="row"><span class="badge" style="{{c.badge}}">${ic('M4 9v6h4l5 4V5L8 9z',14,2.2)}</span><div class="grow"><div class="t1">{{c.label}}</div><div class="t2">{{c.sub}}</div></div><button class="btn t sm {{c.dis}}" onClick="{{c.play}}">{{c.btn}}</button></div></sc-for>
          <div class="tag {{sndTagCls}}" style="align-self:flex-start">{{sndTag}}</div>
        </section>
      </div>

      <section class="card ov rise {{cc.name}}" aria-label="{{t.nameTitle}}">
        <div class="cols" style="align-items:flex-start;gap:28px">
          <div style="flex:1 1 320px;min-width:260px;display:flex;flex-direction:column;gap:10px">
            ${h2tile('t.nameTitle','name')}
            <div class="muted">{{t.nameSub}}</div>
            <div class="cols"><label class="lbl" for="aname">{{t.nameField}}</label><input id="aname" class="field" style="flex:1;min-width:200px" maxlength="32" value="{{appName}}" onInput="{{setName}}"></div>
            <div class="cols"><button class="btn t sm" onClick="{{resetName}}">{{t.nameReset}}</button><span class="tag">{{nameCount}}</span></div>
          </div>
          <div style="flex:1 1 360px;min-width:260px;display:flex;flex-direction:column;gap:12px">
            <div class="lbl">{{t.nameWhere}}</div>
            <div class="rail-demo"><span class="cookie" style="width:44px;height:44px;color:var(--primary)" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="${COOKIE}"/></svg>${ic('M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h.01',22,2.2).replace('<svg ','<svg style="color:#fff" ')}</span><div><div class="brand">{{appName}}<small>RT-AX86U · 198.51.100.1</small></div></div></div>
            <div class="tabdemo">${ic('M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h.01',16)}{{appName}} · {{t.nameTab}}</div>
            <div class="muted">{{t.nameNote}}</div>
          </div>
        </div>
      </section>
`;
html+=SHELL('settings','t.title',0,inner);

const script=`
    const defs = {
      modes: [T('language modes', '語言模式'), T('English, Cantonese, or both lines together. Technical values such as IP addresses are never translated.', '英文、粵語，或者兩行一齊顯示。IP 地址等技術數值唔會翻譯。')],
      fun: [T('funny levels', '幽默程度'), T('Sets how playful the app copy is in each area. Errors and security warnings stay clear at every level.', '設定各個範圍嘅文案有幾好玩。無論調到幾高，錯誤同保安警告都會寫得清楚。')],
      vocab: [T('personal vocabulary', '個人詞彙'), T('Drop a JSON file of your own words. It is validated first and never leaves this device.', '拖放你自己嘅詞彙 JSON 檔案。會先驗證，而且唔會離開呢部裝置。')],
      school: [T('school mode', '校園模式'), T('A calm, work-safe preset for shared screens and classrooms.', '適合共用螢幕同課堂嘅平靜、安全預設。')],
      adhd: [T('attention modes', '專注模式'), T('Reduce visual noise and show one thing at a time.', '減少視覺干擾，一次只顯示一件事。')],
      narr: [T('spoken narrator', '語音旁述'), T('Reads changes, warnings and results aloud using a voice installed on this device.', '用呢部裝置已安裝嘅語音朗讀變更、警告同結果。')],
      snd: [T('action sounds', '動作音效'), T('Short sounds for success and errors. They never replace the on-screen message.', '成功同錯誤嘅短音效，唔會取代畫面上嘅訊息。')],
      name: [T('display name', '顯示名稱'), T('Rename the app everywhere it shows its own name. Your router model is never renamed.', '喺所有顯示應用程式名稱嘅地方改名，路由器型號就唔會改。')]
    };
    const { lk, tips, cc } = mk(defs);

    // ---- language mode preview ----
    const lm = s.lm || 'en';
    const T2 = (en, yue) => lm === 'en' ? en : lm === 'yue' ? yue : en + ' · ' + yue;
    const modes = [['en', 'Aa', 'English', T('Every label in English.', '全部標籤用英文。')], ['yue', '粵', '粵語', T('Natural written Cantonese.', '自然嘅粵語書面語。')], ['both', 'Aa 粵', T('Both', '雙語'), T('English first, Cantonese beside it.', '英文喺前，粵語喺旁。')]].map(([id, big, name, sub]) => ({ big, name, sub, pressed: lm === id ? 'true' : 'false', pick: () => set({ lm: id }) }));
    const pr = { title: T2('Guest Wi-Fi is on', '訪客 Wi-Fi 已開啟'), body: T2('Pat enabled Guest-Home on 2.4 GHz. It switches off at 21:00.', 'Pat 喺 2.4 GHz 開咗 Guest-Home，21:00 自動關閉。'), btn: T2('Apply changes', '套用變更'), tag: T2('Online', '在線') };

    // ---- funny levels ----
    const LV = [T('Serious', '正經'), T('Light', '輕鬆'), T('Playful', '好玩'), T('Cheeky', '搞笑'), T('Dim sum', '點心級')];
    const SAMPLES = {
      tips: [['Shows the Wi-Fi channel in use.', '顯示目前使用嘅 Wi-Fi 頻道。'], ['Shows the channel your router picked.', '顯示路由器揀咗邊個頻道。'], ['The channel your router chose. It had options.', '路由器揀嘅頻道，佢其實有得揀。'], ['Your router picked this channel and is very proud.', '路由器揀咗呢個頻道，仲好自豪。'], ['Channel 44: quiet, fast, and politely ignoring the neighbours.', '44 頻道：靜、快，仲好有禮貌咁無視鄰居。']],
      errors: [['Could not reach 198.51.100.20.', '連唔到 198.51.100.20。'], ['Could not reach 198.51.100.20. Check the cable.', '連唔到 198.51.100.20，請檢查網線。'], ['198.51.100.20 did not answer. Is it asleep?', '198.51.100.20 冇回應，係咪瞓緊？'], ['198.51.100.20 left us on read. Check the cable.', '198.51.100.20 已讀不回，檢查下網線。'], ['198.51.100.20 ghosted us like a dim sum trolley at 3 pm.', '198.51.100.20 好似下午三點嘅點心車咁消失咗。']],
      empty: [['No devices match this filter.', '冇裝置符合呢個篩選。'], ['Nothing here yet. Try another filter.', '暫時冇嘢，試下其他篩選。'], ['Nothing here. Very tidy, very empty.', '乜都冇，好整齊，亦好空。'], ['No matches. The router checked twice.', '冇符合，路由器已經查過兩次。'], ['No matches. Even the router is shrugging.', '冇符合，連路由器都聳聳肩。']],
      success: [['Changes applied.', '已套用變更。'], ['Changes applied to the router.', '變更已套用到路由器。'], ['Done. The router took it well.', '搞掂，路由器接受得好好。'], ['Applied. Nobody had to restart anything.', '已套用，唔使重啟任何嘢。'], ['Applied. Smoother than a fresh egg tart.', '已套用，比新鮮出爐蛋撻仲滑。']]
    };
    const fun = s.fun || { tips: 2, errors: 1, empty: 3, success: 2 };
    const FD = [['tips', T('Tips and help', '提示同說明')], ['errors', T('Error messages', '錯誤訊息')], ['empty', T('Empty states', '空白狀態')], ['success', T('Success messages', '成功訊息')]];
    const funs = FD.map(([id, label]) => {
      const v = fun[id]; const sm = SAMPLES[id][v];
      const o = { id: 'fun-' + id, label, value: v, levelName: LV[v], sample: T2(sm[0], sm[1]), set: (e) => set({ fun: Object.assign({}, fun, { [id]: Math.round(num(e, v)) }) }) };
      for (let i = 0; i < 5; i++) o['s' + i] = i <= v ? 'on' : '';
      return o;
    });

    // ---- vocabulary drop zone ----
    const drop = s.drop || 'idle';
    const words = s.words || 0;
    const dropCfg = {
      idle: { cls: 'drop', icon: 'M12 20V9M7 14l5-5 5 5M4 5h16', title: T('Drop your vocabulary file here', '將你嘅詞彙檔案拖到呢度'), sub: T('A .json file of up to 256 KB. Nothing is uploaded: the words are checked and stored on this device only.', '最大 256 KB 嘅 .json 檔案。唔會上傳，詞彙只會喺本機檢查同儲存。') },
      ok: { cls: 'drop ok', icon: 'M5 12.5l4.5 4.5L19 7.5', title: T('42 words applied', '已套用 42 個詞彙'), sub: T('Checked, saved and live. The app now uses your words everywhere it can.', '已檢查、儲存同生效，應用程式會盡量處處使用你嘅詞彙。') },
      bad: { cls: 'drop bad shake', icon: 'M12 4l9 16H3z M12 10v4 M12 17.5h.01', title: T('That file was refused', '呢個檔案被拒絕'), sub: T('It is not valid JSON, so nothing changed. Your previous words are still in use.', '佢唔係有效嘅 JSON，所以冇任何改動，原有詞彙繼續使用。') },
      big: { cls: 'drop bad shake', icon: 'M12 4l9 16H3z M12 10v4 M12 17.5h.01', title: T('That file is too large', '檔案太大'), sub: T('The limit is 256 KB. Nothing changed.', '上限係 256 KB，冇任何改動。') }
    };
    const dc = dropCfg[drop];
    const confetti = []; for (let i = 0; i < 26; i++) confetti.push({ style: 'left:' + (3 + i * 3.7) + '%;animation-delay:' + ((i % 7) * 0.12).toFixed(2) + 's' });
    const pickFile = () => set({ drop: 'idle' });

    // ---- school and attention ----
    const school = !!s.school;
    const emoji = s.emoji !== false;
    const adhd = s.adhd || 'off';
    const aopt = s.aopt || { deco: true, tint: false, one: false, timer: false };
    const adhdDeco = school ? false : adhd === 'low' || adhd === 'focus' ? false : aopt.deco;
    const ADH = [['off', T('Off', '關')], ['focus', T('Focus', '專注')], ['low', T('Low stimulation', '低刺激')], ['chunk', T('One step at a time', '一步一步')]];
    const adhdOpts = [['deco', T('Decorative shapes', '裝飾形狀'), T('Cookies and blobs behind cards', '卡片背後嘅曲奇同雲朵')], ['tint', T('Mute colours', '柔和顏色'), T('Lower chroma on every surface', '降低所有表面嘅色度')], ['one', T('One panel at a time', '一次一個面板'), T('Collapse everything except what you opened', '收起除咗你打開之外嘅內容')], ['timer', T('Gentle break timer', '溫和休息提示'), T('A quiet reminder every 25 minutes', '每 25 分鐘輕輕提醒一次')]].map(([id, label, sub]) => ({ label, sub, on: aopt[id] ? 'true' : 'false', toggle: () => set({ aopt: Object.assign({}, aopt, { [id]: !aopt[id] }) }) }));
    const schoolEff = [[T('Personal vocabulary is suspended', '個人詞彙暫停使用'), 'background:var(--warn)'], [T('Funny levels drop to Serious', '幽默程度調返「正經」'), 'background:var(--warn)'], [T('Dialog emoji and sounds are off', '對話框表情同音效關閉'), 'background:var(--warn)']].map(([text, dot]) => ({ text, dot: school ? 'background:var(--good)' : 'background:var(--line)', _t: text })).map((e, i) => ({ text: e._t, dot: e.dot }));

    // ---- narrator ----
    const narr = !!s.narr;
    const voice = s.voice || 'hiu';
    const rate = s.rate || 1;
    const speaking = !!s.speaking;
    const VO = [['lib', 'Libby', T('English (UK) · natural', '英文（英國）· 自然')], ['ava', 'Ava', T('English (US) · natural', '英文（美國）· 自然')], ['hiu', 'HiuGaai', T('Cantonese (Hong Kong) · natural', '粵語（香港）· 自然')], ['wan', 'WanLung', T('Cantonese (Hong Kong) · natural', '粵語（香港）· 自然')]];
    const voices = VO.map(([id, name, sub]) => ({ name, sub, checked: voice === id ? 'true' : 'false', pick: () => set({ voice: id }) }));

    // ---- sounds ----
    const snd = s.snd !== false && !school;
    const vol = s.vol === undefined ? 55 : s.vol;
    const played = s.played || '';
    const cues = [['ok', T('Success tick', '成功輕響'), T('Plays after a change is applied', '變更套用之後播放'), 'background:var(--good)'], ['err', T('Error tone', '錯誤提示音'), T('Plays when something fails', '出現失敗時播放'), 'background:var(--bad)'], ['toast', T('Toast chime', '提示叮聲'), T('Plays for new notifications', '新通知時播放'), 'background:var(--primary)'], ['warn', T('Warning note', '警告音'), T('Plays for security warnings', '保安警告時播放'), 'background:var(--warn)']].map(([id, label, sub, badge]) => ({ label, sub, badge, dis: snd ? '' : 'dis', btn: played === id ? T('Playing', '播放中') : T('Play', '播放'), play: () => { if (snd) set({ played: id }); } }));

    // ---- display name ----
    const appName = s.name === undefined ? 'Material Asus Router' : s.name;

    const smile = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0"/></svg>';
    const t = {
      title: T('Language and accessibility', '語言同無障礙'), heroLabel: T('Language summary', '語言摘要'),
      chipMode: T('Mode: ', '模式：') + (lm === 'en' ? 'English' : lm === 'yue' ? '粵語' : T('Both', '雙語')), chipFun: school ? T('School mode on', '校園模式已開') : T('Funny level 2 of 4', '幽默程度 2/4'), chipLocal: T('Stays on this device', '只留喺本機'),
      headline: T('Speak it your way', '用你嘅方式講'),
      lede: T('Switch between English and Cantonese, dial the humour up or down, load your own words, and make the app calmer, louder or quieter whenever you like.', '喺英文同粵語之間切換，調高或者調低幽默感，載入你自己嘅詞彙，亦可以隨時令應用程式更平靜、更熱鬧或者更安靜。'),
      modesTitle: T('Language modes', '語言模式'), modesSub: T('The whole app follows this choice. The preview below changes at once.', '整個應用程式都跟隨呢個選擇，下面嘅預覽即時更新。'), previewLabel: T('Preview', '預覽'),
      funTitle: T('Funny levels', '幽默程度'), funSub: T('One slider per area, from serious to dim sum.', '每個範圍一條滑桿，由正經到點心級。'),
      vocabTitle: T('Personal vocabulary', '個人詞彙'), vocabSub: T('Add your own words and names. The app uses them in place of its defaults.', '加入你自己嘅用詞同名稱，應用程式會優先使用。'), dropLabel: T('Vocabulary file drop zone', '詞彙檔案拖放區'),
      chooseFile: T('Choose a file', '揀檔案'), demoValid: T('Drop a valid file', '模擬有效檔案'), demoBad: T('Drop a broken file', '模擬損壞檔案'), demoBig: T('Drop a huge file', '模擬超大檔案'),
      localOnly: T('Local only', '只限本機'), tplTitle: T('Not sure how to start?', '唔知點開始？'), tplSub: T('Download the template, add your own words, then drop it back here.', '下載範本，加入你自己嘅詞彙，再拖返入嚟。'), tplBtn: T('Download template', '下載範本'), clearVocab: T('Clear my words', '清除我嘅詞彙'), vocabNote: T('Not in the real app yet: sharing a vocabulary between two routers.', '真實應用程式未有：喺兩部路由器之間分享詞彙。'),
      schoolTitle: T('School mode and dialogs', '校園模式同對話框'), schoolOn: T('School mode', '校園模式'), schoolSub: T('Calm, work-safe wording and no surprises', '平靜、適合工作場合，冇驚喜'), schoolEffects: T('While it is on:', '開啟期間：'),
      emoji: T('Dialog emoji', '對話框表情'), emojiSub: T('A friendly face in confirmations', '確認視窗入面加個友善表情'), dlgTitle: T('Restart the router?', '要重啟路由器嗎？'), dlgBody: T('Wi-Fi will drop for about 90 seconds.', 'Wi-Fi 大約會中斷 90 秒。'), dlgCancel: T('Cancel', '取消'), dlgOk: T('Restart', '重啟'),
      adhdTitle: T('Attention modes', '專注模式'), adhdSub: T('Pick a preset or mix your own.', '揀一個預設，或者自己組合。'), adhdPreview: T('Preview', '預覽'),
      narrTitle: T('Spoken narrator', '語音旁述'), narrOn: T('Read changes aloud', '朗讀變更'), narrSub: T('Uses a voice already on this device', '使用呢部裝置已有嘅語音'), voice: T('Voice', '語音'), rate: T('Speaking rate', '語速'),
      sndTitle: T('Action sounds', '動作音效'), sndOn: T('Play sounds', '播放音效'), sndSub: T('Off in school mode', '校園模式下關閉'), volume: T('Volume', '音量'),
      nameTitle: T('Display name', '顯示名稱'), nameSub: T('Give the app your own name. It updates in the rail, the browser tab and exports at once.', '幫應用程式改個自己嘅名，側欄、瀏覽器分頁同匯出會即時更新。'), nameField: T('App name', '應用程式名稱'), nameReset: T('Reset to default', '還原預設'), nameWhere: T('Where the name appears', '名稱出現嘅位置'), nameTab: T('Overview', '概覽'), nameNote: T('Your router model, RT-AX86U, always keeps its real name.', '路由器型號 RT-AX86U 一直用返原名。')
    };
    const speakText = { lib: T('Guest Wi-Fi is on, until 21:00.', '訪客 Wi-Fi 已開啟，直至 21:00。'), ava: T('Guest Wi-Fi is on, until 21:00.', '訪客 Wi-Fi 已開啟，直至 21:00。'), hiu: '訪客 Wi-Fi 已開啟，直至晚上九點。', wan: '訪客 Wi-Fi 已開啟，直至晚上九點。' };

    return Object.assign(base([T('Settings', '設定'), T('Language', '語言'), T('Appearance', '外觀')]), {
      lk, tips, cc, t, d: D, modes, pr, funs,
      dropCls: dc.cls, dropIcon: dc.icon, dropTitle: dc.title, dropSub: dc.sub, celebrate: drop === 'ok', confetti,
      pickFile, dropValid: () => set({ drop: 'ok', words: 42 }), dropBad: () => set({ drop: 'bad' }), dropBig: () => set({ drop: 'big' }),
      wordsText: words ? words + T(' personal words active', ' 個個人詞彙生效中') : T('No personal words loaded', '未載入個人詞彙'), wordsCls: words ? 'good' : '',
      clearVocab: () => set({ words: 0, drop: 'idle' }),
      schoolP: school ? 'true' : 'false', toggleSchool: () => set({ school: !school }), schoolEff,
      emojiP: emoji && !school ? 'true' : 'false', toggleEmoji: () => set({ emoji: !emoji }), emojiOn: emoji && !school,
      adhdModes: ADH.map(([id, label]) => ({ label, pressed: adhd === id ? 'true' : 'false', pick: () => set({ adhd: id }) })), adhdOpts, adhdDeco,
      adhdCardTitle: adhd === 'chunk' ? T('Step 1 of 3: choose the network', '第 1 步（共 3 步）：揀網絡') : T('Guest network', '訪客網絡'),
      adhdCardBody: adhd === 'chunk' ? T('Only the next step is shown. Back and Next keep your place.', '只顯示下一步，返回同下一步會記住你嘅進度。') : T('Name, password, timer and bandwidth limit.', '名稱、密碼、定時同頻寬限制。'),
      narrP: narr ? 'true' : 'false', toggleNarr: () => set({ narr: !narr }), voices, rate, rateText: rate.toFixed(1) + '×', setRate: (e) => set({ rate: num(e, 1) }),
      speaking, speak: () => set({ speaking: !speaking }), speakLabel: speaking ? T('Stop', '停止') : T('Preview voice', '試聽語音'), waveCls: speaking ? 'wavy' : '',
      speakSample: speaking ? T('Speaking: ', '朗讀中：') + speakText[voice] : T('Preview reads a sample sentence.', '試聽會朗讀一句範例。'),
      sndP: snd ? 'true' : 'false', toggleSnd: () => set({ snd: !(s.snd !== false) }), vol, volText: vol + '%', setVol: (e) => set({ vol: num(e, vol) }), cues,
      sndTag: school ? T('School mode keeps sounds off', '校園模式會保持靜音') : snd ? T('Sounds on', '音效已開') : T('Sounds off', '音效已關'), sndTagCls: snd ? 'good' : 'warn',
      appName, setName: (e) => set({ name: txt(e) }), resetName: () => set({ name: undefined }), nameCount: appName.length + ' / 32'
    });`;
html+=wrapScript(script);
C.write('Language.dc.html',html);
console.log('ok',html.length);
