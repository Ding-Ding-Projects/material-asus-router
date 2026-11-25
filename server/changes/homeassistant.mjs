// A very small Home Assistant client. It only ever reads: the list of entities
// (so the owner can pick some) and the present state of an entity the owner
// picked. It never reads attributes other than the friendly name, never keeps
// a state, and never asks for history.
const ENTITY = /^[a-z_]+\.[a-z0-9_]+$/;
export const PICKABLE_DOMAINS = ["person", "device_tracker", "binary_sensor", "input_boolean", "switch", "sensor"];
const TIMEOUT_MS = 5000;

const bad = (message, status = 400, code = "HOME_ASSISTANT") => Object.assign(new Error(message), { status, code });

export function cleanUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? "").trim());
  } catch {
    throw bad("Enter the Home Assistant address, for example http://homeassistant.local:8123");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw bad("The Home Assistant address must start with http:// or https://");
  if (url.username || url.password) throw bad("Leave the user name and password out of the address. The access token goes in its own box.");
  return `${url.origin}`;
}

export const isEntityId = (id) => ENTITY.test(String(id));

async function call(base, token, route, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${base}${route}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: controller.signal, redirect: "error" });
    if (res.status === 401 || res.status === 403) throw bad("Home Assistant did not accept the access token.", 502, "HOME_ASSISTANT_AUTH");
    if (!res.ok) throw bad(`Home Assistant answered with status ${res.status}.`, 502);
    return await res.json();
  } catch (error) {
    if (error.code?.startsWith?.("HOME_ASSISTANT")) throw error;
    throw bad(error.name === "AbortError" ? "Home Assistant did not answer in time." : "Could not reach Home Assistant.", 502, "HOME_ASSISTANT_UNREACHABLE");
  } finally {
    clearTimeout(timer);
  }
}

// [{ entityId, name, domain, state }] for the entities worth picking from.
export async function listEntities(base, token, fetchImpl = fetch) {
  const data = await call(base, token, "/api/states", fetchImpl);
  if (!Array.isArray(data)) throw bad("Home Assistant sent something unexpected.", 502);
  return data
    .filter((e) => typeof e?.entity_id === "string" && ENTITY.test(e.entity_id) && PICKABLE_DOMAINS.includes(e.entity_id.split(".")[0]))
    .map((e) => ({ entityId: e.entity_id, domain: e.entity_id.split(".")[0], name: String(e.attributes?.friendly_name ?? e.entity_id).slice(0, 80), state: String(e.state ?? "").slice(0, 40) }))
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name))
    .slice(0, 500);
}

// "home", "away" or "unknown" for one entity, read right now.
export async function readPresence(base, token, entityId, fetchImpl = fetch) {
  if (!isEntityId(entityId)) throw bad("That is not a Home Assistant entity.");
  const data = await call(base, token, `/api/states/${entityId}`, fetchImpl);
  const state = String(data?.state ?? "").toLowerCase().slice(0, 40);
  return { entityId, state, presence: presenceOf(entityId.split(".")[0], state) };
}

export function presenceOf(domain, state) {
  if (!state || ["unknown", "unavailable", "none"].includes(state)) return "unknown";
  if (domain === "person" || domain === "device_tracker") return state === "home" ? "home" : "away";
  if (state === "on" || state === "home") return "home";
  if (state === "off" || state === "not_home" || state === "away") return "away";
  return "unknown";
}
