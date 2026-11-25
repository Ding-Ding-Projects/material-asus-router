// The Minecraft server creator and manager: a tool tab that is unrelated to
// routing, kept here because every app ships it. It
// finds every server version from the official sources, makes a server and
// manages it on one of four targets (local Docker, SSH Docker, local process,
// SSH process), with a console, players, plugins and a typed properties editor.
// The SSH targets use the app's own SSH connection, which is the router's.
import { handler, resetSim } from "./fake.mjs";
import { applyProperties, defaultProperties, parseProperties, settingsFor } from "./properties.mjs";
import { runtime } from "./runtime.mjs";
import { TARGETS, consoleCommand, dockerBackend, localProcessBackend, parsePlayers, shellJoin, sshProcessBackend, validateSpec } from "./targets.mjs";
import { FLAVOURS, compatibility, discover } from "./versions.mjs";

const bad = (message, status = 400) => Object.assign(new Error(message), { status });

export const TARGET_INFO = [
  { id: "local-docker", name: { en: "Docker on this computer", yue: "呢部電腦嘅 Docker" }, needs: "docker", note: { en: "Runs the server in a container. Works for every flavour, including Bedrock and Forge.", yue: "喺容器入面運行。所有類型都得，包括 Bedrock 同 Forge。" } },
  { id: "ssh-docker", name: { en: "Docker over SSH", yue: "經 SSH 嘅 Docker" }, needs: "docker", note: { en: "Uses this app's SSH connection, which is the router's. Docker must be installed on that machine. Other SSH machines are not built yet.", yue: "用呢個程式嘅 SSH 連線，即係路由器嘅。嗰部機要裝咗 Docker。其他 SSH 機器未做。" } },
  { id: "local-process", name: { en: "Java process on this computer", yue: "呢部電腦嘅 Java 程序" }, needs: "java", note: { en: "Runs the server as a program started by this app. It stops when this app stops. Vanilla, Paper and Fabric; Bedrock and Forge need Docker.", yue: "由呢個程式啟動伺服器程序，程式停止佢都會停。支援 Vanilla、Paper、Fabric；Bedrock 同 Forge 要用 Docker。" } },
  { id: "ssh-process", name: { en: "Java process over SSH", yue: "經 SSH 嘅 Java 程序" }, needs: "java", note: { en: "Installs and runs Java on the SSH machine with nohup. Vanilla, Paper and Fabric; Bedrock and Forge need Docker.", yue: "用 nohup 喺 SSH 機器安裝同運行 Java。支援 Vanilla、Paper、Fabric；Bedrock 同 Forge 要用 Docker。" } },
];

function backend(target, ctx) {
  switch (target) {
    case "local-docker": return dockerBackend({ docker: (args, o) => runtime.run("docker", args, o) });
    case "ssh-docker": return dockerBackend({ docker: (args, o) => ctx.exec(shellJoin(["docker", ...args]), o) });
    case "local-process": return localProcessBackend();
    case "ssh-process": return sshProcessBackend((script, o) => ctx.exec(script, o));
    default: throw bad(`Choose one of the four targets: ${TARGETS.join(", ")}.`);
  }
}
const nameOf = (body) => {
  const name = String(body.name ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,30}$/.test(name)) throw bad("Choose a server by its name.");
  return name;
};
const isDocker = (target) => target.endsWith("docker");

async function findServer(b, name) {
  const found = (await b.list()).find((s) => s.name === name);
  if (!found) throw bad(`There is no server called ${name} on that target.`, 404);
  return found;
}

