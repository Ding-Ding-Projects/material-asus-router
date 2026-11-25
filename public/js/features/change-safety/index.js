// Change safety, browser side: the history manager screen, the undo and redo
// shortcuts, the palette and context menu entries, and the explanation of the
// four impact levels. The top bar switch, the undo toast, the four-key dialog,
// the Level 3 warning, the reboot launch and the progress timeline live in
// safety.js and are wired into the shell by public/js/main.js and dock.js.
import { historyScreen } from "./history-screen.js";
import { LEVELS, SHORTCUTS, isTextTarget } from "./model.js";
import { launchSequence, levelBadge, loadSafety, redo, safety, setLiveMode, undo } from "./safety.js";

const label = { en: "History manager", yue: "改動記錄管理" };
const NAV = (globalThis.marNav ??= {});
const def = NAV.defineShortcut ?? ((d) => (NAV.shortcutQueue ??= []).push(d));

// Fields keep their own undo, and a dialog owns the keyboard while it is open.
const free = () => !isTextTarget(document.activeElement) && !document.querySelector("dialog[open]");
def({ id: "router.undo", keys: "Mod+Z", label: { en: "Undo the last router change", yue: "還原上一項路由器改動" }, when: free, run: () => undo() });
def({ id: "router.redo", keys: "Mod+Shift+Z", label: { en: "Redo the router change", yue: "重做路由器改動" }, when: free, run: () => redo() });
def({ id: "router.redo-y", keys: "Mod+Y", alias: true, label: { en: "Redo the router change (same)", yue: "重做路由器改動（同一個）" }, when: free, run: () => redo() });

function legend(ctx) {
  const { h, tt, t } = ctx;
  return h("section", { class: "card rise legend" },
    h("h2", { class: "h2" }, t("How much a change disturbs the house", "改動對屋企嘅影響")),
    h("div", { class: "legend-grid" }, LEVELS.map((l) => h("div", { class: `legend-item lv${l.level}` }, levelBadge(l.level), h("div", { class: "t2" }, tt(l.about))))),
    h("div", { class: "row" }, h("div", { class: "grow" }, h("b", {}, t("Live mode", "即時模式")), h("div", { class: "t2" }, t("Live: changes apply as you make them, with an Undo toast. Review: you check every change first.", "即時：改動會即刻套用，並有「還原」提示。檢查：每項改動要先檢查。"))),
      h("div", { class: "seg", role: "radiogroup", "aria-label": t("Change mode", "改動模式") }, [[true, t("Live", "即時")], [false, t("Review", "檢查")]].map(([on, text]) => h("button", { role: "radio", "aria-checked": String(safety.live === on), class: safety.live === on ? "on" : "", onClick: async (e) => { await setLiveMode(on); [...e.target.closest(".seg").children].forEach((b, i) => { const isOn = (i === 0) === safety.live; b.classList.toggle("on", isOn); b.setAttribute("aria-checked", String(isOn)); }); } }, text)))),
    h("div", { class: "t2" }, t(`Shortcuts: ${SHORTCUTS.undo} undo, ${SHORTCUTS.redo} or Ctrl+Y redo. They do not run while you are typing in a field.`, `快速鍵：${SHORTCUTS.undo} 還原，${SHORTCUTS.redo} 或 Ctrl+Y 重做。喺輸入欄入面打字時唔會生效。`)));
}

export default {
  id: "change-safety",
  screens: [{ id: "change-safety", group: { en: "Safety", yue: "安全" }, icon: "shield_lock", label, async render(ctx) {
    await loadSafety();
    ctx.root.append(legend(ctx));
    return historyScreen(ctx.root);
  } }],
  settings: [{ id: "change-safety", icon: "shield_lock", label, render: (ctx) => legend(ctx) }],
  commands: [
    { id: "change-safety.undo", icon: "undo", label: { en: "Undo the last router change", yue: "還原上一項路由器改動" }, keywords: "undo revert back 還原 返轉", run: () => undo() },
    { id: "change-safety.redo", icon: "redo", label: { en: "Redo the router change", yue: "重做路由器改動" }, keywords: "redo again 重做", run: () => redo() },
    { id: "change-safety.live", icon: "bolt", label: { en: "Switch between Live and Review", yue: "切換即時／檢查模式" }, keywords: "live review mode 即時 檢查", run: () => setLiveMode(!safety.live) },
    { id: "change-safety.history", icon: "history", label: { en: "Open the history manager", yue: "打開改動記錄管理" }, keywords: "history timeline restore 記錄 還原", run: (ctx) => ctx.navigate("change-safety") },
    { id: "change-safety.reboot", icon: "restart_alt", label: { en: "Reboot the router (launch sequence)", yue: "重啟路由器（發射程序）" }, keywords: "reboot restart launch 重啟", run: () => launchSequence() },
  ],
  overlays: [{ id: "change-safety.menus", mount(ctx) {
    // Right-click anywhere: undo and redo, with their shortcuts, next to the stock items.
    return ctx.bus.on("context:collect", ({ add }) => {
      add({ id: "router-undo", icon: "undo", label: { en: "Undo the last router change", yue: "還原上一項路由器改動" }, shortcutId: "router.undo", run: () => undo() });
      add({ id: "router-redo", icon: "redo", label: { en: "Redo the router change", yue: "重做路由器改動" }, shortcutId: "router.redo", run: () => redo() });
    });
  } }],
};
