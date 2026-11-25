// The same value rules the server applies to each control type, written for
// the browser so a guided form, a quick-add box and a playground tell a person
// what is wrong before anything is sent. tests/features/guided-forms.test.mjs
// proves these agree with the server on every catalogue entry. No imports.

const OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);
const TIME = "([01]\\d|2[0-3]):[0-5]\\d";
const SLOT = new RegExp(`^([0-6]+)@(${TIME})-(${TIME})$`);
const ipNum = (ip) => ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);
const minutes = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const bad = (en, yue) => ({ ok: false, reason: { en, yue } });
const good = (value) => ({ ok: true, value });

// A cell of a list setting stored as "<a>b>c<d>e>f", checked by its column kind.
function tableCell(column, text) {
  if (text === "") return !!column.optional;
  switch (column.kind ?? column.cell) {
    case "ipv4": return IPV4.test(text);
    case "ipv6": return validIpv6(text);
    case "switch": return text === "0" || text === "1";
    case "kbps": return /^\d{1,9}$/.test(text) && Number(text) >= (column.min ?? 0) && Number(text) <= (column.max ?? 10000000);
    case "device": return IPV4.test(text) || /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(text.toUpperCase());
    case "mac": return /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(text.toUpperCase());
    case "port": {
      const m = text.match(/^(\d{1,5})(?::(\d{1,5}))?$/);
      return !!m && !(m[2] && !column.allowRange) && Number(m[1]) >= 1 && Number(m[2] ?? m[1]) <= 65535 && Number(m[1]) <= Number(m[2] ?? m[1]);
    }
    case "number": return /^\d{1,6}$/.test(text) && Number(text) >= (column.min ?? 0) && Number(text) <= (column.max ?? 65535);
    case "select": return column.options.some(([v]) => v === text);
    case "hostname": return /^(?=.{1,253}$)[A-Za-z0-9]([A-Za-z0-9-]{0,62}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,62}[A-Za-z0-9])?)*$/.test(text);
    default: return text.length <= (column.maxLength ?? column.max ?? 32) && !/[\x00-\x1f<>]/.test(text) && (!column.pattern || new RegExp(column.pattern).test(text));
  }
}

// An IPv6 address, with an optional /prefix.
function validIpv6(text) {
  const m = text.match(/^([0-9A-Fa-f:]+)(?:\/(\d{1,3}))?$/);
  if (!m || (m[2] !== undefined && Number(m[2]) > 128)) return false;
  const a = m[1];
  if (!a.includes(":") || a.includes(":::")) return false;
  const group = (g) => /^[0-9A-Fa-f]{1,4}$/.test(g);
  const halves = a.split("::");
  if (halves.length > 2) return false;
  if (halves.length === 1) return a.split(":").length === 8 && a.split(":").every(group);
  const parts = halves.flatMap((h) => (h === "" ? [] : h.split(":")));
  return parts.length <= 7 && parts.every(group);
}

// The parental controls' per-device lists: one item per device, joined with ">".
const MAC = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/;
const HHMM = /^([01]\d|2[0-3])[0-5]\d$/;
function slotOk(text) {
  const m = text.match(/^W([0-9A-F]{3})(\d{4})(\d{4})$/);
  if (!m) return false;
  const mask = parseInt(m[1], 16);
  return mask >= 1 && mask <= 127 && HHMM.test(m[2]) && HHMM.test(m[3]) && m[2] !== m[3];
}
const COLUMN_ITEM = {
  mac: (v) => MAC.test(v.toUpperCase()),
  mode: (v) => ["0", "1", "2"].includes(v),
  name: (v) => v.length <= 32 && !/[\x00-\x1f<>]/.test(v),
  daytime: (v) => v === "" || (v.split("<").length <= 8 && v.split("<").every(slotOk)),
};

// The router-specific list controls whose values are not plain tables.
function validateListControl(entry, text) {
  switch (entry.control) {
    case "column-list": {
      const check = COLUMN_ITEM[entry.item];
      const items = text.split(">");
      const ok = !!check && items.length <= 64 && items.every(check) && (entry.item !== "mac" || new Set(items.map((i) => i.toUpperCase())).size === items.length);
      return ok ? good(text) : bad("Use one item per device joined with >, each in the form this list expects.", "每部裝置一項，用 > 連住，每項要符合呢個列表嘅格式。");
    }
    case "wifi-maclist": {
      const items = text.split("<").map((i) => i.trim().toUpperCase()).filter(Boolean);
      const ok = text.startsWith("<") && items.length >= 1 && items.length <= 64 && items.every((i) => MAC.test(i)) && new Set(items).size === items.length;
      return ok ? good(text) : bad("Start with < before each address, for example <AA:BB:CC:DD:EE:FF.", "每個地址前面加 <，例如 <AA:BB:CC:DD:EE:FF。");
    }
    case "priority-order": {
      const groups = text.split("<").map((g) => (g === "" ? null : g.split(",")));
      const ids = groups.flatMap((g) => g ?? []);
      const ok = groups.length <= 8 && groups.every((g) => g && g.every((id) => /^\d{1,2}$/.test(id) && Number(id) <= 63)) && new Set(ids).size === ids.length;
      return ok ? good(text) : bad("Use up to 8 groups joined with <, each a list of category numbers joined with commas, none repeated.", "最多 8 組，用 < 連住，每組係用逗號分隔嘅類別號碼，唔可以重複。");
    }
    case "ipv6addr":
      return validIpv6(text) ? good(text) : bad("Enter an IPv6 address such as 2001:db8::1.", "輸入 IPv6 地址，例如 2001:db8::1。");
    case "hexpart":
      return /^[0-9A-Fa-f]{1,4}$/.test(text) ? good(text.toLowerCase()) : bad("Enter one to four hexadecimal digits, such as 1000.", "輸入一至四個十六進制數字，例如 1000。");
    case "deviceip":
      return IPV4.test(text) ? good(text) : bad("Enter an address such as 198.51.100.20.", "輸入地址，例如 198.51.100.20。");
    default:
      return null;
  }
}

