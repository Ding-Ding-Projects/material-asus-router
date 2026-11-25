// The built-in authenticator: time-based one-time codes for any account, kept
// per signed-in person. Secrets live only in the encrypted vault; the list
// that is sent to the browser, searched, reordered, exported and bulk-edited
// never contains them. Exporting secrets needs the owner and a finished
// two-key super confirmation.
import { ALGORITHMS, base32Decode, buildUri, checkOptions, codeNow, newSecret, parseUri } from "./totp.mjs";

const ID = "authenticator";
const MAX = 200;
const secretName = (id) => `otp.${id}`;

const mine = (app, userId) => (app.store.read().features?.[ID]?.accounts ?? []).filter((a) => a.owner === userId).sort((a, b) => a.order - b.order);
const edit = (app, fn) =>
  app.store.update((s) => {
    s.features ??= {};
    const bucket = (s.features[ID] ??= { accounts: [] });
    return fn(bucket.accounts ?? (bucket.accounts = []));
  });

// A finished super confirmation hands out a single-use token (see super-confirmation).
const useToken = (app, token, action, userId) => {
  const rec = app.superTokens?.get(String(token ?? ""));
  if (!rec || rec.exp < Date.now() || rec.action !== action || rec.userId !== userId) return false;
  app.superTokens.delete(String(token));
  return true;
};

const view = (a) => ({ id: a.id, issuer: a.issuer, label: a.label, algorithm: a.algorithm, digits: a.digits, period: a.period, group: a.group ?? "", order: a.order, addedAt: a.addedAt });
const clean = (v, max) => String(v ?? "").trim().slice(0, max);

async function addAccount(app, userId, input) {
  const accounts = mine(app, userId);
  if (accounts.length >= MAX) throw new Error(`You can keep up to ${MAX} accounts.`);
  const fields = input.uri ? parseUri(input.uri) : { issuer: clean(input.issuer, 60), label: clean(input.label, 80), secret: String(input.secret ?? "").toUpperCase().replace(/[\s=-]/g, ""), ...checkOptions(input) };
  if (!fields.label) throw new Error("Give the account a name.");
  base32Decode(fields.secret);
  const id = crypto.randomUUID();
  await app.vault.set(secretName(id), fields.secret);
  const account = { id, owner: userId, issuer: fields.issuer, label: fields.label, algorithm: fields.algorithm, digits: fields.digits, period: fields.period, group: clean(input.group, 40), order: accounts.length ? Math.max(...accounts.map((a) => a.order)) + 1 : 0, addedAt: new Date().toISOString() };
  await edit(app, (list) => void list.push(account));
  return view(account);
}

