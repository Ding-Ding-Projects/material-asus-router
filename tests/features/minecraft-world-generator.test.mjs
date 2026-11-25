// The world generator plans and writes; it does not run a server. These tests
// cover the settings by version, the bounded area and its batches, the folder
// it writes, and the ZIP it packs, in a temporary folder.
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { BATCH_SIDE, DEFAULT_SIZE, MAX_CHUNKS, MAX_SPAN, batches, chunkSet, makePlan, normalizeRects, outputName, packWorld, paths, prepareFolder, propertiesText, settingsFor, squareArea, validateWorld } from "../../server/features/minecraft-world-generator/plan.mjs";
import { readZip } from "../../public/js/features/base64-tools/zip.js";
import { VIEW, clampRect, coverage, defaultSquare, rectFromDrag, toChunk } from "../../public/js/features/minecraft-world-generator/area.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/minecraft-world-generator/index.js";
import { startApp } from "../helpers.mjs";

const original = paths.base;

test("the default area is 100 by 100 chunks centred on the middle, and the server and the map agree", () => {
  assert.equal(DEFAULT_SIZE, 100);
  assert.deepEqual(squareArea(), [{ x0: -50, z0: -50, x1: 49, z1: 49 }]);
  assert.deepEqual(defaultSquare(100), squareArea(100)[0], "the map draws exactly the area the plan holds");
  assert.equal(chunkSet(squareArea()).size, 10000);
  assert.deepEqual(squareArea(1), [{ x0: 0, z0: 0, x1: 0, z1: 0 }]);
  assert.throws(() => squareArea(0), /at least 1/);
  assert.throws(() => squareArea("x"), /whole number/);
});

test("areas are bounded before anything is counted", () => {
  assert.throws(() => chunkSet(squareArea(MAX_SPAN + 1)), /at most 512 chunks wide/);
  assert.throws(() => chunkSet(squareArea(300)), /90000 chunks/);
  assert.equal(chunkSet(squareArea(200)).size, MAX_CHUNKS, "200 by 200 is exactly the limit");
  assert.throws(() => chunkSet([{ x0: 0, z0: 0, x1: 100000, z1: 100000 }]), /wide/);
  assert.throws(() => normalizeRects([]), /at least one rectangle/);
  assert.throws(() => normalizeRects(Array.from({ length: 201 }, () => ({ x0: 0, x1: 0, z0: 0, z1: 0 }))), /at most 200/);
  assert.throws(() => normalizeRects([{ x0: "a", x1: 0, z0: 0, z1: 0 }]), /whole number/);
  assert.deepEqual(normalizeRects([{ x0: 5, x1: -5, z0: 2, z1: 1 }]), [{ x0: -5, x1: 5, z0: 1, z1: 2 }], "corners are put in order");
});

test("a drawn shape counts each chunk once, even where rectangles overlap", () => {
  const set = chunkSet([{ x0: 0, z0: 0, x1: 9, z1: 9 }, { x0: 5, z0: 5, x1: 14, z1: 14 }]);
  assert.equal(set.size, 100 + 100 - 25);
  assert.equal(coverage([{ x0: 0, z0: 0, x1: 9, z1: 9 }, { x0: 5, z0: 5, x1: 14, z1: 14 }]).chunks, 175, "the map counts the same way");
  assert.equal(coverage([{ x0: -128, z0: -128, x1: 127, z1: 127 }]).over, true);
});

test("batches are at most 16 by 16 chunks, cover every chunk exactly once, and start at the middle", () => {
  const set = chunkSet(squareArea());
  const list = batches(set);
  assert.equal(list.reduce((n, b) => n + b.chunks, 0), 10000);
  assert.ok(list.every((b) => b.chunks <= BATCH_SIDE * BATCH_SIDE));
  assert.equal(list.length, 64, "8 by 8 tiles for a 100 by 100 area centred on the origin");
  assert.deepEqual(list.map((b) => b.index), list.map((_, i) => i + 1));
  const first = list[0];
  assert.ok(Math.abs(first.from.x) <= 16 && Math.abs(first.from.z) <= 16, "the first batch is next to the middle");
  assert.match(first.load, /^forceload add -?\d+ -?\d+ -?\d+ -?\d+$/);
  assert.equal(first.load.replace("add", "remove"), first.release);
  // The commands use block coordinates: 16 blocks per chunk, and the far corner is the last block of the chunk.
  const one = batches(new Set(["2,3"]))[0];
  assert.equal(one.load, "forceload add 32 48 47 63");
  const sizes = list.map((b) => (b.to.x - b.from.x + 1) * (b.to.z - b.from.z + 1));
  assert.ok(sizes.every((n) => n <= 256), "no forceload command asks for more than 256 chunks");
});

