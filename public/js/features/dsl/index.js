// DSL line: a live reading of the modem (state, speed, noise margin, line loss),
// the settings that decide how it talks to the exchange, and a retrain that
// keeps a live timeline going until the line is back in sync and the settings
// read back. Reading is free; every change needs the router model typed first
// and the safety net still applies. Only on DSL models.
import { STEP_WORDS, VERDICT_WORDS, createTimeline, dbText, gauge, kbpsText } from "./model.js";

const label = { en: "DSL line", yue: "DSL 線路" };
const lede = { en: "See how your phone line is doing, and change how the modem talks to the exchange.", yue: "睇吓電話線嘅狀況，同埋調整數據機點樣同機房溝通。" };
const NS = "http://www.w3.org/2000/svg";

function ring(ctx, value, text, caption, tone) {
  const { h } = ctx;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", "dsl-ring-svg");
  svg.setAttribute("aria-hidden", "true");
  const track = document.createElementNS(NS, "circle");
  const arc = document.createElementNS(NS, "circle");
  for (const [el, cls] of [[track, "dsl-track"], [arc, `dsl-arc ${tone}`]]) {
    el.setAttribute("cx", "50");
    el.setAttribute("cy", "50");
    el.setAttribute("r", "40");
    el.setAttribute("fill", "none");
    el.setAttribute("class", cls);
  }
  const circ = 2 * Math.PI * 40;
  arc.setAttribute("stroke-dasharray", `${(circ * value).toFixed(1)} ${circ.toFixed(1)}`);
  arc.setAttribute("transform", "rotate(-90 50 50)");
  svg.append(track, arc);
  return h("div", { class: "dsl-ring" }, svg, h("div", { class: "dsl-ring-text" }, h("div", { class: "t1" }, text), h("div", { class: "t2" }, caption)));
}

