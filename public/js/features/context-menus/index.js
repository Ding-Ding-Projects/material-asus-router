// A context menu on every element. Right-click, the context-menu key,
// Shift+F10 or a long press opens a menu for what you pointed at. Every menu
// has a filter box with its own regex builder (Escape clears it, then closes
// the menu, and the number of matches is announced). A setting's menu carries
// its live control, which operates the real setting in place without closing.
// Each item shows its real shortcut, read from the shortcut table.
import { ALL_APPEARANCE_CLASSES, APPEARANCE, COMMON_ITEMS, appearanceClasses, shortcutText, targetKind } from "./menu-model.js";

const NAV = (globalThis.marNav ??= {});
const kv = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const def = NAV.defineShortcut ?? ((d) => (NAV.shortcutQueue ??= []).push(d));

const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
let C = null;
let lastTarget = null;
let current = null; // the open menu

// ---- element keys, locks and appearance -------------------------------------------
function keyOf(el) {
  const withId = el.closest?.("[id]");
  if (withId && withId.id && !/^(app|content)$/.test(withId.id)) return `id:${withId.id}`;
  const parts = [];
  for (let n = el; n && n.id !== "content" && parts.length < 8; n = n.parentElement) {
    const same = [...(n.parentElement?.children ?? [])].filter((x) => x.tagName === n.tagName);
    parts.unshift(`${n.tagName.toLowerCase()}${same.length > 1 ? `:${same.indexOf(n)}` : ""}`);
  }
  return `path:${C.state.route}:${parts.join(">")}`;
}
function resolve(key) {
  if (key.startsWith("id:")) return document.getElementById(key.slice(3));
  const [, route, path] = /^path:([^:]+):(.*)$/.exec(key) ?? [];
  if (route !== C.state.route) return null;
  let n = document.getElementById("content");
  for (const part of path.split(">")) {
    const [tag, idx] = part.split(":");
    const kids = [...(n?.children ?? [])].filter((x) => x.tagName.toLowerCase() === tag);
    n = kids[Number(idx ?? 0)] ?? null;
    if (!n) return null;
  }
  return n;
}
const locks = () => kv.get("mar.nav.locks", []);
const looks = () => kv.get("mar.nav.looks", {});

function applyOne(el, key) {
  const locked = locks().some((l) => l.key === key);
  el.classList.toggle("nav-locked", locked);
  if (locked) el.setAttribute("aria-disabled", "true"); else if (el.getAttribute("aria-disabled") === "true" && el.dataset.navLocked) el.removeAttribute("aria-disabled");
  if (locked) el.dataset.navLocked = "1"; else delete el.dataset.navLocked;
  for (const c of el.querySelectorAll("input, select, textarea, button")) {
    if (locked) { if (!c.disabled) { c.disabled = true; c.dataset.navWas = "1"; } }
    else if (c.dataset.navWas) { c.disabled = false; delete c.dataset.navWas; }
  }
  el.classList.remove(...ALL_APPEARANCE_CLASSES);
  el.classList.add(...appearanceClasses(looks()[key]));
}
function applyAll() {
  const keys = new Set([...locks().map((l) => l.key), ...Object.keys(looks())]);
  for (const key of keys) {
    const el = resolve(key);
    if (el) applyOne(el, key);
  }
}

