// DNS benchmark: the router asks several name servers for the same names and
// times each answer, so the ranking is what your own internet link sees. The
// timing is taken on the router (its uptime clock, 10 ms steps) and averaged
// over several rounds, so the SSH round trip never counts.
import { L, ON_OFF, appPrefs, isIpv4, quote } from "../kit.mjs";

const RESOLVERS = [
  ["1.1.1.1", "Cloudflare"], ["1.0.0.1", "Cloudflare (second)"], ["8.8.8.8", "Google"], ["8.8.4.4", "Google (second)"],
  ["9.9.9.9", "Quad9"], ["208.67.222.222", "OpenDNS"], ["94.140.14.14", "AdGuard"],
];
const NAMES = ["example.com", "wikipedia.org", "iana.org", "gov.hk", "bbc.co.uk", "debian.org"];
const NAME = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

const listOf = (value, fallback) => (value === undefined || value === "" ? fallback : String(value).split(",").filter(Boolean));

// prefs: the saved preferences (a Map); nvram: the router's settings, which only supply the name servers it uses now.
export function settingsOf(prefs, nvram) {
  const resolvers = listOf(prefs.get("resolvers"), ["1.1.1.1", "8.8.8.8", "9.9.9.9"]).filter(isIpv4);
  const names = listOf(prefs.get("names"), ["example.com", "wikipedia.org", "iana.org"]).filter((n) => NAME.test(n));
  const routerDns = (nvram.get("wan0_dns") ?? "").split(/\s+/).filter(isIpv4);
  return {
    resolvers,
    names,
    rounds: Math.min(10, Math.max(1, Number(prefs.get("rounds") ?? 3) || 3)),
    includeRouter: (prefs.get("router") ?? "1") === "1",
    fresh: (prefs.get("fresh") ?? "0") === "1",
    routerDns,
  };
}

// The full list of name servers to test: the chosen ones, plus the ones the router uses now.
export function planOf(s) {
  const seen = new Set();
  const out = [];
  const add = (ip, label, router) => {
    if (seen.has(ip)) {
      if (router) out.find((x) => x.ip === ip).router = true;
      return;
    }
    seen.add(ip);
    out.push({ ip, label, router });
  };
  for (const ip of s.resolvers) add(ip, RESOLVERS.find(([r]) => r === ip)?.[1] ?? ip, false);
  if (s.includeRouter) for (const ip of s.routerDns) add(ip, RESOLVERS.find(([r]) => r === ip)?.[1] ?? ip, true);
  return out;
}

export function stats(times) {
  const ok = times.filter((x) => x.ok).map((x) => x.ms).sort((a, b) => a - b);
  const median = ok.length ? (ok.length % 2 ? ok[(ok.length - 1) / 2] : (ok[ok.length / 2 - 1] + ok[ok.length / 2]) / 2) : null;
  return {
    asked: times.length,
    failed: times.length - ok.length,
    median,
    mean: ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null,
    min: ok[0] ?? null,
    max: ok.at(-1) ?? null,
  };
}

// Fastest median first; a name server that answered nothing goes last.
export function rank(results) {
  return [...results].sort((a, b) => (a.median === null) - (b.median === null) || a.failed - b.failed || a.median - b.median || a.ip.localeCompare(b.ip));
}

async function timeOne(exec, name, server, fresh) {
  const command = `s=$(head -n 100000 /proc/uptime); nslookup ${quote(name)} ${quote(server)} >/dev/null 2>&1; r=$?; e=$(head -n 100000 /proc/uptime); echo "$s|$e|$r"`;
  const out = await exec(command, { timeoutMs: 20000 });
  const [start, end, code] = out.stdout.trim().split("|");
  const ms = (parseFloat(end) - parseFloat(start)) * 1000;
  if (out.code !== 0 || !Number.isFinite(ms) || ms < 0) return { ok: false, ms: null };
  // A name that does not exist answers with exit code 1 just like a timeout does, so with uncached names
  // only a quick code 1 counts as an answer; a real timeout takes seconds.
  const answered = code === "0" || (fresh && code === "1" && ms < 2000);
  return { ok: answered, ms: answered ? Math.round(ms * 10) / 10 : null };
}

