// The pretend router's half of Wi-Fi diagnostics: starting settings, and answers
// to the radio driver's commands. Counters grow with time at a steady speed per
// device, so a test can read twice and expect a speed close to the one set here.
const IF = "'?([a-z0-9.]+)'?";

// name, network, signal, link speeds (kbps), seconds joined, speeds in bytes per second, counters at the start.
const CLIENTS = {
  "AC:5A:F0:01:02:03": { ifname: "eth7", rssi: -48, tx: 1201000, rx: 960700, since: 93000, down: 4_200_000, up: 60_000, base: [81_000_000_000, 2_200_000_000] },
  "F0:18:98:AA:BB:01": { ifname: "eth7", rssi: -55, tx: 866700, rx: 780000, since: 5400, down: 800_000, up: 1_600_000, base: [4_000_000_000, 9_000_000_000] },
  "3C:22:FB:10:20:30": { ifname: "eth6", rssi: -67, tx: 144400, rx: 130000, since: 40000, down: 300_000, up: 20_000, base: [900_000_000, 60_000_000] },
  "DC:A6:32:44:55:66": { ifname: "eth6", rssi: -71, tx: 72200, rx: 65000, since: 700, down: 2_000, up: 1_000, base: [5_000_000, 3_000_000] },
};
const AIR = { eth6: { txop: 62, tx: 6, inbss: 9, obss: 18, nocat: 5, nopkt: 4, glitch: 220, knoise: -92 }, eth7: { txop: 85, tx: 4, inbss: 3, obss: 6, nocat: 1, nopkt: 2, glitch: 90, knoise: -95 } };
const NOISE = { eth6: -92, eth7: -95 };
const AFTER = { eth6: "11 (0x100b)", eth7: "149/80 (0xe19b)" };

// Per-router state, made on first use: when the counters started, who was disconnected and until when, and each band's new channel.
export const state = (router) => (router.wlDiag ??= { t0: Date.now(), kicked: new Map(), acs: {}, broken: new Set(), dfs: null, chanimOff: new Set() });

const joined = (router, ifname) => Object.entries(CLIENTS).filter(([mac, c]) => c.ifname === ifname && !((state(router).kicked.get(mac) ?? 0) > Date.now()));

export const fake = {
  nvram: { mar_wd_refresh: "5", mar_wd_weak: "-75", mar_wd_rank: "total", mar_wd_count: "8", mar_wd_guests: "1" },
  handlers: [
    (command, router) => {
      const st = state(router);
      let m;
      if ((m = command.match(new RegExp(`^wl -i ${IF} (assoclist|sta_info|phy_tempsense|noise|chanim_stats|dfs_status|channel|autochannel 1|deauthenticate [0-9A-F:]+)(?: ([0-9A-F:]+))?$`, "i")))) {
        const [, ifname, what, mac] = m;
        if (!NOISE[ifname]) return undefined;
        if (st.broken.has(ifname)) return { code: 1, stderr: "wl: Unsupported\n" };
        if (what === "assoclist") return { stdout: joined(router, ifname).map(([address]) => `assoclist ${address}\n`).join("") };
        if (what === "sta_info") {
          const entry = CLIENTS[String(mac).toUpperCase()];
          if (!entry || entry.ifname !== ifname || !joined(router, ifname).some(([address]) => address === String(mac).toUpperCase())) return { code: 1, stderr: "wl: STA not found\n" };
          const seconds = (Date.now() - st.t0) / 1000;
          const down = Math.floor(entry.base[0] + seconds * entry.down);
          const up = Math.floor(entry.base[1] + seconds * entry.up);
          return {
            stdout: `[VER 4] STA ${mac}:\n\t aid:1 \n\t idle ${entry.since % 7} seconds\n\t in network ${entry.since} seconds\n\t state: AUTHENTICATED ASSOCIATED AUTHORIZED\n\t tx total pkts: ${Math.floor(down / 1200)}\n\t tx total bytes: ${down}\n\t tx failures: ${entry.since % 5}\n\t rx data pkts: ${Math.floor(up / 900)}\n\t rx data bytes: ${up}\n\t smoothed rssi: ${entry.rssi}\n\t per antenna average rssi of rx data frames: ${entry.rssi} ${entry.rssi - 1} 0 0\n\t rate of last tx pkt: ${entry.tx} kbps - ${entry.rx} kbps\n`,
          };
        }
        if (what === "phy_tempsense") return { stdout: `${ifname === "eth6" ? "48 (0x30)" : "53 (0x35)"}\n` };
        if (what === "noise") return { stdout: `${NOISE[ifname]}\n` };
        if (what === "chanim_stats") {
          if (st.chanimOff.has(ifname)) return { code: 1, stderr: "wl: chanim not enabled\n" };
          const a = AIR[ifname];
          return { stdout: `chanspec tx   inbss   obss   nocat   nopkt   doze     txop     goodtx  badtx   glitch   badplcp  knoise  timestamp\n0x1006  ${a.tx}      ${a.inbss}      ${a.obss}      ${a.nocat}      ${a.nopkt}      0        ${a.txop}       9       1      ${a.glitch}      40       ${a.knoise}      1234567\n` };
        }
        if (what === "dfs_status") return ifname === "eth7" ? { stdout: st.dfs ?? "state IDLE time elapsed 183000 ms radar channel 0 channel switch 0\n" } : { code: 1, stderr: "wl: Not supported\n" };
        if (what === "channel") {
          const channel = st.acs[ifname] ? (ifname === "eth6" ? 11 : 149) : ifname === "eth6" ? 6 : 36;
          return { stdout: ["target channel " + channel, "current mac channel " + channel, ""].join("\n") };
        }
        if (what === "autochannel 1") {
          st.acs[ifname] = AFTER[ifname];
          return {};
        }
        if (/^deauthenticate/i.test(what)) {
          const address = what.split(" ")[1].toUpperCase();
          if (!CLIENTS[address]) return { code: 1, stderr: "wl: not associated\n" };
          st.kicked.set(address, Date.now() + 4000);
          (router.kickLog ??= []).push({ ifname, mac: address });
          return {};
        }
      }
      return undefined;
    },
  ],
};
