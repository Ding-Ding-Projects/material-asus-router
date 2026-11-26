// The HTTP routes for change safety and the household. app.mjs calls
// defineSafetyRoutes once; every route goes through the same table as the rest,
// so sign-in, CSRF and role checks always apply (viewers can only read).
import { impactOfEntry, LEVELS, SERVICE_LEVELS } from "./impact.mjs";
import { refuse } from "./safety.mjs";

const bad = (message, status = 400, code = undefined, extra = {}) => Object.assign(new Error(message), { status, code, ...extra });
const ownerOnly = (who) => {
  if (who.role !== "owner") throw refuse("Only the owner can do this.", "只有擁有人先可以咁做。", "OWNER_ONLY", 403);
};

export function defineSafetyRoutes(app, route, { liveContext, readDevices, actionNames, actionInfo, ACTIONS, http, httpRaw }) {
  const safety = () => app.safety;
  const history = () => app.safety.history;
  const household = () => app.safety.household;

  // ---- settings and the impact table ---------------------------------------------

  route("GET", "/api/safety/settings", () => safety().settings());
  route("POST", "/api/safety/settings", async ({ body }) => {
    if (body.liveMode !== undefined) await safety().setLiveMode(body.liveMode === true);
    return safety().settings();
  });

  route("GET", "/api/safety/impact", async () => {
    const ctx = await liveContext(app);
    const entries = {};
    for (const entry of ctx.catalog) entries[entry.id] = impactOfEntry(entry).level;
    const actions = {};
    for (const name of ACTIONS) actions[name] = safety().actionImpact(name, {}).level;
    for (const name of actionNames()) actions[name] = safety().actionImpact(name, {}).level;
    return { levels: LEVELS, entries, actions, services: SERVICE_LEVELS };
  });

  // ---- confirmation ---------------------------------------------------------------

  // Starts a four-key confirmation for a preview, an action or a scheduled change.
  route("POST", "/api/safety/confirm/begin", async ({ body, who }) => {
    if (body.previewId) {
      const p = app.engine.peek(String(body.previewId));
      if (!p) throw bad("That preview expired. Preview the changes again.", 410);
      if (!(await safety().keysNeeded(p.impact.level))) return { required: false, impact: p.impact.level };
      return { required: true, ...safety().beginConfirmation({ who, target: `preview:${body.previewId}`, impact: p.impact.level, shortName: p.shortName }) };
    }
    if (body.action) {
      const name = String(body.action);
      if (!ACTIONS.includes(name) && !actionInfo(name)) throw bad("That action does not exist.", 404);
      const { level } = safety().actionImpact(name, body.body ?? {});
      // A reboot always takes the keys, whatever the household allows.
      if (!(name === "reboot" ? safety().options.fourKey : await safety().keysNeeded(level))) return { required: false, impact: level };
      return { required: true, ...safety().beginConfirmation({ who, target: `action:${name}`, impact: level, shortName: safety().actionShortName(name, body.body ?? {}) }) };
    }
    if (body.schedule) {
      const input = { changes: body.schedule.changes, ops: body.schedule.ops, restart: body.schedule.restart };
      const view = await app.engine.preview(input, { user: who.name, meta: { mode: "quiet", source: "quiet", userId: who.userId } });
      if (!(await safety().keysNeeded(view.impact.level))) return { required: false, impact: view.impact.level };
      return { required: true, ...safety().beginConfirmation({ who, target: `schedule:${safety().hash(input)}`, impact: view.impact.level, shortName: view.shortName }) };
    }
    throw bad("Say what to confirm: a previewId, an action or a schedule.");
  });

  route("POST", "/api/changes/live", async ({ body, who }) => safety().applyLive(body, who));

  // ---- undo and redo ----------------------------------------------------------------

  route("GET", "/api/safety/undo-state", ({ who }) => safety().undoState(who));
  route("POST", "/api/safety/undo", async ({ body, who }) => safety().stackStep("undo", who, body));
  route("POST", "/api/safety/redo", async ({ body, who }) => safety().stackStep("redo", who, body));

  // ---- history ------------------------------------------------------------------------

  route("GET", "/api/safety/history", async ({ query }) => history().list(query));
  route("GET", "/api/safety/history/diff", async ({ query }) => {
    if (!query.a) throw bad("Give the version to look at as a.");
    return history().diff(query.a, query.b || null);
  });
  route("GET", "/api/safety/history/stats", async () => history().stats());
  route("GET", "/api/safety/history/export", async ({ query }) => {
    const out = await history().export({ format: query.format === "csv" ? "csv" : "json" });
    return httpRaw(out.body, { "Content-Type": out.type, "Content-Disposition": `attachment; filename="${out.name}"`, "Cache-Control": "no-store" });
  });
  route("GET", "/api/safety/history/setting", async ({ query }) => {
    if (!query.key && !query.id) throw bad("Give the setting as key or id.");
    return history().settingHistory(query.key || query.id);
  });
  route("GET", "/api/safety/history/bookmarks", async () => ({ items: await history().bookmarks() }));
  route("POST", "/api/safety/history/bookmarks", async ({ body, who }) => http(201, await history().addBookmark(body.oid, { label: body.label, note: body.note, by: who.name, email: `${String(who.name).toLowerCase().replace(/[^a-z0-9]+/g, ".")}@history.local` })));
  route("DELETE", "/api/safety/history/bookmarks/:id", async ({ params }) => history().removeBookmark(params.id));
  route("POST", "/api/safety/history/restore", async ({ body, who }) => safety().restore(body, who));
  route("GET", "/api/safety/history/:oid", async ({ params }) => {
    const commit = await history().resolve(params.oid);
    return { commit, ...(await history().diff(commit.oid)) };
  });

  // ---- waiting changes (later, or when the house is quiet) --------------------------------

  route("GET", "/api/safety/pending", () => ({ items: safety().pendingList() }));
  route("POST", "/api/safety/pending", async ({ body, who }) => http(201, await safety().schedule(body, who)));
  route("DELETE", "/api/safety/pending/:id", async ({ params, who }) => safety().cancelPending(params.id, who));

  // ---- the reboot launch sequence -------------------------------------------------------------

  route("POST", "/api/safety/launch/begin", async ({ body, who }) => http(201, safety().beginLaunch(who, body.confirmation)));
  route("GET", "/api/safety/launch/:id", ({ params, who }) => {
    const run = safety().launch.runs.get(params.id);
    if (!run || run.userId !== (who.userId ?? who.name)) throw bad("That launch sequence does not exist.", 404, "LAUNCH_GONE");
    return safety().launch.view(run);
  });
  const uid = (who) => who.userId ?? who.name;
  route("POST", "/api/safety/launch/:id/open-cover", ({ params, who }) => safety().launch.openCover(params.id, uid(who)));
  route("POST", "/api/safety/launch/:id/arm", ({ params, who }) => safety().launch.arm(params.id, uid(who)));
  route("POST", "/api/safety/launch/:id/code", ({ params, who, body }) => safety().launch.code(params.id, uid(who), body.code));
  route("POST", "/api/safety/launch/:id/key", ({ params, who, body }) => safety().launch.key(params.id, uid(who), Number(body.key), body.state === "down" ? "down" : "up"));
  route("POST", "/api/safety/launch/:id/keys-ready", ({ params, who }) => safety().launch.keysReady(params.id, uid(who)));
  route("POST", "/api/safety/launch/:id/countdown", ({ params, who }) => safety().launch.countdown(params.id, uid(who)));
  route("POST", "/api/safety/launch/:id/abort", ({ params, who }) => safety().launch.abort(params.id, uid(who)));
  route("POST", "/api/safety/launch/:id/launch", async ({ params, who }) => safety().fireLaunch(params.id, who));

  // ---- live progress ------------------------------------------------------------------------------

  route("GET", "/api/safety/runs", () => ({ items: safety().progress.list() }));
  route("GET", "/api/safety/runs/:id", ({ params }) => {
    const run = safety().progress.get(params.id);
    if (!run) throw bad("That run does not exist.", 404);
    return run;
  });
  route("GET", "/api/safety/runs/:id/events", async ({ params, req, res }) => {
    if (!safety().progress.get(params.id)) throw bad("That run does not exist.", 404);
    await safety().progress.stream(params.id, req, res);
  });

  // ---- the household ----------------------------------------------------------------------------------

  route("GET", "/api/household", () => household().view());
  route("PUT", "/api/household", async ({ body, who }) => {
    ownerOnly(who);
    return household().update(body);
  });
  route("POST", "/api/household/members", async ({ body, who }) => {
    ownerOnly(who);
    return http(201, await household().addMember(body));
  });
  route("PATCH", "/api/household/members/:id", async ({ params, body, who }) => {
    ownerOnly(who);
    return household().updateMember(params.id, body);
  });
  route("DELETE", "/api/household/members/:id", async ({ params, who }) => {
    ownerOnly(who);
    return household().removeMember(params.id);
  });
  route("GET", "/api/household/devices", async () => ({ devices: await household().devices(await liveContext(app), readDevices) }));
  route("GET", "/api/household/networks", async () => {
    const ctx = await liveContext(app);
    const networks = household().networkList(ctx);
    const clients = await household().clients(ctx);
    return { networks: networks.map((n) => ({ ...n, clients: clients?.find((c) => c.ifname === n.ifname)?.clients.length ?? null })) };
  });
  route("GET", "/api/household/presence", async () => household().presence(await liveContext(app)));
  route("GET", "/api/household/allowance", async () => household().allowance(await liveContext(app)));
  route("GET", "/api/household/quiet", async () => household().isQuiet(await liveContext(app)));
  route("PUT", "/api/household/homeassistant", async ({ body, who }) => {
    ownerOnly(who);
    return household().setHomeAssistant({ url: body.url, token: body.token });
  });
  route("GET", "/api/household/homeassistant/entities", async ({ who }) => {
    ownerOnly(who);
    return household().haEntities();
  });
  route("POST", "/api/household/homeassistant/test", async ({ who }) => {
    ownerOnly(who);
    const { entities } = await household().haEntities();
    return { ok: true, entities: entities.length };
  });
}
