import assert from "node:assert/strict";
import { test } from "node:test";
import { startApp } from "./helpers.mjs";

test("connecting to an unknown router asks for host key approval, then pins it", async () => {
  const t = await startApp({ configure: false });
  try {
    const body = { host: "127.0.0.1", port: t.router.port, username: "admin", authType: "password", password: t.router.password };
    const first = await t.owner.post("/api/router/connect", body);
    assert.equal(first.status, 409);
    assert.equal(first.data.code, "HOST_KEY_UNKNOWN");
    assert.equal(first.data.fingerprint, t.router.hostKeyFingerprint);
    assert.equal((await t.owner.get("/api/router")).data.configured, false, "nothing is saved before approval");

    assert.equal((await t.owner.post("/api/router/approve-host-key", { fingerprint: "SHA256:wrong" })).status, 409);
    const approved = await t.owner.post("/api/router/approve-host-key", { fingerprint: first.data.fingerprint });
    assert.equal(approved.status, 200, approved.text);
    assert.equal(approved.data.configured, true);
    assert.equal(approved.data.hostKey, t.router.hostKeyFingerprint);
    assert.equal((await t.owner.get("/api/catalog")).status, 200);

    const again = await t.owner.post("/api/router/connect", { ...body, password: undefined });
    assert.equal(again.status, 200, "a known router connects with the stored password");
  } finally {
    await t.stop();
  }
});

test("a router with a different host key than the approved one is refused", async () => {
  const t = await startApp();
  try {
    await t.app.store.update((s) => void (s.router.hostKey = "SHA256:someoneElse"));
    t.app.session.close();
    const res = await t.owner.get("/api/catalog");
    assert.equal(res.status, 409);
    assert.equal(res.data.fingerprint, t.router.hostKeyFingerprint);
    assert.match(res.data.error, /different host key/);
  } finally {
    await t.stop();
  }
});

test("wrong router password and unreachable routers give plain errors", async () => {
  const t = await startApp({ configure: false });
  try {
    const wrong = await t.owner.post("/api/router/connect", { host: "127.0.0.1", port: t.router.port, username: "admin", authType: "password", password: "nope" });
    assert.equal(wrong.status, 409, "the host key is asked about before the password is judged");
    await t.owner.post("/api/router/approve-host-key", { fingerprint: wrong.data.fingerprint }).then((r) => assert.equal(r.status, 401));
    assert.equal((await t.owner.get("/api/catalog")).status, 409, "no router is saved");
    assert.equal((await t.owner.post("/api/router/connect", { host: "not a host", username: "admin", password: "x" })).status, 400);
    assert.equal((await t.owner.post("/api/router/connect", { host: "127.0.0.1", port: 70000, username: "admin", password: "x" })).status, 400);
  } finally {
    await t.stop();
  }
});

test("the app's own key can be generated, allowed on the router, and used to connect", async () => {
  const t = await startApp();
  try {
    const key = await t.owner.post("/api/router/key", {});
    assert.equal(key.status, 200);
    assert.match(key.data.publicKey, /^ssh-ed25519 \S+ material-asus-router$/);
    assert.ok(!(await t.owner.get("/api/router")).text.includes("PRIVATE KEY"));

    const preview = await t.owner.post("/api/actions/install-key", {});
    assert.equal(preview.status, 200, preview.text);
    assert.equal(preview.data.items[0].key, "sshd_authkeys");
    assert.equal(preview.data.items[0].new, "••••••••", "the key list is treated as a secret");
    const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
    assert.equal(applied.data.status, "applied", applied.text);
    assert.ok(t.router.nvram.sshd_authkeys.includes(key.data.publicKey.split(" ")[1]));
    assert.equal((await t.owner.post("/api/actions/install-key", {})).status, 409, "already allowed");

    const connect = await t.owner.post("/api/router/connect", { host: "127.0.0.1", port: t.router.port, username: "admin", authType: "key" });
    assert.equal(connect.status, 200, connect.text);
    assert.equal(connect.data.authType, "key");
    const overview = await t.owner.get("/api/domain/overview");
    assert.equal(overview.status, 200);
    const again = await t.owner.post("/api/router/key", {});
    assert.equal(again.status, 200);
    assert.equal(again.data.publicKey, key.data.publicKey, "asking again shows the same key instead of making a new one");
    assert.equal(again.data.existing, true);
    const replaced = await t.owner.post("/api/router/key", { replace: true });
    assert.notEqual(replaced.data.publicKey, key.data.publicKey, "only an explicit replace makes a new key");
  } finally {
    await t.stop();
  }
});

test("forgetting the router removes it and its stored password", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/router/forget", {})).status, 200);
    assert.equal((await t.owner.get("/api/router")).data.configured, false);
    assert.equal((await t.owner.get("/api/catalog")).status, 409);
    assert.equal(t.app.vault.has("router.password"), false);
  } finally {
    await t.stop();
  }
});

