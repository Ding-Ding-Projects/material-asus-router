// Universal local file converter. Detects what a file is from its first bytes,
// offers only the conversions that really work in this browser, and shows the
// rest disabled with the dependency that is missing. Nothing leaves the device.
import { CATEGORIES, ConversionQueue, ENCODINGS, IMAGE_FORMATS, STRUCTURED, bytesToBinaryText, bytesToHex, convertEncoding, convertStructured, detectType, hexToBytes, minifyJson, searchCatalog, sniffEncoding, uniqueName } from "./convert.js";
import { convertImage } from "./images.js";
import { makeUi } from "./ui.js";
import { load, save } from "./store.js";
import { makeZip, readZip } from "./zip.js";

const label = { en: "File converter", yue: "檔案轉換器" };
const DEFAULTS = { target: "png", quality: 92, indent: 2, delimiter: ",", detect: false, header: true, encoding: "utf-8", eol: "keep", upper: false };
const TEXTISH = new Set(["json", "yaml", "csv", "xml", "text", "svg"]);

const download = (name, blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};
const swapExt = (name, ext) => `${name.replace(/\.[^.]+$/, "")}.${ext}`;

function render(ctx) {
  const { h, icon, t } = ctx;
  const ui = makeUi(ctx);
  const opts = { ...DEFAULTS, ...load("options", {}) };
  const names = new Set();
  const persist = () => save("options", opts);

  // A converter reads one file and returns { name, blob, lossy }.
  async function convertOne(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = detectType(bytes.subarray(0, 4096), file.name);
    const target = opts.target;
    const lossy = [];
    if (target === "zip") return { name: swapExt(file.name, "zip"), blob: new Blob([makeZip([{ name: file.name, bytes }])], { type: "application/zip" }), lossy, kind };
    if (target === "unzip") {
      const entries = readZip(bytes);
      if (!entries.length) throw new Error("The ZIP file is empty.");
      for (const e of entries) download(uniqueName(e.name.split("/").pop() || "file", names), new Blob([e.bytes]));
      return { name: `${entries.length} file(s)`, blob: null, lossy: ["Only stored ZIP files can be read here; compressed entries are refused rather than guessed."], kind };
    }
    if (target === "hex") return { name: `${file.name}.hex.txt`, blob: new Blob([bytesToHex(bytes, { upper: opts.upper })], { type: "text/plain" }), lossy, kind };
    if (target === "bits") return { name: `${file.name}.bits.txt`, blob: new Blob([bytesToBinaryText(bytes)], { type: "text/plain" }), lossy, kind };
    if (target === "from-hex") return { name: swapExt(file.name, "bin"), blob: new Blob([hexToBytes(new TextDecoder().decode(bytes))]), lossy, kind };
    if (IMAGE_FORMATS.some(([id]) => id === target)) {
      const out = await convertImage(file, target, { quality: opts.quality / 100 });
      return { name: swapExt(file.name, target === "jpeg" ? "jpg" : target), blob: out.blob, lossy: out.lossy, kind };
    }
    if (target === "text-encoding") {
      const out = convertEncoding(bytes, "auto", opts.encoding, { eol: opts.eol });
      return { name: `${file.name.replace(/\.[^.]+$/, "")}.${opts.encoding}.txt`, blob: new Blob([out.bytes]), lossy: [`Read as ${sniffEncoding(bytes)}.`, ...out.lossy], kind };
    }
    if (target === "minify" || target === "pretty") {
      const text = new TextDecoder().decode(bytes);
      const out = target === "minify" ? minifyJson(text) : { text: JSON.stringify(JSON.parse(text.replace(/^﻿/, "")), null, opts.indent), lossy: [] };
      return { name: swapExt(file.name, "json"), blob: new Blob([out.text], { type: "application/json" }), lossy: out.lossy, kind };
    }
    if (STRUCTURED.includes(target)) {
      const from = kind.id === "text" ? STRUCTURED.find((s) => file.name.toLowerCase().endsWith(`.${s}`)) : kind.id;
      if (!STRUCTURED.includes(from)) throw new Error(`This file looks like ${kind.id}, not JSON, YAML, CSV or XML. Rename it with its real extension and try again.`);
      if (from === target) throw new Error(`The file is already ${target.toUpperCase()}. Pick a different target.`);
      const out = convertStructured(new TextDecoder().decode(bytes), from, target, { indent: opts.indent, delimiter: opts.delimiter, detect: opts.detect, header: opts.header });
      return { name: swapExt(file.name, target), blob: new Blob([out.text], { type: "text/plain" }), lossy: out.lossy, kind };
    }
    throw new Error(`There is no converter for "${target}".`);
  }

  const results = h("div", { class: "list" });
  const queueView = h("div", { class: "list" });
  const interrupted = load("interrupted", []);

  const queue = new ConversionQueue(async (item) => {
    const out = await convertOne(item.file);
    if (!out.blob) return { lossy: out.lossy, name: out.name };
    const name = uniqueName(out.name, names);
    names.add(name);
    download(name, out.blob);
    return { name, size: out.blob.size, lossy: out.lossy, kind: out.kind.id };
  }, { onChange: drawQueue });

  function drawQueue() {
    save("interrupted", queue.view().filter((i) => i.status === "queued" || i.status === "running").map((i) => i.name));
    queueView.replaceChildren(queue.view().slice(-30).map((i) => h("div", { class: "row" },
      h("span", { class: `tag ${i.status === "done" ? "good" : i.status === "failed" ? "bad" : ""}` }, i.status),
      h("span", { class: "grow" }, i.name),
      i.summary ? h("span", { class: "t2" }, `${i.summary.name}${i.summary.size ? ` · ${i.summary.size} B` : ""}`) : null,
      i.error ? h("span", { class: "err" }, i.error) : null,
      i.status === "queued" || i.status === "running" ? h("button", { class: "btn o sm", onClick: () => queue.cancel(i.id) }, t("Cancel", "取消")) : null,
      i.summary?.lossy?.length ? h("ul", { class: "t2" }, i.summary.lossy.map((l) => h("li", {}, l))) : null)));
  }

  const picker = h("input", { type: "file", multiple: true, hidden: true, "aria-label": t("Choose files", "揀檔案"), onChange(e) { addFiles([...e.target.files]); e.target.value = ""; } });
  async function addFiles(files) {
    for (const file of files) {
      const kind = detectType(new Uint8Array(await file.slice(0, 4096).arrayBuffer()), file.name);
      results.prepend(h("div", { class: "row" }, icon("description", "sm"), h("span", { class: "grow" }, file.name), h("span", { class: "tag" }, `${kind.id} · ${kind.how}`)));
      queue.add(file, null);
    }
  }
  const drop = h("div", { class: "drop", tabindex: "0", role: "button", "aria-label": t("Drop files to convert, or press Enter to choose", "拖放檔案去轉換，或者按 Enter 揀"),
    onClick: () => picker.click(),
    onKeydown(e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); picker.click(); } },
    onDragover(e) { e.preventDefault(); drop.classList.add("over"); },
    onDragleave: () => drop.classList.remove("over"),
    onDrop(e) { e.preventDefault(); drop.classList.remove("over"); addFiles([...e.dataTransfer.files]); } },
    icon("upload_file"), h("div", {}, h("div", { class: "t1" }, t("Drop files here, or press Enter to choose", "拖放檔案喺度，或者按 Enter 揀")), h("div", { class: "t2" }, t("Files are read on this device, one at a time. The originals are never changed and a result never replaces a file.", "檔案喺你部機入面逐個讀取。原檔永不更改，結果永不覆蓋檔案。"))));

  // ---- target and options -------------------------------------------------
  const targets = [
    ["png", "PNG", "圖片 PNG"], ["jpeg", "JPEG", "圖片 JPEG"], ["webp", "WebP", "圖片 WebP"], ["bmp", "BMP", "圖片 BMP"],
    ["json", "JSON", "JSON"], ["yaml", "YAML", "YAML"], ["csv", "CSV", "CSV"], ["xml", "XML", "XML"],
    ["pretty", "Pretty JSON", "排版 JSON"], ["minify", "Minified JSON", "壓縮 JSON"], ["text-encoding", "Text encoding", "文字編碼"],
    ["hex", "Hex text", "十六進制文字"], ["bits", "Binary text", "二進制文字"], ["from-hex", "Hex text to file", "十六進制轉檔案"], ["zip", "ZIP (stored)", "ZIP（不壓縮）"], ["unzip", "Extract ZIP", "解開 ZIP"],
  ];
  const optionBox = h("div", {});
  function drawOptions() {
    const rows = [];
    rows.push(ui.row({ en: "Convert to", yue: "轉換成" }, { en: "Only conversions that work in this browser are listed. Others are shown disabled in the catalogue below.", yue: "只列出喺呢個瀏覽器行得通嘅轉換。其他喺下面目錄顯示為停用。" }, ui.select(targets.map(([v, en, yue]) => [v, { en, yue }]), opts.target, (v) => { opts.target = v; persist(); drawOptions(); }, { en: "Convert to", yue: "轉換成" }).el));
    if (["jpeg", "webp"].includes(opts.target)) rows.push(ui.row({ en: "Quality", yue: "質素" }, { en: "Higher keeps more detail and makes a bigger file.", yue: "越高越多細節，檔案越大。" }, ui.slider(1, 100, 1, "%", opts.quality, (v) => { opts.quality = v; persist(); }, { en: "Quality", yue: "質素" }).el));
    if (["json", "pretty"].includes(opts.target)) rows.push(ui.row({ en: "Indent", yue: "縮排" }, null, ui.stepper(0, 8, 1, t("spaces", "格"), opts.indent, (v) => { opts.indent = v; persist(); }, { en: "Indent", yue: "縮排" }).el));
    if (opts.target === "csv" || STRUCTURED.includes(opts.target)) {
      rows.push(ui.row({ en: "CSV separator", yue: "CSV 分隔符" }, { en: "Used when reading or writing CSV.", yue: "讀寫 CSV 時使用。" }, ui.seg([[",", { en: "Comma", yue: "逗號" }], [";", { en: "Semicolon", yue: "分號" }], ["\t", { en: "Tab", yue: "Tab" }]], opts.delimiter, (v) => { opts.delimiter = v; persist(); }, { en: "CSV separator", yue: "CSV 分隔符" }).el));
      rows.push(ui.row({ en: "Detect numbers in CSV", yue: "偵測 CSV 數字" }, { en: "Turns 12 and true into a number and a boolean instead of text.", yue: "將 12 同 true 轉成數字同布林，唔係文字。" }, ui.sw(opts.detect, (v) => { opts.detect = v; persist(); }, { en: "Detect numbers", yue: "偵測數字" }).el));
    }
    if (opts.target === "text-encoding") {
      rows.push(ui.row({ en: "Target encoding", yue: "目標編碼" }, { en: "The source encoding is detected from its byte order mark or content.", yue: "來源編碼會由位元組順序標記或內容偵測。" }, ui.select(ENCODINGS, opts.encoding, (v) => { opts.encoding = v; persist(); }, { en: "Target encoding", yue: "目標編碼" }).el));
      rows.push(ui.row({ en: "Line endings", yue: "換行" }, null, ui.seg([["keep", { en: "Keep", yue: "保持" }], ["lf", "LF"], ["crlf", "CRLF"]], opts.eol, (v) => { opts.eol = v; persist(); }, { en: "Line endings", yue: "換行" }).el));
    }
    if (opts.target === "hex") rows.push(ui.row({ en: "Capital letters", yue: "大楷" }, null, ui.sw(opts.upper, (v) => { opts.upper = v; persist(); }, { en: "Capital letters", yue: "大楷" }).el));
    optionBox.replaceChildren(...rows);
  }
  drawOptions();

  // ---- catalogue with search ---------------------------------------------
  const search = { text: "", regex: false, flags: "i" };
  const listBox = h("div", {});
  const searchInput = h("input", { class: "field", type: "search", "aria-label": t("Search conversions", "搜尋轉換"), placeholder: t("Search, for example png or pdf", "搜尋，例如 png 或 pdf"), onInput(e) { search.text = e.target.value; drawCatalog(); } });
  function drawCatalog() {
    const { items, error } = searchCatalog(search.text, search);
    listBox.replaceChildren(error ? h("div", { class: "err" }, error) : null, CATEGORIES.map(([id, en, yue]) => {
      const list = items.filter((c) => c.category === id);
      if (!list.length) return null;
      return h("div", {}, h("h3", { class: "t1" }, t(en, yue)), h("div", { class: "list" }, list.map((c) => h("div", { class: `row ${c.available ? "" : "off"}` },
        icon(c.available ? "check_circle" : "block", "sm"), h("span", { class: "grow" }, c.label),
        c.available ? h("span", { class: "tag good" }, t("Works here", "可用")) : h("span", { class: "t2" }, t("Unavailable: ", "未能用："), c.missing)))));
    }));
  }
  drawCatalog();
  const regexBox = ui.sw(false, (v) => { search.regex = v; drawCatalog(); }, { en: "Regular expression", yue: "正規表達式" });
  const flagBox = ui.seg([["i", { en: "Ignore case", yue: "唔分大細楷" }], ["", { en: "Match case", yue: "分大細楷" }]], "i", (v) => { search.flags = v; drawCatalog(); }, { en: "Case", yue: "大小楷" });

  const pauseLabel = h("span", {}, t("Pause", "暫停"));
  const controls = h("div", { class: "chips" },
    h("button", { class: "btn t sm", onClick() { queue.paused ? queue.resume() : queue.pause(); pauseLabel.textContent = queue.paused ? t("Resume", "繼續") : t("Pause", "暫停"); } }, icon("pause", "sm"), pauseLabel),
    h("button", { class: "btn o sm", onClick: () => queue.cancelAll() }, icon("cancel", "sm"), t("Cancel all", "全部取消")));

  const note = interrupted.length ? h("div", { class: "note warn" }, icon("warning", "sm"), t(`Last time the app closed with ${interrupted.length} file(s) unfinished: ${interrupted.slice(0, 3).join(", ")}. A browser cannot keep files after it closes, so add them again.`, `上次關閉嗰陣有 ${interrupted.length} 個檔案未完成：${interrupted.slice(0, 3).join("、")}。瀏覽器關閉後保留唔到檔案，請重新加入。`)) : null;
  save("interrupted", []);

  const inProgress = h("div", { class: "note warn" }, icon("construction", "sm"),
    t("In progress: PDF, audio, video and compressed archives need bundled, offline-proven engines that are not in this app yet, so they stay disabled with their reason. Not built yet: crash recovery that resumes a half-finished file, streaming for files too large to hold in memory, and an overwrite confirmation (downloads never overwrite anything, so none is needed here).", "進行中：PDF、音訊、影片同壓縮檔要有內置、離線驗證過嘅引擎，呢個程式未有，所以停用並寫明原因。未做：可以接續做咗一半嘅檔案嘅崩潰還原、大到放唔入記憶體嘅串流，同覆寫確認（下載永不覆蓋任何嘢，所以呢度唔需要）。"));

  ctx.root.append(ctx.page(label, { en: "Detects each file from its first bytes and converts images, structured data, text encodings and more, entirely on this device.", yue: "由開頭位元組偵測每個檔案，喺你部機入面轉換圖片、結構化資料、文字編碼等。" }));
  ctx.root.firstChild.append(
    note,
    h("div", { class: "grid2" },
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Convert", "轉換")), drop, picker, optionBox, controls, results, queueView),
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Catalogue", "目錄")), searchInput, ui.row({ en: "Regular expression", yue: "正規表達式" }, { en: "A basic pattern search. The full pattern builder is not built yet.", yue: "基本模式搜尋。完整模式建構器未做。" }, regexBox.el), ui.row({ en: "Case", yue: "大小楷" }, null, flagBox.el), listBox)),
    inProgress);
  return () => queue.cancelAll();
}

export default {
  id: "file-converter",
  screens: [{ id: "file-converter", group: { en: "Tools", yue: "工具" }, icon: "transform", label, render }],
  commands: [{ id: "file-converter.open", icon: "transform", label: { en: "Open the file converter", yue: "開啟檔案轉換器" }, keywords: "convert image json yaml csv xml encoding zip hex", run: (ctx) => ctx.navigate("file-converter") }],
  settings: [{ id: "file-converter", icon: "transform", label, render: (ctx) => ctx.h("div", { class: "t2" }, ctx.t("Converter options are kept in this browser and set on the converter screen.", "轉換器選項儲喺呢個瀏覽器，喺轉換器畫面設定。")) }],
};