test("settings depend on the version, and every value is validated by its control", () => {
  const modern = settingsFor("1.21");
  const old = settingsFor("1.12.2");
  assert.equal(modern.find((s) => s.key === "level-type").options[0][0], "minecraft:normal");
  assert.equal(old.find((s) => s.key === "level-type").options[0][0], "default");
  assert.ok(old.find((s) => s.key === "flat-preset").disabled, "flat presets need 1.16");
  assert.equal(modern.find((s) => s.key === "flat-preset").disabled, undefined);
  const free = modern.filter((s) => s.control === "text");
  assert.deepEqual(free.map((s) => s.key), ["level-seed"], "the seed is the only free text, and it says why");
  assert.ok(free[0].freeTextReason.length > 20);
  assert.equal(validateWorld({}, "1.21")["level-type"], "minecraft:normal", "defaults fill in");
  assert.throws(() => validateWorld({ "level-type": "minecraft:cubic" }, "1.21"), /one of/);
  assert.throws(() => validateWorld({ "generate-structures": "yes" }, "1.21"), /true or false/);
  assert.throws(() => validateWorld({ "max-world-size": "0" }, "1.21"), /from 1 to/);
  assert.throws(() => validateWorld({ "level-seed": "a\nb" }, "1.21"), /line break/);
  assert.throws(() => validateWorld({ "level-seed": "x".repeat(65) }, "1.21"), /at most 64/);
});

test("the properties text carries the seed, the type and, for a flat world, valid layers", () => {
  const text = propertiesText(validateWorld({ "level-seed": "banana", "level-type": "minecraft:flat", "flat-preset": "desert" }, "1.21"), "1.21");
  assert.match(text, /level-seed=banana/);
  assert.match(text, /level-type=minecraft:flat/);
  const line = text.split("\n").find((l) => l.startsWith("generator-settings="));
  const parsed = JSON.parse(line.slice("generator-settings=".length));
  assert.equal(parsed.biome, "minecraft:desert");
  assert.equal(parsed.layers[0].block, "minecraft:bedrock");
  assert.ok(!/generator-settings/.test(propertiesText(validateWorld({}, "1.21"), "1.21")), "a normal world has no flat layers");
  assert.ok(!/generator-settings/.test(propertiesText(validateWorld({ "level-type": "flat" }, "1.12.2"), "1.12.2")), "an old version gets no layer JSON it could not read");
});

test("a plan names every step, marks what is not built, and refuses to proceed without the EULA", () => {
  const plan = makePlan({ version: "1.21", area: { kind: "square", size: 100 }, output: { kind: "zip", name: "my world" } });
  assert.equal(plan.area.chunks, 10000);
  assert.equal(plan.output.kind, "zip");
  assert.equal(plan.eulaAccepted, false);
  assert.match(plan.blocker, /EULA has not been accepted/);
  const states = Object.fromEntries(plan.steps.map((s) => [s.id, s.state]));
  assert.deepEqual(states, { write: "ready", server: "not-built", load: "not-built", verify: "not-built", output: "ready" }, "what is not built says so");
  assert.equal(makePlan({ version: "1.21", eula: true }).blocker, null);
  assert.throws(() => makePlan({ version: "24w14a" }), /release version/);
  assert.throws(() => makePlan({ version: "1.21", output: { name: "../evil" } }), /Name the output/);
  assert.equal(outputName("World 1.0"), "World 1.0");
  assert.throws(() => outputName(""), /Name the output/);
});

test("the folder is written once, with the EULA only after it is accepted, and is never replaced", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-world-"));
  paths.base = dir;
  try {
    await assert.rejects(() => prepareFolder({ version: "1.21", output: { name: "w1" } }), (e) => e.status === 403);
    assert.deepEqual(await readdir(dir), [], "nothing is written before the EULA");
    const made = await prepareFolder({ version: "1.21", eula: true, settings: { "level-seed": "42" }, area: { kind: "square", size: 32 }, output: { name: "w1" } });
    assert.deepEqual(made.files, ["server.properties", "eula.txt", "pregenerate.txt"]);
    assert.equal(made.chunks, 1024);
    assert.equal((await readFile(path.join(dir, "w1", "eula.txt"), "utf8")).trim(), "eula=true");
    assert.match(await readFile(path.join(dir, "w1", "server.properties"), "utf8"), /level-seed=42/);
    assert.match(await readFile(path.join(dir, "w1", "pregenerate.txt"), "utf8"), /^forceload add /);
    await assert.rejects(() => prepareFolder({ version: "1.21", eula: true, output: { name: "w1" } }), (e) => e.status === 409 && /Nothing was changed/.test(e.message));
  } finally {
    paths.base = original;
    await rm(dir, { recursive: true, force: true });
  }
});

