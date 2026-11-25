// server.properties as typed, version-bound settings. Each setting says which
// control draws it, its limits and the version it first appeared in, so the
// editor never shows a box where a switch, a menu or a slider belongs, and
// never offers a setting an old version does not read. Free text is allowed
// only for values that really are free text, and says why.
import { L } from "../kit.mjs";

const bad = (message) => Object.assign(new Error(message), { status: 400 });

// ---- versions --------------------------------------------------------------------

// "1.20.4" -> [1, 20, 4]. Snapshots and anything else are not comparable (null).
export function parseVersion(text) {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(text ?? "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}
export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}
export const atLeast = (version, minimum) => {
  const c = compareVersions(version, minimum);
  return c === null ? null : c >= 0;
};

// The Java a server version needs. Used for the runtime check and for the
// Docker image tag.
export function javaMajor(version) {
  if (atLeast(version, "1.20.5")) return 21;
  if (atLeast(version, "1.18")) return 17;
  if (atLeast(version, "1.17")) return 17;
  return 8;
}

// ---- the settings ---------------------------------------------------------------------

const sw = (key, label, help, def, since) => ({ key, control: "switch", label, help, default: def, since });
const limit = (key, control, label, help, def, min, max, extra = {}) => ({ key, control, label, help, default: def, min, max, ...extra });
const pick = (key, label, help, def, options, extra = {}) => ({ key, control: "select", label, help, default: def, options, ...extra });

const GAMEMODES = [["survival", L("Survival", "生存"), L("Collect resources and stay alive.", "收集資源並生存。")], ["creative", L("Creative", "創造"), L("Unlimited blocks and flying.", "無限方塊同飛行。")], ["adventure", L("Adventure", "冒險"), L("Blocks cannot be broken freely.", "唔可以隨意拆方塊。")], ["spectator", L("Spectator", "旁觀"), L("Look around without touching anything.", "只睇唔掂。")]];

export const JAVA_SETTINGS = [
  { key: "motd", control: "text", freeText: true, freeTextReason: "The message shown in the server list is whatever the owner wants to say.", maxLength: 120, label: L("Server message", "伺服器訊息"), help: L("Shown under the server name in the game's server list.", "喺遊戲伺服器清單入面顯示喺名稱下面。"), default: "A Minecraft Server", hint: L("Up to two lines in game; keep it short.", "遊戲入面最多兩行，儘量簡短。") },
  limit("server-port", "port", L("Port", "埠"), L("The port players connect to. The default is 25565.", "玩家連接用嘅埠。預設 25565。"), 25565, 1024, 65535, { presets: [[25565, L("Default", "預設")], [25566, L("Second server", "第二部伺服器")]] }),
  limit("max-players", "stepper", L("Most players", "最多玩家"), L("How many players can be online at once.", "同時最多幾多個玩家上線。"), 20, 1, 1000, { unit: "players" }),
  pick("gamemode", L("Game mode", "遊戲模式"), L("What new players start in.", "新玩家開始時嘅模式。"), "survival", GAMEMODES),
  pick("difficulty", L("Difficulty", "難度"), L("How hard the game is.", "遊戲有幾難。"), "easy", [["peaceful", L("Peaceful", "和平")], ["easy", L("Easy", "容易")], ["normal", L("Normal", "普通")], ["hard", L("Hard", "困難")]]),
  sw("hardcore", L("Hardcore", "極限模式"), L("Players are banned when they die.", "玩家死咗就會被封禁。"), false),
  sw("pvp", L("Players can hurt each other", "玩家可以互相攻擊"), L("Turn off for a friendly server.", "想和平啲就關閉。"), true),
  sw("online-mode", L("Check accounts with Mojang", "同 Mojang 驗證帳戶"), L("Keep this on unless the server is for a closed local network. Turning it off lets anyone pretend to be anyone.", "除非係封閉本地網絡，否則請保持開啟。關閉會令任何人可以冒充其他人。"), true),
  sw("white-list", L("Only allow listed players", "只准名單上嘅玩家"), L("Players must be on the allow list to join.", "玩家要喺許可名單上先加入到。"), false),
  sw("enforce-whitelist", L("Remove unlisted players when the list changes", "名單改變時移走未列出嘅玩家"), L("Applies to players already online.", "對已經上線嘅玩家生效。"), false, "1.13"),
  sw("allow-flight", L("Allow flying", "允許飛行"), L("Stops the server kicking players who fly with mods.", "唔會踢走用模組飛行嘅玩家。"), false),
  sw("allow-nether", L("Allow the Nether", "允許下界"), L("Lets players travel to the Nether.", "玩家可以去下界。"), true),
  sw("spawn-monsters", L("Monsters spawn", "怪物出現"), L("Turn off for no monsters.", "關閉就冇怪物。"), true),
  sw("spawn-animals", L("Animals spawn", "動物出現"), L("Turn off for no animals.", "關閉就冇動物。"), true),
  sw("spawn-npcs", L("Villagers spawn", "村民出現"), L("Turn off for no villagers.", "關閉就冇村民。"), true),
  sw("generate-structures", L("Generate structures", "生成建築"), L("Villages, temples and other buildings in new areas.", "新區域嘅村莊、神廟同其他建築。"), true),
  sw("enable-command-block", L("Command blocks work", "命令方塊可用"), L("Allows command blocks to run.", "容許命令方塊運行。"), false),
  sw("force-gamemode", L("Force the game mode on join", "加入時強制遊戲模式"), L("Everyone joins in the mode above.", "所有人以上面嘅模式加入。"), false),
  sw("sync-chunk-writes", L("Write the world safely", "安全寫入世界"), L("Slower, but a crash loses less.", "較慢，但當機損失較少。"), true, "1.16"),
  sw("enable-status", L("Show up in the server list", "喺伺服器清單顯示"), L("Turn off to hide the server's status from the list.", "關閉就隱藏伺服器狀態。"), true, "1.12"),
  sw("hide-online-players", L("Hide the player list", "隱藏玩家名單"), L("Does not show who is online in the server list.", "唔會喺清單顯示邊個上線。"), false, "1.18"),
  limit("view-distance", "slider", L("View distance", "視野距離"), L("How many chunks around a player are sent. Lower is lighter on the server.", "傳送玩家周圍幾多個區塊。越低越輕。"), 10, 3, 32, { unit: " chunks" }),
  limit("simulation-distance", "slider", L("Simulation distance", "模擬距離"), L("How far from a player things keep moving.", "距離玩家幾遠嘅嘢仍然會活動。"), 10, 3, 32, { unit: " chunks", since: "1.18" }),
  limit("spawn-protection", "stepper", L("Spawn protection", "出生點保護"), L("Radius around the spawn point that only operators can change. 0 turns it off.", "只有管理員可以改嘅出生點半徑。0 即關閉。"), 16, 0, 256, { unit: "blocks" }),
  limit("max-world-size", "slider", L("World border limit", "世界邊界上限"), L("The largest radius the world border can have.", "世界邊界最大半徑。"), 29999984, 1, 29999984, { step: 1000, unit: " blocks" }),
  limit("op-permission-level", "segmented", L("Operator level", "管理員等級"), L("What operators can do: 1 bypass spawn protection, 2 commands, 3 manage players, 4 everything.", "管理員可以做咩：1 繞過出生點保護，2 命令，3 管理玩家，4 全部。"), 4, 1, 4),
  limit("player-idle-timeout", "stepper", L("Kick idle players after", "閒置幾耐踢走玩家"), L("0 never kicks idle players.", "0 即永不踢走閒置玩家。"), 0, 0, 1440, { unit: "minutes" }),
  limit("network-compression-threshold", "stepper", L("Compress packets above", "壓縮高於"), L("Packet size in bytes above which data is compressed. -1 turns compression off.", "資料包超過呢個位元組數就壓縮。-1 即關閉壓縮。"), 256, -1, 4096, { unit: "bytes" }),
  limit("entity-broadcast-range-percentage", "slider", L("How far things are shown", "實體顯示距離"), L("Percent of the normal distance at which mobs are sent to players.", "生物傳送俾玩家嘅距離，佔正常距離嘅百分比。"), 100, 10, 500, { unit: "%", since: "1.20" }),
  { key: "level-name", control: "text", freeText: true, freeTextReason: "A world folder name is chosen by the owner.", maxLength: 40, pattern: /^[A-Za-z0-9 _.-]+$/, label: L("World folder name", "世界資料夾名稱"), help: L("The folder the world is saved in.", "世界儲存嘅資料夾。"), default: "world", hint: L("Letters, digits, spaces, dots, dashes and underscores.", "字母、數字、空格、點、橫線同底線。") },
  { key: "level-seed", control: "text", freeText: true, freeTextReason: "A world seed is any text the owner likes; Minecraft turns it into a number.", maxLength: 64, label: L("World seed", "世界種子"), help: L("Leave empty for a random world. The same seed makes the same world.", "留空就隨機。相同種子會生成相同嘅世界。"), default: "", hint: L("Any text or number.", "任何文字或數字。") },
];

// The kinds of world a version can make. Newer versions name them with a prefix.
export function levelTypes(version) {
  const modern = atLeast(version, "1.16");
  const p = modern ? "minecraft:" : "";
  const types = [[`${p}${modern ? "normal" : "default"}`, L("Normal", "普通"), L("Hills, caves and oceans.", "山丘、洞穴同海洋。")], [`${p}flat`, L("Flat", "超平坦"), L("A flat world for building.", "用嚟起屋嘅平坦世界。")], [`${p}${modern ? "large_biomes" : "largeBiomes"}`, L("Large biomes", "大型生物群系"), L("Normal terrain with much larger biomes.", "普通地形但群系大好多。")]];
  if (atLeast(version, "1.7") !== false) types.push([`${p}amplified`, L("Amplified", "放大化"), L("Extreme tall terrain. Needs a strong computer.", "極高嘅地形，要部好電腦。")]);
  if (atLeast(version, "1.19.3")) types.push([`${p}single_biome_surface`, L("Single biome", "單一群系"), L("The whole world is one biome.", "成個世界只有一個群系。")]);
  return types;
}

export const BEDROCK_SETTINGS = [
  { key: "server-name", control: "text", freeText: true, freeTextReason: "The server name is whatever the owner wants players to see.", maxLength: 60, label: L("Server name", "伺服器名稱"), help: L("Shown in the friends and servers list.", "喺朋友同伺服器清單顯示。"), default: "Dedicated Server", hint: L("Avoid semicolons.", "避免用分號。"), pattern: /^[^;\r\n]+$/ },
  pick("gamemode", L("Game mode", "遊戲模式"), L("What new players start in.", "新玩家開始時嘅模式。"), "survival", GAMEMODES.slice(0, 3)),
  pick("difficulty", L("Difficulty", "難度"), L("How hard the game is.", "遊戲有幾難。"), "easy", [["peaceful", L("Peaceful", "和平")], ["easy", L("Easy", "容易")], ["normal", L("Normal", "普通")], ["hard", L("Hard", "困難")]]),
  sw("allow-cheats", L("Allow cheats", "允許作弊"), L("Lets players use commands.", "玩家可以用命令。"), false),
  limit("max-players", "stepper", L("Most players", "最多玩家"), L("How many players can be online at once.", "同時最多幾多個玩家上線。"), 10, 1, 1000, { unit: "players" }),
  sw("online-mode", L("Require Xbox sign-in", "要求 Xbox 登入"), L("Keep on unless the server is closed to your own network.", "除非只係自己網絡用，否則請保持開啟。"), true),
  sw("white-list", L("Only allow listed players", "只准名單上嘅玩家"), L("Players must be on the allow list.", "玩家要喺許可名單上。"), false),
  limit("server-port", "port", L("Port (IPv4)", "埠（IPv4）"), L("The UDP port players connect to. The default is 19132.", "玩家連接用嘅 UDP 埠。預設 19132。"), 19132, 1024, 65535, { presets: [[19132, L("Default", "預設")]] }),
  limit("view-distance", "slider", L("View distance", "視野距離"), L("How many chunks are sent to each player.", "傳送俾每個玩家幾多個區塊。"), 32, 5, 96, { unit: " chunks" }),
  limit("tick-distance", "slider", L("Simulation distance", "模擬距離"), L("How far from a player things keep moving.", "距離玩家幾遠嘅嘢仍然會活動。"), 4, 4, 12, { unit: " chunks" }),
  pick("default-player-permission-level", L("New player permission", "新玩家權限"), L("What a player can do when first joining.", "玩家首次加入時可以做咩。"), "member", [["visitor", L("Visitor", "訪客")], ["member", L("Member", "成員")], ["operator", L("Operator", "管理員")]]),
  sw("texturepack-required", L("Resource packs are required", "必須使用資源包"), L("Players must accept the server's resource packs.", "玩家必須接受伺服器嘅資源包。"), false),
  { key: "level-name", control: "text", freeText: true, freeTextReason: "A world folder name is chosen by the owner.", maxLength: 40, pattern: /^[A-Za-z0-9 _.-]+$/, label: L("World folder name", "世界資料夾名稱"), help: L("The folder the world is saved in.", "世界儲存嘅資料夾。"), default: "Bedrock level", hint: L("Letters, digits, spaces, dots, dashes and underscores.", "字母、數字、空格、點、橫線同底線。") },
  { key: "level-seed", control: "text", freeText: true, freeTextReason: "A world seed is any text the owner likes.", maxLength: 64, label: L("World seed", "世界種子"), help: L("Leave empty for a random world.", "留空就隨機。"), default: "", hint: L("Any text or number.", "任何文字或數字。") },
];

// The settings for an edition and version, each marked unavailable (with the
// reason) when the version is older than the setting.
export function settingsFor(edition, version) {
  const list = edition === "bedrock" ? BEDROCK_SETTINGS : JAVA_SETTINGS.map((s) => (s.key === "level-name" ? s : s));
  const out = list.map((s) => {
    const missing = s.since && atLeast(version, s.since) === false;
    return { ...s, pattern: s.pattern?.source, disabled: missing ? L(`Needs Minecraft ${s.since} or newer.`, `需要 Minecraft ${s.since} 或以上。`) : undefined };
  });
  if (edition !== "bedrock") {
    const types = levelTypes(version);
    out.push({ key: "level-type", control: "select", label: L("World type", "世界類型"), help: L("The kind of terrain new worlds get.", "新世界嘅地形類型。"), default: types[0][0], options: types });
  }
  return out;
}

// ---- reading, validating and writing the file ---------------------------------------------

// Reads a properties file. Comments and unknown keys are kept exactly.
export function parseProperties(text) {
  const values = new Map();
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at > 0) values.set(line.slice(0, at).trim(), line.slice(at + 1));
  }
  return values;
}

