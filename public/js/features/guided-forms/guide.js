// The guidance for one setting: steps, a worked example and a sample value,
// built from the entry's own label, limits and options so no two settings get
// the same text. Pure data, no DOM, no imports.

const pair = (en, yue) => ({ en, yue });
const lab = (e) => e.label;

// A valid example value that differs from the current one where it can.
export function exampleValue(entry) {
  const cur = String(entry.value ?? "");
  const pick = (list) => String(list.find((v) => String(v) !== cur) ?? list[0]);
  switch (entry.control) {
    case "switch": return cur === entry.values.on ? entry.values.off : entry.values.on;
    case "select": case "segmented": return pick(entry.options.map(([v]) => v));
    case "number": case "slider": case "stepper": return pick([Math.round((entry.min + entry.max) / 2), entry.min, entry.max]);
    case "ipv4": return pick(["198.51.100.77", "198.51.100.78"]);
    case "cidr": return pick(["198.51.100.0/24", "198.51.100.0/25", "203.0.113.0/24"].filter((v) => (entry.minPrefix ?? 0) <= Number(v.split("/")[1]) && Number(v.split("/")[1]) <= (entry.maxPrefix ?? 32)));
    case "range": { const b = entry.within ? entry.within.split("/")[0].split(".").slice(0, 3).join(".") : "198.51.100"; return pick([`${b}.50-${b}.99`, `${b}.60-${b}.120`]); }
    case "port": return pick([entry.presets?.[0]?.[0] ?? "8080", "8443", "3000", entry.min ?? 1]);
    case "mac": case "device": return pick(["02:00:00:00:00:01", "02:00:00:00:00:02"]);
    case "hostname": return pick(["pool.example.test", "time.example.test"]);
    case "schedule": return pick(["12345@08:00-17:00", "06@10:00-12:00"]);
    case "chips": { const pool = entry.options ? entry.options.map(([v]) => v) : ["alpha", "beta"]; return pick([pool.slice(0, 1).join(entry.delimiter ?? ","), pool.slice(0, 2).join(entry.delimiter ?? ",")]); }
    case "color": return pick(["#3366cc", "#cc6633"]);
    case "file": return pick(entry.encoding === "base64" ? ["c2FtcGxlLWE=", "c2FtcGxlLWI="] : ["sample-a", "sample-b"]);
    case "password": return "sample-pass-1234".padEnd(entry.minLength ?? 0, "x").slice(0, entry.maxLength ?? 256);
    default: return "Sample".padEnd(entry.minLength ?? 0, "x").slice(0, entry.maxLength ?? 256);
  }
}

// Controls with several parts get the full step-by-step wizard; simple ones one contextual step.
export const COMPLEX = new Set(["schedule", "cidr", "range", "chips", "port", "mac", "device", "file", "password"]);
export const isComplex = (entry) => COMPLEX.has(entry.control);

