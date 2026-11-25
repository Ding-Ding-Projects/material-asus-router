// Export everything: pick a kind of record and a format, read what the format
// loses, then download. Secrets are always hidden. A ZIP archive can bundle
// every kind. JSON, CSV and YAML files can be read back here to check them.
const label = { en: "Exports", yue: "匯出" };
const group = { en: "Records", yue: "記錄" };

export function saveFile(h, out) {
  const bytes = out.contentEncoding === "base64" ? Uint8Array.from(atob(out.content), (c) => c.charCodeAt(0)) : new TextEncoder().encode(out.content);
  const a = h("a", { href: URL.createObjectURL(new Blob([bytes], { type: out.mime })), download: out.filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function render(ctx) {
  const { api, h, icon, t, tt, toast } = ctx;
  const info = await api.get("/api/x/exports/formats");
  const state = { kind: "settings", format: "json", kinds: new Set(["settings", "devices", "history", "logs"]) };
  const loss = h("div", { class: "note", role: "status" });
  const facts = h("p", { class: "muted" });
  const result = h("div", { class: "ex-result", role: "status" });
  const showLoss = () => {
    const f = info.formats.find((x) => x.format === state.format);
    loss.replaceChildren(icon("info"), h("div", {}, h("strong", {}, t("What this format loses", "呢個格式會損失咩")), h("div", {}, t(f.loss.en, f.loss.yue)), h("div", { class: "muted" }, f.loss.importable ? t("Can be read back below.", "可以喺下面讀返。") : t("Cannot be imported again.", "之後唔能再匯入。"))));
    facts.textContent = `${t("Encoding", "編碼")}: ${f.encoding} · ${t("Line endings", "換行")}: ${f.lineEndings} · ${t("Schema version", "格式版本")}: ${f.schemaVersion}`;
  };

  const kindSeg = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Kind of record", "記錄種類") });
  const formatSeg = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Format", "格式") });
  const drawSeg = () => {
    kindSeg.replaceChildren(...Object.entries(info.kinds).map(([id, l]) => h("button", { role: "radio", "aria-checked": String(state.kind === id), class: state.kind === id ? "on" : "", onClick: () => { state.kind = id; drawSeg(); } }, tt(l))));
    formatSeg.replaceChildren(...info.formats.map((f) => h("button", { role: "radio", "aria-checked": String(state.format === f.format), class: state.format === f.format ? "on" : "", onClick: () => { state.format = f.format; drawSeg(); showLoss(); } }, f.format.toUpperCase())));
  };

  const archiveChecks = Object.entries(info.kinds).map(([id, l]) => h("label", { class: "ex-check" }, h("input", { type: "checkbox", checked: state.kinds.has(id), onChange: (e) => (e.target.checked ? state.kinds.add(id) : state.kinds.delete(id)) }), tt(l)));

  async function run(path, label) {
    result.textContent = t("Preparing...", "準備緊...");
    try {
      const out = await api.get(path);
      saveFile(h, out);
      const hidden = out.meta?.secretsOmitted ?? 0;
      result.textContent = t(`${out.filename}: ${out.bytes} bytes saved. Secrets hidden: ${hidden}.`, `${out.filename}：已儲存 ${out.bytes} 位元組。已隱藏嘅密碼：${hidden} 個。`);
      toast(t(`${label} exported.`, `${label} 已匯出。`));
    } catch (error) {
      result.textContent = error.message;
      toast(error.message, "bad");
    }
  }

  const fileInput = h("input", { type: "file", accept: ".json,.csv,.yaml,.yml", "aria-label": t("Choose an export to read back", "揀要讀返嘅匯出檔案"), onChange: async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase().replace("yml", "yaml");
    try {
      const out = await api.post("/api/x/exports/parse", { format: ext, text: await f.text() });
      back.replaceChildren(h("div", { class: "note" }, icon("check_circle"), t(`Read ${out.rowCount} rows and ${out.columns.length} columns. Nothing was changed.`, `讀到 ${out.rowCount} 行、${out.columns.length} 欄。冇改動任何嘢。`)), h("div", { class: "chips" }, out.columns.map((c) => h("span", { class: "chip" }, c))));
    } catch (error) {
      back.replaceChildren(h("div", { class: "note bad" }, icon("error"), error.message));
    }
  } });
  const back = h("div", { class: "ex-back" });

  drawSeg();
  showLoss();
  ctx.root.append(ctx.page(label, { en: "Records, settings, history and logs in JSON, CSV, YAML, Markdown, HTML or PDF. Secrets are always hidden.", yue: "記錄、設定、歷史同日誌，可以匯出做 JSON、CSV、YAML、Markdown、HTML 或 PDF。密碼一律隱藏。" },
    h("section", { class: "card" }, h("div", { class: "k" }, t("1. What to export", "1. 匯出咩")), kindSeg, h("div", { class: "k" }, t("2. Format", "2. 格式")), formatSeg, loss, facts,
      h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => run(`/api/x/exports/export?kind=${state.kind}&format=${state.format}`, tt(info.kinds[state.kind])) }, icon("download", "sm"), t("Export", "匯出"))), result),
    h("section", { class: "card" }, h("div", { class: "k" }, t("Archive (ZIP)", "壓縮檔（ZIP）")), h("p", {}, t("Bundles several kinds into one ZIP in the format chosen above, with a manifest that counts hidden secrets.", "將多種記錄用上面揀嘅格式放入一個 ZIP，並附有計算隱藏密碼數量嘅清單。")), h("div", { class: "ex-checks" }, archiveChecks),
      h("div", { class: "actions" }, h("button", { class: "btn t", onClick: () => run(`/api/x/exports/archive?format=${state.format}&kinds=${[...state.kinds].join(",")}`, "ZIP") }, icon("folder_zip", "sm"), t("Download ZIP", "下載 ZIP"))),
      h("div", { class: "note warn" }, icon("construction"), t(`In progress: ${info.archives.sevenZip.note}`, "進行中：7z 壓縮（含加密檔頭）仲未做好，請用 ZIP。"))),
    h("section", { class: "card" }, h("div", { class: "k" }, t("Read an export back", "讀返匯出檔案")), h("p", {}, t("Choose a JSON, CSV or YAML export from this app to check that it reads back. Nothing is changed.", "揀一個由呢個程式匯出嘅 JSON、CSV 或 YAML 檔案，檢查可唔可以讀返。唔會改動任何嘢。")), fileInput, back)));
}

export default {
  id: "exports",
  screens: [{ id: "exports", group, icon: "download", label, render }],
  commands: [{ id: "exports.open", icon: "download", label: { en: "Open exports", yue: "開啟匯出" }, keywords: "export download json csv pdf zip backup", run: (ctx) => ctx.navigate("exports") }],
};
