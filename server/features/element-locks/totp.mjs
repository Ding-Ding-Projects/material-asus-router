// One-time codes by RFC 4226 (HOTP) and RFC 6238 (TOTP), with SHA-1, SHA-256
// and SHA-512, 6 to 8 digits and any period. This file is copied unchanged into
// the other feature folders that need it (a feature may import only its own
// folder); tests/features/authenticator.test.mjs fails if the copies differ.
import { createHmac, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const ALGORITHMS = ["SHA1", "SHA256", "SHA512"];
const HASH = { SHA1: "sha1", SHA256: "sha256", SHA512: "sha512" };

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  if (!clean || /[^A-Z2-7]/.test(clean)) throw new Error("A secret uses the letters A to Z and the digits 2 to 7 only.");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  if (out.length < 10) throw new Error("That secret is too short. Use at least 16 base32 characters.");
  return Buffer.from(out);
}

export const newSecret = (bytes = 20) => base32Encode(randomBytes(bytes));

export function hotp(key, counter, algorithm = "SHA1", digits = 6) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac(HASH[algorithm], key).update(message).digest();
  const offset = hash[hash.length - 1] & 15;
  const binary = ((hash[offset] & 0x7f) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totp(key, timeMs, { algorithm = "SHA1", digits = 6, period = 30 } = {}) {
  const counter = Math.floor(timeMs / 1000 / period);
  return hotp(key, counter, algorithm, digits);
}

// The code, the next code and the seconds left in this window.
export function codeNow(secret, timeMs, options = {}) {
  const key = Buffer.isBuffer(secret) ? secret : base32Decode(secret);
  const period = options.period ?? 30;
  const window = Math.floor(timeMs / 1000 / period);
  return { code: totp(key, timeMs, options), next: totp(key, (window + 1) * period * 1000, options), remaining: period - (Math.floor(timeMs / 1000) % period), period };
}

// True when the code matches the current window or one on either side (clock skew).
export function verify(secret, code, timeMs, { skew = 1, ...options } = {}) {
  const key = Buffer.isBuffer(secret) ? secret : base32Decode(secret);
  const period = options.period ?? 30;
  const text = String(code ?? "").replace(/\s/g, "");
  if (!/^\d{6,8}$/.test(text)) return false;
  for (let step = -skew; step <= skew; step++) if (totp(key, timeMs + step * period * 1000, options) === text) return true;
  return false;
}

export function checkOptions({ algorithm = "SHA1", digits = 6, period = 30 } = {}) {
  const alg = String(algorithm).toUpperCase().replace("-", "");
  if (!ALGORITHMS.includes(alg)) throw new Error("Choose SHA1, SHA256 or SHA512.");
  const d = Number(digits);
  if (!Number.isInteger(d) || d < 6 || d > 8) throw new Error("Codes have 6, 7 or 8 digits.");
  const p = Number(period);
  if (!Number.isInteger(p) || p < 1 || p > 3600) throw new Error("The period is 1 to 3600 seconds.");
  return { algorithm: alg, digits: d, period: p };
}

export function buildUri({ issuer = "", label, secret, algorithm = "SHA1", digits = 6, period = 30 }) {
  const name = encodeURIComponent(label);
  const head = issuer ? `${encodeURIComponent(issuer)}:${name}` : name;
  const params = new URLSearchParams({ secret, algorithm, digits: String(digits), period: String(period) });
  if (issuer) params.set("issuer", issuer);
  return `otpauth://totp/${head}?${params.toString().replace(/\+/g, "%20")}`;
}

// Reads an otpauth://totp/ address into the fields an account needs.
export function parseUri(text) {
  let url;
  try {
    url = new URL(String(text).trim());
  } catch {
    throw new Error("That is not an otpauth address.");
  }
  if (url.protocol !== "otpauth:") throw new Error("That is not an otpauth address.");
  if (url.hostname !== "totp") throw new Error("Only time-based (totp) accounts are supported.");
  const path = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const colon = path.indexOf(":");
  const issuerFromPath = colon > 0 ? path.slice(0, colon).trim() : "";
  const label = (colon > 0 ? path.slice(colon + 1) : path).trim();
  const secret = url.searchParams.get("secret");
  if (!secret) throw new Error("That address has no secret.");
  base32Decode(secret);
  const options = checkOptions({ algorithm: url.searchParams.get("algorithm") ?? "SHA1", digits: url.searchParams.get("digits") ?? 6, period: url.searchParams.get("period") ?? 30 });
  return { issuer: (url.searchParams.get("issuer") ?? issuerFromPath).slice(0, 60), label: (label || issuerFromPath || "Account").slice(0, 80), secret: secret.toUpperCase().replace(/[\s=-]/g, ""), ...options };
}
