// The command palette. Ctrl+Shift+F (and Ctrl+K, so there is only ever one
// palette) opens it. It lists every screen, setting, command and appearance
// control. A selected setting shows its real control right in the row; Enter
// takes you to the exact setting, with its screen open, scrolled into view,
// focused and highlighted. A setting you cannot change is labelled and asks
// before doing anything. The size (card or full window) is remembered.
import { buildItems, rank } from "./palette-model.js";

const NAV = (globalThis.marNav ??= {});
const SIZE_KEY = "mar.palette.size";
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const def = NAV.defineShortcut ?? ((d) => (NAV.shortcutQueue ??= []).push(d));
let open = false;

def({ id: "palette.open", keys: "Mod+Shift+F", label: { en: "Open the command palette", yue: "打開指令面板" }, run: (ctx) => openPalette(ctx) });
def({ id: "palette.open-k", keys: "Mod+K", alias: true, label: { en: "Open the command palette (same palette)", yue: "打開指令面板（同一個）" }, run: (ctx) => openPalette(ctx) });

const THEME_KEY = "mar.theme";
function setTheme(value) {
  if (value === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;
  store.set(THEME_KEY, value);
}

function appearanceCommands(ctx) {
  const { h, t } = ctx;
  const current = () => store.get(THEME_KEY, "auto");
  const seg = (name, options, get, set) => () => {
    const wrap = h("div", { class: "seg", role: "radiogroup", "aria-label": name }, options.map(([v, label]) => h("button", { type: "button", role: "radio", class: get() === v ? "on" : "", "aria-checked": String(get() === v), onClick: (e) => { set(v); wrap.querySelectorAll("button").forEach((b) => { const on = b === e.currentTarget; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); }); } }, label)));
    return wrap;
  };
  return [
    { id: "appearance.theme", kind: "appearance", icon: "contrast", label: { en: "Theme: auto, light or dark", yue: "主題：自動、淺色或深色" }, keywords: "dark light colour mode", run: () => setTheme(current() === "dark" ? "light" : "dark"), render: seg(t("Theme", "主題"), [["auto", t("Auto", "自動")], ["light", t("Light", "淺色")], ["dark", t("Dark", "深色")]], current, setTheme) },
    { id: "appearance.language", kind: "appearance", icon: "translate", label: { en: "Language: English, Cantonese or both", yue: "語言：英文、粵語或兩者" }, keywords: "language 粵語 english cantonese", run: () => document.querySelector(".bar .seg button:not(.on)")?.click(), render: seg(t("Language", "語言"), [["en", "EN"], ["yue", "粵"], ["both", "EN+粵"]], () => ctx.getLang(), (v) => { const idx = { en: 0, yue: 1, both: 2 }[v]; document.querySelectorAll(".bar .seg button")[idx]?.click(); }) },
  ];
}

function builtinCommands(ctx) {
  const { t } = ctx;
  return [
    { id: "notifications.open", icon: "notifications", label: { en: "Open the notification centre", yue: "打開通知中心" }, keywords: "bell alerts history", run: () => ctx.navigate("notifications") },
    { id: "shortcuts.open", icon: "keyboard", label: { en: "Show keyboard shortcuts", yue: "顯示鍵盤快速鍵" }, keywords: "keys hotkeys", run: () => ctx.navigate("shortcuts") },
    { id: "dock.review", icon: "edit_note", label: { en: "Review the changes waiting", yue: "檢視等緊嘅改動" }, keywords: "apply pending dock", run: () => { const btn = document.querySelector(".dock .btn.f"); if (btn) btn.click(); else ctx.toast(t("No changes waiting.", "冇等緊嘅改動。")); } },
    ...appearanceCommands(ctx),
  ];
}

// Other features add commands: ctx.bus.emit("palette:collect", { add(cmd) }) is
// answered by every feature that listens for it.
function collect(ctx) {
  const out = [...builtinCommands(ctx)];
  ctx.bus.emit("palette:collect", { add: (c) => out.push(c) });
  return out;
}

async function teleport(ctx, item) {
  if (item.kind === "setting") {
    ctx.state.focusEntry = item.id;
    await ctx.navigate(item.domain);
    const el = document.getElementById(`s-${item.id}`);
    el?.scrollIntoView({ block: "center" });
    el?.classList.add("flash");
    el?.querySelector("button, input, select, [tabindex]")?.focus({ preventScroll: true });
  } else if (item.kind === "page") await ctx.navigate(item.id);
  else await item.run?.(ctx);
}

