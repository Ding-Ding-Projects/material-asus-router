// app-update: the owner's App updates screen talks to the updater only through the shared folder,
// the nightly update fires once at the chosen local time, and updater/updater.sh updates, stays
// put when up to date, and puts the previous version back when the new one does not answer
// (run against a stand-in for the docker command).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir, chmod } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import client, { stepStates } from "../../public/js/features/app-update/index.js";
import { nightTick, readUpdater, request } from "../../server/features/app-update/index.mjs";
import { startApp } from "../helpers.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "mar-upd-data-"));

test("app-update: without the updater the screen says how to set it up, and actions are refused", async () => {
  delete process.env.UPDATES_DIR;
  const t = await startApp();
  try {
    const view = (await t.owner.get("/api/domain/app-update")).data;
    assert.equal(view.updater.configured, false);
    assert.equal((await t.owner.post("/api/x/app-update/apply", {})).status, 409);
  } finally {
    await t.stop();
  }
});

test("app-update: the owner's requests go to the shared folder, operators cannot update, and the status is read back", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-upd-"));
  process.env.UPDATES_DIR = dir;
  const t = await startApp();
  try {
    assert.equal((await readUpdater(dir)).alive, false, "no heartbeat yet");
    await writeFile(path.join(dir, "heartbeat.txt"), String(Math.floor(Date.now() / 1000)));
    await writeFile(path.join(dir, "status.txt"), "state=available\nstep=done\nmessage=A newer version is ready: sha-1a2b3c4d5e6f.\ncurrent=8e0f4ba7cb53\nlatest=1a2b3c4d5e6f\n");
    await writeFile(path.join(dir, "history.log"), "2026-11-25T20:16:00Z|updated|sha-8e0f4ba7cb53|Pat\n");
    const view = (await t.owner.get("/api/domain/app-update")).data;
    assert.equal(view.updater.alive, true);
    assert.equal(view.updater.status.latest, "1a2b3c4d5e6f");
    assert.deepEqual(view.updater.history[0], { at: "2026-11-25T20:16:00Z", event: "updated", detail: "sha-8e0f4ba7cb53", by: "Pat" });

    assert.equal((await t.owner.post("/api/x/app-update/apply", {})).status, 200);
    assert.match(await readFile(path.join(dir, "request.txt"), "utf8"), /^id=[0-9a-f-]{36} action=apply by=Pat\n$/);

    assert.equal((await t.owner.post("/api/users", { name: "helper", username: "helper", password: "a long enough password", role: "operator" })).status, 201);
    const op = t.client();
    await op.signIn("helper", "a long enough password");
    assert.equal((await op.post("/api/x/app-update/apply", {})).status, 403, "only the owner updates the app");
    assert.equal((await op.request("PUT", "/api/x/app-update/auto", { enabled: true, time: "03:00" })).status, 403);

    assert.equal((await t.owner.request("PUT", "/api/x/app-update/auto", { enabled: true, time: "05:00" })).status, 400);
    assert.equal((await t.owner.request("PUT", "/api/x/app-update/auto", { enabled: true, time: "03:00", offsetMinutes: -300 })).status, 200);
  } finally {
    await t.stop();
    delete process.env.UPDATES_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});

