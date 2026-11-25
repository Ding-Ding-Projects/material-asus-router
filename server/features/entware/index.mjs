// Entware: the package manager many routers carry in /opt. Detects whether it
// is there, searches and lists packages, and runs opkg update, install, remove
// and upgrade with the output streamed live. It never installs Entware itself
// (that means running a script from the internet), and it will not remove the
// packages Entware itself stands on.
import { L, quote } from "../kit.mjs";
import { handler as fakeHandler } from "./fake.mjs";
import { amend, record } from "./history.mjs";
import { createJob, finish, jobsOf, news, push, streamExec } from "./jobs.mjs";

const ID = "entware";
const OPKG = "/opt/bin/opkg";
const PACKAGE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const QUERY = /^[A-Za-z0-9._+-]{2,40}$/;
// Taking these away would leave Entware unable to run or update itself.
export const ESSENTIAL = new Set(["opkg", "entware-opt", "entware-release", "libc", "libgcc1", "libpthread", "librt", "ld.so", "busybox", "terminfo", "zlib"]);
const bad = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });

export const parseList = (text) =>
  String(text ?? "").split("\n").map((l) => l.match(/^(\S+) - (\S+)(?: - (.*))?$/)).filter(Boolean).map((m) => ({ name: m[1], version: m[2], description: (m[3] ?? "").trim() }));
export const parseUpgradable = (text) =>
  String(text ?? "").split("\n").map((l) => l.match(/^(\S+) - (\S+) - (\S+)$/)).filter(Boolean).map((m) => ({ name: m[1], from: m[2], to: m[3] }));

async function state(exec) {
  const found = (await exec(`test -x ${OPKG} && echo yes || echo no`).catch(() => ({ stdout: "no" }))).stdout.trim() === "yes";
  if (!found) return { installed: false };
  const [version, arch, installed, upgradable, space] = [await exec(`${OPKG} --version`), await exec(`${OPKG} print-architecture`), await exec(`${OPKG} list-installed`), await exec(`${OPKG} list-upgradable`), await exec("df -k /opt")];
  const archs = String(arch.stdout).split("\n").map((l) => l.match(/^arch (\S+) (\d+)$/)).filter((m) => m && !["all", "noarch"].includes(m[1])).sort((a, b) => Number(b[2]) - Number(a[2]));
  const row = String(space.stdout).split("\n")[1]?.trim().split(/\s+/);
  return {
    installed: true,
    version: String(version.stdout).trim(),
    architecture: archs[0]?.[1] ?? "unknown",
    packages: parseList(installed.stdout).length,
    upgradable: parseUpgradable(upgradable.stdout),
    space: row ? { totalKb: Number(row[1]), usedKb: Number(row[2]), freeKb: Number(row[3]) } : null,
  };
}

const pkg = (value) => {
  const name = String(value ?? "").trim();
  if (!PACKAGE.test(name)) throw bad("Use a package name made of letters, digits, dots, dashes and plus signs.");
  return name;
};

export default {
  id: ID,
  domainMeta: [{ id: ID, icon: "deployed_code", label: L("Entware packages", "Entware 軟件包"), group: { en: "Power tools", yue: "進階工具" }, live: true }],
  domains: { [ID]: async (ctx) => state(ctx.exec) },

  routes(api) {
    api.get("/installed", async ({ live }) => ({ packages: parseList((await (await live()).exec(`${OPKG} list-installed`)).stdout).map((p) => ({ ...p, essential: ESSENTIAL.has(p.name) })) }));

    // Search the package lists the last update fetched (not the whole internet).
    api.get("/search", async ({ query, live, bad: fail }) => {
      const q = String(query.q ?? "").trim();
      if (!QUERY.test(q)) throw fail("Type at least two letters or digits to search.");
      const ctx = await live();
      const out = await ctx.exec(`${OPKG} find ${quote(`*${q}*`)}`);
      const have = new Set(parseList((await ctx.exec(`${OPKG} list-installed`)).stdout).map((p) => p.name));
      const all = parseList(out.stdout);
      return { query: q, total: all.length, results: all.slice(0, 50).map((p) => ({ ...p, installed: have.has(p.name) })) };
    });

    api.post("/run", async ({ app, body, who, live }) => {
      if (body.ack !== true) throw bad("Confirm the action first.", 403, { code: "CONFIRM" });
      const ctx = await live();
      if (!(await state(ctx.exec)).installed) throw bad("Entware is not installed on this router.", 409, { code: "NO_ENTWARE" });
      const op = String(body.op ?? "");
      let command;
      let label;
      if (op === "update") [command, label] = [`${OPKG} update`, L("Refresh the package lists", "更新套件清單")];
      else if (op === "upgrade") [command, label] = [`${OPKG} upgrade`, L("Upgrade every package", "升級所有套件")];
      else if (op === "install") [command, label] = [`${OPKG} install ${quote(pkg(body.package))}`, L("Install a package", "安裝套件")];
      else if (op === "upgrade-one") [command, label] = [`${OPKG} upgrade ${quote(pkg(body.package))}`, L("Upgrade a package", "升級套件")];
      else if (op === "remove") {
        const name = pkg(body.package);
        if (ESSENTIAL.has(name)) throw bad(`${name} is part of Entware itself, so it cannot be removed from here.`, 403, { code: "ESSENTIAL" });
        [command, label] = [`${OPKG} remove ${quote(name)}`, L("Remove a package", "移除套件")];
      } else throw bad("That operation does not exist.", 404);
      if (jobsOf(app) && [...jobsOf(app).values()].some((j) => j.status === "running")) throw bad("Another package job is still running. Wait for it to finish.", 409, { code: "BUSY" });
      const job = createJob(app, { action: op, label, command, risk: op === "remove" || op === "upgrade" ? "network" : "low", user: who.name, userId: who.userId });
      const histId = op === "update" ? null : await record(app, { user: who.name, risk: job.risk, label, detail: command, note: "Started." });
      (async () => {
        push(job, "note", `$ ${command}\n`);
        try {
          const { code } = await streamExec(ctx.session, command, { onData: (stream, text) => push(job, stream, text), timeoutMs: 600000 });
          finish(job, code === 0 ? "done" : "failed", code);
        } catch (error) {
          push(job, "note", `${error.message}\n`);
          finish(job, "failed", null);
        }
        if (histId) await amend(app, histId, { detail: `${command} (${job.status})`, note: job.status === "done" ? undefined : `Ended as ${job.status}.` });
      })();
      return { job: job.id, command };
    });

    api.get("/jobs/:id", async ({ app, params, query, who, bad: fail }) => {
      const job = jobsOf(app).get(params.id);
      if (!job || (job.userId !== who.userId && who.role !== "owner")) throw fail("That job is not here any more.", 404);
      return news(job, Math.max(0, Number(query.from) || 0), Math.min(15000, Math.max(0, Number(query.wait) || 0)));
    });
  },

  fakeRouter: { handlers: [fakeHandler] },
};
