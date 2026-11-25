// vpn-pro: the QR encoder, WireGuard keys and peers, the OpenVPN profile in
// and out, OpenVPN accounts, VPN Director rules, the gated and Merlin-only
// settings, and the browser module. Every catalogue entry is also proved by
// tests/real-controls.test.mjs (read, write, read back, undo).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { readProfile, serverProfile } from "../../server/features/vpn-pro/openvpn.mjs";
import { clientConfig, formatPeers, generateKeyPair, isCidr, isShared, lanNetwork, networkOf, nextAddress, parsePeers, privateKeyBytes, publicKeyOf } from "../../server/features/vpn-pro/wireguard.mjs";
import { policyProblem } from "../../public/js/features/vpn-pro/director.js";
import feature, { SECTIONS } from "../../public/js/features/vpn-pro/index.js";
import { capacity, encodeQr } from "../../public/js/features/vpn-pro/qr.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp, waitFor } from "../helpers.mjs";

const apply = async (t, preview) => {
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.id });
  assert.equal(applied.status, 200, applied.text);
  return waitFor(async () => {
    const record = (await t.owner.get(`/api/changes/history/${applied.data.id}`)).data;
    return record.status !== "guarded" && record.status !== "applying" ? record : null;
  });
};
const DELETE = (t, url) => t.owner.request("DELETE", url);
const hex = (text) => Buffer.from(text, "hex");

// ---- the QR encoder ------------------------------------------------------------

const matrixHash = (q) => createHash("sha256").update(q.modules.map((r) => r.map((d) => (d ? 1 : 0)).join("")).join("\n")).digest("hex").slice(0, 16);

test("vpn-pro: the QR encoder makes well-formed codes, checked against an independent decoder when it was written", () => {
  // These two matrices were decoded back to their text with OpenCV when the encoder was written.
  const small = encodeQr("HELLO");
  assert.deepEqual([small.version, small.size, small.ecl, small.mask, matrixHash(small)], [1, 21, "M", 3, "71bc9ab3ffcaa0d2"]);
  const big = encodeQr("y".repeat(600));
  assert.deepEqual([big.version, big.size, big.mask, matrixHash(big)], [19, 93, 2, "2774d34f1fc35f25"]);

  for (const q of [small, big, encodeQr("[Interface]\nPrivateKey = x\n".repeat(8)), encodeQr("ünï 香港")]) {
    const { size, modules } = q;
    const finder = (x0, y0) => {
      for (let d = 0; d < 7; d += 1) for (const [x, y] of [[x0 + d, y0], [x0 + d, y0 + 6], [x0, y0 + d], [x0 + 6, y0 + d]]) assert.equal(modules[y][x], true, "finder border");
      assert.equal(modules[y0 + 3][x0 + 3], true, "finder centre");
      assert.equal(modules[y0 + 1][x0 + 1], false, "finder gap");
    };
    finder(0, 0);
    finder(size - 7, 0);
    finder(0, size - 7);
    for (let i = 8; i < size - 8; i += 1) assert.equal(modules[6][i], i % 2 === 0, "timing row");
    assert.equal(modules[size - 8][8], true, "the one fixed dark module");
    // Both copies of the format bits agree and form a valid BCH code word.
    const first = [0, 1, 2, 3, 4, 5, 7, 8].map((i) => modules[i === 8 ? 8 : i][8]);
    void first;
    const bits = (cells) => cells.reduce((n, dark, i) => n | (dark ? 1 << i : 0), 0);
    const a = bits([...[0, 1, 2, 3, 4, 5].map((i) => modules[i][8]), modules[7][8], modules[8][8], modules[8][7], ...[9, 10, 11, 12, 13, 14].map((i) => modules[8][14 - i])]);
    const b = bits([...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => modules[8][size - 1 - i]), ...[8, 9, 10, 11, 12, 13, 14].map((i) => modules[size - 15 + i][8])]);
    assert.equal(a, b, "the two format copies match");
    const word = a ^ 0x5412;
    let rem = word >>> 10;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    assert.equal((rem & 0x3ff), word & 0x3ff, "format bits carry a valid error check");
  }
  assert.equal(encodeQr("x".repeat(15), "L").ecl, "L");
  assert.ok(capacity("M") > 900 && capacity("L") > capacity("M"));
  assert.throws(() => encodeQr("z".repeat(5000)), /too long/);
  assert.equal(encodeQr("w".repeat(1100)).ecl, "L", "very long text falls back to the lighter error correction");
});

