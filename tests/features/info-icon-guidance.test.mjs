// The per-control info icon: it offers every part of the guide for every
// setting, uses made-up examples (never the current value), and never starts
// a real operation.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { buildGuide } from "../../public/js/features/guided-forms/guide.js";
import feature, { INFO_PANEL_PARTS } from "../../public/js/features/info-icon-guidance/index.js";
import { allEntries, assertModuleListed } from "../nav-kit.mjs";

test("info-icon-guidance: every catalogue setting has an explanation, steps, a worked example and a practice value", async () => {
  assert.deepEqual(INFO_PANEL_PARTS, ["explanation", "steps", "example", "practice"]);
  for (const e of await allEntries()) {
    const g = buildGuide(e);
    assert.ok(g.steps[0].body.en.includes(e.help.en), `${e.id} explanation uses its own help`);
    assert.ok(g.steps.length >= 2, `${e.id} steps`);
    assert.ok(g.example.en.length > 10, `${e.id} example`);
    assert.notEqual(g.sample, undefined, `${e.id} practice value`);
  }
});

test("info-icon-guidance: the practice value is never the current secret value", async () => {
  for (const e of (await allEntries()).filter((x) => x.secret)) {
    const g = buildGuide({ ...e, value: "do-not-copy-this" });
    assert.ok(!JSON.stringify(g).includes("do-not-copy-this"), e.id);
  }
});

test("info-icon-guidance: the icon opens the guide and nothing else, so it can never start an operation", async () => {
  const source = await readFile(new URL("../../public/js/features/info-icon-guidance/index.js", import.meta.url), "utf8");
  assert.ok(!/api\.(post|patch|del)|dock\.|setEntry|fetch\(/.test(source), "no write, no dock edit, no network call");
  assert.match(source, /guidance\.open\(ctx, entry, \{ wizard: false \}\)/);
  assert.match(source, /aria-label/);
  assert.match(source, /aria-haspopup/);
});

test("info-icon-guidance: the module is listed, styled and well formed", async () => {
  await assertModuleListed("info-icon-guidance", feature, { style: true });
});
