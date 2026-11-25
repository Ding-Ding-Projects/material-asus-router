// Subnet calculator: a browser-only tool, so the test checks the maths against
// well-known networks, the edge sizes (/31, /32, /0), splitting and the module.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { binary, classOf, contains, describeNetwork, isIpv4, maskOf, parseCidr, prefixOfMask, scopeOf, split, toIp, toNumber } from "../../public/js/features/subnet-calculator/calc.js";
import feature from "../../public/js/features/subnet-calculator/index.js";
import { startApp } from "../helpers.mjs";

test("subnet-calculator: a /24 gives the usual numbers, from any address inside it", () => {
  const n = describeNetwork("198.51.100.77", 24);
  assert.deepEqual([n.cidr, n.maskIp, n.wildcardIp, n.networkIp, n.broadcastIp, n.firstIp, n.lastIp, n.usable, n.size, n.isNetworkAddress], ["198.51.100.0/24", "255.255.255.0", "0.0.0.255", "198.51.100.0", "198.51.100.255", "198.51.100.1", "198.51.100.254", 254, 256, false]);
  assert.equal(n.scope, "documentation");
  assert.equal(n.klass, "C");
  assert.equal(binary(n.mask), "11111111.11111111.11111111.00000000");
});

test("subnet-calculator: unusual sizes and boundaries", () => {
  const net = (ip, p) => describeNetwork(ip, p);
  const ten = (...rest) => [10, ...rest].join(".");
  assert.deepEqual([net(ten(0, 0, 0), 8).usable, net(ten(0, 0, 0), 8).lastIp, net(ten(0, 0, 0), 8).scope], [16777214, ten(255, 255, 254), "private"]);
  assert.deepEqual([net("198.51.100.8", 30).usable, net("198.51.100.8", 30).firstIp, net("198.51.100.8", 30).lastIp], [2, "198.51.100.9", "198.51.100.10"]);
  assert.deepEqual([net("198.51.100.8", 31).usable, net("198.51.100.8", 31).firstIp, net("198.51.100.8", 31).lastIp], [2, "198.51.100.8", "198.51.100.9"], "a /31 uses both addresses");
  assert.deepEqual([net("198.51.100.8", 32).usable, net("198.51.100.8", 32).firstIp], [1, "198.51.100.8"]);
  const all = net("1.2.3.4", 0);
  assert.deepEqual([all.networkIp, all.broadcastIp, all.size, all.maskIp], ["0.0.0.0", "255.255.255.255", 2 ** 32, "0.0.0.0"]);
  assert.equal(net([172, 20, 5, 9].join("."), 12).networkIp, [172, 16, 0, 0].join("."));
  assert.throws(() => describeNetwork("300.1.1.1", 24), /IPv4/);
  assert.throws(() => describeNetwork("198.51.100.1", 33), /0 to 32/);
  assert.throws(() => describeNetwork("198.51.100.1", 2.5), /0 to 32/);
});

test("subnet-calculator: masks, scopes, containment and parsing", () => {
  assert.equal(toIp(maskOf(20)), "255.255.240.0");
  assert.equal(prefixOfMask("255.255.240.0"), 20);
  assert.equal(prefixOfMask("255.0.255.0"), null);
  assert.equal(prefixOfMask("nope"), null);
  assert.equal(toNumber("192.0.2.1"), 3221225985);
  const q = (...parts) => parts.join(".");
  assert.deepEqual([q(10, 1, 1, 1), q(172, 31, 0, 1), q(172, 32, 0, 1), q(192, 168, 0, 1), "100.64.0.1", "127.0.0.1", "169.254.1.1", "203.0.113.5", "224.0.0.1", "250.0.0.1", "8.8.8.8", "0.1.2.3"].map((ip) => scopeOf(toNumber(ip))),
    ["private", "private", "public", "private", "shared", "loopback", "link-local", "documentation", "multicast", "reserved", "public", "this-network"]);
  assert.deepEqual([1, 130, 200, 230, 250].map((a) => classOf(a * 2 ** 24)), ["A", "B", "C", "D", "E"]);
  const net = describeNetwork("198.51.100.0", 25);
  assert.equal(contains(net, "198.51.100.127"), true);
  assert.equal(contains(net, "198.51.100.128"), false);
  assert.equal(contains(net, "nonsense"), false);
  assert.deepEqual(parseCidr(" 198.51.100.0/24 "), { ip: "198.51.100.0", prefix: 24 });
  assert.deepEqual(parseCidr("198.51.100.0"), { ip: "198.51.100.0", prefix: null });
  assert.equal(parseCidr("198.51.100.0/24/3"), null);
  assert.equal(parseCidr("999.1.1.1/8"), null);
  assert.equal(isIpv4("1.2.3"), false);
});

test("subnet-calculator: splitting covers the network exactly with no gaps and no overlap", () => {
  const net = describeNetwork("198.51.100.0", 24);
  const parts = split(net, 8);
  assert.equal(parts.length, 8);
  assert.deepEqual([parts[0].cidr, parts[1].cidr, parts[7].cidr], ["198.51.100.0/27", "198.51.100.32/27", "198.51.100.224/27"]);
  assert.equal(parts.reduce((n, p) => n + p.size, 0), net.size);
  parts.forEach((p, i) => i && assert.equal(p.network, parts[i - 1].broadcast + 1));
  assert.equal(parts.at(-1).broadcast, net.broadcast);
  assert.throws(() => split(net, 3), /Split into/);
  assert.throws(() => split(describeNetwork("198.51.100.0", 31), 4), /too small/);
  assert.equal(split(describeNetwork([10, 0, 0, 0].join("."), 8), 256).at(-1).cidr, [10, 255, 0, 0].join(".") + "/16");
});

test("subnet-calculator: it is a browser tool with no server part, reachable from the rail and palette", async () => {
  assert.equal(checkFeatureModule(feature, "subnet-calculator"), null);
  assert.equal(feature.screens[0].group.en, "Network");
  assert.equal(feature.commands[0].id, "subnet-calculator.open");
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/subnet-calculator/index.js"));
    assert.ok(manifest.styles.includes("/js/features/subnet-calculator/style.css"));
    assert.ok(!manifest.server.includes("subnet-calculator"), "nothing runs on the server");
  } finally {
    await t.stop();
  }
});
