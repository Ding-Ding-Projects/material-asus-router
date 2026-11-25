// The typed controls on an action card. Every parameter is a real control for
// its kind of value (a choice, a number, a host name, a MAC address, a cron
// piece, a public key) with its own check, never a bare box for anything.
// Everything arrives in ctx; this file imports nothing.

const HOST = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?)*$/;
const MAC = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;
const CRON_PART = "(?:\\*|\\d{1,2}(?:-\\d{1,2})?)(?:/\\d{1,2})?";
const CRON = new RegExp(`^${CRON_PART}(?:,${CRON_PART}){0,11}$`);
const KEY = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(?:256|384|521)|sk-ssh-ed25519@openssh\.com) [A-Za-z0-9+/=]{20,1500}( [A-Za-z0-9@._-]{1,64})?$/;

export const formatMac = (text) => {
  const hex = String(text).replace(/[^0-9A-Fa-f]/g, "").slice(0, 12).toUpperCase();
  return hex.match(/.{1,2}/g)?.join(":") ?? "";
};

// Says what is wrong with a value, or "" when it is fine.
export function problemWith(def, value, t) {
  const v = String(value ?? "");
  if (!v) return def.required ? t("Choose or enter a value.", "請揀或者輸入一個值。") : "";
  switch (def.type) {
    case "number": {
      const n = Number(v);
      return Number.isInteger(n) && n >= def.min && n <= def.max ? "" : t(`Use a whole number from ${def.min} to ${def.max}.`, `請用 ${def.min} 至 ${def.max} 嘅整數。`);
    }
    case "host": return HOST.test(v) || /^(\d{1,3}\.){3}\d{1,3}$/.test(v) ? "" : t("Enter a host name or an IPv4 address.", "請輸入主機名稱或者 IPv4 地址。");
    case "mac": return MAC.test(v) ? "" : t("Use the form AA:BB:CC:DD:EE:FF.", "請用 AA:BB:CC:DD:EE:FF 格式。");
    case "name": return new RegExp(def.pattern).test(v) ? "" : t("Use letters, digits, dashes and underscores.", "只可以用字母、數字、減號同底線。");
    case "cronfield": return CRON.test(v) ? "" : t("Use *, a number, a range such as 1-5, a step such as */10, or a list.", "可以用 *、數字、範圍（如 1-5）、間隔（如 */10）或者清單。");
    case "pubkey": return KEY.test(v.trim().replace(/\s+/g, " ")) ? "" : t("This is not a public SSH key. It starts with ssh-ed25519 or ssh-rsa.", "呢個唔係 SSH 公開金鑰，應該以 ssh-ed25519 或 ssh-rsa 開頭。");
    default: return "";
  }
}

