// DNS Pro: DNS over TLS, DNSSEC and rebinding protection, DNS Director with
// per-device rules, and the Dynamic DNS account read the router's real values
// and change through the change engine. The presets and the lookup work, and
// Merlin-only items stay visible but disabled on the stock firmware.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/dns-pro/index.js";
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

const mine = async (t) => (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "dns-pro");

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

test("dns-pro: the settings read the router, the lists are typed tables and the screen brings the stock DNS and Dynamic DNS settings", async () => {
  const t = await startApp();
  try {
    const entries = await mine(t);
    for (const id of ["dot-enable", "dot-profile", "dot-servers", "dnssec", "dnssec-unsigned", "rebind", "forward-local", "director-enable", "director-mode", "custom1", "custom2", "custom3", "director-devices", "ddns-user", "ddns-password", "ddns-wildcard", "ddns-refresh", "ddns-period", "ddns-check"])
      assert.ok(entries.some((e) => e.id === `dns-pro.${id}`), `${id} is missing`);
    const servers = entries.find((e) => e.id === "dns-pro.dot-servers");
    assert.equal(servers.control, "dotservers");
    assert.deepEqual(servers.columns.map((c) => c.id), ["ip", "port", "tls", "pin"]);
    assert.equal(servers.value, "<1.1.1.1>853>cloudflare-dns.com>");
    assert.equal(entries.find((e) => e.id === "dns-pro.director-devices").control, "dnsclients");
    assert.equal(entries.find((e) => e.id === "dns-pro.ddns-password").secret, true);
    for (const e of entries.filter((x) => x.control === "text")) assert.ok(e.freeText && e.freeTextReason.length > 10, e.id);
    rulesAreReal(entries);

    const domain = (await t.owner.get("/api/domain/dns-pro")).data;
    assert.deepEqual(domain.stock.map((e) => e.id).sort(), ["ddns.enabled", "ddns.host", "ddns.server", "wan.dns1", "wan.dns2", "wan.dnsauto"]);
    assert.deepEqual(domain.presets.map((p) => p.id), ["cloudflare", "google", "quad9", "adguard", "opendns"], "the four main presets are there");
    assert.equal(domain.usingProvider, true);
    assert.equal(domain.merlin, true);
    assert.ok(domain.inProgress.length === 1 && /providers/i.test(domain.inProgress[0].label.en), "the missing Dynamic DNS providers are listed as in progress, not faked");
    assert.deepEqual(domain.suffixes["WWW.ASUS.COM"], ["asuscomm.com", "asuscomm.cn"]);
  } finally {
    await t.stop();
  }
});

