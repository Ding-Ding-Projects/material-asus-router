// Browser-style workspace tabs. Replaces the stock tab bar with a strip that
// docks to any edge (left by default), has one tab per destination (every one
// open on a fresh install, only never-offered ones added on an update, closed
// ones staying closed), overflow scrolling, drag and keyboard reordering,
// pinning, coloured groups, a New tab catalogue, four independent tab
// searches and bulk close with a preview. All of it is remembered in this
// browser. There is one router workspace at the top of the strip.
import { DOCKS, GROUP_COLORS, GROUP_ICONS, addGroup, closeMatching, closeTab, decorateGroup, deleteGroup, layout, moveIntoGroup, moveTab, openEvery, openTab, reconcile, sanitize, searchCatalog, searchClosed, searchGroups, searchOpen, setDock, setPinned, shiftTab } from "./tabs-model.js";

const NAV = (globalThis.marNav ??= {});
const KEY = "mar.tabs.v2";
const kv = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const def = NAV.defineShortcut ?? ((d) => (NAV.shortcutQueue ??= []).push(d));
def({ id: "tabs.close", keys: "Alt+Shift+W", label: { en: "Close the current tab", yue: "關閉而家嘅分頁" }, run: () => NAV.tabs?.closeCurrent() });
def({ id: "tabs.new", keys: "Alt+Shift+T", label: { en: "New tab: open the catalogue", yue: "新分頁：打開目錄" }, run: () => NAV.tabs?.catalog() });
def({ id: "tabs.find", keys: "Alt+Shift+J", label: { en: "Find tabs", yue: "搵分頁" }, run: () => NAV.tabs?.find() });
def({ id: "tabs.reopen", keys: "Alt+Shift+Y", label: { en: "Reopen the last closed tab", yue: "重開上一個關咗嘅分頁" }, run: () => NAV.tabs?.reopen() });

const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
let C = null;
let state = sanitize(null);
let dests = [];
let strip = null;
let list = null;
let narrow = null;

const labelOf = (id) => { const d = dests.find((x) => x.id === id); return d ? `${d.label.en}
${d.label.yue}` : id; };
const shown = (id) => { const d = dests.find((x) => x.id === id); return d ? C.tt(d.label) : id; };
const iconOf = (id) => dests.find((x) => x.id === id)?.icon ?? "tab";
const save = () => { kv.set(KEY, state); };
const commit = (next) => { state = next; save(); draw(); };

function destinations(ctx) {
  const out = [];
  const seen = new Set();
  for (const d of [...(ctx.state.catalog?.domains ?? []), ...Object.values(ctx.state.featureScreens ?? {})]) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    out.push({ id: d.id, icon: d.icon ?? "tab", label: d.label, group: d.group });
  }
  return out;
}

const go = (id) => { state = openTab(state, id); save(); C.navigate(id); };
const currentId = () => C.state.route;

function closeById(id) {
  const tabs = state.tabs.map((t) => t.id);
  const i = tabs.indexOf(id);
  const next = closeTab(state, id);
  if (next === state) return C.toast(C.t("A pinned tab cannot be closed. Unpin it first.", "固定咗嘅分頁唔可以關閉，先取消固定。"), "warn");
  commit(next);
  if (id === currentId()) C.navigate(tabs[i + 1] ?? tabs[i - 1] ?? "overview");
}

// ---- matcher for a search box (plain words or the box's regex) ----------------------------------
function testFor(input) {
  const rx = NAV.regex?.stateOf(input);
  if (rx?.mode === "regex") { const m = NAV.regex.matcherFor(input); return { test: m.test, error: m.error }; }
  const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return { test: (s) => words.every((w) => s.toLowerCase().includes(w)), error: null };
}

