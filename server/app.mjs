// The HTTP server: routes, sign-in, roles, CSRF protection and static files.
// createApp() builds everything around one data folder so tests can run a
// complete app against a pretend router.
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COOKIE, Sessions, checkPassword, hashPassword } from "./auth.mjs";
import { ACTIONS, generateKey, installKeyChange, publicKey, runAction, runFeatureAction, uploadKey } from "./actions.mjs";
import { ChangeEngine, validateRaw } from "./changes/engine.mjs";
import { impactOfEntry } from "./changes/impact.mjs";
import { defineSafetyRoutes } from "./changes/routes.mjs";
import { SafetyService } from "./changes/safety.mjs";
import { DOMAINS, findByKey, validate } from "./router/catalog.mjs";
import { describeEntry, readDevices, readDomain } from "./router/domains.mjs";
import { suggestedRouter } from "./features/onboarding-wizard/index.mjs";
import { selfService as bandwidthSelfService } from "./features/bandwidth-control/index.mjs";
import { features, featureAction, featureActionNames, featureDomainMeta, mountFeatureRoutes } from "./features/registry.mjs";
import { MASK, isSecret } from "./router/secrets.mjs";
import { RouterSession, VAULT_PASSWORD, VAULT_PUBLIC_KEY } from "./router/session.mjs";
import { hostTarget } from "./router/shell.mjs";
import { FakeRouter } from "./ssh/fake-router.mjs";
import { HostKeyError, RouterConnection } from "./ssh/client.mjs";
import { Store } from "./store.mjs";
import { addUser, checkUsername, findUser, prepareUser, publicUser, removeUser, roleAllows, roleRefusal, updateUser } from "./users.mjs";
import { Vault } from "./vault.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "..", "public");
const MODULES = path.join(ROOT, "..", "node_modules");
const VERSION = "0.1.0";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const FONT_DIRS = { "roboto-flex": path.join(MODULES, "@fontsource-variable", "roboto-flex", "files"), "material-symbols": path.join(MODULES, "@fontsource", "material-symbols-rounded", "files") };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

const bad = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });

// Messages from the sign-in and people modules are written for the person at
// the keyboard, so they go back as ordinary 400 answers.
const friendlySync = (fn) => {
  try {
    return fn();
  } catch (error) {
    if (error.status) throw error;
    throw bad(error.message, 400);
  }
};
const friendly = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    if (error.status) throw error;
    throw bad(error.message, 400);
  }
};
// Handlers return plain data; wrap it in http() only to set a status or headers.
const HTTP = Symbol("http");
const http = (status, body, headers = {}) => ({ [HTTP]: true, status, body, headers });
const httpRaw = (raw, headers) => ({ [HTTP]: true, status: 200, raw, headers });
const USERNAME_ROUTER = /^[A-Za-z0-9._@-]{1,64}$/;

