// Update coming soon: with GitHub answers faked, the screen's data goes from
// waiting to building to published, shows an honest offline state, and nothing
// ever installs by itself.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import feature from "../../public/js/features/update-coming-soon/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { clearCache, newer, readUpdate } from "../../server/features/update-coming-soon/index.mjs";
import { startApp } from "../helpers.mjs";

const NOW = Date.parse("2026-11-25T10:30:00Z");
const run = (over) => ({ id: 7, name: "Build and release", run_number: 42, status: "in_progress", conclusion: null, run_started_at: "2026-11-25T10:20:00Z", created_at: "2026-11-25T10:19:50Z", updated_at: "2026-11-25T10:29:00Z", head_sha: "a".repeat(40), display_title: "Add a bulk action", html_url: "https://github.com/x/y/actions/runs/7", ...over });
const done = (n, minutes) => run({ id: n, run_number: n, status: "completed", conclusion: "success", run_started_at: "2026-11-24T10:00:00Z", updated_at: new Date(Date.parse("2026-11-24T10:00:00Z") + minutes * 60000).toISOString() });

// Pretends to be GitHub for the few addresses the feature asks about.
function pretendGithub(scenario) {
  return async (url) => {
    const u = String(url);
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (scenario.offline) throw new TypeError("fetch failed");
    if (scenario.status) return json({ message: "rate limited" }, scenario.status);
    if (u.endsWith("/releases/latest")) return scenario.release ? json(scenario.release) : json({}, 404);
    if (u.includes("status=in_progress")) return json({ workflow_runs: scenario.running ?? [] });
    if (u.includes("status=queued")) return json({ workflow_runs: scenario.queued ?? [] });
    if (u.includes("/jobs")) return json({ jobs: scenario.jobs ?? [] });
    if (u.includes("/actions/runs?per_page")) return json({ workflow_runs: scenario.recent ?? [] });
    return json({}, 404);
  };
}

test("update-coming-soon: a build in flight shows its number, stages, start, elapsed, a labelled estimate and what it holds", async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = pretendGithub({
      release: { tag_name: "v0.1.0", html_url: "https://github.com/x/y/releases/tag/v0.1.0", draft: false, prerelease: false },
      running: [run()],
      jobs: [{ name: "build", status: "completed", conclusion: "success", started_at: "2026-11-25T10:20:05Z", completed_at: "2026-11-25T10:25:00Z", steps: [{ name: "Checkout", status: "completed", conclusion: "success" }] }, { name: "package", status: "in_progress", conclusion: null, started_at: "2026-11-25T10:25:01Z", steps: [] }, { name: "publish", status: "queued", conclusion: null, steps: [] }],
      recent: [done(40, 12), done(39, 14), run({ id: 41, run_number: 41, status: "completed", conclusion: "failure" })],
    });
    const s = await readUpdate(NOW);
    assert.equal(s.state, "building");
    assert.equal(s.build.number, 42);
    assert.equal(s.build.startedAt, "2026-11-25T10:20:00Z");
    assert.equal(s.build.elapsedSeconds, 600);
    assert.equal(s.build.title, "Add a bulk action");
    assert.deepEqual(s.stages.map((x) => [x.name, x.state]), [["build", "done"], ["package", "running"], ["publish", "waiting"]]);
    assert.deepEqual([s.estimate.seconds, s.estimate.label], [13 * 60, "Estimate, not a promise"]);
    assert.match(s.estimate.basis, /last 2 successful runs/);
    assert.equal(s.installsAnything, false);
    assert.match(s.note, /not published yet/);
  } finally {
    globalThis.fetch = real;
  }
});

