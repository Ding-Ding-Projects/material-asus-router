// Board: app updates for the Docker-hosted app. The owner checks for a newer
// image, replaces the running app with it, watches the steps tick off, and
// sees the previous version put back when the new one does not answer. Drawn
// at phone width like the boards in boards9.mjs; the styles are at the end of
// theme3.mjs and the board also reads at 360 px.
import { ic } from './kit.mjs';
import { S } from './boards1.mjs';

const N = (file, name2, page, bn, o) => S(file, name2, page, '', '', Object.assign({ kind: 'phone', bn, pend: 0 }, o));
const when = (v, body, shown = false) => `<sc-if value="{{${v}}}" hint-placeholder-val="{{ ${shown} }}">${body}</sc-if>`;
const each = (list, as, n, body) => `<sc-for list="{{${list}}}" as="${as}" hint-placeholder-count="${n}">${body}</sc-for>`;

// cur and next: [image id, build day, build time]
const CMD = 'docker compose -f compose.yaml -f compose.lan.yaml -f compose.update.yaml up -d';
const UPDATE = { ver: '0.1.0', cur: ['sha-8e0f4ba7cb53', '2026-11-25', '20:10'], next: ['sha-1a2b3c4d5e6f', '2026-11-25', '21:05'], times: ['02:00', '03:00', '04:00'], cmd: CMD };
function updateLogic(h) {
  const { T, V, set, D, stage, owner } = h; const X = D.x;
  const ready = (V._up ?? 1) === 1, answers = (V._ans ?? 1) === 1;
  const ph = V._ph ?? (stage === 'success' ? 'done' : stage === 'failure' ? 'back' : 'avail');
  const step = V._sp ?? 0, done = ph === 'done', run = ph === 'run', back = ph === 'back';
  const now = done ? X.next : X.cur, short = (s) => s.slice(0, 8) + '…';
  const can = owner && ready && !run && !done, auto = (V._au ?? 1) === 1, at = V._at ?? 1;
  const names = [T('Downloading the new version', '下載緊新版本'), T('Starting it', '啟動緊新版本'), T('Waiting for it to answer (up to 90 seconds)', '等緊新版本回應（最多 90 秒）'), back ? T('Previous version put back: still running ', '已經換返之前嘅版本：仍然行緊 ') + X.cur[0] : T('Done: now running ', '完成：而家行緊 ') + X.next[0]];
  const steps = names.map((label, i) => { const k = done ? 'done' : back ? (i === 2 ? 'fail' : 'done') : i < step ? 'done' : i === step ? 'now' : 'wait';
    return { label, cls: 'st10 ' + k + (k === 'fail' ? ' dr' : ''), style: '--j:' + i, isDone: k === 'done', isFail: k === 'fail', word: k === 'done' ? T('Done', '完成') : k === 'now' ? T('In progress', '進行緊') : k === 'fail' ? T('Did not answer within 90 seconds', '90 秒內冇回應') : T('Waiting', '等緊') }; });
  const log = [['20:16', T('Updated to ', '更新到 ') + short(X.cur[0]), T('by Pat', '由 Pat')], ['02:00', T('Night check: up to date', '夜間檢查：已經係最新版'), ''], [T('Yesterday 02:00', '尋日 02:00'), T('Update rolled back', '更新已還原'), T('The new version did not answer', '新版本冇回應')]];
  if (V._ph === 'done') log.unshift(['21:06', T('Updated to ', '更新到 ') + short(X.next[0]), T('by Pat', '由 Pat')]);
  if (V._ph === 'back') log.unshift(['21:06', T('Update rolled back', '更新已還原'), T('The new version did not answer', '新版本冇回應')]);
  return { runLine: X.ver + ' · ' + now[0] + ' · ' + T('built ', '建置於 ') + now[1] + ' ' + now[2], newLine: X.next[0] + ' (' + T('built ', '建置於 ') + X.next[2] + ')',
    tag: done ? T('You are up to date', '已經係最新版') : run ? T('Updating', '更新緊') : T('Update available', '有更新'), tagCls: done ? 'tag good' : run ? 'tag warn live' : 'tag pri',
    checked: !!V._chk && !run, checkedTxt: done ? T('Checked just now. You are up to date.', '啱啱檢查過，已經係最新版。') : T('Checked just now. ', '啱啱檢查過。') + X.next[0] + T(' is available.', ' 可以更新。'),
    check: () => { if (!run) set({ _chk: true, _ph: back ? 'avail' : ph }); },
    updCls: 'btn fill sm w' + (can && !back ? ' hot dr' : ''), updDis: can ? 'false' : 'true', update: () => { if (can) set({ _ph: 'run', _sp: 0, _chk: false }); },
    notOwner: !owner, notSetUp: !ready, cmd: X.cmd, copy: () => set({ _cp: true }), copyLabel: V._cp ? T('Copied', '已複製') : T('Copy the command', '複製指令'),
    showSteps: run || back || V._ph === 'done', steps, running: run, back, stepTxt: T('Step ', '第 ') + Math.min(step + 1, 4) + T(' of 4', ' 步，共 4 步'),
    next: () => { if (!run) return; if (step < 2) set({ _sp: step + 1 }); else set(answers ? { _ph: 'done', _sp: 3 } : { _ph: 'back' }); },
    reset: () => set({ _ph: 'avail', _sp: 0, _chk: false }), canReset: done || back,
    upCls: 'sw' + (ready ? ' on' : ''), upOn: ready ? 'true' : 'false', flipUp: () => set({ _up: ready ? 0 : 1 }),
    ansCls: 'sw' + (answers ? ' on' : ''), ansOn: answers ? 'true' : 'false', flipAns: () => set({ _ans: answers ? 0 : 1 }),
    auCls: 'sw w' + (auto ? ' on' : ''), auOn: auto ? 'true' : 'false', auDis: owner && ready ? 'false' : 'true', flipAuto: () => { if (owner && ready) set({ _au: auto ? 0 : 1 }); }, auto,
    atIdx: at, times: X.times.map((label, i) => ({ label, pressed: at === i ? 'true' : 'false', pick: () => { if (owner && ready) set({ _at: i }); } })),
    nextCheck: ready ? T('Next night check: tonight at ', '下次夜間檢查：今晚 ') + X.times[at] : T('Night checks start once the updater service is running.', '更新服務行緊之後，先會開始夜間檢查。'),
    log: log.map((r, j) => ({ t: r[0], a: r[1], b: r[2], style: '--j:' + j })) };
}

