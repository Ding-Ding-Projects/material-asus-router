// The mode builder: pick settings from the whole catalogue, choose the value
// each one gets with its real control, name the mode, choose an icon and save it.
// Saving writes nothing to the router: modes are kept by the app, as many as you
// like. A setting this router cannot store right now can still go in a mode; it is
// kept for later use and left out when the mode is turned on.
// Saving writes nothing to the router. The saved mode then appears on the Modes
// screen, where it is previewed, applied and undone like the ready-made ones.
import { canEdit, itemControl, loadControls } from "./item-control.js";

const label = { en: "Mode builder", yue: "砌模式" };
const SHOW_LIMIT = 60;

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  await loadControls();
  const page = ctx.page(label, { en: "Compose your own mode from any setting this router has. Each setting is chosen with its real control, and nothing is written until you turn the mode on from the Modes screen.", yue: "用呢部路由器任何一個設定砌自己嘅模式。每個設定都用佢真正嘅控制項揀值，要喺「模式」頁開啟先會寫入。" });
  ctx.root.append(page);

  let entries = [];
  let refused = {};
  let later = {}; // settings this router cannot store now: allowed in a mode, kept for later
  let icons = ["bolt"];
  let saved = [];
  const model = { id: null, name: "", icon: "movie", items: [] }; // items: [{ id, value }]
  let query = "";
  let showAll = false;
  let problems = [];
  let outcome = null; // { kind: "ok" | "no", title, text }
  let checkTimer = null;
  const locked = !ctx.state.canWrite;

  const banner = h("div", { class: "mb-banner-host" });
  const savedBox = h("section", { class: "card rise", hidden: true });
  const nameInput = h("input", { class: "field", type: "text", maxlength: "40", placeholder: t("Movie night", "睇戲之夜"), "aria-label": t("Mode name", "模式名稱"), disabled: locked, onInput: (e) => { model.name = e.target.value; paintActions(); } });
  const iconBox = h("div", { class: "mb-icons", role: "radiogroup", "aria-label": t("Icon", "圖示") });
  const palette = h("div", { class: "mb-list" });
  const canvas = h("div", { class: "mb-canvas" });
  const count = h("span", { class: "tag" });
  const problemBox = h("div", { class: "mb-problems", role: "alert", hidden: true });
  const saveButton = h("button", { class: "btn f", disabled: true, onClick: () => save() }, icon("save", "sm"), t("Save mode", "儲存模式"));
  const previewButton = h("button", { class: "btn t", disabled: true, onClick: () => previewMode() }, icon("preview", "sm"), t("Preview changes", "預覽變更"));
  const search = h("input", { class: "field", type: "search", placeholder: t("Search every setting", "搜尋所有設定"), "aria-label": t("Search settings", "搜尋設定"), onInput: (e) => { query = e.target.value; showAll = false; paintPalette(); } });

  const byId = (id) => entries.find((e) => e.id === id);

  // ---- banners --------------------------------------------------------------
  function paintBanner() {
    ctx.clear(banner);
    if (!outcome) return;
    banner.append(h("div", { class: `mb-banner ${outcome.kind}`, role: outcome.kind === "ok" ? "status" : "alert" },
      h("span", { class: "mb-mark" }, icon(outcome.kind === "ok" ? "check" : "warning", "lg")),
      h("div", { class: "grow" }, h("div", { class: "t1" }, outcome.title), h("div", { class: "t2" }, outcome.text)),
      outcome.kind === "ok" ? h("button", { class: "btn o sm", onClick: () => ctx.navigate("modes") }, icon("bolt", "sm"), t("Open Modes", "去模式頁")) : null));
  }

  // ---- the palette ----------------------------------------------------------
  function matches(entry) {
    const q = query.trim().toLowerCase();
    return !q || `${entry.label.en} ${entry.label.yue} ${entry.key} ${entry.help.en} ${entry.groupLabel?.en ?? ""} ${entry.groupLabel?.yue ?? ""}`.toLowerCase().includes(q);
  }

  function paintPalette() {
    ctx.clear(palette);
    const inMode = new Set(model.items.map((i) => i.id));
    const found = entries.filter((e) => !e.secret && e.control !== "password" && !e.readOnly && matches(e));
    const shown = showAll ? found : found.slice(0, SHOW_LIMIT);
    if (!found.length) palette.append(h("div", { class: "empty" }, icon("search_off", "lg"), t("No setting matches that search.", "冇設定符合呢個搜尋。")));
    for (const entry of shown) {
      const why = refused[entry.id] ?? (canEdit(entry) ? null : { en: "This kind of setting cannot be edited inside a mode yet.", yue: "呢類設定暫時唔可以喺模式入面編輯。" });
      const taken = inMode.has(entry.id);
      const wait = why ? null : later[entry.id];
      palette.append(h("div", { class: `mb-entry${why ? " off" : ""}` },
        h("div", { class: "grow" }, h("div", { class: "t1" }, tt(entry.label)), h("div", { class: "t2" }, tt(entry.groupLabel ?? { en: "", yue: "" })), why ? h("div", { class: "t2" }, icon("lock", "sm"), " ", tt(why)) : null,
          wait ? h("div", { class: "t2" }, icon("inventory_2", "sm"), " ", tt(wait), " ", t("It can still go in a mode, kept for later.", "仍然可以放入模式，留返之後用。")) : null),
        h("button", { class: "btn t sm", disabled: locked || Boolean(why) || taken, "aria-label": `${taken ? t("Already in the mode", "已經喺模式入面") : t("Add to the mode", "加入模式")}: ${tt(entry.label)}`, onClick: () => add(entry) }, icon(taken ? "check" : "add", "sm"), taken ? t("Added", "已加入") : t("Add", "加入"))));
    }
    if (found.length > shown.length) palette.append(h("button", { class: "btn o sm", onClick: () => { showAll = true; paintPalette(); } }, t(`Show all ${found.length}`, `顯示全部 ${found.length} 項`)));
  }

  // ---- the canvas -----------------------------------------------------------
  function add(entry) {
    if (model.items.some((i) => i.id === entry.id)) return;
    model.items.push({ id: entry.id, value: entry.value ?? "" });
    outcome = null;
    paintBanner();
    paintCanvas();
    paintPalette();
    scheduleCheck();
    ctx.notifications.toast(t(`Added ${tt(entry.label)}`, `已加入 ${tt(entry.label)}`));
  }

  function remove(id) {
    model.items = model.items.filter((i) => i.id !== id);
    paintCanvas();
    paintPalette();
    scheduleCheck();
  }

  function paintCanvas() {
    ctx.clear(canvas);
    count.textContent = t(`${model.items.length} settings in this mode`, `${model.items.length} 個設定喺呢個模式`);
    if (!model.items.length) {
      canvas.append(h("div", { class: "empty mb-empty" }, icon("add_circle", "lg"), h("div", { class: "t1" }, t("An empty mode", "一個空嘅模式")), t("Pick a setting on the left, then add it. A mode needs at least one setting.", "喺左邊揀個設定，再加入。模式最少要有一個設定。")));
    }
    model.items.forEach((item, index) => {
      const entry = byId(item.id);
      const why = entry ? refused[item.id] : null;
      const wait = !entry ? { en: "This router does not have that setting.", yue: "呢部路由器冇呢個設定。" } : why ? null : later[item.id];
      const control = entry && !why && canEdit(entry) ? itemControl(ctx, entry, () => item.value, (value) => { item.value = value; outcome = null; scheduleCheck(); }, locked) : null;
      const card = h("div", { class: `mb-item${why ? " off" : ""}` },
        h("div", { class: "mb-item-top" },
          h("div", { class: "grow" }, h("div", { class: "t1" }, entry ? tt(entry.label) : item.id), h("div", { class: "t2" }, entry ? t(`Now: ${entry.value === "" ? "empty" : entry.value}`, `而家：${entry.value === "" ? "空" : entry.value}`) : ""), why ? h("div", { class: "t2" }, icon("lock", "sm"), " ", tt(why)) : null,
            wait ? h("div", { class: "t2" }, icon("inventory_2", "sm"), " ", tt(wait), " ", t("Kept in the mode for later use, and left out when the mode is turned on.", "會留喺模式入面之後用，開啟模式嗰陣會略過。")) : null),
          h("button", { class: "btn o sm", disabled: locked, "aria-label": `${t("Remove from mode", "由模式移走")}: ${entry ? tt(entry.label) : item.id}`, onClick: () => remove(item.id) }, icon("close", "sm"), t("Remove", "移走"))),
        control ? h("div", { class: "mb-item-ctl" }, control.el) : null);
      card.style.setProperty("--i", String(index));
      canvas.append(card);
    });
  }

  function paintIcons() {
    ctx.clear(iconBox);
    for (const name of icons) {
      iconBox.append(h("button", { type: "button", role: "radio", class: `mb-icon${model.icon === name ? " on" : ""}`, "aria-checked": String(model.icon === name), "aria-label": name.replaceAll("_", " "), disabled: locked, onClick: () => { model.icon = name; paintIcons(); } }, icon(name, "lg")));
    }
  }

  function paintActions() {
    const ready = !locked && model.name.trim().length > 0 && model.items.length > 0 && problems.length === 0;
    saveButton.disabled = !ready;
    previewButton.disabled = !ready;
  }

  function paintProblems() {
    ctx.clear(problemBox);
    problemBox.hidden = problems.length === 0;
    for (const p of problems) problemBox.append(h("div", { class: "mb-problem" }, icon("error", "sm"), h("span", {}, `${tt(p)}`)));
    paintActions();
  }

  // Asks the server whether the mode, as it stands, could be saved. It never saves.
  function scheduleCheck() {
    clearTimeout(checkTimer);
    count.textContent = t(`${model.items.length} settings in this mode`, `${model.items.length} 個設定喺呢個模式`);
    paintActions();
    checkTimer = setTimeout(async () => {
      if (!model.items.length) {
        problems = [];
        return paintProblems();
      }
      try {
        const result = await api.post("/api/x/mode-builder/check", { items: model.items });
        problems = result.ok ? [] : result.problems;
        if (!result.ok) outcome = { kind: "no", title: t("This mode cannot be saved yet", "呢個模式暫時存唔到"), text: tt(result.problems[0]) };
        else if (outcome?.kind === "no") outcome = null;
      } catch (error) {
        problems = [{ en: error.message, yue: error.message }];
      }
      paintBanner();
      paintProblems();
    }, 300);
  }

  // ---- saved modes ----------------------------------------------------------
  function paintSaved() {
    ctx.clear(savedBox);
    savedBox.hidden = saved.length === 0;
    if (!saved.length) return;
    savedBox.append(h("h2", { class: "h2" }, t("Your modes", "你嘅模式")),
      ...saved.map((mode) => h("div", { class: `row${model.id === mode.id ? " mb-editing" : ""}` },
        icon(mode.icon, "lg"),
        h("div", { class: "grow" }, h("div", { class: "t1" }, mode.name), h("div", { class: "t2" }, t(`${mode.items.length} settings`, `${mode.items.length} 個設定`))),
        h("button", { class: "btn t sm", onClick: () => edit(mode) }, icon("edit", "sm"), t("Edit", "編輯")),
        h("button", { class: "btn o sm", disabled: locked, "aria-label": `${t("Delete", "刪除")} ${mode.name}`, onClick: () => del(mode) }, icon("delete", "sm"), t("Delete", "刪除")))));
  }

  function edit(mode) {
    Object.assign(model, { id: mode.id, name: mode.name, icon: mode.icon, items: mode.items.map((i) => ({ ...i })) });
    nameInput.value = model.name;
    outcome = null;
    paintAll();
    scheduleCheck();
    nameInput.focus();
  }

  async function del(mode) {
    if (!(await ctx.confirmDialog({ title: t(`Delete "${mode.name}"?`, `刪除「${mode.name}」？`), body: t("The mode is removed from this app. The router is not changed, and anything the mode already set stays as it is.", "模式會由呢個程式移除。路由器唔會有變，模式已經設定咗嘅嘢會保持原狀。"), confirm: t("Delete", "刪除"), danger: true }))) return;
    try {
      await api.del(`/api/x/mode-builder/modes/${encodeURIComponent(mode.id)}`);
      if (model.id === mode.id) reset();
      await load();
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
  }

  function reset() {
    Object.assign(model, { id: null, name: "", icon: "movie", items: [] });
    nameInput.value = "";
    paintAll();
  }

  async function save() {
    try {
      const mode = await api.post("/api/x/mode-builder/modes", { id: model.id ?? undefined, name: model.name, icon: model.icon, items: model.items });
      model.id = mode.id;
      const kept = mode.later?.length ?? 0;
      outcome = { kind: "ok", title: t("Mode saved", "模式已儲存"), text: t(`${mode.name} is now a card on the Modes screen. Nothing was written to the router yet.`, `「${mode.name}」已經變成模式頁嘅一張卡。暫時乜都未寫入路由器。`) + (kept ? ` ${t(`${kept} setting${kept === 1 ? "" : "s"} this router cannot store now ${kept === 1 ? "is" : "are"} kept in the mode for later use.`, `有 ${kept} 個設定呢部路由器而家存唔到，已經留喺模式入面之後用。`)}` : "") };
      await load();
    } catch (error) {
      outcome = { kind: "no", title: error.status === 409 ? t("This mode contradicts itself", "呢個模式自相矛盾") : t("The mode was not saved", "模式未儲存"), text: error.message };
      paintBanner();
    }
  }

  // Shows the exact old and new values the saved mode would write, straight from the change engine.
  async function previewMode() {
    await save();
    if (outcome?.kind !== "ok") return;
    try {
      const result = await api.post("/api/x/modes/preview", { id: model.id, action: "apply" });
      ctx.openDialog((close) => [
        h("h2", { class: "h2" }, t("Exactly what changes", "實際會改啲乜")),
        h("div", { class: "mode-diff", role: "list" }, result.display.map((d) => h("div", { class: "mode-diff-row", role: "listitem" },
          h("div", { class: "grow" }, h("div", { class: "t1" }, tt(result.preview.items.find((i) => i.key === d.key)?.label ?? { en: d.key, yue: d.key })), h("div", { class: "t2 mono" }, d.key)),
          h("div", { class: "was" }, tt(d.old)), icon("arrow_forward", "sm"), h("div", { class: "now" }, tt(d.new))))),
        h("p", { class: "muted" }, t("Nothing has been written. Turn the mode on from the Modes screen.", "暫時乜都未寫入。喺「模式」頁開啟先會寫入。")),
        h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close() }, t("Close", "關閉")), h("button", { class: "btn f", onClick: () => { close(); ctx.navigate("modes"); } }, icon("bolt", "sm"), t("Open Modes", "去模式頁"))),
      ], { label: t("Exactly what changes", "實際會改啲乜") });
    } catch (error) {
      ctx.toast(error.message, error.status === 409 ? "warn" : "bad");
    }
  }

  function paintAll() {
    nameInput.value = model.name;
    paintIcons();
    paintCanvas();
    paintPalette();
    paintSaved();
    paintBanner();
    paintProblems();
  }

  async function load() {
    const [list, catalog, built] = await Promise.all([api.get("/api/x/mode-builder/modes"), api.get("/api/catalog"), api.get("/api/x/mode-builder/palette")]);
    saved = list.modes;
    icons = list.icons;
    entries = catalog.entries;
    refused = built.refused;
    later = built.later ?? {};
    paintAll();
  }

  page.append(banner, savedBox,
    h("div", { class: "mb-grid" },
      h("section", { class: "card rise mb-palette" }, h("h2", { class: "h2" }, t("Settings palette", "設定調色盤")), search, palette),
      h("section", { class: "card rise mb-main" },
        h("h2", { class: "h2" }, t("Mode builder", "砌模式")),
        h("label", { class: "mode-param" }, h("span", { class: "t1" }, t("Name", "名稱")), nameInput),
        h("div", { class: "mode-param" }, h("span", { class: "t1" }, t("Icon", "圖示")), iconBox),
        h("div", { class: "chips" }, count, t("Keep as many modes as you like. They are saved by this app, not on the router.", "想留幾多個模式都得。模式由呢個程式儲存，唔係存喺路由器。")),
        problemBox,
        canvas,
        h("div", { class: "actions" }, saveButton, previewButton, h("button", { class: "btn o", onClick: () => reset() }, icon("restart_alt", "sm"), t("Start again", "重新開始"))))));

  try {
    await load();
  } catch (error) {
    ctx.toast(error.message, "bad");
  }
  return () => clearTimeout(checkTimer);
}

export default {
  id: "mode-builder",
  screens: [{ id: "mode-builder", group: { en: "Router", yue: "路由器" }, icon: "build_circle", label, render: screen }],
  commands: [{ id: "mode-builder.open", icon: "build_circle", label: { en: "Build your own mode", yue: "砌個自己嘅模式" }, keywords: "mode builder custom movie night own 模式 自己 砌", run: (ctx) => ctx.navigate("mode-builder") }],
};
