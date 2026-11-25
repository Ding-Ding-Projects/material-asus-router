// Fonts: shows that the two fonts are served from this app, that the files
// match the committed manifest (SHA-256), and that the browser really loaded
// them at the weights the app uses.
import { widgets } from "../material-design/ui.js";

const label = { en: "Fonts", yue: "字體" };
const WEIGHTS = [100, 400, 700, 1000];

async function screen(ctx) {
  const w = widgets(ctx);
  const { h, t, icon } = ctx;
  const out = h("div", {});
  const run = async () => {
    out.replaceChildren(h("div", { class: "empty" }, h("div", { class: "spin" }), t("Checking the fonts…", "檢查緊字體…")));
    let verified;
    try { verified = await ctx.api.get("/api/x/vendored-fonts/verify"); } catch (e) { return void out.replaceChildren(w.note("bad", e.message)); }
    const loads = [];
    for (const wt of WEIGHTS) {
      let ok = false;
      try { const faces = await document.fonts.load(`${wt} 16px "Roboto Flex"`); ok = faces.length > 0 && faces.every((f) => f.status === "loaded"); } catch { ok = false; }
      loads.push([`Roboto Flex ${wt}`, ok]);
    }
    let icons = false;
    try { const faces = await document.fonts.load('400 24px "Material Symbols Rounded"', "home"); icons = faces.length > 0 && faces.every((f) => f.status === "loaded"); } catch { icons = false; }
    loads.push(["Material Symbols Rounded 400", icons]);
    const family = getComputedStyle(document.body).fontFamily.split(",")[0].replaceAll('"', "").replaceAll("'", "").trim();
    out.replaceChildren(
      w.note(verified.ok ? "" : "bad", verified.ok ? t("Every font file matches its recorded SHA-256.", "每個字體檔案都同記錄嘅 SHA-256 一致。") : t("A font file is missing or does not match its recorded SHA-256.", "有字體檔案缺失或者同記錄嘅 SHA-256 唔一致。")),
      h("div", { class: "tbl" }, h("table", {},
        h("thead", {}, h("tr", {}, ...[t("Font", "字體"), t("Package", "套件"), t("Axes", "軸"), t("SHA-256", "SHA-256"), t("Result", "結果")].map((x) => h("th", {}, x)))),
        h("tbody", {}, verified.fonts.map((f) => h("tr", {}, h("td", {}, f.family), h("td", {}, `${f.package}@${f.version} (${f.license})`), h("td", {}, f.axes.length ? f.axes.join(", ") : t("none (fixed weight)", "冇（固定粗幼）")), h("td", { class: "mono" }, f.sha256.slice(0, 16) + "…"), h("td", {}, h("span", { class: `tag ${f.match ? "good" : "bad"}` }, f.match ? t("Match", "一致") : f.present ? t("Different", "唔同") : t("Missing", "缺失")))))))),
      h("div", { class: "inv" }, [h("div", { class: "t1" }, `${t("Page text uses", "頁面文字用")}: ${family}`), ...loads.map(([name, ok]) => h("div", { class: "row" }, icon(ok ? "check_circle" : "error"), h("div", { class: "grow" }, name), h("span", { class: `tag ${ok ? "good" : "bad"}` }, ok ? t("Loaded", "已載入") : t("Not loaded", "未載入"))))]),
      h("p", { class: "muted" }, verified.note));
  };
  ctx.root.append(ctx.page(label, { en: "The fonts come with this app. Nothing is fetched from another address.", yue: "字體隨程式附帶，唔會由其他位址攞。" },
    w.card({ en: "Font files and what the browser loaded", yue: "字體檔案同瀏覽器載入咗乜" }, out, h("div", { class: "actions" }, w.button({ en: "Check again", yue: "再檢查" }, "refresh", run, "t"))),
    w.inProgress({ en: "The script that downloads fonts from the font host with a modern browser identity and keeps every unicode-range file is not written. The files come from pinned npm packages, and only the Latin subset is included.", yue: "用現代瀏覽器身分向字體主機下載、並保留每個 unicode-range 檔案嘅腳本未寫。檔案來自已鎖定版本嘅 npm 套件，只包括拉丁字母子集。" })));
  await run();
}

export default {
  id: "vendored-fonts",
  screens: [{ id: "vendored-fonts", group: { en: "Appearance", yue: "外觀" }, icon: "font_download", label, render: screen }],
  commands: [{ id: "vendored-fonts.open", icon: "font_download", label: { en: "Check the fonts", yue: "檢查字體" }, run: (ctx) => ctx.navigate("vendored-fonts") }],
};
