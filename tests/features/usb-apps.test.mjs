// usb-apps: drives and usage, safe eject, sharing accounts, shares with
// permissions, media folders and the Time Machine slider. Every catalogue
// entry is also proved by tests/real-controls.test.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDf, readShares } from "../../server/features/usb-apps/index.mjs";
import feature, { formatSize, passwordStrength } from "../../public/js/features/usb-apps/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp, waitFor } from "../helpers.mjs";

async function applyPreview(t, preview) {
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.id });
  assert.equal(applied.status, 200, applied.text);
  return waitFor(async () => {
    const record = (await t.owner.get(`/api/changes/history/${applied.data.id}`)).data;
    return record.status !== "guarded" && record.status !== "applying" ? record : null;
  });
}
const DELETE = (t, url) => t.owner.request("DELETE", url);

test("usb-apps: the screen data shows drives with usage, accounts without passwords, shares and media folders", async () => {
  const t = await startApp();
  try {
    const data = (await t.owner.get("/api/domain/usb-apps")).data;
    assert.deepEqual(data.drives.map((d) => [d.port, d.manufacturer, d.product]), [[1, "SanDisk", "Ultra Fit"]]);
    assert.deepEqual(data.mounts.map((m) => [m.mount, m.usedPct, m.freeKb]), [["/tmp/mnt/usb1", 39, 148376224]]);
    assert.deepEqual(data.accounts, [{ name: "Pat" }, { name: "Alex" }], "no password leaves the server");
    assert.ok(!JSON.stringify(data).includes("harbour-pass"));
    assert.deepEqual(data.shares, [{ index: 0, name: "Family", path: "/tmp/mnt/usb1/Family", read: ["Pat", "Alex"], write: ["Pat"] }]);
    assert.deepEqual(data.mediaFolders, ["/tmp/mnt/usb1/Music"]);
    assert.ok(data.related.some((e) => e.id === "usb.samba"), "the stock sharing switches sit beside the new settings");
    const byId = Object.fromEntries(data.entries.map((e) => [e.id, e]));
    assert.equal(byId["usb-apps.tm.size"].control, "slider");
    assert.equal(byId["usb-apps.accounts"].secret, true);
    assert.equal(byId["usb-apps.accounts"].value, "");
    assert.equal(byId["usb-apps.accounts"].masked, true);
    assert.ok(data.entries.every((e) => e.disabled === null), "this router has USB");
  } finally {
    await t.stop();
  }
  assert.equal(parseDf("Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/root 100 100 0 100% /\n/dev/sdb1 2048 1024 1024 50% /tmp/mnt/Photos disk").length, 1);
  assert.deepEqual(readShares(new Map([["sh_num", "2"], ["sh_name0", "A"], ["sh_path0", "/tmp/mnt/x"], ["sh_rright0", ""], ["sh_wright0", ""]])).map((s) => s.name), ["A"]);
  assert.equal(formatSize(1536), "1.5 MB");
  assert.deepEqual([passwordStrength("short"), passwordStrength("longenough1"), passwordStrength("Harbour-tea-2026")], [0, 1, 4]);
});

