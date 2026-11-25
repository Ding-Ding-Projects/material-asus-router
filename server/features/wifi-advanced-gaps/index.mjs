// Wi-Fi advanced gaps: what Wi-Fi Pro does not cover. Smart Connect is shown
// (its steering rules are never editable), the 6 GHz and Wi-Fi 7 rules are shown
// as locks and a gate, and the router's operation mode (router, access point,
// repeater, media bridge, AiMesh node) can be changed as a destructive change:
// the router model typed, a held button, a restart, and a live timeline until the
// router answers and its settings read back.
//
// A setting name this router does not have is never written. The control says so
// ("This router does not have the setting ...") instead of guessing.
import { L, ON_OFF, parseRows } from "../kit.mjs";
import { fake } from "./fake.mjs";
import { MODES, availability, currentMode, writesFor } from "./modes.mjs";

const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const SIX = new Set(["4", "5"]);
const bandName = (nband, index) => ({ 2: "2.4 GHz", 1: "5 GHz", 4: "6 GHz", 5: "6 GHz" })[nband] ?? `Band ${index + 1}`;
const missing = (key) => L(`This router does not have the setting ${key}`, `呢部路由器冇 ${key} 呢個設定`);
const cap = (info, ...names) => names.some((n) => info.capabilities.includes(n));

// AiMesh nodes attached to this router, counted from its own list of nodes.
const meshNodes = (nvram) => Math.max(0, parseRows(nvram.get("cfg_clientlist") ?? "").length - 1);

function modeView(ctx) {
  const { nvram, info } = ctx;
  const current = currentMode(nvram);
  const nodes = meshNodes(nvram);
  return {
    value: nvram.get("sw_mode") ?? "",
    current,
    model: info.model,
    meshNodes: nodes,
    modes: Object.values(MODES).map((m) => ({ id: m.id, ...availability(m, nvram, info, current), warnings: warningsFor(m, nodes) })),
  };
}

function warningsFor(mode, nodes) {
  const out = [];
  if (mode.id !== "router" && nodes > 0) out.push({ en: `${nodes} AiMesh node${nodes === 1 ? "" : "s"} are attached. They lose their main router.`, yue: `有 ${nodes} 個 AiMesh 節點接駁緊，佢哋會冇咗主路由器。` });
  if (mode.id !== "router") out.push({ en: "The router stops sharing out addresses and its own address usually changes. Find it on your main router afterwards.", yue: "路由器會停止分配地址，而且自己嘅地址通常會變。完成後請喺主路由器搵返。" });
  return out;
}

export default {
  id: "wifi-advanced-gaps",

  catalog() {
    return [
      {
        id: "wifi-advanced-gaps.mlo", domain: "wifi-advanced-gaps", group: "wifi7", groupLabel: L("Wi-Fi 7", "Wi-Fi 7"),
        key: "wl_mlo_enable", control: "switch", values: ON_OFF, restart: "restart_wireless", risk: "network", requires: "wifi7",
        label: L("Multi-Link Operation (MLO)", "多連結操作（MLO）"),
        help: L("Lets a Wi-Fi 7 device use two bands at once for lower delay and steadier speed. Devices without Wi-Fi 7 are not affected. Only Wi-Fi 7 routers have it.", "等 Wi-Fi 7 裝置同時用兩個頻段，延遲低啲、速度穩啲。冇 Wi-Fi 7 嘅裝置唔受影響。淨係 Wi-Fi 7 路由器先有。"),
        meta: { note: L("The setting name is proved against the pretend router only. This screen keeps the switch off unless your router lists the setting itself.", "設定名稱只喺模擬路由器證實過。除非你部路由器自己列出呢個設定，否則呢個畫面會令開關保持停用。") },
      },
    ];
  },

  domainMeta: [{ id: "wifi-advanced-gaps", icon: "settings_input_antenna", label: L("Wi-Fi 7 and operation mode", "Wi-Fi 7 同運作模式"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: {
    "wifi-advanced-gaps": async (ctx) => {
      const { nvram, info } = ctx;
      const six = info.bands.filter((b) => SIX.has(String(b.nband)));
      const bsd = [...nvram.keys()].filter((k) => /^bsd_[a-z0-9_]+$/.test(k)).sort().slice(0, 16).map((k) => [k, String(nvram.get(k)).slice(0, 160)]);
      return {
        smartConnect: {
          supported: cap(info, "smart_connect"),
          triBand: info.bands.length >= 3,
          value: nvram.get("smart_connect_x") ?? "",
          bands: info.bands.map((b) => ({ index: b.index, band: bandName(b.nband, b.index), ssid: nvram.get(`wl${b.index}_ssid`) ?? "" })),
          details: bsd,
        },
        sixGhz: {
          present: six.length > 0,
          bands: six.map((b) => {
            const auth = nvram.get(`wl${b.index}_auth_mode_x`) ?? "";
            return { index: b.index, ssid: nvram.get(`wl${b.index}_ssid`) ?? "", auth, wpa3: auth === "sae", mfp: nvram.get(`wl${b.index}_mfp`) ?? "" };
          }),
        },
        wifi7: { capable: cap(info, "wifi7", "11be"), mlo: { key: "wl_mlo_enable", present: nvram.has("wl_mlo_enable"), value: nvram.get("wl_mlo_enable") ?? "" } },
        mode: modeView(ctx),
        entries: ctx.entries().map((e) => (e.key === "wl_mlo_enable" && !nvram.has(e.key) && !e.disabled ? { ...e, disabled: missing(e.key) } : e)),
      };
    },
  },

  routes(api) {
    // The mode as the router reports it right now. The screen polls this while the router restarts.
    api.get("/mode", async ({ live }) => {
      const ctx = await live();
      const nvram = await ctx.session.nvram({ fresh: true });
      return modeView({ ...ctx, nvram });
    });
  },

  actions: {
    // Changes the operation mode. A destructive action: the router model typed and a held button come first,
    // then the change goes through the change engine like any other, with a restart and the safety timer.
    "set-mode": {
      risk: "destructive",
      run: async ({ body, nvram, info, preview }) => {
        const mode = MODES[String(body.mode ?? "")];
        if (!mode) throw bad("Choose one of the five operation modes.");
        const book = await nvram();
        const current = currentMode(book);
        const can = availability(mode, book, info, current);
        if (!can.available) throw bad(can.reason.en, 409);
        return preview({ changes: writesFor(mode, book).map(([key, value]) => ({ key, value, risk: "destructive" })), restart: ["reboot"] });
      },
    },
  },

  fakeRouter: fake,
};
