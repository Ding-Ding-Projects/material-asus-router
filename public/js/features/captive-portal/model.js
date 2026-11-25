// Pure helpers for the guest welcome page screen.

const SESSION_WORDS = { 0: { en: "until they leave", yue: "直到佢哋離開" }, 3600: { en: "for 1 hour", yue: "1 小時" }, 14400: { en: "for 4 hours", yue: "4 小時" }, 86400: { en: "for 1 day", yue: "1 日" }, 604800: { en: "for 7 days", yue: "7 日" } };
export const sessionWords = (seconds) => SESSION_WORDS[Number(seconds)] ?? { en: `for ${Math.round(Number(seconds) / 60)} minutes`, yue: `${Math.round(Number(seconds) / 60)} 分鐘` };

// What a visitor will actually experience, from the three settings, as an id and the facts.
export function visitorStory({ enabled, network, networkReady, ssid, session, idle }) {
  if (!enabled) return { id: "off", ssid };
  if (!networkReady) return { id: "network-off", ssid, network };
  return { id: "on", ssid, network, session: Number(session), idle: Number(idle) };
}

// The value each setting would have once the changes waiting in the dock are applied.
export function effective(data, pending) {
  const value = (id, fallback) => (pending.has(id) ? pending.get(id) : fallback);
  const byId = new Map(data.entries.map((e) => [e.id, e]));
  const network = value("captive-portal.network", byId.get("captive-portal.network")?.value ?? data.network);
  const ssid = data.ssids.find((s) => s.id === network);
  return {
    enabled: value("captive-portal.enabled", byId.get("captive-portal.enabled")?.value) === "1",
    network,
    networkReady: ssid?.on ?? false,
    ssid: ssid?.ssid ?? "",
    session: value("captive-portal.session", byId.get("captive-portal.session")?.value ?? "0"),
    idle: value("captive-portal.idle", byId.get("captive-portal.idle")?.value ?? "0"),
  };
}
