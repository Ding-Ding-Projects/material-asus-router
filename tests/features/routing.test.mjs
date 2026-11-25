// Routing and NAT: static routes, NAT passthrough, UPnP and NAT-PMP, port
// triggering and the DMZ host read the router's real values and change through
// the change engine. The live route table and UPnP mappings are read from the
// router, and Merlin-only items stay visible but disabled on the stock firmware.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/routing/index.js";
import { startApp, waitFor } from "../helpers.mjs";

const settle = async (t, record) =>
  record.status === "guarded" || record.status === "applying"
    ? waitFor(async () => {
        const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
        return next.status !== "guarded" && next.status !== "applying" ? next : null;
      })
    : record;

async function applyPreview(t, preview) {
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.id });
  assert.equal(applied.status, 200, applied.text);
  const record = await settle(t, applied.data);
  assert.equal(record.status, "applied");
  return record;
}

async function change(t, changes) {
  const preview = await t.owner.post("/api/changes/preview", { changes });
  assert.equal(preview.status, 200, preview.text);
  return applyPreview(t, preview.data);
}

const mine = async (t) => (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "routing");

function rulesAreReal(entries) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const entry of entries) {
    const rule = entry.meta?.showWhen;
    if (!rule) continue;
    for (const r of (Array.isArray(rule) ? rule.flat() : [rule])) {
      const target = byId.get(r.id);
      assert.ok(target, `${entry.id}: showWhen names ${r.id}, which is not an entry`);
      const allowed = target.options ? target.options.map(([v]) => v) : target.values ? [target.values.on, target.values.off] : null;
      if (allowed) for (const value of r.in) assert.ok(allowed.includes(value), `${entry.id}: showWhen expects ${r.id} to be "${value}", which it cannot be`);
    }
  }
}

test("routing: the settings read the router and the lists are typed tables", async () => {
  const t = await startApp();
  try {
    const entries = await mine(t);
    for (const id of ["static-enable", "static-routes", "pptp", "l2tp", "ipsec", "rtsp", "h323", "sip", "pppoe-relay", "upnp", "upnp-secure", "upnp-clean", "upnp-interval", "upnp-threshold", "natpmp", "trigger-enable", "triggers", "dmz"])
      assert.ok(entries.some((e) => e.id === `routing.${id}`), `${id} is missing`);
    const routes = entries.find((e) => e.id === "routing.static-routes");
    assert.equal(routes.control, "routetable");
    assert.deepEqual(routes.columns.map((c) => c.id), ["net", "mask", "gateway", "metric", "iface"]);
    assert.equal(routes.value, "<203.0.113.0>255.255.255.0>198.51.100.2>1>LAN");
    assert.deepEqual(entries.find((e) => e.id === "routing.triggers").columns.map((c) => c.kind), ["text", "port", "select", "port", "select"]);
    assert.equal(entries.find((e) => e.id === "routing.dmz").control, "deviceip");
    rulesAreReal(entries);

    const domain = (await t.owner.get("/api/domain/routing")).data;
    assert.equal(domain.staticRoutes, 1);
    assert.deepEqual(domain.kernel.map((r) => [r.network, r.prefix, r.gateway, r.iface]), [["0.0.0.0", 0, "100.64.0.1", "eth0"], ["198.51.100.0", 24, "", "br0"], ["203.0.113.0", 24, "198.51.100.2", "br0"]]);
    assert.deepEqual(domain.mappings.map((m) => [m.proto, m.outsidePort, m.device, m.devicePort, m.description]), [["TCP", 8080, "198.51.100.20", 80, "web server"], ["UDP", 51413, "198.51.100.20", 51413, "torrent"]]);
    assert.equal(domain.dmz, "");
  } finally {
    await t.stop();
  }
});

test("routing: static routes, port triggers, passthrough, UPnP and the DMZ host are written, read back and undone", async () => {
  const t = await startApp();
  try {
    const record = await change(t, [
      { id: "routing.static-routes", value: "<203.0.113.0>255.255.255.0>198.51.100.2>1>LAN<192.0.2.0>255.255.255.128>198.51.100.3>5>WAN" },
      { id: "routing.pppoe-relay", value: "1" },
      { id: "routing.sip", value: "0" },
      { id: "routing.upnp", value: "0" },
      { id: "routing.trigger-enable", value: "1" },
      { id: "routing.triggers", value: "<Game lobby>6667>TCP>6881:6889>UDP" },
      { id: "routing.dmz", value: "198.51.100.20" },
    ]);
    const n = t.router.nvram;
    assert.equal(n.sr_rulelist, "<203.0.113.0>255.255.255.0>198.51.100.2>1>LAN<192.0.2.0>255.255.255.128>198.51.100.3>5>WAN");
    assert.deepEqual([n.fw_pt_pppoerelay, n.fw_pt_sip, n.upnp_enable, n.autofw_enable_x, n.autofw_rulelist, n.dmz_ip], ["1", "0", "0", "1", "<Game lobby>6667>TCP>6881:6889>UDP", "198.51.100.20"]);
    for (const service of ["restart_firewall", "restart_upnp"]) assert.ok(t.router.services.includes(service), service);
    assert.equal((await t.owner.get("/api/domain/routing")).data.dmz, "198.51.100.20");
    const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
    await applyPreview(t, undo.data);
    assert.deepEqual([n.sr_rulelist, n.upnp_enable, n.autofw_rulelist, n.dmz_ip], ["<203.0.113.0>255.255.255.0>198.51.100.2>1>LAN", "1", "", ""]);
  } finally {
    await t.stop();
  }
});