// ---- drawing --------------------------------------------------------------------------------------------
function tabEl(t) {
  const { h, icon, t: tr } = C;
  const active = t.id === currentId();
  const group = state.groups.find((g) => g.id === t.group);
  const el = h("div", { class: `mar-tab${active ? " on" : ""}${t.pinned ? " pinned" : ""}`, "data-id": t.id, draggable: "true" },
    h("button", { type: "button", role: "tab", class: "mar-tab-main", "aria-selected": String(active), tabindex: active ? "0" : "-1", title: shown(t.id), onClick: () => go(t.id), onKeydown: (e) => tabKey(e, t) },
      icon(iconOf(t.id), "sm"), h("span", { class: "mar-label" }, shown(t.id)), t.pinned ? icon("push_pin", "sm") : null),
    t.pinned ? null : h("button", { type: "button", class: "mar-x", tabindex: "-1", "aria-label": `${tr("Close", "關閉")} ${shown(t.id)}`, onClick: () => closeById(t.id) }, icon("close", "sm")));
  if (group) el.style.setProperty("--g", group.color);
  el.addEventListener("dragstart", (e) => { e.dataTransfer?.setData("text/plain", t.id); el.classList.add("dragging"); });
  el.addEventListener("dragend", () => el.classList.remove("dragging"));
  el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("over"); });
  el.addEventListener("dragleave", () => el.classList.remove("over"));
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    el.classList.remove("over");
    const from = e.dataTransfer?.getData("text/plain");
    if (!from || from === t.id) return;
    commit(moveTab(state, from, state.tabs.findIndex((x) => x.id === t.id)));
  });
  return el;
}

function tabKey(e, t) {
  const vertical = state.dock === "left" || state.dock === "right";
  const prev = vertical ? "ArrowUp" : "ArrowLeft";
  const next = vertical ? "ArrowDown" : "ArrowRight";
  const ids = state.tabs.map((x) => x.id);
  const i = ids.indexOf(t.id);
  if (e.altKey && (e.key === prev || e.key === next)) { e.preventDefault(); commit(shiftTab(state, t.id, e.key === next ? 1 : -1)); strip.querySelector(`[data-id="${t.id}"] .mar-tab-main`)?.focus(); return; }
  const focusAt = (k) => { const id = ids[(k + ids.length) % ids.length]; strip.querySelector(`[data-id="${id}"] .mar-tab-main`)?.focus(); };
  if (e.key === prev) { e.preventDefault(); focusAt(i - 1); }
  else if (e.key === next) { e.preventDefault(); focusAt(i + 1); }
  else if (e.key === "Home") { e.preventDefault(); focusAt(0); }
  else if (e.key === "End") { e.preventDefault(); focusAt(ids.length - 1); }
  else if (e.key === "Delete") { e.preventDefault(); closeById(t.id); }
}

function groupEl(g, tabs) {
  const { h, icon, t } = C;
  const head = h("button", { type: "button", class: "mar-group", "aria-expanded": String(!g.collapsed), onClick: () => commit(decorateGroup(state, g.id, { collapsed: !g.collapsed })) },
    icon(g.collapsed ? "chevron_right" : "expand_more", "sm"), icon(g.icon, "sm"), h("span", { class: "mar-label" }, g.name), h("span", { class: "mar-count" }, String(tabs.length)));
  const wrap = h("div", { class: "mar-gwrap", "data-group": g.id }, head, g.collapsed ? null : h("div", { class: "mar-gtabs", role: "group", "aria-label": g.name }, tabs.map(tabEl)));
  wrap.style.setProperty("--g", g.color);
  return wrap;
}

export function draw() {
  if (!strip) return;
  const { h, icon, t } = C;
  const lay = layout(state);
  const focusId = strip.contains(document.activeElement) ? document.activeElement.closest?.(".mar-tab")?.dataset.id : null;
  const info = C.state.catalog?.info;
  const router = h("button", { type: "button", class: `mar-router${currentId() === "overview" ? " on" : ""}`, title: t("This router. Select to focus its overview.", "呢部路由器，撳一下去佢嘅概覽。"), onClick: () => go("overview") }, icon("router", "sm"), h("span", { class: "mar-label" }, info?.model ?? t("Router", "路由器")));
  const bar = h("div", { class: "mar-bar" },
    h("button", { type: "button", class: "mar-btn", "aria-label": t("New tab: every screen", "新分頁：所有畫面"), title: `${t("New tab", "新分頁")} (${NAV.shortcuts?.displayFor("tabs.new") ?? ""})`, onClick: openCatalog }, icon("add", "sm")),
    h("button", { type: "button", class: "mar-btn", "aria-label": t("Find tabs", "搵分頁"), title: t("Find tabs", "搵分頁"), onClick: openFind }, icon("search", "sm")),
    h("button", { type: "button", class: "mar-btn", "aria-label": t("Tab options", "分頁選項"), "aria-haspopup": "dialog", title: t("Tab options", "分頁選項"), onClick: openOptions }, icon("more_horiz", "sm")));
  list = h("div", { class: "mar-list", role: "tablist", "aria-orientation": orientation(), "aria-label": t("Open screens", "已開啟嘅畫面") },
    lay.loose.filter((x) => x.pinned).map(tabEl), lay.loose.filter((x) => !x.pinned).map(tabEl), lay.groups.map(({ group, tabs }) => groupEl(group, tabs)));
  strip.replaceChildren(router, bar, list);
  strip.dataset.dock = state.dock;
  strip.classList.toggle("mar-v", orientation() === "vertical");
  list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (focusId) strip.querySelector(`.mar-tab[data-id="${focusId}"] .mar-tab-main`)?.focus({ preventScroll: true });
}
const orientation = () => (narrow?.matches ? "horizontal" : state.dock === "left" || state.dock === "right" ? "vertical" : "horizontal");

