// LAN Pro: what devices are told, reserved addresses, and the switch settings
// read the router's real values and change through the change engine. The
// stock address, DHCP range and lease settings the screen draws are checked
// here too. Link aggregation is shown, and disabled with a reason, on a model
// without the hardware.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/lan-pro/index.js";
import { startApp, waitFor } from "../helpers.mjs";

const settle = async (t, record) =>
  record.status === "guarded" || record.status === "applying"
    ? waitFor(async () => {
        const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
        return next.status !== "guarded" && next.status !== "applying" ? next : null;
      })
    : record;

async function apply(t, preview) {
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  const record = await settle(t, applied.data);
  assert.equal(record.status, "applied");
  return record;
}

async function change(t, changes) {
  const preview = await t.owner.post("/api/changes/preview", { changes });
  assert.equal(preview.status, 200, preview.text);
  return apply(t, preview);
}

const mine = async (t) => (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "lan-pro");

test("lan-pro: the settings read the router, reservations are a typed list and link aggregation is model gated", async () => {
  const t = await startApp();
  try {
    const entries = await mine(t);
    for (const id of ["gateway", "dns1", "dns2", "dns-router", "wins", "use-reserved", "reservations", "jumbo", "lacp"]) assert.ok(entries.some((e) => e.id === `lan-pro.${id}`), `${id} is missing`);
    const list = entries.find((e) => e.id === "lan-pro.reservations");
    assert.equal(list.control, "lanreservations");
    assert.deepEqual(list.columns.map((c) => [c.id, c.kind]), [["mac", "mac"], ["ip", "ipv4"], ["dns", "ipv4"], ["host", "hostname"]]);
    assert.equal(list.value, "<B8:27:EB:11:22:33>198.51.100.20>>nas", "it shows the router's real list");
    const lacp = entries.find((e) => e.id === "lan-pro.lacp");
    assert.ok(lacp.disabled?.en.includes("does not support"), "link aggregation is shown, disabled, with the reason");
    assert.ok(lacp.disabled.yue.length > 5);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "lan-pro.lacp", value: "1" }] })).status, 400);

    const domain = (await t.owner.get("/api/domain/lan-pro")).data;
    assert.deepEqual([domain.lan.network, domain.lan.prefix, domain.lan.hosts, domain.lan.ip], ["198.51.100.0", 24, 254, "198.51.100.1"]);
    assert.deepEqual(domain.lan.pool, { start: "198.51.100.100", end: "198.51.100.199", size: 100 });
    assert.equal(domain.reservations, 1);
    assert.equal(domain.lacpSupported, false);
    assert.deepEqual(domain.stock.map((e) => e.id).filter((id) => /^(lan|dhcp)\./.test(id)).sort(), ["dhcp.enabled", "dhcp.end", "dhcp.lease", "dhcp.start", "lan.domain", "lan.ip", "lan.mask"], "the stock address, range and lease settings are on this screen too");
  } finally {
    await t.stop();
  }
});

test("lan-pro: a model with link aggregation can switch it on", async () => {
  const t = await startApp();
  try {
    t.router.nvram.rc_support += " lacp";
    await t.app.session.catalog({ fresh: true });
    const lacp = (await mine(t)).find((e) => e.id === "lan-pro.lacp");
    assert.equal(lacp.disabled, null);
    await change(t, [{ id: "lan-pro.lacp", value: "1" }]);
    assert.equal(t.router.nvram.lacp_enabled, "1");
  } finally {
    await t.stop();
  }
});

test("lan-pro: reservations, client settings and the DHCP range and lease are written and read back", async () => {
  const t = await startApp();
  try {
    const record = await change(t, [
      { id: "lan-pro.reservations", value: "<f0:18:98:aa:bb:01>198.51.100.150>198.51.100.1>pats-iphone<ac:5a:f0:01:02:03>198.51.100.151>>tv" },
      { id: "lan-pro.gateway", value: "198.51.100.2" },
      { id: "lan-pro.dns1", value: "198.51.100.1" },
      { id: "lan-pro.dns-router", value: "0" },
      { id: "lan-pro.jumbo", value: "1" },
      { id: "dhcp.start", value: "198.51.100.50" },
      { id: "dhcp.end", value: "198.51.100.120" },
      { id: "dhcp.lease", value: "43200" },
    ]);
    assert.equal(t.router.nvram.dhcp_staticlist, "<F0:18:98:AA:BB:01>198.51.100.150>198.51.100.1>pats-iphone<AC:5A:F0:01:02:03>198.51.100.151>>tv", "MAC addresses are stored in upper case");
    assert.deepEqual([t.router.nvram.dhcp_start, t.router.nvram.dhcp_end, t.router.nvram.dhcp_lease, t.router.nvram.dhcp_gateway_x], ["198.51.100.50", "198.51.100.120", "43200", "198.51.100.2"]);
    assert.ok(t.router.services.includes("restart_dnsmasq") && t.router.services.includes("restart_net_and_phy"));
    assert.equal((await t.owner.get("/api/domain/lan-pro")).data.reservations, 2);
    const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
    await apply(t, undo);
    assert.equal(t.router.nvram.dhcp_staticlist, "<B8:27:EB:11:22:33>198.51.100.20>>nas");
    assert.equal(t.router.nvram.dhcp_start, "198.51.100.100");
  } finally {
    await t.stop();
  }
});

