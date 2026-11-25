// Small Material building blocks shared by the appearance features. Each
// control reads its value through a getter and writes through a setter, and
// has a `sync()` the screen calls when the value changed somewhere else
// (reset, import, another control), so it never needs to be rebuilt.
export function widgets(ctx) {
  const { h, icon, t, tt } = ctx;
  const lab = (x) => (typeof x === "string" ? x : tt(x));

  // A group of buttons where one is chosen.
  function segmented(options, get, set, label) {
    const group = h("div", { class: "seg", role: "radiogroup", "aria-label": lab(label) });
    const buttons = options.map(([value, text, about]) => h("button", { type: "button", role: "radio", title: about ? lab(about) : null, onClick: () => set(value) }, lab(text)));
    group.sync = () => options.forEach(([value], i) => { const on = get() === value; buttons[i].setAttribute("aria-checked", String(on)); buttons[i].classList.toggle("on", on); buttons[i].tabIndex = on || (get() === undefined && i === 0) ? 0 : -1; });
    group.addEventListener("keydown", (e) => {
      const i = options.findIndex(([v]) => v === get());
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = (i + step + options.length) % options.length;
      set(options[next][0]);
      buttons[next].focus();
    });
    group.append(...buttons);
    group.sync();
    return group;
  }

  function toggle(get, set, label) {
    const b = h("button", { type: "button", class: "sw", role: "switch", "aria-label": lab(label), onClick: () => set(!get()) }, h("i", {}));
    b.sync = () => b.setAttribute("aria-checked", String(Boolean(get())));
    b.sync();
    return b;
  }

  function slider({ min, max, step = 1, unit = "", get, set, label, format = (v) => `${v}${unit}` }) {
    const out = h("output", { "aria-live": "off" });
    const input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), "aria-label": lab(label), onInput: () => { out.textContent = format(Number(input.value)); set(Number(input.value)); } });
    const wrap = h("div", { class: "slider" }, input, out);
    wrap.sync = () => { input.value = String(get()); out.textContent = format(Number(get())); };
    wrap.sync();
    return wrap;
  }

  // One labelled setting row, the same look as the router settings.
  function row(label, help, control) {
    return h("div", { class: "setting" }, h("div", { class: "top" }, h("div", { class: "grow" }, h("div", { class: "t1" }, lab(label)), help ? h("div", { class: "t2" }, lab(help)) : null), h("div", { class: "ctl" }, control)));
  }

  const button = (text, ic, onClick, cls = "o sm", extra = {}) => h("button", { type: "button", class: `btn ${cls}`, onClick, ...extra }, ic ? icon(ic, "sm") : null, lab(text));
  const note = (kind, text) => h("div", { class: `note ${kind}`.trim() }, icon(kind === "bad" ? "error" : kind === "warn" ? "warning" : "info", "sm"), h("div", {}, lab(text)));
  // A visible, honest marker for anything not fully working yet.
  const inProgress = (what) => h("div", { class: "note warn", role: "note" }, icon("construction", "sm"), h("div", {}, h("b", {}, t("In progress. ", "進行緊。")), lab(what)));
  const card = (title, ...kids) => h("section", { class: "card rise" }, title ? h("h2", { class: "h2" }, lab(title)) : null, ...kids);

  // Re-syncs every control when the store changes; returns the unsubscribe.
  const keepInSync = (store, controls) => store.subscribe(() => controls.forEach((c) => c.sync?.()));

  // Downloads text as a file, or reads a chosen file as text.
  const download = (name, text, type = "application/json") => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h("a", { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const pickTextFile = (accept = ".json,application/json", maxBytes = 200000) => new Promise((resolve) => {
    const input = h("input", { type: "file", accept, class: "sr", "aria-hidden": "true", tabindex: "-1" });
    input.addEventListener("change", async () => {
      const f = input.files?.[0];
      input.remove();
      if (!f) return resolve(null);
      if (f.size > maxBytes) return resolve({ error: t("That file is too large.", "個檔案太大。") });
      resolve({ text: await f.text(), name: f.name });
    });
    document.body.append(input);
    input.click();
  });

  return { segmented, toggle, slider, row, button, note, inProgress, card, keepInSync, download, pickTextFile, lab };
}