// ---- WireGuard keys and peers ----------------------------------------------------

test("vpn-pro: WireGuard keys follow RFC 7748 and the peer list round-trips", () => {
  // The first test vector of RFC 7748 section 6.1 (Alice).
  const alice = hex("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a");
  assert.equal(publicKeyOf(alice).toString("hex"), "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a");
  const clamped = privateKeyBytes(Buffer.alloc(32, 0xff));
  assert.deepEqual([clamped[0], clamped[31]], [0xf8, 0x7f], "the key is adjusted the way the protocol requires");
  const pair = generateKeyPair();
  assert.match(pair.private, /^[A-Za-z0-9+/]{43}=$/);
  assert.match(pair.public, /^[A-Za-z0-9+/]{43}=$/);
  assert.equal(publicKeyOf(Buffer.from(pair.private, "base64")).toString("base64"), pair.public);
  assert.notEqual(generateKeyPair().private, pair.private, "every key is new");

  const peers = [{ name: "Pat phone", address: "192.0.2.2", publicKey: pair.public, privateKey: pair.private, psk: "", allowedIps: ["192.0.2.2/32"] }, { name: "Alex laptop", address: "192.0.2.3", publicKey: generateKeyPair().public, privateKey: "", psk: "", allowedIps: ["192.0.2.3/32", "203.0.113.0/24"] }];
  assert.deepEqual(parsePeers(formatPeers(peers)), peers);
  assert.deepEqual(parsePeers("<bad name!>1.2.3.4>nope>>>"), [], "rows with bad names, addresses or keys are dropped");
  assert.equal(nextAddress("192.0.2.1/24", peers), "192.0.2.4");
  assert.equal(nextAddress("192.0.2.1/30", [{ address: "192.0.2.2" }]), null, "a /30 has room for the router and one device");
  assert.deepEqual(networkOf("192.0.2.77/24"), { start: 3221225984, size: 256, prefix: 24, ip: "192.0.2.77", text: "192.0.2.0/24" });
  assert.equal(lanNetwork("198.51.100.1", "255.255.255.0"), "198.51.100.0/24");
  assert.deepEqual([isCidr("198.51.100.0/24"), isCidr("198.51.100.0/33"), isCidr("198.51.100.0")], [true, false, false]);
  assert.deepEqual([isShared("100.64.12.34"), isShared("100.128.0.1"), isShared("203.0.113.9")], [true, false, false]);
  const text = clientConfig({ peer: peers[0], serverPublic: "S".repeat(43) + "=", host: "home.example.test", port: "51820", dns: "198.51.100.1", allowed: ["0.0.0.0/0"] });
  assert.match(text, /^\[Interface\]\nPrivateKey = .{44}\nAddress = 192\.0\.2\.2\/32\nDNS = 198\.51\.100\.1\n\n\[Peer\]\nPublicKey = S{43}=\nEndpoint = home\.example\.test:51820\nAllowedIPs = 0\.0\.0\.0\/0\nPersistentKeepalive = 25\n$/);
});

// ---- OpenVPN profiles -------------------------------------------------------------

test("vpn-pro: a provider profile is read for its settings and its certificates are counted, never copied", () => {
  const text = "client\ndev tun\nproto udp\nremote vpn.example.test 443 # main\nredirect-gateway def1\nauth-user-pass\n<ca>\n-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n</ca>\n<tls-crypt>\nsecretkeydata\n</tls-crypt>\n";
  const out = readProfile(text, "Work VPN (main).ovpn");
  assert.deepEqual(out.settings, { addr: "vpn.example.test", port: "443", proto: "udp", rgw: "1", desc: "Work VPN main" });
  assert.equal(out.needsLogin, true);
  assert.deepEqual(out.certs.map((c) => c.name), ["ca", "tls-crypt"]);
  assert.ok(!JSON.stringify(out).includes("secretkeydata"));
  assert.equal(readProfile("remote 203.0.113.9 1194 tcp\n").settings.proto, "tcp-client");
  assert.deepEqual(Object.keys(readProfile("remote a.example.test\n").settings), ["addr", "port", "proto"], "no redirect line means the all-traffic choice is left alone");
  for (const bad of ["", "client\ndev tun\n", "remote bad host!\n", "remote a.example.test 1194 sctp\n", "a\0b"]) assert.throws(() => readProfile(bad), undefined, JSON.stringify(bad));
  const profile = serverProfile({ host: "home.example.test", port: "1194", proto: "udp", cipher: "AES-256-GCM", userPass: true, ca: "-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----", staticKey: "" });
  assert.match(profile, /^client\ndev tun\nproto udp\nremote home\.example\.test 1194\n/);
  assert.match(profile, /data-ciphers AES-256-GCM\n/);
  assert.match(profile, /auth-user-pass\n<ca>\n-----BEGIN CERTIFICATE-----/);
  assert.doesNotMatch(profile, /tls-auth|key-direction/);
});

