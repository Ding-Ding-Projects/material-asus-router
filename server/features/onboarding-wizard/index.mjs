// The practical first-run setup guide. The steps do real things in the browser
// (the owner account already exists by the time the app opens; the router
// address, SSH sign-in and connection test go through the app's own router
// routes), and this half saves progress per person so the guide can be stopped
// and resumed, skipped step by step, or dismissed. No password is ever saved
// here; the router password goes straight to the connect route.
import { hostTarget } from "../kit.mjs";

const ID = "onboarding-wizard";
export const STEPS = ["owner", "router", "login", "test", "guard", "people", "polling", "finish"];
const OPTIONAL = new Set(["guard", "people", "polling"]);
const USER = /^[A-Za-z0-9._@-]{1,64}$/;

// Optional editable suggestions for the router step, set by whoever hosts the app
// (ROUTER_SUGGESTED_HOST and ROUTER_SUGGESTED_USER). Anything invalid is dropped.
export function suggestedRouter(env = process.env) {
  const out = {};
  try {
    if (env.ROUTER_SUGGESTED_HOST) out.host = hostTarget(String(env.ROUTER_SUGGESTED_HOST).trim());
  } catch { /* an invalid suggestion is ignored */ }
  const user = String(env.ROUTER_SUGGESTED_USER ?? "").trim();
  if (USER.test(user)) out.username = user;
  return out;
}

const mineOf = (app, userId) => app.store.read().features?.[ID]?.progress?.[userId] ?? { step: 0, done: [], skipped: [], completed: false, dismissed: false, values: {} };

function cleanValues(input, bad) {
  const out = {};
  if (input.host !== undefined && input.host !== "") out.host = hostTarget(input.host);
  if (input.port !== undefined && input.port !== "") {
    const port = Number(input.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw bad("The SSH port is 1 to 65535.");
    out.port = port;
  }
  if (input.username !== undefined && input.username !== "") {
    if (!USER.test(String(input.username))) throw bad("An SSH user name is letters, digits and . _ @ - only.");
    out.username = String(input.username);
  }
  if (input.authType !== undefined) {
    if (!["password", "key"].includes(input.authType)) throw bad("Choose a password or a key.");
    out.authType = input.authType;
  }
  if (input.pollSeconds !== undefined && input.pollSeconds !== "") {
    const n = Number(input.pollSeconds);
    if (!Number.isInteger(n) || n < 2 || n > 60) throw bad("Check the router every 2 to 60 seconds.");
    out.pollSeconds = n;
  }
  return out;
}

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.get("/progress", ({ app, who }) => {
      const p = mineOf(app, who.userId);
      const router = app.store.read().router;
      return { steps: STEPS, optional: [...OPTIONAL], ...p, ownerDone: true, routerConfigured: Boolean(router?.host), suggested: suggestedRouter(), router: router ? { host: router.host, port: router.port, username: router.username, authType: router.authType } : null };
    });

    api.post("/progress", async ({ app, who, body, bad }) => {
      const step = Number(body.step);
      if (!Number.isInteger(step) || step < 0 || step >= STEPS.length) throw bad("That step does not exist.");
      const values = cleanValues(body.values ?? {}, bad);
      const mark = (list, name) => (list.includes(name) ? list : [...list, name]);
      let saved;
      await app.store.update((s) => {
        s.features ??= {};
        const bucket = ((s.features[ID] ??= {}).progress ??= {});
        const p = (bucket[who.userId] ??= { step: 0, done: [], skipped: [], completed: false, dismissed: false, values: {} });
        p.step = step;
        p.values = { ...p.values, ...values };
        if (body.finished && STEPS[body.finished]) {
          p.done = mark(p.done, STEPS[body.finished]);
          p.skipped = p.skipped.filter((id) => id !== STEPS[body.finished]);
        }
        if (body.skipped) {
          if (!OPTIONAL.has(body.skipped)) throw bad("Only optional steps can be skipped.");
          p.skipped = mark(p.skipped, body.skipped);
        }
        saved = structuredClone(p);
      });
      return saved;
    });

    api.post("/complete", async ({ app, who, bad }) => {
      if (!app.store.read().router?.host) throw bad("Connect a router before finishing the guide.", 409, { code: "NO_ROUTER" });
      await app.store.update((s) => {
        const p = (((s.features ??= {})[ID] ??= {}).progress ??= {})[who.userId] ??= { step: 0, done: [], skipped: [], completed: false, dismissed: false, values: {} };
        p.completed = true;
        p.step = STEPS.length - 1;
      });
      return { completed: true };
    });

    api.post("/dismiss", async ({ app, who }) => {
      await app.store.update((s) => {
        const p = (((s.features ??= {})[ID] ??= {}).progress ??= {})[who.userId] ??= { step: 0, done: [], skipped: [], completed: false, dismissed: false, values: {} };
        p.dismissed = true;
      });
      return { dismissed: true };
    });

    // Starts the guide again from the first step.
    api.post("/restart", async ({ app, who }) => {
      await app.store.update((s) => void delete s.features?.[ID]?.progress?.[who.userId]);
      return { restarted: true };
    });
  },
};
