// Latency monitor: ping output is parsed, statistics and alert rules are right,
// the monitor pings the router's targets, keeps the history in the app's own
// state, raises an alert after two bad checks and a recovery after two good ones.
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/latency-monitor/index.js";
import { judge, nextAlert, parsePing, summarise } from "../../server/features/latency-monitor/ping.mjs";
import { validateConfig } from "../../server/features/latency-monitor/index.mjs";
import { waitFor, startApp } from "../helpers.mjs";

process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "mar-latency-"));

const PING = "PING 1.1.1.1 (1.1.1.1): 56 data bytes\n64 bytes from 1.1.1.1: seq=0 ttl=55 time=12.000 ms\n64 bytes from 1.1.1.1: seq=1 ttl=55 time=14.000 ms\n\n--- 1.1.1.1 ping statistics ---\n3 packets transmitted, 2 packets received, 33% packet loss\n";

test("latency-monitor: ping output becomes loss and latency, and a dead target is 100% loss", () => {
  const p = parsePing(PING);
  assert.deepEqual([p.sent, p.got, p.loss, p.min, p.avg, p.max], [3, 2, 33, 12, 13, 14]);
  assert.deepEqual([parsePing("3 packets transmitted, 0 packets received, 100% packet loss", { code: 1 }).loss, parsePing("3 packets transmitted, 0 packets received, 100% packet loss").avg], [100, null]);
  assert.match(parsePing("ping: bad address", { code: 1 }).error, /could not run/);
  assert.equal(parsePing("garbage").loss, 100);
});

test("latency-monitor: statistics and the two-in-a-row alert rule", () => {
  const s = summarise([{ loss: 0, avg: 10, min: 9, max: 11 }, { loss: 100, avg: null, min: null, max: null }, { loss: 0, avg: 20, min: 18, max: 22 }]);
  assert.deepEqual([s.count, s.loss, s.avg, s.min, s.max, s.jitter], [3, 33.3, 15, 9, 22, 10]);
  assert.equal(summarise([]).count, 0);
  const rules = { lossAlertPct: 50, latencyAlertMs: 300 };
  assert.equal(judge({ loss: 100, avg: null }, rules), "down");
  assert.equal(judge({ loss: 60, avg: 20 }, rules), "lossy");
  assert.equal(judge({ loss: 0, avg: 400 }, rules), "slow");
  assert.equal(judge({ loss: 0, avg: 20 }, rules), null);

  let track = {};
  const step = (verdict) => {
    const r = nextAlert(track, verdict);
    track = r.track;
    return r.event?.kind ?? null;
  };
  assert.deepEqual(["down", "down", "down", null, null, null, "down", "down"].map(step), [null, "down", null, null, "recovered", null, null, "down"], "one blip is ignored, an outage alerts once, recovery needs two good checks");
});

test("latency-monitor: the settings are checked before they are saved", () => {
  const good = { enabled: true, intervalSec: 30, lossAlertPct: 50, latencyAlertMs: 300, targets: [{ id: "t1", host: "1.1.1.1", label: "Cloudflare" }] };
  assert.deepEqual(validateConfig(good).targets, [{ id: "t1", host: "1.1.1.1", label: "Cloudflare" }]);
  for (const [change, message] of [[{ targets: [] }, /between 1 and 8/], [{ targets: [{ host: "1.1.1.1; reboot" }] }, /host name/], [{ targets: [{ host: "1.1.1.1" }, { host: "1.1.1.1" }] }, /twice/], [{ intervalSec: 5 }, /interval/], [{ lossAlertPct: 0 }, /loss/], [{ latencyAlertMs: 99999 }, /latency/], [{ enabled: "yes" }, /monitoring/]])
    assert.throws(() => validateConfig({ ...good, ...change }), message);
});

