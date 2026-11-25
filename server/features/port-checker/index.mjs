// Port checker: asks an outside check service whether a port on your router's
// internet address is reachable. The router itself makes the request with curl,
// so the service sees your real internet address. No service is built in: you
// choose one in the settings, and until you do the checker says so instead of
// guessing. Only TCP can be checked this way.
import { L, appPrefs, parseRows } from "../kit.mjs";

const PATHS = ["/check?port={port}", "/api/check?port={port}", "/port/{port}"];
const REPLIES = ["json", "text"];
const HOST = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?)+$/;

export function settingsOf(prefs) {
  const pick = (key, list, fallback) => (list.includes(prefs.get(key)) ? prefs.get(key) : fallback);
  const timeout = Number(prefs.get("timeout") ?? 15);
  return {
    host: HOST.test(prefs.get("host") ?? "") ? prefs.get("host") : "",
    scheme: prefs.get("scheme") === "http" ? "http" : "https",
    path: pick("path", PATHS, PATHS[0]),
    reply: pick("reply", REPLIES, "json"),
    timeout: Number.isInteger(timeout) && timeout >= 5 && timeout <= 30 ? timeout : 15,
  };
}

// Addresses that the internet cannot reach: private ranges, the shared 100.64.0.0/10 range used by
// carriers that share one address between customers, loopback and link-local.
export function isUnreachableAddress(ip) {
  const p = String(ip).split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return p[0] === 10 || p[0] === 127 || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 169 && p[1] === 254);
}

// What the service said, as open, closed or unknown.
export function readReply(kind, body) {
  const text = String(body).trim();
  if (kind === "json") {
    try {
      const value = JSON.parse(text);
      if (typeof value?.open === "boolean") return value.open ? "open" : "closed";
    } catch {}
    return "unknown";
  }
  if (/(closed|not open|unreachable|filtered|refused|timed out)/i.test(text)) return "closed";
  return /\bopen\b/i.test(text) ? "open" : "unknown";
}

export function rulesOf(nvram) {
  return parseRows(nvram.get("vts_rulelist") ?? "").map(([name, external, ip, internal, proto]) => {
    const single = /^\d{1,5}$/.test(external ?? "");
    const tcp = ["TCP", "BOTH", ""].includes(String(proto ?? "").toUpperCase());
    return { name: name ?? "", external, ip, internal, proto: String(proto ?? "").toUpperCase() || "BOTH", checkable: single && tcp, why: !single ? "range" : !tcp ? "udp" : null };
  });
}

export async function check(ctx, port, saved) {
  const s = settingsOf(saved);
  const wan = ctx.nvram.get("wan0_ipaddr") ?? "";
  const base = { port, wanIp: wan, behindSharedAddress: isUnreachableAddress(wan), host: s.host };
  if (!s.host) return { ...base, state: "unavailable", reason: "no-service" };
  const url = `${s.scheme}://${s.host}${s.path.replace("{port}", String(port))}`;
  const out = await ctx.exec(`curl -s --max-time ${s.timeout} -w '\\n%{http_code}' '${url}'`, { timeoutMs: (s.timeout + 5) * 1000 });
  if (out.code !== 0) return { ...base, state: "unavailable", reason: "unreachable-service", detail: out.stderr.trim().split("\n")[0] || `curl exit code ${out.code}` };
  const lines = out.stdout.replace(/\n$/, "").split("\n");
  const status = Number(lines.pop());
  if (status !== 200) return { ...base, state: "unavailable", reason: "service-error", detail: `The service answered HTTP ${status}.` };
  const state = readReply(s.reply, lines.join("\n"));
  return { ...base, state, reason: state === "unknown" ? "unreadable-reply" : null };
}

