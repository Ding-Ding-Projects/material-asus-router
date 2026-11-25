// Tests for the accessibility tools: read-aloud never includes secrets, hiding
// the button needs a confirmation (and Cancel comes first), reset restores it,
// and the shortcuts are documented.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { SHORTCUTS, hideMenu, readableText } from "../../public/js/features/accessibility-sizing/index.js";
import { prefs } from "../../public/js/features/material-design/prefs.js";
import { FEATURES, readSources } from "./fakes.mjs";

// A small tree that behaves enough like DOM nodes for readableText.
class Node {
  constructor(tag, attrs = {}, kids = []) { this.tag = tag; this.attrs = attrs; this.kids = kids; this.removed = false; }
  cloneNode() { return new Node(this.tag, { ...this.attrs }, this.kids.map((k) => (typeof k === "string" ? k : k.cloneNode()))); }
  remove() { this.removed = true; }
  matches(sel) {
    return sel.split(",").some((s) => {
      s = s.trim();
      const both = /^([a-z]+)\.([\w-]+)$/.exec(s);
      if (both) return this.tag === both[1] && (this.attrs.class ?? "").split(/\s+/).includes(both[2]);
      if (s.startsWith("."))return (this.attrs.class ?? "").split(/\s+/).includes(s.slice(1));
      if (s.startsWith("[")) { const [k, v] = s.slice(1, -1).split("="); return v === undefined ? k in this.attrs : String(this.attrs[k]) === v; }
      return this.tag === s;
    });
  }
  all() { return this.kids.flatMap((k) => (typeof k === "string" ? [] : [k, ...k.all()])); }
  querySelectorAll(sel) { return this.all().filter((n) => n.matches(sel)); }
  get textContent() { return this.removed ? "" : this.kids.map((k) => (typeof k === "string" ? k : k.textContent)).join(" "); }
}

test("accessibility-sizing: the module is well formed, with a toolbar button, a shortcut overlay and commands", () => {
  assert.equal(checkFeatureModule(feature, "accessibility-sizing"), null);
  assert.equal(feature.toolbar.length, 1);
  assert.equal(feature.overlays.length, 1);
  for (const id of ["accessibility-sizing.open", "accessibility-sizing.show", "accessibility-sizing.larger", "accessibility-sizing.smaller"]) assert.ok(feature.commands.some((c) => c.id === id), id);
});

test("accessibility-sizing: read-aloud skips passwords, fields, key text and hidden parts, and is bounded", () => {
  const page = new Node("main", {}, [
    new Node("h1", {}, ["Wi-Fi settings"]),
    new Node("p", {}, ["Pick a network name."]),
    new Node("input", { type: "password" }, ["hunter2-secret"]),
    new Node("input", { type: "text" }, ["field value"]),
    new Node("textarea", {}, ["private notes"]),
    new Node("div", { class: "fp" }, ["SHA256:fingerprintbytes"]),
    new Node("div", { "data-secret": "" }, ["api key 123"]),
    new Node("div", { class: "pwdbox" }, ["masked password area"]),
    new Node("pre", { class: "out" }, ["router output with tokens"]),
    new Node("span", { "aria-hidden": "true" }, ["icon_name"]),
    new Node("p", {}, ["Last line."]),
  ]);
  const text = readableText(page);
  assert.match(text, /Wi-Fi settings/);
  assert.match(text, /Pick a network name\./);
  assert.match(text, /Last line\./);
  for (const secret of ["hunter2", "field value", "private notes", "fingerprintbytes", "api key", "masked password", "router output", "icon_name"]) assert.ok(!text.includes(secret), `${secret} must not be read out`);
  const long = new Node("main", {}, [new Node("p", {}, ["word ".repeat(5000)])]);
  assert.equal(readableText(long).length, 4000);
  assert.equal(readableText(new Node("main", {}, [])), "");
});

test("accessibility-sizing: hiding the button needs a confirmation; cancelling changes nothing; reset shows it again", async () => {
  prefs.reset();
  assert.equal(prefs.get().a11yMenu, true, "visible by default");
  const asked = [];
  const ctx = (answer) => ({ t: (en) => en, confirmDialog: async (o) => { asked.push(o); return answer; } });
  assert.equal(await hideMenu(ctx(false)), false);
  assert.equal(prefs.get().a11yMenu, true, "Cancel keeps the button");
  assert.equal(asked.length, 1);
  assert.match(asked[0].body, /Ctrl\+Alt\+A/, "the confirmation says how to get the tools back");
  assert.equal(await hideMenu(ctx(true)), true);
  assert.equal(prefs.get().a11yMenu, false);
  prefs.update((d) => { d.a11yMenu = true; });
  assert.equal(prefs.get().a11yMenu, true);
  prefs.reset();
});

test("accessibility-sizing: the confirmation puts Cancel first so it is the focused button, and every shortcut is documented", async () => {
  const core = await readFile(path.join(FEATURES, "..", "core.js"), "utf8");
  const dialog = core.slice(core.indexOf("export function confirmDialog"));
  assert.ok(dialog.indexOf('t("Cancel"') < dialog.indexOf("confirm }") || dialog.indexOf('t("Cancel"') < dialog.indexOf("onClick: () => close(true)"), "Cancel is before the confirm button");
  assert.ok(dialog.indexOf("close(false)") < dialog.indexOf("close(true)"), "Cancel (false) is first in the dialog");
  const flat = SHORTCUTS.map(([keys]) => keys.join("+"));
  for (const k of ["Ctrl+K", "Ctrl+Alt+A", "Ctrl+Alt+E", "Esc", "Tab"]) assert.ok(flat.includes(k), `${k} is listed`);
  for (const [, about] of SHORTCUTS) assert.ok(about.en && about.yue);
  const src = (await readSources("accessibility-sizing"))["index.js"];
  for (const needle of ["textSize", "contrast", "reduced", "focus", "largeTargets", "speechSynthesis", "readableText"]) assert.ok(src.includes(needle), `${needle} is wired`);
  assert.ok(!/\.value\b/.test(src.slice(src.indexOf("function readAloud"), src.indexOf("async function hideMenu") > 0 ? src.indexOf("async function hideMenu") : undefined)), "read-aloud never reads field values");
});

test("accessibility-sizing: text size, contrast, focus and larger targets all change the page through the shared appearance settings", async () => {
  prefs.reset();
  prefs.update((d) => { d.textSize = 5000; d.contrast = "high"; d.focus = "thick"; d.largeTargets = true; });
  const p = prefs.get();
  assert.deepEqual([p.textSize, p.contrast, p.focus, p.largeTargets], [160, "high", "thick", true]);
  prefs.update((d) => { d.textSize = 1; });
  assert.equal(prefs.get().textSize, 80);
  prefs.reset();
  const css = await readFile(path.join(FEATURES, "material-design", "style.css"), "utf8");
  for (const rule of ["body{zoom:var(--ts", "[data-contrast=high]", "[data-focus=thick]", "[data-targets=large]", "min-height:48px"]) assert.ok(css.includes(rule), `${rule} is in the stylesheet`);
});
