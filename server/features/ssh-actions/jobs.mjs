// Running a command and letting the browser watch it happen. A job keeps every
// piece of output as it arrives; the browser asks for "everything after piece
// N" and the server holds that question open until there is something new
// (long polling), so the output appears as fast as the router prints it.
import { randomBytes } from "node:crypto";

const KEEP = 60;
const MAX_CHUNKS = 4000;

export const jobsOf = (app) => (app.sshJobs ??= new Map());

// Runs one command on the app's own SSH link and reports each piece of output.
// The link's normal queue is not used so a slow command never blocks the screens.
export async function streamExec(session, command, { onData, timeoutMs = 120000 } = {}) {
  const connection = await session.ensure();
  return new Promise((resolve, reject) => {
    if (!connection.client) return reject(Object.assign(new Error("Not connected to the router."), { code: "UNREACHABLE" }));
    connection.client.exec(command, (error, stream) => {
      if (error) return reject(error);
      const timer = setTimeout(() => {
        stream.close();
        reject(Object.assign(new Error("The router took too long to finish."), { code: "TIMEOUT" }));
      }, timeoutMs);
      stream.on("data", (chunk) => onData?.("out", String(chunk)));
      stream.stderr.on("data", (chunk) => onData?.("err", String(chunk)));
      stream.on("close", (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 0 });
      });
    });
  });
}

export function createJob(app, fields) {
  const jobs = jobsOf(app);
  const job = { id: randomBytes(9).toString("base64url"), startedAt: new Date().toISOString(), status: "running", code: null, chunks: [], waiters: new Set(), ...fields };
  jobs.set(job.id, job);
  while (jobs.size > KEEP) {
    const oldest = [...jobs.values()].find((j) => j.status !== "running");
    if (!oldest) break;
    jobs.delete(oldest.id);
  }
  return job;
}

const wake = (job) => {
  for (const resolve of job.waiters) resolve();
  job.waiters.clear();
};

// stream: "out" and "err" are the command's own output, "note" is the app talking.
export function push(job, stream, text) {
  if (!text) return;
  if (job.chunks.length < MAX_CHUNKS) job.chunks.push({ n: job.chunks.length, stream, text });
  else if (job.chunks.at(-1)?.stream !== "cut") job.chunks.push({ n: job.chunks.length, stream: "cut", text: "\n[Output cut here: it was longer than this screen keeps.]\n" });
  wake(job);
}

export function finish(job, status, code = null) {
  job.status = status;
  job.code = code;
  job.finishedAt = new Date().toISOString();
  wake(job);
}

// Resolves with the job's news after piece `from`, waiting up to waitMs for some.
export async function news(job, from, waitMs) {
  if (job.chunks.length <= from && job.status === "running" && waitMs > 0)
    await new Promise((resolve) => {
      const timer = setTimeout(() => (job.waiters.delete(done), resolve()), waitMs);
      const done = () => (clearTimeout(timer), resolve());
      job.waiters.add(done);
    });
  return view(job, from);
}

export const view = (job, from = 0) => ({
  id: job.id,
  action: job.action,
  label: job.label,
  command: job.command,
  risk: job.risk,
  user: job.user,
  startedAt: job.startedAt,
  finishedAt: job.finishedAt ?? null,
  status: job.status,
  code: job.code,
  next: job.chunks.length,
  chunks: job.chunks.slice(from),
  guard: job.guard ?? null,
});
