// Windows virtual disk manager screen. In the web app (and on anything but
// Windows) it explains that it needs the Windows desktop app and shows what it
// will do. In the desktop app it creates, attaches, detaches, resizes,
// compacts and converts VHD and VHDX files, naming the route each time and
// showing the equivalent script. Every change needs a hold-to-confirm.
import { makeUi } from "./ui.js";
import { load, save } from "./store.js";

const label = { en: "Virtual disks", yue: "虛擬磁碟" };
const BASE = "/api/x/virtual-disk-manager";
const HOLD_MS = 1200;

const OPS = [
  ["create", { en: "Create", yue: "建立" }, "add_circle", ["path", "size", "type"]],
  ["create-differencing", { en: "Differencing disk", yue: "差異磁碟" }, "account_tree", ["path", "parent"]],
  ["attach", { en: "Attach", yue: "掛載" }, "link", ["path", "readOnly"]],
  ["detach", { en: "Detach", yue: "卸載" }, "link_off", ["path"]],
  ["grow", { en: "Grow", yue: "擴大" }, "open_in_full", ["path", "size"]],
  ["shrink", { en: "Shrink", yue: "縮細" }, "close_fullscreen", ["path", "size", "toMinimum"]],
  ["compact", { en: "Compact", yue: "壓縮空間" }, "compress", ["path"]],
  ["convert", { en: "Convert", yue: "轉換格式" }, "swap_horiz", ["path", "destination", "type"]],
  ["attach-iso", { en: "Attach ISO", yue: "掛載 ISO" }, "album", ["path"]],
  ["detach-iso", { en: "Detach ISO", yue: "卸載 ISO" }, "eject", ["path"]],
];
const HELP = {
  create: { en: "Makes a new disk file. It never replaces a file that already exists.", yue: "建立新嘅磁碟檔。永不覆蓋已有嘅檔案。" },
  "create-differencing": { en: "Makes a child disk that stores only the changes from its parent.", yue: "建立只儲存同父磁碟差異嘅子磁碟。" },
  attach: { en: "Makes the disk appear in Windows as a drive.", yue: "令磁碟喺 Windows 顯示為磁碟機。" },
  detach: { en: "Removes the drive from Windows. The file stays.", yue: "由 Windows 移除磁碟機。檔案會保留。" },
  grow: { en: "Makes the disk larger. The partition inside is not changed.", yue: "將磁碟擴大。入面嘅分割區唔會改變。" },
  shrink: { en: "Makes the disk smaller. Shrink the partition inside first or data can be lost. Only .vhdx can shrink.", yue: "將磁碟縮細。要先縮細入面嘅分割區，否則可能遺失資料。只有 .vhdx 可以縮細。" },
  compact: { en: "Frees unused space from a dynamic disk file. Detach it first.", yue: "釋放動態磁碟檔嘅未用空間。請先卸載。" },
  convert: { en: "Writes a new disk in the other format. The original is kept.", yue: "以另一種格式寫出新磁碟。原本嗰個會保留。" },
  "attach-iso": { en: "Mounts an ISO file read-only.", yue: "以唯讀方式掛載 ISO 檔。" },
  "detach-iso": { en: "Unmounts an ISO file.", yue: "卸載 ISO 檔。" },
};