// ---- menu items ------------------------------------------------------------------------
function describe(el) {
  const kind = targetKind(el);
  const items = [];
  const { t } = C;
  const selection = String(getSelection?.() ?? "");
  if (selection) items.push({ id: "copy-selection", icon: "content_copy", label: { en: "Copy the selected text", yue: "複製揀咗嘅文字" }, run: () => copy(selection) });
  if (kind === "text-field") {
    const f = el.closest("input, textarea");
    items.push({ id: "copy-field", icon: "content_copy", label: { en: "Copy this field", yue: "複製呢個欄位" }, run: () => copy(f.value) });
    if (!f.readOnly && !f.disabled) {
      items.push({ id: "paste", icon: "content_paste", label: { en: "Paste", yue: "貼上" }, run: async () => { try { f.value += await navigator.clipboard.readText(); f.dispatchEvent(new Event("input", { bubbles: true })); } catch { C.toast(t("Paste is not available here.", "呢度用唔到貼上。"), "bad"); } } });
      items.push({ id: "clear", icon: "backspace", label: { en: "Clear this field", yue: "清空呢個欄位" }, run: () => { f.value = ""; f.dispatchEvent(new Event("input", { bubbles: true })); f.focus(); } });
    }
    items.push({ id: "select-all", icon: "select_all", label: { en: "Select all", yue: "全選" }, run: () => f.select() });
  }
  if (kind === "setting") {
    const row = el.closest(".setting[id^='s-']");
    const id = row.id.slice(2);
    const entry = C.state.catalog?.entries?.find((e) => e.id === id);
    if (entry) {
      const live = liveControl(row, entry);
      if (live) items.push(live);
      items.push({ id: "copy-key", icon: "key", label: { en: `Copy the router setting name (${entry.key})`, yue: `複製路由器設定名稱（${entry.key}）` }, run: () => copy(entry.key) });
      if (C.state.canWrite && C.dock.has(id)) items.push({ id: "undo-edit", icon: "undo", label: { en: "Undo the edit waiting for this setting", yue: "取消呢項設定等緊嘅改動" }, run: () => row.querySelector(".btn.t.sm:not([hidden])")?.click() });
      items.push({ id: "explain", icon: "info", label: { en: "Explain this setting", yue: "解釋呢項設定" }, run: () => (row.querySelector(".info.nt-info") ?? row.querySelector(".info"))?.click() });
    }
  }
  if (kind === "table-row") {
    const tr = el.closest("tr");
    items.push({ id: "copy-row", icon: "content_copy", label: { en: "Copy this row", yue: "複製呢行" }, run: () => copy([...tr.cells].map((c) => c.innerText.trim()).join("\t")) });
  }
  if (kind === "card" || kind === "page") {
    const card = el.closest(".card");
    const heading = card?.querySelector("h2, .h2")?.textContent;
    if (heading) items.push({ id: "copy-heading", icon: "content_copy", label: { en: "Copy this section's title", yue: "複製呢個部分嘅標題" }, run: () => copy(heading) });
  }
  // Features add items for their own elements (a tab, a notification).
  C.bus.emit("context:collect", { target: el, kind, add: (item) => items.push(item) });
  // The common items.
  const key = keyOf(el);
  const locked = locks().some((l) => l.key === key);
  for (const base of COMMON_ITEMS) {
    if (base.id === "palette") items.push({ ...base, run: () => NAV.shortcuts?.find("palette.open")?.run(C) });
    else if (base.id === "notifications") items.push({ ...base, run: () => C.navigate("notifications") });
    else if (base.id === "appearance") items.push({ ...base, run: () => editAppearance(el) });
    else if (base.id === "lock") items.push({ ...base, label: locked ? { en: "Unlock this element", yue: "解鎖呢個元素" } : base.label, icon: locked ? "lock_open" : "lock", run: () => toggleLock(el) });
  }
  return items;
}

function copy(text) {
  navigator.clipboard?.writeText(text).then(() => C.toast(C.t("Copied.", "已複製。")), () => C.toast(C.t("Copy is not available here.", "呢度用唔到複製。"), "bad"));
}

