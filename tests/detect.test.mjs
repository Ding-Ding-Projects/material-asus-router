import assert from "node:assert/strict";
import { test } from "node:test";
import { NvramCache, detect, parseNvram } from "../server/router/detect.mjs";
import { buildCatalog } from "../server/router/catalog.mjs";
import { RouterConnection } from "../server/ssh/client.mjs";
import { FakeRouter } from "../server/ssh/fake-router.mjs";
import { startApp } from "./helpers.mjs";

async function connect(router) {
  const c = new RouterConnection({ host: "127.0.0.1", port: router.port, username: router.username, password: router.password, hostKey: router.hostKeyFingerprint });
  await c.connect();
  return c;
}

test("detects a Merlin router, its bands and capabilities", async () => {
  const router = await new FakeRouter({ firmware: "merlin" }).listen();
  const c = await connect(router);
  try {
    const cache = new NvramCache((cmd) => c.exec(cmd));
    const info = await detect(await cache.get(), (cmd) => c.exec(cmd));
    assert.equal(info.merlin, true);
    assert.equal(info.model, "RT-AX86U");
    assert.match(info.firmware, /^3\.0\.0\.4\.388\.8/);
    assert.deepEqual(info.bands.map((b) => [b.index, b.nband, b.ifname]), [[0, "2", "eth6"], [1, "1", "eth7"]]);
    assert.ok(info.capabilities.includes("wireguard") && info.capabilities.includes("usbX1"));
    assert.equal(info.lan.ip, "198.51.100.1");
  } finally {
    c.close();
    await router.close();
  }
});

test("detects stock firmware and disables Merlin-only settings", async () => {
  const router = await new FakeRouter({ firmware: "stock" }).listen();
  const c = await connect(router);
  try {
    const info = await detect(parseNvram((await c.exec("nvram show")).stdout), (cmd) => c.exec(cmd));
    assert.equal(info.merlin, false);
    const scripts = buildCatalog(info).find((e) => e.id === "merlin.scripts");
    assert.ok(scripts.disabled.en.includes("Merlin"));
  } finally {
    c.close();
    await router.close();
  }
});

test("the settings cache reads nvram once until it is invalidated", async () => {
  const router = await new FakeRouter().listen();
  const c = await connect(router);
  try {
    const cache = new NvramCache((cmd) => c.exec(cmd), { ttlMs: 60000 });
    await cache.get();
    await cache.get();
    assert.equal(router.commands.filter((x) => x === "nvram show").length, 1);
    cache.invalidate();
    await cache.get();
    assert.equal(router.commands.filter((x) => x === "nvram show").length, 2);
  } finally {
    c.close();
    await router.close();
  }
});

test("the app reports stock firmware through the catalogue API", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const res = await t.owner.get("/api/catalog");
    assert.equal(res.status, 200);
    assert.equal(res.data.info.merlin, false);
    assert.equal(res.data.domains.find((d) => d.id === "merlin").supported, false);
    const jobs = await t.owner.get("/api/domain/jobs");
    assert.equal(jobs.data.supported, false);
  } finally {
    await t.stop();
  }
});
