// Planning a Minecraft world generation: typed settings, a bounded area of
// chunks, the batches it is cut into, and the server commands that would load
// each batch. Nothing here runs a server. The same file also writes the
// folder of settings and packs a finished world into one ZIP.
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { L } from "../kit.mjs";
import { makeZip } from "./zip.mjs";

const bad = (message, status = 400) => Object.assign(new Error(message), { status });

export const paths = { base: process.env.MAR_WORLD_DIR || path.join(os.homedir(), "material-asus-router", "worlds") };

// ---- area ---------------------------------------------------------------------------

export const DEFAULT_SIZE = 100; // 100 x 100 chunks
export const MAX_CHUNKS = 40000; // the most chunks one plan may hold
export const MAX_SPAN = 512; // the widest the area may be, in chunks
export const BATCH_SIDE = 16; // 16 x 16 chunks = 256, the most one forceload command takes

const int = (v, name) => {
  const n = Number(v);
  if (!Number.isInteger(n) || Math.abs(n) > 1_000_000) throw bad(`${name} must be a whole number of chunks.`);
  return n;
};

// A square centred on the origin: size x size chunks, from -size/2 up to size/2 - 1.
export function squareArea(size = DEFAULT_SIZE) {
  const n = int(size, "The size");
  if (n < 1) throw bad("The area must be at least 1 chunk wide.");
  const lo = -Math.floor(n / 2) || 0;
  return [{ x0: lo, z0: lo, x1: lo + n - 1, z1: lo + n - 1 }];
}

export function normalizeRects(rects) {
  if (!Array.isArray(rects) || !rects.length) throw bad("Draw at least one rectangle on the map.");
  if (rects.length > 200) throw bad("An area is made of at most 200 rectangles.");
  return rects.map((r) => {
    const a = int(r.x0, "x0");
    const b = int(r.x1, "x1");
    const c = int(r.z0, "z0");
    const d = int(r.z1, "z1");
    return { x0: Math.min(a, b), x1: Math.max(a, b), z0: Math.min(c, d), z1: Math.max(c, d) };
  });
}

// Every chunk in the area, once, as "x,z" keys. Refuses a plan that is too big
// before counting it, so a huge rectangle never makes the server busy.
export function chunkSet(rects) {
  const list = normalizeRects(rects);
  const minX = Math.min(...list.map((r) => r.x0));
  const maxX = Math.max(...list.map((r) => r.x1));
  const minZ = Math.min(...list.map((r) => r.z0));
  const maxZ = Math.max(...list.map((r) => r.z1));
  if (maxX - minX + 1 > MAX_SPAN || maxZ - minZ + 1 > MAX_SPAN) throw bad(`The area can be at most ${MAX_SPAN} chunks wide in each direction (${MAX_SPAN * 16} blocks).`);
  if (list.reduce((sum, r) => sum + (r.x1 - r.x0 + 1) * (r.z1 - r.z0 + 1), 0) > MAX_CHUNKS * 4) throw bad("The rectangles overlap too much to count safely. Make them smaller.");
  const out = new Set();
  for (const r of list) for (let x = r.x0; x <= r.x1; x += 1) for (let z = r.z0; z <= r.z1; z += 1) out.add(`${x},${z}`);
  if (out.size > MAX_CHUNKS) throw bad(`That is ${out.size} chunks. A plan holds at most ${MAX_CHUNKS} (about ${Math.round(Math.sqrt(MAX_CHUNKS))} by ${Math.round(Math.sqrt(MAX_CHUNKS))}).`);
  return out;
}

// Cuts the area into 16 x 16 chunk batches, nearest to the middle first, each
// with the commands that load it and then let it go.
export function batches(set) {
  const tiles = new Map();
  for (const key of set) {
    const [x, z] = key.split(",").map(Number);
    const tx = Math.floor(x / BATCH_SIDE);
    const tz = Math.floor(z / BATCH_SIDE);
    const id = `${tx},${tz}`;
    const tile = tiles.get(id) ?? { tx, tz, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, count: 0 };
    tile.minX = Math.min(tile.minX, x);
    tile.maxX = Math.max(tile.maxX, x);
    tile.minZ = Math.min(tile.minZ, z);
    tile.maxZ = Math.max(tile.maxZ, z);
    tile.count += 1;
    tiles.set(id, tile);
  }
  return [...tiles.values()].sort((a, b) => Math.hypot(a.tx + 0.5, a.tz + 0.5) - Math.hypot(b.tx + 0.5, b.tz + 0.5) || a.tx - b.tx || a.tz - b.tz).map((t, i) => ({
    index: i + 1,
    chunks: t.count,
    from: { x: t.minX, z: t.minZ },
    to: { x: t.maxX, z: t.maxZ },
    // Block coordinates: a chunk is 16 blocks wide.
    load: `forceload add ${t.minX * 16} ${t.minZ * 16} ${t.maxX * 16 + 15} ${t.maxZ * 16 + 15}`,
    release: `forceload remove ${t.minX * 16} ${t.minZ * 16} ${t.maxX * 16 + 15} ${t.maxZ * 16 + 15}`,
  }));
}

