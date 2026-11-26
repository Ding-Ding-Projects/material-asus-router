// App shell: boot, sign-in flow, navigation rail, workspace tabs, search,
// notifications, language and theme switches.
import { $, api, auth, bus, clear, getLang, h, icon, openDialog, setLang, t, tt, toast } from "./core.js";
import { app, dock, renderDock } from "./dock.js";
import { connectScreen, langSwitch, setupScreen, signInScreen } from "./screens/auth.js";
import { domainInfo } from "./screens/common.js";
import { settingsScreen } from "./screens/common.js";
import { devices } from "./screens/devices.js";
import { overview } from "./screens/overview.js";
import { forwarding, lan, parental } from "./screens/lists.js";
import { jobs, logs, tools } from "./screens/tools.js";
import { advanced } from "./screens/advanced.js";
import { history } from "./screens/history.js";
import { aimesh, backup, firmware, maintenance, merlin, system, usb } from "./screens/system.js";
import { featureState, loadFeatures, mountOverlays } from "./features/registry.js";
import { openPalette } from "./palette.js";
import { installApiGuard, loadSafety, mountBadges, mountBar } from "./features/change-safety/safety.js";

const root = $("#app");
const generic = (id) => (el) => settingsScreen(el, id);
const SCREENS = { overview, devices, wifi: generic("wifi"), internet: generic("internet"), lan, forwarding, firewall: generic("firewall"), parental, qos: generic("qos"), vpn: generic("vpn"), aimesh, usb, logs, tools, jobs, backup, firmware, system, maintenance, merlin, advanced, history };
const CORE_SCREENS = new Set(Object.keys(SCREENS));
const SECTIONS = [
  [["Monitor", "監察"], ["overview", "devices", "logs", "history"]],
  [["Network", "網絡"], ["wifi", "internet", "lan", "forwarding", "firewall", "parental", "qos", "vpn", "aimesh"]],
  [["Router", "路由器"], ["usb", "tools", "jobs", "backup", "firmware", "system", "maintenance", "merlin", "advanced"]],
];

// The rail: the stock sections, plus any screen a feature or the server adds
// (placed under its own group, a new group when it names one).
const pairOf = (group) => (!group ? ["Features", "功能"] : typeof group === "string" ? [group, group] : [group.en, group.yue]);
function railSections() {
  const sections = SECTIONS.map(([label, ids]) => [label, [...ids]]);
  const known = new Set(SECTIONS.flatMap(([, ids]) => ids));
  const place = (id, group) => {
    const [en, yue] = pairOf(group);
    let section = sections.find(([label]) => label[0] === en);
    if (!section) sections.push((section = [[en, yue], []]));
    section[1].push(id);
  };
  for (const d of app.catalog.domains) if (!known.has(d.id)) place(d.id, d.group);
  for (const [id, screen] of featureState.screens) if (!known.has(id) && !app.catalog.domains.some((d) => d.id === id)) place(id, screen.group);
  return sections;
}

// Every screen, feature command and feature settings section, for Ctrl+K.
function paletteItems() {
  const items = [];
  for (const [[en, yue], ids] of railSections())
    for (const id of ids) {
      const d = domainInfo(id);
      items.push({ id, icon: d.icon, label: d.label, kind: { en, yue }, run: () => navigate(id) });
    }
  items.push({ id: "theme", icon: "contrast", label: { en: "Switch theme", yue: "轉主題" }, kind: { en: "Command", yue: "指令" }, keywords: "dark light", run: () => applyTheme(THEMES[(THEMES.indexOf(theme()) + 1) % 3]) });
  for (const c of featureState.commands) items.push({ id: c.id, icon: c.icon, label: c.label, kind: { en: "Command", yue: "指令" }, keywords: c.keywords, run: () => c.run(featureState.ctx) });
  for (const section of featureState.settings) items.push({ id: `settings-${section.id}`, icon: section.icon ?? "tune", label: section.label, kind: { en: "Setting", yue: "設定" }, run: () => { app.focusSection = section.id; navigate("feature-settings"); } });
  return items;
}

// ---- theme ------------------------------------------------------------------