// ---- the screen data ----------------------------------------------------------------

test("vpn-pro: the screen data covers both servers, five clients of each kind, gated IPsec and the Director", async () => {
  const t = await startApp();
  try {
    const data = (await t.owner.get("/api/domain/vpn-pro")).data;
    const byId = Object.fromEntries(data.entries.map((e) => [e.id, e]));
    assert.ok(data.entries.length >= 90);
    assert.deepEqual([byId["vpn-pro.ovpn.subnet"].control, byId["vpn-pro.ovpn.size"].control, byId["vpn-pro.wg.address"].control, byId["vpn-pro.ovpnc.start"].control, byId["vpn-pro.ovpnc3.proto"].control, byId["vpn-pro.wgc5.address"].control], ["ipv4", "select", "cidr", "chips", "segmented", "cidr"]);
    assert.deepEqual(data.entries.filter((e) => e.group.startsWith("ovpnc") && e.group !== "ovpnc-start").map((e) => e.group).filter((g, i, a) => a.indexOf(g) === i), ["ovpnc1", "ovpnc2", "ovpnc3", "ovpnc4", "ovpnc5"]);
    for (const secret of ["vpn-pro.ovpn.users", "vpn-pro.wg.peers", "vpn-pro.wg.private", "vpn-pro.ovpnc1.password", "vpn-pro.wgc1.private"]) assert.deepEqual([byId[secret].secret, byId[secret].value], [true, ""], secret);
    assert.match(byId["vpn-pro.ipsec"].disabled.en, /does not support this \(ipsec_srv is missing\)/, "IPsec is shown, off, with the exact reason");
    assert.equal(byId["vpn-pro.wgc1.enable"].disabled, null);
    assert.equal(data.wireguard.publicKey.length, 44);
    assert.deepEqual(data.director.rules, [{ index: 0, enabled: true, desc: "Pat phone", local: "198.51.100.102", remote: "", iface: "WAN" }]);
    assert.deepEqual(data.fusion.profiles, [{ name: "Work VPN", type: "OpenVPN", server: "203.0.113.10" }]);
    assert.equal(data.endpoint.shared, true, "the pretend router sits behind a shared address");
    assert.equal(data.endpoint.warnings.length, 1);
    assert.ok(!JSON.stringify(data).includes((await t.app.session.nvram()).get("wgs_priv")), "the router private key never leaves the server");
    assert.ok(data.related.some((e) => e.id === "vpn.wireguard"));
  } finally {
    await t.stop();
  }
  assert.deepEqual(SECTIONS.map((s) => s.id), ["ovpn-server", "ovpn-clients", "wg-server", "wg-clients", "ipsec", "director"]);
});

test("vpn-pro: on stock firmware the WireGuard clients and VPN Director are visible but switched off with the reason", async () => {
  const t = await startApp({ firmware: "stock" });
  try {
    const entries = (await t.owner.get("/api/domain/vpn-pro")).data.entries;
    for (const id of ["vpn-pro.wgc1.enable", "vpn-pro.wgc4.host", "vpn-pro.director"]) assert.match(entries.find((e) => e.id === id).disabled.en, /Merlin/, id);
    assert.equal(entries.find((e) => e.id === "vpn-pro.ovpnc1.addr").disabled, null, "OpenVPN clients are on the stock firmware too");
    assert.equal((await t.owner.post("/api/x/vpn-pro/director/rules", { desc: "x", local: "198.51.100.5", iface: "WAN" })).status, 409);
  } finally {
    await t.stop();
  }
});

// ---- OpenVPN server -----------------------------------------------------------------

