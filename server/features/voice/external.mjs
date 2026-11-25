// Reads the two external sources a schedule rule can follow: a validated HTTPS
// JSON API and a Home Assistant boolean entity. Both are fetched by the server
// because the page may only talk to itself (strict CSP). Everything is bounded:
// a timeout, a byte limit, no redirects, and no credentials in the address.
// Access tokens are used for the one request and never stored, logged or echoed.
import dns from "node:dns/promises";
import net from "node:net";

export const LIMITS = Object.freeze({ timeoutMs: 5000, maxBytes: 64 * 1024 });

// Tests replace these two functions; production uses the real ones.
export const hooks = {
  fetch: (...args) => globalThis.fetch(...args),
  lookup: (host) => dns.lookup(host, { all: true }),
};

export class ExternalError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Allowed values for the settings a rule can change. The browser applies them;
// the server only refuses anything outside this list.
export const SETTING_VALUES = Object.freeze({
  language: ["en", "yue", "both"],
  theme: ["auto", "light", "dark"],
  density: ["comfortable", "compact"],
  font: ["default", "large", "system"],
  motion: ["full", "reduced"],
});
const HEX = /^#[0-9a-fA-F]{6}$/;

export function isBlockedAddress(address) {
  let a = String(address).toLowerCase();
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) a = mapped[1];
  if (net.isIPv4(a)) {
    const [p, q, r] = a.split(".").map(Number);
    return p === 0 || p === 10 || p === 127 || (p === 100 && q >= 64 && q <= 127) || (p === 169 && q === 254) || (p === 172 && q >= 16 && q <= 31) || (p === 192 && q === 168) || (p === 192 && q === 0 && r === 0) || (p === 198 && (q === 18 || q === 19)) || p >= 224;
  }
  if (net.isIPv6(a)) return a === "::" || a === "::1" || a.startsWith("fc") || a.startsWith("fd") || /^fe[89ab]/.test(a) || a.startsWith("ff");
  return true;
}

function parseUrl(text, { allowHttp }) {
  let url;
  try {
    url = new URL(String(text));
  } catch {
    throw new ExternalError("BAD_URL", "That is not a web address.");
  }
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) throw new ExternalError("BAD_URL", allowHttp ? "Use an http or https address." : "Use an https address.");
  if (url.username || url.password) throw new ExternalError("BAD_URL", "Do not put a user name or password in the address. Use the access token box.");
  if (!url.hostname || String(text).length > 400) throw new ExternalError("BAD_URL", "That address is too long or has no host.");
  return url;
}

// An API address must be public: https only, and no host that resolves to this
// machine or a private network.
export async function checkApiTarget(text) {
  const url = parseUrl(text, { allowHttp: false });
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses;
  if (net.isIP(host)) addresses = [{ address: host }];
  else {
    try {
      addresses = await hooks.lookup(host);
    } catch {
      throw new ExternalError("UNREACHABLE", "That host name could not be found.", 502);
    }
  }
  if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) throw new ExternalError("BLOCKED_HOST", "That address points at this machine or a private network, so it is refused.");
  return url;
}

async function readBounded(res, maxBytes) {
  const length = Number(res.headers.get("content-length"));
  if (length > maxBytes) throw new ExternalError("TOO_BIG", "The answer is too large.", 502);
  const reader = res.body?.getReader?.();
  if (!reader) {
    const text = await res.text();
    if (Buffer.byteLength(text) > maxBytes) throw new ExternalError("TOO_BIG", "The answer is too large.", 502);
    return text;
  }
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ExternalError("TOO_BIG", "The answer is too large.", 502);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function request(url, token) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await hooks.fetch(url, { method: "GET", headers, redirect: "manual", signal: AbortSignal.timeout(LIMITS.timeoutMs) });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new ExternalError("TIMEOUT", "The other side did not answer in time.", 504);
    throw new ExternalError("UNREACHABLE", "Could not reach the other side.", 502);
  }
  if (res.status >= 300 && res.status < 400) throw new ExternalError("REDIRECT", "The address redirects somewhere else, which is not followed.", 502);
  if (res.status === 401 || res.status === 403) throw new ExternalError("UNAUTHORIZED", "The access token was refused.", 502);
  if (res.status === 404) throw new ExternalError("NOT_FOUND", "Nothing was found at that address.", 502);
  if (!res.ok) throw new ExternalError("HTTP", `The other side answered with status ${res.status}.`, 502);
  const text = await readBounded(res, LIMITS.maxBytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new ExternalError("BAD_RESPONSE", "The answer is not JSON.", 502);
  }
}

