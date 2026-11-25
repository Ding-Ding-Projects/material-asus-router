// Tests for material-design: the colour maths, the saved appearance settings,
// the theme and rainbow behaviour, the honest inventory and the component list.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/material-design/index.js";
import * as color from "../../public/js/features/material-design/color.js";
import { DEFAULTS, PALETTE, RAINBOW, RAINBOW_SETTLED_HUE, createJsonStore, createPrefs, exportPrefs, importPrefs, sanitizePrefs } from "../../public/js/features/material-design/prefs.js";
import { COMPONENTS, INVENTORY } from "../../public/js/features/material-design/inventory.js";
import { APPEARANCE_FOLDERS, BrokenStorage, MemoryStorage, readAllCss, readSources } from "./fakes.mjs";
import { startApp } from "../helpers.mjs";

const near = (a, b, tol = 1.2 / 255) => Math.abs(a - b) <= tol;
const sameColor = (p, q, tol) => near(p.r, q.r, tol) && near(p.g, q.g, tol) && near(p.b, q.b, tol);

test("material-design: the module is well formed and the server lists every appearance folder", async () => {
  assert.equal(checkFeatureModule(feature, "material-design"), null);
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    for (const name of APPEARANCE_FOLDERS) assert.ok(manifest.modules.includes(`/js/features/${name}/index.js`), `${name} is in the manifest`);
    for (const name of ["material-design", "motion", "live-charts", "color-picker", "overlay-panels", "collapse-filters", "appearance-editor", "logo-customization", "accessibility-sizing"]) assert.ok(manifest.styles.includes(`/js/features/${name}/style.css`), `${name} stylesheet is listed`);
  } finally {
    await t.stop();
  }
});

test("colour translator: every format round-trips an in-range colour, and alpha is kept", () => {
  for (const text of ["#3366cc", "#ff8800", "rebeccapurple", "rgb(10 200 30)", "hsl(210 50% 40%)", "hwb(120 10% 20%)", "oklab(0.5 0.1 -0.05)", "oklch(0.6 0.12 30)"]) {
    const p = color.parseColor(text);
    assert.equal(p.ok, true, text);
    for (const f of ["hex", "rgb", "hsl", "hsv", "hwb", "oklab", "oklch", "lab", "lch"]) {
      const back = color.parseColor(color.format(p.color, f));
      assert.equal(back.ok, true, `${text} as ${f}: ${color.format(p.color, f)}`);
      assert.ok(sameColor(p.color, back.color, f === "hex" || f === "rgb" ? 1 / 255 : 0.02), `${text} survives ${f}`);
    }
  }
  const half = color.parseColor("rgb(10 20 30 / 50%)").color;
  assert.ok(near(half.a, 0.5, 0.001));
  for (const f of ["hex8", "rgb", "hsl", "hsv", "hwb", "lab", "lch", "oklab", "oklch"]) assert.ok(near(color.parseColor(color.format(half, f)).color.a, 0.5, 0.01), `alpha survives ${f}`);
  assert.equal(color.format(color.parseColor("#ff000080").color, "hex8"), "#ff000080");
  assert.equal(color.format(color.parseColor("#f00").color, "hex"), "#ff0000");
  assert.equal(color.parseColor("cmyk(0% 100% 100% 0%)").ok, true);
  assert.equal(color.format(color.parseColor("cmyk(0% 100% 100% 0%)").color, "hex"), "#ff0000");
});

test("colour translator: named colours, nearest name, contrast and WCAG levels", () => {
  assert.equal(color.format(color.parseColor("red").color, "name"), "red");
  assert.match(color.format(color.parseColor("#fe0000").color, "name"), /^≈ red$/);
  assert.ok(Object.keys(color.NAMED).length >= 140);
  const black = { r: 0, g: 0, b: 0, a: 1 };
  const white = { r: 1, g: 1, b: 1, a: 1 };
  assert.ok(Math.abs(color.contrast(black, white) - 21) < 0.01);
  assert.equal(color.wcagLevel(21), "AAA");
  assert.equal(color.wcagLevel(4.6), "AA");
  assert.equal(color.wcagLevel(3.1), "AA large");
  assert.equal(color.wcagLevel(2), "fail");
});

