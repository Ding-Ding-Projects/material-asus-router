// Context menus show working shortcuts. This feature owns the one table of
// shortcuts (globalThis.marNav.shortcuts). Other features add to it with
// globalThis.marNav.defineShortcut({ id, keys, label, run }); the table both
// handles the key press and supplies the text a menu item shows. The shortcut
// help screen lists the same table.
import { createRegistry, display } from "./shortcuts.js";

const NAV = (globalThis.marNav ??= {});
NAV.shortcutQueue ??= [];
NAV.defineShortcut ??= (def) => {
  NAV.shortcutQueue.push(def);
  NAV.shortcuts?.register(def);
};
NAV.shortcuts = createRegistry();
for (const def of NAV.shortcutQueue) NAV.shortcuts.register(def);

const label = { en: "Keyboard shortcuts", yue: "鍵盤快速鍵" };

export default {
  id: "menu-shortcuts",
  overlays: [
    {
      id: "menu-shortcuts.keys",
      mount(ctx) {
        for (const def of NAV.shortcutQueue) if (!NAV.shortcuts.find(def.id)) NAV.shortcuts.register(def);
        const onKey = (event) => {
          if (event.defaultPrevented || event.isComposing) return;
          const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? "") || event.target?.isContentEditable;
          const def = NAV.shortcuts.find_event(event);
          if (!def) return;
          // A bare-key shortcut never fires while somebody is typing.
          if (typing && !/\b(Mod|Ctrl|Alt)\b/.test(def.keys)) return;
          if (def.when && !def.when(ctx)) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          def.run(ctx);
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
      },
    },
  ],
  screens: [
    {
      id: "shortcuts",
      group: { en: "Router", yue: "路由器" },
      icon: "keyboard",
      label,
      render(ctx) {
        const { h, icon, t } = ctx;
        const rows = NAV.shortcuts.list().sort((a, b) => a.id.localeCompare(b.id));
        ctx.root.append(ctx.page(label, { en: "Every shortcut the app handles. Menus show these same keys.", yue: "程式處理嘅所有快速鍵，選單顯示嘅就係呢啲。" },
          h("section", { class: "card" }, rows.length
            ? rows.map((d) => h("div", { class: "row" }, icon("keyboard", "sm"), h("div", { class: "grow" }, h("div", { class: "t1" }, ctx.tt(d.label)), h("div", { class: "t2" }, d.id)), h("kbd", { class: "kbd" }, display(d.keys))))
            : h("div", { class: "empty" }, t("No shortcuts registered.", "未有登記任何快速鍵。")))));
      },
    },
  ],
  commands: [{ id: "menu-shortcuts.open", icon: "keyboard", label, keywords: "keys hotkeys", run: (ctx) => ctx.navigate("shortcuts") }],
};
