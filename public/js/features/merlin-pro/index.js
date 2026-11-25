// The Merlin tools screen: custom scripts with a highlighted editor and a
// reviewed, super-confirmed save, a cron job builder, Entware packages, add-ons
// and JFFS usage. Everything here needs Asuswrt-Merlin firmware.
import { tokenize } from "./highlight.js";
import { createUi } from "./ui.js";

const label = { en: "Merlin tools", yue: "Merlin 工具" };
const lede = { en: "Scripts that run on events, scheduled jobs, Entware packages and add-ons.", yue: "按事件執行嘅腳本、定時工作、Entware 套件同附加功能。" };

export const formatKb = (kb) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

// Draws the highlighted copy of the text, one span per token.
export function paintCode(h, target, text) {
  target.replaceChildren(...tokenize(text).flatMap((tokens) => [...tokens.map((tk) => (tk.type === "plain" ? tk.text : h("span", { class: `tok-${tk.type}` }, tk.text))), "\n"]));
}

function editor(ctx, ui, state, holder, refresh) {
  const { api, h, t, tt, icon, toast } = ctx;
  let text = state.content;
  const view = h("code", { class: "code-view", "aria-hidden": "true" });
  const area = h("textarea", { class: "code-input", spellcheck: "false", autocapitalize: "off", wrap: "off", "aria-label": t(`Script ${state.name}`, `腳本 ${state.name}`), readOnly: !ctx.state.canWrite });
  area.value = text;
  const sync = () => {
    paintCode(h, view, text);
    view.parentNode.scrollTop = area.scrollTop;
    view.parentNode.scrollLeft = area.scrollLeft;
  };
  const dirty = () => text !== state.content;
  const review = h("button", { class: "btn f", disabled: true, onClick: async () => {
    try {
      const out = await api.post("/api/x/merlin-pro/scripts/review", { name: state.name, content: text });
      const go = await showReview(out);
      if (!go) return;
      const keys = await ui.superConfirm({ title: t(`Save ${state.name} on the router?`, `儲存 ${state.name} 去路由器？`), body: t("This file runs with full control of the router whenever its event happens. A mistake can stop the router starting its services.", "只要事件發生，呢個檔案就會以完全控制路由器嘅權限執行。有錯可能令路由器啟動唔到服務。"), action: t("Save script", "儲存腳本") });
      if (!keys) return;
      const done = await api.post("/api/actions/merlin-pro.save-script", { name: state.name, content: text, token: out.token, ...keys });
      toast(done.verified ? t(`Saved ${state.name} and read it back.`, `已儲存 ${state.name} 並讀返確認。`) : t("Saved, but the router returned different text. Check the file.", "已儲存，但路由器返回嘅內容唔同，請檢查檔案。"), done.verified ? "" : "bad");
      refresh(state.name);
    } catch (error) {
      toast(error.message, "bad");
    }
  } }, icon("fact_check", "sm"), t("Review and save", "檢查並儲存"));
  const showReview = (out) => ctx.openDialog((close) => [
    h("h2", { class: "h2" }, t(`Changes to ${out.name}`, `${out.name} 嘅改動`)),
    h("div", { class: "muted" }, out.exists ? t(`${out.added} lines added, ${out.removed} removed.`, `加咗 ${out.added} 行，刪咗 ${out.removed} 行。`) : t("A new script.", "新腳本。")),
    out.warnings.map((w) => h("div", { class: "note warn" }, icon("warning"), h("div", {}, tt(w)))),
    h("div", { class: "diffview", role: "region", "aria-label": t("Line changes", "逐行改動") }, out.diff.map((d) => h("div", { class: `dl ${d.type}` }, h("span", { class: "sign", "aria-hidden": "true" }, d.type === "add" ? "+" : d.type === "del" ? "-" : " "), h("span", { class: "sr" }, d.type === "add" ? t("Added: ", "新增：") : d.type === "del" ? t("Removed: ", "刪除：") : ""), h("code", {}, d.text || " ")))),
    out.truncated ? h("div", { class: "t2" }, t("Only the first 600 lines of the comparison are shown.", "只顯示比較結果嘅頭 600 行。")) : null,
    h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Back to editing", "返回編輯")), h("button", { class: "btn f", onClick: () => close(true) }, t("Continue", "繼續"))),
  ], { label: t("Review script changes", "檢查腳本改動") }).closed;
  area.addEventListener("input", () => {
    text = area.value;
    review.disabled = !dirty() || !ctx.state.canWrite;
    sync();
  });
  area.addEventListener("scroll", () => {
    view.parentNode.scrollTop = area.scrollTop;
    view.parentNode.scrollLeft = area.scrollLeft;
  });
  holder.replaceChildren(
    h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t1 mono" }, `/jffs/scripts/${state.name}`), state.hook ? h("div", { class: "t2" }, tt(state.hook)) : null), review),
    h("div", { class: "code-box" }, h("pre", { class: "code-pre", "aria-hidden": "true" }, view), area));
  sync();
  return () => dirty();
}

