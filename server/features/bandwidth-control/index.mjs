// Bandwidth control: pause a device's internet for a while (kick), or until lifted (ban).
// It is for sharing the connection fairly, so the person on the paused device can always lift
// it themselves: the public Unkick page recognises their device by its address and offers one
// button for that device only. Ways to pause:
//   pause      the router drops the device's internet traffic (a firewall rule for its MAC)
//   names      the router stops answering the device's name lookups, so sites stop loading
//   disconnect the device is sent off the Wi-Fi once (it can rejoin straight away)
// The rules live in chains of their own, so nothing else in the firewall is touched, and they
// are put back after a router restart. Every pause and every lift is kept in a log.
import { L, isIpv4, isMac, macAddress } from "../kit.mjs";
import { featureState } from "./state.mjs";

const ID = "bandwidth-control";
const store = featureState(ID, { holds: [], log: [] });
const CHAIN = "MAR_PAUSE"; // forwarded traffic from paused devices
const DNS_CHAIN = "MAR_NAMES"; // name lookups to the router from paused devices
export const METHODS = {
  pause: {
    label: L("Pause internet", "暫停上網"),
    about: L("The router drops this device's internet traffic. Things at home, like printers, still work.", "路由器會截停呢部裝置嘅上網流量。屋企入面嘅嘢，例如打印機，照用得。"),
  },
  names: {
    label: L("Block name lookups", "封鎖網址查詢"),
    about: L("The router stops answering this device's name lookups, so websites and most apps stop loading. Anything that uses an address directly still works.", "路由器唔再答呢部裝置查網址，所以網站同大部分 app 都會載入唔到。直接用位址嘅嘢照用得。"),
  },
  disconnect: {
    label: L("Disconnect from Wi-Fi once", "斷開 Wi-Fi 一次"),
    about: L("Sends the device off the Wi-Fi once. It can rejoin straight away.", "叫部裝置離開 Wi-Fi 一次。佢可以即刻連返。"),
  },
};
export const DURATIONS = [15, 30, 60, 120, 240];
const LOG_LIMIT = 200;

const now = () => Date.now();
const running = (hold, t = now()) => hold.until === null || hold.until > t;

// The IPv4 rules for one hold. Pause also gets an IPv6 twin, added and removed alongside.
function rulesFor(mac, method) {
  if (method === "pause") return [`-A ${CHAIN} -m mac --mac-source ${mac} -j DROP`];
  if (method === "names") return [`-A ${DNS_CHAIN} -m mac --mac-source ${mac} -p udp -m udp --dport 53 -j DROP`, `-A ${DNS_CHAIN} -m mac --mac-source ${mac} -p tcp -m tcp --dport 53 -j DROP`];
  return [];
}

// The chains, hooked in once at the top of FORWARD and INPUT. Safe to run again.
const SETUP = [
  `iptables -N ${CHAIN} 2>/dev/null`,
  `iptables -C FORWARD -j ${CHAIN} 2>/dev/null || iptables -I FORWARD 1 -j ${CHAIN}`,
  `ip6tables -N ${CHAIN} 2>/dev/null`,
  `ip6tables -C FORWARD -j ${CHAIN} 2>/dev/null || ip6tables -I FORWARD 1 -j ${CHAIN} 2>/dev/null`,
  `iptables -N ${DNS_CHAIN} 2>/dev/null`,
  `iptables -C INPUT -j ${DNS_CHAIN} 2>/dev/null || iptables -I INPUT 1 -j ${DNS_CHAIN}`,
];

// Puts the router's rules in line with the holds still running: missing rules are added (after a
// router restart), rules of finished or lifted holds are removed. Returns how many rules changed.
export async function reconcile(exec, holds, t = now()) {
  for (const command of SETUP) await exec(command);
  const listed = (await exec(`iptables -S ${CHAIN} 2>/dev/null`)).stdout + (await exec(`iptables -S ${DNS_CHAIN} 2>/dev/null`)).stdout;
  const have = new Set(String(listed).split("\n").map((l) => l.trim()).filter((l) => l.startsWith("-A ") && l.includes("--mac-source")));
  const want = new Set(holds.filter((h) => running(h, t)).flatMap((h) => rulesFor(h.mac, h.method)));
  let changed = 0;
  for (const rule of want) {
    if (have.has(rule)) continue;
    await exec(`iptables ${rule}`);
    if (rule.startsWith(`-A ${CHAIN} `)) await exec(`ip6tables ${rule} 2>/dev/null`);
    changed++;
  }
  for (const rule of have) {
    if (want.has(rule)) continue;
    const remove = rule.replace(/^-A /, "-D ");
    await exec(`iptables ${remove}`);
    if (rule.startsWith(`-A ${CHAIN} `)) await exec(`ip6tables ${remove} 2>/dev/null`);
    changed++;
  }
  return changed;
}