// Reads otpauth lines, a JSON list of addresses or a JSON list of { uri }.
function linesOf(text) {
  const raw = String(text ?? "").trim();
  if (raw.startsWith("[") || raw.startsWith("{")) {
    const data = JSON.parse(raw);
    const items = Array.isArray(data) ? data : data.accounts ?? [];
    return items.map((i) => (typeof i === "string" ? i : i.uri)).filter(Boolean);
  }
  return raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("otpauth://"));
}

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.get("/accounts", ({ app, who, query }) => {
      const q = clean(query.q, 100).toLowerCase();
      const list = mine(app, who.userId).filter((a) => !q || `${a.issuer} ${a.label} ${a.group}`.toLowerCase().includes(q));
      const groups = [...new Set(mine(app, who.userId).map((a) => a.group).filter(Boolean))].sort();
      return { accounts: list.map(view), groups, total: mine(app, who.userId).length };
    });

    // Every code with its next code, plus whether this computer's clock agrees with the browser's.
    api.get("/codes", ({ app, who, query }) => {
      const now = Date.now();
      const client = Number(query.clientTime);
      const skewSeconds = Number.isFinite(client) && client > 0 ? Math.round((client - now) / 1000) : null;
      const codes = mine(app, who.userId).map((a) => {
        try {
          return { id: a.id, ...codeNow(app.vault.get(secretName(a.id)), now, a) };
        } catch {
          return { id: a.id, error: "The secret could not be read." };
        }
      });
      return { codes, serverTime: now, skewSeconds, clockWarning: skewSeconds !== null && Math.abs(skewSeconds) > 30 ? { seconds: skewSeconds, en: `This browser's clock differs from the app's by ${Math.abs(skewSeconds)} seconds. Codes follow the app's clock; fix the clock if a service rejects them.`, yue: `呢個瀏覽器嘅時鐘同程式相差 ${Math.abs(skewSeconds)} 秒。驗證碼跟程式嘅時鐘；如果服務拒絕，請校正時鐘。` } : null };
    });

    api.post("/accounts", async ({ app, who, body, bad }) => {
      try {
        return await addAccount(app, who.userId, body);
      } catch (error) {
        throw bad(error.message);
      }
    });

    api.post("/import-text", async ({ app, who, body, bad }) => {
      let lines;
      try {
        lines = linesOf(body.text);
      } catch {
        throw bad("That file is not a list of otpauth addresses.");
      }
      if (!lines.length) throw bad("No otpauth:// addresses were found.");
      const added = [];
      const skipped = [];
      for (const line of lines.slice(0, 200)) {
        try {
          added.push(await addAccount(app, who.userId, { uri: line, group: body.group }));
        } catch (error) {
          skipped.push({ line: `${line.slice(0, 24)}...`, reason: error.message });
        }
      }
      return { added: added.length, skipped, accounts: added };
    });

    api.patch("/accounts/:id", async ({ app, who, params, body, bad }) => {
      let out;
      await edit(app, (list) => {
        const a = list.find((x) => x.id === params.id && x.owner === who.userId);
        if (!a) throw bad("That account is not in your list.", 404);
        if (body.issuer !== undefined) a.issuer = clean(body.issuer, 60);
        if (body.label !== undefined) a.label = clean(body.label, 80) || a.label;
        if (body.group !== undefined) a.group = clean(body.group, 40);
        out = view(a);
      });
      return out;
    });

    api.post("/reorder", async ({ app, who, body }) => {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      await edit(app, (list) => {
        ids.forEach((id, i) => {
          const a = list.find((x) => x.id === id && x.owner === who.userId);
          if (a) a.order = i;
        });
      });
      return { ok: true };
    });

    // Bulk delete or regroup. Deleting needs the two-key confirmation token.
    api.post("/bulk", async ({ app, who, body, bad }) => {
      const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(String))];
      if (!ids.length) throw bad("Select at least one account.");
      const owned = new Set(mine(app, who.userId).map((a) => a.id));
      const skipped = ids.filter((id) => !owned.has(id)).map((id) => ({ id, reason: "not in your list" }));
      const chosen = ids.filter((id) => owned.has(id));
      if (body.action === "delete") {
        if (!useToken(app, body.token, "authenticator.bulk-delete", who.userId)) throw bad("Deleting accounts needs the two-key confirmation.", 403, { code: "NEEDS_SUPER" });
        await edit(app, (list) => {
          for (const id of chosen) list.splice(list.findIndex((a) => a.id === id), 1);
        });
        for (const id of chosen) await app.vault.delete(secretName(id));
        return { done: chosen.length, skipped };
      }
      if (body.action === "group") {
        const group = clean(body.group, 40);
        await edit(app, (list) => list.filter((a) => chosen.includes(a.id)).forEach((a) => (a.group = group)));
        return { done: chosen.length, skipped };
      }
      throw bad("Choose delete or group.");
    });

    // Ordinary exports leave the secrets out and say so. Secrets need the owner and a token.
    api.get("/export", ({ app, who, query, bad }) => {
      const accounts = mine(app, who.userId);
      if (query.secrets === "1") {
        if (who.role !== "owner") throw bad("Only the owner can export secrets.", 403);
        if (!useToken(app, query.token, "authenticator.export-secrets", who.userId)) throw bad("Exporting secrets needs the two-key confirmation.", 403, { code: "NEEDS_SUPER" });
        return { format: "material-asus-router-authenticator", version: 1, secretsIncluded: true, accounts: accounts.map((a) => ({ ...view(a), uri: buildUri({ ...a, secret: app.vault.get(secretName(a.id)) }) })) };
      }
      return { format: "material-asus-router-authenticator", version: 1, secretsIncluded: false, omitted: "Secrets are never included in an ordinary export. Use the secrets export, which asks for two-key confirmation.", accounts: accounts.map(view) };
    });

    // Shows one account's address (for a QR code on another device). Needs the two-key confirmation.
    api.post("/reveal", ({ app, who, body, bad }) => {
      const a = mine(app, who.userId).find((x) => x.id === body.id);
      if (!a) throw bad("That account is not in your list.", 404);
      if (!useToken(app, body.token, "authenticator.reveal", who.userId)) throw bad("Showing a secret needs the two-key confirmation.", 403, { code: "NEEDS_SUPER" });
      const secret = app.vault.get(secretName(a.id));
      return { uri: buildUri({ ...a, secret }), secret };
    });

    api.get("/algorithms", () => ({ algorithms: ALGORITHMS, digits: [6, 7, 8], periodRange: [1, 3600] }));
    api.get("/new-secret", () => ({ secret: newSecret() }));
  },
};

