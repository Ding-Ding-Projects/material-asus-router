// Top talkers: a tab that answers "who is uploading or downloading the most".
// Three tabs (Downloading, Uploading, Together) rank the devices live, with a
// share of the traffic, the speed now, and what each device has moved since
// this page was opened. It reads the Device traffic feature's reading, so it
// shows the same honest "byte counting is off" message when the router cannot
// count bytes, and never reads anything about where a device physically is.
import { MODES, accumulate, percent, rank, visitRank } from "./model.js";

const label = { en: "Top talkers", yue: "用得最多嘅裝置" };
const lede = { en: "See who is downloading or uploading the most right now.", yue: "睇吓邊部裝置而家下載或者上傳得最多。" };
const TABS = {
  down: { icon: "download", en: "Downloading", yue: "下載" },
  up: { icon: "upload", en: "Uploading", yue: "上傳" },
  both: { icon: "swap_vert", en: "Together", yue: "合計" },
};
const POLL_MS = 2000;

const speed = (bytesPerSecond) => {
  const mbit = (bytesPerSecond * 8) / 1e6;
  return `${mbit >= 100 ? Math.round(mbit) : mbit >= 10 ? mbit.toFixed(1) : mbit.toFixed(2)} Mbit/s`;
};
const size = (bytes) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} kB`);

export default {
  id: "top-talkers",

  screens: [
    {
      id: "top-talkers",
      group: { en: "Monitor", yue: "監察" },
      icon: "leaderboard",
      label,
      async render(ctx) {
        const { h, icon, t, tt, api } = ctx;
        const page = ctx.page(label, lede);
        ctx.root.append(page);
        let mode = "down";
        let view = null;
        let totals = new Map();
        let lastAt = 0;
        let failed = "";
        let timer = null;
        let busy = false;

        const tabs = h("div", { class: "tt-tabs", role: "tablist", "aria-label": tt(label) });
        const panel = h("div", { class: "tt-panel", role: "tabpanel", "aria-live": "polite" });

        const drawTabs = () => {
          ctx.clear(tabs);
          for (const id of MODES) {
            const tab = h("button", { class: `tt-tab ${id === mode ? "on" : ""}`, role: "tab", type: "button", id: `tt-tab-${id}`, "aria-selected": String(id === mode), "aria-controls": "tt-panel", tabindex: id === mode ? "0" : "-1",
              onClick: () => select(id),
              onKeydown(e) {
                const at = MODES.indexOf(mode);
                const to = e.key === "ArrowRight" ? (at + 1) % MODES.length : e.key === "ArrowLeft" ? (at + MODES.length - 1) % MODES.length : e.key === "Home" ? 0 : e.key === "End" ? MODES.length - 1 : -1;
                if (to >= 0) { e.preventDefault(); select(MODES[to]); tabs.children[to]?.focus(); }
              } }, icon(TABS[id].icon, "sm"), tt(TABS[id]));
            tabs.append(tab);
          }
          panel.setAttribute("aria-labelledby", `tt-tab-${mode}`);
          panel.id = "tt-panel";
        };

        const drawPanel = () => {
          ctx.clear(panel);
          if (failed && !view) return void panel.append(h("div", { class: "note bad" }, icon("error"), failed));
          if (!view) return void panel.append(h("div", { class: "empty" }, icon("hourglass_top", "lg"), t("Reading the router…", "讀緊路由器…")));
          if (view.accounting === false) panel.append(h("div", { class: "note warn" }, icon("info"), t("The router lists connections but does not count their bytes, so speeds cannot be worked out. See Device traffic for how to turn counting on.", "路由器有列出連線，但冇計位元組，所以計唔到速度。請睇「裝置流量」點樣開啟計數。")));
          const rows = rank(view.devices, mode);
          const top = rows[0];
          if (view.warm) panel.append(h("div", { class: "t2" }, t("Warming up. The ranking appears after the second reading.", "預熱緊。讀到第二次先會出排名。")));
          if (top && top.rate > 0) panel.append(h("div", { class: "tt-champ rise" }, icon("emoji_events", "lg"), h("div", {}, h("div", { class: "t1" }, top.name), h("div", { class: "t2" }, t(`${mode === "up" ? "Uploading" : mode === "down" ? "Downloading" : "Using"} the most: ${speed(top.rate)}, ${percent(top.share)} of the traffic.`, `${mode === "up" ? "上傳" : mode === "down" ? "下載" : "用"}得最多：${speed(top.rate)}，佔 ${percent(top.share)} 流量。`)))));
          else if (!view.warm) panel.append(h("div", { class: "empty" }, icon("devices_off", "lg"), t("No device is moving data right now.", "而家冇裝置喺度傳送數據。")));
          if (rows.some((r) => r.rate > 0)) {
            panel.append(h("ol", { class: "tt-list" }, rows.filter((r) => r.rate > 0 || r.place <= 3).map((r) =>
              h("li", { class: "tt-row", "data-place": String(r.place) },
                h("span", { class: "tt-place" }, String(r.place)),
                h("div", { class: "grow" }, h("div", { class: "t1" }, r.name), h("div", { class: "t2 mono" }, r.ip),
                  h("div", { class: "tt-bar", role: "img", "aria-label": t(`${percent(r.share)} of the traffic`, `佔 ${percent(r.share)} 流量`) }, h("span", { class: `tt-fill w${Math.min(20, Math.round(r.share * 20))}` }))),
                h("div", { class: "tt-nums" }, h("div", { class: "t1" }, speed(r.rate)), h("div", { class: "t2" }, `${percent(r.share)} · ${size(r.tracked)}`))))));
          }
          const visit = visitRank(totals, mode, 3);
          if (visit.length) panel.append(h("div", { class: "tt-visit" }, h("div", { class: "k" }, t("Since you opened this page", "由你開咗呢頁開始")),
            visit.map((r) => h("div", { class: "row" }, icon("history", "sm"), h("div", { class: "grow t1" }, r.name), h("div", { class: "t2" }, mode === "both" ? size(r.down + r.up) : size(r[mode]))))));
          panel.append(h("div", { class: "muted" }, t("Speeds come from the router's connection table, read every two seconds. The size beside each share is what the router is tracking now; connections that already ended are not counted.", "速度係由路由器嘅連線表計出嚟，每兩秒讀一次。每個百分比旁邊嘅大小係路由器而家追蹤緊嘅數據；已經結束嘅連線唔計。")));
        };

        function select(id) {
          mode = id;
          drawTabs();
          drawPanel();
        }

        const poll = async () => {
          if (busy || document.hidden) return;
          busy = true;
          try {
            view = await api.get("/api/x/device-traffic/sample");
            const now = Date.now();
            totals = accumulate(totals, view.devices, lastAt ? (now - lastAt) / 1000 : 0);
            lastAt = now;
            failed = "";
          } catch (error) {
            failed = error.message;
          }
          drawPanel();
          busy = false;
        };

        page.append(tabs, panel);
        drawTabs();
        drawPanel();
        await poll();
        timer = setInterval(poll, POLL_MS);
        return () => clearInterval(timer);
      },
    },
  ],

  commands: [
    { id: "top-talkers.open", icon: "leaderboard", label: { en: "See who is downloading or uploading the most", yue: "睇邊個下載或上傳得最多" }, keywords: "top talkers biggest download upload hog bandwidth who uses most 流量 最多 下載 上傳", run: (ctx) => ctx.navigate("top-talkers") },
  ],
};