// A live control for a setting. It operates the setting's own control, so the
// menu, the row and the pending changes can never disagree.
function liveControl(row, entry) {
  const { h, tt } = C;
  if (row.querySelector(".sw") && entry.control === "switch") {
    const real = row.querySelector(".sw");
    const mirror = h("button", { type: "button", class: "sw", role: "switch", "aria-checked": real.getAttribute("aria-checked"), "aria-label": tt(entry.label), disabled: real.disabled, onClick: () => { real.click(); mirror.setAttribute("aria-checked", real.getAttribute("aria-checked")); } }, h("i"));
    return { id: "live-switch", icon: "toggle_on", label: entry.label, live: () => mirror, keepOpen: true };
  }
  const radios = [...row.querySelectorAll(".seg [role=radio]")];
  if (radios.length) {
    const wrap = h("div", { class: "seg", role: "radiogroup", "aria-label": tt(entry.label) }, radios.map((r, i) => h("button", { type: "button", role: "radio", class: r.classList.contains("on") ? "on" : "", "aria-checked": r.getAttribute("aria-checked"), disabled: r.disabled, onClick: () => { r.click(); wrap.querySelectorAll("button").forEach((b, j) => { const on = radios[j].classList.contains("on"); b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); }); } }, r.textContent)));
    return { id: "live-segmented", icon: "tune", label: entry.label, live: () => wrap, keepOpen: true };
  }
  const range = row.querySelector("input[type=range]");
  if (range) {
    const out = h("output", {}, range.value);
    const mirror = h("input", { type: "range", min: range.min, max: range.max, step: range.step, value: range.value, "aria-label": tt(entry.label), disabled: range.disabled, onInput: (e) => { range.value = e.target.value; range.dispatchEvent(new Event("input", { bubbles: true })); out.textContent = e.target.value; } });
    return { id: "live-slider", icon: "linear_scale", label: entry.label, live: () => h("div", { class: "slider" }, mirror, out), keepOpen: true };
  }
  return null;
}

function toggleLock(el) {
  const key = keyOf(el);
  const list = locks();
  const was = list.some((l) => l.key === key);
  const label = (el.closest(".card")?.querySelector("h2, .h2") ?? el.closest("[id]") ?? el).textContent?.trim().slice(0, 40) || key;
  kv.set("mar.nav.locks", was ? list.filter((l) => l.key !== key) : [...list, { key, label }]);
  applyOne(el, key);
  C.toast(was ? C.t("Unlocked.", "已解鎖。") : C.t("Locked. Controls inside cannot be changed until you unlock it.", "已鎖住。入面嘅控制項要解鎖先改到。"));
}

function editAppearance(el) {
  const key = keyOf(el);
  const { h, icon, t, tt } = C;
  const mine = { tint: "none", size: "normal", density: "normal", ...(looks()[key] ?? {}) };
  C.openDialog((close) => {
    const seg = (name, field) => h("div", { class: "seg", role: "radiogroup", "aria-label": name }, APPEARANCE[field].map(([v, label]) => h("button", { type: "button", role: "radio", class: mine[field] === v ? "on" : "", "aria-checked": String(mine[field] === v), onClick: () => { mine[field] = v; save(); close(); editAppearance(el); } }, tt(label))));
    const save = () => { const all = looks(); if (appearanceClasses(mine).length) all[key] = mine; else delete all[key]; kv.set("mar.nav.looks", all); applyOne(el, key); };
    return [
      h("h2", { class: "h2" }, t("Edit appearance", "編輯外觀")),
      h("p", { class: "muted" }, t("Changes only this element, in this browser. Reset puts it back.", "只改呢個元素，只係呢個瀏覽器。重設就會還原。")),
      seg(t("Tint", "底色"), "tint"), seg(t("Text size", "文字大小"), "size"), seg(t("Spacing", "間距"), "density"),
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => { mine.tint = mine.size = mine.density = "normal"; save(); close(); } }, icon("restart_alt", "sm"), t("Reset", "重設")), h("button", { class: "btn f", onClick: () => close() }, t("Done", "完成"))),
    ];
  }, { label: t("Edit appearance", "編輯外觀") });
}

