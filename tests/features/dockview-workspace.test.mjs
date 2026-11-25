// Workspaces use dockview: this feature is NOT delivered and says so. The test
// keeps that status honest and fails if a hand-made splitter or another
// docking library is added in its place.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import feature, { STATUS } from "../../public/js/features/dockview-workspace/index.js";
import { assertModuleListed } from "../nav-kit.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(full)));
    else if (/\.(js|mjs|css|html)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test("dockview-workspace: it is marked in progress with what is missing, never claimed as done", () => {
  assert.equal(STATUS.state, "in-progress");
  assert.ok(STATUS.missing.length >= 4);
  assert.ok(STATUS.missing.some((m) => /dockview bundle/.test(m)));
});

test("dockview-workspace: no hand-rolled splitter and no other docking library is used", async () => {
  const forbidden = /golden-layout|goldenlayout|flexlayout|rc-dock|lumino|split-grid|splitjs|Split\.js|gridstack|react-split|class\s+\w*Splitter|\.splitter\b|col-resize|row-resize/i;
  for (const file of await files(path.join(ROOT, "public"))) {
    const source = (await readFile(file, "utf8")).replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
    assert.ok(!forbidden.test(source), `${path.relative(ROOT, file)} looks like a splitter or a docking library`);
  }
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  assert.ok(!Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((d) => /layout|dock|split/i.test(d)), "no docking dependency");
});

test("dockview-workspace: the settings card tells the person it is not available and the module is well formed", async () => {
  await assertModuleListed("dockview-workspace", feature);
  assert.equal(feature.settings.length, 1);
});
