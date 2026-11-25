// Running a card: the right confirmation for its risk, then the live output.
//   low          one confirmation that shows the exact command
//   network      the same, plus the safety net that puts things back
//   destructive  the two-key super confirmation, a single-use token
//   engine       keys and lights are previewed, reviewed and applied by the
//                change engine, never written from here
import { openOutput } from "./output.js";

const BASE = "/api/x/ssh-actions";

export const askSuper = (ctx, options) =>
  new Promise((resolve) => {
    const detail = { ...options, claimed: false, respond: resolve };
    ctx.bus.emit("superconfirm:ask", detail);
    if (!detail.claimed) resolve(null);
  });

export const RISK = {
  low: { icon: "bolt", tone: "", en: "Low risk: asks once", yue: "低風險：確認一次" },
  network: { icon: "shield", tone: "warn", en: "Can affect the network: runs under the safety net", yue: "可能影響網絡：喺安全機制保護下執行" },
  destructive: { icon: "key", tone: "bad", en: "Destructive: needs the two-key confirmation", yue: "具破壞性：需要雙鑰確認" },
};

// Shows the change engine's own preview and applies it, like every other change.
function reviewEngine(ctx, preview, title) {
  const { api, h, icon, t, tt, openDialog, bus } = ctx;
  let phase = "review";
  let record = null;
  let error = null;
  const rows = () => preview.items.map((item) => h("div", { class: "diff" },
    h("div", {}, h("div", { class: "t1" }, tt(item.label)), h("div", { class: "t2 mono" }, item.key)),
    h("div", { class: "was" }, item.secret ? "••••••••" : item.old === null ? t("not set", "未設定") : String(item.old).slice(0, 120) || t("empty", "空")),
    h("div", { class: "arrow" }, icon("arrow_forward", "sm")),
    h("div", { class: "now" }, item.secret ? "••••••••" : item.new === null ? t("removed", "移除") : String(item.new).slice(0, 120) || t("empty", "空"))));
  const apply = async (render) => {
    phase = "applying";
    render();
    try {
      record = await api.post("/api/changes/apply", { previewId: preview.id });
      while (record.status === "guarded" || record.status === "applying") {
        phase = "waiting";
        render();
        await new Promise((r) => setTimeout(r, 1500));
        record = await api.get(`/api/changes/history/${record.id}`);
      }
      phase = "done";
      bus.emit("changed");
    } catch (caught) {
      error = caught;
      phase = "error";
    }
    render();
  };
  return openDialog((close, render) => {
    const heading = h("h2", { class: "h2" }, title);
    if (phase === "review")
      return [heading, h("div", {}, rows()),
        preview.guard?.armed ? h("div", { class: "note" }, icon("shield"), h("div", {}, t(`Safety net on. If this app cannot reach the router ${preview.guard.seconds} seconds after the change, the router puts the old settings back by itself.`, `已開啟安全機制。改動後 ${preview.guard.seconds} 秒內連唔到路由器，路由器會自動還原舊設定。`))) : h("div", { class: "note" }, icon("bolt"), h("div", {}, t("Low risk. It applies straight away and can be undone from Change history.", "風險低。會即時套用，亦可以喺「變更記錄」還原。"))),
        h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: () => apply(render) }, icon("check", "sm"), t("Apply", "套用")))];
    if (phase === "applying" || phase === "waiting")
      return [heading, h("div", { class: "row" }, h("div", { class: "spin" }), h("div", { class: "grow" }, phase === "waiting" ? t("The router is not answering yet. Its safety timer puts the old settings back if needed. Still checking…", "路由器未有回應。有需要時，安全計時器會還原舊設定。繼續檢查中…") : t("Writing the settings and checking the router still answers…", "寫入設定，確認路由器仍然有回應…")))];
    if (phase === "error") return [heading, h("div", { class: "note bad" }, icon("error"), h("div", {}, error.message)), h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close(false) }, t("Close", "關閉")))];
    const ok = record.status === "applied";
    return [h("h2", { class: "h2" }, h("span", { class: `tag ${ok ? "good" : "warn"}` }, icon(ok ? "check_circle" : "history", "sm"), ok ? t("Applied", "已套用") : t("Put back by the safety net", "安全機制已還原"))), h("div", {}, rows()), h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close(ok) }, t("Done", "完成")))];
  }, { label: title });
}

// Asks once, showing exactly what will be sent. Resolves true or false.
function confirmCommand(ctx, card, command, risk, preview) {
  const { h, icon, t, tt, openDialog } = ctx;
  return openDialog((close) => [
    h("h2", { class: "h2" }, tt(card.label)),
    h("div", { class: "sa-cmd mono" }, icon("terminal", "sm"), command),
    h("div", { class: `note ${RISK[risk].tone}` }, icon(RISK[risk].icon), h("div", {}, t(RISK[risk].en, RISK[risk].yue))),
    risk === "network" ? h("div", { class: "t2" }, t("If the router stops answering after this, it undoes it by itself:", "如果之後路由器冇回應，佢會自動還原：")) : null,
    risk === "network" && preview.revert?.length ? h("div", { class: "sa-cmd mono" }, icon("undo", "sm"), preview.revert.join("; ")) : null,
    h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: `btn ${risk === "low" ? "f" : "d"}`, onClick: () => close(true) }, icon("play_arrow", "sm"), t("Run it", "執行"))),
  ], { label: tt(card.label) }).closed;
}

export async function runCard(ctx, card, params, { after } = {}) {
  const { api, t, tt, toast } = ctx;
  try {
    const preview = await api.post(`${BASE}/preview`, { id: card.id, params });
    if (preview.viaEngine) {
      const out = await api.post(`${BASE}/run`, { id: card.id, params });
      const applied = await reviewEngine(ctx, out.preview, tt(card.label)).closed;
      if (applied) after?.();
      return;
    }
    if (!(await confirmCommand(ctx, card, preview.command, preview.risk, preview))) return;
    let token;
    if (preview.risk === "destructive") {
      token = await askSuper(ctx, { action: `ssh-actions.${card.id}`, title: tt(card.label), affects: [preview.command] });
      if (!token) return void toast(t("Not confirmed, so nothing was run.", "未確認，所以冇執行任何嘢。"), "bad");
    }
    const started = await api.post(`${BASE}/run`, { id: card.id, params, ack: true, token });
    const { done } = openOutput(ctx, { job: started.job, title: tt(card.label), command: started.command, risk: started.risk, view: card.view });
    done.then(() => after?.());
  } catch (error) {
    toast(error.message, "bad");
  }
}
