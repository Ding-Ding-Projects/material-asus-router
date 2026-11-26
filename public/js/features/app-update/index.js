// App updates (owner only): check for a newer version, update with one button, or let it update
// every night. The updater service next to the app does the work and puts the previous version
// back by itself if the new one does not answer. Design: the AppUpdate canvas board.

const label = { en: "App updates", yue: "程式更新" };
const STEPS = [
  ["pulling", { en: "Downloading the new version", yue: "下載緊新版本" }],
  ["starting", { en: "Starting it", yue: "啟動緊" }],
  ["waiting", { en: "Waiting for it to answer (up to 90 seconds)", yue: "等緊佢回應（最多 90 秒）" }],
  ["done", { en: "Done", yue: "完成" }],
];
export const BUSY = new Set(["checking", "updating"]);

// Which step is finished, current or failed, from the updater's status.
export function stepStates(status) {
  const at = STEPS.findIndex(([id]) => id === status.step);
  const failed = status.state === "rolledback" || status.state === "failed";
  return STEPS.map(([id], i) => (status.state === "updated" ? "done" : i < at ? "done" : i === at ? (failed ? "failed" : BUSY.has(status.state) ? "now" : "done") : "todo"));
}

const timeText = (iso) => (iso ? new Date(iso).toLocaleString([], { hour12: false, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

async function screen(ctx) {
  const { api, h, icon, t, tt, clear } = ctx;
  const page = ctx.page(label, { en: "Update the app from here. Your accounts, router settings and change history are kept; only the app is replaced.", yue: "喺度更新程式。你嘅帳戶、路由器設定同改動記錄都會保留，只係換程式本身。" });
  ctx.root.append(page);
  const body = h("div", { class: "upd", "aria-live": "polite" });
  page.append(body);
  const owner = ctx.state?.me?.role === "owner";
  let data = null;
  let timer = null;

  async function load() {
    try {
      data = await api.get("/api/domain/app-update");
    } catch (error) {
      clear(body).append(h("p", { class: "bad", role: "alert" }, error.message));
      return;
    }
    draw();
    const busy = BUSY.has(data.updater?.status?.state);
    clearTimeout(timer);
    timer = setTimeout(load, busy ? 2000 : 15000);
  }

  async function send(path, okText) {
    try {
      await api.post(`/api/x/app-update/${path}`, {});
      ctx.toast(okText);
      setTimeout(load, 800);
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
  }

  function draw() {
    const { running, updater, auto, nightTimes } = data;
    const s = updater.status ?? {};
    const header = h("section", { class: "card tone upd-head" },
      h("div", { class: "k" }, t("Running version", "而家用緊嘅版本")),
      h("div", { class: "t1 mono" }, `${running.version}${running.revision ? ` · sha-${running.revision}` : ""}${running.built ? ` · ${t("built", "建立於")} ${timeText(running.built)}` : ""}`),
      s.latest && s.latest !== running.revision
        ? h("div", { class: "upd-latest" }, h("span", { class: "chip on" }, t("Update available", "有新版本")), h("span", { class: "mono" }, ` sha-${s.latest}${s.latest_built ? ` (${t("built", "建立於")} ${timeText(s.latest_built)})` : ""}`))
        : s.latest ? h("div", { class: "upd-latest" }, icon("check_circle", "sm"), t("You are up to date.", "已經係最新版本。")) : null);
    if (!updater.configured || !updater.alive) {
      clear(body).append(header, h("section", { class: "card" },
        h("b", {}, updater.configured ? t("The updater is not answering", "更新器冇回應") : t("The updater is not set up", "未設定更新器")),
        h("p", {}, t("Updating from here needs the small updater service next to the app. Start it with:", "要喺度更新，程式旁邊要有個細小嘅更新器服務。用呢個指令啟動：")),
        h("pre", { class: "mono upd-cmd" }, "docker compose -f compose.yaml -f compose.lan.yaml -f compose.update.yaml up -d"),
        h("p", { class: "t2" }, t("Until then, update the host by hand: set the new image tag in .env, then pull and restart.", "喺未設定之前，可以喺主機手動更新：喺 .env 改新映像標籤，然後拉取同重啟。"))));
      return;
    }
    const busy = BUSY.has(s.state);
    const actions = h("div", { class: "actions" },
      h("button", { class: "btn o", disabled: !owner || busy, onClick: () => send("check", t("Looking for a newer version.", "搵緊新版本。")) }, icon("refresh", "sm"), t("Check for updates", "檢查更新")),
      h("button", { class: "btn f", disabled: !owner || busy, onClick: () => send("apply", t("Updating. The app restarts in a moment.", "更新緊，程式一陣會重啟。")) }, icon("system_update", "sm"), t("Update now", "即刻更新")));
    const states = stepStates(s);
    const steps = (busy || ["updated", "rolledback", "failed"].includes(s.state)) ? h("ol", { class: "upd-steps" }, STEPS.map(([id, text], i) => h("li", { class: `upd-step ${states[i]}` },
      icon(states[i] === "done" ? "check_circle" : states[i] === "failed" ? "error" : states[i] === "now" ? "progress_activity" : "radio_button_unchecked", "sm"),
      h("span", {}, id === "done" && s.state === "updated" ? `${tt(text)}: ${s.message}` : tt(text))))) : null;
    const result = s.state === "rolledback" || s.state === "failed"
      ? h("section", { class: "card bad", role: "alert" }, h("b", {}, s.state === "rolledback" ? t("Rolled back", "已經退返舊版本") : t("The update did not run", "更新冇做到")), h("p", {}, s.message), h("div", { class: "actions" }, h("button", { class: "btn o sm", disabled: !owner, onClick: () => send("apply", t("Trying again.", "再試緊。")) }, t("Try again", "再試"))))
      : s.state === "updated" ? h("section", { class: "card good", role: "status" }, h("b", {}, s.message), h("p", {}, t("Your accounts, router settings and change history were kept.", "你嘅帳戶、路由器設定同改動記錄都保留咗。"))) : null;
    const night = h("section", { class: "card" },
      h("div", { class: "k" }, t("Update automatically every night", "每晚自動更新")),
      h("label", { class: "row" }, h("input", { type: "checkbox", role: "switch", checked: auto.enabled, disabled: !owner, onChange: (e) => saveAuto({ ...auto, enabled: e.target.checked }) }), h("span", {}, auto.enabled ? t("On", "開") : t("Off", "關"))),
      h("div", { class: "seg", role: "radiogroup", "aria-label": t("Time", "時間") }, nightTimes.map((time) => h("button", { type: "button", role: "radio", "aria-checked": String(auto.time === time), class: auto.time === time ? "on" : "", disabled: !owner, onClick: () => saveAuto({ ...auto, time }) }, time))),
      h("p", { class: "t2" }, t("Only when the new version passes its health check; otherwise the current one keeps running.", "只會喺新版本通過健康檢查先會換；唔係嘅話就繼續用而家個版本。")));
    const history = h("section", { class: "card" }, h("div", { class: "k" }, t("Recent updates", "最近更新")),
      updater.history.length ? h("ul", { class: "upd-history" }, updater.history.slice(0, 15).map((e) => h("li", {}, h("time", { datetime: e.at }, timeText(e.at)), ` ${e.event} · ${e.detail}${e.by ? ` · ${t("by", "由")} ${e.by}` : ""}`))) : h("p", { class: "t2" }, t("Nothing yet.", "未有紀錄。")));
    clear(body).append(header, owner ? actions : h("p", { class: "t2" }, t("Only the owner can update the app.", "只有擁有人先可以更新程式。")), steps, result, night, history);
  }

  async function saveAuto(next) {
    try {
      const out = await api.put("/api/x/app-update/auto", { enabled: next.enabled, time: next.time, offsetMinutes: -new Date().getTimezoneOffset() });
      data.auto = out.auto;
      draw();
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
  }

  await load();
  return () => clearTimeout(timer);
}

export default {
  id: "app-update",
  screens: [{ id: "app-update", group: { en: "System", yue: "系統" }, icon: "system_update", label, render: screen }],
  commands: [{ id: "app-update.open", icon: "system_update", label: { en: "Update the app", yue: "更新程式" }, keywords: "update upgrade version rollback 更新 版本", run: (ctx) => ctx.navigate("app-update") }],
};
