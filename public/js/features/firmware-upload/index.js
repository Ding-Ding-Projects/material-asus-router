// "Check a firmware file" on the Firmware page. A person can drop or pick a
// firmware file, and this page tells them what it is from the file name, its
// size and the first few kilobytes. It reads the file inside the browser and
// nothing else: the file is never sent to this app or to the router, and no
// firmware is ever flashed. Custom firmware is not supported here, and the page
// says so kindly, with a basket of dim sum.
//
// This module has no network calls on purpose; tests check that.
import { drawBasket } from "./basket.js";
import { inspectFile, sameModel } from "./inspect.js";

const SCREENS = new Set(["firmware", "firmware-pro"]);
const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} bytes`);

function card(ctx) {
  const { h, icon, t, tt, state } = ctx;
  const input = h("input", { type: "file", hidden: true, "aria-hidden": "true", tabindex: "-1" });
  const result = h("div", { class: "fw-result", "aria-live": "polite" });
  const zone = h("div", { class: "fw-zone", role: "button", tabindex: "0", "aria-label": t("Drop a firmware file here, or press Enter to choose one", "將韌體檔案拖放到呢度，或者撳 Enter 揀檔案") },
    icon("upload_file", "lg"),
    h("div", { class: "t1" }, t("Drop a firmware file here", "將韌體檔案拖放到呢度")),
    h("div", { class: "t2" }, t("or press Enter to choose one", "或者撳 Enter 揀檔案")));

  const show = (view) => result.replaceChildren(...[view].flat());

  function close() {
    show([]);
    zone.focus();
  }

  function dimSumOnly() {
    show(h("div", { class: "fw-only", role: "dialog", "aria-label": t("Hong Kong Dim Sum", "Hong Kong Dim Sum") },
      drawBasket(t("A stack of steaming dim sum baskets", "一疊冒煙嘅點心籠")),
      h("h2", { class: "fw-title" }, "Hong Kong Dim Sum"),
      h("button", { class: "btn t", onClick: close }, icon("close", "sm"), t("Close", "關閉"))));
    result.querySelector("button")?.focus();
  }

  function describe(info) {
    const mine = state.catalog?.info?.model;
    const rows = [
      [t("File name", "檔案名稱"), info.name],
      [t("Size", "大小"), `${size(info.size)} (${info.size.toLocaleString()} bytes)`],
      [t("Looks like", "睇落係"), tt(info.kind)],
      info.model ? [t("Router model", "路由器型號"), `${info.model} (${t("from the", "來自")} ${info.from === "file name" ? t("file name", "檔案名稱") : t("name inside the archive", "壓縮檔入面嘅檔名")})`] : null,
      info.version ? [t("Version", "版本"), info.version] : null,
      info.family ? [t("Build", "版本來源"), info.family === "merlin" ? "Asuswrt-Merlin" : t("Original ASUS", "原廠 ASUS")] : null,
    ].filter(Boolean);
    const match = info.model && mine ? (sameModel(info.model, mine) ? { tone: "", ic: "check_circle", en: `The name says ${info.model}, the same as this router (${mine}).`, yue: `檔名寫 ${info.model}，同呢部路由器（${mine}）一樣。` } : { tone: "warn", ic: "warning", en: `The name says ${info.model}, but this router is ${mine}. Never use a file made for a different model.`, yue: `檔名寫 ${info.model}，但呢部路由器係 ${mine}。千萬唔好用另一個型號嘅檔案。` }) : null;
    show([
      h("div", { class: "fw-card-in" },
        h("div", { class: "fw-basket" }, drawBasket(t("A stack of steaming dim sum baskets", "一疊冒煙嘅點心籠"))),
        h("div", { class: "fw-facts" },
          h("h3", { class: "h2" }, t("Here is what this file looks like", "呢個檔案嘅資料")),
          h("div", { class: "fw-rows" }, rows.map(([k, v]) => h("div", { class: "fw-row" }, h("div", { class: "k" }, k), h("div", { class: "t1 mono" }, v)))),
          match ? h("div", { class: `note ${match.tone}` }, icon(match.ic), h("div", {}, t(match.en, match.yue))) : null,
          h("div", { class: "note" }, icon("emoji_food_beverage"), h("div", {}, t("Thanks for bringing a firmware file. This app does not flash firmware, and it does not support custom firmware upgrades at all. The file stayed in your browser: nothing was sent to this app or to the router. To upgrade, use the router's own page or the maker's tool, and keep a settings backup first.", "多謝你帶嚟韌體檔案。呢個程式唔會刷韌體，亦完全唔支援自訂韌體升級。檔案一直留喺你嘅瀏覽器：冇傳送去呢個程式或者路由器。要升級，請用路由器自己嘅網頁或者廠商嘅工具，並先備份設定。"))),
          h("div", { class: "t2" }, t("Only the file name and the first few kilobytes were read. This is a description, not a check: the file's checksum was not verified.", "只讀咗檔名同頭幾 KB。呢個只係描述，唔係檢查：未驗證檔案嘅校驗碼。")),
          h("div", { class: "actions" }, h("button", { class: "btn t", onClick: close }, icon("close", "sm"), t("Clear", "清除"))))),
    ]);
  }

  async function take(file) {
    if (!file) return;
    show(h("div", { class: "row" }, h("div", { class: "spin" }), t("Reading the file in your browser…", "喺你嘅瀏覽器讀取緊檔案…")));
    try {
      const info = await inspectFile(file);
      if (info.vocabulary) dimSumOnly();
      else describe(info);
    } catch {
      show(h("div", { class: "note bad" }, icon("error"), h("div", {}, t("This browser could not read that file.", "呢個瀏覽器讀唔到個檔案。"))));
    }
  }

  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  for (const name of ["dragenter", "dragover"]) zone.addEventListener(name, (e) => { stop(e); zone.classList.add("over"); });
  zone.addEventListener("dragleave", (e) => { stop(e); zone.classList.remove("over"); });
  zone.addEventListener("drop", (e) => { stop(e); zone.classList.remove("over"); take(e.dataTransfer?.files?.[0]); });
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  input.addEventListener("change", () => { const f = input.files?.[0]; input.value = ""; take(f); });

  return h("section", { class: "card fw-cardbox rise", id: "fw-upload" },
    h("h2", { class: "h2" }, icon("fact_check", "sm"), " ", t("Check a firmware file", "檢查韌體檔案")),
    h("p", { class: "muted" }, t("Drop a file to see what it is. It is read here in your browser only: it is never uploaded, never sent to the router and never flashed.", "拖放檔案睇佢係乜。只會喺你嘅瀏覽器讀取：唔會上載、唔會傳去路由器、唔會刷入。")),
    zone, input, result);
}

// Puts the card at the end of the Firmware page whenever that page is drawn.
function mount(ctx) {
  const content = document.getElementById("content");
  if (!content) return () => {};
  const place = () => {
    if (!SCREENS.has(ctx.state.route)) return;
    const page = content.querySelector(".page");
    if (!page || page.querySelector(".spin") || page.querySelector("#fw-upload")) return;
    page.append(card(ctx));
  };
  const observer = new MutationObserver(place);
  observer.observe(content, { childList: true, subtree: true });
  place();
  return () => observer.disconnect();
}

export default {
  id: "firmware-upload",
  overlays: [{ id: "firmware-upload.card", mount }],
  commands: [
    {
      id: "firmware-upload.open",
      icon: "fact_check",
      label: { en: "Check a firmware file", yue: "檢查韌體檔案" },
      keywords: "firmware file upload drop image version model check dim sum",
      run: (ctx) => {
        ctx.navigate(ctx.state.catalog.domains.some((d) => d.id === "firmware-pro") ? "firmware-pro" : "firmware");
        setTimeout(() => document.getElementById("fw-upload")?.scrollIntoView({ block: "center" }), 700);
      },
    },
  ],
};
