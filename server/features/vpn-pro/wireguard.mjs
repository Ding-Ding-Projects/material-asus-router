// WireGuard key generation, the peer list layout and the client configuration
// file. Keys are made here, on the server, and only stored on the router.
import { createPrivateKey, createPublicKey, randomBytes } from "node:crypto";
import { formatRows, isIpv4, parseRows } from "../kit.mjs";

// The fixed start of an X25519 private key in PKCS#8 form; the 32 key bytes follow.
const PKCS8_X25519 = Buffer.of(0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20);
export const WG_KEY = /^[A-Za-z0-9+/]{43}=$/;
export const PEER_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,31}$/;

export const ipToNumber = (ip) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);
export const numberToIp = (n) => [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join(".");

// A WireGuard private key: 32 random bytes, adjusted the way the protocol requires.
export function privateKeyBytes(random = randomBytes(32)) {
  const key = Buffer.from(random);
  key[0] &= 248;
  key[31] &= 127;
  key[31] |= 64;
  return key;
}

export function publicKeyOf(privateBytes) {
  const key = createPrivateKey({ key: Buffer.concat([PKCS8_X25519, privateBytes]), format: "der", type: "pkcs8" });
  const spki = createPublicKey(key).export({ format: "der", type: "spki" });
  return spki.subarray(spki.length - 32);
}

export function generateKeyPair(random) {
  const priv = privateKeyBytes(random);
  return { private: priv.toString("base64"), public: publicKeyOf(priv).toString("base64") };
}
export const generatePsk = () => randomBytes(32).toString("base64");

// <name>address>public key>private key>preshared key>allowed addresses
export function parsePeers(text) {
  return parseRows(text).map(([name, address, publicKey, privateKey, psk, allowed]) => ({ name: name ?? "", address: address ?? "", publicKey: publicKey ?? "", privateKey: privateKey ?? "", psk: psk ?? "", allowedIps: (allowed ?? "").split(",").filter(Boolean) })).filter((p) => PEER_NAME.test(p.name) && isIpv4(p.address) && WG_KEY.test(p.publicKey));
}
export const formatPeers = (peers) => formatRows(peers.map((p) => [p.name, p.address, p.publicKey, p.privateKey, p.psk, p.allowedIps.join(",")]));

export const isCidr = (value) => {
  const m = String(value).match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  return Boolean(m && isIpv4(m[1]) && Number(m[2]) <= 32);
};

// The network a "192.0.2.1/24" address belongs to, and its prefix.
export function networkOf(cidr) {
  const [ip, prefix] = cidr.split("/");
  const size = 2 ** (32 - Number(prefix));
  const start = ipToNumber(ip) - (ipToNumber(ip) % size);
  return { start, size, prefix: Number(prefix), ip, text: `${numberToIp(start)}/${prefix}` };
}

// The first free host address after the server's own.
export function nextAddress(serverCidr, peers) {
  const { start, size, ip } = networkOf(serverCidr);
  const taken = new Set([ip, ...peers.map((p) => p.address)]);
  for (let n = start + 1; n < start + size - 1; n += 1) if (!taken.has(numberToIp(n))) return numberToIp(n);
  return null;
}

export const lanNetwork = (ip, mask) => {
  const m = ipToNumber(mask);
  const prefix = m.toString(2).replace(/0/g, "").length;
  return `${numberToIp((ipToNumber(ip) & m) >>> 0)}/${prefix}`;
};

// An address is shared (CGNAT) when it sits in 100.64.0.0/10.
export const isShared = (ip) => isIpv4(ip) && ipToNumber(ip) >= ipToNumber("100.64.0.0") && ipToNumber(ip) <= ipToNumber("100.127.255.255");

export function clientConfig({ peer, serverPublic, host, port, dns, allowed }) {
  return [
    "[Interface]",
    `PrivateKey = ${peer.privateKey}`,
    `Address = ${peer.address}/32`,
    dns ? `DNS = ${dns}` : null,
    "",
    "[Peer]",
    `PublicKey = ${serverPublic}`,
    peer.psk ? `PresharedKey = ${peer.psk}` : null,
    `Endpoint = ${host}:${port}`,
    `AllowedIPs = ${allowed.join(", ")}`,
    "PersistentKeepalive = 25",
    "",
  ].filter((line) => line !== null).join("\n");
}