export function validateSetting(def, raw) {
  const value = String(raw ?? "");
  if (def.disabled) throw bad(`${def.label.en} is not available: ${def.disabled.en}`);
  if (/[\r\n\0]/.test(value)) throw bad(`${def.label.en} cannot contain a line break.`);
  switch (def.control) {
    case "switch":
      if (value !== "true" && value !== "false") throw bad(`${def.label.en} must be true or false.`);
      return value;
    case "select":
    case "segmented":
      if (!def.options.some(([v]) => v === value)) throw bad(`${def.label.en} must be one of: ${def.options.map(([v]) => v).join(", ")}.`);
      return value;
    case "number": case "slider": case "stepper": case "port": {
      if (!/^-?\d+$/.test(value)) throw bad(`${def.label.en} must be a whole number.`);
      const n = Number(value);
      if (n < def.min || n > def.max) throw bad(`${def.label.en} must be from ${def.min} to ${def.max}.`);
      return String(n);
    }
    case "text":
      if (value.length > def.maxLength) throw bad(`${def.label.en} can be at most ${def.maxLength} characters.`);
      if (def.pattern && !new RegExp(typeof def.pattern === "string" ? def.pattern : def.pattern.source).test(value)) throw bad(`${def.label.en} has a character that is not allowed.`);
      return value;
    default:
      throw bad(`${def.label.en} has an unknown control type.`);
  }
}

// Applies validated changes to existing text, keeping every other line.
export function applyProperties(text, changes, defs) {
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const clean = new Map();
  for (const [key, raw] of Object.entries(changes)) {
    const def = byKey.get(key);
    if (!def) throw bad(`"${key}" is not a setting this editor knows. It is left alone.`);
    clean.set(key, validateSetting(def, raw));
  }
  const lines = String(text).split(/\r?\n/);
  const seen = new Set();
  const out = lines.map((line) => {
    const at = line.indexOf("=");
    const key = at > 0 && !line.trim().startsWith("#") ? line.slice(0, at).trim() : null;
    if (key && clean.has(key)) { seen.add(key); return `${key}=${clean.get(key)}`; }
    return line;
  });
  while (out.length && out.at(-1) === "") out.pop();
  for (const [key, value] of clean) if (!seen.has(key)) out.push(`${key}=${value}`);
  return `${out.join("\n")}\n`;
}

// What a brand new server starts with.
export function defaultProperties(edition, version, overrides = {}) {
  const defs = settingsFor(edition, version).filter((d) => !d.disabled);
  const lines = defs.map((d) => `${d.key}=${overrides[d.key] ?? d.default}`);
  return `#Minecraft server properties\n${lines.join("\n")}\n`;
}
