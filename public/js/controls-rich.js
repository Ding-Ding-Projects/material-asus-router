// The richer control types: segmented, stepper, port picker, MAC and device
// pickers, IPv4/CIDR picker with a subnet visual, address range bar, chips,
// colour, weekly schedule grid and file drop. Each one is registered with
// registerControl() and has the same server-side check in
// server/router/controls.mjs.
import { api, h, icon, t, tt } from "./core.js";
import { registerControl } from "./control-registry.js";
import { ipv4Field } from "./ipv4-field.js";

const label = (entry) => tt(entry.label);
const ipNum = (ip) => ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);
const ipText = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
const validIp = (s) => /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(s);
const MAC = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/;

// ---- segmented: every option visible at once -------------------------------
registerControl("segmented", (entry, current, commit, locked) => {
  const wrap = h("div", { class: "seg", role: "radiogroup", "aria-label": label(entry) });
  const buttons = entry.options.map(([value, text, about]) =>
    h("button", { role: "radio", disabled: locked, title: about ? tt(about) : undefined, onClick() { commit(value); sync(); } }, tt(text)));
  const sync = () => buttons.forEach((b, i) => { const on = entry.options[i][0] === current(); b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
  wrap.append(...buttons);
  sync();
  return { el: wrap, sync };
});

// ---- stepper: a number with minus and plus buttons --------------------------
registerControl("stepper", (entry, current, commit, locked) => {
  const input = h("input", { class: "field num", type: "number", min: String(entry.min), max: String(entry.max), step: String(entry.step ?? 1), inputmode: "numeric", value: current(), "aria-label": label(entry), disabled: locked, onInput: (e) => commit(e.target.value) });
  const bump = (direction) => {
    const next = Math.min(entry.max, Math.max(entry.min, (Number(input.value) || entry.min) + direction * (entry.step ?? 1)));
    input.value = String(next);
    commit(String(next));
  };
  const button = (name, direction, text) => h("button", { class: "btn t icon", type: "button", "aria-label": text, disabled: locked, onClick: () => bump(direction) }, icon(name, "sm"));
  return {
    el: h("div", { class: "ctl stepper" }, button("remove", -1, t("Less", "減少")), input, button("add", 1, t("More", "增加")), entry.unit ? h("span", { class: "muted" }, entry.unit) : null),
    sync: () => (input.value = current()),
  };
});

// ---- port: a number plus the usual choices -----------------------------------
registerControl("port", (entry, current, commit, locked) => {
  const input = h("input", { class: "field num", inputmode: "numeric", autocomplete: "off", maxlength: entry.allowRange ? "11" : "5", value: current(), "aria-label": label(entry), placeholder: entry.optional ? t("Optional", "可選") : "", disabled: locked, onInput: (e) => commit(e.target.value.replace(entry.allowRange ? /[^\d:]/g : /\D/g, "")) });
  const presets = (entry.presets ?? []).map(([port, text]) => h("button", { class: "chip", type: "button", disabled: locked, title: tt(text), onClick() { input.value = String(port); commit(String(port)); } }, String(port), " ", h("span", { class: "muted" }, tt(text))));
  return { el: h("div", { class: "portpick" }, input, presets.length ? h("div", { class: "chips" }, presets) : null), sync: () => (input.value = current()) };
});

// ---- mac and device: a MAC address, or one picked from the known devices ------
let devicesLoad = null;
const knownDevices = () => (devicesLoad ??= api.get("/api/domain/devices").then((d) => d.devices ?? []).catch(() => []));

function macPicker(entry, current, commit, locked) {
  const input = h("input", { class: "field mac", autocomplete: "off", spellcheck: "false", maxlength: "17", value: current(), "aria-label": label(entry), placeholder: "AA:BB:CC:DD:EE:FF", disabled: locked,
    onInput(e) {
      const hex = e.target.value.replace(/[^0-9a-fA-F]/g, "").toUpperCase().slice(0, 12);
      e.target.value = hex.match(/.{1,2}/g)?.join(":") ?? "";
      state();
      commit(e.target.value);
    } });
  const state = () => { input.setAttribute("aria-invalid", String(input.value !== "" && !MAC.test(input.value))); };
  const pick = h("select", { class: "field", "aria-label": t("Choose a known device", "揀一部已知裝置"), disabled: locked, onChange(e) { input.value = e.target.value; state(); commit(e.target.value); e.target.value = ""; } }, h("option", { value: "" }, t("Pick a device…", "揀裝置…")));
  knownDevices().then((list) => pick.append(...list.map((d) => h("option", { value: d.mac }, `${d.name} · ${d.mac}`))));
  state();
  return { el: h("div", { class: "macpick" }, input, pick), sync: () => { input.value = current(); state(); } };
}
registerControl("mac", (entry, current, commit, locked) => macPicker(entry, current, commit, locked));
registerControl("device", (entry, current, commit, locked) => macPicker(entry, current, commit, locked));

// ---- cidr: an address and a prefix, with the size of the network drawn -----------
registerControl("cidr", (entry, current, commit, locked) => {
  const [address = "", prefix = "24"] = String(current()).split("/");
  let ip = address;
  let bits = prefix === "" ? "24" : prefix;
  const lo = entry.minPrefix ?? 8;
  const hi = entry.maxPrefix ?? 32;
  const out = h("div", { class: "subnet muted" });
  const bar = h("div", { class: "meter" }, h("i"));
  const draw = () => {
    const n = Number(bits);
    if (!validIp(ip)) { out.textContent = t("Enter a full address.", "請輸入完整地址。"); bar.firstChild.style.setProperty("--w", "0%"); return; }
    const size = 2 ** (32 - n);
    const start = ipNum(ip) - (ipNum(ip) % size);
    out.textContent = `${ipText(start)} – ${ipText(start + size - 1)} · ${size.toLocaleString()} ${t("addresses", "個地址")}`;
    bar.firstChild.style.setProperty("--w", `${Math.max(2, ((32 - n) / 24) * 100)}%`);
  };
  const emit = () => { draw(); commit(ip === "" && entry.optional ? "" : `${ip}/${bits}`); };
  const field = ipv4Field(ip, (v) => { ip = v; emit(); }, locked);
  const select = h("select", { class: "field prefix", "aria-label": t("Network size (prefix)", "網絡大小（前綴）"), disabled: locked, onChange: (e) => { bits = e.target.value; emit(); } },
    Array.from({ length: hi - lo + 1 }, (_, i) => hi - i).map((n) => h("option", { value: String(n), selected: String(n) === bits }, `/${n}`)));
  draw();
  return { el: h("div", { class: "cidr" }, h("div", { class: "ctl" }, field.el, h("span", {}, "/"), select), bar, out), sync() { const [a = "", p = "24"] = String(current()).split("/"); ip = a; bits = p; field.set(a); select.value = p; draw(); } };
});

// ---- range: first and last address, drawn over the network ---------------------------
registerControl("range", (entry, current, commit, locked) => {
  let [first = "", last = ""] = String(current()).split("-");
  const base = entry.within ?? "198.51.100.0/24";
  const [baseIp, basePrefix] = base.split("/");
  const size = 2 ** (32 - Number(basePrefix));
  const start = ipNum(baseIp) - (ipNum(baseIp) % size);
  const track = h("div", { class: "rangebar", role: "img", "aria-label": t("Where the range sits in the network", "範圍喺網絡入面嘅位置") }, h("i"));
  const text = h("div", { class: "muted" });
  const draw = () => {
    const ok = validIp(first) && validIp(last) && ipNum(first) <= ipNum(last);
    const bit = track.firstChild.style;
    if (ok) {
      const a = Math.min(Math.max((ipNum(first) - start) / size, 0), 1);
      const b = Math.min(Math.max((ipNum(last) - start + 1) / size, 0), 1);
      bit.setProperty("--l", `${(a * 100).toFixed(1)}%`);
      bit.setProperty("--w", `${Math.max((b - a) * 100, 1).toFixed(1)}%`);
      text.textContent = `${(ipNum(last) - ipNum(first) + 1).toLocaleString()} ${t("addresses", "個地址")}`;
    } else {
      bit.setProperty("--w", "0%");
      text.textContent = first || last ? t("The first address must come before the last.", "第一個地址要喺最後一個之前。") : "";
    }
  };
  const emit = () => { draw(); commit(first === "" && last === "" && entry.optional ? "" : `${first}-${last}`); };
  const a = ipv4Field(first, (v) => { first = v; emit(); }, locked);
  const b = ipv4Field(last, (v) => { last = v; emit(); }, locked);
  draw();
  return { el: h("div", { class: "rangepick" }, h("div", { class: "ctl" }, a.el, h("span", {}, "–"), b.el), track, text), sync() { [first = "", last = ""] = String(current()).split("-"); a.set(first); b.set(last); draw(); } };
});

// ---- chips: a list of short items ------------------------------------------------------
registerControl("chips", (entry, current, commit, locked) => {
  const delimiter = entry.delimiter ?? ",";
  const items = () => (current() === "" ? [] : String(current()).split(delimiter));
  const holder = h("div", { class: "chips" });
  const write = (list) => { commit(list.join(delimiter)); draw(); };
  const add = (value) => { const v = value.trim(); if (v && !items().includes(v) && items().length < (entry.maxItems ?? 20)) write([...items(), v]); };
  const input = entry.options ? null : h("input", { class: "field", autocomplete: "off", maxlength: "32", disabled: locked, placeholder: t("Add and press Enter", "輸入後撳 Enter"), "aria-label": label(entry), onKeydown(e) { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(e.target.value); e.target.value = ""; } } });
  const menu = entry.options ? h("select", { class: "field", disabled: locked, "aria-label": label(entry), onChange(e) { add(e.target.value); e.target.value = ""; } }, h("option", { value: "" }, t("Add…", "加入…")), entry.options.map(([v, text]) => h("option", { value: v }, tt(text)))) : null;
  const draw = () => holder.replaceChildren(...items().map((item) => h("span", { class: "chip on" }, entry.options ? tt(entry.options.find(([v]) => v === item)?.[1] ?? { en: item, yue: item }) : item,
    locked ? null : h("button", { class: "x", type: "button", "aria-label": `${t("Remove", "移除")} ${item}`, onClick: () => write(items().filter((x) => x !== item)) }, icon("close", "sm")))));
  draw();
  return { el: h("div", { class: "chiplist" }, holder, input, menu), sync: draw };
});

// ---- color ---------------------------------------------------------------------------------
registerControl("color", (entry, current, commit, locked) => {
  const valid = (v) => /^#[0-9a-fA-F]{6}$/.test(v);
  const swatch = h("input", { type: "color", class: "swatch", value: valid(current()) ? current() : "#4f5bd5", disabled: locked, "aria-label": label(entry), onInput(e) { text.value = e.target.value; commit(e.target.value); } });
  const text = h("input", { class: "field mono hex", maxlength: "7", spellcheck: "false", value: current(), disabled: locked, "aria-label": `${label(entry)} (hex)`, onInput(e) { if (valid(e.target.value)) swatch.value = e.target.value; commit(e.target.value); } });
  return { el: h("div", { class: "ctl" }, swatch, text), sync() { text.value = current(); if (valid(current())) swatch.value = current(); } };
});

// ---- schedule: a week of time cells you click or drag across -----------------------------------
// Value: slots like "12345@08:00-17:00,06@10:00-12:00" (days 0 = Sunday to 6).
const DAYS = [["Sun", "日"], ["Mon", "一"], ["Tue", "二"], ["Wed", "三"], ["Thu", "四"], ["Fri", "五"], ["Sat", "六"]];
const hhmm = (min) => (min >= 1440 ? "23:59" : `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`);
const toMin = (text) => { const [a, b] = text.split(":").map(Number); return text === "23:59" ? 1440 : a * 60 + b; };

registerControl("schedule", (entry, current, commit, locked) => {
  const step = entry.step ?? 60;
  const cols = 1440 / step;
  const grid = Array.from({ length: 7 }, () => new Array(cols).fill(false));
  const load = () => {
    for (const row of grid) row.fill(false);
    for (const slot of String(current()).split(",").filter(Boolean)) {
      const m = slot.match(/^([0-6]+)@(\d\d:\d\d)-(\d\d:\d\d)$/);
      if (!m) continue;
      for (const d of m[1]) for (let c = Math.floor(toMin(m[2]) / step); c < Math.ceil(toMin(m[3]) / step); c += 1) grid[Number(d)][c] = true;
    }
  };
  const encode = () => {
    const byRange = new Map();
    grid.forEach((row, day) => {
      for (let c = 0; c < cols; c += 1) {
        if (!row[c]) continue;
        let end = c;
        while (end + 1 < cols && row[end + 1]) end += 1;
        const key = `${hhmm(c * step)}-${hhmm((end + 1) * step)}`;
        byRange.set(key, [...(byRange.get(key) ?? []), day]);
        c = end;
      }
    });
    return [...byRange].map(([range, days]) => `${days.join("")}@${range}`).join(",");
  };
  let painting = null;
  const cells = [];
  const paint = (day, c, on) => { grid[day][c] = on; cells[day][c].classList.toggle("on", on); cells[day][c].setAttribute("aria-pressed", String(on)); };
  const finish = () => { if (painting !== null) { painting = null; commit(encode()); summary(); } };
  const summary = () => { text.textContent = `${grid.flat().filter(Boolean).length * step / 60} ${t("hours a week", "個鐘一個星期")}`; };
  const text = h("div", { class: "muted" });
  const table = h("div", { class: "schedule", role: "group", "aria-label": label(entry) });
  table.style.setProperty("--cols", String(cols));
  DAYS.forEach(([en, yue], day) => {
    cells[day] = [];
    table.append(h("span", { class: "dayname" }, t(en, yue)));
    for (let c = 0; c < cols; c += 1) {
      const cell = h("button", { type: "button", class: "slot", disabled: locked, "aria-pressed": "false", "aria-label": `${en} ${hhmm(c * step)}`, title: `${en} ${hhmm(c * step)}`,
        onPointerdown(e) { e.preventDefault(); painting = !grid[day][c]; paint(day, c, painting); },
        onPointerenter(e) { if (painting !== null && e.buttons) paint(day, c, painting); },
        onKeydown(e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); paint(day, c, !grid[day][c]); painting = null; commit(encode()); summary(); } } });
      cells[day].push(cell);
      table.append(cell);
    }
  });
  table.addEventListener("pointerup", finish);
  table.addEventListener("pointerleave", finish);
  const redraw = () => { load(); grid.forEach((row, d) => row.forEach((on, c) => paint(d, c, on))); summary(); };
  redraw();
  const clearButton = h("button", { class: "btn t sm", type: "button", disabled: locked, onClick() { grid.forEach((row, d) => row.forEach((_, c) => paint(d, c, false))); commit(entry.optional ? "" : encode()); summary(); } }, icon("backspace", "sm"), t("Clear", "清除"));
  return { el: h("div", { class: "schedulepick" }, table, h("div", { class: "ctl" }, text, clearButton)), sync: redraw };
});