const THEMES = ["auto", "light", "dark"];
function theme() {
  try {
    return localStorage.getItem("mar.theme") || "auto";
  } catch {
    return "auto";
  }
}
function applyTheme(value = theme()) {
  if (value === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;
  try {
    localStorage.setItem("mar.theme", value);
  } catch {}
}

// ---- boot -------------------------------------------------------------------

async function boot() {
  applyTheme();
  let session;
  try {
    session = await api.get("/api/session");
  } catch (error) {
    return void root.replaceChildren(h("div", { class: "center" }, h("div", { class: "card" }, h("h1", { class: "disp" }, t("Cannot reach the app", "連唔到程式")), h("p", { class: "lede" }, error.message), h("button", { class: "btn f", onClick: boot }, t("Try again", "再試")))));
  }
  auth.csrf = session.csrf ?? "";
  // The sign-in and connect screens count as started; the full app sets this again once its shell is up.
  window.__marStarted = !(session.signedIn && session.router?.configured);
  if (session.setup === "needed") return setupScreen(root, async () => (await boot()));
  if (!session.signedIn) return signInScreen(root, boot);
  Object.assign(app, { me: session.user, canWrite: session.canWrite, router: session.router });
  if (!session.router.configured) return connectScreen(root, boot, { owner: session.user.role === "owner", setup: true });
  try {
    await enterApp();
  } catch (error) {
    // Never leave a blank page: show what failed and the ways out.
    console.error(error);
    root.replaceChildren();
    window.__marBootFailed?.(error);
  }
}

// A visible loading card, so a slow link never looks like a dead button.
function loadingScreen(step, detail = "") {
  const bar = h("div", { class: "load-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100" });
  const card = h("section", { class: "card load-card", "aria-busy": "true" },
    h("div", { class: "load-spin", "aria-hidden": "true" }),
    h("h1", { class: "disp" }, t("Opening your router", "打開緊你嘅路由器")),
    h("p", { class: "lede" }, step),
    h("p", { class: "load-detail" }, detail),
    bar);
  root.replaceChildren(h("div", { class: "center" }, card));
  return {
    step: (text) => { card.querySelector(".lede").textContent = text; },
    progress: (done, total) => {
      const pct = total ? Math.round((done / total) * 100) : 0;
      bar.style.setProperty("--pct", `${pct}%`);
      bar.setAttribute("aria-valuenow", String(pct));
      card.querySelector(".load-detail").textContent = done >= total ? t(`Features loaded: ${total}`, `功能已載入：${total}`) : t(`Loading features: ${done} of ${total}`, `載入功能：${done} / ${total}`);
    },
  };
}

async function enterApp() {
  window.__marArmGuard?.();
  const loading = loadingScreen(t("Reading the router's settings...", "讀緊路由器設定..."));
  try {
    app.catalog = await api.get("/api/catalog");
  } catch (error) {
    if (error.code === "HOST_KEY_CHANGED" || error.code === "HOST_KEY_UNKNOWN")
      return connectScreen(root, boot, { owner: app.me.role === "owner", warning: error.message });
    return root.replaceChildren(h("div", { class: "center" }, h("div", { class: "panel" }, h("div", { class: "langbar" }, langSwitch()), h("section", { class: "card bad" },
      h("h1", { class: "disp" }, t("Cannot reach the router", "連唔到路由器")), h("p", { class: "lede" }, error.message),
      h("div", { class: "actions" }, app.me.role === "owner" ? h("button", { class: "btn o", onClick: () => connectScreen(root, boot, { owner: true }) }, t("Change router", "更換路由器")) : null, h("button", { class: "btn f", onClick: boot }, icon("refresh", "sm"), t("Try again", "再試")))))));
  }
  installApiGuard();
  await loadSafety(app.me);
  loading.step(t("Loading the app's features...", "載入緊程式功能..."));
  await loadFeatures({ navigate, reserved: CORE_SCREENS, onProgress: loading.progress });
  for (const d of app.catalog.domains) if (!SCREENS[d.id]) SCREENS[d.id] = generic(d.id);
  for (const [id, screen] of featureState.screens) SCREENS[id] = screen.render;
  buildShell();
  navigate(location.hash.replace(/^#\//, "") || "overview", { replace: true });
  window.__marStarted = true;
  try {
    if (sessionStorage.getItem("mar.boot.cleared")) {
      sessionStorage.removeItem("mar.boot.cleared");
      toast(t("Saved settings on this browser were cleared. Your sign-in and the router were not touched.", "已清除呢個瀏覽器儲存嘅設定。你嘅登入同路由器都冇改過。"));
    }
  } catch {}
}

// ---- shell ------------------------------------------------------------------

let content;
let cleanup = null;
let token = 0;
let tabs = [];

function loadTabs() {
  try {
    tabs = JSON.parse(localStorage.getItem("mar.tabs") || "[]").filter((id) => SCREENS[id]);
  } catch {
    tabs = [];
  }
  if (!tabs.length) tabs = ["overview", "devices"];
}
const saveTabs = () => {
  try {
    localStorage.setItem("mar.tabs", JSON.stringify(tabs));
  } catch {}
};

function buildShell() {
  // A rebuilt shell (after signing in again, switching routers or trying again) must not leave the
  // previous one's window-wide listeners behind, or a dropped file would be handled twice.
  shell.dispose();
  shell.dispose = () => {};
  loadTabs();
  const rail = h("nav", { class: "rail", "aria-label": t("Sections", "版面") },
    h("div", { class: "brandrow" }, h("div", { class: "logo" }, icon("router", "lg")), h("div", { class: "brand" }, "Material Asus Router", h("small", {}, `${app.catalog.info.model} · ${app.catalog.info.merlin ? "Merlin" : t("Stock firmware", "原廠韌體")}`))),
    railSections().map(([[en, yue], ids]) => [
      h("div", { class: "navsec k" }, t(en, yue)),
      ids.map((id) => {
        const d = domainInfo(id);
        return h("a", { class: `navi ${d.supported === false ? "off" : ""}`, href: `#/${id}`, "data-id": id, onClick: (e) => { e.preventDefault(); navigate(id); } }, icon(d.icon), h("span", {}, tt(d.label)));
      }),
    ]));
  const tabBar = h("div", { class: "tabs", role: "tablist", "aria-label": t("Open screens", "已開啟嘅畫面") });
  const results = h("div", { class: "results", hidden: true, role: "listbox" });
  const search = h("input", { type: "search", placeholder: t("Search settings and screens", "搜尋設定同畫面"), "aria-label": t("Search settings and screens", "搜尋設定同畫面"), autocomplete: "off", onInput: () => showResults(search, results), onKeydown: (e) => { if (e.key === "Escape") { search.value = ""; results.hidden = true; } if (e.key === "Enter") results.querySelector("button")?.click(); } });
  const safetyHost = h("div", { class: "safety-bar" });
  const bell = h("button", { class: "icb", "aria-label": t("Notifications", "通知"), onClick: showNotices }, icon("notifications"), h("span", { class: "dotb", hidden: true }));
  const bar = h("div", { class: "bar" },
    h("label", { class: "search" }, icon("search"), search),
    safetyHost,
    bell,
    h("button", { class: "icb", "aria-label": t("Command palette (Ctrl+K)", "指令面板（Ctrl+K）"), title: t("Command palette (Ctrl+K)", "指令面板（Ctrl+K）"), onClick: () => openPalette(paletteItems()) }, icon("bolt")),
    featureState.toolbar.map((b) => h("button", { class: "icb", "aria-label": tt(b.label), title: tt(b.label), onClick: () => b.onClick(featureState.ctx) }, icon(b.icon))),
    h("div", { class: "seg", role: "radiogroup", "aria-label": t("Language", "語言") }, [["en", "EN"], ["yue", "粵"], ["both", "EN+粵"]].map(([id, label]) => h("button", { role: "radio", "aria-checked": String(getLang() === id), class: getLang() === id ? "on" : "", onClick: () => setLang(id) }, label))),
    h("button", { class: "icb", "aria-label": t("Theme", "主題"), title: t("Theme", "主題"), onClick: () => applyTheme(THEMES[(THEMES.indexOf(theme()) + 1) % 3]) }, icon("contrast")),
    h("button", { class: "icb", "aria-label": t("Sign out", "登出"), title: `${app.me.name} · ${app.me.role}`, onClick: signOut }, h("span", { class: "avatar" }, app.me.name.slice(0, 1).toUpperCase())),
    results);
  content = h("main", { id: "content" });
  const dockEl = h("div", { class: "dock", hidden: true, role: "region", "aria-label": t("Changes waiting", "等緊嘅改動") });
  root.replaceChildren(h("div", { class: "shell" }, rail, h("div", { class: "main" }, tabBar, bar, content)), dockEl);
  const drawTabs = () => {
    clear(tabBar).append(...tabs.map((id) => h("div", { class: `tabcell ${id === app.route ? "on" : ""}`, role: "presentation" },
      h("button", { class: "tab", role: "tab", "aria-selected": String(id === app.route), onClick: () => navigate(id) }, icon(domainInfo(id).icon, "sm"), tt(domainInfo(id).label)),
      tabs.length > 1 ? h("button", { class: "x", "aria-label": `${t("Close", "關閉")} ${tt(domainInfo(id).label)}`, onClick: () => closeTab(id) }, icon("close", "sm")) : null)),
      h("button", { class: "tab new", "aria-label": t("Open another screen", "開另一個畫面"), onClick: openMenu }, icon("add")));
    rail.querySelectorAll(".navi").forEach((a) => { a.classList.toggle("on", a.dataset.id === app.route); a.setAttribute("aria-current", a.dataset.id === app.route ? "page" : "false"); });
  };
  const drawBell = () => { const dot = bell.querySelector(".dotb"); dot.hidden = app.unseen === 0; dot.textContent = String(app.unseen); };
  shell.drawTabs = drawTabs;
  drawTabs();
  drawBell();
  renderDock(dockEl);
  const offs = [bus.on("dock", () => renderDock(dockEl)), bus.on("notices", drawBell), bus.on("lang", () => queueMicrotask(() => { shell.dispose(); buildShell(); navigate(app.route, { replace: true }); })), bus.on("changed", () => api.get("/api/catalog").then((c) => { app.catalog = c; if (app.route !== "overview") navigate(app.route, { replace: true, keepScroll: true }); }).catch(() => {}))];
  const stopOverlays = mountOverlays();
  const stopSafety = mountBar(safetyHost, { onOpenHistory: (id) => navigate(id) });
  const stopBadges = mountBadges(() => app.catalog.entries);
  shell.dispose = () => { offs.forEach((f) => f()); stopOverlays(); stopSafety(); stopBadges(); };
  document.addEventListener("click", (e) => { if (!results.contains(e.target) && e.target !== search) results.hidden = true; }, { capture: true });
}

const shell = { drawTabs() {}, dispose() {} };

function closeTab(id) {
  tabs = tabs.filter((x) => x !== id);
  saveTabs();
  if (app.route === id) navigate(tabs[0]);
  else shell.drawTabs();
}

function openMenu() {
  openDialog((close) => [
    h("h2", { class: "h2" }, t("Open a screen", "開啟畫面")),
    h("div", { class: "grid" }, app.catalog.domains.map((d) => h("button", { class: "btn t", onClick: () => { close(); navigate(d.id); } }, icon(d.icon, "sm"), tt(d.label)))),
    h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close() }, t("Close", "關閉"))),
  ]);
}

