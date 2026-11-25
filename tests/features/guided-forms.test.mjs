// Guided forms: the browser's value rules must agree with the server's on every
// catalogue entry (the direct route and the guided route have identical
// validation), and every setting gets its own unique guidance.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/guided-forms/index.js";
import { COMPLEX, buildGuide, exampleValue, isComplex } from "../../public/js/features/guided-forms/guide.js";
import { validateValue } from "../../public/js/features/guided-forms/validators.js";
import { invalidValue, knownControlTypes, sampleValue } from "../../server/router/controls.mjs";
import { allEntries, assertModuleListed } from "../nav-kit.mjs";

test("guided-forms: the guided check accepts the server's valid example and refuses its invalid one, for every catalogue entry", async () => {
  const entries = await allEntries();
  assert.ok(entries.length > 100);
  for (const e of entries) {
    const good = sampleValue(e, e.value);
    assert.equal(validateValue(e, good).ok, true, `${e.id}: ${good} should be valid`);
    const bad = invalidValue(e);
    if (bad !== null) assert.equal(validateValue(e, bad).ok, false, `${e.id}: ${bad} should be refused`);
  }
});

test("guided-forms: every control type has a worked example the checker accepts", () => {
  const sample = {
    switch: { control: "switch", values: { on: "1", off: "0" }, value: "1" },
    select: { control: "select", options: [["a", {}], ["b", {}]], value: "a" },
    segmented: { control: "segmented", options: [["a", {}], ["b", {}]], value: "a" },
    number: { control: "number", min: 1, max: 9, value: "5" },
    slider: { control: "slider", min: 0, max: 100, value: "10" },
    stepper: { control: "stepper", min: 1, max: 9, value: "2" },
    ipv4: { control: "ipv4", value: "" },
    cidr: { control: "cidr", minPrefix: 16, maxPrefix: 30, network: true, value: "" },
    range: { control: "range", within: "198.51.100.0/24", value: "" },
    port: { control: "port", allowRange: true, presets: [[8080, {}]], value: "" },
    mac: { control: "mac", value: "" },
    device: { control: "device", value: "" },
    hostname: { control: "hostname", value: "" },
    schedule: { control: "schedule", value: "" },
    chips: { control: "chips", value: "" },
    color: { control: "color", value: "" },
    file: { control: "file", maxLength: 100, value: "" },
    password: { control: "password", minLength: 8, maxLength: 63, value: "" },
    text: { control: "text", maxLength: 32, minLength: 1, value: "" },
  };
  for (const type of knownControlTypes()) assert.ok(sample[type] || ["device"].includes(type), `a sample for ${type}`);
  for (const [type, entry] of Object.entries(sample)) assert.equal(validateValue(entry, exampleValue(entry)).ok, true, `${type}: ${exampleValue(entry)}`);
});

test("guided-forms: refusals say what to fix, in both languages", () => {
  const r = validateValue({ control: "cidr", minPrefix: 8, maxPrefix: 30, network: true }, "198.51.100.5/24");
  assert.equal(r.ok, false);
  assert.match(r.reason.en, /first address/);
  assert.ok(r.reason.yue.length > 4);
  assert.equal(validateValue({ control: "port", allowRange: false }, "80:90").ok, false);
  assert.equal(validateValue({ control: "range", within: "198.51.100.0/24" }, "198.51.100.1-203.0.113.9").ok, false);
  assert.equal(validateValue({ control: "mac" }, "aa:bb:cc:dd:ee:ff").value, "AA:BB:CC:DD:EE:FF", "stored upper case");
  assert.equal(validateValue({ control: "schedule" }, "12345@10:00-09:00").ok, false);
  assert.equal(validateValue({ control: "text", maxLength: 4, minLength: 1 }, "toolong").ok, false);
});

test("guided-forms: every setting gets its own guidance, complex controls the full steps and simple ones one contextual step", async () => {
  const entries = await allEntries();
  const seen = new Map();
  for (const e of entries) {
    const g = buildGuide(e);
    assert.ok(g.steps.length >= 2 && g.example.en && g.example.yue && g.limits.en && g.limits.yue, e.id);
    for (const s of g.steps) assert.ok(s.title.en && s.title.yue && s.body.en && s.body.yue, `${e.id} step`);
    assert.equal(g.steps.length, isComplex(e) ? 3 : 2, `${e.id} step count`);
    const text = g.steps.map((s) => s.body.en).join("|") + g.example.en;
    assert.ok(text.includes(e.key), `${e.id} names its own router key`);
    seen.set(`${e.id}`, text);
  }
  const texts = [...seen.values()];
  assert.equal(new Set(texts).size, new Set(entries.map((e) => e.id)).size, "no two settings share guidance");
  assert.ok([...COMPLEX].every((c) => typeof c === "string"));
});

test("guided-forms: the sample value differs from the current value where it can", () => {
  assert.notEqual(exampleValue({ control: "switch", values: { on: "1", off: "0" }, value: "1" }), "1");
  assert.notEqual(exampleValue({ control: "select", options: [["a", {}], ["b", {}]], value: "a" }), "a");
});

test("guided-forms: the module is listed, styled and well formed and shares its engine", async () => {
  await assertModuleListed("guided-forms", feature, { style: true });
  assert.equal(typeof globalThis.marNav.guidance.build, "function");
  assert.equal(globalThis.marNav.guidance.validate, validateValue);
});
