// Draws one server.properties setting with the control its definition asks
// for: a switch for on/off, a menu or buttons for a choice, a slider or
// stepper for a number with limits, a port box with presets, and a text box
// only where the value is genuinely free text. It imports nothing; the ui
// helpers arrive as an argument.
export function settingControl(ctx, ui, def, value, onChange) {
  const { h, tt } = ctx;
  const label = def.label;
  const locked = Boolean(def.disabled);
  const wrap = (control) => (locked ? h("div", { class: "off" }, control.el) : control.el);
  switch (def.control) {
    case "switch": return wrap(ui.sw(value === "true", (v) => onChange(String(v)), label));
    case "select":
    case "segmented": {
      const options = def.options.map(([v, l, about]) => [v, l ?? v, about]);
      const control = options.length <= 4 ? ui.seg(options, value, onChange, label) : ui.select(options, value, onChange, label);
      return wrap(control);
    }
    case "slider": return wrap(ui.slider(def.min, def.max, def.step ?? 1, def.unit ?? "", Number(value), (v) => onChange(String(v)), label));
    case "stepper":
    case "number": return wrap(ui.stepper(def.min, def.max, def.step ?? 1, def.unit ?? "", Number(value), (v) => onChange(String(v)), label));
    case "port": {
      const box = ui.stepper(def.min, def.max, 1, "", Number(value), (v) => onChange(String(v)), label);
      return h("div", { class: "portpick" }, box.el, h("div", { class: "chips" }, (def.presets ?? []).map(([port, name]) => h("button", { class: "chip", type: "button", disabled: locked, onClick() { box.set(port); onChange(String(port)); } }, `${port} · ${tt(name)}`))));
    }
    case "text": return ui.text(value, { maxLength: def.maxLength, hint: def.hint, aria: label, onChange }).el;
    default: return h("div", { class: "t2" }, value);
  }
}
