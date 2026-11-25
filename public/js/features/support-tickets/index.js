// The Support Tickets recovery desk: a local, playful notebook for people who
// are locked out. It is reachable from the unlock prompt and the lock wizard
// (through the "support:open" event), from the Help section of the rail and
// from the command palette. It sends nothing, and resolving a ticket only
// shows the data folder.
import { createSelection, scopeText } from "./selection.js";

const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
const label = { en: "Support tickets", yue: "支援票務處" };
const group = { en: "Help", yue: "幫助" };
const PAGE = 20;

function buildDesk(ctx, afterResolve = () => {}) {
  const { api, h, icon, t, confirmDialog } = ctx;
  const sel = createSelection();
  const view = { q: "", regex: false, page: 0, all: [], error: "" };
  const listEl = h("div", { class: "tk-list" });
  const bulkEl = h("div", { class: "tk-bulk", role: "group", "aria-label": t("Bulk actions", "批量動作") });
  const count = h("p", { class: "muted", role: "status" });

  const filtered = () => {
    view.error = "";
    if (!view.q) return view.all;
    if (view.regex) {
      if (view.q.length > 120) return (view.error = t("Use 120 characters or fewer.", "請用 120 個字元或以下。")), [];
      try {
        const re = new RegExp(view.q, "i");
        return view.all.filter((x) => re.test(`${x.subject}\n${x.body}`.slice(0, 2000)));
      } catch (error) {
        return (view.error = error.message), [];
      }
    }
    const q = view.q.toLowerCase();
    return view.all.filter((x) => `${x.subject} ${x.body} ${x.category}`.toLowerCase().includes(q));
  };

  async function load() {
    const out = await api.get("/api/x/support-tickets/tickets");
    view.all = out.tickets;
    sel.keepOnly(view.all.map((x) => x.id));
    paint();
  }

  function paint() {
    const rows = filtered();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    view.page = Math.min(view.page, pages - 1);
    const visible = rows.slice(view.page * PAGE, view.page * PAGE + PAGE);
    const ids = visible.map((x) => x.id);
    count.textContent = view.error || t(`${rows.length} of ${view.all.length} tickets`, `${view.all.length} 張票之中有 ${rows.length} 張`);
    listEl.replaceChildren(...(visible.length ? visible.map((x) => h("div", { class: `row tk-row ${sel.has(x.id) ? "sel" : ""}`, tabindex: "0", role: "row", "aria-selected": String(sel.has(x.id)),
      onKeydown: (e) => { if (e.key === " ") { e.preventDefault(); sel.toggle(x.id, ids, { shift: e.shiftKey }); paint(); } } },
      h("input", { type: "checkbox", checked: sel.has(x.id), "aria-label": `${t("Select ticket", "選取票")} ${x.number}`, onClick: (e) => { sel.toggle(x.id, ids, { shift: e.shiftKey }); paint(); } }),
      h("div", { class: "grow" }, h("strong", {}, `#${x.number} ${x.subject}`), h("div", { class: "muted" }, `${x.at.slice(0, 16).replace("T", " ")} · ${x.category} · ${x.status}`), x.body ? h("div", {}, x.body) : null, x.resolution ? h("div", { class: "muted" }, x.resolution) : null),
      x.status === "open" ? h("button", { class: "btn t sm", onClick: () => resolve(x) }, icon("folder_open", "sm"), t("Resolve", "解決")) : null)) : [h("div", { class: "empty" }, icon("support_agent", "lg"), view.all.length ? t("No ticket matches.", "冇符合嘅票。") : t("No tickets yet. That is a good sign.", "仲未有票，係好事。"))]));
    const scope = scopeText(t, visible.length, rows.length);
    fill(bulkEl, 
      h("button", { class: "btn o sm", onClick: () => { sel.selectAll(ids); paint(); } }, scope.page),
      rows.length > visible.length ? h("button", { class: "btn o sm", onClick: () => { sel.selectAll(rows.map((x) => x.id)); paint(); } }, scope.matches) : null,
      h("button", { class: "btn o sm", onClick: () => { sel.invert(ids); paint(); } }, t("Invert selection", "反選")),
      h("button", { class: "btn o sm", disabled: !sel.size, onClick: () => { sel.clear(); paint(); } }, t("Clear selection", "取消選取")),
      h("button", { class: "btn d sm", disabled: !sel.size, onClick: removeSelected }, icon("delete", "sm"), t(`Delete ${sel.size} selected`, `刪除 ${sel.size} 張已選`)),
      h("button", { class: "btn t sm", onClick: exportSelected }, icon("download", "sm"), sel.size ? t(`Export ${sel.size} selected`, `匯出 ${sel.size} 張已選`) : t(`Export ${rows.length} shown`, `匯出 ${rows.length} 張顯示中`)),
      pages > 1 ? h("span", { class: "tk-pager" }, h("button", { class: "btn o sm", disabled: view.page === 0, "aria-label": t("Previous page", "上一頁"), onClick: () => { view.page--; paint(); } }, icon("chevron_left", "sm")), `${view.page + 1} / ${pages}`, h("button", { class: "btn o sm", disabled: view.page >= pages - 1, "aria-label": t("Next page", "下一頁"), onClick: () => { view.page++; paint(); } }, icon("chevron_right", "sm"))) : null);
  }

  async function removeSelected() {
    const ids = [...sel.chosen];
    if (!(await confirmDialog({ title: t(`Delete ${ids.length} tickets?`, `刪除 ${ids.length} 張票？`), body: t("This only removes the tickets from this desk. Nothing else changes.", "只會將票從呢個處理處移除，其他嘢唔會變。"), confirm: t("Delete tickets", "刪除票"), danger: true }))) return;
    const skipped = [];
    for (const id of ids) {
      try {
        await api.del(`/api/x/support-tickets/tickets/${id}`);
      } catch (error) {
        skipped.push(`${id.slice(0, 8)}: ${error.message}`);
      }
    }
    sel.clear();
    ctx.toast(skipped.length ? t(`Deleted ${ids.length - skipped.length}; skipped ${skipped.length}: ${skipped[0]}`, `已刪除 ${ids.length - skipped.length} 張，跳過 ${skipped.length} 張：${skipped[0]}`) : t(`Deleted ${ids.length}.`, `已刪除 ${ids.length} 張。`));
    await load();
  }

  function exportSelected() {
    const rows = sel.size ? view.all.filter((x) => sel.has(x.id)) : filtered();
    const csv = ["number,at,category,status,subject"].concat(rows.map((x) => [x.number, x.at, x.category, x.status, `"${x.subject.replace(/"/g, '""')}"`].join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: "tickets.csv" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function resolve(ticket) {
    const out = await api.post(`/api/x/support-tickets/tickets/${ticket.id}/resolve`);
    ctx.openDialog((close) => [
      h("h2", { class: "h2" }, icon("folder_open"), " ", t("Here is where the data lives", "資料放喺呢度")),
      h("div", { class: "mono tk-path" }, out.folder.path),
      h("p", {}, out.folder.hint),
      h("p", { class: "muted" }, `${t("Files you will see", "你會見到嘅檔案")}: ${out.folder.files.join(", ")}`),
      h("p", { class: "muted" }, t("Opening the folder deletes nothing. You decide what to do next.", "開啟資料夾唔會刪除任何嘢，之後點做由你決定。")),
      h("div", { class: "actions" }, h("button", { class: "btn t", onClick: () => (navigator.clipboard?.writeText(out.folder.path).then(() => ctx.toast(t("Path copied.", "已複製路徑。")), () => ctx.toast(t("Copy is not available here.", "呢度用唔到複製。"), "bad"))) }, icon("content_copy", "sm"), t("Copy path", "複製路徑")), h("button", { class: "btn f", onClick: () => close() }, t("Done", "完成"))),
    ], { label: t("Data folder", "資料夾") });
    afterResolve();
    await load();
  }

  const subject = h("input", { class: "field", maxlength: "120", "aria-label": t("Subject", "標題"), placeholder: t("What happened?", "發生咗咩事？") });
  const body = h("textarea", { class: "field tk-body", maxlength: "2000", "aria-label": t("Details", "詳情"), placeholder: t("Anything else? (optional)", "仲有咩？（可選）") });
  const category = h("select", { class: "field", "aria-label": t("Kind of trouble", "麻煩類型") }, [["locked-out", t("Locked out", "鎖咗自己")], ["forgot-pin", t("Forgot a PIN or password", "唔記得 PIN 或密碼")], ["lost-authenticator", t("Lost my authenticator", "冇咗驗證器")], ["other", t("Something else", "其他")]].map(([v, l]) => h("option", { value: v }, l)));
  const search = h("input", { class: "field", type: "search", "aria-label": t("Search tickets", "搜尋票"), placeholder: t("Search tickets", "搜尋票"), onInput: (e) => { view.q = e.target.value.trim(); view.page = 0; paint(); } });
  const regexBox = h("input", { type: "checkbox", onChange: (e) => { view.regex = e.target.checked; paint(); } });

  const el = h("div", { class: "tk" },
    // One plain, unstyled line, never softened or decorated.
    h("p", { class: "tk-plain" }, t("Nothing you write here is sent anywhere, and nobody reads it. These tickets stay on this computer.", "你喺度寫嘅嘢唔會傳去任何地方，亦冇人會睇。呢啲票只留喺呢部電腦。")),
    h("section", { class: "card" },
      h("div", { class: "k" }, t("New ticket", "新票")),
      h("div", { class: "grid2" }, subject, category), body,
      h("div", { class: "actions" }, h("button", { class: "btn f", onClick: async () => {
        try {
          await api.post("/api/x/support-tickets/tickets", { subject: subject.value, body: body.value, category: category.value });
          subject.value = body.value = "";
          ctx.toast(t("Ticket saved on this computer.", "票已儲存喺呢部電腦。"));
          await load();
        } catch (error) {
          ctx.toast(error.message, "bad");
        }
      } }, icon("add", "sm"), t("Open a ticket", "開票")))),
    h("section", { class: "card" },
      h("div", { class: "k" }, t("Tickets", "票")),
      h("div", { class: "tk-tools" }, search, h("label", { class: "tk-rx" }, regexBox, t("Regex", "正則"))),
      count, bulkEl, listEl));
  load();
  return el;
}

export default {
  id: "support-tickets",
  screens: [{ id: "support-tickets", group, icon: "support_agent", label, render: (ctx) => ctx.root.append(ctx.page(label, { en: "A local desk for when a lock or code gets the better of you.", yue: "當鎖或者驗證碼搞到你冇辦法嗰陣用嘅本機處理處。" }, buildDesk(ctx))) }],
  overlays: [{ id: "support-tickets.listener", mount: (ctx) => ctx.bus.on("support:open", (detail) => {
    detail.claimed = true;
    ctx.openDialog((close) => [buildDesk(ctx, () => {}), ctx.h("div", { class: "actions" }, ctx.h("button", { class: "btn f", onClick: () => close() }, ctx.t("Close", "關閉")))], { label: ctx.t("Support tickets", "支援票務處") });
  }) }],
  commands: [{ id: "support-tickets.open", icon: "support_agent", label: { en: "Open support tickets (Help)", yue: "開啟支援票務處（幫助）" }, keywords: "help locked out recovery forgot", run: (ctx) => ctx.navigate("support-tickets") }],
};