// Each action: what it needs from the body and what it does. The wording of
// every failure is the target's own, shortened.
const operations = {
  async check({ body, ctx }) {
    const target = String(body.target);
    const b = backend(target, ctx);
    return { target, ...(await b.check(body.version)) };
  },
  async list({ body, ctx }) {
    return { servers: await backend(String(body.target), ctx).list() };
  },
  async create({ body, ctx }) {
    if (body.eula !== true) throw bad("Accept the Minecraft EULA first. The server will not start without it.", 400);
    const spec = validateSpec(body);
    const fit = compatibility(spec.flavour, spec.version);
    if (!fit.supported) throw bad(fit.notes.join(" "), 409);
    if (spec.edition === "bedrock" && !isDocker(spec.target)) throw bad("Bedrock runs only in Docker for now. Choose a Docker target.", 409);
    const b = backend(spec.target, ctx);
    const runtimeCheck = await b.check(spec.edition === "bedrock" ? null : spec.version);
    if (!runtimeCheck.available) throw bad(runtimeCheck.reason, 409);
    const properties = defaultProperties(spec.edition, spec.version, { "server-port": spec.port, motd: String(body.motd ?? "A Minecraft Server").slice(0, 120).replace(/[\r\n]/g, " ") });
    return { name: spec.name, target: spec.target, ...(await b.create(spec, { properties })), compatibility: fit };
  },
  async start({ body, ctx }) {
    const b = backend(String(body.target), ctx);
    const name = nameOf(body);
    const found = await findServer(b, name);
    return b.start(name, { memoryMb: found.memoryMb || 2048 });
  },
  async stop({ body, ctx }) { return backend(String(body.target), ctx).stop(nameOf(body)); },
  async remove({ body, ctx }) { return backend(String(body.target), ctx).remove(nameOf(body), { data: body.removeData === true }); },
  async command({ body, ctx }) {
    const b = backend(String(body.target), ctx);
    const name = nameOf(body);
    const found = await findServer(b, name);
    return b.command(name, consoleCommand(body.command), found.edition);
  },
  async logs({ body, ctx }) { return backend(String(body.target), ctx).logs(nameOf(body), Number(body.lines) || 200); },
  async players({ body, ctx }) {
    const b = backend(String(body.target), ctx);
    const name = nameOf(body);
    const found = await findServer(b, name);
    if (found.edition === "bedrock") return { players: null, note: "Bedrock does not answer the player list through the console here." };
    if (!found.running) return { players: { online: 0, max: null, names: [] }, note: "The server is not running." };
    const out = await b.command(name, "list", found.edition);
    return { players: parsePlayers(out.output), raw: out.output };
  },
  async plugin({ body, ctx }) {
    const b = backend(String(body.target), ctx);
    const name = nameOf(body);
    const found = await findServer(b, name);
    if (found.flavour !== "paper") throw bad("Plugins need a Paper server. This one is " + found.flavour + ". Mods (Fabric or Forge) are not installed here yet.", 409);
    return b.plugin(name, body.url, body.file);
  },
  async properties({ body, ctx }) {
    const b = backend(String(body.target), ctx);
    const name = nameOf(body);
    const found = await findServer(b, name);
    const text = await b.readProps(name);
    return { settings: describe(found, String(body.target)), values: Object.fromEntries(parseProperties(text)), edition: found.edition, version: found.version, flavour: found.flavour };
  },
  async "save-properties"({ body, ctx }) {
    const b = backend(String(body.target), ctx);
    const name = nameOf(body);
    const found = await findServer(b, name);
    if (!body.changes || typeof body.changes !== "object" || Array.isArray(body.changes)) throw bad("Send the settings to change.");
    const defs = describe(found, String(body.target));
    const next = applyProperties(await b.readProps(name), body.changes, defs);
    return { ...(await b.writeProps(name, next)), changed: Object.keys(body.changes) };
  },
};

// The settings for one server, with the port locked when Docker decides it.
function describe(server, target) {
  return settingsFor(server.edition, server.version).map((d) => (d.key === "server-port" && isDocker(target) ? { ...d, disabled: { en: "Docker publishes the port; change it by creating the server again with another port.", yue: "Docker 負責開放埠；要改請用另一個埠重新建立伺服器。" } } : d));
}

const RISK = { check: "low", list: "low", logs: "low", players: "low", properties: "low", remove: "destructive" };
const actions = Object.fromEntries(Object.entries(operations).map(([name, run]) => [name, { risk: RISK[name] ?? "network", ...(name === "remove" ? { confirm: ["hold"] } : {}), run: (ctx) => run({ body: ctx.body, ctx }) }]));

export default {
  id: "minecraft-server-manager",
  actions,

  routes(api) {
    api.get("/targets", () => ({ targets: TARGET_INFO }));
    api.get("/flavours", () => ({ flavours: FLAVOURS }));
    // Every version a source offers, or an honest "unavailable" with the reason.
    api.get("/versions", async ({ query, bad: fail }) => {
      if (!FLAVOURS.some((f) => f.id === query.flavour)) throw fail("Choose a flavour: vanilla, paper, fabric, forge or bedrock.", 400);
      return discover(query.flavour, runtime);
    });
    api.get("/compatibility", ({ query }) => compatibility(String(query.flavour ?? ""), String(query.version ?? "")));
    api.get("/schema", ({ query }) => ({ settings: settingsFor(query.edition === "bedrock" ? "bedrock" : "java", String(query.version ?? "")) }));
  },

  fakeRouter: { handlers: [(command) => handler(command)] },
};

export { resetSim };