test("packing makes one ZIP of the folder, reads it back, and never replaces a ZIP", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-world-"));
  paths.base = dir;
  try {
    await mkdir(path.join(dir, "w", "region"), { recursive: true });
    await writeFile(path.join(dir, "w", "level.dat"), "level");
    await writeFile(path.join(dir, "w", "region", "r.0.0.mca"), Buffer.alloc(5000, 7));
    const packed = await packWorld("w");
    assert.equal(packed.files, 2);
    assert.match(packed.sha256, /^[0-9a-f]{64}$/);
    const entries = readZip(new Uint8Array(await readFile(packed.zip)));
    assert.deepEqual(entries.map((e) => e.name).sort(), ["level.dat", "region/r.0.0.mca"]);
    assert.equal(entries.find((e) => e.name === "region/r.0.0.mca").bytes.length, 5000);
    await assert.rejects(() => packWorld("w"), (e) => e.status === 409 && /not replaced/.test(e.message));
    await assert.rejects(() => packWorld("missing"), (e) => e.status === 404);
    await mkdir(path.join(dir, "empty"));
    await assert.rejects(() => packWorld("empty"), (e) => e.status === 422);
    await assert.rejects(() => packWorld("../x"), /Name the output/);
  } finally {
    paths.base = original;
    await rm(dir, { recursive: true, force: true });
  }
});

test("the map turns pointer positions into whole chunks and keeps a drawing inside the map", () => {
  assert.equal(VIEW, 256);
  assert.equal(toChunk(0, 560), -128);
  assert.equal(toChunk(280, 560), 0);
  assert.equal(toChunk(559, 560), 127);
  const r = rectFromDrag({ x: 300, y: 300 }, { x: 260, y: 280 }, 560);
  assert.ok(r.x0 <= r.x1 && r.z0 <= r.z1, "dragging up and to the left still gives a proper rectangle");
  assert.equal(r.x1 - r.x0 + 1, toChunk(300, 560) - toChunk(260, 560) + 1);
  assert.deepEqual(clampRect({ x0: -500, x1: 500, z0: -1, z1: 1 }), { x0: -128, x1: 127, z0: -1, z1: 1 });
});

test("the routes plan, and the actions write and pack, for people who may change things", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-world-"));
  paths.base = dir;
  const t = await startApp();
  try {
    assert.ok((await t.owner.get("/api/x/minecraft-world-generator/schema?version=1.21")).data.settings.length >= 5);
    const plan = await t.owner.post("/api/x/minecraft-world-generator/plan", { version: "1.21", area: { kind: "rects", rects: [{ x0: -10, x1: 10, z0: -10, z1: 10 }] }, output: { name: "r" } });
    assert.equal(plan.status, 200, plan.text);
    assert.equal(plan.data.area.chunks, 441);
    assert.equal((await t.owner.post("/api/x/minecraft-world-generator/plan", { version: "1.21", area: { kind: "square", size: 400 } })).status, 400);
    const prepared = await t.owner.post("/api/actions/minecraft-world-generator.prepare", { version: "1.21", eula: true, output: { name: "r" } });
    assert.equal(prepared.status, 200, prepared.text);
    const refused = await t.owner.post("/api/actions/minecraft-world-generator.prepare", { version: "1.21", output: { name: "r2" } });
    assert.equal(refused.status, 403);
    const packed = await t.owner.post("/api/actions/minecraft-world-generator.pack", { name: "r" });
    assert.equal(packed.status, 200, packed.text);
    assert.equal(packed.data.files, 3);
    assert.equal((await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" })).status, 201);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.post("/api/actions/minecraft-world-generator.prepare", { version: "1.21", eula: true, output: { name: "x" } })).status, 403);
    assert.equal((await t.client().get("/api/x/minecraft-world-generator/schema")).status, 401);
  } finally {
    paths.base = original;
    await t.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("the browser module is well formed, its stylesheet is loaded and served", async () => {
  assert.equal(checkFeatureModule(feature, "minecraft-world-generator"), null);
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/minecraft-world-generator/index.js"));
    assert.ok(manifest.styles.includes("/js/features/minecraft-world-generator/style.css"));
  } finally {
    await t.stop();
  }
});