const KEPT = 'Your accounts, router settings and change history are kept; only the app is replaced.|你嘅帳戶、路由器設定同改動記錄都會保留，淨係換咗個應用程式。';
const NEEDS = 'Self-updating needs the small updater service next to the app (compose.update.yaml). Start it with this command on the computer that runs the app.|自動更新要喺應用程式旁邊行一個細嘅更新服務（compose.update.yaml）。喺行緊應用程式嗰部電腦執行呢句指令。';

export const B10 = [
  N('AppUpdate', 'App updates|應用程式更新', 'updates', 4, {
    name: 'App updates (owner only, Docker-hosted app)', data: UPDATE, logic: updateLogic,
    st: { empty: ['wrench', 'Updater not set up|未設定更新服務', `<span>${NEEDS}</span><span class="pub9 cmd10">${CMD}</span>`, 'Show the updates screen|顯示更新畫面'], ok: ['Updated|已更新', 'The app now runs sha-1a2b3c4d5e6f and answered its health check. Your accounts, router settings and change history are as they were.|應用程式而家行緊 sha-1a2b3c4d5e6f，並通過咗健康檢查。你嘅帳戶、路由器設定同改動記錄同之前一樣。'], no: ['Update rolled back|更新已還原', 'The new version did not answer within 90 seconds, so the previous one (sha-8e0f4ba7cb53) was put back. Nothing else changed.|新版本喺 90 秒內冇回應，所以已經換返之前嘅版本（sha-8e0f4ba7cb53）。其他嘢冇變。'] },
    shows: 'App updates for the Docker-hosted app at phone width, for the owner only. A header card with the running version ("0.1.0 · sha-8e0f4ba7cb53 · built 2026-11-25 20:10"), the newest version ("sha-1a2b3c4d5e6f (built 21:05)") and an "Update available" tag, or "You are up to date". Two buttons, Check for updates and Update now. While updating, a list of four steps that tick off: Downloading the new version, Starting it, Waiting for it to answer (up to 90 seconds), Done: now running the new image; with the line that accounts, router settings and change history are kept. The rollback state marks the step that failed, says the previous version was put back and nothing else changed, and offers Try again. "Update automatically every night" with a time choice (02:00, 03:00, 04:00) and the health-check line. The "Updater not set up" card with the compose command for the updater service. A Recent updates list.',
    tryIt: 'Check for updates; Update now, then "Finish this step" three times (each step turns green; the last one names the new image and the tag becomes "You are up to date"); turn off "The new version answers" in the dashed canvas box and update again (the waiting step turns red and shakes once, the previous version is named as still running, Try again appears); turn off "Updater service installed" (the set-up card with the command appears, Update now and the night switch are off); Copy the command; the night switch and the three times; Start again; Tweaks > stage empty (updater not set up), success (updated) and failure (rolled back), role operator or viewer (only the owner can update), motion standard and calm, lang, dark, accent.',
    real: 'an App updates screen in the app settings and the updater service started with compose.update.yaml.', unbuilt: 'All of it when this board was drawn: the app has no self-update screen and compose.update.yaml is not in the repository yet. In the app the steps tick off as the updater reports them; on this board "Finish this step" stands in for each report. The dashed box is for the canvas only.',
    dram: 'The failed step shakes once when the new version does not answer; the Update now button has a rotating border while an update is available.', norm: 'Step marks pop to a green tick one after another and the current step shows a small spinner; the tag, the checked line and the set-up card pop in; the time indicator slides; rows cascade in. With motion calm or reduced motion the spinner stops and the state words (Done, In progress, Waiting) still say where it is.',
    build: (C) => `<div class="b9">`
      + `<div class="cv10" role="group" aria-label="Canvas only|只限畫布"><span class="lab9">Canvas only|只限畫布</span>`
      + `<div class="rowx"><span class="t2 grow">Updater service installed|已裝更新服務</span><button class="{{x.upCls}}" role="switch" aria-checked="{{x.upOn}}" aria-label="Updater service installed|已裝更新服務" onClick="{{x.flipUp}}"><i></i></button></div>`
      + `<div class="rowx"><span class="t2 grow">The new version answers|新版本有回應</span><button class="{{x.ansCls}}" role="switch" aria-checked="{{x.ansOn}}" aria-label="The new version answers|新版本有回應" onClick="{{x.flipAns}}"><i></i></button></div>`
      + when('x.canReset', `<button class="btn out sm" onClick="{{x.reset}}">${ic('undo', 18)}<span>Start again|由頭嚟過</span></button>`) + `</div>`
      + C.tile('', { title: 'This app|呢個應用程式', ic: 'box', tone: 'pri' }, `<div class="ver10"><span class="lab9">Running version|而家行緊嘅版本</span><span class="mono">{{x.runLine}}</span></div>`
        + `<div class="ver10"><span class="lab9">Newest version|最新版本</span><span class="mono">{{x.newLine}}</span></div>`
        + `<div class="rowx"><span class="{{x.tagCls}}" role="status">{{x.tag}}</span></div>`
        + `<div class="pair9"><button class="btn out sm" onClick="{{x.check}}">${ic('refresh', 18)}<span>Check for updates|檢查更新</span></button><button class="{{x.updCls}}" aria-disabled="{{x.updDis}}" onClick="{{x.update}}">${ic('download', 18)}<span>Update now|即刻更新</span></button></div>`
        + when('x.checked', `<div class="sub" role="status">{{x.checkedTxt}}</div>`)
        + when('x.notOwner', `<div class="sub">Only the owner can update the app.|淨係擁有人先可以更新應用程式。</div>`))
      + when('x.notSetUp', C.tile('', { title: 'Updater not set up|未設定更新服務', ic: 'wrench' }, `<div class="sub">${NEEDS}</div><div class="pub9">{{x.cmd}}</div><button class="btn ton sm" onClick="{{x.copy}}">${ic('copy', 18)}<span>{{x.copyLabel}}</span></button>`))
      + when('x.showSteps', `<section class="chg9" aria-label="Update progress|更新進度" aria-live="polite"><header class="th"><span class="tic">${ic('download')}</span><h3>Update progress|更新進度</h3>${when('x.running', `<span class="tag pri">{{x.stepTxt}}</span>`)}</header>`
        + `<div class="steps10" role="list">${each('x.steps', 'sp', 4, `<div class="{{sp.cls}}" role="listitem" style="{{sp.style}}"><span class="sm10" aria-hidden="true">${when('sp.isDone', ic('check', 16, 2.8))}${when('sp.isFail', ic('x', 16, 2.8))}</span><div class="grow"><div class="t1">{{sp.label}}</div><div class="t2">{{sp.word}}</div></div></div>`)}</div>`
        + `<div class="sub">${KEPT}</div>`
        + when('x.running', `<button class="btn ton sm" onClick="{{x.next}}">${ic('play', 18)}<span>Canvas only: finish this step|只限畫布：完成呢一步</span></button>`)
        + when('x.back', `<div class="note9 bad" role="alert">${ic('alert', 20)}<span>The new version did not answer, so the previous one was put back. Nothing else changed.|新版本冇回應，所以已經換返之前嗰個版本。其他嘢冇變。</span></div><button class="btn fill sm w" aria-disabled="{{x.updDis}}" onClick="{{x.update}}">${ic('refresh', 18)}<span>Try again|再試</span></button>`)
        + `</section>`)
      + C.tile('', { title: 'Night updates|夜間更新', ic: 'moon' }, `<div class="rowx" style="flex-wrap:nowrap"><div class="t1 grow">Update automatically every night|每晚自動更新</div><button class="{{x.auCls}}" role="switch" aria-checked="{{x.auOn}}" aria-disabled="{{x.auDis}}" aria-label="Update automatically every night|每晚自動更新" onClick="{{x.flipAuto}}"><i></i></button></div>`
        + when('x.auto', `<div class="seg w" role="group" aria-label="Time of the night check|夜間檢查嘅時間" style="--cnt:3;--idx:{{x.atIdx}}"><i class="ind"></i>${each('x.times', 'tm', 3, `<button aria-pressed="{{tm.pressed}}" onClick="{{tm.pick}}">{{tm.label}}</button>`)}</div><div class="t2">{{x.nextCheck}}</div>`, true)
        + `<div class="sub">Only when the new version passes its health check; otherwise the current one keeps running.|新版本通過健康檢查先會換；唔係嘅話，現有版本會繼續行。</div>`)
      + `<div class="lab9">Recent updates|最近嘅更新</div><div class="rows log9">${each('x.log', 'lg', 3, `<div class="row" style="{{lg.style}}"><span class="tm">{{lg.t}}</span><div class="grow"><div class="t1">{{lg.a}}</div><div class="t2">{{lg.b}}</div></div></div>`)}</div>`
      + `</div>`
  })
];
