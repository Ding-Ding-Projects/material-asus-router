// Channel analyser: scans the air around the router with the radio driver
// (wl scanresults), charts the neighbouring networks by channel and recommends
// the quietest channel the router's own channel setting offers. Choosing it
// goes through the change engine like any other edit.
import { L, ON_OFF, quote } from "../kit.mjs";
import { bandOf, parseScan, recommend, summarise } from "./parse.mjs";

const IFNAME = /^[a-z]{2,5}\d{1,2}$/;

function bandsOf(nvram, info) {
  return info.bands
    .map((b) => ({ index: b.index, ifname: b.ifname, band: bandOf(b.nband), radio: (nvram.get(`wl${b.index}_radio`) ?? "1") === "1", ssid: nvram.get(`wl${b.index}_ssid`) ?? "" }))
    .filter((b) => IFNAME.test(b.ifname));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function scan(ctx, bandIndex, { wait }) {
  const bands = bandsOf(ctx.nvram, ctx.info);
  const b = bands.find((x) => x.index === bandIndex);
  if (!b) throw Object.assign(new Error("That Wi-Fi band does not exist on this router."), { status: 404 });
  if (!b.radio) throw Object.assign(new Error("That band's radio is off, so there is nothing to scan from."), { status: 409 });
  const started = await ctx.exec(`wl -i ${quote(b.ifname)} scan`, { timeoutMs: 15000 });
  if (started.code !== 0) throw Object.assign(new Error(`The radio could not start a scan (${started.stderr.trim() || `exit code ${started.code}`}).`), { status: 502 });
  await sleep(wait);
  const out = await ctx.exec(`wl -i ${quote(b.ifname)} scanresults`, { timeoutMs: 20000 });
  if (out.code !== 0) throw Object.assign(new Error("The scan results could not be read."), { status: 502 });
  const spec = await ctx.exec(`wl -i ${quote(b.ifname)} chanspec`, { timeoutMs: 8000 });
  const own = Number((spec.stdout.match(/^(\d+)/) ?? [])[1]) || null;
  return { b, networks: parseScan(out.stdout), own };
}

export default {
  id: "channel-analyser",

  catalog: () => {
    const g = { domain: "channel-analyser", group: "scan", groupLabel: L("Scanning", "掃描"), risk: "low" };
    return [
      { ...g, id: "channel-analyser.min-rssi", key: "mar_chan_min_rssi", control: "slider", min: -95, max: -50, step: 5, unit: " dBm",
        label: L("Ignore networks weaker than", "忽略比呢個更弱嘅網絡"), help: L("Very faint networks barely disturb you. Lower values count more neighbours.", "好弱嘅網絡幾乎唔影響你。數值愈低，計入愈多鄰居。") },
      { ...g, id: "channel-analyser.hidden", key: "mar_chan_hidden", control: "switch", values: ON_OFF,
        label: L("Count hidden networks", "計入隱藏網絡"), help: L("Hidden networks still use the air, so they count by default.", "隱藏嘅網絡一樣佔用頻道，所以預設會計入。") },
      { ...g, id: "channel-analyser.wait", key: "mar_chan_wait", control: "stepper", min: 2, max: 10, unit: "s",
        label: L("Wait for the scan", "等掃描嘅時間"), help: L("How long the radio listens before the results are read. Longer finds more networks.", "電台聽幾耐先讀結果。耐啲會搵到多啲網絡。") },
    ];
  },

  domainMeta: [{ id: "channel-analyser", icon: "wifi_find", label: L("Channel analyser", "頻道分析"), group: { en: "Network", yue: "網絡" } }],
  domains: {
    "channel-analyser": async (ctx) => ({
      bands: bandsOf(ctx.nvram, ctx.info),
      minRssi: Number(ctx.nvram.get("mar_chan_min_rssi") ?? -85),
      hidden: (ctx.nvram.get("mar_chan_hidden") ?? "1") === "1",
      waitSeconds: Number(ctx.nvram.get("mar_chan_wait") ?? 3),
      entries: ctx.entries(),
    }),
  },

  routes(api) {
    // GET /scan?band=0 : scans one band and returns the networks, the chart rows and a recommendation.
    api.get("/scan", async ({ live, query, bad }) => {
      const ctx = await live();
      const index = Number(query.band ?? 0);
      if (!Number.isInteger(index) || index < 0) throw bad("Choose a band.");
      const minRssi = Number(ctx.nvram.get("mar_chan_min_rssi") ?? -85);
      const hidden = (ctx.nvram.get("mar_chan_hidden") ?? "1") === "1";
      const wait = query.wait !== undefined ? Math.min(10000, Math.max(0, Number(query.wait) || 0)) : Number(ctx.nvram.get("mar_chan_wait") ?? 3) * 1000;
      const { b, networks: all, own } = await scan(ctx, index, { wait });
      const networks = all.filter((n) => n.rssi >= minRssi && (hidden || n.ssid));
      const entry = ctx.catalog.find((e) => e.id === `wl${index}.channel`);
      const candidates = (entry?.options ?? []).map(([v]) => Number(v)).filter((n) => n > 0);
      return {
        band: b,
        scanned: all.length,
        counted: networks.length,
        ownChannel: own,
        networks: networks.sort((x, y) => y.rssi - x.rssi),
        channels: summarise(b.band, networks, candidates),
        candidates,
        recommendation: recommend(b.band, networks, candidates, own),
        entryId: entry?.id ?? null,
      };
    });
  },

  fakeRouter: {
    nvram: { mar_chan_min_rssi: "-85", mar_chan_hidden: "1", mar_chan_wait: "3" },
    handlers: [
      (command, router) => {
        let m;
        if ((m = command.match(/^wl -i '?(eth\d)'? scan$/))) return {};
        if ((m = command.match(/^wl -i '?(eth\d)'? chanspec$/))) return { stdout: m[1] === "eth6" ? `${router.nvram.wl0_chanspec === "0" ? 6 : router.nvram.wl0_chanspec} (0x1006)\n` : `${router.nvram.wl1_chanspec === "0" ? "36/80" : router.nvram.wl1_chanspec} (0xe02a)\n` };
        if ((m = command.match(/^wl -i '?(eth\d)'? scanresults$/))) {
          const block = (ssid, mac, rssi, channel, secured = true) => `SSID: "${ssid}"\nMode: Managed\tRSSI: ${rssi} dBm\tSNR: 30 dB\tnoise: -92 dBm\tChannel: ${channel}\nBSSID: ${mac}\tCapability: ESS ${secured ? "RSN" : ""}\nSupported Rates: [ 6(b) 9 12(b) 18 ]\n\n`;
          const twoFour = block("Neighbour Cafe", "AA:10:00:00:00:01", -48, 6) + block("TeaHouse 2G", "AA:10:00:00:00:02", -60, 6) + block("Flat 9B", "AA:10:00:00:00:03", -71, 1) + block("Alex Phone", "AA:10:00:00:00:04", -66, 11, false) + block("", "AA:10:00:00:00:05", -74, 7) + block("Far Away", "AA:10:00:00:00:06", -92, 3);
          const five = block("Neighbour Cafe 5G", "AA:20:00:00:00:01", -52, "36/80") + block("TeaHouse 5G", "AA:20:00:00:00:02", -64, "36/40") + block("Flat 9B 5G", "AA:20:00:00:00:03", -70, "44/80");
          return { stdout: m[1] === "eth6" ? twoFour : five };
        }
        return undefined;
      },
    ],
  },
};
