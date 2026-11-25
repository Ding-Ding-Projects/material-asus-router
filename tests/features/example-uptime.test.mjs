// The test for the example-uptime feature. It also shows what a feature test
// should cover: its settings, its domain, its routes and role checks, its
// action, and that its frontend module is well formed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/example-uptime/index.js";
import { startApp } from "../helpers.mjs";

test("example-uptime: the settings, domain card, routes, action and fake router handler all work", async () => {
  const t = await startApp();
  try {
    const catalog = (await t.owner.get("/api/catalog")).data;
    assert.ok(catalog.domains.some((d) => d.id === "example-uptime" && d.supported));
    assert.deepEqual(catalog.entries.filter((e) => e.feature === "example-uptime").map((e) => [e.id, e.control, e.value]), [
      ["example-uptime.show", "switch", "1"],
      ["example-uptime.warn", "stepper", "30"],
      ["example-uptime.color", "color", "#3366cc"],
    ]);

    const domain = (await t.owner.get("/api/domain/example-uptime")).data;
    assert.equal(domain.id, "example-uptime");
    assert.ok(domain.days >= 3, "the pretend router has been up for days");
    assert.equal(domain.warnDays, 30);
    assert.equal(domain.entries.length, 3);

    const summary = (await t.owner.get("/api/x/example-uptime/summary")).data;
    assert.equal(summary.model, "RT-AX86U");

    const mark = await t.owner.post("/api/actions/example-uptime.mark");
    assert.equal(mark.status, 200, mark.text);
    assert.deepEqual([mark.data.ok, mark.data.message], [true, "marked"]);
    assert.ok(t.router.commands.includes("example-uptime-mark"));

    // A change goes through the change engine like any other.
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "example-uptime.warn", value: "60" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.equal(t.router.nvram.example_uptime_warn_days, "60");
    assert.equal((await t.owner.get("/api/domain/example-uptime")).data.warnDays, 60);
  } finally {
    await t.stop();
  }
});

test("example-uptime: routes need a session and a CSRF token and refuse viewers", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/x/example-uptime/summary")).status, 401);
    assert.equal((await t.client().get("/api/features/manifest")).status, 401);
    assert.equal((await t.owner.post("/api/x/example-uptime/note", { text: "hi" }, { csrf: "wrong" })).status, 403);
    assert.equal((await t.owner.post("/api/x/example-uptime/note", { text: "" })).status, 400);
    assert.equal((await t.owner.post("/api/x/example-uptime/note", { text: "hi" })).data.text, "hi");

    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201, viewer.text);
    const guest = t.client();
    assert.equal((await guest.signIn("vi", "viewer password 1")).status, 200);
    assert.equal((await guest.get("/api/x/example-uptime/summary")).status, 200, "viewers may read");
    assert.equal((await guest.post("/api/x/example-uptime/note", { text: "hi" })).status, 403, "viewers may not write");
    assert.equal((await guest.post("/api/actions/example-uptime.mark")).status, 403);
  } finally {
    await t.stop();
  }
});

test("example-uptime: the manifest lists its frontend module and the module is well formed", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/example-uptime/index.js"));
    assert.ok(manifest.server.includes("example-uptime"));
    assert.deepEqual([...manifest.modules].sort(), manifest.modules, "the manifest is sorted");
    assert.equal((await fetch(t.base + "/js/features/example-uptime/index.js")).status, 200);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "example-uptime"), null);
  assert.match(checkFeatureModule({ ...feature, id: "other" }, "example-uptime"), /must equal the folder name/);
  assert.match(checkFeatureModule({ id: "x", screens: [{ id: "x", icon: "a", label: { en: "x", yue: "x" } }] }, "x"), /needs a render function/);
});
