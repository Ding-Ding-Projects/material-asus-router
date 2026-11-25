// The command palette: one search box over every screen, every feature
// command and every feature settings section. Open it with Ctrl+K (Cmd+K on
// a Mac) or the lightning button in the top bar.
import { h, icon, openDialog, t, tt } from "./core.js";

// items: [{ id, icon, label: {en, yue}, kind: {en, yue}, keywords?, run() }]
export function openPalette(items) {
  openDialog((close) => {
    let shown = items;
    let at = 0;
    const list = h("div", { class: "list", role: "listbox" });
    const input = h("input", { class: "field", type: "search", autocomplete: "off", "aria-label": t("Search screens and commands", "搜尋畫面同指令"), placeholder: t("Type a screen or a command", "輸入畫面或者指令") });
    const draw = () => {
      list.replaceChildren(...shown.slice(0, 40).map((item, i) => h("button", { role: "option", "aria-selected": String(i === at), onClick: () => (close(), item.run()) }, icon(item.icon ?? "chevron_right", "sm"), tt(item.label), h("span", { class: "kind" }, tt(item.kind)))));
      if (!shown.length) list.append(h("div", { class: "empty" }, t("Nothing found.", "搵唔到。")));
    };
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      shown = q ? items.filter((i) => `${i.label.en} ${i.label.yue} ${i.id} ${i.keywords ?? ""}`.toLowerCase().includes(q)) : items;
      at = 0;
      draw();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); at = Math.min(at + 1, Math.min(shown.length, 40) - 1); draw(); list.children[at]?.scrollIntoView({ block: "nearest" }); }
      if (e.key === "ArrowUp") { e.preventDefault(); at = Math.max(at - 1, 0); draw(); list.children[at]?.scrollIntoView({ block: "nearest" }); }
      if (e.key === "Enter" && shown[at]) { e.preventDefault(); close(); shown[at].run(); }
    });
    draw();
    queueMicrotask(() => input.focus());
    return h("div", { class: "palette" }, h("h2", { class: "h2" }, t("Command palette", "指令面板")), input, list);
  }, { label: t("Command palette", "指令面板") });
}
