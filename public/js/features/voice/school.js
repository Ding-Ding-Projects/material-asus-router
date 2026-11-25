// School mode's lock. Turning School mode off needs the shared PIN or password.
// This is a user-experience lock, not security: it keeps a quick tap from undoing
// the mode, but anyone with access to this browser's storage can remove it, and the
// app says so wherever the lock is set. The secret is never stored: only a salted,
// slow hash of it (PBKDF2 with SHA-256) is kept, and only in this browser.
//
// A passkey is not offered: a passkey needs a server that verifies it, and this
// browser-only lock has none. The setting says "in progress" rather than faking one.

export const PIN_RE = /^\d{4,12}$/;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 128;
export const ITERATIONS = 150000;

const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export function checkSecret(kind, secret) {
  if (kind === "pin") return PIN_RE.test(secret) ? null : "pin";
  if (kind === "password") return typeof secret === "string" && secret.length >= PASSWORD_MIN && secret.length <= PASSWORD_MAX ? null : "password";
  return "kind";
}

async function derive(secret, salt, iter) {
  const key = await globalThis.crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await globalThis.crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256));
}

export async function createLock(kind, secret, iter = ITERATIONS) {
  const problem = checkSecret(kind, secret);
  if (problem) throw new Error(problem);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return { kind, salt: b64(salt), iter, hash: b64(await derive(secret, salt, iter)) };
}

export async function verifyLock(lock, secret) {
  if (!lock || typeof secret !== "string") return false;
  try {
    const expected = unb64(lock.hash);
    const got = await derive(secret, unb64(lock.salt), lock.iter);
    if (expected.length !== got.length) return false;
    let diff = 0;
    for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}
