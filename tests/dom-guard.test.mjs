import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { dropNothing, realNodes } from "../public/js/dom-guard.js";
import { document, install } from "./dom-stub.mjs";

test("nothing the app passes as null, undefined or false is ever printed on the page", () => {
  const seen = [];
  const proto = { append(...items) { seen.push(["append", items]); return "kept"; }, replaceChildren(...items) { seen.push(["replaceChildren", items]); }, other() {} };
  dropNothing(proto);
  assert.equal(proto.append(null, "a", undefined, false, ["b", [null, "c"]], 0, ""), "kept", "the browser's own answer is passed on");
  proto.replaceChildren(null);
  assert.deepEqual(seen, [["append", ["a", "b", "c", 0, ""]], ["replaceChildren", []]]);
  const once = proto.append;
  dropNothing(proto);
  assert.equal(proto.append, once, "applying it twice wraps once");
  assert.deepEqual(realNodes([null, [undefined, [false]]]), []);
});

test("the address field draws four boxes and three dots, and no stray text", async () => {
  install();
  const { ipv4Field } = await import("../public/js/ipv4-field.js");
  const field = ipv4Field("1.0.0.1", () => {}, false);
  assert.deepEqual(field.el.children.map((c) => c.tag), ["input", "span", "input", "span", "input", "span", "input"]);
  assert.equal(field.el.textContent, "...", "only the dots are text");
  assert.deepEqual(field.el.children.filter((c) => c.tag === "input").map((c) => c.value), ["1", "0", "0", "1"]);
  assert.ok(document);
});

test("the guard is loaded before anything is drawn, and an address row can wrap and shrink on a narrow screen", async () => {
  const core = await readFile(new URL("../public/js/core.js", import.meta.url), "utf8");
  assert.match(core, /^import "\.\/dom-guard\.js";/m);
  assert.ok(core.indexOf('import "./dom-guard.js"') < core.indexOf("export function h("));
  const css = await readFile(new URL("../public/style.css", import.meta.url), "utf8");
  assert.match(css, /\.setting \.ctl:has\(\.ipv4\)\{flex-wrap:wrap\}/);
  assert.match(css, /\.ipv4\{[^}]*min-width:0/);
  assert.match(css, /\.ipv4 input\{[^}]*flex:1 1 48px;min-width:22px/);
});
