// Merlin add-ons: read-only status cards for what is in /jffs/addons, with a
// button that launches an add-on's own version command when one is reviewed.
// See server/features/addons.
const BASE = "/api/x/addons";
const label = { en: "Merlin add-ons", yue: "Merlin 附加程式" };
const lede = { en: "What is installed in /jffs/addons, shown read-only. This app never installs, updates or removes an add-on.", yue: "/jffs/addons 入面裝咗乜嘢（只讀）。呢個程式唔會安裝、更新或者移除附加程式。" };
const kb = (n) => (n === null ? "?" : n >= 1024 ? `${(n / 1024).toFixed(1)} MB` : `${n} KB`);

async function draw(ctx, root) {
  const { api, h, icon, t, tt, toast, state } = ctx;
  const data = await api.get("/api/domain/addons");
  const page = ctx.page(label, lede);
  root.replaceChildren(page);
  if (!state.catalog.info.merlin) {
    page.append(h("section", { class: "card" }, h("div", { class: "note warn" }, icon("block"), h("div", {}, t("Add-ons need Asuswrt-Merlin. This router runs the original ASUS firmware.", "附加程式需要 Asuswrt-Merlin。呢部路由器用緊原廠 ASUS 韌體。")))));
    return;
  }
  if (!data.addons.length) {
    page.append(h("section", { class: "card ad-empty rise" }, icon("extension_off", "lg"), h("h2", { class: "h2" }, t("No add-ons found", "搵唔到附加程式")), h("p", { class: "muted" }, t("/jffs/addons is empty. Add-ons are usually installed with the amtm menu.", "/jffs/addons 係空嘅。附加程式通常用 amtm 選單安裝。"))));
    return;
  }
  const grid = h("div", { class: "ad-grid" });
  data.addons.forEach((a, i) => {
    const out = h("pre", { class: "ad-out mono", hidden: true, "aria-live": "polite" });
    const stamp = h("div", { class: "t2" });
    const run = a.command
      ? h("button", { class: "btn f sm", disabled: !state.canWrite, onClick: async (e) => {
          const button = e.currentTarget;
          button.disabled = true;
          out.hidden = false;
          out.textContent = t("Asking the add-on…", "問緊個附加程式…");
          try {
            const r = await api.post(`${BASE}/status`, { key: a.key });
            out.textContent = r.output.trim() || t("The add-on printed nothing.", "個附加程式冇輸出。");
            out.classList.toggle("ad-bad", r.code !== 0);
            stamp.textContent = `${new Date(r.at).toLocaleTimeString()} · exit ${r.code}`;
          } catch (error) {
            out.textContent = error.message;
            out.classList.add("ad-bad");
            toast(error.message, "bad");
          } finally {
            button.disabled = !state.canWrite;
          }
        } }, icon("play_arrow", "sm"), t("Ask for its version", "查詢版本"))
      : null;
    const card = h("article", { class: "card ad-card rise" },
      h("div", { class: "sa-head ad-head" }, h("span", { class: "ad-ico" }, icon("extension")), h("div", { class: "grow" }, h("h2", { class: "h2" }, a.name), h("div", { class: "t2 mono" }, `/jffs/addons/${a.folder}`)), h("span", { class: `tag ${a.known ? "good" : ""}` }, a.known ? t("Reviewed", "已審視") : t("Unknown to this app", "本程式未認識"))),
      h("p", { class: "muted" }, tt(a.about)),
      h("div", { class: "two" }, h("div", {}, h("div", { class: "k" }, t("Size on flash", "佔用空間")), h("div", { class: "t1" }, kb(a.sizeKb))), h("div", {}, h("div", { class: "k" }, t("Its own command", "佢自己嘅命令")), h("div", { class: "t1 mono ad-cmd" }, a.command ?? t("none reviewed", "未有審視過")))),
      run ? h("div", { class: "actions" }, run) : h("div", { class: "t2" }, a.key === "amtm" ? t("amtm is a menu: open it from the terminal.", "amtm 係選單，請喺終端機開啟。") : a.known ? t("Its script is not on the router, so nothing can be launched.", "路由器上冇佢嘅腳本，所以冇嘢可以啟動。") : t("This app has no reviewed command for it.", "本程式未有審視過佢嘅命令。")),
      out, stamp);
    card.style.setProperty("--i", String(i));
    grid.append(card);
  });
  page.append(grid, h("section", { class: "card tone" }, h("h2", { class: "h2" }, icon("terminal", "sm"), " ", t("Start-up scripts", "開機腳本")), data.scripts.length ? h("div", { class: "ad-scripts" }, data.scripts.map((s) => h("span", { class: "tag mono" }, s))) : h("div", { class: "t2" }, t("No scripts in /jffs/scripts.", "/jffs/scripts 冇腳本。")), h("div", { class: "t2" }, t("These run by themselves at the moments their names say. Edit them in the action catalogue's file browser.", "呢啲腳本會喺佢哋名稱所講嘅時機自動執行。可以喺動作目錄嘅檔案瀏覽器編輯。"))));
}

export default {
  id: "addons",
  screens: [{ id: "addons", group: { en: "Power tools", yue: "進階工具" }, icon: "extension", label, render: (ctx) => draw(ctx, ctx.root) }],
  commands: [{ id: "addons.open", icon: "extension", label, keywords: "amtm merlin add-ons spdmerlin connmon scripts jffs", run: (ctx) => ctx.navigate("addons") }],
};