function place() {
  const shell = document.querySelector(".shell");
  const main = document.querySelector(".shell > .main");
  if (!shell || !main || !strip) return;
  strip.remove();
  if (state.dock === "left") shell.insertBefore(strip, main);
  else if (state.dock === "right") shell.append(strip);
  else if (state.dock === "top") main.insertBefore(strip, main.firstChild);
  else main.append(strip);
}

// ---- dialogs ----------------------------------------------------------------------------------------------
export function openCatalog() {
  const { h, icon, t, tt } = C;
  const input = h("input", { type: "search", class: "field", "data-search-id": "tabs-catalog", "aria-label": t("Search every screen", "搜尋所有畫面"), placeholder: t("Search every screen", "搜尋所有畫面") });
  const box = h("div", { class: "mar-catalog" });
  const dialog = C.openDialog((close) => {
    const draw2 = () => {
      const { test, error } = testFor(input);
      const hits = dests.filter((d) => test(`${d.label.en}
${d.label.yue}
${d.id}`));
      const groups = new Map();
      for (const d of hits) { const g = d.group ? tt(d.group) : t("Features", "功能"); groups.set(g, [...(groups.get(g) ?? []), d]); }
      box.replaceChildren(...[...groups].flatMap(([g, ds]) => [h("div", { class: "k" }, g), ...ds.map((d) => h("button", { type: "button", class: "row navi", onClick: () => { close(); go(d.id); } }, icon(d.icon, "sm"), h("span", { class: "grow" }, tt(d.label)), h("span", { class: `tag ${state.tabs.some((x) => x.id === d.id) ? "good" : ""}` }, state.tabs.some((x) => x.id === d.id) ? t("Open", "已開") : t("Closed", "已關"))))]));
      if (!hits.length) box.append(h("div", { class: "empty" }, error ? tt(error) : t("No screen matches.", "冇畫面配對。")));
    };
    input.addEventListener("input", draw2);
    queueMicrotask(draw2);
    return [h("div", { class: "row" }, h("h2", { class: "h2 grow" }, t("New tab", "新分頁")), h("button", { class: "btn t sm", onClick: () => { commit(openEvery(state, dests)); close(); C.toast(t("Every tab is open.", "所有分頁已開啟。")); } }, icon("tab_group", "sm"), t("Open every tab", "開啟所有分頁"))), input, box, h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close() }, t("Close", "關閉")))];
  }, { label: t("New tab", "新分頁") });
  setTimeout(() => input.focus(), 0);
  return dialog;
}

