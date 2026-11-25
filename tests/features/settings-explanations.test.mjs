// The inventory of every setting's explanation. It turns red when any
// catalogue setting lacks one, when two settings repeat the same text, or when
// the provenance line is missing or leaks a secret.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGuide } from "../../public/js/features/guided-forms/guide.js";
import feature from "../../public/js/features/settings-explanations/index.js";
import { explainEntry } from "../../public/js/features/settings-explanations/explain.js";
import { allEntries, assertModuleListed, catalogs } from "../nav-kit.mjs";

test("settings-explanations: every catalogue setting on both routers has a full explanation", async () => {
  const entries = await allEntries();
  for (const e of entries) {
    const x = explainEntry(e, buildGuide(e).limits);
    assert.ok(x.summary.en.length > 20 && x.summary.yue.length > 6, `${e.id} summary`);
    assert.ok(x.details.length >= 2, `${e.id} details`);
    for (const d of x.details) assert.ok(d.en && d.yue, `${e.id} detail`);
    assert.match(x.provenance.en, /^Source: /, `${e.id} provenance`);
    assert.ok(x.provenance.yue.startsWith("來源："), `${e.id} provenance in Cantonese`);
    assert.ok(x.provenance.en.includes(e.key), `${e.id} names its key`);
  }
});

test("settings-explanations: no two settings on one router share the same explanation text", async () => {
  const c = await catalogs();
  for (const [firmware, catl] of Object.entries(c)) {
    const seen = new Map();
    for (const e of catl.entries) {
      const x = explainEntry(e, buildGuide(e).limits);
      const text = [x.summary.en, ...x.details.map((d) => d.en), x.provenance.en].join("|");
      assert.ok(!seen.has(text), `${firmware}: ${e.id} repeats ${seen.get(text)}`);
      seen.set(text, e.id);
    }
  }
});

test("settings-explanations: the provenance says whether the value is written or the firmware default applies, and never shows a secret", () => {
  const base = { id: "x.a", key: "x_a", label: { en: "A", yue: "甲" }, help: { en: "Does a thing.", yue: "做一件事。" }, groupLabel: { en: "G", yue: "組" } };
  assert.match(explainEntry({ ...base, value: "42" }).provenance.en, /written on the router as x_a.*Current value: 42/);
  assert.match(explainEntry({ ...base, value: "" }).provenance.en, /not written on this router.*built-in default/);
  const secret = explainEntry({ ...base, secret: true, hasValue: true, value: "hunter2hunter2" });
  assert.ok(!JSON.stringify(secret).includes("hunter2"));
  assert.match(secret.provenance.en, /written on the router/);
  assert.match(explainEntry({ ...base, secret: true, hasValue: false, value: "" }).provenance.en, /not written/);
});

test("settings-explanations: consequences are stated: safety net, restart, disabled and optional", () => {
  const base = { id: "x.a", key: "x_a", label: { en: "A", yue: "甲" }, help: { en: "Does a thing.", yue: "做一件事。" }, value: "1" };
  const x = explainEntry({ ...base, risk: "network", restart: "restart_wireless", optional: true, disabled: { en: "Needs Merlin.", yue: "要 Merlin。" } });
  const text = x.details.map((d) => d.en).join(" ");
  assert.match(text, /safety net/);
  assert.match(text, /the Wi-Fi radios restarts/);
  assert.match(text, /optional/);
  assert.match(text, /Needs Merlin/);
});

test("settings-explanations: the All settings screen and its command exist and the module is well formed", async () => {
  await assertModuleListed("settings-explanations", feature, { style: true });
  assert.ok(feature.screens.some((s) => s.id === "all-settings"));
  assert.equal(typeof globalThis.marNav.explain.explainEntry, "function");
});
