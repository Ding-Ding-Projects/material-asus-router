// The local version history panel: browse every recorded revision of the app's
// settings and records, filter by date and by derived action (with counts),
// search with a plain or regex query, compare two revisions, label one, restore
// one (a restore is a new revision), prune old ones (two-key confirmation) and
// export. History is kept in an isolated file beside the app data.
const label = { en: "Version history", yue: "版本記錄" };
const group = { en: "Records", yue: "記錄" };

const askSuper = (ctx, options) => new Promise((resolve) => {
  const detail = { ...options, claimed: false, respond: resolve };
  ctx.bus.emit("superconfirm:ask", detail);
  if (!detail.claimed) resolve(null);
});

const ACTION_LABEL = {
  baseline: ["First record", "最初記錄"],
  settings: ["Settings", "設定"],
  "feature-state": ["Feature data", "功能資料"],
  "account-change": ["Accounts", "帳戶"],
  "display-name-change": ["Display name", "顯示名稱"],
  "credential-change": ["Credentials", "憑證"],
  "router-connection": ["Router connection", "路由器連線"],
  "vault-change": ["Vault", "保險庫"],
  restore: ["Restore", "還原"],
  label: ["Label", "標籤"],
  change: ["Other", "其他"],
};

async function render(ctx) {
  const { api, h, icon, t, toast } = ctx;
  const view = { from: "", to: "", actions: new Set(), q: "", regex: false, rows: [], counts: {}, picked: [], error: "" };
  const root = h("div", { class: "lh" });
  const list = h("div", { class: "lh-list" });
  const info = h("p", { class: "muted", role: "status" });
  const chips = h("div", { class: "chips", role: "group", "aria-label": t("Filter by kind of change", "按改動類型篩選") });
  const status = await api.get("/api/x/local-history/status");

  const dateField = (name, key) => h("label", { class: "lh-date" }, name, h("input", { class: "field", type: "date", "aria-label": name, onChange: (e) => { view[key] = e.target.value; load(); } }));
  const search = h("input", { class: "field", type: "search", "aria-label": t("Search history", "搜尋記錄"), placeholder: t("Search label, action, user or changed path", "搜尋標籤、動作、使用者或改動路徑"), onInput: (e) => { view.q = e.target.value; paint(); } });
  const regex = h("input", { type: "checkbox", onChange: (e) => { view.regex = e.target.checked; paint(); } });

  async function load() {
    const params = new URLSearchParams();
    if (view.from) params.set("from", view.from);
    if (view.to) params.set("to", view.to);
    const out = await api.get(`/api/x/local-history/revisions?${params}`);
    view.rows = out.revisions;
    view.counts = out.counts;
    view.total = out.total;
    paint();
  }

  const text = (r) => `${r.label} ${r.action} ${r.user ?? ""} ${(r.changed ?? []).join(" ")}`;
  function rowsNow() {
    view.error = "";
    let rows = view.rows.filter((r) => !view.actions.size || view.actions.has(r.action));
    if (!view.q) return rows;
    if (view.regex) {
      if (view.q.length > 120) return (view.error = t("Use 120 characters or fewer.", "請用 120 個字元或以下。")), [];
      try {
        const re = new RegExp(view.q, "i");
        return rows.filter((r) => re.test(text(r)));
      } catch (error) {
        return (view.error = error.message), [];
      }
    }
    return rows.filter((r) => text(r).toLowerCase().includes(view.q.toLowerCase()));
  }

  function paint() {
    const rows = rowsNow();
    info.textContent = view.error || t(`${rows.length} of ${view.total ?? 0} revisions shown`, `${view.total ?? 0} 個版本之中顯示 ${rows.length} 個`);
    chips.replaceChildren(...Object.entries(view.counts).map(([action, n]) => h("button", { class: `chip ${view.actions.has(action) ? "on" : ""}`, "aria-pressed": String(view.actions.has(action)), onClick: () => { view.actions.has(action) ? view.actions.delete(action) : view.actions.add(action); paint(); } }, (ACTION_LABEL[action] ? t(...ACTION_LABEL[action]) : action), ` ${n}`)));
    list.replaceChildren(...(rows.length ? rows.slice(0, 200).map((r) => h("div", { class: `row lh-row ${view.picked.includes(r.rev) ? "sel" : ""}` },
      h("input", { type: "checkbox", checked: view.picked.includes(r.rev), "aria-label": `${t("Pick revision", "揀版本")} ${r.rev}`, onChange: (e) => { view.picked = e.target.checked ? [...view.picked, r.rev].slice(-2) : view.picked.filter((x) => x !== r.rev); paint(); } }),
      h("div", { class: "grow" }, h("strong", {}, `#${r.rev}`), " ", h("span", { class: "tag" }, ACTION_LABEL[r.action] ? t(...ACTION_LABEL[r.action]) : r.action), h("div", { class: "muted" }, `${r.at.replace("T", " ").slice(0, 19)} UTC${r.user ? ` · ${r.user}` : ""}${r.label ? ` · ${r.label}` : ""}`), r.changed.length ? h("div", { class: "muted lh-paths" }, r.changed.slice(0, 3).join(", ")) : null),
      h("button", { class: "btn t sm", onClick: () => detail(r.rev) }, icon("difference", "sm"), t("Details", "詳情")))) : [h("div", { class: "empty" }, icon("history", "lg"), t("No revision matches.", "冇符合嘅版本。"))]));
    compare.disabled = view.picked.length !== 2;
  }

  async function detail(rev) {
    const r = await api.get(`/api/x/local-history/revisions/${rev}`);
    ctx.openDialog((close) => [
      h("h2", { class: "h2" }, `${t("Revision", "版本")} #${r.rev}`),
      h("p", { class: "muted" }, `${r.at.replace("T", " ").slice(0, 19)} UTC${r.restoredFrom ? ` · ${t("restored from", "還原自")} #${r.restoredFrom}` : ""}`),
      diffView(r.diff),
      h("div", { class: "actions" },
        h("button", { class: "btn o", onClick: () => close() }, t("Close", "關閉")),
        h("button", { class: "btn t", onClick: async () => {
          const name = h("input", { class: "field", maxlength: "80", "aria-label": t("Label for this revision", "呢個版本嘅標籤") });
          const ok = await ctx.openDialog((done) => [h("h2", { class: "h2" }, t("Label this revision", "標籤呢個版本")), name, h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => done(false) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: () => done(true) }, t("Save label", "儲存標籤")))], { label: t("Label", "標籤") }).closed;
          if (ok && name.value.trim()) { await api.post("/api/x/local-history/label", { rev, label: name.value }); close(); await load(); }
        } }, icon("label", "sm"), t("Add a label", "加標籤")),
        ctx.state.me?.role === "owner" ? h("button", { class: "btn f", onClick: async () => { close(); await restore(rev); } }, icon("restore", "sm"), t("Restore settings", "還原設定")) : null),
    ], { label: `${t("Revision", "版本")} ${r.rev}` });
  }

  const diffView = (diff) => diff.length ? h("div", { class: "tbl lh-diff" }, h("table", {}, h("thead", {}, h("tr", {}, ["Path", "Before", "After"].map((c) => h("th", {}, c)))), h("tbody", {}, diff.slice(0, 200).map((d) => h("tr", {}, h("td", { class: "mono" }, d.path), h("td", {}, d.before === undefined ? "-" : String(d.before)), h("td", {}, d.after === undefined ? "-" : String(d.after))))))) : h("div", { class: "empty" }, t("No differences.", "冇分別。"));

  async function restore(rev) {
    if (!(await ctx.confirmDialog({ title: t(`Restore revision #${rev}?`, `還原版本 #${rev}？`), body: t("The app's settings go back to how they were then. This is recorded as a new revision, so you can restore again to undo it. Accounts, router connection and credentials are not changed.", "程式設定會返回嗰陣嘅狀態。呢個動作會記錄成新版本，所以可以再還原嚟撤銷。帳戶、路由器連線同憑證唔會改變。"), confirm: t("Restore", "還原") }))) return;
    try {
      const out = await api.post("/api/x/local-history/restore", { rev });
      toast(t(`Restored. New revision #${out.revision?.rev ?? "?"}.`, `已還原。新版本 #${out.revision?.rev ?? "?"}。`));
      await load();
    } catch (error) {
      toast(error.message, "bad");
    }
  }

  const compare = h("button", { class: "btn t", disabled: true, onClick: async () => {
    const [a, b] = [...view.picked].sort((x, y) => x - y);
    const out = await api.get(`/api/x/local-history/diff?a=${a}&b=${b}`);
    ctx.openDialog((close) => [h("h2", { class: "h2" }, `#${a} → #${b}`), diffView(out.diff), h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close() }, t("Close", "關閉")))], { label: `${a} to ${b}` });
  } }, icon("compare_arrows", "sm"), t("Compare the two picked", "比較揀咗嘅兩個"));

  const prune = h("button", { class: "btn d", onClick: async () => {
    const keep = 100;
    const token = await askSuper(ctx, { action: "local-history.prune", title: t("Prune old versions", "清理舊版本"), affects: [t(`Permanently removes older revisions, keeping the first record and the newest ${keep - 1}. This cannot be undone.`, `永久移除較舊嘅版本，只保留第一個記錄同最新 ${keep - 1} 個。呢個動作無法撤銷。`)] });
    if (!token) return toast(t("Cancelled. Nothing was removed.", "已取消，冇移除任何嘢。"));
    try {
      const out = await api.post("/api/x/local-history/prune", { keep, token });
      toast(t(`Removed ${out.removed}; kept ${out.kept}.`, `已移除 ${out.removed} 個；保留 ${out.kept} 個。`));
      await load();
    } catch (error) {
      toast(error.message, "bad");
    }
  } }, icon("cleaning_services", "sm"), t("Prune old versions", "清理舊版本"));

  const exportBtn = h("button", { class: "btn t", onClick: async () => {
    const out = await api.get("/api/x/local-history/export");
    const a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" })), download: "version-history.json" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } }, icon("download", "sm"), t("Export (secrets hidden)", "匯出（隱藏密碼）"));

  root.append(
    h("section", { class: "card tone" }, h("p", {}, t(`${status.count} revisions kept in an isolated file beside the app data. Restorable: settings. Recorded for comparison only: ${status.recordedOnly.join(", ")}.`, `喺程式資料旁邊嘅獨立檔案保存咗 ${status.count} 個版本。可還原：設定。只作比較記錄：${status.recordedOnly.join("、")}。`)), status.damagedLines ? h("div", { class: "note warn" }, icon("build"), t(`${status.damagedLines} unreadable line(s) from an interrupted write were skipped. Every complete revision is intact.`, `有 ${status.damagedLines} 行因中斷寫入而無法讀取，已跳過。所有完整版本都冇損壞。`)) : null),
    h("section", { class: "card" },
      h("div", { class: "lh-filters" }, dateField(t("From date", "由日期"), "from"), dateField(t("To date", "至日期"), "to")),
      h("div", { class: "lh-search" }, search, h("label", { class: "lh-rx" }, regex, t("Regex", "正則"))),
      chips, info,
      h("div", { class: "actions" }, compare, exportBtn, ctx.state.me?.role === "owner" ? prune : null),
      list));
  ctx.root.append(ctx.page(label, { en: "Every change to the app's saved settings and records, kept locally. Restoring adds a new version; it never rewrites an old one.", yue: "程式儲存嘅設定同記錄嘅每次改動都喺本機保存。還原會新增一個版本，唔會改寫舊版本。" }, root));
  await load();
}

export default {
  id: "local-history",
  screens: [{ id: "local-history", group, icon: "history", label, render }],
  overlays: [{ id: "local-history.start", mount: (ctx) => void ctx.api.get("/api/x/local-history/status").catch(() => {}) }],
  commands: [{ id: "local-history.open", icon: "history", label: { en: "Open version history", yue: "開啟版本記錄" }, keywords: "restore revisions undo settings", run: (ctx) => ctx.navigate("local-history") }],
};
