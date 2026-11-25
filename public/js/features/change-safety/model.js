// Change safety, the parts that need no browser: impact levels, the undo and
// redo shortcuts, the four-key proof, history grouping and statistics, the
// export formats (JSON, CSV, Markdown, HTML and a small PDF) and the choice of
// the before-and-after picture for a change. Everything here is a plain
// function so a Node test can run it.

export const LEVELS = [
  { level: 0, icon: "check_circle", name: { en: "No effect", yue: "冇影響" }, about: { en: "Nobody at home will notice.", yue: "屋企人唔會有感覺。" } },
  { level: 1, icon: "bolt", name: { en: "Small blip", yue: "輕微中斷" }, about: { en: "A quick hiccup for some devices.", yue: "部分裝置會閃一閃。" } },
  { level: 2, icon: "wifi_off", name: { en: "Wi-Fi drops", yue: "Wi-Fi 會斷" }, about: { en: "Everyone's Wi-Fi drops for a few seconds.", yue: "所有人嘅 Wi-Fi 會斷幾秒。" } },
  { level: 3, icon: "crisis_alert", name: { en: "Internet or router down", yue: "上網或路由器停頓" }, about: { en: "The internet or the router is unavailable.", yue: "上唔到網或者路由器停頓。" } },
];
export const levelOf = (value) => LEVELS[Math.min(Math.max(Number(value) || 0, 0), 3)];

