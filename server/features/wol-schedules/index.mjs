// Wake-on-LAN: wake a device now, or on a weekly schedule painted on a grid.
// Schedules live in the app's own state and the app sends the wake at the start
// of each painted block (see runner.mjs). The router settings below (which
// bridge to send on, how many packets) are preferences of this app, saved by the app and never written to the router.
import { L, ON_OFF, appPrefs, cleanText, macAddress, parseRows } from "../kit.mjs";
import { IFACES, createRunner, settingsOf } from "./runner.mjs";
import { nextWake, parseSpec } from "./schedule.mjs";
import { featureState } from "./state.mjs";

const store = featureState("wol-schedules", { schedules: [], log: [] });

const MAX_SCHEDULES = 50;
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function devices(ctx) {
  const out = await ctx.exec("head -n 100000 /var/lib/misc/dnsmasq.leases");
  const names = new Map();
  for (const row of parseRows(ctx.nvram.get("custom_clientlist") ?? "")) if (row[1]) names.set(row[1].toUpperCase(), row[0]);
  const list = new Map();
  for (const line of out.stdout.split("\n")) {
    const [, mac, ip, host] = line.trim().split(/\s+/);
    if (!mac) continue;
    const address = mac.toUpperCase();
    list.set(address, { mac: address, ip, name: names.get(address) || (host && host !== "*" ? host : ip) });
  }
  for (const [mac, name] of names) if (!list.has(mac)) list.set(mac, { mac, ip: "", name });
  return [...list.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function view(schedule, now = new Date()) {
  const next = schedule.enabled ? nextWake(schedule.spec, now) : null;
  return { ...schedule, next: next ? next.toISOString() : null };
}

function checked(body, existing) {
  const mac = macAddress(body.mac ?? existing?.mac);
  const spec = String(body.spec ?? existing?.spec ?? "").trim();
  parseSpec(spec);
  return { mac, name: cleanText(body.name ?? existing?.name ?? "", "Name", { allowEmpty: true }), spec, enabled: body.enabled === undefined ? existing?.enabled ?? true : body.enabled === true };
}

const g = { domain: "wol-schedules", group: "send", groupLabel: L("How wake packets are sent", "點樣發送喚醒訊號"), risk: "low" };
const prefs = appPrefs("wol-schedules", [
  { ...g, id: "wol-schedules.iface", key: "iface", default: "br0", control: "segmented", options: [["br0", L("Main network", "主網絡"), L("The normal home network (br0)", "一般屋企網絡（br0）")], ["br1", L("Guest network", "訪客網絡"), L("The guest bridge (br1), if the router has one", "訪客橋接（br1），如果路由器有")]],
    label: L("Send on", "發送喺"), help: L("Which network the wake packet goes out on. Use the one the sleeping device is on.", "喚醒訊號由邊個網絡發出。用沉睡裝置所屬嗰個。") },
  { ...g, id: "wol-schedules.repeat", key: "repeat", default: "2", control: "stepper", min: 1, max: 5, unit: "times",
    label: L("Send each wake packet", "每個喚醒訊號發送"), help: L("Sending it twice or more helps with devices that miss the first one.", "發送兩次或以上，可以幫到漏咗第一個嘅裝置。") },
  { ...g, id: "wol-schedules.scheduled", key: "enabled", default: "1", control: "switch", values: ON_OFF,
    label: L("Run scheduled wakes", "執行排程喚醒"), help: L("Turn off to pause every schedule without deleting them. Waking by hand still works.", "關閉就暫停所有排程，唔使刪除。手動喚醒照用得。") },
]);
const runner = createRunner({ store, prefs });

export default {
  id: "wol-schedules",

  domainMeta: [{ id: "wol-schedules", icon: "power_settings_new", label: L("Wake-on-LAN", "網絡喚醒"), group: { en: "Network", yue: "網絡" } }],
  domains: { "wol-schedules": async () => { const saved = await prefs.read(); return { ...settingsOf(saved), entries: prefs.entries(saved) }; } },

  routes(api) {
    prefs.routes(api);
    // The timer starts the first time anyone asks, and keeps running while the app runs.
    api.get("/status", async ({ live }) => {
      runner.start(live);
      const ctx = await live();
      const { schedules, log } = await store.read();
      return { scheduler: runner.status(), settings: settingsOf(await prefs.read()), schedules: schedules.map((s) => view(s)), log: [...log].reverse(), devices: await devices(ctx) };
    });
    api.post("/schedules", async ({ body, live }) => {
      runner.start(live);
      const data = checked(body);
      const made = { id: newId(), ...data, lastRun: null, lastKey: null };
      await store.update((s) => {
        if (s.schedules.length >= MAX_SCHEDULES) throw Object.assign(new Error(`Keep at most ${MAX_SCHEDULES} schedules.`), { status: 409 });
        s.schedules.push(made);
      });
      return view(made);
    });
    api.put("/schedules/:id", async ({ body, params, bad }) => {
      const updated = await store.update((s) => {
        const target = s.schedules.find((x) => x.id === params.id);
        if (!target) throw bad("That schedule does not exist.", 404);
        Object.assign(target, checked(body, target));
        return structuredClone(target);
      });
      return view(updated);
    });
    api.delete("/schedules/:id", async ({ params, bad }) => {
      await store.update((s) => {
        if (!s.schedules.some((x) => x.id === params.id)) throw bad("That schedule does not exist.", 404);
        s.schedules = s.schedules.filter((x) => x.id !== params.id);
      });
      return { ok: true };
    });
    api.delete("/log", async () => {
      await store.update((s) => void (s.log = []));
      return { ok: true };
    });
  },

  actions: {
    // POST /api/actions/wol-schedules.wake { mac } : wake one device now.
    wake: {
      risk: "low",
      run: async ({ body, exec }) => {
        const entry = await runner.wake({ exec }, body.mac, { source: "manual", name: String(body.name ?? "").slice(0, 32) });
        return { ok: entry.ok, ...entry };
      },
    },
  },

  fakeRouter: {
    handlers: [
      (command) => {
        const m = command.match(/^ether-wake -i (br\d) ([0-9A-F:]{17})$/);
        if (!m || !IFACES.includes(m[1])) return undefined;
        return m[2] === "02:00:00:00:00:99" ? { code: 1, stderr: "ether-wake: sendto: No such device\n" } : {};
      },
    ],
  },
};
