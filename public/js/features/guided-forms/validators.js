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

export function validateValue(entry, raw) {
  const text = String(raw ?? "");
  const type = entry.control;
  if (entry.optional && text === "" && !["switch", "select", "segmented"].includes(type)) return good("");
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
