// The connection-loss guard. Before a risky change goes in, the router is
// given a small script that puts the old values back after a delay. If the
// app can still reach the router afterwards it cancels that script; if not,
// the router restores itself. The guard lives on the router, so it works even
// when the app can no longer talk to it.
import { nvramSet, nvramUnset, service } from "../router/shell.mjs";

export const GUARD_DIR = "/tmp/mar";
export const guardPath = (id) => `${GUARD_DIR}/r-${id}.sh`;

// One line per old value, then commit, then the same service restarts, then
// the script removes itself.
export function buildRevertScript(id, items, restarts) {
  const lines = items.map((item) => (item.old === null ? nvramUnset(item.key) : nvramSet(item.key, item.old)));
  lines.push("nvram commit", ...restarts.map(service), `rm -f ${guardPath(id)}`);
  return lines.join("\n");
}

export function buildGuardCommand(id, seconds, script) {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) throw new Error("Invalid guard id.");
  if (!Number.isInteger(seconds) || seconds < 5 || seconds > 900) throw new Error("Invalid guard time.");
  const encoded = Buffer.from(script, "utf8").toString("base64");
  const file = guardPath(id);
  return `mkdir -p ${GUARD_DIR}; printf '%s' '${encoded}' | base64 -d > ${file}; ( trap '' HUP; sleep ${seconds}; sh ${file} ) </dev/null >/dev/null 2>&1 & echo $!`;
}

export function parsePid(stdout) {
  const pid = Number.parseInt(String(stdout).trim(), 10);
  if (!Number.isInteger(pid) || pid < 2) throw new Error("The router did not start the safety timer.");
  return pid;
}

export const cancelCommands = (id, pid) => [`kill ${pid}`, `rm -f ${guardPath(id)}`];
