// External editor and VS Code hand-off. The web app cannot see what is
// installed on a computer, so it hands files over the two ways a page can:
// a workspace ZIP to download, and a vscode:// link that opens the folder the
// person unzipped it to. The choice of editor is remembered.
import { DOCKVIEW_NOTE, EDITORS, downloadPage, editorLink, installProbes, workspaceZip } from "./editor.js";
import { makeUi } from "./ui.js";
import { load, save } from "./store.js";

const label = { en: "External editor", yue: "外部編輯器" };

const saveBlob = (name, bytes, type) => {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

// Tries a custom-protocol link and guesses whether anything took it: if the
// page loses focus or is hidden within a moment, an editor probably opened.
function tryOpen(link) {
  return new Promise((resolve) => {
    let taken = false;
    const mark = () => { taken = true; };
    window.addEventListener("blur", mark, { once: true });
    document.addEventListener("visibilitychange", mark, { once: true });
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.src = link;
    document.body.append(frame);
    setTimeout(() => {
      frame.remove();
      window.removeEventListener("blur", mark);
      document.removeEventListener("visibilitychange", mark);
      resolve(taken);
    }, 1500);
  });
}

function render(ctx) {
  const { h, icon, t, tt, api, toast } = ctx;
  const ui = makeUi(ctx);
  const choice = { editor: "vscode", folder: "", line: 1, ...load("choice", {}) };
  const persist = () => save("choice", choice);
  const result = h("div", { class: "list" });

  async function exportZip() {
    try {
      const backup = await api.get("/api/backup");
      const history = await api.get("/api/changes/history");
      const bytes = workspaceZip([{ name: "router-backup.json", text: JSON.stringify(backup, null, 2) }, { name: "change-history.json", text: JSON.stringify(history, null, 2) }]);
      saveBlob("router-workspace.zip", bytes, "application/zip");
      result.replaceChildren(h("div", { class: "note" }, icon("check_circle", "sm"), t("Downloaded router-workspace.zip. Unzip it, then type the folder path below to open it in your editor.", "已下載 router-workspace.zip。解壓縮後，喺下面輸入資料夾路徑就可以用編輯器開啟。")));
    } catch (error) {
      result.replaceChildren(h("div", { class: "note bad", role: "alert" }, icon("error", "sm"), error.message));
    }
  }

  async function open() {
    result.replaceChildren();
    let link;
    try {
      link = editorLink(choice.editor, choice.folder);
    } catch (error) {
      result.replaceChildren(h("div", { class: "note bad", role: "alert" }, icon("error", "sm"), error.message));
      return;
    }
    const opened = await tryOpen(link);
    const name = EDITORS.find(([id]) => id === choice.editor)[1];
    result.replaceChildren(
      h("div", { class: opened ? "note" : "note warn", role: "status" }, icon(opened ? "check_circle" : "help", "sm"), opened ? t(`Asked ${name} to open the folder.`, `已請 ${name} 開啟資料夾。`) : t(`Nothing seemed to open. ${name} may not be installed, or the browser asked you something. A web page cannot see installed programs, so this is a guess.`, `似乎冇嘢開啟。可能未安裝 ${name}，或者瀏覽器問咗你問題。網頁睇唔到已安裝嘅程式，所以呢個只係估計。`)),
      !opened ? h("div", { class: "chips" }, h("a", { class: "btn t", href: downloadPage(), target: "_blank", rel: "noopener noreferrer" }, icon("download", "sm"), t("Get Visual Studio Code", "下載 Visual Studio Code")), h("button", { class: "btn o", type: "button", onClick: () => navigator.clipboard?.writeText(link).then(() => toast(t("Link copied.", "已複製連結。"))) }, icon("content_copy", "sm"), t("Copy the link", "複製連結"))) : null);
  }

  const card = h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Open in your editor", "用編輯器開啟")),
    ui.row({ en: "Editor", yue: "編輯器" }, { en: "Remembered on this browser. A browser cannot tell which of these are installed.", yue: "記住喺呢個瀏覽器。瀏覽器分辨唔到邊個已安裝。" }, ui.seg(EDITORS.map(([id, name]) => [id, name]), choice.editor, (v) => { choice.editor = v; persist(); }, { en: "Editor", yue: "編輯器" }).el),
    h("div", { class: "t1" }, t("Step 1. Download the workspace", "第 1 步：下載工作區")),
    h("div", { class: "t2" }, t("Your router backup (secrets masked) and change history, with a .code-workspace file, as one ZIP.", "你嘅路由器備份（已遮蓋機密）同更改記錄，連 .code-workspace 檔，打包成一個 ZIP。")),
    h("div", { class: "chips" }, h("button", { class: "btn f", type: "button", onClick: exportZip }, icon("folder_zip", "sm"), t("Download the workspace ZIP", "下載工作區 ZIP"))),
    h("div", { class: "t1" }, t("Step 2. Open the folder as the workspace root", "第 2 步：以資料夾做工作區根目錄開啟")),
    ui.row({ en: "Folder you unzipped to", yue: "你解壓縮到嘅資料夾" }, { en: "The full path. It opens as the root of the workspace.", yue: "完整路徑，會做工作區嘅根目錄開啟。" }, ui.text(choice.folder, { maxLength: 240, aria: { en: "Folder path", yue: "資料夾路徑" }, placeholder: "C:\\Work\\router-workspace", hint: { en: "A full path such as C:\\Work\\router-workspace or /home/pat/router-workspace.", yue: "完整路徑，例如 C:\\Work\\router-workspace 或 /home/pat/router-workspace。" }, onChange(v) { choice.folder = v; persist(); } }).el),
    h("div", { class: "chips" }, h("button", { class: "btn f", type: "button", onClick: open }, icon("open_in_new", "sm"), t("Open in the editor", "用編輯器開啟")),
      h("a", { class: "btn o", href: downloadPage(), target: "_blank", rel: "noopener noreferrer" }, icon("download", "sm"), t("Do not have Visual Studio Code?", "未有 Visual Studio Code？"))),
    result);

  const desktop = h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("What the desktop app adds", "桌面版程式嘅額外功能")),
    h("div", { class: "t2" }, t("The desktop app will look for an installed editor itself, in these places:", "桌面版程式會自己喺以下位置搵已安裝嘅編輯器：")),
    installProbes().map((p) => h("div", { class: "row off" }, icon("search", "sm"), h("span", { class: "grow" }, p.path), h("span", { class: "tag" }, p.kind))),
    h("div", { class: "note warn" }, icon("construction", "sm"), t("In progress: the detection itself needs the desktop shell. In the web app these places are only listed. Also not built yet: a one-action Open in VS Code on every export and source record screen, and opening single files at a line.", "進行中：偵測本身需要桌面外殼，網頁版只係列出呢啲位置。未做：每個匯出同來源記錄畫面嘅一鍵「用 VS Code 開啟」，同開啟單一檔案並跳到某一行。")));

  const dock = h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("dock_to_right"), " ", tt(DOCKVIEW_NOTE.title)), h("span", { class: "tag warn" }, t("Required, not integrated yet", "必要，但未整合")), h("div", { class: "t2" }, tt(DOCKVIEW_NOTE.body)));

  ctx.root.append(ctx.page(label, { en: "Hand your exported files to Visual Studio Code, or any editor, in one go.", yue: "一次過將匯出嘅檔案交俾 Visual Studio Code 或者其他編輯器。" }));
  ctx.root.firstChild.append(card, h("div", { class: "grid2" }, desktop, dock));
}

export default {
  id: "external-editor",
  screens: [{ id: "external-editor", group: { en: "Tools", yue: "工具" }, icon: "code", label, render }],
  commands: [{ id: "external-editor.open", icon: "code", label: { en: "Open in Visual Studio Code", yue: "用 Visual Studio Code 開啟" }, keywords: "vscode editor workspace export", run: (ctx) => ctx.navigate("external-editor") }],
  settings: [{ id: "external-editor", icon: "code", label, render: (ctx) => ctx.h("div", { class: "t2" }, ctx.t("Your editor choice is remembered in this browser; set it on the External editor screen.", "你嘅編輯器選擇記住喺呢個瀏覽器，喺外部編輯器畫面設定。")) }],
};

