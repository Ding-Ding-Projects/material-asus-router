// Merlin extras: custom scripts with a reviewed, super-confirmed save, a cron
// job builder, Entware and add-on lists, and JFFS usage. All of it needs
// Asuswrt-Merlin; on stock firmware the screen shows why it is switched off.
import { createHash, randomBytes } from "node:crypto";
import { L, ON_OFF, quote } from "../kit.mjs";
import { HOOKS, JOB_ID, KNOWN_ADDONS, SCRIPT_NAME, buildCron, checkScript, diffLines, parseCron, parseJffs, warnings } from "./tools.mjs";

const ID = "merlin-pro";
const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const sha = (text) => createHash("sha256").update(text).digest("hex");
const REVIEW_MS = 10 * 60 * 1000;

// Reviews wait here until the save action turns them in. One use each.
const reviews = new Map();
const sweep = () => {
  for (const [token, r] of reviews) if (r.expiresAt < Date.now()) reviews.delete(token);
};

export const catalog = () => [
  { id: `${ID}.jffs`, domain: ID, group: "storage", groupLabel: L("Storage", "儲存"), key: "jffs2_on", control: "switch", values: ON_OFF, restart: "", risk: "low", firmware: "merlin",
    label: L("Use the JFFS partition", "使用 JFFS 分區"), help: L("A small area that keeps scripts and add-ons across restarts. Needed by custom scripts and cron persistence. Takes effect after a restart.", "一個細小嘅儲存區，重啟後仍然保留腳本同附加功能。自訂腳本同定時工作需要。重啟後生效。") },
];

const lines = (text) => String(text).split("\n").map((l) => l.trim()).filter(Boolean);
const run = async (exec, command) => {
  const out = await exec(command);
  return out.code === 0 ? out.stdout : null;
};
const scriptPath = (name) => `/jffs/scripts/${name}`;

async function listScripts(exec) {
  return lines((await run(exec, "ls -1 /jffs/scripts")) ?? "").filter((n) => SCRIPT_NAME.test(n)).sort().map((name) => ({ name, hook: HOOKS[name] ?? null }));
}

