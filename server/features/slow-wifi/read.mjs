// Reads what the "My Wi-Fi is slow" check needs from the router: each band's
// air, noise and temperature, the devices joined to it with their signal and
// link speed, and how long the router has been running. A reading the radio
// does not answer is null, never a guess, and the checks skip it.

const IFNAME = /^[a-z]{2,5}\d{1,2}(\.\d{1,2})?$/;
const MAC = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/i;
const MAX_DEVICES = 32;

const whole = (text) => {
  const n = Number(text);
  return text !== "" && text !== null && text !== undefined && Number.isFinite(n) ? n : null;
};

// "wl chanim_stats": a header line, then one line of numbers. Busy is the share of the air that was not free.
export function parseAir(text) {
  const lines = String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const at = lines.findIndex((l) => /^chanspec\b/i.test(l));
  if (at < 0 || !lines[at + 1]) return null;
  const names = lines[at].split(/\s+/).map((n) => n.toLowerCase());
  const values = lines[at + 1].split(/\s+/);
  const get = (name) => {
    const i = names.indexOf(name);
    return i >= 0 ? whole(values[i]) : null;
  };
  const clamp = (v) => (v === null ? null : Math.max(0, Math.min(100, v)));
  const txop = get("txop");
  return { busy: txop === null ? null : clamp(100 - txop), otherNetworks: clamp(get("obss")), nonWifi: clamp(get("nocat")) };
}

// "wl noise" and "wl phy_tempsense": one number at the start of the text.
export function parseLeadingNumber(text) {
  const m = String(text ?? "").trim().match(/^(-?\d+(?:\.\d+)?)/);
  return m ? whole(m[1]) : null;
}

// "assoclist AA:BB:CC:DD:EE:FF" lines.
export function parseAssoc(text) {
  const out = [];
  for (const line of String(text ?? "").split("\n")) {
    const m = line.trim().match(/^assoclist\s+([0-9A-F:]{17})$/i);
    if (m && MAC.test(m[1])) out.push(m[1].toUpperCase());
  }
  return out;
}

// "wl sta_info MAC": the signal and the speed of the last packet sent to the device.
export function parseStation(text) {
  const s = String(text ?? "");
  const rssi = s.match(/smoothed rssi:\s*(-?\d+)/i) ?? s.match(/per antenna average rssi of rx data frames:\s*(-?\d+)/i);
  const rate = s.match(/rate of last tx pkt:\s*(\d+)\s*kbps/i);
  return { rssi: rssi ? whole(rssi[1]) : null, linkMbps: rate ? Math.round(Number(rate[1]) / 100) / 10 : null };
}

const BAND = { 2: "2.4 GHz", 1: "5 GHz", 4: "6 GHz", 5: "6 GHz" };
export const bandLabel = (nband, index) => BAND[nband] ?? `Band ${index + 1}`;

async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

function names(leases, nvram, parseRows) {
  const byMac = new Map();
  for (const line of String(leases ?? "").split("\n")) {
    const [, mac, , host] = line.trim().split(/\s+/);
    if (mac && host && host !== "*") byMac.set(mac.toUpperCase(), host);
  }
  for (const row of parseRows(nvram.get("custom_clientlist") ?? "")) {
    const mac = String(row[1] ?? "").toUpperCase();
    if (row[0] && mac) byMac.set(mac, row[0]);
  }
  return byMac;
}

// One reading of every band. ctx is a feature domain context (exec, nvram, info).
export async function readRouter(ctx, { parseRows }) {
  const run = async (command) => {
    const out = await ctx.exec(command, { timeoutMs: 8000 }).catch(() => ({ code: 1, stdout: "" }));
    return out.code === 0 || out.code === undefined ? out.stdout ?? "" : null;
  };
  const leases = await run("head -n 100000 /var/lib/misc/dnsmasq.leases");
  const book = names(leases, ctx.nvram, parseRows);
  const bands = [];
  for (const b of ctx.info.bands ?? []) {
    if (!IFNAME.test(b.ifname ?? "")) continue;
    const on = (ctx.nvram.get(`wl${b.index}_radio`) ?? "1") === "1";
    const band = { index: b.index, nband: b.nband, ifname: b.ifname, band: bandLabel(b.nband, b.index), ssid: ctx.nvram.get(`wl${b.index}_ssid`) ?? "", on, air: null, noise: null, temperature: null, devices: [] };
    if (on) {
      const [air, noise, temperature, assoc] = await Promise.all([
        run(`wl -i ${b.ifname} chanim_stats`),
        run(`wl -i ${b.ifname} noise`),
        run(`wl -i ${b.ifname} phy_tempsense`),
        run(`wl -i ${b.ifname} assoclist`),
      ]);
      band.air = air === null ? null : parseAir(air);
      band.noise = noise === null ? null : parseLeadingNumber(noise);
      band.temperature = temperature === null ? null : parseLeadingNumber(temperature);
      const macs = assoc === null ? [] : parseAssoc(assoc).slice(0, MAX_DEVICES);
      band.devices = (
        await inBatches(macs, 6, async (mac) => {
          const text = await run(`wl -i ${b.ifname} sta_info ${mac}`);
          return text === null ? null : { mac, name: book.get(mac) ?? "", ...parseStation(text) };
        })
      ).filter(Boolean);
    }
    bands.push(band);
  }
  const uptime = await run("head -n 100000 /proc/uptime");
  const seconds = uptime === null ? null : parseLeadingNumber(uptime);
  return { bands, uptimeDays: seconds === null ? null : Math.floor(seconds / 86400) };
}
