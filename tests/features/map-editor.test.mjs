// The network map editor: the data behind the map, the list edits it stages
// (rename, keep an address, block) through the change engine, and the pure
// helpers on both sides.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { hitZone } from "../../public/js/features/map-editor/drag.js";
import feature from "../../public/js/features/map-editor/index.js";
import { gradeCopy, shortName } from "../../public/js/features/map-editor/model.js";
import { freeAddresses, grade, parsePing } from "../../server/features/map-editor/model.mjs";
import { startApp } from "../helpers.mjs";

test("map-editor: pings are read and graded, and free addresses skip what is in use", () => {
  assert.deepEqual(parsePing("3 packets transmitted, 3 packets received, 0% packet loss\n64 bytes from x: seq=0 ttl=1 time=10.0 ms\n64 bytes from x: seq=1 ttl=1 time=20.0 ms"), { loss: 0, ms: 15 });
  assert.deepEqual(parsePing("nonsense"), { loss: null, ms: null });
  assert.equal(grade({ loss: 0, ms: 12 }), "great");
  assert.equal(grade({ loss: 10, ms: 12 }), "ok");
  assert.equal(grade({ loss: 0, ms: 80 }), "ok");
  assert.equal(grade({ loss: 40, ms: 12 }), "weak");
  assert.equal(grade({ loss: null, ms: null }), "unknown");
  const free = freeAddresses("198.51.100.1", "255.255.255.0", ["198.51.100.1", "198.51.100.100", "198.51.100.101"], "198.51.100.100", "198.51.100.110", 5);
  assert.deepEqual(free, ["198.51.100.102", "198.51.100.103", "198.51.100.104", "198.51.100.105", "198.51.100.106"]);
  assert.deepEqual(freeAddresses("198.51.100.1", "255.255.255.0", ["198.51.100.1"], "198.51.100.100", "198.51.100.101", 3), ["198.51.100.100", "198.51.100.101", "198.51.100.2"]);
  assert.deepEqual(freeAddresses("192.0.2.1", "255.255.0.0", [], "", "", 5), [], "a huge network is not listed");
});

test("map-editor: the browser helpers say what a grade means in words and cut long names safely", () => {
  assert.equal(gradeCopy("weak").label.en, "Weak");
  assert.equal(gradeCopy("anything else").label.en, "Not measured");
  assert.equal(shortName("short", 10), "short");
  assert.equal(shortName("abcdefghij", 5), "abcd…");
  assert.equal(shortName("你好世界你好世界", 4), "你好世…");
  assert.deepEqual(hitZone([{ left: 0, top: 0, right: 10, bottom: 10, id: "a" }, { left: 20, top: 0, right: 30, bottom: 10, id: "b" }], 25, 5).id, "b");
  assert.equal(hitZone([{ left: 0, top: 0, right: 10, bottom: 10 }], 11, 5), null);
});

test("map-editor: the domain draws the router, its node and every device", async () => {
  const t = await startApp();
  try {
    const catalog = (await t.owner.get("/api/catalog")).data;
    assert.ok(catalog.domains.some((d) => d.id === "map-editor" && d.supported));
    const map = (await t.owner.get("/api/domain/map-editor")).data;
    assert.equal(map.main.ip, "198.51.100.1");
    assert.equal(map.mesh, true);
    assert.equal(map.nodes.length, 1);
    assert.equal(map.nodes[0].ip, "198.51.100.2");
    assert.equal(map.nodes[0].quality.grade, "great", "the node answered three pings");
    assert.ok(map.nodes[0].quality.ms > 30);
    assert.equal(map.devices.length, 5);
    const nas = map.devices.find((d) => d.host === "nas");
    assert.equal(nas.reserved, "198.51.100.20", "the reservation on the router shows on the device");
    assert.equal(nas.via, "wired");
    assert.ok(map.free.length > 10 && !map.free.includes("198.51.100.101"));
    assert.ok(t.router.commands.includes("ping -c 3 -W 2 198.51.100.2"));
  } finally {
    await t.stop();
  }
});

test("map-editor: rename, keep an address and block go through the change engine and read back", async () => {
  const t = await startApp();
  try {
    const map = (await t.owner.get("/api/domain/map-editor")).data;
    const phone = map.devices.find((d) => d.host === "Pats-iPhone");
    const preview = await t.owner.post("/api/changes/preview", {
      ops: [
        { op: "rename", mac: phone.mac, name: "Pat's phone" },
        { op: "reserve", mac: phone.mac, ip: map.free[0], hostname: "Pats-iPhone" },
        { op: "block", mac: phone.mac, name: "Pat's phone", blocked: true },
      ],
    });
    assert.equal(preview.status, 200, preview.text);
    const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
    assert.equal(applied.status, 200, applied.text);
    assert.equal(applied.data.status, "applied");
    const again = (await t.owner.get("/api/domain/map-editor")).data.devices.find((d) => d.mac === phone.mac);
    assert.equal(again.name, "Pat's phone");
    assert.equal(again.reserved, map.free[0]);
    assert.equal(again.blocked, true);

    // The reverse edits put it back.
    const undo = await t.owner.post("/api/changes/preview", { ops: [{ op: "unreserve", mac: phone.mac }, { op: "block", mac: phone.mac, blocked: false }, { op: "rename", mac: phone.mac, name: "" }] });
    assert.equal(undo.status, 200, undo.text);
    assert.equal((await t.owner.post("/api/changes/apply", { previewId: undo.data.id })).data.status, "applied");
    const last = (await t.owner.get("/api/domain/map-editor")).data.devices.find((d) => d.mac === phone.mac);
    assert.deepEqual([last.reserved, last.blocked, last.customName], ["", false, ""]);

    // An address another device keeps is refused, never silently taken.
    const clash = await t.owner.post("/api/changes/preview", { ops: [{ op: "reserve", mac: phone.mac, ip: "198.51.100.20" }] });
    assert.equal(clash.status, 409);
  } finally {
    await t.stop();
  }
});

test("map-editor: viewers can read the map but not change anything", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/domain/map-editor")).status, 401);
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/domain/map-editor")).status, 200);
    const phone = (await guest.get("/api/domain/map-editor")).data.devices[0];
    const staged = await guest.post("/api/changes/preview", { ops: [{ op: "rename", mac: phone.mac, name: "x" }] });
    if (staged.status === 200) assert.equal((await guest.post("/api/changes/apply", { previewId: staged.data.id })).status, 403);
    else assert.equal(staged.status, 403);
  } finally {
    await t.stop();
  }
});

test("map-editor: the manifest lists the module and it is well formed", async () => {
  const t = await startApp();
  try {
    const manifest = (await t.owner.get("/api/features/manifest")).data;
    assert.ok(manifest.modules.includes("/js/features/map-editor/index.js"));
    for (const file of ["index.js", "drag.js", "model.js", "style.css"]) assert.equal((await fetch(`${t.base}/js/features/map-editor/${file}`)).status, 200, file);
  } finally {
    await t.stop();
  }
  assert.equal(checkFeatureModule(feature, "map-editor"), null);
  assert.equal(feature.screens[0].group.en, "Network");
});
