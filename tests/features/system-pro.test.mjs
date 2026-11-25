// system-pro: its settings, live sensors, SSH key and wake-on-LAN lists, the
// roles, and the frontend module. Every catalogue entry is also proved by
// tests/real-controls.test.mjs (read, write, read back, undo).
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import feature from "../../public/js/features/system-pro/index.js";
import { gaugeState } from "../../public/js/features/system-pro/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp, waitFor } from "../helpers.mjs";

const publicKeyLine = (comment) => {
  const raw = Buffer.from(generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" }).x, "base64url");
  const part = (buffer) => Buffer.concat([Buffer.from([0, 0, 0, buffer.length]), buffer]);
  return `ssh-ed25519 ${Buffer.concat([part(Buffer.from("ssh-ed25519")), part(raw)]).toString("base64")} ${comment}`;
};

async function applyPreview(t, preview) {
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.id });
  assert.equal(applied.status, 200, applied.text);
  return waitFor(async () => {
    const record = (await t.owner.get(`/api/changes/history/${applied.data.id}`)).data;
    return record.status !== "guarded" && record.status !== "applying" ? record : null;
  });
}

test("system-pro: the catalogue covers access, SSH, time, logs, lights, USB and the restart schedule", async () => {
  const t = await startApp();
  try {
    const entries = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "system-pro");
    const byId = Object.fromEntries(entries.map((e) => [e.id.replace("system-pro.", ""), e]));
    assert.ok(entries.length >= 20);
    assert.equal(byId.login.readOnly, true);
    assert.equal(byId.login.value, "pat-router", "the router login name is shown");
    assert.equal(byId["ssh.port"].readOnly, true, "this app signs in over the SSH port, so it is shown only");
    for (const [name, control] of [["https.port", "port"], ["https.mode", "select"], ["tz.rule", "select"], ["log.ip", "ipv4"], ["ntp.second", "hostname"], ["reboot.schedule", "schedule"], ["btn.mode", "segmented"], ["usb.mode", "select"]])
      assert.equal(byId[name].control, control, name);
    assert.equal(byId["reboot.schedule"].value, "0@04:00-05:00");
    assert.ok(entries.every((e) => e.control !== "text" || e.readOnly), "no free text box except the read-only login name");

    const domain = (await t.owner.get("/api/domain/system-pro")).data;
    assert.equal(domain.entries.length, entries.length);
    assert.ok(domain.related.some((e) => e.id === "sys.led"), "the stock light switch is offered beside the new ones");
    assert.deepEqual(domain.wol, [{ name: "Living room PC", mac: "AA:BB:CC:00:11:22" }]);
    assert.deepEqual(domain.sshKeys, []);
  } finally {
    await t.stop();
  }
});

test("system-pro: Merlin-only settings stay visible and are switched off on stock firmware", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const entries = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "system-pro");
    for (const id of ["ssh.pass", "ssh.bfp", "ntpd.enable", "ntpd.redirect"]) {
      const entry = entries.find((e) => e.id === `system-pro.${id}`);
      assert.match(entry.disabled.en, /Merlin/, id);
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: entry.id, value: "0" }] })).status, 400);
    }
    assert.equal(entries.find((e) => e.id === "system-pro.telnet").disabled, null);
  } finally {
    await t.stop();
  }
});

test("system-pro: the temperature gauges read the processor and each radio", async () => {
  const t = await startApp();
  try {
    const out = (await t.owner.get("/api/x/system-pro/sensors")).data;
    assert.deepEqual(out.gauges.map((g) => g.id), ["cpu", "radio0", "radio1"]);
    assert.ok(out.gauges[0].celsius >= 60 && out.gauges[0].celsius < 70);
    assert.deepEqual(out.gauges.slice(1).map((g) => g.celsius), [48, 53]);
    assert.ok(t.router.commands.includes("wl -i eth6 phy_tempsense"));
  } finally {
    await t.stop();
  }
  assert.deepEqual(gaugeState(null, 80, 100), { share: 0, tone: "", word: "unavailable" });
  assert.deepEqual([gaugeState(50, 80, 100).word, gaugeState(85, 80, 100).word, gaugeState(97, 80, 100).word], ["normal", "warm", "hot"]);
});

