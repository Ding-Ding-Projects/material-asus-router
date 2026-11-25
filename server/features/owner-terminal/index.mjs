// An interactive SSH terminal in the browser, for the owner only. It is raw
// access to the router's shell: nothing is checked or previewed, so it is
// clearly labelled, refused for operators and viewers, and every session is
// written to the change history (who, when, how long, how much and how many
// lines were entered, never what was typed, because that can include a
// password). The terminal widget is xterm.js, served from this app.
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { L } from "../kit.mjs";

const ID = "owner-terminal";
const KEEP_OUTPUT = 1024 * 1024;
const IDLE_MS = 15 * 60 * 1000;
const MAX_SESSIONS = 3;
const require = createRequire(import.meta.url);
const bad = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });

const sessionsOf = (app) => (app.terminals ??= new Map());

const ASSETS = {
  "xterm.js": ["@xterm/xterm/lib/xterm.js", "text/javascript; charset=utf-8"],
  "xterm.css": ["@xterm/xterm/css/xterm.css", "text/css; charset=utf-8"],
  "addon-fit.js": ["@xterm/addon-fit/lib/addon-fit.js", "text/javascript; charset=utf-8"],
};

// ---- the history note ---------------------------------------------------------

async function note(app, entry) {
  await app.store.update((s) => {
    s.history.unshift(entry);
    const mine = s.history.filter((h) => h.items?.[0]?.key === "ssh-terminal");
    for (const old of mine.slice(100).reverse()) s.history.splice(s.history.indexOf(old), 1);
  });
}
const amend = (app, id, patch) =>
  app.store.update((s) => {
    const entry = s.history.find((h) => h.id === id);
    if (!entry) return;
    const { detail, ...rest } = patch;
    Object.assign(entry, rest);
    if (detail !== undefined) entry.items[0].new = String(detail).slice(0, 400);
  });

async function endSession(app, rec, reason) {
  if (rec.closed) return;
  rec.closed = true;
  rec.closedReason = reason;
  clearTimeout(rec.idle);
  try {
    rec.stream?.end();
  } catch {}
  rec.connection?.close();
  for (const wake of rec.waiters) wake();
  rec.waiters.clear();
  const seconds = Math.round((Date.now() - rec.startedAt) / 1000);
  await amend(app, rec.historyId, {
    detail: `Terminal session by ${rec.user}: ${seconds} s, ${rec.linesEntered} lines entered, ${rec.bytesIn} bytes in, ${rec.bytesOut} bytes out. Closed: ${reason}.`,
    note: "The text typed is not recorded, because it can include passwords.",
  }).catch(() => {});
}

function touch(app, rec) {
  clearTimeout(rec.idle);
  rec.idle = setTimeout(() => endSession(app, rec, "idle for 15 minutes"), IDLE_MS);
  rec.idle.unref?.();
}

const viewOf = (rec) => ({ id: rec.id, user: rec.user, startedAt: new Date(rec.startedAt).toISOString(), closed: rec.closed, closedReason: rec.closedReason ?? null, linesEntered: rec.linesEntered, bytesIn: rec.bytesIn, bytesOut: rec.bytesOut });

const needOwner = (who) => {
  if (who.role !== "owner") throw bad("The terminal gives raw access to the router, so only the owner can open it.", 403, { code: "OWNER_ONLY" });
};
const mineOrOwner = (rec, who) => {
  if (!rec || rec.userId !== who.userId) throw bad("That terminal session is not open any more.", 404);
};