test("update-coming-soon: with no earlier run the estimate is unknown, and the build becomes an offer once published", async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = pretendGithub({ running: [run()], jobs: [], recent: [] });
    const waiting = await readUpdate(NOW);
    assert.equal(waiting.state, "building");
    assert.equal(waiting.estimate, null, "no invented estimate");
    assert.deepEqual(waiting.stages, []);

    // Published: a newer release exists, so this is the ordinary update offer.
    globalThis.fetch = pretendGithub({ release: { tag_name: "v0.2.0", name: "Second", html_url: "https://github.com/x/y/releases/tag/v0.2.0", body: "Adds bulk actions.", draft: false, prerelease: false }, running: [run()] });
    const offer = await readUpdate(NOW);
    assert.equal(offer.state, "available");
    assert.equal(offer.release.tag, "v0.2.0");
    assert.match(offer.note, /never installs/);
    // A draft or prerelease is never offered as an update.
    globalThis.fetch = pretendGithub({ release: { tag_name: "v9.0.0", draft: true, prerelease: false, html_url: "x" } });
    assert.equal((await readUpdate(NOW)).state, "none");
    globalThis.fetch = pretendGithub({ release: { tag_name: "v9.0.0", draft: false, prerelease: true, html_url: "x" } });
    assert.equal((await readUpdate(NOW)).state, "none");
  } finally {
    globalThis.fetch = real;
  }
});

test("update-coming-soon: offline, unknown, failed and replaced states are reported as they are", async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = pretendGithub({ offline: true });
    const off = await readUpdate(NOW);
    assert.equal(off.state, "offline");
    assert.match(off.note, /Nothing has been invented/);
    assert.ok(!off.build && !off.stages && !off.estimate, "no progress is made up");
    globalThis.fetch = pretendGithub({ status: 403 });
    assert.equal((await readUpdate(NOW)).state, "unknown");
    globalThis.fetch = pretendGithub({ recent: [run({ id: 9, run_number: 9, status: "completed", conclusion: "failure" })] });
    const failed = await readUpdate(NOW);
    assert.deepEqual([failed.state, failed.build.conclusion], ["failed", "failure"]);
    globalThis.fetch = pretendGithub({ recent: [run({ id: 11, run_number: 11, status: "completed", conclusion: "success" }), run({ id: 10, run_number: 10, status: "completed", conclusion: "cancelled" })].sort((a, b) => b.run_number - a.run_number) });
    assert.equal((await readUpdate(NOW)).state, "none", "the newest run succeeded");
    globalThis.fetch = pretendGithub({ recent: [run({ id: 10, run_number: 10, status: "completed", conclusion: "cancelled" }), run({ id: 11, run_number: 11, status: "completed", conclusion: "success" })] });
    assert.equal((await readUpdate(NOW)).state, "replaced", "a cancelled run with a newer one is replaced");
    globalThis.fetch = pretendGithub({});
    assert.equal((await readUpdate(NOW)).state, "none");
  } finally {
    globalThis.fetch = real;
  }
});

test("update-coming-soon: the route serves the state, versions compare, and no install action exists anywhere", async () => {
  const real = globalThis.fetch;
  const t = await startApp();
  try {
    clearCache();
    globalThis.fetch = async (url, o) => (String(url).startsWith(t.base) ? real(url, o) : pretendGithub({ offline: true })(url));
    const s = (await t.owner.get("/api/x/update-coming-soon/status?fresh=1")).data;
    assert.deepEqual([s.state, s.installsAnything, s.repo], ["offline", false, "Ding-Ding-Projects/material-asus-router"]);
    assert.ok(s.version, "the running version is shown");
    assert.equal((await t.client().get("/api/x/update-coming-soon/status")).status, 401);
    // Only a status route exists: no POST route can install.
    assert.equal((await t.owner.post("/api/x/update-coming-soon/install", {})).status, 404);
    assert.equal((await t.owner.post("/api/x/update-coming-soon/status", {})).status, 405);
  } finally {
    globalThis.fetch = real;
    clearCache();
    await t.stop();
  }
  assert.ok(newer("v0.2.0", "0.1.0") && newer("1.0.0", "0.9.9") && !newer("0.1.0", "0.1.0") && !newer("0.1.0", "0.1.1"));
  assert.equal(checkFeatureModule(feature, "update-coming-soon"), null);
  const client = await readFile("public/js/features/update-coming-soon/index.js", "utf8");
  assert.match(client, /hour12: false/, "times are 24-hour");
  assert.match(client, /never installs|Nothing installs/i);
  assert.doesNotMatch(client, /api\.post/, "the screen only reads");
});
