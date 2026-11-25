// Bulk actions on the device list: click, shift-click or keyboard to select,
// select the page or every match, invert, then run an action on all of them.
// The exact count, the skipped devices with their reasons and the change
// engine's preview are shown first. Edits join the pending-changes dock, so
// they get the usual safety net and undo. Removing things asks for the two-key
// confirmation.
import { createSelection, scopeText } from "./selection.js";

const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
const label = { en: "Bulk actions", yue: "批量動作" };
const group = { en: "Records", yue: "記錄" };
const PAGE = 15;

const askSuper = (ctx, options) => new Promise((resolve) => {
  const detail = { ...options, claimed: false, respond: resolve };
  ctx.bus.emit("superconfirm:ask", detail);
  if (!detail.claimed) resolve(null);
});

async function render(ctx) {
  const { api, h, icon, t, tt, toast } = ctx;
  const sel = createSelection();
  const view = { q: "", rows: [], total: 0, page: 0, actions: [], progress: null };
  const listEl = h("div", { class: "ba-list", role: "listbox", "aria-multiselectable": "true", "aria-label": t("Devices", "裝置") });
  const barEl = h("div", { class: "ba-bar", role: "group", "aria-label": t("Bulk actions", "批量動作") });
  const info = h("p", { class: "muted", role: "status" });
  const progress = h("div", { class: "meter ba-progress", hidden: true }, h("i", {}));

  const search = h("input", { class: "field", type: "search", "aria-label": t("Search devices", "搜尋裝置"), placeholder: t("Search by name, MAC or address", "按名稱、MAC 或地址搜尋"), onInput: (e) => { view.q = e.target.value; view.page = 0; load(); } });

  async function load() {
    const out = await api.get(`/api/x/bulk-actions/devices?q=${encodeURIComponent(view.q)}`);
    view.rows = out.devices;
    view.total = out.total;
    view.actions = out.actions;
    sel.keepOnly(view.rows.map((d) => d.mac));
    paint();
  }

  function paint() {
    const pages = Math.max(1, Math.ceil(view.rows.length / PAGE));
    view.page = Math.min(view.page, pages - 1);
    const shown = view.rows.slice(view.page * PAGE, view.page * PAGE + PAGE);
    const macs = shown.map((d) => d.mac);
    info.textContent = t(`${view.rows.length} of ${view.total} devices match. ${sel.size} selected.`, `${view.total} 部裝置之中有 ${view.rows.length} 部符合，已選取 ${sel.size} 部。`);
    listEl.replaceChildren(...(shown.length ? shown.map((d) => h("div", { class: `row ba-row ${sel.has(d.mac) ? "sel" : ""}`, role: "option", "aria-selected": String(sel.has(d.mac)), tabindex: "0",
      onKeydown: (e) => {
        const i = macs.indexOf(d.mac);
        if (e.key === " ") { e.preventDefault(); sel.toggle(d.mac, macs, { shift: e.shiftKey }); paint(); listEl.children[i]?.focus(); }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const j = Math.min(Math.max(i + (e.key === "ArrowDown" ? 1 : -1), 0), macs.length - 1);
          if (e.shiftKey) sel.toggle(macs[j], macs, { shift: true });
          paint();
          listEl.children[j]?.focus();
        }
      } },
      h("input", { type: "checkbox", tabindex: "-1", checked: sel.has(d.mac), "aria-label": `${t("Select", "選取")} ${d.name}`, onClick: (e) => { sel.toggle(d.mac, macs, { shift: e.shiftKey }); paint(); } }),
      h("div", { class: "grow" }, h("strong", {}, d.name), h("div", { class: "muted mono" }, `${d.mac} · ${d.ip || "-"}`)),
      d.customName ? h("span", { class: "tag" }, t("named", "有名")) : null, d.reservedIp ? h("span", { class: "tag" }, t("reserved", "已留住")) : null, d.blocked ? h("span", { class: "tag bad" }, t("blocked", "已封鎖")) : null)) : [h("div", { class: "empty" }, icon("devices", "lg"), t("No device matches.", "冇符合嘅裝置。"))]));
    const scope = scopeText(t, shown.length, view.rows.length);
    fill(barEl, 
      h("button", { class: "btn o sm", onClick: () => { sel.selectAll(macs); paint(); } }, scope.page),
      view.rows.length > shown.length ? h("button", { class: "btn o sm", onClick: () => { sel.selectAll(view.rows.map((d) => d.mac)); paint(); } }, scope.matches) : null,
      h("button", { class: "btn o sm", onClick: () => { sel.invert(macs); paint(); } }, t("Invert", "反選")),
      h("button", { class: "btn o sm", disabled: !sel.size, onClick: () => { sel.clear(); paint(); } }, t("Clear", "取消選取")),
      ...view.actions.map((a) => h("button", { class: `btn ${a.destructive ? "d" : "t"} sm`, disabled: !sel.size || !ctx.state.canWrite, onClick: () => plan(a) }, tt(a.label))),
      h("button", { class: "btn t sm", onClick: exportRows }, icon("download", "sm"), sel.size ? t(`Export ${sel.size} selected`, `匯出 ${sel.size} 部已選`) : t(`Export all ${view.rows.length} shown`, `匯出顯示中嘅 ${view.rows.length} 部`)),
      pages > 1 ? h("span", { class: "ba-pager" }, h("button", { class: "btn o sm", disabled: view.page === 0, "aria-label": t("Previous page", "上一頁"), onClick: () => { view.page--; paint(); } }, icon("chevron_left", "sm")), `${view.page + 1} / ${pages}`, h("button", { class: "btn o sm", disabled: view.page >= pages - 1, "aria-label": t("Next page", "下一頁"), onClick: () => { view.page++; paint(); } }, icon("chevron_right", "sm"))) : null);
  }

  // Exports honour the filter and the selection, never more.
  async function exportRows() {
    const rows = sel.size ? view.rows.filter((d) => sel.has(d.mac)) : view.rows;
    const csv = ["mac,ip,name,custom name,reserved address,blocked"].concat(rows.map((d) => [d.mac, d.ip, d.name, d.customName, d.reservedIp, d.blocked].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))).join("\r\n");
    const a = h("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), download: "devices-selection.csv" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(t(`Exported ${rows.length} devices.`, `已匯出 ${rows.length} 部裝置。`));
  }

  async function plan(action) {
    progress.hidden = false;
    progress.firstChild.style.setProperty("--w", "30%");
    let out;
    try {
      out = await api.post("/api/x/bulk-actions/plan", { action: action.id, macs: [...sel.chosen] });
    } catch (error) {
      progress.hidden = true;
      return toast(error.message, "bad");
    }
    progress.firstChild.style.setProperty("--w", "100%");
    setTimeout(() => (progress.hidden = true), 600);
    const ok = await ctx.openDialog((close) => [
      h("h2", { class: "h2" }, `${tt(action.label)}: ${out.count} ${t("of", "／")} ${out.requested}`),
      out.count ? h("div", { class: "note" }, icon("playlist_add_check"), t(`${out.count} devices will change. The edits join your pending changes, where you review, apply and can undo them.`, `${out.count} 部裝置會改變。改動會加入等緊嘅改動，你可以喺嗰度檢視、套用同撤銷。`)) : h("div", { class: "note warn" }, icon("block"), t("Nothing to do: every selected device was skipped.", "冇嘢做：所有已選裝置都被跳過。")),
      out.items.length ? h("div", { class: "chips" }, out.items.slice(0, 30).map((d) => h("span", { class: "chip" }, d.name)), out.items.length > 30 ? h("span", { class: "chip" }, `+${out.items.length - 30}`) : null) : null,
      out.skipped.length ? h("div", {}, h("div", { class: "k" }, t(`Skipped ${out.skipped.length}`, `跳過 ${out.skipped.length} 部`)), out.skipped.slice(0, 20).map((s) => h("div", { class: "row" }, h("span", { class: "mono" }, s.mac), h("span", { class: "muted grow" }, s.reason)))) : null,
      out.destructive ? h("div", { class: "note bad" }, icon("warning"), t("This removes things. You will be asked for the two-key confirmation next.", "呢個動作會移除嘢。之後會要求雙鑰確認。")) : null,
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: `btn ${out.destructive ? "d" : "f"}`, disabled: !out.count, onClick: () => close(true) }, t("Continue", "繼續"))),
    ], { label: tt(action.label) }).closed;
    if (!ok) return;
    if (out.destructive) {
      const token = await askSuper(ctx, { action: `bulk-actions.${action.id}`, title: tt(action.label), affects: [t(`${tt(action.label)} for ${out.count} devices: ${out.items.slice(0, 5).map((d) => d.name).join(", ")}${out.count > 5 ? "..." : ""}.`, `為 ${out.count} 部裝置${tt(action.label)}：${out.items.slice(0, 5).map((d) => d.name).join("、")}${out.count > 5 ? "..." : ""}。`), t("It can be undone from the change history after you apply it.", "套用之後可以喺改動記錄入面撤銷。")] });
      if (!token) return toast(t("Cancelled. Nothing was queued.", "已取消，冇加入任何改動。"));
    }
    out.ops.forEach((op, i) => {
      progress.hidden = false;
      progress.firstChild.style.setProperty("--w", `${((i + 1) / out.ops.length) * 100}%`);
      ctx.dock.addOp(op, `${tt(action.label)}: ${out.items[i]?.name ?? op.mac}`);
    });
    setTimeout(() => (progress.hidden = true), 600);
    toast(t(`${out.count} edits added to your pending changes.`, `已將 ${out.count} 項改動加入等緊嘅改動。`));
    sel.clear();
    paint();
  }

  ctx.root.append(ctx.page(label, { en: "Select many devices and change them together. You always see the exact count and what is skipped first, and every edit can be undone.", yue: "一次揀多部裝置一齊改。每次都會先顯示確實數量同被跳過嘅項目，而且每項改動都可以撤銷。" },
    h("section", { class: "card" }, h("div", { class: "ba-tools" }, search), info, barEl, progress, listEl)));
  await load();
}

export default {
  id: "bulk-actions",
  screens: [{ id: "bulk-actions", group, icon: "checklist", label, render }],
  commands: [{ id: "bulk-actions.open", icon: "checklist", label: { en: "Open bulk actions on devices", yue: "開啟裝置批量動作" }, keywords: "select all multiple devices block forget", run: (ctx) => ctx.navigate("bulk-actions") }],
};
