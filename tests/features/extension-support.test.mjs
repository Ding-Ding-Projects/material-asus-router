// Extension support: manifest validation and refusals, permission enforcement,
// consent, time and size limits, a real extension process run, and that
// sensitive values never reach an extension.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import feature from "../../public/js/features/extension-support/index.js";
import { runExtension } from "../../server/features/extension-support/host.mjs";
import { BUILTIN } from "../../server/features/extension-support/index.mjs";
import { FORBIDDEN_PERMISSIONS, PERMISSIONS, SENSITIVE_KEY, effectivePermissions, validateManifest } from "../../server/features/extension-support/manifest.mjs";
import { assertModuleListed } from "../nav-kit.mjs";
import { startApp } from "../helpers.mjs";

const good = () => ({ schema: 1, id: "my-ext", version: "1.2.3", entry: "main.mjs", name: { en: "Mine", yue: "我嘅" }, description: { en: "Does a thing.", yue: "做一件事。" }, permissions: ["router.status"] });

test("extension-support: the built-in manifests are valid and a good manifest is accepted", () => {
  for (const m of BUILTIN) assert.equal(validateManifest(m).ok, true, m.id);
  const r = validateManifest(good());
  assert.equal(r.ok, true);
  assert.deepEqual(r.manifest.permissions, ["router.status"]);
});

test("extension-support: every kind of bad manifest is refused with a sentence", () => {
  const cases = [
    [{ ...good(), schema: 2 }, /schema/], [{ ...good(), id: "Bad Id" }, /id must/], [{ ...good(), version: "1" }, /version/],
    [{ ...good(), entry: "../evil.mjs" }, /entry/], [{ ...good(), entry: "dir/x.mjs" }, /entry/], [{ ...good(), entry: "x.sh" }, /entry/],
    [{ ...good(), name: { en: "x" } }, /name needs/], [{ ...good(), description: { en: "x", yue: "y".repeat(400) } }, /description needs/],
    [{ ...good(), permissions: "all" }, /permissions must/], [{ ...good(), permissions: ["router.status", "router.status"] }, /twice/],
    [{ ...good(), permissions: ["teleport"] }, /not a known permission/], [{ ...good(), extra: 1 }, /not a manifest field/],
    [{ ...good(), author: 7 }, /author/], [null, /JSON object/], [[], /JSON object/],
  ];
  for (const [m, re] of cases) {
    const r = validateManifest(m);
    assert.equal(r.ok, false, JSON.stringify(m));
    assert.match(r.errors.join(" "), re, JSON.stringify(m));
  }
});

test("extension-support: sensitive permissions are refused outright and no permission exists for them", () => {
  assert.ok(FORBIDDEN_PERMISSIONS.includes("ssh.credentials") && FORBIDDEN_PERMISSIONS.includes("router.password"));
  for (const p of FORBIDDEN_PERMISSIONS) {
    assert.equal(PERMISSIONS[p], undefined, `${p} is not a permission an extension can have`);
    const r = validateManifest({ ...good(), permissions: [p] });
    assert.equal(r.ok, false);
    assert.match(r.errors.join(), /refused/);
  }
  for (const key of ["wl0_wpa_psk", "http_passwd", "sshd_authkeys", "vpn_server_key", "api_token"]) assert.ok(SENSITIVE_KEY.test(key), key);
  assert.ok(!SENSITIVE_KEY.test("productid"));
});

test("extension-support: only permissions both declared and allowed take effect", () => {
  const m = { permissions: ["router.status", "nvram.read"] };
  assert.deepEqual(effectivePermissions(m, ["nvram.read", "ssh.credentials"]), ["nvram.read"]);
  assert.deepEqual(effectivePermissions(m, undefined), []);
  assert.deepEqual(effectivePermissions(m, "router.status"), []);
});

async function scratch(script) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-ext-"));
  await writeFile(path.join(dir, "x.mjs"), script);
  return { dir, done: () => rm(dir, { recursive: true, force: true }) };
}
const m = { entry: "x.mjs" };
const exec = async () => ({ stdout: "86400.50 1.0\n" });
const nvram = new Map([["productid", "RT-AX86U"], ["wl0_wpa_psk", "top-secret-pass"]]);
const ask = (call, extra = "") => `import readline from "node:readline"; const rl = readline.createInterface({ input: process.stdin }); let n = 0; rl.on("line", (l) => { const m = JSON.parse(l); if (m.hello) process.stdout.write(JSON.stringify({ id: 1, call: ${JSON.stringify(call)}${extra} }) + "\\n"); else process.stdout.write(JSON.stringify({ result: m }) + "\\n"); });`;

test("extension-support: a real extension process runs, asks the host and returns a result", async () => {
  const s = await scratch(ask("router.uptime"));
  try {
    const r = await runExtension({ manifest: m, dir: s.dir, granted: ["router.status"], exec, nvram });
    assert.equal(r.ok, true);
    assert.deepEqual(r.result, { id: 1, ok: true, value: { seconds: 86400 } });
  } finally {
    await s.done();
  }
});

test("extension-support: a call without the permission is denied by the host", async () => {
  const s = await scratch(ask("router.uptime"));
  try {
    const r = await runExtension({ manifest: m, dir: s.dir, granted: [], exec, nvram });
    assert.deepEqual(r.result, { id: 1, ok: false, error: "permission-denied" });
  } finally {
    await s.done();
  }
});