export function openPalette(ctx) {
  if (open || !ctx.state.me || document.querySelector("dialog[open]")) return;
  open = true;
  const { h, icon, t, tt } = ctx;
  const catl = ctx.state.catalog ?? { domains: [], entries: [] };
  const items = buildItems({ domains: catl.domains, featureScreens: ctx.state.featureScreens ?? {}, entries: catl.entries, commands: collect(ctx), canWrite: ctx.state.canWrite });
  let shown = items;
  let at = 0;
  let size = store.get(SIZE_KEY, "card") === "full" ? "full" : "card";
  const list = h("div", { class: "pal-list", role: "listbox", "aria-label": t("Results", "結果") });
  const count = h("div", { class: "sr", role: "status" });
  const input = h("input", { class: "field", type: "search", autocomplete: "off", "data-search-id": "palette", "aria-label": t("Search every screen, setting and command", "搜尋所有畫面、設定同指令"), placeholder: t("Search screens, settings and commands", "搜尋畫面、設定同指令") });
  const dialog = ctx.openDialog((close) => {
    const sizeBtn = h("button", { type: "button", class: "btn t sm", "aria-pressed": String(size === "full"), onClick: () => { size = size === "full" ? "card" : "full"; store.set(SIZE_KEY, size); dialog.sheet.classList.toggle("pal-full", size === "full"); sizeBtn.setAttribute("aria-pressed", String(size === "full")); } }, icon("open_in_full", "sm"), t("Full window", "全視窗"));
    list.addEventListener("click", (e) => { const row = e.target.closest("[data-i]"); if (row && !e.target.closest(".setting")) choose(Number(row.dataset.i), close); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter" && shown[at]) { e.preventDefault(); choose(at, close); }
      else if (e.key === "Escape" && input.value) { e.preventDefault(); e.stopPropagation(); input.value = ""; input.dispatchEvent(new Event("input")); }
    });
    return h("div", { class: "pal" }, h("div", { class: "row" }, h("h2", { class: "h2 grow" }, t("Command palette", "指令面板")), sizeBtn), input, count, list);
  }, { label: t("Command palette", "指令面板") });
  dialog.sheet.classList.add("pal-sheet");
  dialog.sheet.classList.toggle("pal-full", size === "full");
  dialog.sheet.parentElement?.setAttribute("data-search-scope", "palette");
  dialog.closed.then(() => { open = false; });

  function choose(i, close) {
    const item = shown[i];
    if (!item) return;
    if (item.locked) return void lockedPrompt(item, close);
    close();
    teleport(ctx, item);
  }
  async function lockedPrompt(item, close) {
    const go = await ctx.confirmDialog({ title: tt(item.label), body: `${tt(item.lockedReason)} ${t("Opening it will not change anything.", "打開唔會改任何嘢。")}`, confirm: t("Open the screen", "打開畫面") });
    if (go) { close(); teleport(ctx, item); }
  }
  function move(d) {
    at = Math.max(0, Math.min(shown.length - 1, at + d));
    paint(false);
    list.querySelector(`[data-i="${at}"]`)?.scrollIntoView({ block: "nearest" });
  }
  function paint(rebuild = true) {
    if (!rebuild) {
      list.querySelectorAll("[data-i]").forEach((r) => r.setAttribute("aria-selected", String(Number(r.dataset.i) === at)));
      return;
    }
    list.replaceChildren(...shown.slice(0, 60).map((item, i) => {
      const live = i === at && item.kind === "setting" && !item.locked ? ctx.controls.settingRow(item.entry) : i === at && item.render ? item.render() : null;
      return h("div", { class: "pal-row", "data-i": String(i), role: "option", "aria-selected": String(i === at) },
        h("div", { class: "pal-main" }, icon(item.icon, "sm"), h("span", { class: "grow" }, tt(item.label)), item.locked ? h("span", { class: "tag warn" }, icon("lock", "sm"), t("Locked", "鎖住")) : null, h("span", { class: "kind" }, tt(item.where))),
        live);
    }));
    if (!shown.length) list.append(h("div", { class: "empty" }, icon("search_off", "lg"), t("Nothing matches.", "冇嘢配對。")));
    count.textContent = t(`${shown.length} result${shown.length === 1 ? "" : "s"}`, `${shown.length} 個結果`);
  }
  input.addEventListener("input", () => {
    const rx = NAV.regex?.stateOf(input);
    const m = rx?.mode === "regex" ? NAV.regex.matcherFor(input) : null;
    shown = rank(items, input.value, m ? m.test : null);
    if (m?.error) count.textContent = tt(m.error);
    at = 0;
    paint();
    if (m?.error) count.textContent = tt(m.error);
  });
  list.addEventListener("pointermove", (e) => { const row = e.target.closest("[data-i]"); if (row && Number(row.dataset.i) !== at && !list.querySelector(".pal-row .setting :focus")) { at = Number(row.dataset.i); paint(true); } });
  shown = rank(items, "");
  paint();
  setTimeout(() => input.focus(), 0);
}

export default {
  id: "command-palette",
  overlays: [
    {
      id: "command-palette.stock-button",
      // The stock lightning button opens this same palette, so there is only one.
      mount(ctx) {
        const onClick = (e) => {
          const btn = e.target.closest?.(".bar .icb");
          if (!btn || btn.querySelector(".ms")?.textContent !== "bolt") return;
          e.preventDefault();
          e.stopImmediatePropagation();
          openPalette(ctx);
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
      },
    },
  ],
  commands: [{ id: "command-palette.open", icon: "bolt", label: { en: "Open the command palette", yue: "打開指令面板" }, keywords: "search everything", run: (ctx) => setTimeout(() => openPalette(ctx), 0) }],
};