export function openFind() {
  const { h, icon, t, tt } = C;
  const defs = [
    { id: "open", title: t("Open tabs", "已開分頁"), run: (test) => searchOpen(state, test, labelOf).map((id) => ({ id, text: shown(id), onPick: (close) => { close(); go(id); } })) },
    { id: "closed", title: t("Closed tabs", "已關分頁"), run: (test) => searchClosed(state, test, labelOf).map((id) => ({ id, text: shown(id), tag: t("Reopen", "重開"), onPick: (close) => { close(); go(id); } })) },
    { id: "groups", title: t("Groups", "群組"), run: (test) => searchGroups(state, test).map((g) => ({ id: g.id, text: `${g.name} (${state.tabs.filter((x) => x.group === g.id).length})`, onPick: () => { commit(decorateGroup(state, g.id, { collapsed: false })); } })) },
    { id: "catalog", title: t("Every destination", "所有目的地"), run: (test) => searchCatalog(dests, test, labelOf).map((id) => ({ id, text: shown(id), onPick: (close) => { close(); go(id); } })) },
  ];
  C.openDialog((close) => [
    h("h2", { class: "h2" }, t("Find tabs", "搵分頁")),
    h("div", { class: "mar-find" }, defs.map((d) => {
      const input = h("input", { type: "search", class: "field", "data-search-id": `tabs-${d.id}`, "aria-label": `${t("Search", "搜尋")}: ${d.title}`, placeholder: d.title });
      const out = h("div", { class: "mar-hits" });
      const paint = () => {
        const { test, error } = testFor(input);
        const hits = d.run(test);
        out.replaceChildren(...hits.slice(0, 12).map((x) => h("button", { type: "button", class: "chip", onClick: () => x.onPick(close) }, x.text, x.tag ? h("span", { class: "t2" }, ` · ${x.tag}`) : null)));
        if (!hits.length) out.append(h("span", { class: "t2" }, error ? tt(error) : t("Nothing found.", "冇搵到。")));
      };
      input.addEventListener("input", paint);
      paint();
      return h("section", { class: "card tone" }, h("h3", { class: "t1" }, d.title), input, out);
    })),
    h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close() }, t("Close", "關閉"))),
  ], { label: t("Find tabs", "搵分頁") });
}

function openOptions() {
  const { h, icon, t, tt } = C;
  C.openDialog((close) => {
    const dockName = { left: t("Left", "左"), top: t("Top", "頂"), right: t("Right", "右"), bottom: t("Bottom", "底") };
    return [
      h("h2", { class: "h2" }, t("Tab options", "分頁選項")),
      h("div", {}, h("div", { class: "k" }, t("Dock the tab strip", "分頁列放喺邊")), h("div", { class: "seg", role: "radiogroup", "aria-label": t("Dock edge", "停靠邊緣") }, DOCKS.map((d) => h("button", { type: "button", role: "radio", "aria-checked": String(state.dock === d), class: state.dock === d ? "on" : "", onClick: () => { close(); setDockEdge(d); } }, dockName[d])))),
      h("div", { class: "chips" },
        h("button", { class: "btn t sm", onClick: () => { close(); commit(openEvery(state, dests)); } }, icon("tab_group", "sm"), t("Open every tab", "開啟所有分頁")),
        h("button", { class: "btn t sm", onClick: () => { close(); closeByText(); } }, icon("tab_close", "sm"), t("Close tabs by text", "按文字關閉分頁")),
        h("button", { class: "btn t sm", onClick: () => { close(); newGroupDialog([]); } }, icon("create_new_folder", "sm"), t("New group", "新群組")),
        h("button", { class: "btn o sm", onClick: async () => { close(); if (await C.confirmDialog({ title: t("Reset the tab layout?", "重設分頁排列？"), body: t("Every tab opens again in the default order and groups are removed.", "所有分頁會用預設次序重開，群組會移除。"), confirm: t("Reset", "重設") })) commit(reconcile(sanitize(null), dests)); } }, icon("restart_alt", "sm"), t("Reset layout", "重設排列")))];
  }, { label: t("Tab options", "分頁選項") });
}

function setDockEdge(d) {
  state = setDock(state, d);
  save();
  place();
  draw();
}

// Move into group: pick a group or make one.
export function groupDialog(ids) {
  const { h, icon, t } = C;
  C.openDialog((close) => [
    h("h2", { class: "h2" }, t("Move into group", "加入群組")),
    h("div", {}, state.groups.map((g) => h("button", { class: "row navi", onClick: () => { commit(moveIntoGroup(state, ids, g.id)); close(); } }, icon(g.icon, "sm"), h("span", { class: "grow" }, g.name), h("span", { class: "mar-dot" }, "●")))),
    h("button", { class: "btn t", onClick: () => { close(); newGroupDialog(ids); } }, icon("create_new_folder", "sm"), t("New group", "新群組")),
    ids.some((id) => state.tabs.find((x) => x.id === id)?.group) ? h("button", { class: "btn o", onClick: () => { commit(moveIntoGroup(state, ids, null)); close(); } }, icon("folder_off", "sm"), t("Remove from group", "移出群組")) : null,
    h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close() }, t("Cancel", "取消"))),
  ], { label: t("Move into group", "加入群組") });
}