function limits(e) {
  switch (e.control) {
    case "number": case "slider": case "stepper": return pair(`A whole number from ${e.min} to ${e.max}${e.unit ? ` ${e.unit}` : ""}.`, `${e.min} 至 ${e.max} 嘅整數${e.unit ? `（${e.unit}）` : ""}。`);
    case "select": case "segmented": return pair(`One of: ${e.options.map(([v, l]) => l.en).join(", ")}.`, `其中一個：${e.options.map(([v, l]) => l.yue).join("、")}。`);
    case "switch": return pair("On or off.", "開或者關。");
    case "ipv4": return pair("An IPv4 address with four numbers from 0 to 255.", "四個 0 至 255 嘅數字組成嘅 IPv4 地址。");
    case "cidr": return pair(`An address and a prefix length from ${e.minPrefix ?? 0} to ${e.maxPrefix ?? 32}${e.network ? ", starting at the first address of the network" : ""}.`, `地址加前綴長度（${e.minPrefix ?? 0} 至 ${e.maxPrefix ?? 32}）${e.network ? "，要由網絡第一個地址開始" : ""}。`);
    case "range": return pair(`Two addresses${e.within ? ` inside ${e.within}` : ""}, the first not after the last.`, `兩個地址${e.within ? `（喺 ${e.within} 入面）` : ""}，第一個唔可以喺最後一個之後。`);
    case "port": return pair(`A port from ${e.min ?? 1} to ${e.max ?? 65535}${e.allowRange ? ", or a range like 8000:8010" : ""}.`, `${e.min ?? 1} 至 ${e.max ?? 65535} 嘅端口${e.allowRange ? "，或者範圍例如 8000:8010" : ""}。`);
    case "mac": case "device": return pair("A device address like AA:BB:CC:DD:EE:FF.", "裝置地址，例如 AA:BB:CC:DD:EE:FF。");
    case "hostname": return pair("A host name made of letters, digits and dashes, separated by dots.", "由字母、數字同橫線組成，用點分隔嘅主機名稱。");
    case "schedule": return pair("Time slots like 12345@08:00-17:00: days 0 (Sunday) to 6, then a start and end time.", "時段例如 12345@08:00-17:00：0（星期日）至 6，再加開始同結束時間。");
    case "chips": return pair(`Up to ${e.maxItems ?? 20} items${e.options ? " from the list" : ""}, no repeats.`, `最多 ${e.maxItems ?? 20} 項${e.options ? "（要喺清單入面）" : ""}，唔可以重複。`);
    case "color": return pair("A colour written like #3366cc.", "顏色，寫法例如 #3366cc。");
    case "password": return pair(`${e.minLength ?? 0} to ${e.maxLength ?? 256} characters. It is hidden and never shown in previews.`, `${e.minLength ?? 0} 至 ${e.maxLength ?? 256} 個字元，會隱藏，預覽唔會顯示。`);
    case "file": return pair(`Up to ${e.maxLength ?? 8192} characters of file content.`, `最多 ${e.maxLength ?? 8192} 個字元嘅檔案內容。`);
    default: return pair(`${e.minLength ?? 0} to ${e.maxLength ?? 256} characters.`, `${e.minLength ?? 0} 至 ${e.maxLength ?? 256} 個字元。`);
  }
}
export const limitsOf = limits;

// -> { title, steps: [{ title, body }], example, sample, limits }
export function buildGuide(entry) {
  const L = lab(entry);
  const sample = exampleValue(entry);
  const risk = entry.risk === "network" ? pair("This change can briefly interrupt connections, so it is applied with the safety net: if you lose the router, it rolls back by itself.", "呢項改動可能短暫中斷連線，所以會用安全機制套用：連唔返路由器就會自動還原。") : entry.risk === "destructive" ? pair("This change is destructive and needs extra confirmation.", "呢項改動有破壞性，要額外確認。") : pair("This change is small and can be undone from the change history.", "呢項改動細，可以喺變更記錄還原。");
  const steps = [
    { title: pair(`Know what ${L.en} does`, `了解「${L.yue}」做乜`), body: pair(`${entry.help.en} It is stored as ${entry.key} on the router${entry.groupLabel ? ` (${entry.groupLabel.en})` : ""}.`, `${entry.help.yue} 佢喺路由器入面儲存做 ${entry.key}${entry.groupLabel ? `（${entry.groupLabel.yue}）` : ""}。`) },
    { title: pair(`Choose a value for ${L.en}`, `為「${L.yue}」揀個值`), body: pair(`Allowed: ${limits(entry).en}${entry.optional ? " It may also be left empty." : ""} Example: ${sample}.`, `容許：${limits(entry).yue}${entry.optional ? " 亦可以留空。" : ""} 例子：${sample}。`) },
    { title: pair("Check it, then review", "檢查，然後檢視"), body: pair(`The value is checked as you type. Nothing reaches the router yet: it waits in the changes bar. ${risk.en}`, `你輸入嗰陣就會檢查。暫時唔會送去路由器：會等喺改動列。${risk.yue}`) },
  ];
  if (!isComplex(entry)) steps.splice(1, 2, { title: pair(`Set ${L.en}`, `設定「${L.yue}」`), body: pair(`Allowed: ${limits(entry).en} Example: ${sample}. Nothing reaches the router until you review and apply it. ${risk.en}`, `容許：${limits(entry).yue} 例子：${sample}。你檢視同套用之前，路由器唔會有變。${risk.yue}`) });
  return { title: L, steps, sample, example: pair(`For ${L.en}, a worked example is ${sample}.`, `「${L.yue}」嘅示範例子係 ${sample}。`), limits: limits(entry) };
}
