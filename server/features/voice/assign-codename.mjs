// Assigns the next release its dish code name and records it in release-names.json.
//   node server/features/voice/assign-codename.mjs 0.2.0
// It reads the public catalogue, skips every dish already used, requires the dish's
// picture to be published, and writes nothing if the catalogue is unreachable, so an
// unavailable catalogue never blocks a release (the release simply has no code name yet).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPhoto, loadCatalogue, tagsFor, SOURCE } from "./dimsum.mjs";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "release-names.json");

export async function assign(version, { file = FILE } = {}) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Give a version such as 0.2.0.");
  const record = JSON.parse(await readFile(file, "utf8"));
  if (record.releases[version]) return { version, ...record.releases[version], reused: true };
  const used = new Set(Object.values(record.releases).map((r) => r.id));
  const { dishes, revision } = await loadCatalogue();
  for (const dish of dishes.filter((d) => !used.has(d.id))) {
    const photo = await fetchPhoto(dish);
    if (!photo) continue;
    const tag = tagsFor(dish.id).find((t) => photo.sourceUrl.includes(`/${t}/`));
    record.releases[version] = { id: dish.id, en: dish.en, zhHant: dish.zhHant, photoTag: tag, photoFile: dish.file, revision, recorded: new Date().toISOString().slice(0, 10) };
    await writeFile(file, `${JSON.stringify(record, null, 2)}\n`);
    return { version, ...record.releases[version], reused: false, source: SOURCE.index };
  }
  throw new Error("No unused dish with a published picture was found.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assign(process.argv[2] ?? "")
    .then((r) => console.log(`${r.version}: ${r.en} ${r.zhHant} (${r.id})${r.reused ? " already recorded" : " recorded"}`))
    .catch((error) => {
      console.error(`No code name recorded: ${error.message}`);
      process.exitCode = 0; // a missing code name must never fail a release
    });
}
