// routers: the screen saves, switches and removes routers through /api/routers, and the top-bar
// badge appears only while a Testing router is in use. The routes are proven in
// tests/router-access.test.mjs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { ROLE } from "../../public/js/features/routers/index.js";

test("routers: the module is well formed, with a screen, a badge and a palette entry", async () => {
  assert.equal(checkFeatureModule(feature, "routers"), null);
  assert.deepEqual(Object.keys(ROLE), ["main", "testing"]);
  assert.ok(ROLE.testing.en && ROLE.testing.yue);
  const src = await readFile(new URL("../../public/js/features/routers/index.js", import.meta.url), "utf8");
  assert.match(src, /api\.del\(`\/api\/routers\//, "removing uses the API helper's delete");
  assert.match(src, /info\?\.active\?\.role !== "testing"/, "the badge shows only for a Testing router");
  assert.match(src, /confirmDialog\(/, "removing a router asks first");
});
