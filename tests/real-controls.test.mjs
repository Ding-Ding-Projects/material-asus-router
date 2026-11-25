// The control check. Every catalogue entry, stock and from every feature folder,
// must be a real control: it reads the router's actual value, only typed
// controls are used, and every writable entry can be previewed, applied, read
// back and undone through the change engine. It also checks that the feature
// folders are well formed and each has its own test.
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { featureErrors, features } from "../server/features/registry.mjs";
import { validate } from "../server/router/catalog.mjs";
import { controlFor, invalidValue, knownControlTypes, sampleValue } from "../server/router/controls.mjs";
import { startApp, waitFor } from "./helpers.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const folders = async (...parts) => (await readdir(path.join(ROOT, ...parts), { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory()).map((e) => e.name).sort();

test("every feature folder loads without errors", async () => {
  assert.deepEqual(featureErrors, []);
  const withIndex = [];
  for (const name of await folders("server", "features")) if ((await stat(path.join(ROOT, "server", "features", name, "index.mjs")).catch(() => null))?.isFile()) withIndex.push(name);
  assert.deepEqual(features.map((f) => f.id), withIndex, "every server/features/<id>/index.mjs is registered");
});

test("no feature folder is missing its test", async () => {
  const names = new Set([...(await folders("server", "features")), ...(await folders("public", "js", "features"))]);
  for (const name of names) assert.ok((await stat(path.join(ROOT, "tests", "features", `${name}.test.mjs`)).catch(() => null))?.isFile(), `tests/features/${name}.test.mjs is missing`);
});

test("a feature's server code imports only the kit, so the registry never has an import cycle", async () => {
  const allowed = /^(node:[a-z/]+|\.\/[A-Za-z0-9._/-]+|\.\.\/kit\.mjs)$/;
  async function files(dir) {
    const out = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...(await files(full)));
      else if (entry.name.endsWith(".mjs")) out.push(full);
    }
    return out;
  }
  for (const name of await folders("server", "features")) {
    for (const file of await files(path.join(ROOT, "server", "features", name))) {
      const source = (await readFile(file, "utf8")).replace(/^\s*\/\/.*$/gm, "");
      for (const m of source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g))
        assert.match(m[1], allowed, `${path.relative(ROOT, file)} imports ${m[1]}; import only ../kit.mjs, node: modules and files inside its own folder`);
    }
  }
});

test("every control type the catalogue can use has a check, a valid example and a refused example", () => {
  for (const type of knownControlTypes()) {
    const control = controlFor(type);
    assert.equal(typeof control.sample, "function", `${type} has no sample`);
    assert.equal(typeof control.invalid, "function", `${type} has no invalid example`);
  }
});

const sleepFinal = async (t, record) => {
  if (record.status !== "guarded" && record.status !== "applying") return record;
  return waitFor(async () => {
    const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
    return next.status !== "guarded" && next.status !== "applying" ? next : null;
  });
};

async function applyChange(t, body, label) {
  const preview = await t.owner.post("/api/changes/preview", body);
  assert.equal(preview.status, 200, `${label}: preview failed: ${preview.text}`);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, `${label}: apply failed: ${applied.text}`);
  const record = await sleepFinal(t, applied.data);
  assert.equal(record.status, "applied", `${label}: the change ended as ${record.status}`);
  return { preview: preview.data, record };
}

