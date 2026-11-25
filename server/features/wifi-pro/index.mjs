// Wi-Fi Pro: every radio setting that matters beyond a name and a password,
// band by band. Standards, OFDMA and MU-MIMO, beamforming, airtime fairness,
// roaming and steering, DFS and 160 MHz, beacon timing, multicast rate,
// protected management frames, RADIUS details, regulation and a schedule.
//
// The basic controls (radio, name, hiding, security mode, password, channel,
// width and power) already live in the stock Wi-Fi catalogue; this screen draws
// them beside the new ones so a person never has to hunt for a band's settings.
import { L } from "../kit.mjs";
import { bandDefaults, bandEntries, bandName } from "./entries.mjs";

const STOCK_ID = /^wl\d+\.(radio|ssid|hidden|auth|password|channel|width|power)$/;

const clientCount = async (exec, ifname) => {
  try {
    const out = await exec(`wl -i ${ifname} assoclist`);
    return out.code === 0 ? out.stdout.split("\n").filter((line) => /^assoclist /.test(line)).length : null;
  } catch {
    return null;
  }
};

export default {
  id: "wifi-pro",

  catalog(info) {
    const entries = info.bands.flatMap((band) => bandEntries(band.index, band.nband));
    entries.push({
      id: "wifi-pro.smart-connect", domain: "wifi-pro", group: "smart", groupLabel: L("Smart Connect", "Smart Connect"),
      key: "smart_connect_x", control: "select", restart: "restart_wireless", risk: "network", requires: "smart_connect",
      options: [
        ["0", L("Off", "關"), L("Each band keeps its own network name.", "每個頻段保留自己嘅網絡名稱。")],
        ["1", L("All bands share one name", "所有頻段共用一個名"), L("Devices are steered to the best band automatically.", "裝置會自動被引導去最好嘅頻段。")],
        ["2", L("5 GHz bands share one name", "5 GHz 頻段共用一個名"), L("Only the 5 GHz bands are joined; 2.4 GHz stays separate.", "淨係合併 5 GHz 頻段；2.4 GHz 保持獨立。")],
      ],
      label: L("Smart Connect band steering", "Smart Connect 頻段引導"),
      help: L("Joins the bands under one network name and moves each device to the band that suits it. Turn it off if a gadget keeps joining the slow band.", "將各頻段合併成一個網絡名，再將每部裝置引導去最適合嘅頻段。如果有裝置老係連上慢嘅頻段，就關咗佢。"),
      meta: { note: L("Smart Connect needs the router to support it. The steering rules behind it are not editable yet.", "路由器要支援先有 Smart Connect。背後嘅引導規則暫時未能編輯。") },
    });
    return entries;
  },

  domainMeta: [{ id: "wifi-pro", icon: "tune", label: L("Wi-Fi Pro", "Wi-Fi 進階"), group: { en: "Network", yue: "網絡" } }],
  domains: {
    "wifi-pro": async (ctx) => ({
      bands: await Promise.all(
        ctx.info.bands.map(async (band) => ({
          index: band.index,
          nband: band.nband,
          ifname: band.ifname,
          label: bandName(band.nband, band.index),
          region: ctx.nvram.get(`wl${band.index}_country_code`) ?? "",
          clients: await clientCount(ctx.exec, band.ifname),
          on: ctx.nvram.get(`wl${band.index}_radio`) === "1",
          ssid: ctx.nvram.get(`wl${band.index}_ssid`) ?? "",
        })),
      ),
      stock: ctx.entries("wifi").filter((entry) => STOCK_ID.test(entry.id)),
      entries: ctx.entries(),
      merlin: ctx.info.merlin,
    }),
  },

  routes(api) {
    // A quick, read-only summary of every band for the top of the screen.
    api.get("/bands", async ({ live }) => {
      const ctx = await live();
      return {
        bands: await Promise.all(ctx.info.bands.map(async (band) => ({ index: band.index, nband: band.nband, clients: await clientCount(ctx.exec, band.ifname) }))),
      };
    });
  },

  fakeRouter: {
    nvram: () => ({
      ...bandDefaults(0, "2"),
      ...bandDefaults(1, "1"),
      smart_connect_x: "0",
    }),
  },
};

