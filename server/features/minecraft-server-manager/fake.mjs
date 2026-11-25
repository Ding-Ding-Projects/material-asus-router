// The pretend machine behind the pretend router, so the two SSH targets can be
// exercised end to end without a real Docker or Java. It only answers the
// commands this feature sends and returns undefined for everything else, so
// the router's other commands are untouched.
export const sim = { containers: new Map(), dirs: new Map(), javaMajor: 17, docker: true };
export function resetSim(patch = {}) {
  sim.containers.clear();
  sim.dirs.clear();
  Object.assign(sim, { javaMajor: 17, docker: true }, patch);
}

// Splits a command the way the shell would for the quoting this feature uses.
export function tokens(command) {
  const out = [];
  let cur = "";
  let any = false;
  for (let i = 0; i < command.length; i += 1) {
    const c = command[i];
    if (c === "'") {
      any = true;
      const end = command.indexOf("'", i + 1);
      cur += command.slice(i + 1, end);
      i = end;
    } else if (c === "\\" && command[i + 1] === "'") {
      cur += "'";
      any = true;
      i += 1;
    } else if (/\s/.test(c)) {
      if (any || cur) out.push(cur);
      cur = "";
      any = false;
    } else {
      cur += c;
      any = true;
    }
  }
  if (any || cur) out.push(cur);
  return out;
}

const decode = (b64) => Buffer.from(b64, "base64").toString("utf8");
const PLAYERS = "There are 1 of a max of 20 players online: Pat\n";

function docker(args) {
  const [op, ...rest] = args;
  if (!sim.docker) return { code: 127, stderr: "docker: not found\n" };
  const find = (name) => sim.containers.get(name);
  switch (op) {
    case "version": return { stdout: "27.0.0\n" };
    case "ps": return { stdout: [...sim.containers.values()].map((c) => JSON.stringify({ Names: c.name, State: c.state, Status: c.state === "running" ? "Up 1 minute" : "Exited (0) 1 minute ago", Labels: Object.entries(c.labels).map(([k, v]) => `${k}=${v}`).join(",") })).join("\n").concat(sim.containers.size ? "\n" : "") };
    case "run": {
      const name = rest[rest.indexOf("--name") + 1];
      if (sim.containers.has(name)) return { code: 125, stderr: `Conflict. The container name "/${name}" is already in use.\n` };
      const labels = {};
      rest.forEach((a, i) => { if (a === "--label") { const [k, ...v] = rest[i + 1].split("="); labels[k] = v.join("="); } });
      sim.containers.set(name, { name, labels, state: "running", log: ["[Server thread/INFO]: Done (1.9s)! For help, type \"help\""], plugins: [], props: "motd=A Minecraft Server\nmax-players=20\n", args: rest });
      return { stdout: "9f2c1a7e5b3d\n" };
    }
    case "start": { const c = find(rest.at(-1)); if (!c) return { code: 1, stderr: "No such container\n" }; c.state = "running"; return { stdout: `${c.name}\n` }; }
    case "stop": { const c = find(rest.at(-1)); if (!c) return { code: 1, stderr: "No such container\n" }; c.state = "exited"; return { stdout: `${c.name}\n` }; }
    case "rm": { const name = rest.at(-1); if (!sim.containers.delete(name)) return { code: 1, stderr: "No such container\n" }; return { stdout: `${name}\n` }; }
    case "volume": return { stdout: `${rest.at(-1)}\n` };
    case "logs": { const c = find(rest.at(-1)); return c ? { stdout: `${c.log.join("\n")}\n` } : { code: 1, stderr: "No such container\n" }; }
    case "exec": {
      const c = find(rest[0]);
      if (!c) return { code: 1, stderr: "No such container\n" };
      const [prog, ...a] = rest.slice(1);
      if (prog === "rcon-cli") { c.log.push(`[Server thread/INFO]: ran ${a.join(" ")}`); return { stdout: a[0] === "list" ? PLAYERS : "OK\n" }; }
      if (prog === "send-command") return { stdout: "" };
      if (prog === "mkdir") return {};
      if (prog === "curl") { const out = a[a.indexOf("-o") + 1]; if (c.plugins.includes(out)) return { code: 1, stderr: "exists" }; c.plugins.push(out); return {}; }
      if (prog === "head") return { stdout: c.props };
      if (prog === "sh") { const m = /printf %s ([A-Za-z0-9+/=]+) \| base64 -d > \/data\/server\.properties/.exec(a[1]); if (m) { c.props = decode(m[1]); return {}; } }
      return { code: 126, stderr: "unsupported in the pretend machine\n" };
    }
    default: return { code: 1, stderr: `docker: '${op}' is not a command the pretend machine knows\n` };
  }
}

function process_(command) {
  const op = /MAR_OP=([a-z-]+)/.exec(command)[1];
  const name = /minecraft\/([a-z0-9-]+)/.exec(command)?.[1];
  const dir = sim.dirs.get(name);
  const log = (d, line) => d.log.push(line);
  if (op === "list") return { stdout: [...sim.dirs.values()].map((d) => `${JSON.stringify(d.meta)}\n`).join("") };
  if (op === "status") return { stdout: dir?.running ? "running\n" : "stopped\n" };
  if (op === "install") {
    if (sim.dirs.has(name)) return { code: 9, stderr: "exists\n" };
    const props = /printf %s ([A-Za-z0-9+/=]+) \| base64 -d > server\.properties/.exec(command);
    const meta = /printf %s ([A-Za-z0-9+/=]+) \| base64 -d > mar-server\.json/.exec(command);
    sim.dirs.set(name, { meta: JSON.parse(decode(meta[1])), props: decode(props[1]), running: false, log: [], plugins: [], jar: /curl[^&]* '([^']+)'/.exec(command)?.[1] });
    return {};
  }
  if (!dir) return { code: 2, stderr: "no such server\n" };
  switch (op) {
    case "start": if (dir.running) return { code: 9, stderr: "running\n" }; dir.running = true; log(dir, "[Server thread/INFO]: Done (2.1s)!"); dir.memory = /-Xmx(\d+)M/.exec(command)?.[1]; return {};
    case "stop": dir.running = false; log(dir, "[Server thread/INFO]: Stopping the server"); return {};
    case "remove": if (dir.running) return { code: 9, stderr: "running\n" }; sim.dirs.delete(name); return {};
    case "logs": return { stdout: `${dir.log.slice(-Number(/tail -n (\d+)/.exec(command)?.[1] ?? 200)).join("\n")}\n` };
    case "command": { const cmd = /printf '%s\\n' '([^']*)'/.exec(command)?.[1] ?? tokens(command).at(-3); log(dir, `[Server thread/INFO]: ran ${cmd}`); if (cmd === "list") log(dir, PLAYERS.trim()); return {}; }
    case "plugin": { const file = /"\$d"\/'([^']+)'/.exec(command)[1]; if (dir.plugins.includes(file)) return { code: 1 }; dir.plugins.push(file); return {}; }
    case "props": return { stdout: dir.props };
    case "props-save": dir.props = decode(/printf %s ([A-Za-z0-9+/=]+)/.exec(command)[1]); return {};
    default: return { code: 1, stderr: "unknown operation\n" };
  }
}

export function handler(command) {
  if (/^java -version/.test(command)) return sim.javaMajor ? { stderr: `openjdk version "${sim.javaMajor}.0.9" 2023-10-17\n` } : { code: 127, stderr: "java: not found\n" };
  if (/^docker /.test(command)) return docker(tokens(command).slice(1));
  if (/^MAR_OP=/.test(command)) return process_(command);
  return undefined;
}
