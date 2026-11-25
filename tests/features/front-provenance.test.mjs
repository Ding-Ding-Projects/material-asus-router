// Front-screen provenance: the version and the build time come from the
// running build, never from the launch time or a file timestamp, and a
// missing value says "unavailable".
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import feature, { formatInstant } from "../../public/js/features/front-provenance/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { isIsoInstant, readProvenance } from "../../server/features/front-provenance/index.mjs";
import { startApp } from "../helpers.mjs";

test("front-provenance: the values come from the build and each missing one is shown as unavailable", async () => {
  const full = await readProvenance({ APP_VERSION: "0.4.2", BUILD_DATE: "2026-11-25T06:03:07Z", SOURCE_REVISION: "9358D7F2D562B2F9761DF8835355F719E4546668" });
  assert.deepEqual([full.version, full.updatedAt, full.commit], ["0.4.2", "2026-11-25T06:03:07.000Z", "9358d7f2d562b2f9761df8835355f719e4546668"]);
  assert.match(full.updatedAtSource, /BUILD_DATE/);
  assert.equal(full.updatedAtUnavailable, null);

  // No build time recorded: honest unavailable, never the launch time.
  const noDate = await readProvenance({ APP_VERSION: "0.4.2" });
  assert.deepEqual([noDate.updatedAt, noDate.updatedAtSource], [null, null]);
  assert.match(noDate.updatedAtUnavailable, /did not record/);
  // A hand-typed or invalid label is not accepted as a build time.
  for (const label of ["yesterday", "2026-11-25", "now", "2026-13-45T00:00:00Z", "2026-11-25 06:03:07"]) assert.equal((await readProvenance({ BUILD_DATE: label })).updatedAt, null, label);
  assert.match((await readProvenance({ BUILD_DATE: "yesterday" })).updatedAtUnavailable, /not a valid date/);
  // A bad commit is dropped; the version falls back to the package file shipped with the build.
  const odd = await readProvenance({ SOURCE_REVISION: "not a sha" });
  assert.equal(odd.commit, null);
  assert.equal(odd.version, JSON.parse(await readFile("package.json", "utf8")).version);
  assert.match(odd.versionSource, /package\.json/);
  assert.ok(isIsoInstant("2026-11-25T06:03:07+08:00") && !isIsoInstant("2026-11-25"));
});

test("front-provenance: the time is shown in local time with seconds and a named time zone", () => {
  const text = formatInstant("2026-11-25T06:03:07Z");
  assert.match(text, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \S+ \(UTC[+-]\d{2}:\d{2}\)$/, text);
  assert.equal(formatInstant("garbage"), null);
  const d = new Date("2026-11-25T06:03:07Z");
  const offset = -d.getTimezoneOffset();
  assert.ok(text.includes(`UTC${offset >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`));
});

test("front-provenance: the route serves the provenance, needs a session and the image build passes the values in", async () => {
  const previous = { v: process.env.APP_VERSION, d: process.env.BUILD_DATE, s: process.env.SOURCE_REVISION };
  process.env.APP_VERSION = "1.2.3";
  process.env.BUILD_DATE = "2026-11-25T01:02:03Z";
  delete process.env.SOURCE_REVISION;
  const t = await startApp();
  try {
    const info = (await t.owner.get("/api/x/front-provenance/info")).data;
    assert.deepEqual([info.version, info.updatedAt, info.commit], ["1.2.3", "2026-11-25T01:02:03.000Z", null]);
    assert.match(info.beforeSignIn, /In progress/);
    assert.equal((await t.client().get("/api/x/front-provenance/info")).status, 401);
  } finally {
    for (const [key, value] of [["APP_VERSION", previous.v], ["BUILD_DATE", previous.d], ["SOURCE_REVISION", previous.s]]) value === undefined ? delete process.env[key] : (process.env[key] = value);
    await t.stop();
  }
  const dockerfile = await readFile("Dockerfile", "utf8");
  for (const name of ["APP_VERSION", "BUILD_DATE", "SOURCE_REVISION"]) assert.ok(dockerfile.includes(`${name}=\$${name}`), `${name} reaches the running container`);
  assert.equal(checkFeatureModule(feature, "front-provenance"), null);
});

test("front-provenance: the chip is built from the provenance only and has a detail view", async () => {
  const source = await readFile("public/js/features/front-provenance/index.js", "utf8");
  assert.match(source, /unavailable/);
  assert.doesNotMatch(source, /new Date\(\)|Date\.now\(\)|lastModified/, "never the clock of the moment or a file timestamp");
  assert.match(source, /openDialog/);
});