// Returns { el, get(), set(value), setOptions(list), problem() }.
export function buildControl(ctx, def, { value, options, onChange }) {
  const { h, icon, t, tt } = ctx;
  let current = value ?? def.default ?? "";
  let choices = options ?? (def.options ?? []).map((o) => [o.value, o.label]);
  const hint = h("div", { class: "t2 sa-hint", role: "status" });
  const wrap = h("div", { class: "sa-param" });
  const label = h("label", { class: "k sa-plabel" }, tt(def.label), def.unit ? ` (${def.unit})` : "");
  const body = h("div", { class: "sa-pbody" });
  wrap.append(label, body, hint);
  const update = (next, fromUser = true) => {
    current = next;
    const bad = problemWith(def, current, t);
    hint.textContent = bad;
    hint.classList.toggle("sa-bad", Boolean(bad));
    if (fromUser) onChange?.(current);
  };
  const id = `sa-${def.id}-${Math.random().toString(36).slice(2, 7)}`;
  label.setAttribute("for", id);
  let sync = () => {};
  const text = (el) => (typeof el === "string" ? el : tt(el));

  const drawChoice = () => {
    body.replaceChildren();
    if (!choices.length) {
      body.append(h("div", { class: "note warn" }, icon("info"), h("div", {}, t("Nothing to choose from on the router right now.", "路由器而家冇嘢可以揀。"))));
      sync = () => {};
      return;
    }
    if (choices.length <= 4 && def.type !== "select-menu") {
      const seg = h("div", { class: "seg sa-seg", role: "radiogroup", "aria-labelledby": id, id });
      const draw = () => seg.replaceChildren(...choices.map(([v, l]) => h("button", { type: "button", role: "radio", class: String(current) === String(v) ? "on" : "", "aria-checked": String(String(current) === String(v)), onClick: () => (update(String(v)), draw()) }, text(l))));
      draw();
      sync = draw;
      body.append(seg);
    } else {
      const select = h("select", { class: "field sa-select", id }, choices.map(([v, l]) => h("option", { value: String(v), selected: String(current) === String(v) }, text(l))));
      select.addEventListener("change", () => update(select.value));
      sync = () => (select.value = String(current));
      body.append(select);
    }
    if (!choices.some(([v]) => String(v) === String(current))) update(String(choices[0][0]), true);
  };

  if (def.type === "select" || def.type === "segmented") drawChoice();
  else if (def.type === "number") {
    const input = h("input", { class: "field num", id, type: "number", inputmode: "numeric", min: String(def.min), max: String(def.max), step: "1", value: String(current) });
    const step = (d) => { const n = Math.min(def.max, Math.max(def.min, (Number(input.value) || def.min) + d)); input.value = String(n); update(String(n)); };
    input.addEventListener("input", () => update(input.value));
    body.append(h("div", { class: "sa-stepper" },
      h("button", { type: "button", class: "btn t icon", "aria-label": t("Less", "減少"), onClick: () => step(-1) }, icon("remove", "sm")), input,
      h("button", { type: "button", class: "btn t icon", "aria-label": t("More", "增加"), onClick: () => step(1) }, icon("add", "sm"))));
    sync = () => (input.value = String(current));
  } else if (def.type === "host" || def.type === "name" || def.type === "mac" || def.type === "cronfield") {
    const listId = `${id}-list`;
    const input = h("input", { class: `field ${def.type === "mac" ? "mono" : ""}`, id, type: "text", autocomplete: "off", spellcheck: "false", value: String(current), maxlength: def.type === "mac" ? "17" : "253", list: def.presets?.length ? listId : null, placeholder: def.type === "mac" ? "AA:BB:CC:DD:EE:FF" : "" });
    input.addEventListener("input", () => {
      if (def.type === "mac") input.value = formatMac(input.value);
      update(input.value.trim());
    });
    body.append(input);
    if (def.presets?.length) body.append(h("datalist", { id: listId }, def.presets.map((p) => h("option", { value: p }))));
    if (def.type === "cronfield") body.append(h("div", { class: "sa-chips" }, ["*", "0", "*/5", "*/15", "1-5"].map((p) => h("button", { type: "button", class: "btn t sm", onClick: () => { input.value = p; update(p); } }, p))));
    sync = () => (input.value = String(current));
  } else if (def.type === "pubkey") {
    const area = h("textarea", { class: "field sa-key mono", id, rows: "3", spellcheck: "false", autocomplete: "off", placeholder: "ssh-ed25519 AAAA…" });
    area.addEventListener("input", () => update(area.value.trim()));
    const file = h("input", { type: "file", hidden: true, accept: ".pub,text/plain", onChange: async (e) => { const f = e.target.files?.[0]; if (f && f.size < 4096) { area.value = (await f.text()).split("\n")[0].trim(); update(area.value); } } });
    body.append(area, file, h("div", { class: "actions sa-left" }, h("button", { type: "button", class: "btn t sm", onClick: () => file.click() }, icon("upload_file", "sm"), t("Choose a .pub file", "揀 .pub 檔"))));
    sync = () => (area.value = String(current));
  }
  update(current, false);
  hint.textContent = "";
  return {
    el: wrap,
    get: () => (def.type === "number" && current !== "" ? Number(current) : current),
    set(next) { current = next; sync(); },
    setOptions(list) { choices = list; drawChoice(); },
    problem: () => problemWith(def, current, t),
    show: () => update(current, false),
  };
}
