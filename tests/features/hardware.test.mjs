// hardware: its settings (all gated by verifyKey), the live sensors, the RGB
// colour control, the shared light and button settings, and the frontend module.
// Every entry is also proved by tests/real-controls.test.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { firstNumber } from "../../server/features/hardware/sensors.mjs";
import feature, { gaugeState, hexToRgb, rgbToHex } from "../../public/js/features/hardware/index.js";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import { startApp, waitFor } from "../helpers.mjs";

async function applyOne(t, id, value) {
  const preview = await t.owner.post("/api/changes/preview", { changes: [{ id, value }] });
  assert.equal(preview.status, 200, preview.text);
  const applied = await t.owner.post("/api/changes/apply", { previewId: preview.data.id });
  assert.equal(applied.status, 200, applied.text);
  return waitFor(async () => {
    const record = (await t.owner.get(`/api/changes/history/${applied.data.id}`)).data;
    return record.status !== "guarded" && record.status !== "applying" ? record : null;
  });
}

test("hardware: the first number in a sensor line is read, and nothing is invented", () => {
  assert.equal(firstNumber("61000\n"), 61000);
  assert.equal(firstNumber("CPU temperature : 61. (Celsius)"), 61);
  assert.equal(firstNumber("-5.5"), -5.5);
  assert.equal(firstNumber("No such file"), null);
  assert.equal(firstNumber(""), null);
});

test("hardware: the catalogue lists the light schedule and RGB settings and the screen data adds the shared ones", async () => {
  const t = await startApp();
  try {
    const entries = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "hardware");
    assert.deepEqual(entries.map((e) => [e.id, e.control, e.key]), [
      ["hardware.led-schedule", "switch", "ledsched_enable"],
      ["hardware.led-hours", "schedule", "ledsched_time"],
      ["hardware.aura", "switch", "aurargb_enable"],
      ["hardware.aura-colour", "rgb", "aurargb_val"],
    ]);
    assert.ok(entries.every((e) => e.disabled === null), "the pretend router lists all four keys");
    assert.equal(entries.find((e) => e.id === "hardware.aura-colour").value, "79,91,213");

    const domain = (await t.owner.get("/api/domain/hardware")).data;
    assert.deepEqual(domain.lights.map((e) => e.id), ["sys.led", "system-pro.led.eth"]);
    assert.deepEqual(domain.buttons.map((e) => e.id), ["system-pro.btn.radio", "system-pro.btn.mode"]);
    assert.equal(domain.entries.length, 4);
    assert.ok(domain.gauges.length >= 3);
  } finally {
    await t.stop();
  }
});

test("hardware: a setting the router does not list is off with the reason and is never written", async () => {
  const t = await startApp();
  try {
    delete t.router.nvram.aurargb_val;
    delete t.router.nvram.ledsched_time;
    const entries = (await t.owner.get("/api/catalog")).data.entries.filter((e) => e.feature === "hardware");
    assert.equal(entries.find((e) => e.id === "hardware.aura-colour").disabled.en, "This router does not have the setting aurargb_val");
    assert.equal(entries.find((e) => e.id === "hardware.led-hours").disabled.en, "This router does not have the setting ledsched_time");
    assert.equal(entries.find((e) => e.id === "hardware.aura").disabled, null);
    const refused = await t.owner.post("/api/changes/preview", { changes: [{ id: "hardware.aura-colour", value: "1,2,3" }] });
    assert.equal(refused.status, 400);
    assert.equal(t.router.nvram.aurargb_val, undefined);
  } finally {
    await t.stop();
  }
});