test("usb-apps: the Time Machine slider and the settings go through the change engine", async () => {
  const t = await startApp();
  try {
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "usb-apps.tm.size", value: "500" }, { id: "usb-apps.samba.mode", value: "1" }] });
    assert.equal(preview.status, 200, preview.text);
    assert.ok(preview.data.restarts.includes("restart_timemachine") && preview.data.restarts.includes("restart_nasapps"));
    assert.equal((await applyPreview(t, preview.data)).status, "applied");
    assert.deepEqual([t.router.nvram.tm_vol_size, t.router.nvram.st_samba_mode], ["500", "1"]);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "usb-apps.tm.size", value: "9000" }] })).status, 400);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "usb-apps.samba.mode", value: "7" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("usb-apps: folders are listed only inside the USB mount and never outside it", async () => {
  const t = await startApp();
  try {
    assert.deepEqual((await t.owner.get("/api/x/usb-apps/folders")).data, { path: "/tmp/mnt", folders: ["usb1"] });
    assert.deepEqual((await t.owner.get("/api/x/usb-apps/folders?path=%2Ftmp%2Fmnt%2Fusb1")).data.folders, ["Family", "Music", "Videos"]);
    for (const path of ["/etc", "/tmp/mnt/../../etc", "/tmp/mnt/usb1;reboot", "/tmp/mnt/usb1/$(id)"]) assert.equal((await t.owner.get(`/api/x/usb-apps/folders?path=${encodeURIComponent(path)}`)).status, 400, path);
    assert.equal((await t.owner.get("/api/x/usb-apps/folders?path=%2Ftmp%2Fmnt%2Fnothing")).status, 404);
    assert.ok(t.router.commands.every((c) => !/reboot|\$\(/.test(c)), "nothing odd reached the router");
  } finally {
    await t.stop();
  }
});

test("usb-apps: accounts are added, changed and removed, and passwords stay masked", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/x/usb-apps/accounts", { name: "bad name!", password: "long-enough-1" })).status, 400);
    assert.equal((await t.owner.post("/api/x/usb-apps/accounts", { name: "Sam", password: "short" })).status, 400);
    assert.equal((await t.owner.post("/api/x/usb-apps/accounts", { name: "pat", password: "long-enough-1" })).status, 409, "names are not case sensitive");

    const add = await t.owner.post("/api/x/usb-apps/accounts", { name: "Sam", password: "tea-and-egg-tarts" });
    assert.equal(add.status, 200, add.text);
    assert.ok(add.data.items[0].secret && !JSON.stringify(add.data).includes("tea-and-egg"), "the preview masks the passwords");
    assert.ok(add.data.restarts.includes("restart_nasapps"));
    assert.equal((await applyPreview(t, add.data)).status, "applied");
    assert.equal(t.router.nvram.acc_list, "<Pat>harbour-pass1<Alex>harbour-pass2<Sam>tea-and-egg-tarts");

    const change = await t.owner.request("PATCH", "/api/x/usb-apps/accounts/Sam", { password: "new-password-77" });
    assert.equal((await applyPreview(t, change.data)).status, "applied");
    assert.match(t.router.nvram.acc_list, /<Sam>new-password-77$/);
    assert.equal((await t.owner.request("PATCH", "/api/x/usb-apps/accounts/Nobody", { password: "new-password-77" })).status, 404);

    // Removing an account also takes it off every share.
    const gone = await DELETE(t, "/api/x/usb-apps/accounts/Alex");
    assert.equal(gone.status, 200, gone.text);
    assert.equal((await applyPreview(t, gone.data)).status, "applied");
    assert.equal(t.router.nvram.acc_list, "<Pat>harbour-pass1<Sam>new-password-77");
    assert.equal(t.router.nvram.sh_rright0, "Pat");
  } finally {
    await t.stop();
  }
});

