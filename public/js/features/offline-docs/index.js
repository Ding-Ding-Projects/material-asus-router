// The offline documentation browser: every article and wiki page bundled with
// the app, read in the app, with links that resolve inside it and a search
// (plain or regex) over titles and bodies. No page is fetched from the
// internet. If the docs folder is not bundled with the install, the screen says so.
import { parseMarkdown, renderBlocks, slugify } from "./markdown.js";

const label = { en: "Documentation", yue: "說明文件" };
const group = { en: "Help", yue: "幫助" };

async function render(ctx) {
  const { api, h, icon, t, toast } = ctx;
  const idx = await api.get("/api/x/offline-docs/index");
  if (!idx.present) {
    return void ctx.root.append(ctx.page(label, { en: "The documentation is read offline from the app's own files.", yue: "說明文件由程式自己嘅檔案離線閱讀。" }, h("section", { class: "card warn" }, icon("menu_book", "lg"), h("p", {}, t("The documentation is not bundled with this install, so there is nothing to read here. The online site has the same pages. In progress: the container image build must copy the docs folder in.", "呢個安裝冇附帶說明文件，所以呢度冇嘢可以睇。網上版有同樣嘅頁面。進行中：容器映像建置需要將 docs 資料夾複製入去。")))));
  }
  const state = { slug: null, lang: ctx.getLang() === "yue" ? "yue" : "en", q: "", regex: false, corpus: null, hits: null, error: "" };
  const nav = h("nav", { class: "od-nav", "aria-label": t("Documentation pages", "說明文件頁面") });
  const reader = h("article", { class: "od-reader card", "aria-live": "polite" });
  const info = h("p", { class: "muted", role: "status" });

  const byCategory = () => {
    const map = new Map();
    for (const a of idx.articles) (map.get(a.category) ?? map.set(a.category, []).get(a.category)).push(a);
    return [...map.entries()];
  };
  const titleOf = (a) => (state.lang === "yue" && a.yue?.title ? a.yue.title : a.title);

  async function ensureCorpus() {
    if (state.corpus?.lang === state.lang) return state.corpus;
    state.corpus = await api.get(`/api/x/offline-docs/corpus?lang=${state.lang}`);
    return state.corpus;
  }

  async function runSearch() {
    state.error = "";
    if (!state.q) {
      state.hits = null;
      return drawNav();
    }
    let test;
    if (state.regex) {
      if (state.q.length > 120) state.error = t("Use 120 characters or fewer.", "請用 120 個字元或以下。");
      else {
        try {
          const re = new RegExp(state.q, "i");
          test = (p) => re.test(`${p.title}\n${p.text}`);
        } catch (error) {
          state.error = error.message;
        }
      }
    } else {
      const q = state.q.toLowerCase();
      test = (p) => `${p.title}\n${p.text}`.toLowerCase().includes(q);
    }
    if (state.error) {
      state.hits = [];
      return drawNav();
    }
    const corpus = await ensureCorpus();
    state.hits = new Set(corpus.pages.filter(test).map((p) => p.slug));
    drawNav();
  }

  function drawNav() {
    const sections = byCategory();
    info.textContent = state.error || (state.hits ? t(`${state.hits.size} of ${idx.count} pages match.`, `${idx.count} 頁之中有 ${state.hits.size} 頁符合。`) : t(`${idx.count} pages bundled.`, `已附帶 ${idx.count} 頁。`));
    nav.replaceChildren(...sections.map(([section, list]) => {
      const shown = state.hits ? list.filter((a) => state.hits.has(a.slug)) : list;
      if (!shown.length) return null;
      return h("details", { open: Boolean(state.hits) || state.slug?.startsWith(`${section}/`) || undefined }, h("summary", {}, `${section} (${shown.length})`), shown.map((a) => h("button", { class: `od-link ${a.slug === state.slug ? "on" : ""}`, "aria-current": a.slug === state.slug ? "page" : "false", onClick: () => open(a.slug) }, titleOf(a), a.status === "in-progress" ? h("span", { class: "tag warn" }, t("In progress", "開發中")) : null)));
    }));
  }

  async function open(slug, anchor = "") {
    state.slug = slug;
    let page;
    try {
      page = await api.get(`/api/x/offline-docs/article?slug=${encodeURIComponent(slug)}&lang=${state.lang}`);
    } catch (error) {
      reader.replaceChildren(h("div", { class: "note bad" }, icon("error"), error.message));
      return drawNav();
    }
    const blocks = parseMarkdown(page.markdown, slug);
    const twin = idx.articles.find((a) => a.slug === slug)?.yue;
    reader.replaceChildren(
      h("div", { class: "od-top" }, h("h1", { class: "disp" }, page.title), page.status === "in-progress" ? h("span", { class: "tag warn" }, t("In progress", "開發中")) : null),
      page.summary ? h("p", { class: "lede" }, page.summary) : null,
      twin ? h("button", { class: "btn o sm", onClick: () => { state.lang = state.lang === "yue" ? "en" : "yue"; state.corpus = null; open(slug); } }, icon("translate", "sm"), state.lang === "yue" ? "English" : "廣東話") : null,
      ...renderBlocks(h, blocks, (link) => open(link.page, link.anchor)),
      page.related.length ? h("div", {}, h("div", { class: "k" }, t("Related", "相關")), h("div", { class: "chips" }, page.related.map((r) => h("button", { class: "chip", onClick: () => open(r) }, r)))) : null);
    drawNav();
    if (anchor) document.getElementById(`od-${slugify(anchor)}`)?.scrollIntoView({ block: "start" });
    else reader.scrollIntoView({ block: "start" });
  }

  const search = h("input", { class: "field", type: "search", "aria-label": t("Search the documentation", "搜尋說明文件"), placeholder: t("Search titles and text", "搜尋標題同內容"), onInput: (e) => { state.q = e.target.value; runSearch().catch((error) => toast(error.message, "bad")); } });
  const regex = h("input", { type: "checkbox", onChange: (e) => { state.regex = e.target.checked; runSearch(); } });
  ctx.root.append(ctx.page(label, { en: "Every guide and wiki page, bundled with the app and readable without the internet.", yue: "每篇指南同 wiki 頁面都附喺程式內，唔使上網都睇到。" },
    h("div", { class: "od" },
      h("aside", { class: "od-side card" }, h("div", { class: "od-search" }, search, h("label", { class: "od-rx" }, regex, t("Regex", "正則"))), info, nav),
      reader)));
  drawNav();
  reader.append(h("div", { class: "empty" }, icon("menu_book", "lg"), t("Pick a page on the left.", "喺左邊揀一頁。")));
  const first = idx.articles.find((a) => a.slug === "start/quick-tour") ?? idx.articles[0];
  if (first) await open(first.slug);
}

export default {
  id: "offline-docs",
  screens: [{ id: "offline-docs", group, icon: "menu_book", label, render }],
  commands: [{ id: "offline-docs.open", icon: "menu_book", label: { en: "Open the documentation (offline)", yue: "開啟說明文件（離線）" }, keywords: "help docs guides wiki manual", run: (ctx) => ctx.navigate("offline-docs") }],
};