const oneLine = (value, max) => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

function cleanHold(body, bad, who) {
  const mac = macAddress(String(body.mac ?? ""));
  if (!isMac(mac)) throw bad("Choose a device.");
  const method = String(body.method ?? "pause");
  if (!METHODS[method]) throw bad("Choose how to pause it.");
  const ban = body.ban === true && method !== "disconnect";
  const minutes = Number(body.minutes);
  if (!ban && method !== "disconnect" && !DURATIONS.includes(minutes)) throw bad(`Choose how long: ${DURATIONS.join(", ")} minutes.`);
  return { mac: mac.toUpperCase(), method, ban, minutes: ban || method === "disconnect" ? null : minutes, note: oneLine(body.note, 120), name: oneLine(body.name, 64), by: who.name };
}

function log(state, entry) {
  state.log.unshift({ at: new Date().toISOString(), ...entry });
  if (state.log.length > LOG_LIMIT) state.log.length = LOG_LIMIT;
}

// What a paused person sees about their own device: why and until when, never anyone else's.
const publicHold = (h) => ({ method: h.method, methodLabel: METHODS[h.method].label, ban: h.ban, until: h.until === null ? null : new Date(h.until).toISOString(), note: h.note, by: h.by });

async function macOfAddress(exec, ip) {
  const arp = (await exec("head -n 100000 /proc/net/arp")).stdout ?? "";
  for (const line of arp.split("\n").slice(1)) {
    const c = line.trim().split(/\s+/);
    if (c[0] === ip && isMac(c[3] ?? "") && c[2] !== "0x0") return c[3].toUpperCase();
  }
  const leases = (await exec("head -n 100000 /var/lib/misc/dnsmasq.leases")).stdout ?? "";
  for (const line of leases.split("\n")) {
    const c = line.trim().split(/\s+/);
    if (c[2] === ip && isMac(c[1] ?? "")) return c[1].toUpperCase();
  }
  return "";
}

// The public Unkick page: it may only read and lift the holds on the visitor's own device.
export async function selfService({ exec, ip, lift = false }) {
  const address = String(ip ?? "").replace(/^::ffff:/, "");
  if (!isIpv4(address)) return { found: false, reason: "address" };
  const mac = await macOfAddress(exec, address);
  if (!mac) return { found: false, reason: "device" };
  const state = await store.read();
  const mine = state.holds.filter((h) => h.mac === mac && running(h));
  if (!lift) return { found: true, holds: mine.map(publicHold) };
  if (!mine.length) return { found: true, holds: [], lifted: 0 };
  const holds = await store.update((s) => {
    for (const h of s.holds.filter((x) => x.mac === mac && running(x))) log(s, { event: h.ban ? "unban" : "unkick", mac, name: h.name, by: "the device itself", method: h.method });
    s.holds = s.holds.filter((x) => !(x.mac === mac && running(x)));
    return s.holds;
  });
  await reconcile(exec, holds);
  return { found: true, holds: [], lifted: mine.length };
}

