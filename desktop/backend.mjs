// Starts the existing web app in this process on a random loopback port. This file
// does not import Electron, so tests can run it against the pretend router.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createApp } from "../server/app.mjs";

export const APP_NAME = "Material Asus Router";
export const FEED_URL = "https://github.com/Ding-Ding-Projects/material-asus-router/releases/latest/download";

// router.json is a local, untracked file that prefills the router address and user.
// Only host, port, username and password are read; anything else is ignored.
export async function readRouterPrefill(file) {
  let raw;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || typeof raw.host !== "string" || !raw.host.trim()) return null;
  const port = Number.isInteger(raw.port) && raw.port > 0 && raw.port < 65536 ? raw.port : 22;
  const prefill = { host: raw.host.trim(), port, username: String(raw.username ?? "").trim(), authType: "password" };
  if (typeof raw.password === "string" && raw.password) prefill.password = raw.password;
  return prefill.username ? prefill : null;
}

async function alreadyConfigured(dataDir) {
  try {
    const state = JSON.parse(await readFile(path.join(dataDir, "state.json"), "utf8"));
    return Boolean(state.router?.host);
  } catch {
    return false;
  }
}

async function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = "no answer yet";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok && (await res.json()).ok) return;
      last = `HTTP ${res.status}`;
    } catch (error) {
      last = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`The built-in server did not become healthy: ${last}`);
}

export async function startBackend({ dataDir, routerFile, demo = false, healthTimeoutMs = 15000 }) {
  const options = { demo, dataDir };
  if (!demo && routerFile && !(await alreadyConfigured(dataDir))) {
    const prefill = await readRouterPrefill(routerFile);
    if (prefill) options.preconfigure = prefill;
  }
  const app = await createApp(options);
  await app.listen(0, "127.0.0.1");
  try {
    await waitForHealth(app.port, healthTimeoutMs);
  } catch (error) {
    await app.close();
    throw error;
  }
  return { app, port: app.port, url: `http://127.0.0.1:${app.port}/`, close: () => app.close() };
}

// Squirrel starts the app with --squirrel-* arguments on install, update and uninstall.
export function squirrelEvent(argv) {
  const flag = argv.find((a) => /^--squirrel-(install|updated|uninstall|obsolete|firstrun)$/.test(a));
  return flag ? flag.slice("--squirrel-".length) : null;
}
