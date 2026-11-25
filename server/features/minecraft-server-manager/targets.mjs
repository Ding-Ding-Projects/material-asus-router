// The four places a server can live, behind one set of operations:
//   local-docker  the docker program on this computer
//   ssh-docker    docker on the machine the app's SSH connection reaches
//   local-process Java started by this app on this computer
//   ssh-process   Java started with a script on the SSH machine
// Every command is built from validated pieces and passed as an argument list
// (or, over SSH, quoted piece by piece). Nothing a person types is ever
// pasted into a shell.
import { createHash } from "node:crypto";
import path from "node:path";
import { quote } from "../kit.mjs";
import { javaMajor } from "./properties.mjs";
import { runtime } from "./runtime.mjs";
import { officialUrl, resolveDownload } from "./versions.mjs";

export const TARGETS = ["local-process", "local-docker", "ssh-process", "ssh-docker"];
const bad = (message, status = 400) => Object.assign(new Error(message), { status });

export const NAME = /^[a-z0-9][a-z0-9-]{0,30}$/;
const VERSION = /^[A-Za-z0-9._-]{1,32}$/;
export const containerName = (name) => `mar-mc-${name}`;
export const volumeName = (name) => `mar-mc-${name}`;

export function validateSpec(input) {
  const spec = {
    name: String(input.name ?? "").trim().toLowerCase(),
    edition: input.edition === "bedrock" ? "bedrock" : "java",
    flavour: String(input.flavour ?? "vanilla"),
    version: String(input.version ?? "").trim(),
    port: Number(input.port ?? (input.edition === "bedrock" ? 19132 : 25565)),
    memoryMb: Number(input.memoryMb ?? 2048),
    target: String(input.target ?? ""),
  };
  if (!TARGETS.includes(spec.target)) throw bad(`Choose one of the four targets: ${TARGETS.join(", ")}.`);
  if (!NAME.test(spec.name)) throw bad("A server name uses lowercase letters, digits and dashes, starts with a letter or digit, and is at most 31 characters.");
  if (!["vanilla", "paper", "fabric", "forge", "bedrock"].includes(spec.flavour)) throw bad("Choose Vanilla, Paper, Fabric, Forge or Bedrock.");
  if ((spec.flavour === "bedrock") !== (spec.edition === "bedrock")) throw bad("Bedrock is the only Bedrock flavour.");
  if (!VERSION.test(spec.version)) throw bad("Choose a version.");
  if (!Number.isInteger(spec.port) || spec.port < 1024 || spec.port > 65535) throw bad("The port must be a whole number from 1024 to 65535.");
  if (!Number.isInteger(spec.memoryMb) || spec.memoryMb < 512 || spec.memoryMb > 65536) throw bad("Memory must be from 512 to 65536 MB.");
  return spec;
}

// docker arguments are joined for SSH, quoting only what needs it.
export const shellJoin = (args) => args.map((a) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(a) ? a : quote(a))).join(" ");

// ---- docker -------------------------------------------------------------------------

export const dockerTag = (version) => `java${javaMajor(version) >= 21 ? 21 : javaMajor(version) >= 17 ? 17 : 8}`;

export function dockerRunArgs(spec) {
  const labels = ["minecraft=1", `name=${spec.name}`, `edition=${spec.edition}`, `flavour=${spec.flavour}`, `version=${spec.version}`, `port=${spec.port}`, `memory=${spec.memoryMb}`].flatMap((l) => ["--label", `mar.${l}`]);
  const head = ["run", "-d", "--name", containerName(spec.name), "--restart", "unless-stopped", ...labels];
  if (spec.edition === "bedrock") return [...head, "-p", `${spec.port}:19132/udp`, "-e", "EULA=TRUE", "-e", `VERSION=${spec.version === "latest" ? "LATEST" : spec.version}`, "-v", `${volumeName(spec.name)}:/data`, "itzg/minecraft-bedrock-server"];
  const type = spec.flavour.toUpperCase();
  return [...head, "-p", `${spec.port}:25565`, "-e", "EULA=TRUE", "-e", `TYPE=${type}`, "-e", `VERSION=${spec.version}`, "-e", `MEMORY=${spec.memoryMb}M`, "-v", `${volumeName(spec.name)}:/data`, `itzg/minecraft-server:${dockerTag(spec.version)}`];
}

