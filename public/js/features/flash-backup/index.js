// Flash backup: the router's flash partitions, and a read-only copy of the boot
// loader and nvram partitions to a USB drive. There is no way to write to flash
// from here. See server/features/flash-backup.
import { openOutput } from "./output.js";

const BASE = "/api/x/flash-backup";
const label = { en: "Flash backup", yue: "快閃備份" };
const lede = { en: "Copy the boot loader and settings partitions to a USB drive, and check the copy matches. Read-only: nothing here can write to the router's flash.", yue: "將開機載入器同設定分區複製去 USB 磁碟，並檢查副本相符。只讀：呢度完全寫唔到路由器嘅快閃記憶體。" };
const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(n % 1048576 ? 1 : 0)} MB` : `${Math.round(n / 1024)} KB`);
const kb = (n) => (n === null ? "?" : n >= 1048576 ? `${(n / 1048576).toFixed(1)} GB` : `${Math.round(n / 1024)} MB`);

async function draw(ctx, root) {
  const { api, h, icon, t, tt, toast, openDialog, state } = ctx;
  const data = await api.get("/api/domain/flash-backup");
  const page = ctx.page(label, lede);
  root.replaceChildren(page);
  const owner = state.me?.role === "owner";
  const chosen = { partition: null, target: data.targets[0]?.mount ?? null };

  page.append(h("section", { class: "card fb-safe rise" },
    h("div", { class: "row" }, icon("verified_user", "lg"), h("div", { class: "grow" }, h("h2", { class: "h2" }, t("Read-only by design", "設計上只讀")), h("div", { class: "t2" }, t("The partition is only ever read. The one thing written is a new file on your USB drive, which is then compared with the flash by SHA-256.", "分區只會被讀取。唯一寫入嘅係你 USB 磁碟上面嘅新檔案，之後會用 SHA-256 同快閃記憶體比對。")))),
    h("div", { class: "note warn" }, icon("key"), h("div", {}, t("The settings (nvram) partition contains your Wi-Fi passwords in plain form. Keep the drive somewhere safe. Only the owner can make a copy.", "設定（nvram）分區入面有你 Wi-Fi 密碼嘅明文。請妥善保管磁碟。只有擁有者可以複製。")))));

  const rows = data.partitions.map((p, i) => {
    const pick = h("button", { class: "btn t sm", disabled: !p.offered || !owner || !chosen.target, "aria-label": `${t("Copy", "複製")} ${p.name}`, onClick: () => confirm(p) }, icon("content_copy", "sm"), t("Copy", "複製"));
    const r = h("div", { class: `row fb-part ${p.offered ? "" : "fb-off"}` },
      icon(p.offered ? "memory" : "lock"),
      h("div", { class: "grow" }, h("div", { class: "t1" }, p.name, h("span", { class: "t2 mono" }, `  mtd${p.index} · ${size(p.size)}`)), h("div", { class: "t2" }, p.offered ? t("Can be copied", "可以複製") : t("Only the boot loader and settings partitions are offered here.", "呢度只提供開機載入器同設定分區。"))),
      pick);
    r.style.setProperty("--i", String(i));
    return r;
  });
  page.append(h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("memory", "sm"), " ", t("Flash partitions", "快閃分區")), rows));

  const targetCard = h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("usb", "sm"), " ", t("Where the copy goes", "副本放喺邊")));
  if (!data.targets.length) targetCard.append(h("div", { class: "note warn" }, icon("usb_off"), h("div", {}, t("No USB drive is mounted on the router. Plug one in, then press Refresh.", "路由器冇掛載任何 USB 磁碟。請插入一個，再撳「重新整理」。"))));
  else
    targetCard.append(h("div", { class: "seg fb-targets", role: "radiogroup", "aria-label": t("Drive", "磁碟") }, data.targets.map((d) => h("button", { role: "radio", class: chosen.target === d.mount ? "on" : "", "aria-checked": String(chosen.target === d.mount), onClick: (e) => { chosen.target = d.mount; e.currentTarget.parentNode.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b === e.currentTarget); b.setAttribute("aria-checked", String(b === e.currentTarget)); }); } }, `${d.mount} · ${t(`${kb(d.freeKb)} free`, `剩 ${kb(d.freeKb)}`)}`))));
  targetCard.append(h("div", { class: "actions" }, h("button", { class: "btn t", onClick: () => draw(ctx, root) }, icon("refresh", "sm"), t("Refresh", "重新整理"))));
  page.append(targetCard);

  page.append(h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("folder_zip", "sm"), " ", t("Copies already on the drive", "磁碟上已有嘅副本")),
    data.existing.length ? data.existing.map((f) => h("div", { class: "row" }, icon("description"), h("div", { class: "grow" }, h("div", { class: "t1 mono fb-name" }, f.name), h("div", { class: "t2" }, `${f.mount}/${data.folder} · ${size(f.size)} · ${f.modified}`)))) : h("div", { class: "t2" }, t("None yet.", "暫時冇。"))));
  if (!owner) page.append(h("div", { class: "note" }, icon("lock"), h("div", {}, t("Only the owner can copy a partition.", "只有擁有者可以複製分區。"))));

  function confirm(p) {
    openDialog((close) => [
      h("h2", { class: "h2" }, t(`Copy the ${p.name} partition?`, `複製 ${p.name} 分區？`)),
      h("div", { class: "t2" }, t(`Read mtd${p.index} (${size(p.size)}) and write it to ${chosen.target}/${data.folder}. Then compare the two.`, `讀取 mtd${p.index}（${size(p.size)}）並寫去 ${chosen.target}/${data.folder}，之後比對兩者。`)),
      p.name.toLowerCase().startsWith("nvram") ? h("div", { class: "note warn" }, icon("key"), h("div", {}, t("This copy contains Wi-Fi passwords. Keep the drive safe.", "呢個副本包含 Wi-Fi 密碼，請妥善保管磁碟。"))) : null,
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: () => close(true) }, icon("content_copy", "sm"), t("Copy", "複製"))),
    ], { label: p.name }).closed.then(async (ok) => {
      if (!ok) return;
      try {
        const started = await api.post(`${BASE}/copy`, { partition: p.index, target: chosen.target, ack: true });
        const { done } = openOutput(ctx, { job: started.job, title: t(`Copy ${p.name}`, `複製 ${p.name}`), command: `dd if=${started.device}`, risk: "low" });
        done.then((r) => { if (r?.status === "done") draw(ctx, root); });
      } catch (error) {
        toast(error.message, "bad");
      }
    });
  }
}

export default {
  id: "flash-backup",
  screens: [{ id: "flash-backup", group: { en: "Power tools", yue: "進階工具" }, icon: "save", label, render: (ctx) => draw(ctx, ctx.root) }],
  commands: [{ id: "flash-backup.open", icon: "save", label, keywords: "mtd nvram bootloader partition copy usb backup flash", run: (ctx) => ctx.navigate("flash-backup") }],
};