test("network tools validate their target and run on the router", async () => {
  const t = await startApp();
  try {
    const ping = await t.owner.post("/api/actions/ping", { host: "example.com", count: 2 });
    assert.equal(ping.status, 200);
    assert.match(ping.data.output, /2 packets transmitted/);
    assert.ok(t.router.commands.includes("ping -c 2 -W 2 example.com"));
    assert.match((await t.owner.post("/api/actions/traceroute", { host: "198.51.100.20" })).data.output, /ms/);
    assert.match((await t.owner.post("/api/actions/nslookup", { host: "example.com" })).data.output, /Address/);
    for (const host of ["example.com; reboot", "a b", "$(id)", "", "-c 1000 x"]) assert.equal((await t.owner.post("/api/actions/ping", { host })).status, 400, host);
    assert.equal((await t.owner.post("/api/actions/ping", { host: "example.com", count: 99 })).status, 400);
    assert.equal(t.router.commands.some((c) => /reboot|\$\(/.test(c)), false);
    assert.equal((await t.owner.post("/api/actions/wake", { mac: "AC:5A:F0:01:02:03" })).data.ok, true);
    assert.equal((await t.owner.post("/api/actions/wake", { mac: "not a mac" })).status, 400);
    assert.equal((await t.owner.post("/api/actions/restart-service", { service: "restart_wireless" })).data.ok, true);
    assert.equal((await t.owner.post("/api/actions/restart-service", { service: "restart_wireless; reboot" })).status, 400);
    assert.equal((await t.owner.post("/api/actions/nothing", {})).status, 404);
  } finally {
    await t.stop();
  }
});

test("reboot needs the model typed exactly and the hold confirmation", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/actions/reboot", {})).status, 403);
    assert.equal((await t.owner.post("/api/actions/reboot", { confirm: "rt-ax86u", hold: true })).status, 403, "case matters");
    const noHold = await t.owner.post("/api/actions/reboot", { confirm: "RT-AX86U" });
    assert.equal(noHold.status, 403);
    assert.equal(noHold.data.code, "CONFIRM_HOLD");
    assert.equal(t.router.rebooted, undefined);
    const ok = await t.owner.post("/api/actions/reboot", { confirm: "RT-AX86U", hold: true });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(t.router.rebooted, true);
  } finally {
    await t.stop();
  }
});

test("backup omits secrets by default; only the owner can include them; restore goes through preview", async () => {
  const t = await startApp();
  try {
    const plain = (await t.owner.get("/api/backup")).data;
    assert.equal(plain.format, "material-asus-router-backup");
    assert.equal(plain.secretsIncluded, false);
    assert.equal(plain.nvram.wl0_wpa_psk, "••••••••");
    assert.equal(plain.nvram.wl0_ssid, "Harbour Home");
    const full = (await t.owner.get("/api/backup?secrets=1")).data;
    assert.equal(full.nvram.wl0_wpa_psk, "milk-tea-and-egg-tarts");

    const change = await t.owner.post("/api/changes/preview", { changes: [{ id: "qos.up", value: "30000" }, { id: "wl0.ssid", value: "Changed" }] });
    await t.owner.post("/api/changes/apply", { previewId: change.data.id });
    assert.equal(t.router.nvram.wl0_ssid, "Changed");

    const restore = await t.owner.post("/api/restore", { backup: plain });
    assert.equal(restore.status, 200, restore.text);
    assert.deepEqual(restore.data.preview.items.map((i) => i.key).sort(), ["qos_obw", "wl0_ssid"]);
    assert.equal(t.router.nvram.wl0_ssid, "Changed", "restore only previews until applied");
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: restore.data.preview.id })).data.status, "applied");
    assert.equal(t.router.nvram.wl0_ssid, "Harbour Home");
    assert.equal(t.router.nvram.wl0_wpa_psk, "milk-tea-and-egg-tarts", "masked secrets are never written back");
    assert.equal((await t.owner.post("/api/restore", { backup: { nope: true } })).status, 400);
    assert.equal((await t.owner.post("/api/restore", { backup: plain })).status, 400, "nothing left to restore");
  } finally {
    await t.stop();
  }
});

test("the safety timer length is a setting with limits", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.get("/api/settings")).data.guardSeconds, 30);
    assert.equal((await t.owner.post("/api/settings", { guardSeconds: 120 })).data.guardSeconds, 120);
    const preview = await t.owner.post("/api/changes/preview", { changes: [{ id: "wl0.ssid", value: "Timer test" }] });
    assert.equal(preview.data.guard.seconds, 120);
    assert.equal((await t.owner.post("/api/settings", { guardSeconds: 5 })).status, 400);
  } finally {
    await t.stop();
  }
});

test("approving the host key uses the sign-in method chosen now, and refusals say what to do", async () => {
  const t = await startApp({ configure: false });
  try {
    const key = await t.owner.post("/api/router/key", {});
    t.router.nvram.sshd_authkeys = key.data.publicKey;
    // First attempt with a wrong password stops at the unknown host key.
    const first = await t.owner.post("/api/router/connect", { host: "127.0.0.1", port: t.router.port, username: "admin", authType: "password", password: "not-the-password" });
    assert.equal(first.data.code, "HOST_KEY_UNKNOWN");
    // Switching to the key before approving must use the key, not the stored password attempt.
    const approved = await t.owner.post("/api/router/approve-host-key", { fingerprint: first.data.fingerprint, authType: "key" });
    assert.equal(approved.status, 200, approved.text);
    assert.equal(approved.data.authType, "key");
    assert.equal((await t.owner.post("/api/router/key", {})).data.publicKey, key.data.publicKey, "the key did not change");

    // A refused password explains what to do next.
    await t.owner.post("/api/router/forget", {});
    const again = await t.owner.post("/api/router/connect", { host: "127.0.0.1", port: t.router.port, username: "admin", authType: "password", password: "nope" });
    const approve = await t.owner.post("/api/router/approve-host-key", { fingerprint: again.data.fingerprint, authType: "password", password: "nope" });
    assert.notEqual(approve.status, 200);
    assert.match(approve.data.error ?? approve.text, /This app's key/);
  } finally {
    await t.stop();
  }
});
