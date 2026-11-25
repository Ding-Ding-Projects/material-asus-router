// The Entware screen: whether it is installed, a package search with a
// keyboard-friendly combobox, the installed packages, and update, install,
// remove and upgrade with live output. See server/features/entware.
import { openOutput } from "./output.js";

const BASE = "/api/x/entware";
const label = { en: "Entware packages", yue: "Entware 軟件包" };
const lede = { en: "Search, install, remove and upgrade the extra programs Entware keeps in /opt.", yue: "搜尋、安裝、移除同升級 Entware 放喺 /opt 嘅額外程式。" };
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} GB` : n >= 1024 ? `${(n / 1024).toFixed(0)} MB` : `${n} KB`);

async function draw(ctx, root) {
  const { api, h, icon, t, tt, toast, confirmDialog, state } = ctx;
  const status = await api.get("/api/domain/entware");
  const page = ctx.page(label, lede);
  root.replaceChildren(page);
  if (!status.installed) {
    page.append(h("section", { class: "card ew-none rise" },
      h("div", { class: "row" }, icon("deployed_code", "lg"), h("h2", { class: "h2 grow" }, t("Entware is not installed on this router", "呢部路由器未安裝 Entware"))),
      h("p", {}, t("Entware adds thousands of extra programs, such as editors, monitoring tools and servers. It needs a USB drive and is installed from the router itself, for example with the amtm menu on Asuswrt-Merlin. This app does not install it, because that means running a script from the internet on your router.", "Entware 提供數以千計嘅額外程式，例如編輯器、監察工具同伺服器。佢需要 USB 磁碟，要喺路由器本身安裝，例如喺 Asuswrt-Merlin 用 amtm 選單。呢個程式唔會幫你安裝，因為安裝要喺路由器上執行來自互聯網嘅腳本。")),
      h("div", { class: "actions" }, h("button", { class: "btn t", onClick: () => draw(ctx, root) }, icon("refresh", "sm"), t("Check again", "再檢查")))));
    return;
  }
  const canWrite = state.canWrite;
  const start = async (body, title) => {
    try {
      const started = await api.post(`${BASE}/run`, { ack: true, ...body });
      const { done } = openOutput(ctx, { job: started.job, title, command: started.command, risk: "low" });
      done.then(() => { draw(ctx, root); });
    } catch (error) {
      toast(error.message, "bad");
    }
  };
  const ask = async (title, body, confirm, danger = false) => confirmDialog({ title, body, confirm, danger });

  const free = status.space;
  page.append(h("section", { class: "card ew-status rise" },
    h("div", { class: "row" }, icon("deployed_code", "lg"), h("div", { class: "grow" }, h("h2", { class: "h2" }, t("Entware is installed", "Entware 已安裝")), h("div", { class: "t2 mono" }, `${status.version} · ${status.architecture}`))),
    h("div", { class: "two" },
      h("div", {}, h("div", { class: "k" }, t("Installed packages", "已安裝套件")), h("div", { class: "big" }, String(status.packages))),
      h("div", {}, h("div", { class: "k" }, t("Upgrades waiting", "等緊升級")), h("div", { class: "big" }, String(status.upgradable.length)))),
    free ? h("div", {}, h("div", { class: "t2" }, t(`${kb(free.freeKb)} free of ${kb(free.totalKb)} in /opt`, `/opt 共 ${kb(free.totalKb)}，剩 ${kb(free.freeKb)}`)), h("div", { class: "meter", role: "img", "aria-label": t("Space used in /opt", "/opt 已用空間") }, h("i", { class: "ew-fill", "data-w": String(Math.round((free.usedKb / free.totalKb) * 100)) }))) : null,
    h("div", { class: "actions ew-left" },
      h("button", { class: "btn t", disabled: !canWrite, onClick: () => start({ op: "update" }, t("Refresh the package lists", "更新套件清單")) }, icon("sync", "sm"), t("Refresh the lists", "更新清單")),
      h("button", { class: "btn f", disabled: !canWrite || !status.upgradable.length, onClick: async () => { if (await ask(t(`Upgrade ${status.upgradable.length} packages?`, `升級 ${status.upgradable.length} 個套件？`), status.upgradable.map((u) => `${u.name} ${u.from} → ${u.to}`).join("\n"), t("Upgrade", "升級"))) start({ op: "upgrade" }, t("Upgrade every package", "升級所有套件")); } }, icon("upgrade", "sm"), t("Upgrade everything", "全部升級")))));
  for (const bar of page.querySelectorAll(".ew-fill")) bar.style.setProperty("--w", `${bar.dataset.w}%`);

  // ---- the search combobox ----
  const input = h("input", { class: "field", type: "text", role: "combobox", "aria-expanded": "false", "aria-controls": "ew-list", "aria-autocomplete": "list", autocomplete: "off", spellcheck: "false", placeholder: t("Search packages, for example nano or curl", "搜尋套件，例如 nano 或 curl"), "aria-label": t("Search for a package", "搜尋套件") });
  const list = h("ul", { class: "ew-list", id: "ew-list", role: "listbox", hidden: true });
  const live = h("div", { class: "t2", role: "status", "aria-live": "polite" });
  let results = [];
  let active = -1;
  let timer = null;
  let seq = 0;
  const setActive = (i) => {
    active = i;
    [...list.children].forEach((li, n) => { li.classList.toggle("on", n === i); li.setAttribute("aria-selected", String(n === i)); });
    if (i >= 0) input.setAttribute("aria-activedescendant", `ew-opt-${i}`), list.children[i]?.scrollIntoView({ block: "nearest" });
    else input.removeAttribute("aria-activedescendant");
  };
  const choose = async (p) => {
    if (p.installed) return void toast(t(`${p.name} is already installed.`, `${p.name} 已經安裝咗。`));
    if (await ask(t(`Install ${p.name}?`, `安裝 ${p.name}？`), `${p.name} ${p.version}\n${p.description}`, t("Install", "安裝"))) start({ op: "install", package: p.name }, t(`Install ${p.name}`, `安裝 ${p.name}`));
  };
  const showResults = () => {
    list.replaceChildren(...results.map((p, i) => h("li", { class: "ew-opt", id: `ew-opt-${i}`, role: "option", "aria-selected": "false", onMousedown: (e) => { e.preventDefault(); choose(p); } },
      icon(p.installed ? "check_circle" : "download", "sm"),
      h("div", { class: "grow" }, h("div", { class: "t1" }, p.name, " ", h("span", { class: "t2 mono" }, p.version)), h("div", { class: "t2" }, p.description)),
      p.installed ? h("span", { class: "tag good" }, t("Installed", "已安裝")) : h("span", { class: "tag" }, t("Install", "安裝")))));
    list.hidden = !results.length;
    input.setAttribute("aria-expanded", String(results.length > 0));
    setActive(-1);
  };
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { results = []; showResults(); live.textContent = ""; return; }
    timer = setTimeout(async () => {
      const mine = ++seq;
      try {
        const r = await api.get(`${BASE}/search?q=${encodeURIComponent(q)}`);
        if (mine !== seq) return;
        results = r.results;
        showResults();
        live.textContent = r.total ? t(`${r.total} packages found${r.total > r.results.length ? `, showing ${r.results.length}` : ""}.`, `搵到 ${r.total} 個套件${r.total > r.results.length ? `，顯示 ${r.results.length} 個` : ""}。`) : t("No package matches. Try Refresh the lists first.", "冇符合嘅套件，可以先試「更新清單」。");
      } catch (error) {
        live.textContent = error.message;
      }
    }, 250);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(results.length - 1, active + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(-1, active - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(results[active]); }
    else if (e.key === "Escape") { results = []; showResults(); }
  });
  input.addEventListener("blur", () => setTimeout(() => { list.hidden = true; input.setAttribute("aria-expanded", "false"); }, 120));
  input.addEventListener("focus", () => { if (results.length) { list.hidden = false; input.setAttribute("aria-expanded", "true"); } });
  page.append(h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("search", "sm"), " ", t("Find a package", "搵套件")), h("div", { class: "t2" }, t("Searches the package lists from the last refresh.", "搜尋上次更新嘅套件清單。")), h("div", { class: "ew-combo" }, input, list), live));

  // ---- installed packages ----
  const { packages } = await api.get(`${BASE}/installed`);
  const filter = h("input", { class: "field", type: "search", placeholder: t("Filter the installed packages", "篩選已安裝套件"), "aria-label": t("Filter the installed packages", "篩選已安裝套件") });
  const body = h("div", { class: "ew-installed" });
  const upgrades = new Map(status.upgradable.map((u) => [u.name, u.to]));
  const drawInstalled = () => {
    const q = filter.value.trim().toLowerCase();
    body.replaceChildren(...packages.filter((p) => !q || p.name.includes(q)).map((p) => h("div", { class: "row" },
      icon("deployed_code", "sm"),
      h("div", { class: "grow" }, h("div", { class: "t1" }, p.name), h("div", { class: "t2 mono" }, p.version, upgrades.has(p.name) ? ` → ${upgrades.get(p.name)}` : "")),
      upgrades.has(p.name) ? h("button", { class: "btn t sm", disabled: !canWrite, onClick: () => start({ op: "upgrade-one", package: p.name }, t(`Upgrade ${p.name}`, `升級 ${p.name}`)) }, icon("upgrade", "sm"), t("Upgrade", "升級")) : null,
      p.essential ? h("span", { class: "tag" }, icon("lock", "sm"), t("Part of Entware", "Entware 本身")) : h("button", { class: "btn t sm", disabled: !canWrite, "aria-label": `${t("Remove", "移除")} ${p.name}`, onClick: async () => { if (await ask(t(`Remove ${p.name}?`, `移除 ${p.name}？`), t("Programs that need it may stop working.", "需要佢嘅程式可能會停止運作。"), t("Remove", "移除"), true)) start({ op: "remove", package: p.name }, t(`Remove ${p.name}`, `移除 ${p.name}`)); } }, icon("delete", "sm"), t("Remove", "移除")))));
  };
  filter.addEventListener("input", drawInstalled);
  drawInstalled();
  page.append(h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("inventory_2", "sm"), " ", t("Installed packages", "已安裝套件")), filter, body));
  if (!canWrite) page.append(h("div", { class: "note" }, icon("visibility"), h("div", {}, t("Your account can look but not change packages.", "你嘅帳戶只可以睇，唔可以改套件。"))));
}

export default {
  id: "entware",
  screens: [{ id: "entware", group: { en: "Power tools", yue: "進階工具" }, icon: "deployed_code", label, render: (ctx) => draw(ctx, ctx.root) }],
  commands: [{ id: "entware.open", icon: "deployed_code", label, keywords: "opkg packages install remove upgrade opt", run: (ctx) => ctx.navigate("entware") }],
};
