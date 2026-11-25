// Rich controls for catalogue settings: switch, select (segmented or menu),
// slider, number, text, password with reveal, and IPv4 fields. Each control
// edits the pending-changes dock, never the router directly.
import { api, h, icon, t, tt, toast } from "./core.js";
import { app, dock } from "./dock.js";

function ipv4Field(value, onChange, disabled) {
  const parts = String(value || "").split(".");
  while (parts.length < 4) parts.push("");
  const inputs = [0, 1, 2, 3].map((i) =>
    h("input", {
      class: "oct",
      inputmode: "numeric",
      maxlength: "3",
      autocomplete: "off",
      "aria-label": t(`Part ${i + 1} of the address`, `地址第 ${i + 1} 部分`),
      value: parts[i],
      disabled,
      onInput(e) {
        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 3);
        const hadDot = /\./.test(e.target.value);
        e.target.value = cleaned;
        if (i < 3 && (cleaned.length === 3 || (hadDot && cleaned))) inputs[i + 1].focus();
        const joined = inputs.map((x) => x.value);
        onChange(joined.every((x) => x === "") ? "" : joined.join("."));
      },
      onKeydown(e) {
        if (e.key === "Backspace" && !e.target.value && i > 0) inputs[i - 1].focus();
        if (e.key === "." && i < 3) (e.preventDefault(), inputs[i + 1].focus());
      },
    }),
  );
  const wrap = h("span", { class: "ipv4", role: "group" });
  inputs.forEach((input, i) => wrap.append(i ? h("span", { "aria-hidden": "true" }, ".") : null, input));
  return { el: wrap, set: (v) => String(v).split(".").forEach((p, i) => inputs[i] && (inputs[i].value = p)) };
}

function control(entry, current, commit, locked) {
  const disabled = locked;
  switch (entry.control) {
    case "switch": {
      const on = () => current() === entry.values.on;
      const sw = h("button", {
        class: "sw",
        role: "switch",
        "aria-checked": String(on()),
        "aria-label": tt(entry.label),
        disabled,
        onClick() {
          commit(on() ? entry.values.off : entry.values.on);
          sw.setAttribute("aria-checked", String(on()));
        },
      }, h("i"));
      return { el: sw, sync: () => sw.setAttribute("aria-checked", String(on())) };
    }
    case "select": {
      if (entry.options.length <= 4) {
        const wrap = h("div", { class: "seg", role: "radiogroup", "aria-label": tt(entry.label) });
        const buttons = entry.options.map(([value, label]) =>
          h("button", { role: "radio", disabled, onClick() { commit(value); sync(); } }, tt(label)),
        );
        const sync = () => buttons.forEach((b, i) => { b.classList.toggle("on", entry.options[i][0] === current()); b.setAttribute("aria-checked", String(entry.options[i][0] === current())); });
        wrap.append(...buttons);
        sync();
        return { el: wrap, sync };
      }
      const select = h("select", { class: "field", "aria-label": tt(entry.label), disabled, onChange: (e) => commit(e.target.value) },
        entry.options.map(([value, label]) => h("option", { value, selected: value === current() }, tt(label))));
      if (!entry.options.some(([v]) => v === current())) select.prepend(h("option", { value: current(), selected: true }, current() || "—"));
      return { el: select, sync: () => (select.value = current()) };
    }
    case "slider": {
      const out = h("output", {}, `${current()}${entry.unit ?? ""}`);
      const input = h("input", { type: "range", min: String(entry.min), max: String(entry.max), step: String(entry.step ?? 1), value: current() || String(entry.max), "aria-label": tt(entry.label), disabled, onInput(e) { out.textContent = `${e.target.value}${entry.unit ?? ""}`; commit(e.target.value); } });
      return { el: h("div", { class: "slider" }, input, out), sync() { input.value = current(); out.textContent = `${current()}${entry.unit ?? ""}`; } };
    }
    case "number": {
      const input = h("input", { class: "field", type: "number", min: String(entry.min), max: String(entry.max), inputmode: "numeric", value: current(), "aria-label": tt(entry.label), disabled, onInput: (e) => commit(e.target.value) });
      return { el: h("div", { class: "ctl" }, input, entry.unit ? h("span", { class: "muted" }, entry.unit) : null), sync: () => (input.value = current()) };
    }
    case "ipv4": {
      const field = ipv4Field(current(), commit, disabled);
      return { el: field.el, sync: () => field.set(current()) };
    }
    case "password": {
      let shown = false;
      let loaded = null;
      const input = h("input", { class: "field", type: "password", autocomplete: "new-password", placeholder: entry.hasValue ? t("Unchanged. Type to replace.", "冇改。打字就會更換。") : t("Not set", "未設定"), minlength: String(entry.minLength ?? 0), maxlength: String(entry.maxLength ?? 256), "aria-label": tt(entry.label), disabled, onInput: (e) => commit(e.target.value) });
      const eye = h("button", {
        class: "btn t icon",
        type: "button",
        "aria-label": t("Show password", "顯示密碼"),
        disabled: disabled && !app.canWrite,
        async onClick() {
          shown = !shown;
          if (shown && !input.value && entry.hasValue) {
            try {
              loaded ??= (await api.post("/api/reveal", { id: entry.id })).value;
              input.value = loaded;
              input.placeholder = "";
            } catch (e) {
              shown = false;
              return toast(e.message, "bad");
            }
          } else if (!shown && input.value === loaded) input.value = "";
          input.type = shown ? "text" : "password";
          eye.firstChild.textContent = shown ? "visibility_off" : "visibility";
        },
      }, icon("visibility", "sm"));
      return { el: h("div", { class: "pwd" }, input, eye), sync: () => (input.value = dock.value(entry.id) ?? "") };
    }
    default: {
      const input = h("input", { class: "field", type: "text", maxlength: String(entry.maxLength ?? 256), autocomplete: "off", spellcheck: "false", value: current(), "aria-label": tt(entry.label), placeholder: entry.optional ? t("Optional", "可選") : "", disabled, onInput: (e) => commit(e.target.value) });
      return { el: input, sync: () => (input.value = current()) };
    }
  }
}

