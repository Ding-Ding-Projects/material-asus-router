// Support tickets: a local desk that sends nothing, shows the data folder
// when a ticket is resolved, deletes nothing itself and is reachable from the
// unlock prompt, the lock setting and Help.
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import feature from "../../public/js/features/support-tickets/index.js";
import { createSelection, scopeText } from "../../public/js/features/support-tickets/selection.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { DISCLOSURE } from "../../server/features/support-tickets/index.mjs";
import { startApp } from "../helpers.mjs";

const base = "/api/x/support-tickets";

test("support-tickets: open, search, export, resolve (shows the folder, deletes nothing) and delete", async () => {
  const t = await startApp();
  const realFetch = globalThis.fetch;
  const outside = [];
  try {
    globalThis.fetch = async (url, ...rest) => (String(url).startsWith(t.base) ? realFetch(url, ...rest) : (outside.push(String(url)), Promise.reject(new Error("no outside requests"))));
    const a = (await t.owner.post(`${base}/tickets`, { subject: "Locked out of the Wi-Fi card", body: "I forgot the PIN", category: "forgot-pin" })).data;
    const b = (await t.owner.post(`${base}/tickets`, { subject: "Lost my phone", category: "lost-authenticator" })).data;
    assert.deepEqual([a.number, b.number, a.status], [1, 2, "open"]);
    assert.equal((await t.owner.post(`${base}/tickets`, { subject: "   " })).status, 400);
    assert.equal((await t.owner.post(`${base}/tickets`, { subject: "x", category: "nonsense" })).data.category, "other");

    const all = (await t.owner.get(`${base}/tickets`)).data;
    assert.equal(all.total, 3);
    assert.deepEqual(all.tickets.map((x) => x.number), [3, 2, 1], "newest first");
    assert.deepEqual((await t.owner.get(`${base}/tickets?q=phone`)).data.tickets.map((x) => x.subject), ["Lost my phone"]);
    assert.deepEqual((await t.owner.get(`${base}/tickets?q=PIN`)).data.tickets.map((x) => x.number), [1], "the body is searched too");

    const csv = (await t.owner.get(`${base}/export?format=csv`)).data.text;
    assert.match(csv, /^"number"|^number,/);
    assert.ok(csv.includes("Lost my phone"));
    const json = (await t.owner.get(`${base}/export?format=json`)).data;
    assert.equal(json.tickets.length, 3);
    assert.equal(json.disclosure, DISCLOSURE);
    assert.equal((await t.owner.get(`${base}/export?format=pdf`)).status, 400);

    // Resolving shows the data folder and removes nothing.
    const before = (await readdir(t.dir)).sort();
    const resolved = (await t.owner.post(`${base}/tickets/${a.id}/resolve`)).data;
    assert.equal(resolved.ticket.status, "resolved");
    assert.equal(path.resolve(resolved.folder.path), path.resolve(t.dir));
    assert.equal(resolved.folder.deletesNothing, true);
    assert.ok((await stat(resolved.folder.path)).isDirectory());
    assert.deepEqual((await readdir(t.dir)).filter((f) => before.includes(f)).sort(), before, "no file was deleted");
    assert.ok(resolved.folder.platform && resolved.folder.hint.includes(resolved.folder.platform) || resolved.folder.hint.includes("container"));
    assert.equal((await t.owner.get(`${base}/folder`)).data.path, resolved.folder.path);

    assert.equal((await t.owner.request("DELETE", `${base}/tickets/${b.id}`)).data.removed, true);
    assert.equal((await t.owner.request("DELETE", `${base}/tickets/${b.id}`)).status, 404);
    assert.equal(outside.length, 0, "the desk made no outside request");
  } finally {
    globalThis.fetch = realFetch;
    await t.stop();
  }
});

test("support-tickets: the disclosure is one plain line that never changes", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.get(`${base}/disclosure`)).data.text, DISCLOSURE);
    assert.match(DISCLOSURE, /Nothing you write here is sent anywhere/);
    assert.match(DISCLOSURE, /nobody reads it/);
    const css = await readFile("public/js/features/support-tickets/style.css", "utf8");
    assert.match(css, /\.tk-plain\{font:inherit;color:inherit;margin:0\}/, "the line is not styled");
    const source = await readFile("public/js/features/support-tickets/index.js", "utf8");
    assert.match(source, /class: "tk-plain"/);
    assert.doesNotMatch(source, /support@|call us|our team|agent will|we will reply/i, "no imitation of a real company's support");
    // Viewers and signed-out people cannot write tickets.
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const viewer = t.client();
    await viewer.signIn("vi", "viewer password 1");
    assert.equal((await viewer.post(`${base}/tickets`, { subject: "hi" })).status, 403);
    assert.equal((await t.client().get(`${base}/tickets`)).status, 401);
  } finally {
    await t.stop();
  }
});

test("support-tickets: the desk is reachable from the unlock prompt, the lock setting and Help", async () => {
  assert.equal(checkFeatureModule(feature, "support-tickets"), null);
  assert.deepEqual(feature.screens[0].group, { en: "Help", yue: "幫助" });
  assert.ok(feature.commands.some((c) => c.id === "support-tickets.open"), "the palette opens it");
  const locks = await readFile("public/js/features/element-locks/index.js", "utf8");
  assert.equal((locks.match(/support:open/g) ?? []).length, 1, "one shared helper emits the event");
  assert.match(locks, /support\(\)/);
  assert.match(locks, /I forgot it/, "the unlock prompt has the route");
  assert.match(locks, /How recovery works/, "the lock wizard (the lock setting) has the route");
  assert.match(await readFile("public/js/features/support-tickets/index.js", "utf8"), /bus\.on\("support:open"/);
});

test("support-tickets: the selection model handles click, shift-click, all, invert and removal", () => {
  const sel = createSelection();
  const ids = ["a", "b", "c", "d", "e"];
  sel.toggle("b", ids);
  sel.toggle("d", ids, { shift: true });
  assert.deepEqual([...sel.chosen].sort(), ["b", "c", "d"]);
  sel.invert(ids);
  assert.deepEqual([...sel.chosen].sort(), ["a", "e"]);
  sel.selectAll(ids);
  assert.equal(sel.size, 5);
  sel.keepOnly(["a", "b"]);
  assert.equal(sel.size, 2);
  sel.clear();
  assert.equal(sel.size, 0);
  const words = scopeText((en) => en, 15, 90);
  assert.match(words.page, /15 on this page/);
  assert.match(words.matches, /all 90 that match/);
});

test("support-tickets: the selection helper copies in the other feature folders are identical", async () => {
  const original = await readFile("public/js/features/support-tickets/selection.js", "utf8");
  for (const folder of ["authenticator", "bulk-actions"]) assert.equal(await readFile(`public/js/features/${folder}/selection.js`, "utf8"), original, `${folder}/selection.js differs`);
});