// ---- version-bound settings --------------------------------------------------------------

const parse = (v) => { const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(v ?? "")); return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null; };
const atLeast = (v, min) => { const a = parse(v); const b = parse(min); if (!a || !b) return null; for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i]; return true; };

const FLAT = {
  classic: [{ block: "minecraft:bedrock", height: 1 }, { block: "minecraft:dirt", height: 2 }, { block: "minecraft:grass_block", height: 1 }],
  desert: [{ block: "minecraft:bedrock", height: 1 }, { block: "minecraft:stone", height: 3 }, { block: "minecraft:sandstone", height: 52 }, { block: "minecraft:sand", height: 8 }],
  void: [{ block: "minecraft:air", height: 1 }],
};
const FLAT_BIOME = { classic: "minecraft:plains", desert: "minecraft:desert", void: "minecraft:the_void" };

export function settingsFor(version) {
  const modern = atLeast(version, "1.16");
  const p = modern ? "minecraft:" : "";
  const types = [[`${p}${modern ? "normal" : "default"}`, L("Normal", "普通"), L("Hills, caves and oceans.", "山丘、洞穴同海洋。")], [`${p}flat`, L("Flat", "超平坦"), L("A flat world for building.", "用嚟起屋嘅平坦世界。")], [`${p}${modern ? "large_biomes" : "largeBiomes"}`, L("Large biomes", "大型生物群系"), L("Much larger biomes.", "群系大好多。")], [`${p}amplified`, L("Amplified", "放大化"), L("Extreme tall terrain.", "極高嘅地形。")]];
  const list = [
    { key: "level-seed", control: "text", freeText: true, freeTextReason: "A world seed is any text the person likes; Minecraft turns it into a number.", maxLength: 64, label: L("Seed", "種子"), help: L("The same seed always makes the same world. Leave empty for a random one.", "相同種子永遠生成相同嘅世界。留空就隨機。"), hint: L("Any text or number.", "任何文字或數字。"), default: "" },
    { key: "level-type", control: "select", label: L("World type", "世界類型"), help: L("The kind of terrain.", "地形類型。"), options: types, default: types[0][0] },
    { key: "generate-structures", control: "switch", label: L("Villages and other structures", "村莊同其他建築"), help: L("Turn off for a world without generated buildings.", "關閉就冇自動生成嘅建築。"), default: "true" },
    { key: "bonus-chest", control: "switch", label: L("Bonus chest at the spawn", "出生點額外箱子"), help: L("Adds a chest with starter items. It exists only in the first generation.", "加一個有起始物品嘅箱子。只喺首次生成存在。"), default: "false" },
    { key: "max-world-size", control: "slider", min: 1, max: 29999984, step: 1000, unit: " blocks", label: L("World border limit", "世界邊界上限"), help: L("The largest radius the border can have.", "邊界最大半徑。"), default: "29999984" },
    { key: "flat-preset", control: "select", label: L("Flat world layers", "超平坦層次"), help: L("Only used when the world type is Flat.", "只喺世界類型係超平坦時使用。"), options: [["classic", L("Classic", "經典"), L("Bedrock, dirt, grass.", "基岩、泥土、草地。")], ["desert", L("Desert", "沙漠"), L("Sandstone and sand.", "砂岩同沙。")], ["void", L("Void", "虛空"), L("Nothing at all.", "乜都冇。")]], default: "classic", disabled: modern === false ? L("Flat layer presets here need Minecraft 1.16 or newer.", "超平坦層次預設需要 Minecraft 1.16 或以上。") : undefined },
  ];
  return list;
}

export function validateWorld(settings, version) {
  const defs = settingsFor(version);
  const out = {};
  for (const def of defs) {
    const raw = String(settings?.[def.key] ?? def.default);
    if (/[\r\n\0]/.test(raw)) throw bad(`${def.label.en} cannot contain a line break.`);
    if (def.control === "switch" && raw !== "true" && raw !== "false") throw bad(`${def.label.en} must be true or false.`);
    if (def.control === "select" && !def.options.some(([v]) => v === raw)) throw bad(`${def.label.en} must be one of: ${def.options.map(([v]) => v).join(", ")}.`);
    if (def.control === "slider" && (!/^\d+$/.test(raw) || Number(raw) < def.min || Number(raw) > def.max)) throw bad(`${def.label.en} must be from ${def.min} to ${def.max}.`);
    if (def.control === "text" && raw.length > def.maxLength) throw bad(`${def.label.en} can be at most ${def.maxLength} characters.`);
    out[def.key] = raw;
  }
  return out;
}

// The lines of server.properties that shape the world.
export function propertiesText(world, version) {
  const lines = ["#Generated by Material Asus Router", `level-seed=${world["level-seed"]}`, `level-type=${world["level-type"]}`, `generate-structures=${world["generate-structures"]}`, `max-world-size=${world["max-world-size"]}`, "spawn-protection=0", "online-mode=true"];
  if (/flat$/.test(world["level-type"]) && atLeast(version, "1.16")) {
    const preset = world["flat-preset"];
    lines.push(`generator-settings=${JSON.stringify({ layers: FLAT[preset], biome: FLAT_BIOME[preset] })}`);
  }
  return `${lines.join("\n")}\n`;
}

