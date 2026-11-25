// VPN: the OpenVPN server and five clients, the WireGuard server with a peer
// list that makes keys on the server, five WireGuard clients, IPsec (shown and
// gated), VPN Director rules for Merlin and a read-only look at VPN Fusion.
// Every setting is a typed control; the lists are built by routes that return
// a reviewed preview. Private keys are made here and stored only on the router.
import { L, cleanText, formatRows, isIpv4, nvramKey, parseRows } from "../kit.mjs";
import { ID, UNITS, catalog } from "./entries.mjs";
import { serverProfile, readProfile } from "./openvpn.mjs";
import { PEER_NAME, clientConfig, formatPeers, generateKeyPair, generatePsk, isCidr, isShared, lanNetwork, networkOf, nextAddress, parsePeers } from "./wireguard.mjs";

const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const IFACES = ["WAN", ...UNITS.map((n) => `OVPN${n}`), ...UNITS.map((n) => `WGC${n}`)];
const USER = /^[A-Za-z0-9._-]{1,32}$/;
// A real pair, made once, so the pretend router has a believable public key.
const SERVER_KEYS = generateKeyPair();

const rows = (nvram, key) => parseRows(nvram.get(key) ?? "");

function endpoint(nvram) {
  const ddns = nvram.get("ddns_hostname_x") ?? "";
  const wan = nvram.get("wan0_ipaddr") ?? "";
  const host = ddns || wan;
  return { host, source: ddns ? "ddns" : "wan", shared: !ddns && isShared(wan), unknown: !host };
}
const endpointWarnings = (ep) => [
  ep.unknown ? L("The router does not know its internet address yet.", "路由器暫時未知道自己嘅互聯網地址。") : null,
  ep.shared ? L("Your internet provider shares one address between many homes, so this address cannot be reached from outside. Use a dynamic DNS name, or ask the provider for a public address.", "你嘅互聯網供應商畀多個家庭共用一個地址，所以呢個地址喺外面連唔到。請用動態 DNS 名稱，或者問供應商要公開地址。") : null,
].filter(Boolean);

const readDirector = (nvram) => rows(nvram, "vpndirector_rulelist").map((r, index) => ({ index, enabled: r[0] === "1", desc: r[1] ?? "", local: r[2] ?? "", remote: r[3] ?? "", iface: r[4] ?? "" }));
const formatDirector = (rules) => formatRows(rules.map((r) => [r.enabled ? "1" : "0", r.desc, r.local, r.remote, r.iface]));

function checkRule(body) {
  const target = (value, label) => {
    const text = String(value ?? "").trim();
    if (text && !isIpv4(text) && !isCidr(text)) throw bad(`${label}: enter an IPv4 address such as 198.51.100.102, a network such as 198.51.100.0/24, or leave it empty.`);
    return text;
  };
  const local = target(body.local, "Device");
  if (!local) throw bad("Device: choose the device or network that this rule is for.");
  const iface = String(body.iface ?? "");
  if (!IFACES.includes(iface)) throw bad("Send through: choose WAN (no VPN) or one of the VPN connections.");
  return { enabled: body.enabled !== false, desc: cleanText(body.desc, "Name", { max: 32 }), local, remote: target(body.remote, "Destination"), iface };
}

const peerView = (p) => ({ name: p.name, address: p.address, publicKey: p.publicKey, allowedIps: p.allowedIps, hasPsk: Boolean(p.psk) });

function configFor(nvram, peer, mode) {
  const ep = endpoint(nvram);
  const serverPublic = nvram.get("wgs_pub") ?? "";
  if (!serverPublic) throw bad("The router has no WireGuard key yet. Turn the WireGuard server on once so it makes one.", 409);
  const vpn = networkOf(nvram.get("wgs_addr") ?? "");
  const lan = lanNetwork(nvram.get("lan_ipaddr") ?? "198.51.100.1", nvram.get("lan_netmask") ?? "255.255.255.0");
  return {
    filename: `${peer.name.replace(/[^A-Za-z0-9._-]+/g, "-")}.conf`,
    text: clientConfig({ peer, serverPublic, host: ep.host || "YOUR-ADDRESS", port: nvram.get("wgs_port") ?? "51820", dns: nvram.get("wgs_dns") || nvram.get("lan_ipaddr"), allowed: mode === "lan" ? [vpn.text, lan] : ["0.0.0.0/0", "::/0"] }),
    warnings: endpointWarnings(ep),
  };
}