export default {
  id: ID,
  catalog,
  domainMeta: [{ id: ID, icon: "extension", label: L("Merlin tools", "Merlin 工具"), group: { en: "Router", yue: "路由器" }, firmware: "merlin", live: true }],
  domains: {
    [ID]: async (ctx) => {
      const base = { entries: ctx.entries(), related: ctx.entries("merlin"), supported: ctx.info.merlin };
      if (!ctx.info.merlin) return { ...base, scripts: [], cron: [], entware: { present: false, packages: [] }, addons: [], amtm: false, jffs: null };
      const entware = (await run(ctx.exec, "test -x /opt/bin/opkg && echo yes || echo no"))?.trim() === "yes";
      const found = lines((await run(ctx.exec, "ls -1 -p /jffs/addons")) ?? "").filter((n) => n.endsWith("/")).map((n) => n.slice(0, -1));
      const amtm = (await run(ctx.exec, "test -f /jffs/scripts/amtm && echo yes || echo no"))?.trim() === "yes";
      return {
        ...base,
        scripts: await listScripts(ctx.exec),
        cron: parseCron((await run(ctx.exec, "cru l")) ?? ""),
        entware: { present: entware, packages: entware ? lines((await run(ctx.exec, "/opt/bin/opkg list-installed")) ?? "").map((l) => { const [name, , version] = l.split(" "); return { name, version: version ?? "" }; }).filter((p) => /^[A-Za-z0-9._+-]+$/.test(p.name)) : [] },
        addons: found.filter((n) => /^[A-Za-z0-9._-]{1,48}$/.test(n)).map((name) => ({ name, about: KNOWN_ADDONS[name] ?? null })),
        amtm,
        jffs: parseJffs((await run(ctx.exec, "df -k /jffs")) ?? ""),
      };
    },
  },
  routes(api) {
    const needMerlin = async (live) => {
      const ctx = await live();
      if (!ctx.info.merlin) throw bad("This needs Asuswrt-Merlin firmware.", 409);
      return ctx;
    };

    api.get("/scripts/:name", async ({ params, live }) => {
      const { exec } = await needMerlin(live);
      if (!SCRIPT_NAME.test(params.name)) throw bad("That is not a script name.");
      const out = await exec(`head -n 100000 ${quote(scriptPath(params.name))}`);
      if (out.code !== 0) throw bad("That script does not exist.", 404);
      return { name: params.name, content: out.stdout, hook: HOOKS[params.name] ?? null, bytes: Buffer.byteLength(out.stdout) };
    });

    // Step one of a save: show exactly what would change. Nothing is written.
    api.post("/scripts/review", async ({ body, live, who }) => {
      const { exec } = await needMerlin(live);
      const name = String(body.name ?? "");
      const content = checkScript(name, body.content);
      const old = await exec(`head -n 100000 ${quote(scriptPath(name))}`);
      const before = old.code === 0 ? old.stdout : "";
      const diff = diffLines(before, content);
      const changed = diff.filter((d) => d.type !== "same").length;
      if (!changed && old.code === 0) throw bad("Nothing would change.");
      sweep();
      const token = randomBytes(16).toString("hex");
      reviews.set(token, { name, sha: sha(content), who: who.name, expiresAt: Date.now() + REVIEW_MS });
      return { token, name, exists: old.code === 0, added: diff.filter((d) => d.type === "add").length, removed: diff.filter((d) => d.type === "del").length, diff: diff.slice(0, 600), truncated: diff.length > 600, warnings: warnings(name, content), expiresIn: REVIEW_MS / 1000 };
    });

    // Cron builder: from a painted schedule to the exact lines. Nothing is written.
    api.post("/cron/build", async ({ body }) => ({ entries: buildCron(body) }));
  },
  actions: {
    // Step two: only a content that was reviewed, and only with both confirmations.
    "save-script": {
      risk: "destructive",
      run: async ({ body, exec, who, info }) => {
        if (!info.merlin) throw bad("This needs Asuswrt-Merlin firmware.", 409);
        const name = String(body.name ?? "");
        const content = checkScript(name, body.content);
        sweep();
        const review = reviews.get(String(body.token ?? ""));
        if (!review || review.name !== name || review.sha !== sha(content) || review.who !== who.name) throw bad("Review these exact changes first. The review expired or the text changed since.", 409);
        reviews.delete(body.token);
        const encoded = Buffer.from(content).toString("base64");
        const target = scriptPath(name);
        const out = await exec(`printf '%s' '${encoded}' | base64 -d > ${quote(`${target}.new`)} && chmod 755 ${quote(`${target}.new`)} && mv ${quote(`${target}.new`)} ${quote(target)}`);
        if (out.code !== 0) throw bad("The router could not write the script. Nothing was changed.", 502);
        const back = await exec(`head -n 100000 ${quote(target)}`);
        return { ok: true, name, verified: back.code === 0 && sha(back.stdout) === sha(content), bytes: Buffer.byteLength(content) };
      },
    },

    // Adds the jobs from a painted schedule. A job runs a command as root, so it needs both confirmations.
    "cron-add": {
      risk: "destructive",
      run: async ({ body, exec, info }) => {
        if (!info.merlin) throw bad("This needs Asuswrt-Merlin firmware.", 409);
        const entries = buildCron(body);
        for (const e of entries) {
          const out = await exec(`cru a ${e.id} ${quote(`${e.expression} ${e.command}`)}`);
          if (out.code !== 0) throw bad(`The router refused the job ${e.id}.`, 502);
        }
        return { ok: true, added: entries.map((e) => e.id), persistLines: entries.map((e) => e.line), note: "Jobs added with cru are forgotten when the router restarts. To keep them, add these lines to the services-start script." };
      },
    },

    "cron-delete": {
      risk: "network",
      confirm: ["hold"],
      run: async ({ body, exec, info }) => {
        if (!info.merlin) throw bad("This needs Asuswrt-Merlin firmware.", 409);
        const id = String(body.id ?? "");
        if (!JOB_ID.test(id)) throw bad("That is not a job name.");
        const jobs = parseCron((await run(exec, "cru l")) ?? "");
        if (!jobs.some((j) => j.id === id)) throw bad("That job does not exist.", 404);
        const out = await exec(`cru d ${id}`);
        return { ok: out.code === 0, id };
      },
    },
  },
  fakeRouter: {
    nvram: { jffs2_on: "1" },
    handlers: [
      (command, router) => {
        if (router.nvram["3rd-party"] !== "merlin") return undefined;
        const files = (router.jffs ??= new Map([
          ["firewall-start", "#!/bin/sh\n# Keep the printer reachable\niptables -I FORWARD -d 198.51.100.104 -j ACCEPT\n"],
          ["services-start", "#!/bin/sh\ncru a nightly-backup \"0 4 * * * /jffs/scripts/backup.sh\"\n"],
        ]));
        const cron = (router.cron ??= new Map([["nightly-backup", "0 4 * * * /jffs/scripts/backup.sh"]]));
        if (command === "ls -1 /jffs/scripts") return { stdout: `${[...files.keys()].join("\n")}\n` };
        if (command === "ls -1 -p /jffs/addons") return { stdout: "YazFi/\nscMerlin/\nmy-own-addon/\nreadme.txt\n" };
        if (command === "test -f /jffs/scripts/amtm && echo yes || echo no") return { stdout: "yes\n" };
        if (command === "test -x /opt/bin/opkg && echo yes || echo no") return { stdout: "yes\n" };
        if (command === "/opt/bin/opkg list-installed") return { stdout: "busybox - 1.36.1-1\nentware-opt - 227000-3\nnano - 7.2-1\n" };
        if (command === "df -k /jffs") return { stdout: "Filesystem           1K-blocks      Used Available Use% Mounted on\nubi:jffs2                65536     21504     44032  33% /jffs\n" };
        let m = command.match(/^head -n 100000 '\/jffs\/scripts\/([A-Za-z0-9._-]+)'$/);
        if (m) return files.has(m[1]) ? { stdout: files.get(m[1]) } : { code: 1, stdout: "" };
        m = command.match(/^printf '%s' '([A-Za-z0-9+/=]*)' \| base64 -d > '(\/jffs\/scripts\/[A-Za-z0-9._-]+)\.new' && chmod 755 '\2\.new' && mv '\2\.new' '\2'$/);
        if (m) {
          files.set(m[2].split("/").pop(), Buffer.from(m[1], "base64").toString("utf8"));
          return { stdout: "" };
        }
        if (command === "cru l") return { stdout: [...cron].map(([id, line]) => `${line} #${id}#`).join("\n") + (cron.size ? "\n" : "") };
        m = command.match(/^cru a ([A-Za-z0-9_-]+) '(.*)'$/);
        if (m) {
          cron.set(m[1], m[2]);
          return { stdout: "" };
        }
        m = command.match(/^cru d ([A-Za-z0-9_-]+)$/);
        if (m) return cron.delete(m[1]) ? { stdout: "" } : { code: 1, stdout: "" };
        return undefined;
      },
    ],
  },
};
