// IPv6: the connection types, prefix, name servers and DHCPv6 settings read the
// router's real values and change through the change engine. The IPv6 address
// and pool controls this feature adds check what they are given.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/ipv6/index.js";
import { compressIpv6, expandIpv6, kindOfIpv6, parseIpv6 } from "../../server/features/ipv6/index.mjs";
import { startApp, waitFor } from "../helpers.mjs";

const settle = async (t, record) =>
  record.status === "guarded" || record.status === "applying"
    ? waitFor(async () => {
        const next = (await t.owner.get(`/api/changes/history/${record.id}`)).data;
        return next.status !== "guarded" && next.status !== "applying" ? next : null;
      })
    : record;

async function change(t, changes) {
  const preview = await t.owner.post("/api/changes/preview", { changes });
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  const record = await settle(t, applied.data);
  assert.equal(record.status, "applied");
  return record;
}

const mine = async (t) => (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "ipv6");

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

test("ipv6: reading, compressing and classifying addresses", () => {
  assert.deepEqual(parseIpv6("2001:db8::1"), [0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual(parseIpv6("::"), [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(parseIpv6("1:2:3:4:5:6:7:8"), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const bad of ["", "1", "2001:db8:::1", "2001:db8::1::2", "1:2:3:4:5:6:7", "1:2:3:4:5:6:7:8:9", "12345::1", "2001:db8::g", ":1:2:3:4:5:6:7", "1:2:3:4:5:6:7:"]) assert.equal(parseIpv6(bad), null, bad);
  assert.equal(compressIpv6(parseIpv6("2001:0DB8:0000:0000:0000:0000:0000:0001")), "2001:db8::1");
  assert.equal(compressIpv6(parseIpv6("2001:db8:0:1:0:0:0:1")), "2001:db8:0:1::1", "the longest run of zeros is the one that is shortened");
  assert.equal(compressIpv6(parseIpv6("2001:db8:0:1:1:1:1:1")), "2001:db8:0:1:1:1:1:1", "a single zero group is not shortened");
  assert.equal(compressIpv6(parseIpv6("::")), "::");
  assert.equal(expandIpv6(parseIpv6("2001:db8::1")), "2001:0db8:0000:0000:0000:0000:0000:0001");
  const kinds = { "2001:db8::1": "documentation", "fe80::1": "link-local", "fd12:3456::1": "unique-local", "::1": "loopback", "::": "unspecified", "ff02::1": "multicast", "2606:4700::1111": "global" };
  for (const [address, kind] of Object.entries(kinds)) assert.equal(kindOfIpv6(parseIpv6(address)), kind, address);
});

test("ipv6: every connection type and its fields are in the catalogue and read the router", async () => {
  const t = await startApp();
  try {
    const entries = await mine(t);
    const service = entries.find((e) => e.id === "ipv6.service");
    assert.deepEqual(service.options.map(([v]) => v), ["disabled", "dhcp6", "static6", "ipv6pt", "6in4", "6rd", "6to4", "flets"]);
    assert.equal(service.value, "disabled");
    for (const id of ["pd", "pd-length", "address", "wan-prefix", "gateway", "tun-end", "tun-address", "tun-length", "tun-mtu", "tun-ttl", "6rd-auto", "6rd-prefix", "6rd-length", "6rd-relay", "6rd-ip4", "dns-auto", "dns1", "dns2", "dns3", "router-address", "lan-prefix", "lan-prefix-length", "autoconf", "pool-start", "pool-end", "lease"])
      assert.ok(entries.some((e) => e.id === `ipv6.${id}`), `${id} is missing`);
    assert.equal(entries.find((e) => e.id === "ipv6.address").control, "ipv6addr");
    assert.equal(entries.find((e) => e.id === "ipv6.pool-start").value, "1000");
    rulesAreReal(entries);
    const domain = (await t.owner.get("/api/domain/ipv6")).data;
    assert.deepEqual([domain.service, domain.firewall], ["disabled", true]);
  } finally {
    await t.stop();
  }
});

test("ipv6: a native setup and a static setup are written, read back and undone", async () => {
  const t = await startApp();
  try {
    const native = await change(t, [
      { id: "ipv6.service", value: "dhcp6" },
      { id: "ipv6.pd-length", value: "56" },
      { id: "ipv6.autoconf", value: "1" },
      { id: "ipv6.pool-start", value: "1A00" },
      { id: "ipv6.pool-end", value: "1f00" },
      { id: "ipv6.lease", value: "7200" },
      { id: "ipv6.dns-auto", value: "0" },
      { id: "ipv6.dns1", value: "2606:4700:4700:0:0:0:0:1111" },
    ]);
    assert.deepEqual([t.router.nvram.ipv6_service, t.router.nvram.ipv6_dhcp_pd_len, t.router.nvram.ipv6_autoconf_type], ["dhcp6", "56", "1"]);
    assert.deepEqual([t.router.nvram.ipv6_dhcp_start, t.router.nvram.ipv6_dhcp_end], ["1a00", "1f00"], "pool ends are stored in lower case");
    assert.equal(t.router.nvram.ipv6_dns1, "2606:4700:4700::1111", "addresses are stored in their short form");
    assert.ok(t.router.services.includes("restart_wan_if 0") && t.router.services.includes("restart_dnsmasq"));

    await change(t, [
      { id: "ipv6.service", value: "static6" },
      { id: "ipv6.address", value: "2001:db8:10::2" },
      { id: "ipv6.wan-prefix", value: "64" },
      { id: "ipv6.gateway", value: "2001:db8:10::1" },
      { id: "ipv6.lan-prefix", value: "2001:DB8:20:0:0:0:0:0" },
      { id: "ipv6.lan-prefix-length", value: "60" },
    ]);
    assert.deepEqual([t.router.nvram.ipv6_ipaddr, t.router.nvram.ipv6_prefix, t.router.nvram.ipv6_prefix_length], ["2001:db8:10::2", "2001:db8:20::", "60"]);

    const undo = await t.owner.post(`/api/changes/${native.id}/undo`);
    assert.equal(undo.status, 200, undo.text);
    assert.equal((await settle(t, (await t.owner.post("/api/changes/apply", { previewId: undo.data.id })).data)).status, "applied");
    assert.equal(t.router.nvram.ipv6_service, "disabled");
  } finally {
    await t.stop();
  }
});

test("ipv6: 6in4 and 6rd fields are written, and wrong values are refused", async () => {
  const t = await startApp();
  try {
    await change(t, [
      { id: "ipv6.service", value: "6in4" },
      { id: "ipv6.tun-end", value: "203.0.113.77" },
      { id: "ipv6.tun-address", value: "2001:db8:ff::2" },
      { id: "ipv6.tun-mtu", value: "1400" },
    ]);
    assert.deepEqual([t.router.nvram.ipv6_tun_v4end, t.router.nvram.ipv6_tun_addr, t.router.nvram.ipv6_tun_mtu], ["203.0.113.77", "2001:db8:ff::2", "1400"]);
    await change(t, [{ id: "ipv6.service", value: "6rd" }, { id: "ipv6.6rd-auto", value: "0" }, { id: "ipv6.6rd-prefix", value: "2001:db8::" }, { id: "ipv6.6rd-relay", value: "203.0.113.5" }, { id: "ipv6.6rd-ip4", value: "8" }]);
    assert.deepEqual([t.router.nvram.ipv6_6rd_prefix, t.router.nvram.ipv6_6rd_router, t.router.nvram.ipv6_6rd_ip4size], ["2001:db8::", "203.0.113.5", "8"]);

    const refuse = async (id, value) => assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id, value }] })).status, 400, `${id} = ${value}`);
    await refuse("ipv6.service", "magic");
    await refuse("ipv6.address", "2001:db8::zz");
    await refuse("ipv6.address", "203.0.113.5");
    await refuse("ipv6.gateway", "1:2:3");
    await refuse("ipv6.pool-start", "12345");
    await refuse("ipv6.pool-end", "xyz!");
    await refuse("ipv6.tun-mtu", "1000");
    await refuse("ipv6.tun-end", "2001:db8::1");
    await refuse("ipv6.lan-prefix-length", "65");
    await refuse("ipv6.lease", "10");
  } finally {
    await t.stop();
  }
});

test("ipv6: the address checker route explains an address, and viewers may read but not write", async () => {
  const t = await startApp();
  try {
    const ok = (await t.owner.post("/api/x/ipv6/check-address", { address: "2001:0db8:0000:0000:0000:0000:0000:0001" })).data;
    assert.deepEqual(ok, { valid: true, compressed: "2001:db8::1", expanded: "2001:0db8:0000:0000:0000:0000:0000:0001", kind: "documentation" });
    assert.deepEqual((await t.owner.post("/api/x/ipv6/check-address", { address: "nonsense" })).data, { valid: false });
    assert.equal((await t.owner.post("/api/x/ipv6/check-address", { address: "::1" }, { csrf: "wrong" })).status, 403);
    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201, viewer.text);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/domain/ipv6")).status, 200);
    assert.equal((await guest.post("/api/x/ipv6/check-address", { address: "::1" })).status, 403);
  } finally {
    await t.stop();
  }
});

test("ipv6: the browser module is well formed, brings its two controls and the manifest lists it", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/ipv6/index.js"));
    assert.ok(manifest.styles.includes("/js/features/ipv6/style.css"));
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "ipv6"), null);
  assert.deepEqual(Object.keys(feature.controls).sort(), ["hexpart", "ipv6addr"]);
});
