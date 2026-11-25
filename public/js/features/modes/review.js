// The review and apply dialog for a mode. It shows the exact old and new value
// of every setting from the change engine's own preview, applies it, and keeps
// refreshing until the router has really finished: it follows the engine's
// record, shows the safety-timer countdown, and only then tells the server to
// remember the mode as applied. A refusal from the engine is shown as it is.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function reviewMode(ctx, { mode, action, result, startNow = false, onDone }) {
  const { api, h, icon, t, tt } = ctx;
  const { preview, display } = result;
  const verb = action === "undo" ? { en: "Undo", yue: "還原" } : { en: "Apply", yue: "套用" };
  let phase = startNow ? "applying" : "review"; // review, applying, waiting, done, failed
  let record = null;
  let error = null;
  let confirmed = null;
  let startedAt = 0;
  let timer = null;

  const clock = () => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    return preview.guard.armed ? t(`${Math.max(0, preview.guard.seconds - seconds)} s of the safety timer left`, `安全計時仲有 ${Math.max(0, preview.guard.seconds - seconds)} 秒`) : t(`${seconds} s`, `${seconds} 秒`);
  };
  const tick = () => {
    for (const el of dialog.sheet.querySelectorAll(".mode-clock")) el.textContent = clock();
  };

  async function apply(render) {
    phase = "applying";
    startedAt = Date.now();
    render();
    timer = setInterval(tick, 500);
    try {
      record = await api.post("/api/changes/apply", { previewId: preview.id });
      while (record.status === "guarded" || record.status === "applying") {
        phase = "waiting";
        render();
        await sleep(1200);
        record = await api.get(`/api/changes/history/${record.id}`);
      }
      phase = record.status === "applied" ? "done" : "failed";
      if (phase === "failed") error = record.note ?? statusText(record.status);
    } catch (e) {
      phase = "failed";
      error = e.message;
    }
    clearInterval(timer);
    if (record?.status === "applied") {
      try {
        confirmed = await api.post("/api/x/modes/confirm", { previewId: preview.id });
      } catch (e) {
        confirmed = { active: false, recorded: false, error: e.message };
      }
      ctx.bus.emit("changed", { source: "modes" });
    }
    render();
    onDone?.(phase, record);
  }

  function statusText(status) {
    if (status === "reverted-by-guard") return t("The router did not confirm in time, so the safety timer put every old value back. Nothing was left half applied.", "路由器冇及時確認，所以安全計時器已經將所有舊數值還原。冇嘢係做到一半。");
    if (status === "unreachable") return t("The router could not be reached.", "連唔到路由器。");
    return t("The router did not keep every change.", "路由器冇保留所有改動。");
  }

  const rows = () =>
    h("div", { class: "mode-diff", role: "list" },
      display.map((d, index) => {
        const item = preview.items.find((i) => i.key === d.key);
        const row = h("div", { class: "mode-diff-row", role: "listitem" },
          h("div", { class: "grow" }, h("div", { class: "t1" }, item ? tt(item.label) : d.key), h("div", { class: "t2 mono" }, d.key)),
          h("div", { class: "was" }, tt(d.old)), icon("arrow_forward", "sm"), h("div", { class: "now" }, tt(d.new)));
        row.style.setProperty("--n", String(index));
        return row;
      }));

  const step = (state, text) =>
    h("li", { class: `mode-step ${state}`, "aria-current": state === "run" ? "step" : undefined },
      h("span", { class: "mode-step-dot" }, state === "ok" ? icon("check", "sm") : state === "bad" ? icon("close", "sm") : state === "run" ? h("span", { class: "mode-spin", "aria-hidden": "true" }) : null),
      h("span", {}, text));

  const timeline = () => {
    const failed = phase === "failed";
    const wrote = phase === "waiting" || phase === "done" || (failed && record !== null);
    const read = phase === "done" ? "ok" : phase === "waiting" ? "run" : failed && record ? "bad" : "wait";
    return h("ol", { class: "mode-steps", "aria-live": "polite" },
      step("ok", t("The router agreed the changes are possible", "路由器確認改動可行")),
      step(wrote ? "ok" : failed ? "bad" : "run", preview.guard.armed ? t("Safety timer armed, writing the changes", "已啟動安全計時器，寫入改動中") : t("Writing the changes", "寫入改動中")),
      step(read, phase === "waiting" ? t("Waiting for the router to answer and read the settings back", "等路由器回應，再讀返設定") : t("The router's settings were read back", "已讀返路由器設定")));
  };

  const dialog = ctx.openDialog(
    (close, render) => {
      const title = action === "undo" ? t(`Undo ${tt(mode.name)}`, `還原「${tt(mode.name)}」`) : tt(mode.name);
      const head = h("div", { class: "mode-dlg-head" }, h("span", { class: "mode-badge", "data-state": phase }, icon(mode.icon, "lg")), h("div", { class: "grow" }, h("h2", { class: "h2" }, title), h("div", { class: "t2" }, t("Exactly what changes", "實際會改啲乜"))));
      if (phase === "review")
        return [
          head,
          rows(),
          preview.guard.armed ? h("div", { class: "mode-note" }, icon("shield", "sm"), t(`Runs under the connection-loss guard: if the router does not confirm in ${preview.guard.seconds} seconds, every value goes back.`, `有斷線守護：路由器 ${preview.guard.seconds} 秒內唔確認，所有數值會返轉頭。`)) : null,
          preview.restarts.length ? h("div", { class: "t2" }, t(`Restarts: ${preview.restarts.join(", ")}`, `會重啟：${preview.restarts.join("、")}`)) : null,
          h("div", { class: "actions" },
            h("button", { class: "btn o", onClick: () => close(false) }, t("Not now", "遲啲先")),
            h("button", { class: "btn f", onClick: () => apply(render) }, icon(action === "undo" ? "undo" : "bolt", "sm"), preview.guard.armed ? t(`${verb.en} under guard`, `有守護咁${verb.yue}`) : t(verb.en, verb.yue))),
        ];
      if (phase === "applying" || phase === "waiting")
        return [head, timeline(), h("div", { class: "mode-clock t2", role: "timer" }, clock()), rows()];
      const ok = phase === "done";
      const remembered = ok && confirmed?.active !== false;
      return [
        head,
        h("div", { class: `mode-result ${ok ? "ok" : "no"}`, role: ok ? "status" : "alert" },
          h("span", { class: "mode-mark" }, ok ? h("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, h("path", { d: "M5 12.5l4.5 4.5L19 7.5" })) : icon("warning", "lg")),
          h("div", { class: "grow" },
            h("div", { class: "t1" }, ok ? (action === "undo" ? t("The old values are back", "舊數值已經返嚟") : t("Mode applied and verified", "模式已套用同驗證")) : t("Nothing was left half applied", "冇嘢係做到一半")),
            h("div", { class: "t2" }, ok ? (remembered ? t("The router confirmed every change, and this mode can be undone in one tap.", "路由器確認咗所有改動，呢個模式可以㩒一下還原。") : t("The router confirmed the changes, but the mode no longer looks fully on.", "路由器確認咗改動，但模式似乎唔再完全生效。")) : error))),
        ok ? null : timeline(),
        h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close(true) }, t("Close", "關閉"))),
      ];
    },
    { label: tt(mode.name) },
  );
  dialog.closed.then(() => clearInterval(timer));
  if (startNow) apply(dialog.render);
  return dialog;
}
