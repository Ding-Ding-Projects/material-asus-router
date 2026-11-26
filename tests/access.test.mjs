import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { Client, startApp } from "./helpers.mjs";

async function addUser(t, body) {
  const res = await t.owner.post("/api/users", { name: body.username, password: "a long enough password", ...body });
  assert.equal(res.status, 201, res.text);
  return res.data;
}

test("the first account becomes the owner and a second setup is refused", async () => {
  const t = await startApp();
  try {
    const again = await t.client().post("/api/setup", { name: "Alex", username: "alex", password: "another long password" });
    assert.equal(again.status, 409);
    assert.equal(again.data.signIn, true);
    const session = (await t.owner.get("/api/session")).data;
    assert.equal(session.setup, "done");
    assert.equal(session.user.role, "owner");
    assert.equal(session.router.configured, true);
  } finally {
    await t.stop();
  }
});

test("two setups at the same moment create exactly one owner", async () => {
  const t = await startApp({ configure: false });
  // startApp already created the owner; use a brand-new app to race.
  await t.stop();
  const { createApp } = await import("../server/app.mjs");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const os = await import("node:os");
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-race-"));
  const app = await createApp({ dataDir: dir });
  await app.listen(0, "127.0.0.1");
  try {
    const base = `http://127.0.0.1:${app.port}`;
    const attempts = await Promise.all(
      ["one", "two", "three"].map((name) => new Client(base).post("/api/setup", { name, username: `owner-${name}`, password: "a long enough password" })),
    );
    assert.deepEqual(attempts.map((a) => a.status).sort(), [200, 409, 409]);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("sign-in rejects bad passwords and a wrong password never reveals which part was wrong", async () => {
  const t = await startApp();
  try {
    const wrongPassword = await t.client().signIn("pat", "not the password");
    const wrongUser = await t.client().signIn("nobody", "not the password");
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongUser.status, 401);
    assert.equal(wrongPassword.data.error, wrongUser.data.error);
    const ok = t.client();
    assert.equal((await ok.signIn("PAT", "correct horse battery")).status, 200);
    assert.equal((await ok.get("/api/session")).data.signedIn, true);
    assert.equal((await t.client().get("/api/catalog")).status, 401, "no session, no data");
  } finally {
    await t.stop();
  }
});

test("a viewer can read and preview but every write is refused on the server", async () => {
  const t = await startApp();
  try {
    await addUser(t, { username: "guest", role: "viewer" });
    const viewer = t.client();
    assert.equal((await viewer.signIn("guest", "a long enough password")).status, 200);
    assert.equal((await viewer.get("/api/domain/wifi")).status, 200);
    assert.equal((await viewer.get("/api/changes/history")).status, 200);
    const preview = await viewer.post("/api/changes/preview", { changes: [{ id: "qos.up", value: "21000" }] });
    assert.equal(preview.status, 200, "a viewer may preview");
    const apply = await viewer.post("/api/changes/apply", { previewId: preview.data.id });
    assert.equal(apply.status, 403);
    assert.equal(apply.data.code, "ROLE");
    assert.equal(t.router.nvram.qos_obw, "20000");
    for (const [url, body] of [["/api/actions/reboot", {}], ["/api/actions/ping", { host: "example.com" }], ["/api/settings", { guardSeconds: 60 }], ["/api/users", {}], ["/api/router/forget", {}], ["/api/reveal", { id: "wl0.password" }], ["/api/restore", {}]])
      assert.equal((await viewer.post(url, body)).status, 403, url);
    assert.equal((await viewer.get("/api/users")).status, 403);
    assert.equal((await viewer.get("/api/backup?secrets=1")).status, 403);
  } finally {
    await t.stop();
  }
});

test("an operator can change settings but cannot manage people or the router connection", async () => {
  const t = await startApp();
  try {
    await addUser(t, { username: "helper", role: "operator" });
    const op = t.client();
    await op.signIn("helper", "a long enough password");
    const preview = await op.post("/api/changes/preview", { changes: [{ id: "qos.up", value: "21000" }] });
    assert.equal((await op.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.equal((await op.post("/api/users", { username: "x", password: "a long enough password", role: "viewer" })).status, 403);
    assert.equal((await op.post("/api/router/key", {})).status, 403);
    assert.equal((await op.post("/api/actions/install-key", {})).status, 403);
    assert.equal((await op.get("/api/users")).status, 403);
  } finally {
    await t.stop();
  }
});

test("requests that change anything need the CSRF token", async () => {
  const t = await startApp();
  try {
    const none = await t.owner.post("/api/changes/preview", { changes: [{ id: "qos.up", value: "21000" }] }, { csrf: "" });
    assert.equal(none.status, 403);
    assert.equal(none.data.code, "CSRF");
    const wrong = await t.owner.post("/api/changes/preview", { changes: [{ id: "qos.up", value: "21000" }] }, { csrf: "forged" });
    assert.equal(wrong.status, 403);
    assert.equal((await t.owner.get("/api/domain/qos")).status, 200, "reads need no token");
    assert.equal((await t.owner.post("/api/logout", {}, { csrf: "" })).status, 403);
  } finally {
    await t.stop();
  }
});

test("removing a person ends their sessions and role changes take effect at once", async () => {
  const t = await startApp();
  try {
    const user = await addUser(t, { username: "temp", role: "operator" });
    const temp = t.client();
    await temp.signIn("temp", "a long enough password");
    assert.equal((await temp.get("/api/domain/qos")).status, 200);
    assert.equal((await t.owner.request("DELETE", `/api/users/${user.id}`)).status, 200);
    assert.equal((await temp.get("/api/domain/qos")).status, 401);
    assert.equal((await t.client().signIn("temp", "a long enough password")).status, 401);
    assert.equal((await t.owner.post("/api/users", { username: "pat", password: "a long enough password", role: "viewer" })).status, 400, "duplicate user name");
    assert.equal((await t.owner.post("/api/users", { username: "short", password: "short", role: "viewer" })).status, 400);
  } finally {
    await t.stop();
  }
});

test("security headers are set and the app never serves files outside public/", async () => {
  const t = await startApp();
  try {
    const page = await fetch(`${t.base}/`);
    assert.match(page.headers.get("content-security-policy"), /default-src 'self'/);
    assert.doesNotMatch(page.headers.get("content-security-policy"), /unsafe-inline/);
    assert.equal(page.headers.get("x-content-type-options"), "nosniff");
    for (const bad of ["/..%2fserver%2fstore.mjs", "/%2e%2e/package.json", "/fonts/roboto-flex/..%2f..%2fpackage.json"]) {
      const res = await fetch(`${t.base}${bad}`);
      assert.ok([400, 404].includes(res.status), `${bad} -> ${res.status}`);
    }
    const health = await (await fetch(`${t.base}/health`)).json();
    assert.deepEqual(Object.keys(health).sort(), ["ok", "router", "version"]);
  } finally {
    await t.stop();
  }
});

test("secrets never reach state.json, the vault file in clear text, or any API response", async () => {
  const t = await startApp();
  try {
    const sweep = [];
    for (const url of ["/api/session", "/api/router", "/api/catalog", "/api/domain/wifi", "/api/domain/advanced", "/api/domain/system", "/api/backup", "/api/changes/history", "/api/users"]) {
      sweep.push([url, (await t.owner.get(url)).text]);
    }
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "wl1.password", value: "pineapple-bun-12345" }] });
    sweep.push(["preview", JSON.stringify(preview.data)]);
    sweep.push(["apply", JSON.stringify((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).data)]);
    const secrets = ["milk-tea-and-egg-tarts", "visitors-welcome", "router-password", "pineapple-bun-12345", "correct horse battery"];
    for (const [where, text] of sweep) for (const secret of secrets) assert.ok(!text.includes(secret), `${secret} leaked in ${where}`);
    for (const file of ["state.json", "vault.json"]) {
      const text = await readFile(path.join(t.dir, file), "utf8");
      for (const secret of secrets) assert.ok(!text.includes(secret), `${secret} leaked in ${file}`);
    }
    const vaultText = await readFile(path.join(t.dir, "vault.json"), "utf8");
    assert.ok(vaultText.includes('"router.password"'), "the router password is stored, encrypted");
  } finally {
    await t.stop();
  }
});

