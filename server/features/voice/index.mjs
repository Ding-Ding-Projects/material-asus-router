// The voice and comfort feature: language modes, funny levels, personal wording,
// sounds, narration, schedules, renaming, ADHD modes, School mode and the dim
// sum surprise. Almost all of it lives in the browser (public/js/features/voice);
// this half answers what a page cannot do for itself:
//   - read a schedule source (a validated HTTPS API, or a Home Assistant entity)
//   - fetch dim sum pictures from the public catalogue (the page may only load
//     pictures from this site)
//   - report the shipped identity, which a rename never changes
// There are no router settings here, so there are no catalogue entries.
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { L } from "../kit.mjs";
import { ExternalError, fetchApiState, fetchHomeAssistant } from "./external.mjs";
import { dishById, pickDish } from "./dimsum.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE = path.join(DIR, "..", "..", "..", "package.json");
// The shipped identity. A display-name change in the browser never touches these.
export const IDENTITY = Object.freeze({ product: "Material Asus Router", packageName: "material-asus-router", dataFolder: "data" });

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
export const version = async () => (await readJson(PACKAGE)).version;
export const releaseNames = async () => readJson(path.join(DIR, "release-names.json"));

function wrap(bad, fn) {
  return async (input) => {
    try {
      return await fn(input);
    } catch (error) {
      if (error instanceof ExternalError) throw bad(error.message, error.status, { code: error.code });
      throw bad("The picture or schedule source is unavailable right now.", 502, { code: "UNAVAILABLE" });
    }
  };
}

export default {
  id: "voice",

  routes(api) {
    // Who this app really is, whatever the page is currently called.
    api.get("/identity", async () => ({ ...IDENTITY, version: await version() }));
    api.get("/diagnostics", async () => ({ ...IDENTITY, version: await version(), node: process.version, platform: `${os.platform()} ${os.arch()}`, generatedAt: new Date().toISOString(), note: "Diagnostics always carry the shipped product name. A display name chosen in the browser is cosmetic." }));

    // Schedule sources. Tokens are used for this one request and never kept.
    api.post("/external/api", async ({ body, bad }) => wrap(bad, async () => fetchApiState({ url: body.url, token: body.token }))());
    api.post("/external/home-assistant", async ({ body, bad }) => wrap(bad, async () => fetchHomeAssistant({ url: body.url, entity: body.entity, token: body.token }))());

    // Dim sum: a random dish with its picture, and the recorded release code names.
    api.get("/dimsum/dish", async ({ query, bad }) => {
      const exclude = String(query.exclude ?? "").split(",").filter((id) => /^hk-dish-\d+$/.test(id)).slice(0, 50);
      return wrap(bad, () => pickDish({ exclude }))();
    });
    api.get("/dimsum/codename", async ({ query, bad }) => {
      const record = await releaseNames();
      const current = await version();
      const entry = record.releases[current] ?? null;
      const out = { version: current, source: record.source, rule: record.rule, all: Object.entries(record.releases).map(([v, r]) => ({ version: v, id: r.id, en: r.en, zhHant: r.zhHant, revision: r.revision })), current: entry ? { id: entry.id, en: entry.en, zhHant: entry.zhHant, revision: entry.revision } : null, photo: null, omitted: [] };
      if (entry && query.photo === "1") {
        try {
          const found = await dishById(entry.id, { withPhoto: true });
          if (found) Object.assign(out, { photo: found.photo, omitted: found.omitted });
        } catch {
          out.omitted = [{ id: entry.id, reason: "the catalogue is unreachable" }];
        }
      }
      return out;
    });
  },

  // What the feature is called wherever a list of features is shown.
  title: L("Voice and comfort", "聲音同舒適"),
};
