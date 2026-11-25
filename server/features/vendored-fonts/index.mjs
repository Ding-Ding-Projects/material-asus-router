// Vendored fonts: the committed manifest records the SHA-256 of each font file
// this app serves; GET /api/x/vendored-fonts/verify reads the files again and
// says whether they still match. Read only, nothing is written.
import { readFile } from "node:fs/promises";
import { describeFont, SERVED } from "./build-manifest.mjs";

export async function verify() {
  const manifest = JSON.parse(await readFile(new URL("./manifest.json", import.meta.url), "utf8"));
  const fonts = [];
  for (const expected of manifest.fonts) {
    const entry = SERVED.find((s) => s.file === expected.file);
    let actual = null;
    try { actual = entry ? await describeFont(entry) : null; } catch { actual = null; }
    fonts.push({ ...expected, actualSha256: actual?.sha256 ?? null, actualBytes: actual?.bytes ?? null, present: actual !== null, match: actual !== null && actual.sha256 === expected.sha256 && actual.bytes === expected.bytes });
  }
  const complete = SERVED.every((s) => manifest.fonts.some((f) => f.file === s.file));
  return { ok: complete && fonts.every((f) => f.match), complete, note: manifest.note, fonts };
}

export default {
  id: "vendored-fonts",
  routes(api) {
    api.get("/verify", async () => verify());
  },
};
