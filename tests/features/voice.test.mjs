// The server half of the voice feature, and the shape of its browser module:
// the identity routes, the two schedule sources, the dim sum picture source, the
// release code names, and the checks that every text key exists in both languages.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import feature from "../../public/js/features/voice/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { assign } from "../../server/features/voice/assign-codename.mjs";
import * as dimsum from "../../server/features/voice/dimsum.mjs";
import * as external from "../../server/features/voice/external.mjs";
import { startApp } from "../helpers.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const json = (body, init = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
const restore = () => {
  const saved = { efetch: external.hooks.fetch, elookup: external.hooks.lookup, dfetch: dimsum.hooks.fetch, drandom: dimsum.hooks.random, dnow: dimsum.hooks.now };
  return () => {
    Object.assign(external.hooks, { fetch: saved.efetch, lookup: saved.elookup });
    Object.assign(dimsum.hooks, { fetch: saved.dfetch, random: saved.drandom, now: saved.dnow });
    dimsum.resetCache();
  };
};

test("voice: the browser module is well formed and every screen, section and command has bilingual labels", () => {
  assert.equal(checkFeatureModule(feature, "voice"), null);
  assert.equal(feature.screens.length, 1);
  assert.ok(feature.settings.length >= 12, "every panel is also a Settings section");
  assert.equal(new Set(feature.settings.map((s) => s.id)).size, feature.settings.length);
  for (const item of [...feature.screens, ...feature.settings, ...feature.commands, ...feature.toolbar]) assert.ok(item.label.en && item.label.yue, `${item.id} needs both labels`);
  const ids = feature.commands.map((c) => c.id);
  for (const needed of ["voice.open", "voice.wording.choose", "voice.wording.clear", "voice.rename", "voice.rename.reset", "voice.adhd.focus", "voice.adhd.low", "voice.adhd.time", "voice.adhd.one", "voice.adhd.momentum", "voice.sounds", "voice.narrator", "voice.school", "voice.schedule"]) assert.ok(ids.includes(needed), `${needed} is in the command palette`);
});

test("voice: the manifest lists the module and its stylesheet, and both are served", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/voice/index.js"));
    assert.ok(manifest.styles.includes("/js/features/voice/style.css"));
    assert.ok(manifest.server.includes("voice"));
    for (const url of ["/js/features/voice/index.js", "/js/features/voice/style.css", "/js/features/voice/strings-yue.js"]) assert.equal((await fetch(t.base + url)).status, 200, url);
  } finally {
    await t.stop();
  }
});

test("voice: identity and diagnostics always carry the shipped name; viewers may read; sources need a writer", async () => {
  const t = await startApp();
  try {
    const identity = (await t.owner.get("/api/x/voice/identity")).data;
    assert.deepEqual([identity.product, identity.packageName, identity.dataFolder], ["Material Asus Router", "material-asus-router", "data"]);
    assert.equal(identity.version, JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8")).version);
    const diagnostics = (await t.owner.get("/api/x/voice/diagnostics")).data;
    assert.equal(diagnostics.product, "Material Asus Router");
    assert.match(diagnostics.note, /cosmetic/);

    assert.equal((await t.client().get("/api/x/voice/identity")).status, 401);
    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201, viewer.text);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/x/voice/identity")).status, 200);
    assert.equal((await guest.post("/api/x/voice/external/api", { url: "https://schedule.example.test/now" })).status, 403);
    assert.equal((await t.owner.post("/api/x/voice/external/api", { url: "https://schedule.example.test/now" }, { csrf: "wrong" })).status, 403);
  } finally {
    await t.stop();
  }
});

// ---- schedule sources ---------------------------------------------------------------------------

test("voice external: the schedule answer is validated strictly", () => {
  assert.deepEqual(external.parseApiState({ schema: 1, active: true }), { active: true, settings: {}, validUntil: null });
  const full = external.parseApiState({ schema: 1, active: false, settings: { theme: "dark", accent: "#AABBCC", language: "yue", density: "compact", font: "large", motion: "reduced" }, validUntil: "2026-12-01T00:00:00Z" });
  assert.equal(full.settings.accent, "#aabbcc");
  assert.equal(full.validUntil, "2026-12-01T00:00:00.000Z");
  for (const bad of [null, [], "x", {}, { schema: 2, active: true }, { schema: 1, active: "yes" }, { schema: 1, active: true, extra: 1 }, { schema: 1, active: true, settings: [] }, { schema: 1, active: true, settings: { theme: "neon" } }, { schema: 1, active: true, settings: { accent: "red" } }, { schema: 1, active: true, settings: { wallpaper: "x" } }, { schema: 1, active: true, validUntil: "soon" }])
    assert.throws(() => external.parseApiState(bad), (e) => e.code === "BAD_RESPONSE", JSON.stringify(bad));
});