// ---- file: drop a file or choose one ---------------------------------------------------------------------
registerControl("file", (entry, current, commit, locked) => {
  const note = h("div", { class: "muted" }, current() ? t("A file is set.", "已經有檔案。") : t("No file chosen.", "未揀檔案。"));
  const take = async (file) => {
    if (!file) return;
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      let text = entry.encoding === "base64" ? btoa(String.fromCharCode(...buffer)) : new TextDecoder().decode(buffer);
      text = text.replace(/[\r\n]+/g, " ").trim();
      if (text.length > (entry.maxLength ?? 8192)) throw new Error(t(`That file is too large. The limit is ${entry.maxLength ?? 8192} characters.`, `檔案太大，上限係 ${entry.maxLength ?? 8192} 個字元。`));
      commit(text);
      note.textContent = `${file.name} · ${file.size} B`;
    } catch (e) {
      note.textContent = e.message;
    }
  };
  const input = h("input", { type: "file", class: "sr", accept: entry.accept, disabled: locked, "aria-label": label(entry), onChange: (e) => take(e.target.files[0]) });
  const zone = h("label", { class: "drop", onDragover(e) { e.preventDefault(); zone.classList.add("over"); }, onDragleave: () => zone.classList.remove("over"), onDrop(e) { e.preventDefault(); zone.classList.remove("over"); if (!locked) take(e.dataTransfer.files[0]); } }, icon("upload_file"), h("span", {}, t("Drop a file here or choose one", "拖放檔案到呢度，或者揀檔案")), input);
  return { el: h("div", { class: "filepick" }, zone, note), sync: () => (note.textContent = current() ? t("A file is set.", "已經有檔案。") : t("No file chosen.", "未揀檔案。")) };
});
