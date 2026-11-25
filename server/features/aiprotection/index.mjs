// AiProtection: the router's traffic-inspection protections (malicious site
// blocking, two-way IPS, infected device prevention) and a router security
// scan with a real result for every item.
//
// The protections only exist on models whose rc_support lists "bwdpi" (the
// traffic-inspection engine). On other models the switches stay visible but
// disabled with the exact reason, and the scan still checks everything else.
import { L, ON_OFF } from "../kit.mjs";
import { runScan } from "./scan.mjs";

const GROUP = L("AiProtection", "AiProtection");

const protection = (id, key, label, help) => ({
  id: `aiprotection.${id}`,
  group: "protect",
  groupLabel: GROUP,
  key,
  control: "switch",
  values: ON_OFF,
  restart: "restart_wrs",
  risk: "low",
  requires: "bwdpi",
  label,
  help,
});

const ENTRIES = [
  protection("enable", "wrs_protect_enable", L("AiProtection", "AiProtection"), L("The master switch. The three protections below only work while this is on.", "總開關。下面三項保護要開咗呢個先會運作。")),
  protection("sites", "wrs_mals_enable", L("Malicious site blocking", "惡意網站封鎖"), L("Stops devices from opening websites known to spread malware or steal passwords.", "唔俾裝置打開已知會散播惡意程式或者偷密碼嘅網站。")),
  protection("ips", "wrs_vp_enable", L("Two-way IPS", "雙向 IPS"), L("Checks traffic in both directions and drops attacks that use known weaknesses.", "雙向檢查流量，丟棄利用已知漏洞嘅攻擊。")),
  protection("infected", "wrs_cc_enable", L("Infected device prevention and blocking", "受感染裝置防護同封鎖"), L("Blocks a device from talking to known attacker servers, and tells you when one tries.", "阻止裝置連去已知嘅攻擊者伺服器，嘗試連線時會通知你。")),
];

export default {
  id: "aiprotection",

  catalog: () => ENTRIES,

  domainMeta: [{ id: "aiprotection", icon: "gpp_good", label: L("AiProtection", "AiProtection"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    aiprotection: async (ctx) => {
      const supported = ctx.info.capabilities.includes("bwdpi");
      return {
        entries: ctx.entries(),
        supported,
        reason: supported ? null : L("This router model does not include the traffic-inspection engine (bwdpi), so the protections cannot be turned on. The security scan still works.", "呢個型號冇流量檢查引擎（bwdpi），所以開唔到保護。安全掃描仍然可以用。"),
      };
    },
  },

  routes(api) {
    // The router security scan. Read-only: it never changes anything.
    api.get("/scan", async ({ live }) => {
      const ctx = await live();
      const get = (key) => ctx.nvram.get(key) ?? "";
      const has = (key) => ctx.nvram.has(key);
      return { at: new Date().toISOString(), model: ctx.info.model, ...runScan({ get, has, bands: ctx.info.bands, bwdpi: ctx.info.capabilities.includes("bwdpi") }) };
    });
  },

  fakeRouter: {
    nvram: {
      wrs_protect_enable: "1",
      wrs_mals_enable: "1",
      wrs_vp_enable: "0",
      wrs_cc_enable: "1",
      // Settings the scan reads that the other screens do not own.
      telnetd_enable: "0",
      upnp_enable: "0",
      wps_enable: "0",
      http_enable: "2",
      http_username: "pat-router",
    },
  },
};
