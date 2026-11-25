// Wi-Fi diagnostics: who is connected to each Wi-Fi network and how well, who
// is using the most, the state of each radio (busy air, noise, radar and heat),
// disconnecting one device and asking the radio to pick a better channel again.
// Everything is read from the radio driver (the "wl" tool) and nothing here
// tracks where anyone is: a device only appears while it is joined to a network.
import { L, ON_OFF, macAddress, parseRows } from "../kit.mjs";
import { fake } from "./fake.mjs";
import { IFNAME, bandLabel, bytesPerSecond, parseAssoc, parseChanim, parseChannel, parseDfs, parseNumber, parseStaInfo, quality, rank } from "./parse.mjs";

const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const TRAIL = 30;
const MIN_GAP_MS = 800;
const RANKS = ["total", "down", "up"];
const states = new WeakMap(); // session -> what the last samples saw

// Every Wi-Fi network the router broadcasts: each band's main network and any guest network that is switched on.
function networks(nvram, info) {
  const out = [];
  for (const b of info.bands) {
    const main = { index: b.index, guest: false, ifname: b.ifname, ssid: nvram.get(`wl${b.index}_ssid`) ?? "", radio: (nvram.get(`wl${b.index}_radio`) ?? "1") === "1", nband: b.nband };
    out.push(main);
    for (let g = 1; g <= 3; g += 1) {
      const p = `wl${b.index}.${g}`;
      if (nvram.get(`${p}_bss_enabled`) !== "1") continue;
      out.push({ index: b.index, guest: true, ifname: nvram.get(`${p}_ifname`) || p, ssid: nvram.get(`${p}_ssid`) ?? "", radio: main.radio, nband: b.nband });
    }
  }
  return out.filter((n) => IFNAME.test(n.ifname)).map((n) => ({ ...n, band: bandLabel(n.nband, n.index) }));
}

function nameBook(leases, nvram) {
  const byMac = new Map();
  for (const line of leases.split("\n")) {
    const [, mac, ip, host] = line.trim().split(/\s+/);
    if (mac) byMac.set(mac.toUpperCase(), { ip: ip ?? "", name: host && host !== "*" ? host : "" });
  }
  for (const row of parseRows(nvram.get("custom_clientlist") ?? "")) {
    const mac = String(row[1] ?? "").toUpperCase();
    if (row[0] && mac) byMac.set(mac, { ip: byMac.get(mac)?.ip ?? "", name: row[0] });
  }
  return byMac;
}

async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

const setting = (nvram, key, fallback) => {
  const raw = nvram.get(key);
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(n) ? n : fallback;
};

