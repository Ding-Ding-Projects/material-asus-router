// Change safety in the browser: Live and Review mode, the undo toast, undo and
// redo, the four-key confirmation, the Level 3 warning, the reboot launch
// sequence, the live progress timeline and quiet apply. The pieces that need no
// browser live in model.js; the pictures live in sims/.
import { api, bus, clear, getLang, h, icon, openDialog, t, tt, toast } from "../../core.js";
import { buildProof, chipText, chordMatches, keyState, levelOf, outageText, refusalText, SHORTCUTS } from "./model.js";
import { simulateChange } from "./sims/index.js";

// The original post, kept before the app-wide guard below wraps api.post for everyone else.
const RAW_POST = api.post;
export const rawPost = (url, body) => RAW_POST(url, body);

export const safety = { owner: false, live: true, loaded: false, undo: [], redo: [], allowance: null, presence: null, impact: null, busy: false };

export const reducedMotion = () => {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errorText = (error) => {
  const r = refusalText(error);
  return r ? t(r.en, r.yue) : error.data?.yue && getLang() !== "en" ? (getLang() === "yue" ? error.data.yue : `${error.message}\n${error.data.yue}`) : error.message;
};

// ---- load and refresh --------------------------------------------------------------

export async function loadSafety(me = null) {
  if (me) safety.owner = me.role === "owner";
  try {
    const [settings, undo] = await Promise.all([api.get("/api/safety/settings"), api.get("/api/safety/undo-state")]);
    safety.live = settings.liveMode !== false;
    safety.undo = undo.undo ?? [];
    safety.redo = undo.redo ?? [];
    safety.loaded = true;
  } catch {
    safety.loaded = false;
  }
  bus.emit("safety");
  return safety;
}
export async function refreshUndo() {
  try {
    const state = await api.get("/api/safety/undo-state");
    safety.undo = state.undo ?? [];
    safety.redo = state.redo ?? [];
  } catch {}
  bus.emit("safety");
}
export async function refreshAllowance() {
  try {
    const [allowance, presence] = await Promise.all([api.get("/api/household/allowance"), api.get("/api/household/presence")]);
    safety.allowance = allowance;
    safety.presence = presence;
  } catch {}
  bus.emit("safety");
  return safety.allowance;
}
export async function setLiveMode(on) {
  try {
    const out = await rawPost("/api/safety/settings", { liveMode: on });
    safety.live = out.liveMode !== false;
    toast(safety.live ? t("Live mode on: changes apply as you make them.", "即時模式已開：改動會即刻套用。") : t("Review mode: you check every change before it applies.", "檢查模式：每項改動都要先檢查先套用。"));
  } catch (error) {
    toast(errorText(error), "bad");
  }
  bus.emit("safety");
}

// ---- badges --------------------------------------------------------------------------

export function levelBadge(level, { label = true, size = "sm" } = {}) {
  const info = levelOf(level);
  return h("span", { class: `lvl lv${info.level}`, title: `${tt(info.name)}: ${tt(info.about)}`, "data-level": String(info.level) }, icon(info.icon, size), h("b", {}, info.level === 0 ? "0" : `L${info.level}`), label ? h("span", { class: "lvl-name" }, tt(info.name)) : null);
}

// ---- the guarded call: four keys, allowance and owner override --------------------------

// `call(extra)` makes the request with `{ confirmation?, override? }` merged in.
// 428 asks for the four keys, 403 ALLOWANCE for the household's say.
export async function guarded(call, context = {}, firstError = null) {
  const extra = {};
  let seed = firstError;
  for (let round = 0; round < 5; round += 1) {
    try {
      if (seed) { const e = seed; seed = null; throw e; }
      return await call(extra, context);
    } catch (error) {
      if (error.code === "CONFIRM_REQUIRED") {
        const detail = error.data?.detail ?? {};
        if (detail.previewId) context.previewId = detail.previewId;
        const proof = await confirmDialog(detail.confirmation ?? detail, context);
        if (!proof) return null;
        extra.confirmation = proof;
        continue;
      }
      if (error.code === "ALLOWANCE") {
        if (error.data?.detail?.previewId) context.previewId = error.data.detail.previewId;
        const ok = await allowanceDialog(error.data?.detail ?? {});
        if (!ok) return null;
        extra.override = true;
        continue;
      }
      if (/^CONFIRM_/.test(error.code ?? "")) {
        toast(errorText(error), "bad");
        delete extra.confirmation;
        continue;
      }
      throw error;
    }
  }
  throw new Error(t("The confirmation did not go through. Try again.", "確認唔成功，請再試。"));
}

// ---- who is affected: the banner -----------------------------------------------------------

function impactBanner(level, reboot) {
  const box = h("div", { class: `impact-banner lv${level}` });
  const render = () => {
    clear(box);
    const members = safety.presence?.members ?? [];
    const lines = [];
    for (const m of members.filter((x) => x.configured)) {
      const wifi = (m.sources ?? []).find((s) => s.source === "wifi");
      const online = (wifi?.devices ?? []).map((d) => d.label);
      const text = online.length
        ? t(`${m.name}: ${online.join(", ")} ${online.length === 1 ? "is" : "are"} online on Wi-Fi now and will drop.`, `${m.nameYue ?? m.name}：${online.join("、")} 而家連住 Wi-Fi，會斷線。`)
        : m.state === "away"
          ? t(`${m.name} has no device on the home Wi-Fi right now.`, `${m.nameYue ?? m.name}而家冇裝置連住屋企 Wi-Fi。`)
          : t(`Cannot tell which of ${m.name}'s devices are online: only wired devices, or the list is not set up.`, `睇唔到${m.nameYue ?? m.name}邊部裝置喺線：可能只有有線裝置，或者仲未設定。`);
      lines.push(h("div", { class: "row" }, icon(online.length ? "devices" : "help", "sm"), h("div", { class: "grow" }, text)));
    }
    if (!lines.length) lines.push(h("div", { class: "row" }, icon("groups", "sm"), h("div", { class: "grow" }, t("Nobody is set up in the household yet, so every device at home counts as affected.", "屋企仲未設定任何人，所以所有裝置都當係受影響。"))));
    box.append(h("div", { class: "ib-head" }, levelBadge(level), h("b", {}, t("Who will notice", "邊個會留意到"))), ...lines, h("div", { class: "t2" }, icon("timer", "sm"), tt(outageText(level, reboot))));
  };
  render();
  refreshAllowance().then(render);
  return box;
}

// ---- the Level 3 warning --------------------------------------------------------------------

export async function warnLevel3() {
  const dlg = openDialog((closeIt) => {
    const still = reducedMotion();
    const go = h("button", { class: "btn d", disabled: !still, onClick: () => closeIt(true) }, icon("arrow_forward", "sm"), t("I understand, continue", "我明白，繼續"));
    if (!still) setTimeout(() => { go.disabled = false; }, 1600);
    return [
      h("div", { class: `warn3 ${still ? "still" : ""}`, role: "alertdialog", "aria-labelledby": "warn3-title" },
        h("div", { class: "warn3-stripes", "aria-hidden": "true" }),
        h("div", { class: "warn3-core" },
          h("div", { class: "warn3-icon", "aria-hidden": "true" }, icon("emergency_home", "lg"), icon("crisis_alert", "lg"), icon("emergency_home", "lg")),
          h("h1", { id: "warn3-title", class: "disp warn3-title" }, t("Prepare for brother mad", "預備你兄弟發火")),
          h("p", { class: "warn3-sub" }, t("This change can take the internet or the router down. Devices may need to be reconnected by hand.", "呢個改動可能令上網或路由器停頓，裝置可能要人手重新連線。")),
          h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => closeIt(false) }, icon("close", "sm"), t("Cancel, take me back", "取消，返轉頭")), go))),
    ];
  }, { label: t("Prepare for brother mad", "預備你兄弟發火") });
  dlg.sheet.parentNode.classList.add("fs-warning");
  dlg.sheet.classList.add("fs");
  return (await dlg.closed) === true;
}