test("usb-apps: shares are added, edited with permissions and removed without leaving stale settings", async () => {
  const t = await startApp();
  try {
    const share = { name: "Photos", path: "/tmp/mnt/usb1/Videos", read: ["Alex"], write: ["Pat"] };
    for (const bad of [{ ...share, name: "" }, { ...share, path: "/etc" }, { ...share, path: "/tmp/mnt/usb1/../x" }, { ...share, read: ["Ghost"] }, { ...share, name: "family" }])
      assert.equal((await t.owner.post("/api/x/usb-apps/shares", bad)).status, bad.name === "family" ? 409 : 400, JSON.stringify(bad));

    const add = await t.owner.post("/api/x/usb-apps/shares", share);
    assert.equal(add.status, 200, add.text);
    assert.equal((await applyPreview(t, add.data)).status, "applied");
    assert.deepEqual([t.router.nvram.sh_num, t.router.nvram.sh_name1, t.router.nvram.sh_path1, t.router.nvram.sh_rright1, t.router.nvram.sh_wright1], ["2", "Photos", "/tmp/mnt/usb1/Videos", "Alex>Pat", "Pat"], "a writer can always read too");

    const edit = await t.owner.post("/api/x/usb-apps/shares", { ...share, index: 1, name: "Pictures", read: [], write: [] });
    assert.equal((await applyPreview(t, edit.data)).status, "applied");
    assert.equal(t.router.nvram.sh_name1, "Pictures");

    const remove = await DELETE(t, "/api/x/usb-apps/shares/0");
    assert.equal((await applyPreview(t, remove.data)).status, "applied");
    assert.deepEqual([t.router.nvram.sh_num, t.router.nvram.sh_name0, t.router.nvram.sh_name1], ["1", "Pictures", undefined], "the list closes up and the last slot is unset");
    assert.equal((await DELETE(t, "/api/x/usb-apps/shares/9")).status, 404);
  } finally {
    await t.stop();
  }
});

test("usb-apps: media folders are listed, added and removed", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/x/usb-apps/media-folders", { path: "/home" })).status, 400);
    assert.equal((await t.owner.post("/api/x/usb-apps/media-folders", { path: "/tmp/mnt/usb1/Music" })).status, 409);
    const add = await t.owner.post("/api/x/usb-apps/media-folders", { path: "/tmp/mnt/usb1/Videos/" });
    assert.equal((await applyPreview(t, add.data)).status, "applied");
    assert.deepEqual([t.router.nvram.dms_dir_x, t.router.nvram.dms_dir_type_x], ["</tmp/mnt/usb1/Music</tmp/mnt/usb1/Videos", "<7<7"]);
    const gone = await DELETE(t, "/api/x/usb-apps/media-folders/0");
    assert.equal((await applyPreview(t, gone.data)).status, "applied");
    assert.equal(t.router.nvram.dms_dir_x, "</tmp/mnt/usb1/Videos");
    assert.equal((await DELETE(t, "/api/x/usb-apps/media-folders/5")).status, 404);
  } finally {
    await t.stop();
  }
});

test("usb-apps: safe eject needs the hold button, checks the port and unmounts the drive", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/actions/usb-apps.eject", { port: 1 })).status, 403, "no hold, no eject");
    assert.equal((await t.owner.post("/api/actions/usb-apps.eject", { port: 9, hold: true })).status, 400);
    assert.equal((await t.owner.post("/api/actions/usb-apps.eject", { port: 2, hold: true })).status, 404);
    assert.ok(!t.router.commands.some((c) => c.startsWith("ejusb")));
    const out = await t.owner.post("/api/actions/usb-apps.eject", { port: 1, hold: true });
    assert.equal(out.status, 200, out.text);
    assert.deepEqual([out.data.ok, out.data.port], [true, 1]);
    assert.ok(t.router.commands.includes("ejusb 1"));
    const after = (await t.owner.get("/api/domain/usb-apps")).data;
    assert.deepEqual([after.drives.length, after.mounts.length], [0, 0], "the drive is gone from the screen");
  } finally {
    await t.stop();
  }
});

test("usb-apps: lists need write access and a session", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/x/usb-apps/folders")).status, 401);
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/x/usb-apps/folders")).status, 200);
    assert.equal((await guest.post("/api/x/usb-apps/accounts", { name: "Sam", password: "tea-and-egg-tarts" })).status, 403);
    assert.equal((await guest.post("/api/actions/usb-apps.eject", { port: 1, hold: true })).status, 403);
  } finally {
    await t.stop();
  }
});

test("usb-apps: the browser module is well formed and listed in the manifest", async () => {
  assert.equal(checkFeatureModule(feature, "usb-apps"), null);
  const t = await startApp();
  try {
    assert.ok((await t.owner.get("/api/features/manifest")).data.modules.includes("/js/features/usb-apps/index.js"));
  } finally {
    await t.stop();
  }
});
