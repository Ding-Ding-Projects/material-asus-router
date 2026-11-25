// A list editor for settings stored as rows of cells ("<a>b>c<d>e>f"). The
// columns come from the entry's `columns`, so one editor serves every table in
// this feature. Rows are stacked field groups, so they fit a 360 px phone.
// Every edit goes to the pending-changes dock through commit(); nothing
// reaches the router until the person reviews and applies it.
// (Each feature folder keeps its own copy; a feature imports only its own files.)
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const MAC = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;
const HOST = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?)*$/;
const ipNum = (ip) => ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);

let devicesLoad = null;
const knownDevices = (api) => (devicesLoad ??= api.get("/api/domain/devices").then((d) => (d.devices ?? []).filter((x) => x.mac)).catch(() => []));
let counter = 0;

// The router's own network and automatic address pool, as the person sees it
// now (pending edits included).
function lanInfo(ctx) {
  const entries = ctx.state.catalog?.entries ?? [];
  const value = (id) => (ctx.dock.has(id) ? ctx.dock.value(id) : entries.find((e) => e.id === id)?.value ?? "");
  const ip = value("lan.ip");
  const mask = value("lan.mask");
  if (!IPV4.test(ip) || !IPV4.test(mask)) return null;
  return { ip, mask: ipNum(mask), net: ipNum(ip) & ipNum(mask) };
}

// A sentence saying what is wrong with a cell, or null.
function problem(ctx, column, value) {
  const { t } = ctx;
  if (value === "") return column.optional ? null : t("Enter a value.", "請輸入內容。");
  switch (column.kind) {
    case "ipv4": {
      if (!IPV4.test(value)) return t("Enter an address such as 198.51.100.20.", "請輸入地址，例如 198.51.100.20。");
      if (column.within === "lan") {
        const lan = lanInfo(ctx);
        if (lan && ((ipNum(value) & lan.mask) >>> 0) !== lan.net >>> 0) return t("This address is outside the home network.", "呢個地址喺屋企網絡範圍之外。");
        if (lan && ipNum(value) === ipNum(lan.ip)) return t("That is the router itself.", "呢個係路由器自己。");
      }
      return null;
    }
    case "mac":
      return MAC.test(value) ? null : t("Enter a MAC address such as AA:BB:CC:DD:EE:FF.", "請輸入 MAC 地址，例如 AA:BB:CC:DD:EE:FF。");
    case "port": {
      const m = value.match(/^(\d{1,5})(?::(\d{1,5}))?$/);
      if (!m || (m[2] && !column.allowRange) || Number(m[1]) < 1 || Number(m[2] ?? m[1]) > 65535 || Number(m[1]) > Number(m[2] ?? m[1])) return t("Enter a port from 1 to 65535.", "請輸入 1 至 65535 嘅端口。");
      return null;
    }
    case "number":
      return /^\d{1,6}$/.test(value) && Number(value) >= (column.min ?? 0) && Number(value) <= (column.max ?? 65535) ? null : t(`Enter a number from ${column.min ?? 0} to ${column.max ?? 65535}.`, `請輸入 ${column.min ?? 0} 至 ${column.max ?? 65535} 嘅數字。`);
    case "select":
      return column.options.some(([v]) => v === value) ? null : t("Choose one of the options.", "請揀其中一個選項。");
    case "hostname":
      return HOST.test(value) ? null : t("Enter a host name such as nas.home.lan.", "請輸入主機名稱，例如 nas.home.lan。");
    default:
      return value.length <= (column.maxLength ?? 32) && !/[\x00-\x1f<>]/.test(value) ? null : t("Use fewer characters and no < or >.", "字數少啲，同唔好用 < 或者 >。");
  }
}