// ---- the four keys ----------------------------------------------------------------------------

// Resolves with the proof to send, or null when the person cancels.
export async function confirmDialog(detail, context = {}) {
  const level = detail.impact ?? context.level ?? 1;
  if (level >= 3 && !context.skipWarning && !(await warnLevel3())) return null;
  const people = detail.steps?.acknowledge?.people ?? [];
  const input = { acked: [], typed: "", holdMs: 0, chord: false, noPeopleAck: people.length === 0 ? false : true };
  const minMs = detail.steps?.hold?.minMs ?? 1500;
  const keys = detail.steps?.chord?.keys ?? SHORTCUTS.confirm;
  let holdStart = 0;
  let holdTimer = null;
  let holdFill;
  let dialog;
  const status = () => keyState(detail, input);

  const dlg = openDialog((close, render) => {
    const s = status();
    const mark = (ok) => h("span", { class: `key-ok ${ok ? "on" : ""}`, "aria-hidden": "true" }, icon(ok ? "check_circle" : "radio_button_unchecked", "sm"));
    const ackBox = people.length
      ? people.map((p) => h("label", { class: "row" }, h("input", { type: "checkbox", checked: input.acked.includes(p.id), onChange: (e) => { input.acked = e.target.checked ? [...input.acked, p.id] : input.acked.filter((x) => x !== p.id); render(); } }), h("span", {}, t(`I know ${p.name}'s devices will be affected.`, `我知道${p.nameYue ?? p.name}嘅裝置會受影響。`))))
      : [h("label", { class: "row" }, h("input", { type: "checkbox", checked: input.noPeopleAck, onChange: (e) => { input.noPeopleAck = e.target.checked; render(); } }), h("span", {}, t("I know everyone at home may be affected.", "我知道屋企所有人都可能受影響。")))];
    holdFill = h("span", { class: "hold-fill" });
    const holdBtn = h("button", { class: `btn hold ${s.keys.hold ? "ok" : ""}`, type: "button", "aria-describedby": "hold-help",
      onPointerdown: (e) => { e.preventDefault(); beginHold(); }, onPointerup: endHold, onPointerleave: endHold, onPointercancel: endHold,
      onKeydown: (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat && !e.ctrlKey) { e.preventDefault(); beginHold(); } },
      onKeyup: (e) => { if (e.key === " " || e.key === "Enter") endHold(); } }, holdFill, h("span", { class: "hold-text" }, icon("touch_app", "sm"), s.keys.hold ? t("Held long enough", "撳得夠耐") : t("Press and hold", "撳住唔好放")));
    const typed = h("input", { type: "text", value: input.typed, autocomplete: "off", spellcheck: "false", "aria-label": t(`Type ${s.shortName}`, `輸入 ${s.shortName}`), placeholder: s.shortName, onInput: (e) => { input.typed = e.target.value; refreshGo(); } });
    const go = h("button", { class: `btn ${level >= 3 ? "d" : "f"}`, disabled: !s.ready, onClick: () => close(buildProof(detail, input)) }, icon("lock_open", "sm"), t("Turn all four keys", "四把匙一齊轉"));
    const refreshGo = () => { const st = status(); go.disabled = !st.ready; typedMark.replaceWith((typedMark = mark(st.keys.typeName))); };
    let typedMark = mark(s.keys.typeName);
    return [
      h("div", { class: "sheet-head" }, levelBadge(level), h("h2", { class: "h2" }, t("Four keys to turn", "要轉四把匙"))),
      impactBanner(level, detail.target === "action:reboot"),
      detail.steps ? null : h("div", { class: "note warn" }, icon("info"), h("div", {}, t("The router did not ask for any keys.", "路由器冇要求任何匙。"))),
      h("div", { class: "keys" },
        h("section", { class: "key" }, h("div", { class: "key-h" }, mark(s.keys.acknowledge), h("b", {}, t("Key 1 · Acknowledge", "第 1 把 · 確認"))), ackBox),
        h("section", { class: "key" }, h("div", { class: "key-h" }, typedMark, h("b", {}, t("Key 2 · Type the name", "第 2 把 · 輸入名稱"))), h("div", { class: "t2" }, t("Type exactly:", "請原字輸入："), " ", h("span", { class: "mono" }, s.shortName)), typed),
        h("section", { class: "key" }, h("div", { class: "key-h" }, mark(s.keys.hold), h("b", {}, t("Key 3 · Hold", "第 3 把 · 撳住"))), h("div", { id: "hold-help", class: "t2" }, t(`Hold for ${(minMs / 1000).toFixed(1)} seconds.`, `撳住 ${(minMs / 1000).toFixed(1)} 秒。`)), holdBtn),
        h("section", { class: "key" }, h("div", { class: "key-h" }, mark(s.keys.chord), h("b", {}, t("Key 4 · Key combination", "第 4 把 · 組合鍵"))), h("div", { class: "t2" }, t("Press", "撳"), " ", h("kbd", {}, keys), t(" together.", " 一齊。")),
          h("button", { class: `btn ${s.keys.chord ? "ok" : "t"}`, type: "button", onClick: () => { toast(t(`Press ${keys} on the keyboard.`, `用鍵盤撳 ${keys}。`)); } }, icon("keyboard", "sm"), s.keys.chord ? t("Pressed", "已撳") : t("Waiting for the keys", "等緊組合鍵")))),
      simulateChange ? simulationHost(context) : null,
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(null) }, icon("close", "sm"), t("Cancel", "取消")), go),
    ];
  }, { label: t("Confirm the change", "確認改動") });
  dialog = dlg.sheet.parentNode;
  dlg.sheet.classList.add("keys-sheet");

  function beginHold() {
    if (holdStart) return;
    holdStart = performance.now();
    holdFill?.classList.add("going");
    holdTimer = setInterval(() => {
      const ratio = Math.min((performance.now() - holdStart) / minMs, 1);
      holdFill?.style.setProperty("--p", String(ratio));
    }, 50);
  }
  function endHold() {
    if (!holdStart) return;
    clearInterval(holdTimer);
    input.holdMs = Math.max(input.holdMs, performance.now() - holdStart);
    holdStart = 0;
    dlg.render();
  }
  const onKey = (e) => {
    if (chordMatches(e, keys)) { e.preventDefault(); input.chord = true; dlg.render(); }
  };
  dialog.addEventListener("keydown", onKey);
  const result = await dlg.closed;
  dialog.removeEventListener("keydown", onKey);
  clearInterval(holdTimer);
  return result ?? null;
}

