// Builds the genuine Squirrel.Windows installer from the unpacked app:
// Setup.exe, RELEASES and the full .nupkg, in desktop/dist/squirrel. Unsigned.
//   node desktop/scripts/squirrel.mjs
import { createRequire } from "node:module";
import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(DESKTOP, "package.json"));
const { createWindowsInstaller } = require("electron-winstaller");

const appDirectory = path.join(DESKTOP, "dist", "builder", "win-unpacked");
const outputDirectory = path.join(DESKTOP, "dist", "squirrel");
if (!existsSync(path.join(appDirectory, "Material Asus Router.exe"))) {
  console.error(`The unpacked app is missing at ${appDirectory}. Run the app build first.`);
  process.exit(1);
}
// The Squirrel package description lists a LICENSE file next to the app.
if (!existsSync(path.join(appDirectory, "LICENSE"))) copyFileSync(path.join(DESKTOP, "..", "LICENSE"), path.join(appDirectory, "LICENSE"));
const version = JSON.parse(readFileSync(path.join(DESKTOP, "payload", "package.json"), "utf8")).version;
rmSync(outputDirectory, { recursive: true, force: true });

await createWindowsInstaller({
  appDirectory,
  outputDirectory,
  name: "MaterialAsusRouter",
  title: "Material Asus Router",
  authors: "Ding Ding Projects",
  description: "Manage an Asus router over SSH with readable controls, previews and undo.",
  version,
  exe: "Material Asus Router.exe",
  setupExe: "Material-Asus-Router-Setup.exe",
  setupIcon: path.join(DESKTOP, "assets", "icon.ico"),
  iconUrl: "https://raw.githubusercontent.com/Ding-Ding-Projects/material-asus-router/main/public/favicon.svg",
  noMsi: true,
});
console.log(`Squirrel installer for version ${version} written to ${outputDirectory}`);
