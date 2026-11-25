// The DHCP address map: the cells and summary the server draws, the helpers the
// browser uses to drag the pool and keep addresses, and the real settings and
// list edits it stages through the change engine.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/dhcp-map/index.js";
import { applyPool, leaseLeft, movePool, numberIp, releaseAt, reserveAt, rowsOf, stepIp, warnings, ipNumber } from "../../public/js/features/dhcp-map/model.js";
import { blockOf, buildCells, summarise } from "../../server/features/dhcp-map/model.mjs";
import { startApp } from "../helpers.mjs";

const net = { lanIp: "198.51.100.1", mask: "255.255.255.0", poolStart: "198.51.100.100", poolEnd: "198.51.100.110" };

test("dhcp-map: every address becomes a cell and the kinds are counted", () => {
  const { cells, block } = buildCells({ ...net, leases: [{ ip: "198.51.100.101", mac: "AA:AA:AA:AA:AA:01", name: "phone", ends: 100 }, { ip: "198.51.100.20", mac: "AA:AA:AA:AA:AA:02", name: "nas", ends: 100 }], reservations: [{ ip: "198.51.100.20", mac: "AA:AA:AA:AA:AA:02", name: "nas" }, { ip: "198.51.100.30", mac: "AA:AA:AA:AA:AA:03", name: "printer" }] });
  assert.equal(cells.length, 256);
  assert.deepEqual([cells[0].kind, cells[1].kind, cells[255].kind], ["edge", "router", "edge"]);
  assert.equal(cells.find((c) => c.ip === "198.51.100.20").leased, true, "a reserved address that is also leased says so");
  assert.equal(block.whole, true);
  assert.deepEqual(summarise(cells), { router: 1, reserved: 2, leased: 1, free: 250, pool: 11, poolFree: 10 });
  assert.equal(cells.filter((c) => c.inPool).length, 11);
  const big = blockOf("198.51.100.77", "255.255.0.0");
  assert.deepEqual([big.whole, big.size], [false, 256], "a network bigger than the map shows the /24 around the router");
});

test("dhcp-map: the browser moves the pool, keeps addresses and warns about bad pools", () => {
  const { cells } = buildCells({ ...net, leases: [{ ip: "198.51.100.101", mac: "AA:AA:AA:AA:AA:01", name: "phone", ends: 1000 }, { ip: "198.51.100.102", mac: "AA:AA:AA:AA:AA:09", name: "tv", ends: 1000 }], reservations: [] });
  const pool = { start: net.poolStart, end: net.poolEnd };
  assert.deepEqual(movePool(cells, pool, "end", "198.51.100.150"), { start: "198.51.100.100", end: "198.51.100.150" });
  assert.deepEqual(movePool(cells, pool, "start", "198.51.100.120"), { start: "198.51.100.120", end: "198.51.100.120" }, "the other end follows when they would cross");
  assert.equal(movePool(cells, pool, "end", "198.51.100.255"), null, "the last address of the network cannot be handed out");
  assert.equal(movePool(cells, pool, "end", "10.0.0.1"), null);
  assert.equal(stepIp(cells, "198.51.100.254", 1), null, "the broadcast address is not a step");
  assert.equal(stepIp(cells, "198.51.100.2", -1), "198.51.100.1");
  assert.equal(applyPool(cells, "198.51.100.101", "198.51.100.102").filter((c) => c.inPool).length, 2);

  const kept = reserveAt(cells, "AA:AA:AA:AA:AA:01", "198.51.100.40", "phone");
  assert.equal(kept.find((c) => c.ip === "198.51.100.40").kind, "reserved");
  assert.equal(kept.find((c) => c.ip === "198.51.100.101").kind, "free", "the old address frees up");
  assert.equal(reserveAt(cells, "AA:AA:AA:AA:AA:01", "198.51.100.101", "x"), cells, "an address that is not free is left alone");
  assert.equal(releaseAt(kept, "198.51.100.40").find((c) => c.ip === "198.51.100.40").kind, "free");

  assert.deepEqual(warnings(cells, { start: "198.51.100.200", end: "198.51.100.100" }), ["empty-pool"]);
  assert.deepEqual(warnings(cells, { start: "198.51.100.1", end: "198.51.100.100" }), ["router-in-pool"]);
  assert.deepEqual(warnings(cells, { start: "198.51.100.100", end: "198.51.100.100" }), ["small-pool"]);
  assert.deepEqual(leaseLeft(10000 + 3 * 3600 + 20 * 60, 10000), { hours: 3, minutes: 20 });
  assert.equal(leaseLeft(null, 5), null);
  assert.equal(numberIp(ipNumber("198.51.100.7")), "198.51.100.7");
  assert.deepEqual(rowsOf(cells, 16).map((r) => r.length).slice(0, 2), [16, 16]);
});

test("dhcp-map: the domain draws the real network", async () => {
  const t = await startApp();
  try {
    assert.ok((await t.owner.get("/api/catalog")).data.domains.some((d) => d.id === "dhcp-map" && d.supported));
    const data = (await t.owner.get("/api/domain/dhcp-map")).data;
    assert.equal(data.cells.length, 256);
    assert.deepEqual([data.pool.start, data.pool.end], ["198.51.100.100", "198.51.100.199"]);
    const nas = data.cells.find((c) => c.ip === "198.51.100.20");
    assert.deepEqual([nas.kind, nas.leased, nas.name], ["reserved", true, "nas"]);
    assert.equal(data.cells.find((c) => c.ip === "198.51.100.101").kind, "leased");
    assert.equal(data.summary.reserved, 1);
    assert.equal(data.summary.leased, 4);
    assert.ok(data.entries.some((e) => e.id === "dhcp.start") && data.entries.some((e) => e.id === "dhcp.end"));
  } finally {
    await t.stop();
  }
});

test("dhcp-map: resizing the pool and keeping an address go through the change engine", async () => {
  const t = await startApp();
  try {
    const phone = (await t.owner.get("/api/domain/dhcp-map")).data.cells.find((c) => c.ip === "198.51.100.102");
    const preview = await t.owner.post("/api/changes/preview", {
      changes: [{ id: "dhcp.start", value: "198.51.100.50" }, { id: "dhcp.end", value: "198.51.100.150" }],
      ops: [{ op: "reserve", mac: phone.mac, ip: "198.51.100.60", hostname: "Pats-iPhone" }],
    });
    assert.equal(preview.status, 200, preview.text);
    assert.ok(preview.data.restarts.includes("restart_dnsmasq"));
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: preview.data.id })).status, 200);
    const data = (await t.owner.get("/api/domain/dhcp-map")).data;
    assert.deepEqual([data.pool.start, data.pool.end], ["198.51.100.50", "198.51.100.150"]);
    assert.equal(data.cells.find((c) => c.ip === "198.51.100.60").kind, "reserved");
    assert.equal(data.cells.filter((c) => c.inPool).length, 101);
    // The address another device keeps, and the router's own address, are refused.
    assert.equal((await t.owner.post("/api/changes/preview", { ops: [{ op: "reserve", mac: phone.mac, ip: "198.51.100.20" }] })).status, 409);
    assert.equal((await t.owner.post("/api/changes/preview", { ops: [{ op: "reserve", mac: phone.mac, ip: "198.51.100.1" }] })).status, 400);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "dhcp.end", value: "not-an-address" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("dhcp-map: the module is listed and well formed", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/domain/dhcp-map")).status, 401);
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/dhcp-map/index.js"));
    for (const file of ["index.js", "drag.js", "model.js", "style.css"]) assert.equal((await fetch(`${t.base}/js/features/dhcp-map/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "dhcp-map"), null);
});