test("extension-support: sensitive settings never reach an extension even with nvram.read", async () => {
  const s = await scratch(ask("nvram.get", ', key: "wl0_wpa_psk"'));
  const ok = await scratch(ask("nvram.get", ', key: "productid"'));
  try {
    const denied = await runExtension({ manifest: m, dir: s.dir, granted: ["nvram.read"], exec, nvram });
    assert.deepEqual(denied.result, { id: 1, ok: false, error: "key-not-available" });
    assert.ok(!JSON.stringify(denied).includes("top-secret-pass"));
    const allowed = await runExtension({ manifest: m, dir: ok.dir, granted: ["nvram.read"], exec, nvram });
    assert.deepEqual(allowed.result, { id: 1, ok: true, value: "RT-AX86U" });
  } finally {
    await s.done();
    await ok.done();
  }
});

test("extension-support: a slow extension is stopped at the time limit", async () => {
  const s = await scratch("setInterval(() => {}, 1000);");
  try {
    const r = await runExtension({ manifest: m, dir: s.dir, granted: [], exec, nvram, limits: { timeoutMs: 300, maxBytes: 65536, maxCalls: 20 } });
    assert.equal(r.ok, false);
    assert.match(r.error, /longer than 300 ms/);
  } finally {
    await s.done();
  }
});

test("extension-support: an extension that writes too much, or something that is not JSON, is stopped", async () => {
  const big = await scratch('process.stdin.on("data", () => process.stdout.write("x".repeat(70000)));');
  const junk = await scratch('process.stdin.on("data", () => process.stdout.write("not json\\n"));');
  const quiet = await scratch('process.stdin.on("data", () => process.exit(0));');
  try {
    assert.match((await runExtension({ manifest: m, dir: big.dir, granted: [], exec, nvram })).error, /more than 65536 bytes/);
    assert.match((await runExtension({ manifest: m, dir: junk.dir, granted: [], exec, nvram })).error, /not JSON/);
    assert.match((await runExtension({ manifest: m, dir: quiet.dir, granted: [], exec, nvram })).error, /without a result/);
  } finally {
    await big.done();
    await junk.done();
    await quiet.done();
  }
});

test("extension-support: too many calls from one extension are refused", async () => {
  const s = await scratch('process.stdin.on("data", () => { for (let i = 1; i <= 5; i++) process.stdout.write(JSON.stringify({ id: i, call: "router.uptime" }) + "\\n"); });');
  const seen = [];
  const spy = async () => { seen.push(1); return { stdout: "5.00 1.0\n" }; };
  try {
    await runExtension({ manifest: m, dir: s.dir, granted: ["router.status"], exec: spy, nvram, limits: { timeoutMs: 400, maxBytes: 65536, maxCalls: 2 } });
    assert.ok(seen.length <= 2, `the router was asked ${seen.length} times`);
  } finally {
    await s.done();
  }
});

test("extension-support: the routes list built-ins, validate a manifest, require consent and run both built-in extensions", async () => {
  const t = await startApp();
  try {
    const list = (await t.owner.get("/api/x/extension-support/list")).data;
    assert.deepEqual(list.extensions.map((e) => e.id), ["reboot-planner", "uptime-log"].sort((a, b) => BUILTIN.findIndex((x) => x.id === a) - BUILTIN.findIndex((x) => x.id === b)));
    assert.ok(list.extensions.every((e) => e.builtin && e.permissionLabels.length === e.permissions.length));
    assert.ok(!list.permissions.some((p) => FORBIDDEN_PERMISSIONS.includes(p.id)));

    assert.equal((await t.owner.post("/api/x/extension-support/validate", { manifest: good() })).data.ok, true);
    assert.equal((await t.owner.post("/api/x/extension-support/validate", { manifest: { ...good(), permissions: ["router.password"] } })).data.ok, false);

    const noConsent = await t.owner.post("/api/x/extension-support/run", { id: "uptime-log", allowed: [] });
    assert.equal(noConsent.status, 403);
    assert.equal(noConsent.data.code, "CONSENT_NEEDED");
    assert.match(noConsent.data.error, /Still needed: router\.status/);
    assert.equal((await t.owner.post("/api/x/extension-support/run", { id: "nope", allowed: [] })).status, 404);

    const up = (await t.owner.post("/api/x/extension-support/run", { id: "uptime-log", allowed: ["router.status"] })).data;
    assert.equal(up.ok, true);
    assert.deepEqual(up.result.granted, ["router.status"]);
    assert.ok(up.result.seconds >= 0 && up.result.note === "ok");

    const plan = (await t.owner.post("/api/x/extension-support/run", { id: "reboot-planner", allowed: ["nvram.read"] })).data;
    assert.equal(plan.ok, true);
    assert.equal(plan.result.performed, false);
    assert.equal(plan.result.model, "RT-AX86U");
    assert.ok(!JSON.stringify(plan).includes("milk-tea"), "no router password is in the result");

    const guest = t.client();
    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "another long passphrase", role: "viewer" });
    await guest.signIn("alex", "another long passphrase");
    assert.equal((await guest.get("/api/x/extension-support/list")).status, 200, "a viewer may look");
    assert.equal((await guest.post("/api/x/extension-support/run", { id: "uptime-log", allowed: ["router.status"] })).status, 403, "a viewer may not run");
  } finally {
    await t.stop();
  }
});

test("extension-support: the module is listed and well formed", async () => {
  await assertModuleListed("extension-support", feature);
  assert.ok(feature.screens.some((s) => s.id === "extensions"));
});