export default {
  id: "dsl",

  screens: [
    {
      id: "dsl",
      group: { en: "Monitor", yue: "監察" },
      icon: "cable",
      label,
      async render(ctx) {
        const { h, icon, t, tt, api } = ctx;
        const page = ctx.page(label, lede);
        ctx.root.append(page);
        let data = await api.get("/api/domain/dsl");
        if (!data.supported) {
          page.append(h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("cable", "lg"), t("This router has no DSL modem, so there is nothing to show here.", "呢部路由器冇 DSL 數據機，所以呢度冇嘢顯示。"))));
          return undefined;
        }
        const offs = [];
        let line = data.line;
        let verdict = data.verdict;
        let timeline = null;
        let timer = null;
        let busy = false;
        const statusBox = h("section", { class: "card rise dsl-status", "aria-live": "polite" });
        const timelineBox = h("section", { class: "card rise dsl-timeline", hidden: true, "aria-live": "polite" });

        const drawStatus = () => {
          ctx.clear(statusBox);
          if (!line) return void statusBox.append(h("div", { class: "empty" }, icon("hourglass_top", "lg"), t("Reading the modem…", "讀緊數據機…")));
          const word = VERDICT_WORDS[verdict?.id] ?? VERDICT_WORDS.unknown;
          const stateText = { up: t("In sync", "已同步"), training: t("Training", "訓練中"), down: t("Down", "斷線"), unknown: t("Unknown", "未知") }[line.state];
          statusBox.append(
            h("div", { class: "dsl-head" },
              h("span", { class: `dsl-state ${line.state}` }, icon(line.state === "up" ? "check_circle" : line.state === "training" ? "sync" : "link_off", "sm"), stateText),
              h("span", { class: "t2" }, line.mode || "")),
            h("div", { class: `dsl-verdict ${word.tone}` }, icon(word.icon), tt(word)),
            h("div", { class: "dsl-rings" },
              ring(ctx, gauge(line.snr.down), dbText(line.snr.down), t("Noise margin, down", "雜訊餘量（下載）"), word.tone),
              ring(ctx, gauge(line.snr.up), dbText(line.snr.up), t("Noise margin, up", "雜訊餘量（上載）"), word.tone),
              ring(ctx, gauge(line.attenuation.down, 60), dbText(line.attenuation.down), t("Line loss, down", "線路損耗（下載）"), "wait")),
            h("div", { class: "dsl-rates" },
              h("div", {}, h("div", { class: "big" }, kbpsText(line.rate.down)), h("div", { class: "t2" }, t(`Download (line can do ${kbpsText(line.maxRate.down)})`, `下載（線路最高 ${kbpsText(line.maxRate.down)}）`))),
              h("div", {}, h("div", { class: "big" }, kbpsText(line.rate.up)), h("div", { class: "t2" }, t(`Upload (line can do ${kbpsText(line.maxRate.up)})`, `上載（線路最高 ${kbpsText(line.maxRate.up)}）`)))));
        };

        const drawTimeline = (steps, note) => {
          timelineBox.hidden = false;
          ctx.clear(timelineBox);
          timelineBox.append(
            h("h2", { class: "h2" }, icon("timeline", "sm"), " ", t("Retraining the line", "重新訓練線路")),
            h("ol", { class: "dsl-steps" }, steps.map((s) => h("li", { class: `dsl-step ${s.status}`, "aria-current": s.status === "active" ? "step" : undefined },
              icon(s.status === "done" ? "check_circle" : s.status === "active" ? "progress_activity" : "radio_button_unchecked", "sm"), h("span", {}, tt(STEP_WORDS[s.id]))))),
            note ? h("div", { class: "t2", role: "status" }, note) : null);
        };

        const poll = async () => {
          if (busy) return;
          busy = true;
          try {
            const out = await api.get("/api/x/dsl/status");
            line = out.line;
            verdict = out.verdict;
            drawStatus();
            if (timeline) {
              let steps = timeline.observe(line.state);
              if (timeline.upAt !== null && !timeline.finished) {
                data = await api.get("/api/domain/dsl");
                steps = timeline.confirmReadBack();
              }
              drawTimeline(steps, timeline.finished ? t("Done. The line is back and the router reports the settings you chose.", "完成。線路已返嚟，路由器亦報告返你揀嘅設定。") : t("Still going. This page keeps checking by itself.", "仍然進行緊。呢頁會自己繼續檢查。"));
              if (timeline.finished) {
                timeline = null;
                ctx.toast(t("The DSL line is back in sync.", "DSL 線路已重新同步。"));
              }
            }
          } catch {
            if (timeline) drawTimeline(timeline.steps(), t("The router is not answering yet. Waiting for it to come back…", "路由器暫時冇回應，等佢返嚟…"));
          }
          busy = false;
          timer = setTimeout(poll, timeline ? 1000 : 4000);
        };
        const startTimeline = () => {
          timeline = createTimeline(Date.now());
          drawTimeline(timeline.steps(), t("Waiting for the modem to react…", "等數據機反應…"));
          clearTimeout(timer);
          poll();
        };
        offs.push(() => clearTimeout(timer));

        // The typed confirmation: the router model has to be typed exactly before the action runs.
        const confirmModel = (title, body, run, confirmLabel) => ctx.openDialog((close) => {
          const input = h("input", { class: "inp", type: "text", autocomplete: "off", "aria-label": t("Router model", "路由器型號"), placeholder: data.model });
          const go = h("button", { class: "btn f danger", type: "button", disabled: true, onClick: async () => {
            go.disabled = true;
            try { await run(input.value); close(true); } catch (error) { go.disabled = false; ctx.toast(error.message, "bad"); }
          } }, confirmLabel);
          input.addEventListener("input", () => { go.disabled = input.value !== data.model; });
          return [h("h2", { class: "h2" }, title), h("p", {}, body), h("p", { class: "t2" }, t(`Type ${data.model} to confirm.`, `輸入 ${data.model} 確認。`)), input,
            h("div", { class: "actions" }, h("button", { class: "btn t", type: "button", onClick: () => close(false) }, t("Cancel", "取消")), go)];
        }, { label: title });

        page.append(statusBox, timelineBox);
        drawStatus();
        if (ctx.state.canWrite) {
          const waiting = () => data.entries.filter((e) => ctx.dock.has(e.id));
          const apply = h("button", { class: "btn f", type: "button", onClick: () => {
            const changes = waiting().map((e) => ({ id: e.id, value: ctx.dock.value(e.id) }));
            if (!changes.length) return void ctx.toast(t("Change a setting below first.", "請先喺下面改一個設定。"));
            confirmModel(t("Change the DSL settings?", "更改 DSL 設定？"), t("The line will drop and retrain for a minute or two, so the internet stops meanwhile. The safety net can still put the old settings back.", "線路會斷開並重新訓練一至兩分鐘，期間上唔到網。安全機制仍然可以還原舊設定。"), async (typed) => {
              const preview = await api.post("/api/x/dsl/change", { changes, confirm: typed });
              await api.post("/api/changes/apply", { previewId: preview.id });
              for (const e of waiting()) ctx.dock.setEntry(e, e.value);
              startTimeline();
            }, t("Apply and retrain", "套用並重新訓練"));
          } }, icon("done_all", "sm"), t("Apply the changes to the line", "套用改動到線路"));
          const retrain = h("button", { class: "btn o", type: "button", onClick: () => confirmModel(t("Retrain the line now?", "而家重新訓練線路？"), t("The modem restarts its link to the exchange. The internet stops for a minute or two.", "數據機會重新連去機房。上唔到網一至兩分鐘。"), async (typed) => {
            await api.post("/api/actions/dsl.retrain", { confirm: typed, hold: true });
            startTimeline();
          }, t("Retrain now", "即刻重新訓練")) }, icon("restart_alt", "sm"), t("Retrain the line", "重新訓練線路"));
          page.append(h("div", { class: "chips" }, apply, retrain));
        }
        for (const group of ctx.controls.settingGroups(data.entries)) {
          const card = ctx.controls.groupCard(group.label, group.entries);
          card.classList.add("rise");
          page.append(card);
        }
        poll();
        return () => offs.forEach((off) => off());
      },
    },
  ],

  commands: [
    { id: "dsl.open", icon: "cable", label: { en: "Open the DSL line", yue: "開啟 DSL 線路" }, keywords: "dsl adsl vdsl modem line snr noise margin retrain 數據機 線路", run: (ctx) => ctx.navigate("dsl") },
  ],
};
