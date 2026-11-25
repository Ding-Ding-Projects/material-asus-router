// OpenVPN: the client profile (.ovpn) this router's server hands out, and the
// reader for a profile a VPN provider hands to the router's own clients.
import { isIpv4 } from "../kit.mjs";

const HOST = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?)*$/;
const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const block = (tag, text) => (text.trim() ? `<${tag}>\n${text.trim()}\n</${tag}>` : null);

// The profile for a computer or phone that connects to this router.
export function serverProfile({ host, port, proto, cipher, userPass, ca, staticKey }) {
  const tcp = proto === "tcp" || proto === "tcp-client";
  const gcm = /GCM|POLY1305/.test(cipher);
  return [
    "client",
    "dev tun",
    `proto ${tcp ? "tcp-client" : "udp"}`,
    `remote ${host} ${port}`,
    "resolv-retry infinite",
    "nobind",
    "persist-key",
    "persist-tun",
    "remote-cert-tls server",
    gcm ? `data-ciphers ${cipher}` : `cipher ${cipher}`,
    "verb 3",
    userPass ? "auth-user-pass" : null,
    staticKey.trim() ? "key-direction 1" : null,
    block("ca", ca),
    block("tls-auth", staticKey),
    "",
  ].filter((line) => line !== null).join("\n");
}

// What a provider profile says. Certificates are counted, never returned.
export function readProfile(text, filename = "") {
  const source = String(text ?? "");
  if (!source.trim() || source.length > 200000 || source.includes("\0")) throw bad("That does not look like an OpenVPN profile.");
  const certs = [];
  const body = source.replace(/<(ca|cert|key|tls-auth|tls-crypt|tls-crypt-v2|pkcs12|dh)>([\s\S]*?)<\/\1>/g, (_all, tag, inner) => {
    certs.push({ name: tag, bytes: inner.trim().length });
    return "";
  });
  const lines = body.split(/\r?\n/).map((l) => l.replace(/\s*[#;].*$/, "").trim()).filter(Boolean);
  const first = (name) => lines.find((l) => l === name || l.startsWith(`${name} `))?.slice(name.length).trim() ?? null;
  const remote = first("remote");
  if (!remote) throw bad("The profile has no remote line, so there is no server to connect to.");
  const [addr, port = "1194", remoteProto] = remote.split(/\s+/);
  if (!HOST.test(addr) && !isIpv4(addr)) throw bad(`"${addr}" is not a server name or address.`);
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw bad(`"${port}" is not a port from 1 to 65535.`);
  const protoText = (first("proto") ?? remoteProto ?? "udp").toLowerCase();
  if (!/^(udp|udp4|udp6|tcp|tcp4|tcp6|tcp-client)$/.test(protoText)) throw bad(`"${protoText}" is not a protocol this router's client can use.`);
  const name = String(filename).replace(/\.(ovpn|conf)$/i, "").replace(/[^A-Za-z0-9 ._-]/g, "").trim().slice(0, 32);
  return {
    settings: { addr, port, proto: protoText.startsWith("tcp") ? "tcp-client" : "udp", ...(lines.some((l) => l.startsWith("redirect-gateway")) ? { rgw: "1" } : {}), ...(name ? { desc: name } : {}) },
    needsLogin: lines.some((l) => l === "auth-user-pass" || l.startsWith("auth-user-pass ")),
    certs,
  };
}
