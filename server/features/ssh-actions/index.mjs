// The action catalogue: everything the app can do over SSH as a card with real
// controls, a risk level, the exact command it will send and live output.
// Low risk asks once, network risk runs under a safety net that puts things
// back if the router stops answering, and destructive risk needs the two-key
// super confirmation. Files can be browsed, edited after a reviewed save,
// uploaded, downloaded and deleted in /jffs, /tmp and /opt.
//
// Nothing here writes a setting itself: keys and lights go through the change
// engine's preview, and rebooting is left to the Maintenance screen.
import { L, quote } from "../kit.mjs";
import { ACTIONS, GROUPS, actionById, checkParams, unavailable } from "./catalogue.mjs";
import { DOWNLOAD_LIMIT, ROOTS, UPLOAD_LIMIT, checkUpload, deleteEntry, deleteNeedsSuper, listFolder, readBytes, readText, reviewSave, safePath, saveReviewed, writeBytes } from "./files.mjs";
import { handler as fakeHandler } from "./fake.mjs";
import { watchGuard } from "./guard.mjs";
import { amend, record } from "./history.mjs";
import { createJob, finish, jobsOf, news, push, streamExec, view } from "./jobs.mjs";
import { SOURCES, bad, parseProcesses, resolveOptions } from "./sources.mjs";

const ID = "ssh-actions";
const DENIED_NAMES = /^(\.sys|nvram)$/;

// A finished super confirmation hands out a single-use token (see super-confirmation).
const useToken = (app, token, action, userId) => {
  const rec = app.superTokens?.get(String(token ?? ""));
  if (!rec || rec.exp < Date.now() || rec.action !== action || rec.userId !== userId) return false;
  app.superTokens.delete(String(token));
  return true;
};
const needSuper = (app, body, who, action) => {
  if (!useToken(app, body.token, action, who.userId)) throw bad("This needs the two-key confirmation first.", 403, { code: "SUPER_CONFIRM_REQUIRED", action });
};
const canWork = (who) => who.role === "owner" || who.role === "operator";
const needWork = (who) => {
  if (!canWork(who)) throw bad("Your account can view the router but not change it or read its files.", 403, { code: "ROLE" });
};

async function probesOf(exec) {
  const out = {};
  for (const name of ["cru", "iperf3"]) out[name] = (await exec(`command -v ${name}`).catch(() => ({ code: 1 }))).code === 0;
  return out;
}

const clean = (def) => ({ id: def.id, type: def.type, label: def.label, help: def.help, options: def.options, source: def.source, min: def.min, max: def.max, unit: def.unit, default: def.default, presets: def.presets, pattern: def.pattern, required: def.required });

function cardOf(action, probes) {
  // For a card whose risk depends on one choice, tell the screen each choice's risk.
  let riskBy = null;
  if (action.riskFor) {
    const param = action.params.find((p) => p.options);
    if (param) {
      const defaults = Object.fromEntries(action.params.filter((p) => p.default !== undefined).map((p) => [p.id, p.default]));
      riskBy = { param: param.id, values: Object.fromEntries(param.options.map((o) => [o.value, action.riskFor({ ...defaults, [param.id]: o.value })])) };
    }
  }
  return { id: action.id, group: action.group, icon: action.icon, label: action.label, help: action.help, risk: action.risk, riskBy, view: action.view ?? null, live: Boolean(action.live), viaEngine: Boolean(action.viaEngine), link: action.link ?? null, hidden: Boolean(action.hidden), unavailable: unavailable(action, probes), params: action.params.map(clean) };
}

const envOf = (ctx) => ({ exec: ctx.exec, nvram: ctx.nvram, info: ctx.info });

