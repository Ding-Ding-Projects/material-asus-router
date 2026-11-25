// Tests for the colour picker's own parts: the name search with its regex mode
// (bounded and validated), saved colours with import and export and reset, and
// the rainbow sentinel that is never stored as a colour.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { exportSaved, importSaved, sanitizeSaved } from "../../public/js/features/color-picker/index.js";
import { MAX_PATTERN, compileSearch } from "../../public/js/features/color-picker/search.js";
import { NAMED } from "../../public/js/features/material-design/color.js";
import { PALETTE, RAINBOW, createJsonStore } from "../../public/js/features/material-design/prefs.js";
import { MemoryStorage, readSources } from "./fakes.mjs";

const names = Object.keys(NAMED);
const find = (spec) => { const c = compileSearch(spec); assert.equal(c.ok, true, JSON.stringify(c)); return names.filter((n) => c.test(n)); };

test("color-picker: the module is well formed and has a screen, a settings card and two commands", () => {
  assert.equal(checkFeatureModule(feature, "color-picker"), null);
  assert.equal(feature.commands.length, 2);
});

test("color-picker: plain search ignores case and empty search shows everything", () => {
  assert.equal(find({ mode: "plain", query: "" }).length, names.length);
  assert.ok(find({ mode: "plain", query: "BLUE" }).includes("darkblue"));
  assert.ok(!find({ mode: "plain", query: "blue" }).includes("red"));
  assert.deepEqual(find({ mode: "plain", query: "rebecca" }), ["rebeccapurple"]);
});

test("color-picker: regex mode matches, honours flags, and says what is wrong with a bad pattern", () => {
  assert.deepEqual(find({ mode: "regex", query: "^dark.*blue$", flags: "i" }), ["darkblue", "darkslateblue"]);
  assert.ok(find({ mode: "regex", query: "^DARK", flags: "" }).length === 0, "case matters without the i flag");
  assert.ok(find({ mode: "regex", query: "^DARK", flags: "i" }).length > 5);
  assert.ok(find({ mode: "regex", query: "gr[ae]y$" }).includes("slategray"));
  assert.equal(find({ mode: "regex", query: "" }).length, names.length);
  const bad = compileSearch({ mode: "regex", query: "([a-" });
  assert.equal(bad.ok, false);
  assert.ok(bad.error.length > 5);
  // Nothing that can hang the page is accepted, and the pattern length is bounded.
  for (const evil of ["(a+)+$", "(a*)*b", "(.*)*x", "(x{1,5})+y"]) assert.equal(compileSearch({ mode: "regex", query: evil }).ok, false, evil);
  assert.equal(compileSearch({ mode: "regex", query: "a".repeat(MAX_PATTERN + 1) }).ok, false);
  assert.equal(compileSearch({ mode: "regex", query: "a", flags: "gy" }).flags, "", "stateful flags are dropped");
  const t0 = Date.now();
  const heavy = compileSearch({ mode: "regex", query: "(a|b|c)+d" });
  names.forEach((n) => heavy.test(n));
  assert.ok(Date.now() - t0 < 200, "searching every name stays fast");
});

test("color-picker: saved colours are cleaned, deduplicated, bounded and never contain the rainbow", () => {
  const clean = sanitizeSaved({ saved: ["#336699", "#336699", "rgb(255 0 0)", "rebeccapurple", RAINBOW, "nonsense", 7, null, "#12345680"] });
  assert.deepEqual(clean.saved, ["#336699", "#ff0000", "#663399", "#12345680"]);
  assert.equal(sanitizeSaved({ saved: Array.from({ length: 100 }, (_, i) => `#${(i + 16).toString(16).padStart(2, "0")}0000`) }).saved.length, 48);
  assert.ok(!PALETTE.includes(RAINBOW));
  assert.deepEqual(sanitizeSaved(undefined), { saved: [] });
});

test("color-picker: saved colours persist across a restart, export and import with a report, and reset", () => {
  const storage = new MemoryStorage();
  const make = () => createJsonStore(storage, "colours", sanitizeSaved, () => ({ saved: [] }));
  const a = make();
  a.update((d) => { d.saved.push("#336699"); d.saved.push("#ff8800"); });
  assert.deepEqual(make().get().saved, ["#336699", "#ff8800"], "survives a restart");
  const text = exportSaved(a.get().saved);
  const ok = importSaved(text);
  assert.deepEqual([ok.ok, ok.saved, ok.dropped], [true, ["#336699", "#ff8800"], 0]);
  const partly = importSaved(JSON.stringify({ kind: "material-asus-router-colours", version: 1, saved: ["#abcdef", "garbage", RAINBOW] }));
  assert.deepEqual([partly.ok, partly.saved, partly.dropped], [true, ["#abcdef"], 2], "what could not be read is counted, not silently lost");
  assert.equal(importSaved("{").ok, false);
  assert.equal(importSaved(JSON.stringify({ kind: "nope", version: 1, saved: [] })).ok, false);
  assert.equal(importSaved(JSON.stringify({ kind: "material-asus-router-colours", version: 2, saved: [] })).ok, false);
  a.reset();
  assert.deepEqual(make().get().saved, [], "reset clears them");
});

test("color-picker: the picker has pointer and keyboard control, every format row, and the rainbow as a separate button", async () => {
  const src = (await readSources("color-picker"))["picker.js"];
  for (const key of ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "PageUp", "PageDown"]) assert.ok(src.includes(key), `${key} moves the field`);
  assert.ok(src.includes("setPointerCapture"), "dragging works");
  for (const f of ["HEX8", "RGB", "HSL", "HSV", "HWB", "CIELAB", "CIELCH", "OKLab", "OKLCH", "CMYK"]) assert.ok(src.includes(f), `${f} has an entry`);
  assert.ok(src.includes("role: \"slider\""), "the field is a labelled slider for screen readers");
  assert.ok(src.includes("aria-invalid"), "a bad entry is flagged");
  assert.ok(/Animated rainbow/.test(src) && /RAINBOW/.test(src), "the rainbow is its own choice");
});