// One reading of every connected device. Counters are read twice over time, so the first reading has no speed yet.
async function sample(ctx, { force = false } = {}) {
  const now = Date.now();
  let state = states.get(ctx.session);
  if (!state) states.set(ctx.session, (state = { at: 0, rows: [], networks: [], prev: new Map(), totals: new Map(), trails: new Map(), since: now, samples: 0 }));
  if (!force && state.samples > 0 && now - state.at < MIN_GAP_MS) return state;
  const nets = networks(ctx.nvram, ctx.info);
  const weak = setting(ctx.nvram, "mar_wd_weak", -75);
  const leases = await ctx.exec("head -n 100000 /var/lib/misc/dnsmasq.leases").catch(() => ({ stdout: "" }));
  const book = nameBook(leases.stdout ?? "", ctx.nvram);
  const listed = await Promise.all(
    nets.map(async (n) => {
      if (!n.radio) return { n, macs: [], supported: true };
      const out = await ctx.exec(`wl -i ${n.ifname} assoclist`, { timeoutMs: 8000 }).catch(() => ({ code: 1, stdout: "" }));
      return { n, macs: out.code === 0 ? parseAssoc(out.stdout) : [], supported: out.code === 0 };
    }),
  );
  const jobs = listed.flatMap(({ n, macs }) => macs.map((mac) => ({ n, mac })));
  const detail = await inBatches(jobs, 6, async ({ n, mac }) => {
    const out = await ctx.exec(`wl -i ${n.ifname} sta_info ${mac}`, { timeoutMs: 8000 }).catch(() => ({ code: 1, stdout: "" }));
    return { n, mac, info: out.code === 0 ? parseStaInfo(out.stdout) : null };
  });
  const taken = Date.now();
  const nextPrev = new Map();
  const rows = [];
  for (const { n, mac, info } of detail) {
    if (!info) continue;
    const before = state.prev.get(mac);
    const seconds = before ? (taken - before.at) / 1000 : 0;
    // A reading taken almost at once after the last one is too short to give a speed: keep the old speed.
    const enough = Boolean(before) && seconds >= 0.5;
    const downBps = enough ? bytesPerSecond(before.tx, info.txBytes, seconds) : before?.downBps ?? null;
    const upBps = enough ? bytesPerSecond(before.rx, info.rxBytes, seconds) : before?.upBps ?? null;
    nextPrev.set(mac, enough || !before ? { at: taken, tx: info.txBytes, rx: info.rxBytes, downBps, upBps } : before);
    if (enough) {
      if (downBps !== null && upBps !== null) {
        const t = state.totals.get(mac) ?? { down: 0, up: 0 };
        state.totals.set(mac, { down: t.down + (info.txBytes - before.tx), up: t.up + (info.rxBytes - before.rx) });
      }
      state.trails.set(mac, [...(state.trails.get(mac) ?? []), [downBps, upBps]].slice(-TRAIL));
    }
    const who = book.get(mac);
    const totals = state.totals.get(mac) ?? { down: 0, up: 0 };
    rows.push({
      mac,
      name: who?.name ?? "",
      ip: who?.ip ?? "",
      network: n.ssid,
      ifname: n.ifname,
      guest: n.guest,
      band: n.band,
      bandIndex: n.index,
      rssi: info.rssi,
      quality: quality(info.rssi),
      weak: info.rssi !== null && info.rssi < weak,
      txMbps: info.txKbps === null ? null : Math.round(info.txKbps / 100) / 10,
      rxMbps: info.rxKbps === null ? null : Math.round(info.rxKbps / 100) / 10,
      connected: info.connected,
      idle: info.idle,
      failures: info.failures,
      txBytes: info.txBytes,
      rxBytes: info.rxBytes,
      downBps,
      upBps,
      downTotal: totals.down,
      upTotal: totals.up,
      trail: state.trails.get(mac) ?? [],
    });
  }
  state.prev = nextPrev;
  for (const mac of [...state.trails.keys()]) if (!nextPrev.has(mac)) state.trails.delete(mac);
  state.at = taken;
  state.rows = rows.sort((a, b) => a.band.localeCompare(b.band) || (a.name || a.mac).localeCompare(b.name || b.mac));
  state.networks = listed.map(({ n, macs, supported }) => ({ ifname: n.ifname, ssid: n.ssid, band: n.band, guest: n.guest, radio: n.radio, supported, clients: macs.length }));
  state.samples += 1;
  return state;
}

// Readings of one band's radio. A reading the radio does not answer is null and named in "unavailable".
async function radio(ctx, band) {
  const run = async (what, parse) => {
    const out = await ctx.exec(`wl -i ${band.ifname} ${what}`, { timeoutMs: 8000 }).catch(() => ({ code: 1, stdout: "" }));
    return out.code === 0 ? parse(out.stdout) : null;
  };
  const five = band.nband !== "2";
  const [noise, air, dfs, temperature, channel] = await Promise.all([run("noise", parseNumber), run("chanim_stats", parseChanim), five ? run("dfs_status", parseDfs) : Promise.resolve(null), run("phy_tempsense", parseNumber), run("channel", parseChannel)]);
  const chanspec = ctx.nvram.get(`wl${band.index}_chanspec`) ?? "";
  return {
    index: band.index,
    ifname: band.ifname,
    band: bandLabel(band.nband, band.index),
    ssid: ctx.nvram.get(`wl${band.index}_ssid`) ?? "",
    on: (ctx.nvram.get(`wl${band.index}_radio`) ?? "1") === "1",
    chanspec,
    autoChannel: chanspec === "0" || chanspec === "",
    noise,
    air,
    dfs: five ? dfs : null,
    dfsApplies: five,
    temperature,
    channel,
    unavailable: [noise === null && "noise", air === null && "air", five && dfs === null && "dfs", temperature === null && "temperature"].filter(Boolean),
  };
}

