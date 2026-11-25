// The Minecraft server manager is tested against stand-ins only: a pretend
// Docker and Java on the pretend router (the two SSH targets), a recorded
// docker program, and a temporary folder with a fake download for the local
// process. No real server is ever started and nothing is downloaded.
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { resetSim, sim } from "../../server/features/minecraft-server-manager/fake.mjs";
import { JAVA_SETTINGS, applyProperties, atLeast, compareVersions, defaultProperties, javaMajor, levelTypes, parseProperties, settingsFor, validateSetting } from "../../server/features/minecraft-server-manager/properties.mjs";
import { runtime, setRuntime } from "../../server/features/minecraft-server-manager/runtime.mjs";
import { containerName, dockerRunArgs, dockerTag, parseDockerList, parsePlayers, pluginSource, shellJoin, validateSpec } from "../../server/features/minecraft-server-manager/targets.mjs";
import { FLAVOURS, clearVersionCache, compatibility, discover, forgeInstallerUrl, officialUrl, parseBedrockPage, parseFabricGames, parseForgePromos, parseJavaManifest, parseJavaVersionFile, parsePaperBuilds, parsePaperVersions } from "../../server/features/minecraft-server-manager/versions.mjs";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/minecraft-server-manager/index.js";
import { startApp, waitFor } from "../helpers.mjs";

const original = { ...runtime };
const act = (t, name, body) => t.owner.post(`/api/actions/minecraft-server-manager.${name}`, body);

const MANIFEST = { versions: [{ id: "1.21", type: "release", releaseTime: "2024-06-13T00:00:00Z", url: "https://piston-meta.mojang.com/v1/packages/aa/1.21.json" }, { id: "24w14a", type: "snapshot", releaseTime: "2024-04-03T00:00:00Z", url: "https://piston-meta.mojang.com/v1/packages/bb/24w14a.json" }, { id: "b1.7.3", type: "old_beta", releaseTime: "2011-07-08T00:00:00Z", url: "https://piston-meta.mojang.com/v1/packages/cc/b1.7.3.json" }, { id: "a1.0.4", type: "old_alpha", releaseTime: "2010-12-03T00:00:00Z", url: "https://piston-meta.mojang.com/v1/packages/dd/a1.0.4.json" }] };

test("versions: numbers compare, settings know their version, and Java follows the game", () => {
  assert.equal(compareVersions("1.20.4", "1.20.10"), -1);
  assert.equal(compareVersions("1.21", "1.21.0"), 0);
  assert.equal(compareVersions("24w14a", "1.21"), null, "a snapshot cannot be compared by number");
  assert.equal(atLeast("1.18", "1.18"), true);
  assert.equal(atLeast("1.12.2", "1.18"), false);
  assert.equal(atLeast("24w14a", "1.18"), null);
  assert.deepEqual([javaMajor("1.12.2"), javaMajor("1.16.5"), javaMajor("1.17.1"), javaMajor("1.20.4"), javaMajor("1.20.5"), javaMajor("1.21")], [8, 8, 17, 17, 21, 21]);
  assert.deepEqual([dockerTag("1.12.2"), dockerTag("1.18"), dockerTag("1.21")], ["java8", "java17", "java21"]);
  assert.equal(levelTypes("1.20")[0][0], "minecraft:normal");
  assert.equal(levelTypes("1.12.2")[0][0], "default");
  assert.ok(levelTypes("1.20").some(([v]) => v === "minecraft:large_biomes"));
  assert.ok(levelTypes("1.19.3").some(([v]) => v === "minecraft:single_biome_surface"));
  assert.ok(!levelTypes("1.18").some(([v]) => v.includes("single_biome")));
});

