// Wake-on-LAN screen: wake a device now, schedule weekly wakes on a grid, and
// see what was sent. The app sends the wake at the start of each painted
// block while it is running.
import { CELLS, DAYS, PRESETS, describe, emptyGrid, gridToSpec, slotCount, specToGrid } from "./grid.js";

const label = { en: "Wake-on-LAN", yue: "網絡喚醒" };
const DAY_NAMES = [["Sun", "日"], ["Mon", "一"], ["Tue", "二"], ["Wed", "三"], ["Thu", "四"], ["Fri", "五"], ["Sat", "六"]];
const MAC = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;
const hh = (cell) => `${String(Math.floor(cell / 2)).padStart(2, "0")}:${cell % 2 ? "30" : "00"}`;

// The week grid: click or drag to paint, arrow keys and Space for the keyboard.
export function weekGrid(ctx, grid, onChange, disabled) {
  const { h, t } = ctx;
  const buttons = [];
  let painting = null; // true: adding, false: removing
  const root = h("div", { class: "wg", role: "group", "aria-label": t("Weekly wake times", "每週喚醒時間") });
  const set = (d, c, on) => {
    grid[d][c] = on;
    buttons[d][c].setAttribute("aria-pressed", String(on));
    buttons[d][c].classList.toggle("on", on);
  };
  const head = h("div", { class: "wg-row wg-head" }, h("span", { class: "wg-day" }), ...Array.from({ length: CELLS }, (_, c) => h("span", { class: "wg-hour" }, c % 4 === 0 ? String(c / 2) : "")));
  root.append(head);
  for (let d = 0; d < DAYS; d += 1) {
    buttons[d] = [];
    const row = h("div", { class: "wg-row" }, h("span", { class: "wg-day" }, t(DAY_NAMES[d][0], DAY_NAMES[d][1])));
    for (let c = 0; c < CELLS; c += 1) {
      const cell = h("button", { type: "button", class: `wg-cell ${grid[d][c] ? "on" : ""}`, "aria-pressed": String(grid[d][c]), "aria-label": `${t(DAY_NAMES[d][0], DAY_NAMES[d][1])} ${hh(c)}`, disabled,
        onPointerdown: (e) => { e.preventDefault(); painting = !grid[d][c]; set(d, c, painting); onChange(); },
        onPointerenter: (e) => { if (painting !== null && e.buttons) { set(d, c, painting); onChange(); } },
        onKeydown: (e) => {
          const move = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key];
          if (move) { e.preventDefault(); buttons[Math.min(DAYS - 1, Math.max(0, d + move[0]))][Math.min(CELLS - 1, Math.max(0, c + move[1]))].focus(); }
          else if (e.key === " " || e.key === "Enter") { e.preventDefault(); set(d, c, !grid[d][c]); onChange(); }
        } });
      buttons[d].push(cell);
      row.append(cell);
    }
    root.append(row);
  }
  const stop = () => { painting = null; };
  root.addEventListener("pointerup", stop);
  root.addEventListener("pointerleave", stop);
  return { el: h("div", { class: "wg-scroll" }, root), refresh() { grid.forEach((day, d) => day.forEach((on, c) => set(d, c, on))); } };
}

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const page = ctx.page(label, { en: "Wake a sleeping device now, or on a weekly schedule. The app sends the wake while it is running.", yue: "即刻喚醒沉睡嘅裝置，或者按每週時間表喚醒。程式運行期間先會發出喚醒。" });
  ctx.root.append(page);
  let data = null;
  let tab = "now";
  const body = h("div", {});
  const tabs = h("div", { class: "seg", role: "tablist", "aria-label": t("Wake-on-LAN sections", "網絡喚醒分頁") });
  const settings = await api.get("/api/domain/wol-schedules");

  async function load() {
    data = await api.get("/api/x/wol-schedules/status");
    draw();
  }

  async function wake(mac, name) {
    try {
      const out = await api.post("/api/actions/wol-schedules.wake", { mac, name });
      ctx.toast(out.ok ? t(`Wake signal sent to ${name || mac}.`, `已向 ${name || mac} 發出喚醒訊號。`) : t(`The router could not send it: ${out.detail}`, `路由器發送唔到：${out.detail}`), out.ok ? "good" : "bad");
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
    await load();
  }

  function editor(existing) {
    const grid = specToGrid(existing?.spec ?? PRESETS[0].spec);
    const state = { mac: existing?.mac ?? data.devices[0]?.mac ?? "", name: existing?.name ?? data.devices[0]?.name ?? "", enabled: existing?.enabled ?? true };
    return ctx.openDialog((close, render) => {
      const summary = h("div", { class: "muted", "aria-live": "polite" });
      const warning = h("div", { class: "note warn", role: "status" });
      const save = h("button", { class: "btn f", onClick: async () => {
        try {
          const payload = { mac: state.mac, name: state.name, spec: gridToSpec(grid), enabled: state.enabled };
          if (existing) await api.put(`/api/x/wol-schedules/schedules/${existing.id}`, payload);
          else await api.post("/api/x/wol-schedules/schedules", payload);
          close(true);
          await load();
        } catch (error) {
          ctx.toast(error.message, "bad");
        }
      } }, icon("check", "sm"), t("Save", "儲存"));
      // Recomputed after every edit, so Save is only available when the schedule is valid.
      const refresh = () => {
        const spec = gridToSpec(grid);
        const problem = !MAC.test(state.mac) ? t("Pick a device or type its MAC address.", "請揀裝置或者輸入 MAC 地址。") : !spec ? t("Paint at least one block of time.", "請至少畫一段時間。") : slotCount(spec) > 28 ? t("That is too many separate blocks. Paint fewer.", "分開嘅時段太多，請畫少啲。") : "";
        summary.textContent = spec ? t(`Wakes at the start of each block: ${describe(spec, t)}`, `喺每個時段開始時喚醒：${describe(spec, t)}`) : t("Nothing painted yet.", "未畫任何時段。");
        warning.hidden = !problem;
        warning.textContent = problem;
        save.disabled = Boolean(problem);
      };
      const picker = h("select", { class: "field", "aria-label": t("Device", "裝置"), onChange: (e) => { state.mac = e.target.value; const d = data.devices.find((x) => x.mac === e.target.value); if (d) state.name = d.name; refresh(); } },
        data.devices.map((d) => h("option", { value: d.mac, selected: d.mac === state.mac }, `${d.name} (${d.mac})`)), !data.devices.some((d) => d.mac === state.mac) ? h("option", { value: state.mac, selected: true }, state.mac || t("Choose…", "揀…")) : null);
      const manual = h("input", { class: "field", placeholder: t("Or type a MAC address, AA:BB:CC:DD:EE:FF", "或者輸入 MAC 地址，AA:BB:CC:DD:EE:FF"), "aria-label": t("Or type a MAC address", "或者輸入 MAC 地址"), onInput: (e) => { state.mac = e.target.value.trim().toUpperCase(); refresh(); } });
      const wg = weekGrid(ctx, grid, refresh, false);
      refresh();
      return [
        h("h2", { class: "h2" }, existing ? t("Edit schedule", "編輯排程") : t("New schedule", "新增排程")),
        picker, manual,
        h("div", { class: "chips" }, ...PRESETS.map((p) => h("button", { class: "chip", onClick: () => { const g = specToGrid(p.spec); g.forEach((day, d) => day.forEach((on, c) => (grid[d][c] = on))); wg.refresh(); refresh(); } }, tt(p.label))),
          h("button", { class: "chip", onClick: () => { grid.forEach((day) => day.fill(false)); wg.refresh(); refresh(); } }, t("Clear", "清除"))),
        wg.el, summary, warning,
        h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), save),
      ];
    }, { label: t("Schedule", "排程") });
  }

  const when = (iso) => (iso ? new Date(iso).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "—");

  function drawNow() {
    const manual = h("input", { class: "field", placeholder: "AA:BB:CC:DD:EE:FF", "aria-label": t("MAC address", "MAC 地址") });
    return [
      h("div", { class: "tbl" }, h("table", {}, h("thead", {}, h("tr", {}, [t("Device", "裝置"), t("Address", "地址"), "MAC", ""].map((x) => h("th", {}, x)))),
        h("tbody", {}, data.devices.map((d) => h("tr", {}, h("td", {}, d.name), h("td", { class: "mono" }, d.ip || "—"), h("td", { class: "mono" }, d.mac), h("td", {}, h("button", { class: "btn t sm", disabled: !ctx.state.canWrite, "aria-label": `${t("Wake", "喚醒")} ${d.name}`, onClick: () => wake(d.mac, d.name) }, icon("power_settings_new", "sm"), t("Wake", "喚醒")))))))),
      h("div", { class: "chips" }, manual, h("button", { class: "btn f", disabled: !ctx.state.canWrite, onClick: () => { if (!MAC.test(manual.value)) return void ctx.toast(t("Enter a MAC address such as AA:BB:CC:DD:EE:FF.", "請輸入 MAC 地址，例如 AA:BB:CC:DD:EE:FF。"), "warn"); wake(manual.value.toUpperCase(), ""); } }, icon("power_settings_new", "sm"), t("Wake this address", "喚醒呢個地址"))),
      h("div", { class: "muted" }, t(`Sent on ${data.settings.iface}, ${data.settings.repeat} time(s) each. Change this in the settings below.`, `喺 ${data.settings.iface} 發送，每次 ${data.settings.repeat} 個。可以喺下面嘅設定更改。`)),
    ];
  }

  function drawSchedules() {
    return [
      h("div", { class: "chips" }, h("button", { class: "btn f", disabled: !ctx.state.canWrite, onClick: () => editor(null) }, icon("add", "sm"), t("New schedule", "新增排程"))),
      data.schedules.length ? data.schedules.map((s) => h("div", { class: "row" },
        h("div", { class: "grow" }, h("div", { class: "t1" }, s.name || s.mac), h("div", { class: "t2" }, describe(s.spec, t)), h("div", { class: "t2" }, s.enabled ? `${t("Next wake", "下次喚醒")}: ${when(s.next)}${s.lastRun ? ` · ${t("Last", "上次")}: ${when(s.lastRun)}` : ""}` : t("Paused", "已暫停"))),
        h("button", { class: "sw", role: "switch", "aria-checked": String(s.enabled), "aria-label": `${t("Enabled", "啟用")}: ${s.name || s.mac}`, disabled: !ctx.state.canWrite, onClick: async () => { await api.put(`/api/x/wol-schedules/schedules/${s.id}`, { enabled: !s.enabled }); await load(); } }, h("i")),
        h("button", { class: "btn t icon", disabled: !ctx.state.canWrite, title: t("Edit", "編輯"), "aria-label": `${t("Edit", "編輯")} ${s.name || s.mac}`, onClick: () => editor(s) }, icon("edit", "sm")),
        h("button", { class: "btn o icon", disabled: !ctx.state.canWrite, title: t("Delete", "刪除"), "aria-label": `${t("Delete", "刪除")} ${s.name || s.mac}`, onClick: async () => { if (await ctx.confirmDialog({ title: t("Delete this schedule?", "刪除呢個排程？"), body: t("The device will no longer be woken at these times.", "裝置唔會再喺呢啲時間被喚醒。"), confirm: t("Delete", "刪除"), danger: true })) { await api.del(`/api/x/wol-schedules/schedules/${s.id}`); await load(); } } }, icon("delete", "sm"))))
        : h("div", { class: "empty" }, icon("event", "lg"), t("No schedules yet.", "未有排程。")),
    ];
  }

  function drawLog() {
    return data.log.length ? data.log.slice(0, 40).map((e) => h("div", { class: "row" }, h("span", { class: `tag ${e.ok ? "good" : "bad"}` }, e.ok ? t("Sent", "已發送") : t("Failed", "失敗")),
      h("div", { class: "grow" }, h("div", { class: "t1" }, e.name || e.mac), h("div", { class: "t2" }, `${new Date(e.at).toLocaleString()} · ${e.source === "schedule" ? t("by schedule", "排程") : t("by hand", "手動")} · ${e.iface}${e.detail ? ` · ${e.detail}` : ""}`))))
      : [h("div", { class: "empty" }, icon("history", "lg"), t("Nothing sent yet.", "未發送過。"))];
  }

  function draw() {
    ctx.clear(tabs).append(...[["now", t("Wake now", "即刻喚醒")], ["schedules", t("Schedules", "排程")], ["log", t("History", "記錄")]].map(([id, text]) => h("button", { role: "tab", "aria-selected": String(tab === id), class: tab === id ? "on" : "", onClick: () => { tab = id; draw(); } }, text)));
    const sc = data.scheduler;
    ctx.clear(body).append(
      h("div", { class: "muted", role: "status" }, sc.running ? t(`Scheduler is running. App time is ${sc.now} (UTC${sc.timezoneOffsetMinutes >= 0 ? "+" : ""}${sc.timezoneOffsetMinutes / 60}). Wakes are sent only while this app is running.`, `排程器運行中。程式時間 ${sc.now}（UTC${sc.timezoneOffsetMinutes >= 0 ? "+" : ""}${sc.timezoneOffsetMinutes / 60}）。只有程式運行期間先會發出喚醒。`) : t("The scheduler has not started.", "排程器未啟動。")),
      data.settings.scheduled ? null : h("div", { class: "note warn" }, icon("pause_circle"), h("div", {}, t("Scheduled wakes are turned off in the settings below. Schedules are kept but nothing is sent.", "下面嘅設定已關閉排程喚醒。排程會保留，但唔會發送。"))),
      sc.lastError ? h("div", { class: "note warn" }, icon("wifi_off"), h("div", {}, sc.lastError)) : null,
      ...(tab === "now" ? drawNow() : tab === "schedules" ? drawSchedules() : drawLog()));
  }

  page.append(h("section", { class: "card rise" }, tabs, body), ...ctx.controls.appGroupCards("wol-schedules", settings.entries, () => load()));
  await load();
}

// Always on: the schedule timer lives in the app (server), and it starts the first time anyone asks.
// Asking once after sign-in, and now and then, makes it run again after the app restarts.
const overlay = {
  id: "wol-scheduler",
  mount(ctx) {
    const ask = () => ctx.api.get("/api/x/wol-schedules/status").catch(() => {});
    ask();
    const timer = setInterval(ask, 10 * 60 * 1000);
    return () => clearInterval(timer);
  },
};

export default {
  id: "wol-schedules",
  overlays: [overlay],
  screens: [{ id: "wol-schedules", group: { en: "Network", yue: "網絡" }, icon: "power_settings_new", label, render: screen }],
  settings: [{ id: "wol-schedules", icon: "power_settings_new", label, async render(ctx) { const data = await ctx.api.get("/api/domain/wol-schedules"); return ctx.controls.appGroupCards("wol-schedules", data.entries); } }],
  commands: [{ id: "wol-schedules.open", icon: "power_settings_new", label: { en: "Wake a device or edit wake schedules", yue: "喚醒裝置或者編輯喚醒排程" }, keywords: "wake on lan wol schedule power on magic packet 喚醒 排程 開機", run: (ctx) => ctx.navigate("wol-schedules") }],
};