function showNotices() {
  app.unseen = 0;
  bus.emit("notices");
  openDialog((close) => [
    h("h2", { class: "h2" }, t("Notifications", "通知")),
    app.notices.length ? app.notices.map((n) => h("div", { class: "row" }, icon(n.kind === "good" ? "check_circle" : "info"), h("div", { class: "grow" }, n.text), h("span", { class: "muted" }, n.at.toLocaleTimeString()))) : h("div", { class: "empty" }, icon("notifications_off", "lg"), t("Nothing new.", "冇新通知。")),
    h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close() }, t("Close", "關閉"))),
  ]);
}

function showResults(input, box) {
  const q = input.value.trim().toLowerCase();
  clear(box);
  if (!q) return void (box.hidden = true);
  const screens = [...app.catalog.domains, ...Object.values(app.featureScreens ?? {}).filter((f) => !app.catalog.domains.some((d) => d.id === f.id))];
  const doms = screens.filter((d) => `${d.label.en} ${d.label.yue} ${d.id}`.toLowerCase().includes(q)).slice(0, 4);
  const ents = app.catalog.entries.filter((e) => `${e.label.en} ${e.label.yue} ${e.key} ${e.help.en}`.toLowerCase().includes(q)).slice(0, 10);
  const go = (domain, entry) => () => { input.value = ""; box.hidden = true; app.focusEntry = entry; navigate(domain); };
  box.append(
    ...doms.map((d) => h("button", { role: "option", onClick: go(d.id) }, icon(d.icon, "sm"), tt(d.label))),
    ...ents.map((e) => h("button", { role: "option", onClick: go(e.domain, e.id) }, icon("tune", "sm"), h("span", {}, tt(e.label), h("span", { class: "t2" }, `  ${tt(domainInfo(e.domain).label)}${e.groupLabel ? ` · ${tt(e.groupLabel)}` : ""}`)))),
  );
  if (!box.children.length) box.append(h("div", { class: "empty" }, t("Nothing found.", "搵唔到。")));
  box.hidden = false;
}

