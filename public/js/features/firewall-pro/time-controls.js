// The two schedule controls for the firewall filters, plus the pure helper that
// turns a filter's days and time windows into the week grid shown beside them.
// This file imports nothing; the controls get ctx from the registry.

// "weekdays" is seven 0 or 1 flags, Sunday first. "timerange" is HHMMHHMM.
export const DAY_NAMES = [["Sun", "日"], ["Mon", "一"], ["Tue", "二"], ["Wed", "三"], ["Thu", "四"], ["Fri", "五"], ["Sat", "六"]];

const minutes = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(2, 4));
const toInput = (text) => (/^\d{4}$/.test(text) ? `${text.slice(0, 2)}:${text.slice(2)}` : "");
const fromInput = (text) => text.replace(":", "");

// Which hours of the day a "HHMMHHMM" window touches, as 24 booleans.
export function windowHours(range) {
  const hours = new Array(24).fill(false);
  if (!/^\d{8}$/.test(range)) return hours;
  const [start, end] = [minutes(range.slice(0, 4)), minutes(range.slice(4))];
  for (let h = 0; h < 24; h += 1) hours[h] = h * 60 < end && h * 60 + 60 > start;
  return hours;
}

// days: "1111111"; ranges: a list of "HHMMHHMM" texts (empty ones are ignored).
// Returns seven rows of 24 booleans, Sunday first.
export function activeGrid(days, ranges) {
  const hours = new Array(24).fill(false);
  for (const range of ranges) windowHours(range).forEach((on, h) => { hours[h] = hours[h] || on; });
  return Array.from({ length: 7 }, (_, d) => hours.map((on) => on && days[d] === "1"));
}

export function weekdays(entry, current, commit, locked, ctx) {
  const { h, t } = ctx;
  const buttons = DAY_NAMES.map(([en, yue], day) =>
    h("button", { class: "chip", type: "button", role: "checkbox", disabled: locked, "aria-label": t(en, yue), onClick() {
      const flags = current().padEnd(7, "0").split("");
      flags[day] = flags[day] === "1" ? "0" : "1";
      commit(flags.join(""));
      sync();
    } }, t(en, yue)));
  const sync = () => buttons.forEach((b, day) => { const on = current()[day] === "1"; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
  sync();
  return { el: h("div", { class: "chips fp-days", role: "group", "aria-label": ctx.tt(entry.label) }, buttons), sync };
}

export function timerange(entry, current, commit, locked, ctx) {
  const { h, icon, t } = ctx;
  const label = ctx.tt(entry.label);
  const from = h("input", { class: "field", type: "time", disabled: locked, "aria-label": `${label}: ${t("from", "由")}`, onInput: write });
  const to = h("input", { class: "field", type: "time", disabled: locked, "aria-label": `${label}: ${t("until", "至")}`, onInput: write });
  function write() {
    if (!from.value || !to.value) return entry.optional && !from.value && !to.value ? commit("") : undefined;
    commit(fromInput(from.value) + fromInput(to.value));
  }
  const clear = entry.optional ? h("button", { class: "btn t sm", type: "button", disabled: locked, onClick() { from.value = ""; to.value = ""; commit(""); } }, icon("backspace", "sm"), t("Clear", "清除")) : null;
  const sync = () => { from.value = toInput(current().slice(0, 4)); to.value = toInput(current().slice(4)); };
  sync();
  return { el: h("div", { class: "ctl fp-time" }, from, h("span", {}, t("to", "至")), to, clear), sync };
}
