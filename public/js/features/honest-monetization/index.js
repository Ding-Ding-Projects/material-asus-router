// A plain statement that the app is free, where the protected categories live,
// and links to the upstream work this app builds on. It never prompts anyone.
const label = { en: "Free and fair", yue: "免費同公平" };

export default {
  id: "honest-monetization",
  screens: [{
    id: "honest-monetization",
    group: { en: "Help", yue: "幫助" },
    icon: "volunteer_activism",
    label,
    async render(ctx) {
      const { api, h, icon, t, tt, navigate } = ctx;
      const s = await api.get("/api/x/honest-monetization/statement");
      ctx.root.append(ctx.page(label, { en: "This app is free, and these parts will always be.", yue: "呢個程式免費，而下面呢幾部分永遠都係。" },
        h("section", { class: "card" }, h("div", { class: "k" }, t("The honest statement", "坦白講")), h("p", {}, t("Material Asus Router is free. Nothing in it is behind a payment, and it never asks for money, a donation, a review or an upgrade.", "Material Asus Router 係免費嘅。入面冇任何功能要付費，亦唔會問你要錢、捐款、評價或者升級。"))),
        h("section", { class: "card" }, h("div", { class: "k" }, t("Always free", "永遠免費")), s.protectedCategories.map((c) => h("div", { class: "row" }, icon("check_circle"), h("div", { class: "grow" }, tt(c.label)), h("button", { class: "btn t sm", onClick: () => navigate(c.screen) }, t("Open", "開啟"))))),
        h("section", { class: "card" }, h("div", { class: "k" }, t("Built on", "建基於")), s.upstream.map((u) => h("div", { class: "row" }, icon("link"), h("div", { class: "grow" }, h("a", { href: u.url, target: "_blank", rel: "noopener noreferrer" }, u.name), h("div", { class: "muted" }, t(u.en, u.yue))))))));
    },
  }],
  commands: [{ id: "honest-monetization.open", icon: "volunteer_activism", label: { en: "Open the free and fair statement", yue: "開啟免費同公平聲明" }, keywords: "free paid donate pricing", run: (ctx) => ctx.navigate("honest-monetization") }],
};
