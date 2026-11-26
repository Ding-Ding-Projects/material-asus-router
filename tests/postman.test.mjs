// The Postman collection is generated from the source and must list every route the running
// app has registered, and be current (node scripts/build-postman.mjs --check).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { buildCollection } from "../scripts/build-postman.mjs";
import { startApp } from "./helpers.mjs";

test("every route the app registers is in the Postman collection, and the file is current", async () => {
  const collection = await buildCollection();
  const listed = collection.item.flatMap((g) => g.item.map((i) => ({ method: i.request.method, path: `/${i.request.url.path.join("/")}`.replace(/\{\{[a-z]+\}\}/gi, "sample") })));
  const t = await startApp();
  try {
    const missing = t.app.routes.filter((r) => !listed.some((l) => l.method === r.method && r.re.test(l.path))).map((r) => `${r.method} ${r.re.source}`);
    assert.deepEqual(missing, [], "routes missing from the collection");
  } finally {
    await t.stop();
  }
  assert.ok(collection.item.some((g) => g.name === "Router connection"));
  assert.doesNotMatch(JSON.stringify(collection), /BEGIN [A-Z ]*PRIVATE KEY/, "no key material in the collection");
  execFileSync(process.execPath, ["scripts/build-postman.mjs", "--check"], { stdio: "pipe" });
});