export default {
  id: ID,
  domainMeta: [{ id: ID, icon: "terminal", label: L("Terminal", "終端機"), group: { en: "Power tools", yue: "進階工具" } }],
  domains: {
    [ID]: async (ctx) => ({ ready: true, shell: ctx.info.merlin ? "Merlin shell" : "ASUS shell", maxSessions: MAX_SESSIONS }),
  },

  routes(api) {
    // xterm.js and its style sheet, from the copy installed with this app.
    api.get("/assets/:name", async ({ params, res, bad: fail }) => {
      const asset = ASSETS[params.name];
      if (!asset) throw fail("That file does not exist.", 404);
      const body = await readFile(require.resolve(asset[0]));
      res.writeHead(200, { "Content-Type": asset[1], "Content-Length": body.length, "Cache-Control": "private, max-age=3600" });
      res.end(body);
    });

    api.get("/sessions", ({ app, who }) => {
      needOwner(who);
      return { sessions: [...sessionsOf(app).values()].map(viewOf).reverse() };
    });

    api.post("/sessions", async ({ app, body, who, live }) => {
      needOwner(who);
      const sessions = sessionsOf(app);
      if ([...sessions.values()].filter((s) => !s.closed).length >= MAX_SESSIONS) throw bad(`Up to ${MAX_SESSIONS} terminals can be open at once. Close one first.`, 409);
      const ctx = await live();
      const cols = Math.min(300, Math.max(20, Math.round(Number(body.cols)) || 80));
      const rows = Math.min(100, Math.max(5, Math.round(Number(body.rows)) || 24));
      const connection = await ctx.session.openFresh();
      const id = randomBytes(9).toString("base64url");
      const historyId = randomUUID();
      const rec = { id, userId: who.userId, user: who.name, startedAt: Date.now(), historyId, connection, stream: null, chunks: [], offset: 0, size: 0, bytesIn: 0, bytesOut: 0, linesEntered: 0, closed: false, waiters: new Set(), idle: null };
      await note(app, { id: historyId, at: new Date().toISOString(), user: who.name, status: "recorded", risk: "destructive", restarts: [], guard: null, undoOf: null, note: "The text typed is not recorded, because it can include passwords.", items: [{ key: "ssh-terminal", entryId: null, label: L("Terminal session", "終端機工作階段"), secret: false, risk: "destructive", old: null, new: `Terminal session opened by ${who.name} (raw shell access).` }] });
      try {
        await new Promise((resolve, reject) =>
          connection.client.shell({ term: "xterm-256color", cols, rows }, (error, stream) => {
            if (error) return reject(error);
            rec.stream = stream;
            stream.setEncoding("utf8");
            stream.on("data", (text) => {
              rec.bytesOut += Buffer.byteLength(text);
              rec.chunks.push(text);
              rec.size += text.length;
              while (rec.size > KEEP_OUTPUT && rec.chunks.length > 1) {
                rec.size -= rec.chunks.shift().length;
                rec.offset += 1;
              }
              for (const wake of rec.waiters) wake();
              rec.waiters.clear();
            });
            stream.on("close", () => endSession(app, rec, "the router closed it"));
            resolve();
          }),
        );
      } catch (error) {
        await endSession(app, rec, `could not start: ${error.message}`);
        throw bad(`The router would not start a shell: ${error.message}`, 502);
      }
      sessions.set(id, rec);
      touch(app, rec);
      return { id, cols, rows };
    });

    // Everything after piece `from`; waits up to `wait` ms for news.
    api.get("/sessions/:id", async ({ app, params, query, who }) => {
      const rec = sessionsOf(app).get(params.id);
      mineOrOwner(rec, who);
      const from = Math.max(rec.offset, Number(query.from) || 0);
      const wait = Math.min(15000, Math.max(0, Number(query.wait) || 0));
      if (rec.offset + rec.chunks.length <= from && !rec.closed && wait > 0)
        await new Promise((resolve) => {
          const done = () => (clearTimeout(timer), resolve());
          const timer = setTimeout(() => (rec.waiters.delete(done), resolve()), wait);
          rec.waiters.add(done);
        });
      const chunks = rec.chunks.slice(Math.max(0, from - rec.offset));
      return { next: rec.offset + rec.chunks.length, text: chunks.join(""), closed: rec.closed, closedReason: rec.closedReason ?? null };
    });

    api.post("/sessions/:id/input", ({ app, params, body, who }) => {
      const rec = sessionsOf(app).get(params.id);
      mineOrOwner(rec, who);
      if (rec.closed) throw bad("That terminal session has ended.", 410);
      const data = String(body.data ?? "");
      if (!data || data.length > 8192) throw bad("Send between 1 and 8192 characters at a time.");
      rec.bytesIn += Buffer.byteLength(data);
      rec.linesEntered += (data.match(/\r/g) ?? []).length;
      touch(app, rec);
      rec.stream.write(data);
      return { ok: true };
    });

    api.post("/sessions/:id/resize", ({ app, params, body, who }) => {
      const rec = sessionsOf(app).get(params.id);
      mineOrOwner(rec, who);
      if (rec.closed) throw bad("That terminal session has ended.", 410);
      const cols = Math.min(300, Math.max(20, Math.round(Number(body.cols)) || 80));
      const rows = Math.min(100, Math.max(5, Math.round(Number(body.rows)) || 24));
      rec.stream.setWindow(rows, cols, 0, 0);
      return { cols, rows };
    });

    api.delete("/sessions/:id", async ({ app, params, who }) => {
      const rec = sessionsOf(app).get(params.id);
      mineOrOwner(rec, who);
      await endSession(app, rec, "closed by the owner");
      return { closed: true };
    });
  },
};
