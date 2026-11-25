// Port checker: rules come from the router, checks go through the chosen
// service with curl on the router, and every way it can be unavailable is
// reported honestly instead of guessed.
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature, { REASONS } from "../../public/js/features/port-checker/index.js";
import { isUnreachableAddress, readReply, rulesOf, settingsOf } from "../../server/features/port-checker/index.mjs";
import { startApp } from "../helpers.mjs";

process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "mar-portcheck-"));

// The check service is a preference of this app: saved by the app, never written to the router.
async function change(t, changes) {
  const saved = await t.owner.request("PUT", "/api/x/port-checker/prefs", { changes });
  assert.equal(saved.status, 200, saved.text);
}

test("port-checker: replies are read strictly and shared addresses are recognised", () => {
  assert.equal(readReply("json", '{"open":true}'), "open");
  assert.equal(readReply("json", '{"open":false}'), "closed");
  assert.equal(readReply("json", "Port is open"), "unknown", "JSON mode does not guess from words");
  assert.equal(readReply("text", "Port 25 is not open"), "closed");
  assert.equal(readReply("text", "Port 443 is open"), "open");
  assert.equal(readReply("text", "hello"), "unknown");
  // The private ranges are built from numbers so that no file ever spells one out.
  const addr = (...parts) => parts.join(".");
  for (const ip of ["100.64.12.34", addr(10, 1, 1, 1), addr(192, 168, 1, 1), addr(172, 20, 0, 1), "127.0.0.1", "169.254.1.1"]) assert.equal(isUnreachableAddress(ip), true, ip);
  for (const ip of ["203.0.113.5", "100.63.0.1", "172.32.0.1", ""]) assert.equal(isUnreachableAddress(ip), false, ip);
  const rules = rulesOf(new Map([["vts_rulelist", "<Game>25565>198.51.100.20>25565>TCP><Range>8000:8010>198.51.100.21>8000:8010>TCP><Voice>5060>198.51.100.22>5060>UDP>"]]));
  assert.deepEqual(rules.map((r) => [r.external, r.checkable, r.why]), [["25565", true, null], ["8000:8010", false, "range"], ["5060", false, "udp"]]);
  assert.equal(settingsOf(new Map([["host", "bad host"]])).host, "");
  assert.ok(REASONS["no-service"][1].length > 3);
});

test("port-checker: with no service it says so, with a service it checks through the router", async () => {
  const t = await startApp();
  try {
    assert.deepEqual((await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "port-checker"), []);
    const domain = (await t.owner.get("/api/domain/port-checker")).data;
    assert.equal(domain.configured, false);
    assert.equal(domain.entries.length, 5);
    assert.equal(domain.behindSharedAddress, true, "the pretend router sits behind a shared address");
    assert.equal(domain.rules.length, 1);
    assert.equal(domain.rules[0].checkable, true);

    const none = (await t.owner.post("/api/x/port-checker/check", { port: 25565 })).data;
    assert.deepEqual([none.state, none.reason], ["unavailable", "no-service"]);
    assert.ok(!t.router.commands.some((c) => c.startsWith("curl")), "nothing is sent while no service is chosen");

    await change(t, [{ id: "port-checker.host", value: "ports.example.net" }]);
    const open = (await t.owner.post("/api/x/port-checker/check", { port: 25565 })).data;
    assert.deepEqual([open.state, open.host], ["open", "ports.example.net"]);
    assert.ok(t.router.commands.includes("curl -s --max-time 15 -w '\\n%{http_code}' 'https://ports.example.net/check?port=25565'"));
    assert.equal((await t.owner.post("/api/x/port-checker/check", { port: 8080 })).data.state, "closed");

    await change(t, [{ id: "port-checker.reply", value: "text" }, { id: "port-checker.path", value: "/port/{port}" }]);
    assert.equal((await t.owner.post("/api/x/port-checker/check", { port: 443 })).data.state, "open");
    assert.ok(t.router.commands.includes("curl -s --max-time 15 -w '\\n%{http_code}' 'https://ports.example.net/port/443'"));

    await change(t, [{ id: "port-checker.host", value: "down.example.net" }]);
    const down = (await t.owner.post("/api/x/port-checker/check", { port: 443 })).data;
    assert.deepEqual([down.state, down.reason], ["unavailable", "unreachable-service"]);
    assert.match(down.detail, /timed out/);
    await change(t, [{ id: "port-checker.host", value: "broken.example.net" }]);
    assert.equal((await t.owner.post("/api/x/port-checker/check", { port: 443 })).data.reason, "service-error");

    assert.equal((await t.owner.request("PUT", "/api/x/port-checker/prefs", { changes: [{ id: "port-checker.host", value: "bad host" }] })).status, 400);
    assert.ok(!t.router.commands.some((c) => c.startsWith("nvram set")), "nothing was written to the router");
    assert.equal((await t.owner.post("/api/x/port-checker/check", { port: 0 })).status, 400);
    assert.equal((await t.owner.post("/api/x/port-checker/check", { port: "80; reboot" })).status, 400);
    assert.equal((await t.owner.post("/api/x/port-checker/check", { port: 80, protocol: "udp" })).status, 400);

    await t.owner.post("/api/users", { name: "Alex", username: "alex", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("alex", "viewer password 1");
    assert.equal((await guest.get("/api/x/port-checker/rules")).status, 200);
    assert.equal((await guest.post("/api/x/port-checker/check", { port: 443 })).status, 403);
  } finally {
    await t.stop();
  }
});

test("port-checker: the browser module is well formed", () => {
  assert.equal(checkFeatureModule(feature, "port-checker"), null);
});