// ---- opening and drawing the menu ---------------------------------------------------------
function closeMenu(refocus = true) {
  if (!current) return;
  const { menu, origin } = current;
  menu.remove();
  current = null;
  if (refocus && origin?.isConnected) origin.focus?.({ preventScroll: true });
}

function openMenu(x, y, target, origin) {
  closeMenu(false);
  const { h, icon, t, tt } = C;
  const items = describe(target);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform ?? "");
  const filter = h("input", { type: "search", class: "field", "data-search-id": "context-menu", "aria-label": t("Filter this menu", "篩選呢個選單"), placeholder: t("Filter this menu", "篩選呢個選單") });
  const list = h("div", { class: "cm-list", role: "none" });
  const count = h("div", { class: "sr", role: "status" });
  const menu = h("div", { class: "cm", role: "menu", "aria-label": t("Context menu", "右鍵選單") }, filter, list, count);
  const apply = () => {
    const rx = NAV.regex?.stateOf(filter);
    const m = rx?.mode === "regex" ? NAV.regex.matcherFor(filter) : null;
    const q = filter.value.trim().toLowerCase();
    const test = m ? m.test : (text) => !q || text.toLowerCase().includes(q);
    const shown = items.filter((i) => test(`${i.label.en}
${i.label.yue}`));
    list.replaceChildren(...shown.map((item) => {
      const keys = shortcutText(item, NAV.shortcuts, mac);
      const shortcutId = item.shortcutId;
      const reg = shortcutId ? NAV.shortcuts?.find(shortcutId) : null;
      if (item.live)
        return h("div", { class: "cm-item cm-live", role: "group", "aria-label": tt(item.label) }, icon(item.icon, "sm"), h("span", { class: "grow" }, tt(item.label)), item.live());
      return h("button", { type: "button", role: "menuitem", class: "cm-item", "aria-keyshortcuts": reg ? reg.keys.replace("Mod", "Control") : undefined, onClick: () => { const run = item.run; closeMenu(false); run?.(); } },
        icon(item.icon, "sm"), h("span", { class: "grow" }, tt(item.label)), keys ? h("span", { class: "cm-keys", "aria-hidden": "true" }, keys) : null);
    }));
    if (!shown.length) list.append(h("div", { class: "empty" }, t("Nothing in this menu matches.", "呢個選單冇嘢配對。")));
    count.textContent = m?.error ? tt(m.error) : t(`${shown.length} item${shown.length === 1 ? "" : "s"}`, `${shown.length} 項`);
  };
  filter.addEventListener("input", apply);
  menu.addEventListener("keydown", (e) => {
    const rows = [...menu.querySelectorAll("[role=menuitem], .cm-live button, .cm-live input")];
    const i = rows.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (filter.value) { filter.value = ""; filter.dispatchEvent(new Event("input")); } else closeMenu(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); (rows[i + 1] ?? rows[0])?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); (rows[i - 1] ?? rows.at(-1))?.focus(); }
    else if (e.key === "Tab") { e.preventDefault(); closeMenu(); }
  });
  const host = document.querySelector("dialog[open]") ?? document.body;
  host.append(menu);
  apply();
  const w = menu.offsetWidth;
  const hgt = menu.offsetHeight;
  menu.style.setProperty("left", `${Math.max(8, Math.min(x, window.innerWidth - w - 8))}px`);
  menu.style.setProperty("top", `${Math.max(8, Math.min(y, window.innerHeight - hgt - 8))}px`);
  current = { menu, origin };
  filter.focus();
}

function onContext(e) {
  if (!C.state.me) return;
  if (e.target.closest?.(".cm, .rx-panel")) return;
  e.preventDefault();
  lastTarget = e.target;
  const r = e.clientX === 0 && e.clientY === 0 ? e.target.getBoundingClientRect() : null;
  openMenu(r ? r.left + 12 : e.clientX, r ? r.bottom : e.clientY, e.target, document.activeElement);
}