test("system-pro: SSH keys are added and removed through a reviewed preview and the key text is masked", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/x/system-pro/ssh-keys", { key: "not a key" })).status, 400);
    assert.equal((await t.owner.post("/api/x/system-pro/ssh-keys", { key: "ssh-ed25519 AAAA" })).status, 400);
    const line = publicKeyLine("pat laptop");
    const preview = await t.owner.post("/api/x/system-pro/ssh-keys", { key: line });
    assert.equal(preview.status, 200, preview.text);
    assert.equal(preview.data.maxRisk, "network", "a key change uses the safety net");
    assert.ok(preview.data.items[0].secret && !JSON.stringify(preview.data).includes(line.split(" ")[1]), "the key is masked in the preview");
    assert.equal((await applyPreview(t, preview.data)).status, "applied");
    assert.equal(t.router.nvram.sshd_authkeys, line);
    const shown = (await t.owner.get("/api/domain/system-pro")).data.sshKeys;
    assert.deepEqual(shown.map((k) => [k.type, k.comment]), [["ssh-ed25519", "pat laptop"]]);
    assert.match(shown[0].fingerprint, /^SHA256:[A-Za-z0-9+/]{43}$/);
    assert.equal((await t.owner.post("/api/x/system-pro/ssh-keys", { key: line })).status, 409, "the same key twice is refused");

    const gone = await t.owner.request("DELETE", "/api/x/system-pro/ssh-keys/0");
    assert.equal(gone.status, 200, gone.text);
    assert.equal((await applyPreview(t, gone.data)).status, "applied");
    assert.equal(t.router.nvram.sshd_authkeys, "");
    assert.equal((await t.owner.request("DELETE", "/api/x/system-pro/ssh-keys/0")).status, 404);
  } finally {
    await t.stop();
  }
});

test("system-pro: a second SSH key can be added", async () => {
  const t = await startApp();
  try {
    for (const comment of ["first", "second"]) {
      const preview = await t.owner.post("/api/x/system-pro/ssh-keys", { key: publicKeyLine(comment) });
      assert.equal((await applyPreview(t, preview.data)).status, "applied", comment);
    }
    assert.equal(t.router.nvram.sshd_authkeys.split("\n").length, 2);
  } finally {
    await t.stop();
  }
});

test("system-pro: wake-on-LAN devices are added, woken and removed", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/x/system-pro/wol", { name: "Bad", mac: "nope" })).status, 400);
    assert.equal((await t.owner.post("/api/x/system-pro/wol", { name: "", mac: "AA:BB:CC:00:11:33" })).status, 400);
    const preview = await t.owner.post("/api/x/system-pro/wol", { name: "Alex desktop", mac: "aa:bb:cc:00:11:33" });
    assert.equal(preview.status, 200, preview.text);
    assert.equal((await applyPreview(t, preview.data)).status, "applied");
    assert.equal(t.router.nvram.wollist, "<Living room PC>AA:BB:CC:00:11:22<Alex desktop>AA:BB:CC:00:11:33");
    assert.equal((await t.owner.post("/api/actions/wake", { mac: "AA:BB:CC:00:11:33" })).status, 200);
    assert.ok(t.router.commands.includes("ether-wake -i br0 AA:BB:CC:00:11:33"));
    const removed = await t.owner.request("DELETE", "/api/x/system-pro/wol/AA%3ABB%3ACC%3A00%3A11%3A22");
    assert.equal(removed.status, 200, removed.text);
    assert.equal((await applyPreview(t, removed.data)).status, "applied");
    assert.equal(t.router.nvram.wollist, "<Alex desktop>AA:BB:CC:00:11:33");
  } finally {
    await t.stop();
  }
});

test("system-pro: routes need a session and viewers cannot change lists", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/x/system-pro/sensors")).status, 401);
    assert.equal((await t.owner.post("/api/x/system-pro/wol", { name: "A", mac: "AA:BB:CC:00:11:33" }, { csrf: "wrong" })).status, 403);
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/x/system-pro/sensors")).status, 200);
    assert.equal((await guest.post("/api/x/system-pro/wol", { name: "A", mac: "AA:BB:CC:00:11:33" })).status, 403);
  } finally {
    await t.stop();
  }
});

test("system-pro: the browser module is well formed and listed in the manifest", async () => {
  assert.equal(checkFeatureModule(feature, "system-pro"), null);
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/system-pro/index.js"));
    assert.ok(manifest.styles.includes("/js/features/system-pro/style.css"));
    assert.equal((await fetch(`${t.base}/js/features/system-pro/ui.js`)).status, 200);
  } finally {
    await t.stop();
  }
});
