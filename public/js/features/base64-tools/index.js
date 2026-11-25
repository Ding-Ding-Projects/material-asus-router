// Full local Base64 toolkit: text and files, standard and URL-safe, MIME line
// lengths, strict and lenient decoding with exact error offsets, data: URLs,
// a hex view, large files with progress / pause / cancel, a SHA-256 round
// trip, history with undo, and exports. Nothing leaves the device.
import { Base64Error, ENCODED_SUFFIX, TEXT_ENCODINGS, buildDataUrl, bytesToText, decode, decodeBlob, encode, encodeBlob, encodedName, hexView, makeControl, parseDataUrl, pushHistory, restoredName, sha256, sha256Blob, textToBytes, uniqueName, undoHistory } from "./codec.js";
import { makeUi } from "./ui.js";
import { load, save } from "./store.js";
import { makeZip } from "./zip.js";

const label = { en: "Base64 toolkit", yue: "Base64 工具箱" };
const DEFAULTS = { alphabet: "std", padding: true, lineLength: 0, strict: true, encoding: "utf-8", mode: "text" };

const download = (name, blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

async function render(ctx) {
  const { h, icon, t, toast, confirmDialog } = ctx;
  const ui = makeUi(ctx);
  const opts = { ...DEFAULTS, ...load("options", {}) };
  let history = load("history", []);
  const taken = new Set();
  const saveOpts = () => save("options", opts);
  const control = { current: null };

  const input = h("textarea", { class: "field", rows: "6", "aria-label": t("Input", "輸入"), spellcheck: "false", value: load("draft", "") });
  const output = h("textarea", { class: "field", rows: "6", readOnly: true, "aria-label": t("Output", "輸出"), spellcheck: "false" });
  const status = h("div", { class: "note", role: "status", hidden: true });
  const info = h("div", { class: "t2" });
  const progress = h("progress", { max: "1", value: "0", hidden: true, "aria-label": t("Progress", "進度") });
  const hash = h("div", { class: "mono t2" });
  const historyBox = h("div", {});
  let lastBytes = null;
  let lastName = "output";

  const say = (message, kind = "") => {
    status.hidden = !message;
    status.className = `note ${kind}`;
    status.replaceChildren(icon(kind === "bad" ? "error" : "info", "sm"), message ?? "");
  };
  const options = () => ({ urlSafe: opts.alphabet === "url", padding: opts.padding, lineLength: opts.lineLength, eol: "\r\n" });
  const decodeOptions = () => ({ strict: opts.strict, urlSafe: opts.alphabet === "url", mime: opts.lineLength > 0, requirePadding: opts.padding });

  function record(kind, from, to) {
    history = pushHistory(history, { kind, from: from.slice(0, 2000), to: to.slice(0, 2000), truncated: from.length > 2000 || to.length > 2000 });
    save("history", history);
    drawHistory();
  }
  function drawHistory() {
    historyBox.replaceChildren(
      history.length ? history.slice(0, 8).map((e) => h("div", { class: "row" }, h("span", { class: "tag" }, e.kind), h("code", { class: "grow" }, `${e.from.slice(0, 40)} → ${e.to.slice(0, 40)}`), h("button", { class: "btn t sm", onClick() { input.value = e.from; output.value = e.to; toast(t("Restored from history.", "已由記錄還原。")); } }, t("Restore", "還原")))) : h("div", { class: "t2" }, t("Nothing converted yet.", "未轉換過任何嘢。")),
    );
  }

  function run(kind) {
    say(null);
    hash.textContent = "";
    try {
      const from = input.value;
      let result;
      if (kind === "encode") {
        lastBytes = textToBytes(from, opts.encoding);
        result = encode(lastBytes, options());
      } else if (kind === "decode") {
        const out = decode(from, decodeOptions());
        lastBytes = out.bytes;
        result = bytesToText(out.bytes, opts.encoding, { fatal: opts.strict });
        if (out.warnings.length) say(t(`Decoded with ${out.warnings.length} warning(s). First: ${out.warnings[0].message} at offset ${out.warnings[0].offset}.`, `解碼有 ${out.warnings.length} 個警告。第一個：${out.warnings[0].message}（位置 ${out.warnings[0].offset}）。`), "warn");
      } else if (kind === "data-url") {
        lastBytes = textToBytes(from, opts.encoding);
        result = buildDataUrl("text/plain", lastBytes);
      } else if (kind === "parse-data-url") {
        const parsed = parseDataUrl(from);
        lastBytes = parsed.bytes;
        result = bytesToText(parsed.bytes, opts.encoding);
        say(t(`Type ${parsed.mime}, ${parsed.base64 ? "Base64" : "percent-encoded"}, ${parsed.bytes.length} bytes.`, `類型 ${parsed.mime}，${parsed.base64 ? "Base64" : "百分比編碼"}，${parsed.bytes.length} 位元組。`));
      } else {
        lastBytes = textToBytes(from, opts.encoding);
        result = hexView(lastBytes);
      }
      output.value = result;
      info.textContent = t(`${lastBytes.length} bytes`, `${lastBytes.length} 位元組`);
      record(kind, from, result);
      save("draft", from.slice(0, 20000));
    } catch (error) {
      if (error instanceof Base64Error) {
        say(`${error.message}`, "bad");
        input.focus();
        try { input.setSelectionRange(error.offset, Math.min(input.value.length, error.offset + 1)); } catch {}
      } else say(error.message, "bad");
    }
  }

  const copy = () => navigator.clipboard?.writeText(output.value).then(() => toast(t("Copied.", "已複製。")), () => toast(t("Copy is not available here.", "呢度用唔到複製。"), "bad"));

  // ---- files -------------------------------------------------------------
  const fileBox = h("div", { class: "list" });
  async function handleFile(file) {
    const row = h("div", { class: "row" }, icon("description", "sm"), h("span", { class: "grow" }, file.name));
    const bar = h("progress", { max: "1", value: "0", "aria-label": file.name });
    const pause = h("button", { class: "btn t sm", type: "button" }, icon("pause", "sm"), t("Pause", "暫停"));
    const stop = h("button", { class: "btn o sm", type: "button" }, icon("close", "sm"), t("Cancel", "取消"));
    const result = h("span", { class: "t2" });
    const ctl = makeControl();
    pause.addEventListener("click", () => {
      ctl.paused ? ctl.resume() : ctl.pause();
      pause.replaceChildren(icon(ctl.paused ? "play_arrow" : "pause", "sm"), ctl.paused ? t("Resume", "繼續") : t("Pause", "暫停"));
    });
    stop.addEventListener("click", () => ctl.cancel());
    row.append(bar, pause, stop, result);
    fileBox.prepend(row);
    const onProgress = (p) => (bar.value = p);
    try {
      const restore = restoredName(file.name);
      let blob;
      let name;
      let verify;
      if (restore) {
        // Dropping name.ext.base64.txt gives back name.ext.
        const decoded = await decodeBlob(file, { control: ctl, onProgress, ...decodeOptions(), strict: false });
        blob = decoded.blob;
        name = uniqueName(restore, taken);
        if (decoded.warnings.length) result.textContent = t(`${decoded.warnings.length} warning(s). `, `${decoded.warnings.length} 個警告。`);
      } else {
        blob = await encodeBlob(file, { control: ctl, onProgress, ...options() });
        name = uniqueName(encodedName(file.name), taken);
        // Round trip: decode what we wrote and compare SHA-256 with the original.
        const back = await decodeBlob(blob, { control: ctl, ...decodeOptions(), strict: true });
        const [a, b] = await Promise.all([sha256Blob(file), sha256Blob(back.blob)]);
        verify = a && b ? (a === b ? t(`SHA-256 round trip matches (${a.slice(0, 12)}…).`, `SHA-256 來回一致（${a.slice(0, 12)}…）。`) : t("SHA-256 round trip DOES NOT match.", "SHA-256 來回唔一致。")) : t("Too large to hash here; round trip not verified.", "太大，未能喺度計雜湊，來回未驗證。");
      }
      taken.add(name);
      download(name, blob);
      result.textContent += `${name} · ${blob.size} B ${verify ?? ""}`;
      bar.value = 1;
      history = pushHistory(history, { kind: restore ? "file-decode" : "file-encode", from: file.name, to: name });
      save("history", history);
      drawHistory();
    } catch (error) {
      result.textContent = error.message === "Cancelled" ? t("Cancelled. Nothing was saved.", "已取消，冇儲存任何嘢。") : error.message;
    } finally {
      pause.disabled = stop.disabled = true;
    }
  }
  const picker = h("input", { type: "file", multiple: true, hidden: true, "aria-label": t("Choose files", "揀檔案"), onChange(e) { [...e.target.files].forEach(handleFile); e.target.value = ""; } });
  const drop = h("div", { class: "drop", tabindex: "0", role: "button", "aria-label": t("Drop files to encode, or drop a .base64.txt file to restore it", "拖放檔案去編碼，或者拖放 .base64.txt 檔案還原"),
    onClick: () => picker.click(),
    onKeydown(e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); picker.click(); } },
    onDragover(e) { e.preventDefault(); drop.classList.add("over"); },
    onDragleave: () => drop.classList.remove("over"),
    onDrop(e) { e.preventDefault(); drop.classList.remove("over"); [...e.dataTransfer.files].forEach(handleFile); } },
    icon("upload_file"), h("div", {}, h("div", { class: "t1" }, t("Drop files here, or press Enter to choose", "拖放檔案喺度，或者按 Enter 揀")),
      h("div", { class: "t2" }, t(`Writes name.ext${ENCODED_SUFFIX} as a download and never replaces a file. Drop a ${ENCODED_SUFFIX} file to get the original back.`, `會下載 name.ext${ENCODED_SUFFIX}，永不覆蓋檔案。拖放 ${ENCODED_SUFFIX} 就會還原原檔。`))));

  async function bulkZip(files) {
    const entries = [];
    for (const file of files) entries.push({ name: encodedName(file.name), bytes: new TextEncoder().encode(encode(new Uint8Array(await file.arrayBuffer()), options())) });
    download("base64-export.zip", new Blob([makeZip(entries)], { type: "application/zip" }));
  }
  const bulk = h("input", { type: "file", multiple: true, hidden: true, onChange(e) { bulkZip([...e.target.files]); e.target.value = ""; } });

  // ---- layout -------------------------------------------------------------
  const settings = h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Options", "選項")),
    ui.row({ en: "Alphabet", yue: "字母表" }, { en: "Standard uses + and /; URL-safe uses - and _ and is safe in addresses and file names.", yue: "標準用 + 同 /；URL 安全版用 - 同 _，可以放喺網址同檔名。" },
      ui.seg([["std", { en: "Standard", yue: "標準" }], ["url", { en: "URL-safe", yue: "URL 安全" }]], opts.alphabet, (v) => { opts.alphabet = v; saveOpts(); }, "Alphabet").el),
    ui.row({ en: "Padding", yue: "填充" }, { en: "Add or require the = signs at the end.", yue: "結尾加上或者要求 = 號。" }, ui.sw(opts.padding, (v) => { opts.padding = v; saveOpts(); }, { en: "Padding", yue: "填充" }).el),
    ui.row({ en: "Line length", yue: "每行長度" }, { en: "0 keeps one line; 64 is PEM and 76 is MIME. Must be a multiple of 4.", yue: "0 即一行；64 係 PEM，76 係 MIME。要係 4 嘅倍數。" },
      ui.select([["0", { en: "One line", yue: "一行" }], ["64", "64 (PEM)"], ["76", "76 (MIME)"]], String(opts.lineLength), (v) => { opts.lineLength = Number(v); saveOpts(); }, { en: "Line length", yue: "每行長度" }).el),
    ui.row({ en: "Strict decoding", yue: "嚴格解碼" }, { en: "Strict refuses anything outside the alphabet and says the exact offset. Lenient skips it and lists warnings.", yue: "嚴格會拒絕字母表以外嘅字元並指出位置；寬鬆會跳過並列出警告。" }, ui.sw(opts.strict, (v) => { opts.strict = v; saveOpts(); }, { en: "Strict decoding", yue: "嚴格解碼" }).el),
    ui.row({ en: "Text encoding", yue: "文字編碼" }, { en: "How text becomes bytes before encoding, and bytes become text after decoding.", yue: "編碼前文字點樣變成位元組，解碼後位元組點樣變回文字。" }, ui.select(TEXT_ENCODINGS, opts.encoding, (v) => { opts.encoding = v; saveOpts(); }, { en: "Text encoding", yue: "文字編碼" }).el));

  const actions = h("div", { class: "chips" },
    ...[["encode", "Encode", "編碼", "lock"], ["decode", "Decode", "解碼", "lock_open"], ["data-url", "Build data URL", "建立 data URL", "link"], ["parse-data-url", "Parse data URL", "解析 data URL", "link_off"], ["hex", "Hex view", "十六進制檢視", "grid_view"]].map(([kind, en, yue, ic]) => h("button", { class: kind === "encode" ? "btn f" : "btn t", type: "button", onClick: () => run(kind) }, icon(ic, "sm"), t(en, yue))));

  const text = h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Text", "文字")), input, actions, status, output, info, hash,
    h("div", { class: "chips" },
      h("button", { class: "btn o sm", onClick: copy }, icon("content_copy", "sm"), t("Copy output", "複製輸出")),
      h("button", { class: "btn o sm", onClick() { navigator.clipboard?.readText().then((v) => (input.value = v), () => toast(t("Paste is not available here.", "呢度用唔到貼上。"), "bad")); } }, icon("content_paste", "sm"), t("Paste", "貼上")),
      h("button", { class: "btn o sm", onClick() { const a = input.value; input.value = output.value; output.value = a; } }, icon("swap_vert", "sm"), t("Swap", "對調")),
      h("button", { class: "btn o sm", onClick() { download(`${lastName}.txt`, new Blob([output.value], { type: "text/plain" })); } }, icon("download", "sm"), t("Save output", "儲存輸出")),
      h("button", { class: "btn o sm", onClick() { download("base64.json", new Blob([JSON.stringify({ input: input.value, output: output.value, options: { ...opts } }, null, 2)], { type: "application/json" })); } }, icon("data_object", "sm"), t("Export JSON", "匯出 JSON")),
      h("button", { class: "btn o sm", async onClick() { if (!lastBytes) return toast(t("Convert something first.", "請先轉換啲嘢。"), "bad"); hash.textContent = `SHA-256 ${await sha256(lastBytes)}`; } }, icon("tag", "sm"), t("SHA-256 of bytes", "位元組 SHA-256"))));

  const files = h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Files", "檔案")), drop, picker, progress, fileBox,
    h("div", { class: "chips" }, h("button", { class: "btn o sm", onClick: () => bulk.click() }, icon("folder_zip", "sm"), t("Encode several files into one ZIP", "將多個檔案編碼成一個 ZIP")), bulk),
    h("div", { class: "t2" }, t("Browsers cannot write next to the original file, so the result downloads with its name. Very large files are processed in pieces; the output is built from pieces and only held by the browser.", "瀏覽器唔可以喺原檔旁邊寫檔，所以結果會以呢個名下載。好大嘅檔案會分段處理。")));

  const hist = h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("History", "記錄")), historyBox,
    h("div", { class: "chips" },
      h("button", { class: "btn t sm", onClick() { const { list, undone } = undoHistory(history); if (!undone) return toast(t("Nothing to undo.", "冇嘢可還原。")); history = list; save("history", history); input.value = undone.from; output.value = ""; drawHistory(); toast(t("Last conversion undone.", "已還原上一次轉換。")); } }, icon("undo", "sm"), t("Undo last conversion", "還原上一次轉換")),
      h("button", { class: "btn o sm", async onClick() { if (await confirmDialog({ title: t("Clear the history?", "清除記錄？"), body: t("This only removes the list kept in this browser.", "只會移除呢個瀏覽器入面嘅記錄。"), confirm: t("Clear", "清除"), danger: true })) { history = []; save("history", history); drawHistory(); } } }, icon("delete", "sm"), t("Clear history", "清除記錄"))));
  drawHistory();

  ctx.root.append(ctx.page(label, { en: "Encode and decode text and files, strictly or leniently. Everything happens in this browser.", yue: "編碼同解碼文字同檔案，可以嚴格或寬鬆。全部喺呢個瀏覽器入面完成。" }));
  ctx.root.firstChild.append(h("div", { class: "grid2" }, text, h("div", { class: "page" }, settings, files)), hist);
  input.addEventListener("input", () => save("draft", input.value.slice(0, 20000)));
  return () => control.current?.cancel();
}

export default {
  id: "base64-tools",
  screens: [{ id: "base64-tools", group: { en: "Tools", yue: "工具" }, icon: "tag", label, render }],
  commands: [{ id: "base64-tools.open", icon: "tag", label: { en: "Open the Base64 toolkit", yue: "開啟 Base64 工具箱" }, keywords: "base64 encode decode data url hex", run: (ctx) => ctx.navigate("base64-tools") }],
  settings: [{ id: "base64-tools", icon: "tag", label, render: (ctx) => ctx.h("div", { class: "t2" }, ctx.t("Your Base64 options are kept in this browser and set on the toolkit screen.", "你嘅 Base64 選項儲喺呢個瀏覽器，喺工具箱畫面設定。")) }],
};
