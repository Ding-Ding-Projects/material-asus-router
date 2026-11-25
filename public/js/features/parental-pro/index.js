// Parental controls, per device: block a device always, or on a weekly
// schedule edited on a 7 by 24 grid, plus the web and apps filter categories
// on models that have the traffic-inspection engine. A change updates the
// router's four parallel lists together through the change dock, so it gets a
// preview, the safety net and undo like every other setting.
import { COLUMN_KEYS, ENTRY_IDS, NIGHTLY, blockedHours, describeSlot, gridToSlots, parseSlots, readDevices, slotsToGrid, splitColumn, writeDevices } from "./model.js";

const label = { en: "Time limits and filters", yue: "時間限制同過濾" };
const lede = { en: "Cut a device off from the internet, or block it at set times of the week.", yue: "斷開某部裝置嘅網絡，或者喺每星期指定時間封鎖。" };
const DAYS = [["Sun", "日"], ["Mon", "一"], ["Tue", "二"], ["Wed", "三"], ["Thu", "四"], ["Fri", "五"], ["Sat", "六"]];
const MAC = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

// A week of hour cells you click or drag across (blocked cells are filled).
// Keyboard users press Space or Enter on a cell. onChange gets the new grid.
export function gridEditor(ctx, grid, onChange, locked, name) {
  const { h, t } = ctx;
  let painting = null;
  const cells = [];
  const root = h("div", { class: "schedule pp-grid", role: "group", "aria-label": `${t("Blocked times for", "封鎖時段：")} ${name}` });
  root.style.setProperty("--cols", "24");
  const paint = (d, c, on) => { grid[d][c] = on; cells[d][c].classList.toggle("on", on); cells[d][c].setAttribute("aria-pressed", String(on)); };
  const finish = () => { if (painting !== null) { painting = null; onChange(grid); } };
  DAYS.forEach(([en, yue], d) => {
    cells[d] = [];
    root.append(h("span", { class: "dayname" }, t(en, yue)));
    for (let c = 0; c < 24; c += 1) {
      const cell = h("button", { type: "button", class: "slot", disabled: locked, "aria-pressed": String(grid[d][c]), "aria-label": `${en} ${String(c).padStart(2, "0")}:00`, title: `${en} ${String(c).padStart(2, "0")}:00`,
        onPointerdown(e) { e.preventDefault(); painting = !grid[d][c]; paint(d, c, painting); },
        onPointerenter(e) { if (painting !== null && e.buttons) paint(d, c, painting); },
        onKeydown(e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); paint(d, c, !grid[d][c]); onChange(grid); } } });
      cell.classList.toggle("on", grid[d][c]);
      cells[d].push(cell);
      root.append(cell);
    }
  });
  root.addEventListener("pointerup", finish);
  root.addEventListener("pointerleave", finish);
  return root;
}

// The four lists are raw internals. Wherever one is drawn as a setting, show it
// decoded and send the person to the screen that edits them together.
function columnView(entry, current, _commit, _locked, ctx) {
  const { h, icon, t } = ctx;
  const items = () => splitColumn(current());
  const modes = { "0": t("No rule", "冇規則"), "1": t("Blocked on a schedule", "按時間表封鎖"), "2": t("Always blocked", "全日封鎖") };
  const text = (item) => (entry.item === "mode" ? modes[item] ?? item : entry.item === "daytime" ? parseSlots(item).map((s) => describeSlot(s, DAYS.map((d) => t(...d)))).join("; ") || t("No blocked times", "冇封鎖時段") : item || "—");
  const list = h("ol", { class: "pp-column" });
  const draw = () => list.replaceChildren(...items().map((item) => h("li", {}, text(item))), ...(items().length ? [] : [h("li", { class: "muted" }, t("Empty", "空"))]));
  draw();
  return { el: h("div", { class: "pp-columnview" }, list, h("button", { class: "btn t sm", type: "button", onClick: () => ctx.navigate("parental-pro") }, icon("open_in_new", "sm"), t("Edit on the parental controls screen", "喺家長控制畫面編輯"))), sync: draw };
}

