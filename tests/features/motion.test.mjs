// Tests for the animation and transition editor's model: kinds, profiles,
// easing, global speed, import and export, and that reduced motion always wins.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/motion/index.js";
import { DEFAULT_MOTION, EASINGS, KINDS, KIND_IDS, PROFILES, cssVars, easingCss, easingPoints, effectiveKind, exportMotion, importMotion, isReduced, parseBezier, resolveMotion, sanitizeMotion, springSamples } from "../../public/js/features/material-design/motion-engine.js";
import { readAllCss } from "./fakes.mjs";

test("motion: the module is well formed and lists the editor, its command and settings card", () => {
  assert.equal(checkFeatureModule(feature, "motion"), null);
  assert.deepEqual(feature.screens.map((s) => s.id), ["motion"]);
  assert.ok(feature.commands.some((c) => c.id === "motion.low"));
  assert.ok(feature.settings.length === 1);
});

test("motion: fourteen kinds, four profiles, every kind bilingual with a complete base", () => {
  assert.equal(KINDS.length, 14);
  assert.deepEqual(Object.keys(PROFILES), ["calm", "standard", "expressive", "playful"]);
  assert.equal(new Set(KIND_IDS).size, 14);
  for (const k of KINDS) {
    assert.ok(k.label.en && k.label.yue, k.id);
    for (const f of ["duration", "delay", "stagger", "easing", "distance", "scale"]) assert.notEqual(k.base[f], undefined, `${k.id}.${f}`);
    assert.ok(k.base.easing in EASINGS, `${k.id} uses a known easing`);
  }
});

test("motion: profiles reshape the standard values and the person's own edits win over a profile", () => {
  const calm = { ...DEFAULT_MOTION, profile: "calm" };
  const standard = { ...DEFAULT_MOTION };
  const playful = { ...DEFAULT_MOTION, profile: "playful" };
  assert.ok(effectiveKind(calm, "page-entry").duration < effectiveKind(standard, "page-entry").duration);
  assert.ok(effectiveKind(playful, "page-entry").duration > effectiveKind(standard, "page-entry").duration);
  assert.ok(effectiveKind(playful, "dialog").distance > effectiveKind(standard, "dialog").distance);
  assert.equal(effectiveKind(playful, "page-entry").easing, "spring");
  assert.equal(effectiveKind(playful, "live-pulse").duration, effectiveKind(standard, "live-pulse").duration, "the live pulse keeps its calm rhythm");
  const own = { ...playful, kinds: { "page-entry": { duration: 123, easing: "linear" } } };
  assert.equal(effectiveKind(own, "page-entry").duration, 123);
  assert.equal(effectiveKind(own, "page-entry").easing, "linear");
  assert.equal(effectiveKind(own, "dialog").easing, effectiveKind(playful, "dialog").easing);
});

test("motion: global speed, the master switch and a kind's own switch change what the page uses", () => {
  const base = resolveMotion(DEFAULT_MOTION, false).kinds["page-entry"];
  assert.equal(base.duration, 500);
  assert.equal(resolveMotion({ ...DEFAULT_MOTION, speed: 2 }, false).kinds["page-entry"].duration, 250);
  assert.equal(resolveMotion({ ...DEFAULT_MOTION, speed: 0.5 }, false).kinds["page-entry"].duration, 1000);
  assert.equal(resolveMotion({ ...DEFAULT_MOTION, master: false }, false).kinds["page-entry"].duration, 0);
  const off = resolveMotion({ ...DEFAULT_MOTION, kinds: { dialog: { enabled: false } } }, false).kinds;
  assert.equal(off.dialog.duration, 0);
  assert.equal(off["page-entry"].duration, 500, "other kinds are untouched");
});