test("vpn-pro: the OpenVPN server profile holds the server's keys and warns when the address is shared", async () => {
  const t = await startApp();
  try {
    const shared = await t.owner.post("/api/x/vpn-pro/openvpn/export");
    assert.equal(shared.status, 200, shared.text);
    assert.equal(shared.data.filename, "home-vpn.ovpn");
    assert.match(shared.data.text, /remote 100\.64\.12\.34 1194\n/);
    assert.match(shared.data.text, /<ca>\n-----BEGIN CERTIFICATE-----/);
    assert.match(shared.data.text, /<tls-auth>\n-----BEGIN OpenVPN Static key V1-----/);
    assert.equal(shared.data.warnings.length, 1);
    assert.match(shared.data.warnings[0].en, /shares one address/);

    t.router.nvram.ddns_hostname_x = "pats-home.example.test";
    t.app.session.invalidate();
    const named = (await t.owner.post("/api/x/vpn-pro/openvpn/export")).data;
    assert.match(named.text, /remote pats-home\.example\.test 1194\n/);
    assert.deepEqual(named.warnings, []);

    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.post("/api/x/vpn-pro/openvpn/export")).status, 403, "viewers never get the keys");
    assert.equal((await t.client().post("/api/x/vpn-pro/openvpn/export")).status, 401);
  } finally {
    await t.stop();
  }
});

test("vpn-pro: OpenVPN accounts are added and removed through a preview that masks the passwords", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/x/vpn-pro/openvpn/users", { name: "bad name", password: "long-enough-1" })).status, 400);
    assert.equal((await t.owner.post("/api/x/vpn-pro/openvpn/users", { name: "pat", password: "short" })).status, 400);
    const add = await t.owner.post("/api/x/vpn-pro/openvpn/users", { name: "pat", password: "tea-and-egg-tarts" });
    assert.equal(add.status, 200, add.text);
    assert.ok(!JSON.stringify(add.data).includes("tea-and-egg"));
    assert.deepEqual(add.data.restarts, ["restart_vpnd"]);
    assert.equal((await apply(t, add.data)).status, "applied");
    assert.equal(t.router.nvram.vpn_server1_clientlist, "<pat>tea-and-egg-tarts");
    assert.deepEqual((await t.owner.get("/api/domain/vpn-pro")).data.openvpn.users, [{ name: "pat" }]);
    assert.equal((await t.owner.post("/api/x/vpn-pro/openvpn/users", { name: "PAT", password: "tea-and-egg-tarts" })).status, 409);
    const gone = await DELETE(t, "/api/x/vpn-pro/openvpn/users/pat");
    assert.equal((await apply(t, gone.data)).status, "applied");
    assert.equal(t.router.nvram.vpn_server1_clientlist, "");
    assert.equal((await DELETE(t, "/api/x/vpn-pro/openvpn/users/pat")).status, 404);
  } finally {
    await t.stop();
  }
});

test("vpn-pro: importing a provider profile fills in a client and says plainly what it could not store", async () => {
  const t = await startApp();
  try {
    const text = "client\nproto tcp-client\nremote vpn.example.test 443\nredirect-gateway def1\nauth-user-pass\n<ca>\nCERTDATA\n</ca>\n";
    assert.equal((await t.owner.post("/api/x/vpn-pro/openvpn/profile", { unit: 9, filename: "a.ovpn", text })).status, 400);
    assert.equal((await t.owner.post("/api/x/vpn-pro/openvpn/profile", { unit: 2, filename: "a.ovpn", text: "client\n" })).status, 400);
    const out = await t.owner.post("/api/x/vpn-pro/openvpn/profile", { unit: 2, filename: "Office.ovpn", text });
    assert.equal(out.status, 200, out.text);
    assert.deepEqual(out.data.settings, { addr: "vpn.example.test", port: "443", proto: "tcp-client", rgw: "1", desc: "Office" });
    assert.deepEqual([out.data.needsLogin, out.data.certificatesStored, out.data.certificates], [true, false, [{ name: "ca", bytes: 8 }]]);
    assert.deepEqual(out.data.preview.restarts, ["restart_vpnclient2"]);
    assert.equal(t.router.nvram.vpn_client2_addr, "", "reading a profile writes nothing");
    assert.equal((await apply(t, out.data.preview)).status, "applied");
    assert.deepEqual(["addr", "port", "proto", "rgw", "desc"].map((k) => t.router.nvram[`vpn_client2_${k}`]), ["vpn.example.test", "443", "tcp-client", "1", "Office"]);
    assert.equal(t.router.nvram.vpn_client1_addr, "", "only the chosen client changed");
    assert.ok(!JSON.stringify(t.router.commands).includes("CERTDATA"), "certificate text never reached the router");
  } finally {
    await t.stop();
  }
});

// ---- WireGuard -----------------------------------------------------------------------

