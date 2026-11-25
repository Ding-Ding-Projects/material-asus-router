// The catalogue screen: a card for every action with real controls for its
// parameters, the exact command it will send, its risk, and a Run button that
// asks for the confirmation that risk deserves.
import { buildControl } from "./controls.js";
import { drawFiles } from "./files.js";
import { openOutput } from "./output.js";
import { openProcesses } from "./processes.js";
import { RISK, runCard } from "./run.js";

const BASE = "/api/x/ssh-actions";
const debounce = (fn, ms) => { let id; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); }; };

export async function drawCatalogue(ctx, root, { title, lede }) {
  const { api, h, icon, t, tt, toast, navigate, state } = ctx;
  const data = await api.get("/api/domain/ssh-actions");
  const groups = new Map(data.groups.map((g) => [g.id, g]));
  const sources = new Map();
  const loadSource = async (name) => {
    try {
      sources.set(name, (await api.get(`${BASE}/options/${name}`)).options);
    } catch {
      sources.set(name, []);
    }
  };
  const wanted = [...new Set(data.actions.filter((a) => !a.unavailable && !a.link).flatMap((a) => a.params.map((p) => p.source).filter(Boolean)))];
  await Promise.all(wanted.map(loadSource));

  const view = { q: "", group: "all" };
  const grid = h("div", { class: "sa-grid" });
  const empty = h("div", { class: "empty", hidden: true }, icon("search_off", "lg"), t("No action matches. Clear the search or pick another group.", "冇符合嘅動作，請清除搜尋或者揀其他分類。"));
  const cardsByGroup = [];

  function buildCard(a, index) {
    const controls = new Map();
    const tone = (r) => (r === "destructive" ? "bad" : r === "network" ? "warn" : "");
    const riskTag = h("span", { class: "tag" });
    const showRisk = (r) => {
      riskTag.className = `tag ${tone(r)}`;
      riskTag.replaceChildren(icon(RISK[r].icon, "sm"), t(RISK[r].en, RISK[r].yue));
    };
    const currentRisk = () => (a.riskBy ? a.riskBy.values[controls.get(a.riskBy.param)?.get()] ?? a.risk : a.risk);
    showRisk(currentRisk());
    const cmd = h("div", { class: "sa-cmd mono", "aria-live": "polite" });
    const cmdRow = h("div", { class: "sa-cmdrow" }, h("div", { class: "k" }, t("Exact command", "確實命令")), cmd);
    const run = h("button", { class: "btn f sa-run", disabled: true }, icon(a.viaEngine ? "fact_check" : "play_arrow", "sm"), a.viaEngine ? t("Review and apply", "檢查並套用") : a.view ? t("Show", "顯示") : t("Run", "執行"));
    const values = () => Object.fromEntries([...controls].map(([id, c]) => [id, c.get()]));
    const card = h("article", { class: `card sa-card rise ${tone(a.risk)}`, "data-id": a.id, "data-group": a.group });
    card.style.setProperty("--i", String(index));

    let seq = 0;
    const refresh = debounce(async () => {
      const mine = ++seq;
      showRisk(currentRisk());
      if ([...controls.values()].some((c) => c.problem())) {
        cmd.textContent = t("Fix the highlighted choice to see the command.", "請先修正標示嘅選項，先會見到命令。");
        cmd.classList.add("sa-wait");
        run.disabled = true;
        return;
      }
      try {
        const pv = await api.post(`${BASE}/preview`, { id: a.id, params: values() });
        if (mine !== seq) return;
        cmd.classList.remove("sa-wait", "sa-bad");
        cmd.textContent = pv.viaEngine ? t("Reviewed first: the change engine shows exactly what changes before anything is written.", "先檢查：改動引擎會喺寫入前列出會改變乜嘢。") : pv.command;
        if (pv.risk) showRisk(pv.risk);
        run.disabled = !state.canWrite;
      } catch (error) {
        if (mine !== seq) return;
        cmd.textContent = error.message;
        cmd.classList.add("sa-bad");
        run.disabled = true;
      }
    }, 200);

    for (const p of a.params) {
      const control = buildControl(ctx, p, { options: p.source ? sources.get(p.source) : undefined, onChange: refresh });
      controls.set(p.id, control);
    }

    const head = h("div", { class: "sa-head" },
      h("span", { class: "sa-ico" }, icon(a.icon)),
      h("div", { class: "grow" }, h("h3", { class: "h2 sa-title" }, tt(a.label)), h("div", { class: "t2 sa-group" }, tt(groups.get(a.group).label))),
      riskTag);
    card.append(head, h("p", { class: "muted sa-help" }, tt(a.help)));

    if (a.unavailable) {
      card.append(h("div", { class: "note warn" }, icon("block"), h("div", {}, tt(a.unavailable))));
      return card;
    }
    if (a.link) {
      card.append(h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => navigate(a.link) }, icon("arrow_forward", "sm"), t("Open Maintenance", "開啟維護畫面"))));
      return card;
    }
    if (a.view === "processes") {
      card.append(h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => openProcesses(ctx) }, icon("memory", "sm"), t("Show processes", "顯示程序"))));
      return card;
    }
    for (const c of controls.values()) card.append(c.el);
    if (a.params.some((p) => p.source))
      card.append(h("div", { class: "actions sa-left" }, h("button", { class: "btn t sm", onClick: async () => { for (const p of a.params.filter((x) => x.source)) { await loadSource(p.source); controls.get(p.id).setOptions(sources.get(p.source)); } refresh(); } }, icon("refresh", "sm"), t("Refresh the choices", "重新讀取選項"))));
    card.append(cmdRow);
    if (!state.canWrite) card.append(h("div", { class: "t2" }, t("Your account can look but not run actions.", "你嘅帳戶只可以睇，唔可以執行動作。")));
    run.addEventListener("click", async () => {
      if (!a.viaEngine && a.view && a.risk === "low" && !a.params.length) return quick(a, values());
      card.classList.add("sa-launch");
      setTimeout(() => card.classList.remove("sa-launch"), 900);
      await runCard(ctx, a, values(), { after: () => { loadRecent(); for (const p of a.params.filter((x) => x.source)) loadSource(p.source).then(() => controls.get(p.id).setOptions(sources.get(p.source))); } });
    });
    card.append(h("div", { class: "actions" }, run));
    refresh();
    return card;
  }

  // A read-only view needs no confirmation: pressing Show is the confirmation.
  async function quick(a, params) {
    try {
      const started = await api.post(`${BASE}/run`, { id: a.id, params, ack: true });
      openOutput(ctx, { job: started.job, title: tt(a.label), command: started.command, risk: started.risk, view: a.view });
    } catch (error) {
      toast(error.message, "bad");
    }
  }

  const cards = data.actions.filter((a) => !a.hidden).map((a, i) => buildCard(a, i));
  for (const [i, a] of data.actions.filter((x) => !x.hidden).entries()) cardsByGroup.push({ a, el: cards[i], text: `${a.label.en} ${a.label.yue} ${a.help.en} ${a.help.yue} ${a.id}`.toLowerCase() });
  grid.append(...cards);

  const search = h("input", { class: "field", type: "search", placeholder: t("Search the actions", "搜尋動作"), "aria-label": t("Search the actions", "搜尋動作"), onInput: (e) => { view.q = e.target.value.trim().toLowerCase(); applyFilter(); } });
  const chips = h("div", { class: "seg sa-chips", role: "radiogroup", "aria-label": t("Group", "分類") });
  const drawChips = () => chips.replaceChildren(...[["all", { en: "All", yue: "全部" }], ...data.groups.map((g) => [g.id, g.label])].map(([id, label]) => h("button", { role: "radio", class: view.group === id ? "on" : "", "aria-checked": String(view.group === id), onClick: () => { view.group = id; drawChips(); applyFilter(); } }, tt(label))));
  function applyFilter() {
    let shown = 0;
    for (const c of cardsByGroup) {
      const ok = (view.group === "all" || c.a.group === view.group) && (!view.q || c.text.includes(view.q));
      c.el.hidden = !ok;
      if (ok) shown += 1;
    }
    empty.hidden = shown > 0;
  }
  drawChips();

  const recent = h("div", { class: "sa-recent" });
  async function loadRecent() {
    try {
      const { jobs } = await api.get(`${BASE}/jobs`);
      recent.replaceChildren(...(jobs.length ? jobs.slice(0, 8).map((j) => h("div", { class: "row" },
        icon(j.status === "done" ? "check_circle" : j.status === "running" ? "sync" : "error"),
        h("div", { class: "grow" }, h("div", { class: "t1" }, tt(j.label)), h("div", { class: "t2 mono" }, j.command)),
        h("span", { class: "t2" }, new Date(j.startedAt).toLocaleTimeString()),
        h("button", { class: "btn t sm", onClick: () => openOutput(ctx, { job: j.id, title: tt(j.label), command: j.command, risk: j.risk }) }, icon("terminal", "sm"), t("Open", "開啟")))) : [h("div", { class: "t2" }, t("Nothing has been run since this app started.", "自程式啟動後未執行過任何動作。"))]));
    } catch {
      recent.replaceChildren();
    }
  }

  const filesHost = h("div", { class: "sa-fileshost" });
  const page = ctx.page(title, lede,
    h("section", { class: "card tone sa-bar" }, h("label", { class: "search sa-search" }, icon("search"), search), chips),
    grid, empty,
    h("section", { class: "card", id: "sa-files" }, h("h2", { class: "h2" }, icon("folder_open", "sm"), " ", t("Files on the router", "路由器上嘅檔案")), h("div", { class: "t2" }, t("Browse /jffs, /tmp and /opt. Edits are reviewed before they are saved.", "瀏覽 /jffs、/tmp 同 /opt。儲存前會先檢查改動。")), filesHost),
    h("section", { class: "card" }, h("h2", { class: "h2" }, icon("history", "sm"), " ", t("Recent runs", "最近執行")), recent));
  root.replaceChildren(page);
  if (state.me?.role !== "viewer") drawFiles(ctx, filesHost);
  else filesHost.append(h("div", { class: "note" }, icon("visibility"), h("div", {}, t("Files are not shown to view-only accounts.", "只讀帳戶睇唔到檔案。"))));
  loadRecent();
  return () => {};
}