export function parseDockerList(stdout) {
  return stdout.split("\n").filter(Boolean).flatMap((line) => {
    try {
      const row = JSON.parse(line);
      const labels = Object.fromEntries(String(row.Labels ?? "").split(",").map((p) => p.split(/=(.*)/s).slice(0, 2)));
      if (labels["mar.minecraft"] !== "1") return [];
      return [{ name: labels["mar.name"], edition: labels["mar.edition"], flavour: labels["mar.flavour"], version: labels["mar.version"], port: Number(labels["mar.port"]), memoryMb: Number(labels["mar.memory"] ?? 0), running: row.State === "running", status: row.Status ?? row.State }];
    } catch {
      return [];
    }
  });
}

// "There are 2 of a max of 20 players online: Pat, Alex" and the older
// "There are 2/20 players online:" forms.
export function parsePlayers(text) {
  const m = /There are (\d+)(?: of a max of |\/)(\d+) players online:?\s*([^\n]*)/i.exec(String(text).replace(/\u001b\[[0-9;]*m/g, ""));
  if (!m) return null;
  return { online: Number(m[1]), max: Number(m[2]), names: m[3].split(",").map((s) => s.trim()).filter(Boolean) };
}

const COMMAND = /^[^\r\n\0]{1,256}$/;
export const consoleCommand = (text) => {
  const value = String(text ?? "").trim().replace(/^\//, "");
  if (!COMMAND.test(value)) throw bad("A console command is one line of at most 256 characters.");
  return value;
};

// A plugin address must be https and a real host name. Downloads from it are
// done by the target, never by the browser.
export function pluginSource(url, file) {
  let u;
  try {
    u = new URL(String(url));
  } catch {
    throw bad("The plugin address is not valid.");
  }
  if (u.protocol !== "https:" || u.username || u.password) throw bad("A plugin address must start with https and carry no password.");
  if (/^[\d.]+$/.test(u.hostname) || u.hostname.includes(":") || !u.hostname.includes(".") || /(^|\.)(localhost|local|internal|lan|home)$/.test(u.hostname)) throw bad("A plugin must come from a public host name, not an address on a local network.");
  const name = file ?? decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,80}\.jar$/.test(name) || name.includes(" ")) throw bad("The plugin file name must end in .jar and use letters, digits, dots, dashes and underscores.");
  return { url: u.href, file: name };
}

const docker = (io, args, o) => io.docker(args, o);
const failed = (r, what) => { if (r.code !== 0) throw Object.assign(bad((r.stderr || r.stdout || `${what} failed.`).trim().split("\n")[0].slice(0, 300), 422), { code: "TARGET_FAILED" }); return r; };

