// Tests for vendored fonts: the committed manifest matches the files this app
// really serves (bytes and SHA-256), a changed or missing file is caught, and
// the verify route needs a session.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import browser from "../../public/js/features/vendored-fonts/index.js";
import server from "../../server/features/vendored-fonts/index.mjs";
import { verify } from "../../server/features/vendored-fonts/index.mjs";
import { SERVED, buildManifest, describeFont, sha256 } from "../../server/features/vendored-fonts/build-manifest.mjs";
import { ROOT } from "./fakes.mjs";
import { startApp } from "../helpers.mjs";

const manifestPath = path.join(ROOT, "server", "features", "vendored-fonts", "manifest.json");

test("vendored-fonts: both halves of the feature are well formed", () => {
  assert.equal(checkFeatureModule(browser, "vendored-fonts"), null);
  assert.equal(server.id, "vendored-fonts");
  assert.equal(typeof server.routes, "function");
});

test("vendored-fonts: the committed manifest is current, complete and records the real axes", async () => {
  const committed = JSON.parse(await readFile(manifestPath, "utf8"));
  const fresh = await buildManifest();
  assert.deepEqual(committed, fresh, "run node server/features/vendored-fonts/build-manifest.mjs and commit the result");
  assert.equal(committed.fonts.length, SERVED.length);
  for (const f of committed.fonts) {
    assert.match(f.sha256, /^[0-9a-f]{64}$/);
    assert.ok(f.bytes > 1000, f.file);
    assert.ok(f.license && f.version && f.package, f.file);
    assert.ok(!/https?:/.test(JSON.stringify(f)), "no remote address is recorded");
  }
  const roboto = committed.fonts.find((f) => f.family === "Roboto Flex");
  assert.ok(roboto.axes.includes("wght") && roboto.axes.includes("wdth"), "the axes the CSS uses are real axes of this file");
  const metadata = JSON.parse(await readFile(path.join(ROOT, "node_modules", "@fontsource-variable", "roboto-flex", "metadata.json"), "utf8"));
  assert.deepEqual(roboto.axes.slice().sort(), Object.keys(metadata.variable).sort(), "declares exactly the axes the font package lists, no more");
  assert.equal(committed.fonts.find((f) => f.family === "Material Symbols Rounded").axes.length, 0, "a fixed font declares no axes");
  const css = await readFile(path.join(ROOT, "public", "style.css"), "utf8");
  assert.ok(css.includes("font-weight:100 1000") && css.includes("font-stretch:25% 151%"), "the stylesheet's declared range is inside the font's real range");
  assert.ok(Number(metadata.variable.wght.min) <= 100 && Number(metadata.variable.wght.max) >= 1000);
  assert.ok(Number(metadata.variable.wdth.min) <= 25 && Number(metadata.variable.wdth.max) >= 151);
});

test("vendored-fonts: the files the server really sends have the recorded SHA-256", async () => {
  const t = await startApp();
  try {
    const committed = JSON.parse(await readFile(manifestPath, "utf8"));
    for (const f of committed.fonts) {
      const res = await fetch(t.base + f.route);
      assert.equal(res.status, 200, f.route);
      assert.match(res.headers.get("content-type"), /font\/woff2/);
      const body = Buffer.from(await res.arrayBuffer());
      assert.equal(body.length, f.bytes, `${f.file} size`);
      assert.equal(createHash("sha256").update(body).digest("hex"), f.sha256, `${f.file} digest`);
    }
    const guest = await t.client().get("/api/x/vendored-fonts/verify");
    assert.equal(guest.status, 401, "the verify route needs a session");
    const res = await t.owner.get("/api/x/vendored-fonts/verify");
    assert.equal(res.status, 200, res.text);
    assert.equal(res.data.ok, true);
    assert.equal(res.data.complete, true);
    assert.deepEqual(res.data.fonts.map((f) => f.match), [true, true]);
  } finally {
    await t.stop();
  }
});

test("vendored-fonts: a changed, missing or partial font set is caught and the manifest builder stops", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-fonts-"));
  try {
    for (const entry of SERVED) {
      const pkgDir = path.join(dir, ...entry.package.split("/"));
      await mkdir(path.join(pkgDir, "files"), { recursive: true });
      await writeFile(path.join(pkgDir, "package.json"), JSON.stringify({ version: "1.0.0", license: "OFL-1.1" }));
      await writeFile(path.join(pkgDir, "files", entry.file), Buffer.from(`font bytes for ${entry.file}`));
    }
    const built = await buildManifest(dir);
    assert.equal(built.fonts.length, 2);
    const original = await describeFont(SERVED[0], dir);
    assert.equal(original.sha256, sha256(Buffer.from(`font bytes for ${SERVED[0].file}`)));
    await writeFile(path.join(dir, ...SERVED[0].package.split("/"), "files", SERVED[0].file), Buffer.from("tampered"));
    const changed = await describeFont(SERVED[0], dir);
    assert.notEqual(changed.sha256, original.sha256, "a changed file has a different digest");
    await rm(path.join(dir, ...SERVED[1].package.split("/"), "files", SERVED[1].file));
    await assert.rejects(() => buildManifest(dir), "a missing file stops the build; a partial set is never recorded");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  const live = await verify();
  assert.equal(live.ok, true, "the real files still match");
});