export async function createApp(options = {}) {
  const dataDir = path.resolve(options.dataDir ?? process.env.DATA_DIR ?? "./data");
  const store = await new Store(dataDir).load();
  const vault = await new Vault(dataDir).load();
  // Sign-ins are saved on the data volume, so a restart or an update does not sign anyone out.
  const sessions = await new Sessions({ dir: dataDir }).load((userId) => {
    const state = store.read();
    if (state.owner?.id === userId) return { role: "owner", name: state.owner.name };
    const user = state.users.find((u) => u.id === userId);
    return user ? { role: user.role, name: user.name } : null;
  });
  const session = new RouterSession({ store, vault, verifyTimeoutMs: options.verifyTimeoutMs ?? 8000, cacheTtlMs: options.cacheTtlMs ?? 3000 });
  const engine = new ChangeEngine({ session, store, vault, guardSeconds: options.guardSeconds ?? 90, pollMs: options.pollMs ?? 3000, watchDeadlineMs: options.watchDeadlineMs ?? null });
  const app = { store, vault, sessions, session, engine, pendingHostKey: null, demoRouter: null };
  const areaLabel = (id) => [...DOMAINS, ...featureDomainMeta()].find((d) => d.id === id)?.label ?? { en: id, yue: id };
  app.safety = new SafetyService({ store, vault, session, engine, dataDir, options: { ...options, pollMs: options.pollMs ?? 3000 }, areaLabel, readDevices, actionInfo: featureAction });

  if (options.demo) {
    app.demoRouter = await new FakeRouter({ firmware: options.demoFirmware ?? "merlin", profile: options.demoProfile ?? null }).listen(0, "127.0.0.1");
    options.preconfigure = { host: "127.0.0.1", port: app.demoRouter.port, username: app.demoRouter.username, authType: "password", password: app.demoRouter.password, hostKey: app.demoRouter.hostKeyFingerprint };
  }
  if (options.preconfigure) await saveRouter(app, options.preconfigure);

  const routes = [];
  const route = (method, pattern, handler, flags = {}) => {
    const names = [];
    const source = pattern.replace(/:([a-z]+)/g, (_, name) => (names.push(name), "([^/]+)"));
    routes.push({ method, re: new RegExp(`^${source}$`), names, handler, ...flags });
  };
  defineRoutes(app, route);

  async function handle(req, res) {
    try {
      const url = new URL(req.url, "http://localhost");
      headers(res);
      if (url.pathname === "/health" || url.pathname.startsWith("/api/")) return await api(app, routes, req, res, url);
      return await serveStatic(req, res, url.pathname);
    } catch (error) {
      sendError(res, error, options.log);
    }
  }

  const server = createServer(handle);
  const running = {
    ...app,
    server,
    routes,
    port: null,
    listen: (port = 8790, host = "0.0.0.0") =>
      new Promise((resolve) =>
        server.listen(port, host, () => {
          running.port = server.address().port;
          resolve(running.port);
        }),
      ),
    async close() {
      app.safety.close();
      engine.close();
      session.close();
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
      await sessions.flush();
      await app.demoRouter?.close();
    },
  };
  return running;
}

// ---- helpers ------------------------------------------------------------

function headers(res) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
}

function sendJson(res, status, data, extra = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(body), ...extra });
  res.end(body);
}

function sendError(res, error, log) {
  if (res.headersSent) return void res.end();
  let status = error.status;
  const body = { error: error.message, code: error.code };
  if (error instanceof HostKeyError) {
    status = 409;
    body.fingerprint = error.fingerprint;
  } else if (!status && ["UNREACHABLE", "TIMEOUT", "AUTH_FAILED"].includes(error.code)) {
    status = error.code === "AUTH_FAILED" ? 401 : 502;
    body.code = error.code === "AUTH_FAILED" ? "ROUTER_AUTH_FAILED" : error.code;
  }
  for (const field of ["fingerprint", "signIn", "skipped", "detail", "yue"]) if (error[field] !== undefined) body[field] = error[field];
  if (!status) {
    status = 500;
    body.error = "Something went wrong on the server.";
    body.code = "INTERNAL";
    if (log) console.error(`[error] ${error.stack}`);
  }
  sendJson(res, status, body);
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw bad("That request is too large.", 413);
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw bad("The request was not valid JSON.", 400);
  }
}

async function api(app, routes, req, res, url) {
  const method = req.method;
  const found = routes.find((r) => r.method === method && r.re.test(url.pathname));
  if (!found) {
    if (routes.some((r) => r.re.test(url.pathname))) throw bad("That method is not allowed here.", 405);
    throw bad("That page does not exist.", 404);
  }
  const match = url.pathname.match(found.re);
  const params = Object.fromEntries(found.names.map((n, i) => [n, decodeURIComponent(match[i + 1])]));
  let who = null;
  if (!found.public) {
    who = signedIn(app, req, res);
    if (!who) throw bad("Sign in to continue.", 401, { code: "SIGNED_OUT" });
    if (method !== "GET" && method !== "HEAD" && req.headers["x-csrf"] !== who.csrf) throw bad("The page is out of date. Reload and try again.", 403, { code: "CSRF" });
    if (!roleAllows(who.role, method, url.pathname)) throw bad(roleRefusal(who.role), 403, { code: "ROLE" });
  }
  const body = method === "GET" || method === "HEAD" ? {} : await readBody(req, found.limit ?? 1024 * 1024);
  const query = Object.fromEntries(url.searchParams);
  const result = await found.handler({ app, req, res, body, query, params, who, url });
  if (res.writableEnded) return;
  if (result?.[HTTP]) {
    if (result.raw !== undefined) return void res.writeHead(result.status, result.headers).end(result.raw);
    return sendJson(res, result.status, result.body, result.headers);
  }
  sendJson(res, 200, result ?? { ok: true });
}

