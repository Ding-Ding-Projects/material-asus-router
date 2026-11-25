// Live traffic: the router's real download and upload as Liveline-style charts.
import { widgets } from "../material-design/ui.js";
import { collapsible } from "../collapse-filters/collapsible.js";
import { formatRate } from "./chart-model.js";
import { mountTraffic } from "./traffic.js";

const label = { en: "Live traffic", yue: "即時流量" };

async function screen(ctx) {
  const { h, t } = ctx;
  const w = widgets(ctx);
  const box = h("div", { class: "lc-wrap" });
  const live = mountTraffic(ctx, box);
  const stats = h("div", { class: "grid" });
  const drawStats = () => {
    const one = (name, chart) => {
      const v = chart.values();
      const avg = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
      return h("div", { class: "card tone" }, h("div", { class: "k" }, name), v.length ? [h("div", { class: "t1" }, `${t("Average", "平均")}: ${formatRate(avg)}`), h("div", { class: "t2" }, `${t("Peak", "最高")}: ${formatRate(Math.max(...v))} · ${v.length} ${t("samples", "個樣本")}`)] : h("div", { class: "t2" }, t("No samples yet.", "未有樣本。")));
    };
    stats.replaceChildren(one(t("Download", "下載"), live.down), one(t("Upload", "上傳"), live.up));
  };
  const timer = setInterval(drawStats, 2000);
  drawStats();
  ctx.root.append(ctx.page(label, { en: "Real readings from the router every two seconds. Hover or use the arrow keys on a chart to scrub.", yue: "每兩秒由路由器讀取真實數據。喺圖表上移動滑鼠或者撳方向鍵都可以逐點睇。" },
    w.card({ en: "Internet traffic", yue: "上網流量" }, box),
    collapsible(ctx, { id: "live-charts.stats", title: { en: "Statistics for this window", yue: "今次視窗嘅統計" }, descriptive: true }, stats)));
  return () => { clearInterval(timer); live.stop(); };
}

export default {
  id: "live-charts",
  screens: [{ id: "live-charts", group: { en: "Appearance", yue: "外觀" }, icon: "monitoring", label, render: screen }],
  commands: [{ id: "live-charts.open", icon: "monitoring", label: { en: "Open live traffic", yue: "開啟即時流量" }, keywords: "chart graph bandwidth download upload", run: (ctx) => ctx.navigate("live-charts") }],
};