let press = null;
function onDown(e) {
  if (current && !e.target.closest?.(".cm")) closeMenu(false);
  if (e.pointerType !== "touch") return;
  const { clientX: x, clientY: y, target } = e;
  press = setTimeout(() => { lastTarget = target; openMenu(x, y, target, document.activeElement); }, 550);
}
const onUp = () => clearTimeout(press);

const focusTarget = () => document.activeElement && document.activeElement !== document.body ? document.activeElement : lastTarget ?? document.getElementById("content");

def({ id: "context.open", keys: "Shift+F10", label: { en: "Open the context menu for the focused element", yue: "打開焦點元素嘅右鍵選單" }, run: () => { const el = focusTarget(); const r = el.getBoundingClientRect(); openMenu(r.left + 12, r.bottom, el, el); } });
def({ id: "context.open-key", keys: "ContextMenu", alias: true, label: { en: "Open the context menu (menu key)", yue: "打開右鍵選單（選單鍵）" }, run: () => { const el = focusTarget(); const r = el.getBoundingClientRect(); openMenu(r.left + 12, r.bottom, el, el); } });
def({ id: "element.lock", keys: "Alt+Shift+L", label: { en: "Lock or unlock the focused element", yue: "鎖住或者解鎖焦點元素" }, run: () => toggleLock(focusTarget()) });
def({ id: "element.appearance", keys: "Alt+Shift+E", label: { en: "Edit appearance of the focused element", yue: "編輯焦點元素嘅外觀" }, run: () => editAppearance(focusTarget()) });

export default {
  id: "context-menus",
  overlays: [
    {
      id: "context-menus.listen",
      mount(ctx) {
        C = ctx;
        document.addEventListener("contextmenu", onContext, true);
        document.addEventListener("pointerdown", onDown, true);
        document.addEventListener("pointerup", onUp, true);
        document.addEventListener("pointercancel", onUp, true);
        const content = document.getElementById("content");
        let timer = 0;
        const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(applyAll, 120); });
        if (content) observer.observe(content, { childList: true, subtree: true });
        applyAll();
        return () => { document.removeEventListener("contextmenu", onContext, true); document.removeEventListener("pointerdown", onDown, true); document.removeEventListener("pointerup", onUp, true); document.removeEventListener("pointercancel", onUp, true); observer.disconnect(); closeMenu(false); };
      },
    },
  ],
  settings: [
    {
      id: "context-menus",
      icon: "menu_open",
      label: { en: "Locked elements and appearance", yue: "鎖住嘅元素同外觀" },
      render(ctx) {
        const { h, icon, t } = ctx;
        const body = h("div", {});
        const draw = () => {
          const L = locks();
          const A = Object.keys(looks());
          fill(body,
            L.length ? L.map((l) => h("div", { class: "row" }, icon("lock", "sm"), h("div", { class: "grow" }, h("div", { class: "t1" }, l.label), h("div", { class: "t2" }, l.key)), h("button", { class: "btn t sm", onClick: () => { kv.set("mar.nav.locks", locks().filter((x) => x.key !== l.key)); const el = resolve(l.key); if (el) applyOne(el, l.key); draw(); } }, icon("lock_open", "sm"), t("Unlock", "解鎖")))) : h("div", { class: "t2" }, t("No element is locked. Right-click anything and choose Lock this element.", "冇鎖住任何元素。右鍵撳任何嘢，揀「鎖住呢個元素」。")),
            A.length ? h("div", { class: "row" }, h("div", { class: "grow t2" }, t(`${A.length} element${A.length === 1 ? "" : "s"} with a custom look`, `${A.length} 個元素有自訂外觀`)), h("button", { class: "btn o sm", onClick: () => { for (const k of A) { const el = resolve(k); kv.set("mar.nav.looks", {}); if (el) applyOne(el, k); } draw(); } }, icon("restart_alt", "sm"), t("Reset all appearance", "重設所有外觀"))) : null);
        };
        draw();
        return body;
      },
    },
  ],
};
