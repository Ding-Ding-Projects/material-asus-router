// The pretend Merlin router's add-ons: three installed, one of them with no
// reviewed command, and two version scripts that answer.
const merlin = (router) => router.nvram["3rd-party"] === "merlin";
const DIRS = ["amtm", "connmon.d", "spdmerlin.d"];
const SCRIPTS = { "/jffs/scripts/spdmerlin": "spdMerlin version v4.4.8\n", "/jffs/scripts/connmon": "connmon version v3.0.1\n" };

export function handler(command, router) {
  if (!merlin(router)) return undefined;
  let m;
  if (command === "ls -1 /jffs/addons") return { stdout: `${DIRS.join("\n")}\n` };
  if ((m = command.match(/^du -sk \/jffs\/addons\/([A-Za-z0-9._-]+)$/))) return DIRS.includes(m[1]) ? { stdout: `${m[1] === "amtm" ? 48 : 412}\t/jffs/addons/${m[1]}\n` } : { code: 1 };
  if ((m = command.match(/^test -x (\/jffs\/scripts\/[A-Za-z0-9._-]+) && echo yes \|\| echo no$/))) return { stdout: SCRIPTS[m[1]] ? "yes\n" : "no\n" };
  if ((m = command.match(/^(\/jffs\/scripts\/[A-Za-z0-9._-]+) version$/))) return SCRIPTS[m[1]] ? { stdout: SCRIPTS[m[1]] } : { code: 127, stderr: "not found\n" };
  return undefined;
}
