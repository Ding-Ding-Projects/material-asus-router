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
//   - a preference of the app itself (how this card looks) is saved by the app with appPrefs, never as a
//     router setting: a router only ever gets settings it already has
import { L, ON_OFF, appPrefs } from "../kit.mjs";

const read = async (exec) => {
  const out = await exec("head -n 100000 /proc/uptime");
  const seconds = Math.floor(Number(out.stdout.split(" ")[0])) || 0;
  return { seconds, days: Math.floor(seconds / 86400) };
};

// Preferences of this app: the same entry shape as the catalogue (id, control, label, help) plus the name they
// are saved under (key) and a default. They are read and saved through GET and PUT /api/x/example-uptime/prefs,
// each with the same rich control as a router setting, and they never touch the router.
const prefs = appPrefs("example-uptime", [
  { id: "example-uptime.show", domain: "example-uptime", group: "card", groupLabel: L("Uptime card", "運行時間卡"), key: "show", default: "1", control: "switch", values: ON_OFF,
    label: L("Show the uptime card", "顯示運行時間卡"), help: L("Shows how long the router has been running on the overview.", "喺概覽顯示路由器已經運行咗幾耐。") },
  { id: "example-uptime.warn", domain: "example-uptime", group: "card", groupLabel: L("Uptime card", "運行時間卡"), key: "warn_days", default: "30", control: "stepper", min: 1, max: 365, unit: "days",
    label: L("Remind me to restart after", "幾耐之後提醒重啟"), help: L("The card turns amber once the router has run this long.", "運行超過呢個日數，卡片會變琥珀色。") },
  { id: "example-uptime.color", domain: "example-uptime", group: "card", groupLabel: L("Uptime card", "運行時間卡"), key: "color", default: "#3366cc", control: "color",
    label: L("Card colour", "卡片顏色"), help: L("The accent colour of the card.", "卡片嘅強調顏色。") },
]);

export default {
  id: "example-uptime",

  // A screen the server can read: GET /api/domain/example-uptime.
  domainMeta: [{ id: "example-uptime", icon: "timer", label: L("Uptime (example)", "運行時間（範例）"), group: { en: "Monitor", yue: "監察" } }],
  domains: {
    "example-uptime": async (ctx) => {
      const saved = await prefs.read();
      return { ...(await read(ctx.exec)), warnDays: Number(saved.get("warn_days")), color: saved.get("color"), show: saved.get("show") === "1", entries: prefs.entries(saved) };
    },
  },

  // Extra HTTP routes under /api/x/example-uptime. Sign-in, CSRF and the
  // viewer/operator roles apply automatically.
  routes(api) {
    prefs.routes(api);
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
  // feature: answers to commands only this feature sends.
  fakeRouter: {
    handlers: [(command) => (command === "example-uptime-mark" ? { stdout: "marked\n" } : undefined)],
  },
};
