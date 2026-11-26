// The page must not scroll past the app. The body keeps the app's line breaks for its children only:
// with white-space: pre-line on the body itself, the line breaks between the top-level elements of
// index.html turned into blank lines above and below the app, so the page scrolled on past its end
// and the side navigation slid up off the screen, leaving an empty band under it.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("the body keeps line breaks for the app only, so the page ends where the app ends", async () => {
  const css = await readFile(new URL("../public/style.css", import.meta.url), "utf8");
  const body = css.match(/(?:^|\n)body\{([^}]*)\}/);
  assert.ok(body, "the body rule exists");
  assert.doesNotMatch(body[1], /white-space\s*:\s*pre/, "the body itself does not keep the whitespace between top-level elements");
  assert.match(css, /(?:^|\n)body>\*\{white-space:pre-line\}/, "the app and the overlays still keep their own line breaks");
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /<div id="app"/);
});
