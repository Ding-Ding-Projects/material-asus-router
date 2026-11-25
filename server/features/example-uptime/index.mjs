// A complete, tiny feature that uses every hook the registry offers. Copy this
// folder (and public/js/features/example-uptime and tests/features/
// example-uptime.test.mjs) to start a new feature, then delete what you do not
// need. Delete the three originals when you no longer want the example.
//
// Rules this file follows, and yours must too:
//   - import only from "../kit.mjs" (never from server/router, server/ssh,
//     server/changes, server/app.mjs or server/actions.mjs)
//   - every setting is a typed control, never a bare text box
//   - every router write goes through the change engine
import { L, ON_OFF } from "../kit.mjs";

const read = async (exec) => {
  const out = await exec("head -n 100000 /proc/uptime");
  const seconds = Math.floor(Number(out.stdout.split(" ")[0])) || 0;
  return { seconds, days: Math.floor(seconds / 86400) };
};

export default {
  id: "example-uptime",

  // Settings: the same entry shape as server/router/catalog.mjs. Each entry
  // reads its value from nvram and is changed through preview, guard and undo.
  catalog: () => [
    { id: "example-uptime.show", domain: "example-uptime", group: "card", groupLabel: L("Uptime card", "運行時間卡"), key: "example_uptime_show", control: "switch", values: ON_OFF, risk: "low",
      label: L("Show the uptime card", "顯示運行時間卡"), help: L("Shows how long the router has been running on the overview.", "喺概覽顯示路由器已經運行咗幾耐。") },
    { id: "example-uptime.warn", domain: "example-uptime", group: "card", groupLabel: L("Uptime card", "運行時間卡"), key: "example_uptime_warn_days", control: "stepper", min: 1, max: 365, unit: "days", risk: "low",
      label: L("Remind me to restart after", "幾耐之後提醒重啟"), help: L("The card turns amber once the router has run this long.", "運行超過呢個日數，卡片會變琥珀色。") },
    { id: "example-uptime.color", domain: "example-uptime", group: "card", groupLabel: L("Uptime card", "運行時間卡"), key: "example_uptime_color", control: "color", risk: "low",
      label: L("Card colour", "卡片顏色"), help: L("The accent colour of the card.", "卡片嘅強調顏色。") },
  ],

  // A screen the server can read: GET /api/domain/example-uptime.
  domainMeta: [{ id: "example-uptime", icon: "timer", label: L("Uptime (example)", "運行時間（範例）"), group: { en: "Monitor", yue: "監察" } }],
  domains: {
    "example-uptime": async (ctx) => ({
      ...(await read(ctx.exec)),
      warnDays: Number(ctx.nvram.get("example_uptime_warn_days") ?? 30),
      color: ctx.nvram.get("example_uptime_color") ?? "#3366cc",
      entries: ctx.entries(),
    }),
  },

  // Extra HTTP routes under /api/x/example-uptime. Sign-in, CSRF and the
  // viewer/operator roles apply automatically.
  routes(api) {
    api.get("/summary", async ({ live }) => {
      const ctx = await live();
      return { ...(await read(ctx.exec)), model: ctx.info.model };
    });
    api.post("/note", async ({ body, bad }) => {
      const text = String(body.text ?? "").trim();
      if (!text || text.length > 80) throw bad("Write a note of 1 to 80 characters.");
      return { ok: true, text };
    });
  },

  // One-off actions: POST /api/actions/example-uptime.mark
  actions: {
    mark: {
      risk: "low",
      run: async ({ exec }) => {
        const out = await exec("example-uptime-mark");
        return { ok: out.code === 0, message: out.stdout.trim() };
      },
    },
  },

  // What the pretend router needs so tests and demo mode can exercise the
  // feature: starting settings, and answers to commands only this feature sends.
  fakeRouter: {
    nvram: { example_uptime_show: "1", example_uptime_warn_days: "30", example_uptime_color: "#3366cc" },
    handlers: [(command) => (command === "example-uptime-mark" ? { stdout: "marked\n" } : undefined)],
  },
};