// ---- the plan ----------------------------------------------------------------------------------

export function outputName(value) {
  const name = String(value ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,59}$/.test(name) || name.includes("..")) throw bad("Name the output with letters, digits, spaces, dots, dashes and underscores (up to 60 characters).");
  return name;
}

export function makePlan(input) {
  const version = String(input.version ?? "");
  if (!parse(version)) throw bad("Choose a release version such as 1.21. Snapshots cannot be planned here because their settings cannot be worked out from the number.");
  const world = validateWorld(input.settings ?? {}, version);
  const area = input.area?.kind === "rects" ? normalizeRects(input.area.rects) : squareArea(input.area?.size ?? DEFAULT_SIZE);
  const set = chunkSet(area);
  const list = batches(set);
  const output = { kind: input.output?.kind === "zip" ? "zip" : "folder", name: outputName(input.output?.name ?? "generated-world") };
  const ready = input.eula === true;
  return {
    version,
    world,
    area: { rects: area, chunks: set.size, blocks: set.size * 256 },
    batches: list,
    output,
    properties: propertiesText(world, version),
    eulaAccepted: ready,
    steps: [
      { id: "write", state: "ready", label: L("Write the settings and the EULA acceptance", "寫入設定同 EULA 同意") },
      { id: "server", state: "not-built", label: L("Run the exact server version", "運行確切版本嘅伺服器"), why: "Downloading and running the server for this version is not built yet. The settings and commands below are exact; run them with a server of this version." },
      { id: "load", state: "not-built", label: L(`Load ${list.length} batch(es) of up to ${BATCH_SIDE * BATCH_SIDE} chunks`, `載入 ${list.length} 批，每批最多 ${BATCH_SIDE * BATCH_SIDE} 個區塊`) },
      { id: "verify", state: "not-built", label: L("Reopen the world with the same version to verify it", "用同一版本重開世界驗證") },
      { id: "output", state: "ready", label: output.kind === "zip" ? L("Pack the finished world into one ZIP", "將完成嘅世界打包成一個 ZIP") : L("Keep the finished world as a folder", "將完成嘅世界保留為資料夾") },
    ],
    blocker: ready ? null : "The Minecraft EULA has not been accepted in the app, so nothing will be written or run.",
  };
}

// ---- writing the folder and packing a world ------------------------------------------------------

async function exists(p) {
  return Boolean(await fs.stat(p).catch(() => null));
}

// Writes the settings folder. It never replaces a folder that already exists,
// and writes the EULA file only because the app's EULA acceptance said so.
export async function prepareFolder(input) {
  const plan = makePlan(input);
  if (!plan.eulaAccepted) throw bad(plan.blocker, 403);
  const dir = path.join(paths.base, plan.output.name);
  if (await exists(dir)) throw bad(`${plan.output.name} already exists. Nothing was changed; choose another name.`, 409);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "server.properties"), plan.properties);
  await fs.writeFile(path.join(dir, "eula.txt"), "eula=true\n");
  await fs.writeFile(path.join(dir, "pregenerate.txt"), `${plan.batches.flatMap((b) => [b.load, "# wait until the chunks are loaded, then:", b.release]).join("\n")}\n`);
  return { folder: dir, files: ["server.properties", "eula.txt", "pregenerate.txt"], batches: plan.batches.length, chunks: plan.area.chunks };
}

const MAX_PACK = 512 * 1024 * 1024;
async function walk(dir, root, out) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) await walk(full, root, out);
    else if (entry.isFile()) out.push({ full, name: path.relative(root, full).split(path.sep).join("/") });
  }
}

// Packs a world folder under the worlds folder into <name>.zip. The ZIP is
// read back and every file's checksum compared before it counts as written.
export async function packWorld(name) {
  const clean = outputName(name);
  const dir = path.join(paths.base, clean);
  if (!(await exists(dir))) throw bad(`There is no folder called ${clean} to pack.`, 404);
  const target = `${dir}.zip`;
  if (await exists(target)) throw bad(`${clean}.zip already exists. It was not replaced.`, 409);
  const files = [];
  await walk(dir, dir, files);
  if (!files.length) throw bad("The folder is empty, so there is nothing to pack.", 422);
  let total = 0;
  const entries = [];
  for (const f of files) {
    const bytes = await fs.readFile(f.full);
    total += bytes.length;
    if (total > MAX_PACK) throw bad("The world is larger than 512 MB, which is more than this tool packs in one go. Keep it as a folder.", 413);
    entries.push({ name: f.name, bytes: new Uint8Array(bytes) });
  }
  const zip = makeZip(entries);
  await fs.writeFile(target, zip, { flag: "wx" });
  const back = await fs.readFile(target);
  const hash = createHash("sha256").update(back).digest("hex");
  if (hash !== createHash("sha256").update(zip).digest("hex")) throw bad("The ZIP could not be read back correctly, so it was removed.", 500);
  return { zip: target, files: entries.length, bytes: zip.length, sha256: hash };
}
