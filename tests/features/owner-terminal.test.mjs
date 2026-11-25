// The owner's terminal: raw shell access that only the owner can open, whose
// every session lands in the change history without the text that was typed.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/owner-terminal/index.js";
import { Client, startApp } from "../helpers.mjs";

const base = "/api/x/owner-terminal";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function readUntil(client, id, pattern, { from = 0 } = {}) {
  let text = "";
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    const r = (await client.get(`${base}/sessions/${id}?from=${from}&wait=2000`)).data;
    from = r.next;
    text += r.text;
    if (pattern.test(text) || r.closed) return { text, next: from, closed: r.closed };
  }
  throw new Error(`never saw ${pattern} in ${JSON.stringify(text)}`);
}

test("owner-terminal: the browser module has the shape the registry needs", () => {
  assert.equal(checkFeatureModule(feature, "owner-terminal"), null);
});

test("owner-terminal: an interactive shell works for the owner, and its session is written to the history without the typed text", async () => {
  const t = await startApp();
  try {
    const opened = await t.owner.post(`${base}/sessions`, { cols: 100, rows: 30 });
    assert.equal(opened.status, 200, opened.text);
    const id = opened.data.id;
    let r = await readUntil(t.owner, id, /root# $/);
    assert.match(r.text, /Welcome to the pretend router/);
    assert.equal((await t.owner.post(`${base}/sessions/${id}/input`, { data: "uname -a\r" })).status, 200);
    r = await readUntil(t.owner, id, /ASUSWRT[\s\S]*root# $/, { from: r.next });
    assert.match(r.text, /uname -a/, "what is typed is echoed by the shell");
    assert.match(r.text, /Linux RT-AX86U/);
    assert.deepEqual((await t.owner.post(`${base}/sessions/${id}/resize`, { cols: 120, rows: 40 })).data, { cols: 120, rows: 40 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(t.router.lastWindow?.cols, 120);
    assert.equal((await t.owner.get(`${base}/sessions`)).data.sessions[0].linesEntered, 1);

    // The shell ends when the person types exit.
    await t.owner.post(`${base}/sessions/${id}/input`, { data: "exit\r" });
    r = await readUntil(t.owner, id, /never matches/, { from: r.next }).catch(() => null);
    const list = (await t.owner.get(`${base}/sessions`)).data.sessions;
    assert.equal(list[0].closed, true);
    assert.equal((await t.owner.post(`${base}/sessions/${id}/input`, { data: "x" })).status, 410);

    const history = (await t.owner.get("/api/changes/history")).data.items.filter((h) => h.items[0].key === "ssh-terminal");
    assert.equal(history.length, 1);
    assert.equal(history[0].status, "recorded");
    assert.equal(history[0].canUndo, false);
    assert.equal(history[0].user, "Pat");
    assert.match(history[0].items[0].new, /Terminal session by Pat: \d+ s, 2 lines entered/);
    assert.doesNotMatch(JSON.stringify(history), /uname/, "the text typed is never recorded");
  } finally {
    await t.stop();
  }
});

test("owner-terminal: operators and viewers are refused, and nobody signed out can reach it", async () => {
  const t = await startApp();
  try {
    for (const role of ["operator", "viewer"]) await t.owner.post("/api/users", { name: role, username: role, password: "a long enough password", role });
    for (const role of ["operator", "viewer"]) {
      const c = t.client();
      await c.signIn(role, "a long enough password");
      const r = await c.post(`${base}/sessions`, { cols: 80, rows: 24 });
      assert.equal(r.status, 403, role);
      assert.equal((await c.get(`${base}/sessions`)).status, 403, `${role} cannot list sessions`);
    }
    const operator = t.client();
    await operator.signIn("operator", "a long enough password");
    assert.equal((await operator.post(`${base}/sessions`, {})).data.code, "OWNER_ONLY");
    assert.equal(t.router.shells ?? 0, 0, "no shell was ever started on the router");
    assert.equal((await new Client(t.base).post(`${base}/sessions`, {})).status, 401);
    assert.equal((await new Client(t.base).get(`${base}/assets/xterm.js`)).status, 401);
    // Someone else's session id is not theirs to use.
    const mine = (await t.owner.post(`${base}/sessions`, {})).data.id;
    assert.equal((await operator.get(`${base}/sessions/${mine}`)).status, 404);
    assert.equal((await operator.post(`${base}/sessions/${mine}/input`, { data: "x" })).status, 404);
    assert.equal((await t.owner.request("DELETE", `${base}/sessions/${mine}`)).status, 200);
  } finally {
    await t.stop();
  }
});

test("owner-terminal: sizes and the number of open terminals are limited, and the terminal files are served", async () => {
  const t = await startApp();
  try {
    const ids = [];
    for (let i = 0; i < 3; i += 1) ids.push((await t.owner.post(`${base}/sessions`, { cols: 9999, rows: 1 })).data);
    assert.deepEqual([ids[0].cols, ids[0].rows], [300, 5], "sizes are kept inside sane limits");
    assert.equal((await t.owner.post(`${base}/sessions`, {})).status, 409);
    assert.equal((await t.owner.post(`${base}/sessions/${ids[0].id}/input`, { data: "x".repeat(9000) })).status, 400);
    for (const { id } of ids) await t.owner.request("DELETE", `${base}/sessions/${id}`);

    const js = await fetch(`${t.base}${base}/assets/xterm.js`, { headers: { Cookie: t.owner.cookie } });
    assert.equal(js.status, 200);
    assert.match(js.headers.get("content-type"), /javascript/);
    assert.match((await js.text()).slice(0, 4000), /globalThis/);
    const css = await fetch(`${t.base}${base}/assets/xterm.css`, { headers: { Cookie: t.owner.cookie } });
    assert.match(css.headers.get("content-type"), /text\/css/);
    assert.equal((await t.owner.get(`${base}/assets/..%2Fpackage.json`)).status, 404);
    assert.equal((await t.owner.get(`${base}/assets/secret.js`)).status, 404);
  } finally {
    await t.stop();
  }
});

test("owner-terminal: the folder obeys the project's wording and address rules", async () => {
  const files = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else files.push(full);
    }
  };
  await walk(path.join(ROOT, "server", "features", "owner-terminal"));
  await walk(path.join(ROOT, "public", "js", "features", "owner-terminal"));
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, new RegExp(`\\b${"c"}${"at"}\\b`, "i"), `${file}: reserved word found`);
    assert.doesNotMatch(text, /\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/, `${file}: private-range address`);
    assert.doesNotMatch(text, /\b(admin|root|docker)@[0-9a-z]/i, `${file}: user@address`);
  }
});

