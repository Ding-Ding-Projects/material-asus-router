// Small building blocks for this feature's panels, drawn with the app's own
// classes so they look and behave like its other controls: a switch, segmented
// buttons, a slider with its unit, a labelled row and a card.
export function kit(ctx) {
  const { h, icon } = ctx;

  const row = (label, help, control, extra) =>
    h("div", { class: "setting vx-row" },
      h("div", { class: "top" },
        h("div", { class: "grow" }, h("div", { class: "t1" }, label), help ? h("div", { class: "t2" }, help) : null),
        h("div", { class: "ctl" }, control)),
      extra ?? null);

  const sw = (label, checked, onChange, { disabled = false } = {}) => {
    const el = h("button", { class: "sw", type: "button", role: "switch", "aria-checked": String(Boolean(checked)), "aria-label": label, disabled, onClick: () => {
      const next = el.getAttribute("aria-checked") !== "true";
      el.setAttribute("aria-checked", String(next));
      onChange(next);
    } }, h("i"));
    el.set = (v) => el.setAttribute("aria-checked", String(Boolean(v)));
    return el;
  };

  const seg = (label, options, current, onPick) => {
    const buttons = options.map(([value, text]) => h("button", { type: "button", role: "radio", "aria-checked": String(value === current), class: value === current ? "on" : "", onClick: () => { onPick(value); mark(value); } }, text));
    const mark = (v) => buttons.forEach((b, i) => { const on = options[i][0] === v; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
    return h("div", { class: "seg", role: "radiogroup", "aria-label": label }, buttons);
  };

  // A slider that saves when you let go, and shows its value while you drag.
  const slider = ({ label, min, max, step = 1, value, format = (v) => String(v), onInput, onCommit }) => {
    const out = h("output", {}, format(value));
    const input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value), "aria-label": label, "aria-valuetext": format(value),
      onInput: (e) => { out.textContent = format(Number(e.target.value)); input.setAttribute("aria-valuetext", out.textContent); onInput?.(Number(e.target.value)); },
      onChange: (e) => onCommit?.(Number(e.target.value)) });
    const el = h("div", { class: "slider" }, input, out);
    el.set = (v) => { input.value = String(v); out.textContent = format(v); };
    return el;
  };

  const card = (id, title, iconName, lede, ...children) =>
    h("section", { class: "card rise vx-card", id: `vx-${id}` },
      h("h2", { class: "h2" }, iconName ? icon(iconName, "sm") : null, " ", title),
      lede ? h("p", { class: "muted" }, lede) : null,
      ...children);

  const note = (kind, text) => h("div", { class: `note ${kind}` }, icon(kind === "bad" ? "error" : kind === "warn" ? "warning" : "info"), h("div", {}, text));
  const btn = (text, onClick, { kind = "t", iconName, disabled = false, small = true } = {}) =>
    h("button", { class: `btn ${kind} ${small ? "sm" : ""}`, type: "button", disabled, onClick }, iconName ? icon(iconName, "sm") : null, text);

  return { row, sw, seg, slider, card, note, btn };
}
