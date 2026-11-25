// merlin-pro: the script editor's reviewed save, the cron builder, Entware,
// add-ons and JFFS usage, and the way everything stays switched off on stock
// firmware.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SCRIPT_NAME, buildCron, checkScript, diffLines, parseCron, parseJffs, warnings } from "../../server/features/merlin-pro/tools.mjs";
import { tokenize, tokenizeLine } from "../../public/js/features/merlin-pro/highlight.js";
import feature, { formatKb } from "../../public/js/features/merlin-pro/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp } from "../helpers.mjs";

const MODEL = "RT-AX86U";
const ACTION = (t, name, body) => t.owner.post(`/api/actions/merlin-pro.${name}`, body);

test("merlin-pro: script names and content are checked before anything is reviewed", () => {
  for (const ok of ["services-start", "firewall-start", "my.sh", "a"]) assert.match(ok, SCRIPT_NAME);
  for (const no of ["", "../etc", "a/b", ".hidden", "x".repeat(49), "bad name", "a;b"]) assert.doesNotMatch(no, SCRIPT_NAME, no);
  assert.equal(checkScript("a.sh", "#!/bin/sh\necho hi"), "#!/bin/sh\necho hi\n", "one trailing line break is kept");
  assert.throws(() => checkScript("a.sh", "echo hi\r\n"), /carriage returns/);
  assert.throws(() => checkScript("a.sh", "a\0b"), /NUL/);
  assert.throws(() => checkScript("a.sh", "x".repeat(70000)), /64 KB/);
  assert.throws(() => checkScript("a.sh", "x\n".repeat(1600)), /1500 lines/);
  assert.throws(() => checkScript("../a", "x"), /Use 1 to 48/);
  assert.equal(warnings("firewall-start", "#!/bin/sh\n").length, 0);
  assert.equal(warnings("firewall-start", "echo\n").length, 1, "no shebang");
  assert.equal(warnings("random", "#!/bin/sh\n").length, 1, "not an event script");
});

test("merlin-pro: the line diff shows what is added, removed and kept", () => {
  assert.deepEqual(diffLines("a\nb\nc\n", "a\nc\nd\n").map((d) => `${d.type}:${d.text}`), ["same:a", "del:b", "same:c", "add:d"]);
  assert.deepEqual(diffLines("", "x\n").map((d) => d.type), ["add"]);
  assert.deepEqual(diffLines("x\n", "").map((d) => d.type), ["del"]);
  assert.deepEqual(diffLines("a\n", "a\n").map((d) => d.type), ["same"]);
});

test("merlin-pro: a painted schedule becomes cron entries that run at the start of each block", () => {
  const out = buildCron({ schedule: "12345@08:30-17:00,06@10:00-12:00", command: "/jffs/scripts/backup.sh", id: "backup" });
  assert.deepEqual(out.map((e) => [e.id, e.expression]), [["backup-1", "30 8 * * 1,2,3,4,5"], ["backup-2", "0 10 * * 0,6"]]);
  assert.equal(out[0].line, "cru a backup-1 '30 8 * * 1,2,3,4,5 /jffs/scripts/backup.sh'");
  assert.equal(buildCron({ schedule: "0@04:00-05:00", command: "x", id: "weekly" })[0].id, "weekly", "one slot keeps the plain name");
  assert.equal(buildCron({ schedule: "0@04:00-05:00", command: "echo 'quoted'", id: "q" })[0].line, "cru a q '0 4 * * 0 echo '\\''quoted'\\'''");
  for (const bad of [{ schedule: "", command: "x", id: "a" }, { schedule: "9@04:00-05:00", command: "x", id: "a" }, { schedule: "00@04:00-05:00", command: "x", id: "a" }, { schedule: "0@04:00-05:00", command: "", id: "a" }, { schedule: "0@04:00-05:00", command: "a\nb", id: "a" }, { schedule: "0@04:00-05:00", command: "x", id: "bad id" }])
    assert.throws(() => buildCron(bad), undefined, JSON.stringify(bad));
  assert.deepEqual(parseCron("0 4 * * * /jffs/scripts/backup.sh #nightly-backup#\nnonsense\n"), [{ expression: "0 4 * * *", command: "/jffs/scripts/backup.sh", id: "nightly-backup" }, { expression: "", command: "nonsense", id: "" }]);
  assert.deepEqual(parseJffs("Filesystem 1K-blocks Used Available Use% Mounted on\nubi:jffs2 65536 21504 44032 33% /jffs\n"), { totalKb: 65536, usedKb: 21504, freeKb: 44032, usedPct: 33 });
  assert.equal(parseJffs("Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/root 1 1 0 100% /\n"), null);
  assert.equal(formatKb(512), "512 KB");
  assert.equal(formatKb(2048), "2.0 MB");
});

