// Toy locks for the cards on any screen. Each lock has its own credentials
// (a PIN, a password, a one-time code, or a mix of them) kept hashed or
// encrypted in the vault, and there is no master credential. A lock is a toy:
// it stops accidental clicks and nosy friends at the keyboard, it does not
// protect the router (the real protection is signing in and the roles). If a
// lock is forgotten, clearing this app's local data is the recovery route.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { buildUri, newSecret, verify } from "./totp.mjs";

const ID = "element-locks";
const VAULT = "element-locks.credentials";
export const MIXES = ["pin", "password", "pin+password", "password+totp", "pin+totp", "pin+password+totp"];
const KEY = /^[A-Za-z0-9:._ /-]{1,120}$/;
const FAILS_BEFORE_WAIT = 3;

const unlocked = new Map(); // session id -> Set(lock key)
const failures = new Map(); // lock key -> consecutive wrong tries
const prepared = new Map(); // `${userId}:${lock key}` -> { secret, at }

const parts = (mix) => ({ pin: mix.includes("pin"), password: mix.includes("password"), totp: mix.includes("totp") });
const hash = (text, salt = randomBytes(16).toString("hex")) => ({ salt, hash: scryptSync(String(text), salt, 32).toString("hex") });
const same = (text, rec) => Boolean(rec) && timingSafeEqual(scryptSync(String(text ?? ""), rec.salt, 32), Buffer.from(rec.hash, "hex"));

const readCreds = (app) => {
  try {
    return JSON.parse(app.vault.get(VAULT) ?? "{}");
  } catch {
    return {};
  }
};
const metaOf = (app) => app.store.read().features?.[ID]?.locks ?? {};
const waits = (app) => (app.lockWaits ??= new Map());
const waitSeconds = (app, key) => Math.max(0, Math.ceil(((waits(app).get(key) ?? 0) - Date.now()) / 1000));

function checkKey(key, bad) {
  const text = String(key ?? "");
  if (!KEY.test(text)) throw bad("That element cannot be locked.");
  return text;
}

