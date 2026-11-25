// Small typed rows for this feature's own settings (state that belongs to the
// app, not to the router). Each control returns { el, set(value) }. Nothing
// here writes HTML strings; text always goes in as text nodes.
export function makeUi(ctx) {
  const { h, icon, tt } = ctx;
  const say = (spec) => (typeof spec === "string" ? spec : tt(spec));

  const row = (title, help, control, extra) =>
    h("div", { class: "setting" },
      h("div", { class: "top" },
        h("div", { class: "grow" }, h("div", { class: "t1" }, say(title)), help ? h("div", { class: "t2" }, say(help)) : null),
        h("div", { class: "ctl" }, control, extra)));

  function seg(options, value, onChange, aria) {
    const wrap = h("div", { class: "seg", role: "radiogroup", "aria-label": say(aria ?? "") });
    const buttons = options.map(([v, l, about]) => h("button", { type: "button", role: "radio", title: about ? say(about) : undefined, onClick() { value = v; sync(); onChange(v); } }, say(l)));
    const sync = () => buttons.forEach((b, i) => { const on = options[i][0] === value; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
    wrap.append(...buttons);
    sync();
    return { el: wrap, set(v) { value = v; sync(); } };
  }

  function sw(value, onChange, aria) {
    const el = h("button", { type: "button", class: "sw", role: "switch", "aria-label": say(aria), "aria-checked": String(Boolean(value)), onClick() { value = !value; el.setAttribute("aria-checked", String(value)); onChange(value); } }, h("i"));
    return { el, set(v) { value = Boolean(v); el.setAttribute("aria-checked", String(value)); } };
  }

  function select(options, value, onChange, aria) {
    const el = h("select", { class: "field", "aria-label": say(aria), onChange: (e) => onChange(e.target.value) },
      options.map(([v, l, about]) => h("option", { value: v, selected: v === value }, about ? `${say(l)} \u00b7 ${say(about)}` : say(l))));
    return { el, set(v) { el.value = v; } };
  }

  function slider(min, max, step, unit, value, onChange, aria) {
    const out = h("output", {}, `${value}${unit ?? ""}`);
    const input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value), "aria-label": say(aria), onInput(e) { out.textContent = `${e.target.value}${unit ?? ""}`; onChange(Number(e.target.value)); } });
    return { el: h("div", { class: "slider" }, input, out), set(v) { input.value = String(v); out.textContent = `${v}${unit ?? ""}`; } };
  }

  function stepper(min, max, step, unit, value, onChange, aria) {
    const input = h("input", { class: "field num", type: "number", min: String(min), max: String(max), step: String(step), inputmode: "numeric", value: String(value), "aria-label": say(aria) });
    const commit = (n) => { const next = Math.min(max, Math.max(min, Number.isFinite(n) ? n : min)); input.value = String(next); onChange(next); };
    input.addEventListener("change", () => commit(Number(input.value)));
    const bump = (d) => commit(Number(input.value || 0) + d * step);
    return {
      el: h("div", { class: "stepper" }, h("button", { type: "button", class: "btn t sm icon", "aria-label": "-", onClick: () => bump(-1) }, icon("remove", "sm")), input, h("button", { type: "button", class: "btn t sm icon", "aria-label": "+", onClick: () => bump(1) }, icon("add", "sm")), unit ? h("span", { class: "muted" }, unit) : null),
      set(v) { input.value = String(v); },
    };
  }

  // Free text, only where the value really is free text; it always has a
  // counter and a hint.
  function text(value, { maxLength = 120, hint, onChange, aria, placeholder = "" }) {
    const counter = h("div", { class: "t2 counter" }, `${value.length}/${maxLength}`);
    const input = h("input", { class: "field", type: "text", maxlength: String(maxLength), placeholder, value, "aria-label": say(aria), onInput(e) { counter.textContent = `${e.target.value.length}/${maxLength}`; onChange(e.target.value); } });
    return { el: h("div", { class: "textbox" }, input, counter, hint ? h("div", { class: "t2" }, say(hint)) : null), set(v) { input.value = v; counter.textContent = `${v.length}/${maxLength}`; } };
  }

  return { row, seg, sw, select, slider, stepper, text, say };
}
