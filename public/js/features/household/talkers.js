// Who is uploading or downloading the most: a ranked list of devices (and of the
// people they belong to) taken from the router's connection table, refreshed
// every few seconds while the tab is open. The household's devices carry their
// owner's name. Nothing here is presence: it never tells where anyone is.
import { api, clear, h, icon, t, tt } from "../../core.js";
import { METRICS, rankPeople, rankTalkers, rateText } from "./model.js";

const errText = (e) => e?.message ?? String(e);

export async function talkersPanel(root, { members = [] } = {}) {
  const state = { metric: "down", window: "now", view: null, error: "", paused: false };
  let timer = null;
  let busy = false;
  const body = h("div", { class: "talkers", "aria-live": "off" });
  const head = h("div", { class: "talkers-head" });

  const drawHead = () => clear(head).append(
    h("div", { class: "seg", role: "radiogroup", "aria-label": t("What to rank by", "按咩排名") }, Object.entries(METRICS).map(([id, m]) => h("button", { type: "button", role: "radio", "aria-checked": String(state.metric === id), class: state.metric === id ? "on" : "", onClick: () => { state.metric = id; drawHead(); draw(); } }, icon(id.includes("Up") || id === "up" ? "upload" : "download", "sm"), t(m.en, m.yue)))),
    METRICS[state.metric].total ? null : h("div", { class: "seg", role: "radiogroup", "aria-label": t("Window", "時段") }, [["now", t("Right now", "而家")], ["recent", t("Last minute", "最近一分鐘")]].map(([id, label]) => h("button", { type: "button", role: "radio", "aria-checked": String(state.window === id), class: state.window === id ? "on" : "", onClick: () => { state.window = id; drawHead(); draw(); } }, label))),
    h("button", { type: "button", class: "btn t sm", onClick: () => { state.paused = !state.paused; drawHead(); if (!state.paused) poll(); } }, icon(state.paused ? "play_arrow" : "pause", "sm"), state.paused ? t("Resume", "繼續") : t("Pause", "暫停")));

  function draw() {
    clear(body);
    if (state.error) return body.append(h("div", { class: "note warn" }, icon("info"), h("div", {}, state.error)));
    const view = state.view;
    if (!view) return body.append(h("div", { class: "row" }, h("div", { class: "spin" }), t("Reading the router…", "讀緊路由器…")));
    if (view.accounting === false)
      return body.append(h("div", { class: "note warn" }, icon("info"), h("div", {}, t("The router lists connections but does not count their bytes, so nobody can be ranked. Turn on connection accounting on the router and reload.", "路由器有列出連線但冇計位元組，所以排唔到名。請喺路由器開啟連線計數，之後重新載入。"))));
    const total = METRICS[state.metric].total;
    const average = !total && state.window === "recent";
    const rows = rankTalkers(view, members, state.metric, { average });
    const people = rankPeople(view, members, state.metric);
    const unit = "bits";
    body.append(
      view.warm ? h("div", { class: "muted" }, t("Warming up: speeds appear after the second reading.", "預熱中：第二次讀取之後先有速度。")) : null,
      h("div", { class: "grid2" },
        h("section", { class: "card rise" },
          h("h2", { class: "h2" }, t(`Top devices: ${METRICS[state.metric].en.toLowerCase()}`, `裝置排名：${METRICS[state.metric].yue}`)),
          rows.length ? h("ol", { class: "rank" }, rows.map((r) => h("li", { class: "rank-row", "data-ip": r.ip },
            h("span", { class: "rank-n" }, String(r.rank)),
            h("div", { class: "grow" },
              h("div", { class: "t1" }, r.owner ? `${tt({ en: r.owner.name, yue: r.owner.nameYue })} · ` : "", r.name),
              h("div", { class: "t2 mono" }, `${r.ip}${r.mac ? ` · ${r.mac}` : ""}`),
              h("div", { class: "rank-bar" }, bar(r.ratio))),
            h("div", { class: "rank-val" }, h("b", {}, rateText(r.value, state.metric, unit)), h("div", { class: "t2" }, `${Math.round(r.share * 100)}%`))))) : h("div", { class: "empty" }, icon("devices_off", "lg"), t("Nobody is moving data right now.", "而家冇人傳緊資料。"))),
        h("section", { class: "card rise" },
          h("h2", { class: "h2" }, t("By person", "按人")),
          people.length ? people.map((p) => h("div", { class: "rank-person" }, h("div", { class: "grow" }, h("div", { class: "t1" }, tt({ en: p.name, yue: p.nameYue })), h("div", { class: "t2" }, t(`${p.devices} device${p.devices === 1 ? "" : "s"}`, `${p.devices} 部裝置`))), h("b", {}, rateText(p.value, state.metric, unit)))) : h("div", { class: "muted" }, t("Nothing to show yet.", "暫時冇嘢顯示。")),
          h("p", { class: "t2" }, t("Devices that have not been given to a person are grouped as other devices. Only the connections the router is tracking right now are counted.", "未分配畀任何人嘅裝置歸入其他裝置。只計算路由器而家追蹤緊嘅連線。")))));
  }
  const bar = (ratio) => { const fill = h("span", { class: "rank-fill" }); fill.style.setProperty("--w", `${Math.max(2, Math.round(ratio * 100))}%`); return h("span", { class: "rank-track" }, fill); };

  async function poll() {
    if (busy || state.paused) return;
    busy = true;
    try {
      state.view = await api.get("/api/x/device-traffic/sample");
      state.error = "";
    } catch (error) {
      state.error = state.view ? "" : errText(error);
    }
    busy = false;
    draw();
  }

  root.append(h("p", { class: "lede" }, t("Who is uploading or downloading the most, worked out from the router's connection table and refreshed every few seconds.", "邊個上傳或者下載最多，由路由器嘅連線表計出嚟，每幾秒更新一次。")), head, body);
  drawHead();
  draw();
  await poll();
  timer = setInterval(poll, 3000);
  return () => clearInterval(timer);
}