test("hardware: the RGB colour is checked, stored as red,green,blue, and the light schedule is applied and read back", async () => {
  const t = await startApp();
  try {
    for (const wrong of ["300,0,0", "1,2", "#336699", "1,2,3,4", "red", ""])
      assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "hardware.aura-colour", value: wrong }] })).status, 400, JSON.stringify(wrong));
    assert.equal((await applyOne(t, "hardware.aura-colour", "010,020,030")).status, "applied");
    assert.equal(t.router.nvram.aurargb_val, "10,20,30", "leading zeros are tidied");
    assert.equal((await applyOne(t, "hardware.led-hours", "12345@22:00-23:30")).status, "applied");
    assert.equal(t.router.nvram.ledsched_time, "12345@22:00-23:30");
    assert.equal((await t.owner.post("/api/changes/preview", { changes: [{ id: "hardware.led-hours", value: "12345@23:00-22:00" }] })).status, 400, "a slot must end after it starts");
    assert.equal((await applyOne(t, "hardware.led-schedule", "1")).status, "applied");
    assert.ok(t.router.services.includes("restart_leds"), "the lights service is restarted");
    const reread = (await t.owner.get("/api/domain/hardware")).data.entries.find((e) => e.id === "hardware.led-schedule");
    assert.equal(reread.value, "1");
  } finally {
    await t.stop();
  }
});

test("hardware: the sensors route reports the processor, each radio and a fan only where one exists", async () => {
  const t = await startApp();
  try {
    const plain = (await t.owner.get("/api/x/hardware/sensors")).data;
    assert.deepEqual(plain.gauges.map((g) => g.id), ["cpu", "radio0", "radio1", "fan"]);
    const byId = Object.fromEntries(plain.gauges.map((g) => [g.id, g]));
    assert.ok(byId.cpu.value > 55 && byId.cpu.value < 70, "thousandths of a degree become degrees");
    assert.deepEqual([byId.radio0.value, byId.radio1.value], [48, 53]);
    assert.equal(byId.fan.value, null, "a router without a fan reports none, not a made-up number");
    assert.equal(byId.radio0.label.en, "2.4 GHz radio");

    t.router.nvram.productid = "GT-AX11000";
    const gaming = (await t.owner.get("/api/x/hardware/sensors")).data;
    const fan = gaming.gauges.find((g) => g.id === "fan");
    assert.ok(fan.value >= 2100 && fan.value < 2400);
    assert.equal(fan.mode, "0");

    // A reading that cannot be real is dropped rather than shown.
    const original = t.router.execute.bind(t.router);
    t.router.execute = (command) => (command.startsWith("wl -i eth6") ? { stdout: "9999\n" } : original(command));
    assert.equal((await t.owner.get("/api/x/hardware/sensors")).data.gauges.find((g) => g.id === "radio0").value, null);
  } finally {
    await t.stop();
  }
});

test("hardware: the sensors route needs a session and viewers may read it", async () => {
  const t = await startApp();
  try {
    assert.equal((await t.client().get("/api/x/hardware/sensors")).status, 401);
    await t.owner.post("/api/users", { name: "Vi", username: "vi", password: "viewer password 1", role: "viewer" });
    const guest = t.client();
    await guest.signIn("vi", "viewer password 1");
    assert.equal((await guest.get("/api/x/hardware/sensors")).status, 200);
  } finally {
    await t.stop();
  }
});

test("hardware: dial states and colour conversions are right, and the frontend module is well formed", () => {
  assert.equal(checkFeatureModule(feature, "hardware"), null);
  assert.deepEqual(gaugeState(null, 80, 100), { deg: 0, tone: "", word: "unavailable" });
  assert.deepEqual(gaugeState(50, 80, 100), { deg: 135, tone: "good", word: "normal" });
  assert.equal(gaugeState(85, 80, 100).word, "warm");
  assert.equal(gaugeState(96, 80, 100).word, "hot");
  assert.equal(gaugeState(500, 80, 100).deg, 270, "the dial never goes past full");
  assert.equal(rgbToHex("79,91,213"), "#4f5bd5");
  assert.equal(rgbToHex("256,0,0"), null);
  assert.equal(rgbToHex("1,2"), null);
  assert.equal(hexToRgb("#4f5bd5"), "79,91,213");
  assert.equal(hexToRgb("blue"), null);
  assert.equal(hexToRgb(rgbToHex("0,128,255")), "0,128,255");
});
