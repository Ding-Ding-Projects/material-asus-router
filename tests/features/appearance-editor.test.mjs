// Tests for the per-element appearance editor's model: layers, the generated
// CSS (and that nothing but known properties can reach it), undo and redo, the
// append-only history, presets, copy and paste, and import and export.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { canRedo, canUndo, editorStore, mutate, redo, undo } from "../../public/js/features/appearance-editor/index.js";
import * as core from "../../public/js/features/appearance-editor/editor-core.js";

const { MATRIX, PROPS, STATES, TARGETS } = core;
const fresh = () => core.emptyEditor();

test("appearance-editor: the module is well formed, with a screen, an overlay, a toolbar button and four commands", () => {
  assert.equal(checkFeatureModule(feature, "appearance-editor"), null);
  assert.equal(feature.overlays.length, 1);
  assert.equal(feature.toolbar.length, 1);
  assert.equal(feature.commands.length, 4);
});

test("appearance-editor: sixteen element kinds, five states, twelve properties", () => {
  assert.equal(TARGETS.length, 16);
  assert.equal(STATES.length, 5);
  assert.equal(PROPS.length, 12);
  for (const t of TARGETS) assert.ok(t.selector.startsWith(".") && t.label.en && t.label.yue, t.id);
  assert.equal(new Set(TARGETS.map((t) => t.id)).size, 16);
});