test("vpn-pro: a WireGuard device is added with server-made keys, shown once, and can be rebuilt, edited and removed", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.owner.post("/api/x/vpn-pro/wireguard/peers", { name: "bad<name>" })).status, 400);
    assert.equal((await t.owner.post("/api/x/vpn-pro/wireguard/peers", { name: "Pat phone", allowedIps: ["nonsense"] })).status, 400);
    const add = await t.owner.post("/api/x/vpn-pro/wireguard/peers", { name: "Pat phone" });
    assert.equal(add.status, 200, add.text);
    const { peer, config, preview } = add.data;
    assert.deepEqual([peer.address, peer.allowedIps, peer.hasPsk], ["192.0.2.2", ["192.0.2.2/32"], true]);
    assert.ok(!JSON.stringify(peer).includes("rivate"), "the peer summary carries no key");
    assert.equal(preview.items[0].secret, true);
    assert.ok(!JSON.stringify(preview).includes(config.text.match(/PrivateKey = (\S+)/)[1]), "the preview masks the private key");
    assert.match(config.text, /Endpoint = 100\.64\.12\.34:51820\nAllowedIPs = 0\.0\.0\.0\/0, ::\/0\n/);
    assert.equal(config.warnings.length, 1, "the shared address is called out");
    assert.equal(t.router.nvram.wgs_clientlist, "", "nothing is stored until the preview is applied");
    assert.equal((await apply(t, preview)).status, "applied");

    const stored = parsePeers(t.router.nvram.wgs_clientlist);
    assert.equal(stored.length, 1);
    const key = config.text.match(/PrivateKey = (\S+)/)[1];
    assert.equal(stored[0].privateKey, key, "the router keeps the key that went into the file");
    assert.equal(publicKeyOf(Buffer.from(key, "base64")).toString("base64"), stored[0].publicKey, "and its public half is right");
    assert.match(config.text, new RegExp(`PublicKey = ${t.router.nvram.wgs_pub.replace(/[+/]/g, "\\$&")}\\n`));

    assert.equal((await t.owner.post("/api/x/vpn-pro/wireguard/peers", { name: "pat PHONE" })).status, 409);
    const second = await t.owner.post("/api/x/vpn-pro/wireguard/peers", { name: "Alex laptop", allowedIps: ["203.0.113.0/24"], psk: false });
    assert.deepEqual([second.data.peer.address, second.data.peer.allowedIps, second.data.peer.hasPsk], ["192.0.2.3", ["192.0.2.3/32", "203.0.113.0/24"], false]);
    assert.equal((await apply(t, second.data.preview)).status, "applied");

    const lan = (await t.owner.post("/api/x/vpn-pro/wireguard/peers/Pat%20phone/config", { mode: "lan" })).data;
    assert.match(lan.text, /AllowedIPs = 192\.0\.2\.0\/24, 198\.51\.100\.0\/24\n/);
    assert.equal(lan.filename, "Pat-phone.conf");
    assert.equal((await t.owner.post("/api/x/vpn-pro/wireguard/peers/Nobody/config", {})).status, 404);

    const edit = await t.owner.request("PATCH", "/api/x/vpn-pro/wireguard/peers/Alex%20laptop", { allowedIps: ["198.51.100.0/24", "192.0.2.3/32"] });
    assert.equal((await apply(t, edit.data)).status, "applied");
    assert.deepEqual(parsePeers(t.router.nvram.wgs_clientlist).find((p) => p.name === "Alex laptop").allowedIps, ["192.0.2.3/32", "198.51.100.0/24"]);

    const view = (await t.owner.get("/api/domain/vpn-pro")).data.wireguard;
    assert.deepEqual(view.peers.map((p) => p.name), ["Pat phone", "Alex laptop"]);
    assert.ok(!JSON.stringify(view).includes(key), "the list shown on screen never carries a private key");

    const gone = await DELETE(t, "/api/x/vpn-pro/wireguard/peers/Pat%20phone");
    assert.equal((await apply(t, gone.data)).status, "applied");
    assert.deepEqual(parsePeers(t.router.nvram.wgs_clientlist).map((p) => p.name), ["Alex laptop"]);
    assert.equal((await DELETE(t, "/api/x/vpn-pro/wireguard/peers/Pat%20phone")).status, 404);
    const third = await t.owner.post("/api/x/vpn-pro/wireguard/peers", { name: "Sam tablet" });
    assert.equal(third.data.peer.address, "192.0.2.2", "a freed address is handed out again");
  } finally {
    await t.stop();
  }
});

