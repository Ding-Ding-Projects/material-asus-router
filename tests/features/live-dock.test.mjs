// The pending-changes bar in Live and Review mode, run in Node against the real server and the
// pretend router with the small DOM stand-in. It draws the real bar, makes real edits and waits for
// the bar to act. It proves the bar and the server agree; it is not a layout or visual check.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { startApp, waitFor } from "../helpers.mjs";
import { Element, document, install } from "../dom-stub.mjs";

install();
Object.defineProperty(Element.prototype, "parentNode", { get() { return this.parent; }, configurable: true });
const core = await import("../../public/js/core.js");
const { app, dock, renderDock, LIVE_PAUSE_MS } = await import("../../public/js/dock.js");
const { loadSafety, safety, setLiveMode } = await import("../../public/js/features/change-safety/safety.js");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dialogs = () => document.body.children.filter((c) => c.tag === "dialog" && c.open);
const button = (root, text) => root.all("button").find((b) => b.textContent.includes(text));

async function boot(options) {
  const t = await startApp(options);
  const real = globalThis.fetch;
  globalThis.fetch = (url, init = {}) => real(url.startsWith("/") ? t.base + url : url, { ...init, headers: { ...(init.headers ?? {}), Cookie: t.owner.cookie } });
  core.auth.csrf = t.owner.csrf;
  document.body.children = [];
  dock.clear();
  app.canWrite = true;
  app.catalog = await core.api.get("/api/catalog");
  await loadSafety({ role: "owner" });
  const bar = core.h("div", { class: "dock" });
  // The same two subscriptions the shell makes.
  const offs = [core.bus.on("dock", () => renderDock(bar)), core.bus.on("safety", () => renderDock(bar))];
  renderDock(bar);
  const entry = (id) => app.catalog.entries.find((e) => e.id === id);
  return {
    t, bar, entry,
    async stop() {
      offs.forEach((f) => f());
      dock.clear();
      for (const d of dialogs()) (button(d, "Close") ?? button(d, "Hide") ?? button(d, "Cancel"))?.click();
      await sleep(700); // lets a progress timeline finish its last read
      globalThis.fetch = real;
      await t.stop();
    },
  };
}

test("live mode: a change that people at home notice applies by itself, with nothing to review", async () => {
  const s = await boot();
  try {
    const up = s.entry("qos.up");
    assert.ok(up.impact.level >= 1, "this change is above Level 0");
    assert.equal(safety.live, true);
    dock.setEntry(up, "21000");
    assert.equal(s.bar.hidden, false);
    assert.match(s.bar.textContent, /applies by itself in a moment/);
    assert.ok(button(s.bar, "Apply now"));
    assert.equal(button(s.bar, "Review"), undefined, "the bar does not ask for a review in Live mode");
    assert.equal(s.t.router.nvram.qos_obw, "20000", "nothing is written during the pause");
    await waitFor(() => s.t.router.nvram.qos_obw === "21000", { timeoutMs: LIVE_PAUSE_MS + 8000 });
    await waitFor(() => dock.count() === 0);
    assert.equal(s.bar.hidden, true);
  } finally {
    await s.stop();
  }
});

test("live mode: a change that needs the keys asks for them by itself, once, and waits if they are refused", async () => {
  const s = await boot({ safety: { fourKey: true } });
  try {
    // The household chose Level 0, so this Level 1 change is above what it chose and takes the keys.
    assert.equal((await s.t.owner.request("PUT", "/api/household", { madness: 0 })).status, 200);
    dock.setEntry(s.entry("qos.up"), "21000");
    const keys = await waitFor(() => dialogs().find((d) => d.textContent.includes("Four keys to turn")), { timeoutMs: LIVE_PAUSE_MS + 8000 });
    assert.equal(s.t.router.nvram.qos_obw, "20000", "nothing is written before the keys are turned");
    button(keys, "Cancel").click();
    await waitFor(() => safety.busy === false);
    assert.equal(dock.count(), 1, "the change is still waiting");
    assert.ok(button(s.bar, "Apply now"));
    assert.doesNotMatch(s.bar.textContent, /applies by itself/);
    await sleep(LIVE_PAUSE_MS + 600);
    assert.equal(dialogs().length, 0, "it does not ask again until the person edits or presses Apply now");
    assert.equal(s.t.router.nvram.qos_obw, "20000");
  } finally {
    await s.stop();
  }
});

test("review mode: nothing applies by itself, and switching to Live takes over the waiting change", async () => {
  const s = await boot();
  try {
    await setLiveMode(false);
    dock.setEntry(s.entry("qos.up"), "21000");
    assert.ok(button(s.bar, "Review and apply"));
    assert.equal(button(s.bar, "Apply now"), undefined);
    await sleep(LIVE_PAUSE_MS + 600);
    assert.equal(s.t.router.nvram.qos_obw, "20000");
    assert.equal(dock.count(), 1);
    await setLiveMode(true);
    assert.ok(button(s.bar, "Apply now"), "the bar follows the switch at once");
    await waitFor(() => s.t.router.nvram.qos_obw === "21000", { timeoutMs: LIVE_PAUSE_MS + 8000 });
    await waitFor(() => dock.count() === 0 && safety.busy === false);
  } finally {
    await s.stop();
  }
});

test("the shell redraws the pending-changes bar when the Live and Review switch or the busy state changes", async () => {
  const main = await readFile(path.join(ROOT, "public", "js", "main.js"), "utf8");
  assert.match(main, /bus\.on\("dock", \(\) => renderDock\(dockEl\)\), bus\.on\("safety", \(\) => renderDock\(dockEl\)\)/);
});
