// The virtual disk manager only runs PowerShell on Windows with the desktop
// app on. These tests replace PowerShell with a recorder, so no disk is ever
// touched, and prove the scripts, the refusals and the unavailable state.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/virtual-disk-manager/index.js";
import { GB, LIMITS, OPERATIONS, TB, buildScript, diskPath, encodeCommand, makeManager, setManager, sizeBytes } from "../../server/features/virtual-disk-manager/vhd.mjs";
import { startApp } from "../helpers.mjs";

const recorder = (reply = { code: 0, stdout: "", stderr: "" }) => {
  const scripts = [];
  return { scripts, run: async (script) => (scripts.push(script), typeof reply === "function" ? reply(script) : reply) };
};

test("virtual disks: paths are full Windows paths with an allowed extension and nothing that can break out", () => {
  assert.equal(diskPath("D:\\Disks\\data.vhdx"), "D:\\Disks\\data.vhdx");
  assert.equal(diskPath("\\\\nas\\share\\a.VHD"), "\\\\nas\\share\\a.VHD");
  for (const wrong of ["data.vhdx", "D:/x.vhdx", "D:\\x.txt", "D:\\a'; Remove-Item C:\\ ; '.vhdx", "D:\\a$(x).vhdx", "D:\\a`b.vhdx", "D:\\..\\x.vhdx", "D:\\a|b.vhdx", "D:\\a&b.vhdx", "D:\\x\n.vhdx", `D:\\${"a".repeat(250)}.vhdx`, "", null]) assert.throws(() => diskPath(wrong), (e) => e.status === 400, JSON.stringify(wrong));
  assert.throws(() => diskPath("D:\\x.vhd", ["iso"]), /\.iso/);
});

test("virtual disks: sizes respect the format limits", () => {
  assert.equal(sizeBytes(20, "GB", "vhdx"), 20 * GB);
  assert.equal(sizeBytes(2040, "GB", "vhd"), 2040 * GB);
  assert.throws(() => sizeBytes(2041, "GB", "vhd"), /at most 2040 GB/);
  assert.equal(sizeBytes(64, "TB", "vhdx"), 64 * TB);
  assert.throws(() => sizeBytes(65, "TB", "vhdx"), /at most 64 TB/);
  assert.throws(() => sizeBytes(1, "MB", "vhdx"), /3 MB/);
  assert.throws(() => sizeBytes(0, "GB"), /above zero/);
  assert.throws(() => sizeBytes("x", "GB"), /number/);
  assert.throws(() => sizeBytes(1, "PB"), /MB, GB or TB/);
  assert.equal(LIMITS.vhd, 2040 * GB);
});

