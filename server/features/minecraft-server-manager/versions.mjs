// Finding every server version, from the official sources, for each flavour.
// When a source cannot be reached the answer says so with the reason; a
// version list is never invented. Downloads are only taken from the official
// hosts below.
import { atLeast, javaMajor } from "./properties.mjs";

export const SOURCES = {
  javaManifest: "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
  paper: "https://api.papermc.io/v2/projects/paper",
  fabricGame: "https://meta.fabricmc.net/v2/versions/game",
  fabricLoader: "https://meta.fabricmc.net/v2/versions/loader",
  fabricInstaller: "https://meta.fabricmc.net/v2/versions/installer",
  forge: "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json",
  bedrockPage: "https://www.minecraft.net/en-us/download/server/bedrock",
};

// Servers are only ever downloaded from these official hosts.
export const DOWNLOAD_HOSTS = new Set(["piston-data.mojang.com", "piston-meta.mojang.com", "launcher.mojang.com", "api.papermc.io", "meta.fabricmc.net", "maven.minecraftforge.net", "www.minecraft.net"]);
export function officialUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw Object.assign(new Error("That download address is not valid."), { status: 400 });
  }
  if (parsed.protocol !== "https:" || !DOWNLOAD_HOSTS.has(parsed.hostname)) throw Object.assign(new Error(`Downloads are only taken from official Minecraft sources; ${parsed.hostname} is not one of them.`), { status: 400 });
  return parsed.href;
}

export const FLAVOURS = [
  { id: "vanilla", edition: "java", name: "Vanilla", about: { en: "The official server from Mojang.", yue: "Mojang 官方伺服器。" } },
  { id: "paper", edition: "java", name: "Paper", about: { en: "Fast server that runs Bukkit plugins.", yue: "快速、可行 Bukkit 插件嘅伺服器。" }, plugins: true },
  { id: "fabric", edition: "java", name: "Fabric", about: { en: "Light server for Fabric mods.", yue: "行 Fabric 模組嘅輕量伺服器。" } },
  { id: "forge", edition: "java", name: "Forge", about: { en: "Server for Forge mods.", yue: "行 Forge 模組嘅伺服器。" } },
  { id: "bedrock", edition: "bedrock", name: "Bedrock", about: { en: "The official Bedrock dedicated server.", yue: "官方基岩版專用伺服器。" } },
];

// ---- parsers (pure, tested with saved samples) ----------------------------------------------

const CHANNEL = { release: "release", snapshot: "development", old_beta: "historic", old_alpha: "historic" };

export function parseJavaManifest(json) {
  if (!json || !Array.isArray(json.versions)) throw new Error("The Java version list is not in the expected shape.");
  return json.versions.map((v) => ({ id: v.id, type: v.type, channel: CHANNEL[v.type] ?? "development", releaseTime: v.releaseTime, url: v.url }));
}

// The server download for one Java version, from its own version file. Old
// versions simply have none, and that is reported as a gap.
export function parseJavaVersionFile(json) {
  const server = json?.downloads?.server;
  const major = json?.javaVersion?.majorVersion;
  if (!server?.url) return { available: false, reason: "Mojang published no server download for this version.", javaMajor: major ?? null };
  return { available: true, url: officialUrl(server.url), sha1: server.sha1 ?? null, size: server.size ?? null, javaMajor: major ?? null };
}

export const parsePaperVersions = (json) => (json?.versions ?? []).slice().reverse().map((id) => ({ id, channel: /-(pre|rc)|snapshot/i.test(id) ? "development" : "release" }));
export function parsePaperBuilds(json, version) {
  const builds = json?.builds ?? [];
  if (!builds.length) return { available: false, reason: `Paper has no build for ${version}.` };
  const last = builds.at(-1);
  const build = typeof last === "number" ? last : last.build;
  const name = last?.downloads?.application?.name ?? `paper-${version}-${build}.jar`;
  return { available: true, build, url: officialUrl(`${SOURCES.paper}/versions/${version}/builds/${build}/downloads/${name}`), sha256: last?.downloads?.application?.sha256 ?? null };
}
export const parseFabricGames = (json) => (Array.isArray(json) ? json : []).map((g) => ({ id: g.version, channel: g.stable ? "release" : "development" }));
export const parseForgePromos = (json) => {
  const out = new Map();
  for (const [key, forge] of Object.entries(json?.promos ?? {})) {
    const m = /^(.+)-(latest|recommended)$/.exec(key);
    if (!m) continue;
    const entry = out.get(m[1]) ?? { id: m[1], channel: "release", forge: {} };
    entry.forge[m[2]] = forge;
    out.set(m[1], entry);
  }
  return [...out.values()].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
};
export const forgeInstallerUrl = (mc, forge) => officialUrl(`https://maven.minecraftforge.net/net/minecraftforge/forge/${mc}-${forge}/forge-${mc}-${forge}-installer.jar`);

