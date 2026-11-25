// The changelog viewer: every release with its version, date, categorised
// changes and full commit SHA as a link that is checked against GitHub when
// the computer is online. A typed date range and a regex search compose, and
// the filtered view can be copied or saved as Markdown with its range and SHAs.
const label = { en: "Changelog", yue: "更新記錄" };
const group = { en: "Help", yue: "幫助" };

async function render(ctx) {
  const { api, h, icon, t, toast } = ctx;
  const view = { from: "", to: "", q: "", regex: false, data: null, error: "", verified: new Map() };
  const list = h("div", { class: "cl-list" });
  const summary = h("p", { class: "muted", role: "status" });
  const dateError = h("p", { class: "cl-error", role: "alert" });

  const dateInput = (key, name) => {
    const typed = h("input", { class: "field", inputmode: "numeric", maxlength: "10", placeholder: "2026-11-25", "aria-label": name, onInput: (e) => { view[key] = e.target.value.trim(); pick.value = /^\d{4}-\d{2}-\d{2}$/.test(view[key]) ? view[key] : ""; load(); } });
    const pick = h("input", { class: "cl-cal", type: "date", "aria-label": `${name} (${t("calendar", "日曆")})`, onChange: (e) => { view[key] = e.target.value; typed.value = e.target.value; load(); } });
    return h("div", { class: "cl-date" }, h("span", {}, name), h("div", { class: "cl-datebox" }, typed, pick));
  };

  async function load() {
    const params = new URLSearchParams({ from: view.from, to: view.to });
    view.data = await api.get(`/api/x/changelog/releases?${params}`);
    paint();
  }

  function matches() {
    view.error = "";
    const data = view.data;
    if (!data?.present) return [];
    const rows = [];
    let re = null;
    if (view.q && view.regex) {
      if (view.q.length > 120) return (view.error = t("Use 120 characters or fewer.", "請用 120 個字元或以下。")), [];
      try {
        re = new RegExp(view.q, "i");
      } catch (error) {
        return (view.error = error.message), [];
      }
    }
    const ok = (text) => (!view.q ? true : re ? re.test(text) : text.toLowerCase().includes(view.q.toLowerCase()));
    for (const r of data.releases) {
      const groups = r.categories.map((c) => ({ ...c, changes: c.changes.filter((x) => ok(`${r.version} ${c.name} ${x.text} ${x.shas.join(" ")}`)) })).filter((c) => c.changes.length);
      if (groups.length) rows.push({ ...r, categories: groups });
    }
    return rows;
  }

  const shortSha = (s) => s.slice(0, 7);
  async function verify(sha, badge) {
    if (!view.verified.has(sha)) {
      try {
        view.verified.set(sha, (await api.get(`/api/x/changelog/verify?sha=${sha}`)).state);
      } catch {
        view.verified.set(sha, "unverified");
      }
    }
    const state = view.verified.get(sha);
    badge.className = `tag ${state === "verified" ? "good" : state === "not-found" ? "bad" : "warn"}`;
    badge.textContent = state === "verified" ? t("on GitHub", "喺 GitHub") : state === "not-found" ? t("not found on GitHub", "GitHub 搵唔到") : t("not checked (offline?)", "未檢查（離線？）");
  }

  function paint() {
    const data = view.data;
    const err = data?.errors?.[0];
    dateError.textContent = err ? err.message : "";
    if (!data?.present) {
      summary.textContent = "";
      return list.replaceChildren(h("div", { class: "empty" }, icon("history_edu", "lg"), t("CHANGELOG.md was not found next to the app, so there is nothing to show.", "喺程式旁邊搵唔到 CHANGELOG.md，所以冇嘢可以顯示。")));
    }
    const rows = matches();
    const count = rows.reduce((n, r) => n + r.categories.reduce((m, c) => m + c.changes.length, 0), 0);
    summary.textContent = view.error || (err ? "" : t(`${rows.length} releases, ${count} changes shown.`, `顯示 ${rows.length} 個版本、${count} 項更新。`));
    list.replaceChildren(...(rows.length ? rows.map((r) => h("section", { class: "card" },
      h("div", { class: "cl-head" }, h("h2", { class: "h2" }, r.version), h("span", { class: "muted" }, r.date)),
      r.categories.map((c) => h("div", {}, h("div", { class: "k" }, c.name), h("ul", { class: "cl-changes" }, c.changes.map((x) => h("li", {}, x.text, x.shas.map((sha) => { const badge = h("span", { class: "tag" }, "..."); verify(sha, badge); return h("span", { class: "cl-ref" }, " ", h("a", { href: `https://github.com/${data.repo}/commit/${sha}`, target: "_blank", rel: "noopener noreferrer", title: sha }, shortSha(sha)), " ", badge); })))))))) : err ? [] : [h("div", { class: "empty" }, icon("search_off", "lg"), t("No change matches.", "冇符合嘅更新。"))]));
  }

  function asMarkdown() {
    const rows = matches();
    const range = `${view.from || "start"} to ${view.to || "now"}`;
    return [`# Changelog (${range}${view.q ? `, search ${view.regex ? "regex " : ""}"${view.q}"` : ""})`, "", ...rows.flatMap((r) => [`## ${r.version} - ${r.date}`, ...r.categories.flatMap((c) => [`### ${c.name}`, ...c.changes.map((x) => `- ${x.text}${x.shas.length ? ` (${x.shas.join(", ")})` : ""}`)]), ""])].join("\n");
  }

  const search = h("input", { class: "field", type: "search", "aria-label": t("Search the changelog", "搜尋更新記錄"), placeholder: t("Search changes, versions or commits", "搜尋更新、版本或 commit"), onInput: (e) => { view.q = e.target.value; paint(); } });
  const regexBox = h("input", { type: "checkbox", onChange: (e) => { view.regex = e.target.checked; paint(); } });
  ctx.root.append(ctx.page(label, { en: "What changed in each release, with the commit that made each change.", yue: "每個版本改咗咩，以及每項改動嘅 commit。" },
    h("section", { class: "card tone" },
      h("div", { class: "cl-filters" }, dateInput("from", t("From", "由")), dateInput("to", t("To", "至"))),
      dateError,
      h("div", { class: "cl-search" }, search, h("label", { class: "cl-rx" }, regexBox, t("Regex", "正則"))),
      summary,
      h("div", { class: "actions" },
        h("button", { class: "btn t sm", onClick: () => navigator.clipboard?.writeText(asMarkdown()).then(() => toast(t("Copied the filtered view.", "已複製篩選後嘅內容。")), () => toast(t("Copy is not available here.", "呢度用唔到複製。"), "bad")) }, icon("content_copy", "sm"), t("Copy filtered view", "複製篩選結果")),
        h("button", { class: "btn t sm", onClick: () => { const a = h("a", { href: URL.createObjectURL(new Blob([asMarkdown()], { type: "text/markdown;charset=utf-8" })), download: "changelog-view.md" }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } }, icon("download", "sm"), t("Save as Markdown", "儲存做 Markdown")))),
    list));
  await load();
}

export default {
  id: "changelog",
  screens: [{ id: "changelog", group, icon: "history_edu", label, render }],
  commands: [{ id: "changelog.open", icon: "history_edu", label: { en: "Open the changelog (Help)", yue: "開啟更新記錄（幫助）" }, keywords: "release notes versions commits what's new", run: (ctx) => ctx.navigate("changelog") }],
};