test("dns-pro: DNS over TLS, safety checks, DNS Director and the Dynamic DNS account are written, read back and undone", async () => {
  const t = await startApp();
  try {
    const record = await change(t, [
      { id: "dns-pro.dot-enable", value: "1" },
      { id: "dns-pro.dot-profile", value: "0" },
      { id: "dns-pro.dot-servers", value: "<9.9.9.9>853>dns.quad9.net><149.112.112.112>853>dns.quad9.net>sha256pin=" },
      { id: "dns-pro.dnssec", value: "1" },
      { id: "dns-pro.rebind", value: "0" },
      { id: "dns-pro.director-enable", value: "1" },
      { id: "dns-pro.director-mode", value: "2" },
      { id: "dns-pro.custom1", value: "203.0.113.53" },
      { id: "dns-pro.director-devices", value: "<Kids tablet>f0:18:98:aa:bb:01>7<Guest>ac:5a:f0:01:02:03>11" },
      { id: "dns-pro.ddns-user", value: "pat" },
      { id: "dns-pro.ddns-password", value: "a provider key" },
      { id: "dns-pro.ddns-refresh", value: "1" },
      { id: "dns-pro.ddns-period", value: "30" },
    ]);
    const n = t.router.nvram;
    assert.deepEqual([n.dnspriv_enable, n.dnspriv_profile, n.dnssec_enable, n.dns_norebind, n.dnsfilter_enable_x, n.dnsfilter_mode, n.dnsfilter_custom1], ["1", "0", "1", "0", "1", "2", "203.0.113.53"]);
    assert.equal(n.dnspriv_rulelist, "<9.9.9.9>853>dns.quad9.net><149.112.112.112>853>dns.quad9.net>sha256pin=");
    assert.equal(n.dnsfilter_rulelist, "<Kids tablet>F0:18:98:AA:BB:01>7<Guest>AC:5A:F0:01:02:03>11", "MAC addresses are stored in upper case");
    assert.deepEqual([n.ddns_username_x, n.ddns_passwd_x, n.ddns_regular_check, n.ddns_regular_period], ["pat", "a provider key", "1", "30"]);
    for (const service of ["restart_stubby", "restart_dnsfilter", "restart_ddns", "restart_dnsmasq"]) assert.ok(t.router.services.includes(service), service);
    const secret = (await mine(t)).find((e) => e.id === "dns-pro.ddns-password");
    assert.deepEqual([secret.value, secret.masked], ["", true]);
    const undo = await t.owner.post(`/api/changes/${record.id}/undo`);
    await applyPreview(t, undo.data);
    assert.deepEqual([n.dnspriv_enable, n.dnsfilter_rulelist, n.ddns_passwd_x, n.dnssec_enable], ["0", "", "", "0"]);
  } finally {
    await t.stop();
  }
});

test("dns-pro: wrong values and bad lists are refused", async () => {
  const t = await startApp();
  try {
    const refuse = async (id, value, pattern) => {
      const res = await t.owner.post("/api/changes/preview", { changes: [{ id, value }] });
      assert.equal(res.status, 400, `${id} = ${value}`);
      if (pattern) assert.match(res.data.error, pattern);
    };
    await refuse("dns-pro.dot-profile", "2");
    await refuse("dns-pro.dot-servers", "<1.1.1.1>853>cloudflare-dns.com", /4 columns/);
    await refuse("dns-pro.dot-servers", "<1.1.1.999>853>cloudflare-dns.com>", /IPv4/);
    await refuse("dns-pro.dot-servers", "<1.1.1.1>0>cloudflare-dns.com>", /whole number from 1 to 65535/);
    await refuse("dns-pro.dot-servers", "<1.1.1.1>853>not a host>", /host name/);
    await refuse("dns-pro.dot-servers", "<1.1.1.1>853>a.example.test><1.0.0.1>853>b.example.test><1.1.1.1>853>c.example.test><1.0.0.1>853>d.example.test><1.1.1.1>853>e.example.test><1.0.0.1>853>f.example.test><1.1.1.1>853>g.example.test><1.0.0.1>853>h.example.test><1.1.1.1>853>i.example.test>", /at most 8/);
    await refuse("dns-pro.director-mode", "99");
    await refuse("dns-pro.director-devices", "<Kids>nope>1", /MAC address/);
    await refuse("dns-pro.director-devices", "<Kids>f0:18:98:aa:bb:01>99", /listed options/);
    await refuse("dns-pro.director-devices", "<A>f0:18:98:aa:bb:01>1<B>F0:18:98:AA:BB:01>2", /used twice/);
    await refuse("dns-pro.custom2", "999.9.9.9");
    await refuse("dns-pro.ddns-period", "0");
    await refuse("dns-pro.ddns-user", "<b>");
    await refuse("dns-pro.ddns-password", "");
    assert.equal(t.router.nvram.dnspriv_enable, "0");
  } finally {
    await t.stop();
  }
});