function scriptsCard(ctx, ui, data, refresh) {
  const { api, h, t, tt, icon, confirmDialog, toast } = ctx;
  const holder = h("div", {});
  let isDirty = () => false;
  const open = async (name) => {
    if (isDirty() && !(await confirmDialog({ title: t("Leave without saving?", "唔儲存就離開？"), body: t("Your edits to this script will be lost.", "你對呢個腳本嘅修改會失去。"), confirm: t("Discard edits", "放棄修改"), danger: true }))) return;
    try {
      const file = await api.get(`/api/x/merlin-pro/scripts/${encodeURIComponent(name)}`);
      isDirty = editor(ctx, ui, { name, content: file.content, hook: file.hook }, holder, (saved) => { isDirty = () => false; refresh(saved); });
      list.querySelectorAll("button[data-script]").forEach((b) => b.classList.toggle("on", b.dataset.script === name));
    } catch (error) {
      toast(error.message, "bad");
    }
  };
  const fresh = () => ui.form({
    title: t("New script", "新腳本"),
    intro: t("Pick one of the names the router runs by itself, such as services-start or firewall-start.", "揀一個路由器會自動執行嘅名稱，例如 services-start 或 firewall-start。"),
    fields: [{ name: "name", label: { en: "Script name", yue: "腳本名稱" }, maxlength: 48 }],
    submitLabel: t("Start editing", "開始編輯"),
    async submit(values) {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,47}$/.test(values.name)) throw new Error(t("Use letters, numbers, dots, dashes or underscores.", "請用字母、數字、點、橫線或底線。"));
      if (data.scripts.some((s) => s.name === values.name)) throw new Error(t("That script already exists.", "已有同名腳本。"));
      setTimeout(() => { isDirty = editor(ctx, ui, { name: values.name, content: "#!/bin/sh\n", hook: null }, holder, (saved) => refresh(saved)); }, 0);
    },
  });
  const list = h("div", { class: "chips" }, data.scripts.map((s) => h("button", { class: "chip", "data-script": s.name, title: s.hook ? tt(s.hook) : "", onClick: () => open(s.name) }, icon("description", "sm"), s.name)));
  return { open, el: ui.card(
    ui.headRow(t("Custom scripts", "自訂腳本"), ctx.state.canWrite ? h("button", { class: "btn f sm", onClick: fresh }, icon("note_add", "sm"), t("New script", "新腳本")) : null),
    h("div", { class: "t2" }, t("Open a script, edit it, then review the exact changes before anything is written.", "打開腳本、編輯，然後先檢查實際改動先會寫入。")),
    data.scripts.length ? list : ui.empty(t("No scripts yet.", "未有腳本。")), holder) };
}

// The stock schedule grid, reused without leaving anything waiting in the changes dock.
function scheduleField(ctx, onChange) {
  const entry = { id: "merlin-pro.cron.builder", key: "merlin_pro_cron_builder", control: "schedule", step: 60, value: "", secret: false, group: "cron", groupLabel: { en: "Schedule", yue: "時間表" }, risk: "low",
    label: { en: "When to run", yue: "幾時執行" }, help: { en: "Paint the days and hours. The job runs at the start of each painted block.", yue: "塗上日子同鐘數。工作會喺每個塗咗嘅時段開始時執行。" } };
  const off = ctx.bus.on("dock", () => {
    if (!ctx.dock.has(entry.id)) return;
    const value = ctx.dock.value(entry.id);
    ctx.dock.setEntry(entry, entry.value);
    onChange(value);
  });
  return { el: ctx.controls.settingRow(entry), off };
}

