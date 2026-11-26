// Own-address mode: compose.lan.yaml keeps the hardening of compose.yaml, drops the published
// port and attaches the app to a macvlan network; the host and setup scripts expose it.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");

test("compose.lan.yaml: macvlan network with the documented variables, no published port", async () => {
  const lan = await read("compose.lan.yaml");
  for (const name of ["ROUTER_APP_LAN_PARENT", "ROUTER_APP_LAN_SUBNET", "ROUTER_APP_LAN_GATEWAY", "ROUTER_APP_LAN_IP", "ROUTER_APP_LAN_RANGE"]) assert.ok(lan.includes(name), name);
  assert.match(lan, /driver: macvlan/);
  assert.match(lan, /ports: !reset \[\]/);
  assert.match(lan, /ip_range: \$\{ROUTER_APP_LAN_RANGE:-\$\{ROUTER_APP_LAN_IP\}\/32\}/);
  assert.match(lan, /ipv4_address: \$\{ROUTER_APP_LAN_IP:\?/);
  // The override adds the network and never loosens the base hardening.
  // Each of these is a compose option; it must not appear as a key in the LAN file (text such as the
  // sysctl name ip_unprivileged_port_start is not the privileged option).
  for (const loosened of ["read_only", "cap_drop", "security_opt", "privileged", "cap_add", "healthcheck"]) assert.ok(!new RegExp(`^[ \\t]*${loosened}:`, "m").test(lan), `${loosened} must stay only in compose.yaml`);
  assert.doesNotMatch(lan, /^\s*cap_add:|^\s*privileged:\s*true/m, "the LAN file never adds capabilities or privileged mode");
  const base = await read("compose.yaml");
  for (const kept of ["read_only: true", "no-new-privileges:true", "- ALL", "http://127.0.0.1:8790/health"]) assert.ok(base.includes(kept), kept);
  assert.match(base, /ROUTER_APP_PORT:-8790\}:8790/, "published port stays the default mode");
});

test("compose.lan.yaml: docker compose merges both files when Docker is installed", (t) => {
  const env = { ...process.env, ROUTER_APP_LAN_PARENT: "eth0", ROUTER_APP_LAN_SUBNET: "198.51.100.0/24", ROUTER_APP_LAN_GATEWAY: "198.51.100.1", ROUTER_APP_LAN_IP: "198.51.100.50" };
  const run = (args, e = env) => spawnSync("docker", ["compose", ...args, "config"], { cwd: new URL("..", import.meta.url), env: e, encoding: "utf8" });
  const probe = spawnSync("docker", ["compose", "version"], { encoding: "utf8" });
  if (probe.status !== 0) return t.skip("docker compose is not installed");
  const merged = run(["-f", "compose.yaml", "-f", "compose.lan.yaml"]);
  assert.equal(merged.status, 0, merged.stderr);
  assert.match(merged.stdout, /driver: macvlan/);
  assert.match(merged.stdout, /ip_range: 198\.51\.100\.50\/32/);
  assert.ok(!/published:/.test(merged.stdout), "no published port in own-address mode");
  assert.match(merged.stdout, /read_only: true/);
  const ranged = run(["-f", "compose.yaml", "-f", "compose.lan.yaml"], { ...env, ROUTER_APP_LAN_RANGE: "198.51.100.48/30" });
  assert.match(ranged.stdout, /ip_range: 198\.51\.100\.48\/30/);
  const missing = run(["-f", "compose.yaml", "-f", "compose.lan.yaml"], { ...env, ROUTER_APP_LAN_IP: "" });
  assert.notEqual(missing.status, 0, "the address is required");
  const plain = run(["-f", "compose.yaml"]);
  assert.match(plain.stdout, /published: "8790"/);
});

test("host.ps1 and setup.ps1 expose own-address mode", async () => {
  const host = await read("scripts/host.ps1");
  for (const flag of ["--lan-ip", "--lan-parent", "--lan-subnet", "--lan-gateway"]) assert.ok(host.includes(flag), flag);
  assert.ok(host.includes("compose.lan.yaml"));
  assert.ok(host.includes("Its own address on the home network"), "menu choice");
  assert.ok(host.includes("ping -c 2"), "the address is checked before starting");
  assert.ok(host.includes(":8790/"), "the health URL uses the own address");
  for (const mode of ["--detached", "--logs", "--stop", "--remote"]) assert.ok(host.includes(mode), mode);
  const setup = await read("scripts/setup.ps1");
  for (const name of ["-LanIp", "-LanParent", "-LanSubnet", "-LanGateway", "ROUTER_APP_NETWORK", "ROUTER_APP_LAN_IP"]) assert.ok(setup.includes(name.replace(/^-/, "")), name);
  // No private-range address may live in the repository's scripts or compose files.
  for (const [name, text] of [["host.ps1", host], ["setup.ps1", setup], ["compose.lan.yaml", await read("compose.lan.yaml")]]) {
    assert.ok(!/\b(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/.test(text), `${name} must not hold a private address`);
  }
});
