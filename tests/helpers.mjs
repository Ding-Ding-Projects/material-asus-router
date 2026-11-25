// Shared test setup: a pretend router, a complete app in a temporary data
// folder, and a tiny HTTP client that keeps the session cookie and CSRF token.
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";
import { FakeRouter } from "../server/ssh/fake-router.mjs";

export class Client {
  constructor(base) {
    this.base = base;
    this.cookie = "";
    this.csrf = "";
  }

  async request(method, url, body, { csrf = this.csrf, raw = false } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (this.cookie) headers.Cookie = this.cookie;
    if (csrf) headers["X-CSRF"] = csrf;
    const res = await fetch(this.base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    const text = await res.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {}
    return { status: res.status, data, text, headers: res.headers };
  }

  get = (url, options) => this.request("GET", url, undefined, options);
  post = (url, body, options) => this.request("POST", url, body ?? {}, options);

  async signIn(username, password) {
    const res = await this.post("/api/login", { username, password });
    if (res.status === 200) this.csrf = res.data.csrf;
    return res;
  }
}

export async function startApp({ firmware = "merlin", configure = true, guardScale = 0.1, guardSeconds = 30, ...options } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-test-"));
  const router = await new FakeRouter({ firmware, guardScale }).listen(0, "127.0.0.1");
  const app = await createApp({
    dataDir: dir,
    guardSeconds,
    pollMs: 100,
    verifyTimeoutMs: 2000,
    cacheTtlMs: 0,
    log: Boolean(process.env.MAR_TEST_LOG),
    ...(configure ? { preconfigure: { host: "127.0.0.1", port: router.port, username: router.username, authType: "password", password: router.password, hostKey: router.hostKeyFingerprint } } : {}),
    ...options,
  });
  await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${app.port}`;
  const owner = new Client(base);
  const setup = await owner.post("/api/setup", { name: "Pat", username: "pat", password: "correct horse battery" });
  if (setup.status !== 200) throw new Error(`setup failed: ${JSON.stringify(setup.data)}`);
  owner.csrf = setup.data.csrf;
  return {
    app,
    router,
    owner,
    base,
    dir,
    client: () => new Client(base),
    async stop() {
      await app.close();
      await router.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export async function waitFor(fn, { timeoutMs = 15000, intervalMs = 100 } = {}) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) throw new Error("Timed out waiting for the condition.");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