export function simulationHost(context) {
  const wrap = h("div", { class: "sim-wrap" });
  const items = context.preview?.items ?? context.items ?? [];
  if (!items.length) {
    wrap.hidden = true;
    return wrap;
  }
  const stage = h("div", { class: "sim-host" });
  const show = (i) => {
    clear(stage);
    try {
      simulateChange(stage, items[i], { all: items });
    } catch (error) {
      stage.append(h("div", { class: "muted" }, error.message));
    }
  };
  if (items.length > 1)
    wrap.append(h("label", { class: "field" }, h("span", {}, t("Picture for", "圖解對象")), h("select", { onChange: (e) => show(Number(e.target.value)) }, items.map((item, i) => h("option", { value: String(i) }, tt(item.label ?? { en: item.key, yue: item.key }))))));
  wrap.append(stage);
  show(0);
  return wrap;
}

// ---- the household's say: allowance refusal -----------------------------------------------------

async function allowanceDialog(detail) {
  const owner = safety.owner === true;
  const dlg = openDialog((close) => [
    h("div", { class: "sheet-head" }, levelBadge(detail.impact ?? 1), h("h2", { class: "h2" }, t("Not right now", "依家唔得"))),
    h("div", { class: "note warn" }, icon("family_restroom"), h("div", {}, t(`The household allows up to Level ${detail.allowed ?? 0} right now, and this change is Level ${detail.impact ?? "?"}.`, `屋企依家最多容許級數 ${detail.allowed ?? 0}，而呢個改動係級數 ${detail.impact ?? "?"}。`))),
    h("div", {}, (detail.people ?? []).map((p) => h("div", { class: "row" }, icon(p.presence === "home" ? "home" : p.presence === "away" ? "directions_walk" : "help", "sm"), h("div", { class: "grow" }, h("b", {}, tt({ en: p.name, yue: p.nameYue ?? p.name })), h("div", { class: "t2" }, p.reason ? tt(p.reason) : "")), levelBadge(p.allowed, { label: false })))),
    h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close(false) }, t("Wait, do it later", "等陣，遲啲先做")),
      owner ? h("button", { class: "btn d", onClick: () => close(true) }, icon("gavel", "sm"), t("Override as the owner", "以擁有人身份覆寫")) : h("span", { class: "muted" }, t("Only the owner can override this.", "只有擁有人可以覆寫。"))),
  ], { label: t("The household says not now", "屋企話依家唔得") });
  return (await dlg.closed) === true;
}