test("dns-pro: Merlin-only items are visible but disabled on the stock firmware, with the reason", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const entries = await mine(t);
    for (const id of ["dot-enable", "dot-servers", "director-enable", "director-mode", "director-devices", "forward-local"]) {
      const entry = entries.find((e) => e.id === `dns-pro.${id}`);
      assert.ok(entry.disabled?.en.includes("Merlin"), id);
    }
    assert.equal(entries.find((e) => e.id === "dns-pro.dnssec").disabled, null, "DNSSEC is available on the stock firmware");
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "dns-pro.dot-enable", value: "1" }] })).status, 400);
    const preset = await t.owner.post("/api/x/dns-pro/preset", { id: "cloudflare", mode: "dot" });
    assert.equal(preset.status, 400, "an encrypted preset cannot be queued without Merlin");
    assert.equal((await t.owner.get("/api/domain/dns-pro")).data.merlin, false);
  } finally {
    await t.stop();
  }
});

test("dns-pro: presets fill the stock name servers through the change engine, and back to the provider's", async () => {
  const t = await startApp();
  try {
    const list = (await t.owner.get("/api/x/dns-pro/presets")).data.presets;
    assert.ok(["cloudflare", "google", "quad9", "adguard"].every((id) => list.some((p) => p.id === id)));

    const preset = await t.owner.post("/api/x/dns-pro/preset", { id: "cloudflare", mode: "dns" });
    assert.equal(preset.status, 200, preset.text);
    assert.deepEqual(preset.data.preview.items.map((i) => [i.key, i.new]), [["wan_dnsenable_x", "0"], ["wan_dns1_x", "1.1.1.1"], ["wan_dns2_x", "1.0.0.1"]]);
    await applyPreview(t, preset.data.preview);
    assert.deepEqual([t.router.nvram.wan_dnsenable_x, t.router.nvram.wan_dns1_x, t.router.nvram.wan_dns2_x], ["0", "1.1.1.1", "1.0.0.1"]);

    const both = await t.owner.post("/api/x/dns-pro/preset", { id: "quad9", mode: "both" });
    assert.equal(both.status, 200, both.text);
    await applyPreview(t, both.data.preview);
    assert.deepEqual([t.router.nvram.wan_dns1_x, t.router.nvram.dnspriv_enable, t.router.nvram.dnspriv_rulelist], ["9.9.9.9", "1", "<9.9.9.9>853>dns.quad9.net>"]);

    const back = await t.owner.post("/api/x/dns-pro/preset", { id: "provider" });
    await applyPreview(t, back.data.preview);
    assert.equal(t.router.nvram.wan_dnsenable_x, "1");

    assert.equal((await t.owner.post("/api/x/dns-pro/preset", { id: "nobody" })).status, 404);
    assert.equal((await t.owner.post("/api/x/dns-pro/preset", { id: "opendns", mode: "dot" })).status, 400, "OpenDNS has no encrypted server in the list");
    assert.equal((await t.owner.post("/api/x/dns-pro/preset", { id: "google", mode: "nonsense" })).status, 400);
  } finally {
    await t.stop();
  }
});

test("dns-pro: the lookup route asks the router and checks the name first, and roles apply", async () => {
  const t = await startApp();
  try {
    const found = (await t.owner.get("/api/x/dns-pro/lookup?name=example.test")).data;
    assert.deepEqual([found.ok, found.name, found.addresses], [true, "example.test", ["93.184.216.34"]]);
    assert.ok(t.router.commands.includes("nslookup example.test"));
    assert.equal((await t.owner.get("/api/x/dns-pro/lookup?name=" + encodeURIComponent("x; reboot"))).status, 400);
    assert.ok(!t.router.rebooted);
    const viewer = await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    assert.equal(viewer.status, 201, viewer.text);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/x/dns-pro/lookup?name=example.test")).status, 200);
    assert.equal((await guest.post("/api/x/dns-pro/preset", { id: "google" })).status, 403);
  } finally {
    await t.stop();
  }
});

test("dns-pro: the browser module is well formed and brings its two list editors", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/dns-pro/index.js"));
    assert.ok(manifest.styles.includes("/js/features/dns-pro/style.css"));
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "dns-pro"), null);
  assert.deepEqual(Object.keys(feature.controls).sort(), ["dnsclients", "dotservers"]);
});