async function signOut() {
  try {
    await api.post("/api/logout");
  } catch {}
  auth.csrf = "";
  dock.clear();
  shell.dispose();
  app.me = null;
  content = null;
  boot();
}

// ---- navigation ---------------------------------------------------------------

export async function navigate(id, { replace = false, keepScroll = false } = {}) {
  const scroll = window.scrollY;
  if (!SCREENS[id]) id = "overview";
  app.route = id;
  if (!tabs.includes(id)) tabs.push(id);
  saveTabs();
  const hash = `#/${id}`;
  if (location.hash !== hash) history_(hash, replace);
  shell.drawTabs();
  const mine = ++token;
  cleanup?.();
  cleanup = null;
  clear(content).append(h("div", { class: "page" }, h("div", { class: "empty" }, h("div", { class: "spin" }), t("Loading…", "載入緊…"))));
  const holder = h("div", {});
  try {
    const result = await SCREENS[id](holder);
    if (mine !== token) return void (typeof result === "function" && result());
    cleanup = typeof result === "function" ? result : null;
    clear(content).append(holder);
    window.scrollTo(0, keepScroll ? scroll : 0);
    if (app.focusSection) {
      const el = document.getElementById(`fs-${app.focusSection}`);
      app.focusSection = null;
      el?.scrollIntoView({ block: "start" });
      el?.classList.add("flash");
    }
    if (app.focusEntry) {
      const el = document.getElementById(`s-${app.focusEntry}`);
      app.focusEntry = null;
      el?.scrollIntoView({ block: "center" });
      el?.classList.add("flash");
    }
  } catch (error) {
    if (mine !== token) return;
    clear(content).append(h("div", { class: "page" }, h("section", { class: "card bad" }, h("h2", { class: "h2" }, t("This screen could not load", "呢個畫面載入唔到")), h("p", {}, error.message), h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => navigate(id) }, icon("refresh", "sm"), t("Try again", "再試"))))));
  }
}

function history_(hash, replace) {
  if (replace) window.history.replaceState(null, "", hash);
  else window.history.pushState(null, "", hash);
}

window.addEventListener("popstate", () => app.me && content && navigate(location.hash.replace(/^#\//, "") || "overview", { replace: true }));
bus.on("signedout", () => { if (app.me) { app.me = null; toast(t("You were signed out. Sign in again.", "你已被登出，請重新登入。"), "bad"); boot(); } });
bus.on("lang", () => { if (!app.me || !content) boot(); });

boot();

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && app.me && content && !document.querySelector("dialog[open]")) {
    e.preventDefault();
    openPalette(paletteItems());
  }
});
