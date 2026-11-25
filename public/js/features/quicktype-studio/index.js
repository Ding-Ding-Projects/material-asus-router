// Type generator and JSON editor. Generates typed models from JSON samples or
// a JSON Schema in six languages, locally, live as you type; and a JSON editor
// with Tree, Code, Split and Table views, inline editing, undo, find, a
// JSONPath bar and schema validation. Nothing leaves the device.
import { LANGUAGES, SOURCES, describeType, generate } from "./generate.js";
import { EditHistory, addChild, findAll, jsonPath, parseInlineValue, parseLenient, pathToText, removeAt, renameKey, setAt, stringify, toTable, validateSchema } from "./json-tools.js";
import { makeUi } from "./ui.js";
import { load, save } from "./store.js";

const label = { en: "Types and JSON", yue: "類型同 JSON" };
const SAMPLE = '{\n  "id": 1,\n  "name": "Pat",\n  "tags": ["router", "demo"],\n  "owner": { "name": "Alex", "since": "2026-11-25" },\n  "score": 4.5,\n  "nickname": null\n}';
const DEFAULTS = { language: "typescript", source: "json", rootName: "Root", allOptional: false, inferDates: true, samplesAreList: false, view: "split", tab: "generate" };

const download = (name, text, type = "text/plain") => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