export default {
  id: "parental-pro",

  controls: { "column-list": columnView },

  screens: [
    {
      id: "parental-pro",
      group: { en: "Network", yue: "網絡" },
      icon: "family_restroom",
      label,
      async render(ctx) {
        const { h, icon, t, tt } = ctx;
        const page = ctx.page(label, lede);
        ctx.root.append(page);
        let data = await ctx.api.get("/api/domain/parental-pro");
        const byId = new Map(data.entries.map((e) => [e.id, e]));
        const canWrite = ctx.state.canWrite;
        const dayNames = DAYS.map((d) => t(...d));

        // The value of one list as the person currently sees it, pending edits included.
        const valueOf = (id) => (ctx.dock.has(id) ? ctx.dock.value(id) : byId.get(id).value);
        const idByKey = Object.fromEntries(Object.entries(COLUMN_KEYS).map(([name, key]) => [key, ENTRY_IDS[name]]));
        const devices = () => readDevices((key) => valueOf(idByKey[key]));
        const save = (next) => {
          const values = writeDevices(next);
          for (const [name, id] of Object.entries(ENTRY_IDS)) ctx.dock.setEntry(byId.get(id), values[COLUMN_KEYS[name]]);
          draw();
        };
        const nameOf = (d) => d.name || data.known.find((k) => k.mac === d.mac)?.name || d.mac;
        const update = (mac, change) => save(devices().map((d) => (d.mac === mac ? { ...d, ...change } : d)));

        const master = ctx.controls.groupCard({ en: "Parental controls", yue: "家長控制" }, data.stock);
        const deviceCards = h("div", { class: "pp-devices" });
        const addCard = h("div", {});
        const webHost = h("div", {});
        if (master) page.append(master);
        page.append(h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("devices", "sm"), " ", t("Devices with a rule", "有規則嘅裝置")), deviceCards, addCard));
        page.append(webHost);

        function deviceCard(d) {
          const { grid, exact } = slotsToGrid(d.slots);
          const modeButtons = [["0", t("No rule", "冇規則")], ["1", t("Block on a schedule", "按時間表封鎖")], ["2", t("Always blocked", "全日封鎖")]].map(([mode, text]) =>
            h("button", { type: "button", role: "radio", class: d.mode === mode ? "on" : "", "aria-checked": String(d.mode === mode), disabled: !canWrite, onClick() {
              if (mode === "0") return save(devices().filter((x) => x.mac !== d.mac));
              update(d.mac, { mode, slots: mode === "1" ? (d.slots.length ? d.slots : NIGHTLY) : [] });
            } }, text));
          const hours = blockedHours(grid);
          return h("div", { class: "pp-device" },
            h("div", { class: "row" }, icon(d.mode === "2" ? "block" : "schedule"), h("div", { class: "grow" }, h("div", { class: "t1" }, nameOf(d)), h("div", { class: "t2 mono" }, d.mac, d.ip ? ` · ${d.ip}` : "")),
              h("span", { class: `tag ${d.mode === "2" ? "bad" : "warn"}` }, d.mode === "2" ? t("Always blocked", "全日封鎖") : t(`${hours} h blocked a week`, `每星期封鎖 ${hours} 小時`))),
            h("div", { class: "seg", role: "radiogroup", "aria-label": `${t("Rule for", "規則：")} ${nameOf(d)}` }, modeButtons),
            d.mode === "1" ? h("div", { class: "pp-schedule" },
              h("div", { class: "muted" }, t("Filled hours are when the internet is blocked. Drag across the week, or press Space on an hour.", "著咗色嘅鐘數就係封鎖上網。喺星期表上拖動，或者喺某個鐘數撳 Space。")),
              gridEditor(ctx, grid, (next) => update(d.mac, { slots: gridToSlots(next) }), !canWrite, nameOf(d)),
              exact ? null : h("div", { class: "note warn" }, icon("info"), t("This device has a time window that does not start or end on the hour. Editing the grid rounds it to whole hours.", "呢部裝置有時段唔係整點開始或結束。編輯星期表會取整到整點。")),
              h("div", { class: "ctl" },
                h("button", { class: "btn t sm", type: "button", disabled: !canWrite, onClick: () => update(d.mac, { slots: NIGHTLY }) }, icon("bedtime", "sm"), t("Every night 22:00 to 07:00", "每晚 22:00 至 07:00")),
                h("button", { class: "btn t sm", type: "button", disabled: !canWrite, onClick: () => update(d.mac, { slots: [] }) }, icon("backspace", "sm"), t("Clear", "清除")))) : null);
        }

        function addForm() {
          const controlled = new Set(devices().map((d) => d.mac));
          const choices = data.known.filter((k) => !controlled.has(k.mac));
          const pick = h("select", { class: "field", "aria-label": t("Device to add", "要加入嘅裝置"), disabled: !canWrite }, h("option", { value: "" }, t("Pick a device…", "揀裝置…")), choices.map((k) => h("option", { value: k.mac }, `${k.name} · ${k.ip || k.mac}`)));
          const mac = h("input", { class: "field mac", maxlength: "17", placeholder: "AA:BB:CC:DD:EE:FF", autocomplete: "off", "aria-label": t("Or a MAC address", "或者輸入 MAC 地址"), disabled: !canWrite, onInput(e) {
            const hex = e.target.value.replace(/[^0-9a-fA-F]/g, "").toUpperCase().slice(0, 12);
            e.target.value = hex.match(/.{1,2}/g)?.join(":") ?? "";
          } });
          const note = h("div", { class: "rt-problem", role: "status" });
          const add = h("button", { class: "btn o sm", type: "button", disabled: !canWrite, onClick() {
            const chosen = (pick.value || mac.value).toUpperCase();
            if (!MAC.test(chosen)) { note.textContent = t("Pick a device or enter a MAC address such as AA:BB:CC:DD:EE:FF.", "請揀裝置，或者輸入 MAC 地址，例如 AA:BB:CC:DD:EE:FF。"); return; }
            if (controlled.has(chosen)) { note.textContent = t("That device already has a rule.", "呢部裝置已經有規則。"); return; }
            if (devices().length >= data.limit) { note.textContent = t(`At most ${data.limit} devices.`, `最多 ${data.limit} 部裝置。`); return; }
            const known = data.known.find((k) => k.mac === chosen);
            save([...devices(), { mac: chosen, mode: "1", name: known?.name?.slice(0, 32) ?? "", slots: NIGHTLY }]);
          } }, icon("add", "sm"), t("Add a rule", "加入規則"));
          return h("div", { class: "pp-add" }, h("div", { class: "k" }, t("Add a device", "加入裝置")), h("div", { class: "ctl" }, pick, mac, add), note);
        }

        function draw() {
          const list = devices();
          deviceCards.replaceChildren(...list.map(deviceCard), ...(list.length ? [] : [h("div", { class: "muted" }, t("No device has a rule yet.", "未有裝置有規則。"))]));
          addCard.replaceChildren(addForm());
        }
        draw();

        // Web and apps filters: shown always, disabled with the reason on models without the engine.
        const webEntries = data.entries.filter((e) => e.group === "web");
        const web = ctx.controls.groupCard(webEntries[0].groupLabel, webEntries);
        if (!data.webSupported) webHost.append(h("div", { class: "note warn" }, icon("lock"), tt(data.webReason)));
        webHost.append(web);
        const notes = data.entries.filter((e) => e.meta?.note);
        if (notes.length) webHost.append(h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("construction", "sm"), " ", t("In progress", "進行中")), notes.map((e) => h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t1" }, tt(e.label)), h("div", { class: "t2" }, tt(e.meta.note))))))
        );
        const off = ctx.bus.on("changed", async () => { data = await ctx.api.get("/api/domain/parental-pro"); byId.clear(); data.entries.forEach((e) => byId.set(e.id, e)); draw(); });
        return off;
      },
    },
  ],

  commands: [
    { id: "parental-pro.open", icon: "family_restroom", label: { en: "Open parental controls", yue: "開啟家長控制" }, keywords: "parental children block schedule bedtime device internet", run: (ctx) => ctx.navigate("parental-pro") },
  ],
};
