// Rich controls wherever a value is shown. Setting rows, the command palette,
// the context menu and the top-bar search results all show the real control
// (a switch, a segmented choice, a slider) instead of a printout of the value,
// and each of them writes the same pending change as the Settings row, so a
// control and the place it came from can never disagree.
//
// This feature adds the top-bar search results (a live switch beside each
// switch setting) and a windowed list helper for long lists. The inventory
// below is the hand-written list of surfaces and which are still plain
// readouts, each with its reason.
const NAV = (globalThis.marNav ??= {});

export const SURFACES = [
  { id: "settings-rows", surface: "Setting rows", rich: true, how: "the control for the entry's type" },
  { id: "palette", surface: "Command palette results", rich: true, how: "the selected setting shows its real row" },
  { id: "context-menu", surface: "Context menu on a setting", rich: true, how: "a live switch, choice or slider that operates the row's own control" },
  { id: "top-search", surface: "Top bar search results", rich: true, how: "a live switch beside each switch setting" },
  { id: "all-settings", surface: "All settings screen", rich: true, how: "the same rows as every other screen" },
  { id: "device-table", surface: "Devices table", rich: false, reason: "The device table belongs to the Devices screen, which another part of the app owns. Its block and rename actions are buttons, but its values are readouts. Not changed here." },
  { id: "logs", surface: "Logs", rich: false, reason: "A log line is a record of what happened, not a value anyone can set, so a readout is correct." },
  { id: "history", surface: "Change history", rich: false, reason: "Past values are a record. Undo is already a button on each row." },
];

// Windowed rendering for long lists: only the rows in view exist in the page.
// virtualList(container, items, { rowHeight, render }) -> { update, destroy }.
export function virtualList(container, items, { rowHeight = 48, overscan = 6, render }) {
  const spacer = document.createElement("div");
  const view = document.createElement("div");
  container.replaceChildren(spacer, view);
  spacer.style.setProperty("height", `${items.length * rowHeight}px`);
  spacer.style.setProperty("position", "relative");
  const draw = () => {
    const top = container.scrollTop;
    const from = Math.max(0, Math.floor(top / rowHeight) - overscan);
    const to = Math.min(items.length, Math.ceil((top + container.clientHeight) / rowHeight) + overscan);
    view.replaceChildren(...items.slice(from, to).map((item, i) => { const el = render(item, from + i); el.style.setProperty("position", "absolute"); el.style.setProperty("top", `${(from + i) * rowHeight}px`); el.style.setProperty("left", "0"); el.style.setProperty("right", "0"); el.style.setProperty("height", `${rowHeight}px`); return el; }));
    spacer.replaceChildren(view);
  };
  container.addEventListener("scroll", draw);
  draw();
  return { update: draw, destroy: () => container.removeEventListener("scroll", draw) };
}
NAV.virtualList = virtualList;

function mini(ctx, entry) {
  const { h, tt } = ctx;
  const on = () => (ctx.dock.has(entry.id) ? ctx.dock.value(entry.id) : entry.value) === entry.values.on;
  const el = h("span", { class: "sw rc-mini", role: "switch", tabindex: "0", "aria-checked": String(on()), "aria-label": tt(entry.label), "aria-disabled": String(!ctx.state.canWrite) });
  el.append(h("i"));
  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!ctx.state.canWrite) return;
    ctx.dock.setEntry(entry, on() ? entry.values.off : entry.values.on);
    el.setAttribute("aria-checked", String(on()));
  };
  el.addEventListener("click", toggle);
  el.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") toggle(e); });
  const off = ctx.bus.on("dock", () => { if (el.isConnected) el.setAttribute("aria-checked", String(on())); });
  return { el, off };
}

function enhanceResults(ctx, box) {
  const entries = ctx.state.catalog?.entries ?? [];
  for (const btn of box.querySelectorAll("button[role=option]")) {
    if (btn.dataset.rcDone) continue;
    btn.dataset.rcDone = "1";
    const span = btn.querySelector("span:not(.ms)");
    const label = span?.firstChild?.textContent?.trim();
    const group = span?.querySelector(".t2")?.textContent ?? "";
    const entry = entries.find((e) => e.control === "switch" && ctx.tt(e.label) === label && (!e.groupLabel || group.includes(ctx.tt(e.groupLabel))));
    if (entry) btn.append(mini(ctx, entry).el);
  }
}

