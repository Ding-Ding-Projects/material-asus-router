// The running version and when this exact build was made. The values come from
// the build itself (the image build passes APP_VERSION, SOURCE_REVISION and
// BUILD_DATE into the container), never from the launch time, a file
// timestamp or anything typed by hand. When the build did not record them the
// answer says "unavailable" instead of guessing.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID = "front-provenance";

export const isIsoInstant = (text) => typeof text === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(text) && !Number.isNaN(Date.parse(text));
const isSha = (text) => typeof text === "string" && /^[0-9a-f]{7,40}$/i.test(text);

export async function readProvenance(env = process.env) {
  let version = String(env.APP_VERSION ?? "").trim();
  let versionSource = version ? "build argument APP_VERSION" : null;
  if (!version) {
    try {
      const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "package.json");
      version = JSON.parse(await readFile(file, "utf8")).version ?? "";
      versionSource = version ? "package.json shipped with the build" : null;
    } catch {
      version = "";
    }
  }
  const built = String(env.BUILD_DATE ?? "").trim();
  const builtOk = isIsoInstant(built);
  const commit = String(env.SOURCE_REVISION ?? "").trim();
  return {
    version: version || null,
    versionSource,
    updatedAt: builtOk ? new Date(built).toISOString() : null,
    updatedAtSource: builtOk ? "build argument BUILD_DATE, recorded when the image was built" : null,
    updatedAtUnavailable: builtOk ? null : built ? "The recorded build time is not a valid date, so it is not shown." : "This build did not record when it was made.",
    commit: isSha(commit) ? commit.toLowerCase() : null,
    beforeSignIn: "In progress: before sign-in the version and build time are not shown yet, because the sign-in screens are drawn by the app's core files, which a feature cannot change. They are shown on the rail after sign-in.",
  };
}

export default {
  id: ID,
  domainMeta: [],
  routes(api) {
    api.get("/info", async () => readProvenance());
  },
};
