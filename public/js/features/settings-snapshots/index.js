// Settings snapshots screen: save, compare and restore. A restore queues the
// chosen settings in the pending-changes dock, so it gets the same review,
// safety net and undo as any other edit.

const label = { en: "Settings snapshots", yue: "設定快照" };

// A value as a person reads it: On/Off for switches, the option name for choices.
export function friendly(entry, value, t) {
  if (value === null || value === undefined) return t("not set", "未設定");
  if (!entry) return value === "" ? t("empty", "空") : value;
  if (entry.control === "switch") return value === entry.values.on ? t("On", "開") : t("Off", "關");
  if ((entry.control === "select" || entry.control === "segmented") && entry.options) {
    const option = entry.options.find(([v]) => v === value);
    if (option) return t(option[1].en, option[1].yue);
  }
  if (value === "") return t("empty", "空");
  return `${value}${entry.unit && ["number", "slider", "stepper"].includes(entry.control) ? ` ${entry.unit.trim()}` : ""}`;
}

export const groupRows = (rows) => {
  const groups = new Map();
  for (const row of rows) {
    const key = row.group.en;
    if (!groups.has(key)) groups.set(key, { label: row.group, rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
};

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const page = ctx.page(label, { en: "Save the router's settings under a name, see what changed between two moments, and put chosen settings back.", yue: "用名儲存路由器設定，睇兩個時間點之間改咗啲乜，再揀返要還原嘅設定。" });
  ctx.root.append(page);
  let list = [];
  let app = { autoBeforeRestore: true, keep: 30 };
  let from = "";
  let against = "current";
  let result = null;
  const chosen = new Set();
  const listBox = h("div", {});
  const diffBox = h("div", {});
  const entryById = (id) => ctx.state.catalog.entries.find((e) => e.id === id);

  async function load() {
    const data = await api.get("/api/x/settings-snapshots/snapshots");
    list = data.snapshots;
    app = data.settings;
    if (!list.some((s) => s.id === from)) from = list[0]?.id ?? "";
    drawList();
  }

  const name = h("input", { class: "field", maxlength: "60", placeholder: t("Name, for example Before the holiday", "名稱，例如「去旅行前」"), "aria-label": t("Snapshot name", "快照名稱") });
  const note = h("input", { class: "field", maxlength: "200", placeholder: t("Note (optional)", "備註（可選）"), "aria-label": t("Snapshot note", "快照備註") });
  const saveButton = h("button", { class: "btn f", disabled: !ctx.state.canWrite, onClick: async () => {
    try {
      const made = await api.post("/api/x/settings-snapshots/snapshots", { name: name.value, note: note.value });
      name.value = "";
      note.value = "";
      ctx.toast(t(`Saved "${made.name}" with ${made.count} settings.`, `已儲存「${made.name}」，共 ${made.count} 項設定。`));
      from = made.id;
      await load();
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
  } }, icon("photo_camera", "sm"), t("Save a snapshot now", "而家儲存快照"));

  function select(value, onChange, options, aria) {
    const el = h("select", { class: "field", "aria-label": aria, onChange: (e) => onChange(e.target.value) }, options.map(([v, text]) => h("option", { value: v, selected: v === value }, text)));
    return el;
  }

  function drawList() {
    ctx.clear(listBox);
    if (!list.length) return void listBox.append(h("div", { class: "empty" }, icon("photo_camera", "lg"), t("No snapshots yet. Save one above.", "未有快照。喺上面儲存一個。")));
    listBox.append(
      ...list.map((s) => h("div", { class: "row" },
        h("div", { class: "grow" }, h("div", { class: "t1" }, s.name, s.auto ? h("span", { class: "tag" }, t("Automatic", "自動")) : null), h("div", { class: "t2" }, `${new Date(s.at).toLocaleString()} · ${t(`${s.count} settings`, `${s.count} 項設定`)}${s.note ? ` · ${s.note}` : ""}`)),
        h("button", { class: "btn t sm", onClick: () => { from = s.id; compare(); } }, icon("compare_arrows", "sm"), t("Compare", "比較")),
        h("button", { class: "btn o sm", disabled: !ctx.state.canWrite, "aria-label": `${t("Delete", "刪除")} ${s.name}`, onClick: async () => {
          if (!(await ctx.confirmDialog({ title: t(`Delete "${s.name}"?`, `刪除「${s.name}」？`), body: t("The snapshot is removed from this app. The router is not changed.", "快照會由本程式移除，路由器唔會有變。"), confirm: t("Delete", "刪除"), danger: true }))) return;
          await api.del(`/api/x/settings-snapshots/snapshots/${s.id}`);
          await load();
        } }, icon("delete", "sm"), t("Delete", "刪除")))),
      h("div", { class: "chips" },
        h("label", { class: "t2" }, t("Put back settings from", "還原設定，來自")), select(from, (v) => { from = v; }, list.map((s) => [s.id, s.name]), t("Restore from", "還原來源")),
        h("label", { class: "t2" }, t("compared with", "對比")), select(against, (v) => { against = v; }, [["current", t("The router right now", "路由器而家")], ...list.filter((s) => s.id !== from).map((s) => [s.id, s.name])], t("Compare with", "對比")),
        h("button", { class: "btn f", onClick: compare }, icon("difference", "sm"), t("Show what differs", "顯示分別"))));
  }

  async function compare() {
    chosen.clear();
    try {
      result = await api.get(`/api/x/settings-snapshots/diff?a=${encodeURIComponent(from)}&b=${encodeURIComponent(against === from ? "current" : against)}`);
    } catch (error) {
      return void ctx.toast(error.message, "bad");
    }
    for (const row of result.rows) if (row.restorable) chosen.add(row.id);
    drawDiff();
  }

  function drawDiff() {
    ctx.clear(diffBox);
    if (!result) return;
    const right = result.b.id === "current" ? t("Right now", "而家") : result.b.name;
    if (result.same) return void diffBox.append(h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("check_circle", "lg"), t("No differences. The router has the same settings.", "冇分別。路由器設定一樣。"))));
    diffBox.append(
      h("div", { class: "chips" }, h("span", { class: "pill p" }, t(`${result.rows.length} differences`, `${result.rows.length} 項分別`)),
        h("button", { class: "btn t sm", onClick: () => { result.rows.forEach((r) => r.restorable && chosen.add(r.id)); drawDiff(); } }, t("Select all", "全選")),
        h("button", { class: "btn t sm", onClick: () => { chosen.clear(); drawDiff(); } }, t("Select none", "全部唔揀")),
        h("button", { class: "btn f", disabled: !ctx.state.canWrite || !chosen.size, onClick: restore }, icon("history", "sm"), t(`Put back ${chosen.size} from "${result.a.name}"`, `由「${result.a.name}」還原 ${chosen.size} 項`))),
      ...groupRows(result.rows).map((g) => h("section", { class: "card rise" }, h("h2", { class: "h2" }, tt(g.label)),
        h("div", { class: "tbl" }, h("table", {}, h("thead", {}, h("tr", {}, ["", t("Setting", "設定"), result.a.name, right].map((x) => h("th", {}, x)))),
          h("tbody", {}, g.rows.map((r) => {
            const entry = entryById(r.id);
            return h("tr", {}, h("td", {}, h("input", { type: "checkbox", checked: chosen.has(r.id), disabled: !r.restorable, "aria-label": `${t("Put back", "還原")} ${tt(r.label)}`, onChange: (e) => { e.target.checked ? chosen.add(r.id) : chosen.delete(r.id); drawDiff(); } })),
              h("td", {}, h("div", { class: "t1" }, tt(r.label)), r.restorable ? null : h("div", { class: "t2" }, t("Cannot be put back from here", "唔可以喺度還原"))),
              h("td", {}, friendly(entry, r.a, t)), h("td", {}, friendly(entry, r.b, t)));
          })))))));
  }

  async function restore() {
    try {
      const out = await api.post("/api/x/settings-snapshots/restore", { from: result.a.id, ids: [...chosen] });
      for (const change of out.changes) {
        const entry = entryById(change.id);
        if (entry) ctx.dock.setEntry(entry, change.value);
      }
      ctx.toast(t(`${out.changes.length} settings are waiting in your pending changes. Review and apply them from the bar below.${out.safetySnapshot ? " A safety copy of the router as it is now was saved." : ""}`, `${out.changes.length} 項設定已加入待套用改動，喺下面嘅列檢查同套用。${out.safetySnapshot ? "而家嘅設定已另存一份保險快照。" : ""}`));
      if (out.skipped.length) ctx.toast(t(`${out.skipped.length} were left out.`, `有 ${out.skipped.length} 項冇加入。`), "warn");
      await load();
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
  }

  const switchEl = h("button", { class: "sw", role: "switch", "aria-checked": "true", "aria-label": t("Save a safety copy before every restore", "每次還原前先儲存保險快照"), disabled: !ctx.state.canWrite, onClick: () => saveSettings({ autoBeforeRestore: !app.autoBeforeRestore }) }, h("i"));
  const keepInput = h("input", { class: "field num", type: "number", min: "5", max: "100", inputmode: "numeric", "aria-label": t("Snapshots to keep", "保留快照數量"), disabled: !ctx.state.canWrite, onChange: (e) => saveSettings({ keep: Number(e.target.value) }) });
  async function saveSettings(change) {
    try {
      app = await api.put("/api/x/settings-snapshots/settings", { ...app, ...change });
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
    paintSettings();
  }
  function paintSettings() {
    switchEl.setAttribute("aria-checked", String(app.autoBeforeRestore));
    keepInput.value = String(app.keep);
  }

  page.append(
    h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Save a snapshot", "儲存快照")), h("div", { class: "muted" }, t("Passwords and keys are never copied into a snapshot.", "密碼同金鑰唔會複製入快照。")), name, note, h("div", { class: "chips" }, saveButton)),
    h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Your snapshots", "你嘅快照")), listBox),
    diffBox,
    h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Snapshot settings", "快照設定")),
      h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t1" }, t("Save a safety copy before every restore", "每次還原前先儲存保險快照")), h("div", { class: "t2" }, t("Lets you go back if a restore is not what you wanted.", "如果還原唔似預期，可以返轉頭。"))), switchEl),
      h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t1" }, t("Snapshots to keep", "保留快照數量")), h("div", { class: "t2" }, t("The oldest automatic ones go first.", "最舊嘅自動快照會先被移除。"))), keepInput)));
  await load();
  paintSettings();
}

export default {
  id: "settings-snapshots",
  screens: [{ id: "settings-snapshots", group: { en: "Router", yue: "路由器" }, icon: "photo_camera", label, render: screen }],
  commands: [{ id: "settings-snapshots.open", icon: "photo_camera", label: { en: "Save or compare a settings snapshot", yue: "儲存或比較設定快照" }, keywords: "snapshot backup compare restore settings diff 快照 還原 比較", run: (ctx) => ctx.navigate("settings-snapshots") }],
};
