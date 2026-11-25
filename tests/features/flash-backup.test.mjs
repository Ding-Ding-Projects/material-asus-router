// Flash backup is read-only: it copies the boot loader and nvram partitions to a
// USB drive, proves the copy matches the flash, and has no path that writes to
// flash.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/flash-backup/index.js";
import { OFFERED, parseMtd } from "../../server/features/flash-backup/index.mjs";
import { flash } from "../../server/features/flash-backup/fake.mjs";
import { startApp } from "../helpers.mjs";

const base = "/api/x/flash-backup";
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
const copy = (client, body) => client.post(`${base}/copy`, { ack: true, ...body });

test("flash-backup: the browser module has the shape the registry needs", () => {
  assert.equal(checkFeatureModule(feature, "flash-backup"), null);
});

test("flash-backup: partitions and drives are read from the router, and only the boot loader and nvram are offered", async () => {
  const t = await startApp();
  try {
    const data = (await t.owner.get("/api/domain/flash-backup")).data;
    assert.equal(data.readOnly, true);
    assert.deepEqual(data.partitions.map((p) => [p.index, p.name, p.offered]), [[0, "boot", true], [1, "nvram", true], [2, "image", false], [3, "misc1", false], [4, "rootfs_update", false]]);
    assert.equal(data.partitions[0].size, 0x200000);
    assert.equal(data.targets.length, 1);
    assert.equal(data.targets[0].mount, "/tmp/mnt/usb1");
    assert.equal(data.targets[0].freeKb, 13630464);
    assert.deepEqual(data.existing, []);
    assert.deepEqual(parseMtd('mtd0: 00100000 00020000 "bootloader"\njunk\n').map((p) => [p.name, p.offered]), [["bootloader", true]]);
    for (const name of ["boot", "bootloader", "cfe", "pmon", "u-boot", "uboot", "nvram", "nvram2", "NVRAM"]) assert.match(name, OFFERED);
    for (const name of ["rootfs", "image", "factory", "linux", "jffs2", "misc1"]) assert.doesNotMatch(name, OFFERED);
  } finally {
    await t.stop();
  }
});

test("flash-backup: a partition is copied with live output, checked against the flash, and listed afterwards", async () => {
  const t = await startApp();
  try {
    const started = await copy(t.owner, { partition: 1, target: "/tmp/mnt/usb1" });
    assert.equal(started.status, 200, started.text);
    assert.match(started.data.file, /^\/tmp\/mnt\/usb1\/router-flash-backup\/mtd1-nvram-\d{8}-\d{6}\.bin$/);
    assert.equal(started.data.device, "/dev/mtdblock1");
    const out = await follow(t.owner, started.data.job);
    assert.equal(out.status, "done", out.output);
    assert.match(out.output, /16\+0 records out/);
    assert.match(out.output, /Checked: the copy and the flash have the same SHA-256/);
    assert.equal(flash(t.router).files.size, 1);

    const data = (await t.owner.get("/api/domain/flash-backup")).data;
    assert.equal(data.existing.length, 1);
    assert.equal(data.existing[0].size, 0x100000);
    assert.equal(data.existing[0].mount, "/tmp/mnt/usb1");
    const note = (await t.owner.get("/api/changes/history")).data.items.find((h) => h.items[0].key === "flash-backup-action");
    assert.match(note.items[0].new, /\(done, checked\)$/);
  } finally {
    await t.stop();
  }
});

test("flash-backup: a copy that does not match the flash is reported as failed, never as a good backup", async () => {
  const t = await startApp();
  try {
    flash(t.router).corrupt = true;
    const started = await copy(t.owner, { partition: 0, target: "/tmp/mnt/usb1" });
    const out = await follow(t.owner, started.data.job);
    assert.equal(out.status, "failed");
    assert.match(out.output, /does NOT match the flash/);
    const note = (await t.owner.get("/api/changes/history")).data.items.find((h) => h.items[0].key === "flash-backup-action");
    assert.doesNotMatch(note.items[0].new, /checked\)/);
  } finally {
    await t.stop();
  }
});