// Every router the pretend router can be: the two generic ones and a faithful model of one real router.
const ROUTERS = [
  ["merlin", { firmware: "merlin" }],
  ["stock", { firmware: "stock" }],
  ["rt-be88u-merlin-3006", { profile: "rt-be88u-merlin-3006" }],
];
for (const [firmware, startOptions] of ROUTERS) {
  test(`every catalogue entry on a ${firmware} router is a real control that reads, writes and undoes`, async () => {
    const t = await startApp(startOptions);
    try {
      const definitions = await t.app.session.catalog({ fresh: true });
      const shown = new Map((await t.owner.get("/api/catalog")).data.entries.map((e) => [e.id, e]));
      assert.ok(definitions.length > 30, "the catalogue is not empty");
      assert.ok(definitions.some((e) => e.feature), "at least one feature adds entries");
      assert.equal(new Set(definitions.map((e) => e.id)).size, definitions.length, "entry ids are unique");
      assert.equal(new Set(definitions.map((e) => e.key)).size, definitions.length, "entry keys are unique");

      let written = 0;
      for (const entry of definitions) {
        const label = entry.id;
        assert.ok(controlFor(entry.control), `${label}: unknown control type "${entry.control}"`);
        if (entry.control === "text") assert.ok(entry.freeText === true && String(entry.freeTextReason ?? "").length > 10, `${label}: a plain text box needs freeText: true and a freeTextReason`);
        if (entry.control === "text") assert.ok(entry.maxLength > 0, `${label}: free text needs a maxLength`);
        assert.ok(entry.help?.en && entry.help?.yue && entry.label?.en && entry.label?.yue, `${label}: needs English and Cantonese label and help`);
        const view = shown.get(entry.id);
        assert.ok(view, `${label}: missing from /api/catalog`);

        if (entry.disabled) {
          // A setting the router does not have is switched off with a reason, never written.
          if (!(entry.key in t.router.nvram)) assert.ok(entry.disabled.en.includes(`This router does not have the setting ${entry.key}`) || entry.disabled.en.includes("Merlin") || entry.disabled.en.includes("model does not support"), `${label}: absent setting ${entry.key} needs the missing-setting reason`);
          const refused = await t.owner.post("/api/changes/preview", { changes: [{ id: entry.id, value: sampleValue(entry, "") }] });
          assert.equal(refused.status, 400, `${label}: a disabled entry must refuse changes`);
          continue;
        }

        // 1. It reads the router's real value.
        const original = t.router.nvram[entry.key];
        assert.notEqual(original, undefined, `${label}: setting ${entry.key} does not exist on the router`);
        if (view.secret) {
          assert.equal(view.value, "", `${label}: a secret must not be sent to the browser`);
          assert.equal(view.masked, original !== "", `${label}: the masked flag must match the router`);
        } else assert.equal(view.value, original, `${label}: shows ${JSON.stringify(view.value)} but the router has ${JSON.stringify(original)}`);

        if (entry.readOnly) {
          const refused = await t.owner.post("/api/changes/preview", { changes: [{ id: entry.id, value: sampleValue(entry, original) }] });
          assert.equal(refused.status, 400, `${label}: a read-only entry must refuse changes`);
          continue;
        }

        // 2. A wrong value is refused.
        const wrong = invalidValue(entry);
        if (wrong !== null) assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: entry.id, value: wrong }] })).status, 400, `${label}: ${JSON.stringify(wrong)} should be refused`);

        // 3. A valid new value previews, applies and reads back.
        const next = sampleValue(entry, original);
        assert.notEqual(next, original, `${label}: the example value equals the current value`);
        const expected = validate(entry, next);
        const movesRouter = entry.key === "lan_ipaddr";
        if (movesRouter) t.router.startLanIp = expected; // the pretend router keeps answering at its new address
        const { preview, record } = await applyChange(t, { changes: [{ id: entry.id, value: next }] }, label);
        const item = preview.items.find((i) => i.key === entry.key);
        assert.ok(item, `${label}: the preview does not list ${entry.key}`);
        assert.equal(item.secret, Boolean(view.secret), `${label}: the preview treats the secret flag differently`);
        if (!view.secret) assert.deepEqual([item.old, item.new], [original, expected], `${label}: preview old/new`);
        assert.equal(t.router.nvram[entry.key], expected, `${label}: the router has ${JSON.stringify(t.router.nvram[entry.key])} after the change`);
        assert.equal(t.router.committed[entry.key], expected, `${label}: the change was not committed`);
        const reread = (await t.owner.get("/api/catalog")).data.entries.find((e) => e.id === entry.id);
        if (!view.secret) assert.equal(reread.value, expected, `${label}: the browser does not read back the new value`);

        // 4. Undo puts the original back.
        assert.equal(record.canUndo, true, `${label}: cannot be undone`);
        if (movesRouter) t.router.startLanIp = original;
        const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
        assert.equal(undo.status, 200, `${label}: undo preview failed: ${undo.text}`);
        const undone = await t.owner.post("/api/changes/apply", { previewId: undo.data.id });
        assert.equal(undone.status, 200, `${label}: undo apply failed: ${undone.text}`);
        assert.equal((await sleepFinal(t, undone.data)).status, "applied", `${label}: undo did not finish`);
        assert.equal(t.router.nvram[entry.key], original, `${label}: undo left ${JSON.stringify(t.router.nvram[entry.key])} instead of ${JSON.stringify(original)}`);
        written += 1;
      }
      for (const entry of definitions) if (!entry.disabled) assert.ok(entry.key in t.router.nvram, `${entry.id}: an available control needs setting ${entry.key} on the router`);
      for (const entry of definitions) if (!entry.disabled) assert.ok(entry.key in t.router.nvram, `${entry.id}: an available control needs setting ${entry.key} on the router`);
      assert.ok(written >= 40, `only ${written} entries were written and undone; the loop is not covering the catalogue`);
    } finally {
      await t.stop();
    }
  });
}
