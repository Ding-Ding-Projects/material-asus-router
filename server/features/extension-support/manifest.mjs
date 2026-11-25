// The extension manifest and the permissions an extension can ask for.
// An extension is a separate program that talks to the app in JSON lines (see
// host.mjs), so any language works. Nothing sensitive is ever offered to one:
// the SSH credentials and the router passwords have no permission at all.

export const API_VERSION = 1;

export const PERMISSIONS = {
  "router.status": { en: "Read the router's uptime", yue: "讀取路由器運行時間" },
  "nvram.read": { en: "Read ordinary router settings (never passwords or keys)", yue: "讀取一般路由器設定（唔包括密碼或金鑰）" },
};

// Asking for any of these is refused outright, whatever else the manifest says.
export const FORBIDDEN_PERMISSIONS = ["ssh.credentials", "router.password", "vault.read", "nvram.secrets", "nvram.write", "router.exec"];

// Setting names an extension can never read, even with nvram.read.
export const SENSITIVE_KEY = /(pass|psk|secret|key|token|auth|cred|sshd|private|cert|wpa)/i;

const ID = /^[a-z][a-z0-9-]{1,39}$/;
const SEMVER = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const ENTRY = /^[A-Za-z0-9._-]{1,60}\.mjs$/;

const bilingual = (v, max) => Boolean(v) && typeof v === "object" && typeof v.en === "string" && v.en.trim() !== "" && typeof v.yue === "string" && v.yue.trim() !== "" && v.en.length <= max && v.yue.length <= max;

// Returns { ok, errors: [sentence], manifest } and never throws.
export function validateManifest(input) {
  const errors = [];
  const m = input && typeof input === "object" && !Array.isArray(input) ? input : null;
  if (!m) return { ok: false, errors: ["The manifest must be a JSON object."], manifest: null };
  if (m.schema !== API_VERSION) errors.push(`schema must be ${API_VERSION}.`);
  if (typeof m.id !== "string" || !ID.test(m.id)) errors.push("id must be 2 to 40 lowercase letters, digits or dashes, starting with a letter.");
  if (typeof m.version !== "string" || !SEMVER.test(m.version)) errors.push("version must look like 1.0.0.");
  if (typeof m.entry !== "string" || !ENTRY.test(m.entry) || m.entry.includes("..")) errors.push("entry must be a plain .mjs file name with no folders.");
  if (!bilingual(m.name, 80)) errors.push("name needs an en and a yue text of up to 80 characters.");
  if (!bilingual(m.description, 300)) errors.push("description needs an en and a yue text of up to 300 characters.");
  if (!Array.isArray(m.permissions)) errors.push("permissions must be a list (it may be empty).");
  else {
    const seen = new Set();
    for (const p of m.permissions) {
      if (FORBIDDEN_PERMISSIONS.includes(p)) errors.push(`"${p}" is refused: SSH credentials, router passwords and write access are never available to an extension.`);
      else if (!PERMISSIONS[p]) errors.push(`"${p}" is not a known permission.`);
      if (seen.has(p)) errors.push(`"${p}" is listed twice.`);
      seen.add(p);
    }
  }
  if (m.author !== undefined && (typeof m.author !== "string" || m.author.length > 60)) errors.push("author must be text of up to 60 characters.");
  const known = new Set(["schema", "id", "version", "name", "description", "entry", "permissions", "author"]);
  for (const k of Object.keys(m)) if (!known.has(k)) errors.push(`"${k}" is not a manifest field.`);
  if (errors.length) return { ok: false, errors, manifest: null };
  return { ok: true, errors: [], manifest: { schema: m.schema, id: m.id, version: m.version, entry: m.entry, name: m.name, description: m.description, permissions: [...m.permissions], author: m.author ?? "" } };
}

// The permissions that are both declared by the manifest and allowed by the person.
export const effectivePermissions = (manifest, allowed) => manifest.permissions.filter((p) => Array.isArray(allowed) && allowed.includes(p));
