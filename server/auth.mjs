// Password hashing and signed-in sessions. Adapted from Material QEMU.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SESSION_HOURS = 8;
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

export class Sessions {
  constructor(now = Date.now) {
    this.now = now;
    this.items = new Map();
    this.failures = new Map();
  }

  issue(who) {
    const id = randomBytes(32).toString("base64url");
    const value = {
      csrf: randomBytes(24).toString("base64url"),
      expires: this.now() + SESSION_HOURS * 3600 * 1000,
      userId: who.userId,
      role: who.role,
      name: who.name,
    };
    this.items.set(id, value);
    return { id, ...value };
  }

  get(request) {
    const id = request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    const session = id && this.items.get(id);
    if (!session) return null;
    if (session.expires < this.now()) {
      this.items.delete(id);
      return null;
    }
    return { id, ...session };
  }

  end(id) {
    this.items.delete(id);
  }

  revokeUser(userId) {
    for (const [id, session] of this.items) if (session.userId === userId) this.items.delete(id);
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
    return `${COOKIE}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}${secure ? "; Secure" : ""}`;
  }
}