test("appearance-editor: a layer becomes real CSS for the right element and state", () => {
  const d = fresh();
  core.setLayer(d, "card", "default", "radius", 12);
  core.setLayer(d, "button", "hover", "background", "#ff8800");
  core.setLayer(d, "button", "disabled", "opacity", 0.5);
  core.setLayer(d, "dialog", "default", "shadow", "e3");
  core.setLayer(d, "field", "focus", "border-color", "rgb(0 0 255)");
  const css = core.buildCss(d.layers);
  assert.match(css, /\.card\{border-radius:12px!important;\}/);
  assert.match(css, /\.btn:hover\{background-color:#ff8800!important;\}/);
  assert.match(css, /\.btn:disabled,\.btn\[aria-disabled=true\]\{opacity:0\.5!important;\}/);
  assert.match(css, /\.sheet\{box-shadow:var\(--e3\)!important;\}/);
  assert.match(css, /\.field:focus-visible\{border-color:#0000ff!important;border-style:solid!important;border-width:1\.5px!important;\}/);
  d.layers[0].on = false;
  assert.ok(!core.buildCss(d.layers).includes("border-radius"), "a hidden layer writes nothing");
});

test("appearance-editor: nothing but known properties and clean values can reach the stylesheet", () => {
  const evil = [
    { kind: "card", state: "default", prop: "background", value: "red;}body{display:none" },
    { kind: "card", state: "default", prop: "color", value: "url(javascript:alert(1))" },
    { kind: "card", state: "default", prop: "shadow", value: "0 0 0 red" },
    { kind: "card", state: "default", prop: "position", value: "fixed" },
    { kind: "nothing", state: "default", prop: "radius", value: 4 },
    { kind: "card", state: "hover; x", prop: "radius", value: 4 },
    { kind: "card", state: "default", prop: "radius", value: "4px}" },
    { kind: "card", state: "default", prop: "radius", value: Infinity },
    null,
    "text",
  ];
  assert.deepEqual(core.sanitizeLayers(evil), []);
  assert.equal(core.buildCss(core.sanitizeLayers(evil)), "");
  const good = core.sanitizeLayers([{ kind: "card", state: "default", prop: "radius", value: 9999, on: false, id: "../../x" }]);
  assert.equal(good.length, 1);
  assert.equal(good[0].value, "60", "numbers are clamped to the property's range");
  assert.equal(good[0].on, false);
  assert.match(good[0].id, /^[a-z0-9]+$/, "an unsafe id is replaced");
  assert.equal(core.sanitizeLayers(Array.from({ length: 900 }, () => ({ kind: "card", state: "default", prop: "radius", value: 3 }))).length, 400);
  for (const p of PROPS) assert.equal(typeof core.cleanValue(p.id, p.type === "color" ? "#123456" : p.type === "choice" ? p.choices[0] : p.min), "string", p.id);
});

test("appearance-editor: layers can be changed, hidden, moved and deleted, and the history only ever grows", () => {
  const d = fresh();
  core.setLayer(d, "card", "default", "radius", 4);
  core.setLayer(d, "card", "default", "radius", 8);
  assert.equal(d.layers.length, 1, "the same property of the same element is one layer");
  assert.equal(d.layers[0].value, "8");
  core.setLayer(d, "chip", "default", "color", "#112233");
  core.setLayer(d, "tag", "default", "padding", 3);
  const [a, b, c] = d.layers.map((l) => l.id);
  assert.equal(core.moveLayer(d, c, -1), true);
  assert.deepEqual(d.layers.map((l) => l.id), [a, c, b]);
  assert.equal(core.moveLayer(d, a, -1), false, "cannot move past the start");
  assert.equal(core.toggleLayer(d, a), true);
  assert.equal(d.layers[0].on, false);
  assert.equal(core.removeLayer(d, b), true);
  assert.equal(core.removeLayer(d, "missing"), false);
  assert.equal(core.setLayer(d, "card", "default", "color", "not a colour"), false);
  assert.equal(core.setLayer(d, "card", "default", "nope", 1), false);
  const lengths = [];
  const e = fresh();
  for (let i = 0; i < 12; i += 1) { core.setLayer(e, "card", "default", "radius", i); lengths.push(e.log.length); }
  assert.deepEqual(lengths, [...lengths].sort((x, y) => x - y), "the log never shrinks");
  core.clearAll(e);
  assert.equal(e.layers.length, 0);
  assert.ok(e.log.length > 12, "resetting is itself recorded");
  assert.ok(e.log.every((x) => typeof x.at === "number" && x.text.length > 3));
});

test("appearance-editor: undo and redo step through changes, and one slider drag is one step", () => {
  editorStore.replace(core.emptyEditor());
  // clear the undo history left by earlier use in this process
  while (canUndo()) undo();
  editorStore.replace(core.emptyEditor());
  assert.equal(canUndo(), false);
  mutate((d) => core.setLayer(d, "card", "default", "radius", 4), "drag");
  mutate((d) => core.setLayer(d, "card", "default", "radius", 6), "drag");
  mutate((d) => core.setLayer(d, "card", "default", "radius", 9), "drag");
  assert.equal(editorStore.get().layers[0].value, "9");
  mutate((d) => core.setLayer(d, "chip", "default", "color", "#336699"));
  assert.equal(editorStore.get().layers.length, 2);
  assert.equal(undo(), true);
  assert.equal(editorStore.get().layers.length, 1, "the chip change is undone");
  assert.equal(canRedo(), true);
  assert.equal(undo(), true);
  assert.equal(editorStore.get().layers.length, 0, "the whole drag is one undo step");
  assert.equal(undo(), false);
  assert.equal(redo(), true);
  assert.equal(editorStore.get().layers[0].value, "9");
  assert.equal(redo(), true);
  assert.equal(editorStore.get().layers.length, 2);
  assert.equal(redo(), false);
  mutate((d) => core.removeLayer(d, d.layers[0].id));
  assert.equal(canRedo(), false, "a new change ends the redo branch");
  assert.ok(editorStore.get().log.length >= 5, "undo and redo are recorded in the history");
  editorStore.replace(core.emptyEditor());
});

test("appearance-editor: presets, copy and paste style", () => {
  const d = fresh();
  core.setLayer(d, "button", "default", "background", "#336699");
  core.setLayer(d, "button", "default", "radius", 20);
  core.setLayer(d, "button", "hover", "opacity", 0.8);
  assert.equal(core.savePreset(d, "Rounded blue"), true);
  assert.equal(core.savePreset(d, "bad/name"), false);
  assert.equal(core.savePreset(d, ""), false);
  assert.equal(core.savePreset(d, "x".repeat(41)), false);
  const clip = core.copyStyle(d, "button", "default");
  assert.deepEqual(clip, [{ prop: "background", value: "#336699" }, { prop: "radius", value: "20" }]);
  assert.equal(core.pasteStyle(d, clip, "chip", "default"), 2);
  assert.ok(d.layers.some((l) => l.kind === "chip" && l.prop === "radius" && l.value === "20"));
  core.clearAll(d);
  assert.equal(core.applyPreset(d, "Rounded blue"), true);
  assert.equal(d.layers.length, 3);
  assert.equal(core.applyPreset(d, "missing"), false);
  assert.equal(core.deletePreset(d, "Rounded blue"), true);
  assert.equal(core.deletePreset(d, "Rounded blue"), false);
  assert.ok(Object.keys(core.sanitizeEditor({ presets: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`p${i}`, []])) }).presets).length <= 30);
});

test("appearance-editor: export and import round-trip, and a damaged file is reported", () => {
  const d = fresh();
  core.setLayer(d, "card", "default", "radius", 12);
  core.setLayer(d, "tag", "hover", "color", "#abcdef");
  core.savePreset(d, "Mine");
  const back = core.importEditor(core.exportEditor(d));
  assert.equal(back.ok, true);
  assert.deepEqual(back.layers.map(({ kind, state, prop, value }) => [kind, state, prop, value]), d.layers.map(({ kind, state, prop, value }) => [kind, state, prop, value]));
  assert.deepEqual(Object.keys(back.presets), ["Mine"]);
  assert.equal(back.dropped, 0);
  const mixed = core.importEditor(JSON.stringify({ kind: "material-asus-router-elements", version: 1, layers: [{ kind: "card", state: "default", prop: "radius", value: 3 }, { kind: "card", prop: "x" }, 5] }));
  assert.deepEqual([mixed.ok, mixed.layers.length, mixed.dropped], [true, 1, 2], "unreadable layers are counted");
  assert.equal(core.importEditor("{").ok, false);
  assert.equal(core.importEditor(JSON.stringify({ kind: "other", version: 1 })).ok, false);
  assert.equal(core.importEditor("x".repeat(500000)).ok, false);
});

test("appearance-editor: an element is matched to the nearest listed kind, and unlisted ones are reported", () => {
  const node = (matches, parent = null) => ({ nodeType: 1, parentElement: parent, matches: (s) => matches.includes(s) });
  const card = node([".card"]);
  const inner = node(["span"], node(["div"], card));
  const found = core.targetOf(inner);
  assert.equal(found.target.id, "card");
  assert.equal(found.element, card);
  assert.equal(core.targetOf(node(["span"], node(["div"]))), null);
  assert.equal(core.targetOf(node([".btn", ".card"])).target.id, "card", "the first listed kind wins for an element that matches two");
});

test("appearance-editor: the capability matrix covers every property and says plainly what is not supported", () => {
  for (const p of PROPS) assert.ok(MATRIX.some((m) => m.id === p.id && m.status === "working"), `${p.id} is in the matrix`);
  for (const id of ["layers", "undo", "presets", "animation"]) assert.ok(MATRIX.some((m) => m.id === id));
  const unsupported = MATRIX.filter((m) => m.status === "unsupported");
  assert.ok(unsupported.length >= 3);
  for (const m of MATRIX) { assert.ok(m.label.en && m.label.yue, m.id); assert.ok(m.how.en.length > 20 && m.how.yue.length > 4, `${m.id} explains itself`); assert.ok(["working", "partial", "unsupported"].includes(m.status)); }
});
