// The file browser for /jffs, /tmp and /opt: list, view and edit (with syntax
// highlighting and a reviewed save), upload, download and delete. Every write
// goes through a review or a confirmation on the server as well.
import { highlight, languageOf, paint } from "./highlight.js";
import { askSuper } from "./run.js";

const BASE = "/api/x/ssh-actions";
const sizeText = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const join = (a, b) => `${a.replace(/\/$/, "")}/${b}`;
const parent = (p) => p.slice(0, p.lastIndexOf("/")) || "/";

function toBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function download(ctx, path) {
  const res = await fetch(`${BASE}/files/download?path=${encodeURIComponent(path)}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const a = ctx.h("a", { href: url, download: path.split("/").pop() });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// The editor: text on top of a highlighted copy, a diff review, then the save.
export function openEditor(ctx, path, { onSaved } = {}) {
  const { api, h, icon, t, openDialog, toast } = ctx;
  return api.get(`${BASE}/files/read?path=${encodeURIComponent(path)}`).then((file) => {
    const lang = languageOf(path, file.content);
    const layer = h("pre", { class: "sa-hl mono", "aria-hidden": "true" });
    const area = h("textarea", { class: "sa-ta mono", spellcheck: "false", wrap: "off", "aria-label": `${t("Contents of", "內容：")} ${path}` });
    area.value = file.content;
    const redraw = () => paint(h, layer, highlight(area.value, lang));
    area.addEventListener("input", redraw);
    area.addEventListener("scroll", () => { layer.scrollTop = area.scrollTop; layer.scrollLeft = area.scrollLeft; });
    area.addEventListener("keydown", (e) => {
      if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); area.setRangeText("  ", area.selectionStart, area.selectionEnd, "end"); redraw(); }
    });
    redraw();
    const status = h("div", { class: "t2", role: "status" }, `${lang} · ${sizeText(file.size)}`);
    let step = "edit";
    let review = null;
    const dialog = openDialog((close, render) => {
      if (step === "review")
        return [
          h("h2", { class: "h2" }, t("Review before saving", "儲存前先檢查")),
          h("div", { class: "t2 mono" }, path),
          h("div", { class: "t2" }, t(`${review.diff.added} lines added, ${review.diff.removed} removed.`, `加咗 ${review.diff.added} 行，刪咗 ${review.diff.removed} 行。`)),
          h("pre", { class: "sa-diff mono", tabindex: "0", "aria-label": t("The changes", "改動") }, review.diff.rows.map((r) => h("div", { class: `sa-d${r.op === "+" ? "add" : r.op === "-" ? "del" : "same"}` }, `${r.op === "~" ? "" : r.op} ${r.text}`))),
          !path.startsWith("/tmp/") ? h("div", { class: "note warn" }, icon("warning"), h("div", {}, t("This file is kept when the router restarts. A mistake in a start-up script can stop the router starting properly.", "呢個檔案喺路由器重啟後仍然保留。開機腳本出錯可能令路由器開唔到機。"))) : null,
          h("div", { class: "actions" },
            h("button", { class: "btn o", onClick: () => ((step = "edit"), render()) }, icon("edit", "sm"), t("Back to editing", "返回編輯")),
            h("button", { class: "btn f", onClick: async (e) => {
              e.currentTarget.disabled = true;
              try { await api.post(`${BASE}/files/save`, { id: review.id }); toast(t("Saved.", "已儲存。")); onSaved?.(); close(true); } catch (error) { toast(error.message, "bad"); e.currentTarget.disabled = false; }
            } }, icon("save", "sm"), t("Save to the router", "儲存去路由器"))),
        ];
      return [
        h("h2", { class: "h2" }, h("span", {}, t("Edit", "編輯"), " "), h("span", { class: "mono" }, path)),
        h("div", { class: "sa-ed" }, layer, area),
        status,
        h("div", { class: "actions" },
          h("button", { class: "btn o", onClick: () => close(false) }, t("Close", "關閉")),
          h("button", { class: "btn f", disabled: !ctx.state.canWrite, onClick: async () => {
            try { review = await api.post(`${BASE}/files/review`, { path, content: area.value }); step = "review"; render(); } catch (error) { toast(error.message, "bad"); }
          } }, icon("difference", "sm"), t("Review changes", "檢查改動"))),
      ];
    }, { label: path });
    return dialog;
  });
}

export function drawFiles(ctx, holder, { start = "/jffs" } = {}) {
  const { api, h, icon, t, toast, openDialog, state } = ctx;
  let path = start;
  const roots = ["/jffs", "/tmp", "/opt"];
  const list = h("div", { class: "sa-files", role: "list" });
  const crumbs = h("nav", { class: "sa-crumbs", "aria-label": t("Folder path", "資料夾路徑") });
  const note = h("div", { class: "t2", role: "status" });
  const picker = h("input", { type: "file", hidden: true, onChange: async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); } });

  const rootsSeg = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Place", "位置") });
  const drawRoots = () => rootsSeg.replaceChildren(...roots.map((r) => {
    const on = path === r || path.startsWith(`${r}/`);
    return h("button", { role: "radio", class: on ? "on" : "", "aria-checked": String(on), onClick: () => load(r) }, r);
  }));

  async function load(next = path) {
    note.textContent = t("Loading…", "載入緊…");
    try {
      const data = await api.get(`${BASE}/files/list?path=${encodeURIComponent(next)}`);
      path = data.path;
      drawRoots();
      draw(data.entries);
      note.textContent = t(`${data.entries.length} items`, `${data.entries.length} 項`);
    } catch (error) {
      list.replaceChildren(h("div", { class: "note bad" }, icon("error"), h("div", {}, error.message)));
      note.textContent = "";
    }
  }
  function draw(entries) {
    const parts = path.split("/").filter(Boolean);
    crumbs.replaceChildren(...parts.map((p, i) => h("button", { class: "btn t sm", onClick: () => load(`/${parts.slice(0, i + 1).join("/")}`) }, p)));
    list.replaceChildren(
      parts.length > 1 ? h("div", { class: "row", role: "listitem" }, icon("arrow_upward"), h("button", { class: "btn t sm grow sa-left", onClick: () => load(parent(path)) }, t("Up one folder", "上一層"))) : null,
      ...entries.map((e) => {
        const full = join(path, e.name);
        return h("div", { class: "row sa-file", role: "listitem" },
          icon(e.type === "folder" ? "folder" : e.type === "link" ? "link" : "description"),
          h("div", { class: "grow" },
            e.type === "folder" ? h("button", { class: "sa-link", onClick: () => load(full) }, e.name) : h("span", { class: "t1" }, e.name),
            h("div", { class: "t2" }, `${e.type === "folder" ? t("Folder", "資料夾") : sizeText(e.size)} · ${e.modified} · ${e.mode}`)),
          e.type === "file" ? h("div", { class: "sa-rowbtns" },
            h("button", { class: "btn t icon", "aria-label": `${t("Open", "開啟")} ${e.name}`, title: t("View or edit", "查看或編輯"), onClick: () => openEditor(ctx, full, { onSaved: () => load() }).catch((error) => toast(error.status === 415 ? t("That file is not plain text. Download it instead.", "呢個檔案唔係純文字，請下載。") : error.message, "bad")) }, icon("edit_note", "sm")),
            h("button", { class: "btn t icon", "aria-label": `${t("Download", "下載")} ${e.name}`, title: t("Download", "下載"), onClick: () => download(ctx, full).catch((error) => toast(error.message, "bad")) }, icon("download", "sm")),
            h("button", { class: "btn t icon", "aria-label": `${t("Delete", "刪除")} ${e.name}`, title: t("Delete", "刪除"), disabled: !state.canWrite, onClick: () => remove(full, e) }, icon("delete", "sm"))) : null,
          e.type === "folder" ? h("button", { class: "btn t icon", "aria-label": `${t("Delete folder", "刪除資料夾")} ${e.name}`, disabled: !state.canWrite, onClick: () => remove(full, e) }, icon("delete", "sm")) : null);
      }));
  }
  async function upload(file, replace = false) {
    if (file.size > 2 * 1024 * 1024) return void toast(t("Files up to 2 MB can be uploaded from here.", "呢度最多可以上載 2 MB 嘅檔案。"), "bad");
    try {
      await api.post(`${BASE}/files/upload`, { folder: path, name: file.name, data: toBase64(await file.arrayBuffer()), replace, executable: /\.sh$/.test(file.name) });
      toast(t(`Uploaded ${file.name}.`, `已上載 ${file.name}。`));
      load();
    } catch (error) {
      if (error.code === "EXISTS" && (await ctx.confirmDialog({ title: t("Replace the file?", "要取代個檔案？"), body: file.name, confirm: t("Replace", "取代"), danger: true }))) return upload(file, true);
      if (error.code !== "EXISTS") toast(error.message, "bad");
    }
  }
  async function newFile() {
    let name = "";
    const ok = await openDialog((close) => [
      h("h2", { class: "h2" }, t("New file", "新檔案")),
      h("label", { class: "lbl" }, t("File name", "檔案名稱"), h("input", { class: "field", autocomplete: "off", onInput: (e) => (name = e.target.value.trim()) })),
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: () => close(true) }, t("Create", "建立"))),
    ], { label: t("New file", "新檔案") }).closed;
    if (!ok || !name) return;
    try {
      const review = await api.post(`${BASE}/files/review`, { path: join(path, name), content: "\n" });
      await api.post(`${BASE}/files/save`, { id: review.id });
      await load();
      openEditor(ctx, join(path, name), { onSaved: () => load() }).catch((error) => toast(error.message, "bad"));
    } catch (error) {
      toast(error.message, "bad");
    }
  }
  async function remove(full, e) {
    let typed = "";
    const needsSuper = !full.startsWith("/tmp/");
    const ok = await openDialog((close, render) => [
      h("h2", { class: "h2" }, t(`Delete ${e.name}?`, `刪除 ${e.name}？`)),
      h("div", { class: "note bad" }, icon("warning"), h("div", {}, needsSuper ? t("This cannot be undone, and it is kept storage, so it needs the two-key confirmation too.", "呢個動作還原唔到，而且係長期儲存，所以仲要雙鑰確認。") : t("This cannot be undone.", "呢個動作還原唔到。"))),
      h("div", { class: "sa-cmd mono" }, icon("folder", "sm"), full),
      h("label", { class: "lbl" }, t(`Type ${e.name} to confirm`, `輸入 ${e.name} 確認`), h("input", { class: "field", autocomplete: "off", spellcheck: "false", onInput: (ev) => { typed = ev.target.value; const b = ev.target.closest(".sheet").querySelector(".sa-go"); if (b) b.disabled = typed !== e.name; } })),
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: "btn d sa-go", disabled: true, onClick: () => close(true) }, icon("delete", "sm"), t("Delete", "刪除"))),
    ], { label: t("Delete", "刪除") }).closed;
    if (!ok) return;
    try {
      let token;
      if (needsSuper) {
        token = await askSuper(ctx, { action: "ssh-actions.file-delete", title: t(`Delete ${e.name}`, `刪除 ${e.name}`), affects: [full] });
        if (!token) return void toast(t("Not confirmed, so nothing was deleted.", "未確認，所以冇刪除任何嘢。"), "bad");
      }
      await api.post(`${BASE}/files/delete`, { path: full, confirmName: typed, token });
      toast(t("Deleted.", "已刪除。"));
      load();
    } catch (error) {
      toast(error.message, "bad");
    }
  }

  holder.append(
    h("div", { class: "row" },
      rootsSeg,
      h("div", { class: "grow" }),
      h("button", { class: "btn t sm", disabled: !state.canWrite, onClick: newFile }, icon("note_add", "sm"), t("New file", "新檔案")),
      h("button", { class: "btn t sm", disabled: !state.canWrite, onClick: () => picker.click() }, icon("upload", "sm"), t("Upload", "上載")),
      h("button", { class: "btn t sm", onClick: () => load() }, icon("refresh", "sm"), t("Refresh", "重新整理"))),
    picker, crumbs, note, list);
  load(start);
  return { load };
}