// ---- progress timeline ------------------------------------------------------------------------------

// A timeline that keeps refreshing until the run is really finished.
export function progressTimeline(runId, { onEnd } = {}) {
  const list = h("ol", { class: "timeline", "aria-live": "polite" });
  const head = h("div", { class: "tl-head" });
  const box = h("div", { class: "tl" }, head, list);
  let stopped = false;
  let finished = false;
  const draw = (run) => {
    clear(head);
    const status = run.status ?? "running";
    head.append(h("span", { class: `tag ${status === "done" ? "good" : status === "failed" || status === "timeout" ? "bad" : "warn"}` }, icon(status === "done" ? "check_circle" : status === "running" ? "sync" : "error", "sm"), t(status === "running" ? "Working" : status === "done" ? "Finished" : status, status === "running" ? "進行緊" : status === "done" ? "完成" : status)), h("b", {}, run.title ? tt(run.title) : ""));
    clear(list).append(...(run.steps ?? []).map((s) => h("li", { class: `tl-step ${s.state}` }, h("span", { class: "tl-dot", "aria-hidden": "true" }, icon(s.state === "done" ? "check" : s.state === "failed" ? "close" : s.state === "waiting" ? "hourglass_top" : s.state === "info" ? "info" : "sync", "sm")), h("div", { class: "grow" }, h("div", { class: "t1" }, tt(s.label)), s.detail ? h("div", { class: "t2" }, s.detail) : null), h("span", { class: "muted" }, new Date(s.at).toLocaleTimeString([], { hour12: false })))));
    if (run.status && run.status !== "running" && !finished) {
      finished = true;
      onEnd?.(run);
    }
  };
  const poll = async () => {
    while (!stopped && !finished) {
      try {
        draw(await api.get(`/api/safety/runs/${runId}`));
      } catch (error) {
        if (error.status === 404) break;
      }
      if (!finished) await wait(finished ? 0 : 600);
    }
  };
  poll();
  return { el: box, stop: () => { stopped = true; }, get finished() { return finished; } };
}