export default {
  id: ID,
  catalog,
  domainMeta: [{ id: ID, icon: "vpn_lock", label: L("VPN tools", "VPN 工具"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    [ID]: async (ctx) => {
      const nv = ctx.nvram;
      const ep = endpoint(nv);
      return {
        entries: ctx.entries(),
        related: ctx.entries("vpn"),
        merlin: ctx.info.merlin,
        endpoint: { ...ep, warnings: endpointWarnings(ep) },
        openvpn: { users: rows(nv, "vpn_server1_clientlist").map((r) => ({ name: r[0] })).filter((u) => USER.test(u.name ?? "")), startAtBoot: (nv.get("vpn_clientx_eas") ?? "").split(",").filter(Boolean) },
        wireguard: { publicKey: nv.get("wgs_pub") ?? "", address: nv.get("wgs_addr") ?? "", port: nv.get("wgs_port") ?? "", peers: parsePeers(nv.get("wgs_clientlist") ?? "").map(peerView) },
        director: { enabled: nv.get("vpndirector_enable") === "1", rules: readDirector(nv), interfaces: IFACES, clientPolicy: Object.fromEntries(UNITS.map((n) => [`OVPN${n}`, nv.get(`vpn_client${n}_rgw`) ?? ""])) },
        fusion: { available: ctx.info.capabilities.includes("vpnc") || (nv.get("vpnc_clientlist") ?? "") !== "", profiles: rows(nv, "vpnc_clientlist").map((r) => ({ name: r[0] ?? "", type: r[1] ?? "", server: r[2] ?? "" })) },
      };
    },
  },
  routes(api) {
    const need = (live) => live();

    // ---- OpenVPN server ----
    // A profile holds the server's keys, so it is made on request by a signed-in person who may write.
    api.post("/openvpn/export", async ({ live }) => {
      const { nvram, exec } = await need(live);
      const ep = endpoint(nvram);
      const get = async (key) => (await exec(`nvram get ${nvramKey(key)}`)).stdout.replace(/\n$/, "");
      const ca = await get("vpn_crt_server1_ca");
      if (!ca.includes("BEGIN CERTIFICATE")) throw bad("The OpenVPN server has no certificate yet. Turn the server on and wait a minute for it to make its keys.", 409);
      const text = serverProfile({ host: ep.host || "YOUR-ADDRESS", port: nvram.get("vpn_server1_port") ?? "1194", proto: nvram.get("vpn_server1_proto") ?? "udp", cipher: nvram.get("vpn_server1_cipher") ?? "AES-128-CBC", userPass: nvram.get("vpn_server1_userpass_auth") === "1", ca, staticKey: await get("vpn_crt_server1_static") });
      return { filename: "home-vpn.ovpn", text, warnings: endpointWarnings(ep) };
    });

    const userValue = (list) => formatRows(list.map((u) => [u.name, u.password]));
    api.post("/openvpn/users", async ({ body, live, preview }) => {
      const name = String(body.name ?? "").trim();
      if (!USER.test(name)) throw bad("Use 1 to 32 letters, numbers, dots, dashes or underscores for the account name.");
      const password = String(body.password ?? "");
      if (password.length < 8 || password.length > 32 || /[\x00-\x1f<>]/.test(password)) throw bad("Use a password of 8 to 32 characters without < or >.");
      const list = rows((await need(live)).nvram, "vpn_server1_clientlist").map(([n, p]) => ({ name: n, password: p ?? "" }));
      if (list.some((u) => u.name.toLowerCase() === name.toLowerCase())) throw bad("That account already exists.", 409);
      if (list.length >= 16) throw bad("The router can keep 16 VPN accounts.");
      return preview({ changes: [{ id: `${ID}.ovpn.users`, value: userValue([...list, { name, password }]) }], restart: ["restart_vpnd"] });
    });
    api.delete("/openvpn/users/:name", async ({ params, live, preview }) => {
      const list = rows((await need(live)).nvram, "vpn_server1_clientlist").map(([n, p]) => ({ name: n, password: p ?? "" }));
      if (!list.some((u) => u.name === params.name)) throw bad("That account does not exist.", 404);
      return preview({ changes: [{ id: `${ID}.ovpn.users`, value: userValue(list.filter((u) => u.name !== params.name)) }], restart: ["restart_vpnd"] });
    });

    // ---- OpenVPN clients: read a provider profile and offer its settings ----
    api.post("/openvpn/profile", async ({ body, preview }) => {
      const unit = Number(body.unit);
      if (!UNITS.includes(unit)) throw bad("Choose a client from 1 to 5.");
      const profile = readProfile(body.text, body.filename);
      const names = { addr: "addr", port: "port", proto: "proto", rgw: "rgw", desc: "desc" };
      const changes = Object.entries(profile.settings).map(([field, value]) => ({ id: `${ID}.ovpnc${unit}.${names[field]}`, value }));
      return { unit, settings: profile.settings, needsLogin: profile.needsLogin, certificates: profile.certs, certificatesStored: false, preview: await preview({ changes, restart: [`restart_vpnclient${unit}`] }) };
    }, { limit: 300 * 1024 });

    // ---- WireGuard peers ----
    api.post("/wireguard/peers", async ({ body, live, preview }) => {
      const { nvram } = await need(live);
      const name = String(body.name ?? "").trim();
      if (!PEER_NAME.test(name)) throw bad("Use 1 to 32 letters, numbers, spaces, dots, dashes or underscores for the device name.");
      const peers = parsePeers(nvram.get("wgs_clientlist") ?? "");
      if (peers.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw bad("A device already has that name.", 409);
      if (peers.length >= 16) throw bad("The router can keep 16 WireGuard devices.");
      const server = nvram.get("wgs_addr") ?? "";
      if (!isCidr(server)) throw bad("Set the WireGuard network first.", 409);
      const address = nextAddress(server, peers);
      if (!address) throw bad("The WireGuard network has no free addresses left.", 409);
      const extra = (Array.isArray(body.allowedIps) ? body.allowedIps : []).map(String);
      if (extra.length > 8 || extra.some((c) => !isCidr(c))) throw bad("Allowed networks: up to 8 networks such as 198.51.100.0/24.");
      const pair = generateKeyPair();
      const peer = { name, address, publicKey: pair.public, privateKey: pair.private, psk: body.psk === false ? "" : generatePsk(), allowedIps: [`${address}/32`, ...extra] };
      const value = formatPeers([...peers, peer]);
      if (value.length > 4096) throw bad("The device list is full.", 409);
      return { peer: peerView(peer), config: configFor(nvram, peer, "full"), preview: await preview({ changes: [{ id: `${ID}.wg.peers`, value }], restart: ["restart_wgs"] }) };
    });
    // The configuration holds the device's private key, so it needs write access.
    api.post("/wireguard/peers/:name/config", async ({ params, body, live }) => {
      const { nvram } = await need(live);
      const peer = parsePeers(nvram.get("wgs_clientlist") ?? "").find((p) => p.name === params.name);
      if (!peer) throw bad("That device is not on the list.", 404);
      if (!peer.privateKey) throw bad("This device's key was not made here, so its configuration cannot be rebuilt.", 409);
      return configFor(nvram, peer, body.mode === "lan" ? "lan" : "full");
    });
    api.patch("/wireguard/peers/:name", async ({ params, body, live, preview }) => {
      const { nvram } = await need(live);
      const peers = parsePeers(nvram.get("wgs_clientlist") ?? "");
      const peer = peers.find((p) => p.name === params.name);
      if (!peer) throw bad("That device is not on the list.", 404);
      const extra = (Array.isArray(body.allowedIps) ? body.allowedIps : []).map(String);
      if (extra.length > 8 || extra.some((c) => !isCidr(c))) throw bad("Allowed networks: up to 8 networks such as 198.51.100.0/24.");
      peer.allowedIps = [`${peer.address}/32`, ...extra.filter((c) => c !== `${peer.address}/32`)];
      return preview({ changes: [{ id: `${ID}.wg.peers`, value: formatPeers(peers) }], restart: ["restart_wgs"] });
    });
    api.delete("/wireguard/peers/:name", async ({ params, live, preview }) => {
      const peers = parsePeers((await need(live)).nvram.get("wgs_clientlist") ?? "");
      if (!peers.some((p) => p.name === params.name)) throw bad("That device is not on the list.", 404);
      return preview({ changes: [{ id: `${ID}.wg.peers`, value: formatPeers(peers.filter((p) => p.name !== params.name)) }], restart: ["restart_wgs"] });
    });

    // ---- VPN Director rules (Merlin) ----
    const director = async (live, fn, preview) => {
      const { nvram, info } = await need(live);
      if (!info.merlin) throw bad("VPN Director needs Asuswrt-Merlin firmware.", 409);
      const rules = readDirector(nvram);
      const next = fn(rules, nvram);
      if (next.length > 64) throw bad("VPN Director can keep 64 rules.");
      return preview({ changes: [{ key: "vpndirector_rulelist", value: formatDirector(next), risk: "low" }], restart: ["restart_vpnrouting0"] });
    };
    api.post("/director/rules", ({ body, live, preview }) => director(live, (rules) => {
      const rule = checkRule(body);
      const at = body.index === undefined ? -1 : rules.findIndex((r) => r.index === Number(body.index));
      if (body.index !== undefined && at === -1) throw bad("That rule no longer exists.", 404);
      if (at === -1) rules.push(rule);
      else rules[at] = rule;
      return rules;
    }, preview));
    api.patch("/director/rules/:index", ({ params, body, live, preview }) => director(live, (rules) => {
      const rule = rules.find((r) => r.index === Number(params.index));
      if (!rule) throw bad("That rule no longer exists.", 404);
      if (typeof body.enabled !== "boolean") throw bad("Say whether the rule is on.");
      rule.enabled = body.enabled;
      return rules;
    }, preview));
    api.delete("/director/rules/:index", ({ params, live, preview }) => director(live, (rules) => {
      const at = rules.findIndex((r) => r.index === Number(params.index));
      if (at === -1) throw bad("That rule no longer exists.", 404);
      rules.splice(at, 1);
      return rules;
    }, preview));
  },
  fakeRouter: {
    nvram: () => ({
      vpn_server1_sn: "192.0.2.0", vpn_server1_nm: "255.255.255.0", vpn_server1_plan: "1", vpn_server1_c2c: "0", vpn_server1_pdns: "1", vpn_server1_cipher: "AES-128-CBC", vpn_server1_comp: "-1", vpn_server1_userpass_auth: "0", vpn_server1_clientlist: "",
      vpn_clientx_eas: "",
      ...Object.fromEntries(UNITS.flatMap((n) => [[`vpn_client${n}_desc`, ""], [`vpn_client${n}_addr`, ""], [`vpn_client${n}_port`, "1194"], [`vpn_client${n}_proto`, "udp"], [`vpn_client${n}_rgw`, "0"], [`vpn_client${n}_username`, ""], [`vpn_client${n}_password`, ""]])),
      wgs_addr: "192.0.2.1/24", wgs_dns: "198.51.100.1", wgs_lanaccess: "1", wgs_pub: SERVER_KEYS.public, wgs_priv: SERVER_KEYS.private, wgs_clientlist: "",
      ...Object.fromEntries(UNITS.flatMap((n) => [[`wgc${n}_enable`, "0"], [`wgc${n}_addr`, `192.0.2.${40 + n}/32`], [`wgc${n}_priv`, ""], [`wgc${n}_ppub`, ""], [`wgc${n}_ep_addr`, ""], [`wgc${n}_ep_port`, "51820"], [`wgc${n}_aips`, "0.0.0.0/0"], [`wgc${n}_dns`, ""]])),
      ipsec_server_enable: "0", vpndirector_enable: "0", vpndirector_rulelist: "<1>Pat phone>198.51.100.102>>WAN",
      vpnc_clientlist: "<Work VPN>OpenVPN>203.0.113.10",
    }),
    handlers: [
      (command) => {
        if (command === "nvram get vpn_crt_server1_ca") return { stdout: "-----BEGIN CERTIFICATE-----\nMIIBsampleSampleSampleSampleSampleSampleSample\nQWxleCBhbmQgUGF0IHdlcmUgaGVyZQ\n-----END CERTIFICATE-----\n" };
        if (command === "nvram get vpn_crt_server1_static") return { stdout: "-----BEGIN OpenVPN Static key V1-----\n0123456789abcdef0123456789abcdef\n-----END OpenVPN Static key V1-----\n" };
        return undefined;
      },
    ],
  },
};