test("app-update: the nightly update fires once at the chosen local time", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-upd-night-"));
  try {
    // offsetMinutes -300 was saved above: 03:00 local is 08:00 UTC.
    assert.equal(await nightTick(new Date("2026-11-26T07:59:00Z"), dir), false);
    assert.equal(await nightTick(new Date("2026-11-26T08:00:00Z"), dir), true);
    assert.match(await readFile(path.join(dir, "request.txt"), "utf8"), /action=apply by=night/);
    assert.equal(await nightTick(new Date("2026-11-26T08:00:30Z"), dir), false, "only once a day");
    assert.equal(await nightTick(new Date("2026-11-27T08:00:00Z"), dir), true, "and again the next night");
    await assert.rejects(() => request("reboot", "Pat", dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("app-update: the screen module and its step display", () => {
  assert.equal(checkFeatureModule(client, "app-update"), null);
  assert.deepEqual(stepStates({ state: "updating", step: "waiting" }), ["done", "done", "now", "todo"]);
  assert.deepEqual(stepStates({ state: "rolledback", step: "waiting" }), ["done", "done", "failed", "todo"]);
  assert.deepEqual(stepStates({ state: "updated", step: "done" }), ["done", "done", "done", "done"]);
});

// A stand-in for the docker command: the running app and the newest build each have a revision,
// compose up switches the running one to the tag in .env, and FAIL_NEW makes the new one unhealthy.
const FAKE_DOCKER = `#!/bin/sh
S="$FAKE_STATE"
case "$*" in
  "pull -q "*) exit 0 ;;
  *"image.revision"*" material-asus-router") head -n 1 "$S/running" ;;
  *"image.revision"*":latest") head -n 1 "$S/latest" ;;
  *"image.created"*) echo 2026-11-25T21:05:00Z ;;
  *".State.Health.Status"*) if [ -f "$S/fail" ] && [ "$(cut -c1-12 "$S/running")" = "$(cut -c1-12 "$S/latest")" ]; then echo unhealthy; else echo healthy; fi ;;
  "compose pull"*) exit 0 ;;
  "compose up"*) tag=$(sed -n 's/^ROUTER_APP_TAG=sha-//p' .env); if [ "$(cut -c1-12 "$S/latest")" = "$tag" ]; then cp "$S/latest" "$S/running"; else cp "$S/previous" "$S/running"; fi; echo up >> "$S/ups" ;;
  *) echo "unexpected: $*" >&2; exit 1 ;;
esac
`.replace(/\bcat\b/g, "head -n 1");

const sh = spawnSync("sh", ["-c", "echo ok"], { encoding: "utf8" }).status === 0;

test("updater.sh: updates, stays put when up to date, and rolls back a version that does not answer", { skip: !sh && "needs a POSIX shell" }, async () => {
  const work = await mkdtemp(path.join(os.tmpdir(), "mar-updater-"));
  try {
    const state = path.join(work, "state"), deploy = path.join(work, "deploy"), updates = path.join(work, "updates");
    for (const d of [state, deploy, updates]) await mkdir(d, { recursive: true });
    const docker = path.join(work, "docker");
    await writeFile(docker, FAKE_DOCKER);
    await chmod(docker, 0o755);
    const run = async ({ running, latest, fail = false, action = "apply" }) => {
      await writeFile(path.join(state, "running"), `${running}\n`);
      await writeFile(path.join(state, "previous"), `${running}\n`);
      await writeFile(path.join(state, "latest"), `${latest}\n`);
      await rm(path.join(state, "fail"), { force: true });
      if (fail) await writeFile(path.join(state, "fail"), "1");
      await writeFile(path.join(deploy, ".env"), `ROUTER_APP_PORT=8790\nROUTER_APP_TAG=sha-${running}\n`);
      await writeFile(path.join(updates, "request.txt"), `id=test-1 action=${action} by=Pat\n`);
      const r = spawnSync("sh", [path.join(ROOT, "updater", "updater.sh")], {
        encoding: "utf8", timeout: 60000,
        env: { ...process.env, UPDATES_DIR: updates, DEPLOY_DIR: deploy, DOCKER_BIN: docker, FAKE_STATE: state, UPDATER_ONCE: "1", HEALTH_WAIT_SECONDS: "6", APP_UID: String(process.getuid?.() ?? 0) },
      });
      const status = Object.fromEntries((await readFile(path.join(updates, "status.txt"), "utf8")).trim().split("\n").map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1)]));
      return { r, status, env: await readFile(path.join(deploy, ".env"), "utf8") };
    };

    const good = await run({ running: "8e0f4ba7cb53", latest: "1a2b3c4d5e6f" });
    assert.equal(good.status.state, "updated", good.r.stderr + JSON.stringify(good.status));
    assert.match(good.env, /^ROUTER_APP_TAG=sha-1a2b3c4d5e6f$/m, "the newest build's exact tag is pinned");
    assert.match(good.env, /^ROUTER_APP_PORT=8790$/m, "the rest of .env is kept");

    const same = await run({ running: "1a2b3c4d5e6f", latest: "1a2b3c4d5e6f" });
    assert.equal(same.status.state, "uptodate");

    const bad = await run({ running: "8e0f4ba7cb53", latest: "deadbeef0000", fail: true });
    assert.equal(bad.status.state, "rolledback", JSON.stringify(bad.status));
    assert.match(bad.status.message, /did not answer, so the previous one was put back/);
    assert.match(bad.env, /^ROUTER_APP_TAG=sha-8e0f4ba7cb53$/m, "the previous tag is back");

    const check = await run({ running: "8e0f4ba7cb53", latest: "1a2b3c4d5e6f", action: "check" });
    assert.equal(check.status.state, "available");
    assert.match(check.env, /sha-8e0f4ba7cb53/, "a check changes nothing");
    const history = await readFile(path.join(updates, "history.log"), "utf8");
    assert.match(history, /\|updated\|sha-1a2b3c4d5e6f\|Pat/);
    assert.match(history, /\|rolledback\|sha-deadbeef0000 did not answer\|Pat/);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