export function openProgress(runId, title, preview = null) {
  if (runId) markSeen(runId);
  let line;
  const dlg = openDialog((close) => {
    line = progressTimeline(runId, { onEnd: () => { refreshUndo(); bus.emit("changed"); doneBtn.disabled = false; } });
    const doneBtn = h("button", { class: "btn f", onClick: () => close(true) }, t("Close", "關閉"));
    return [h("h2", { class: "h2" }, title ?? t("What is happening", "而家發生緊乜")), h("p", { class: "muted" }, t("This keeps updating until the router has answered and its settings have been read back.", "呢度會不斷更新，直至路由器有回應同埋設定讀返出嚟。")), line.el, preview?.items?.length ? simulationHost({ preview }) : null, h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Hide", "收埋")), doneBtn)];
  }, { label: t("Progress", "進度") });
  dlg.closed.then(() => line?.stop());
  return dlg;
}

// ---- applying -------------------------------------------------------------------------------------------

export function recordSummary(record) {
  return { applied: t("Applied", "已套用"), "reverted-by-guard": t("Put back by the safety net", "安全機制已還原"), failed: t("Failed", "失敗"), unreachable: t("Router not reachable", "路由器連唔到"), guarded: t("Waiting for the router", "等緊路由器") }[record.status] ?? record.status;
}

// Live apply: preview and apply in one step.
export async function applyLive(body, { preview = null, title } = {}) {
  safety.busy = true;
  bus.emit("safety");
  try {
    const record = await guarded((extra) => rawPost("/api/changes/live", { ...body, ...extra }), { preview });
    if (!record) return null;
    await afterApply(record, preview, title);
    return record;
  } catch (error) {
    toast(errorText(error), "bad");
    return null;
  } finally {
    safety.busy = false;
    bus.emit("safety");
  }
}

export async function applyPreviewId(previewId, { verifyHost, preview = null, title } = {}) {
  safety.busy = true;
  bus.emit("safety");
  try {
    const record = await guarded((extra) => rawPost("/api/changes/apply", { previewId, verifyHost, ...extra }), { preview, previewId });
    if (!record) return null;
    await afterApply(record, preview, title);
    return record;
  } catch (error) {
    toast(errorText(error), "bad");
    return null;
  } finally {
    safety.busy = false;
    bus.emit("safety");
  }
}

async function afterApply(record, preview, title) {
  await refreshUndo();
  bus.emit("changed");
  // The picture comes from the preview when there is one, and from the record's own old and new values otherwise (undo, redo, restore).
  if (record.runId && !seen.has(record.runId)) openProgress(record.runId, title, preview ?? { items: record.items ?? [] });
  if (record.status === "applied") undoToast(record, preview);
}

// A toast with an Undo button, kept for eight seconds.
export function undoToast(record, preview) {
  const host = document.querySelector("#toasts");
  if (!host) return;
  const el = h("div", { class: "toast undo-toast", role: "status" }, icon("check_circle", "sm"), h("span", { class: "grow" }, t("Applied.", "已套用。"), preview?.items?.length ? ` ${tt(preview.items[0].label)}${preview.items.length > 1 ? ` +${preview.items.length - 1}` : ""}` : ""),
    h("button", { class: "btn t sm", onClick: async () => { el.remove(); await undo(); } }, icon("undo", "sm"), t("Undo", "還原"), h("kbd", {}, SHORTCUTS.undo)));
  host.append(el);
  setTimeout(() => el.remove(), 8000);
}

// ---- undo and redo --------------------------------------------------------------------------------------

export async function stackStep(kind) {
  if (safety.busy) return null;
  const list = kind === "undo" ? safety.undo : safety.redo;
  if (!list.length) {
    toast(kind === "undo" ? t("Nothing to undo.", "冇嘢可以還原。") : t("Nothing to redo.", "冇嘢可以重做。"));
    return null;
  }
  safety.busy = true;
  bus.emit("safety");
  try {
    if (safety.live) {
      const record = await guarded((extra, ctx) => (ctx.previewId ? rawPost("/api/changes/apply", { previewId: ctx.previewId, ...extra }) : rawPost(`/api/safety/${kind}`, { apply: true, ...extra })), {});
      if (!record) return null;
      await afterApply(record, null, kind === "undo" ? t("Undoing", "還原緊") : t("Redoing", "重做緊"));
      return record;
    }
    const preview = await rawPost(`/api/safety/${kind}`, { apply: false });
    const { reviewPreview } = await import("../../dock.js");
    return reviewPreview(preview, { title: kind === "undo" ? t("Undo this change", "還原呢項改動") : t("Redo this change", "重做呢項改動"), applyVia: (extra) => rawPost(`/api/safety/${kind}`, { previewId: preview.id, ...extra }) });
  } catch (error) {
    toast(errorText(error), "bad");
    return null;
  } finally {
    safety.busy = false;
    bus.emit("safety");
  }
}
export const undo = () => stackStep("undo");
export const redo = () => stackStep("redo");

// ---- quiet apply and apply later -------------------------------------------------------------------------

export async function scheduleDialog(body, { preview = null } = {}) {
  const input = { mode: "quiet", at: "", notBefore: "", notAfter: "" };
  const dlg = openDialog((close, render) => [
    h("h2", { class: "h2" }, t("Apply later", "遲啲再套用")),
    h("div", { class: "seg", role: "radiogroup", "aria-label": t("When", "幾時") },
      [["quiet", t("When the house is quiet", "屋企冇人用嗰陣")], ["at", t("At a set time", "喺指定時間")]].map(([id, label]) => h("button", { role: "radio", "aria-checked": String(input.mode === id), class: input.mode === id ? "on" : "", onClick: () => { input.mode = id; render(); } }, label))),
    input.mode === "at"
      ? h("label", { class: "field" }, h("span", {}, t("Time", "時間")), h("input", { type: "datetime-local", value: input.at, onInput: (e) => (input.at = e.target.value) }))
      : [h("p", { class: "muted" }, t("The change waits until nobody's devices are on the home Wi-Fi, then applies by itself. Nothing is stored about who was home.", "改動會等到冇人嘅裝置連住屋企 Wi-Fi，然後自動套用。唔會記錄邊個喺屋企。")),
        h("div", { class: "grid2" }, h("label", { class: "field" }, h("span", {}, t("Not before", "唔早過")), h("input", { type: "datetime-local", value: input.notBefore, onInput: (e) => (input.notBefore = e.target.value) })), h("label", { class: "field" }, h("span", {}, t("Not after", "唔遲過")), h("input", { type: "datetime-local", value: input.notAfter, onInput: (e) => (input.notAfter = e.target.value) })))],
    h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(null) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: () => close({ ...input }) }, icon("schedule", "sm"), t("Schedule it", "安排"))),
  ], { label: t("Apply later", "遲啲再套用") });
  const chosen = await dlg.closed;
  if (!chosen) return null;
  const when = chosen.mode === "at" ? { at: new Date(chosen.at).toISOString() } : { quiet: true, ...(chosen.notBefore ? { notBefore: new Date(chosen.notBefore).toISOString() } : {}), ...(chosen.notAfter ? { notAfter: new Date(chosen.notAfter).toISOString() } : {}) };
  if (chosen.mode === "at" && !chosen.at) return void toast(t("Pick a time first.", "請先揀時間。"), "bad");
  try {
    const out = await guarded(async (extra) => {
      // The four keys are asked for when the change is scheduled, as the server checks them then.
      const begin = await rawPost("/api/safety/confirm/begin", { schedule: body });
      if (begin.required && !extra.confirmation) throw Object.assign(new Error("keys"), { code: "CONFIRM_REQUIRED", data: { detail: { confirmation: begin } } });
      return rawPost("/api/safety/pending", { ...body, when, ...extra });
    }, { preview });
    if (out) toast(t("Scheduled. You can cancel it from History.", "已安排，可以喺「改動記錄」取消。"));
    bus.emit("safety");
    return out;
  } catch (error) {
    toast(errorText(error), "bad");
    return null;
  }
}