test("routing: the DMZ host can be switched off by emptying it, and the UPnP clean-up settings apply on Merlin", async () => {
  const t = await startApp();
  try {
    await change(t, [{ id: "routing.dmz", value: "198.51.100.20" }]);
    await change(t, [{ id: "routing.dmz", value: "" }, { id: "routing.upnp-interval", value: "900" }, { id: "routing.upnp-threshold", value: "50" }, { id: "routing.natpmp", value: "1" }]);
    assert.deepEqual([t.router.nvram.dmz_ip, t.router.nvram.upnp_clean_interval, t.router.nvram.upnp_clean_threshold, t.router.nvram.upnp_mnp], ["", "900", "50", "1"]);
  } finally {
    await t.stop();
  }
});

test("routing: wrong values and bad lists are refused with a clear reason", async () => {
  const t = await startApp();
  try {
    const refuse = async (id, value, pattern) => {
      const res = await t.owner.post("/api/changes/preview", { changes: [{ id, value }] });
      assert.equal(res.status, 400, `${id} = ${value}`);
      if (pattern) assert.match(res.data.error, pattern);
    };
    await refuse("routing.dmz", "198.51.100.999");
    await refuse("routing.dmz", "my-nas");
    await refuse("routing.static-routes", "<203.0.113.0>255.255.255.0>198.51.100.2>1", /5 columns/);
    await refuse("routing.static-routes", "<203.0.113.0>255.0.255.0>198.51.100.2>1>LAN", /listed options/);
    await refuse("routing.static-routes", "<203.0.113.0>255.255.255.0>198.51.100.2>999>LAN", /0 to 255/);
    await refuse("routing.static-routes", "<203.0.113.0>255.255.255.0>198.51.100.2>1>DSL", /listed options/);
    await refuse("routing.static-routes", "<203.0.113.0>255.255.255.0>nowhere>1>LAN", /IPv4/);
    await refuse("routing.triggers", "<Lobby>99999>TCP>6881>UDP", /port/);
    await refuse("routing.triggers", "<Lobby>6667>ICMP>6881>UDP", /listed options/);
    await refuse("routing.triggers", "<Lobby>9000:8000>TCP>6881>UDP", /port/);
    await refuse("routing.triggers", "<<>>>>>", null);
    await refuse("routing.upnp-interval", "5");
    await refuse("routing.upnp", "maybe");
    assert.equal(t.router.nvram.dmz_ip, "");
  } finally {
    await t.stop();
  }
});

test("routing: Merlin-only UPnP items are visible but disabled on the stock firmware, with the reason", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const entries = await mine(t);
    for (const id of ["upnp-secure", "upnp-clean", "upnp-interval", "upnp-threshold", "natpmp"]) assert.ok(entries.find((e) => e.id === `routing.${id}`).disabled?.en.includes("Merlin"), id);
    assert.equal(entries.find((e) => e.id === "routing.upnp").disabled, null);
    assert.equal(entries.find((e) => e.id === "routing.dmz").disabled, null);
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "routing.natpmp", value: "1" }] })).status, 400);
  } finally {
    await t.stop();
  }
});

test("routing: the route table and UPnP routes read the router, and roles apply", async () => {
  const t = await startApp();
  try {
    const routes = (await t.owner.get("/api/x/routing/kernel-routes")).data.routes;
    assert.equal(routes.length, 3);
    assert.equal(routes[0].gateway, "100.64.0.1");
    assert.equal((await t.owner.get("/api/x/routing/upnp-mappings")).data.mappings.length, 2);
    assert.ok(t.router.commands.includes("head -n 100000 /proc/net/route"));
    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201, viewer.text);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/x/routing/kernel-routes")).status, 200);
    assert.equal((await t.client().get("/api/x/routing/kernel-routes")).status, 401);
    const look = await guest.post("/api/changes/preview", { changes: [{ id: "routing.dmz", value: "198.51.100.20" }] });
    assert.equal((await guest.post("/api/changes/apply", { previewId: look.data.id })).status, 403, "viewers cannot change settings");
  } finally {
    await t.stop();
  }
});

test("routing: the browser module is well formed and brings its list editors and device picker", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/routing/index.js"));
    assert.ok(manifest.styles.includes("/js/features/routing/style.css"));
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "routing"), null);
  assert.deepEqual(Object.keys(feature.controls).sort(), ["deviceip", "routetable", "triggertable"]);
});