const HOST = /^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
export const hostnameOk = (value, optional) => (value === "" ? Boolean(optional) : HOST.test(value));

// The host name control: a text box that says right away whether the name is
// valid, shows an example, and clears in one tap. It records the same pending
// change as every other control.
function hostnameControl(entry, current, commit, locked, ctx) {
  const { h, icon, t, tt } = ctx;
  const note = h("div", { class: "t2", role: "status" });
  const input = h("input", { class: "field", type: "text", inputmode: "url", autocomplete: "off", spellcheck: "false", maxlength: "253", value: current(), placeholder: "pool.example.test", "aria-label": tt(entry.label), disabled: locked });
  const clear = h("button", { type: "button", class: "btn t icon", "aria-label": t("Clear", "清除"), disabled: locked || !entry.optional, onClick: () => { input.value = ""; input.dispatchEvent(new Event("input")); input.focus(); } }, icon("backspace", "sm"));
  const draw = () => {
    const v = input.value.trim();
    const ok = hostnameOk(v, entry.optional);
    input.setAttribute("aria-invalid", String(!ok));
    note.className = `t2${ok ? "" : " err"}`;
    note.textContent = ok ? (v === "" ? t("Empty: not used.", "空：唔使用。") : t("A valid host name.", "有效嘅主機名稱。")) : t("Use letters, digits and dashes, separated by dots, for example pool.example.test.", "用字母、數字同橫線，用點分隔，例如 pool.example.test。");
  };
  input.addEventListener("input", () => { draw(); commit(input.value.trim()); });
  draw();
  return { el: h("div", { class: "textbox" }, h("div", { class: "ctl" }, input, clear), note), sync: () => { input.value = current(); draw(); } };
}

// Keeps every visible setting row in step with the pending changes, whoever made
// the change (a quick-add box, a search result, a menu, the Discard button), so
// a control and the place it came from never disagree.
export function syncRow(ctx, row) {
  const entry = ctx.state.catalog?.entries?.find((e) => e.id === row.id.slice(2));
  if (!entry) return;
  const edited = ctx.dock.has(entry.id);
  const value = edited ? ctx.dock.value(entry.id) : entry.secret ? "" : entry.value;
  row.classList.toggle("edited", edited);
  const revert = row.querySelector(".top .ctl > .btn.t.sm");
  if (revert) revert.hidden = !edited;
  if (entry.control === "switch") row.querySelector(".sw")?.setAttribute("aria-checked", String(value === entry.values.on));
  else if (entry.options) row.querySelectorAll(".seg [role=radio]").forEach((b, i) => { const on = entry.options[i]?.[0] === value; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
}

export default {
  id: "rich-controls",
  controls: { hostname: hostnameControl },
  overlays: [
    {
      id: "rich-controls.sync",
      mount(ctx) {
        const sync = () => document.querySelectorAll(".setting[id^='s-']").forEach((row) => syncRow(ctx, row));
        return ctx.bus.on("dock", sync);
      },
    },
    {
      id: "rich-controls.search",
      mount(ctx) {
        const box = document.querySelector(".bar .results");
        if (!box) return () => {};
        const observer = new MutationObserver(() => enhanceResults(ctx, box));
        observer.observe(box, { childList: true });
        return () => observer.disconnect();
      },
    },
  ],
  settings: [
    {
      id: "rich-controls",
      icon: "toggle_on",
      label: { en: "Where values are shown as controls", yue: "喺邊度用控制項顯示數值" },
      render(ctx) {
        const { h, icon, t } = ctx;
        return h("div", {}, SURFACES.map((s) => h("div", { class: "row" }, icon(s.rich ? "toggle_on" : "text_fields", "sm"), h("div", { class: "grow" }, h("div", { class: "t1" }, s.surface), h("div", { class: "t2" }, s.rich ? s.how : s.reason)), h("span", { class: `tag ${s.rich ? "good" : "warn"}` }, s.rich ? t("Control", "控制項") : t("Readout", "只讀")))));
      },
    },
  ],
};