function render(ctx) {
  const { h, icon, t, tt, api, toast } = ctx;
  const ui = makeUi(ctx);
  const form = { op: "create", path: "", parent: "", destination: "", size: 20, unit: "GB", type: "dynamic", readOnly: false, toMinimum: false, ...load("form", {}) };
  const persist = () => save("form", { ...form, path: "", parent: "", destination: "" });
  const body = h("div", {});
  const out = h("div", { class: "list" });
  let status = null;

  function holdButton(text, onConfirm, disabled) {
    let timer = null;
    const fill = h("progress", { max: "100", value: "0", "aria-hidden": "true" });
    const button = h("button", { type: "button", class: "btn d", disabled, "aria-label": t(`${tt(text)}: press and hold for a moment to confirm`, `${tt(text)}：撳住一陣先確認`) }, icon("touch_app", "sm"), tt(text));
    const start = () => {
      if (timer || button.disabled) return;
      const began = performance.now();
      timer = setInterval(() => {
        const p = Math.min(100, ((performance.now() - began) / HOLD_MS) * 100);
        fill.value = p;
        if (p >= 100) { stop(); onConfirm(); }
      }, 40);
    };
    const stop = () => { clearInterval(timer); timer = null; fill.value = 0; };
    button.addEventListener("pointerdown", start);
    for (const ev of ["pointerup", "pointerleave", "pointercancel", "blur"]) button.addEventListener(ev, stop);
    button.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } });
    button.addEventListener("keyup", stop);
    return h("div", { class: "ctl" }, button, fill, h("span", { class: "t2" }, t("Hold to confirm", "撳住確認")));
  }

  function drawResult(result, error) {
    out.replaceChildren(error
      ? h("div", { class: "note bad", role: "alert" }, icon("error", "sm"), h("div", {}, error.message, error.hint ? h("div", { class: "t2" }, error.hint) : null))
      : h("div", { class: "note" }, icon("check_circle", "sm"), h("div", {}, t(`Done by ${result.route}.`, `已經用 ${result.route} 完成。`), result.output ? h("pre", { class: "fp" }, JSON.stringify(result.output, null, 2)) : null)),
    result?.equivalent ? h("details", {}, h("summary", {}, t("The equivalent PowerShell script", "等效嘅 PowerShell 腳本")), h("pre", { class: "fp" }, result.equivalent)) : null);
  }

  function drawForm() {
    const op = OPS.find(([id]) => id === form.op);
    const fields = op[3];
    const pathField = (key, title, help, exts) => ui.row(title, help, ui.text(form[key], { maxLength: 240, aria: title, hint: { en: `A full Windows path ending in ${exts}.`, yue: `完整 Windows 路徑，以 ${exts} 結尾。` }, placeholder: "D:\\Disks\\data.vhdx", onChange(v) { form[key] = v.trim(); } }).el);
    const rows = [
      ui.row({ en: "Operation", yue: "操作" }, HELP[form.op], ui.select(OPS.map(([id, name]) => [id, name]), form.op, (v) => { form.op = v; persist(); drawForm(); }, { en: "Operation", yue: "操作" }).el),
      fields.includes("path") ? pathField("path", { en: form.op.includes("iso") ? "ISO file" : "Disk file", yue: form.op.includes("iso") ? "ISO 檔" : "磁碟檔" }, null, form.op.includes("iso") ? ".iso" : ".vhd, .vhdx or .vhds") : null,
      fields.includes("parent") ? pathField("parent", { en: "Parent disk", yue: "父磁碟" }, null, ".vhd or .vhdx") : null,
      fields.includes("destination") ? pathField("destination", { en: "New disk file", yue: "新磁碟檔" }, { en: "Must use the other extension.", yue: "要用另一個副檔名。" }, ".vhd or .vhdx") : null,
      fields.includes("size") && !(form.op === "shrink" && form.toMinimum) ? ui.row({ en: "Size", yue: "大小" }, { en: ".vhd is limited to 2040 GB; .vhdx and .vhds to 64 TB.", yue: ".vhd 最大 2040 GB；.vhdx 同 .vhds 最大 64 TB。" }, h("div", { class: "ctl" }, ui.stepper(1, 1048576, 1, "", form.size, (v) => { form.size = v; persist(); }, { en: "Size", yue: "大小" }).el, ui.seg([["MB", "MB"], ["GB", "GB"], ["TB", "TB"]], form.unit, (v) => { form.unit = v; persist(); }, { en: "Unit", yue: "單位" }).el)) : null,
      fields.includes("toMinimum") ? ui.row({ en: "Shrink to the smallest possible", yue: "縮到最細" }, { en: "Windows works out the smallest size the data allows.", yue: "由 Windows 計算資料容許嘅最細大小。" }, ui.sw(form.toMinimum, (v) => { form.toMinimum = v; persist(); drawForm(); }, { en: "Shrink to the smallest possible", yue: "縮到最細" }).el) : null,
      fields.includes("type") ? ui.row({ en: "Type", yue: "類型" }, { en: "Dynamic grows as it fills; fixed takes all its space at once.", yue: "動態會跟住用量增長；固定即時佔用全部空間。" }, ui.seg([["dynamic", { en: "Dynamic", yue: "動態" }], ["fixed", { en: "Fixed", yue: "固定" }]], form.type, (v) => { form.type = v; persist(); }, { en: "Type", yue: "類型" }).el) : null,
      fields.includes("readOnly") ? ui.row({ en: "Read only", yue: "唯讀" }, null, ui.sw(form.readOnly, (v) => { form.readOnly = v; persist(); }, { en: "Read only", yue: "唯讀" }).el) : null,
    ].filter(Boolean);
    const payload = () => ({ operation: form.op, path: form.path, parent: form.parent, destination: form.destination, size: form.size, unit: form.unit, type: form.type, readOnly: form.readOnly, toMinimum: form.toMinimum });
    const preview = h("button", { type: "button", class: "btn o", async onClick() {
      try { const r = await api.post(`${BASE}/preview`, payload()); out.replaceChildren(h("div", { class: "note" }, icon("description", "sm"), t(`Route: ${r.route}. Nothing has been run.`, `途徑：${r.route}。未有執行任何嘢。`)), h("pre", { class: "fp" }, r.script)); } catch (error) { drawResult(null, error); }
    } }, icon("visibility", "sm"), t("Show the script first", "先睇腳本"));
    const run = holdButton(op[1], async () => {
      try { drawResult(await api.post(`/api/actions/virtual-disk-manager.${form.op}`, { ...payload(), hold: true })); toast(t("Done.", "完成。")); } catch (error) { drawResult(null, error); }
    }, !ctxCanRun());
    formBox.replaceChildren(h("h2", { class: "h2" }, icon(op[2]), " ", tt(op[1])), ...rows, h("div", { class: "chips" }, preview), run);
  }
  const ctxCanRun = () => Boolean(status?.available) && ctx.state.canWrite;
  const formBox = h("section", { class: "card rise" });

  async function start() {
    try {
      status = await api.get(`${BASE}/status`);
    } catch (error) {
      body.replaceChildren(h("div", { class: "note bad" }, icon("error", "sm"), error.message));
      return;
    }
    const banner = status.available
      ? h("div", { class: "note" }, icon("check_circle", "sm"), t("Connected to Windows storage. Every change asks you to hold the button, and elevation prompts are always yours to approve.", "已連接 Windows 儲存。每個更改都要撳住個掣確認，提升權限嘅提示永遠由你自己批准。"))
      : h("div", { class: "note warn", role: "status" }, icon("desktop_windows", "sm"), h("div", {}, h("div", { class: "t1" }, t("Needs the Windows desktop app", "需要 Windows 桌面版程式")), tt(status.reason)));
    const ops = h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("What it does", "功能")),
      OPS.map(([id, name, ic]) => h("div", { class: `row ${status.available ? "" : "off"}` }, icon(ic, "sm"), h("span", { class: "grow" }, h("div", { class: "t1" }, tt(name)), h("div", { class: "t2" }, tt(HELP[id]))), h("span", { class: "tag" }, status.operations.find((o) => o.id === id)?.route ?? ""))));
    const listBtn = h("button", { type: "button", class: "btn t", disabled: !status.available, async onClick() { try { drawResult(await api.get(`${BASE}/list`)); } catch (error) { drawResult(null, error); } } }, icon("list", "sm"), t("List attached virtual disks", "列出已掛載嘅虛擬磁碟"));
    const inProgress = h("div", { class: "note warn" }, icon("construction", "sm"), t("In progress: VHD Set specifics, Quick pack with auto-grow and SHA-256 verification, and real round trips on a Windows host. The commands are built and tested against a stand-in for PowerShell here; they have not been run on a real Windows disk yet.", "進行中：VHD Set 細節、有自動擴大同 SHA-256 驗證嘅快速打包，同喺真正 Windows 主機上嘅完整來回測試。指令喺度只係用 PowerShell 替身測試過，仲未喺真正 Windows 磁碟上跑過。"));
    body.replaceChildren(banner, status.available ? h("div", { class: "grid2" }, formBox, h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Result", "結果")), listBtn, out)) : ops, inProgress);
    if (status.available) drawForm();
  }
  ctx.root.append(ctx.page(label, { en: "Create and manage VHD and VHDX disks with the Hyper-V and storage tools of Windows.", yue: "用 Windows 嘅 Hyper-V 同儲存工具建立同管理 VHD、VHDX 磁碟。" }));
  ctx.root.firstChild.append(body);
  start();
}

export default {
  id: "virtual-disk-manager",
  screens: [{ id: "virtual-disk-manager", group: { en: "Tools", yue: "工具" }, icon: "hard_drive", label, render }],
  commands: [{ id: "virtual-disk-manager.open", icon: "hard_drive", label: { en: "Open virtual disks", yue: "開啟虛擬磁碟" }, keywords: "vhd vhdx iso virtual disk hyper-v attach", run: (ctx) => ctx.navigate("virtual-disk-manager") }],
};
