// DNS benchmark: timings come from the router's own clock, the ranking puts the
// fastest first and a name server that never answers last, and the settings
// decide what is asked.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { ms, rank as browserRank } from "../../public/js/features/dns-benchmark/index.js";
import { planOf, rank, settingsOf, stats } from "../../server/features/dns-benchmark/index.mjs";
import { startApp } from "../helpers.mjs";

test("dns-benchmark: statistics, ranking and the list of name servers", () => {
  const s = stats([{ ok: true, ms: 10 }, { ok: true, ms: 30 }, { ok: true, ms: 20 }, { ok: false, ms: null }]);
  assert.deepEqual([s.asked, s.failed, s.median, s.mean, s.min, s.max], [4, 1, 20, 20, 10, 30]);
  assert.equal(stats([{ ok: true, ms: 10 }, { ok: true, ms: 20 }]).median, 15);
  assert.deepEqual([stats([]).median, stats([{ ok: false, ms: null }]).median], [null, null]);
  const rows = [{ ip: "c", median: null, failed: 3 }, { ip: "b", median: 30, failed: 0 }, { ip: "a", median: 12, failed: 0 }, { ip: "d", median: 5, failed: 1 }];
  assert.deepEqual(rank(rows).map((r) => r.ip), ["a", "b", "d", "c"]);
  assert.deepEqual(browserRank(rows).map((r) => r.ip), ["a", "b", "d", "c"]);
  assert.equal(ms(12.34), "12.3 ms");
  assert.equal(ms(null), "—");

  const nvram = new Map([["mar_dnsb_resolvers", "1.1.1.1,bad,9.9.9.9"], ["mar_dnsb_names", "example.com,not a name"], ["wan0_dns", "1.1.1.1 192.0.2.53"], ["mar_dnsb_rounds", "99"]]);
  const settings = settingsOf(nvram);
  assert.deepEqual(settings.resolvers, ["1.1.1.1", "9.9.9.9"]);
  assert.deepEqual(settings.names, ["example.com"]);
  assert.equal(settings.rounds, 10);
  assert.deepEqual(planOf(settings).map((x) => [x.ip, x.router]), [["1.1.1.1", true], ["9.9.9.9", false], ["192.0.2.53", true]]);
});

test("dns-benchmark: the benchmark times each name server on the router and ranks them", async () => {
  const t = await startApp();
  try {
    const domain = (await t.owner.get("/api/domain/dns-benchmark")).data;
    assert.deepEqual(domain.plan.map((x) => x.ip), ["1.1.1.1", "8.8.8.8", "9.9.9.9"]);
    assert.equal(domain.entries.length, 5);

    // Add the server that never answers, through the change engine.
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "dns-benchmark.resolvers", value: "1.1.1.1,9.9.9.9,208.67.222.222" }, { id: "dns-benchmark.rounds", value: "2" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    const plan = (await t.owner.get("/api/domain/dns-benchmark")).data.plan;
    assert.deepEqual(plan.map((x) => x.ip), ["1.1.1.1", "9.9.9.9", "208.67.222.222", "8.8.8.8"]);

    const results = [];
    for (const server of plan) {
      const r = await t.owner.post("/api/x/dns-benchmark/bench", { ip: server.ip });
      assert.equal(r.status, 200, r.text);
      results.push(r.data);
    }
    const [cloudflare, quad9, silent, google] = results;
    assert.equal(cloudflare.asked, 6, "3 names, 2 rounds");
    assert.ok(cloudflare.median >= 10 && cloudflare.median <= 20, `median ${cloudflare.median}`);
    assert.equal(cloudflare.router, true);
    assert.equal(silent.failed, 6);
    assert.equal(silent.median, null);
    assert.deepEqual(rank(results).map((r) => r.ip), [cloudflare.ip, google.ip, quad9.ip, silent.ip]);
    assert.ok(t.router.commands.some((c) => c.includes("nslookup 'example.com' '1.1.1.1'")));

    assert.equal((await t.owner.post("/api/x/dns-benchmark/bench", { ip: "192.0.2.99" })).status, 400, "only listed name servers can be tested");
    assert.equal((await t.owner.post("/api/x/dns-benchmark/bench", { ip: "1.1.1.1; reboot" })).status, 400);
  } finally {
    await t.stop();
  }
});

test("dns-benchmark: the browser module is well formed", () => {
  assert.equal(checkFeatureModule(feature, "dns-benchmark"), null);
});