// What to test is a preference of this app: it is saved by the app and never written to the router.
const g = { domain: "dns-benchmark", group: "test", groupLabel: L("What to test", "測試內容"), risk: "low" };
const prefs = appPrefs("dns-benchmark", [
  { ...g, id: "dns-benchmark.resolvers", key: "resolvers", default: "1.1.1.1,8.8.8.8,9.9.9.9", control: "chips", options: RESOLVERS.map(([ip, name]) => [ip, L(`${name} (${ip})`, `${name}（${ip}）`)]), maxItems: 7,
    label: L("Name servers to compare", "要比較嘅域名伺服器"), help: L("Public name servers to test. Pick the ones you might switch to.", "要測試嘅公共域名伺服器。揀你可能轉用嘅。") },
  { ...g, id: "dns-benchmark.names", key: "names", default: "example.com,wikipedia.org,iana.org", control: "chips", options: NAMES.map((n) => [n, L(n, n)]), maxItems: 6,
    label: L("Names to look up", "要查嘅域名"), help: L("Each name server is asked for these names.", "每個域名伺服器都會被問呢啲名。") },
  { ...g, id: "dns-benchmark.rounds", key: "rounds", default: "3", control: "stepper", min: 1, max: 10, unit: "rounds",
    label: L("Rounds", "回合數"), help: L("More rounds give steadier results but take longer.", "回合愈多愈穩定，但花時間愈多。") },
  { ...g, id: "dns-benchmark.router", key: "router", default: "1", control: "switch", values: ON_OFF,
    label: L("Include the router's current name servers", "包括路由器而家用緊嘅域名伺服器"), help: L("Shows how your present setup compares.", "睇吓你而家嘅設定比起其他點。") },
  { ...g, id: "dns-benchmark.fresh", key: "fresh", default: "0", control: "switch", values: ON_OFF,
    label: L("Ask for names that are not cached", "問冇緩存嘅名"), help: L("Adds a random prefix so each answer is not already remembered. Measures the full lookup.", "加隨機前綴，答案就唔會係已經記住嘅。量度完整查詢。") },
]);

export default {
  id: "dns-benchmark",

  domainMeta: [{ id: "dns-benchmark", icon: "dns", label: L("DNS benchmark", "DNS 測速"), group: { en: "Network", yue: "網絡" } }],
  domains: {
    "dns-benchmark": async (ctx) => {
      const saved = await prefs.read();
      const s = settingsOf(saved, ctx.nvram);
      return { ...s, plan: planOf(s), entries: prefs.entries(saved) };
    },
  },

  routes(api) {
    prefs.routes(api);
    // POST /bench { ip } : asks one name server for every chosen name, for every round, and returns its timings.
    api.post("/bench", async ({ live, body, bad }) => {
      const ctx = await live();
      const s = settingsOf(await prefs.read(), ctx.nvram);
      const entry = planOf(s).find((x) => x.ip === String(body.ip ?? ""));
      if (!entry) throw bad("That name server is not in the list to test.", 400);
      if (!s.names.length) throw bad("Choose at least one name to look up.", 409);
      const times = [];
      for (let round = 0; round < s.rounds; round += 1)
        for (const name of s.names) {
          const asked = s.fresh ? `mar${Math.random().toString(36).slice(2, 8)}.${name}` : name;
          times.push(await timeOne(ctx.exec, asked, entry.ip, s.fresh));
        }
      return { ...entry, ...stats(times), times: times.map((x) => x.ms) };
    });
  },

  fakeRouter: {
    handlers: [
      (command, router) => {
        const m = command.match(/^s=\$\(head -n 100000 \/proc\/uptime\); nslookup '([^']+)' '([^']+)' >\/dev\/null 2>&1; r=\$\?; e=\$\(head -n 100000 \/proc\/uptime\); echo "\$s\|\$e\|\$r"$/);
        if (!m) return undefined;
        const speed = { "1.1.1.1": 0.012, "1.0.0.1": 0.014, "8.8.8.8": 0.02, "8.8.4.4": 0.022, "9.9.9.9": 0.03, "94.140.14.14": 0.05 };
        router.dnsQueries = (router.dnsQueries ?? 0) + 1;
        const base = 1000 + router.dnsQueries;
        if (m[2] === "208.67.222.222") return { stdout: `${base.toFixed(2)} 5000.00|${(base + 2).toFixed(2)} 5000.00|1\n` }; // timed out: the pretend server never answers
        const seconds = (speed[m[2]] ?? 0.04) * (1 + (router.dnsQueries % 3) * 0.1);
        return { stdout: `${base.toFixed(2)} 5000.00|${(base + seconds).toFixed(2)} 5000.00|0\n` };
      },
    ],
  },
};
