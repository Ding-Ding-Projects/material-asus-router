// Latency monitor: the router pings the targets you choose on an interval, the
// app keeps the history, charts latency and loss, and raises an alert when a
// target stops answering or gets slow. The monitor is the app's own timer:
// it runs while the app runs, and picks up again the next time anyone opens the
// app after a restart (the browser asks for alerts every few seconds).
import { cleanText, hostTarget } from "../kit.mjs";
import { judge, nextAlert, parsePing, summarise } from "./ping.mjs";
import { featureState } from "./state.mjs";

const DEFAULT_CONFIG = { enabled: false, intervalSec: 30, lossAlertPct: 50, latencyAlertMs: 300, targets: [{ id: "t1", host: "1.1.1.1", label: "Cloudflare" }, { id: "t2", host: "8.8.8.8", label: "Google" }] };
const store = featureState("latency-monitor", { config: DEFAULT_CONFIG, alerts: [], nextAlertId: 1, samples: {} });
const SAMPLE_LIMIT = 720;
const ALERT_LIMIT = 50;

let live = null;
let timer = null;
let running = false;
const memory = { samples: new Map(), tracks: new Map(), loaded: false, sinceSave: 0 };

async function load() {
  if (memory.loaded) return;
  memory.loaded = true;
  const state = await store.read();
  for (const [id, list] of Object.entries(state.samples)) memory.samples.set(id, list);
}

const seriesOf = (id) => memory.samples.get(id) ?? [];

// Pings every target once, records the samples and raises alerts. Returns what it measured.
export async function cycle(ctx, config) {
  await load();
  const results = await Promise.all(config.targets.map(async (target) => {
    const out = await ctx.exec(`ping -c 3 -W 2 ${hostTarget(target.host)}`, { timeoutMs: 20000 });
    const sample = { at: Date.now(), ...parsePing(out.stdout + out.stderr, { code: out.code }) };
    return { target, sample: { at: sample.at, loss: sample.loss, avg: sample.avg, min: sample.min, max: sample.max } };
  }));
  const events = [];
  for (const { target, sample } of results) {
    const list = seriesOf(target.id);
    list.push(sample);
    while (list.length > SAMPLE_LIMIT) list.shift();
    memory.samples.set(target.id, list);
    const { track, event } = nextAlert(memory.tracks.get(target.id) ?? {}, judge(sample, config));
    memory.tracks.set(target.id, track);
    if (event) events.push({ ...event, target: target.id, host: target.host, label: target.label, sample });
  }
  memory.sinceSave += 1;
  await store.update((s) => {
    for (const e of events) {
      const name = e.label || e.host;
      const words = {
        recovered: [`${name} is answering normally again.`, `${name} 回復正常回應。`],
        down: [`${name} (${e.host}) stopped answering.`, `${name}（${e.host}）冇再回應。`],
        lossy: [`${name} (${e.host}) is losing ${e.sample.loss}% of its packets.`, `${name}（${e.host}）跌咗 ${e.sample.loss}% 嘅包。`],
        slow: [`${name} (${e.host}) is slow: ${Math.round(e.sample.avg)} ms.`, `${name}（${e.host}）好慢：${Math.round(e.sample.avg)} ms。`],
      }[e.kind];
      s.alerts.push({ id: s.nextAlertId++, at: new Date(e.sample.at).toISOString(), kind: e.kind, level: e.level, target: e.target, text: words[0], textYue: words[1] });
    }
    while (s.alerts.length > ALERT_LIMIT) s.alerts.shift();
    if (memory.sinceSave >= 5 || events.length) {
      s.samples = Object.fromEntries([...memory.samples].map(([id, list]) => [id, list.slice(-SAMPLE_LIMIT)]));
      memory.sinceSave = 0;
    }
  });
  return results;
}

async function loop() {
  const { config } = await store.read();
  if (!config.enabled) return void (timer = null);
  if (!running) {
    running = true;
    try {
      await cycle(await live(), config);
    } catch {
      // The router could not be reached; the next cycle tries again.
    }
    running = false;
  }
  const fresh = (await store.read()).config;
  timer = fresh.enabled ? setTimeout(loop, fresh.intervalSec * 1000) : null;
  timer?.unref?.();
}

