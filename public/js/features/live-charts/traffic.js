// Feeds two live charts (download and upload) with the router's real traffic,
// read from the overview every two seconds. It never invents a reading: when a
// read fails the charts say the data is out of date, and when updates are
// paused nothing is requested.
import { createLiveChart } from "./chart.js";
import { formatRate } from "./chart-model.js";

export const INTERVAL_MS = 2000;

export function mountTraffic(ctx, container, { windowMs = 120000, height = 150 } = {}) {
  const { h, t, icon } = ctx;
  const down = createLiveChart(ctx, { label: { en: "Download", yue: "下載" }, format: formatRate, windowMs, height, intervalMs: INTERVAL_MS, series: "primary" });
  const up = createLiveChart(ctx, { label: { en: "Upload", yue: "上傳" }, format: formatRate, windowMs, height, intervalMs: INTERVAL_MS, series: "tertiary" });
  const error = h("div", { class: "note bad", role: "alert", hidden: true });
  let paused = false;
  let timer = null;
  let busy = false;
  let stopped = false;
  const pauseBtn = h("button", { type: "button", class: "btn o sm", "aria-pressed": "false", onClick: () => toggle() });
  const drawBtn = () => { pauseBtn.replaceChildren(icon(paused ? "play_arrow" : "pause", "sm"), paused ? t("Resume", "繼續") : t("Pause", "暫停")); pauseBtn.setAttribute("aria-pressed", String(paused)); };
  function toggle(force) {
    paused = force ?? !paused;
    down.setState(paused ? "paused" : down.count() ? "live" : "loading");
    up.setState(paused ? "paused" : up.count() ? "live" : "loading");
    drawBtn();
    if (!paused) poll();
  }
  async function poll() {
    if (busy || paused || stopped || document.hidden) return;
    busy = true;
    try {
      const d = await ctx.api.get("/api/domain/overview");
      const rx = d?.traffic?.rxBitsPerSecond;
      const tx = d?.traffic?.txBitsPerSecond;
      if (Number.isFinite(rx) && Number.isFinite(tx)) { down.push(rx); up.push(tx); error.hidden = true; }
      else { down.markStale(); up.markStale(); error.textContent = t("The router did not report traffic.", "路由器冇回報流量。"); error.hidden = false; }
    } catch (e) {
      down.markStale(); up.markStale();
      error.textContent = e.message;
      error.hidden = false;
    } finally {
      busy = false;
    }
  }
  drawBtn();
  container.append(h("div", { class: "actions" }, pauseBtn), error, h("div", { class: "lc-legend legend" }, h("span", {}, h("i", { class: "lc-key-a" }), t("Download", "下載")), h("span", {}, h("i", { class: "lc-key-b" }), t("Upload", "上傳"))), down.el, up.el);
  timer = setInterval(poll, INTERVAL_MS);
  poll();
  return {
    down, up, toggle,
    stop() { stopped = true; clearInterval(timer); down.destroy(); up.destroy(); },
  };
}
