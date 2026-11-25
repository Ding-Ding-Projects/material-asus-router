// Builds the router add-on release files:
//   dist/addon/material-asus-router-addon.tar.gz   install.sh, uninstall.sh, mar.sh, webui/, app/
//   dist/addon/SHA256SUMS.txt (the release adds the archive to its own SHA256SUMS.txt too)
// app/ holds the server, the browser files and the production packages, so the router needs
// only Entware's Node.js. Run: node scripts/build-addon.mjs
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "dist", "addon");
const STAGE = path.join(OUT, "stage");
const NAME = "material-asus-router-addon.tar.gz";

await rm(OUT, { recursive: true, force: true });
await mkdir(path.join(STAGE, "app"), { recursive: true });

for (const file of ["install.sh", "uninstall.sh", "mar.sh"]) {
  // The router runs these with /bin/sh, so line endings must be LF whatever the checkout uses.
  const text = (await readFile(path.join(ROOT, "addon", file), "utf8")).replace(/\r\n/g, "\n");
  await writeFile(path.join(STAGE, file), text, { mode: 0o755 });
}
await mkdir(path.join(STAGE, "webui"));
await writeFile(path.join(STAGE, "webui", "mar.asp"), (await readFile(path.join(ROOT, "addon", "webui", "mar.asp"), "utf8")).replace(/\r\n/g, "\n"));

for (const part of ["server", "public", "package.json", "package-lock.json", "LICENSE"]) await cp(path.join(ROOT, part), path.join(STAGE, "app", part), { recursive: true });
// Production packages only, without install scripts (none of them need one to run).
execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: path.join(STAGE, "app"), stdio: "inherit", shell: process.platform === "win32" });

// Relative paths: GNU tar would read "C:" in an absolute Windows path as a remote host.
execFileSync("tar", ["-czf", NAME, "-C", "stage", "."], { cwd: OUT, stdio: "inherit" });
const sum = createHash("sha256").update(await readFile(path.join(OUT, NAME))).digest("hex");
await writeFile(path.join(OUT, "SHA256SUMS.txt"), `${sum}  ${NAME}\n`);
await rm(STAGE, { recursive: true, force: true });
console.log(`${NAME} ${sum}`);