test("merlin-pro: the shell highlighter marks comments, strings, variables and keywords", () => {
  const types = (line) => tokenizeLine(line).filter((t) => t.type !== "plain").map((t) => `${t.type}:${t.text}`);
  assert.deepEqual(types("#!/bin/sh"), ["shebang:#!/bin/sh"]);
  assert.deepEqual(types("if [ \"$1\" = 'x' ]; then # go"), ["keyword:if", "string:\"$1\"", "operator:=", "string:'x'", "operator:;", "keyword:then", "comment:# go"]);
  assert.deepEqual(types("echo ${HOME} $(date) $PATH 42"), ["builtin:echo", "variable:${HOME}", "variable:$(date)", "variable:$PATH", "number:42"]);
  assert.deepEqual(types("a#b"), [], "a hash inside a word is not a comment");
  assert.deepEqual(types("echo 'unclosed"), ["builtin:echo", "string:'unclosed"]);
  assert.equal(tokenize("a\nb").length, 2);
  assert.equal(tokenizeLine("echo hi").map((t) => t.text).join(""), "echo hi", "no character is lost");
});

test("merlin-pro: the screen data lists scripts with what each one is for, Entware, add-ons and JFFS", async () => {
  const t = await startApp();
  try {
    const data = (await t.owner.get("/api/domain/merlin-pro")).data;
    assert.equal(data.supported, true);
    assert.deepEqual(data.scripts.map((s) => [s.name, Boolean(s.hook)]), [["firewall-start", true], ["services-start", true]]);
    assert.deepEqual(data.cron, [{ expression: "0 4 * * *", command: "/jffs/scripts/backup.sh", id: "nightly-backup" }]);
    assert.deepEqual(data.entware.packages.map((p) => [p.name, p.version]), [["busybox", "1.36.1-1"], ["entware-opt", "227000-3"], ["nano", "7.2-1"]]);
    assert.deepEqual(data.addons.map((a) => [a.name, Boolean(a.about)]), [["YazFi", true], ["scMerlin", true], ["my-own-addon", false]]);
    assert.equal(data.amtm, true);
    assert.deepEqual(data.jffs, { totalKb: 65536, usedKb: 21504, freeKb: 44032, usedPct: 33 });
    assert.deepEqual(data.entries.map((e) => [e.id, e.control, e.value]), [["merlin-pro.jffs", "switch", "1"]]);
    assert.ok(data.related.some((e) => e.id === "merlin.scripts"));
  } finally {
    await t.stop();
  }
});

test("merlin-pro: on stock firmware everything is off and says why", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const data = (await t.owner.get("/api/domain/merlin-pro")).data;
    assert.deepEqual([data.supported, data.scripts, data.cron, data.entware.present, data.jffs], [false, [], [], false, null]);
    assert.match(data.entries[0].disabled.en, /Merlin/);
    assert.equal((await t.owner.get("/api/x/merlin-pro/scripts/firewall-start")).status, 409);
    assert.equal((await t.owner.post("/api/x/merlin-pro/scripts/review", { name: "a.sh", content: "#!/bin/sh\n" })).status, 409);
    assert.equal((await ACTION(t, "save-script", { name: "a.sh", content: "#!/bin/sh\n", token: "x", confirm: MODEL, hold: true })).status, 409);
    assert.equal((await ACTION(t, "cron-add", { schedule: "0@04:00-05:00", command: "x", id: "a", confirm: MODEL, hold: true })).status, 409);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "merlin-pro.jffs", value: "0" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("merlin-pro: a script is read, reviewed as a diff, then saved only with the review, the model and the hold button", async () => {
  const t = await startApp();
  try {
    const file = (await t.owner.get("/api/x/merlin-pro/scripts/firewall-start")).data;
    assert.match(file.content, /iptables -I FORWARD/);
    assert.equal((await t.owner.get("/api/x/merlin-pro/scripts/nothing-here")).status, 404);
    assert.equal((await t.owner.get("/api/x/merlin-pro/scripts/..%2Fpasswd")).status, 400);

    const next = `${file.content}logger "firewall rules built"\n`;
    assert.equal((await t.owner.post("/api/x/merlin-pro/scripts/review", { name: "firewall-start", content: file.content })).status, 400, "nothing would change");
    assert.equal((await t.owner.post("/api/x/merlin-pro/scripts/review", { name: "firewall-start", content: "echo\r\n" })).status, 400);
    const review = (await t.owner.post("/api/x/merlin-pro/scripts/review", { name: "firewall-start", content: next })).data;
    assert.deepEqual([review.exists, review.added, review.removed, review.warnings.length], [true, 1, 0, 0]);
    assert.deepEqual(review.diff.at(-1), { type: "add", text: 'logger "firewall rules built"' });
    assert.equal(t.router.jffs.get("firewall-start"), file.content, "reviewing wrote nothing");

    const body = { name: "firewall-start", content: next, token: review.token };
    assert.equal((await ACTION(t, "save-script", body)).data.code, "CONFIRM_MODEL");
    assert.equal((await ACTION(t, "save-script", { ...body, confirm: MODEL })).data.code, "CONFIRM_HOLD");
    assert.equal((await ACTION(t, "save-script", { ...body, token: "0".repeat(32), confirm: MODEL, hold: true })).status, 409, "an unknown review does not count");
    assert.equal((await ACTION(t, "save-script", { ...body, content: `${next}rm -rf /\n`, confirm: MODEL, hold: true })).status, 409, "text changed after the review");
    assert.equal((await ACTION(t, "save-script", { ...body, name: "services-start", confirm: MODEL, hold: true })).status, 409, "another file");
    assert.equal(t.router.jffs.get("firewall-start"), file.content, "nothing was written yet");

    const saved = await ACTION(t, "save-script", { ...body, confirm: MODEL, hold: true });
    assert.equal(saved.status, 200, saved.text);
    assert.deepEqual([saved.data.ok, saved.data.verified], [true, true]);
    assert.equal(t.router.jffs.get("firewall-start"), next);
    assert.ok(t.router.commands.some((c) => /^printf '%s' '[A-Za-z0-9+/=]+' \| base64 -d > '\/jffs\/scripts\/firewall-start\.new' && chmod 755 .* && mv /.test(c)), "written as a temporary file, then moved into place");
    assert.equal((await ACTION(t, "save-script", { ...body, confirm: MODEL, hold: true })).status, 409, "a review is good for one save only");
  } finally {
    await t.stop();
  }
});

test("merlin-pro: a review belongs to the person who asked for it", async () => {
  const t = await startApp();
  try {
    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "operator password 1", role: "operator" });
    const alex = t.client();
    await alex.signIn("alex", "operator password 1");
    const review = (await alex.post("/api/x/merlin-pro/scripts/review", { name: "new-one.sh", content: "#!/bin/sh\necho hi\n" })).data;
    assert.equal(review.exists, false);
    const body = { name: "new-one.sh", content: "#!/bin/sh\necho hi\n", token: review.token, confirm: MODEL, hold: true };
    assert.equal((await ACTION(t, "save-script", body)).status, 409, "Pat cannot spend Alex's review");
    assert.equal((await alex.post("/api/actions/merlin-pro.save-script", body)).status, 200);
    assert.equal(t.router.jffs.get("new-one.sh"), "#!/bin/sh\necho hi\n");
  } finally {
    await t.stop();
  }
});