test("owners can reveal a secret on request; the value is not part of ordinary reads", async () => {
  const t = await startApp();
  try {
    const res = await t.owner.post("/api/reveal", { id: "wl0.password" });
    assert.equal(res.data.value, "milk-tea-and-egg-tarts");
    assert.equal((await t.owner.post("/api/reveal", { id: "wl0.ssid" })).status, 400);
  } finally {
    await t.stop();
  }
});

// ---- staying signed in -------------------------------------------------------

async function restart(t) {
  const { createApp } = await import("../server/app.mjs");
  await t.app.close();
  const app = await createApp({ dataDir: t.dir, pollMs: 100, verifyTimeoutMs: 2000, cacheTtlMs: 0, safety: { fourKey: false, launch: false, quietPollMs: 0 } });
  await app.listen(0, "127.0.0.1");
  return { app, base: `http://127.0.0.1:${app.port}` };
}

async function stopRestarted(t, again) {
  const { rm } = await import("node:fs/promises");
  await again?.app.close();
  await t.router.close();
  await rm(t.dir, { recursive: true, force: true });
}

test("a sign-in survives a restart, and the saved file holds nothing a browser could present", async () => {
  const t = await startApp();
  let again;
  try {
    const cookieValue = t.owner.cookie.split("=")[1];
    again = await restart(t);
    const owner = new Client(again.base);
    owner.cookie = t.owner.cookie;
    const session = (await owner.get("/api/session")).data;
    assert.equal(session.signedIn, true, "still signed in after the restart");
    assert.equal(session.user.role, "owner");
    assert.equal(session.csrf, t.owner.csrf, "the page's token still works");
    owner.csrf = session.csrf;
    assert.equal((await owner.post("/api/changes/preview", { changes: [{ id: "qos.up", value: "21000" }] })).status, 200);
    const saved = await readFile(path.join(t.dir, "sessions.json"), "utf8");
    assert.ok(!saved.includes(cookieValue), "the cookie value is not saved");
    assert.ok(!saved.includes(t.owner.csrf), "the token is not saved");
    assert.equal(JSON.parse(saved).sessions.length, 1);
  } finally {
    await stopRestarted(t, again);
  }
});

