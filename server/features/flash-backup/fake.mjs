// The pretend router's flash: five partitions and the commands used to copy
// one. The list of mounted drives is answered by the action catalogue's pretend
// router (the `mount` command), so both screens always agree.
import { createHash } from "node:crypto";

const MTD = ['mtd0: 00200000 00020000 "boot"', 'mtd1: 00100000 00020000 "nvram"', 'mtd2: 06000000 00020000 "image"', 'mtd3: 00100000 00020000 "misc1"', 'mtd4: 02000000 00020000 "rootfs_update"'];
const seedOf = (index) => createHash("sha256").update(`partition-${index}`).digest("hex");

export const flash = (router) => (router.flash ??= { dirs: new Set(), files: new Map(), corrupt: false });

const words = (command) => command.match(/'[^']*'|\S+/g)?.map((w) => w.replaceAll("'", "")) ?? [];

export function handler(command, router) {
  const state = flash(router);
  const w = words(command);
  let m;
  if (command === "head -n 100000 /proc/mtd") return { stdout: `dev:    size   erasesize  name\n${MTD.join("\n")}\n` };
  if (w[0] === "df" && w[1] === "-k" && w.length === 3 && /^\/tmp\/mnt\/[A-Za-z0-9._-]+$/.test(w[2]))
    return { stdout: `Filesystem           1K-blocks      Used Available Use% Mounted on\n/dev/sda1             15727616   2097152  13630464  13% ${w[2]}\n` };
  if (w[0] === "mkdir" && w[1] === "-p" && /\/router-flash-backup$/.test(w[2] ?? "") && w.length === 3) return (state.dirs.add(w[2]), {});
  if (w[0] === "dd" && (m = w[1]?.match(/^if=\/dev\/mtdblock(\d)$/)) && w[2]?.startsWith("of=") && w[3] === "bs=64k") {
    const target = w[2].slice(3);
    if (![...state.dirs].some((d) => target.startsWith(`${d}/`))) return { code: 1, stderr: "dd: can't open for writing\n" };
    const index = Number(m[1]);
    const size = Number.parseInt(MTD[index].split(" ")[1], 16);
    state.files.set(target, { size, hash: state.corrupt ? "0".repeat(64) : seedOf(index) });
    return { chunks: [`${size / 65536}+0 records in\n`, `${size / 65536}+0 records out\n`], chunkDelayMs: 20 };
  }
  if (w[0] === "sha256sum" && w.length === 3 && (m = w[1].match(/^\/dev\/mtdblock(\d)$/))) {
    const file = state.files.get(w[2]);
    return file ? { stdout: `${seedOf(Number(m[1]))}  ${w[1]}\n${file.hash}  ${w[2]}\n` } : { code: 1, stderr: "sha256sum: no such file\n" };
  }
  if (w[0] === "ls" && w[1] === "-lA" && w.length === 3 && state.dirs.has(w[2])) {
    const rows = [...state.files].filter(([p]) => p.startsWith(`${w[2]}/`)).map(([p, f]) => `-rw-r--r--    1 admin    root ${String(f.size).padStart(10)} Nov 25 09:12 ${p.split("/").pop()}`);
    return { stdout: `total 0\n${rows.join("\n")}\n` };
  }
  return undefined;
}