test("merlin-pro: cron jobs are built, added with both confirmations and deleted with the hold button", async () => {
  const t = await startApp();
  try {
    const build = await t.owner.post("/api/x/merlin-pro/cron/build", { schedule: "06@10:00-12:00", command: "/jffs/scripts/tidy.sh", id: "tidy" });
    assert.equal(build.status, 200, build.text);
    assert.deepEqual(build.data.entries.map((e) => e.expression), ["0 10 * * 0,6"]);
    assert.equal((await t.owner.post("/api/x/merlin-pro/cron/build", { schedule: "x", command: "a", id: "tidy" })).status, 400);
    assert.ok(!t.router.commands.some((c) => c.startsWith("cru a")), "building adds nothing");

    const body = { schedule: "06@10:00-12:00", command: "/jffs/scripts/tidy.sh", id: "tidy" };
    assert.equal((await ACTION(t, "cron-add", body)).data.code, "CONFIRM_MODEL");
    assert.equal((await ACTION(t, "cron-add", { ...body, confirm: MODEL })).data.code, "CONFIRM_HOLD");
    const added = await ACTION(t, "cron-add", { ...body, confirm: MODEL, hold: true });
    assert.equal(added.status, 200, added.text);
    assert.deepEqual(added.data.added, ["tidy"]);
    assert.match(added.data.persistLines[0], /^cru a tidy '0 10 \* \* 0,6 \/jffs\/scripts\/tidy\.sh'$/);
    assert.deepEqual((await t.owner.get("/api/domain/merlin-pro")).data.cron.map((j) => j.id), ["nightly-backup", "tidy"]);

    assert.equal((await ACTION(t, "cron-delete", { id: "tidy" })).status, 403, "deleting needs the hold button");
    assert.equal((await ACTION(t, "cron-delete", { id: "nothing", hold: true })).status, 404);
    assert.equal((await ACTION(t, "cron-delete", { id: "bad id", hold: true })).status, 400);
    assert.equal((await ACTION(t, "cron-delete", { id: "tidy", hold: true })).status, 200);
    assert.deepEqual((await t.owner.get("/api/domain/merlin-pro")).data.cron.map((j) => j.id), ["nightly-backup"]);
  } finally {
    await t.stop();
  }
});

test("merlin-pro: the browser module is well formed and listed in the manifest", async () => {
  assert.equal(checkFeatureModule(feature, "merlin-pro"), null);
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/merlin-pro/index.js") && manifest.styles.includes("/js/features/merlin-pro/style.css"));
    assert.equal((await fetch(`${t.base}/js/features/merlin-pro/highlight.js`)).status, 200);
  } finally {
    await t.stop();
  }
});