test("voice external: an API address must be public https", async () => {
  const done = restore();
  try {
    external.hooks.lookup = async (host) => (host === "internal.example.test" ? [{ address: "10.1.2.3" }] : [{ address: "203.0.113.7" }]);
    for (const [url, code] of [
      ["http://schedule.example.test/x", "BAD_URL"], ["ftp://schedule.example.test/x", "BAD_URL"], ["not a url", "BAD_URL"], ["https://user:pw@schedule.example.test/x", "BAD_URL"],
      ["https://127.0.0.1/x", "BLOCKED_HOST"], ["https://[::1]/x", "BLOCKED_HOST"], ["https://10.0.0.5/x", "BLOCKED_HOST"], ["https://169.254.1.1/x", "BLOCKED_HOST"], ["https://internal.example.test/x", "BLOCKED_HOST"],
    ]) await assert.rejects(external.checkApiTarget(url), (e) => e.code === code, url);
    assert.equal((await external.checkApiTarget("https://schedule.example.test/now")).hostname, "schedule.example.test");
    for (const ip of ["0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.0.1", "172.16.0.1", "172.31.255.255", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) assert.ok(external.isBlockedAddress(ip), ip);
    for (const ip of ["203.0.113.7", "192.0.2.1", "198.51.100.1", "2001:db8::1"]) assert.ok(!external.isBlockedAddress(ip), ip);
  } finally {
    done();
  }
});

test("voice external: the API source works, fails safely and never echoes the token", async () => {
  const done = restore();
  const t = await startApp();
  try {
    external.hooks.lookup = async () => [{ address: "203.0.113.7" }];
    const seen = [];
    external.hooks.fetch = async (url, init) => {
      seen.push({ url: String(url), auth: init.headers.Authorization, redirect: init.redirect });
      return json({ schema: 1, active: true, settings: { theme: "dark" } });
    };
    const ok = await t.owner.post("/api/x/voice/external/api", { url: "https://schedule.example.test/now", token: "tok-abc-123" });
    assert.equal(ok.status, 200, ok.text);
    assert.deepEqual([ok.data.active, ok.data.settings, ok.data.source], [true, { theme: "dark" }, "api"]);
    assert.equal(seen[0].auth, "Bearer tok-abc-123");
    assert.equal(seen[0].redirect, "manual", "redirects are never followed");
    assert.ok(!ok.text.includes("tok-abc-123"), "the token is never echoed");

    const failures = [
      [() => new Response("", { status: 401 }), "UNAUTHORIZED"],
      [() => new Response("", { status: 404 }), "NOT_FOUND"],
      [() => new Response("", { status: 302, headers: { location: "https://elsewhere.example.test/" } }), "REDIRECT"],
      [() => new Response("", { status: 503 }), "HTTP"],
      [() => new Response("<html>", { status: 200 }), "BAD_RESPONSE"],
      [() => json({ schema: 1 }), "BAD_RESPONSE"],
      [() => new Response("x".repeat(70 * 1024), { status: 200 }), "TOO_BIG"],
      [() => { throw Object.assign(new Error("slow"), { name: "TimeoutError" }); }, "TIMEOUT"],
      [() => { throw new Error("offline secret tok-abc-123"); }, "UNREACHABLE"],
    ];
    for (const [make, code] of failures) {
      external.hooks.fetch = async () => make();
      const res = await t.owner.post("/api/x/voice/external/api", { url: "https://schedule.example.test/now", token: "tok-abc-123" });
      assert.ok(res.status >= 400, code);
      assert.equal(res.data.code, code, res.text);
      assert.ok(!res.text.includes("tok-abc-123"), `${code}: the token never appears in an error`);
    }
    const blocked = await t.owner.post("/api/x/voice/external/api", { url: "https://127.0.0.1/now" });
    assert.equal(blocked.data.code, "BLOCKED_HOST");
  } finally {
    done();
    await t.stop();
  }
});

test("voice external: the Home Assistant source reads on, off, unavailable and missing-token answers", async () => {
  const done = restore();
  const t = await startApp();
  try {
    let state = "on";
    const urls = [];
    external.hooks.fetch = async (url, init) => {
      urls.push(String(url));
      assert.equal(init.headers.Authorization, "Bearer long-lived-token");
      return json({ entity_id: "input_boolean.school_hours", state });
    };
    const body = { url: "http://homeassistant.local:8123/", entity: "input_boolean.school_hours", token: "long-lived-token" };
    const on = await t.owner.post("/api/x/voice/external/home-assistant", body);
    assert.equal(on.status, 200, on.text);
    assert.deepEqual([on.data.active, on.data.state, on.data.source], [true, "on", "home-assistant"]);
    assert.equal(urls[0], "http://homeassistant.local:8123/api/states/input_boolean.school_hours");
    state = "off";
    assert.equal((await t.owner.post("/api/x/voice/external/home-assistant", body)).data.active, false);
    state = "unavailable";
    assert.equal((await t.owner.post("/api/x/voice/external/home-assistant", body)).data.code, "ENTITY_UNAVAILABLE");
    state = "heating";
    assert.equal((await t.owner.post("/api/x/voice/external/home-assistant", body)).data.code, "BAD_RESPONSE");
    const before = urls.length;
    assert.equal((await t.owner.post("/api/x/voice/external/home-assistant", { ...body, token: "" })).data.code, "TOKEN_MISSING");
    assert.equal(urls.length, before, "with no token nothing is requested");
    assert.equal((await t.owner.post("/api/x/voice/external/home-assistant", { ...body, entity: "light.kitchen; drop" })).data.code, "BAD_ENTITY");
    assert.equal((await t.owner.post("/api/x/voice/external/home-assistant", { ...body, url: "http://user:pw@ha.local/" })).data.code, "BAD_URL");
    external.hooks.fetch = async () => new Response("", { status: 401 });
    assert.equal((await t.owner.post("/api/x/voice/external/home-assistant", body)).data.code, "UNAUTHORIZED");
  } finally {
    done();
    await t.stop();
  }
});

// ---- dim sum ------------------------------------------------------------------------------------

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const catalogue = { schemaVersion: "1.0.0", dishes: [
  { id: "hk-dish-0001", name: { en: "Classic Har Gow", zhHant: "蝦餃" }, image: { path: "images/hk-dish-0001-classic-har-gow.png", alt: { en: "Har gow", yue: "蝦餃" } } },
  { id: "hk-dish-0002", name: { en: "Scallop Har Gow", zhHant: "帶子蝦餃" }, image: { path: "images/hk-dish-0002-scallop-har-gow.png" } },
  { id: "hk-dish-1500", name: { en: "No Picture Bun", zhHant: "冇圖包" }, image: { path: "images/hk-dish-1500-no-picture-bun.png" } },
  { id: "bad", name: { en: "Broken", zhHant: "壞" }, image: { path: "x.png" } },
] };
function fakeNetwork({ missing = [], offline = false } = {}) {
  const log = [];
  return {
    log,
    fetch: async (url) => {
      log.push(String(url));
      if (offline) throw new Error("offline");
      const u = new URL(String(url));
      if (u.hostname === "raw.githubusercontent.com") return json(catalogue);
      if (u.hostname === "api.github.com") return json({ sha: "a".repeat(40) });
      if (u.hostname === "github.com") return new Response("", { status: 302, headers: { location: `https://release-assets.githubusercontent.com/x/${u.pathname.split("/").pop()}` } });
      if (u.hostname === "release-assets.githubusercontent.com") return missing.some((m) => u.pathname.includes(m)) ? new Response("", { status: 404 }) : new Response(PNG, { status: 200 });
      throw new Error(`unexpected host ${u.hostname}`);
    },
  };
}

test("voice dim sum: a dish comes with its names, picture, source and revision; only the public hosts are used", async () => {
  const done = restore();
  const net = fakeNetwork();
  try {
    dimsum.hooks.fetch = net.fetch;
    dimsum.hooks.random = () => 0;
    const found = await dimsum.pickDish();
    assert.deepEqual([found.dish.id, found.dish.en, found.dish.zhHant], ["hk-dish-0001", "Classic Har Gow", "蝦餃"]);
    assert.equal(found.dish.altEn, "Har gow");
    assert.match(found.photo.dataUrl, /^data:image\/png;base64,/);
    assert.equal(found.revision, "a".repeat(40));
    assert.equal(found.source, dimsum.SOURCE.index);
    assert.ok(found.photo.sourceUrl.startsWith("https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/"));
    assert.ok(net.log.every((u) => new URL(u).protocol === "https:"));
    assert.ok(!(await dimsum.loadCatalogue()).dishes.some((d) => d.id === "bad"), "an entry without proper names or a picture path is dropped");
  } finally {
    done();
  }
});

test("voice dim sum: a missing picture omits the dish and is reported; an unreachable catalogue is an honest error", async () => {
  const done = restore();
  try {
    dimsum.hooks.fetch = fakeNetwork({ missing: ["hk-dish-0001"] }).fetch;
    dimsum.hooks.random = () => 0;
    const found = await dimsum.pickDish();
    assert.equal(found.dish.id, "hk-dish-0002", "the dish without a picture is skipped");
    assert.deepEqual(found.omitted.map((o) => o.id), ["hk-dish-0001"]);

    dimsum.resetCache();
    dimsum.hooks.fetch = fakeNetwork({ missing: ["images", "hk-dish"] }).fetch;
    const none = await dimsum.pickDish();
    assert.equal(none.dish, null);
    assert.equal(none.photo, null);
    assert.ok(none.omitted.length >= 1);

    dimsum.resetCache();
    dimsum.hooks.fetch = fakeNetwork({ offline: true }).fetch;
    await assert.rejects(dimsum.pickDish());

    const t = await startApp();
    try {
      const res = await t.owner.get("/api/x/voice/dimsum/dish");
      assert.equal(res.status, 502, res.text);
      assert.equal(res.data.code, "UNAVAILABLE");
    } finally {
      await t.stop();
    }
  } finally {
    done();
  }
});

test("voice dim sum: the route serves a dish and never follows a redirect off the public hosts", async () => {
  const done = restore();
  const t = await startApp();
  try {
    dimsum.hooks.fetch = fakeNetwork().fetch;
    dimsum.hooks.random = () => 0;
    const ok = await t.owner.get("/api/x/voice/dimsum/dish");
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.data.dish.en, "Classic Har Gow");
    const excluded = await t.owner.get("/api/x/voice/dimsum/dish?exclude=hk-dish-0001");
    assert.notEqual(excluded.data.dish?.id, "hk-dish-0001");

    dimsum.resetCache();
    dimsum.hooks.fetch = async (url) => {
      const u = new URL(String(url));
      if (u.hostname === "raw.githubusercontent.com") return json(catalogue);
      if (u.hostname === "github.com") return new Response("", { status: 302, headers: { location: "https://evil.example.test/p.png" } });
      return new Response("", { status: 404 });
    };
    const refused = await t.owner.get("/api/x/voice/dimsum/dish");
    assert.equal(refused.data.dish ?? null, null, "a redirect to another host is not followed");
  } finally {
    done();
    await t.stop();
  }
});