test("latency-monitor: the monitor pings, keeps history, alerts on an outage and recovers", async () => {
  const t = await startApp();
  try {
    await t.owner.request("DELETE", "/api/x/latency-monitor/history");
    const first = (await t.owner.get("/api/x/latency-monitor/status")).data;
    assert.equal(first.config.enabled, false);
    assert.deepEqual(first.config.targets.map((x) => x.host), ["1.1.1.1", "8.8.8.8"]);

    const probed = (await t.owner.post("/api/x/latency-monitor/probe")).data;
    assert.equal(probed.series.t1.length, 1);
    assert.deepEqual([probed.stats.t1.loss, probed.stats.t1.avg > 10, probed.stats.t1.active], [0, true, null]);
    assert.ok(t.router.commands.includes("ping -c 3 -W 2 1.1.1.1"));

    // A target that is dead: two bad checks raise one alert.
    const config = { ...first.config, targets: [{ id: "t1", host: "1.1.1.1", label: "Cloudflare" }, { id: "t3", host: "192.0.2.99", label: "Old NAS" }, { id: "t4", host: "192.0.2.66", label: "Flaky" }] };
    const saved = (await t.owner.request("PUT", "/api/x/latency-monitor/config", config)).data;
    assert.deepEqual(saved.config.targets.map((x) => x.id), ["t1", "t3", "t4"]);
    await t.owner.post("/api/x/latency-monitor/probe");
    assert.equal((await t.owner.get("/api/x/latency-monitor/alerts?since=0")).data.alerts.length, 0, "one bad check is not an alert");
    const after = (await t.owner.post("/api/x/latency-monitor/probe")).data;
    const kinds = after.alerts.map((a) => [a.kind, a.target]).sort();
    assert.deepEqual(kinds, [["down", "t3"], ["lossy", "t4"]]);
    assert.match(after.alerts[0].text, /Old NAS|Flaky/);
    assert.match(after.alerts[0].textYue, /Old NAS|Flaky/);
    assert.equal(after.stats.t3.active, "down");
    assert.equal(after.stats.t3.loss, 100);
    const feed = (await t.owner.get("/api/x/latency-monitor/alerts?since=0")).data;
    assert.equal(feed.alerts.length, 2);
    assert.equal((await t.owner.get(`/api/x/latency-monitor/alerts?since=${feed.lastAlertId}`)).data.alerts.length, 0, "nothing new after the last one");

    // The target comes back: two good checks, one recovery.
    await t.owner.request("PUT", "/api/x/latency-monitor/config", { ...config, targets: [config.targets[0], { id: "t3", host: "198.51.100.50", label: "Old NAS" }, config.targets[2]] });
    await t.owner.post("/api/x/latency-monitor/probe");
    const healed = (await t.owner.post("/api/x/latency-monitor/probe")).data;
    assert.ok(healed.alerts.some((a) => a.kind === "recovered" && a.target === "t3"));

    // Bad settings are refused; clearing the history empties the charts and alerts.
    assert.equal((await t.owner.request("PUT", "/api/x/latency-monitor/config", { ...config, intervalSec: 1 })).status, 400);
    assert.equal((await t.owner.request("DELETE", "/api/x/latency-monitor/history")).status, 200);
    const cleared = (await t.owner.get("/api/x/latency-monitor/status")).data;
    assert.deepEqual([cleared.alerts.length, cleared.series.t1.length], [0, 0]);
  } finally {
    await t.stop();
  }
});

test("latency-monitor: switched on, it pings by itself; viewers can read but not change it", async () => {
  const t = await startApp();
  try {
    await t.owner.request("DELETE", "/api/x/latency-monitor/history");
    const cfg = (await t.owner.get("/api/x/latency-monitor/status")).data.config;
    const on = (await t.owner.request("PUT", "/api/x/latency-monitor/config", { ...cfg, enabled: true, intervalSec: 10, targets: [{ id: "t1", host: "1.1.1.1", label: "Cloudflare" }] })).data;
    assert.equal(on.config.enabled, true);
    const status = await waitFor(async () => {
      const s = (await t.owner.get("/api/x/latency-monitor/status")).data;
      return s.series.t1.length >= 1 ? s : null;
    });
    assert.equal(status.running, true);
    assert.ok(t.router.commands.includes("ping -c 3 -W 2 1.1.1.1"), "it pinged without being asked");
    const off = (await t.owner.request("PUT", "/api/x/latency-monitor/config", { ...cfg, enabled: false, targets: [{ id: "t1", host: "1.1.1.1", label: "Cloudflare" }] })).data;
    assert.equal(off.config.enabled, false);

    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("alex", "viewer password 1");
    assert.equal((await guest.get("/api/x/latency-monitor/status")).status, 200);
    assert.equal((await guest.get("/api/x/latency-monitor/alerts?since=0")).status, 200);
    assert.equal((await guest.request("PUT", "/api/x/latency-monitor/config", cfg)).status, 403);
    assert.equal((await guest.post("/api/x/latency-monitor/probe")).status, 403);
  } finally {
    await t.stop();
  }
});

test("latency-monitor: the browser module has a screen, a palette entry and an always-on alert overlay", () => {
  assert.equal(checkFeatureModule(feature, "latency-monitor"), null);
  assert.equal(feature.overlays[0].id, "latency-alerts");
  assert.equal(typeof feature.overlays[0].mount, "function");
});