test("settings: every one is a typed control with limits, free text is rare and explained, and old versions lose newer settings", () => {
  const types = new Set(JAVA_SETTINGS.map((s) => s.control));
  for (const type of ["switch", "select", "slider", "stepper", "port", "segmented", "text"]) assert.ok(types.has(type), `uses ${type}`);
  for (const s of JAVA_SETTINGS) {
    assert.ok(s.label.en && s.label.yue && s.help.en && s.help.yue, `${s.key} is bilingual`);
    if (s.control === "text") assert.ok(s.freeText && s.freeTextReason.length > 20 && s.maxLength > 0 && s.hint, `${s.key} explains why it is free text`);
    if (["slider", "stepper", "port"].includes(s.control)) assert.ok(s.min < s.max, `${s.key} has limits`);
  }
  assert.ok(JAVA_SETTINGS.filter((s) => s.control === "text").length <= 3, "only the message, folder name and seed are free text");
  const old = settingsFor("java", "1.12.2");
  assert.ok(old.find((s) => s.key === "simulation-distance").disabled.en.includes("1.18"));
  assert.equal(old.find((s) => s.key === "motd").disabled, undefined);
  assert.equal(settingsFor("java", "1.21").find((s) => s.key === "simulation-distance").disabled, undefined);
  assert.ok(settingsFor("bedrock", "1.21.0").some((s) => s.key === "allow-cheats"));
  assert.ok(!settingsFor("bedrock", "1.21.0").some((s) => s.key === "level-type"));
});

