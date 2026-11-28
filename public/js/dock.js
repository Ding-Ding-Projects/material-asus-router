// Pending changes and the review, apply and guard flow. Every edit in the app
// lands here first. In Live mode the change applies by itself after a short
// pause (or at once with Apply now), and the server asks for the keys when the
// change needs them; in Review mode it is previewed and checked first. Either way the
// four keys, the household allowance and the live progress timeline come from
// features/change-safety/safety.js.
import { api, bus, clear, h, icon, openDialog, t, toast, tt } from "./core.js";
import { applyLive, guarded, levelBadge, markSeen, oneClick, progressTimeline, rawPost, refreshUndo, safety, scheduleDialog, simulationHost, undoToast, watchRun } from "./features/change-safety/safety.js";
import { levelOf, outageText } from "./features/change-safety/model.js";

export const app = { me: null, router: null, catalog: null, route: "overview", canWrite: false, notices: [], unseen: 0 };

export function notice(kind, text) {
  app.notices.unshift({ kind, text, at: new Date() });
  app.notices.length = Math.min(app.notices.length, 30);
  app.unseen += 1;
  bus.emit("notices");
}

// ---- pending changes -----------------------------------------------------

export const dock = {
  changes: new Map(), // key -> { id?, key?, label, value, shown }
  ops: [], // { op: {...}, summary }
  edits: 0, // goes up with every edit, so Live mode applies once per edit
  count() {
    return this.changes.size + this.ops.length;
  },
  has(id) {
    return this.changes.has(id);
  },
  value(id) {
    return this.changes.get(id)?.value;
  },
  setEntry(entry, value) {
    const original = entry.masked || entry.secret ? "" : entry.value;
    if (value === original) this.changes.delete(entry.id);
    else this.changes.set(entry.id, { id: entry.id, label: entry.label, value, shown: entry.secret ? "••••••••" : value });
    this.edits += 1;
    bus.emit("dock");
  },
  setRaw(key, value, original, label) {
    const slot = `raw:${key}`;
    if (value === original) this.changes.delete(slot);
    else this.changes.set(slot, { key, label: label ?? { en: key, yue: key }, value, shown: value });
    this.edits += 1;
    bus.emit("dock");
  },
  addOp(op, summary) {
    this.ops.push({ op, summary });
    this.edits += 1;
    bus.emit("dock");
  },
  clear() {
    this.changes.clear();
    this.ops.length = 0;
    this.edits += 1;
    bus.emit("dock");
  },
  toBody() {
    return {
      changes: [...this.changes.values()].map((c) => (c.id ? { id: c.id, value: c.value } : { key: c.key, value: c.value })),
      ops: this.ops.map((o) => o.op),
    };
  },
  lines() {
    return [...[...this.changes.values()].map((c) => `${tt(c.label)}: ${c.shown}`), ...this.ops.map((o) => o.summary)];
  },
  // The highest impact the waiting changes are known to have. A change the catalogue does not
  // know (a raw key or a list edit) counts as a small blip until the preview says better.
  impact() {
    let level = 0;
    let known = true;
    for (const c of this.changes.values()) {
      const entry = c.id ? app.catalog?.entries?.find((e) => e.id === c.id) : null;
      if (entry?.impact) level = Math.max(level, entry.impact.level);
      else {
        level = Math.max(level, 1);
        known = false;
      }
    }
    if (this.ops.length) {
      level = Math.max(level, 1);
      known = false;
    }
    return { level, known };
  },
};

// ---- the bar at the bottom ---------------------------------------------------

// In Live mode one click is enough: a change applies by itself as soon as it is made, and an Undo
// toast follows. Text being typed waits until the person leaves the field or presses Enter. The
// server still asks for the keys or the household's say when a change needs them. This happens
// once per edit: after a refusal or a cancelled confirmation the changes stay in the bar until
// the person edits again or presses Apply now.
// The short pause lets one action that makes several edits land as one change.
export const LIVE_PAUSE_MS = 250;
let autoTimer = null;
let autoTried = -1;
// True while the person is still in a text field.
const typing = () => Boolean(document.activeElement?.matches?.("textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=search]):not([type=button]):not([type=color]):not([type=file])"));

