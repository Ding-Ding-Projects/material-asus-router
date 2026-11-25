// Hardware: the lights, the RGB lighting on gaming models, the front button
// and live temperature and fan gauges. Gauges are read only. The main light
// switch (System), the Ethernet port lights and the button settings (System
// tools) are shown here too, as the same settings, so there is one place to
// change them. Settings whose names are not certain to exist on every firmware
// are marked verifyKey, so they are offered only when the router has them.
import { L, ON_OFF } from "../kit.mjs";
import { DMU_COMMAND, FAN_COMMAND, readSensors } from "./sensors.mjs";

const F = "hardware";
const G = {
  schedule: { group: "schedule", groupLabel: L("Light schedule", "燈號時間表") },
  aura: { group: "aura", groupLabel: L("RGB lighting (gaming models)", "RGB 燈效（電競型號）") },
};
const e = (id, group, key, control, label, help, extra = {}) => ({ id: `${F}.${id}`, domain: F, ...group, key, control, label, help, verifyKey: true, ...extra });
const CONFIRM = L("This setting name is the one recent ASUS builds use; confirm the result on your model after applying.", "呢個設定名稱係近期 ASUS 版本用嘅；套用後請喺你部機確認。");

const RGB = /^(\d{1,3}),(\d{1,3}),(\d{1,3})$/;
// Colours are stored the way the router keeps them: "red,green,blue", each 0 to 255.
const rgbControl = {
  validate(entry, text, fail) {
    const m = text.match(RGB);
    if (!m || [m[1], m[2], m[3]].some((n) => Number(n) > 255)) fail("enter a colour as red,green,blue with each number from 0 to 255, such as 79,91,213.");
    return [m[1], m[2], m[3]].map(Number).join(",");
  },
  sample: (_entry, current) => (current === "0,128,255" ? "255,64,0" : "0,128,255"),
  invalid: () => "300,0,0",
};

export default {
  id: F,

  catalog: () => [
    e("led-schedule", G.schedule, "ledsched_enable", "switch", L("Turn the lights off on a schedule", "定時關燈"), L("Switches the lights off during the hours painted below and back on afterwards. The main light switch overrides it.", "喺下面塗咗嘅時段自動關燈，之後再開。總燈掣優先。"), { values: ON_OFF, restart: "restart_leds", meta: { note: CONFIRM } }),
    e("led-hours", G.schedule, "ledsched_time", "schedule", L("Hours with the lights off", "關燈嘅時段"), L("Paint the days and hours when the lights should be off, for example every night.", "塗上要關燈嘅日子同鐘數，例如每晚。"), { step: 60, restart: "restart_leds", meta: { note: CONFIRM } }),
    e("aura", G.aura, "aurargb_enable", "switch", L("RGB lighting", "RGB 燈效"), L("Turns the colour lighting on gaming routers on or off. Routers without it do not list this setting.", "開關電競路由器嘅彩色燈效。冇燈效嘅路由器唔會有呢個設定。"), { values: ON_OFF, restart: "restart_leds", meta: { note: CONFIRM } }),
    e("aura-colour", G.aura, "aurargb_val", "rgb", L("RGB colour", "RGB 顏色"), L("The colour the lighting shows. The router keeps it as three numbers from 0 to 255.", "燈效顯示嘅顏色。路由器用三個 0 至 255 嘅數字記住。"), { restart: "restart_leds", meta: { note: CONFIRM } }),
  ],

  controls: { rgb: rgbControl },

  domainMeta: [{ id: F, icon: "memory", label: L("Hardware", "硬件"), group: { en: "Router", yue: "路由器" }, live: true }],
  domains: {
    [F]: async (ctx) => {
      const sensors = await readSensors(ctx);
      const system = ctx.entries("system").filter((x) => x.id === "sys.led");
      const tools = ctx.entries("system-pro").filter((x) => ["system-pro.led.eth", "system-pro.btn.radio", "system-pro.btn.mode"].includes(x.id));
      return {
        ...sensors,
        model: ctx.info.model,
        entries: ctx.entries(),
        lights: [...system, ...tools.filter((x) => x.id === "system-pro.led.eth")],
        buttons: tools.filter((x) => x.id.startsWith("system-pro.btn.")),
        fanMode: ctx.nvram.get("fan_mode") ?? null,
      };
    },
  },

  routes(api) {
    // The gauges, read again while the screen is open.
    api.get("/sensors", async ({ live }) => readSensors(await live()));
  },

  fakeRouter: {
    nvram: { ledsched_enable: "0", ledsched_time: "0123456@00:00-06:00", aurargb_enable: "1", aurargb_val: "79,91,213", fan_mode: "0" },
    handlers: [
      (command, router) => {
        // Only gaming models have a fan; others answer that there is none.
        if (command === FAN_COMMAND) return /^(GT-|ROG|GS-)/.test(router.nvram.productid) ? { stdout: `${2100 + Math.floor(Math.random() * 300)}\n` } : { code: 1, stderr: "No such file or directory\n" };
        if (command === DMU_COMMAND) return { code: 1, stderr: "No such file or directory\n" };
        return undefined;
      },
    ],
  },
};