test("settings: values are validated by their control, applied without disturbing the rest of the file", () => {
  const defs = settingsFor("java", "1.21");
  const def = (key) => defs.find((d) => d.key === key);
  assert.equal(validateSetting(def("pvp"), "false"), "false");
  assert.throws(() => validateSetting(def("pvp"), "yes"), /true or false/);
  assert.equal(validateSetting(def("difficulty"), "hard"), "hard");
  assert.throws(() => validateSetting(def("difficulty"), "impossible"), /one of/);
  assert.equal(validateSetting(def("view-distance"), "12"), "12");
  assert.throws(() => validateSetting(def("view-distance"), "99"), /from 3 to 32/);
  assert.throws(() => validateSetting(def("view-distance"), "1.5"), /whole number/);
  assert.throws(() => validateSetting(def("server-port"), "80"), /from 1024/);
  assert.throws(() => validateSetting(def("level-name"), "../etc"), /not allowed/);
  assert.throws(() => validateSetting(def("motd"), "line\nbreak"), /line break/);
  assert.throws(() => validateSetting(def("motd"), "x".repeat(200)), /at most 120/);
  assert.throws(() => validateSetting(settingsFor("java", "1.12.2").find((d) => d.key === "simulation-distance"), "10"), /not available/);

  const text = "#Minecraft server properties\n#Wed Nov 25\nmotd=Hello\nmax-players=20\nsome-mod-setting=keep-me\n";
  const next = applyProperties(text, { motd: "Hi there", "max-players": "30", pvp: "false" }, defs);
  assert.match(next, /^#Minecraft server properties\n#Wed Nov 25\n/, "comments are kept");
  assert.match(next, /motd=Hi there\nmax-players=30\nsome-mod-setting=keep-me\npvp=false\n$/, "changed in place, unknown keys kept, new keys appended");
  assert.throws(() => applyProperties(text, { "made-up": "1" }, defs), /not a setting/);
  assert.throws(() => applyProperties(text, { "max-players": "0" }, defs), /from 1 to 1000/);
  assert.equal(parseProperties(next).get("pvp"), "false");
  const fresh = defaultProperties("java", "1.21", { "server-port": 25570 });
  assert.match(fresh, /server-port=25570/);
  assert.match(fresh, /level-type=minecraft:normal/);
  assert.ok(!/simulation-distance/.test(defaultProperties("java", "1.12.2")), "a new file for an old version leaves out newer settings");
});

test("discovery reads every kind of version from each official source and says plainly when it cannot", async () => {
  const java = parseJavaManifest(MANIFEST);
  assert.deepEqual(java.map((v) => [v.id, v.channel]), [["1.21", "release"], ["24w14a", "development"], ["b1.7.3", "historic"], ["a1.0.4", "historic"]]);
  assert.throws(() => parseJavaManifest({}), /expected shape/);
  assert.equal(parseJavaVersionFile({ downloads: { server: { url: "https://piston-data.mojang.com/v1/objects/x/server.jar", sha1: "abc", size: 5 } }, javaVersion: { majorVersion: 21 } }).javaMajor, 21);
  const none = parseJavaVersionFile({ downloads: {} });
  assert.equal(none.available, false, "old versions with no server are a reported gap");
  assert.match(none.reason, /no server download/);
  assert.throws(() => parseJavaVersionFile({ downloads: { server: { url: "https://evil.example.test/server.jar" } } }), /official Minecraft sources/);
  assert.deepEqual(parsePaperVersions({ versions: ["1.20.4", "1.21"] }).map((v) => v.id), ["1.21", "1.20.4"]);
  const build = parsePaperBuilds({ builds: [{ build: 1 }, { build: 7, downloads: { application: { name: "paper-1.21-7.jar", sha256: "00" } } }] }, "1.21");
  assert.equal(build.url, "https://api.papermc.io/v2/projects/paper/versions/1.21/builds/7/downloads/paper-1.21-7.jar");
  assert.equal(parsePaperBuilds({ builds: [] }, "1.2").available, false);
  assert.deepEqual(parseFabricGames([{ version: "1.21", stable: true }, { version: "24w14a", stable: false }]).map((v) => v.channel), ["release", "development"]);
  const forge = parseForgePromos({ promos: { "1.20.1-latest": "47.3.0", "1.20.1-recommended": "47.2.0", "1.12.2-latest": "14.23.5.2860" } });
  assert.deepEqual(forge.map((f) => f.id), ["1.20.1", "1.12.2"]);
  assert.equal(forge[0].forge.recommended, "47.2.0");
  assert.equal(forgeInstallerUrl("1.20.1", "47.2.0"), "https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.2.0/forge-1.20.1-47.2.0-installer.jar");
  const bedrock = parseBedrockPage('<a href="https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.21.2.01.zip">x</a><a href="https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.2.01.zip">y</a><a href="https://www.minecraft.net/bedrockdedicatedserver/bin-linux-preview/bedrock-server-1.21.3.01.zip">z</a>');
  assert.deepEqual(bedrock.map((v) => [v.id, v.channel, Object.keys(v.downloads).sort().join()]), [["1.21.2.01", "release", "linux,win"], ["1.21.3.01", "development", "linux"]]);
  assert.throws(() => officialUrl("http://piston-meta.mojang.com/x"), /official Minecraft sources/);

  clearVersionCache();
  const ok = await discover("vanilla", { fetchJson: async () => MANIFEST });
  assert.equal(ok.available, true);
  assert.equal(ok.versions.length, 4);
  assert.match(ok.source, /Mojang/);
  clearVersionCache();
  const offline = await discover("vanilla", { fetchJson: async () => { throw new Error("getaddrinfo ENOTFOUND piston-meta.mojang.com"); } });
  assert.equal(offline.available, false);
  assert.match(offline.reason, /Nothing is guessed/);
  assert.match(offline.error, /ENOTFOUND/);
  clearVersionCache();
  const gap = await discover("bedrock", { fetchText: async () => '<a href="https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.21.2.01.zip">' });
  assert.match(gap.gaps[0], /Older Bedrock versions are not published/);
  clearVersionCache();
  assert.equal((await discover("bedrock", { fetchText: async () => "<html></html>" })).available, false, "a page with no links is a gap, not an empty success");
  await assert.rejects(() => discover("cobol", {}), (e) => e.status === 404);
  assert.deepEqual(FLAVOURS.map((f) => f.id), ["vanilla", "paper", "fabric", "forge", "bedrock"]);
  assert.equal(compatibility("fabric", "1.12.2").supported, false);
  assert.equal(compatibility("paper", "1.21").java, 21);
  assert.match(compatibility("vanilla", "24w14a").notes[0], /development version/);
});

test("specs, docker arguments, players and plugin addresses are validated", () => {
  const spec = validateSpec({ name: "Home", edition: "java", flavour: "paper", version: "1.21", port: 25570, memoryMb: 4096, target: "local-docker" });
  assert.equal(spec.name, "home");
  for (const wrong of [{ name: "Bad Name" }, { name: "x;rm" }, { port: 80 }, { memoryMb: 100 }, { target: "cloud" }, { flavour: "bukkit" }, { version: "1.21; rm" }, { edition: "bedrock" }]) assert.throws(() => validateSpec({ name: "ok", edition: "java", flavour: "vanilla", version: "1.21", target: "local-docker", ...wrong }), (e) => e.status === 400, JSON.stringify(wrong));
  const args = dockerRunArgs(spec);
  assert.deepEqual(args.slice(0, 5), ["run", "-d", "--name", "mar-mc-home", "--restart"]);
  assert.ok(args.includes("-e") && args.includes("TYPE=PAPER") && args.includes("VERSION=1.21") && args.includes("MEMORY=4096M") && args.includes("EULA=TRUE"));
  assert.ok(args.includes("25570:25565") && args.includes("mar-mc-home:/data") && args.at(-1) === "itzg/minecraft-server:java21");
  assert.ok(args.includes("mar.minecraft=1"));
  const bedrock = dockerRunArgs(validateSpec({ name: "b", edition: "bedrock", flavour: "bedrock", version: "1.21.2.01", target: "local-docker" }));
  assert.ok(bedrock.includes("19132:19132/udp") && bedrock.at(-1) === "itzg/minecraft-bedrock-server");
  assert.equal(containerName("home"), "mar-mc-home");
  assert.equal(shellJoin(["docker", "exec", "x", "sh", "-c", "a b; rm -rf /"]), "docker exec x sh -c 'a b; rm -rf /'", "anything unusual is quoted");
  assert.deepEqual(parsePlayers("There are 2 of a max of 20 players online: Pat, Alex"), { online: 2, max: 20, names: ["Pat", "Alex"] });
  assert.deepEqual(parsePlayers("There are 0/10 players online:"), { online: 0, max: 10, names: [] });
  assert.equal(parsePlayers("nothing"), null);
  assert.equal(pluginSource("https://cdn.example.test/dl/EssentialsX-2.20.jar").file, "EssentialsX-2.20.jar");
  for (const wrong of ["http://cdn.example.test/a.jar", "https://localhost/a.jar", "https://203.0.113.4/a.jar", "https://user:pw@cdn.example.test/a.jar", "https://cdn.example.test/a.zip", "https://box.local/a.jar", "nope"]) assert.throws(() => pluginSource(wrong), (e) => e.status === 400, wrong);
  const list = parseDockerList(`${JSON.stringify({ Names: "mar-mc-home", State: "running", Status: "Up 2 hours", Labels: "mar.minecraft=1,mar.name=home,mar.edition=java,mar.flavour=paper,mar.version=1.21,mar.port=25570,mar.memory=4096" })}\n${JSON.stringify({ Names: "other", State: "running", Labels: "x=1" })}\nnot json\n`);
  assert.deepEqual(list.map((s) => [s.name, s.flavour, s.port, s.running]), [["home", "paper", 25570, true]]);
});

test("ssh-docker: create, list, console, players, plugin, properties, stop, start and remove, all on the SSH machine's Docker", async () => {
  resetSim();
  const t = await startApp();
  try {
    const base = { target: "ssh-docker" };
    const check = await act(t, "check", base);
    assert.equal(check.data.available, true);
    assert.match(check.data.runtime, /Docker 27/);

    assert.equal((await act(t, "create", { ...base, name: "home", flavour: "paper", version: "1.21", port: 25570 })).status, 400, "the EULA must be accepted first");
    const made = await act(t, "create", { ...base, name: "home", flavour: "paper", version: "1.21", port: 25570, eula: true });
    assert.equal(made.status, 200, made.text);
    assert.equal(made.data.created, true);
    assert.equal(made.data.compatibility.java, 21);
    assert.equal((await act(t, "create", { ...base, name: "home", flavour: "paper", version: "1.21", eula: true })).status, 422, "a second server with the same name is refused by Docker and reported");
    assert.ok(t.router.commands.some((c) => c.startsWith("docker run -d --name mar-mc-home")));

    const servers = (await act(t, "list", base)).data.servers;
    assert.deepEqual(servers.map((s) => [s.name, s.flavour, s.version, s.port, s.running]), [["home", "paper", "1.21", 25570, true]]);
    assert.match((await act(t, "logs", { ...base, name: "home" })).data.text, /Done/);
    const said = await act(t, "command", { ...base, name: "home", command: "/say hello" });
    assert.equal(said.data.sent, true);
    assert.ok(t.router.commands.some((c) => c.includes("rcon-cli 'say hello'")), "the command is quoted and the slash removed");
    assert.equal((await act(t, "command", { ...base, name: "home", command: "a\nb" })).status, 400);
    const players = (await act(t, "players", { ...base, name: "home" })).data.players;
    assert.deepEqual(players, { online: 1, max: 20, names: ["Pat"] });

    const plugin = await act(t, "plugin", { ...base, name: "home", url: "https://cdn.example.test/dl/EssentialsX.jar" });
    assert.equal(plugin.data.installed, "EssentialsX.jar");
    assert.equal(plugin.data.restartNeeded, true);
    assert.equal((await act(t, "plugin", { ...base, name: "home", url: "http://cdn.example.test/x.jar" })).status, 400);

    const props = (await act(t, "properties", { ...base, name: "home" })).data;
    assert.equal(props.values.motd, "A Minecraft Server");
    assert.ok(props.settings.find((s) => s.key === "server-port").disabled, "Docker owns the port");
    const saved = await act(t, "save-properties", { ...base, name: "home", changes: { motd: "Hello", pvp: "false" } });
    assert.equal(saved.status, 200, saved.text);
    assert.equal(sim.containers.get("mar-mc-home").props.includes("motd=Hello"), true);
    assert.equal((await act(t, "save-properties", { ...base, name: "home", changes: { "server-port": "26000" } })).status, 400, "the locked port cannot be changed");
    assert.equal((await act(t, "save-properties", { ...base, name: "home", changes: { "view-distance": "500" } })).status, 400);

    assert.equal((await act(t, "stop", { ...base, name: "home" })).data.stopped, true);
    assert.equal((await act(t, "list", base)).data.servers[0].running, false);
    assert.equal((await act(t, "players", { ...base, name: "home" })).data.players.online, 0);
    assert.equal((await act(t, "start", { ...base, name: "home" })).data.started, true);

    assert.equal((await act(t, "remove", { ...base, name: "home" })).status, 403, "removing needs the hold");
    assert.equal(sim.containers.size, 1, "nothing was removed without it");
    const removed = await act(t, "remove", { ...base, name: "home", hold: true, removeData: true });
    assert.equal(removed.status, 200, removed.text);
    assert.equal(sim.containers.size, 0);
  } finally {
    await t.stop();
  }
});

test("ssh-docker: remove keeps the world data unless asked, and a missing Docker is reported plainly", async () => {
  resetSim();
  const t = await startApp();
  try {
    const base = { target: "ssh-docker" };
    await act(t, "create", { ...base, name: "w", flavour: "vanilla", version: "1.20.4", eula: true });
    const kept = await act(t, "remove", { ...base, name: "w", hold: true });
    assert.equal(kept.status, 200, kept.text);
    assert.equal(kept.data.dataKept, true);
    assert.equal(sim.containers.size, 0);
    await act(t, "create", { ...base, name: "w2", flavour: "vanilla", version: "1.20.4", eula: true });
    assert.equal((await act(t, "remove", { ...base, name: "w2", hold: true, removeData: true })).data.dataKept, false);

    resetSim({ docker: false });
    const missing = await act(t, "check", base);
    assert.equal(missing.data.available, false);
    assert.match(missing.data.reason, /Docker was not found/);
    const refused = await act(t, "create", { ...base, name: "x", flavour: "vanilla", version: "1.21", eula: true });
    assert.equal(refused.status, 409);
    assert.match(refused.data.error, /Docker was not found/);
  } finally {
    resetSim();
    await t.stop();
  }
});

test("ssh-process: install, start, console, stop and remove run as one script each on the SSH machine, and Java must be new enough", async () => {
  resetSim();
  clearVersionCache();
  const jar = Buffer.from("PK-fake-jar");
  const sha1 = createHash("sha1").update(jar).digest("hex");
  setRuntime({ fetchJson: async (url) => (url.includes("version_manifest") ? MANIFEST : { downloads: { server: { url: "https://piston-data.mojang.com/v1/objects/x/server.jar", sha1, size: jar.length } }, javaVersion: { majorVersion: 21 } }) });
  const t = await startApp();
  try {
    const base = { target: "ssh-process" };
    resetSim({ javaMajor: 8 });
    const old = await act(t, "create", { ...base, name: "p", flavour: "vanilla", version: "1.21", eula: true });
    assert.equal(old.status, 409);
    assert.match(old.data.error, /needs Java 21 or newer.*Java 8/);
    assert.equal(sim.dirs.size, 0, "nothing was installed");

    resetSim({ javaMajor: 21 });
    const made = await act(t, "create", { ...base, name: "p", flavour: "vanilla", version: "1.21", port: 25580, memoryMb: 3072, eula: true });
    assert.equal(made.status, 200, made.text);
    assert.match(sim.dirs.get("p").props, /server-port=25580/);
    assert.equal((await act(t, "create", { ...base, name: "p", flavour: "vanilla", version: "1.21", eula: true })).status, 409, "an existing server is never overwritten");
    assert.equal((await act(t, "create", { ...base, name: "f", flavour: "forge", version: "1.20.1", eula: true })).status, 409, "Forge needs Docker for now");
    assert.equal((await act(t, "create", { target: "ssh-process", name: "b", edition: "bedrock", flavour: "bedrock", version: "1.21.2.01", eula: true })).status, 409, "Bedrock needs Docker for now");

    assert.deepEqual((await act(t, "list", base)).data.servers.map((s) => [s.name, s.running]), [["p", false]]);
    assert.equal((await act(t, "start", { ...base, name: "p" })).data.started, true);
    assert.equal(sim.dirs.get("p").memory, "3072", "the memory chosen at creation is used");
    assert.equal((await act(t, "start", { ...base, name: "p" })).status, 409, "a running server is not started twice");
    assert.deepEqual((await act(t, "players", { ...base, name: "p" })).data.players, { online: 1, max: 20, names: ["Pat"] });
    assert.match((await act(t, "logs", { ...base, name: "p" })).data.text, /Done/);
    assert.equal((await act(t, "remove", { ...base, name: "p", hold: true })).status, 409, "a running server cannot be removed");
    assert.equal((await act(t, "stop", { ...base, name: "p" })).data.stopped, true);
    assert.equal((await act(t, "plugin", { ...base, name: "p", url: "https://cdn.example.test/a.jar" })).status, 409, "plugins need Paper");
    assert.equal((await act(t, "remove", { ...base, name: "p", hold: true, removeData: true })).data.dataKept, false);
    assert.equal(sim.dirs.size, 0);
    assert.ok(t.router.commands.every((c) => !/\bcat\b/.test(c)));
  } finally {
    setRuntime(original);
    resetSim();
    await t.stop();
  }
});

test("local-docker uses the docker program on this computer, with an argument list and never a shell", async () => {
  const calls = [];
  setRuntime({ run: async (command, args) => {
    calls.push([command, ...args]);
    if (args[0] === "version") return { code: 0, stdout: "26.1.0\n", stderr: "" };
    if (args[0] === "ps") return { code: 0, stdout: `${JSON.stringify({ Names: "mar-mc-a", State: "running", Status: "Up", Labels: "mar.minecraft=1,mar.name=a,mar.edition=java,mar.flavour=fabric,mar.version=1.21,mar.port=25565,mar.memory=2048" })}\n`, stderr: "" };
    return { code: 0, stdout: "ok\n", stderr: "" };
  } });
  const t = await startApp();
  try {
    const base = { target: "local-docker" };
    assert.equal((await act(t, "check", base)).data.available, true);
    const made = await act(t, "create", { ...base, name: "a", flavour: "fabric", version: "1.21", eula: true });
    assert.equal(made.status, 200, made.text);
    const run = calls.find((c) => c[1] === "run");
    assert.equal(run[0], "docker");
    assert.ok(run.includes("TYPE=FABRIC") && run.includes("mar-mc-a"));
    assert.equal((await act(t, "logs", { ...base, name: "a" })).status, 200);
    assert.ok(calls.some((c) => c[1] === "logs" && c.includes("--tail")));
    assert.equal((await act(t, "stop", { ...base, name: "a" })).status, 200);
    assert.equal((await act(t, "create", { ...base, name: "evil; rm -rf /", flavour: "vanilla", version: "1.21", eula: true })).status, 400);
    assert.ok(calls.every((c) => !c.join(" ").includes("rm -rf")), "a hostile name never reaches docker");
  } finally {
    setRuntime(original);
    await t.stop();
  }
});

test("local-process downloads from an official source, checks the checksum, runs Java and talks to its console", async () => {
  clearVersionCache();
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-mc-"));
  const jar = Buffer.from("PK-the-server-jar");
  const sha1 = createHash("sha1").update(jar).digest("hex");
  const children = [];
  const spawned = [];
  setRuntime({
    base: dir,
    run: async (command, args) => (command === "java" ? { code: 0, stdout: "", stderr: 'openjdk version "21.0.2" 2024-01-16' } : { code: 127, stdout: "", stderr: "not found" }),
    fetchJson: async (url) => (url.includes("version_manifest") ? MANIFEST : { downloads: { server: { url: "https://piston-data.mojang.com/v1/objects/x/server.jar", sha1, size: jar.length } }, javaVersion: { majorVersion: 21 } }),
    fetchBuffer: async (url) => (url.includes("plugin") ? Buffer.from("PK-plugin") : jar),
    spawn: (command, args, options) => {
      const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), stdin: { writes: [], write(s) { this.writes.push(s); } } });
      spawned.push({ command, args, options });
      children.push(child);
      return child;
    },
  });
  const t = await startApp();
  try {
    const base = { target: "local-process" };
    const made = await act(t, "create", { ...base, name: "solo", flavour: "vanilla", version: "1.21", port: 25590, memoryMb: 1536, eula: true });
    assert.equal(made.status, 200, made.text);
    assert.deepEqual((await readFile(path.join(dir, "solo", "server.jar"))), jar);
    assert.equal((await readFile(path.join(dir, "solo", "eula.txt"), "utf8")).trim(), "eula=true");
    assert.match(await readFile(path.join(dir, "solo", "server.properties"), "utf8"), /server-port=25590/);
    assert.equal((await act(t, "create", { ...base, name: "solo", flavour: "vanilla", version: "1.21", eula: true })).status, 409, "never overwritten");

    setRuntime({ fetchBuffer: async () => Buffer.from("tampered") });
    const bad = await act(t, "create", { ...base, name: "tampered", flavour: "vanilla", version: "1.21", eula: true });
    assert.equal(bad.status, 502);
    assert.match(bad.data.error, /did not match Mojang's checksum/);
    assert.equal(await stat(path.join(dir, "tampered")).catch(() => null), null, "a bad download leaves nothing behind");
    setRuntime({ fetchBuffer: async (url) => (url.includes("plugin") ? Buffer.from("PK-plugin") : jar) });

    const started = await act(t, "start", { ...base, name: "solo" });
    assert.equal(started.status, 200, started.text);
    assert.deepEqual(spawned[0].args, ["-Xmx1536M", "-jar", "server.jar", "nogui"], "an argument list, never a shell");
    assert.equal(spawned[0].options.cwd, path.join(dir, "solo"));
    children[0].stdout.emit("data", "[Server thread/INFO]: Done!\n");
    assert.match((await act(t, "logs", { ...base, name: "solo" })).data.text, /Done!/);
    assert.deepEqual((await act(t, "list", base)).data.servers.map((s) => [s.name, s.running, s.version]), [["solo", true, "1.21"]]);
    const sent = act(t, "command", { ...base, name: "solo", command: "/list" });
    await waitFor(() => children[0].stdin.writes.includes("list\n"));
    children[0].stdout.emit("data", "There are 1 of a max of 20 players online: Pat\n");
    const answer = await sent;
    assert.equal(answer.status, 200);
    assert.match(answer.data.output, /There are 1 of a max of 20 players online: Pat/, "the console output that came back is returned");
    assert.equal((await act(t, "remove", { ...base, name: "solo", hold: true })).status, 409, "stop it first");
    assert.equal((await act(t, "stop", { ...base, name: "solo" })).status, 200);
    assert.ok(children[0].stdin.writes.includes("stop\n"));
    children[0].emit("exit", 0);
    assert.equal((await act(t, "list", base)).data.servers[0].running, false);
    const gone = await act(t, "remove", { ...base, name: "solo", hold: true, removeData: true });
    assert.equal(gone.data.dataKept, false);
    assert.deepEqual(await readdir(dir), [], "removing with the data leaves nothing behind");
  } finally {
    setRuntime(original);
    await rm(dir, { recursive: true, force: true });
    await t.stop();
  }
});

