// The Support Tickets recovery desk. It is a local, playful notebook for people
// locked out of a toy lock. It sends nothing anywhere and nobody reads it.
// "Resolving" a ticket shows the folder where this app keeps its data (with a
// copy button on the page); it deletes nothing itself.
const ID = "support-tickets";
export const DISCLOSURE = "Nothing you write here is sent anywhere, and nobody reads it. These tickets stay on this computer.";
const CATEGORIES = ["locked-out", "forgot-pin", "lost-authenticator", "other"];
const MAX = 500;

const tickets = (app) => app.store.read().features?.[ID]?.tickets ?? [];
const clean = (v, max) => String(v ?? "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").trim().slice(0, max);

function folderInfo(app) {
  const folder = app.store.dir;
  const inContainer = folder === "/data" || process.env.DATA_DIR === "/data";
  const platform = { win32: "Windows", darwin: "macOS", linux: "Linux" }[process.platform] ?? process.platform;
  return {
    path: folder,
    platform,
    files: ["state.json", "vault.json", "vault.key", "history/"],
    hint: inContainer
      ? "The app runs in a container and keeps its data in /data. On the computer that hosts it, look at the volume or folder mounted there (compose.yaml names it), for example with: docker volume inspect."
      : `Open this folder in your file manager on ${platform}. Removing the lock records inside it (state.json and vault.json) clears every lock; keep a copy first.`,
    deletesNothing: true,
  };
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.get("/disclosure", () => ({ text: DISCLOSURE }));

    api.get("/tickets", ({ app, query }) => {
      const q = clean(query.q, 120);
      // Plain-text search happens here; the regex search runs in the browser, where a slow pattern cannot stall the server.
      const test = q ? (t) => `${t.subject} ${t.body} ${t.category}`.toLowerCase().includes(q.toLowerCase()) : () => true;
      return { tickets: tickets(app).filter(test).reverse(), total: tickets(app).length, categories: CATEGORIES };
    });

    api.post("/tickets", async ({ app, body, bad }) => {
      const subject = clean(body.subject, 120);
      if (!subject) throw bad("Give the ticket a short subject.");
      const category = CATEGORIES.includes(body.category) ? body.category : "other";
      let ticket;
      await app.store.update((s) => {
        s.features ??= {};
        const list = ((s.features[ID] ??= {}).tickets ??= []);
        if (list.length >= MAX) throw bad(`The desk holds up to ${MAX} tickets. Delete some first.`, 409);
        const number = (list.at(-1)?.number ?? 0) + 1;
        ticket = { id: crypto.randomUUID(), number, at: new Date().toISOString(), subject, body: clean(body.body, 2000), category, status: "open", resolution: "" };
        list.push(ticket);
      });
      return ticket;
    });

    // Resolving shows the data folder. It never deletes or changes anything else.
    api.post("/tickets/:id/resolve", async ({ app, params, bad }) => {
      let found;
      await app.store.update((s) => {
        found = (s.features?.[ID]?.tickets ?? []).find((t) => t.id === params.id);
        if (!found) throw bad("That ticket is not here.", 404);
        found.status = "resolved";
        found.resolvedAt = new Date().toISOString();
        found.resolution = "Shown the data folder. Nothing was deleted.";
      });
      return { ticket: found, folder: folderInfo(app) };
    });

    api.delete("/tickets/:id", async ({ app, params, bad }) => {
      await app.store.update((s) => {
        const list = s.features?.[ID]?.tickets ?? [];
        const i = list.findIndex((t) => t.id === params.id);
        if (i < 0) throw bad("That ticket is not here.", 404);
        list.splice(i, 1);
      });
      return { removed: true };
    });

    api.get("/folder", ({ app }) => folderInfo(app));

    api.get("/export", ({ app, query, bad }) => {
      const format = query.format ?? "json";
      const list = tickets(app);
      if (format === "json") return { format: "material-asus-router-tickets", version: 1, disclosure: DISCLOSURE, tickets: list };
      if (format === "csv") {
        const rows = [["number", "at", "category", "status", "subject", "body", "resolution"], ...list.map((t) => [t.number, t.at, t.category, t.status, t.subject, t.body, t.resolution])];
        return { format: "csv", text: rows.map((r) => r.map(csvCell).join(",")).join("\n") };
      }
      throw bad("Choose json or csv.");
    });
  },
};