test("motion: reduced motion always wins, from the choice, from Low stimulation or from the system", () => {
  assert.equal(isReduced({ ...DEFAULT_MOTION }, false), false);
  assert.equal(isReduced({ ...DEFAULT_MOTION }, true), true, "follow the system, system asks");
  assert.equal(isReduced({ ...DEFAULT_MOTION, reduced: "off" }, true), false, "the person allows motion over the system");
  assert.equal(isReduced({ ...DEFAULT_MOTION, reduced: "on" }, false), true);
  assert.equal(isReduced({ ...DEFAULT_MOTION, reduced: "off", low: true }, false), true, "Low stimulation composes with the system choice and wins");
  // Whatever the editor is set to, a reduced page gets no duration, delay, stagger or travel.
  const wild = sanitizeMotion({ reduced: "on", profile: "playful", speed: 3, kinds: Object.fromEntries(KIND_IDS.map((id) => [id, { duration: 4000, delay: 900, stagger: 300, distance: 100, scale: 1.4, enabled: true }])) });
  const r = resolveMotion(wild, false);
  assert.equal(r.reduced, true);
  for (const id of KIND_IDS) assert.deepEqual([r.kinds[id].duration, r.kinds[id].delay, r.kinds[id].stagger, r.kinds[id].distance, r.kinds[id].scale, r.kinds[id].enabled], [0, 0, 0, 0, 1, false], id);
  const vars = cssVars(r);
  for (const id of KIND_IDS) { assert.equal(vars[`--mo-${id}-d`], "0ms"); assert.equal(vars[`--mo-${id}-dist`], "0px"); }
});

test("motion: easing curves, the spring and the custom curve editor are valid CSS and are refused when not", () => {
  assert.equal(easingCss("standard"), "cubic-bezier(0.2, 0, 0, 1)");
  assert.equal(easingCss("linear"), "linear");
  assert.match(easingCss("spring"), /^linear\(0, /);
  const s = springSamples(EASINGS.spring.spring);
  assert.equal(s.length, 28);
  assert.equal(s[0], 0);
  assert.equal(s.at(-1), 1);
  assert.ok(Math.max(...s) > 1, "an underdamped spring overshoots");
  assert.deepEqual(parseBezier("bezier(0.1, 0.2, 0.3, 1.2)"), [0.1, 0.2, 0.3, 1.2]);
  assert.equal(easingCss("bezier(0.1,0.2,0.3,1.2)"), "cubic-bezier(0.1, 0.2, 0.3, 1.2)");
  for (const bad of ["bezier(2,0,0,1)", "bezier(0,0,0)", "bezier(a,b,c,d)", "bezier(0,9,0,1)", "url(x)", "ease; color: red"]) assert.equal(parseBezier(bad), null, bad);
  assert.equal(easingPoints("standard").length, 41);
  assert.equal(easingPoints("spring").length, 41);
});

test("motion: settings are cleaned, clamped, and exported and imported without trusting the file", () => {
  const dirty = sanitizeMotion({ reduced: "maybe", low: "yes", master: 0, profile: "wild", speed: 99, kinds: { "page-entry": { duration: -5, delay: 99999, stagger: "x", distance: 1e9, scale: 9, easing: "ease; evil", enabled: "no" }, nonsense: { duration: 5 }, dialog: { duration: 250.4, easing: "bezier(0.2,0,0,1)" } } });
  assert.equal(dirty.reduced, "system");
  assert.equal(dirty.low, false);
  assert.equal(dirty.master, true);
  assert.equal(dirty.profile, "standard");
  assert.equal(dirty.speed, 3);
  assert.deepEqual(dirty.kinds["page-entry"], { duration: 0, delay: 2000, stagger: 0, distance: 120, scale: 1.5 });
  assert.equal(dirty.kinds.nonsense, undefined);
  assert.deepEqual(dirty.kinds.dialog, { duration: 250, easing: "bezier(0.2,0,0,1)" });
  const round = importMotion(exportMotion(dirty));
  assert.equal(round.ok, true);
  assert.deepEqual(round.motion, dirty);
  assert.equal(importMotion("{").ok, false);
  assert.equal(importMotion(JSON.stringify({ kind: "x", version: 1, motion: {} })).ok, false);
});

test("motion: the stylesheet really uses every kind's values, so the editor changes the app", async () => {
  const css = await readAllCss();
  for (const id of KIND_IDS) assert.ok(css.includes(`--mo-${id}-d`), `${id} duration is used by the stylesheet`);
  for (const id of ["page-entry", "list-stagger", "dialog", "menu", "sheet", "toast", "switch", "progress", "tab-change", "hover-lift", "cards"]) assert.ok(css.includes(`--mo-${id}-ease`), `${id} easing is used`);
  assert.ok(css.includes("--mo-list-stagger-stagger"), "the stagger is used");
  assert.match(css, /:root\[data-motion=reduced\] \*[^{]*\{[^}]*animation:none!important/, "reduced motion stops all animation");
});
