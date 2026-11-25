import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { startApp } from "./helpers.mjs";

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(full)));
    else out.push(full);
  }
  return out;
}

test("every module the page imports exists and the page loads no remote assets", async () => {
  const all = await files(PUBLIC);
  const scripts = all.filter((f) => f.endsWith(".js"));
  assert.ok(scripts.length >= 13);
  for (const file of scripts) {
    const raw = await readFile(file, "utf8");
    const source = raw.replace(/^\s*\/\/.*$/gm, "");
    for (const match of source.matchAll(/from\s+"(\.[^"]+)"/g)) {
      const target = path.resolve(path.dirname(file), match[1]);
      assert.ok(all.includes(target), `${path.relative(PUBLIC, file)} imports missing ${match[1]}`);
    }
    assert.ok(!/https?:\/\//.test(source.replace(/\/\/.*$/gm, "")), `${path.relative(PUBLIC, file)} references a remote address`);
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(source), `${path.relative(PUBLIC, file)} writes HTML strings`);
    assert.ok(!/setAttribute\(\s*["']style["']/.test(source), `${path.relative(PUBLIC, file)} sets an inline style attribute`);
  }
  const html = await readFile(path.join(PUBLIC, "index.html"), "utf8");
  assert.ok(!/<style|style="|onclick=|<script(?![^>]*src=)/.test(html), "no inline styles or scripts, so the strict CSP holds");
  const css = await readFile(path.join(PUBLIC, "style.css"), "utf8");
  assert.ok(!/https?:\/\//.test(css), "the stylesheet loads nothing remote");
});

test("the server serves the page, scripts, stylesheet and both icon fonts", async () => {
  const t = await startApp();
  try {
    for (const [url, type] of [["/", "text/html"], ["/js/main.js", "text/javascript"], ["/style.css", "text/css"], ["/fonts/roboto-flex/roboto-flex-latin-full-normal.woff2", "font/woff2"], ["/fonts/material-symbols/material-symbols-rounded-latin-400-normal.woff2", "font/woff2"]]) {
      const res = await fetch(t.base + url);
      assert.equal(res.status, 200, url);
      assert.match(res.headers.get("content-type"), new RegExp(type));
    }
    assert.equal((await fetch(`${t.base}/fonts/roboto-flex/nothing.woff2`)).status, 404);
    assert.equal((await fetch(`${t.base}/js/nothing.js`)).status, 404);
  } finally {
    await t.stop();
  }
});

test("no file in the project contains a private LAN address range", async () => {
  const root = path.join(PUBLIC, "..");
  const forbidden = ["192", "168"].join(".");
  for (const dir of ["server", "public", "tests"]) {
    for (const file of await files(path.join(root, dir))) {
      if (/\.(woff2?|png|ico)$/.test(file)) continue;
      assert.ok(!(await readFile(file, "utf8")).includes(forbidden), `${path.relative(root, file)} contains a ${forbidden} address`);
    }
  }
});
