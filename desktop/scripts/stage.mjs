// Builds desktop/payload: the exact files the packaged app contains (server, public pages,
// the desktop shell and production-only node_modules), so the packaged app never depends
// on this checkout. The version comes from package.json; BUILD_NUMBER (set by the release workflow)
// becomes the patch number so every build has a higher Squirrel version than the last.
//   node desktop/scripts/stage.mjs
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAYLOAD = path.join(ROOT, "desktop", "payload");

export function buildVersion(base, buildNumber) {
  const [major, minor, patch] = base.split(".");
  const n = Number(buildNumber);
  return Number.isInteger(n) && n > 0 ? `${major}.${minor}.${n}` : `${major}.${minor}.${patch}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootPackage = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const version = buildVersion(rootPackage.version, process.env.BUILD_NUMBER);

  rmSync(PAYLOAD, { recursive: true, force: true });
  mkdirSync(PAYLOAD, { recursive: true });
  for (const dir of ["server", "public"]) cpSync(path.join(ROOT, dir), path.join(PAYLOAD, dir), { recursive: true });
  const desktopFiles = ["main.mjs", "backend.mjs", "settings.mjs", "preload.cjs", "shell.html", "shell.css", "shell.js"];
  mkdirSync(path.join(PAYLOAD, "desktop", "assets"), { recursive: true });
  for (const file of desktopFiles) cpSync(path.join(ROOT, "desktop", file), path.join(PAYLOAD, "desktop", file));
  for (const file of ["icon.png", "icon.ico"]) cpSync(path.join(ROOT, "desktop", "assets", file), path.join(PAYLOAD, "desktop", "assets", file));
  cpSync(path.join(ROOT, "package-lock.json"), path.join(PAYLOAD, "package-lock.json"));

  const payloadPackage = {
    name: "material-asus-router",
    productName: "Material Asus Router",
    version,
    description: rootPackage.description,
    author: "Ding Ding Projects",
    license: rootPackage.license,
    type: "module",
    main: "desktop/main.mjs",
    dependencies: rootPackage.dependencies,
  };
  writeFileSync(path.join(PAYLOAD, "package.json"), JSON.stringify(payloadPackage, null, 2));

  const install = spawnSync("npm ci --omit=dev --ignore-scripts --no-audit --no-fund", { cwd: PAYLOAD, stdio: "inherit", shell: true });
  if (install.status !== 0) {
    console.error("Installing the production packages for the app failed.");
    process.exit(install.status ?? 1);
  }
  if (!existsSync(path.join(PAYLOAD, "node_modules", "ssh2"))) {
    console.error("The payload is missing ssh2.");
    process.exit(1);
  }
  console.log(`Staged ${payloadPackage.productName} ${version} in ${PAYLOAD}`);
}
