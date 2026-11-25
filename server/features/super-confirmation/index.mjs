// Two-key super confirmation for destructive actions. The browser dialog walks
// the person through two separately operated keys and then a full-range
// slider. Each step is also recorded here, in order and with minimum pauses,
// and only a finished set gives out a single-use token that the destructive
// action must present. Other features read that token from app.superTokens
// (a Map of token to { action, userId, exp }), so nothing destructive runs on
// the strength of a browser click alone.
import { randomBytes } from "node:crypto";

const ID = "super-confirmation";
const PENDING_MS = 5 * 60 * 1000;
const TOKEN_MS = 60 * 1000;
const MIN_GAP_MS = 120; // a script cannot press both keys and the slider in one breath

const pendingOf = (app) => (app.superPending ??= new Map());
const tokensOf = (app) => (app.superTokens ??= new Map());
const sweep = (map) => {
  const now = Date.now();
  for (const [key, value] of map) if ((value.exp ?? value.at + PENDING_MS) < now) map.delete(key);
};

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.post("/begin", ({ app, who, body, bad }) => {
      const action = String(body.action ?? "");
      if (!/^[a-z][a-z0-9.-]{2,60}$/.test(action)) throw bad("Say which action this confirms.");
      const summary = String(body.summary ?? "").slice(0, 300);
      const pending = pendingOf(app);
      sweep(pending);
      const id = randomBytes(12).toString("base64url");
      pending.set(id, { id, action, summary, userId: who.userId, at: Date.now(), keys: {}, slider: false, last: Date.now() });
      return { id, action, steps: ["key1", "key2", "slider"] };
    });

    api.post("/key", ({ app, who, body, bad }) => {
      const rec = take(app, who, body, bad);
      const which = Number(body.key);
      if (which !== 1 && which !== 2) throw bad("There are two keys, 1 and 2.");
      if (Date.now() - rec.last < MIN_GAP_MS) throw bad("That was too fast to be a person. Try again.", 429);
      rec.keys[which] = Date.now();
      rec.last = Date.now();
      return { key1: Boolean(rec.keys[1]), key2: Boolean(rec.keys[2]) };
    });

    api.post("/slide", ({ app, who, body, bad }) => {
      const rec = take(app, who, body, bad);
      if (!rec.keys[1] || !rec.keys[2]) throw bad("Turn both keys first.", 409);
      if (Number(body.value) !== 100) {
        rec.slider = false;
        return { slider: false };
      }
      if (Date.now() - rec.last < MIN_GAP_MS) throw bad("That was too fast to be a person. Try again.", 429);
      rec.slider = true;
      rec.last = Date.now();
      return { slider: true };
    });

    // Only a complete set gives out the token. Nothing happens before this succeeds.
    api.post("/finish", ({ app, who, body, bad }) => {
      const rec = take(app, who, body, bad);
      if (!rec.keys[1] || !rec.keys[2] || !rec.slider) throw bad("Not every step is finished, so nothing was confirmed.", 409, { code: "INCOMPLETE" });
      pendingOf(app).delete(rec.id);
      const token = randomBytes(24).toString("base64url");
      const tokens = tokensOf(app);
      sweep(tokens);
      tokens.set(token, { action: rec.action, userId: rec.userId, exp: Date.now() + TOKEN_MS });
      return { token, action: rec.action, expiresInSeconds: TOKEN_MS / 1000 };
    });

    api.post("/cancel", ({ app, body }) => {
      pendingOf(app).delete(String(body.id ?? ""));
      return { cancelled: true };
    });

    // Lets a screen check a token without spending it (the destructive route spends it).
    api.post("/check", ({ app, who, body }) => {
      const rec = tokensOf(app).get(String(body.token ?? ""));
      return { valid: Boolean(rec && rec.userId === who.userId && rec.exp > Date.now() && rec.action === body.action) };
    });
  },
};

function take(app, who, body, bad) {
  const rec = pendingOf(app).get(String(body.id ?? ""));
  if (!rec || rec.userId !== who.userId || Date.now() - rec.at > PENDING_MS) throw bad("That confirmation expired. Start again.", 410);
  return rec;
}
