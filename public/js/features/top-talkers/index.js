// Top talkers: who is uploading or downloading the most. Four tabs rank the
// devices by the speed they use right now and by the bytes of the connections the
// router is tracking. The numbers come from the Device traffic reading of the
// router's connection table (two readings give a speed, so the first one is
// "warming up"); this screen only ranks them. It refreshes every few seconds
// while it is open and stops when it is left.
import { TABS, percent, rank, rateText, sizeText } from "./rank.js";

const label = { en: "Top talkers", yue: "邊個用得最多" };
const REFRESH_MS = 3000;

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const page = ctx.page(label, { en: "Who is uploading or downloading the most, right now and in total. Pick a tab.", yue: "邊個上傳或者下載最多，包括而家同累計。揀個分頁睇。" });
  ctx.root.append(page);
  let unit = "bits";
  let top = 10;
  try {
    const config = await api.get("/api/domain/device-traffic");
    unit = config.unit === "bytes" ? "bytes" : "bits";
    top = Math.min(20, Math.max(3, Number(config.top) || 10));
  } catch {}
  let tab = "down";
  let view = null;
  let paused = false;
  let timer = null;
  let busy = false;
  const live = h("span", { class: "tt-live" }, h("i", { "aria-hidden": "true" }), h("span", {}, t("Live, every 3 seconds", "即時，每 3 秒更新")));
  const pause = h("button", { class: "btn o sm", onClick: () => { paused = !paused; paint(); if (!paused) read(); } });
  const tabs = h("div", { class: "tt-tabs", role: "tablist", "aria-label": tt(label) });
  const body = h("div", {});

  const valueText = (tabInfo, value) => (tabInfo.kind === "rate" ? rateText(value, unit) : sizeText(value));

  function paintTabs() {
    ctx.clear(tabs);
    TABS.forEach((info, index) => {
      const button = h("button", { class: "tt-tab", role: "tab", id: `tt-tab-${info.id}`, "aria-selected": String(tab === info.id), "aria-controls": "tt-panel", tabindex: tab === info.id ? "0" : "-1",
        onClick: () => { tab = info.id; paint(); },
        onKeydown: (e) => {
          const move = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: TABS.length - 1 - index }[e.key];
          if (move === undefined) return;
          e.preventDefault();
          tab = TABS[(index + move + TABS.length) % TABS.length].id;
          paint();
          tabs.querySelector(`#tt-tab-${tab}`)?.focus();
        } }, icon(info.icon, "sm"), tt(info.label));
      tabs.append(button);
    });
  }

  function paintBody() {
    ctx.clear(body);
    const info = TABS.find((x) => x.id === tab);
    if (!view) return void body.append(h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("hourglass_top", "lg"), t("Reading the router…", "讀緊路由器…"))));
    if (view.accounting === false)
      body.append(h("div", { class: "card warn" }, h("div", { class: "k" }, t("Byte counting is off", "未開位元組計數")), h("div", { class: "t1" }, t("The router lists connections but does not count their bytes, so there is nothing to rank.", "路由器有列出連線，但冇計位元組，所以冇嘢可以排名。"))));
    const ranked = rank(view.devices, info.key, top);
    const warming = info.kind === "rate" && view.warm;
    body.append(h("section", { class: "card rise", id: "tt-panel", role: "tabpanel", "aria-labelledby": `tt-tab-${tab}` },
      h("div", { class: "chips" }, h("h2", { class: "h2 grow" }, tt(info.label)), live, pause),
      warming ? h("div", { class: "muted", role: "status" }, t("Warming up. A speed needs two readings of the router, so the first ranking appears in a moment.", "預熱緊。速度要讀路由器兩次先計到，第一個排名一陣就出。"))
        : !ranked.rows.length ? h("div", { class: "empty" }, icon(info.kind === "rate" ? "bedtime" : "devices_off", "lg"), info.kind === "rate" ? t("Nobody is using the internet right now.", "而家冇人用緊網絡。") : t("The router has no connection with data in it yet.", "路由器暫時冇帶數據嘅連線。"))
        : h("ol", { class: "tt-list", "aria-label": tt(info.label) }, ranked.rows.map((row, index) => {
          const el = h("li", { class: "tt-row" },
            h("span", { class: "tt-rank", "aria-label": t(`Number ${row.rank}`, `第 ${row.rank} 名`) }, String(row.rank)),
            h("div", {}, h("div", { class: "t1" }, row.name), h("div", { class: "t2 mono" }, `${row.ip}${row.mac ? ` · ${row.mac}` : ""} · ${t(`${percent(row.share)} of all`, `佔全部 ${percent(row.share)}`)}`)),
            h("div", { class: "tt-value" }, valueText(info, row.value)),
            h("div", { class: "tt-bar", role: "presentation" }, h("i")));
          el.style.setProperty("--i", String(index));
          el.querySelector("i").style.setProperty("--w", String(Math.max(2, Math.round(row.fraction * 100))));
          return el;
        })),
      ranked.others ? h("div", { class: "t2" }, t(`${ranked.others} more devices are not shown.`, `仲有 ${ranked.others} 部裝置冇顯示。`)) : null,
      h("div", { class: "muted" }, info.kind === "rate"
        ? t("Speeds are worked out from two readings of the router's connection table.", "速度由路由器連線表兩次讀數計出嚟。")
        : t("Totals are the bytes of connections the router is tracking now. Connections that already ended are not counted, and a router restart starts them again from zero.", "累計數字係路由器而家追蹤緊嘅連線嘅位元組。已經結束嘅連線唔計，路由器重啟後會由零重新計。"))));
  }

  function paint() {
    paintTabs();
    paintBody();
    pause.replaceChildren(icon(paused ? "play_arrow" : "pause", "sm"), paused ? t("Resume", "繼續") : t("Pause", "暫停"));
    live.classList.toggle("paused", paused);
  }

  async function read() {
    if (busy || paused) return;
    busy = true;
    try {
      view = await api.get("/api/x/device-traffic/sample");
      paint();
    } catch (error) {
      ctx.toast(error.message, "bad");
    } finally {
      busy = false;
    }
  }

  page.append(tabs, body);
  paint();
  await read();
  timer = setInterval(read, REFRESH_MS);
  return () => clearInterval(timer);
}

export default {
  id: "top-talkers",
  screens: [{ id: "top-talkers", group: { en: "Monitor", yue: "監察" }, icon: "leaderboard", label, render: screen }],
  commands: [{ id: "top-talkers.open", icon: "leaderboard", label: { en: "Who is uploading or downloading the most", yue: "邊個上傳或者下載最多" }, keywords: "top talkers busiest upload download most bandwidth hog traffic 上傳 下載 最多 流量", run: (ctx) => ctx.navigate("top-talkers") }],
};