test("vpn-pro: a device configuration needs write access, and a router without a key says so", async () => {
  const t = await startApp();
  try {
    const add = await t.owner.post("/api/x/vpn-pro/wireguard/peers", { name: "Pat phone" });
    await apply(t, add.data.preview);
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/domain/vpn-pro")).status, 200);
    assert.equal((await guest.post("/api/x/vpn-pro/wireguard/peers/Pat%20phone/config", { mode: "full" })).status, 403, "the private key stays behind the write role");
    assert.equal((await guest.post("/api/x/vpn-pro/wireguard/peers", { name: "Sam" })).status, 403);
    t.router.nvram.wgs_pub = "";
    t.app.session.invalidate();
    assert.equal((await t.owner.post("/api/x/vpn-pro/wireguard/peers/Pat%20phone/config", { mode: "full" })).status, 409);
  } finally {
    await t.stop();
  }
});

// ---- VPN Director --------------------------------------------------------------------

test("vpn-pro: VPN Director rules are added, changed, switched and removed one reviewed step at a time", async () => {
  const t = await startApp();
  try {
    const rule = { desc: "Alex laptop", local: "198.51.100.103", remote: "", iface: "OVPN1" };
    for (const bad of [{ ...rule, iface: "OVPN9" }, { ...rule, local: "" }, { ...rule, local: "not-an-address" }, { ...rule, remote: "x.y" }, { ...rule, desc: "" }])
      assert.equal((await t.owner.post("/api/x/vpn-pro/director/rules", bad)).status, 400, JSON.stringify(bad));
    const add = await t.owner.post("/api/x/vpn-pro/director/rules", rule);
    assert.equal(add.status, 200, add.text);
    assert.deepEqual(add.data.restarts, ["restart_vpnrouting0"]);
    assert.equal((await apply(t, add.data)).status, "applied");
    assert.equal(t.router.nvram.vpndirector_rulelist, "<1>Pat phone>198.51.100.102>>WAN<1>Alex laptop>198.51.100.103>>OVPN1");

    const edit = await t.owner.post("/api/x/vpn-pro/director/rules", { ...rule, index: 1, remote: "203.0.113.0/24", iface: "WGC2" });
    assert.equal((await apply(t, edit.data)).status, "applied");
    assert.match(t.router.nvram.vpndirector_rulelist, /<1>Alex laptop>198\.51\.100\.103>203\.0\.113\.0\/24>WGC2$/);
    assert.equal((await t.owner.post("/api/x/vpn-pro/director/rules", { ...rule, index: 7 })).status, 404);

    const off = await t.owner.request("PATCH", "/api/x/vpn-pro/director/rules/0", { enabled: false });
    assert.equal((await apply(t, off.data)).status, "applied");
    assert.match(t.router.nvram.vpndirector_rulelist, /^<0>Pat phone/);
    assert.equal((await t.owner.request("PATCH", "/api/x/vpn-pro/director/rules/0", { enabled: "no" })).status, 400);

    const data = (await t.owner.get("/api/domain/vpn-pro")).data.director;
    assert.deepEqual(data.rules.map((r) => [r.desc, r.enabled, r.iface]), [["Pat phone", false, "WAN"], ["Alex laptop", true, "WGC2"]]);
    assert.equal(data.interfaces.length, 11);
    assert.deepEqual([policyProblem({ director: data }, "OVPN1"), policyProblem({ director: data }, "WAN"), policyProblem({ director: data }, "WGC1")], [true, false, false], "a client that is not on policy rules is called out");
    t.router.nvram.vpn_client1_rgw = "2";
    t.app.session.invalidate();
    assert.equal(policyProblem({ director: (await t.owner.get("/api/domain/vpn-pro")).data.director }, "OVPN1"), false);

    const gone = await DELETE(t, "/api/x/vpn-pro/director/rules/0");
    assert.equal((await apply(t, gone.data)).status, "applied");
    assert.equal(t.router.nvram.vpndirector_rulelist, "<1>Alex laptop>198.51.100.103>203.0.113.0/24>WGC2");
    assert.equal((await DELETE(t, "/api/x/vpn-pro/director/rules/5")).status, 404);
  } finally {
    await t.stop();
  }
});

test("vpn-pro: the browser module is well formed and its files are served", async () => {
  assert.equal(checkFeatureModule(feature, "vpn-pro"), null);
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/vpn-pro/index.js") && manifest.styles.includes("/js/features/vpn-pro/style.css"));
    for (const file of ["qr.js", "wireguard.js", "openvpn.js", "director.js", "ui.js"]) assert.equal((await fetch(`${t.base}/js/features/vpn-pro/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
});
