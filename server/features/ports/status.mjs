// Reads what the router's switch reports about each wired port and turns it
// into plain data. Nothing here writes to the router. Two sources are understood:
// the Broadcom "robocfg showports" listing, and the generic Linux link files
// under /sys/class/net. A router with neither shows an honest empty list.

// Commands the status route sends. Fixed text, no user input.
export const CHIPSET_COMMAND = "for c in robocfg ethswctl swconfig; do command -v $c 2>/dev/null; done";
export const ROBOCFG_COMMAND = "robocfg showports";
export const SYSFS_COMMAND = 'for p in /sys/class/net/eth*; do echo "${p##*/} $(head -n 100000 $p/carrier 2>/dev/null) $(head -n 100000 $p/speed 2>/dev/null) $(head -n 100000 $p/duplex 2>/dev/null)"; done';

const CHIPSETS = {
  robocfg: { id: "broadcom-robocfg", label: { en: "Broadcom switch (robocfg)", yue: "Broadcom 交換晶片（robocfg）" } },
  ethswctl: { id: "broadcom-runner", label: { en: "Broadcom Runner switch (ethswctl)", yue: "Broadcom Runner 交換晶片（ethswctl）" } },
  swconfig: { id: "swconfig", label: { en: "Switch managed by swconfig", yue: "由 swconfig 管理嘅交換晶片" } },
};

// "/usr/sbin/robocfg" lines -> the chipset the router has tools for.
export function detectChipset(text) {
  const tools = new Set(String(text).split("\n").map((line) => line.trim().split("/").pop()).filter((name) => name in CHIPSETS));
  const first = ["robocfg", "ethswctl", "swconfig"].find((name) => tools.has(name));
  return first ? { ...CHIPSETS[first], tool: first, tools: [...tools] } : { id: "generic", tool: "", tools: [], label: { en: "Generic Linux ports", yue: "一般 Linux 網絡埠" } };
}

// "Port 1: 1000FD enabled stp: none vlan: 1 jumbo: off mac: ..." and "Port 2: DOWN enabled ..."
export function parseRobocfg(text) {
  const ports = [];
  for (const line of String(text).split("\n")) {
    const m = line.match(/^\s*Port\s+(\d+):\s+(\S+)\s+(enabled|disabled)\b(.*)$/i);
    if (!m) continue;
    const link = m[2].match(/^(\d+)(FD|HD)$/i);
    const jumbo = m[4].match(/jumbo:\s*(on|off)/i);
    ports.push({
      id: `port${m[1]}`,
      number: Number(m[1]),
      up: Boolean(link) && m[3].toLowerCase() === "enabled",
      enabled: m[3].toLowerCase() === "enabled",
      speed: link ? Number(link[1]) : 0,
      duplex: link ? (link[2].toUpperCase() === "FD" ? "full" : "half") : "",
      jumbo: jumbo ? jumbo[1].toLowerCase() === "on" : null,
    });
  }
  return ports.sort((a, b) => a.number - b.number);
}

// "eth1 1 1000 full" per line: interface, carrier, speed in Mbit/s, duplex. Wireless
// interfaces report no speed and are left out when their names are given in `skip`.
export function parseSysfs(text, skip = []) {
  const ports = [];
  const hidden = new Set(skip);
  for (const line of String(text).split("\n")) {
    const m = line.trim().match(/^(eth\d+)\s+(\d)?\s*(-?\d+)?\s*(\w+)?$/i);
    if (!m || hidden.has(m[1])) continue;
    const speed = Number(m[3]);
    if (!Number.isFinite(speed) && m[2] === undefined) continue;
    const up = m[2] === "1" && speed > 0;
    ports.push({ id: m[1], number: Number(m[1].slice(3)), name: m[1], up, enabled: true, speed: up ? speed : 0, duplex: up && /^(full|half)$/i.test(m[4] ?? "") ? m[4].toLowerCase() : "", jumbo: null });
  }
  return ports.sort((a, b) => a.number - b.number);
}

// What the router's own settings say each LAN port is used for. LAN numbers are the
// numbers printed on the case; the chip's port numbers do not always match them.
export function portRoles(nvram) {
  const get = (key) => nvram.get(key) ?? "";
  const roles = [];
  const stb = { 1: [1], 2: [2], 3: [3], 4: [4], 5: [1, 2], 6: [3, 4] }[get("switch_stb_x")];
  if (stb) roles.push({ kind: "iptv", lan: stb });
  const dual = get("wans_dualwan").split(/\s+/).filter(Boolean);
  const lanPort = Number(get("wans_lanport"));
  if (dual.includes("lan") && Number.isInteger(lanPort) && lanPort > 0) roles.push({ kind: "second-internet", lan: [lanPort] });
  if (get("lacp_enabled") === "1") roles.push({ kind: "aggregation", lan: [] });
  if (get("jumbo_frame_enable") === "1") roles.push({ kind: "jumbo", lan: [] });
  if (get("ctf_disable_force") === "1" || get("fc_disable") === "1" || get("runner_disable") === "1") roles.push({ kind: "accel-off", lan: [] });
  return roles;
}

export async function readPorts(exec, nvram) {
  const found = await exec(CHIPSET_COMMAND);
  const chipset = detectChipset(found.code === 0 ? found.stdout : "");
  let source = "none";
  let ports = [];
  if (chipset.tools.includes("robocfg")) {
    const out = await exec(ROBOCFG_COMMAND);
    ports = out.code === 0 ? parseRobocfg(out.stdout) : [];
    if (ports.length) source = "robocfg";
  }
  if (!ports.length) {
    const out = await exec(SYSFS_COMMAND);
    ports = out.code === 0 ? parseSysfs(out.stdout, (nvram.get("wl_ifnames") ?? "").split(/\s+/)) : [];
    if (ports.length) source = "sysfs";
  }
  return { chipset, source, ports, roles: portRoles(nvram), readAt: new Date().toISOString() };
}