// io = { docker(args, options) -> { code, stdout, stderr } }
export const dockerBackend = (io) => ({
  async check() {
    const r = await docker(io, ["version", "--format", "{{.Server.Version}}"]);
    return r.code === 0 ? { available: true, runtime: `Docker ${r.stdout.trim()}` } : { available: false, reason: /not found|not recognized/i.test(r.stderr) ? "Docker was not found on that machine." : (r.stderr || "Docker did not answer.").trim().split("\n")[0].slice(0, 200) };
  },
  async list() {
    return parseDockerList(failed(await docker(io, ["ps", "-a", "--filter", "label=mar.minecraft=1", "--format", "{{json .}}"]), "Listing servers").stdout);
  },
  async create(spec) {
    failed(await docker(io, dockerRunArgs(spec), { timeoutMs: 15 * 60 * 1000 }), "Creating the server");
    return { created: true, note: "Docker is pulling the server image and starting it. The first start takes a few minutes while the server downloads the game." };
  },
  async start(name) { failed(await docker(io, ["start", containerName(name)]), "Starting"); return { started: true }; },
  async stop(name) { failed(await docker(io, ["stop", "--time", "60", containerName(name)], { timeoutMs: 90000 }), "Stopping"); return { stopped: true }; },
  async remove(name, { data = false } = {}) {
    failed(await docker(io, ["rm", "-f", containerName(name)]), "Removing");
    if (data) failed(await docker(io, ["volume", "rm", volumeName(name)]), "Removing the world data");
    return { removed: true, dataKept: !data };
  },
  async logs(name, lines = 200) { return { text: failed(await docker(io, ["logs", "--tail", String(Math.min(2000, Math.max(1, lines))), containerName(name)]), "Reading the log").stdout + "" }; },
  async command(name, text, edition = "java") {
    const cmd = consoleCommand(text);
    if (edition === "bedrock") { failed(await docker(io, ["exec", containerName(name), "send-command", cmd]), "Sending the command"); return { sent: true, output: "" }; }
    return { sent: true, output: failed(await docker(io, ["exec", containerName(name), "rcon-cli", cmd]), "Sending the command").stdout.trim() };
  },
  async plugin(name, url, file) {
    const src = pluginSource(url, file);
    failed(await docker(io, ["exec", containerName(name), "mkdir", "-p", "/data/plugins"]), "Making the plugins folder");
    failed(await docker(io, ["exec", containerName(name), "curl", "-fsSL", "--max-filesize", "104857600", "-o", `/data/plugins/${src.file}`, src.url], { timeoutMs: 120000 }), "Downloading the plugin");
    return { installed: src.file, restartNeeded: true };
  },
  async readProps(name) { return failed(await docker(io, ["exec", containerName(name), "head", "-n", "100000", "/data/server.properties"]), "Reading server.properties").stdout; },
  async writeProps(name, text) {
    const b64 = Buffer.from(text).toString("base64");
    failed(await docker(io, ["exec", containerName(name), "sh", "-c", `printf %s ${b64} | base64 -d > /data/server.properties`]), "Writing server.properties");
    return { saved: true, restartNeeded: true };
  },
});

// ---- Java process, on this computer ----------------------------------------------------------

const ring = (list, line, max = 500) => { list.push(line); if (list.length > max) list.splice(0, list.length - max); };
const dirOf = (name) => path.join(runtime.base, name);
const running = new Map(); // name -> { child, lines }
export const localProcesses = running;

async function sha(bytes, algorithm) {
  return createHash(algorithm).update(bytes).digest("hex");
}

export async function javaVersion(run = (c, a) => runtime.run(c, a)) {
  const r = await run("java", ["-version"]);
  const text = `${r.stderr}\n${r.stdout}`;
  const m = /version "(\d+)(?:\.(\d+))?/.exec(text);
  if (r.code !== 0 || !m) return { available: false, reason: /not found/i.test(text) || r.code === 127 ? "Java was not found on that machine." : "Java did not answer." };
  const major = m[1] === "1" ? Number(m[2]) : Number(m[1]);
  return { available: true, major, runtime: `Java ${major}` };
}

