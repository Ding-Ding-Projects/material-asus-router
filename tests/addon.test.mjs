// The router add-on: its scripts are plain POSIX sh for the router's BusyBox, it is off by
// default, binds only to the home network, and installs, updates, rolls back and uninstalls
// cleanly. The end-to-end part needs a Unix shell with real symbolic links, so it runs on
// Linux and macOS (as in the release checks) and is skipped on Windows.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFile(path.join(ROOT, ...p), "utf8");

test("the add-on scripts are POSIX sh, off by default and bound to the home network only", async () => {
  for (const file of ["install.sh", "uninstall.sh", "mar.sh"]) {
    const text = await read("addon", file);
    assert.match(text, /^#!\/bin\/sh\n/, `${file} runs with /bin/sh`);
    assert.doesNotMatch(text, /\[\[|(?<!# )<<< *["$A-Za-z]|^\s*(local|declare|function|source)\s|\$\{[A-Za-z_]+\/\//m, `${file} uses no bash-only syntax`);
    assert.doesNotMatch(text, /(^|[;&|]\s*)(reboot|mtd-write|mtd|flash_erase)\b|service\s+reboot|rc rc_service reboot/m, `${file} never restarts or flashes the router`);
  }
  const install = await read("addon", "install.sh");
  assert.match(install, /mar_enabled 0/, "installs switched off");
  const mar = await read("addon", "mar.sh");
  assert.match(mar, /BIND_ADDRESS="\$ip"/, "binds to the router's home network address");
  assert.match(mar, /0\.0\.0\.0\) say/, "refuses an unknown address instead of listening everywhere");
  assert.match(mar, /verify_archive/, "updates are checked against SHA256SUMS");
  const page = await read("addon", "webui", "mar.asp");
  assert.match(page, /localStorage\.setItem\(CHOICE_KEY/, "the Material or Advanced choice is remembered per browser");
  assert.match(page, /restart_materialrouter/, "applying restarts only this app");
  assert.doesNotMatch(page, /restart_(all|net|wireless)|reboot/, "the page never restarts the router or its networks");
});

const shell = process.platform !== "win32" && spawnSync("sh", ["-c", "command -v sha256sum && command -v tar"], { encoding: "utf8" }).status === 0;

const freePort = () => new Promise((resolve) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

test("install, start, update with health check, roll back and uninstall on a pretend router", { skip: !shell && "needs a Unix shell with real symbolic links" }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-addon-"));
  try {
    execFileSync(process.execPath, [path.join(ROOT, "scripts", "build-addon.mjs")], { cwd: ROOT, stdio: "ignore" });
    const unpacked = path.join(dir, "release");
    await mkdir(unpacked);
    execFileSync("tar", ["-xzf", path.join(ROOT, "dist", "addon", "material-asus-router-addon.tar.gz"), "-C", unpacked]);
    const root = path.join(dir, "router");
    for (const d of ["jffs/scripts", "jffs/addons", "opt/var", "tmp"]) await mkdir(path.join(root, d), { recursive: true });
    await writeFile(path.join(root, "jffs/scripts/services-start"), "#!/bin/sh\necho mine\n");
    const port = await freePort();
    const env = { ...process.env, MAR_ROOT: root, MAR_SKIP_CHECKS: "1", MAR_LAN_IP: "127.0.0.1", MAR_NODE: process.execPath };
    const run = (...args) => spawnSync("sh", args, { env, encoding: "utf8", timeout: 120000 });
    const mar = (...args) => run(path.join(root, "jffs/addons/material-asus-router/mar.sh"), ...args);

    let r = run(path.join(unpacked, "install.sh"));
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const start = await readFile(path.join(root, "jffs/scripts/services-start"), "utf8");
    assert.match(start, /echo mine/, "existing hook lines are kept");
    assert.equal(start.match(/>>> material-asus-router/g).length, 1);
    assert.equal(run(path.join(unpacked, "install.sh")).status, 0, "installing again is safe");
    assert.equal((await readFile(path.join(root, "jffs/scripts/services-start"), "utf8")).match(/>>> material-asus-router/g).length, 1, "hooks are added once");
    assert.match(mar("status").stdout, /switched off/);
    assert.match(mar("start").stdout, /switched off; not starting/, "off means off");

    const settings = path.join(root, "jffs/addons/custom_settings.txt");
    await writeFile(settings, (await readFile(settings, "utf8")).replace(/^mar_port .*$/m, `mar_port ${port}`));
    r = mar("enable");
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const health = async () => { for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return true; } catch {} await new Promise((s) => setTimeout(s, 500)); } return false; };
    assert.ok(await health(), "the app answers once switched on");
    const app = path.join(root, "opt/share/material-asus-router");
    const slot = async () => (await readlink(path.join(app, "current"))).slice(-1);
    const other = (s) => (s === "a" ? "b" : "a");
    assert.equal(await slot(), "b", "installing a second time went through the updater into the spare slot");

    // A good update moves to the spare slot and keeps answering.
    r = mar("update", path.join(ROOT, "dist", "addon", "material-asus-router-addon.tar.gz"));
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const good = await slot();
    assert.equal(good, "a");
    assert.ok(await health());

    // A broken update is rolled back by itself.
    const broken = path.join(dir, "broken");
    await cp(path.join(app, "slots", "b"), broken, { recursive: true });
    await writeFile(path.join(broken, "server", "index.mjs"), "process.exit(1);\n");
    execFileSync("tar", ["-czf", "broken.tar.gz", "-C", "broken", "."], { cwd: dir });
    r = mar("update", path.join(dir, "broken.tar.gz"));
    assert.notEqual(r.status, 0, "a version that does not answer is refused");
    assert.match(r.stdout, new RegExp(`going back to slot ${good}`));
    assert.equal(await slot(), good);
    assert.ok(await health(), "the previous version is running again");

    // The failed copy used the spare slot, so there is honestly no older version to go back to.
    r = mar("rollback");
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /there is no previous version/);
    assert.equal(await slot(), good);

    // After another good update, rollback returns to the version before it.
    r = mar("update", path.join(ROOT, "dist", "addon", "material-asus-router-addon.tar.gz"));
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(await slot(), other(good));
    r = mar("rollback");
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(await slot(), good);
    assert.ok(await health(), "the rolled-back version answers");

    r = run(path.join(root, "jffs/addons/material-asus-router/uninstall.sh"));
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const after = await readFile(path.join(root, "jffs/scripts/services-start"), "utf8");
    assert.doesNotMatch(after, /material-asus-router/, "hooks are removed");
    assert.match(after, /echo mine/, "other hook lines stay");
    assert.doesNotMatch(await readFile(settings, "utf8"), /^mar_/m);
    let down = false;
    try { await fetch(`http://127.0.0.1:${port}/health`); } catch { down = true; }
    assert.ok(down, "the app is stopped");
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(path.join(ROOT, "dist", "addon"), { recursive: true, force: true });
  }
});