export default {
  id: ID,
  domainMeta: [{ id: ID, icon: "pan_tool", label: L("Kick and ban", "踢走同封鎖"), group: L("Devices", "裝置") }],
  domains: {
    [ID]: async () => {
      const state = await store.read();
      const t = now();
      return { methods: METHODS, durations: DURATIONS, holds: state.holds.filter((h) => running(h, t)), log: state.log.slice(0, 50) };
    },
  },
  routes(api) {
    api.post("/hold", async ({ body, bad, who, live }) => {
      const hold = cleanHold(body, bad, who);
      const ctx = await live();
      if (hold.method === "disconnect") {
        for (const band of ctx.info.bands) await ctx.exec(`wl -i ${band.ifname} deauthenticate ${hold.mac} 2>/dev/null`);
        await store.update((s) => log(s, { event: "disconnect", mac: hold.mac, name: hold.name, by: hold.by, method: "disconnect" }));
        return { ok: true, disconnected: hold.mac };
      }
      const t = now();
      const record = { id: `${t.toString(36)}-${hold.mac.replace(/:/g, "").slice(-6).toLowerCase()}`, mac: hold.mac, name: hold.name, method: hold.method, ban: hold.ban, note: hold.note, by: hold.by, at: t, until: hold.ban ? null : t + hold.minutes * 60000 };
      const holds = await store.update((s) => {
        s.holds = s.holds.filter((h) => running(h, t) && !(h.mac === hold.mac && h.method === hold.method));
        s.holds.push(record);
        log(s, { event: hold.ban ? "ban" : "kick", mac: hold.mac, name: hold.name, by: hold.by, method: hold.method, minutes: hold.minutes });
        return s.holds;
      });
      await reconcile(ctx.exec, holds, t);
      return { ok: true, hold: record };
    });
    api.delete("/hold/:id", async ({ params, bad, who, live }) => {
      const holds = await store.update((s) => {
        const h = s.holds.find((x) => x.id === params.id);
        if (!h) throw bad("That pause has already ended.", 404);
        s.holds = s.holds.filter((x) => x.id !== params.id);
        log(s, { event: h.ban ? "unban" : "unkick", mac: h.mac, name: h.name, by: who.name, method: h.method });
        return s.holds;
      });
      await reconcile((await live()).exec, holds);
      return { ok: true };
    });
    // Run by the screen while it is open and by the app's timer: ends finished holds and puts
    // rules back after a router restart.
    api.post("/sync", async ({ live }) => {
      const t = now();
      const holds = await store.update((s) => {
        s.holds = s.holds.filter((h) => running(h, t));
        return s.holds;
      });
      return { ok: true, changed: await reconcile((await live()).exec, holds, t) };
    });
  },
  fakeRouter: {
    handlers: [
      (command, router) => {
        router.firewall ??= { chains: new Map(), hooks: new Set(), deauth: [], v6: [] };
        const fw = router.firewall;
        let m;
        if ((m = command.match(/^ip(6?)tables -N (MAR_\w+) 2>\/dev\/null$/))) {
          if (!m[1] && !fw.chains.has(m[2])) fw.chains.set(m[2], []);
          return { stdout: "", stderr: "", code: 0 };
        }
        if ((m = command.match(/^ip(6?)tables -C (FORWARD|INPUT) -j (MAR_\w+) 2>\/dev\/null \|\| ip6?tables -I \2 1 -j \3( 2>\/dev\/null)?$/))) {
          fw.hooks.add(`${m[1] ? "v6" : "v4"} ${m[2]} ${m[3]}`);
          return { stdout: "", stderr: "", code: 0 };
        }
        if ((m = command.match(/^iptables -S (MAR_\w+) 2>\/dev\/null$/))) return { stdout: (fw.chains.get(m[1]) ?? []).map((r) => `-A ${m[1]} ${r}\n`).join(""), stderr: "", code: 0 };
        if ((m = command.match(/^iptables -([AD]) (MAR_\w+) (.+)$/))) {
          const list = fw.chains.get(m[2]) ?? [];
          if (m[1] === "A") list.push(m[3]);
          else if (list.includes(m[3])) list.splice(list.indexOf(m[3]), 1);
          else return { stdout: "", stderr: "iptables: Bad rule (does a matching rule exist in that chain?).", code: 1 };
          fw.chains.set(m[2], list);
          return { stdout: "", stderr: "", code: 0 };
        }
        if ((m = command.match(/^ip6tables -([AD]) (MAR_\w+) (.+) 2>\/dev\/null$/))) {
          if (m[1] === "A") fw.v6.push(m[3]);
          else if (fw.v6.includes(m[3])) fw.v6.splice(fw.v6.indexOf(m[3]), 1);
          return { stdout: "", stderr: "", code: 0 };
        }
        if ((m = command.match(/^wl -i (\S+) deauthenticate ([0-9A-F:]{17}) 2>\/dev\/null$/))) {
          fw.deauth.push(m[2]);
          return { stdout: "", stderr: "", code: 0 };
        }
        return undefined;
      },
    ],
  },
};
