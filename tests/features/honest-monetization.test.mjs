// Honest monetisation: the app is free, the four protected categories are
// reachable without payment, and nothing in any flow asks for money.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import feature from "../../public/js/features/honest-monetization/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { PROTECTED } from "../../server/features/honest-monetization/index.mjs";
import { startApp } from "../helpers.mjs";

const PROMO = /donat|buy me|upgrade to|go premium|premium plan|paywall|subscribe(?!\()|subscription|rate us|leave a review|leave us a review|pricing|checkout|free trial|unlock pro/i;

async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(full)));
    else if (/\.(js|mjs|css|html)$/.test(e.name)) out.push(full);
  }
  return out;
}

test("honest-monetization: the statement says free, lists the four protected categories and credits upstream", async () => {
  const t = await startApp();
  try {
    const s = (await t.owner.get("/api/x/honest-monetization/statement")).data;
    assert.deepEqual([s.free, s.paid], [true, false]);
    assert.deepEqual(s.prompts, { payments: false, donations: false, reviews: false, upgrades: false });
    assert.deepEqual(s.protectedCategories.map((c) => c.id), ["accessibility", "school-mode", "unlock-ladder", "data-export"]);
    assert.ok(s.upstream.every((u) => u.url.startsWith("https://") && u.name));
    assert.equal(PROTECTED.length, 4);
  } finally {
    await t.stop();
  }
});

test("honest-monetization: every protected category is reachable without payment", async () => {
  const screens = new Set(["feature-settings"]);
  for (const dir of await readdir("public/js/features", { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const mod = (await import(`../../public/js/features/${dir.name}/index.js`)).default;
    for (const s of mod.screens ?? []) screens.add(s.id);
    if ((mod.settings ?? []).length) screens.add("feature-settings");
  }
  for (const c of PROTECTED) assert.ok(screens.has(c.screen), `${c.id} points at ${c.screen}, which must exist`);
  assert.equal(checkFeatureModule(feature, "honest-monetization"), null);
});

test("honest-monetization: no promotional prompt or paywall exists in any feature file or in the app's own screens", async () => {
  const own = path.join("public", "js", "features", "honest-monetization");
  const sources = [...(await files(path.join("public", "js"))), ...(await files("server"))];
  assert.ok(sources.length > 30);
  for (const file of sources) {
    if (file.startsWith(own) || file.includes(path.join("server", "features", "honest-monetization"))) continue;
    const text = (await readFile(file, "utf8")).replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(text, PROMO, `${file} sounds like a promotion or a paywall`);
  }
  // The statement page itself says what it does not do, and only there.
  assert.match(await readFile(path.join(own, "index.js"), "utf8"), /never asks for money|never ask/i);
});
