// Read-only flash backup. It lists the router's flash partitions and copies the
// boot loader and nvram partitions to a USB drive, then checks the copy against
// the flash with a SHA-256. There is no way to write to flash from here: the
// partition is only ever read (the only write is the new file on the USB
// drive). The nvram partition holds Wi-Fi passwords, so only the owner can copy.
import { L, quote } from "../kit.mjs";
import { handler as fakeHandler } from "./fake.mjs";
import { amend, record } from "./history.mjs";
import { createJob, finish, jobsOf, news, push, streamExec } from "./jobs.mjs";

const ID = "flash-backup";
const bad = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });
// Only these are offered: the boot loader and the settings partitions.
export const OFFERED = /^(boot|bootloader|cfe|pmon|u-?boot|nvram[0-9]*)$/i;
const FOLDER = "router-flash-backup";
const MOUNT = /^\/tmp\/mnt\/[A-Za-z0-9._-]{1,40}$/;

export function parseMtd(text) {
  const out = [];
  for (const line of String(text ?? "").split("\n")) {
    const m = line.match(/^mtd(\d+):\s+([0-9a-f]+)\s+([0-9a-f]+)\s+"([^"]*)"/i);
    if (m) out.push({ index: Number(m[1]), size: Number.parseInt(m[2], 16), erase: Number.parseInt(m[3], 16), name: m[4], offered: OFFERED.test(m[4]) });
  }
  return out;
}

export function parseMounts(text) {
  return String(text ?? "").split("\n").map((l) => l.match(/^(\/dev\/\S+) on (\/tmp\/mnt\/[A-Za-z0-9._-]{1,40}) type (\S+)/)).filter(Boolean).map((m) => ({ device: m[1], mount: m[2], type: m[3] }));
}

async function targets(exec) {
  const out = [];
  for (const m of parseMounts((await exec("mount")).stdout)) {
    const row = (await exec(`df -k ${quote(m.mount)}`)).stdout.split("\n").map((l) => l.trim().split(/\s+/)).find((p) => p[p.length - 1] === m.mount);
    out.push({ ...m, totalKb: row ? Number(row[1]) : null, freeKb: row ? Number(row[3]) : null });
  }
  return out;
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "-");
const safeName = (name) => String(name).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "partition";

async function listBackups(exec, mount) {
  const out = await exec(`ls -lA ${quote(`${mount}/${FOLDER}`)}`);
  if (out.code !== 0) return [];
  return out.stdout.split("\n").map((l) => l.match(/^-[rwx-]{9}\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\w{3}\s+\d+\s+[\d:]+)\s+(.+\.bin)$/)).filter(Boolean).map((m) => ({ name: m[3], size: Number(m[1]), modified: m[2] }));
}

export default {
  id: ID,
  domainMeta: [{ id: ID, icon: "save", label: L("Flash backup", "快閃備份"), group: { en: "Power tools", yue: "進階工具" }, live: true }],
  domains: {
    [ID]: async (ctx) => {
      const partitions = parseMtd((await ctx.exec("head -n 100000 /proc/mtd")).stdout);
      const drives = await targets(ctx.exec);
      const existing = [];
      for (const d of drives) for (const f of await listBackups(ctx.exec, d.mount)) existing.push({ ...f, mount: d.mount });
      return { partitions, targets: drives, existing, folder: FOLDER, readOnly: true };
    },
  },

  routes(api) {
    api.post("/copy", async ({ app, body, who, live }) => {
      if (who.role !== "owner") throw bad("The settings partition holds Wi-Fi passwords, so only the owner can copy it to a drive.", 403, { code: "OWNER_ONLY" });
      if (body.ack !== true) throw bad("Confirm the copy first.", 403, { code: "CONFIRM" });
      const ctx = await live();
      const part = parseMtd((await ctx.exec("head -n 100000 /proc/mtd")).stdout).find((p) => p.index === Number(body.partition));
      if (!part) throw bad("That partition is not on this router.", 404);
      if (!part.offered) throw bad("Only the boot loader and the settings (nvram) partitions can be copied here.", 403, { code: "NOT_OFFERED" });
      const mount = String(body.target ?? "");
      if (!MOUNT.test(mount)) throw bad("Choose a USB drive.");
      const drive = (await targets(ctx.exec)).find((d) => d.mount === mount);
      if (!drive) throw bad("That drive is not mounted on the router.", 404);
      if (drive.freeKb !== null && drive.freeKb * 1024 < part.size + 1024 * 1024) throw bad("There is not enough free space on that drive.", 409, { code: "NO_SPACE" });
      if ([...jobsOf(app).values()].some((j) => j.status === "running")) throw bad("Another copy is still running.", 409, { code: "BUSY" });

      const device = `/dev/mtdblock${part.index}`;
      const dir = `${mount}/${FOLDER}`;
      const file = `${dir}/mtd${part.index}-${safeName(part.name)}-${stamp()}.bin`;
      const commands = [`mkdir -p ${quote(dir)}`, `dd if=${device} of=${quote(file)} bs=64k`, "sync", `sha256sum ${device} ${quote(file)}`];
      const label = L(`Copy the ${part.name} partition`, `複製 ${part.name} 分區`);
      const job = createJob(app, { action: "copy", label, command: commands.join("; "), risk: "low", user: who.name, userId: who.userId });
      const histId = await record(app, { user: who.name, risk: "low", label, detail: `${device} -> ${file}`, note: "Started." });
      (async () => {
        let verified = false;
        try {
          let sums = "";
          for (const command of commands) {
            push(job, "note", `$ ${command}\n`);
            const { code } = await streamExec(ctx.session, command, { onData: (stream, text) => { if (stream === "out" && command.startsWith("sha256sum")) sums += text; push(job, stream, text); }, timeoutMs: 180000 });
            if (code !== 0) throw new Error(`The router stopped at: ${command} (exit ${code}).`);
          }
          const hashes = sums.split("\n").map((l) => l.trim().split(/\s+/)[0]).filter((h) => /^[0-9a-f]{64}$/.test(h));
          verified = hashes.length === 2 && hashes[0] === hashes[1];
          push(job, "note", verified ? `Checked: the copy and the flash have the same SHA-256 (${hashes[0].slice(0, 16)}…).\n` : "The copy does NOT match the flash. Do not rely on it, and try again.\n");
          finish(job, verified ? "done" : "failed", 0);
        } catch (error) {
          push(job, "note", `${error.message}\n`);
          finish(job, "failed", null);
        }
        await amend(app, histId, { detail: `${device} -> ${file} (${job.status}${verified ? ", checked" : ""})`, note: verified ? undefined : "The copy could not be checked." });
      })();
      return { job: job.id, file, device, size: part.size };
    });

    api.get("/jobs/:id", async ({ app, params, query, who, bad: fail }) => {
      const job = jobsOf(app).get(params.id);
      if (!job || (job.userId !== who.userId && who.role !== "owner")) throw fail("That job is not here any more.", 404);
      return news(job, Math.max(0, Number(query.from) || 0), Math.min(15000, Math.max(0, Number(query.wait) || 0)));
    });
  },

  fakeRouter: { handlers: [fakeHandler] },
};
