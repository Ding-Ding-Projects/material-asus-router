// The dim sum picture source. Photos are never stored in this project: they come
// from the public Ding-Ding-Projects dim-sum-photos catalogue (its catalogue
// file and its public release assets) and are kept only in memory here, with the
// source address and revision recorded next to every answer. A picture that
// cannot be fetched is left out and reported.
export const SOURCE = Object.freeze({
  repository: "Ding-Ding-Projects/dim-sum-photos",
  index: "https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json",
  revisionUrl: "https://api.github.com/repos/Ding-Ding-Projects/dim-sum-photos/commits/main",
  assetBase: "https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download",
});
const HOSTS = [/^github\.com$/, /^raw\.githubusercontent\.com$/, /^api\.github\.com$/, /(^|\.)githubusercontent\.com$/];
const LIMITS = { index: 24 * 1024 * 1024, photo: 6 * 1024 * 1024, timeoutMs: 15000, ttlMs: 6 * 3600 * 1000 };
const PNG = [0x89, 0x50, 0x4e, 0x47];

// Tests replace these; production uses the real ones.
export const hooks = { fetch: (...args) => globalThis.fetch(...args), now: () => Date.now(), random: Math.random };
let cache = null;

async function get(url, maxBytes) {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const parsed = new URL(current);
    if (parsed.protocol !== "https:" || !HOSTS.some((rule) => rule.test(parsed.hostname))) throw new Error("blocked host");
    const res = await hooks.fetch(current, { redirect: "manual", headers: { Accept: "*/*" }, signal: AbortSignal.timeout(LIMITS.timeoutMs) });
    if (res.status >= 300 && res.status < 400) {
      current = new URL(res.headers.get("location") ?? "", current).href;
      continue;
    }
    if (!res.ok) throw new Error(`status ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error("too large");
    return bytes;
  }
  throw new Error("too many redirects");
}

const text = (v) => (typeof v === "string" ? v : "");
export function normaliseCatalogue(json) {
  const list = Array.isArray(json) ? json : Array.isArray(json?.dishes) ? json.dishes : [];
  const out = [];
  for (const d of list) {
    const file = text(d?.image?.path).split("/").pop();
    const en = text(d?.name?.en);
    const zhHant = text(d?.name?.zhHant);
    if (!/^hk-dish-\d{4,}$/.test(text(d?.id)) || !en || !zhHant || !/^[A-Za-z0-9._-]+\.png$/.test(file)) continue;
    out.push({ id: d.id, en, zhHant, file, altEn: text(d.image?.alt?.en) || en, altYue: text(d.image?.alt?.yue) || zhHant });
  }
  return out;
}

export async function loadCatalogue() {
  if (cache && hooks.now() - cache.at < LIMITS.ttlMs) return cache;
  const dishes = normaliseCatalogue(JSON.parse((await get(SOURCE.index, LIMITS.index)).toString("utf8")));
  if (!dishes.length) throw new Error("the catalogue has no usable dishes");
  let revision = "main (revision unknown)";
  try {
    const sha = JSON.parse((await get(SOURCE.revisionUrl, 256 * 1024)).toString("utf8")).sha;
    if (/^[0-9a-f]{40}$/.test(sha)) revision = sha;
  } catch {}
  cache = { at: hooks.now(), dishes, revision };
  return cache;
}
export const resetCache = () => void (cache = null);

// Which release volume holds a dish: each volume holds about a thousand pictures, in order.
export function tagsFor(id) {
  const n = Number(id.match(/(\d+)$/)?.[1] ?? 0);
  const all = ["catalog-v1", "catalog-v1-part-002", "catalog-v1-part-003", "catalog-v1-part-004"];
  const first = n <= 995 ? 0 : n <= 1985 ? 1 : n <= 2975 ? 2 : 3;
  return [all[first], ...all.filter((_, i) => i !== first)];
}

export async function fetchPhoto(dish) {
  for (const tag of tagsFor(dish.id)) {
    const url = `${SOURCE.assetBase}/${tag}/${dish.file}`;
    try {
      const bytes = await get(url, LIMITS.photo);
      if (PNG.every((b, i) => bytes[i] === b)) return { dataUrl: `data:image/png;base64,${bytes.toString("base64")}`, bytes: bytes.length, sourceUrl: url };
    } catch {}
  }
  return null;
}

export const describe = (d) => ({ id: d.id, en: d.en, zhHant: d.zhHant, altEn: d.altEn, altYue: d.altYue });

// A random dish whose photo can be fetched. A dish without a photo is left out
// and listed in "omitted".
export async function pickDish({ exclude = [] } = {}) {
  const { dishes, revision } = await loadCatalogue();
  const pool = dishes.filter((d) => !exclude.includes(d.id));
  const omitted = [];
  for (let attempt = 0; attempt < 4 && pool.length; attempt++) {
    const dish = pool.splice(Math.floor(hooks.random() * pool.length), 1)[0];
    const photo = await fetchPhoto(dish);
    if (photo) return { dish: describe(dish), photo, revision, source: SOURCE.index, omitted };
    omitted.push({ id: dish.id, reason: "its picture could not be fetched" });
  }
  return { dish: null, photo: null, revision, source: SOURCE.index, omitted };
}

// One dish by id, with its photo when asked, for the release code name card.
export async function dishById(id, { withPhoto = false } = {}) {
  const { dishes, revision } = await loadCatalogue();
  const dish = dishes.find((d) => d.id === id);
  if (!dish) return null;
  const photo = withPhoto ? await fetchPhoto(dish) : null;
  return { dish: describe(dish), photo, revision, source: SOURCE.index, omitted: withPhoto && !photo ? [{ id, reason: "its picture could not be fetched" }] : [] };
}