function newGroupDialog(ids, existing = null) {
  const { h, icon, t } = C;
  const g = existing ?? { name: "", color: GROUP_COLORS[state.groups.length % GROUP_COLORS.length], icon: "folder" };
  C.openDialog((close) => {
    const name = h("input", { class: "field", value: g.name, maxlength: "40", "aria-label": t("Group name", "群組名稱"), placeholder: t("Group name", "群組名稱") });
    const colors = h("div", { class: "chips", role: "radiogroup", "aria-label": t("Colour", "顏色") }, GROUP_COLORS.map((c) => { const b = h("button", { type: "button", role: "radio", class: `chip mar-swatch${g.color === c ? " on" : ""}`, "aria-checked": String(g.color === c), "aria-label": c, onClick: () => { g.color = c; colors.querySelectorAll("button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", String(x === b)); }); } }, "●"); b.style.setProperty("color", c); return b; }));
    const icons = h("div", { class: "chips", role: "radiogroup", "aria-label": t("Icon", "圖示") }, GROUP_ICONS.map((i) => { const b = h("button", { type: "button", role: "radio", class: `chip${g.icon === i ? " on" : ""}`, "aria-checked": String(g.icon === i), "aria-label": i, onClick: () => { g.icon = i; icons.querySelectorAll("button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", String(x === b)); }); } }, icon(i, "sm")); return b; }));
    return [
      h("h2", { class: "h2" }, existing ? t("Edit group", "編輯群組") : t("New group", "新群組")), name, colors, icons,
      h("div", { class: "actions" },
        existing ? h("button", { class: "btn d", onClick: () => { commit(deleteGroup(state, existing.id)); close(); } }, icon("delete", "sm"), t("Delete group", "刪除群組")) : null,
        h("button", { class: "btn o", onClick: () => close() }, t("Cancel", "取消")),
        h("button", { class: "btn f", onClick: () => {
          if (!name.value.trim()) return C.toast(t("Give the group a name.", "俾個群組一個名。"), "warn");
          if (existing) commit(decorateGroup(state, existing.id, { name: name.value, color: g.color, icon: g.icon }));
          else { const r = addGroup(state, name.value, g); commit(ids.length ? moveIntoGroup(r.state, ids, r.group.id) : r.state); }
          close();
        } }, t("Save", "儲存"))),
    ];
  }, { label: t("Group", "群組") });
}

// Close tabs containing / not containing text, with a preview that excludes pinned tabs.
export function closeByText() {
  const { h, icon, t } = C;
  let contains = true;
  C.openDialog((close) => {
    const input = h("input", { type: "search", class: "field", "data-search-id": "tabs-bulk", "aria-label": t("Text to look for", "要搵嘅文字"), placeholder: t("Text to look for in tab names", "喺分頁名稱搵嘅文字") });
    const preview = h("div", { class: "mar-preview", role: "status" });
    const go2 = h("button", { class: "btn d", disabled: true }, t("Close tabs", "關閉分頁"));
    let plan = null;
    const paint = () => {
      const { test, error } = testFor(input);
      plan = input.value.trim() === "" ? null : closeMatching(state, test, { contains, labelOf });
      fill(preview,
        !plan ? h("span", { class: "t2" }, error ? C.tt(error) : t("Type text to preview which tabs would close.", "輸入文字預覽邊啲分頁會關閉。"))
        : [h("div", { class: "t1" }, t(`${plan.targets.length} tab${plan.targets.length === 1 ? "" : "s"} would close`, `會關閉 ${plan.targets.length} 個分頁`)), h("div", { class: "chips" }, plan.targets.map((id) => h("span", { class: "chip" }, shown(id)))), plan.pinnedSkipped.length ? h("div", { class: "t2" }, icon("push_pin", "sm"), ` ${t("Pinned tabs are never closed:", "固定嘅分頁唔會關閉：")} ${plan.pinnedSkipped.map(shown).join(", ")}`) : null]);
      go2.disabled = !plan || !plan.targets.length;
    };
    const mode = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Match", "配對") }, [[true, t("Containing", "包含")], [false, t("Not containing", "唔包含")]].map(([v, label]) => h("button", { type: "button", role: "radio", class: contains === v ? "on" : "", "aria-checked": String(contains === v), onClick: (e) => { contains = v; mode.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b === e.currentTarget); b.setAttribute("aria-checked", String(b === e.currentTarget)); }); paint(); } }, label)));
    input.addEventListener("input", paint);
    go2.addEventListener("click", () => { const current = currentId(); commit(plan.apply()); close(); if (plan.targets.includes(current)) C.navigate(state.tabs[0]?.id ?? "overview"); });
    paint();
    return [h("h2", { class: "h2" }, t("Close tabs by text", "按文字關閉分頁")), mode, input, preview, h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close() }, t("Cancel", "取消")), go2)];
  }, { label: t("Close tabs by text", "按文字關閉分頁") });
}

