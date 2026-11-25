// Settings that explain themselves. Every setting row gets an "Explain"
// disclosure: what it does, what it accepts, what it causes, and where its
// value comes from (written on the router, or the firmware default). The "All
// settings" screen lists every catalogue setting in task-oriented groups with
// a search box (and its regex builder), reset of waiting edits, and a way
// back to the change history for recovery.
import { explainEntry } from "./explain.js";

const NAV = (globalThis.marNav ??= {});
NAV.explain = { explainEntry };

function decorate(ctx, row) {
  if (row.dataset.seDone) return;
  row.dataset.seDone = "1";
  const entry = ctx.state.catalog?.entries?.find((e) => e.id === row.id.slice(2));
  const grow = row.querySelector(".top .grow");
  if (!entry || !grow) return;
  const { h, icon, t, tt } = ctx;
  const panel = h("div", { class: "se-panel", hidden: true });
  const btn = h("button", { type: "button", class: "se-more", "aria-expanded": "false", "aria-controls": `se-${entry.id}` }, icon("expand_more", "sm"), t("Explain", "解釋"));
  panel.id = `se-${entry.id}`;
  btn.addEventListener("click", () => {
    const open = panel.hidden;
    if (open && !panel.firstChild) {
      const limits = NAV.guidance?.build(entry).limits ?? null;
      const x = explainEntry(entry, limits);
      panel.append(h("p", {}, tt(x.summary)), h("ul", {}, x.details.map((d) => h("li", {}, tt(d)))), h("p", { class: "mono t2" }, tt(x.provenance)));
    }
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.firstChild.textContent = open ? "expand_less" : "expand_more";
  });
  grow.append(btn);
  row.append(panel);
}

async function allSettings(ctx) {
  const { h, icon, t, tt } = ctx;
  const catl = ctx.state.catalog;
  const input = h("input", { type: "search", class: "field", "data-search-id": "all-settings", "aria-label": t("Search every setting", "搜尋所有設定"), placeholder: t("Search every setting", "搜尋所有設定") });
  const count = h("div", { class: "t2", role: "status" });
  const cards = h("div", { class: "grid2" });
  const draw = () => {
    const rx = NAV.regex?.stateOf(input);
    const m = rx?.mode === "regex" ? NAV.regex.matcherFor(input) : null;
    const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const test = m ? m.test : (s) => words.every((w) => s.toLowerCase().includes(w));
    let shown = 0;
    const out = [];
    for (const d of catl.domains) {
      const entries = catl.entries.filter((e) => e.domain === d.id && test(`${e.label.en}
${e.label.yue}
${e.key}
${e.help.en}
${e.help.yue}`));
      if (!entries.length) continue;
      shown += entries.length;
      out.push(h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon(d.icon, "sm"), " ", tt(d.label)), ctx.controls.settingGroups(entries).map((g) => ctx.controls.groupCard(g.label, g.entries))));
    }
    cards.replaceChildren(...out);
    if (!out.length) cards.append(h("div", { class: "empty" }, icon("search_off", "lg"), m?.error ? tt(m.error) : t("No setting matches.", "冇設定配對。")));
    count.textContent = t(`${shown} of ${catl.entries.length} settings shown`, `顯示 ${shown} / ${catl.entries.length} 項設定`);
  };
  input.addEventListener("input", draw);
  draw();
  const tools = h("div", { class: "chips" },
    h("button", { type: "button", class: "btn t sm", onClick: () => { ctx.dock.clear(); ctx.bus.emit("changed"); ctx.toast(ctx.t("Waiting edits discarded.", "等緊嘅改動已放棄。")); } }, icon("undo", "sm"), t("Discard waiting edits", "放棄等緊嘅改動")),
    h("button", { type: "button", class: "btn t sm", onClick: () => ctx.navigate("history") }, icon("history", "sm"), t("Recover from the change history", "由變更記錄還原")));
  ctx.root.append(ctx.page({ en: "All settings", yue: "所有設定" }, { en: "Every setting the app can change, grouped by task, with an explanation for each.", yue: "程式可以改嘅所有設定，按任務分組，每項都有解釋。" }, h("section", { class: "card" }, input, count, tools), cards));
}

export default {
  id: "settings-explanations",
  overlays: [
    {
      id: "settings-explanations.rows",
      mount(ctx) {
        const scan = (root) => root.querySelectorAll?.(".setting[id^='s-']").forEach((r) => decorate(ctx, r));
        scan(document);
        const observer = new MutationObserver((records) => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) { if (n.matches?.(".setting[id^='s-']")) decorate(ctx, n); scan(n); } });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
      },
    },
  ],
  screens: [{ id: "all-settings", group: { en: "Router", yue: "路由器" }, icon: "tune", label: { en: "All settings", yue: "所有設定" }, render: allSettings }],
  commands: [{ id: "settings-explanations.open", icon: "tune", label: { en: "Open all settings", yue: "打開所有設定" }, keywords: "every setting search explain", run: (ctx) => ctx.navigate("all-settings") }],
};
