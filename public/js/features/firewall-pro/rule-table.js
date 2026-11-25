// The "rule-table" control: a list of rules the router keeps in one setting as
// "<a>b>c<d>e>f". Every rule is a row of typed cells (text, choice, switch,
// number, speed slider, port, address, device picker). Rows can be edited in
// place, moved up and down (rules are checked from the top), removed, and new
// rows are added from a blank row. Every edit goes to the change dock through
// commit(), so nothing reaches the router before the person previews it.
//
// This file imports nothing; everything it needs arrives in ctx. It is shared
// with the qos-pro feature, which uses the same control type.

export const parseRows = (value) => String(value ?? "").split("<").filter(Boolean).map((row) => row.split(">"));
export const formatRows = (rows) => rows.map((row) => `<${row.join(">")}`).join("");
const strip = (text) => String(text).replace(/[<>]/g, "");

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const MAC = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;
const PORT = /^(\d{1,5})(?::(\d{1,5}))?$/;

// Is one cell's text acceptable? Returns "" when fine, otherwise what is wrong.
export function cellProblem(column, value, ctx) {
  const t = ctx.t;
  if (value === "") return column.optional ? "" : t("Fill this in.", "請填寫。");
  switch (column.cell) {
    case "ipv4":
      return IPV4.test(value) ? "" : t("Enter an IPv4 address.", "請輸入 IPv4 地址。");
    case "device":
      return IPV4.test(value) || MAC.test(value) ? "" : t("Enter an IPv4 or MAC address.", "請輸入 IPv4 或 MAC 地址。");
    case "port": {
      const m = value.match(PORT);
      return m && Number(m[1]) >= 1 && Number(m[2] ?? m[1]) <= 65535 && Number(m[1]) <= Number(m[2] ?? m[1]) ? "" : t("Enter a port from 1 to 65535, or a range such as 8000:8010.", "請輸入 1 至 65535 嘅端口，或者好似 8000:8010 嘅範圍。");
    }
    case "number":
    case "kbps":
      return /^\d{1,9}$/.test(value) && Number(value) >= (column.min ?? 0) && Number(value) <= (column.max ?? 10000000) ? "" : t(`Enter a whole number from ${column.min ?? 0} to ${column.max ?? 10000000}.`, `請輸入 ${column.min ?? 0} 至 ${column.max ?? 10000000} 嘅整數。`);
    case "ipv6":
      return /^[0-9A-Fa-f:]+(\/\d{1,3})?$/.test(value) && value.includes(":") ? "" : t("Enter an IPv6 address.", "請輸入 IPv6 地址。");
    case "text":
      if (column.pattern && !new RegExp(column.pattern).test(value)) return t("That is not an allowed value.", "呢個值唔可以用。");
      return value.length > (column.max ?? 32) ? t("That is too long.", "太長。") : "";
    default:
      return "";
  }
}

let devicesLoad = null;
const knownDevices = (ctx) => (devicesLoad ??= ctx.api.get("/api/domain/devices").then((d) => d.devices ?? []).catch(() => []));

const kbitText = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || value === "") return "";
  return n >= 1000 ? `${(n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} Mbit/s` : `${n} kbit/s`;
};

// One cell editor. get() returns the text, set(text) puts a value in.
function cellEditor(column, ctx, locked, onInput) {
  const { h, t, tt } = ctx;
  const label = tt(column.label);
  const base = { "aria-label": label, disabled: locked };
  switch (column.cell) {
    case "select": {
      const select = h("select", { ...base, class: "field", onChange: () => onInput() }, column.options.map(([value, text]) => h("option", { value }, tt(text))));
      return { el: select, get: () => select.value, set: (v) => { select.value = column.options.some(([o]) => o === v) ? v : column.options[0][0]; } };
    }
    case "switch": {
      let on = true;
      const button = h("button", { ...base, class: "sw", type: "button", role: "switch", "aria-checked": "true", onClick() { on = !on; button.setAttribute("aria-checked", String(on)); onInput(); } }, h("i"));
      return { el: button, get: () => (on ? "1" : "0"), set(v) { on = v !== "0"; button.setAttribute("aria-checked", String(on)); } };
    }
    case "kbps": {
      const max = Math.min(column.max ?? 1000000, 1000000);
      const hint = h("span", { class: "muted rt-unit" });
      const number = h("input", { ...base, class: "field num", type: "number", inputmode: "numeric", min: String(column.min ?? 0), max: String(column.max ?? 10000000), onInput() { slider.value = String(Math.min(Number(number.value) || 0, max)); hint.textContent = kbitText(number.value); onInput(); } });
      const slider = h("input", { ...base, type: "range", min: String(column.min ?? 0), max: String(max), step: "1000", "aria-label": `${label} (${t("slider", "滑桿")})`, onInput() { number.value = slider.value; hint.textContent = kbitText(slider.value); onInput(); } });
      return {
        el: h("div", { class: "rt-rate" }, slider, h("div", { class: "ctl" }, number, h("span", { class: "muted" }, column.unit ?? "kbit/s"), hint)),
        get: () => number.value,
        set(v) { number.value = v; slider.value = String(Math.min(Number(v) || 0, max)); hint.textContent = kbitText(v); },
      };
    }
    case "device": {
      const input = h("input", { ...base, class: "field", autocomplete: "off", spellcheck: "false", maxlength: "17", placeholder: column.optional ? t("Any device", "任何裝置") : "198.51.100.20", onInput: () => onInput() });
      const pick = h("select", { class: "field", "aria-label": `${label} (${t("pick a device", "揀裝置")})`, disabled: locked, onChange(e) { if (e.target.value) { input.value = e.target.value; e.target.value = ""; onInput(); } } }, h("option", { value: "" }, t("Pick a device…", "揀裝置…")));
      knownDevices(ctx).then((list) => pick.append(...list.filter((d) => d.ip).map((d) => h("option", { value: d.ip }, `${d.name || d.hostname || d.mac} · ${d.ip}`))));
      return { el: h("div", { class: "rt-device" }, input, pick), get: () => { const v = input.value.trim(); return MAC.test(v) ? v.toUpperCase() : v; }, set: (v) => { input.value = v; } };
    }
    case "number": {
      const input = h("input", { ...base, class: "field num", type: "number", inputmode: "numeric", min: String(column.min ?? 0), max: String(column.max ?? 10000000), onInput: () => onInput() });
      return { el: input, get: () => input.value, set: (v) => { input.value = v; } };
    }
    default: {
      const input = h("input", { ...base, class: "field", autocomplete: "off", spellcheck: "false", maxlength: String(column.max ?? (column.cell === "ipv6" ? 43 : 32)), inputmode: column.cell === "port" ? "numeric" : undefined, placeholder: column.optional ? t("Any", "任何") : "", onInput: () => onInput() });
      return { el: input, get: () => strip(input.value).trim(), set: (v) => { input.value = v; } };
    }
  }
}

