// Speed test screen: a live gauge that moves after every step of the run, the
// result, a history chart and the test server settings. Everything is measured
// by the router (see server/features/speed-test).
import { lineChart, svg } from "./chart.js";

const label = { en: "Speed test", yue: "測速" };
const SCALES = [10, 25, 50, 100, 250, 500, 1000, 2500, 10000];
const scaleFor = (value) => SCALES.find((s) => s >= value * 1.05) ?? SCALES.at(-1);
const mbit = (n) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

// A half-circle gauge. pathLength 100 lets the filled part be a plain dash length.
export function gauge(valueMbit, max) {
  const arc = "M 20 110 A 90 90 0 0 1 200 110";
  const pct = Math.max(0, Math.min(100, (valueMbit / max) * 100));
  return svg("svg", { class: "st-gauge", viewBox: "0 0 220 130", role: "img", "aria-label": `${mbit(valueMbit)} Mbit/s` },
    svg("path", { class: "st-track", d: arc, pathLength: 100 }),
    svg("path", { class: "st-fill", d: arc, pathLength: 100, "stroke-dasharray": `${pct} 100` }),
    svg("text", { class: "st-num", x: 110, y: 92, "text-anchor": "middle" }, String(mbit(valueMbit))),
    svg("text", { class: "st-unit", x: 110, y: 112, "text-anchor": "middle" }, "Mbit/s"),
    svg("text", { class: "st-end", x: 20, y: 126, "text-anchor": "middle" }, "0"),
    svg("text", { class: "st-end", x: 200, y: 126, "text-anchor": "middle" }, String(max)));
}

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const root = ctx.root;
  let data = await api.get("/api/domain/speed-test");
  let running = false;
  let live = 0;
  let stage = null;

  const page = ctx.page(label, { en: "Measures what the router's own internet link delivers, using a test server you choose.", yue: "用你揀嘅測試伺服器，量度路由器本身條互聯網連線真正有幾快。" });
  root.append(page);

  const gaugeBox = h("div", { class: "st-gaugebox", "aria-live": "polite" });
  const status = h("div", { class: "muted", role: "status" });
  const results = h("div", { class: "st-results" });
  const historyBox = h("div", {});
  const start = h("button", { class: "btn f", onClick: run }, icon("play_arrow", "sm"), t("Start test", "開始測試"));

  function drawGauge() {
    const max = scaleFor(Math.max(live, ...data.history.slice(-10).map((x) => x.down ?? 0), 50));
    ctx.clear(gaugeBox).append(gauge(live, max), stage ? h("div", { class: "pill p" }, icon(stage === "up" ? "upload" : "download", "sm"), stage === "up" ? t("Uploading", "上傳中") : t("Downloading", "下載中")) : null);
  }

  function drawResults() {
    const last = data.history.at(-1);
    ctx.clear(results);
    if (!last) return void results.append(h("div", { class: "muted" }, t("No test yet. Press Start test.", "未測試過。撳「開始測試」。")));
    const cell = (k, v, u) => h("div", { class: "st-cell" }, h("div", { class: "k" }, k), h("div", { class: "big" }, v, h("small", {}, u)));
    results.append(cell(t("Download", "下載"), mbit(last.down), "Mbit/s"), cell(t("Upload", "上傳"), last.up === null ? "—" : mbit(last.up), "Mbit/s"), cell(t("Connect time", "連線時間"), last.connectMs, "ms"),
      h("div", { class: "t2" }, `${new Date(last.at).toLocaleString()} · ${last.host} · ${last.mb} MB`));
  }

  function drawHistory() {
    ctx.clear(historyBox);
    const list = data.history.slice(-30);
    if (list.length < 2) return void historyBox.append(h("div", { class: "muted" }, t("The chart appears after two tests.", "測試兩次之後就會出圖。")));
    historyBox.append(
      lineChart({ series: [{ name: tt({ en: "Download", yue: "下載" }), cls: "s0", values: list.map((x) => x.down) }, { name: tt({ en: "Upload", yue: "上傳" }), cls: "s1", values: list.map((x) => x.up) }], unit: " Mbit/s", label: t("Speed test history", "測速記錄") }),
      h("div", { class: "st-legend" }, h("span", { class: "chip" }, h("i", { class: "st-dot s0" }), t("Download", "下載")), h("span", { class: "chip" }, h("i", { class: "st-dot s1" }), t("Upload", "上傳"))),
      h("div", { class: "tbl" }, h("table", {}, h("thead", {}, h("tr", {}, [t("When", "時間"), t("Server", "伺服器"), t("Download", "下載"), t("Upload", "上傳"), t("Connect", "連線")].map((x) => h("th", {}, x)))),
        h("tbody", {}, [...list].reverse().slice(0, 10).map((x) => h("tr", {}, h("td", {}, new Date(x.at).toLocaleString()), h("td", { class: "mono" }, x.host), h("td", {}, `${mbit(x.down)} Mbit/s`), h("td", {}, x.up === null ? "—" : `${mbit(x.up)} Mbit/s`), h("td", {}, `${x.connectMs} ms`)))))));
  }

  async function run() {
    if (running) return;
    if (!data.configured) return void ctx.toast(t("Choose a test server in the settings below first.", "請先喺下面嘅設定揀測試伺服器。"), "warn");
    running = true;
    start.disabled = true;
    live = 0;
    try {
      const begun = await api.post("/api/x/speed-test/runs");
      stage = "down";
      for (let guard = 0; guard < 60 && stage; guard += 1) {
        status.textContent = t(`Testing against ${begun.host}…`, `正在對 ${begun.host} 測試…`);
        drawGauge();
        const step = await api.post(`/api/x/speed-test/runs/${begun.id}/step`);
        live = step.runningMbit;
        status.textContent = t(`Step ${step.step} of ${step.steps}: ${mbit(step.sample.mbit)} Mbit/s`, `第 ${step.step} / ${step.steps} 步：${mbit(step.sample.mbit)} Mbit/s`);
        if (step.finished) {
          stage = null;
          data.history.push(step.finished);
          live = step.finished.down;
          status.textContent = t("Finished.", "完成。");
        } else stage = step.next;
        drawGauge();
      }
    } catch (error) {
      stage = null;
      status.textContent = error.message;
      ctx.toast(error.message, "bad");
    }
    running = false;
    start.disabled = false;
    drawGauge();
    drawResults();
    drawHistory();
  }

  const clearHistory = h("button", { class: "btn o sm", disabled: !ctx.state.canWrite, onClick: async () => {
    if (!(await ctx.confirmDialog({ title: t("Clear the speed test history?", "清除測速記錄？"), body: t("The saved results are removed. This cannot be undone.", "已儲存嘅結果會被移除，唔可以還原。"), confirm: t("Clear", "清除"), danger: true }))) return;
    await api.del("/api/x/speed-test/history");
    data.history = [];
    drawResults();
    drawHistory();
    drawGauge();
  } }, icon("delete", "sm"), t("Clear history", "清除記錄"));

  page.append(
    h("section", { class: "card rise" }, h("div", { class: "st-top" }, gaugeBox, h("div", { class: "st-side" }, results, h("div", { class: "chips" }, start, clearHistory), status))),
    h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("History", "記錄")), historyBox),
    ...ctx.controls.appGroupCards("speed-test", data.entries, async () => { data = { ...(await api.get("/api/domain/speed-test")) }; drawResults(); }));
  drawGauge();
  drawResults();
  drawHistory();
  const off = ctx.bus.on("changed", async () => { data = { ...(await api.get("/api/domain/speed-test")) }; drawResults(); });
  return off;
}

export default {
  id: "speed-test",
  screens: [{ id: "speed-test", group: { en: "Monitor", yue: "監察" }, icon: "speed", label, render: screen }],
  settings: [{ id: "speed-test", icon: "speed", label, async render(ctx) { const data = await ctx.api.get("/api/domain/speed-test"); return ctx.controls.appGroupCards("speed-test", data.entries); } }],
  commands: [{ id: "speed-test.open", icon: "speed", label: { en: "Run a speed test", yue: "做個測速" }, keywords: "speed test download upload bandwidth 測速 速度", run: (ctx) => ctx.navigate("speed-test") }],
};