function secureRequest(req) {
  return Boolean(req.socket.encrypted) || req.headers["x-forwarded-proto"] === "https";
}

// The signed-in person for this request. Using the app pushes the sign-in forward, and the
// cookie is sent again then so the browser keeps it just as long.
function signedIn(app, req, res) {
  const who = app.sessions.get(req);
  if (who?.renewed) res.setHeader("Set-Cookie", app.sessions.cookie(who.id, secureRequest(req)));
  return who;
}

async function startSession(app, req, res, who) {
  const issued = app.sessions.issue(who);
  await app.sessions.flush();
  res.setHeader("Set-Cookie", app.sessions.cookie(issued.id, secureRequest(req)));
  return { ok: true, csrf: issued.csrf, user: { name: who.name, role: who.role } };
}

async function saveRouter(app, config) {
  const { password, privateKey, ...rest } = config;
  await app.store.update((s) => {
    s.router = { host: rest.host, port: rest.port ?? 22, username: rest.username, authType: rest.authType ?? "password", hostKey: rest.hostKey, savedAt: new Date().toISOString() };
  });
  if (password) await app.vault.set(VAULT_PASSWORD, password);
  app.session.close();
  app.session.invalidate();
}

function routerView(app) {
  const config = app.store.read().router;
  return {
    configured: Boolean(config?.host),
    connected: app.session.connected,
    host: config?.host ?? null,
    port: config?.port ?? null,
    username: config?.username ?? null,
    authType: config?.authType ?? null,
    hostKey: config?.hostKey ?? null,
    hasKey: app.vault.has(VAULT_PUBLIC_KEY),
    publicKey: publicKey(app.vault),
    suggested: config?.host ? null : suggestedRouter(),
    // Which saved router this is (name and Main or Testing), shown to everyone signed in.
    active: savedRouterOf(app),
    demo: Boolean(app.demoRouter),
  };
}

// ---- saved routers -----------------------------------------------------------
// The owner can keep several routers, for example the main one and a Testing router, and
// switch between them. The router in use is still s.router; each saved router keeps its own
// address, user, sign-in method and host key, and its password sits in the vault under its id.

const ROUTER_ROLES = ["main", "testing"];
const routerPasswordKey = (id) => `routers.${id}.password`;
const sameRouter = (a, b) => Boolean(a && b) && a.host === b.host && Number(a.port ?? 22) === Number(b.port ?? 22) && a.username === b.username;

function savedRouterOf(app) {
  const s = app.store.read();
  const found = (s.routers ?? []).find((r) => sameRouter(r, s.router));
  return found ? { id: found.id, name: found.name, role: found.role } : null;
}

function savedRoutersView(app) {
  const s = app.store.read();
  return (s.routers ?? []).map((r) => ({ id: r.id, name: r.name, role: r.role, host: r.host, port: r.port, username: r.username, authType: r.authType, hasHostKey: Boolean(r.hostKey), active: sameRouter(r, s.router), savedAt: r.savedAt }));
}

async function liveContext(app) {
  if (!app.session.configured) throw bad("Connect a router first.", 409, { code: "NO_ROUTER" });
  return app.session.context();
}

const domainView = (domain, info) => ({ ...domain, supported: domain.feature ? (!domain.firmware || (domain.firmware === "merlin" && info.merlin)) && (!domain.requires || info.capabilities.includes(domain.requires)) : domain.id === "merlin" || domain.id === "jobs" ? info.merlin : domain.id === "aimesh" ? info.capabilities.includes("amas") : domain.id === "usb" ? info.capabilities.includes("usbX1") : true });

// ---- routes -------------------------------------------------------------

