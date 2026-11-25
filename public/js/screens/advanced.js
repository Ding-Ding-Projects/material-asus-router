// Advanced: every raw router setting in a searchable table. Known settings
// show their friendly name, secrets are hidden until revealed, and every edit
// goes through the same preview and safety net as everything else.
import { api, bus, clear, h, icon, openDialog, t, toast, tt } from "../core.js";
import { app, dock } from "../dock.js";
import { header, loadDomain, tableOf } from "./common.js";

const PAGE = 100;

function editDialog(row, current) {
  let value = current ?? "";
  const original = current ?? "";
  return openDialog((close) => [
    h("h2", { class: "h2" }, row ? t("Edit a raw setting", "編輯原始設定") : t("Add a raw setting", "新增原始設定")),
    h("div", { class: "note warn" }, icon("warning"), t("Raw settings have no friendly checks. A wrong value can cut the router off, so the safety net is always on for these edits.", "原始設定冇友善嘅檢查。錯誤嘅值可以令路由器斷線，所以呢類改動一定會用安全機制。")),
    row ? h("div", { class: "t1 mono" }, row.key) : h("label", { class: "lbl" }, t("Setting name", "設定名稱"), h("input", { class: "field mono", id: "newkey", maxlength: "64", autocomplete: "off", spellcheck: "false" })),
    h("label", { class: "lbl" }, t("Value", "值"), h("textarea", { class: "field mono", maxlength: "4096", spellcheck: "false", onInput: (e) => (value = e.target.value) }, original)),
    h("div", { class: "actions" },
      h("button", { class: "btn o", onClick: () => close() }, t("Cancel", "取消")),
      h("button", { class: "btn f", onClick: () => {
        const key = row?.key ?? document.getElementById("newkey").value.trim();
        if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(key)) return toast(t("Use letters, digits, dots, dashes, colons and underscores in the name.", "名稱可以用字母、數字、點、橫線、冒號同底線。"), "bad");
        dock.setRaw(key, value, row ? original : undefined, row?.label ?? undefined);
        close(true);
      } }, t("Add to changes", "加入改動"))),
  ]);
}

export async function advanced(root) {
  let data = await loadDomain("advanced");
  let query = "";
  let page = 0;
  let onlyKnown = false;
  const revealed = new Map();
  const body = h("div", {});
  const pager = h("div", { class: "row" });

  function paint() {
    const q = query.toLowerCase();
    const rows = data.rows.filter((r) => (!onlyKnown || r.label) && (!q || `${r.key} ${r.label?.en ?? ""} ${r.label?.yue ?? ""} ${r.masked ? "" : r.value}`.toLowerCase().includes(q)));
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    page = Math.min(page, pages - 1);
    const slice = rows.slice(page * PAGE, page * PAGE + PAGE);
    clear(body).append(slice.length
      ? tableOf([t("Setting", "設定"), t("Value", "值"), ""], slice.map((r) => {
          const staged = dock.changes.get(`raw:${r.key}`);
          const shown = revealed.get(r.key) ?? (r.masked ? "••••••••" : r.value);
          return h("tr", {},
            h("td", {}, r.label ? h("div", { class: "t1" }, tt(r.label)) : null, h("div", { class: "mono t2" }, r.key)),
            h("td", { class: "mono" }, staged ? h("span", { class: "tag warn" }, icon("edit_note", "sm"), staged.value.length > 60 ? `${staged.value.slice(0, 60)}…` : staged.value) : (shown === "" ? h("span", { class: "muted" }, t("empty", "空")) : shown.length > 160 ? `${shown.slice(0, 160)}…` : shown), r.truncated ? h("span", { class: "tag" }, t("long", "好長")) : null),
            h("td", {}, h("div", { class: "chips" },
              r.masked ? h("button", { class: "btn t icon", "aria-label": `${t("Reveal", "顯示")} ${r.key}`, disabled: !app.canWrite, onClick: async () => { try { revealed.set(r.key, revealed.has(r.key) ? undefined : (await api.post("/api/reveal", { key: r.key })).value); if (revealed.get(r.key) === undefined) revealed.delete(r.key); paint(); } catch (e) { toast(e.message, "bad"); } } }, icon(revealed.has(r.key) ? "visibility_off" : "visibility", "sm")) : null,
              app.canWrite && r.editable ? h("button", { class: "btn t icon", "aria-label": `${t("Edit", "編輯")} ${r.key}`, onClick: async () => { let cur = revealed.get(r.key) ?? r.value; if (r.masked && !revealed.has(r.key)) { try { cur = (await api.post("/api/reveal", { key: r.key })).value; } catch (e) { return toast(e.message, "bad"); } } await editDialog(r, staged?.value ?? cur).closed; paint(); } }, icon("edit", "sm")) : null)));
        }))
      : h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("search_off", "lg"), t("No settings match.", "冇符合嘅設定。"))));
    clear(pager).append(
      h("span", { class: "muted grow" }, t(`${rows.length} of ${data.total} settings`, `${data.total} 項入面有 ${rows.length} 項`)),
      h("button", { class: "btn t sm", disabled: page === 0, onClick: () => { page -= 1; paint(); } }, icon("chevron_left", "sm"), t("Previous", "上一頁")),
      h("span", { class: "muted" }, `${page + 1} / ${pages}`),
      h("button", { class: "btn t sm", disabled: page >= pages - 1, onClick: () => { page += 1; paint(); } }, t("Next", "下一頁"), icon("chevron_right", "sm")));
  }

  root.append(h("div", { class: "page" }, header("advanced"),
    h("section", { class: "card" },
      h("div", { class: "row" },
        h("input", { class: "field", type: "search", placeholder: t("Search by name or value", "按名稱或值搜尋"), "aria-label": t("Search settings", "搜尋設定"), onInput: (e) => { query = e.target.value; page = 0; paint(); } }),
        h("label", { class: "row" }, h("input", { type: "checkbox", onChange: (e) => { onlyKnown = e.target.checked; page = 0; paint(); } }), t("Only settings with a friendly name", "只顯示有友善名稱嘅設定")),
        app.canWrite ? h("button", { class: "btn f sm", onClick: async () => { await editDialog(null, "").closed; paint(); } }, icon("add", "sm"), t("Add setting", "新增設定")) : null),
      pager),
    body));
  paint();
  const off = [bus.on("dock", paint), bus.on("changed", async () => { data = await loadDomain("advanced"); paint(); })];
  return () => off.forEach((f) => f());
}
