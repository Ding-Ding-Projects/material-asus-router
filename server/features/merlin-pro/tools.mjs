// Pure helpers for the Merlin screen: script name and content checks, a line
// diff for the review step, and the cron entry builder. Nothing here touches
// the router.
import { L, quote } from "../kit.mjs";

export const SCRIPT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,47}$/;
export const JOB_ID = /^[A-Za-z0-9_-]{1,32}$/;
export const MAX_BYTES = 64 * 1024;
export const MAX_LINES = 1500;

const bad = (message, status = 400) => Object.assign(new Error(message), { status });

// The scripts Merlin runs by itself, and what makes each one run.
export const HOOKS = {
  "init-start": L("Runs early at start-up, before the network is ready.", "開機初期執行，網絡未就緒。"),
  "services-start": L("Runs when the router has finished starting its services.", "路由器完成啟動各項服務後執行。"),
  "services-stop": L("Runs just before the router stops its services.", "路由器停止各項服務之前執行。"),
  "firewall-start": L("Runs every time the firewall rules are built.", "每次建立防火牆規則時執行。"),
  "nat-start": L("Runs every time the address translation rules are built.", "每次建立位址轉換規則時執行。"),
  "wan-start": L("Runs when the internet connection comes up.", "互聯網連線接通時執行。"),
  "wan-event": L("Runs when the internet connection changes state.", "互聯網連線狀態改變時執行。"),
  "post-mount": L("Runs after a USB drive is mounted.", "USB 磁碟掛載之後執行。"),
  unmount: L("Runs before a USB drive is removed.", "USB 磁碟移除之前執行。"),
  "dhcpc-event": L("Runs when the router's own address lease changes.", "路由器自己嘅地址租約改變時執行。"),
  "openvpn-event": L("Runs when an OpenVPN tunnel changes state.", "OpenVPN 通道狀態改變時執行。"),
  "dnsmasq.postconf": L("Edits the DNS and address handout configuration before it starts.", "喺 DNS 同派地址設定啟動前修改設定。"),
};

export function checkScript(name, content) {
  if (!SCRIPT_NAME.test(String(name ?? ""))) throw bad("Use 1 to 48 letters, numbers, dots, dashes or underscores, starting with a letter or number.");
  const text = String(content ?? "");
  if (Buffer.byteLength(text) > MAX_BYTES) throw bad("A script can be at most 64 KB.");
  if (text.includes("\0")) throw bad("A script cannot contain NUL characters.");
  if (text.includes("\r")) throw bad("Remove the Windows line endings (carriage returns). The router needs plain line breaks.");
  if (text.split("\n").length > MAX_LINES) throw bad(`A script can have at most ${MAX_LINES} lines.`);
  return text.replace(/\n*$/, "\n");
}

export function warnings(name, text) {
  const out = [];
  if (!text.startsWith("#!")) out.push(L("The first line is not a shebang such as #!/bin/sh, so the router may not run it.", "第一行唔係 #!/bin/sh 呢類 shebang，路由器可能唔會執行。"));
  if (!HOOKS[name] && !name.endsWith(".sh") && !name.endsWith(".postconf")) out.push(L("This name is not one of the scripts the router runs by itself. It only runs when something calls it.", "呢個名唔係路由器自動執行嘅腳本名，要有其他嘢去呼叫先會執行。"));
  return out;
}

// A plain line diff: unchanged, added and removed lines in order.
export function diffLines(before, after) {
  const a = before === "" ? [] : before.replace(/\n$/, "").split("\n");
  const b = after === "" ? [] : after.replace(/\n$/, "").split("\n");
  const rows = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) rows[i][j] = a[i] === b[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i += 1;
      j += 1;
    } else if (j < b.length && (i === a.length || rows[i][j + 1] >= rows[i + 1][j])) out.push({ type: "add", text: b[j++] });
    else out.push({ type: "del", text: a[i++] });
  }
  return out;
}

// Turns a painted schedule such as "12345@08:00-17:00,06@10:00-12:00" into cron
// entries that run at the start of each slot.
export function buildCron({ schedule, command, id }) {
  const name = String(id ?? "");
  if (!JOB_ID.test(name)) throw bad("Use 1 to 32 letters, numbers, dashes or underscores for the job name.");
  const cmd = String(command ?? "").trim();
  if (!cmd || cmd.length > 240 || /[\x00-\x1f]/.test(cmd)) throw bad("Enter the command to run, on one line, up to 240 characters.");
  const slots = String(schedule ?? "").split(",");
  if (!schedule || slots.length > 28) throw bad("Paint between 1 and 28 time slots.");
  const entries = slots.map((slot, index) => {
    const m = slot.match(/^([0-6]+)@([01]\d|2[0-3]):([0-5]\d)-(?:[01]\d|2[0-3]):[0-5]\d$/);
    if (!m || new Set(m[1]).size !== m[1].length) throw bad(`"${slot}" is not a time slot. Use days 0 to 6, then @ and a time range.`);
    const days = [...m[1]].sort().join(",");
    return { id: slots.length === 1 ? name : `${name}-${index + 1}`, expression: `${Number(m[3])} ${Number(m[2])} * * ${days}`, command: cmd };
  });
  return entries.map((e) => ({ ...e, line: `cru a ${e.id} ${quote(`${e.expression} ${e.command}`)}` }));
}

export function parseCron(text) {
  return String(text)
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const m = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*?)(?:\s+#([^#]+)#)?$/);
      return m ? { expression: m.slice(1, 6).join(" "), command: m[6], id: m[7] ?? "" } : { expression: "", command: line.trim(), id: "" };
    });
}

export function parseJffs(text) {
  for (const line of String(text).split("\n").slice(1)) {
    const c = line.trim().split(/\s+/);
    if (c.length >= 6 && c[5] === "/jffs") {
      const [total, used, free] = [Number(c[1]), Number(c[2]), Number(c[3])];
      if ([total, used, free].every(Number.isFinite)) return { totalKb: total, usedKb: used, freeKb: free, usedPct: total ? Math.round((used / total) * 100) : 0 };
    }
  }
  return null;
}

// Add-ons that amtm and the community maintain, matched by their folder name.
export const KNOWN_ADDONS = {
  YazFi: L("Guest network control with its own rules.", "客人網絡嘅獨立規則控制。"),
  scMerlin: L("Service control and a script hub.", "服務控制同腳本中心。"),
  Skynet: L("Firewall that blocks known bad addresses.", "擋住已知惡意地址嘅防火牆。"),
  diversion: L("Network-wide ad blocking.", "全網絡廣告封鎖。"),
  uiDivStats: L("Statistics page for Diversion.", "Diversion 嘅統計頁。"),
  spdMerlin: L("Internet speed tests on a schedule.", "定時測試網速。"),
  connmon: L("Internet connection monitor.", "互聯網連線監察。"),
  ntpMerlin: L("Clock accuracy monitor.", "時鐘準確度監察。"),
  YazDHCP: L("Address reservations from the router page.", "喺路由器網頁管理保留地址。"),
  amtm: L("The add-on manager itself.", "附加功能管理程式。"),
};
