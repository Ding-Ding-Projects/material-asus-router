// The safety net for an action that can cut the router off. Before the command
// runs the router is given a small script that puts things back after a delay.
// If the app can still open a brand new connection afterwards it cancels the
// script; if not, the router restores itself. This is the same idea the change
// engine uses for settings, here for commands.
import { randomBytes } from "node:crypto";
import { push } from "./jobs.mjs";

const DIR = "/tmp/mar";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function armCommand(id, seconds, script) {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) throw new Error("Invalid guard id.");
  if (!Number.isInteger(seconds) || seconds < 5 || seconds > 900) throw new Error("Invalid guard time.");
  const file = `${DIR}/r-${id}.sh`;
  const encoded = Buffer.from(script, "utf8").toString("base64");
  return `mkdir -p ${DIR}; printf '%s' '${encoded}' | base64 -d > ${file}; ( trap '' HUP; sleep ${seconds}; sh ${file} ) </dev/null >/dev/null 2>&1 & echo $!`;
}

// Arms the net (when there is something to put back), waits for the router to
// answer on a fresh connection, then cancels the net or reports that it fired.
// Pieces of news go to the job so the screen shows a live timeline.
export async function watchGuard({ job, session, seconds, revert, pollMs = 1000 }) {
  const id = randomBytes(8).toString("hex");
  let pid = null;
  if (revert?.length) {
    const script = [...revert, `rm -f ${DIR}/r-${id}.sh`].join("\n");
    const armed = await session.exec(armCommand(id, seconds, script));
    pid = Number.parseInt(String(armed.stdout).trim(), 10);
    if (armed.code !== 0 || !Number.isInteger(pid) || pid < 2) throw Object.assign(new Error("The router would not start its safety timer, so nothing was run."), { status: 502 });
    push(job, "note", `Safety net on: the router puts this back by itself after ${seconds} seconds if it stops answering.\n`);
  } else push(job, "note", "Nothing here needs putting back, so the safety net only checks that the router still answers.\n");
  job.guard = { state: "armed", seconds, pid };
  return {
    // Called after the command finished (or the link dropped).
    async settle() {
      const end = Date.now() + (seconds + 25) * 1000;
      for (;;) {
        let fresh = null;
        try {
          fresh = await session.openFresh();
          const answer = await fresh.exec("echo mar-alive");
          if (answer.stdout.includes("mar-alive")) {
            // The script removes itself when it has run, so a missing file means the net fired.
            const fired = pid ? (await fresh.exec(`test -f ${DIR}/r-${id}.sh && echo armed || echo fired`)).stdout.includes("fired") : false;
            if (pid && !fired) for (const c of [`kill ${pid}`, `rm -f ${DIR}/r-${id}.sh`]) await fresh.exec(c).catch(() => {});
            job.guard = { ...job.guard, state: fired ? "reverted" : "ok" };
            push(job, "note", fired ? "The safety net fired and put things back. The router answers again.\n" : job.guard.sawDown ? "The router came back by itself, so the safety net was switched off.\n" : "The router still answers, so the safety net was switched off.\n");
            return job.guard.state;
          }
        } catch {
          if (!job.guard.sawDown) push(job, "note", "The router is not answering yet. Waiting, and the safety net will act if it does not come back.\n");
          job.guard.sawDown = true;
        } finally {
          fresh?.close();
        }
        if (Date.now() > end) break;
        await sleep(pollMs);
      }
      job.guard = { ...job.guard, state: "unreachable" };
      push(job, "note", "The router did not answer in time. Check it, and try again in a minute.\n");
      return "unreachable";
    },
  };
}
