// "Update coming soon": while a newer build is being made on GitHub but is not
// published, this reports the build number, each stage with its own state, the
// start time, the elapsed time, a labelled estimate and what the build holds.
// Once a newer release is published it becomes an ordinary update offer.
// Nothing here installs anything, and nothing is invented: when GitHub cannot
// be reached the answer is "offline", never a guess.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID = "update-coming-soon";
const REPO = "Ding-Ding-Projects/material-asus-router";
const API = `https://api.github.com/repos/${REPO}`;
const CACHE_MS = 60 * 1000;
let cache = null;

async function currentVersion() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "package.json");
    return JSON.parse(await readFile(file, "utf8")).version;
  } catch {
    return null;
  }
}

const parts = (v) => String(v ?? "").replace(/^v/i, "").split(/[.+-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
export function newer(a, b) {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "material-asus-router" }, signal: AbortSignal.timeout(5000) });
  if (res.status === 404) return null;
  if (!res.ok) throw Object.assign(new Error(`GitHub answered ${res.status}.`), { status: res.status });
  return res.json();
}

const stateOf = (item) => (item.status === "completed" ? (item.conclusion === "success" ? "done" : item.conclusion === "skipped" ? "skipped" : item.conclusion === "cancelled" ? "cancelled" : "failed") : item.status === "in_progress" ? "running" : "waiting");

export async function readUpdate(now = Date.now()) {
  const version = await currentVersion();
  const base = { version, checkedAt: new Date(now).toISOString(), repo: REPO, installsAnything: false };
  try {
    const [latest, running, queued, recent] = await Promise.all([
      getJson(`${API}/releases/latest`),
      getJson(`${API}/actions/runs?status=in_progress&per_page=5`),
      getJson(`${API}/actions/runs?status=queued&per_page=5`),
      getJson(`${API}/actions/runs?per_page=10&exclude_pull_requests=true`),
    ]);
    const release = latest ? { tag: latest.tag_name, name: latest.name, url: latest.html_url, publishedAt: latest.published_at, notes: String(latest.body ?? "").slice(0, 4000), draft: Boolean(latest.draft), prerelease: Boolean(latest.prerelease) } : null;
    const newerRelease = release && !release.draft && !release.prerelease && version && newer(release.tag, version);
    if (newerRelease) return { ...base, state: "available", release, note: "A newer release is published. This app never installs it by itself; download it from the release page." };

    const active = [...(running?.workflow_runs ?? []), ...(queued?.workflow_runs ?? [])].sort((a, b) => b.run_number - a.run_number)[0];
    if (active) {
      const jobs = (await getJson(`${API}/actions/runs/${active.id}/jobs`))?.jobs ?? [];
      const started = active.run_started_at ?? active.created_at;
      const history = (recent?.workflow_runs ?? []).filter((r) => r.conclusion === "success" && r.name === active.name && r.run_started_at);
      const durations = history.map((r) => new Date(r.updated_at) - new Date(r.run_started_at)).filter((n) => n > 0);
      const estimateMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
      return {
        ...base,
        state: "building",
        build: { number: active.run_number, name: active.name, status: active.status, startedAt: started, elapsedSeconds: Math.max(0, Math.round((now - new Date(started)) / 1000)), commit: active.head_sha, title: active.display_title ?? active.head_commit?.message?.split("\n")[0] ?? "", url: active.html_url },
        stages: jobs.map((job) => ({ name: job.name, state: stateOf(job), startedAt: job.started_at, completedAt: job.completed_at, steps: (job.steps ?? []).map((s) => ({ name: s.name, state: stateOf(s) })) })),
        estimate: estimateMs === null ? null : { seconds: Math.round(estimateMs / 1000), basis: `the average of the last ${durations.length} successful run${durations.length === 1 ? "" : "s"} of this workflow`, label: "Estimate, not a promise" },
        note: "A newer build is being made and is not published yet. It will become an update offer when it is released.",
      };
    }
    const last = (recent?.workflow_runs ?? [])[0];
    if (last && last.status === "completed" && last.conclusion && last.conclusion !== "success") {
      const replaced = last.conclusion === "cancelled" && (recent.workflow_runs ?? []).some((r) => r.run_number > last.run_number);
      return { ...base, state: replaced ? "replaced" : "failed", build: { number: last.run_number, name: last.name, commit: last.head_sha, conclusion: last.conclusion, url: last.html_url, finishedAt: last.updated_at }, note: replaced ? "The last build was replaced by a newer one." : "The last build did not finish successfully. No new release was made from it." };
    }
    return { ...base, state: "none", release, note: "No newer build is being made, and no newer release is published." };
  } catch (error) {
    return { ...base, state: error.status ? "unknown" : "offline", note: error.status ? `GitHub could not tell (${error.message}).` : "This computer cannot reach GitHub, so nothing is known about updates. Nothing has been invented." };
  }
}

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.get("/status", async ({ query }) => {
      if (cache && Date.now() - cache.at < CACHE_MS && !query.fresh) return cache.value;
      const value = await readUpdate();
      cache = { at: Date.now(), value };
      return value;
    });
  },
};

// For tests.
export const clearCache = () => (cache = null);
