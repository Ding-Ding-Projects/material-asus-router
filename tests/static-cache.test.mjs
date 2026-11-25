import assert from "node:assert/strict";
import { test } from "node:test";
import { startApp } from "./helpers.mjs";

test("static files carry a fingerprint and unchanged files answer 304", async () => {
  const t = await startApp();
  try {
    const first = await fetch(`${t.owner.base}/style.css`);
    assert.equal(first.status, 200);
    const etag = first.headers.get("etag");
    assert.match(etag ?? "", /^W\/"/);
    await first.arrayBuffer();
    const again = await fetch(`${t.owner.base}/style.css`, { headers: { "If-None-Match": etag } });
    assert.equal(again.status, 304);
    const changed = await fetch(`${t.owner.base}/style.css`, { headers: { "If-None-Match": 'W/"other"' } });
    assert.equal(changed.status, 200);
  } finally {
    await t.stop();
  }
});

test("the tab strip never makes the page wider than a narrow screen", async () => {
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(new URL("../public/js/features/tabs/style.css", import.meta.url), "utf8");
  const narrow = css.slice(css.indexOf("@media (max-width:900px)"));
  assert.match(narrow, /\.mar-tabs\[data-dock\]\{[^}]*contain:inline-size/, "on narrow screens the strip is contained to the screen width");
  assert.match(narrow, /\.mar-tabs\[data-dock\]\{[^}]*align-self:stretch/, "and stretches instead of sizing to its tabs");
});
