// Workflow navigation: every destination in the rail has an icon, a bilingual
// label and a real screen behind it; the audit catches a broken one.
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import feature, { auditDestinations } from "../../public/js/features/workflow-navigation/index.js";
import { assertModuleListed, catalogs } from "../nav-kit.mjs";

async function featureScreens() {
  const dir = new URL("../../public/js/features/", import.meta.url);
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === "example-uptime") continue;
    const m = (await import(new URL(`${e.name}/index.js`, dir).href)).default;
    for (const s of m.screens ?? []) out.push({ id: s.id, icon: s.icon, label: s.label });
  }
  return out;
}

test("workflow-navigation: every destination a person can reach has an icon, a bilingual label and a screen", async () => {
  const catl = (await catalogs()).merlin;
  const screens = await featureScreens();
  const destinations = [...catl.domains, ...screens];
  const screenIds = new Set([...catl.domains.map((d) => d.id), ...screens.map((s) => s.id)]);
  assert.deepEqual(auditDestinations(destinations, screenIds), []);
  for (const id of ["notifications", "shortcuts", "all-settings", "extensions", "setup", "map"]) assert.ok(screens.some((s) => s.id === id), `${id} is a screen`);
  assert.equal(new Set(destinations.map((d) => d.id)).size, destinations.length, "no destination id is used twice");
});

test("workflow-navigation: the audit reports a destination with no screen, no icon, no label or a repeated id", () => {
  const good = { id: "a", icon: "tab", label: { en: "A", yue: "甲" } };
  assert.deepEqual(auditDestinations([good], new Set(["a"])), []);
  assert.match(auditDestinations([good], new Set()).join(), /a has no screen behind it/);
  assert.match(auditDestinations([{ ...good, icon: "" }], new Set(["a"])).join(), /no icon/);
  assert.match(auditDestinations([{ ...good, label: { en: "A" } }], new Set(["a"])).join(), /no bilingual label/);
  assert.match(auditDestinations([good, good], new Set(["a"])).join(), /listed twice/);
  assert.match(auditDestinations([{}], new Set()).join(), /no id/);
});

test("workflow-navigation: the module is listed and well formed and the desktop title bar is stated as not applicable", async () => {
  await assertModuleListed("workflow-navigation", feature);
  assert.ok(feature.screens.some((s) => s.id === "map"));
});
