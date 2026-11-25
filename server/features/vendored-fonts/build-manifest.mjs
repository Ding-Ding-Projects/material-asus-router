// Writes manifest.json: the SHA-256 and size of every font file this app
// serves, plus the axes the font really has. Run it after changing a font
// package:  node server/features/vendored-fonts/build-manifest.mjs
// It stops loudly if a listed file is missing, so a partial set can never be
// recorded. It imports only node: modules.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MODULES = path.join(HERE, "..", "..", "..", "node_modules");

// What the app serves (see FONT_DIRS in server/app.mjs) and the family name its stylesheet uses.
export const SERVED = [
  { family: "Roboto Flex", package: "@fontsource-variable/roboto-flex", file: "roboto-flex-latin-full-normal.woff2", route: "/fonts/roboto-flex/roboto-flex-latin-full-normal.woff2", weights: "100 1000", variableAxes: ["opsz", "slnt", "wdth", "wght", "GRAD", "XOPQ", "XTRA", "YOPQ", "YTAS", "YTDE", "YTFI", "YTLC", "YTUC"] },
  { family: "Material Symbols Rounded", package: "@fontsource/material-symbols-rounded", file: "material-symbols-rounded-latin-400-normal.woff2", route: "/fonts/material-symbols/material-symbols-rounded-latin-400-normal.woff2", weights: "400", variableAxes: [] },
];

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function describeFont(entry, modules = MODULES) {
  const dir = path.join(modules, ...entry.package.split("/"));
  const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
  const bytes = await readFile(path.join(dir, "files", entry.file));
  return { family: entry.family, package: entry.package, version: pkg.version, license: pkg.license, file: entry.file, route: entry.route, weights: entry.weights, axes: entry.variableAxes, subset: "latin", sha256: sha256(bytes), bytes: bytes.length };
}

export async function buildManifest(modules = MODULES) {
  const fonts = [];
  for (const entry of SERVED) fonts.push(await describeFont(entry, modules));
  return { version: 1, note: "Both fonts are served by this app from pinned npm packages. Only the Latin subset is included, so Chinese text uses a font already on the device.", fonts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await buildManifest();
  await writeFile(path.join(HERE, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote manifest.json with ${manifest.fonts.length} fonts.`);
}