function render(ctx) {
  const { h, icon, t } = ctx;
  const ui = makeUi(ctx);
  const opts = { ...DEFAULTS, ...load("options", {}) };
  const persist = () => save("options", opts);
  const body = h("div", {});
  const state = { text: load("sample", SAMPLE), schema: load("schema", ""), history: null, find: { query: "", regex: false, flags: "i" }, selected: [], pathHits: [], mark: null };
  state.history = new EditHistory(parseLenient(state.text).value ?? {});

  const tabs = ui.seg([["generate", { en: "Generate types", yue: "產生類型" }], ["editor", { en: "JSON editor", yue: "JSON 編輯器" }]], opts.tab, (v) => { opts.tab = v; persist(); draw(); }, { en: "Section", yue: "部分" });

  // ---------------------------------------------------------------- generate
  function drawGenerate() {
    const input = h("textarea", { class: "field", rows: "14", spellcheck: "false", "aria-label": t("JSON sample or schema", "JSON 樣本或結構"), value: state.text, onInput(e) { state.text = e.target.value; save("sample", state.text); redo(); } });
    const out = h("pre", { class: "fp", tabindex: "0", "aria-label": t("Generated code", "產生嘅程式碼") });
    const inspector = h("pre", { class: "fp", tabindex: "0", "aria-label": t("Inferred types", "推斷嘅類型") });
    const status = h("div", { class: "note", role: "status", hidden: true });
    let last = null;
    function redo() {
      status.hidden = true;
      try {
        last = generate(state.text, opts.language, { source: opts.source, rootName: opts.rootName, allOptional: opts.allOptional, inferDates: opts.inferDates, samplesAreList: opts.samplesAreList });
        out.textContent = last.code;
        inspector.textContent = describeType(last.type);
      } catch (error) {
        last = null;
        status.hidden = false;
        status.className = "note bad";
        status.replaceChildren(icon("error", "sm"), error.message);
        out.textContent = "";
        inspector.textContent = "";
      }
    }
    redo();
    const langs = ui.seg(LANGUAGES.map(([id, name]) => [id, name]), opts.language, (v) => { opts.language = v; persist(); redo(); }, { en: "Language", yue: "語言" });
    const sources = ui.select(SOURCES.map(([id, name, ok, why]) => [id, ok ? name : `${name} (${t("not built yet", "未做")})`, ok ? undefined : why]), opts.source, (v) => {
      if (!SOURCES.find((s) => s[0] === v)[2]) { ctx.toast(SOURCES.find((s) => s[0] === v)[3], "bad"); sources.set(opts.source); return; }
      opts.source = v; persist(); redo();
    }, { en: "Source", yue: "來源" });
    return [
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Source", "來源")), input, status),
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Options", "選項")),
        ui.row({ en: "Language", yue: "語言" }, null, langs.el),
        ui.row({ en: "Read from", yue: "讀取自" }, { en: "TypeScript and GraphQL sources are not built yet and are shown disabled.", yue: "TypeScript 同 GraphQL 來源未做，顯示為停用。" }, sources.el),
        ui.row({ en: "Top-level name", yue: "最上層名稱" }, { en: "The name of the first type; the others are named from their keys.", yue: "第一個類型嘅名；其他按 key 命名。" }, ui.text(opts.rootName, { maxLength: 40, aria: { en: "Top-level name", yue: "最上層名稱" }, hint: { en: "Letters and digits; it is converted to the language's style.", yue: "字母同數字；會按語言風格轉換。" }, onChange(v) { opts.rootName = v.replace(/[^A-Za-z0-9_ -]/g, "") || "Root"; persist(); redo(); } }).el),
        ui.row({ en: "Many samples", yue: "多個樣本" }, { en: "Treat a top-level list as several samples and merge them, so fields missing in some become optional.", yue: "將最上層清單當作多個樣本合併，部分冇嘅欄位會變成可選。" }, ui.sw(opts.samplesAreList, (v) => { opts.samplesAreList = v; persist(); redo(); }, { en: "Many samples", yue: "多個樣本" }).el),
        ui.row({ en: "Everything optional", yue: "全部可選" }, null, ui.sw(opts.allOptional, (v) => { opts.allOptional = v; persist(); redo(); }, { en: "Everything optional", yue: "全部可選" }).el),
        ui.row({ en: "Recognise dates", yue: "辨認日期" }, { en: "ISO dates and times become a date type instead of a string.", yue: "ISO 日期同時間會變成日期類型，唔係字串。" }, ui.sw(opts.inferDates, (v) => { opts.inferDates = v; persist(); redo(); }, { en: "Recognise dates", yue: "辨認日期" }).el)),
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Generated code", "產生嘅程式碼")), out,
        h("div", { class: "chips" },
          h("button", { class: "btn f sm", onClick: () => last && navigator.clipboard?.writeText(last.code).then(() => ctx.toast(t("Copied.", "已複製。")), () => ctx.toast(t("Copy is not available here.", "呢度用唔到複製。"), "bad")) }, icon("content_copy", "sm"), t("Copy", "複製")),
          h("button", { class: "btn o sm", onClick: () => last && download(`${opts.rootName || "Root"}.${last.extension}`, last.code) }, icon("download", "sm"), t("Download", "下載")))),
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Inferred types", "推斷嘅類型")), h("div", { class: "t2" }, t("What the generator decided, before it is written in a language. Types shown with ? may be null; keys with ? are missing in some samples.", "生成器喺寫成語言之前嘅判斷。有 ? 嘅類型可以係 null；有 ? 嘅 key 喺部分樣本冇。")), inspector),
    ];
  }

  // ---------------------------------------------------------------- editor
  function drawEditor() {
    const parsed = parseLenient(state.text);
    const value = () => state.history.value;
    const code = h("textarea", { class: "field", rows: "18", spellcheck: "false", "aria-label": t("JSON text", "JSON 文字"), value: state.text });
    const message = h("div", { class: "note", role: "status", hidden: true });
    const treeBox = h("div", { class: "tree", role: "tree", "aria-label": t("JSON tree", "JSON 樹") });
    const tableBox = h("div", { class: "tbl" });
    const info = h("div", { class: "t2" });

    function setMessage(text, kind = "") {
      message.hidden = !text;
      message.className = `note ${kind}`;
      message.replaceChildren(icon(kind === "bad" ? "error" : "info", "sm"), text ?? "");
    }
    function commit(next) {
      if (!state.history.push(next)) return;
      state.text = stringify(next);
      code.value = state.text;
      save("sample", state.text);
      refresh();
    }
    function fromCode() {
      state.text = code.value;
      save("sample", state.text);
      const p = parseLenient(state.text);
      if (p.error) { setMessage(t(`Line ${p.error.line}, column ${p.error.column}: ${p.error.message}`, `第 ${p.error.line} 行第 ${p.error.column} 列：${p.error.message}`), "bad"); return; }
      state.history.push(p.value);
      setMessage(p.warnings.length ? t(`Read with ${p.warnings.length} tolerated issue(s): ${p.warnings[0].message}`, `讀取時容忍咗 ${p.warnings.length} 個問題：${p.warnings[0].message}`) : null, "warn");
      refresh(false);
    }
    code.addEventListener("input", fromCode);

    function node(path, key, v) {
      const isBranch = v !== null && typeof v === "object";
      const row = h("div", { class: "row", role: "treeitem" });
      const text = pathToText(path);
      const hit = state.pathHits.includes(text) || state.mark?.some((m) => m.join("\u0000") === path.join("\u0000"));
      if (hit) row.classList.add("tone");
      const nameBtn = path.length && typeof key === "string" ? h("button", { class: "btn t sm", title: t("Rename this key", "改呢個 key 嘅名"), onClick() { const n = prompt(t("New key name", "新 key 名"), key); if (n) try { commit(renameKey(value(), path, n)); } catch (e) { setMessage(e.message, "bad"); } } }, key) : h("span", { class: "tag" }, path.length ? String(key) : "$");
      row.append(nameBtn);
      if (isBranch) {
        row.append(h("span", { class: "t2" }, Array.isArray(v) ? `[${v.length}]` : `{${Object.keys(v).length}}`),
          h("button", { class: "btn t sm icon", "aria-label": t("Add a child", "加子項"), onClick() {
            const isList = Array.isArray(v);
            const k = isList ? null : prompt(t("Name of the new key", "新 key 嘅名"), "");
            if (!isList && !k) return;
            try { commit(addChild(value(), path, k, null)); } catch (e) { setMessage(e.message, "bad"); }
          } }, icon("add", "sm")));
      } else {
        const field = h("input", { class: "field", value: JSON.stringify(v), "aria-label": t(`Value of ${text}`, `${text} 嘅值`), onChange(e) { commit(setAt(value(), path, parseInlineValue(e.target.value))); } });
        row.append(field);
      }
      if (path.length) row.append(h("button", { class: "btn o sm icon", "aria-label": t("Remove", "移除"), onClick: () => commit(removeAt(value(), path)) }, icon("delete", "sm")));
      const wrap = h("div", {}, row);
      if (isBranch) {
        const kids = h("div", { class: "page" });
        for (const [k, child] of Object.entries(v)) kids.append(node([...path, Array.isArray(v) ? Number(k) : k], Array.isArray(v) ? Number(k) : k, child));
        wrap.append(kids);
      }
      return wrap;
    }

    function refresh(rewriteCode = true) {
      const v = value();
      if (rewriteCode) code.value = state.text;
      treeBox.replaceChildren(node([], "$", v));
      const table = toTable(v);
      tableBox.replaceChildren(h("table", {}, h("thead", {}, h("tr", {}, table.columns.map((c) => h("th", {}, c)))), h("tbody", {}, table.rows.slice(0, 200).map((r) => h("tr", {}, r.map((c) => h("td", {}, c)))))));
      info.textContent = t(`${state.text.length} characters`, `${state.text.length} 個字元`);
      undoBtn.disabled = !state.history.canUndo;
      redoBtn.disabled = !state.history.canRedo;
    }
    const undoBtn = h("button", { class: "btn t sm", onClick() { const v = state.history.undo(); state.text = stringify(v); refresh(); } }, icon("undo", "sm"), t("Undo", "還原"));
    const redoBtn = h("button", { class: "btn t sm", onClick() { const v = state.history.redo(); state.text = stringify(v); refresh(); } }, icon("redo", "sm"), t("Redo", "重做"));
    const views = ui.seg([["tree", { en: "Tree", yue: "樹" }], ["code", { en: "Code", yue: "程式碼" }], ["split", { en: "Split", yue: "分割" }], ["table", { en: "Table", yue: "表格" }]], opts.view, (v) => { opts.view = v; persist(); layout(); }, { en: "View", yue: "檢視" });
    const stage = h("div", { class: "grid2" });
    function layout() {
      const show = { tree: [treeBox], code: [code], split: [code, treeBox], table: [tableBox] }[opts.view];
      stage.replaceChildren(...show);
    }

    // JSONPath bar
    const pathOut = h("div", { class: "t2" });
    const pathInput = h("input", { class: "field", value: "$", spellcheck: "false", "aria-label": "JSONPath", onInput() {
      try {
        const hits = jsonPath(value(), pathInput.value);
        state.pathHits = hits.map((x) => x.path);
        pathOut.className = "t2";
        pathOut.textContent = hits.length ? t(`${hits.length} match(es). First: ${hits[0].path} = ${JSON.stringify(hits[0].value)?.slice(0, 80)}`, `${hits.length} 個符合。第一個：${hits[0].path} = ${JSON.stringify(hits[0].value)?.slice(0, 80)}`) : t("No match.", "冇符合。");
      } catch (error) {
        state.pathHits = [];
        pathOut.className = "err";
        pathOut.textContent = error.message;
      }
      refresh(false);
    } });

    // regex find
    const findOut = h("div", { class: "t2" });
    const findInput = h("input", { class: "field", type: "search", "aria-label": t("Find keys and values", "搵 key 同值"), placeholder: t("Find", "搵"), onInput() { state.find.query = findInput.value; doFind(); } });
    function doFind() {
      const { hits, error } = findAll(value(), state.find.query, state.find);
      state.mark = hits.map((x) => x.path);
      findOut.className = error ? "err" : "t2";
      findOut.textContent = error ?? (state.find.query ? t(`${hits.length} found${hits.length >= 500 ? " (showing the first 500)" : ""}`, `搵到 ${hits.length} 個`) : "");
      refresh(false);
    }

    // schema validation
    const schemaInput = h("textarea", { class: "field", rows: "6", spellcheck: "false", placeholder: '{ "type": "object", "required": ["id"] }', "aria-label": t("JSON Schema", "JSON 結構"), value: state.schema, onInput(e) { state.schema = e.target.value; save("schema", state.schema); } });
    const schemaOut = h("div", { class: "list" });
    const validateBtn = h("button", { class: "btn t sm", onClick() {
      schemaOut.replaceChildren();
      const s = parseLenient(state.schema);
      if (s.error) return schemaOut.append(h("div", { class: "err" }, t(`The schema is not valid JSON: ${s.error.message}`, `結構唔係有效 JSON：${s.error.message}`)));
      const errors = validateSchema(value(), s.value);
      schemaOut.append(errors.length ? errors.slice(0, 50).map((e) => h("div", { class: "row" }, h("code", {}, e.path), h("span", { class: "grow" }, e.message))) : h("div", { class: "note" }, icon("check_circle", "sm"), t("The JSON matches the schema.", "JSON 符合結構。")));
    } }, icon("rule", "sm"), t("Validate", "驗證"));

    refresh();
    layout();
    return [
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Edit", "編輯")), views.el, h("div", { class: "chips" }, undoBtn, redoBtn,
        h("button", { class: "btn o sm", onClick() { state.text = stringify(value(), 2); code.value = state.text; refresh(); } }, icon("format_align_left", "sm"), t("Format", "排版")),
        h("button", { class: "btn o sm", onClick() { state.text = JSON.stringify(value()); code.value = state.text; refresh(); } }, icon("compress", "sm"), t("Minify", "壓縮")),
        h("button", { class: "btn f sm", onClick() { opts.tab = "generate"; persist(); draw(); } }, icon("code", "sm"), t("Generate types from this", "用呢個產生類型"))), message, stage, info),
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Find and JSONPath", "搜尋同 JSONPath")),
        ui.row({ en: "Find", yue: "搜尋" }, { en: "Searches keys and values.", yue: "搜尋 key 同值。" }, findInput),
        ui.row({ en: "Regular expression", yue: "正規表達式" }, { en: "A basic pattern. The full pattern builder is not built yet.", yue: "基本模式。完整模式建構器未做。" }, ui.sw(false, (v) => { state.find.regex = v; doFind(); }, { en: "Regular expression", yue: "正規表達式" }).el), findOut,
        ui.row("JSONPath", { en: "Names, indexes, slices, * and .. are supported.", yue: "支援名稱、索引、切片、* 同 ..。" }, pathInput), pathOut),
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Schema validation", "結構驗證")), schemaInput, validateBtn, schemaOut),
    ];
  }

  function draw() {
    tabs.set(opts.tab);
    body.replaceChildren(...(opts.tab === "generate" ? drawGenerate() : drawEditor()));
  }
  draw();

  const notes = h("div", { class: "note warn" }, icon("construction", "sm"), t("In progress: reading TypeScript and GraphQL as sources, serializer code for each language, and the full pattern builder. Generation from JSON and JSON Schema is working.", "進行中：讀取 TypeScript 同 GraphQL 作來源、每種語言嘅序列化程式碼，同完整模式建構器。由 JSON 同 JSON Schema 產生已經可用。"));
  ctx.root.append(ctx.page(label, { en: "Turn JSON samples into typed models, and edit JSON with a tree, code, split and table view.", yue: "將 JSON 樣本變成有類型嘅模型，並用樹、程式碼、分割同表格檢視編輯 JSON。" }));
  ctx.root.firstChild.append(h("div", { class: "chips" }, tabs.el), body, notes);
}

export default {
  id: "quicktype-studio",
  screens: [{ id: "quicktype-studio", group: { en: "Tools", yue: "工具" }, icon: "data_object", label, render }],
  commands: [{ id: "quicktype-studio.open", icon: "data_object", label: { en: "Open types and JSON", yue: "開啟類型同 JSON" }, keywords: "quicktype json types typescript csharp go python rust java schema", run: (ctx) => ctx.navigate("quicktype-studio") }],
  settings: [{ id: "quicktype-studio", icon: "data_object", label, render: (ctx) => ctx.h("div", { class: "t2" }, ctx.t("The type generator keeps its options in this browser; set them on its screen.", "類型生成器將選項儲喺呢個瀏覽器，喺佢嘅畫面設定。")) }],
};
