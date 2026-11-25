// Collapsible filters and statistics: the section component is in
// collapsible.js. This file adds a settings card that lists which sections
// have been opened or closed by hand and resets them to their defaults.
import { prefs } from "../material-design/prefs.js";
import { widgets } from "../material-design/ui.js";
import { resetCollapsed } from "./collapsible.js";

const label = { en: "Collapsible sections", yue: "可收合區塊" };

export default {
  id: "collapse-filters",
  settings: [{
    id: "collapse-filters", icon: "unfold_less", label,
    render(ctx) {
      const w = widgets(ctx);
      const { h, t } = ctx;
      const list = h("div", {});
      const draw = () => {
        const saved = Object.entries(prefs.get().collapsed);
        list.replaceChildren(...(saved.length
          ? saved.map(([id, closed]) => w.row(id, closed ? { en: "Closed", yue: "已收合" } : { en: "Open", yue: "已展開" }, h("span", { class: `tag ${closed ? "" : "good"}` }, closed ? t("Closed", "已收合") : t("Open", "已展開"))))
          : [h("div", { class: "t2" }, t("Every section is in its default state. Descriptive sections and statistics start closed; search and filter bars start open.", "所有區塊都係預設狀態。描述性區塊同統計預設收合；搜尋同篩選列預設展開。"))]));
        list.append(h("div", { class: "actions" }, w.button({ en: "Reset every section to its default", yue: "將所有區塊重設做預設" }, "restart_alt", () => resetCollapsed())));
      };
      draw();
      const off = prefs.subscribe(() => (list.isConnected ? draw() : off()));
      return list;
    },
  }],
  commands: [{ id: "collapse-filters.reset", icon: "unfold_more", label: { en: "Reset collapsed sections", yue: "重設收合區塊" }, keywords: "filters statistics expand collapse", run: () => resetCollapsed() }],
};