function cronCard(ctx, ui, data, refresh, cleanups) {
  const { api, h, t, icon, toast } = ctx;
  const v = { id: "", command: "", schedule: "" };
  const preview = h("div", { class: "t2", "aria-live": "polite" });
  const field = scheduleField(ctx, (value) => { v.schedule = value; show(); });
  cleanups.push(field.off);
  async function show() {
    if (!v.schedule || !v.id || !v.command) return preview.replaceChildren(t("Fill in the name, the command and paint a schedule to see the exact lines.", "填寫名稱、指令同塗上時間表，就會見到實際嘅行。"));
    try {
      const out = await api.post("/api/x/merlin-pro/cron/build", v);
      preview.replaceChildren(h("div", { class: "k" }, t("These jobs will be added", "會加入以下工作")), ...out.entries.map((e) => h("div", { class: "mono t1" }, `${e.expression}  ${e.command}  #${e.id}#`)));
    } catch (error) {
      preview.replaceChildren(h("div", { class: "note bad" }, icon("error"), h("div", {}, error.message)));
    }
  }
  const add = async () => {
    const keys = await ui.superConfirm({ title: t("Add these jobs?", "加入呢啲工作？"), body: t("The command runs on the router as its administrator account every time the schedule fires.", "每次時間到，指令會以路由器管理帳戶身份執行。"), action: t("Add jobs", "加入工作") });
    if (!keys) return;
    try {
      const out = await api.post("/api/actions/merlin-pro.cron-add", { ...v, ...keys });
      toast(t(`Added: ${out.added.join(", ")}`, `已加入：${out.added.join("、")}`));
      ctx.openDialog((close) => [h("h2", { class: "h2" }, t("Keep the jobs after a restart", "重啟後保留工作")), h("p", { class: "muted" }, t(out.note, "用 cru 加入嘅工作喺路由器重啟後會消失。要保留，請將以下行加入 services-start 腳本。")), h("pre", { class: "fp" }, out.persistLines.join("\n")), h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close() }, t("Done", "完成")))], { label: t("Keep the jobs", "保留工作") });
      refresh();
    } catch (error) {
      toast(error.message, "bad");
    }
  };
  const remove = async (job) => {
    const keys = await ui.superConfirm({ title: t(`Delete the job ${job.id}?`, `刪除工作 ${job.id}？`), body: t("It stops running until it is added again.", "會停止執行，直至再加入。"), action: t("Delete job", "刪除工作"), typeModel: false });
    if (!keys) return;
    try {
      await api.post("/api/actions/merlin-pro.cron-delete", { id: job.id, hold: keys.hold });
      refresh();
    } catch (error) {
      toast(error.message, "bad");
    }
  };
  return ui.card(
    ui.headRow(t("Scheduled jobs", "定時工作")),
    data.cron.length ? data.cron.map((j) => h("div", { class: "row" }, icon("schedule"), h("div", { class: "grow" }, h("div", { class: "t1 mono" }, j.command), h("div", { class: "t2 mono" }, j.expression, j.id ? ` · ${j.id}` : "")),
      ctx.state.canWrite && j.id ? h("button", { class: "btn t icon", "aria-label": t(`Delete ${j.id}`, `刪除 ${j.id}`), onClick: () => remove(j) }, icon("delete", "sm")) : null)) : ui.empty(t("No scheduled jobs.", "未有定時工作。")),
    ctx.state.canWrite
      ? h("div", { class: "cron-builder" },
        h("h3", { class: "h2" }, t("Build a job", "建立工作")),
        h("div", { class: "two" },
          h("label", { class: "lbl" }, t("Job name", "工作名稱"), h("input", { class: "field", maxlength: "32", autocomplete: "off", onInput: (e) => { v.id = e.target.value.trim(); show(); } })),
          h("label", { class: "lbl" }, t("Command", "指令"), h("input", { class: "field mono", maxlength: "240", autocomplete: "off", spellcheck: "false", onInput: (e) => { v.command = e.target.value; show(); } }))),
        field.el, preview,
        h("div", { class: "actions" }, h("button", { class: "btn f", onClick: add }, icon("add", "sm"), t("Add the jobs", "加入工作"))))
      : null);
}

function listCard(ctx, ui, { title, intro, items, render, filterLabel, empty }) {
  const { h, t } = ctx;
  const body = h("div", {});
  const paint = (q) => {
    const shown = items.filter((x) => `${x.name} ${x.version ?? ""} ${x.about?.en ?? ""}`.toLowerCase().includes(q.toLowerCase()));
    body.replaceChildren(...(shown.length ? shown.map(render) : [ui.empty(items.length ? t("Nothing matches.", "冇符合嘅項目。") : empty)]));
  };
  paint("");
  return ui.card(ui.headRow(title), intro, items.length > 8 ? h("input", { class: "field", type: "search", "aria-label": filterLabel, placeholder: filterLabel, onInput: (e) => paint(e.target.value) }) : null, body);
}

