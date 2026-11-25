// The choices a ready-made mode asks for: a console or laptop, the devices that
// go quiet at night, a time, a resolver. Each one is a real typed control, and
// the answer is saved on the server so the next visit starts where this one ended.

const deviceName = (d) => d.hostname || d.mac;
const deviceValue = (d) => d.ip || d.mac;

export function paramSection(ctx, mode, { devices, save, locked }) {
  const { h, t, tt } = ctx;
  const values = structuredClone(mode.params);
  let timer = null;
  const commit = () => {
    clearTimeout(timer);
    timer = setTimeout(() => save({ ...values }), 350);
  };

  const field = (p, control) => h("label", { class: "mode-param" }, h("span", { class: "t1" }, tt(p.label)), p.help ? h("span", { class: "t2" }, tt(p.help)) : null, control);

  const controls = mode.schema.map((p) => {
    switch (p.kind) {
      case "device": {
        const list = devices.filter((d) => deviceValue(d));
        const options = [h("option", { value: "" }, t("Every device", "所有裝置"))];
        for (const d of list) options.push(h("option", { value: deviceValue(d), selected: values[p.id] === deviceValue(d) }, `${deviceName(d)} · ${deviceValue(d)}`));
        if (values[p.id] && !list.some((d) => deviceValue(d) === values[p.id])) options.push(h("option", { value: values[p.id], selected: true }, values[p.id]));
        const select = h("select", { class: "field", disabled: locked, onChange: (e) => { values[p.id] = e.target.value; commit(); } }, options);
        select.value = values[p.id] ?? "";
        return field(p, select);
      }
      case "devices": {
        const chosen = new Map(values[p.id].map((d) => [d.mac, d.name]));
        const known = devices.filter((d) => d.mac);
        const rows = known.map((d) =>
          h("label", { class: "mode-check" },
            h("input", { type: "checkbox", checked: chosen.has(d.mac.toUpperCase()), disabled: locked, onChange: (e) => {
              if (e.target.checked) chosen.set(d.mac.toUpperCase(), deviceName(d));
              else chosen.delete(d.mac.toUpperCase());
              values[p.id] = [...chosen].map(([mac, name]) => ({ mac, name }));
              commit();
            } }),
            h("span", { class: "grow" }, h("span", { class: "t1" }, deviceName(d)), h("span", { class: "t2 mono" }, ` ${d.mac}`)),
            d.online ? h("span", { class: "tag good" }, t("Online", "在線")) : null));
        return field(p, h("div", { class: "mode-checks", role: "group", "aria-label": tt(p.label) }, rows.length ? rows : h("div", { class: "t2" }, t("No devices found yet.", "暫時搵唔到裝置。"))));
      }
      case "choice": {
        const seg = h("div", { class: "seg", role: "radiogroup", "aria-label": tt(p.label) },
          p.options.map(([value, label]) => h("button", { type: "button", role: "radio", disabled: locked, class: values[p.id] === value ? "on" : "", "aria-checked": String(values[p.id] === value), onClick: (e) => {
            values[p.id] = value;
            for (const b of seg.children) { const on = b === e.currentTarget; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); }
            commit();
          } }, tt(label))));
        return field(p, seg);
      }
      case "time":
        return field(p, h("input", { class: "field", type: "time", value: values[p.id], disabled: locked, step: "300", onChange: (e) => { if (e.target.value) { values[p.id] = e.target.value; commit(); } } }));
      default:
        return null;
    }
  });
  return controls.length ? h("div", { class: "mode-params" }, controls) : null;
}
