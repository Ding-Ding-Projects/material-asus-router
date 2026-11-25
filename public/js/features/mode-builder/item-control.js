// The control for one setting inside a mode. It is the same kind of control the
// Settings screens use for that setting: the app's registered control types
// (schedule grid, MAC picker, chips, port, rule table, ...) are borrowed from the
// control registry, and the few stock ones that the registry does not hold
// (switch, choices, slider, number, IPv4) are drawn here. The control edits the
// mode's target value, never the router.
let registry = null;
let ipv4 = null;

// If the app's control modules cannot be loaded, only the stock controls below are offered and every other
// kind of setting says it cannot be edited inside a mode.
export async function loadControls() {
  try {
    registry ??= (await import("/js/control-registry.js")).controlTypes;
  } catch {
    registry = null;
  }
  try {
    ipv4 ??= (await import("/js/ipv4-field.js")).ipv4Field;
  } catch {
    ipv4 = null;
  }
}

const STOCK = new Set(["switch", "select", "slider", "number", "ipv4", "text", "hostname"]);

// Can this kind of setting be given a value inside a mode?
export const canEdit = (entry) => STOCK.has(entry.control) || Boolean(registry?.has(entry.control));

export function itemControl(ctx, entry, current, commit, locked) {
  const { h, tt } = ctx;
  const label = tt(entry.label);
  switch (entry.control) {
    case "switch": {
      const on = () => current() === entry.values.on;
      const sw = h("button", { type: "button", class: "sw", role: "switch", "aria-checked": String(on()), "aria-label": label, disabled: locked, onClick() { commit(on() ? entry.values.off : entry.values.on); sw.setAttribute("aria-checked", String(on())); } }, h("i"));
      return { el: sw, sync: () => sw.setAttribute("aria-checked", String(on())) };
    }
    case "select": {
      const select = h("select", { class: "field", "aria-label": label, disabled: locked, onChange: (e) => commit(e.target.value) },
        entry.options.map(([value, text]) => h("option", { value, selected: value === current() }, tt(text))));
      if (!entry.options.some(([v]) => v === current())) select.prepend(h("option", { value: current(), selected: true }, current() || "-"));
      return { el: select, sync: () => (select.value = current()) };
    }
    case "slider": {
      const out = h("output", {}, `${current()}${entry.unit ?? ""}`);
      const input = h("input", { type: "range", min: String(entry.min), max: String(entry.max), step: String(entry.step ?? 1), value: current() || String(entry.max), "aria-label": label, disabled: locked, onInput(e) { out.textContent = `${e.target.value}${entry.unit ?? ""}`; commit(e.target.value); } });
      return { el: h("div", { class: "slider" }, input, out), sync() { input.value = current(); out.textContent = `${current()}${entry.unit ?? ""}`; } };
    }
    case "number": {
      const input = h("input", { class: "field", type: "number", min: String(entry.min), max: String(entry.max), inputmode: "numeric", value: current(), "aria-label": label, disabled: locked, onInput: (e) => commit(e.target.value) });
      return { el: h("div", { class: "ctl" }, input, entry.unit ? h("span", { class: "muted" }, entry.unit) : null), sync: () => (input.value = current()) };
    }
    case "ipv4":
      if (ipv4) {
        const field = ipv4(current(), commit, locked);
        return { el: field.el, sync: () => field.set(current()) };
      }
      break;
    case "text":
    case "hostname": {
      const input = h("input", { class: "field", type: "text", maxlength: String(entry.maxLength ?? 253), autocomplete: "off", spellcheck: "false", value: current(), "aria-label": label, disabled: locked, onInput: (e) => commit(e.target.value) });
      return { el: input, sync: () => (input.value = current()) };
    }
    default: {
      const factory = registry?.get(entry.control);
      if (factory) return factory(entry, current, commit, locked, { entry });
    }
  }
  return { el: h("div", { class: "t2" }, ctx.t("This kind of setting cannot be edited inside a mode yet. Change it on its own page.", "呢類設定暫時唔可以喺模式入面編輯，請去佢自己嘅頁面改。")), sync() {} };
}
