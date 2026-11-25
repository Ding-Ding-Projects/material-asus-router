// Schedule painter: paint a week of hours for a device's internet block or for
// when a Wi-Fi band is on. Drag across the grid with a mouse, pen or finger; with
// the keyboard use the arrow keys and Space (hold Shift to keep painting while
// moving). Edits wait in the pending-changes dock, so they are previewed and
// undoable like every other change.
import {
  COLUMN_KEYS, DAYS, ENTRY_IDS, MAX_WIFI_SLOTS, PRESETS, cloneGrid, countOn, gridToSchedule, gridToSlots, moveFocus, paint, readDevices, scheduleToGrid, slotsToGrid, toggleDay, toggleHour, writeDevices,
} from "./model.js";

const label = { en: "Schedule painter", yue: "時間表畫板" };
const lede = { en: "Paint the hours you want. Drag across the grid, or use the arrow keys and Space.", yue: "畫出你想要嘅時段。喺格仔上面拖過去，或者用方向鍵同空白鍵。" };
const REFRESH_MS = 12000;

// The painted grid, with pointer painting and a keyboard route. `change(grid)` is called once per gesture.
function paintGrid(ctx, { grid, locked, dim, change, name }) {
  const { h, t } = ctx;
  let current = cloneGrid(grid);
  let brush = true;
  let painting = false;
  let focus = [0, 0];
  const cells = [];
  const root = h("div", { class: `sp-grid${dim ? " dim" : ""}`, role: "grid", "aria-label": name, "aria-readonly": String(locked) });
  const sync = () => cells.forEach((row, d) => row.forEach((cell, hr) => {
    cell.classList.toggle("on", current[d][hr]);
    cell.setAttribute("aria-pressed", String(current[d][hr]));
    cell.setAttribute("aria-label", `${t(...DAYS[d])} ${String(hr).padStart(2, "0")}:00 ${current[d][hr] ? t("on", "已畫") : t("off", "未畫")}`);
    cell.tabIndex = d === focus[0] && hr === focus[1] ? 0 : -1;
  }));
  const apply = (cellsList, on) => {
    current = paint(current, cellsList, on);
    sync();
  };
  const commit = () => change(cloneGrid(current));

  root.append(h("span", { class: "sp-corner" }));
  for (let hr = 0; hr < 24; hr += 1)
    root.append(h("button", { type: "button", class: "sp-hour", disabled: locked, tabindex: "-1", "aria-label": `${t("Toggle", "切換")} ${String(hr).padStart(2, "0")}:00`, onClick() { current = toggleHour(current, hr); sync(); commit(); } }, hr % 3 === 0 ? String(hr).padStart(2, "0") : ""));
  DAYS.forEach((day, d) => {
    cells[d] = [];
    root.append(h("button", { type: "button", class: "sp-day", disabled: locked, tabindex: "-1", "aria-label": `${t("Toggle every", "切換整個")} ${t(...day)}`, onClick() { current = toggleDay(current, d); sync(); commit(); } }, t(...day)));
    for (let hr = 0; hr < 24; hr += 1) {
      const cell = h("button", { type: "button", class: "sp-cell", "data-d": String(d), "data-h": String(hr), disabled: locked,
        onPointerdown(e) {
          if (locked || e.button > 0) return;
          e.preventDefault();
          brush = !current[d][hr];
          painting = true;
          focus = [d, hr];
          apply([[d, hr]], brush);
          root.setPointerCapture?.(e.pointerId);
        },
        onKeydown(e) {
          if (locked) return;
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            brush = !current[d][hr];
            apply([[d, hr]], brush);
            commit();
          } else if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            focus = moveFocus([d, hr], e.key);
            if (e.shiftKey) apply([focus], brush);
            sync();
            cells[focus[0]][focus[1]].focus();
            if (e.shiftKey) commit();
          }
        } }, "");
      cells[d].push(cell);
      root.append(cell);
    }
  });
  root.addEventListener("pointermove", (e) => {
    if (!painting) return;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".sp-cell");
    if (cell && root.contains(cell)) apply([[Number(cell.dataset.d), Number(cell.dataset.h)]], brush);
  });
  const end = () => {
    if (!painting) return;
    painting = false;
    commit();
  };
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", end);
  sync();
  return { el: root, set(next) { current = cloneGrid(next); sync(); } };
}

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const canWrite = ctx.state.canWrite;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  let parental = await api.get("/api/domain/parental-pro");
  let tab = "parental";
  let band = null;
  let selected = null;
  const body = h("div", { class: "sp-body" });
  const tabs = h("div", { class: "seg", role: "radiogroup", "aria-label": t("What to schedule", "要排程嘅嘢") });
  const entryOf = (id) => ctx.state.catalog.entries.find((e) => e.id === id);
  const valueOf = (entry) => (ctx.dock.has(entry.id) ? ctx.dock.value(entry.id) : entry.value);
  const guard = () => (canWrite ? true : (ctx.toast(t("Your role can only look.", "你嘅角色只可以睇。"), "warn"), false));

  // ---- time limits for devices ----
  const pEntries = () => Object.fromEntries(Object.entries(ENTRY_IDS).map(([name, id]) => [name, parental.entries.find((e) => e.id === id)]));
  const devices = () => {
    const e = pEntries();
    const byKey = { [COLUMN_KEYS.mac]: e.mac, [COLUMN_KEYS.mode]: e.mode, [COLUMN_KEYS.name]: e.name, [COLUMN_KEYS.daytime]: e.daytime };
    return readDevices((key) => (byKey[key] ? valueOf(byKey[key]) : ""));
  };
  const saveDevices = (next) => {
    if (!guard()) return;
    const values = writeDevices(next);
    const e = pEntries();
    for (const [name, key] of Object.entries(COLUMN_KEYS)) ctx.dock.setEntry(e[name], values[key]);
    drawBody();
  };
  const nameOf = (d) => d.name || parental.known.find((k) => k.mac === d.mac)?.name || d.mac;

  function parentalView() {
    const list = devices();
    const device = list.find((d) => d.mac === selected) ?? list[0];
    selected = device?.mac ?? null;
    const free = parental.known.filter((k) => !list.some((d) => d.mac === k.mac));
    const picker = h("select", { class: "field", "aria-label": t("Add a device", "加入裝置"), disabled: !canWrite || !free.length }, h("option", { value: "" }, free.length ? t("Add a device…", "加入裝置…") : t("Every known device has a rule", "所有已知裝置都有規則")), free.map((k) => h("option", { value: k.mac }, `${k.name} · ${k.ip || k.mac}`)));
    picker.addEventListener("change", () => {
      const k = parental.known.find((x) => x.mac === picker.value);
      if (!k || list.length >= parental.limit) return;
      selected = k.mac;
      saveDevices([...list, { mac: k.mac, mode: "1", name: k.name.slice(0, 32), slots: gridToSlots(PRESETS.nights.build()) }]);
    });
    const side = h("div", { class: "sp-side" },
      h("div", { class: "sp-devices", role: "listbox", "aria-label": t("Devices with a rule", "有規則嘅裝置") }, list.length
        ? list.map((d) => h("button", { type: "button", role: "option", "aria-selected": String(d.mac === selected), class: `sp-device${d.mac === selected ? " on" : ""}`, onClick() { selected = d.mac; drawBody(); } }, icon(d.mode === "2" ? "block" : "schedule", "sm"), h("span", {}, nameOf(d))))
        : h("div", { class: "muted" }, t("No device has a rule yet.", "未有裝置有規則。"))),
      picker);
    if (!device) return h("div", { class: "sp-split" }, side, h("div", { class: "empty" }, icon("family_restroom", "lg"), t("Add a device to paint its blocked hours.", "加入一部裝置就可以畫佢嘅封鎖時段。")));
    const { grid, exact } = slotsToGrid(device.slots);
    const update = (change) => saveDevices(list.map((d) => (d.mac === device.mac ? { ...d, ...change } : d)));
    const modes = [["0", t("No rule", "冇規則")], ["1", t("Block on a schedule", "按時間表封鎖")], ["2", t("Always blocked", "全日封鎖")]];
    const canvas = device.mode === "1"
      ? paintGrid(ctx, { grid, locked: !canWrite, name: `${nameOf(device)}: ${t("blocked hours", "封鎖時段")}`, change: (g) => (countOn(g) === 0 ? update({ mode: "0", slots: [] }) : update({ slots: gridToSlots(g) })) })
      : null;
    return h("div", { class: "sp-split" }, side, h("div", { class: "sp-main" },
      h("h2", { class: "h2" }, nameOf(device)),
      h("div", { class: "seg", role: "radiogroup", "aria-label": t("Rule", "規則") }, modes.map(([mode, text]) => h("button", { type: "button", role: "radio", "aria-checked": String(device.mode === mode), class: device.mode === mode ? "on" : "", disabled: !canWrite, onClick() {
        if (mode === "0") return saveDevices(list.filter((d) => d.mac !== device.mac));
        update({ mode, slots: mode === "1" ? (device.slots.length ? device.slots : gridToSlots(PRESETS.nights.build())) : [] });
      } }, text))),
      device.mode === "1"
        ? [presets(canvas, (g) => update(countOn(g) === 0 ? { mode: "0", slots: [] } : { slots: gridToSlots(g) })), canvas.el,
          h("div", { class: "t2" }, t(`${countOn(grid)} of 168 hours blocked each week.`, `每星期 ${countOn(grid)} / 168 個鐘封鎖。`)),
          exact ? null : h("div", { class: "note warn" }, icon("info"), t("This device has a time window that does not start or end on the hour. Painting rounds it to whole hours.", "呢部裝置有時段唔係整點開始或結束。畫完會取整到整點。"))]
        : h("div", { class: "note" }, icon(device.mode === "2" ? "block" : "check_circle"), device.mode === "2" ? t("Blocked all the time. Pick Block on a schedule to paint hours instead.", "全日封鎖。揀「按時間表封鎖」就可以畫時段。") : t("No rule for this device.", "呢部裝置冇規則。"))));
  }

  // ---- when a Wi-Fi band is on ----
  const bands = () => ctx.state.catalog.entries.filter((e) => /^wifi-pro\.wl\d+\.sched$/.test(e.id)).map((e) => ({ sched: e, on: entryOf(e.id.replace(/\.sched$/, ".sched-on")), name: e.groupLabel }));

  function wifiView() {
    const list = bands();
    if (!list.length) return h("div", { class: "empty" }, icon("wifi_off", "lg"), t("This router reports no Wi-Fi schedule settings.", "呢部路由器冇 Wi-Fi 時間表設定。"));
    const chosen = list.find((b) => b.sched.id === band) ?? list[0];
    band = chosen.sched.id;
    const enabled = chosen.on ? valueOf(chosen.on) === chosen.on.values.on : false;
    const { grid, exact } = scheduleToGrid(valueOf(chosen.sched));
    const stage = (g) => {
      if (!guard()) return;
      const text = gridToSchedule(g);
      if (!text) return ctx.toast(t("Paint at least one hour, or turn the schedule off.", "請最少畫一個鐘，或者關閉時間表。"), "warn"), drawBody();
      if (text.split(",").length > MAX_WIFI_SLOTS) return ctx.toast(t(`That needs more than ${MAX_WIFI_SLOTS} time slots. Paint fewer different patterns.`, `需要超過 ${MAX_WIFI_SLOTS} 個時段。請減少唔同嘅圖案。`), "warn"), drawBody();
      ctx.dock.setEntry(chosen.sched, text);
      drawBody();
    };
    const canvas = paintGrid(ctx, { grid, locked: !canWrite || chosen.sched.disabled, dim: !enabled, name: `${tt(chosen.name)}: ${t("hours the radio is on", "電台開住嘅時段")}`, change: stage });
    return h("div", { class: "sp-main" },
      list.length > 1 ? h("div", { class: "seg", role: "radiogroup", "aria-label": t("Wi-Fi band", "Wi-Fi 頻段") }, list.map((b) => h("button", { type: "button", role: "radio", "aria-checked": String(b.sched.id === band), class: b.sched.id === band ? "on" : "", onClick() { band = b.sched.id; drawBody(); } }, tt(b.name).split(":")[0]))) : null,
      chosen.on ? h("button", { type: "button", class: `chip${enabled ? " on" : ""}`, role: "switch", "aria-checked": String(enabled), disabled: !canWrite || Boolean(chosen.on.disabled), onClick() { ctx.dock.setEntry(chosen.on, enabled ? chosen.on.values.off : chosen.on.values.on); drawBody(); } }, icon(enabled ? "toggle_on" : "toggle_off", "sm"), enabled ? t("Schedule on: the radio follows the painted hours", "時間表開：電台跟住畫咗嘅時段") : t("Schedule off: the radio stays on all day", "時間表關：電台成日開住")) : null,
      presets(canvas, stage), canvas.el,
      h("div", { class: "t2" }, t(`The radio is on for ${countOn(grid)} of 168 hours each week.`, `電台每星期開 ${countOn(grid)} / 168 個鐘。`)),
      exact ? null : h("div", { class: "note warn" }, icon("info"), t("This schedule has times that are not on the hour. Painting rounds them to whole hours.", "呢個時間表有唔係整點嘅時間。畫完會取整到整點。")),
      chosen.sched.meta?.note ? h("div", { class: "note" }, icon("construction"), h("div", {}, h("b", {}, t("In progress: ", "進行中：")), tt(chosen.sched.meta.note))) : null);
  }

  function presets(canvas, apply) {
    return h("div", { class: "chips", role: "group", "aria-label": t("Starting points", "起點") }, Object.entries(PRESETS).map(([id, p]) => h("button", { type: "button", class: "chip", disabled: !canWrite, onClick() { const g = p.build(); canvas.set(g); apply(g); } }, tt(p.label))));
  }

  function drawTabs() {
    ctx.clear(tabs).append(...[["parental", "Time limits for devices", "裝置時間限制"], ["wifi", "When Wi-Fi is on", "Wi-Fi 開啟時段"]].map(([id, en, yue]) => h("button", { type: "button", role: "radio", "aria-checked": String(tab === id), class: tab === id ? "on" : "", onClick() { tab = id; drawTabs(); drawBody(); } }, t(en, yue))));
  }
  function drawBody() {
    ctx.clear(body).append(tab === "parental" ? parentalView() : wifiView());
  }
  page.append(h("section", { class: "card rise" }, tabs, body));
  drawTabs();
  drawBody();

  const refresh = async () => {
    if (ctx.dock.count() > 0 || document.hidden) return;
    try {
      parental = await api.get("/api/domain/parental-pro");
      drawBody();
    } catch {
      /* The next refresh tries again. */
    }
  };
  const timer = setInterval(refresh, REFRESH_MS);
  const off = ctx.bus.on("dock", () => ctx.dock.count() === 0 && refresh());
  return () => (clearInterval(timer), off());
}

export default {
  id: "schedule-paint",
  screens: [{ id: "schedule-paint", group: { en: "Network", yue: "網絡" }, icon: "event_available", label, render: screen }],
  commands: [{ id: "schedule-paint.open", icon: "event_available", label: { en: "Open the schedule painter", yue: "開啟時間表畫板" }, keywords: "schedule paint parental bedtime wifi hours time limit 時間表 家長 睡覺", run: (ctx) => ctx.navigate("schedule-paint") }],
};