test("local-process is honest when Java is missing or too old", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mar-mc-"));
  setRuntime({ base: dir, run: async () => ({ code: 127, stdout: "", stderr: "java: not found" }) });
  const t = await startApp();
  try {
    const check = await act(t, "check", { target: "local-process" });
    assert.equal(check.data.available, false);
    assert.match(check.data.reason, /Java was not found/);
    const refused = await act(t, "create", { target: "local-process", name: "a", flavour: "vanilla", version: "1.21", eula: true });
    assert.equal(refused.status, 409);
    setRuntime({ run: async () => ({ code: 0, stdout: "", stderr: 'openjdk version "11.0.2"' }) });
    assert.match((await act(t, "check", { target: "local-process", version: "1.21" })).data.reason, /needs Java 21 or newer.*Java 11/);
  } finally {
    setRuntime(original);
    await rm(dir, { recursive: true, force: true });
    await t.stop();
  }
});

test("the version, schema and target routes work for any signed-in person, and roles guard the actions", async () => {
  clearVersionCache();
  setRuntime({ fetchJson: async () => MANIFEST });
  const t = await startApp();
  try {
    assert.equal((await t.owner.get("/api/x/minecraft-server-manager/targets")).data.targets.length, 4);
    assert.deepEqual((await t.owner.get("/api/x/minecraft-server-manager/flavours")).data.flavours.map((f) => f.id), ["vanilla", "paper", "fabric", "forge", "bedrock"]);
    const versions = (await t.owner.get("/api/x/minecraft-server-manager/versions?flavour=vanilla")).data;
    assert.equal(versions.versions.length, 4);
    assert.equal((await t.owner.get("/api/x/minecraft-server-manager/versions?flavour=nope")).status, 400);
    const schema = (await t.owner.get("/api/x/minecraft-server-manager/schema?edition=java&version=1.12.2")).data.settings;
    assert.ok(schema.find((s) => s.key === "simulation-distance").disabled);
    assert.equal((await t.owner.get("/api/x/minecraft-server-manager/compatibility?flavour=fabric&version=1.12.2")).data.supported, false);
    assert.equal((await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" })).status, 201);
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/x/minecraft-server-manager/targets")).status, 200);
    assert.equal((await guest.post("/api/actions/minecraft-server-manager.create", { target: "local-docker", name: "x", flavour: "vanilla", version: "1.21", eula: true })).status, 403);
    assert.equal((await t.client().post("/api/actions/minecraft-server-manager.list", { target: "local-docker" })).status, 401);
  } finally {
    setRuntime(original);
    await t.stop();
  }
});

test("the browser module is well formed and served", async () => {
  assert.equal(checkFeatureModule(feature, "minecraft-server-manager"), null);
  const t = await startApp();
  try {
    assert.ok((await t.owner.get("/api/features/manifest")).data.modules.includes("/js/features/minecraft-server-manager/index.js"));
  } finally {
    await t.stop();
  }
});