// One labelled row: label, help button, control and edit marker.
export function settingRow(entry) {
  const locked = !app.canWrite || Boolean(entry.disabled);
  const current = () => (dock.has(entry.id) ? dock.value(entry.id) : entry.secret ? "" : entry.value);
  const row = h("div", { class: "setting", id: `s-${entry.id}` });
  const help = h("div", { class: "help", hidden: true }, tt(entry.help), h("div", { class: "mono t2" }, entry.key));
  let ctl;
  const mark = () => row.classList.toggle("edited", dock.has(entry.id));
  const revert = h("button", { class: "btn t sm", hidden: true, onClick() { dock.setEntry(entry, entry.secret ? "" : entry.value); ctl.sync?.(); mark(); revert.hidden = true; } }, icon("undo", "sm"), t("Undo edit", "取消編輯"));
  ctl = control(entry, current, (value) => {
    dock.setEntry(entry, value);
    mark();
    revert.hidden = !dock.has(entry.id);
  }, locked);
  const info = h("button", { class: "info", "aria-label": t("What is this?", "呢個係咩？"), "aria-expanded": "false", onClick(e) { help.hidden = !help.hidden; e.currentTarget.setAttribute("aria-expanded", String(!help.hidden)); } }, icon("info", "sm"));
  row.append(
    h("div", { class: "top" },
      h("div", { class: "grow" },
        h("div", { class: "t1" }, tt(entry.label), " ", entry.risk === "network" ? h("span", { class: "tag warn", title: t("A change here is applied with the safety net.", "改呢度會用安全機制套用。") }, icon("shield", "sm"), t("Safety net", "安全機制")) : null),
        entry.disabled ? h("div", { class: "t2" }, icon("lock", "sm"), " ", tt(entry.disabled)) : null),
      h("div", { class: "ctl" }, ctl.el, revert, info)),
    help,
  );
  if (entry.disabled) row.classList.add("off");
  mark();
  revert.hidden = !dock.has(entry.id);
  return row;
}

export function groupCard(label, entries, query = "") {
  const q = query.trim().toLowerCase();
  const shown = q ? entries.filter((e) => `${e.label.en} ${e.label.yue} ${e.key} ${e.help.en}`.toLowerCase().includes(q)) : entries;
  if (!shown.length) return null;
  return h("section", { class: "card rise" }, label ? h("h2", { class: "h2" }, tt(label)) : null, shown.map(settingRow));
}

// Turns a flat list of entries into one card per group, in router order.
export function settingGroups(entries) {
  const groups = [];
  for (const entry of entries) {
    let group = groups.find((g) => g.id === entry.group);
    if (!group) groups.push((group = { id: entry.group, label: entry.groupLabel, entries: [] }));
    group.entries.push(entry);
  }
  return groups;
}
