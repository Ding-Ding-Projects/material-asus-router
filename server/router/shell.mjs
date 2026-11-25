// Every command sent to the router is built here from validated pieces.
// Nothing typed in the browser is ever passed to the router shell as-is.

// Input mistakes are the person's to fix, so they carry a 400 status.
const invalid = (message) => Object.assign(new Error(message), { status: 400 });

export const NVRAM_KEY = /^[A-Za-z0-9_.:-]{1,64}$/;
export const SERVICE = /^[a-z0-9_ ]{2,48}$/;
const HOSTNAME = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?)*$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const MAC = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;

// Single-quote a value for a POSIX shell: ' becomes '\''.
export function quote(value, { multiline = false } = {}) {
  const text = String(value);
  if (text.includes("\0") || text.includes("\r") || (!multiline && text.includes("\n"))) throw invalid("Values cannot contain line breaks.");
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

export function nvramKey(key) {
  if (!NVRAM_KEY.test(key)) throw invalid(`"${key}" is not a valid setting name.`);
  return key;
}

export const nvramGet = (key) => `nvram get ${nvramKey(key)}`;
// Only these settings hold several lines by design (one SSH key per line).
export const MULTILINE_KEYS = new Set(["sshd_authkeys"]);
export const nvramSet = (key, value) =>
  `nvram set ${nvramKey(key)}=${quote(value, { multiline: MULTILINE_KEYS.has(key) })}`;
export const nvramUnset = (key) => `nvram unset ${nvramKey(key)}`;

export function service(name) {
  if (!SERVICE.test(name)) throw invalid(`"${name}" is not a known router service.`);
  return `service ${name}`;
}

export const isIpv4 = (v) => IPV4.test(String(v));
export const isMac = (v) => MAC.test(String(v));

export function hostTarget(value) {
  const text = String(value ?? "").trim();
  if (IPV4.test(text) || HOSTNAME.test(text)) return text;
  throw invalid("Enter an IPv4 address or a host name.");
}

export function macAddress(value) {
  const text = String(value ?? "").trim().toUpperCase();
  if (!MAC.test(text)) throw invalid("Enter a MAC address such as AA:BB:CC:DD:EE:FF.");
  return text;
}