export default {
  id: "wifi-diagnostics",

  catalog() {
    const g = { domain: "wifi-diagnostics", risk: "low" };
    const live = { ...g, group: "live", groupLabel: L("Live view", "即時顯示") };
    const top = { ...g, group: "top", groupLabel: L("Busiest devices", "最忙嘅裝置") };
    return [
      { ...live, id: "wifi-diagnostics.refresh", key: "mar_wd_refresh", control: "stepper", min: 2, max: 30, unit: "s",
        label: L("Refresh the live view every", "即時顯示幾耐更新一次"), help: L("How often the client table, the busiest devices and the radio gauges read the router again while the screen is open. Shorter is smoother but asks the router more often.", "屏幕打開時，客戶端表、最忙裝置同電台儀表幾耐向路由器讀一次。短啲順啲，但路由器要答得密啲。") },
      { ...live, id: "wifi-diagnostics.weak", key: "mar_wd_weak", control: "slider", min: -90, max: -50, step: 5, unit: " dBm",
        label: L("Call a signal weak below", "訊號低過呢個值就當係弱"), help: L("Devices under this level are marked weak in the table. -75 dBm is a fair line; video calls start to struggle past -80.", "低過呢個數值嘅裝置喺表入面會標示為弱。-75 dBm 係合理嘅界線；過咗 -80 視像通話就開始辛苦。") },
      { ...top, id: "wifi-diagnostics.rank", key: "mar_wd_rank", control: "segmented",
        options: [["total", L("Both together", "上載加下載"), L("Rank by upload plus download.", "按上載加下載排名。")], ["down", L("Downloading", "下載"), L("Rank by what devices pull from the internet.", "按裝置由互聯網拉落嚟嘅資料排名。")], ["up", L("Uploading", "上載"), L("Rank by what devices send out.", "按裝置送出去嘅資料排名。")]],
        label: L("Rank the busiest devices by", "最忙嘅裝置按咩排名"), help: L("Which direction decides the order. You can also switch it on the Busiest tab without saving.", "邊個方向決定次序。你亦可以喺「最忙」分頁臨時切換，唔使儲存。") },
      { ...top, id: "wifi-diagnostics.count", key: "mar_wd_count", control: "stepper", min: 3, max: 20, unit: "",
        label: L("How many devices to list", "列出幾多部裝置"), help: L("The length of the busiest-devices list.", "最忙裝置名單嘅長度。") },
      { ...top, id: "wifi-diagnostics.guests", key: "mar_wd_guests", control: "switch", values: ON_OFF,
        label: L("Include guest networks", "包括訪客網絡"), help: L("Counts devices on guest networks in the busiest list as well.", "最忙名單亦計入訪客網絡嘅裝置。") },
    ];
  },

  domainMeta: [{ id: "wifi-diagnostics", icon: "network_check", label: L("Wi-Fi diagnostics", "Wi-Fi 診斷"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    "wifi-diagnostics": async (ctx) => ({
      networks: networks(ctx.nvram, ctx.info),
      bands: ctx.info.bands.filter((b) => IFNAME.test(b.ifname)).map((b) => ({ index: b.index, ifname: b.ifname, band: bandLabel(b.nband, b.index), dfs: b.nband !== "2", on: (ctx.nvram.get(`wl${b.index}_radio`) ?? "1") === "1", auto: (ctx.nvram.get(`wl${b.index}_chanspec`) ?? "0") === "0" })),
      refresh: setting(ctx.nvram, "mar_wd_refresh", 5),
      weak: setting(ctx.nvram, "mar_wd_weak", -75),
      rank: RANKS.includes(ctx.nvram.get("mar_wd_rank")) ? ctx.nvram.get("mar_wd_rank") : "total",
      count: setting(ctx.nvram, "mar_wd_count", 8),
      entries: ctx.entries(),
    }),
  },

  routes(api) {
    // Every connected device with its signal, speeds and counters.
    api.get("/clients", async ({ live, query }) => {
      const ctx = await live();
      const s = await sample(ctx, { force: query.force === "1" });
      return { at: new Date(s.at).toISOString(), networks: s.networks, clients: s.rows, weakBelow: setting(ctx.nvram, "mar_wd_weak", -75), warming: s.samples < 2 };
    });

    // Who is downloading and uploading the most right now, with totals since this app started watching.
    api.get("/top", async ({ live, query }) => {
      const ctx = await live();
      const s = await sample(ctx, { force: query.force === "1" });
      const saved = ctx.nvram.get("mar_wd_rank");
      const by = RANKS.includes(query.by) ? query.by : RANKS.includes(saved) ? saved : "total";
      const count = Math.min(20, Math.max(1, Number(query.count) || setting(ctx.nvram, "mar_wd_count", 8)));
      const guests = (ctx.nvram.get("mar_wd_guests") ?? "1") === "1";
      const pool = s.rows.filter((r) => guests || !r.guest);
      const sum = (key) => pool.reduce((t, r) => t + (r[key] ?? 0), 0);
      const down = sum("downBps");
      const up = sum("upBps");
      const share = (value, whole) => (whole > 0 ? Math.round((1000 * (value ?? 0)) / whole) / 10 : 0);
      const rows = rank(pool, by, count).map((r) => ({ ...r, shareDown: share(r.downBps, down), shareUp: share(r.upBps, up) }));
      const perNetwork = new Map();
      for (const r of pool) {
        const n = perNetwork.get(r.ifname) ?? { ssid: r.network, band: r.band, guest: r.guest, clients: 0, downBps: 0, upBps: 0 };
        n.clients += 1;
        n.downBps += r.downBps ?? 0;
        n.upBps += r.upBps ?? 0;
        perNetwork.set(r.ifname, n);
      }
      return {
        at: new Date(s.at).toISOString(),
        since: new Date(s.since).toISOString(),
        by,
        count,
        warming: s.samples < 2,
        totals: { downBps: down, upBps: up, clients: pool.length },
        rows,
        networks: [...perNetwork.values()].sort((a, b) => b.downBps + b.upBps - (a.downBps + a.upBps)),
      };
    });

    // Gauges for every radio: noise, busy air, radar state and temperature.
    api.get("/radios", async ({ live }) => {
      const ctx = await live();
      const bands = ctx.info.bands.filter((b) => IFNAME.test(b.ifname));
      return { at: new Date().toISOString(), radios: await Promise.all(bands.map((b) => radio(ctx, b))) };
    });
  },

  actions: {
    // Disconnects one device from the network it is on. Most devices rejoin straight away; this only asks.
    kick: {
      risk: "network",
      confirm: ["hold"],
      run: async ({ body, exec, nvram, info }) => {
        const mac = macAddress(body.mac);
        const book = await nvram();
        for (const n of networks(book, info)) {
          if (!n.radio) continue;
          const out = await exec(`wl -i ${n.ifname} assoclist`, { timeoutMs: 8000 }).catch(() => ({ code: 1, stdout: "" }));
          if (out.code !== 0 || !parseAssoc(out.stdout).includes(mac)) continue;
          const kicked = await exec(`wl -i ${n.ifname} deauthenticate ${mac}`, { timeoutMs: 8000 });
          if (kicked.code !== 0) throw bad(`The radio refused to disconnect ${mac}.`, 502);
          const after = await exec(`wl -i ${n.ifname} assoclist`, { timeoutMs: 8000 }).catch(() => ({ code: 1, stdout: "" }));
          return { ok: true, mac, network: n.ssid, band: n.band, gone: after.code === 0 && !parseAssoc(after.stdout).includes(mac), message: "The device was disconnected. Most devices join again within a few seconds." };
        }
        throw bad("That device is not joined to any Wi-Fi network right now.", 404);
      },
    },

    // Asks the radio to pick the best channel again. Only a band left on automatic channel selection can move.
    acs: {
      risk: "network",
      confirm: ["hold"],
      run: async ({ body, exec, nvram, info }) => {
        const index = Number(body.band);
        const b = info.bands.find((x) => x.index === index);
        if (!Number.isInteger(index) || !b || !IFNAME.test(b.ifname)) throw bad("Choose one of the router's Wi-Fi bands.", 404);
        const book = await nvram();
        if ((book.get(`wl${index}_radio`) ?? "1") !== "1") throw bad("That band's radio is off.", 409);
        if ((book.get(`wl${index}_chanspec`) ?? "0") !== "0") throw bad("That band has a fixed channel. Set its channel to Auto first, then ask again.", 409);
        const read = async () => {
          const out = await exec(`wl -i ${b.ifname} channel`, { timeoutMs: 8000 }).catch(() => ({ stdout: "" }));
          const channel = parseChannel(out.stdout);
          return channel === null ? null : String(channel);
        };
        const before = await read();
        let method = "autochannel";
        const out = await exec(`wl -i ${b.ifname} autochannel 1`, { timeoutMs: 15000 }).catch(() => ({ code: 1 }));
        if (out.code !== 0) {
          method = "restart_wireless";
          const restarted = await exec("service restart_wireless", { timeoutMs: 15000 }).catch(() => ({ code: 1 }));
          if (restarted.code !== 0) throw bad("The radio could not start a new channel search. Nothing was changed.", 502);
        }
        const after = await read();
        return { ok: true, band: bandLabel(b.nband, b.index), method, before, after, moved: before !== null && after !== null && before !== after };
      },
    },
  },

  fakeRouter: fake,
};