export function parseBedrockPage(html) {
  const found = new Map();
  for (const m of String(html).matchAll(/https:\/\/www\.minecraft\.net\/bedrockdedicatedserver\/bin-(linux|win)(-preview)?\/bedrock-server-([\d.]+)\.zip/g)) {
    const id = m[3];
    const entry = found.get(`${id}${m[2] ?? ""}`) ?? { id, channel: m[2] ? "development" : "release", downloads: {} };
    entry.downloads[m[1]] = m[0];
    found.set(`${id}${m[2] ?? ""}`, entry);
  }
  return [...found.values()];
}

// ---- compatibility ------------------------------------------------------------------------------

// What each flavour needs from a Minecraft version, and the Java that
// version runs on. Anything that cannot be decided is reported, not guessed.
export function compatibility(flavour, version) {
  const notes = [];
  let supported = true;
  if (flavour === "paper" && atLeast(version, "1.8") === false) { supported = false; notes.push("Paper starts at Minecraft 1.8."); }
  if (flavour === "fabric" && atLeast(version, "1.14") === false) { supported = false; notes.push("Fabric starts at Minecraft 1.14."); }
  if (atLeast(version, "1.0") === null && flavour !== "bedrock") notes.push("This is a development version, so its Java version and settings cannot be worked out from its number.");
  const java = flavour === "bedrock" ? null : javaMajor(version);
  return { supported, java, notes };
}

// ---- discovery (the only part that uses the network, through an injected fetcher) ---------------------

const cache = new Map();
const TTL_MS = 10 * 60 * 1000;
export const clearVersionCache = () => cache.clear();

export async function discover(flavour, net, { now = Date.now() } = {}) {
  const hit = cache.get(flavour);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  let versions;
  let source;
  try {
    if (flavour === "vanilla") {
      versions = parseJavaManifest(await net.fetchJson(SOURCES.javaManifest));
      source = "Mojang version manifest (every release, snapshot and historic version)";
    } else if (flavour === "paper") {
      versions = parsePaperVersions(await net.fetchJson(SOURCES.paper));
      source = "Paper downloads API";
    } else if (flavour === "fabric") {
      versions = parseFabricGames(await net.fetchJson(SOURCES.fabricGame));
      source = "Fabric meta API";
    } else if (flavour === "forge") {
      versions = parseForgePromos(await net.fetchJson(SOURCES.forge));
      source = "Forge promotions list";
    } else if (flavour === "bedrock") {
      versions = parseBedrockPage(await net.fetchText(SOURCES.bedrockPage));
      source = "Mojang's Bedrock download page";
      if (!versions.length) throw new Error("The Bedrock download page had no download links in the expected form.");
    } else throw Object.assign(new Error(`There is no flavour called ${flavour}.`), { status: 404 });
  } catch (error) {
    if (error.status) throw error;
    return { available: false, flavour, error: error.message, reason: "The official source could not be read, so the version list is unavailable. Nothing is guessed." };
  }
  const gaps = [];
  if (flavour === "bedrock") gaps.push("Mojang lists only the current Bedrock server (and a preview when there is one). Older Bedrock versions are not published on that page.");
  if (flavour === "forge") gaps.push("Only Minecraft versions that have a Forge promotion are listed.");
  const value = { available: true, flavour, source, fetchedAt: new Date(now).toISOString(), versions, gaps };
  cache.set(flavour, { at: now, value });
  return value;
}

// The download for one chosen version, resolved from the official source.
export async function resolveDownload(flavour, version, net) {
  if (flavour === "vanilla") {
    const list = parseJavaManifest(await net.fetchJson(SOURCES.javaManifest));
    const found = list.find((v) => v.id === version);
    if (!found) throw Object.assign(new Error(`Minecraft ${version} is not in the official list.`), { status: 404 });
    return { ...parseJavaVersionFile(await net.fetchJson(officialUrl(found.url))), kind: "server-jar" };
  }
  if (flavour === "paper") return { ...parsePaperBuilds(await net.fetchJson(`${SOURCES.paper}/versions/${version}/builds`), version), kind: "server-jar" };
  if (flavour === "fabric") {
    const [loaders, installers] = await Promise.all([net.fetchJson(SOURCES.fabricLoader), net.fetchJson(SOURCES.fabricInstaller)]);
    const loader = loaders.find((l) => l.stable)?.version ?? loaders[0]?.version;
    const installer = installers.find((i) => i.stable)?.version ?? installers[0]?.version;
    if (!loader || !installer) return { available: false, reason: "Fabric did not list a loader or installer." };
    return { available: true, kind: "server-jar", url: officialUrl(`${SOURCES.fabricLoader}/${version}/${loader}/${installer}/server/jar`), loader, installer };
  }
  if (flavour === "forge") {
    const promo = parseForgePromos(await net.fetchJson(SOURCES.forge)).find((p) => p.id === version);
    const forge = promo?.forge.recommended ?? promo?.forge.latest;
    if (!forge) return { available: false, reason: `Forge has no promoted build for ${version}.` };
    return { available: true, kind: "forge-installer", forge, url: forgeInstallerUrl(version, forge) };
  }
  throw Object.assign(new Error("That flavour has no direct download."), { status: 400 });
}
