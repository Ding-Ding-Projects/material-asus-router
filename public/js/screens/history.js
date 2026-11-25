// Change history: every change the app made, its outcome, and one-click undo.
import { api, bus, h, icon, t, tt } from "../core.js";
import { app, statusCopy, undoChange } from "../dock.js";
import { header } from "./common.js";

export async function history(root) {
  const holder = h("div", { class: "grid" });
  const load = async () => {
    const { items } = await api.get("/api/changes/history");
    holder.replaceChildren(...(items.length
      ? items.map((r) => {
          const copy = statusCopy(r.status);
          return h("section", { class: "card rise" },
            h("div", { class: "row" }, h("span", { class: `tag ${copy.tag}` }, icon(copy.icon, "sm"), t(copy.en, copy.yue)), h("span", { class: "muted grow" }, `${new Date(r.at).toLocaleString()} · ${r.user || "—"}`)),
            r.items.slice(0, 6).map((i) => h("div", { class: "t2" }, h("b", {}, tt(i.label)), ": ", i.secret ? "••••••••" : `${i.old ?? "—"} → ${i.new ?? "—"}`)),
            r.items.length > 6 ? h("div", { class: "t2" }, t(`and ${r.items.length - 6} more`, `仲有 ${r.items.length - 6} 項`)) : null,
            r.note ? h("div", { class: "muted" }, r.note) : null,
            r.undone ? h("span", { class: "tag" }, icon("undo", "sm"), t("Undone", "已還原")) : null,
            r.undoOf ? h("span", { class: "tag" }, icon("undo", "sm"), t("This was an undo", "呢項係還原")) : null,
            r.canUndo && app.canWrite ? h("div", { class: "actions" }, h("button", { class: "btn t sm", onClick: () => undoChange(r.id) }, icon("undo", "sm"), t("Undo", "還原"))) : null);
        })
      : [h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("history", "lg"), t("Nothing has been changed yet.", "未改過任何嘢。")))]));
  };
  await load();
  root.append(h("div", { class: "page" }, header("history"), holder));
  return bus.on("changed", load);
}