export const localProcessBackend = () => ({
  async check(version) {
    const java = await javaVersion();
    if (!java.available) return java;
    const needed = version ? javaMajor(version) : null;
    return needed && java.major < needed ? { available: false, reason: `Minecraft ${version} needs Java ${needed} or newer; this computer has Java ${java.major}.`, runtime: java.runtime } : java;
  },
  async list() {
    const out = [];
    for (const entry of await runtime.fs.readdir(runtime.base, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory()) continue;
      try {
        const meta = JSON.parse(await runtime.fs.readFile(path.join(runtime.base, entry.name, "mar-server.json"), "utf8"));
        out.push({ ...meta, running: running.has(entry.name), status: running.has(entry.name) ? "running" : "stopped" });
      } catch {
        // A folder without our file is not one of ours.
      }
    }
    return out;
  },
  async create(spec, { properties }) {
    if (spec.edition === "bedrock") throw bad("Bedrock runs only in Docker for now. Choose a Docker target.", 409);
    if (spec.flavour === "forge") throw bad("Forge needs its installer run, which is not built yet. Choose a Docker target for Forge.", 409);
    const dir = dirOf(spec.name);
    if (await runtime.fs.stat(dir).catch(() => null)) throw bad(`A server called ${spec.name} already exists here. Nothing was changed.`, 409);
    const download = await resolveDownload(spec.flavour, spec.version, runtime);
    if (!download.available) throw bad(download.reason ?? "There is no download for that version.", 404);
    const bytes = await runtime.fetchBuffer(officialUrl(download.url));
    if (download.sha1 && (await sha(bytes, "sha1")) !== download.sha1) throw bad("The downloaded file did not match Mojang's checksum, so it was thrown away.", 502);
    if (download.sha256 && (await sha(bytes, "sha256")) !== download.sha256) throw bad("The downloaded file did not match the published checksum, so it was thrown away.", 502);
    await runtime.fs.mkdir(dir, { recursive: true });
    await runtime.fs.writeFile(path.join(dir, "server.jar"), bytes);
    await runtime.fs.writeFile(path.join(dir, "eula.txt"), "eula=true\n");
    await runtime.fs.writeFile(path.join(dir, "server.properties"), properties);
    await runtime.fs.writeFile(path.join(dir, "mar-server.json"), JSON.stringify({ name: spec.name, edition: spec.edition, flavour: spec.flavour, version: spec.version, port: spec.port, memoryMb: spec.memoryMb, target: "local-process", createdAt: new Date().toISOString() }));
    return { created: true, bytes: bytes.length, note: "Downloaded and checked. Start it when you are ready." };
  },
  async start(name) {
    if (running.has(name)) throw bad("That server is already running.", 409);
    const meta = JSON.parse(await runtime.fs.readFile(path.join(dirOf(name), "mar-server.json"), "utf8").catch(() => { throw bad("There is no server with that name here.", 404); }));
    const child = runtime.spawn("java", [`-Xmx${meta.memoryMb}M`, "-jar", "server.jar", "nogui"], { cwd: dirOf(name), stdio: ["pipe", "pipe", "pipe"] });
    const lines = [];
    const take = (chunk) => String(chunk).split(/\r?\n/).filter(Boolean).forEach((l) => ring(lines, l));
    child.stdout?.on("data", take);
    child.stderr?.on("data", take);
    child.on("exit", (code) => { ring(lines, `[server stopped with code ${code}]`); running.delete(name); });
    child.on("error", (error) => { ring(lines, `[could not start: ${error.message}]`); running.delete(name); });
    running.set(name, { child, lines });
    return { started: true };
  },
  async stop(name) {
    const r = running.get(name);
    if (!r) throw bad("That server is not running.", 409);
    r.child.stdin.write("stop\n");
    return { stopped: true, note: "The server was asked to stop and saves the world before it exits." };
  },
  async remove(name, { data = false } = {}) {
    if (running.has(name)) throw bad("Stop the server before removing it.", 409);
    if (!data) { await runtime.fs.rm(path.join(dirOf(name), "mar-server.json")); return { removed: true, dataKept: true }; }
    await runtime.fs.rm(dirOf(name), { recursive: true });
    return { removed: true, dataKept: false };
  },
  async logs(name, lines = 200) {
    const r = running.get(name);
    if (r) return { text: r.lines.slice(-lines).join("\n") };
    const text = await runtime.fs.readFile(path.join(dirOf(name), "logs", "latest.log"), "utf8").catch(() => "");
    return { text: text.split("\n").slice(-lines).join("\n") };
  },
  async command(name, text) {
    const cmd = consoleCommand(text);
    const r = running.get(name);
    if (!r) throw bad("The server is not running, so it cannot take commands.", 409);
    const before = r.lines.length;
    r.child.stdin.write(`${cmd}\n`);
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { sent: true, output: r.lines.slice(before).join("\n") };
  },
  async plugin(name, url, file) {
    const src = pluginSource(url, file);
    const bytes = await runtime.fetchBuffer(src.url, { maxBytes: 100 * 1024 * 1024 });
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw bad("That download is not a jar file, so it was not installed.", 422);
    await runtime.fs.mkdir(path.join(dirOf(name), "plugins"), { recursive: true });
    await runtime.fs.writeFile(path.join(dirOf(name), "plugins", src.file), bytes, { flag: "wx" }).catch((e) => { throw e.code === "EEXIST" ? bad(`${src.file} is already installed. Nothing was replaced.`, 409) : e; });
    return { installed: src.file, restartNeeded: true };
  },
  async readProps(name) { return runtime.fs.readFile(path.join(dirOf(name), "server.properties"), "utf8"); },
  async writeProps(name, text) { await runtime.fs.writeFile(path.join(dirOf(name), "server.properties"), text); return { saved: true, restartNeeded: running.has(name) }; },
});

