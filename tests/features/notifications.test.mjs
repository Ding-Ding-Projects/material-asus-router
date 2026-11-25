// Notification history as data: errors persist, calm toasts leave, history is
// bounded, searchable, filterable and bulk-manageable.
import assert from "node:assert/strict";
import { test } from "node:test";
import feature from "../../public/js/features/notifications/index.js";
import { MAX_HISTORY, addEntry, filterHistory, makeEntry, markRead, removeEntries, sanitize, toastTtl, unreadCount } from "../../public/js/features/notifications/notify-model.js";
import { assertModuleListed } from "../nav-kit.mjs";

const e = (kind, text, now) => makeEntry({ kind, text }, now);

test("notifications: errors and warnings stay until dismissed, the rest leave by themselves", () => {
  assert.equal(toastTtl("bad"), 0);
  assert.equal(toastTtl("warn"), 0);
  assert.ok(toastTtl("good") > 0);
  assert.ok(toastTtl("info") > 0);
});

test("notifications: entries are shaped safely and the history is bounded and newest first", () => {
  assert.equal(makeEntry({ kind: "", text: "x" }).kind, "good", "the stock empty kind means success");
  assert.equal(makeEntry({ kind: "weird", text: "x" }).kind, "info");
  assert.equal(makeEntry({ text: "y".repeat(1000) }).text.length, 400);
  let h = [];
  for (let i = 0; i < MAX_HISTORY + 20; i++) h = addEntry(h, e("info", `n${i}`, 1000 + i));
  assert.equal(h.length, MAX_HISTORY);
  assert.equal(h[0].text, `n${MAX_HISTORY + 19}`);
  const same = addEntry(h, { ...h[0], text: "again" });
  assert.equal(same.length, MAX_HISTORY, "the same id replaces itself");
});

test("notifications: filtering by kind, read state and a search test, and counting unread", () => {
  let h = [e("bad", "Router lost", 1), e("good", "Saved", 2), e("warn", "Slow link", 3), e("good", "Router back", 4)];
  assert.equal(unreadCount(h), 4);
  assert.deepEqual(filterHistory(h, { kind: "good" }).map((n) => n.text), ["Saved", "Router back"]);
  assert.deepEqual(filterHistory(h, { test: (s) => /^router/i.test(s) }).map((n) => n.text), ["Router lost", "Router back"]);
  h = markRead(h, [h[0].id, h[1].id]);
  assert.equal(unreadCount(h), 2);
  assert.deepEqual(filterHistory(h, { read: "unread" }).map((n) => n.text), ["Slow link", "Router back"]);
  assert.deepEqual(filterHistory(h, { read: "read", kind: "bad" }).map((n) => n.text), ["Router lost"]);
  assert.equal(unreadCount(markRead(h, [h[0].id], false)), 3, "mark unread");
});

test("notifications: bulk dismiss removes exactly the chosen ones", () => {
  const h = [e("info", "a", 1), e("info", "b", 2), e("info", "c", 3)];
  assert.deepEqual(removeEntries(h, [h[0].id, h[2].id]).map((n) => n.text), ["b"]);
  assert.deepEqual(removeEntries(h, []), h);
});

test("notifications: stored history is sanitised on load", () => {
  assert.deepEqual(sanitize(null), []);
  assert.deepEqual(sanitize([{ id: "1", kind: "bad", text: "ok" }, { id: 2, kind: "bad", text: "no" }, { id: "3", kind: "x", text: "no" }, null]).map((n) => n.id), ["1"]);
});

test("notifications: the module is listed, styled, has a centre screen and the bell shortcut", async () => {
  await assertModuleListed("notifications", feature, { style: true });
  assert.ok(feature.screens.some((s) => s.id === "notifications"));
  assert.ok((globalThis.marNav.shortcutQueue ?? []).some((d) => d.id === "notifications.open"));
});