function defineRoutes(app, route) {
  const { store, vault, sessions, session, engine } = app;
  const owner = () => store.read().owner;

  route("GET", "/health", () => ({ ok: true, version: VERSION, router: session.connected ? "connected" : session.configured ? "configured" : "none" }), { public: true });

  // Unkick: anyone on the home network may lift a pause or ban on their own device, without an
  // account. The device is recognised by the address it connects from, so this can only ever
  // touch the visitor's own device. A custom header keeps other websites from pressing the button.
  const unkick = async ({ req }, lift) => {
    if (lift && req.headers["x-unkick"] !== "1") throw bad("Use the Unkick page to lift a pause.", 403);
    if (!session.configured) return { found: false, reason: "router" };
    const ctx = await liveContext(app);
    return bandwidthSelfService({ exec: ctx.exec, ip: req.socket.remoteAddress ?? "", lift });
  };
  route("GET", "/api/unkick", (c) => unkick(c, false), { public: true });
  route("POST", "/api/unkick", (c) => unkick(c, true), { public: true });

  route("GET", "/api/session", ({ req, res }) => {
    const who = signedIn(app, req, res);
    const state = store.read();
    return {
      version: VERSION,
      setup: state.owner ? "done" : "needed",
      signedIn: Boolean(who),
      user: who ? { name: who.name, role: who.role } : null,
      csrf: who?.csrf ?? null,
      canWrite: who ? who.role !== "viewer" : false,
      router: who ? routerView(app) : { configured: Boolean(state.router?.host) },
    };
  }, { public: true });

  route("POST", "/api/setup", async ({ req, res, body }) => {
    const prepared = await friendly(() => prepareUser({ ...body, role: "operator" }));
    const hash = prepared.password;
    let created;
    await store.update((s) => {
      if (s.owner) throw bad("This router manager already has an owner. Sign in instead.", 409, { code: "ALREADY_SETUP", signIn: true });
      const username = friendlySync(() => checkUsername(prepared.username, s));
      s.owner = { id: crypto.randomUUID(), name: prepared.name || username, username, ...hash, createdAt: new Date().toISOString() };
      created = s.owner;
    });
    return startSession(app, req, res, { userId: created.id, role: "owner", name: created.name });
  }, { public: true });

  route("POST", "/api/login", async ({ req, res, body }) => {
    const address = req.socket.remoteAddress ?? "";
    if (!sessions.allowed(address)) throw bad("Too many failed sign-ins. Wait 15 minutes and try again.", 429);
    const state = store.read();
    const name = String(body.username ?? "").trim().toLowerCase();
    let account = null;
    let role = null;
    if (state.owner && state.owner.username.toLowerCase() === name) [account, role] = [state.owner, "owner"];
    else if ((account = findUser(state, name))) role = account.role;
    const ok = await checkPassword(String(body.password ?? ""), account ?? { salt: "00".repeat(16), hash: "00".repeat(64) });
    if (!account || !ok) {
      sessions.record(address, false);
      throw bad("That user name or password is not right.", 401, { code: "BAD_LOGIN" });
    }
    sessions.record(address, true);
    return startSession(app, req, res, { userId: account.id, role, name: account.name });
  }, { public: true });

  route("POST", "/api/logout", ({ req, res, who }) => {
    sessions.end(who.id);
    res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    return { ok: true };
  });

  // -- people (owner only) --
  route("GET", "/api/users", () => {
    const state = store.read();
    return { owner: { id: state.owner.id, name: state.owner.name, username: state.owner.username }, users: state.users.map(publicUser) };
  });
  route("POST", "/api/users", async ({ body }) => {
    const prepared = await friendly(() => prepareUser(body));
    let user;
    await store.update((s) => void (user = friendlySync(() => addUser(s, prepared))));
    return http(201, user);
  });
  route("PATCH", "/api/users/:id", async ({ params, body }) => {
    const password = body.password ? await friendly(() => hashPassword(body.password)) : undefined;
    let user;
    await store.update((s) => void (user = friendlySync(() => updateUser(s, params.id, { role: body.role, name: body.name, password }))));
    if (password || body.role) sessions.revokeUser(params.id);
    return user;
  });
  route("DELETE", "/api/users/:id", async ({ params }) => {
    await store.update((s) => friendlySync(() => removeUser(s, params.id)));
    sessions.revokeUser(params.id);
    return { ok: true };
  });

  // -- router connection --
  route("GET", "/api/router", () => routerView(app));

  route("POST", "/api/router/connect", async ({ body }) => {
    const host = hostTarget(body.host);
    const port = body.port === undefined || body.port === "" ? 22 : Number(body.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw bad("The SSH port must be from 1 to 65535.");
    const username = String(body.username ?? "");
    if (!USERNAME_ROUTER.test(username)) throw bad("Enter the router's SSH user name.");
    const authType = body.authType === "key" ? "key" : "password";
    const existing = store.read().router;
    const same = existing && existing.host === host && existing.port === port;
    const password = authType === "password" ? (body.password ? String(body.password) : same && existing.authType === "password" ? vault.get(VAULT_PASSWORD) : null) : null;
    if (authType === "password" && !password) throw bad("Enter the router's SSH password.");
    const privateKey = authType === "key" ? vault.get("router.privateKey") : null;
    if (authType === "key" && !privateKey) throw bad("Generate this app's SSH key first, then allow it on the router.", 409, { code: "NO_KEY" });
    const config = { host, port, username, authType, password };
    const hostKey = same ? existing.hostKey : undefined;
    const connection = new RouterConnection({ host, port, username, password: password ?? undefined, privateKey: privateKey ?? undefined, hostKey, readyTimeoutMs: 10000 });
    try {
      await connection.connect();
    } catch (error) {
      if (error instanceof HostKeyError) app.pendingHostKey = { ...config, fingerprint: error.fingerprint, at: Date.now(), changed: error.code === "HOST_KEY_CHANGED" };
      throw error instanceof HostKeyError ? Object.assign(error, { status: 409 }) : explainRefusal(error, authType, username);
    }
    connection.close();
    await saveRouter(app, { ...config, hostKey });
    app.pendingHostKey = null;
    await session.ensure();
    return routerView(app);
  });

  route("POST", "/api/router/approve-host-key", async ({ body }) => {
    const pending = app.pendingHostKey;
    if (!pending || Date.now() - pending.at > 5 * 60 * 1000) throw bad("Connect to the router first.", 409, { code: "NO_PENDING_KEY" });
    if (body.fingerprint !== pending.fingerprint) throw bad("That does not match the key the router showed.", 409);
    // Use the sign-in method chosen now, which may differ from the first attempt.
    const authType = body.authType === "key" || body.authType === "password" ? body.authType : pending.authType;
    const password = authType === "password" ? (body.password ? String(body.password) : pending.password) : undefined;
    if (authType === "password" && !password) throw bad("Enter the router's SSH password.");
    const username = body.username === undefined || body.username === "" ? pending.username : String(body.username).trim();
    if (!USERNAME_ROUTER.test(username)) throw bad("Enter the router's SSH user name.");
    const privateKey = authType === "key" ? vault.get("router.privateKey") : undefined;
    if (authType === "key" && !privateKey) throw bad("Make this app's key first, then allow it on the router.", 409, { code: "NO_KEY" });
    const connection = new RouterConnection({ host: pending.host, port: pending.port, username, password, privateKey, hostKey: pending.fingerprint, readyTimeoutMs: 10000 });
    try {
      await connection.connect();
    } catch (error) {
      throw explainRefusal(error, authType, username);
    }
    connection.close();
    await saveRouter(app, { ...pending, username, authType, password, hostKey: pending.fingerprint });
    app.pendingHostKey = null;
    await session.ensure();
    return routerView(app);
  });

  // The app's key is made once and then stays the same, so the copy added to the
  // router keeps working. Only an explicit replace makes a new one.
  route("POST", "/api/router/key", async ({ body }) => {
    const existingKey = publicKey(vault);
    if (existingKey && body.replace !== true) return { publicKey: existingKey, existing: true };
    return { publicKey: await generateKey(vault), existing: false };
  });

  route("POST", "/api/router/key/upload", async ({ body }) => {
    const line = await uploadKey(vault, body.privateKey);
    session.close();
    session.invalidate();
    return { publicKey: line, uploaded: true };
  }, { limit: 32 * 1024 });

  route("GET", "/api/routers", () => ({ routers: savedRoutersView(app), roles: ROUTER_ROLES }));

  // Saves the router in use under a name, as Main or Testing. Saving again renames it.
  route("POST", "/api/routers", async ({ body }) => {
    const current = store.read().router;
    if (!current?.host) throw bad("Connect a router first, then save it.", 409);
    const name = String(body.name ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (!name) throw bad("Give the router a name, such as Living room or Testing.");
    const role = ROUTER_ROLES.includes(body.role) ? body.role : "main";
    let id;
    await store.update((s) => {
      s.routers ??= [];
      if (s.routers.length >= 8 && !s.routers.some((r) => sameRouter(r, current))) throw bad("Up to 8 routers can be saved.");
      const existing = s.routers.find((r) => sameRouter(r, current));
      id = existing?.id ?? crypto.randomUUID();
      const entry = { id, name, role, host: current.host, port: current.port ?? 22, username: current.username, authType: current.authType, hostKey: current.hostKey, savedAt: new Date().toISOString() };
      s.routers = existing ? s.routers.map((r) => (r.id === id ? entry : r)) : [...s.routers, entry];
    });
    const password = vault.get(VAULT_PASSWORD);
    if (password) await vault.set(routerPasswordKey(id), password);
    return { routers: savedRoutersView(app) };
  });

  // Switches to a saved router: the connection is closed and the next request opens the new one.
  // The router's host key must still match the one approved when it was saved.
  route("POST", "/api/routers/:id/use", async ({ params }) => {
    const target = (store.read().routers ?? []).find((r) => r.id === params.id);
    if (!target) throw bad("That router is not saved.", 404);
    const password = vault.get(routerPasswordKey(target.id));
    await store.update((s) => {
      s.router = { host: target.host, port: target.port, username: target.username, authType: target.authType, hostKey: target.hostKey, savedAt: new Date().toISOString() };
    });
    if (password) await vault.set(VAULT_PASSWORD, password);
    else await vault.delete(VAULT_PASSWORD);
    session.close();
    session.invalidate();
    return routerView(app);
  });

  route("DELETE", "/api/routers/:id", async ({ params }) => {
    let removed = null;
    await store.update((s) => {
      removed = (s.routers ?? []).find((r) => r.id === params.id) ?? null;
      s.routers = (s.routers ?? []).filter((r) => r.id !== params.id);
    });
    if (!removed) throw bad("That router is not saved.", 404);
    await vault.delete(routerPasswordKey(removed.id));
    return { routers: savedRoutersView(app) };
  });

  route("POST", "/api/router/forget", async () => {
    await store.update((s) => void (s.router = null));
    await vault.delete(VAULT_PASSWORD);
    session.close();
    session.invalidate();
    return { ok: true };
  });

  // -- reading --
  route("GET", "/api/catalog", async () => {
    const ctx = await liveContext(app);
    return {
      info: ctx.info,
      domains: [...DOMAINS, ...featureDomainMeta().filter((m) => !DOMAINS.some((d) => d.id === m.id))].map((d) => domainView(d, ctx.info)),
      entries: ctx.catalog.map((e) => ({ ...describeEntry(e, ctx.nvram), impact: impactOfEntry(e) })),
    };
  });

  route("GET", "/api/domain/:id", async ({ params, query }) => {
    const ctx = await liveContext(app);
    if (params.id === "history") return { id: "history", items: engine.history() };
    // These screens always show the router's present state.
    const live = ["advanced", "devices", "overview"].includes(params.id) || Boolean(featureDomainMeta().find((m) => m.id === params.id)?.live);
    return readDomain(params.id, live ? await session.context({ fresh: true }) : ctx, query);
  });

  route("GET", "/api/logs", async ({ query }) => readDomain("logs", await liveContext(app), query));

  route("POST", "/api/reveal", async ({ body }) => {
    const ctx = await liveContext(app);
    const entry = body.id ? ctx.catalog.find((e) => e.id === body.id) : findByKey(ctx.catalog, body.key);
    const key = entry?.key ?? String(body.key ?? "");
    if (!isSecret(key, entry)) throw bad("That setting is not a secret.");
    return { value: ctx.nvram.get(key) ?? "" };
  });

  route("GET", "/api/settings", () => ({ guardSeconds: engine.guardSeconds, liveMode: app.safety.liveMode }));
  route("POST", "/api/settings", async ({ body }) => {
    if (body.guardSeconds === undefined && body.liveMode === undefined) throw bad("Say which setting to change.");
    if (body.guardSeconds !== undefined) {
      const seconds = Number(body.guardSeconds);
      if (!Number.isInteger(seconds) || seconds < 20 || seconds > 600) throw bad("The safety timer can be 20 to 600 seconds.");
      await store.update((s) => void (s.settings.guardSeconds = seconds));
    }
    if (body.liveMode !== undefined) {
      if (typeof body.liveMode !== "boolean") throw bad("Live mode is on or off.");
      await app.safety.setLiveMode(body.liveMode);
    }
    return { guardSeconds: engine.guardSeconds, liveMode: app.safety.liveMode };
  });

  // -- changing --
  route("POST", "/api/changes/preview", async ({ body, who }) => app.safety.previewChange(body, who, { mode: app.safety.liveMode ? "live" : "review" }));
  route("POST", "/api/changes/apply", async ({ body, who }) => app.safety.commit(String(body.previewId ?? ""), { who, confirmation: body.confirmation, override: body.override === true, verifyHost: body.verifyHost || null }));
  route("GET", "/api/changes/history", () => ({ items: engine.history() }));
  route("GET", "/api/changes/history/:id", ({ params }) => {
    const record = engine.get(params.id);
    if (!record) throw bad("That change is not in the history.", 404);
    return record;
  });
  route("POST", "/api/changes/:id/undo", async ({ params, who }) => app.safety.decorate(await engine.undo(params.id, { user: who.name, meta: { mode: app.safety.liveMode ? "live" : "review", userId: who.userId } })));

  route("POST", "/api/actions/:name", async ({ params, body, who }) => {
    const custom = featureAction(params.name);
    if (custom || ACTIONS.includes(params.name)) await app.safety.gateAction(params.name, body, who);
    if (custom) {
      const info = await session.info();
      return runFeatureAction(custom, body, { session, info, who, exec: (c, o) => session.exec(c, o), nvram: () => session.nvram({ fresh: true }), preview: (input) => engine.preview(input, { user: who.name }) });
    }
    if (!ACTIONS.includes(params.name)) throw bad("That action does not exist.", 404);
    if (params.name === "install-key") {
      if (who.role !== "owner") throw bad("Only the owner can allow a new SSH key.", 403);
      const input = await installKeyChange({ vault, session });
      return app.safety.previewChange(input, who);
    }
    const info = await session.info();
    return runAction(params.name, body, { session, info });
  });

  // -- change safety and the household: live mode, impact, history, undo, quiet apply, reboot launch --
  defineSafetyRoutes(app, route, { liveContext, readDevices, actionNames: featureActionNames, actionInfo: featureAction, ACTIONS, http, httpRaw });

  // -- features: every folder in server/features adds its own routes under /api/x/<id> --
  // They go through the same table as every route above, so sign-in, CSRF
  // and role checks always apply; a feature cannot make a route public.
  route("GET", "/api/features/manifest", async () => {
    const dir = path.join(PUBLIC_DIR, "js", "features");
    const folders = (await readdir(dir, { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    const modules = [];
    const styles = [];
    for (const name of folders) {
      if ((await stat(path.join(dir, name, "index.js")).catch(() => null))?.isFile()) modules.push(`/js/features/${name}/index.js`);
      if ((await stat(path.join(dir, name, "style.css")).catch(() => null))?.isFile()) styles.push(`/js/features/${name}/style.css`);
    }
    return { modules, styles, server: features.map((f) => f.id) };
  });
  mountFeatureRoutes((id, method, sub, handler, flags = {}) => {
    const { public: _ignored, ...allowed } = flags;
    route(method, `/api/x/${id}${sub}`, (c) => handler({ ...c, live: () => liveContext(app), preview: (input) => engine.preview(input, { user: c.who.name }), bad }), allowed);
  });

  // -- backup and restore --
  route("GET", "/api/backup", async ({ query, who }) => {
    const ctx = await liveContext(app);
    session.invalidate();
    const values = await session.nvram({ fresh: true });
    const withSecrets = query.secrets === "1";
    if (withSecrets && who.role !== "owner") throw bad("Only the owner can include secrets in a backup.", 403);
    const byKey = new Map(ctx.catalog.map((e) => [e.key, e]));
    const nvram = {};
    for (const [key, value] of values) nvram[key] = withSecrets || !isSecret(key, byKey.get(key)) ? value : value === "" ? "" : MASK;
    const data = { format: "material-asus-router-backup", version: 1, model: ctx.info.model, createdAt: new Date().toISOString(), secretsIncluded: withSecrets, nvram };
    return httpRaw(JSON.stringify(data, null, 2), { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="router-backup-${data.createdAt.slice(0, 10)}.json"`, "Cache-Control": "no-store" });
  });

  route("POST", "/api/restore", async ({ body, who }) => {
    const backup = body.backup;
    if (!backup || backup.format !== "material-asus-router-backup" || typeof backup.nvram !== "object") throw bad("That is not a backup from this app.");
    const ctx = await liveContext(app);
    session.invalidate();
    const current = await session.nvram({ fresh: true });
    const changes = [];
    const skipped = [];
    for (const [key, value] of Object.entries(backup.nvram)) {
      if (typeof value !== "string") continue;
      if (value === MASK) {
        skipped.push({ key, reason: "secret not included in the backup" });
        continue;
      }
      if (current.get(key) === value) continue;
      try {
        const entry = findByKey(ctx.catalog, key);
        if (entry) validate(entry, value);
        else validateRaw(key, value);
        changes.push({ key, value });
      } catch (error) {
        skipped.push({ key, reason: error.message });
      }
    }
    if (!changes.length) throw bad("Nothing in that backup differs from the router.", 400, { skipped });
    return { preview: await app.safety.previewChange({ changes }, who, { source: "restore" }), skipped };
  }, { limit: 6 * 1024 * 1024 });
}

// ---- static files -------------------------------------------------------

async function sendFile(req, res, file, cache) {
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return false;
  // A fingerprint from size and change time lets a browser re-check a file cheaply: unchanged files answer 304.
  const etag = `W/"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, { ETag: etag, "Cache-Control": cache });
    res.end();
    return true;
  }
  const body = await readFile(file);
  res.writeHead(200, { ETag: etag, "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream", "Content-Length": body.length, "Cache-Control": cache });
  res.end(req.method === "HEAD" ? undefined : body);
  return true;
}

async function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") throw bad("That method is not allowed here.", 405);
  const font = pathname.match(/^\/fonts\/(roboto-flex|material-symbols)\/([A-Za-z0-9._-]+\.woff2?)$/);
  if (font) {
    if (await sendFile(req, res, path.join(FONT_DIRS[font[1]], font[2]), "public, max-age=31536000, immutable")) return;
    throw bad("That font does not exist.", 404);
  }
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw bad("Bad address.", 400);
  }
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const file = path.resolve(PUBLIC_DIR, relative);
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) throw bad("That page does not exist.", 404);
  if (await sendFile(req, res, file, "no-cache")) return;
  if (!path.extname(relative) && (await sendFile(req, res, path.join(PUBLIC_DIR, "index.html"), "no-cache"))) return;
  throw bad("That page does not exist.", 404);
}

// Turns the router's refusal into a message that says what to do next.
function explainRefusal(error, authType, username = "") {
  if (error?.code !== "AUTH_FAILED") return error;
  const who = username ? `"${username}"` : "this user name";
  const check = `Check the user name first: the router only accepts the exact SSH user name set under Administration, System (it is case-sensitive), and ${who} was refused.`;
  error.message = authType === "key"
    ? `${check} If the user name is right, add the key shown under "This app's key" to the router's Authorized Keys on the same page, press Apply there, then try again.`
    : `${check} If the user name is right, the password was refused, or password login for SSH is turned off on the router; then choose "This app's key" instead.`;
  return error;
}