// Checks every credential the lock's mix needs. Returns null when all are right.
function checkCreds(app, key, mix, body) {
  const creds = readCreds(app)[key];
  if (!creds) return "That element has no lock.";
  const need = parts(mix);
  if (need.pin && !(/^\d{4,8}$/.test(String(body.pin ?? "")) && same(body.pin, creds.pin))) return "The PIN is not right.";
  if (need.password && !same(body.password, creds.password)) return "The password is not right.";
  if (need.totp && !verify(creds.totp, body.code, Date.now())) return "The code is not right.";
  return null;
}

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.get("/state", ({ app, who }) => {
      const open = unlocked.get(who.id) ?? new Set();
      const locks = Object.entries(metaOf(app)).map(([key, m]) => ({ key, mix: m.mix, createdAt: m.createdAt, locked: !open.has(key), waitSeconds: waitSeconds(app, key) }));
      return { locks, mixes: MIXES, disclosure: "This lock is just for fun. It is a toy that stops accidents, not a safe. If you forget it, clearing this app's local data removes every lock; the Support Tickets desk shows where that data lives." };
    });

    // The one-time-code part of a lock: a secret made here and shown on request.
    api.post("/prepare-totp", ({ app, who, body, bad }) => {
      const key = checkKey(body.key, bad);
      const secret = newSecret();
      prepared.set(`${who.userId}:${key}`, { secret, at: Date.now() });
      const uri = buildUri({ issuer: "Lock", label: key.slice(0, 60), secret });
      return { secret, uri, algorithm: "SHA1", digits: 6, period: 30 };
    });

    api.post("/lock", async ({ app, who, body, bad }) => {
      const key = checkKey(body.key, bad);
      const mix = String(body.mix ?? "");
      if (!MIXES.includes(mix)) throw bad("Choose one of the six credential mixes.");
      if (metaOf(app)[key]) throw bad("That element is already locked.", 409);
      const need = parts(mix);
      const record = {};
      if (need.pin) {
        if (!/^\d{4,8}$/.test(String(body.pin ?? ""))) throw bad("A PIN is 4 to 8 digits.");
        record.pin = hash(body.pin);
      }
      if (need.password) {
        const pw = String(body.password ?? "");
        if (pw.length < 8 || pw.length > 128) throw bad("A lock password is 8 to 128 characters.");
        record.password = hash(pw);
      }
      if (need.totp) {
        const pending = prepared.get(`${who.userId}:${key}`);
        if (!pending || Date.now() - pending.at > 15 * 60 * 1000) throw bad("Make the one-time code first.", 409);
        if (!verify(pending.secret, body.code, Date.now())) throw bad("Type a current code from your authenticator to finish.", 400, { code: "BAD_CODE" });
        record.totp = pending.secret;
        prepared.delete(`${who.userId}:${key}`);
      }
      const creds = readCreds(app);
      creds[key] = record;
      await app.vault.set(VAULT, JSON.stringify(creds));
      await app.store.update((s) => {
        s.features ??= {};
        ((s.features[ID] ??= {}).locks ??= {})[key] = { mix, createdAt: new Date().toISOString() };
      });
      unlocked.get(who.id)?.delete(key); // a new lock starts closed
      return { locked: true, key, mix };
    });

    api.post("/unlock", ({ app, who, body, bad }) => {
      const key = checkKey(body.key, bad);
      const meta = metaOf(app)[key];
      if (!meta) throw bad("That element has no lock.", 404);
      const left = waitSeconds(app, key);
      if (left > 0) throw bad(`Too many wrong tries. Wait ${left} seconds, or use the unlock ladder to clear the wait.`, 423, { code: "WAITING" });
      const problem = checkCreds(app, key, meta.mix, body);
      if (problem) {
        const count = (failures.get(key) ?? 0) + 1;
        failures.set(key, count);
        if (count >= FAILS_BEFORE_WAIT) waits(app).set(key, Date.now() + Math.min(900, 30 * 2 ** (count - FAILS_BEFORE_WAIT)) * 1000);
        throw bad(waitSeconds(app, key) > 0 ? `${problem} Too many wrong tries: wait ${waitSeconds(app, key)} seconds, or use the unlock ladder to clear the wait.` : problem, 401, { code: "BAD_CREDENTIAL" });
      }
      failures.delete(key);
      (unlocked.get(who.id) ?? unlocked.set(who.id, new Set()).get(who.id)).add(key);
      return { locked: false, key };
    });

    api.post("/relock", ({ who, body, bad }) => {
      unlocked.get(who.id)?.delete(checkKey(body.key, bad));
      return { locked: true };
    });

    // Removing a lock needs its credentials again.
    api.post("/remove", async ({ app, who, body, bad }) => {
      const key = checkKey(body.key, bad);
      const meta = metaOf(app)[key];
      if (!meta) throw bad("That element has no lock.", 404);
      if (waitSeconds(app, key) > 0) throw bad("Wait for the lock's waiting time first.", 423);
      const problem = checkCreds(app, key, meta.mix, body);
      if (problem) throw bad(problem, 401);
      const creds = readCreds(app);
      delete creds[key];
      await app.vault.set(VAULT, JSON.stringify(creds));
      await app.store.update((s) => void delete s.features?.[ID]?.locks?.[key]);
      unlocked.get(who.id)?.delete(key);
      return { removed: true };
    });

    // The recovery route inside the app: the owner clears every lock after a two-key confirmation.
    api.post("/clear-all", async ({ app, who, body, bad }) => {
      if (who.role !== "owner") throw bad("Only the owner can clear every lock.", 403);
      const rec = app.superTokens?.get(String(body.token ?? ""));
      if (!rec || rec.action !== "element-locks.clear-all" || rec.userId !== who.userId || rec.exp < Date.now()) throw bad("Clearing every lock needs the two-key confirmation.", 403, { code: "NEEDS_SUPER" });
      app.superTokens.delete(String(body.token));
      await app.vault.delete(VAULT);
      await app.store.update((s) => void delete s.features?.[ID]?.locks);
      unlocked.clear();
      failures.clear();
      waits(app).clear();
      return { cleared: true };
    });
  },
};
