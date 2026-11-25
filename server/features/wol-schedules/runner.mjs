// Sends Wake-on-LAN packets from the router, now or when a schedule says so.
// The app does the timing (a timer in this server process): the router is only
// asked to send the packet. If the app is not running at that minute, that
// wake is skipped; it is never sent late.
import { macAddress } from "../kit.mjs";
import { dayKey, clock, dueAt } from "./schedule.mjs";

export const IFACES = ["br0", "br1"];
const LOG_LIMIT = 60;

export function settingsOf(nvram) {
  const repeat = Number(nvram.get("mar_wol_repeat") ?? 2);
  return {
    iface: IFACES.includes(nvram.get("mar_wol_iface")) ? nvram.get("mar_wol_iface") : "br0",
    repeat: Number.isInteger(repeat) && repeat >= 1 && repeat <= 5 ? repeat : 2,
    scheduled: (nvram.get("mar_wol_enabled") ?? "1") === "1",
  };
}

export function createRunner({ store, tickMs = 15000 }) {
  let live = null;
  let timer = null;
  let lastError = null;
  let lastTick = null;
  let ticking = false;

  async function wake(ctx, mac, { source, name = "" }) {
    const address = macAddress(mac);
    const s = settingsOf(ctx.nvram);
    let ok = true;
    let detail = "";
    for (let i = 0; i < s.repeat; i += 1) {
      const out = await ctx.exec(`ether-wake -i ${s.iface} ${address}`, { timeoutMs: 10000 });
      if (out.code !== 0) {
        ok = false;
        detail = out.stderr.trim().split("\n")[0] || `exit code ${out.code}`;
        break;
      }
    }
    const entry = { at: new Date().toISOString(), mac: address, name, source, ok, detail, iface: s.iface };
    await store.update((st) => {
      st.log.push(entry);
      while (st.log.length > LOG_LIMIT) st.log.shift();
    });
    return entry;
  }

  // Looks at the clock once and wakes whatever is due this minute.
  async function tick(ctx, date = new Date()) {
    lastTick = date.toISOString();
    if (!settingsOf(ctx.nvram).scheduled) return [];
    const { schedules } = await store.read();
    const sent = [];
    for (const { schedule, key } of dueAt(schedules, date)) {
      if (schedule.lastKey === key) continue;
      // Claim the minute first, so two overlapping ticks never wake the same device twice.
      const claimed = await store.update((st) => {
        const target = st.schedules.find((x) => x.id === schedule.id);
        if (!target || target.lastKey === key) return false;
        target.lastKey = key;
        target.lastRun = date.toISOString();
        return true;
      });
      if (claimed) sent.push(await wake(ctx, schedule.mac, { source: "schedule", name: schedule.name }));
    }
    return sent;
  }

  return {
    wake,
    tick,
    // Starts the timer once; it keeps the router link function so it can read a fresh context every time.
    start(liveFn) {
      live = liveFn;
      if (timer) return;
      timer = setInterval(async () => {
        if (ticking) return;
        ticking = true;
        try {
          await tick(await live());
          lastError = null;
        } catch (error) {
          lastError = error.message;
        }
        ticking = false;
      }, tickMs);
      timer.unref?.();
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
    status: () => ({ running: Boolean(timer), tickMs, lastTick, lastError, serverTime: new Date().toISOString(), timezoneOffsetMinutes: -new Date().getTimezoneOffset(), today: dayKey(new Date()), now: clock(new Date()) }),
  };
}