export function renderDock(host) {
  host.replaceChildren();
  clearTimeout(autoTimer);
  host.hidden = dock.count() === 0 || !app.canWrite;
  if (host.hidden) return;
  const lines = dock.lines();
  const { level, known } = dock.impact();
  const edits = dock.edits;
  const auto = safety.live && !safety.busy && autoTried !== edits;
  host.append(
    icon("edit_note"),
    h("b", {}, levelBadge(level, { label: false }), " ", t(`${lines.length} change${lines.length === 1 ? "" : "s"} waiting`, `${lines.length} 項改動等緊`), h("span", { class: "muted" }, ` ${lines.slice(0, 2).join(" · ")}${lines.length > 2 ? " …" : ""}`),
      auto ? h("span", { class: "muted dock-auto" }, ` · ${typing() ? t("applies when you leave the field or press Enter", "離開欄位或者撳 Enter 就會套用") : t("applying", "套用緊")}`) : null),
    h("button", { class: "btn o sm", onClick: () => dock.clear() }, t("Discard", "放棄")),
    h("button", { class: "btn o sm", title: t("Apply later, or when the house is quiet", "遲啲，或者屋企冇人用嗰陣套用"), onClick: async () => { const out = await scheduleDialog(dock.toBody()); if (out) dock.clear(); } }, icon("schedule", "sm"), t("Later", "遲啲")),
    safety.live
      ? h("button", { class: "btn o sm", onClick: () => reviewPending() }, icon("list_alt", "sm"), t("Details", "詳情"))
      : h("button", { class: "btn o sm", onClick: () => reviewPending() }, icon("fact_check", "sm"), t("Review", "檢查")),
    safety.live ? h("button", { class: "btn f", disabled: safety.busy, onClick: () => applyNow() }, icon("bolt", "sm"), t("Apply now", "即時套用")) : h("button", { class: "btn f", onClick: () => reviewPending() }, icon("fact_check", "sm"), t("Review and apply", "檢查同套用")),
  );
  if (!auto) return;
  const fire = () => {
    if (!dock.count() || !safety.live || safety.busy || dock.edits !== edits) return;
    if (typing()) return void (autoTimer = setTimeout(fire, 300));
    autoTried = edits;
    applyNow();
  };
  autoTimer = setTimeout(fire, LIVE_PAUSE_MS);
}

// Enter in a setting's text field applies what is waiting, the same as leaving the field.
globalThis.document?.addEventListener?.("keydown", (e) => {
  if (e.key !== "Enter" || e.isComposing || !safety.live || safety.busy || !dock.count() || !app.canWrite) return;
  const field = document.activeElement;
  if (!field?.matches?.("input") || !typing() || !field.closest?.(".setting")) return;
  autoTried = dock.edits;
  applyNow();
});

async function applyNow() {
  clearTimeout(autoTimer);
  if (safety.busy) return;
  const body = dock.toBody();
  const preview = await previewOf(body);
  if (!preview) return;
  const lan = preview.items.find((i) => i.key === "lan_ipaddr");
  const record = await applyLive({ previewId: preview.id, verifyHost: lan ? lan.new : undefined }, { preview });
  if (record && record.status === "applied") dock.clear();
}

async function previewOf(body) {
  try {
    return await rawPost("/api/changes/preview", body);
  } catch (error) {
    toast(error.message, "bad");
    return null;
  }
}

export async function reviewPending() {
  clearTimeout(autoTimer);
  const preview = await previewOf(dock.toBody());
  if (preview) return runPreview(preview, { clearOnApplied: true, review: true });
}

// ---- the review dialog ---------------------------------------------------

const STATUS_COPY = {
  applied: { icon: "check_circle", tag: "good", en: "Applied", yue: "已套用" },
  "reverted-by-guard": { icon: "history", tag: "warn", en: "Put back by the safety net", yue: "安全機制已還原" },
  guarded: { icon: "hourglass_top", tag: "warn", en: "Waiting for the router", yue: "等緊路由器" },
  failed: { icon: "error", tag: "bad", en: "Failed", yue: "失敗" },
  unreachable: { icon: "wifi_off", tag: "bad", en: "Router not reachable", yue: "路由器連唔到" },
  applying: { icon: "sync", tag: "", en: "Applying", yue: "套用緊" },
};
export const statusCopy = (status) => STATUS_COPY[status] ?? { icon: "help", tag: "", en: status, yue: status };

export function diffRows(items) {
  return items.map((item) =>
    h(
      "div",
      { class: "diff" },
      h("div", {}, h("div", { class: "t1" }, item.impact !== undefined ? levelBadge(item.impact, { label: false }) : null, " ", tt(item.label)), h("div", { class: "t2 mono" }, item.key, item.secret ? ` · ${t("secret", "機密")}` : "")),
      h("div", { class: "was" }, item.added ? t("not set", "未設定") : item.old === "" ? t("empty", "空") : item.old),
      h("div", { class: "arrow" }, icon("arrow_forward", "sm")),
      h("div", { class: "now" }, item.removed ? t("removed", "移除") : item.new === "" ? t("empty", "空") : item.new),
    ),
  );
}

