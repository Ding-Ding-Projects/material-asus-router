// One-off actions: network tools, wake-on-LAN, service restarts, reboot and
// the app's own SSH key. Every router command is built from validated input.
import ssh2 from "ssh2";
import { generateEd25519 } from "./ssh/keys.mjs";
import { VAULT_PRIVATE_KEY, VAULT_PUBLIC_KEY } from "./router/session.mjs";
import { hostTarget, macAddress, service } from "./router/shell.mjs";

const { utils } = ssh2;

const KEY_COMMENT = "material-asus-router";
const SERVICES = new Set(["restart_wireless", "restart_dnsmasq", "restart_firewall", "restart_httpd", "restart_time", "restart_ddns", "restart_qos", "restart_vpnd", "restart_wgs", "restart_nasapps", "restart_sshd"]);

const bad = (message, status = 400) => Object.assign(new Error(message), { status });

export const ACTIONS = ["ping", "traceroute", "nslookup", "wake", "restart-service", "reboot", "install-key"];

function whole(body, key, min, max, fallback) {
  const n = body[key] === undefined ? fallback : Number(body[key]);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${key} must be a whole number from ${min} to ${max}.`);
  return n;
}

export async function generateKey(vault) {
  const pair = generateEd25519();
  const publicKey = `${pair.public.trim()} ${KEY_COMMENT}`;
  await vault.set(VAULT_PRIVATE_KEY, pair.private);
  await vault.set(VAULT_PUBLIC_KEY, publicKey);
  return publicKey;
}

export const publicKey = (vault) => vault.get(VAULT_PUBLIC_KEY);

// Uses a private key the owner already has for the router (for example the one whose public half
// is in the router's Authorized Keys) instead of the app's own. It is checked to be a real,
// unencrypted private key and kept only in the vault; its public half is shown so it can be matched.
export async function uploadKey(vault, text) {
  const pem = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (!pem || pem.length > 16384) throw bad("Choose the router's private key file (an OpenSSH or PEM key).", 400);
  if (/^ssh-(ed25519|rsa|dss) |^ecdsa-sha2-/.test(pem)) throw bad("That is a public key. Upload the private key file, the one without .pub.", 400);
  const parsed = utils.parseKey(pem);
  if (parsed instanceof Error) {
    if (/encrypted|passphrase/i.test(parsed.message)) throw Object.assign(bad("This key is protected by a passphrase. Remove the passphrase (ssh-keygen -p -f <file>) or use this app's own key.", 400), { code: "KEY_ENCRYPTED" });
    throw bad("That file is not a private key the app can use.", 400);
  }
  const key = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!key.isPrivateKey()) throw bad("That is a public key. Upload the private key file, the one without .pub.", 400);
  const publicLine = `${key.type} ${key.getPublicSSH().toString("base64")} uploaded-key`;
  await vault.set(VAULT_PRIVATE_KEY, `${pem}\n`);
  await vault.set(VAULT_PUBLIC_KEY, publicLine);
  return publicLine;
}

// Builds the change that adds the app's public key to the router's list of
// allowed SSH keys. The change engine then previews and applies it.
export async function installKeyChange({ vault, session }) {
  const key = publicKey(vault);
  if (!key) throw bad("Generate the app's SSH key first.", 409);
  const nvram = await session.nvram({ fresh: true });
  const existing = (nvram.get("sshd_authkeys") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (existing.includes(key)) throw bad("That key is already allowed on the router.", 409);
  return { changes: [{ key: "sshd_authkeys", value: [...existing, key].join("\n"), risk: "network" }] };
}

export async function runAction(name, body, { session, info }) {
  switch (name) {
    case "ping": {
      const host = hostTarget(body.host);
      const out = await session.exec(`ping -c ${whole(body, "count", 1, 9, 4)} -W 2 ${host}`, { timeoutMs: 30000 });
      return { host, output: out.stdout + out.stderr, ok: out.code === 0 };
    }
    case "traceroute": {
      const host = hostTarget(body.host);
      const out = await session.exec(`traceroute -m 15 -w 2 ${host}`, { timeoutMs: 60000 });
      return { host, output: out.stdout + out.stderr, ok: out.code === 0 };
    }
    case "nslookup": {
      const host = hostTarget(body.host);
      const out = await session.exec(`nslookup ${host}`, { timeoutMs: 15000 });
      return { host, output: out.stdout + out.stderr, ok: out.code === 0 };
    }
    case "wake": {
      const mac = macAddress(body.mac);
      const out = await session.exec(`ether-wake -i br0 ${mac}`);
      return { mac, ok: out.code === 0 };
    }
    case "restart-service": {
      const name = String(body.service ?? "");
      if (!SERVICES.has(name)) throw bad("That service cannot be restarted from here.");
      const out = await session.exec(service(name));
      session.invalidate();
      return { service: name, ok: out.code === 0 };
    }
    case "reboot": {
      // Two keys: type the router's model name exactly, and hold the button.
      if (body.confirm !== info.model) throw Object.assign(bad(`Type the router model, ${info.model}, exactly to confirm.`, 403), { code: "CONFIRM_MODEL" });
      if (body.hold !== true) throw Object.assign(bad("Press and hold the reboot button to confirm.", 403), { code: "CONFIRM_HOLD" });
      await session.exec("reboot").catch(() => {});
      session.close();
      session.invalidate();
      return { ok: true, message: "The router is restarting. It can take a few minutes to come back." };
    }
    default:
      throw bad("That action does not exist.", 404);
  }
}

// Runs an action a feature folder registered (its name is "<feature>.<name>").
// A destructive action asks for both confirmations the reboot does, unless the
// feature lists exactly which ones it wants.
export async function runFeatureAction(action, body, ctx) {
  const needs = action.confirm ?? (action.risk === "destructive" ? ["model", "hold"] : []);
  if (needs.includes("model") && body.confirm !== ctx.info.model) throw Object.assign(bad(`Type the router model, ${ctx.info.model}, exactly to confirm.`, 403), { code: "CONFIRM_MODEL" });
  if (needs.includes("hold") && body.hold !== true) throw Object.assign(bad("Press and hold the button to confirm.", 403), { code: "CONFIRM_HOLD" });
  const result = await action.run({ ...ctx, body });
  if (action.risk !== "low") ctx.session.invalidate();
  return result ?? { ok: true };
}