test("lan-pro: bad reservation lists are refused with a clear reason", async () => {
  const t = await startApp();
  try {
    const refuse = async (value, pattern) => {
      const res = await t.owner.post("/api/changes/preview", { changes: [{ id: "lan-pro.reservations", value }] });
      assert.equal(res.status, 400, value);
      assert.match(res.data.error ?? res.text, pattern, value);
    };
    await refuse("<broken", /needs 4 columns/);
    await refuse("B8:27:EB:11:22:33>198.51.100.20>>nas", /router's format/);
    await refuse("<not-a-mac>198.51.100.20>>nas", /MAC address/);
    await refuse("<B8:27:EB:11:22:33>198.51.100.999>>nas", /IPv4/);
    await refuse("<B8:27:EB:11:22:33>198.51.100.20>>bad name!", /host name/);
    await refuse("<B8:27:EB:11:22:33>198.51.100.20>>a<b8:27:eb:11:22:33>198.51.100.21>>b", /is used twice/i);
    await refuse("<B8:27:EB:11:22:33>198.51.100.20>>a<B8:27:EB:11:22:34>198.51.100.20>>b", /is used twice/i);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "lan-pro.reservations", value: "" }] })).status, 200, "an empty list is allowed: it removes every reservation");
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "lan-pro.dns1", value: "999.1.1.1" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("lan-pro: the clients route, the reserve check and unreserve work through the change engine", async () => {
  const t = await startApp();
  try {
    const { clients } = (await t.owner.get("/api/x/lan-pro/clients")).data;
    assert.equal(clients.length, 5);
    const nas = clients.find((c) => c.host === "nas");
    assert.equal(nas.reservedAddress, "198.51.100.20");
    assert.equal(clients.find((c) => c.host === "Pats-iPhone").reservedAddress, null);

    const reserve = await t.owner.post("/api/x/lan-pro/reserve", { mac: "f0:18:98:aa:bb:01", ip: "198.51.100.40", hostname: "pats-iphone" });
    assert.equal(reserve.status, 200, reserve.text);
    assert.equal(reserve.data.inPool, false);
    assert.match(reserve.data.note, /outside the automatic range/);
    await apply(t, { data: reserve.data.preview });
    assert.match(t.router.nvram.dhcp_staticlist, /<F0:18:98:AA:BB:01>198\.51\.100.40>>pats-iphone$/);

    const inPool = await t.owner.post("/api/x/lan-pro/reserve", { mac: "02:00:00:00:00:09", ip: "198.51.100.180" });
    assert.equal(inPool.data.inPool, true);

    const refused = async (body, status, pattern) => {
      const res = await t.owner.post("/api/x/lan-pro/reserve", body);
      assert.equal(res.status, status, JSON.stringify(body));
      assert.match(res.data.error, pattern);
    };
    await refused({ mac: "02:00:00:00:00:09", ip: "203.0.113.5" }, 400, /outside the home network/);
    await refused({ mac: "02:00:00:00:00:09", ip: "198.51.100.1" }, 400, /cannot be given/);
    await refused({ mac: "02:00:00:00:00:09", ip: "198.51.100.255" }, 400, /cannot be given/);
    await refused({ mac: "nope", ip: "198.51.100.30" }, 400, /MAC address/);
    await refused({ mac: "02:00:00:00:00:09", ip: "198.51.100.101" }, 409, /in use by lgwebostv/);
    await refused({ mac: "02:00:00:00:00:09", ip: "198.51.100.40" }, 409, /already belongs to another device/);

    const unreserve = await t.owner.post("/api/x/lan-pro/unreserve", { mac: "b8:27:eb:11:22:33" });
    assert.equal(unreserve.status, 200, unreserve.text);
    await apply(t, { data: unreserve.data.preview });
    assert.doesNotMatch(t.router.nvram.dhcp_staticlist, /B8:27:EB:11:22:33/);
    assert.equal((await t.owner.post("/api/x/lan-pro/unreserve", { mac: "b8:27:eb:11:22:33" })).status, 404);
  } finally {
    await t.stop();
  }
});

test("lan-pro: viewers may read but not reserve", async () => {
  const t = await startApp();
  try {
    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201, viewer.text);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/domain/lan-pro")).status, 200);
    assert.equal((await guest.get("/api/x/lan-pro/clients")).status, 200);
    assert.equal((await guest.post("/api/x/lan-pro/reserve", { mac: "02:00:00:00:00:09", ip: "198.51.100.150" })).status, 403);
    assert.equal((await t.client().get("/api/x/lan-pro/clients")).status, 401);
  } finally {
    await t.stop();
  }
});

test("lan-pro: the browser module is well formed and brings its list editor", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/lan-pro/index.js"));
    assert.ok(manifest.styles.includes("/js/features/lan-pro/style.css"));
    for (const url of ["/js/features/lan-pro/table.js", "/js/features/lan-pro/view.js"]) assert.equal((await fetch(t.base + url)).status, 200);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "lan-pro"), null);
  assert.deepEqual(Object.keys(feature.controls), ["lanreservations"]);
});