test("voice code names: the current version has a recorded dish, none is reused, and the answer is factual without the network", async () => {
  const record = JSON.parse(await readFile(path.join(ROOT, "server", "features", "voice", "release-names.json"), "utf8"));
  const ids = Object.values(record.releases).map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "a dish is used for one release only");
  for (const [version, r] of Object.entries(record.releases)) {
    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.ok(r.en && r.zhHant && /^hk-dish-\d+$/.test(r.id) && r.photoFile.endsWith(".png") && /^[0-9a-f]{40}$/.test(r.revision), version);
  }
  const done = restore();
  const t = await startApp();
  try {
    dimsum.hooks.fetch = async () => { throw new Error("offline"); };
    const res = (await t.owner.get("/api/x/voice/dimsum/codename?photo=1")).data;
    const version = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8")).version;
    assert.equal(res.version, version);
    assert.deepEqual([res.current?.en, res.current?.zhHant], [record.releases[version].en, record.releases[version].zhHant]);
    assert.equal(res.photo, null);
    assert.ok(res.omitted.length === 1, "the missing picture is reported, and the code name is still shown");
  } finally {
    done();
    await t.stop();
  }
});

test("voice code names: assigning skips used dishes, needs a published picture and never fails when the catalogue is down", async () => {
  const done = restore();
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-names-"));
  try {
    const file = path.join(dir, "release-names.json");
    await writeFile(file, JSON.stringify({ schema: 1, source: "x", releases: { "0.1.0": { id: "hk-dish-0001", en: "Classic Har Gow", zhHant: "蝦餃" } } }));
    dimsum.hooks.fetch = fakeNetwork({ missing: ["hk-dish-0002"] }).fetch;
    const next = await assign("0.2.0", { file });
    assert.equal(next.id, "hk-dish-1500", "the used dish and the dish without a picture are both skipped");
    assert.equal((await assign("0.2.0", { file })).reused, true, "assigning again keeps the same dish");
    const saved = JSON.parse(await readFile(file, "utf8"));
    assert.deepEqual(Object.keys(saved.releases), ["0.1.0", "0.2.0"]);
    await assert.rejects(assign("0.3.0", { file }), /No unused dish/);
    await assert.rejects(assign("nonsense", { file }), /version/);
    dimsum.resetCache();
    dimsum.hooks.fetch = fakeNetwork({ offline: true }).fetch;
    await assert.rejects(assign("0.4.0", { file }));
    assert.equal(JSON.parse(await readFile(file, "utf8")).releases["0.4.0"], undefined, "nothing is written when the catalogue is unreachable");
  } finally {
    done();
    await rm(dir, { recursive: true, force: true });
  }
});