// ---- actions with an impact (restart a service, and so on) -------------------------------------------------

export async function runAction(name, body = {}, { title } = {}) {
  try {
    const out = await guarded((extra) => rawPost(`/api/actions/${name}`, { ...body, ...extra }), { skipWarning: false });
    if (out?.runId) openProgress(out.runId, title);
    return out;
  } catch (error) {
    if (error.code === "LAUNCH_REQUIRED") return launchSequence();
    toast(errorText(error), "bad");
    return null;
  }
}

// ---- the reboot: a missile launch -------------------------------------------------------------------------

export async function launchSequence() {
  let begin;
  try {
    begin = await rawPost("/api/safety/confirm/begin", { action: "reboot" });
  } catch (error) {
    toast(errorText(error), "bad");
    return null;
  }
  let proof = null;
  if (begin.required) {
    proof = await confirmDialog(begin, { level: 3 });
    if (!proof) return null;
  }
  let seq;
  try {
    seq = await rawPost("/api/safety/launch/begin", { confirmation: proof });
  } catch (error) {
    toast(errorText(error), "bad");
    return null;
  }
  return runLaunch(seq);
}

function cdFill(view) {
  const fill = h("span", { class: "cd-fill" });
  const total = view.countdownMs || 10000;
  fill.style.setProperty("--p", String(Math.min(Math.max(1 - (view.countdownLeftMs ?? total) / total, 0), 1)));
  return fill;
}

