// QR pairing for the account's two-factor code. The secret is made here, in
// memory, and drawn as a QR code by this process (no online service). It is
// shown only after an explicit "reveal", never written to disk or logs, and the
// factor is armed only after the person types a current code from their
// authenticator. Only then is the secret stored, encrypted, in the vault.
import { encodeQr } from "./qr.mjs";
import { buildUri, checkOptions, newSecret, verify } from "./totp.mjs";

const ID = "qr-pairing";
const PENDING_MS = 10 * 60 * 1000;
const vaultName = (userId) => `account-2fa.${userId}`;

const pendingOf = (app) => (app.pairingPending ??= new Map());
const arm = (app, userId) => app.store.read().features?.[ID]?.armed?.[userId] ?? null;

export default {
  id: ID,

  domainMeta: [],

  routes(api) {
    // Draws any short text as a QR code. Used here and by the authenticator.
    api.post("/qr", ({ body, bad }) => {
      const text = String(body.text ?? "");
      if (!text || text.length > 360) throw bad("Give 1 to 360 characters to draw.");
      try {
        const { rows, size, version, level } = encodeQr(text);
        return { rows, size, version, level, quietZone: 4 };
      } catch (error) {
        throw bad(error.message);
      }
    });

    api.get("/status", ({ app, who }) => {
      const rec = arm(app, who.userId);
      return { armed: Boolean(rec), armedAt: rec?.at ?? null, algorithm: rec?.algorithm ?? null, digits: rec?.digits ?? null, period: rec?.period ?? null, enforcedAtSignIn: false };
    });

    // Step 1: make a secret. Nothing secret is returned yet.
    api.post("/begin", ({ app, who, body, bad }) => {
      let options;
      try {
        options = checkOptions({ algorithm: body.algorithm, digits: body.digits, period: body.period });
      } catch (error) {
        throw bad(error.message);
      }
      const issuer = String(body.issuer ?? "Material Asus Router").slice(0, 40).replace(/[:/\\]/g, " ");
      const pending = pendingOf(app);
      const id = crypto.randomUUID();
      pending.set(who.userId, { id, secret: newSecret(), issuer, label: who.name || "owner", ...options, at: Date.now(), revealed: false });
      const { algorithm, digits, period } = options;
      return { id, issuer, label: who.name, algorithm, digits, period, revealed: false };
    });

    // Step 2: the person asks to see it. This is the only route that returns the secret.
    api.post("/reveal", ({ app, who, body, bad }) => {
      const rec = pendingOf(app).get(who.userId);
      if (!rec || rec.id !== body.id || Date.now() - rec.at > PENDING_MS) throw bad("Start pairing again. The secret expired or was never made.", 409);
      rec.revealed = true;
      const uri = buildUri(rec);
      const qr = encodeQr(uri);
      return { secret: rec.secret, uri, qr: { rows: qr.rows, size: qr.size, quietZone: 4 }, algorithm: rec.algorithm, digits: rec.digits, period: rec.period };
    });

    // Step 3: arm the factor only when a current code is typed.
    api.post("/confirm", async ({ app, who, body, bad }) => {
      const rec = pendingOf(app).get(who.userId);
      if (!rec || rec.id !== body.id || Date.now() - rec.at > PENDING_MS) throw bad("Start pairing again. The secret expired or was never made.", 409);
      if (!rec.revealed) throw bad("Reveal the secret and add it to your authenticator first.", 409);
      rec.tries = (rec.tries ?? 0) + 1;
      if (rec.tries > 8) {
        pendingOf(app).delete(who.userId);
        throw bad("Too many wrong codes. Start pairing again.", 429);
      }
      if (!verify(rec.secret, body.code, Date.now(), rec)) throw bad("That code is not right. Check the clock on your phone and try the next code.", 400, { code: "BAD_CODE" });
      await app.vault.set(vaultName(who.userId), JSON.stringify({ secret: rec.secret, algorithm: rec.algorithm, digits: rec.digits, period: rec.period }));
      const at = new Date().toISOString();
      await app.store.update((s) => {
        s.features ??= {};
        const mine = (s.features[ID] ??= {});
        (mine.armed ??= {})[who.userId] = { at, algorithm: rec.algorithm, digits: rec.digits, period: rec.period };
      });
      pendingOf(app).delete(who.userId);
      return { armed: true, armedAt: at };
    });

    api.post("/cancel", ({ app, who }) => {
      pendingOf(app).delete(who.userId);
      return { ok: true };
    });

    // Turning the factor off needs a current code.
    api.post("/disarm", async ({ app, who, body, bad }) => {
      const stored = app.vault.get(vaultName(who.userId));
      if (!stored) throw bad("Two-factor sign-in is not armed.", 409);
      const rec = JSON.parse(stored);
      if (!verify(rec.secret, body.code, Date.now(), rec)) throw bad("That code is not right.", 400, { code: "BAD_CODE" });
      await app.vault.delete(vaultName(who.userId));
      await app.store.update((s) => void delete s.features?.[ID]?.armed?.[who.userId]);
      return { armed: false };
    });
  },

  fakeRouter: {},
};