// The API answer, version 1:
//   { "schema": 1, "active": true, "settings": { "theme": "dark" }, "validUntil": "2026-12-01T00:00:00Z" }
// Only these keys are allowed; "settings" is optional.
export function parseApiState(json) {
  const fail = (why) => new ExternalError("BAD_RESPONSE", `The answer does not match the schedule schema: ${why}.`, 502);
  if (!json || typeof json !== "object" || Array.isArray(json)) throw fail("it is not an object");
  for (const key of Object.keys(json)) if (!["schema", "active", "settings", "validUntil"].includes(key)) throw fail(`unknown field "${key}"`);
  if (json.schema !== 1) throw fail("schema must be 1");
  if (typeof json.active !== "boolean") throw fail("active must be true or false");
  const out = { active: json.active, settings: {}, validUntil: null };
  if (json.settings !== undefined) {
    if (!json.settings || typeof json.settings !== "object" || Array.isArray(json.settings)) throw fail("settings must be an object");
    for (const [key, value] of Object.entries(json.settings)) {
      if (key === "accent") {
        if (typeof value !== "string" || !HEX.test(value)) throw fail("accent must be a colour like #3366cc");
        out.settings.accent = value.toLowerCase();
      } else if (SETTING_VALUES[key]) {
        if (!SETTING_VALUES[key].includes(value)) throw fail(`${key} must be one of ${SETTING_VALUES[key].join(", ")}`);
        out.settings[key] = value;
      } else throw fail(`unknown setting "${key}"`);
    }
  }
  if (json.validUntil !== undefined) {
    const when = typeof json.validUntil === "string" ? Date.parse(json.validUntil) : NaN;
    if (!Number.isFinite(when)) throw fail("validUntil must be a date and time");
    out.validUntil = new Date(when).toISOString();
  }
  return out;
}

function cleanToken(token) {
  if (token === undefined || token === null || token === "") return "";
  const text = String(token).trim();
  if (text.length > 2048 || /[\r\n\0]/.test(text)) throw new ExternalError("BAD_TOKEN", "The access token is not valid.");
  return text;
}

export async function fetchApiState({ url, token }) {
  const target = await checkApiTarget(url);
  return { ...parseApiState(await request(target, cleanToken(token))), source: "api", checkedAt: new Date().toISOString() };
}

const ENTITY = /^(input_boolean|binary_sensor|switch)\.[a-z0-9_]{1,80}$/;

export async function fetchHomeAssistant({ url, entity, token }) {
  const base = parseUrl(url, { allowHttp: true });
  if (!ENTITY.test(String(entity ?? ""))) throw new ExternalError("BAD_ENTITY", "Use a boolean entity such as input_boolean.school_hours.");
  const secret = cleanToken(token);
  if (!secret) throw new ExternalError("TOKEN_MISSING", "Home Assistant needs a long-lived access token.");
  const target = new URL(`api/states/${entity}`, base.href.endsWith("/") ? base.href : `${base.href}/`);
  const json = await request(target, secret);
  const state = typeof json?.state === "string" ? json.state.toLowerCase() : "";
  if (state === "on" || state === "off") return { active: state === "on", state, entity, source: "home-assistant", checkedAt: new Date().toISOString() };
  if (state === "unavailable" || state === "unknown") throw new ExternalError("ENTITY_UNAVAILABLE", `Home Assistant reports the entity as ${state}.`, 502);
  throw new ExternalError("BAD_RESPONSE", "That entity is not an on/off entity.", 502);
}
