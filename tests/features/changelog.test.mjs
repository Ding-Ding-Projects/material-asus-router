// The changelog: CHANGELOG.md is parsed into releases with full commit SHAs,
// every referenced commit exists, typed dates are validated inline and each
// SHA is checked against GitHub without ever being called verified offline.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import feature from "../../public/js/features/changelog/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { checkDate, parseChangelog, verifySha } from "../../server/features/changelog/index.mjs";
import { startApp } from "../helpers.mjs";

const base = "/api/x/changelog";
const SHA = /\b[0-9a-f]{40}\b/g;

test("changelog: CHANGELOG.md has releases, dates, categories and full commit SHAs that exist in the project history", async () => {
  const text = await readFile("CHANGELOG.md", "utf8");
  const releases = parseChangelog(text);
  assert.ok(releases.length >= 2);
  for (const r of releases) {
    assert.match(r.version, /^[A-Za-z0-9.]+$/);
    assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(r.categories.length >= 1 && r.categories.every((c) => c.name && c.changes.length));
  }
  const shas = new Set(text.match(SHA));
  assert.ok(shas.size >= 4);
  for (const sha of shas) {
    // Every referenced commit must exist in this project's own history.
    assert.doesNotThrow(() => execFileSync("git", ["rev-parse", "--verify", "--quiet", `${sha}^{commit}`], { stdio: "ignore" }), `${sha} is not a commit in this repository`);
  }
  const parsed = releases.flatMap((r) => r.categories.flatMap((c) => c.changes.flatMap((x) => x.shas)));
  assert.deepEqual(new Set(parsed), shas, "every SHA in the file is attached to a change");
  assert.ok(releases.flatMap((r) => r.categories.flatMap((c) => c.changes)).every((x) => !/\([0-9a-f]{40}\)\s*$/.test(x.text)), "the SHA is split from the sentence");
});

test("changelog: typed dates are checked, partial or invalid ones are reported inline and the filter composes", async () => {
  assert.deepEqual(checkDate("", "fromDate"), { value: null });
  assert.deepEqual(checkDate("2026-11-25", "fromDate"), { value: "2026-11-25" });
  assert.match(checkDate("2026-1", "fromDate").error.message, /only part of a date/);
  assert.match(checkDate("2026", "fromDate").error.message, /only part of a date/);
  assert.match(checkDate("next week", "toDate").error.message, /not a date/);
  assert.match(checkDate("2026-02-30", "toDate").error.message, /not a real calendar date/);
  const t = await startApp();
  try {
    const all = (await t.owner.get(`${base}/releases`)).data;
    assert.equal(all.present, true);
    assert.ok(all.releases.length >= 2);
    assert.deepEqual((await t.owner.get(`${base}/releases?from=2026-11-25&to=2026-11-25`)).data.releases.map((r) => r.date), all.releases.map((r) => r.date));
    assert.equal((await t.owner.get(`${base}/releases?from=2099-01-01`)).data.releases.length, 0);
    const partial = (await t.owner.get(`${base}/releases?from=2026-1`)).data;
    assert.deepEqual([partial.releases.length, partial.errors[0].field], [0, "fromDate"]);
    const backwards = (await t.owner.get(`${base}/releases?from=2026-12-01&to=2026-01-01`)).data;
    assert.match(backwards.errors[0].message, /before the start/);
    assert.match((await t.owner.get(`${base}/raw`)).data.markdown, /# Changelog/);
  } finally {
    await t.stop();
  }
});

test("changelog: commit references are verified against GitHub, reported unverified offline and never called verified by guesswork", async () => {
  const realFetch = globalThis.fetch;
  const sha = "9358d7f2d562b2f9761df8835355f719e4546668";
  const t = await startApp();
  try {
    const seen = [];
    globalThis.fetch = async (url, options) => {
      if (!String(url).startsWith("https://api.github.com/")) return realFetch(url, options);
      seen.push(String(url));
      if (String(url).endsWith(sha)) return new Response("{}", { status: 200 });
      if (String(url).endsWith("0".repeat(40))) return new Response("{}", { status: 404 });
      throw new Error("offline");
    };
    assert.equal((await t.owner.get(`${base}/verify?sha=${sha}`)).data.state, "verified");
    assert.ok(seen[0].includes("/repos/Ding-Ding-Projects/material-asus-router/commits/"));
    assert.equal((await t.owner.get(`${base}/verify?sha=${"0".repeat(40)}`)).data.state, "not-found");
    const offline = (await t.owner.get(`${base}/verify?sha=${"1".repeat(40)}`)).data;
    assert.deepEqual([offline.state, offline.url], ["unverified", `https://github.com/Ding-Ding-Projects/material-asus-router/commit/${"1".repeat(40)}`]);
    assert.equal(await verifySha("2".repeat(40)), "unverified");
    for (const bad of ["abc", "G".repeat(40), `${sha}00`]) assert.equal((await t.owner.get(`${base}/verify?sha=${bad}`)).status, 400);
  } finally {
    globalThis.fetch = realFetch;
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "changelog"), null);
});

test("changelog: the viewer can copy or save its filtered view with the range and the SHAs", async () => {
  const source = await readFile("public/js/features/changelog/index.js", "utf8");
  assert.match(source, /asMarkdown/);
  assert.match(source, /x\.shas\.join\(", "\)/, "the export carries the SHAs");
  assert.match(source, /range = `\$\{view\.from \|\| "start"\} to \$\{view\.to \|\| "now"\}`/, "and the date range");
  assert.match(source, /view\.regex/, "regex search composes with the dates");
  assert.match(source, /target: "_blank", rel: "noopener noreferrer"/, "commit links are real links");
});