// The exact change for an action that goes through the change engine.
async function engineChange(action, params, ctx) {
  // sys.led is the "Turn the lights off" switch on AllLED, where 1 means the lights are on and 0 means off.
  if (action.id === "led") return { changes: [{ id: "sys.led", value: params.state === "off" ? "0" : "1" }] };
  const values = await ctx.session.nvram({ fresh: true });
  const keys = String(values.get("sshd_authkeys") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (action.id === "ssh-key-add") {
    if (keys.includes(params.key)) throw bad("That key is already allowed on the router.", 409);
    return { changes: [{ key: "sshd_authkeys", value: [...keys, params.key].join("\n"), risk: "network" }] };
  }
  const at = Number(params.key);
  if (!Number.isInteger(at) || !keys[at]) throw bad("That key is not on the router any more.", 404);
  return { changes: [{ key: "sshd_authkeys", value: keys.filter((_, i) => i !== at).join("\n"), risk: "network" }] };
}

async function prepare(body, ctx, who) {
  const action = actionById(String(body.id ?? ""));
  if (!action) throw bad("That action does not exist.", 404);
  if (action.link) throw bad("This one is done on the Maintenance screen.", 409, { code: "USE_MAINTENANCE", link: action.link });
  const probes = await probesOf(ctx.exec);
  const missing = unavailable(action, probes);
  if (missing) throw bad(missing.en, 409, { code: "UNAVAILABLE" });
  const env = envOf(ctx);
  const params = await checkParams(action, body.params, env);
  if (action.viaEngine) {
    if ((action.id === "ssh-key-add" || action.id === "ssh-key-remove") && who.role !== "owner") throw bad("Only the owner can change which SSH keys the router allows.", 403, { code: "ROLE" });
    return { action, params, engine: await engineChange(action, params, ctx) };
  }
  const built = await action.build(params, env);
  const risk = action.riskFor?.(params) ?? action.risk;
  return { action, params, built, risk };
}

async function execute(app, job, { action, built, risk, session, histId }) {
  let guard = null;
  try {
    if (risk === "network") guard = await watchGuard({ job, session, seconds: app.engine.guardSeconds, revert: built.revert });
    push(job, "note", `$ ${built.command}\n`);
    let code = 0;
    let dropped = false;
    try {
      ({ code } = await streamExec(session, built.command, { onData: (stream, text) => push(job, stream, text), timeoutMs: action.live ? 180000 : 60000 }));
    } catch (error) {
      if (!guard) throw error;
      dropped = true;
      push(job, "note", `The link to the router dropped: ${error.message}\n`);
    }
    let status = code === 0 && !dropped ? "done" : "failed";
    if (guard) {
      const state = await guard.settle();
      if (state === "reverted") status = "reverted";
      else if (state === "unreachable") status = "unreachable";
      else if (dropped) status = "done";
      // Only a link that really dropped is rebuilt, so a second job is never cut off for nothing.
      if (dropped || state !== "ok") await session.reconnect().catch(() => {});
    }
    session.invalidate();
    finish(job, status, code);
    if (status === "failed") push(job, "note", `The router answered with exit code ${code}.\n`);
  } catch (error) {
    push(job, "note", `${error.message}\n`);
    finish(job, "failed", null);
  }
  if (histId) await amend(app, histId, { detail: `${job.command} (${job.status})`, note: job.status === "done" ? undefined : `Ended as ${job.status}.` });
}

export default {
  id: ID,
  domainMeta: [{ id: ID, icon: "terminal", label: L("Action catalogue", "動作目錄"), group: { en: "Power tools", yue: "進階工具" }, live: true }],
  domains: {
    [ID]: async (ctx) => {
      const probes = await probesOf(ctx.exec);
      // The lights card starts on the opposite of what the router is doing now, the likely wish.
      const lightsOff = ctx.nvram.get("AllLED") === "0";
      const cards = ACTIONS.map((a) => cardOf(a, probes));
      const led = cards.find((c) => c.id === "led");
      if (led) led.params[0].default = lightsOff ? "on" : "off";
      return { groups: GROUPS.map(([id, label, icon]) => ({ id, label, icon })), actions: cards, probes, roots: ROOTS, uploadLimit: UPLOAD_LIMIT, downloadLimit: DOWNLOAD_LIMIT };
    },
  },

  routes(api) {
    // The choices for a card's list (interfaces, drives, jobs, keys ...), read now.
    api.get("/options/:source", async ({ params, live }) => {
      if (!Object.hasOwn(SOURCES, params.source)) throw bad("That list does not exist.", 404);
      const ctx = await live();
      return { source: params.source, options: await resolveOptions(params.source, { exec: ctx.exec, nvram: await ctx.session.nvram({ fresh: true }) }) };
    });

    api.get("/processes", async ({ live }) => {
      const ctx = await live();
      return { processes: parseProcesses((await ctx.exec("ps w")).stdout) };
    });

    // The exact command, without running it.
    api.post("/preview", async ({ body, who, live, preview }) => {
      needWork(who);
      const ctx = await live();
      const made = await prepare(body, ctx, who);
      if (made.engine) return { viaEngine: true, risk: made.action.risk, preview: await preview(made.engine) };
      return { viaEngine: false, command: made.built.command, risk: made.risk, revert: made.built.revert ?? [], guard: made.risk === "network", needsSuper: made.risk === "destructive" };
    });

    api.post("/run", async ({ app, body, who, live, preview }) => {
      needWork(who);
      const ctx = await live();
      const made = await prepare(body, ctx, who);
      if (made.engine) return { viaEngine: true, preview: await preview(made.engine) };
      if (body.ack !== true) throw bad("Confirm the action first.", 403, { code: "CONFIRM" });
      if (made.risk === "destructive") needSuper(app, body, who, `${ID}.${made.action.id}`);
      const job = createJob(app, { action: made.action.id, label: made.action.label, command: made.built.command, risk: made.risk, user: who.name, userId: who.userId });
      const histId = made.risk === "low" ? null : await record(app, { user: who.name, risk: made.risk, label: made.action.label, detail: made.built.command, note: "Started." });
      execute(app, job, { action: made.action, built: made.built, risk: made.risk, session: ctx.session, histId }).catch(() => finish(job, "failed", null));
      return { job: job.id, command: made.built.command, risk: made.risk };
    });

    // Everything after piece `from`; waits up to `wait` ms when there is nothing yet.
    api.get("/jobs/:id", async ({ app, params, query, who, bad: fail }) => {
      const job = jobsOf(app).get(params.id);
      if (!job || (job.userId !== who.userId && who.role !== "owner")) throw fail("That job is not here any more.", 404);
      return news(job, Math.max(0, Number(query.from) || 0), Math.min(15000, Math.max(0, Number(query.wait) || 0)));
    });
    api.get("/jobs", ({ app, who }) => ({ jobs: [...jobsOf(app).values()].filter((j) => j.userId === who.userId || who.role === "owner").map((j) => ({ ...view(j, 0), chunks: [] })).reverse() }));

    // ---- files -----------------------------------------------------------------
    api.get("/files/list", async ({ query, who, live }) => {
      needWork(who);
      const ctx = await live();
      const path = await safePath(ctx.exec, query.path ?? "/jffs", { root: true });
      const entries = await listFolder(ctx.exec, path);
      return { path, roots: ROOTS, entries: entries.filter((e) => !(path === "/jffs" && DENIED_NAMES.test(e.name))) };
    });
    api.get("/files/read", async ({ query, who, live }) => {
      needWork(who);
      const ctx = await live();
      return readText(ctx.exec, await safePath(ctx.exec, query.path));
    });
    api.post("/files/review", async ({ app, body, who, live }) => {
      needWork(who);
      const ctx = await live();
      return reviewSave(app, ctx.exec, { path: await safePath(ctx.exec, body.path), content: body.content, who });
    });
    api.post("/files/save", async ({ app, body, who, live }) => {
      needWork(who);
      const ctx = await live();
      const saved = await saveReviewed(app, ctx.exec, { id: body.id, who });
      await record(app, { user: who.name, risk: saved.path.startsWith("/tmp/") ? "low" : "network", label: L("File saved", "檔案已儲存"), detail: `${saved.path} (${saved.bytes} bytes${saved.isNew ? ", new file" : ""})` });
      return saved;
    });
    api.post("/files/upload", async ({ app, body, who, live }) => {
      needWork(who);
      const ctx = await live();
      const folder = await safePath(ctx.exec, body.folder, { root: true });
      const bytes = Buffer.from(String(body.data ?? ""), "base64");
      const path = await safePath(ctx.exec, checkUpload(folder, body.name, bytes.length));
      if (!body.replace && (await ctx.exec(`wc -c < ${quote(path)}`)).code === 0) throw bad("A file with that name is already there. Choose replace to overwrite it.", 409, { code: "EXISTS" });
      await writeBytes(ctx.exec, path, bytes, { executable: body.executable === true });
      await record(app, { user: who.name, risk: path.startsWith("/tmp/") ? "low" : "network", label: L("File uploaded", "檔案已上載"), detail: `${path} (${bytes.length} bytes)` });
      return { path, bytes: bytes.length };
    }, { limit: Math.ceil(UPLOAD_LIMIT * 1.4) + 4096 });
    api.get("/files/download", async ({ query, who, live, res }) => {
      needWork(who);
      const ctx = await live();
      const path = await safePath(ctx.exec, query.path);
      const buffer = await readBytes(ctx.exec, path, DOWNLOAD_LIMIT);
      const name = path.split("/").pop().replace(/[^A-Za-z0-9._-]/g, "_");
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"`, "Content-Length": buffer.length, "Cache-Control": "no-store" });
      res.end(buffer);
    });
    api.post("/files/delete", async ({ app, body, who, live }) => {
      needWork(who);
      const ctx = await live();
      const path = await safePath(ctx.exec, body.path);
      if (deleteNeedsSuper(path)) needSuper(app, body, who, `${ID}.file-delete`);
      const out = await deleteEntry(ctx.exec, path, { confirmName: body.confirmName });
      await record(app, { user: who.name, risk: deleteNeedsSuper(path) ? "destructive" : "low", label: L("File deleted", "檔案已刪除"), detail: path });
      return out;
    });
  },

  fakeRouter: { handlers: [fakeHandler] },
};