export function ruleTable(entry, current, commit, locked, ctx) {
  const { h, icon, t, tt } = ctx;
  const columns = entry.columns;
  const max = entry.maxItems ?? 32;
  const list = h("div", { class: "rt-rows", role: "list" });
  const count = h("div", { class: "muted rt-count" });
  const rows = () => parseRows(current());
  const write = (next) => { commit(formatRows(next)); draw(); };

  const row = (cells, index) => {
    const editors = columns.map((column, i) => {
      const editor = cellEditor(column, ctx, locked, () => save());
      editor.set(cells[i] ?? "");
      return editor;
    });
    const problems = h("div", { class: "rt-problem", role: "status" });
    const save = () => {
      const values = editors.map((e) => e.get());
      const bad = columns.map((c, i) => (cellProblem(c, values[i], ctx) ? `${tt(c.label)}: ${cellProblem(c, values[i], ctx)}` : "")).filter(Boolean);
      problems.textContent = bad.join(" ");
      const next = rows();
      next[index] = values;
      commit(formatRows(next));
    };
    const tools = locked ? null : h("div", { class: "rt-tools" },
      h("button", { class: "btn t icon", type: "button", disabled: index === 0, "aria-label": `${t("Move up", "上移")} #${index + 1}`, onClick() { const next = rows(); [next[index - 1], next[index]] = [next[index], next[index - 1]]; write(next); } }, icon("arrow_upward", "sm")),
      h("button", { class: "btn t icon", type: "button", disabled: index === rows().length - 1, "aria-label": `${t("Move down", "下移")} #${index + 1}`, onClick() { const next = rows(); [next[index + 1], next[index]] = [next[index], next[index + 1]]; write(next); } }, icon("arrow_downward", "sm")),
      h("button", { class: "btn t icon", type: "button", "aria-label": `${t("Remove rule", "移除規則")} #${index + 1}`, onClick() { write(rows().filter((_, i) => i !== index)); } }, icon("delete", "sm")));
    return h("div", { class: "rt-row", role: "listitem" },
      h("span", { class: "rt-n", "aria-hidden": "true" }, String(index + 1)),
      h("div", { class: "rt-cells" }, columns.map((column, i) => h("label", { class: `rt-cell c-${column.cell}` }, h("span", { class: "t2" }, tt(column.label)), editors[i].el))),
      tools, problems);
  };

  // The blank row at the bottom adds a rule.
  const addEditors = columns.map((column) => cellEditor(column, ctx, locked, () => {}));
  addEditors.forEach((editor, i) => editor.set(columns[i].cell === "switch" ? "1" : columns[i].cell === "select" ? columns[i].options[0][0] : ""));
  const addNote = h("div", { class: "rt-problem", role: "status" });
  const add = locked ? null : h("div", { class: "rt-add" },
    h("div", { class: "rt-cells" }, columns.map((column, i) => h("label", { class: `rt-cell c-${column.cell}` }, h("span", { class: "t2" }, tt(column.label)), addEditors[i].el))),
    h("button", { class: "btn o sm", type: "button", onClick() {
      const values = addEditors.map((e) => e.get());
      const bad = columns.map((c, i) => (cellProblem(c, values[i], ctx) ? `${tt(c.label)}: ${cellProblem(c, values[i], ctx)}` : "")).filter(Boolean);
      if (bad.length) { addNote.textContent = bad.join(" "); return; }
      if (rows().length >= max) { addNote.textContent = t(`At most ${max} rules.`, `最多 ${max} 條規則。`); return; }
      if (entry.unique && rows().some((r) => r[0].toLowerCase() === values[0].toLowerCase())) { addNote.textContent = t("That is already in the list.", "名單入面已經有。"); return; }
      addNote.textContent = "";
      write([...rows(), values]);
      addEditors.forEach((editor, i) => editor.set(columns[i].cell === "switch" ? "1" : columns[i].cell === "select" ? columns[i].options[0][0] : ""));
    } }, icon("add", "sm"), t("Add rule", "加規則")), addNote);

  function draw() {
    const all = rows();
    list.replaceChildren(...all.map(row));
    if (!all.length) list.append(h("div", { class: "muted rt-empty" }, t("No rules yet.", "未有規則。")));
    count.textContent = `${all.length}/${max}`;
  }
  draw();
  return { el: h("div", { class: "ruletable" }, list, count, add, entry.hint ? h("div", { class: "t2" }, tt(entry.hint)) : null), sync: draw };
}