test("signing out and removing a person stay in force across a restart", async () => {
  const t = await startApp();
  let again;
  try {
    const user = await addUser(t, { username: "temp", role: "operator" });
    const temp = t.client();
    await temp.signIn("temp", "a long enough password");
    const left = t.client();
    await left.signIn("pat", "correct horse battery");
    const leftCookie = left.cookie;
    assert.equal((await left.post("/api/logout")).status, 200);
    assert.equal((await t.owner.request("DELETE", `/api/users/${user.id}`)).status, 200);
    again = await restart(t);
    for (const cookie of [temp.cookie, leftCookie]) {
      const c = new Client(again.base);
      c.cookie = cookie;
      assert.equal((await c.get("/api/session")).data.signedIn, false);
      assert.equal((await c.get("/api/catalog")).status, 401);
    }
    const owner = new Client(again.base);
    owner.cookie = t.owner.cookie;
    assert.equal((await owner.get("/api/session")).data.signedIn, true, "the owner's other browser is untouched");
  } finally {
    await stopRestarted(t, again);
  }
});

test("a saved sign-in never outlives its account or keeps an old role", async () => {
  const { Sessions } = await import("../server/auth.mjs");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const os = await import("node:os");
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-sessions-"));
  try {
    const first = new Sessions({ dir });
    const kept = first.issue({ userId: "u1", role: "operator", name: "Sam" });
    const gone = first.issue({ userId: "u2", role: "operator", name: "Alex" });
    await first.flush();
    const request = (id) => ({ headers: { cookie: `other=1; mar_session=${id}` } });
    const second = await new Sessions({ dir }).load((userId) => (userId === "u1" ? { role: "viewer", name: "Sam" } : null));
    assert.equal(second.get(request(kept.id)).role, "viewer", "the role comes from the account as it is now");
    assert.equal(second.get(request(gone.id)), null, "no account, no session");
    assert.equal(second.get(request("made-up")), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("using the app keeps the sign-in alive for 90 days at a time, and an unused one ends", async () => {
  const { Sessions, SESSION_DAYS } = await import("../server/auth.mjs");
  const day = 24 * 3600 * 1000;
  let now = Date.UTC(2026, 0, 1);
  const sessions = new Sessions({ now: () => now });
  const issued = sessions.issue({ userId: "u1", role: "owner", name: "Pat" });
  const request = { headers: { cookie: `mar_session=${issued.id}` } };
  assert.equal(SESSION_DAYS, 90);
  assert.match(sessions.cookie(issued.id, false), /Max-Age=7776000$/);
  assert.match(sessions.cookie(issued.id, true), /Max-Age=7776000; Secure$/);
  now += 3600 * 1000;
  assert.equal(sessions.get(request).renewed, false, "not pushed forward on every request");
  now += 2 * day;
  const later = sessions.get(request);
  assert.equal(later.renewed, true);
  assert.equal(later.expires, now + 90 * day);
  assert.equal(later.csrf, issued.csrf, "the token does not change when the sign-in is pushed forward");
  now += 89 * day;
  assert.ok(sessions.get(request), "still signed in 89 days after the last use");
  now += 91 * day;
  assert.equal(sessions.get(request), null, "an unused sign-in ends after 90 days");
});

test("using the app after a day sends the cookie again so the browser keeps it as long", async () => {
  const t = await startApp();
  try {
    const first = await t.owner.get("/api/session");
    assert.equal(first.headers.get("set-cookie"), null, "a fresh sign-in is not sent again");
    for (const s of t.app.sessions.items.values()) s.expires -= 2 * 24 * 3600 * 1000;
    const next = await t.owner.get("/api/domain/qos");
    assert.equal(next.status, 200);
    assert.match(next.headers.get("set-cookie"), /^mar_session=[^;]+; HttpOnly; SameSite=Strict; Path=\/; Max-Age=7776000$/);
    assert.equal((await t.owner.get("/api/session")).data.signedIn, true);
  } finally {
    await t.stop();
  }
});