test("virtual disks: every operation builds a script from the right cmdlet, and creation never overwrites", () => {
  const cmdlets = { list: "Get-Disk", info: "Get-VHD", create: "New-VHD", "create-differencing": "-Differencing", attach: "Mount-VHD", detach: "Dismount-VHD", grow: "Resize-VHD", shrink: "Resize-VHD", compact: "Optimize-VHD", convert: "Convert-VHD", "attach-iso": "Mount-DiskImage", "detach-iso": "Dismount-DiskImage" };
  assert.deepEqual(Object.keys(OPERATIONS).sort(), Object.keys(cmdlets).sort());
  const input = { path: "D:\\a.vhdx", size: 10, unit: "GB", parent: "D:\\p.vhdx", destination: "D:\\a.vhd", type: "dynamic" };
  for (const [op, cmdlet] of Object.entries(cmdlets)) {
    const script = buildScript(op, op.includes("iso") ? { path: "D:\\a.iso" } : op === "create-differencing" ? { ...input, path: "D:\\child.vhdx" } : input);
    assert.ok(script.includes(cmdlet), `${op} uses ${cmdlet}`);
    assert.ok(script.startsWith("$ErrorActionPreference = 'Stop'"), `${op} stops on the first error`);
  }
  const create = buildScript("create", input);
  assert.match(create, /if \(Test-Path -LiteralPath 'D:\\a\.vhdx'\) \{ throw 'A file already exists/, "the existence check comes before New-VHD");
  assert.ok(create.indexOf("Test-Path") < create.indexOf("New-VHD"));
  assert.match(create, new RegExp(`-SizeBytes ${10 * GB} -Dynamic`));
  assert.match(buildScript("create", { ...input, type: "fixed" }), /-Fixed/);
  assert.throws(() => buildScript("create", { ...input, path: "D:\\a.vhds", type: "fixed" }), /always dynamic/);
  assert.throws(() => buildScript("create", { ...input, path: "D:\\a.vhd", size: 3000 }), /2040 GB/);
  assert.match(buildScript("convert", input), /Test-Path -LiteralPath 'D:\\a\.vhd'\) \{ throw[^\n]*\n.*Convert-VHD/s, "a convert never overwrites its destination either");
  assert.throws(() => buildScript("convert", { ...input, destination: "D:\\b.vhdx" }), /different extension/);
  assert.throws(() => buildScript("create-differencing", { ...input, path: "D:\\x.vhd" }), /same format/);
  assert.throws(() => buildScript("create-differencing", { ...input, path: input.parent }), /own parent/);
  assert.match(buildScript("attach", { path: "D:\\a.vhdx", readOnly: true }), /Mount-VHD -Path 'D:\\a\.vhdx' -ReadOnly/);
  assert.match(buildScript("grow", input), /throw 'The new size must be larger/);
  assert.match(buildScript("shrink", input), /throw 'The new size must be smaller/);
  assert.match(buildScript("shrink", { path: "D:\\a.vhdx", toMinimum: true }), /-ToMinimumSize/);
  assert.throws(() => buildScript("shrink", { path: "D:\\a.vhd", size: 1, unit: "GB" }), /\.vhdx/, "only VHDX can shrink");
  assert.throws(() => buildScript("compact", { path: "D:\\a.iso" }), /\.vhd/);
  assert.throws(() => buildScript("explode", {}), /no operation/);
  assert.equal(Buffer.from(encodeCommand("Get-Date"), "base64").toString("utf16le"), "Get-Date");
});

test("virtual disks: where it is not allowed, it says it needs the Windows desktop app and runs nothing", async () => {
  const r = recorder();
  const linux = makeManager({ platform: "linux", desktop: true, run: r.run });
  assert.equal(linux.available, false);
  assert.match(linux.reason.en, /needs the Windows desktop app.*linux/);
  assert.ok(linux.reason.yue.includes("Windows"));
  await assert.rejects(() => linux.run("create", { path: "D:\\a.vhdx", size: 1 }), (e) => e.status === 409);
  const web = makeManager({ platform: "win32", desktop: false, run: r.run });
  assert.equal(web.available, false);
  assert.match(web.reason.en, /web app does not manage disks/);
  await assert.rejects(() => web.run("list"), /web app/);
  assert.deepEqual(r.scripts, [], "no script ran");
});

test("virtual disks: a run returns the route, the equivalent script and the parsed output; failures explain what to do", async () => {
  const ok = recorder({ code: 0, stdout: '{"Path":"D:\\\\a.vhdx","Size":10737418240}', stderr: "" });
  const manager = makeManager({ platform: "win32", desktop: true, run: ok.run });
  const result = await manager.run("create", { path: "D:\\a.vhdx", size: 10, unit: "GB" });
  assert.equal(result.route, "New-VHD (Hyper-V module)");
  assert.equal(result.output.Size, 10 * GB);
  assert.equal(result.equivalent, ok.scripts[0]);
  const noAdmin = makeManager({ platform: "win32", desktop: true, run: async () => ({ code: 1, stdout: "", stderr: "Access is denied. Administrator privilege required." }) });
  await assert.rejects(() => noAdmin.run("attach", { path: "D:\\a.vhdx" }), (e) => /administrator/i.test(e.hint) && /never approves it for you/.test(e.hint) && e.status === 422);
  const noHyperV = makeManager({ platform: "win32", desktop: true, run: async () => ({ code: 1, stdout: "", stderr: "The term 'New-VHD' is not recognized as the name of a cmdlet" }) });
  await assert.rejects(() => noHyperV.run("create", { path: "D:\\a.vhdx", size: 1 }), (e) => /Hyper-V/.test(e.hint));
  const exists = makeManager({ platform: "win32", desktop: true, run: async () => ({ code: 1, stdout: "", stderr: "A file already exists at that path. Nothing was changed." }) });
  await assert.rejects(() => exists.run("create", { path: "D:\\a.vhdx", size: 1 }), /already exists/);
});

test("virtual disks: the web routes and confirmed actions work, and a hold is required", async () => {
  const t = await startApp();
  const r = recorder({ code: 0, stdout: "[]", stderr: "" });
  try {
    // Out of the box (no desktop app) the feature says so.
    const status = (await t.owner.get("/api/x/virtual-disk-manager/status")).data;
    assert.equal(status.available, false);
    assert.ok(status.reason.en && status.reason.yue);
    assert.equal(status.operations.length, Object.keys(OPERATIONS).length);
    const refused = await t.owner.post("/api/actions/virtual-disk-manager.create", { path: "D:\\a.vhdx", size: 1, hold: true });
    assert.equal(refused.status, 409, refused.text);

    setManager(makeManager({ platform: "win32", desktop: true, run: r.run }));
    assert.equal((await t.owner.get("/api/x/virtual-disk-manager/status")).data.available, true);
    assert.equal((await t.owner.get("/api/x/virtual-disk-manager/list")).status, 200);
    const preview = await t.owner.post("/api/x/virtual-disk-manager/preview", { operation: "create", path: "D:\\a.vhdx", size: 5, unit: "GB" });
    assert.match(preview.data.script, /New-VHD/);
    assert.equal(r.scripts.length, 1, "previewing does not run anything (only the list ran)");
    assert.equal((await t.owner.post("/api/x/virtual-disk-manager/preview", { operation: "create", path: "bad", size: 5 })).status, 400);

    const noHold = await t.owner.post("/api/actions/virtual-disk-manager.create", { path: "D:\\a.vhdx", size: 1 });
    assert.equal(noHold.status, 403, "without the hold nothing runs");
    assert.equal(r.scripts.length, 1);
    const done = await t.owner.post("/api/actions/virtual-disk-manager.create", { path: "D:\\a.vhdx", size: 1, unit: "GB", hold: true });
    assert.equal(done.status, 200, done.text);
    assert.equal(done.data.route, "New-VHD (Hyper-V module)");
    assert.equal(r.scripts.length, 2);
    const invalid = await t.owner.post("/api/actions/virtual-disk-manager.create", { path: "D:\\a.vhd", size: 9999, hold: true });
    assert.equal(invalid.status, 400);

    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.post("/api/actions/virtual-disk-manager.detach", { path: "D:\\a.vhdx", hold: true })).status, 403, "a viewer cannot change disks");
    assert.equal((await guest.get("/api/x/virtual-disk-manager/status")).status, 200);
  } finally {
    setManager(makeManager());
    await t.stop();
  }
});

test("virtual disks: the browser module is well formed and served", async () => {
  assert.equal(checkFeatureModule(feature, "virtual-disk-manager"), null);
  const t = await startApp();
  try {
    assert.ok((await t.owner.get("/api/features/manifest")).data.modules.includes("/js/features/virtual-disk-manager/index.js"));
  } finally {
    await t.stop();
  }
});
