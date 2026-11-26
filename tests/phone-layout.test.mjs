// Fixes found by using the app at phone width: the bottom bar stays one row and short, the
// version chip never stretches it, the fourth confirmation key has a touch form, and a change
// to a device list is described by what it adds and removes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { deviceListSummary } from "../public/js/features/change-safety/sims/scenes.js";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

test("on a phone the bottom bar is one short row that the version chip cannot stretch", async () => {
  const css = await read("public/style.css");
  const narrow = css.slice(css.indexOf("@media (max-width:900px)"));
  assert.match(narrow, /\.rail\{[^}]*align-items:center;max-height:calc\(84px/, "items are centred, not stretched to the tallest, and the bar has a height limit");
  const chip = await read("public/js/features/front-provenance/style.css");
  assert.match(chip, /@media \(max-width:900px\)\{\s*[^}]*\.rail \.fp-chip\{[^}]*white-space:nowrap/, "the version chip stays on one line in the bottom bar");
});

test("the fourth confirmation key can be turned on a touch screen", async () => {
  const src = await read("public/js/features/change-safety/safety.js");
  assert.match(src, /No keyboard\? Tap in order:/);
  assert.match(src, /if \(input\.tapNext > 3\) input\.chord = true;/, "tapping 1, 2 and 3 in order completes the key");
  assert.match(src, /else input\.tapNext = n === 1 \? 2 : 1;/, "a wrong tap starts again");
  assert.match(src, /\[3, 1, 2\]\.map/, "the buttons are not in order, so the order has to be read");
  assert.match(src, /replace\(\/\^Your \/, "your "\)/, "a default name like Your brother reads naturally mid-sentence");
});

test("a change to a device list says what it adds and removes", () => {
  const add = deviceListSummary({ old: "<B8:27:EB:11:22:33>198.51.100.20>>nas", new: "<B8:27:EB:11:22:33>198.51.100.20>>nas<3C:22:FB:10:20:30>198.51.100.103>>kitchen-speaker" });
  assert.equal(add.en, "Adds kitchen-speaker · 198.51.100.103 · 3C:22:FB:10:20:30. 2 entries in all.");
  assert.match(add.zh, /^加入 kitchen-speaker/);
  const remove = deviceListSummary({ old: "<B8:27:EB:11:22:33>198.51.100.20>>nas", new: "" });
  assert.equal(remove.en, "Removes nas · 198.51.100.20 · B8:27:EB:11:22:33. 0 entries in all.");
  assert.match(deviceListSummary({ old: "<A>198.51.100.5>>x", new: "<A>198.51.100.5>>x" }).en, /the same 1 entry\./);
});
