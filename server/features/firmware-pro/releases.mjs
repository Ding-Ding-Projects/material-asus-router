// Version reading and comparing for the Firmware screen. Nothing here writes
// to the router. The network fetch can be replaced in tests with setFetcher().
export const MERLIN_RELEASES = "https://api.github.com/repos/RMerl/asuswrt-merlin.ng/releases/latest";

let fetcher = (url, options) => fetch(url, options);
export const setFetcher = (fn) => {
  fetcher = fn ?? ((url, options) => fetch(url, options));
};

// "3004.388.8_4", "388.8_4" and "386.12_4" all become [major, minor, patch].
export function parseMerlin(text) {
  const m = String(text ?? "").match(/(?:\d{4}\.)?(\d{3})\.(\d+)(?:_(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

// "3004_388_24198_0" is [3004, 388, 24198].
export function parseStockInfo(text) {
  const m = String(text ?? "").match(/^(\d{4})_(\d{3})_(\d+)/);
  return m ? [Number(m[2]), Number(m[3])] : null;
}

export function compare(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

// The version the router runs now, from its own settings.
export function currentVersion(nvram) {
  const get = (key) => nvram.get(key) ?? "";
  const merlin = get("3rd-party") === "merlin";
  const extend = get("extendno").match(/^\d+/)?.[0] ?? "";
  return {
    family: merlin ? "merlin" : "stock",
    firmver: get("firmver"),
    buildno: get("buildno"),
    extendno: get("extendno"),
    display: merlin ? `${get("buildno")}${extend ? `_${extend}` : ""}` : [get("firmver"), get("buildno"), extend].filter(Boolean).join("."),
    parts: merlin ? parseMerlin(`${get("buildno")}_${extend || 0}`) : [Number(get("buildno")) || 0, Number(extend) || 0],
  };
}

const verdict = (current, latest) => {
  if (!current || !latest) return "unknown";
  const order = compare(current, latest);
  return order < 0 ? "newer" : order > 0 ? "ahead" : "current";
};

const plain = (text) => String(text ?? "").replace(/\r/g, "").replace(/<[^>]*>/g, "").slice(0, 1800).trim();

// Merlin: the latest GitHub release, or a clear offline state.
export async function checkMerlin(current) {
  const checkedAt = new Date().toISOString();
  try {
    const res = await fetcher(MERLIN_RELEASES, { headers: { Accept: "application/vnd.github+json", "User-Agent": "material-asus-router" }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { state: "offline", checkedAt, source: "github", reason: `GitHub answered ${res.status}.` };
    const release = await res.json();
    const latest = parseMerlin(release.tag_name);
    return {
      state: verdict(current.parts, latest),
      source: "github",
      checkedAt,
      latest: String(release.tag_name ?? ""),
      name: String(release.name ?? ""),
      publishedAt: release.published_at ?? null,
      url: /^https:\/\/github\.com\//.test(release.html_url ?? "") ? release.html_url : "https://www.asuswrt-merlin.net/download",
      notes: plain(release.body),
    };
  } catch (error) {
    return { state: "offline", checkedAt, source: "github", reason: error?.name === "TimeoutError" ? "GitHub did not answer in time." : "This app could not reach GitHub from here." };
  }
}

// Stock: what the router itself reports after its own update check.
export function readStock(current, nvram, model) {
  const info = nvram.get("webs_state_info") ?? "";
  const page = `https://www.asus.com/supportonly/${encodeURIComponent(model)}/helpdesk_bios/`;
  const latest = parseStockInfo(info);
  if (!latest) return { state: "unchecked", source: "router", url: page };
  const digits = info.split("_")[0].split("").join(".");
  return { state: verdict(current.parts, latest), source: "router", latest: `${digits}.${latest[0]}.${latest[1]}`, url: page, checkedAt: null };
}
