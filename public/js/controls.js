// Rich controls for catalogue settings. Drawn here: switch, select (segmented
// or menu, with option descriptions), slider with units, number, IPv4 fields,
// password with reveal and strength, and free text with counter and hint.
// Every other type (segmented, stepper, port, mac, device, cidr, range, chips,
// color, schedule, file and any a feature adds) is registered with
// registerControl() in control-registry.js; controls-rich.js holds the stock
// ones. Each control edits the pending-changes dock, never the router directly.
import { api, h, icon, t, tt, toast } from "./core.js";
import { app, dock } from "./dock.js";
import { controlTypes } from "./control-registry.js";
import { ipv4Field } from "./ipv4-field.js";
import "./controls-rich.js";

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
        const buttons = entry.options.map(([value, label, about]) =>
          h("button", { role: "radio", disabled, title: about ? tt(about) : undefined, onClick() { commit(value); sync(); } }, tt(label)),
        );
        const sync = () => buttons.forEach((b, i) => { b.classList.toggle("on", entry.options[i][0] === current()); b.setAttribute("aria-checked", String(entry.options[i][0] === current())); });
        wrap.append(...buttons);
        sync();
        return { el: wrap, sync };
      }
      const select = h("select", { class: "field", "aria-label": tt(entry.label), disabled, onChange: (e) => commit(e.target.value) },
        entry.options.map(([value, label, about]) => h("option", { value, selected: value === current() }, about ? `${tt(label)} · ${tt(about)}` : tt(label))));
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
      const strength = h("div", { class: "meter strength", role: "img" }, h("i"));
      const rate = (v) => { const score = Math.min(4, (v.length >= 8) + (v.length >= 12) + (/[a-z]/.test(v) && /[A-Z]/.test(v)) + (/d/.test(v) && /[^A-Za-z0-9]/.test(v))); strength.className = `meter strength ${score < 2 ? "bad" : score < 3 ? "warn" : ""}`; strength.setAttribute("aria-label", [t("Very weak", "好弱"), t("Weak", "弱"), t("Fair", "一般"), t("Good", "好"), t("Strong", "強")][v ? score : 0]); strength.firstChild.style.setProperty("--w", `${v ? (score + 1) * 20 : 0}%`); };
      const input = h("input", { class: "field", type: "password", autocomplete: "new-password", placeholder: entry.hasValue ? t("Unchanged. Type to replace.", "冇改。打字就會更換。") : t("Not set", "未設定"), minlength: String(entry.minLength ?? 0), maxlength: String(entry.maxLength ?? 256), "aria-label": tt(entry.label), disabled, onInput: (e) => { rate(e.target.value); commit(e.target.value); } });
      rate("");
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
      return { el: h("div", { class: "pwdbox" }, h("div", { class: "pwd" }, input, eye), strength), sync: () => { input.value = dock.value(entry.id) ?? ""; rate(input.value); } };
    }
    default: {
      const custom = controlTypes.get(entry.control);
      if (custom) return custom(entry, current, commit, locked, { entry });
      const counter = entry.maxLength ? h("span", { class: "t2 counter" }, `${String(current()).length}/${entry.maxLength}`) : null;
      const input = h("input", { class: "field", type: "text", maxlength: String(entry.maxLength ?? 256), autocomplete: "off", spellcheck: "false", value: current(), "aria-label": tt(entry.label), placeholder: entry.optional ? t("Optional", "可選") : "", disabled, onInput: (e) => { if (counter) counter.textContent = `${e.target.value.length}/${entry.maxLength}`; commit(e.target.value); } });
      return { el: h("div", { class: "textbox" }, input, counter, entry.hint ? h("div", { class: "t2" }, tt(entry.hint)) : null), sync: () => { input.value = current(); if (counter) counter.textContent = `${String(current()).length}/${entry.maxLength}`; } };
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

// ---- the app's own preferences ------------------------------------------------
// A feature's preferences (a test server, a refresh rate) are saved by this app, not by the router, so they do
// not go through the pending-changes dock: the control saves by itself a moment after the last edit and says so.
// The same rich control draws it, so it looks and works like every router setting.
const SAVE_DELAY_MS = 500;

export function appSettingRow(featureId, entry, onSaved = () => {}) {
  const locked = !app.canWrite;
  let value = String(entry.value ?? "");
  let saved = value;
  let timer = null;
  let attempt = 0;
  const row = h("div", { class: "setting app-setting", id: `s-${entry.id}` });
  const status = h("div", { class: "t2", role: "status", "aria-live": "polite" });
  const help = h("div", { class: "help", hidden: true }, tt(entry.help), h("div", { class: "t2" }, t("Saved by this app. It is never written to the router.", "由呢個程式儲存，唔會寫入路由器。")));
  let ctl;
  const say = (text, bad = false) => {
    status.textContent = text;
    status.classList.toggle("bad", bad);
  };
  async function save() {
    timer = null;
    const mine = (attempt += 1);
    try {
      const answer = await api.put(`/api/x/${featureId}/prefs`, { changes: [{ id: entry.id, value }] });
      if (mine !== attempt) return;
      saved = value;
      say(t("Saved", "已儲存"));
      row.classList.remove("edited");
      onSaved(answer.entries);
    } catch (error) {
      if (mine !== attempt) return;
      say(error.message, true);
      row.classList.add("edited");
    }
  }
  const revert = h("button", { class: "btn t sm", hidden: true, onClick() { value = saved; ctl.sync?.(); clearTimeout(timer); timer = null; row.classList.remove("edited"); revert.hidden = true; say(""); } }, icon("undo", "sm"), t("Undo edit", "取消編輯"));
  ctl = control(entry, () => value, (next) => {
    value = String(next);
    say(t("Saving…", "儲存緊…"));
    row.classList.add("edited");
    revert.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  }, locked);
  const info = h("button", { class: "info", "aria-label": t("What is this?", "呢個係咩？"), "aria-expanded": "false", onClick(e) { help.hidden = !help.hidden; e.currentTarget.setAttribute("aria-expanded", String(!help.hidden)); } }, icon("info", "sm"));
  row.append(
    h("div", { class: "top" },
      h("div", { class: "grow" }, h("div", { class: "t1" }, tt(entry.label), " ", h("span", { class: "tag", title: t("Saved by this app, not on the router.", "由呢個程式儲存，唔係喺路由器。") }, icon("save", "sm"), t("This app", "呢個程式"))), status),
      h("div", { class: "ctl" }, ctl.el, revert, info)),
    help);
  return row;
}

export function appGroupCard(featureId, label, entries, onSaved) {
  if (!entries.length) return null;
  return h("section", { class: "card rise" }, label ? h("h2", { class: "h2" }, tt(label)) : null, entries.map((e) => appSettingRow(featureId, e, onSaved)));
}

// One card per group for a feature's saved preferences.
export function appGroupCards(featureId, entries, onSaved) {
  return settingGroups(entries).map((g) => appGroupCard(featureId, g.label, g.entries, onSaved));
}
