// Overlays and panels: a floating live-traffic panel (a real use of the panel
// engine), plus a settings card that lists every remembered panel and resets
// them. Panels are in panels.js.
import { prefs } from "../material-design/prefs.js";
import { widgets } from "../material-design/ui.js";
import { mountTraffic } from "../live-charts/traffic.js";
import { openPanel, openPanelIds, resetAllPanels, resetPanel, savedRect } from "./panels.js";

const label = { en: "Floating panels", yue: "浮動面板" };

function openTraffic(ctx, opener) {
  return openPanel(ctx, {
    id: "live-traffic", title: { en: "Live traffic", yue: "即時流量" }, size: { w: 440, h: 460 }, opener,
    build(body) {
      const live = mountTraffic(ctx, body, { height: 120 });
      return () => live.stop();
    },
  });
}

export default {
  id: "overlay-panels",
  toolbar: [{ id: "live-traffic-panel", icon: "picture_in_picture", label: { en: "Floating live traffic panel", yue: "浮動即時流量面板" }, onClick: (ctx) => openTraffic(ctx, document.activeElement) }],
  commands: [
    { id: "overlay-panels.traffic", icon: "picture_in_picture", label: { en: "Open the floating traffic panel", yue: "開啟浮動流量面板" }, keywords: "panel float window chart", run: (ctx) => openTraffic(ctx) },
    { id: "overlay-panels.reset", icon: "restart_alt", label: { en: "Reset all panel positions and sizes", yue: "重設所有面板位置同大細" }, keywords: "panel reset layout", run: () => resetAllPanels() },
  ],
  settings: [{
    id: "overlay-panels", icon: "picture_in_picture", label,
    render(ctx) {
      const w = widgets(ctx);
      const { h, t } = ctx;
      const list = h("div", {});
      const draw = () => {
        const saved = Object.entries(prefs.get().panels);
        list.replaceChildren(...(saved.length
          ? saved.map(([id, r]) => w.row(id, `${r.w} × ${r.h} px at ${r.x}, ${r.y}`, w.button({ en: "Reset", yue: "重設" }, "restart_alt", () => resetPanel(id))))
          : [h("div", { class: "empty" }, t("No panel has been moved or resized yet. Drag a panel by its header or resize it from any edge and it is remembered here.", "未有面板被移動或者調整大細。拖動面板標題或者由任何邊緣調整，就會喺呢度記住。"))]));
        list.append(h("div", { class: "actions" }, w.button({ en: "Open the traffic panel", yue: "開啟流量面板" }, "picture_in_picture", (e) => openTraffic(ctx, e.currentTarget)), w.button({ en: "Reset all panels", yue: "重設所有面板" }, "restart_alt", () => resetAllPanels())));
      };
      draw();
      const off = prefs.subscribe(() => (list.isConnected ? draw() : off()));
      return list;
    },
  }],
  // exported for tests
  _helpers: { openPanelIds, savedRect },
};