// Rough seconds the household is disturbed, by level. Shown as an estimate only.
export const OUTAGE_SECONDS = [0, 5, 15, 90];
export const outageText = (level, reboot = false) => {
  const seconds = reboot ? 120 : OUTAGE_SECONDS[levelOf(level).level];
  if (!seconds) return { en: "No outage expected.", yue: "預計唔會中斷。" };
  const text = seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds} s`;
  return { en: `About ${text} of disturbance (an estimate).`, yue: `大約 ${text} 受影響（只係估計）。` };
};

// ---- shortcuts ---------------------------------------------------------------

// Fields keep their own native undo, so the router shortcuts stay out of them.
export function isTextTarget(target) {
  if (!target || typeof target !== "object") return false;
  const tag = String(target.tagName ?? "").toLowerCase();
  if (target.isContentEditable) return true;
  if (tag === "textarea" || tag === "select") return true;
  if (tag !== "input") return false;
  return !["checkbox", "radio", "button", "submit", "range", "color", "file", "reset", "image"].includes(String(target.type ?? "text").toLowerCase());
}

// "undo", "redo" or null for a keydown event.
export function stackShortcut(event, target = event?.target) {
  if (!event || !(event.ctrlKey || event.metaKey) || event.altKey) return null;
  if (isTextTarget(target)) return null;
  const key = String(event.key ?? "").toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && !event.shiftKey) return "redo";
  return null;
}
export const SHORTCUTS = { undo: "Ctrl+Z", redo: "Ctrl+Shift+Z", redoAlt: "Ctrl+Y", confirm: "Ctrl+Shift+Enter" };

// ---- four keys ---------------------------------------------------------------

export function chordMatches(event, keys = "Ctrl+Shift+Enter") {
  const parts = keys.toLowerCase().split("+");
  const want = { ctrl: parts.includes("ctrl"), shift: parts.includes("shift"), alt: parts.includes("alt") };
  const main = parts[parts.length - 1];
  return Boolean(event.ctrlKey || event.metaKey) === want.ctrl && Boolean(event.shiftKey) === want.shift && Boolean(event.altKey) === want.alt && String(event.key ?? "").toLowerCase() === main;
}

// The state of the four keys, from what the server asked for and what the person did.
export function keyState(detail, input = {}) {
  const steps = detail?.steps ?? {};
  const people = steps.acknowledge?.people ?? [];
  const acked = new Set(input.acked ?? []);
  const shortName = steps.typeName?.shortName ?? "";
  const minMs = steps.hold?.minMs ?? 1500;
  const keys = {
    acknowledge: people.every((p) => acked.has(p.id)) && (people.length > 0 || input.noPeopleAck === true),
    typeName: String(input.typed ?? "").trim() === String(shortName).trim() && shortName !== "",
    hold: (input.holdMs ?? 0) >= minMs,
    chord: input.chord === true,
  };
  return { keys, ready: Object.values(keys).every(Boolean), minMs, shortName, people };
}
export function buildProof(detail, input = {}) {
  const people = detail?.steps?.acknowledge?.people ?? [];
  return { nonce: detail.nonce, ackPeople: people.map((p) => p.id), typed: String(input.typed ?? "").trim(), holdMs: Math.round(input.holdMs ?? 0), chord: input.chord === true };
}

export const REFUSALS = {
  CONFIRM_NONCE: { en: "That confirmation expired. Start again.", yue: "確認已經過期，請重新開始。" },
  CONFIRM_ACK: { en: "Acknowledge everyone who is affected.", yue: "請確認所有受影響嘅人。" },
  CONFIRM_TYPED: { en: "The name you typed does not match.", yue: "你打嘅名同要求唔一樣。" },
  CONFIRM_HOLD: { en: "Hold the button a little longer.", yue: "請再撳耐啲。" },
  CONFIRM_CHORD: { en: "Press the key combination.", yue: "請撳指定嘅組合鍵。" },
  ALLOWANCE: { en: "The household does not allow this much disturbance right now.", yue: "屋企依家唔容許咁大嘅影響。" },
  OVERRIDE_OWNER: { en: "Only the owner can override the household allowance.", yue: "只有擁有人先可以覆寫屋企嘅容許級數。" },
  LIVE_MODE_OFF: { en: "Live mode is off. Review the change, then apply it.", yue: "即時模式已關閉，請先檢查再套用。" },
  STACK_EMPTY: { en: "Nothing to undo or redo.", yue: "冇嘢可以還原或重做。" },
  LAUNCH_REQUIRED: { en: "A reboot needs the launch sequence.", yue: "重啟要經過發射程序。" },
  LAUNCH_ORDER: { en: "That step comes later. Follow the order.", yue: "呢一步要稍後，請跟次序。" },
  LAUNCH_CODE: { en: "Wrong launch code.", yue: "發射密碼唔啱。" },
  LAUNCH_KEYS: { en: "Hold both keys at the same time.", yue: "請同時撳住兩條匙。" },
  LAUNCH_TOO_EARLY: { en: "Not yet. Wait for the countdown.", yue: "未到時間，請等倒數。" },
  LAUNCH_ABORTED: { en: "The launch was aborted.", yue: "發射已中止。" },
  LAUNCH_DONE: { en: "The launch already happened.", yue: "已經發射咗。" },
};
export const refusalText = (error) => REFUSALS[error?.code] ?? null;

// ---- allowance chip ------------------------------------------------------------

export function chipText(allowance, presence) {
  if (!allowance || allowance.configured === false)
    return { en: "Allowance: not set up", yue: "容許級數：未設定", tone: "muted" };
  const first = (presence?.members ?? [])[0];
  const who = (allowance.people ?? [])[0];
  const name = who?.name ?? "Your brother";
  const nameYue = who?.nameYue ?? "你兄弟";
  const state = who?.presence ?? first?.state ?? "unknown";
  const devices = (first?.sources ?? []).filter((s) => s.source === "wifi").flatMap((s) => s.devices ?? []);
  const where = devices.length ? ` (${devices[0].label} on Wi-Fi)` : state === "unknown" ? " (cannot tell: wired devices only)" : "";
  const whereYue = devices.length ? `（${devices[0].label} 連住 Wi-Fi）` : state === "unknown" ? "（睇唔到：淨係有線裝置）" : "";
  const en = { home: "is home", away: "is away", unknown: "may be home" }[state] ?? "may be home";
  const yue = { home: "喺屋企", away: "唔喺屋企", unknown: "可能喺屋企" }[state] ?? "可能喺屋企";
  return { en: `Allowance: Level ${allowance.allowed} · ${name} ${en}${where}`, yue: `容許級數：${allowance.allowed} · ${nameYue}${yue}${whereYue}`, tone: state, level: allowance.allowed };
}

// ---- history ---------------------------------------------------------------------

export const AREAS = {
  wifi: { en: "Wi-Fi", yue: "Wi-Fi" }, internet: { en: "Internet", yue: "互聯網" }, lan: { en: "Home network", yue: "屋企網絡" },
  forwarding: { en: "Port forwarding", yue: "埠轉發" }, firewall: { en: "Firewall", yue: "防火牆" }, parental: { en: "Parental controls", yue: "家長監控" },
  qos: { en: "Speed priorities", yue: "速度優先" }, vpn: { en: "VPN", yue: "VPN" }, aimesh: { en: "Mesh", yue: "Mesh" }, usb: { en: "USB", yue: "USB" },
  system: { en: "System", yue: "系統" }, merlin: { en: "Merlin add-ons", yue: "Merlin 附加功能" }, advanced: { en: "Advanced", yue: "進階" }, other: { en: "Other", yue: "其他" },
};
export const areaName = (id) => AREAS[id] ?? { en: id ? String(id).replace(/[-_.]/g, " ") : "Other", yue: id ? String(id) : "其他" };

export function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A timeline: by day, newest first, each entry placed under its first area.
export function groupTimeline(items, by = "day") {
  const groups = new Map();
  for (const item of items) {
    const key = by === "area" ? (item.areas?.[0] ?? "other") : dayKey(item.at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const keys = [...groups.keys()].sort((a, b) => (by === "day" ? (a < b ? 1 : -1) : a.localeCompare(b)));
  return keys.map((key) => ({ key, items: groups.get(key) }));
}

export function historyQuery(filters = {}, extra = {}) {
  const params = new URLSearchParams();
  for (const k of ["area", "person", "mode", "source", "impact", "since", "until", "text", "key"]) if (filters[k] !== undefined && filters[k] !== "") params.set(k, String(filters[k]));
  if (filters.regex) params.set("regex", String(filters.regex));
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== "") params.set(k, String(v));
  const text = params.toString();
  return text ? `?${text}` : "";
}

// Search text with an optional regular expression, checked before it is sent.
export function checkPattern(pattern, flags = "i") {
  if (!pattern) return { ok: true };
  if (pattern.length > 200) return { ok: false, error: { en: "Use 200 characters or fewer.", yue: "請用 200 個字元或以下。" } };
  try {
    new RegExp(pattern, flags);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: { en: `Not a valid pattern: ${error.message}`, yue: `唔係有效嘅樣式：${error.message}` } };
  }
}

export function statistics(items) {
  const count = (pick) => {
    const map = new Map();
    for (const item of items) for (const k of [].concat(pick(item) ?? [])) map.set(k, (map.get(k) ?? 0) + 1);
    return [...map].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || String(a.key).localeCompare(String(b.key)));
  };
  return {
    total: items.length,
    byDay: count((i) => dayKey(i.at)).sort((a, b) => (a.key < b.key ? -1 : 1)),
    byArea: count((i) => i.areas?.length ? i.areas : ["other"]),
    byPerson: count((i) => i.person || "unknown"),
    byImpact: [0, 1, 2, 3].map((level) => ({ key: level, n: items.filter((i) => Number(i.impact) === level).length })),
    byMode: count((i) => i.mode || "live"),
    bySource: count((i) => i.source || "ui"),
  };
}

// ---- a change, in words ---------------------------------------------------------------

export const valueText = (value) => (value === undefined || value === null || value === "" ? "" : String(value));
export const shown = (c, which) => (c.secret ? "••••••••" : valueText(c[which]));

export function describeChange(c) {
  const before = shown(c, "old");
  const after = shown(c, "new");
  const label = c.label ?? c.key;
  const lbl = typeof label === "string" ? { en: label, yue: label } : label;
  if (!before && after) return { en: `${lbl.en}: set to ${after}`, yue: `${lbl.yue}：設為 ${after}` };
  if (before && !after) return { en: `${lbl.en}: cleared (was ${before})`, yue: `${lbl.yue}：已清除（原本 ${before}）` };
  return { en: `${lbl.en}: ${before} to ${after}`, yue: `${lbl.yue}：${before} 改為 ${after}` };
}

// ---- exports ---------------------------------------------------------------------------

const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // never let a spreadsheet run a value as a formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (item) => [item.oid, item.at, item.person, item.mode, item.source, item.impact, (item.areas ?? []).join(" "), item.subject];
const HEAD = ["version", "at", "person", "mode", "source", "impact", "areas", "subject"];

export const toCsv = (items) => `${[HEAD, ...items.map(row)].map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
export const toJson = (items) => `${JSON.stringify({ exportedFrom: "Material Asus Router", count: items.length, items }, null, 2)}\n`;
export function toMarkdown(items) {
  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const lines = ["# Router change history", "", `${items.length} change${items.length === 1 ? "" : "s"}.`, "", "| When | Who | Mode | Impact | Areas | What |", "| --- | --- | --- | --- | --- | --- |"];
  for (const i of items) lines.push(`| ${esc(i.at)} | ${esc(i.person)} | ${esc(i.mode)} | ${esc(i.impact)} | ${esc((i.areas ?? []).join(", "))} | ${esc(i.subject)} |`);
  return `${lines.join("\n")}\n`;
}
export const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function toHtml(items) {
  const rows = items.map((i) => `<tr><td>${escapeHtml(i.at)}</td><td>${escapeHtml(i.person)}</td><td>${escapeHtml(i.mode)}</td><td>${escapeHtml(i.impact)}</td><td>${escapeHtml((i.areas ?? []).join(", "))}</td><td>${escapeHtml(i.subject)}</td></tr>`).join("\n");
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Router change history</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>Router change history</h1><p>${items.length} change${items.length === 1 ? "" : "s"}.</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>When</th><th>Who</th><th>Mode</th><th>Impact</th><th>Areas</th><th>What</th></tr></thead><tbody>\n${rows}\n</tbody></table></body></html>\n`;
}

// A small, valid PDF: one monospace line per entry, paginated. No fonts are embedded.
export function toPdf(items, title = "Router change history") {
  const asciiSafe = (s) => String(s ?? "").replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
  const lines = [title, `${items.length} change${items.length === 1 ? "" : "s"}`, "", ...items.map((i) => `${String(i.at ?? "").slice(0, 16).replace("T", " ")}  L${i.impact ?? 0}  ${i.person ?? ""}: ${i.subject ?? ""}`.slice(0, 110))];
  const perPage = 52;
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (!pages.length) pages.push([title]);
  const objects = [];
  const add = (body) => objects.push(body) && objects.length;
  const catalog = add("");
  const pagesObj = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  const kids = [];
  for (const page of pages) {
    const stream = `BT /F1 9 Tf 12 TL 36 806 Td ${page.map((l) => `(${asciiSafe(l)}) Tj T*`).join(" ")} ET`;
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

export const EXPORTS = {
  json: { name: "JSON", type: "application/json", ext: "json", make: toJson },
  csv: { name: "CSV", type: "text/csv", ext: "csv", make: toCsv },
  markdown: { name: "Markdown", type: "text/markdown", ext: "md", make: toMarkdown },
  html: { name: "HTML", type: "text/html", ext: "html", make: toHtml },
  pdf: { name: "PDF", type: "application/pdf", ext: "pdf", make: toPdf },
};

// ---- which picture explains a change ----------------------------------------------------

// Chooses one of the before-and-after pictures from a change's key and area.
export function simKind(change = {}) {
  const key = String(change.key ?? change.id ?? "");
  const area = String(change.area ?? "");
  if (/^wl\d*(\.\d+)?_(chanspec|channel|bw|nbw|nctrlsb|bw_cap)/.test(key)) return "wifi";
  if (/^dhcp_(start|end|lease|enable)/.test(key) || /^lan_(ipaddr|netmask)/.test(key)) return "dhcp";
  if (/^vts_|^autofw_|^upnp|^port_forward|forward/.test(key) || area === "forwarding") return "portforward";
  if (/^fw_|firewall|^ipv6_fw|^misc_ping|^sshd_|^misc_http/.test(key) || area === "firewall") return "firewall";
  if (/qos|bwdpi|^qos_/.test(key) || area === "qos") return "qos";
  if (/^vpn_|^vpnc_|^wgc_|^wgs_|openvpn|vpndirector|routing_rule/.test(key) || area === "vpn") return "vpn";
  if (/^MULTIFILTER|^parental|^macfilter|^wl\d_macmode|^wl\d_maclist|^rc_support_time/.test(key) || area === "parental") return "parental";
  if (/^dhcp_staticlist|^custom_clientlist|^wan_hwaddr|clientlist/.test(key) || area === "lan") return "devices";
  return "generic";
}

// The numbers a picture needs, taken from the entry's real old and new values.
export const ipToNumber = (ip) => {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip ?? "").trim());
  if (!m || m.slice(1).some((n) => Number(n) > 255)) return null;
  return ((Number(m[1]) << 24) >>> 0) + (Number(m[2]) << 16) + (Number(m[3]) << 8) + Number(m[4]);
};
export function channelOf(value) {
  const text = String(value ?? "");
  const m = /^(\d{1,3})/.exec(text);
  const width = /(?:\/|u|l|-)?(20|40|80|160)/.exec(text.replace(/^\d+/, ""));
  return { channel: m ? Number(m[1]) : 0, width: width ? Number(width[1]) : 20, auto: text === "0" || text === "" };
}
export function poolOf(change, all = []) {
  const get = (key) => all.find((c) => c.key === key);
  const start = get("dhcp_start") ?? (change.key === "dhcp_start" ? change : null);
  const end = get("dhcp_end") ?? (change.key === "dhcp_end" ? change : null);
  return { oldStart: ipToNumber(start?.old), newStart: ipToNumber(start?.new), oldEnd: ipToNumber(end?.old), newEnd: ipToNumber(end?.new) };
}
// Parental time windows: "W" + three hex digits for the days (bit 0 is Sunday) + HHMM start + HHMM end.
// A start after the end runs overnight. Several windows may be joined with "<" or ">".
export function scheduleOf(value) {
  const slots = [];
  for (const part of String(value ?? "").split(/[<>]/)) {
    const m = /^W([0-9A-Fa-f]{3})(\d{4})(\d{4})$/.exec(part.trim());
    if (!m) continue;
    const mask = parseInt(m[1], 16);
    slots.push({ days: [0, 1, 2, 3, 4, 5, 6].filter((d) => mask & (1 << d)), from: `${m[2].slice(0, 2)}:${m[2].slice(2)}`, to: `${m[3].slice(0, 2)}:${m[3].slice(2)}` });
  }
  return slots;
}
export const bytesPerSecondText = (b) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB/s` : `${Math.round(b / 1e3)} kB/s`);
