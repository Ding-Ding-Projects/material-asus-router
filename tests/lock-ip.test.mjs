// Lock IP in the device list: one tap keeps a device's current address (the router's address
// reservation) and Unlock IP releases it, both queued in the changes like any other edit. The
// reserve and unreserve operations themselves are proven against the pretend router in
// tests/changes.test.mjs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("the device list locks and unlocks addresses through the reserve and unreserve changes", async () => {
  const src = await readFile(new URL("../public/js/screens/devices.js", import.meta.url), "utf8");
  assert.match(src, /function lockIp\(device\)[\s\S]*?op: "reserve", mac: device\.mac, ip,/, "Lock IP reserves the address the device has now");
  assert.match(src, /function unlockIp\(device\)[\s\S]*?op: "unreserve", mac: device\.mac/);
  assert.match(src, /t\("Lock IP", "鎖定 IP"\)/);
  assert.match(src, /t\("Unlock IP", "解除鎖定 IP"\)/);
  assert.match(src, /t\("IP locked", "IP 已鎖定"\)/, "a locked address is labelled in words, not only with an icon");
  assert.match(src, /filter\(\(d\) => d\.ip && !d\.reservedIp\)\.forEach\(lockIp\)/, "bulk Lock IPs skips devices already locked");
  assert.match(src, /disabled: !d\.ip/, "a device without an address cannot be locked");
});