function impactSummary(preview) {
  const imp = preview.impact ?? { level: 0, reasons: [] };
  const info = levelOf(imp.level);
  return h("div", { class: `impact-banner lv${info.level}` },
    h("div", { class: "ib-head" }, levelBadge(info.level), h("b", {}, tt(info.about))),
    (imp.reasons ?? []).slice(0, 4).map((r) => h("div", { class: "row" }, levelBadge(r.level, { label: false }), h("div", { class: "grow" }, h("span", { class: "t1" }, tt(r.label)), r.why ? h("div", { class: "t2" }, tt(r.why)) : null))),
    h("div", { class: "t2" }, icon("timer", "sm"), tt(outageText(info.level))),
    preview.allowance && imp.level >= 1 ? h("div", { class: `note ${preview.allowance.ok ? "" : "warn"}` }, icon(preview.allowance.ok ? "family_restroom" : "block"), h("div", {}, preview.allowance.ok
      ? t("The household allows this right now.", "屋企依家容許呢個改動。")
      : t(`The household does not allow this right now (up to Level ${preview.allowance.allowed ?? 0}). The owner can override.`, `屋企依家唔容許（最多容許級數 ${preview.allowance.allowed ?? 0}），擁有人可以覆寫。`))) : null);
}

// review: true always shows what will change first. Without it, Live mode applies at once when
// the change needs no keys and the household allows it, and closes by itself when it worked.
export function runPreview(preview, { clearOnApplied = false, title, applyVia, review = false } = {}) {
  const direct = !review && oneClick(preview);
  let phase = direct ? "applying" : "review";
  let closeSheet = null;
  let record = null;
  let error = null;
  let timer = null;
  let verify = true;
  let stopWatch = null;
  let line = null;
  const lan = preview.items.find((i) => i.key === "lan_ipaddr");
  const counter = h("span", { class: "countdown" }, "");
  let started = 0;
  const tick = () => {
    const left = Math.max(0, preview.guard.seconds - Math.floor((Date.now() - started) / 1000));
    counter.textContent = `${left}s`;
  };

  const apply = async (render) => {
    phase = "applying";
    started = Date.now();
    render();
    if (preview.guard.armed) timer = setInterval(tick, 500);
    const since = Date.now() - 1500;
    stopWatch = watchRun({ previewId: preview.id, since, onFound: (run) => { markSeen(run.id); line = progressTimeline(run.id); render(); } });
    try {
      const doit = (extra) => (applyVia ? applyVia(extra) : rawPost("/api/changes/apply", { previewId: preview.id, verifyHost: lan && verify ? lan.new : undefined, ...extra }));
      record = await guarded(doit, { preview, previewId: preview.id });
      if (!record) {
        phase = "review";
        return render();
      }
      while (record.status === "guarded" || record.status === "applying") {
        phase = "waiting";
        render();
        await new Promise((r) => setTimeout(r, 1500));
        record = await api.get(`/api/changes/history/${record.id}`);
      }
      phase = "done";
      if (record.runId && !line) line = progressTimeline(record.runId);
      notice(record.status === "applied" ? "good" : "warn", `${tt({ en: statusCopy(record.status).en, yue: statusCopy(record.status).yue })}: ${preview.items.map((i) => tt(i.label)).join(", ")}`);
      if (record.status === "applied" && clearOnApplied) dock.clear();
      refreshUndo();
      bus.emit("changed");
      if (record.status === "applied") undoToast(record, preview);
      if (direct && record.status === "applied") return void closeSheet?.(true);
    } catch (e) {
      error = e;
      phase = "error";
    } finally {
      clearInterval(timer);
      stopWatch?.();
    }
    render();
  };

  const dialog = openDialog(
    (close, render) => {
      closeSheet = close;
      const heading = title ?? t("Review changes", "檢查改動");
      if (phase === "review")
        return [
          h("div", { class: "sheet-head" }, levelBadge(preview.impact?.level ?? 0), h("h2", { class: "h2" }, heading)),
          impactSummary(preview),
          h("div", {}, diffRows(preview.items)),
          preview.restarts.length ? h("div", { class: "muted" }, t("The router will restart: ", "路由器會重啟："), preview.restarts.join(", ")) : null,
          preview.guard.armed
            ? h("div", { class: "note" }, icon("shield"), h("div", {}, t(`Safety net on. If this app cannot reach the router ${preview.guard.seconds} seconds after the change, the router puts the old settings back by itself.`, `已開啟安全機制。改動後 ${preview.guard.seconds} 秒，如果呢個程式連唔到路由器，路由器會自動還原舊設定。`)))
            : h("div", { class: "note" }, icon("bolt"), h("div", {}, t("Low risk. This applies straight away and can be undone with Ctrl+Z or from the history manager.", "風險低。會即時套用，可以用 Ctrl+Z 或者喺改動記錄管理還原。"))),
          lan
            ? h("label", { class: "row" }, h("input", { type: "checkbox", checked: true, onChange: (e) => (verify = e.target.checked) }), h("span", {}, t(`Look for the router at its new address, ${lan.new}, afterwards`, `改動後去新地址 ${lan.new} 搵路由器`)))
            : null,
          simulationHost({ preview }),
          h("div", { class: "actions" },
            h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")),
            h("button", { class: "btn o", onClick: async () => { const out = await scheduleDialog({ changes: preview.items.map((i) => ({ key: i.key, value: i.new })) }, { preview }); if (out) close(true); } }, icon("schedule", "sm"), t("Later", "遲啲")),
            h("button", { class: `btn ${(preview.impact?.level ?? 0) >= 3 ? "d" : "f"}`, onClick: () => apply(render) }, icon("check", "sm"), t("Apply", "套用"))),
        ];
      if (phase === "applying")
        return [
          h("h2", { class: "h2" }, t("Applying…", "套用緊…")),
          line ? line.el : h("div", { class: "row" }, h("div", { class: "spin" }), h("div", { class: "grow" }, t("Writing the settings, then opening a fresh connection to check the router still answers.", "寫入設定，之後會開新連線確認路由器仲有回應。"))),
          preview.guard.armed ? h("div", { class: "card tone" }, h("div", { class: "k" }, t("Safety net countdown", "安全機制倒數")), counter) : null,
        ];
      if (phase === "waiting")
        return [
          h("h2", { class: "h2" }, t("The router is not answering", "路由器冇回應")),
          h("div", { class: "note warn" }, icon("hourglass_top"), h("div", {}, t("The change may have cut the connection. The router's own safety timer will put the old settings back. This page keeps checking.", "改動可能令連線中斷。路由器自己嘅安全計時器會還原舊設定，呢頁會不斷檢查。"))),
          line ? line.el : null,
          h("div", { class: "row" }, h("div", { class: "spin" }), t("Waiting for the router to come back…", "等路由器返嚟…")),
        ];
      if (phase === "error")
        return [h("h2", { class: "h2" }, t("Could not apply", "套用唔到")), h("div", { class: "note bad" }, icon("error"), h("div", {}, error.message)), h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close(false) }, t("Close", "關閉")))];
      const copy = statusCopy(record.status);
      return [
        h("h2", { class: "h2" }, h("span", { class: `tag ${copy.tag}` }, icon(copy.icon, "sm"), t(copy.en, copy.yue))),
        record.status === "applied"
          ? h("div", { class: "note" }, icon("check_circle"), h("div", {}, t("The router has the new settings and still answers.", "路由器已經用緊新設定，而且有回應。")))
          : record.status === "reverted-by-guard"
            ? h("div", { class: "note warn" }, icon("history"), h("div", {}, t("The router could not be reached after the change, so its safety net restored the old settings. Nothing was lost.", "改動後連唔到路由器，所以安全機制已還原舊設定，冇嘢有損失。")))
            : h("div", { class: "note bad" }, icon("error"), h("div", {}, record.note ?? t("Something did not go as planned. Check the router.", "有啲嘢未如預期，請檢查路由器。"))),
        record.differs ? h("div", { class: "muted" }, t("The router stored slightly different values than asked for (it adjusts some settings itself).", "路由器儲存咗少少唔同嘅值（有啲設定佢會自己調整）。")) : null,
        line ? line.el : null,
        h("div", {}, diffRows(preview.items)),
        simulationHost({ preview }),
        h("div", { class: "actions" }, record.canUndo ? h("button", { class: "btn t", onClick: () => (close(true), undoChange(record.id)) }, icon("undo", "sm"), t("Undo", "還原"), h("kbd", {}, "Ctrl+Z")) : null, h("button", { class: "btn f", onClick: () => close(true) }, t("Done", "完成"))),
      ];
    },
    { label: t("Review changes", "檢查改動") },
  );
  if (direct) apply(dialog.render);
  return dialog;
}
export const reviewPreview = runPreview;

export async function undoChange(id) {
  try {
    const preview = await api.post(`/api/changes/${id}/undo`);
    return runPreview(preview, { title: t("Undo this change", "還原呢項改動") });
  } catch (error) {
    toast(error.message, "bad");
  }
}