test("voice dim sum: no photo or catalogue copy is tracked in this project", () => {
  const files = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  const images = files.filter((f) => /\.(png|jpe?g|webp|gif|avif)$/i.test(f) && /dim|sum|dumpling|har-?gow|siu|catalog/i.test(f));
  assert.deepEqual(images, [], "dim sum pictures come only from the public catalogue");
  assert.ok(!files.some((f) => /dim-sum-photos|catalog\/index\.json/i.test(f)), "the catalogue is never copied here");
});

// ---- text ---------------------------------------------------------------------------------------

test("voice text: both languages have exactly the same keys and placeholders, and every key the code uses exists", async () => {
  const { EN } = await import("../../public/js/features/voice/strings-en.js");
  const { YUE } = await import("../../public/js/features/voice/strings-yue.js");
  assert.deepEqual(Object.keys(EN).sort(), Object.keys(YUE).sort(), "the two resource files have the same keys");
  const holes = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const key of Object.keys(EN)) {
    assert.ok(EN[key].trim() && YUE[key].trim(), `${key} is not empty`);
    assert.equal(holes(EN[key]), holes(YUE[key]), `${key}: the placeholders match`);
    assert.ok(/[㐀-鿿]/.test(YUE[key]) || /^(Cancel|Save)$/.test(EN[key]) || key === "narrationSampleEn", `${key}: the Cantonese text is Cantonese`);
  }
  const dir = path.join(ROOT, "public", "js", "features", "voice");
  const used = new Set();
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".js") || name.startsWith("strings")) continue;
    const source = await readFile(path.join(dir, name), "utf8");
    for (const m of source.matchAll(/(?:\btr(?:\.en|\.yue)?|\blabel)\(\s*"([A-Za-z0-9_-]+)"/g)) used.add(m[1]);
    for (const m of source.matchAll(/(?:\btr(?:\.en|\.yue)?|\blabel)\(\s*[^()"]*\?\s*"([A-Za-z0-9_-]+)"\s*:\s*"([A-Za-z0-9_-]+)"/g)) [m[1], m[2]].forEach((k) => used.add(k));
    for (const m of source.matchAll(/\btr\(\s*`([A-Za-z0-9_-]+_)\$\{/g)) for (const key of Object.keys(EN)) if (key.startsWith(m[1])) used.add(key);
  }
  for (const key of used) assert.ok(key in EN, `the code uses "${key}" but strings-en.js has no such key`);
  assert.ok(used.size > 150, "the scan found the keys");
});