test("colour translator: out-of-range colours are named, warned about, and mapped without moving hue", () => {
  const wide = color.parseColor("oklch(0.7 0.4 150)").color;
  assert.equal(color.inGamut(wide), false);
  const tr = color.translate(wide);
  assert.equal(tr.inGamut, false);
  assert.ok(tr.warnings.some((w) => /outside the sRGB range/.test(w)));
  assert.equal(color.inGamut(tr.mapped), true);
  const hue = (c) => color.toOklch(c).h;
  assert.ok(Math.abs(hue(tr.mapped) - 150) < 6, "the hue is kept");
  assert.ok(Math.abs(color.toOklch(tr.mapped).L - 0.7) < 0.03, "the lightness is kept");
  // The wide formats keep the original numbers; the sRGB formats show the mapped colour.
  assert.match(tr.rows.oklch, /^oklch\(0\.7 0\.4 150/);
  assert.ok(color.translate(color.parseColor("#336699").color).warnings.every((w) => !/outside/.test(w)));
  assert.ok(color.translate(color.parseColor("#33669980").color).warnings.some((w) => /Alpha/.test(w)));
});

test("colour parsing never silently drops a value: every bad input says what is wrong", () => {
  for (const bad of ["", "   ", "banana", "#12", "rgb(1 2)", "rgb(a b c)", "hsl(10 20)", "oklch(0.5)", "cmyk(1 2 3)", "lab(50 x 2)", "rgb(1 2 3 / 3)", "wat(1 2 3)", "color(display-p3 1 0 0)"]) {
    const p = color.parseColor(bad);
    assert.equal(p.ok, false, `${JSON.stringify(bad)} must not parse`);
    assert.ok(p.error.length > 8, `${JSON.stringify(bad)} explains itself`);
  }
  assert.equal(color.parseColor("color(srgb 0.2 0.4 0.6 / 0.5)").ok, true, "the form browsers report for computed colours parses");
});

test("appearance settings: defaults, cleaning, the rainbow sentinel and the palette", () => {
  assert.deepEqual(sanitizePrefs(undefined), sanitizePrefs({}));
  const d = sanitizePrefs({});
  assert.deepEqual([d.theme, d.density, d.font, d.textSize, d.contrast, d.focus, d.largeTargets, d.a11yMenu, d.shape], ["auto", "comfortable", "default", 100, "standard", "standard", false, true, 1]);
  const junk = sanitizePrefs({ theme: "neon", accent: "not a colour", density: 4, font: "comic", textSize: 9000, shape: -3, contrast: "x", focus: "x", largeTargets: "yes", a11yMenu: 0, panels: { "../x": { x: 1, y: 1, w: 300, h: 300 }, ok: { x: 1, y: 2, w: 300, h: 300 }, bad: { x: "a" } }, collapsed: { a: true, B: true, c: "yes" } });
  assert.deepEqual([junk.theme, junk.accent, junk.density, junk.font, junk.textSize, junk.shape, junk.contrast, junk.focus, junk.largeTargets, junk.a11yMenu], ["auto", DEFAULTS.accent, "comfortable", "default", 160, 0, "standard", "standard", false, true]);
  assert.deepEqual(Object.keys(junk.panels), ["ok"]);
  assert.deepEqual(junk.collapsed, { a: true });
  assert.equal(sanitizePrefs({ accent: RAINBOW }).accent, RAINBOW, "the rainbow is accepted as an accent");
  assert.equal(sanitizePrefs({ accent: "RGB(255 0 0)" }).accent, "#ff0000", "any colour form is stored as hex");
  assert.ok(!PALETTE.includes(RAINBOW), "the rainbow is a sentinel outside the palette");
  assert.ok(PALETTE.every((hex) => /^#[0-9a-f]{6}$/.test(hex)));
  assert.ok(RAINBOW_SETTLED_HUE >= 0 && RAINBOW_SETTLED_HUE < 360);
});

test("appearance settings persist across a restart, survive broken storage, and import and export are checked", () => {
  const storage = new MemoryStorage();
  const a = createPrefs(storage);
  a.update((p) => { p.theme = "dark"; p.textSize = 130; p.panels.demo = { x: 10, y: 10, w: 400, h: 300 }; });
  const b = createPrefs(storage); // a new store over the same storage is a restart
  assert.deepEqual([b.get().theme, b.get().textSize, b.get().panels.demo.w], ["dark", 130, 400]);
  b.reset();
  assert.equal(createPrefs(storage).get().theme, "auto");
  const broken = createPrefs(BrokenStorage);
  assert.equal(broken.update((p) => { p.theme = "light"; }), false, "a failed save is reported");
  assert.equal(broken.get().theme, "light", "the value still works for this session");

  const text = exportPrefs({ ...DEFAULTS, theme: "dark" });
  assert.equal(importPrefs(text).prefs.theme, "dark");
  assert.equal(importPrefs("nope").ok, false);
  assert.equal(importPrefs(JSON.stringify({ kind: "other", version: 1, prefs: {} })).ok, false);
  assert.equal(importPrefs("x".repeat(300000)).ok, false);
  const ev = [];
  const s = createJsonStore(new MemoryStorage(), "k", (x) => x ?? {}, () => ({}));
  s.subscribe((v) => ev.push(v));
  s.update((d) => { d.a = 1; return true; }); // returning true must not wipe the draft
  assert.deepEqual(s.get(), { a: 1 });
  assert.equal(ev.length, 1);
});

test("the rainbow settles on one hue when motion is reduced, and the theme follows the saved choice", async () => {
  const styles = new Map();
  const dataset = {};
  const classes = new Set();
  const el = { style: { setProperty: (k, v) => styles.set(k, v), removeProperty: (k) => styles.delete(k) }, dataset, classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } };
  globalThis.document = { documentElement: el };
  let systemReduced = false;
  globalThis.matchMedia = () => ({ matches: systemReduced, addEventListener() {} });
  const { applyAppearance } = await import("../../public/js/features/material-design/apply.js");
  const { prefs } = await import("../../public/js/features/material-design/prefs.js");
  try {
    prefs.update((p) => { p.accent = RAINBOW; p.motion.reduced = "on"; p.theme = "dark"; });
    applyAppearance();
    assert.equal(styles.get("--accent"), `oklch(0.55 0.17 ${RAINBOW_SETTLED_HUE})`);
    assert.equal(dataset.motion, "reduced");
    assert.equal(dataset.theme, "dark");
    assert.ok(classes.has("calm"));
    assert.equal(styles.get("--mo-page-entry-d"), "0ms");
    // Follow the system, and the system asks for reduced motion: still settled.
    prefs.update((p) => { p.motion.reduced = "system"; });
    systemReduced = true;
    applyAppearance();
    assert.equal(dataset.motion, "reduced");
    // Motion allowed: the rainbow moves, so the hue is not the settled one after a tick.
    systemReduced = false;
    prefs.update((p) => { p.motion.reduced = "off"; });
    applyAppearance();
    assert.equal(dataset.motion, "full");
    assert.equal(styles.get("--mo-page-entry-d"), "500ms");
    await new Promise((r) => setTimeout(r, 260));
    assert.notEqual(styles.get("--accent"), `oklch(0.55 0.17 ${RAINBOW_SETTLED_HUE})`);
    // A plain accent stops the rainbow.
    prefs.update((p) => { p.accent = "#336699"; p.theme = "auto"; });
    applyAppearance();
    assert.equal(styles.get("--accent"), "#336699");
    assert.equal(dataset.theme, undefined);
    assert.equal(dataset.accent, undefined);
  } finally {
    prefs.reset();
    applyAppearance();
    delete globalThis.document;
    delete globalThis.matchMedia;
  }
});

test("the completeness inventory is hand-written, bilingual and covers every requirement", () => {
  const required = ["material-design", "motion", "live-charts", "appearance-editor", "color-picker", "logo-customization", "overlay-panels", "collapse-filters", "accessibility-sizing", "functional-ui", "design-reference-parity", "design-folder", "clipping-matrix", "vendored-fonts", "app-icon"];
  assert.deepEqual(INVENTORY.map((i) => i.id), required);
  for (const i of INVENTORY) {
    assert.ok(["working", "partial", "progress"].includes(i.state), i.id);
    for (const field of ["title", "works", "missing"]) assert.ok(i[field].en.length > 8 && i[field].yue.length >= 3, `${i.id}.${field}`);
  }
  assert.ok(INVENTORY.filter((i) => i.state === "progress").length >= 3, "unfinished items stay visibly in progress");
  assert.ok(INVENTORY.every((i) => i.state !== "working"), "nothing is called fully done before it has been proved on the built app");
});

test("every Material component in the inventory exists in a stylesheet, and no surface uses a generic placeholder", async () => {
  const css = await readAllCss();
  for (const c of COMPONENTS) for (const cls of c.classes) assert.ok(new RegExp(`\\.${cls}[\\s{.:,\\[>]`).test(css), `${c.surface}: .${cls} is not styled`);
  // A native select, textarea, alert, confirm or prompt would replace a Material component with a generic one.
  for (const folder of APPEARANCE_FOLDERS) {
    for (const [file, source] of Object.entries(await readSources(folder))) {
      const code = source.replace(/^\s*\/\/.*$/gm, "");
      assert.ok(!/h\(\s*["'](select|textarea|marquee|font|center)["']/.test(code), `${folder}/${file} builds a generic element`);
      assert.ok(!/\b(alert|confirm|prompt)\(/.test(code.replace(/confirmDialog\(/g, "")), `${folder}/${file} uses a browser dialog`);
      assert.ok(!/<[a-z]+[^>]*style="/.test(code), `${folder}/${file} writes inline style markup`);
    }
  }
});
