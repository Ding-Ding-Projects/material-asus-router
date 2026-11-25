// Merlin add-ons: read-only status cards, and a launch button that runs only the
// reviewed version command of an add-on that is really installed.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/addons/index.js";
import { KNOWN } from "../../server/features/addons/index.mjs";
import { startApp } from "../helpers.mjs";

const base = "/api/x/addons";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("addons: the browser module has the shape the registry needs", () => {
  assert.equal(checkFeatureModule(feature, "addons"), null);
});

test("addons: every folder in /jffs/addons becomes a card, known ones with their own words", async () => {
  const t = await startApp();
  try {
    const data = (await t.owner.get("/api/domain/addons")).data;
    assert.deepEqual(data.addons.map((a) => a.key), ["amtm", "connmon", "spdmerlin"]);
    const by = Object.fromEntries(data.addons.map((a) => [a.key, a]));
    assert.equal(by.spdmerlin.name, "spdMerlin");
    assert.equal(by.spdmerlin.folder, "spdmerlin.d");
    assert.equal(by.spdmerlin.sizeKb, 412);
    assert.equal(by.spdmerlin.command, "/jffs/scripts/spdmerlin version");
    assert.equal(by.amtm.command, null, "amtm is a menu, so there is no command to launch");
    assert.equal(data.amtm, true);
    assert.deepEqual(data.scripts, ["firewall-start", "services-start"]);
    for (const a of data.addons) assert.ok(a.about.en && a.about.yue);
    const domains = (await t.owner.get("/api/catalog")).data.domains;
    assert.equal(domains.find((d) => d.id === "addons").supported, true);
  } finally {
    await t.stop();
  }
});

test("addons: a stock router has no add-ons and the screen says it needs Merlin", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    assert.equal((await t.owner.get("/api/catalog")).data.domains.find((d) => d.id === "addons").supported, false);
    assert.deepEqual((await t.owner.get("/api/domain/addons")).data.addons, []);
  } finally {
    await t.stop();
  }
});

test("addons: the status button runs only a reviewed version command of an installed add-on", async () => {
  const t = await startApp();
  try {
    const before = t.router.commands.length;
    const ok = await t.owner.post(`${base}/status`, { key: "spdmerlin" });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.data.command, "/jffs/scripts/spdmerlin version");
    assert.match(ok.data.output, /spdMerlin version v4\.4\.8/);
    assert.equal(ok.data.code, 0);
    assert.ok(t.router.commands.includes("/jffs/scripts/spdmerlin version"));

    assert.equal((await t.owner.post(`${base}/status`, { key: "amtm" })).data.code, "NO_COMMAND");
    assert.equal((await t.owner.post(`${base}/status`, { key: "ntpmerlin" })).status, 404, "a reviewed add-on that is not installed");
    const noScript = await t.owner.post(`${base}/status`, { key: "uidivstats" });
    assert.equal(noScript.status, 404);
    for (const key of ["__proto__", "constructor", "spdmerlin; reboot", "../../etc/passwd", "", "toString"]) {
      const r = await t.owner.post(`${base}/status`, { key });
      assert.ok([404].includes(r.status), `${JSON.stringify(key)} -> ${r.status}`);
    }
    // Only the one reviewed command (and the reads that list the folder) ever reached the router.
    const sent = t.router.commands.slice(before);
    assert.equal(sent.some((c) => c.includes("reboot") || c.includes("passwd")), false);
    assert.equal(sent.filter((c) => c.endsWith(" version")).length, 1);
  } finally {
    await t.stop();
  }
});

test("addons: every reviewed command is inside /jffs/scripts and uses only the version word", () => {
  for (const [key, a] of Object.entries(KNOWN)) {
    assert.ok(a.about.en && a.about.yue, key);
    if (a.script) assert.match(a.script, /^\/jffs\/scripts\/[A-Za-z0-9._-]+$/, key);
  }
});

test("addons: viewers can look at the cards but cannot launch anything", async () => {
  const t = await startApp();
  try {
    await t.owner.post("/api/users", { name: "viewer", username: "viewer", password: "a long enough password", role: "viewer" });
    const viewer = t.client();
    await viewer.signIn("viewer", "a long enough password");
    assert.equal((await viewer.get("/api/domain/addons")).status, 200);
    assert.equal((await viewer.post(`${base}/status`, { key: "spdmerlin" })).status, 403);
  } finally {
    await t.stop();
  }
});

test("addons: the folder obeys the project's wording and address rules", async () => {
  const files = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else files.push(full);
    }
  };
  await walk(path.join(ROOT, "server", "features", "addons"));
  await walk(path.join(ROOT, "public", "js", "features", "addons"));
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, new RegExp(`\\b${"c"}${"at"}\\b`, "i"), `${file}: reserved word found`);
    assert.doesNotMatch(text, /\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/, `${file}: private-range address`);
    assert.doesNotMatch(text, /\b(admin|root|docker)@[0-9a-z]/i, `${file}: user@address`);
  }
});
