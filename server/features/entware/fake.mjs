// What the pretend router answers for opkg. Entware is NOT installed on a new
// pretend router (the older Merlin screen expects that); a test or the demo
// turns it on with router.entware.installed = true.
const AVAILABLE = [
  ["nano", "7.2-1", "Small text editor"],
  ["htop", "3.2.2-1", "Interactive process viewer"],
  ["python3", "3.11.5-1", "The Python 3 programming language"],
  ["curl", "8.4.0-1", "Command line tool for transferring data with URL syntax"],
  ["iperf3", "3.15-1", "Network bandwidth measurement tool"],
  ["tcpdump", "4.99.4-1", "Network packet capture tool"],
  ["wireguard-tools", "1.0.20210914-1", "WireGuard command line tools"],
  ["unbound-daemon", "1.18.0-1", "Validating, recursive and caching DNS resolver"],
  ["opkg", "2022-02-24-1", "Package manager"],
  ["entware-opt", "227000-3", "Entware root structure"],
];

export const entware = (router) =>
  (router.entware ??= {
    installed: true,
    installedPackages: new Map([["busybox", "1.36.1-1"], ["entware-opt", "227000-3"], ["nano", "7.2-1"]]),
    upgradable: new Map([["nano", "7.2-2"]]),
  });

const words = (command) => command.match(/'[^']*'|\S+/g)?.map((w) => w.replaceAll("'", "")) ?? [];

export function handler(command, router) {
  const state = entware(router);
  if (command === "test -x /opt/bin/opkg && echo yes || echo no") return { stdout: state.installed ? "yes\n" : "no\n" };
  if (!command.startsWith("/opt/bin/opkg ") && command !== "df -k /opt") return undefined;
  if (!state.installed) return { code: 127, stderr: "opkg: not found\n" };
  const w = words(command);
  if (command === "df -k /opt") return { stdout: "Filesystem           1K-blocks      Used Available Use% Mounted on\n/dev/sda1             15727616    524288  15203328   3% /opt\n" };
  if (w[1] === "--version") return { stdout: "opkg version 2022-02-24 (6b67e0d)\n" };
  if (w[1] === "print-architecture") return { stdout: "arch all 1\narch noarch 1\narch aarch64-3.10 10\n" };
  if (w[1] === "list-installed") return { stdout: [...state.installedPackages].map(([n, v]) => `${n} - ${v}\n`).join("") };
  if (w[1] === "list-upgradable") return { stdout: [...state.upgradable].map(([n, to]) => `${n} - ${state.installedPackages.get(n)} - ${to}\n`).join("") };
  if (w[1] === "find" && w.length === 3) {
    const q = w[2].replace(/\*/g, "").toLowerCase();
    return { stdout: AVAILABLE.filter(([n, , d]) => n.includes(q) || d.toLowerCase().includes(q)).map(([n, v, d]) => `${n} - ${v} - ${d}\n`).join("") };
  }
  if (w[1] === "update" && w.length === 2)
    return { chunks: ["Downloading https://bin.entware.net/aarch64-k3.10/Packages.gz\n", "Updated list of available packages in /opt/var/opkg-lists/entware\n"], chunkDelayMs: 20 };
  if (w[1] === "install" && w.length === 3) {
    const found = AVAILABLE.find(([n]) => n === w[2]);
    if (!found) return { code: 255, stderr: `Unknown package '${w[2]}'.\nCollected errors:\n * opkg_install_cmd: Cannot install package ${w[2]}.\n` };
    if (state.installedPackages.has(w[2])) return { stdout: `Package ${w[2]} (${found[1]}) installed in root is up to date.\n` };
    state.installedPackages.set(w[2], found[1]);
    return { chunks: [`Installing ${w[2]} (${found[1]}) to root...\n`, `Downloading https://bin.entware.net/aarch64-k3.10/${w[2]}_${found[1]}_aarch64-3.10.ipk\n`, `Configuring ${w[2]}.\n`], chunkDelayMs: 20 };
  }
  if (w[1] === "remove" && w.length === 3) {
    if (!state.installedPackages.has(w[2])) return { code: 255, stderr: `No packages removed.\nCollected errors:\n * opkg_remove_cmd: Package ${w[2]} is not installed.\n` };
    state.installedPackages.delete(w[2]);
    return { chunks: [`Removing package ${w[2]} from root...\n`], chunkDelayMs: 20 };
  }
  if (w[1] === "upgrade") {
    const names = w.length === 3 ? [w[2]] : [...state.upgradable.keys()];
    const out = [];
    for (const n of names) if (state.upgradable.has(n)) (state.installedPackages.set(n, state.upgradable.get(n)), state.upgradable.delete(n), out.push(`Upgrading ${n} to ${state.installedPackages.get(n)}...\n`, `Configuring ${n}.\n`));
    return { chunks: out.length ? out : ["Nothing to upgrade.\n"], chunkDelayMs: 20 };
  }
  return { code: 1, stderr: `opkg: unknown sub-command ${w[1]}\n` };
}
