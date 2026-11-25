// The changelog viewer's server half. It reads CHANGELOG.md (served by the app
// from the project folder), turns it into releases with version, date,
// categorised changes and full commit SHAs, filters by typed dates, and checks
// each SHA against GitHub when the computer is online. A commit that GitHub
// does not know is reported as not found; offline it is reported as unverified,
// never as verified.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID = "changelog";
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "CHANGELOG.md");
export const REPO = "Ding-Ding-Projects/material-asus-router";
const SHA = /\b[0-9a-f]{40}\b/g;
const verdicts = new Map(); // sha -> { state, at }

export function parseChangelog(markdown) {
  const releases = [];
  let release = null;
  let category = "Changes";
  for (const line of String(markdown).split(/\r?\n/)) {
    const head = line.match(/^##\s+\[?([^\]\s-][^\]]*?)\]?\s+-\s+(\d{4}-\d{2}-\d{2})\s*$/);
    if (head) {
      release = { version: head[1], date: head[2], categories: [] };
      releases.push(release);
      category = "Changes";
      continue;
    }
    if (!release) continue;
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      category = heading[1];
      continue;
    }
    const item = line.match(/^[-*]\s+(.*\S)\s*$/);
    if (item) {
      const shas = [...item[1].matchAll(SHA)].map((m) => m[0]);
      let group = release.categories.find((c) => c.name === category);
      if (!group) release.categories.push((group = { name: category, changes: [] }));
      group.changes.push({ text: item[1].replace(/\s*\((?:[0-9a-f]{40}(?:,\s*)?)+\)\s*$/, "").trim(), shas });
    }
  }
  return releases;
}

// Typed dates must be whole: 2026-11-25. Anything else is explained back.
export function checkDate(text, field) {
  const value = String(text ?? "").trim();
  if (!value) return { value: null };
  if (/^\d{4}(-\d{0,2}){0,2}$/.test(value) && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: { field, message: `"${value}" is only part of a date. Type the whole date as 2026-11-25.` } };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: { field, message: `"${value}" is not a date. Type it as 2026-11-25.` } };
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return { error: { field, message: `${value} is not a real calendar date.` } };
  return { value };
}

async function load() {
  try {
    return { markdown: await readFile(FILE, "utf8"), present: true };
  } catch {
    return { markdown: "", present: false };
  }
}

export async function verifySha(sha) {
  const known = verdicts.get(sha);
  if (known && Date.now() - known.at < 10 * 60 * 1000 && known.state !== "unverified") return known.state;
  let state = "unverified";
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${sha}`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "material-asus-router" }, signal: AbortSignal.timeout(4000) });
    if (res.status === 200) state = "verified";
    else if (res.status === 404 || res.status === 422) state = "not-found";
  } catch {
    state = "unverified";
  }
  verdicts.set(sha, { state, at: Date.now() });
  return state;
}

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.get("/releases", async ({ query }) => {
      const from = checkDate(query.from, "fromDate");
      const to = checkDate(query.to, "toDate");
      const errors = [from.error, to.error].filter(Boolean);
      if (!errors.length && from.value && to.value && from.value > to.value) errors.push({ field: "toDate", message: "The end date is before the start date." });
      const { markdown, present } = await load();
      if (!present) return { present: false, releases: [], errors, repo: REPO };
      const all = parseChangelog(markdown);
      const releases = errors.length ? [] : all.filter((r) => (!from.value || r.date >= from.value) && (!to.value || r.date <= to.value));
      return { present: true, releases, total: all.length, errors, repo: REPO, range: { from: from.value, to: to.value } };
    });

    api.get("/raw", async () => {
      const { markdown, present } = await load();
      return { present, markdown };
    });

    api.get("/verify", async ({ query, bad }) => {
      const sha = String(query.sha ?? "");
      if (!/^[0-9a-f]{40}$/.test(sha)) throw bad("A commit reference is 40 lowercase hexadecimal characters.");
      return { sha, state: await verifySha(sha), url: `https://github.com/${REPO}/commit/${sha}` };
    });
  },
};