// ---- hooks ----------------------------------------------------------------------------------------------------
function onRoute() {
  const id = C.state.route;
  if (id && dests.some((d) => d.id === id) && !state.tabs.some((t) => t.id === id)) { state = openTab(state, id); save(); }
  draw();
}

NAV.tabs = {
  catalog: () => C && openCatalog(),
  find: () => C && openFind(),
  closeCurrent: () => C && closeById(currentId()),
  reopen: () => { const id = state.closed.at(-1); if (id) go(id); else C?.toast(C.t("No closed tab to reopen.", "冇關咗嘅分頁可以重開。")); },
  state: () => state,
};

export default {
  id: "tabs",
  overlays: [
    {
      id: "tabs.strip",
      mount(ctx) {
        C = ctx;
        dests = destinations(ctx);
        state = reconcile(sanitize(kv.get(KEY, null)), dests);
        save();
        narrow = window.matchMedia?.("(max-width: 900px)") ?? null;
        strip = ctx.h("nav", { class: "mar-tabs", "aria-label": ctx.t("Workspace tabs", "工作區分頁") });
        document.querySelector(".shell .tabs")?.setAttribute("hidden", "");
        place();
        draw();
        const wrap = (name) => { const orig = history[name]; history[name] = function (...a) { const r = orig.apply(this, a); queueMicrotask(onRoute); return r; }; return () => { history[name] = orig; }; };
        const restore = [wrap("pushState"), wrap("replaceState")];
        const onPop = () => queueMicrotask(onRoute);
        window.addEventListener("popstate", onPop);
        const onNarrow = () => draw();
        narrow?.addEventListener?.("change", onNarrow);
        const stopCollect = ctx.bus.on("palette:collect", ({ add }) => {
          const { t } = ctx;
          add({ id: "tabs.open-every", icon: "tab_group", label: { en: "Open every tab", yue: "開啟所有分頁" }, keywords: "tabs reopen all", run: () => commit(openEvery(state, dests)) });
          add({ id: "tabs.new", icon: "add", label: { en: "New tab: every screen", yue: "新分頁：所有畫面" }, keywords: "tab catalogue", run: openCatalog });
          add({ id: "tabs.find", icon: "search", label: { en: "Find tabs", yue: "搵分頁" }, run: openFind });
          add({ id: "tabs.bulk", icon: "tab_close", label: { en: "Close tabs containing or not containing text", yue: "按文字關閉分頁" }, run: closeByText });
          for (const d of DOCKS) add({ id: `tabs.dock-${d}`, icon: "dock_to_left", label: { en: `Dock the tab strip: ${d}`, yue: `分頁列停靠：${{ left: "左", top: "頂", right: "右", bottom: "底" }[d]}` }, run: () => setDockEdge(d) });
          void t;
        });
        const stopContext = ctx.bus.on("context:collect", ({ target, add }) => {
          const tabNode = target.closest?.(".mar-tab");
          const groupNode = target.closest?.(".mar-gwrap > .mar-group");
          if (groupNode) {
            const g = state.groups.find((x) => x.id === groupNode.parentElement.dataset.group);
            if (g) { add({ id: "tab-group-edit", icon: "edit", label: { en: "Edit this group", yue: "編輯呢個群組" }, run: () => newGroupDialog([], g) }); add({ id: "tab-group-toggle", icon: "unfold_less", label: { en: "Collapse or expand this group", yue: "收埋或者展開呢個群組" }, run: () => commit(decorateGroup(state, g.id, { collapsed: !g.collapsed })) }); }
          }
          if (!tabNode) return;
          const id = tabNode.dataset.id;
          const tab = state.tabs.find((x) => x.id === id);
          if (!tab) return;
          add({ id: "tab-close", icon: "close", label: { en: "Close this tab", yue: "關閉呢個分頁" }, shortcutId: "tabs.close", run: () => closeById(id) });
          add({ id: "tab-pin", icon: tab.pinned ? "keep_off" : "push_pin", label: tab.pinned ? { en: "Unpin this tab", yue: "取消固定" } : { en: "Pin this tab", yue: "固定呢個分頁" }, run: () => commit(setPinned(state, id, !tab.pinned)) });
          add({ id: "tab-earlier", icon: "arrow_upward", label: { en: "Move this tab earlier", yue: "分頁前移" }, run: () => commit(shiftTab(state, id, -1)) });
          add({ id: "tab-later", icon: "arrow_downward", label: { en: "Move this tab later", yue: "分頁後移" }, run: () => commit(shiftTab(state, id, 1)) });
          add({ id: "tab-group", icon: "folder", label: { en: "Move into group…", yue: "加入群組…" }, run: () => groupDialog([id]) });
          add({ id: "tab-bulk", icon: "tab_close", label: { en: "Close tabs containing or not containing text…", yue: "按文字關閉分頁…" }, run: closeByText });
          add({ id: "tab-reopen", icon: "history", label: { en: "Reopen the last closed tab", yue: "重開上一個關咗嘅分頁" }, shortcutId: "tabs.reopen", run: () => NAV.tabs.reopen() });
        });
        return () => { restore.forEach((r) => r()); window.removeEventListener("popstate", onPop); narrow?.removeEventListener?.("change", onNarrow); stopCollect(); stopContext(); strip?.remove(); strip = null; document.querySelector(".shell .tabs")?.removeAttribute("hidden"); C = null; };
      },
    },
  ],
  settings: [
    {
      id: "tabs",
      icon: "tab",
      label: { en: "Workspace tabs", yue: "工作區分頁" },
      render(ctx) {
        const { h, icon, t } = ctx;
        const body = h("div", {});
        const paint = () => {
          const closed = state.closed;
          fill(body,
            h("div", { class: "setting" }, h("div", { class: "top" }, h("div", { class: "grow" }, h("div", { class: "t1" }, t("Where the tab strip sits", "分頁列位置")), h("div", { class: "t2" }, t("Left is the default. On a narrow screen the strip always runs along the top.", "預設係左邊。窄螢幕時分頁列永遠喺頂部。"))), h("div", { class: "seg", role: "radiogroup", "aria-label": t("Dock edge", "停靠邊緣") }, DOCKS.map((d) => h("button", { type: "button", role: "radio", "aria-checked": String(state.dock === d), class: state.dock === d ? "on" : "", onClick: () => { setDockEdge(d); paint(); } }, { left: t("Left", "左"), top: t("Top", "頂"), right: t("Right", "右"), bottom: t("Bottom", "底") }[d]))))),
            h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t1" }, t("Open every tab", "開啟所有分頁")), h("div", { class: "t2" }, t(`${closed.length} closed tab${closed.length === 1 ? "" : "s"} would open again.`, `${closed.length} 個關咗嘅分頁會重開。`))), h("button", { class: "btn t sm", disabled: !closed.length, onClick: () => { commit(openEvery(state, dests)); paint(); } }, icon("tab_group", "sm"), t("Open every tab", "開啟所有分頁"))),
            closed.length ? h("div", { class: "chips" }, closed.map((id) => h("button", { class: "chip", onClick: () => { go(id); paint(); } }, shown(id)))) : null,
            state.groups.map((g) => h("div", { class: "row" }, icon(g.icon, "sm"), h("div", { class: "grow t1" }, g.name), h("button", { class: "btn t sm", onClick: () => newGroupDialog([], g) }, icon("edit", "sm"), t("Edit", "編輯")))));
        };
        paint();
        return body;
      },
    },
  ],
};
