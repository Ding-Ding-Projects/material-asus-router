// Tests for network-services: the settings, the disk readers, the health and
// check routes (read only), role rules, and that its module is well formed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { healthTone, sizeText } from "../../public/js/features/network-services/index.js";
import { missingSettings, parseExports, parseMounts, parsePartitions, parseSmart } from "../../server/features/network-services/disks.mjs";
import { startApp } from "../helpers.mjs";

test("network-services: readers turn router text into drives, mounts, SMART facts and exports", () => {
  const parts = parsePartitions("major minor  #blocks  name\n\n   8        0  1000 sda\n   8        1  900 sda1\n  31        0  2 mtdblock0\n");
  assert.deepEqual(parts, [{ name: "sda", sizeKb: 1000, partitions: [{ name: "sda1", sizeKb: 900 }] }]);
  assert.equal(parseMounts("/dev/sda1 /tmp/mnt/usb1 ext4 rw 0 0\nrootfs / rootfs rw 0 0\n").get("sda1"), "/tmp/mnt/usb1");
  const smart = parseSmart("SMART overall-health self-assessment test result: FAILED!\n  5 Reallocated_Sector_Ct 0x0033 090 090 010 Pre-fail Always - 48\n197 Current_Pending_Sector 0x0032 100 100 000 Old_age Always - 3\n194 Temperature_Celsius 0x0022 064 050 000 Old_age Always - 58 (Min/Max 20/60)\n");
  assert.deepEqual([smart.health, smart.reallocated, smart.pending, smart.temperatureC], ["failed", 48, 3, 58]);
  assert.equal(smart.warnings.length, 4);
  assert.equal(parseSmart("nothing useful").health, "unknown");
  assert.deepEqual(parseExports("</tmp/mnt/usb1/Family>198.51.100.0/24>rw"), [{ folder: "/tmp/mnt/usb1/Family", client: "198.51.100.0/24", options: "rw" }]);
  assert.deepEqual(parseExports(""), []);
});

test("network-services: a setting the router does not have is locked with the exact reason", () => {
  const entries = [{ key: "wsdd_enable" }, { key: "present" }, { key: "gone", disabled: { en: "Needs Merlin", yue: "x" } }];
  const out = missingSettings(entries, new Map([["present", "1"]]));
  assert.equal(out[0].disabled.en, "This router does not have the setting wsdd_enable");
  assert.equal(out[1].disabled, undefined);
  assert.equal(out[2].disabled.en, "Needs Merlin", "an existing lock is kept");
});

test("network-services: settings read, write through the engine and the domain shows drives", async () => {
  const t = await startApp();
  try {
    const catalog = (await t.owner.get("/api/catalog")).data;
    const mine = catalog.entries.filter((e) => e.feature === "network-services");
    assert.deepEqual(mine.map((e) => e.id).sort(), ["network-services.mdns.enable", "network-services.nfs.enable", "network-services.nfs.exports", "network-services.print.lprd", "network-services.snmp.enable", "network-services.usb.idle", "network-services.wsdd.enable"]);
    assert.equal(mine.find((e) => e.id.endsWith("nfs.exports")).readOnly, true);
    const domain = (await t.owner.get("/api/domain/network-services")).data;
    assert.deepEqual(domain.disks.map((d) => d.name), ["sda", "sdb"]);
    assert.equal(domain.exports[0].folder, "/tmp/mnt/usb1/Family");
    assert.equal(domain.entries.every((e) => !e.disabled), true, "the pretend router has every setting");
    delete t.router.nvram.lprd_enable;
    t.app.session.invalidate();
    const again = (await t.owner.get("/api/domain/network-services")).data;
    assert.equal(again.entries.find((e) => e.key === "lprd_enable").disabled.en, "This router does not have the setting lprd_enable");

    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "network-services.usb.idle", value: "1800" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    assert.equal(t.router.nvram.usb_idle_timeout, "1800");
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "network-services.usb.idle", value: "5" }] })).status, 400);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "network-services.nfs.exports", value: "<x>y>z" }] })).status, 400, "exports are read only");
  } finally {
    await t.stop();
  }
});

test("network-services: health reads SMART, and a check only runs on an ejected drive and never repairs", async () => {
  const t = await startApp();
  try {
    const good = (await t.owner.get("/api/x/network-services/health/sda")).data;
    assert.deepEqual([good.available, good.health, good.temperatureC, good.powerOnHours], [true, "passed", 36, 2904]);
    const failing = (await t.owner.get("/api/x/network-services/health/sdb")).data;
    assert.equal(failing.health, "failed");
    assert.equal((await t.owner.get("/api/x/network-services/health/sdz")).status, 404);
    assert.equal((await t.owner.get("/api/x/network-services/health/sda;reboot")).status, 400);

    // sda1 is mounted (a drive is plugged into USB 1), so it cannot be checked.
    const busy = await t.owner.post("/api/x/network-services/check", { partition: "sda1" });
    assert.equal(busy.status, 409);
    const ok = await t.owner.post("/api/x/network-services/check", { partition: "sdb1" });
    assert.equal(ok.status, 200, ok.text);
    assert.deepEqual([ok.data.available, ok.data.clean, ok.data.repaired], [true, true, false]);
    assert.ok(t.router.commands.includes("fsck -n '/dev/sdb1'"), "only the read-only check was run");
    assert.ok(!t.router.commands.some((c) => /mkfs|^dd |smartctl -t|^fsck (?!-n)/.test(c)), "nothing that changes a disk was run");
    assert.equal((await t.owner.post("/api/x/network-services/check", { partition: "sdb1; reboot" })).status, 400);

    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/x/network-services/health/sda")).status, 200);
    assert.equal((await guest.post("/api/x/network-services/check", { partition: "sdb1" })).status, 403);
    assert.equal((await t.client().get("/api/x/network-services/health/sda")).status, 401);
  } finally {
    await t.stop();
  }
});

test("network-services: on stock firmware the Merlin-only settings are locked", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const entries = (await t.owner.get("/api/domain/network-services")).data.entries;
    for (const key of ["nfsd_enable", "snmpd_enable", "nfsd_exportlist"]) assert.match(entries.find((e) => e.key === key).disabled.en, /Merlin/);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "network-services.nfs.enable", value: "1" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("network-services: the browser module is well formed and its helpers are honest", () => {
  assert.equal(checkFeatureModule(feature, "network-services"), null);
  assert.deepEqual([sizeText(244190646), sizeText(2000)], ["244.2 GB", "2 MB"]);
  assert.equal(healthTone({ available: false }).word, "unavailable");
  assert.equal(healthTone({ available: true, health: "passed", pending: 0, reallocated: 0 }).tone, "good");
  assert.equal(healthTone({ available: true, health: "passed", pending: 2, reallocated: 0 }).tone, "warn");
  assert.equal(healthTone({ available: true, health: "failed" }).word, "failing");
});