async function draw(ctx, root, cleanups, openName) {
  const ui = createUi(ctx);
  const { api, h, t, icon } = ctx;
  const data = await api.get("/api/domain/merlin-pro");
  cleanups.forEach((fn) => fn());
  cleanups.length = 0;
  const page = ctx.page(label, lede);
  root.replaceChildren(page);
  if (!data.supported) {
    page.append(ui.card(h("div", { class: "note warn" }, icon("lock"), h("div", {}, t("These tools need Asuswrt-Merlin firmware. This router runs the stock ASUS firmware, so everything here is switched off.", "呢啲工具要用 Asuswrt-Merlin 韌體。呢部路由器用緊原廠 ASUS 韌體，所以全部停用。"))),
      ...ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries))));
    return;
  }
  const refresh = (name) => draw(ctx, root, cleanups, name);
  const scripts = scriptsCard(ctx, ui, data, refresh);
  const jffs = data.jffs;
  const bar = h("i", {});
  bar.style.setProperty("--w", `${jffs?.usedPct ?? 0}%`);
  page.append(
    scripts.el,
    cronCard(ctx, ui, data, refresh, cleanups),
    listCard(ctx, ui, { title: t("Entware packages", "Entware 套件"), intro: h("div", { class: "t2" }, data.entware.present ? t(`Entware is installed with ${data.entware.packages.length} packages.`, `已安裝 Entware，共 ${data.entware.packages.length} 個套件。`) : t("Entware is not installed. Install it with amtm.", "未安裝 Entware，可以用 amtm 安裝。")), items: data.entware.packages, filterLabel: t("Filter packages", "篩選套件"), empty: t("No packages to list.", "冇套件可列出。"), render: (p) => h("div", { class: "row" }, icon("inventory_2", "sm"), h("div", { class: "grow t1 mono" }, p.name), h("span", { class: "t2 mono" }, p.version)) }),
    listCard(ctx, ui, { title: t("Add-ons", "附加功能"), intro: h("div", { class: "t2" }, data.amtm ? t("amtm, the add-on manager, is installed. Run it from an SSH session to install or update add-ons.", "已安裝附加功能管理程式 amtm。用 SSH 執行就可以安裝或更新附加功能。") : t("amtm is not installed, so add-ons are managed by hand.", "未安裝 amtm，附加功能要手動管理。")), items: data.addons, filterLabel: t("Filter add-ons", "篩選附加功能"), empty: t("No add-ons found in /jffs/addons.", "喺 /jffs/addons 搵唔到附加功能。"), render: (a) => h("div", { class: "row" }, icon("extension", "sm"), h("div", { class: "grow" }, h("div", { class: "t1" }, a.name), a.about ? h("div", { class: "t2" }, t(a.about.en, a.about.yue)) : null)) }),
    ui.card(ui.headRow(t("JFFS storage", "JFFS 儲存")),
      jffs ? [h("div", { class: `meter ${jffs.usedPct >= 90 ? "bad" : jffs.usedPct >= 75 ? "warn" : ""}`, role: "meter", "aria-label": t("JFFS space used", "JFFS 已用空間"), "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(jffs.usedPct) }, bar), h("div", { class: "t2" }, t(`${formatKb(jffs.usedKb)} used of ${formatKb(jffs.totalKb)} (${jffs.usedPct}%), ${formatKb(jffs.freeKb)} free`, `已用 ${formatKb(jffs.usedKb)} / ${formatKb(jffs.totalKb)}（${jffs.usedPct}%），尚餘 ${formatKb(jffs.freeKb)}`))] : h("div", { class: "t2" }, t("The router did not report JFFS usage.", "路由器冇提供 JFFS 用量。"))),
    ...ctx.controls.settingGroups([...data.entries, ...data.related]).map((g) => ctx.controls.groupCard(g.label, g.entries)));
  if (openName) scripts.open(openName);
}

export default {
  id: "merlin-pro",
  screens: [
    {
      id: "merlin-pro",
      group: { en: "Router", yue: "路由器" },
      icon: "extension",
      label,
      async render(ctx) {
        const cleanups = [];
        await draw(ctx, ctx.root, cleanups);
        return () => cleanups.forEach((fn) => fn());
      },
    },
  ],
  settings: [
    {
      id: "merlin-pro",
      icon: "extension",
      label,
      async render(ctx) {
        const data = await ctx.api.get("/api/domain/merlin-pro");
        return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries));
      },
    },
  ],
  commands: [
    { id: "merlin-pro.open", icon: "extension", label: { en: "Open Merlin tools", yue: "開啟 Merlin 工具" }, keywords: "merlin scripts jffs cron entware amtm addons", run: (ctx) => ctx.navigate("merlin-pro") },
    { id: "merlin-pro.cron", icon: "schedule", label: { en: "Build a scheduled job", yue: "建立定時工作" }, keywords: "cron cru schedule job", run: (ctx) => ctx.navigate("merlin-pro") },
  ],
};
