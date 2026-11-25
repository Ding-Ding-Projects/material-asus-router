// The desktop shell's logic that does not need Electron: router.json prefill, desktop
// settings, Squirrel arguments, version numbering and the in-process server start.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { readRouterPrefill, squirrelEvent, startBackend } from "../desktop/backend.mjs";
import { DesktopSettings } from "../desktop/settings.mjs";
import { buildVersion } from "../desktop/scripts/stage.mjs";

const temp = () => mkdtemp(path.join(tmpdir(), "mar-desktop-"));

test("router.json prefills only a complete, valid router", async () => {
  const dir = await temp();
  try {
    const file = path.join(dir, "router.json");
    assert.equal(await readRouterPrefill(file), null, "missing file");
    await writeFile(file, "not json");
    assert.equal(await readRouterPrefill(file), null, "broken file");
    await writeFile(file, JSON.stringify({ host: "198.51.100.1", username: "Pat" }));
    assert.deepEqual(await readRouterPrefill(file), { host: "198.51.100.1", port: 22, username: "Pat", authType: "password" });
    await writeFile(file, JSON.stringify({ host: "198.51.100.1", port: 2222, username: "Pat", password: "x", extra: 1 }));
    assert.deepEqual(await readRouterPrefill(file), { host: "198.51.100.1", port: 2222, username: "Pat", authType: "password", password: "x" });
    await writeFile(file, JSON.stringify({ host: "198.51.100.1" }));
    assert.equal(await readRouterPrefill(file), null, "no user");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("desktop settings persist and ignore bad values", async () => {
  const dir = await temp();
  try {
    const file = path.join(dir, "desktop.json");
    const first = await new DesktopSettings(file).load();
    assert.equal(first.get("keepInTray"), false);
    await first.set("keepInTray", true);
    await first.set("windowBounds", { x: 10, y: 20, width: 900, height: 700 });
    const again = await new DesktopSettings(file).load();
    assert.equal(again.get("keepInTray"), true);
    assert.deepEqual(again.get("windowBounds"), { x: 10, y: 20, width: 900, height: 700 });
    await assert.rejects(first.set("nope", 1));
    await writeFile(file, JSON.stringify({ keepInTray: "yes", windowBounds: { x: 0, y: 0, width: 10, height: 10 } }));
    const bad = await new DesktopSettings(file).load();
    assert.equal(bad.get("keepInTray"), false);
    assert.equal(bad.get("windowBounds"), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Squirrel start arguments are recognised", () => {
  assert.equal(squirrelEvent(["app.exe", "--squirrel-install", "0.1.5"]), "install");
  assert.equal(squirrelEvent(["app.exe", "--squirrel-updated", "0.1.5"]), "updated");
  assert.equal(squirrelEvent(["app.exe", "--squirrel-uninstall"]), "uninstall");
  assert.equal(squirrelEvent(["app.exe", "--squirrel-firstrun"]), "firstrun");
  assert.equal(squirrelEvent(["app.exe", "--demo"]), null);
});

test("the build number becomes the patch number so each build updates the last", () => {
  assert.equal(buildVersion("0.1.0", "42"), "0.1.42");
  assert.equal(buildVersion("0.1.7", undefined), "0.1.7");
  assert.equal(buildVersion("0.1.7", "abc"), "0.1.7");
});

test("the built-in server starts on a loopback port, answers /health and stops", async () => {
  const dir = await temp();
  const backend = await startBackend({ dataDir: dir, demo: true });
  try {
    assert.match(backend.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    const health = await (await fetch(`${backend.url}health`)).json();
    assert.equal(health.ok, true);
    assert.equal(health.router, "configured", "demo mode prefills the pretend router");
    const page = await fetch(backend.url);
    assert.equal(page.status, 200);
  } finally {
    await backend.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("router.json prefills a fresh data folder but never overwrites a saved router", async () => {
  const dir = await temp();
  const routerFile = path.join(dir, "router.json");
  await writeFile(routerFile, JSON.stringify({ host: "198.51.100.1", username: "Pat" }));
  const dataDir = path.join(dir, "data");
  const first = await startBackend({ dataDir, routerFile });
  try {
    assert.equal((await (await fetch(`${first.url}health`)).json()).router, "configured");
  } finally {
    await first.close();
  }
  const state = JSON.parse(await readFile(path.join(dataDir, "state.json"), "utf8"));
  assert.equal(state.router.host, "198.51.100.1");
  state.router.hostKey = "SHA256:pinned";
  await writeFile(path.join(dataDir, "state.json"), JSON.stringify(state));
  await writeFile(routerFile, JSON.stringify({ host: "203.0.113.9", username: "Alex" }));
  const second = await startBackend({ dataDir, routerFile });
  await second.close();
  const after = JSON.parse(await readFile(path.join(dataDir, "state.json"), "utf8"));
  assert.equal(after.router.host, "198.51.100.1");
  assert.equal(after.router.hostKey, "SHA256:pinned");
  await rm(dir, { recursive: true, force: true });
});