// Starts the loop once; later calls only refresh the router link and restart it after a stop.
async function ensure(liveFn) {
  live = liveFn;
  await load();
  const { config } = await store.read();
  if (config.enabled && !timer) {
    timer = setTimeout(loop, 50);
    timer.unref?.();
  }
}

export function validateConfig(body) {
  const fail = (message) => Object.assign(new Error(message), { status: 400 });
  const targets = Array.isArray(body.targets) ? body.targets : null;
  if (!targets || targets.length < 1 || targets.length > 8) throw fail("Choose between 1 and 8 targets to ping.");
  const seen = new Set();
  const clean = targets.map((t, i) => {
    const host = hostTarget(t.host);
    if (seen.has(host.toLowerCase())) throw fail(`${host} is listed twice.`);
    seen.add(host.toLowerCase());
    return { id: /^t\d{1,3}$/.test(String(t.id)) ? String(t.id) : `t${i + 1}`, host, label: cleanText(t.label ?? "", "Name", { allowEmpty: true }) };
  });
  const whole = (value, min, max, name) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) throw fail(`${name} must be a whole number from ${min} to ${max}.`);
    return n;
  };
  if (typeof body.enabled !== "boolean") throw fail("Say whether monitoring is on.");
  return { enabled: body.enabled, intervalSec: whole(body.intervalSec, 10, 3600, "The interval (seconds)"), lossAlertPct: whole(body.lossAlertPct, 1, 100, "The loss alert (%)"), latencyAlertMs: whole(body.latencyAlertMs, 20, 5000, "The latency alert (ms)"), targets: clean };
}

async function status() {
  await load();
  const { config, alerts } = await store.read();
  const series = {};
  const stats = {};
  for (const t of config.targets) {
    const list = seriesOf(t.id);
    series[t.id] = list.slice(-120);
    stats[t.id] = { ...summarise(list.slice(-120)), active: memory.tracks.get(t.id)?.active ?? null };
  }
  return { config, running: Boolean(timer) || running, series, stats, alerts: alerts.slice(-20).reverse(), lastAlertId: alerts.at(-1)?.id ?? 0 };
}

export default {
  id: "latency-monitor",

  routes(api) {
    api.get("/status", async ({ live: liveFn }) => {
      await ensure(liveFn);
      return status();
    });
    // GET /alerts?since=<id> : what the bell needs; also keeps the monitor running after a restart.
    api.get("/alerts", async ({ live: liveFn, query }) => {
      await ensure(liveFn);
      const { alerts } = await store.read();
      const since = Number(query.since ?? 0) || 0;
      return { alerts: alerts.filter((a) => a.id > since), lastAlertId: alerts.at(-1)?.id ?? 0 };
    });
    api.put("/config", async ({ body, live: liveFn }) => {
      const config = validateConfig(body);
      await store.update((s) => void (s.config = config));
      clearTimeout(timer);
      timer = null;
      const ids = new Set(config.targets.map((t) => t.id));
      for (const id of [...memory.samples.keys()]) if (!ids.has(id)) memory.samples.delete(id);
      await ensure(liveFn);
      return status();
    });
    // POST /probe : one round of pings right now, even while monitoring is off.
    api.post("/probe", async ({ live: liveFn }) => {
      live = liveFn;
      const { config } = await store.read();
      await cycle(await liveFn(), config);
      return status();
    });
    api.delete("/history", async () => {
      memory.samples.clear();
      memory.tracks.clear();
      await store.update((s) => {
        s.samples = {};
        s.alerts = [];
      });
      return { ok: true };
    });
  },

  fakeRouter: {
    handlers: [
      (command) => {
        const m = command.match(/^ping -c 3 -W 2 (192\.0\.2\.(?:66|99))$/);
        if (!m) return undefined;
        // A pretend target that loses packets, and one that never answers.
        if (m[1] === "192.0.2.66") return { stdout: `PING ${m[1]} (${m[1]}): 56 data bytes\n64 bytes from ${m[1]}: seq=0 ttl=55 time=48.100 ms\n\n--- ${m[1]} ping statistics ---\n3 packets transmitted, 1 packets received, 66% packet loss\n` };
        return { code: 1, stdout: `PING ${m[1]} (${m[1]}): 56 data bytes\n\n--- ${m[1]} ping statistics ---\n3 packets transmitted, 0 packets received, 100% packet loss\n` };
      },
    ],
  },
};
