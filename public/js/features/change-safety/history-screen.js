// The history manager: a timeline of every change grouped by day or area,
// filters and search (with the regex builder next to the box), a readable diff
// of any entry, compare any two points, per-setting history, restore one
// setting or everything to a point, bookmarks, statistics, pending changes
// and exports. Every entry carries a before-and-after picture of its real
// old and new values.
import { api, bus, clear, h, icon, openDialog, t, tt, toast } from "../../core.js";
import { AREAS, EXPORTS, areaName, checkPattern, describeChange, groupTimeline, historyQuery, shown } from "./model.js";
import { guarded, levelBadge, rawPost, refreshUndo, safety, openProgress, redo, undo } from "./safety.js";
import { simulateChange } from "./sims/index.js";

const PAGE = 40;
const TABS = [["timeline", "history", "Timeline", "時間線"], ["compare", "compare_arrows", "Compare", "比較"], ["setting", "tune", "One setting", "單一設定"], ["bookmarks", "bookmark", "Bookmarks", "書籤"], ["stats", "bar_chart", "Statistics", "統計"], ["pending", "schedule", "Pending", "等待中"], ["export", "download", "Export", "匯出"]];

export function saveBlob(name, type, text) {
  const blob = new Blob([text], { type });
  const a = h("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const whenText = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString([], { hour12: false, year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const errText = (e) => e?.message ?? String(e);

export function bar(label, n, max, cls = "") {
  const row = h("div", { class: `statbar ${cls}` }, h("span", { class: "sb-l" }, label), h("span", { class: "sb-t" }, h("span", { class: "sb-f" })), h("span", { class: "sb-n" }, String(n)));
  row.querySelector(".sb-f").style.setProperty("--w", `${max ? Math.max(3, Math.round((n / max) * 100)) : 0}%`);
  return row;
}

export async function historyScreen(root) {
  const filters = { area: "", person: "", mode: "", source: "", impact: "", since: "", until: "", text: "", regex: "" };
  const state = { tab: "timeline", by: "day", items: [], total: 0, offset: 0, open: null, detail: null, loading: false, a: "", b: "", bookmarks: [], settingKey: "", error: "" };
  const page = h("div", { class: "page hist" });
  root.append(page);
  const body = h("div", { class: "hist-body" });
  const bar1 = h("div", { class: "hist-bar" });
  let search;

  const bookmarkOf = (oid) => state.bookmarks.filter((b) => b.oid === oid);

  async function load({ more = false } = {}) {
    state.loading = true;
    if (!more) state.offset = 0;
    drawBody();
    try {
      const query = historyQuery(filters, { limit: PAGE, offset: state.offset });
      const out = await api.get(`/api/safety/history${query}`);
      state.items = more ? [...state.items, ...out.items] : out.items;
      state.total = out.total;
      state.error = "";
    } catch (error) {
      state.error = errText(error);
      if (!more) state.items = [];
    }
    try { state.bookmarks = (await api.get("/api/safety/history/bookmarks")).items ?? []; } catch {}
    state.loading = false;
    drawBody();
  }

  // ---- filters ------------------------------------------------------------------------------

  function filterBar() {
    const areas = Object.keys(AREAS);
    const select = (key, label, options) => h("label", { class: "field" }, h("span", {}, label), h("select", { onChange: (e) => { filters[key] = e.target.value; load(); } }, h("option", { value: "" }, t("Any", "任何")), options.map(([v, text]) => h("option", { value: v, selected: filters[key] === String(v) }, text))));
    const date = (key, label) => h("label", { class: "field" }, h("span", {}, label), h("input", { type: "date", value: filters[key], onChange: (e) => { filters[key] = e.target.value ? new Date(`${e.target.value}T${key === "until" ? "23:59:59" : "00:00:00"}`).toISOString() : ""; load(); } }));
    search = h("input", { type: "search", "data-search-id": "history-search", "aria-label": t("Search the history", "搜尋改動記錄"), placeholder: t("Search what changed", "搜尋改咗啲乜"), autocomplete: "off", value: "" });
    const apply = () => {
      const rx = globalThis.marNav?.regex?.stateOf?.(search);
      const isRegex = rx?.mode === "regex";
      filters.text = isRegex ? "" : search.value.trim();
      filters.regex = isRegex ? search.value : "";
      const check = isRegex ? checkPattern(search.value, rx.flags) : { ok: true };
      search.setAttribute("aria-invalid", String(!check.ok));
      if (check.ok) load();
    };
    let timer;
    search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(apply, 280); });
    return h("div", { class: "hist-filters" },
      h("div", { class: "hist-search" }, h("label", { class: "search" }, icon("search"), search)),
      h("div", { class: "grid4" },
        select("area", t("Area", "範圍"), areas.map((a) => [a, tt(areaName(a))])),
        select("mode", t("Mode", "模式"), [["live", t("Live", "即時")], ["review", t("Review", "檢查")], ["quiet", t("Quiet apply", "靜音套用")]]),
        select("impact", t("Impact", "影響"), [[0, "0"], [1, "L1"], [2, "L2"], [3, "L3"]]),
        h("label", { class: "field" }, h("span", {}, t("Person", "人")), h("input", { type: "text", value: filters.person, placeholder: t("Anyone", "任何人"), onChange: (e) => { filters.person = e.target.value.trim(); load(); } })),
        date("since", t("From", "由")), date("until", t("To", "至")),
        h("button", { class: "btn o sm", onClick: () => { for (const k of Object.keys(filters)) filters[k] = ""; search.value = ""; clear(bar1).append(...headBar()); drawFilters(); load(); } }, icon("filter_alt_off", "sm"), t("Clear filters", "清除篩選"))));
  }
  const filtersHost = h("div", {});
  const drawFilters = () => clear(filtersHost).append(filterBar());

  const headBar = () => [
    h("div", { class: "seg tabs-in", role: "tablist", "aria-label": t("History views", "記錄檢視") }, TABS.map(([id, ic, en, yue]) => h("button", { role: "tab", "aria-selected": String(state.tab === id), class: state.tab === id ? "on" : "", onClick: () => { state.tab = id; clear(bar1).append(...headBar()); drawBody(); } }, icon(ic, "sm"), t(en, yue)))),
    h("div", { class: "hist-actions" },
      h("button", { class: "btn t sm", disabled: !safety.undo.length, onClick: undo, title: "Ctrl+Z" }, icon("undo", "sm"), t("Undo", "還原")),
      h("button", { class: "btn t sm", disabled: !safety.redo.length, onClick: redo, title: "Ctrl+Shift+Z" }, icon("redo", "sm"), t("Redo", "重做"))),
  ];

  // ---- the timeline -----------------------------------------------------------------------------

  function entryCard(item) {
    const marks = bookmarkOf(item.oid);
    const open = state.open === item.oid;
    return h("article", { class: `hist-entry ${open ? "open" : ""}`, "data-oid": item.oid },
      h("div", { class: "he-top" },
        levelBadge(item.impact ?? 0, { label: false }),
        h("div", { class: "grow" },
          h("div", { class: "t1" }, item.subject),
          h("div", { class: "t2" }, `${whenText(item.at)} · ${item.person}`, " · ", h("span", { class: `tag ${item.mode === "review" ? "" : "good"}` }, item.mode === "review" ? t("Review", "檢查") : item.mode === "quiet" ? t("Quiet apply", "靜音套用") : t("Live", "即時")), item.override ? h("span", { class: "tag warn" }, t("Owner override", "擁有人覆寫")) : null),
          h("div", { class: "chips" }, (item.areas ?? []).map((a) => h("span", { class: "chip" }, tt(areaName(a)))), marks.map((m) => h("span", { class: "chip mark" }, icon("bookmark", "sm"), m.label)))),
        h("button", { class: "btn t sm", "aria-expanded": String(open), onClick: () => toggle(item) }, icon(open ? "expand_less" : "expand_more", "sm"), t(open ? "Close" : "Open", open ? "收埋" : "打開"))),
      open ? detailView(item) : null);
  }

  async function toggle(item) {
    if (state.open === item.oid) {
      state.open = null;
      state.detail = null;
      return drawBody();
    }
    state.open = item.oid;
    state.detail = null;
    drawBody();
    try {
      state.detail = await api.get(`/api/safety/history/${item.oid}`);
    } catch (error) {
      toast(errText(error), "bad");
      state.open = null;
    }
    drawBody();
  }

  function detailView(item) {
    const d = state.detail;
    if (!d) return h("div", { class: "he-body" }, h("div", { class: "row" }, h("div", { class: "spin" }), t("Reading this version…", "讀緊呢個版本…")));
    return h("div", { class: "he-body" },
      d.commit?.body ? h("p", { class: "muted pre" }, d.commit.body) : null,
      h("div", { class: "he-actions" },
        h("button", { class: "btn f sm", onClick: () => restore(item.oid, { all: true }) }, icon("restore", "sm"), t("Restore everything to this point", "全部還原到呢個時間點")),
        h("button", { class: "btn t sm", onClick: () => bookmarkDialog(item) }, icon("bookmark_add", "sm"), t("Bookmark", "加書籤")),
        h("button", { class: "btn t sm", onClick: () => { state.a = item.oid; state.tab = "compare"; clear(bar1).append(...headBar()); drawBody(); } }, icon("compare_arrows", "sm"), t("Compare with another", "同另一個比較")),
        item.runId ? h("button", { class: "btn t sm", onClick: () => openProgress(item.runId) }, icon("timeline", "sm"), t("Show what happened", "睇返過程")) : null),
      d.changes.length ? d.changes.map((c, i) => changeRow(c, item, d.changes, i === 0)) : h("div", { class: "muted" }, t("This version has no setting changes.", "呢個版本冇設定改動。")));
  }

  function changeRow(c, item, all, first) {
    const label = c.label ?? { en: c.key, yue: c.key };
    const simHost = h("div", { class: "sim-host" });
    const wrap = h("details", { class: "he-change", open: first },
      h("summary", {}, h("span", { class: "t1" }, tt(label)), h("span", { class: "t2 mono" }, `${shown(c, "old") || t("not set", "未設定")} → ${shown(c, "new") || t("cleared", "已清除")}`)),
      h("div", { class: "he-change-body" },
        h("div", { class: "diff" }, h("div", {}, h("div", { class: "t1" }, tt(label)), h("div", { class: "t2 mono" }, c.key, c.secret ? ` · ${t("secret", "機密")}` : "")), h("div", { class: "was" }, shown(c, "old") || t("not set", "未設定")), h("div", { class: "arrow" }, icon("arrow_forward", "sm")), h("div", { class: "now" }, shown(c, "new") || t("cleared", "已清除"))),
        h("div", { class: "he-actions" },
          h("button", { class: "btn t sm", onClick: () => { state.settingKey = c.key; state.tab = "setting"; clear(bar1).append(...headBar()); drawBody(); } }, icon("history", "sm"), t("This setting's history", "呢項設定嘅記錄")),
          c.secret ? h("span", { class: "muted" }, t("Secrets are never restored from history.", "機密唔會由記錄還原。")) : h("button", { class: "btn t sm", onClick: () => restore(item.oid, { key: c.key }) }, icon("settings_backup_restore", "sm"), t("Restore this setting", "還原呢項設定"))),
        simHost));
    const draw = () => { if (!simHost.dataset.drawn) { simHost.dataset.drawn = "1"; try { simulateChange(simHost, { ...c, area: item.areas?.[0] }, { all: all.map((x) => ({ ...x })) }); } catch (error) { simHost.append(h("div", { class: "muted" }, errText(error))); } } };
    if (first) queueMicrotask(draw);
    wrap.addEventListener("toggle", () => wrap.open && draw());
    return wrap;
  }

  // ---- restore -----------------------------------------------------------------------------------------

  async function restore(oid, scope) {
    try {
      if (safety.live) {
        const out = await guarded(async (extra, ctx) => (ctx.previewId ? { applied: await rawPost("/api/changes/apply", { previewId: ctx.previewId, ...extra }), skipped: [] } : rawPost("/api/safety/history/restore", { oid, ...scope, apply: true, ...extra })), {});
        if (!out) return;
        if (out.skipped?.length) toast(t(`${out.skipped.length} setting(s) were left alone (secrets are never restored).`, `有 ${out.skipped.length} 項設定冇動（機密唔會還原）。`));
        if (out.applied?.runId) openProgress(out.applied.runId, t("Restoring", "還原緊"));
        await refreshUndo();
        bus.emit("changed");
        load();
        return;
      }
      const out = await rawPost("/api/safety/history/restore", { oid, ...scope, apply: false });
      if (out.skipped?.length) toast(t(`${out.skipped.length} setting(s) will be left alone (secrets are never restored).`, `有 ${out.skipped.length} 項設定唔會動（機密唔會還原）。`));
      const { reviewPreview } = await import("../../dock.js");
      await reviewPreview(out.preview, { title: t("Restore from history", "由記錄還原") });
      load();
    } catch (error) {
      toast(errText(error), "bad");
    }
  }

  function bookmarkDialog(item) {
    const input = { label: "", note: "" };
    const dlg = openDialog((close) => [
      h("h2", { class: "h2" }, t("Bookmark this point", "為呢個時間點加書籤")),
      h("label", { class: "field" }, h("span", {}, t("Name", "名稱")), h("input", { type: "text", maxlength: "60", placeholder: t("Before the guest network", "未開訪客網絡之前"), onInput: (e) => (input.label = e.target.value) })),
      h("label", { class: "field" }, h("span", {}, t("Note (optional)", "備註（可選）")), h("input", { type: "text", maxlength: "200", onInput: (e) => (input.note = e.target.value) })),
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(null) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: () => close(input) }, icon("bookmark_add", "sm"), t("Save", "儲存"))),
    ], { label: t("Bookmark", "書籤") });
    dlg.closed.then(async (v) => {
      if (!v?.label?.trim()) return;
      try { await api.post("/api/safety/history/bookmarks", { oid: item.oid, label: v.label.trim(), note: v.note }); load(); } catch (error) { toast(errText(error), "bad"); }
    });
  }

  // ---- the other views -------------------------------------------------------------------------------------

  function versionSelect(value, onChange, label) {
    return h("label", { class: "field" }, h("span", {}, label), h("select", { onChange: (e) => onChange(e.target.value) },
      h("option", { value: "" }, t("Pick a version", "揀一個版本")),
      state.items.map((i) => h("option", { value: i.oid, selected: i.oid === value }, `${whenText(i.at)} · ${i.subject.slice(0, 60)}`)),
      state.bookmarks.map((b) => h("option", { value: b.oid, selected: b.oid === value }, `★ ${b.label}`))));
  }

  function compareView() {
    const out = h("div", { class: "hist-result" });
    const run = async () => {
      clear(out);
      if (!state.a || !state.b) return out.append(h("div", { class: "muted" }, t("Pick two versions to see what differs.", "揀兩個版本睇有咩唔同。")));
      out.append(h("div", { class: "row" }, h("div", { class: "spin" }), t("Comparing…", "比較緊…")));
      try {
        const diff = await api.get(`/api/safety/history/diff?a=${encodeURIComponent(state.a)}&b=${encodeURIComponent(state.b)}`);
        clear(out).append(diff.changes.length ? h("div", { class: "cmp-list" }, diff.changes.map((c, i) => changeRow(c, { oid: state.b, areas: [] }, diff.changes, i === 0))) : h("div", { class: "note" }, icon("check_circle"), h("div", {}, t("These two versions are the same.", "呢兩個版本一模一樣。"))), diff.changes.length ? h("div", { class: "he-actions" }, h("button", { class: "btn f sm", onClick: () => restore(state.a, { all: true }) }, icon("restore", "sm"), t("Restore the first version", "還原第一個版本"))) : null);
      } catch (error) {
        clear(out).append(h("div", { class: "note bad" }, icon("error"), h("div", {}, errText(error))));
      }
    };
    queueMicrotask(run);
    return h("div", {}, h("div", { class: "grid2" }, versionSelect(state.a, (v) => { state.a = v; run(); }, t("From", "由")), versionSelect(state.b, (v) => { state.b = v; run(); }, t("To", "至"))), out);
  }

  function settingView() {
    const out = h("div", { class: "hist-result" });
    const input = h("input", { type: "text", value: state.settingKey, placeholder: t("A setting key, such as wl0_ssid", "設定鍵，例如 wl0_ssid"), "aria-label": t("Setting key", "設定鍵"), onChange: (e) => { state.settingKey = e.target.value.trim(); run(); } });
    const run = async () => {
      clear(out);
      if (!state.settingKey) return out.append(h("div", { class: "muted" }, t("Open a change and choose “This setting's history”, or type a setting key.", "喺一項改動揀「呢項設定嘅記錄」，或者輸入設定鍵。")));
      try {
        const data = await api.get(`/api/safety/history/setting?key=${encodeURIComponent(state.settingKey)}`);
        if (!data.items.length) return out.append(h("div", { class: "muted" }, t("This setting has never been changed here.", "呢項設定喺度未改過。")));
        out.append(h("ol", { class: "timeline" }, data.items.map((i, idx) => h("li", { class: "tl-step done" }, h("span", { class: "tl-dot", "aria-hidden": "true" }, icon("edit", "sm")), h("div", { class: "grow" }, h("div", { class: "t1" }, `${i.old ?? t("not set", "未設定")} → ${i.new ?? t("cleared", "已清除")}`), h("div", { class: "t2" }, `${whenText(i.at)} · ${i.person} · ${i.subject}`), h("div", { class: "he-actions" }, h("button", { class: "btn t sm", onClick: () => restore(i.oid, { key: data.key }) }, icon("settings_backup_restore", "sm"), t("Put the setting back to this", "將設定還原成呢個"))))))));
        const last = data.items[0];
        const host = h("div", { class: "sim-host" });
        out.append(host);
        simulateChange(host, { key: data.key, old: last.old, new: last.new, label: last.label ?? { en: data.key, yue: data.key } }, {});
      } catch (error) {
        out.append(h("div", { class: "note bad" }, icon("error"), h("div", {}, errText(error))));
      }
    };
    queueMicrotask(run);
    return h("div", {}, h("label", { class: "field" }, h("span", {}, t("Setting", "設定")), input), out);
  }

  function bookmarksView() {
    if (!state.bookmarks.length) return h("div", { class: "empty" }, icon("bookmark", "lg"), t("No bookmarks yet. Open a change and choose Bookmark.", "仲未有書籤。打開一項改動再揀「加書籤」。"));
    return h("div", {}, state.bookmarks.map((b) => h("div", { class: "row card" }, icon("bookmark"), h("div", { class: "grow" }, h("div", { class: "t1" }, b.label), h("div", { class: "t2" }, `${b.note ?? ""} ${b.at ? `· ${whenText(b.at)}` : ""} ${b.by ? `· ${b.by}` : ""}`)),
      h("button", { class: "btn t sm", onClick: () => restore(b.oid, { all: true }) }, icon("restore", "sm"), t("Restore", "還原")),
      h("button", { class: "icb", "aria-label": t("Remove bookmark", "移除書籤"), onClick: async () => { try { await api.del(`/api/safety/history/bookmarks/${b.id}`); load(); } catch (error) { toast(errText(error), "bad"); } } }, icon("delete")))));
  }

  function statsView() {
    const out = h("div", { class: "stats" }, h("div", { class: "row" }, h("div", { class: "spin" }), t("Counting…", "計緊…")));
    api.get("/api/safety/history/stats").then((s) => {
      const section = (title, rows, fmt) => h("section", { class: "card" }, h("h3", { class: "h2" }, title), rows.length ? rows.map((r) => bar(fmt(r), r.n ?? r.count, Math.max(...rows.map((x) => x.n ?? x.count)), r.cls)) : h("div", { class: "muted" }, t("Nothing yet.", "暫時冇。")));
      clear(out).append(
        h("div", { class: "big" }, String(s.total)), h("div", { class: "t2" }, t("changes recorded", "項改動已記錄")),
        h("div", { class: "grid2" },
          section(t("By day", "按日"), s.perDay.slice(-14), (r) => r.day),
          section(t("By impact", "按影響"), s.perImpact.map((r) => ({ ...r, cls: `lv${r.level}` })), (r) => `L${r.level} ${tt(levelNameOf(r.level))}`),
          section(t("Most changed settings", "最常改嘅設定"), s.mostChanged, (r) => tt(r.label)),
          section(t("By person", "按人"), s.perPerson, (r) => r.person),
          section(t("By mode", "按模式"), s.perMode, (r) => r.mode)));
    }).catch((error) => clear(out).append(h("div", { class: "note bad" }, icon("error"), h("div", {}, errText(error)))));
    return out;
  }
  const levelNameOf = (l) => ({ en: ["No effect", "Small blip", "Wi-Fi drops", "Internet down"][l], yue: ["冇影響", "輕微中斷", "Wi-Fi 會斷", "上網停頓"][l] });

  function pendingView() {
    const out = h("div", {}, h("div", { class: "row" }, h("div", { class: "spin" }), t("Loading…", "載入緊…")));
    const draw = async () => {
      try {
        const { items } = await api.get("/api/safety/pending");
        clear(out).append(items.length ? h("div", { class: "pend-list" }, items.map((p) => h("div", { class: "row card" }, levelBadge(p.impact ?? 0, { label: false }), icon(p.when?.type === "quiet" ? "bedtime" : "schedule"), h("div", { class: "grow" }, h("div", { class: "t1" }, (p.summary ?? []).map((x) => tt(x.label)).join(", ") || p.shortName || p.id), h("div", { class: "t2" }, p.when?.type === "quiet" ? t("When the house is quiet", "屋企冇人用嗰陣") : whenText(p.when?.at), p.when?.notAfter ? ` · ${t("not after", "唔遲過")} ${whenText(p.when.notAfter)}` : "", ` · ${p.status ?? ""} · ${p.user ?? ""}`)), p.status === "pending" ? h("button", { class: "btn o sm", onClick: async () => { try { await api.del(`/api/safety/pending/${p.id}`); draw(); } catch (error) { toast(errText(error), "bad"); } } }, icon("cancel", "sm"), t("Cancel", "取消")) : null))) : h("div", { class: "empty" }, icon("schedule", "lg"), t("Nothing is waiting.", "冇等緊嘅改動。")));
      } catch (error) {
        clear(out).append(h("div", { class: "note bad" }, icon("error"), h("div", {}, errText(error))));
      }
    };
    draw();
    return out;
  }

  function exportView() {
    const result = h("div", { class: "muted", role: "status" });
    return h("div", {}, h("p", { class: "muted" }, t("Exports the entries that match the filters above, up to 1000. Secrets are never included.", "匯出符合上面篩選嘅記錄，最多 1000 項。機密一律唔包括。")),
      h("div", { class: "chips" }, Object.entries(EXPORTS).map(([id, f]) => h("button", { class: "btn t", onClick: async () => {
        result.textContent = t("Preparing…", "準備緊…");
        try {
          const out = await api.get(`/api/safety/history${historyQuery(filters, { limit: 1000 })}`);
          saveBlob(`router-history.${f.ext}`, f.type, f.make(out.items));
          result.textContent = t(`Saved ${out.items.length} entries as ${f.name}.`, `已儲存 ${out.items.length} 項為 ${f.name}。`);
        } catch (error) { result.textContent = errText(error); }
      } }, icon("download", "sm"), f.name))), result);
  }

  // ---- put it together ----------------------------------------------------------------------------------------

  function timelineView() {
    if (state.error) return h("div", { class: "note bad" }, icon("error"), h("div", {}, state.error));
    if (!state.items.length && !state.loading) return h("div", { class: "empty" }, icon("history_toggle_off", "lg"), t("No changes match.", "冇符合嘅改動。"));
    const groups = groupTimeline(state.items, state.by);
    return h("div", {},
      h("div", { class: "seg", role: "radiogroup", "aria-label": t("Group by", "分組") }, [["day", t("By day", "按日")], ["area", t("By area", "按範圍")]].map(([id, label]) => h("button", { role: "radio", "aria-checked": String(state.by === id), class: state.by === id ? "on" : "", onClick: () => { state.by = id; drawBody(); } }, label))),
      groups.map((g) => h("section", { class: "hist-group" }, h("h3", { class: "k" }, state.by === "area" ? tt(areaName(g.key)) : g.key), g.items.map(entryCard))),
      state.items.length < state.total ? h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => { state.offset += PAGE; load({ more: true }); } }, icon("expand_more", "sm"), t(`Show more (${state.total - state.items.length} left)`, `顯示更多（仲有 ${state.total - state.items.length} 項）`))) : null);
  }

  function drawBody() {
    const views = { timeline: timelineView, compare: compareView, setting: settingView, bookmarks: bookmarksView, stats: statsView, pending: pendingView, export: exportView };
    const keepScroll = window.scrollY;
    clear(body).append(state.loading && !state.items.length ? h("div", { class: "row" }, h("div", { class: "spin" }), t("Reading the history…", "讀緊記錄…")) : views[state.tab]());
    window.scrollTo(0, keepScroll);
  }

  page.append(
    h("div", { class: "rise" }, h("h1", { class: "disp" }, t("History manager", "改動記錄管理")), h("p", { class: "lede" }, t("Every change to the router, who made it and when, with a picture of what it did. Go back to any point, one setting or everything.", "路由器每項改動、邊個改、幾時改，仲有圖解釋改咗啲乜。可以返去任何一個時間點，一項設定或者全部。"))),
    bar1, filtersHost, body);
  clear(bar1).append(...headBar());
  drawFilters();
  await load();
  const offs = [bus.on("safety", () => clear(bar1).append(...headBar())), bus.on("changed", () => load())];
  return () => offs.forEach((f) => f());
}
