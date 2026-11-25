// First account becomes the owner. The sign-up route itself (POST /api/setup in
// server/app.mjs) makes the first registration the owner inside one atomic
// store transaction and refuses every later attempt with a pointer to sign-in;
// no setup code exists. This feature reports that state and removes any old
// setup-code file left in the data folder by an earlier version.
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const ID = "first-account-owner";
// Names an earlier release could have used for a one-time setup code.
const OLD = /^(setup[-_. ]?(code|token|secret)|first[-_. ]?run[-_. ]?(code|token)|owner[-_. ]?(code|token))(\.[a-z0-9]+)?$/i;

export async function removeSetupCodeFiles(dir) {
  const removed = [];
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (entry.isFile() && OLD.test(entry.name)) {
      await rm(path.join(dir, entry.name), { force: true });
      removed.push(entry.name);
    }
  }
  return removed;
}

export default {
  id: ID,
  domainMeta: [],

  routes(api) {
    api.get("/status", async ({ app }) => {
      const removed = await removeSetupCodeFiles(app.store.dir);
      const state = app.store.read();
      return { hasOwner: Boolean(state.owner), ownerUsername: state.owner?.username ?? null, setupCodeRequired: false, removedSetupCodeFiles: removed, rule: "The first account to register becomes the owner. Later attempts are refused and pointed at sign-in." };
    });
  },
};