test("flash-backup: no command can ever write to flash", async () => {
  const t = await startApp();
  try {
    const before = t.router.commands.length;
    for (const body of [{ partition: 0 }, { partition: 1 }]) await follow(t.owner, (await copy(t.owner, { target: "/tmp/mnt/usb1", ...body })).data.job);
    // Things that must be refused, whatever is asked.
    for (const body of [{ partition: 2 }, { partition: 3 }, { partition: 4 }, { partition: 99 }, { partition: "0; reboot" }, { partition: -1 }])
      assert.ok([403, 404].includes((await copy(t.owner, { target: "/tmp/mnt/usb1", ...body })).status), JSON.stringify(body));
    for (const target of ["/dev/mtdblock1", "/jffs", "/tmp/mnt/usb1; reboot", "/tmp/mnt/other", ""])
      assert.ok([400, 404].includes((await copy(t.owner, { partition: 1, target })).status), target);
    const sent = t.router.commands.slice(before);
    assert.ok(sent.length >= 8);
    for (const c of sent) {
      assert.doesNotMatch(c, /of=\/dev|>\s*\/dev\/|mtd-write|hnd-write|flash_erase|mtd-erase|nandwrite|flashcp|nvram (set|commit|unset)|reboot/i, c);
      if (c.startsWith("dd ")) {
        assert.match(c, /^dd if=\/dev\/mtdblock[01] of='\/tmp\/mnt\/usb1\/router-flash-backup\/mtd[01]-[a-z0-9-]+\.bin' bs=64k$/, "dd only reads a partition and writes a file on the drive");
      }
    }
  } finally {
    await t.stop();
  }
});

test("flash-backup: only the owner can copy, a confirmation is needed, and a full drive is refused", async () => {
  const t = await startApp();
  try {
    await t.owner.post("/api/users", { name: "op", username: "op", password: "a long enough password", role: "operator" });
    await t.owner.post("/api/users", { name: "vw", username: "vw", password: "a long enough password", role: "viewer" });
    const op = t.client();
    await op.signIn("op", "a long enough password");
    const vw = t.client();
    await vw.signIn("vw", "a long enough password");
    assert.equal((await copy(op, { partition: 1, target: "/tmp/mnt/usb1" })).data.code, "OWNER_ONLY");
    assert.equal((await copy(vw, { partition: 1, target: "/tmp/mnt/usb1" })).status, 403);
    assert.equal((await op.get("/api/domain/flash-backup")).status, 200, "an operator can see the list");
    assert.equal((await t.owner.post(`${base}/copy`, { partition: 1, target: "/tmp/mnt/usb1" })).data.code, "CONFIRM");
    assert.equal(t.router.commands.some((c) => c.startsWith("dd ")), false, "nothing ran");
    // A drive with almost no space left cannot take the copy.
    const real = t.router.execute.bind(t.router);
    t.router.execute = (command) => (command.startsWith("df -k ") ? { stdout: "Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/sda1 1000 900 100 90% /tmp/mnt/usb1\n", code: 0 } : real(command));
    assert.equal((await copy(t.owner, { partition: 0, target: "/tmp/mnt/usb1" })).data.code, "NO_SPACE");
    t.router.execute = real;
  } finally {
    await t.stop();
  }
});

test("flash-backup: the folder obeys the project's wording and address rules", async () => {
  const files = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else files.push(full);
    }
  };
  await walk(path.join(ROOT, "server", "features", "flash-backup"));
  await walk(path.join(ROOT, "public", "js", "features", "flash-backup"));
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, new RegExp(`\\b${"c"}${"at"}\\b`, "i"), `${file}: reserved word found`);
    assert.doesNotMatch(text, /\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/, `${file}: private-range address`);
    assert.doesNotMatch(text, /\b(admin|root|docker)@[0-9a-z]/i, `${file}: user@address`);
  }
});
