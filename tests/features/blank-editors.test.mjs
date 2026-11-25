// Presets for blank editors: each states what it creates, uses a really
// connected device, passes the same validation as a typed value, and is a
// recorded action that can be undone.
import assert from "node:assert/strict";
import { test } from "node:test";
import { validateValue } from "../../public/js/features/guided-forms/validators.js";
import feature from "../../public/js/features/blank-editors/index.js";
import { EDITORS, FORWARD_FIELDS, FORWARD_PRESETS, RESERVE_FIELDS, editorFor, forwardFill, record, reserveFill, reserveSays, undoValues } from "../../public/js/features/blank-editors/presets.js";
import { assertModuleListed } from "../nav-kit.mjs";
import { startApp } from "../helpers.mjs";

const PORT = { control: "port", allowRange: true };

test("blank-editors: every forwarding preset states what it creates in both languages and passes the port rules", () => {
  assert.ok(FORWARD_PRESETS.length >= 5);
  const ids = new Set();
  for (const p of FORWARD_PRESETS) {
    assert.ok(!ids.has(p.id), `${p.id} is unique`);
    ids.add(p.id);
    assert.ok(p.label.en && p.label.yue && p.says.en && p.says.yue, p.id);
    assert.match(p.says.en, /^Sends outside port/);
    assert.equal(validateValue(PORT, p.values.extPort).ok, true, `${p.id} outside port`);
    assert.equal(validateValue({ control: "port" }, p.values.intPort).ok, true, `${p.id} device port`);
    assert.ok(["TCP", "UDP", "BOTH"].includes(p.values.proto));
  }
});

test("blank-editors: a preset fills the address from a really connected device, never an invented one", async () => {
  const t = await startApp();
  try {
    const devices = (await t.owner.get("/api/domain/devices")).data.devices.filter((d) => d.ip);
    assert.ok(devices.length > 0);
    const fill = forwardFill(FORWARD_PRESETS[0], devices[0]);
    assert.deepEqual(Object.keys(fill), FORWARD_FIELDS);
    assert.equal(fill.ip, devices[0].ip);
    assert.equal(validateValue({ control: "ipv4" }, fill.ip).ok, true);
    assert.equal(forwardFill(FORWARD_PRESETS[0], null).ip, "", "no device, no address");
    const r = reserveFill(devices[0]);
    assert.deepEqual(Object.keys(r), RESERVE_FIELDS);
    assert.equal(validateValue({ control: "mac" }, r.mac).ok, true);
    assert.equal(validateValue({ control: "ipv4" }, r.ip).ok, true);
    assert.match(reserveSays(devices[0]).en, new RegExp(devices[0].ip.replaceAll(".", "\\.")));
  } finally {
    await t.stop();
  }
});

test("blank-editors: the editors are recognised from their titles in either language and only those", () => {
  assert.equal(editorFor("New forwarding rule"), "forward");
  assert.equal(editorFor("新增轉發規則"), "forward");
  assert.equal(editorFor("New forwarding rule\n新增轉發規則"), "forward");
  assert.equal(editorFor("Reserve an address · 留住一個地址"), "reserve");
  assert.equal(editorFor("Edit forwarding rule"), null, "an editor that already has data is not blank");
  assert.equal(editorFor("Something else"), null);
  assert.deepEqual(Object.keys(EDITORS).sort(), ["forward", "reserve"]);
});

test("blank-editors: applying a preset is a recorded action and undo restores what was there", () => {
  const before = { name: "", extPort: "", ip: "", intPort: "", proto: "TCP", srcIp: "" };
  const after = forwardFill(FORWARD_PRESETS[1], { ip: "198.51.100.20" });
  const r = record("forward", "https", before, after, "2026-11-25T10:00:00.000Z");
  assert.deepEqual(r, { at: "2026-11-25T10:00:00.000Z", editor: "forward", preset: "https", before, after });
  assert.deepEqual(undoValues(r), before);
});

test("blank-editors: the module is listed, styled and well formed", async () => {
  await assertModuleListed("blank-editors", feature, { style: true });
});