export function tableEditor(entry, current, commit, locked, ctx) {
  const { h, icon, t, tt } = ctx;
  const columns = entry.columns;
  const listId = `dl-${entry.id.replace(/[^a-z0-9]/g, "-")}-${(counter += 1)}`;
  const parse = (text) => (text === "" ? [] : text.split("<").slice(1).map((row) => columns.map((_, j) => row.split(">")[j] ?? "")));
  let rows = parse(String(current()));
  let devices = [];
  const holder = h("div", { class: "edtable" });
  const status = h("div", { class: "edmsg", role: "status", "aria-live": "polite" });
  const datalist = h("datalist", { id: listId });
  const serialize = () => rows.map((r) => `<${r.join(">")}`).join("");
  const bad = (r, j) => problem(ctx, columns[j], r[j]);
  const duplicates = () => {
    const out = new Set();
    columns.forEach((c, j) => {
      if (!c.unique) return;
      const seen = new Set();
      rows.forEach((r, i) => {
        const key = r[j].toLowerCase();
        if (key && seen.has(key)) out.add(`${i}:${j}`);
        seen.add(key);
      });
    });
    return out;
  };
  const validate = () => {
    if (rows.length > (entry.maxItems ?? 64)) return t(`Use at most ${entry.maxItems ?? 64} rows.`, `最多 ${entry.maxItems ?? 64} 行。`);
    if (!rows.length && !entry.optional) return t("Add at least one row.", "請最少加一行。");
    const dup = duplicates();
    const issues = rows.some((r, i) => columns.some((_, j) => bad(r, j) || dup.has(`${i}:${j}`)));
    return issues ? t("Fix the highlighted fields. Nothing is queued until they are all valid.", "請改正標紅嘅欄位。全部正確之前，唔會加入改動。") : "";
  };
  const save = () => {
    const message = validate();
    status.textContent = message;
    if (!message) commit(serialize());
  };
  const mark = (input, r, j) => {
    const issue = bad(r, j) || (duplicates().has(`${rows.indexOf(r)}:${j}`) ? t("Already used in another row.", "另一行已經用咗。") : null);
    input.setAttribute("aria-invalid", String(Boolean(issue)));
    input.title = issue ?? "";
  };
  // Picking a known device fills the empty address and name cells of that row.
  const fillFromDevice = (r) => {
    const at = columns.findIndex((c) => c.kind === "mac");
    const device = devices.find((d) => d.mac.toUpperCase() === r[at]);
    if (!device) return;
    const ipAt = columns.findIndex((c) => c.id === "ip");
    const hostAt = columns.findIndex((c) => c.id === "host");
    let changed = false;
    if (ipAt >= 0 && r[ipAt] === "" && device.ip) {
      r[ipAt] = device.ip;
      changed = true;
    }
    if (hostAt >= 0 && r[hostAt] === "" && device.name) {
      r[hostAt] = String(device.name).replace(/[^A-Za-z0-9.-]/g, "-").slice(0, 32);
      changed = true;
    }
    if (changed) paint();
  };
  const field = (r, j) => {
    const column = columns[j];
    const label = `${tt(entry.label)}: ${tt(column.label)} (${rows.indexOf(r) + 1})`;
    let input;
    if (column.kind === "select") {
      input = h("select", { class: "field", disabled: locked, "aria-label": label, onChange(e) { r[j] = e.target.value; save(); } },
        column.options.map(([v, text]) => h("option", { value: v, selected: v === r[j] }, tt(text))));
    } else {
      input = h("input", {
        class: `field${column.kind === "mac" || column.kind === "ipv4" || column.kind === "port" ? " mono" : ""}`,
        value: r[j], disabled: locked, autocomplete: "off", spellcheck: "false", "aria-label": label,
        placeholder: column.placeholder ?? (column.optional ? t("Optional", "可選") : ""),
        maxlength: String(column.kind === "mac" ? 17 : column.maxLength ?? 64),
        inputmode: column.kind === "ipv4" || column.kind === "port" || column.kind === "number" ? "decimal" : undefined,
        list: column.kind === "mac" ? listId : undefined,
        onInput(e) {
          r[j] = column.kind === "mac" ? e.target.value.toUpperCase() : e.target.value.trim();
          if (column.kind === "mac") fillFromDevice(r);
          mark(e.target, r, j);
          save();
        },
      });
      mark(input, r, j);
    }
    return h("label", { class: "edcell" }, h("span", { class: "edlabel" }, tt(column.label)), input);
  };
  const blank = () => columns.map((c) => (c.kind === "select" ? c.options[0][0] : c.default ?? ""));
  const fillList = () => datalist.replaceChildren(...devices.map((d) => h("option", { value: d.mac.toUpperCase() }, `${d.name ?? ""} ${d.ip ?? ""}`.trim())));
  function paint() {
    holder.replaceChildren(
      ...rows.map((r, i) => h("div", { class: "edrow", role: "group", "aria-label": `${tt(entry.label)} ${i + 1}` },
        columns.map((_, j) => field(r, j)),
        locked ? null : h("button", { class: "btn t icon", type: "button", "aria-label": `${t("Remove row", "移除呢行")} ${i + 1}`, onClick() { rows.splice(i, 1); paint(); save(); } }, icon("delete", "sm")))),
      rows.length ? null : h("div", { class: "t2" }, entry.emptyText ? tt(entry.emptyText) : t("No rows yet.", "未有任何一行。")),
      locked ? null : h("div", { class: "edactions" }, h("button", { class: "btn t sm", type: "button", disabled: rows.length >= (entry.maxItems ?? 64), onClick() { rows.push(blank()); paint(); save(); } }, icon("add", "sm"), t("Add a row", "加一行"))),
    );
    fillList();
  }
  knownDevices(ctx.api).then((list) => { devices = list; fillList(); });
  paint();
  return { el: h("div", { class: "edtable-wrap" }, holder, datalist, status), sync() { rows = parse(String(current())); status.textContent = ""; paint(); } };
}
