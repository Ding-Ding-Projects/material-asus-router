// Password hashing and signed-in sessions. Adapted from Material QEMU.
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
// A sign-in lasts this long since the browser was last used, so regular use never signs anyone out.
export const SESSION_DAYS = 90;
const LIFETIME_MS = SESSION_DAYS * 24 * 3600 * 1000;
// The sign-in is pushed forward at most once a day, which keeps the saved file quiet.
const RENEW_AFTER_MS = 24 * 3600 * 1000;
const MAX_SESSIONS = 500;
export const COOKIE = "mar_session";

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 256)
    throw new Error("Passwords need 12 to 256 characters.");
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: (await scrypt(password, salt, 64)).toString("hex") };
}

export async function checkPassword(password, record) {
  if (!record || typeof password !== "string" || password.length > 256) return false;
  const actual = await scrypt(password, record.salt, 64);
  return timingSafeEqual(actual, Buffer.from(record.hash, "hex"));
}

// Sessions are kept by the SHA-256 of the cookie value, and the per-session token is derived from
// the cookie value, so neither memory nor the saved file holds anything a browser could present.
const keyOf = (id) => createHash("sha256").update(id).digest("hex");
const csrfOf = (id) => createHmac("sha256", id).update("csrf").digest("base64url");

export class Sessions {
  constructor({ now = Date.now, dir = null } = {}) {
    this.now = now;
    this.file = dir ? path.join(dir, "sessions.json") : null;
    this.items = new Map();
    this.failures = new Map();
    this.queue = Promise.resolve();
  }

  // Reads the sessions saved before the last restart. `account(userId)` returns the person's
  // current { role, name } or null, so a saved session never outlives its account or keeps an old role.
  async load(account = () => null) {
    if (!this.file) return this;
    let saved = [];
    try {
      saved = JSON.parse(await readFile(this.file, "utf8")).sessions;
    } catch {
      // A missing or unreadable file only means everyone signs in again.
    }
    for (const s of Array.isArray(saved) ? saved : []) {
      if (typeof s?.key !== "string" || !/^[0-9a-f]{64}$/.test(s.key) || !(s.expires > this.now())) continue;
      const current = account(s.userId);
      if (current) this.items.set(s.key, { expires: s.expires, userId: s.userId, role: current.role, name: current.name });
    }
    return this;
  }

  #save() {
    if (!this.file) return;
    const file = this.file;
    const run = this.queue.then(async () => {
      const now = this.now();
      for (const [key, s] of this.items) if (s.expires < now) this.items.delete(key);
      while (this.items.size > MAX_SESSIONS) this.items.delete(this.items.keys().next().value);
      const sessions = [...this.items].map(([key, s]) => ({ key, userId: s.userId, expires: s.expires }));
      await mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify({ version: 1, sessions }), { mode: 0o600 });
      await rename(tmp, file);
    });
    // A failed save leaves the sessions working in memory until the next restart.
    this.queue = run.catch(() => {});
  }

  // Resolves once every change so far is on disk.
  flush() {
    return this.queue;
  }

  issue(who) {
    const id = randomBytes(32).toString("base64url");
    const value = { expires: this.now() + LIFETIME_MS, userId: who.userId, role: who.role, name: who.name };
    this.items.set(keyOf(id), value);
    this.#save();
    return { id, csrf: csrfOf(id), ...value };
  }

  get(request) {
    const id = request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    if (!id) return null;
    const key = keyOf(id);
    const session = this.items.get(key);
    if (!session) return null;
    const now = this.now();
    if (session.expires < now) {
      this.items.delete(key);
      this.#save();
      return null;
    }
    // Using the app keeps the sign-in alive; the caller sends the cookie again when `renewed` is set.
    const renewed = session.expires - now < LIFETIME_MS - RENEW_AFTER_MS;
    if (renewed) {
      session.expires = now + LIFETIME_MS;
      this.#save();
    }
    return { id, csrf: csrfOf(id), renewed, ...session };
  }

  end(id) {
    if (this.items.delete(keyOf(id))) this.#save();
  }

  revokeUser(userId) {
    let removed = false;
    for (const [key, session] of this.items) if (session.userId === userId) removed = this.items.delete(key) || removed;
    if (removed) this.#save();
  }

  // Five failed sign-ins from one address lock it out for fifteen minutes.
  allowed(address) {
    const state = this.failures.get(address);
    return !state || state.until < this.now() || state.count < 5;
  }

  record(address, success) {
    if (success) return void this.failures.delete(address);
    const old = this.failures.get(address);
    const fresh = !old || old.until < this.now();
    this.failures.set(address, { count: fresh ? 1 : old.count + 1, until: this.now() + 15 * 60 * 1000 });
    if (this.failures.size > 10000) this.failures.delete(this.failures.keys().next().value);
  }

  cookie(id, secure) {
    return `${COOKIE}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 24 * 3600}${secure ? "; Secure" : ""}`;
  }
}