test("owner-terminal: terminal colours reach the page without inline style text, which the policy refuses", async () => {
  const { installStyleShim } = await import("../../public/js/features/owner-terminal/styleshim.js");
  class Sheet {
    replaceSync(text) {
      this.text = text;
    }
  }
  const elementProto = { setAttribute(name, value) { (this.attrs ??= {})[name] = value; } };
  const proto = { createElement: (tag) => Object.assign(Object.create(elementProto), { tag, style: { cssText: "" } }) };
  const doc = Object.assign(Object.create(proto), { adoptedStyleSheets: [] });
  const stop = installStyleShim(doc, Sheet, elementProto);
  const div = doc.createElement("div");
  assert.equal(Object.keys(div).includes("sheet"), false, "other elements are untouched");
  const style = doc.createElement("style");
  assert.notEqual(style.tag, "style", "no real style element is ever inserted, because the policy refuses even an empty one");
  style.textContent = ".xterm-fg-1 { color: red; }";
  assert.equal(doc.adoptedStyleSheets.length, 1);
  assert.equal(doc.adoptedStyleSheets[0].text, ".xterm-fg-1 { color: red; }");
  assert.equal(style.textContent, ".xterm-fg-1 { color: red; }");
  style.textContent = ".xterm-fg-1 { color: blue; }";
  assert.equal(doc.adoptedStyleSheets.length, 1, "a rewritten rule set replaces the old one");
  assert.equal(style.sheet, doc.adoptedStyleSheets[0]);
  // A style attribute goes through the style object model instead of the refused attribute.
  div.setAttribute("style", "color: red;");
  assert.equal(div.style.cssText, "color: red;");
  assert.equal(div.attrs?.style, undefined);
  div.setAttribute("class", "x");
  assert.equal(div.attrs.class, "x", "other attributes are untouched");
  stop();
  assert.equal(elementProto.setAttribute.name, "setAttribute");
  div.setAttribute("style", "color: blue;");
  assert.equal(div.attrs.style, "color: blue;", "after uninstall the page behaves as before");
  assert.equal(doc.adoptedStyleSheets.length, 0);
  assert.equal(doc.createElement, proto.createElement, "uninstall removes the override");
});