function runLaunch(first) {
  return new Promise((resolve) => {
    let view = first;
    let code = "";
    let typed = "";
    let down = { 1: false, 2: false };
    let timer = null;
    let readyTimer = null;
    let runId = null;
    const base = `/api/safety/launch/${view.id}`;
    const step = async (path, body) => {
      try {
        view = { ...view, ...(await rawPost(`${base}/${path}`, body ?? {})) };
        if (view.code) code = view.code;
        dlg.render();
        return view;
      } catch (error) {
        toast(errorText(error), "bad");
        if (["LAUNCH_ABORTED", "LAUNCH_DONE", "LAUNCH_GONE"].includes(error.code)) finish(null);
        else if (error.code === "LAUNCH_CODE") { typed = ""; view = { ...view, attemptsLeft: error.data?.detail?.attemptsLeft ?? Math.max((view.attemptsLeft ?? 3) - 1, 0) }; dlg.render(); }
        return null;
      }
    };
    const finish = (value) => { clearInterval(timer); clearInterval(readyTimer); dlg.close(value); };
    const keyChange = async (which, state) => {
      if (down[which] === (state === "down")) return;
      down[which] = state === "down";
      try { view = { ...view, ...(await rawPost(`${base}/key`, { key: which, state })) }; } catch (error) { toast(errorText(error), "bad"); }
      dlg.render();
      if (down[1] && down[2] && !readyTimer) {
        // The server wants both keys held together for a moment, so ask again until it agrees or a key is let go.
        readyTimer = setInterval(async () => {
          if (!(down[1] && down[2]) || view.state !== "code-ok") { clearInterval(readyTimer); readyTimer = null; return; }
          try { view = { ...view, ...(await rawPost(`${base}/keys-ready`)) }; clearInterval(readyTimer); readyTimer = null; dlg.render(); } catch (error) { if (error.code !== "LAUNCH_KEYS") { clearInterval(readyTimer); readyTimer = null; toast(errText(error), "bad"); } }
        }, 400);
      }
    };
    const keyButton = (which) => h("button", { class: `launch-key ${down[which] ? "down" : ""}`, type: "button", "aria-pressed": String(down[which]), "aria-label": t(`Key ${which}: hold`, `匙 ${which}：撳住`),
      onPointerdown: (e) => { e.preventDefault(); keyChange(which, "down"); }, onPointerup: () => keyChange(which, "up"), onPointerleave: () => keyChange(which, "up"), onPointercancel: () => keyChange(which, "up"),
      onKeydown: (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); keyChange(which, "down"); } }, onKeyup: (e) => { if (e.key === " " || e.key === "Enter") keyChange(which, "up"); } },
      icon("key", "lg"), h("span", {}, t(`KEY ${which}`, `匙 ${which}`)));
    const dlg = openDialog((close) => {
      const st = view.state;
      const left = view.countdownLeftMs != null ? Math.ceil(view.countdownLeftMs / 1000) : null;
      return [
        h("div", { class: "launch" },
          h("div", { class: "launch-head" }, h("span", { class: "launch-led on" }), h("h2", { class: "h2 disp" }, t("Router reboot: launch control", "路由器重啟：發射控制")), h("span", { class: `launch-state` }, st)),
          h("div", { class: "launch-board", "aria-live": "polite" },
            h("div", { class: `panel-cover ${st === "covered" ? "closed" : "open"}` }, h("div", { class: "cover-plate" }, st === "covered" ? t("SAFETY COVER", "安全蓋") : t("COVER OPEN", "蓋已打開")),
              st === "covered" ? h("button", { class: "btn d", onClick: () => step("open-cover") }, icon("lock_open", "sm"), t("Lift the cover", "打開安全蓋")) : null),
            st === "cover-open" ? h("div", { class: "arm" }, h("button", { class: "arm-switch", onClick: () => step("arm"), "aria-label": t("Arm", "武裝") }, h("span", { class: "arm-knob" }), h("b", {}, t("ARM", "武裝"))), h("p", { class: "muted" }, t("Flip the switch to get the launch code.", "撥動開關攞發射密碼。"))) : null,
            st === "armed" ? h("div", { class: "code-card" }, h("div", { class: "k" }, t("Launch code", "發射密碼")), h("div", { class: "code-show mono" }, code), h("label", { class: "field" }, h("span", {}, t("Type the code back", "輸入返密碼")), h("input", { type: "text", autocomplete: "off", spellcheck: "false", value: typed, maxlength: "12", onInput: (e) => (typed = e.target.value.toUpperCase()) })), h("button", { class: "btn f", onClick: () => step("code", { code: typed }) }, icon("password", "sm"), t("Enter code", "輸入密碼")), view.attemptsLeft != null ? h("div", { class: "t2" }, t(`${view.attemptsLeft} tries left`, `仲有 ${view.attemptsLeft} 次機會`)) : null) : null,
            st === "code-ok" || st === "keys-held" ? h("div", { class: "keys-row" }, h("p", { class: "muted" }, t("Hold both keys at the same time.", "同時撳住兩把匙。")), h("div", { class: "keys-pair" }, keyButton(1), keyButton(2)), st === "keys-held" ? h("button", { class: "btn d", onClick: () => step("countdown") }, icon("timer", "sm"), t("Start the countdown", "開始倒數")) : null) : null,
            st === "countdown" ? h("div", { class: "countdown-big", role: "timer" }, h("div", { class: "cd-num" }, left == null ? "" : String(left)), h("div", { class: "cd-bar" }, cdFill(view)), h("button", { class: "btn abort", onClick: async () => { try { await rawPost(`${base}/abort`); } catch {} finish(null); } }, icon("front_hand", "lg"), t("ABORT", "中止")), left === 0 ? h("button", { class: "big-red", onClick: async () => { const out = await step("launch"); if (out) { runId = out.runId; finish(runId); } } }, t("LAUNCH", "發射")) : h("button", { class: "big-red", disabled: true }, t("LAUNCH", "發射"))) : null),
          st === "covered" || st === "cover-open" || st === "armed" || st === "code-ok" || st === "keys-held" ? h("div", { class: "actions" }, h("button", { class: "btn o", onClick: async () => { try { await rawPost(`${base}/abort`); } catch {} finish(null); } }, t("Stand down", "取消發射"))) : null),
      ];
    }, { label: t("Reboot launch control", "重啟發射控制") });
    dlg.sheet.classList.add("launch-sheet");
    timer = setInterval(async () => {
      if (view.state !== "countdown") return;
      try { view = { ...view, ...(await api.get(base)) }; } catch {}
      dlg.render();
    }, 500);
    dlg.closed.then(async (value) => {
      clearInterval(timer);
      if (typeof value === "string" || view.runId) {
        const id = typeof value === "string" ? value : view.runId;
        const progress = openProgress(id, t("Router reboot", "路由器重啟"));
        await progress.closed;
        resolve(id);
      } else resolve(null);
    });
  });
}

// ---- the top bar: Live or Review, undo and redo, the allowance chip ------------------------------------------

