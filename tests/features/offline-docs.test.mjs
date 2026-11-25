// Offline documentation: every article and wiki file on disk is in the bundle,
// pages read without the internet, traversal is refused, and the Markdown
// reader resolves links inside the app and never turns text into markup.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import feature from "../../public/js/features/offline-docs/index.js";
import { parseInline, parseMarkdown, resolveLink, slugify } from "../../public/js/features/offline-docs/markdown.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { frontMatter } from "../../server/features/offline-docs/index.mjs";
import { startApp } from "../helpers.mjs";

const base = "/api/x/offline-docs";

async function markdownFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await markdownFiles(full)));
    else if (e.name.endsWith(".md") && e.name !== "README.md") out.push(full);
  }
  return out;
}

test("offline-docs: the bundle holds every article and wiki file on disk, with the right titles", async () => {
  const t = await startApp();
  const realFetch = globalThis.fetch;
  const outside = [];
  try {
    globalThis.fetch = async (url, ...rest) => (String(url).startsWith(t.base) ? realFetch(url, ...rest) : (outside.push(String(url)), Promise.reject(new Error("offline"))));
    const index = (await t.owner.get(`${base}/index`)).data;
    const onDisk = [...(await markdownFiles("docs/articles")), ...(await markdownFiles("docs/wiki"))].map((f) => f.split(path.sep).join("/"));
    assert.equal(index.present, true);
    assert.equal(index.fileCount, onDisk.length, "every Markdown file is in the bundle");
    const listed = new Set(index.articles.flatMap((a) => a.files.map((f) => `docs/${f}`)));
    for (const file of onDisk) assert.ok(listed.has(file), `${file} is missing from the bundle`);
    for (const entry of index.articles) {
      const english = entry.files.find((f) => !f.endsWith(".zh-HK.md"));
      const { meta } = frontMatter(await readFile(path.join("docs", english), "utf8"));
      assert.equal(entry.title, meta.title, `${entry.slug} title matches its file`);
      assert.ok(entry.category && entry.slug);
    }
    assert.ok(index.articles.some((a) => a.slug === "start/quick-tour") && index.articles.some((a) => a.slug === "wiki:home"));
    assert.ok(index.count >= 99);
    // Reading and searching make no outside request.
    const page = (await t.owner.get(`${base}/article?slug=start/quick-tour`)).data;
    assert.ok(page.markdown.length > 100 && page.lang === "en");
    const yue = (await t.owner.get(`${base}/article?slug=start/quick-tour&lang=yue`)).data;
    assert.equal(yue.lang, "yue");
    assert.notEqual(yue.title, page.title);
    assert.equal((await t.owner.get(`${base}/article?slug=wiki:home`)).status, 200);
    const corpus = (await t.owner.get(`${base}/corpus?lang=en`)).data;
    assert.equal(corpus.pages.length, index.count);
    assert.equal(outside.length, 0, "works offline");
  } finally {
    globalThis.fetch = realFetch;
    await t.stop();
  }
});

test("offline-docs: unknown pages are 404 and path tricks are refused", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.get(`${base}/article?slug=start/no-such-page`)).status, 404);
    for (const slug of ["../../package", "..%2F..%2Fpackage", "start/../../package", "/etc/passwd", "C:/Windows/win", "a/b/c", ""]) assert.equal((await t.owner.get(`${base}/article?slug=${slug}`)).status, 400, slug);
    assert.equal((await t.client().get(`${base}/index`)).status, 401);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "offline-docs"), null);
});

test("offline-docs: links resolve inside the app, to the wiki, to GitHub files and to outside sites", () => {
  assert.deepEqual(resolveLink("../safety/connection-guard.md", "app/exports"), { page: "safety/connection-guard", anchor: "" });
  assert.deepEqual(resolveLink("undo-changes.md#how", "safety/connection-guard"), { page: "safety/undo-changes", anchor: "how" });
  assert.deepEqual(resolveLink("../articles/router/wifi.md", "wiki:home"), { page: "router/wifi", anchor: "" });
  assert.deepEqual(resolveLink("home.md", "wiki:glossary"), { page: "wiki:home", anchor: "" });
  assert.deepEqual(resolveLink("#section", "app/exports"), { page: "app/exports", anchor: "section" });
  assert.equal(resolveLink("https://example.com/x", "a/b").external, true);
  assert.match(resolveLink("../../compose.yaml", "app/exports").href, /^https:\/\/github\.com\/Ding-Ding-Projects\/material-asus-router\//);
  assert.deepEqual(parseInline("see [[router/wifi|the Wi-Fi guide]] now", "app/x")[1], { text: "the Wi-Fi guide", link: { page: "router/wifi", anchor: "" } });
  assert.equal(slugify("What it is for"), "what-it-is-for");
});

test("offline-docs: the reader builds headings, lists, tables, code and callouts and never turns text into markup", () => {
  const md = ["# Title", "", "Some **bold** and `code` and *soft* text with <script>alert(1)</script>.", "", "- one", "- two [link](../a/b.md)", "", "1. first", "", "| A | B |", "| --- | --- |", "| 1 | 2 \\| x |", "", "```js", "const x = '<b>';", "```", "", "> [!NOTE]", "> be careful", ""].join("\n");
  const blocks = parseMarkdown(md, "app/x");
  assert.deepEqual(blocks.map((b) => b.type), ["h", "p", "ul", "ol", "table", "code", "quote"]);
  assert.equal(blocks[0].id, "title");
  const text = JSON.stringify(blocks[1]);
  assert.ok(text.includes("<script>alert(1)</script>") && !blocks[1].inline.some((p) => p.html !== undefined), "markup stays as plain text");
  assert.deepEqual(blocks[2].items[1].find((p) => p.link).link, { page: "a/b", anchor: "" });
  assert.deepEqual(blocks[4].rows[0].map((c) => c.map((p) => p.text).join("")), ["1", "2 | x"]);
  assert.equal(blocks[5].text, "const x = '<b>';");
  assert.deepEqual([blocks[6].kind, blocks[6].blocks[0].type], ["note", "p"]);
});

test("offline-docs: every bundled article parses without a block the reader cannot handle", async () => {
  const files = [...(await markdownFiles("docs/articles")), ...(await markdownFiles("docs/wiki"))];
  let parsed = 0;
  for (const file of files) {
    const { body } = frontMatter(await readFile(file, "utf8"));
    const blocks = parseMarkdown(body, "app/x");
    assert.ok(blocks.length > 0, `${file} produced nothing`);
    parsed++;
  }
  assert.equal(parsed, files.length);
});