function validateTable(entry, text) {
  const wrong = bad("Use rows written like <a>b>c, with every column filled in as its label asks.", "用 <a>b>c 呢種寫法嘅行，每一欄都要照標籤填好。");
  if (!text.startsWith("<")) return wrong;
  const rows = text.slice(1).split("<");
  if (rows.length > (entry.maxItems ?? 64)) return bad(`Use at most ${entry.maxItems ?? 64} rows.`, `最多用 ${entry.maxItems ?? 64} 行。`);
  for (const row of rows) {
    const cells = row.split(">");
    if (cells.length !== entry.columns.length || !entry.columns.every((c, j) => tableCell(c, cells[j]))) return wrong;
  }
  return good(text);
}

export function validateValue(entry, raw) {
  const text = String(raw ?? "");
  const type = entry.control;
  if (entry.optional && text === "" && !["switch", "select", "segmented"].includes(type)) return good("");
  const listResult = validateListControl(entry, text);
  if (listResult) return listResult;
  if (type === "rule-table" && text === "") return good("");
  if (Array.isArray(entry.columns)) return text === "" ? bad("Add at least one row.", "至少加一行。") : validateTable(entry, text);
  switch (type) {
    case "switch":
      return text === entry.values.on || text === entry.values.off ? good(text) : bad("Choose on or off.", "揀開或者關。");
    case "select":
    case "segmented":
      return entry.options.some(([v]) => v === text) ? good(text) : bad("Choose one of the listed options.", "揀其中一個選項。");
    case "number":
    case "slider":
    case "stepper": {
      const n = Number(text);
      return text !== "" && Number.isInteger(n) && n >= entry.min && n <= entry.max ? good(String(n)) : bad(`Enter a whole number from ${entry.min} to ${entry.max}${entry.unit ? ` ${entry.unit}` : ""}.`, `輸入 ${entry.min} 至 ${entry.max} 嘅整數${entry.unit ? `（${entry.unit}）` : ""}。`);
    }
    case "ipv4":
      return IPV4.test(text) ? good(text) : bad("Enter an address such as 198.51.100.20.", "輸入地址，例如 198.51.100.20。");
    case "cidr": {
      const m = text.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
      const prefix = m ? Number(m[2]) : -1;
      if (!m || !IPV4.test(m[1]) || prefix < (entry.minPrefix ?? 0) || prefix > (entry.maxPrefix ?? 32)) return bad(`Enter an address with a prefix such as 198.51.100.0/24 (prefix ${entry.minPrefix ?? 0} to ${entry.maxPrefix ?? 32}).`, `輸入帶前綴嘅地址，例如 198.51.100.0/24（前綴 ${entry.minPrefix ?? 0} 至 ${entry.maxPrefix ?? 32}）。`);
      if (entry.network && (prefix === 32 ? 0 : ipNum(m[1]) & (2 ** (32 - prefix) - 1)) !== 0) return bad("The address must be the first address of its network.", "地址要係網絡嘅第一個地址。");
      return good(text);
    }
    case "range": {
      const parts = text.split("-");
      if (parts.length !== 2 || !parts.every((p) => IPV4.test(p))) return bad("Enter two addresses with a dash, such as 198.51.100.50-198.51.100.99.", "輸入兩個用橫線連住嘅地址，例如 198.51.100.50-198.51.100.99。");
      const [lo, hi] = parts.map(ipNum);
      if (lo > hi) return bad("The first address must not be after the last.", "第一個地址唔可以喺最後一個之後。");
      if (entry.within) {
        const [base, prefix] = entry.within.split("/");
        const size = 2 ** (32 - Number(prefix));
        const start = ipNum(base) - (ipNum(base) % size);
        if (lo < start || hi >= start + size) return bad(`Both addresses must be inside ${entry.within}.`, `兩個地址都要喺 ${entry.within} 入面。`);
      }
      return good(text);
    }
    case "port": {
      const single = /^\d{1,5}$/.test(text);
      const r = entry.allowRange ? text.match(/^(\d{1,5}):(\d{1,5})$/) : null;
      const [lo, hi] = single ? [Number(text), Number(text)] : r ? [Number(r[1]), Number(r[2])] : [0, 0];
      const min = entry.min ?? 1;
      const max = entry.max ?? 65535;
      return (single || r) && lo >= min && hi <= max && lo <= hi ? good(text) : bad(`Enter a port from ${min} to ${max}${entry.allowRange ? ", or a range such as 8000:8010" : ""}.`, `輸入 ${min} 至 ${max} 嘅端口${entry.allowRange ? "，或者範圍例如 8000:8010" : ""}。`);
    }
    case "mac":
    case "device":
      return /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(text.toUpperCase()) ? good(text.toUpperCase()) : bad("Enter a MAC address such as AA:BB:CC:DD:EE:FF.", "輸入 MAC 地址，例如 AA:BB:CC:DD:EE:FF。");
    case "hostname":
      return /^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(text) ? good(text) : bad("Enter a host name such as pool.example.test.", "輸入主機名稱，例如 pool.example.test。");
    case "schedule": {
      const slots = text.split(",");
      if (!text || slots.length > 28) return bad("Enter 1 to 28 time slots such as 12345@08:00-17:00.", "輸入 1 至 28 個時段，例如 12345@08:00-17:00。");
      for (const slot of slots) {
        const m = slot.match(SLOT);
        if (!m) return bad(`"${slot}" is not a time slot. Use days 0 to 6, @, then a time range.`, `「${slot}」唔係時段。用 0 至 6 嘅日子、@、再加時間範圍。`);
        if (new Set(m[1]).size !== m[1].length) return bad(`"${slot}" repeats a day.`, `「${slot}」重複咗日子。`);
        if (minutes(m[2]) >= minutes(m[4])) return bad(`"${slot}" must end after it starts.`, `「${slot}」要喺開始之後結束。`);
      }
      return good(text);
    }
    case "chips": {
      const items = text === "" ? [] : text.split(entry.delimiter ?? ",");
      if (!items.length) return bad("Add at least one item.", "至少加一項。");
      if (items.length > (entry.maxItems ?? 20)) return bad(`Use at most ${entry.maxItems ?? 20} items.`, `最多用 ${entry.maxItems ?? 20} 項。`);
      if (new Set(items).size !== items.length) return bad("Remove the repeated item.", "移除重複嘅項目。");
      const allowed = entry.options ? new Set(entry.options.map(([v]) => v)) : null;
      const pattern = entry.pattern ? new RegExp(entry.pattern) : /^[A-Za-z0-9._-]{1,32}$/;
      const wrong = items.find((i) => (allowed ? !allowed.has(i) : !pattern.test(i)));
      return wrong === undefined ? good(text) : bad(`"${wrong}" is not an allowed item.`, `「${wrong}」唔係容許嘅項目。`);
    }
    case "weekdays":
      return /^[01]{7}$/.test(text) ? good(text) : bad("Choose the days, Sunday first, as seven 0 or 1 flags such as 0111110.", "揀日子，星期日喺最前，寫成七個 0 或 1，例如 0111110。");
    case "timerange": {
      const clock = (s) => (Number(s.slice(0, 2)) < 24 && Number(s.slice(2)) < 60 ? Number(s.slice(0, 2)) * 60 + Number(s.slice(2)) : null);
      const ok = /^\d{8}$/.test(text) && clock(text.slice(0, 4)) !== null && clock(text.slice(4)) !== null && clock(text.slice(0, 4)) < clock(text.slice(4));
      return ok ? good(text) : bad("Enter a start and an end time as HHMMHHMM, with the start first, such as 08001700.", "輸入開始同結束時間，寫成 HHMMHHMM，開始要喺前，例如 08001700。");
    }
    case "color":
      return /^#[0-9a-fA-F]{6}$/.test(text) ? good(text.toLowerCase()) : bad("Choose a colour written like #3366cc.", "揀個顏色，寫法例如 #3366cc。");
    case "file": {
      const max = entry.maxLength ?? 8192;
      if (!text || text.length > max) return bad(`The content must be 1 to ${max} characters.`, `內容要 1 至 ${max} 個字元。`);
      if (/[\x00-\x1f]/.test(text)) return bad("No line breaks or control characters.", "唔可以有換行或者控制字元。");
      if (entry.encoding === "base64" && !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return bad("That is not valid base64.", "唔係有效嘅 base64。");
      return good(text);
    }
    default: {
      const min = entry.minLength ?? 0;
      const max = entry.maxLength ?? 256;
      if (text.length < min || text.length > max) return bad(`Use ${min} to ${max} characters.`, `用 ${min} 至 ${max} 個字元。`);
      if (/[<>\x00-\x1f]/.test(text)) return bad("Angle brackets and control characters are not allowed.", "唔可以用角括號同控制字元。");
      return good(text);
    }
  }
}