export function mountBar(host, { onOpenHistory } = {}) {
  const live = h("div", { class: "seg live-switch", role: "radiogroup", "aria-label": t("Change mode", "改動模式") });
  const undoBtn = h("button", { class: "icb", "aria-label": t("Undo (Ctrl+Z)", "還原（Ctrl+Z）"), title: t(`Undo (${SHORTCUTS.undo})`, `還原（${SHORTCUTS.undo}）`), onClick: undo }, icon("undo"));
  const redoBtn = h("button", { class: "icb", "aria-label": t("Redo (Ctrl+Shift+Z)", "重做（Ctrl+Shift+Z）"), title: t(`Redo (${SHORTCUTS.redo} or ${SHORTCUTS.redoAlt})`, `重做（${SHORTCUTS.redo} 或 ${SHORTCUTS.redoAlt}）`), onClick: redo }, icon("redo"));
  const chip = h("button", { class: "chip allow-chip", onClick: () => onOpenHistory?.("household"), title: t("Open the household", "開啟屋企設定") });
  const draw = () => {
    clear(live).append(...[[true, t("Live", "即時"), "bolt"], [false, t("Review", "檢查"), "fact_check"]].map(([on, label, ic]) => h("button", { role: "radio", "aria-checked": String(safety.live === on), class: safety.live === on ? "on" : "", onClick: () => setLiveMode(on) }, icon(ic, "sm"), label)));
    undoBtn.disabled = !safety.undo.length || safety.busy;
    redoBtn.disabled = !safety.redo.length || safety.busy;
    const c = chipText(safety.allowance, safety.presence);
    clear(chip).append(levelBadge(safety.allowance?.configured === false ? 0 : (safety.allowance?.allowed ?? 0), { label: false }), h("span", {}, t(c.en, c.yue)));
    chip.dataset.state = c.tone;
  };
  draw();
  host.append(chip, live, undoBtn, redoBtn);
  const off = [bus.on("safety", draw), bus.on("lang", draw), bus.on("changed", refreshAllowance)];
  refreshAllowance();
  const poll = setInterval(refreshAllowance, 30000);
  return () => { off.forEach((f) => f()); clearInterval(poll); };
}

// ---- finding the run a change started ---------------------------------------------------------------------

// Watches the list of runs for the one this change creates (it appears once the keys pass).
export function watchRun({ previewId = null, since = Date.now() - 1500, onFound }) {
  let stopped = false;
  (async () => {
    while (!stopped) {
      try {
        const { items } = await api.get("/api/safety/runs");
        const run = items.find((r) => (previewId ? r.meta?.previewId === previewId : Date.parse(r.startedAt) >= since) && !seen.has(r.id));
        if (run) { seen.add(run.id); stopped = true; onFound(run); return; }
      } catch {}
      await wait(250);
    }
  })();
  return () => { stopped = true; };
}
const seen = new Set();
export const markSeen = (id) => seen.add(id);

// Runs `fn`; the progress dialog opens by itself as soon as the change has really started.
export async function withProgress(fn, { previewId = null, title, preview = null } = {}) {
  const stop = watchRun({ previewId, onFound: (run) => openProgress(run.id, title, preview) });
  try {
    return await fn();
  } finally {
    stop();
  }
}

// ---- every other screen: the same keys, with no change to those screens ----------------------------------------

// Wraps api.post so a feature that posts a change, an action or a reboot gets the four keys, the
// household's say and the launch sequence without knowing about them.
export function installApiGuard() {
  if (api.__guarded) return;
  api.__guarded = true;
  api.post = async (url, body = {}) => {
    if (/^\/api\/(safety|changes\/(live|preview)|login|logout|setup)/.test(url)) return RAW_POST(url, body);
    try {
      const out = await RAW_POST(url, body);
      if (/^\/api\/(changes\/apply|actions\/)/.test(url)) refreshUndo();
      return out;
    } catch (error) {
      if (error.code === "LAUNCH_REQUIRED") {
        const id = await launchSequence();
        if (id) return { ok: true, runId: id, message: t("Reboot sent.", "已送出重啟。") };
        throw Object.assign(new Error(t("Cancelled.", "已取消。")), { code: "CANCELLED" });
      }
      if (!["CONFIRM_REQUIRED", "ALLOWANCE"].includes(error.code)) throw error;
      const out = await withProgress(() => guarded((extra) => RAW_POST(url, { ...body, ...extra }), { previewId: body.previewId }, error), { previewId: body.previewId ?? null });
      if (out === null) throw Object.assign(new Error(t("Cancelled.", "已取消。")), { code: "CANCELLED" });
      refreshUndo();
      return out;
    }
  };
}

// ---- a level badge on every rated control, on every screen ------------------------------------------------------

// Watches the page for setting rows and adds the entry's impact badge beside its name.
export function mountBadges(entries) {
  const decorate = (root) => {
    const rows = root.matches?.(".setting[id^='s-']") ? [root] : [...(root.querySelectorAll?.(".setting[id^='s-']") ?? [])];
    if (!rows.length) return;
    const byId = new Map(entries().map((e) => [e.id, e]));
    for (const row of rows) {
      const title = row.querySelector(".t1");
      const entry = byId.get(row.id.slice(2));
      if (!title || !entry?.impact || title.querySelector(".lvl")) continue;
      title.append(" ", levelBadge(entry.impact.level, { label: entry.impact.level > 0 }));
    }
  };
  const observer = new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) decorate(n);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  decorate(document.body);
  return () => observer.disconnect();
}
