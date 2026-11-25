// Entware: detection, search, and opkg update, install, remove and upgrade with
// streamed output, behind confirmations and without touching what Entware
// itself stands on.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/entware/index.js";
import { ESSENTIAL, parseList, parseUpgradable } from "../../server/features/entware/index.mjs";
import { entware } from "../../server/features/entware/fake.mjs";
import { startApp } from "../helpers.mjs";

const base = "/api/x/entware";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function follow(client, job) {
  let from = 0;
  let output = "";
  for (;;) {
    const r = (await client.get(`${base}/jobs/${job}?from=${from}&wait=5000`)).data;
    from = r.next;
    output += r.chunks.map((c) => c.text).join("");
    if (r.status !== "running") return { ...r, output };
  }
}
const run = async (client, body) => {
  const r = await client.post(`${base}/run`, { ack: true, ...body });
  assert.equal(r.status, 200, r.text);
  return follow(client, r.data.job);
};
const withEntware = async (fn) => {
  const t = await startApp();
  try {
    await fn(t);
  } finally {
    await t.stop();
  }
};

test("entware: the browser module has the shape the registry needs", () => {
  assert.equal(checkFeatureModule(feature, "entware"), null);
});

test("entware: a router without it says so and offers nothing to run", async () => {
  const t = await startApp();
  try {
    entware(t.router).installed = false;
    assert.deepEqual((await t.owner.get("/api/domain/entware")).data, { id: "entware", installed: false });
    const r = await t.owner.post(`${base}/run`, { op: "update", ack: true });
    assert.equal(r.status, 409);
    assert.equal(r.data.code, "NO_ENTWARE");
    assert.equal(t.router.commands.some((c) => c.startsWith("/opt/bin/opkg update")), false);
  } finally {
    await t.stop();
  }
});

test("entware: status, installed packages and search come from the router", () =>
  withEntware(async (t) => {
    const status = (await t.owner.get("/api/domain/entware")).data;
    assert.equal(status.installed, true);
    assert.equal(status.architecture, "aarch64-3.10");
    assert.match(status.version, /opkg version/);
    assert.equal(status.packages, 3);
    assert.deepEqual(status.upgradable, [{ name: "nano", from: "7.2-1", to: "7.2-2" }]);
    assert.equal(status.space.freeKb, 15203328);

    const installed = (await t.owner.get(`${base}/installed`)).data.packages;
    assert.equal(installed.find((p) => p.name === "busybox").essential, true);
    assert.equal(installed.find((p) => p.name === "nano").essential, false);

    const found = (await t.owner.get(`${base}/search?q=nano`)).data;
    assert.deepEqual(found.results.map((p) => [p.name, p.installed]), [["nano", true]]);
    assert.match(found.results[0].description, /text editor/);
    assert.equal((await t.owner.get(`${base}/search?q=htop`)).data.results[0].installed, false);
    assert.equal((await t.owner.get(`${base}/search?q=a`)).status, 400, "one letter is not a search");
    assert.equal((await t.owner.get(`${base}/search?q=${encodeURIComponent("x'; reboot; '")}`)).status, 400);
    assert.deepEqual(parseList("nano - 7.2-1 - Small editor\nbad line\n"), [{ name: "nano", version: "7.2-1", description: "Small editor" }]);
    assert.deepEqual(parseUpgradable("nano - 1 - 2\n"), [{ name: "nano", from: "1", to: "2" }]);
  }));

test("entware: update, install, upgrade and remove stream their output and change the router", () =>
  withEntware(async (t) => {
    const update = await run(t.owner, { op: "update" });
    assert.equal(update.status, "done");
    assert.match(update.output, /Updated list of available packages/);

    const install = await run(t.owner, { op: "install", package: "htop" });
    assert.equal(install.status, "done", install.output);
    assert.match(install.output, /Installing htop \(3\.2\.2-1\)/);
    assert.ok(t.router.commands.includes("/opt/bin/opkg install 'htop'"));
    assert.equal(entware(t.router).installedPackages.has("htop"), true);
    const missing = await run(t.owner, { op: "install", package: "no-such-thing" });
    assert.equal(missing.status, "failed");
    assert.match(missing.output, /Unknown package/);

    const upgrade = await run(t.owner, { op: "upgrade" });
    assert.equal(upgrade.status, "done");
    assert.match(upgrade.output, /Upgrading nano to 7\.2-2/);
    assert.equal(entware(t.router).upgradable.size, 0);

    const remove = await run(t.owner, { op: "remove", package: "htop" });
    assert.equal(remove.status, "done");
    assert.equal(entware(t.router).installedPackages.has("htop"), false);

    const notes = (await t.owner.get("/api/changes/history")).data.items.filter((h) => h.items[0].key === "entware-action").map((h) => h.items[0].new);
    assert.ok(notes.some((n) => n.startsWith("/opt/bin/opkg install 'htop'") && n.endsWith("(done)")));
    assert.ok(notes.some((n) => n.startsWith("/opt/bin/opkg remove 'htop'")));
    assert.equal(notes.some((n) => n.includes("opkg update")), false, "a refresh of the lists is not worth a history entry");
  }));

test("entware: names are checked, essentials stay, and nothing runs without the confirmation", () =>
  withEntware(async (t) => {
    const before = t.router.commands.length;
    for (const name of ["a b", "x;reboot", "$(reboot)", "../x", "", "-rf", "a".repeat(80)])
      assert.equal((await t.owner.post(`${base}/run`, { op: "install", package: name, ack: true })).status, 400, JSON.stringify(name));
    for (const name of ESSENTIAL) {
      const r = await t.owner.post(`${base}/run`, { op: "remove", package: name, ack: true });
      assert.equal(r.status, 403, name);
      assert.equal(r.data.code, "ESSENTIAL");
    }
    assert.equal((await t.owner.post(`${base}/run`, { op: "install", package: "htop" })).status, 403, "the confirmation flag is required");
    assert.equal((await t.owner.post(`${base}/run`, { op: "format-everything", ack: true })).status, 404);
    assert.equal(t.router.commands.slice(before).some((c) => /opkg (install|remove)/.test(c)), false, "none of those reached the router");
    assert.equal(entware(t.router).installedPackages.has("busybox"), true);
  }));

test("entware: only one package job runs at a time, and viewers cannot run any", () =>
  withEntware(async (t) => {
    await t.owner.post("/api/users", { name: "viewer", username: "viewer", password: "a long enough password", role: "viewer" });
    const viewer = t.client();
    await viewer.signIn("viewer", "a long enough password");
    assert.equal((await viewer.post(`${base}/run`, { op: "update", ack: true })).status, 403);
    assert.equal((await viewer.get(`${base}/installed`)).status, 200, "viewers can look");
    const first = await t.owner.post(`${base}/run`, { op: "install", package: "htop", ack: true });
    const second = await t.owner.post(`${base}/run`, { op: "install", package: "curl", ack: true });
    assert.equal(second.status, 409);
    assert.equal(second.data.code, "BUSY");
    await follow(t.owner, first.data.job);
  }));

test("entware: the folder obeys the project's wording and address rules", async () => {
  const files = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else files.push(full);
    }
  };
  await walk(path.join(ROOT, "server", "features", "entware"));
  await walk(path.join(ROOT, "public", "js", "features", "entware"));
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, new RegExp(`\\b${"c"}${"at"}\\b`, "i"), `${file}: reserved word found`);
    assert.doesNotMatch(text, /\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/, `${file}: private-range address`);
    assert.doesNotMatch(text, /\b(admin|root|docker)@[0-9a-z]/i, `${file}: user@address`);
  }
});
