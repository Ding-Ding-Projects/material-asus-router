// Everything that touches this computer or the network, in one replaceable
// object, so tests can swap it for a stand-in and never start a real server.
// The child-process module is taken from the runtime rather than imported by
// name, so the feature folder keeps to the import rule (kit, node: modules and
// its own files) without needing a list entry for every built-in module.
const { execFile, spawn } = process.getBuiltinModule("child_process");
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const MAX_JAR = 600 * 1024 * 1024;

async function get(url, { timeoutMs = 20000 } = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (!response.ok) throw new Error(`${new URL(url).hostname} answered ${response.status}.`);
  return response;
}

export const runtime = {
  // Where local servers live. MAR_MINECRAFT_DIR moves it.
  base: process.env.MAR_MINECRAFT_DIR || path.join(os.homedir(), "material-asus-router", "minecraft"),
  fs,
  fetchJson: async (url) => (await get(url)).json(),
  fetchText: async (url) => (await get(url)).text(),
  async fetchBuffer(url, { maxBytes = MAX_JAR } = {}) {
    const response = await get(url, { timeoutMs: 15 * 60 * 1000 });
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > maxBytes) throw new Error(`The download is ${Math.round(length / 1e6)} MB, more than the ${Math.round(maxBytes / 1e6)} MB limit.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error("The download is larger than the limit.");
    return bytes;
  },
  // Runs a program with an argument list (never a shell), with a time limit.
  run: (command, args, { timeoutMs = 60000, cwd } = {}) =>
    new Promise((resolve) => {
      execFile(command, args, { timeout: timeoutMs, cwd, windowsHide: true, maxBuffer: 8 << 20 }, (error, stdout, stderr) => {
        resolve({ code: error ? (typeof error.code === "number" ? error.code : error.code === "ENOENT" ? 127 : 1) : 0, stdout: String(stdout), stderr: String(stderr || (error?.code === "ENOENT" ? `${command}: not found` : error?.message) || "") });
      });
    }),
  spawn: (command, args, options) => spawn(command, args, { windowsHide: true, ...options }),
};

export const setRuntime = (patch) => Object.assign(runtime, patch);