// Which service to ask is a preference of this app: it is saved by the app and never written to the router.
const g = { domain: "port-checker", group: "service", groupLabel: L("Check service", "檢查服務"), risk: "low" };
const prefs = appPrefs("port-checker", [
  { ...g, id: "port-checker.host", key: "host", default: "", control: "hostname", optional: true,
    label: L("Check service", "檢查服務"), help: L("The host name of an outside port-check service you trust. None is built in. The service must answer from the internet to your router's address.", "你信得過嘅外部端口檢查服務嘅主機名。本程式冇內置。服務要由互聯網連返你路由器嘅地址。") },
  { ...g, id: "port-checker.scheme", key: "scheme", default: "https", control: "segmented", options: [["https", L("HTTPS", "HTTPS")], ["http", L("HTTP", "HTTP")]],
    label: L("Connection type", "連線類型"), help: L("HTTPS is recommended.", "建議用 HTTPS。") },
  { ...g, id: "port-checker.path", key: "path", default: "/check?port={port}", control: "select", options: PATHS.map((p) => [p, L(p, p)]),
    label: L("Address pattern", "地址格式"), help: L("The service's address, where {port} is replaced by the port. Pick the one your service uses.", "服務嘅地址，{port} 會換成端口。揀你嘅服務用嗰個。") },
  { ...g, id: "port-checker.reply", key: "reply", default: "json", control: "segmented", options: [["json", L("JSON", "JSON"), L('Answers {"open": true}', '回答 {"open": true}')], ["text", L("Text", "文字"), L('Says "open" or "closed"', '話 "open" 或 "closed"')]],
    label: L("How the service answers", "服務點樣回答"), help: L("Tells the checker how to read the answer.", "話俾檢查器知點樣讀答案。") },
  { ...g, id: "port-checker.timeout", key: "timeout", default: "15", control: "slider", min: 5, max: 30, step: 5, unit: " s",
    label: L("Give up after", "幾耐後放棄"), help: L("How long to wait for the service to answer.", "等服務回答等幾耐。") },
]);

export default {
  id: "port-checker",

  domainMeta: [{ id: "port-checker", icon: "lan", label: L("Port checker", "端口檢查"), group: { en: "Network", yue: "網絡" } }],
  domains: {
    "port-checker": async (ctx) => {
      const saved = await prefs.read();
      const s = settingsOf(saved);
      const wan = ctx.nvram.get("wan0_ipaddr") ?? "";
      return { ...s, configured: Boolean(s.host), wanIp: wan, behindSharedAddress: isUnreachableAddress(wan), rules: rulesOf(ctx.nvram), entries: prefs.entries(saved) };
    },
  },

  routes(api) {
    prefs.routes(api);
    api.get("/rules", async ({ live }) => ({ rules: rulesOf((await live()).nvram) }));
    // POST /check { port } : one TCP port.
    api.post("/check", async ({ live, body, bad }) => {
      const port = Number(body.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw bad("Enter a port from 1 to 65535.");
      if (body.protocol !== undefined && String(body.protocol).toLowerCase() !== "tcp") throw bad("Only TCP ports can be checked from outside.");
      return check(await live(), port, await prefs.read());
    });
  },

  fakeRouter: {
    handlers: [
      (command) => {
        const m = command.match(/^curl -s --max-time (\d+) -w '\\n%\{http_code\}' '(https?):\/\/([^/']+)(\/[^']*)'$/);
        if (!m || !["ports.example.net", "down.example.net", "broken.example.net"].includes(m[3])) return undefined;
        if (m[3] === "down.example.net") return { code: 28, stderr: "curl: (28) Operation timed out\n" };
        if (m[3] === "broken.example.net") return { stdout: "oops\n500" };
        const port = Number((m[4].match(/(\d+)$/) ?? [])[1]);
        const open = [25565, 443].includes(port);
        const body = m[4].startsWith("/port/") ? `Port ${port} is ${open ? "open" : "closed"}` : JSON.stringify({ open });
        return { stdout: `${body}\n200` };
      },
    ],
  },
};