// ---- Java process, over SSH --------------------------------------------------------------------------

// Every script starts with MAR_OP=<operation> so it is easy to recognise in
// logs, and uses the SSH user's home folder, never a path typed by a person.
const home = (name) => `"$HOME"/minecraft/${name}`;
export const sshProcessBackend = (exec) => {
  const run = async (script, timeoutMs = 30000) => exec(script, { timeoutMs });
  return {
    async check(version) {
      const java = await javaVersion((c, a) => run(shellJoin([c, ...a]).concat(" 2>&1")));
      if (!java.available) return java;
      const needed = version ? javaMajor(version) : null;
      return needed && java.major < needed ? { available: false, reason: `Minecraft ${version} needs Java ${needed} or newer; that machine has Java ${java.major}.`, runtime: java.runtime } : java;
    },
    async list() {
      const r = await run(`MAR_OP=list; for f in "$HOME"/minecraft/*/mar-server.json; do [ -f "$f" ] && head -n 100000 "$f" && echo; done`);
      const metas = r.stdout.split(String.fromCharCode(10)).filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
      return Promise.all(metas.map(async (m) => {
        const alive = await run(`MAR_OP=status; d=${home(m.name)}; if [ -f "$d"/server.pid ] && kill -0 "$(head -n 1 "$d"/server.pid)" 2>/dev/null; then echo running; else echo stopped; fi`);
        const isRunning = alive.stdout.trim() === "running";
        return { ...m, running: isRunning, status: isRunning ? "running" : "stopped" };
      }));
    },
    async create(spec, { properties }) {
      if (spec.edition === "bedrock") throw bad("Bedrock runs only in Docker for now. Choose a Docker target.", 409);
      if (spec.flavour === "forge") throw bad("Forge needs its installer run, which is not built yet. Choose a Docker target for Forge.", 409);
      const download = await resolveDownload(spec.flavour, spec.version, runtime);
      if (!download.available) throw bad(download.reason ?? "There is no download for that version.", 404);
      const meta = JSON.stringify({ name: spec.name, edition: spec.edition, flavour: spec.flavour, version: spec.version, port: spec.port, memoryMb: spec.memoryMb, target: "ssh-process", createdAt: new Date().toISOString() });
      const b64 = (s) => Buffer.from(s).toString("base64");
      const check = download.sha1 ? `echo ${download.sha1}  server.jar | sha1sum -c - >/dev/null || { rm -f server.jar; echo checksum-mismatch >&2; exit 3; }` : "true";
      const script = `MAR_OP=install; d=${home(spec.name)}; [ -e "$d" ] && { echo exists >&2; exit 9; }; mkdir -p "$d" && cd "$d" && curl -fsSL --max-filesize 629145600 -o server.jar ${quote(officialUrl(download.url))} && ${check} && echo eula=true > eula.txt && printf %s ${b64(properties)} | base64 -d > server.properties && printf %s ${b64(meta)} | base64 -d > mar-server.json`;
      const r = await run(script, 15 * 60 * 1000);
      if (r.code === 9) throw bad(`A server called ${spec.name} already exists on that machine. Nothing was changed.`, 409);
      if (r.code === 3) throw bad("The downloaded file did not match the published checksum, so it was removed.", 502);
      failed(r, "Installing the server");
      return { created: true, note: "Downloaded and checked on that machine. Start it when you are ready." };
    },
    async start(name, { memoryMb = 2048 } = {}) {
      const mem = Math.min(65536, Math.max(512, Number(memoryMb) || 2048));
      const r = await run(`MAR_OP=start; cd ${home(name)} || exit 2; if [ -f server.pid ] && kill -0 "$(head -n 1 server.pid)" 2>/dev/null; then echo running >&2; exit 9; fi; [ -p console.in ] || mkfifo console.in; ( nohup sh -c 'exec 3<>console.in; exec java -Xmx${mem}M -jar server.jar nogui <&3' > console.log 2>&1 < /dev/null & echo $! > server.pid )`);
      if (r.code === 9) throw bad("That server is already running.", 409);
      if (r.code === 2) throw bad("There is no server with that name on that machine.", 404);
      failed(r, "Starting");
      return { started: true };
    },
    async stop(name) { failed(await run(`MAR_OP=stop; cd ${home(name)} && printf 'stop\\n' > console.in`), "Stopping"); return { stopped: true, note: "The server was asked to stop and saves the world before it exits." }; },
    async remove(name, { data = false } = {}) {
      const r = await run(`MAR_OP=remove; cd ${home(name)} && { [ -f server.pid ] && kill -0 "$(head -n 1 server.pid)" 2>/dev/null && { echo running >&2; exit 9; }; true; } && ${data ? `cd .. && rm -rf ${name}` : "rm -f mar-server.json"}`);
      if (r.code === 9) throw bad("Stop the server before removing it.", 409);
      failed(r, "Removing");
      return { removed: true, dataKept: !data };
    },
    async logs(name, lines = 200) { return { text: failed(await run(`MAR_OP=logs; tail -n ${Math.min(2000, Math.max(1, Number(lines) || 200))} ${home(name)}/console.log`), "Reading the log").stdout }; },
    async command(name, text) {
      const cmd = consoleCommand(text);
      failed(await run(`MAR_OP=command; printf '%s\\n' ${quote(cmd)} > ${home(name)}/console.in`), "Sending the command");
      await new Promise((r) => setTimeout(r, 400));
      return { sent: true, output: (await run(`MAR_OP=logs; tail -n 5 ${home(name)}/console.log`)).stdout.trim() };
    },
    async plugin(name, url, file) {
      const src = pluginSource(url, file);
      const r = await run(`MAR_OP=plugin; d=${home(name)}/plugins; mkdir -p "$d" && [ ! -e "$d"/${quote(src.file)} ] && curl -fsSL --max-filesize 104857600 -o "$d"/${quote(src.file)} ${quote(src.url)}`, 120000);
      if (r.code === 1 && !r.stderr) throw bad(`${src.file} is already installed. Nothing was replaced.`, 409);
      failed(r, "Downloading the plugin");
      return { installed: src.file, restartNeeded: true };
    },
    async readProps(name) { return failed(await run(`MAR_OP=props; head -n 100000 ${home(name)}/server.properties`), "Reading server.properties").stdout; },
    async writeProps(name, text) { failed(await run(`MAR_OP=props-save; printf %s ${Buffer.from(text).toString("base64")} | base64 -d > ${home(name)}/server.properties`), "Writing server.properties"); return { saved: true, restartNeeded: true }; },
  };
};

