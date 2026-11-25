// DSL line status and settings, for the ASUS DSL models only (rc_support
// lists "dsl"). The status screen is read only and refreshes by itself; the
// settings change how the modem negotiates with the exchange and so retrain
// the line, which drops the connection for a minute or two. Every setting is
// therefore a destructive-tier change: it needs the router model typed, then
// goes through the change engine like any other (preview, safety net, undo).
//
// The key names follow what ASUS DSL firmware is known to use (dslx_...) but
// have not been checked on a real router; the screen also switches off any
// entry whose setting the router does not list.
import { L, ON_OFF } from "../kit.mjs";
import { parseXdsl, verdict } from "./parse.mjs";

const NOTE = L(
  "The setting name follows what ASUS DSL firmware is known to use but has not been checked on a real router yet. It works against the pretend router in tests.",
  "設定名稱跟返 ASUS DSL 韌體常見做法，但未喺真正路由器驗證過。喺測試用嘅模擬路由器上運作正常。",
);
const missing = (key) => ({ en: `This router does not have the setting ${key}`, yue: `呢部路由器冇「${key}」呢個設定` });

const base = { domain: "dsl", group: "line", groupLabel: L("How the modem talks to the exchange", "數據機同機房點樣溝通"), restart: "restart_dsl", risk: "destructive", requires: "dsl", meta: { note: NOTE } };
const MODULATION = [
  ["3", L("Automatic (recommended)", "自動（建議）"), L("The modem tries every standard and uses the best one your line supports.", "數據機會試晒所有標準，用你條線支援嘅最好一個。")],
  ["5", L("ADSL2+", "ADSL2+"), L("Fast ADSL, up to about 24 Mbit/s down.", "高速 ADSL，最高大約 24 Mbit/s 下載。")],
  ["4", L("ADSL2", "ADSL2"), L("The middle ADSL standard.", "中間嗰個 ADSL 標準。")],
  ["2", L("G.dmt (ADSL)", "G.dmt（ADSL）"), L("The first full-rate ADSL standard.", "最早嘅全速 ADSL 標準。")],
  ["1", L("G.lite", "G.lite"), L("Slow, light ADSL. Only for very old exchanges.", "慢嘅輕量 ADSL。只有好舊嘅機房先用。")],
  ["0", L("T1.413", "T1.413"), L("The oldest ADSL standard.", "最舊嘅 ADSL 標準。")],
];
const ANNEX = ["ANNEX A", "ANNEX A/L", "ANNEX A/M", "ANNEX B", "ANNEX J", "ANNEX M"].map((v) => [v, L(v.replace("ANNEX", "Annex"), v.replace("ANNEX", "附錄"))]);
const PROFILES = [
  ["0", L("Automatic", "自動")],
  ["1", L("Profile 17a", "規格 17a")],
  ["2", L("Profile 30a", "規格 30a")],
  ["3", L("Profile 35b (vectoring)", "規格 35b（向量）")],
];

export const dslEntries = () => [
  { ...base, id: "dsl.modulation", key: "dslx_modulation", control: "select", options: MODULATION, label: L("DSL standard", "DSL 標準"), help: L("Which DSL standard the modem uses. Keep Automatic unless your provider tells you otherwise. Changing it retrains the line.", "數據機用邊個 DSL 標準。除非供應商叫你轉，否則保持自動。更改會令線路重新訓練。") },
  { ...base, id: "dsl.annex", key: "dslx_annex", control: "select", options: ANNEX, label: L("Line type (annex)", "線路類型（附錄）"), help: L("Must match your provider's line type. A wrong choice means the line never comes up, so check with your provider first.", "要同供應商嘅線路類型一致。揀錯條線就唔會上到，所以先問清楚供應商。") },
  { ...base, id: "dsl.vdsl-profile", key: "dslx_vdsl_profile", control: "select", options: PROFILES, label: L("VDSL profile", "VDSL 規格"), help: L("The VDSL2 profile. Automatic works for nearly every line.", "VDSL2 規格。自動適用於差不多所有線路。") },
  { ...base, id: "dsl.snr-offset", key: "dslx_snrm_offset", control: "stepper", min: -100, max: 100, step: 5, unit: " (0.1 dB)", label: L("Noise margin offset", "雜訊餘量調整"), help: L("Moves the target noise margin up for a steadier line (but slower) or down for more speed (but more drop-outs). 0 is the normal setting.", "調高目標雜訊餘量會更穩定（但較慢），調低會更快（但較易斷線）。0 係正常設定。") },
  { ...base, id: "dsl.sra", key: "dslx_sra", control: "switch", values: ON_OFF, label: L("Seamless rate adaptation", "無縫速率調整"), help: L("Lets the line change speed on its own when the noise changes, without dropping the connection.", "雜訊改變時線路自己調整速度，唔使斷線。") },
  { ...base, id: "dsl.bitswap", key: "dslx_bitswap", control: "switch", values: ON_OFF, label: L("Bit swapping", "位元交換"), help: L("Lets the modem move data between frequencies as the noise changes. Keep it on.", "雜訊改變時數據機喺頻率之間搬數據。建議保持開。") },
  { ...base, id: "dsl.ginp", key: "dslx_ginp", control: "switch", values: ON_OFF, label: L("Retransmission (G.INP)", "重傳（G.INP）"), help: L("Resends damaged data instead of dropping it, which helps on noisy lines. Both ends must support it.", "損壞嘅數據會重傳而唔係丟棄，對雜訊多嘅線路有幫助。兩邊都要支援。") },
];

export const defaults = () => ({ dslx_modulation: "3", dslx_annex: "ANNEX A", dslx_vdsl_profile: "0", dslx_snrm_offset: "0", dslx_sra: "1", dslx_bitswap: "1", dslx_ginp: "1" });

// How long the pretend line stays down after a retrain.
const DOWN_MS = 600;
const TRAIN_MS = 600;
const retrains = new WeakMap();

function xdslText(router) {
  const count = router.services.filter((s) => s === "restart_dsl").length;
  let state = retrains.get(router);
  if (!state) retrains.set(router, (state = { count: 0, at: 0 }));
  if (count !== state.count) Object.assign(state, { count, at: Date.now() });
  const since = Date.now() - state.at;
  const phase = state.at && since < DOWN_MS ? "Idle" : state.at && since < DOWN_MS + TRAIN_MS ? "G.994 Training" : "Showtime";
  const up = phase === "Showtime";
  const mode = router.nvram.dslx_annex === "ANNEX B" ? "ADSL2+ Annex B" : "ADSL2+ Annex A";
  return [
    "xdslctl: ADSL driver and PHY status",
    `Status: ${phase === "Idle" ? "Idle" : up ? "Showtime" : "Handshake"}`,
    "Last Retrain Reason:\t0",
    "Max:\tUpstream rate = 1176 Kbps, Downstream rate = 15088 Kbps",
    up ? "Bearer:\t0, Upstream rate = 1020 Kbps, Downstream rate = 9964 Kbps" : "Bearer:\t0, Upstream rate = 0 Kbps, Downstream rate = 0 Kbps",
    "",
    "Link Power State:\tL0",
    `Mode:\t\t\t${mode}`,
    "Line Status:\t\tNo Defect",
    `Training Status:\t${phase}`,
    "\t\tDown\t\tUp",
    up ? "SNR (dB):\t 7.8\t\t 6.0" : "SNR (dB):\t 0.0\t\t 0.0",
    up ? "Attn(dB):\t 30.5\t\t 17.0" : "Attn(dB):\t 0.0\t\t 0.0",
    up ? "Pwr(dBm):\t 12.2\t\t 12.3" : "Pwr(dBm):\t 0.0\t\t 0.0",
    "",
  ].join("\n");
}

export default {
  id: "dsl",

  catalog: dslEntries,

  domainMeta: [{ id: "dsl", icon: "cable", label: L("DSL line", "DSL 線路"), group: { en: "Monitor", yue: "監察" }, requires: "dsl", live: true }],
  domains: {
    dsl: async (ctx) => {
      const entries = ctx.entries().map((e) => (e.disabled || ctx.nvram.has(e.key) ? e : { ...e, disabled: missing(e.key) }));
      const supported = ctx.info.capabilities.includes("dsl");
      let line = null;
      if (supported) {
        const r = await ctx.exec("xdslctl info --show").catch(() => null);
        if (r && r.code === 0) line = parseXdsl(r.stdout);
      }
      return { entries, supported, model: ctx.info.model, line, verdict: line ? verdict(line) : null };
    },
  },

  routes(api) {
    // The line right now, for the screen to poll while it retrains.
    api.get("/status", async ({ live, bad }) => {
      const { exec, info } = await live();
      if (!info.capabilities.includes("dsl")) throw bad("This router has no DSL modem.", 404);
      const r = await exec("xdslctl info --show");
      if (r.code !== 0) throw bad("The router did not report the DSL line.", 502);
      const line = parseXdsl(r.stdout);
      return { at: new Date().toISOString(), line, verdict: verdict(line) };
    });

    // Previews DSL setting changes, but only once the router model has been typed exactly.
    api.post("/change", async ({ body, live, preview, bad }) => {
      const { info } = await live();
      if (!info.capabilities.includes("dsl")) throw bad("This router has no DSL modem.", 404);
      if (body.confirm !== info.model) throw bad(`Type the router model, ${info.model}, exactly to confirm.`, 403);
      const changes = Array.isArray(body.changes) ? body.changes : [];
      if (!changes.length || changes.some((c) => !String(c?.id ?? "").startsWith("dsl."))) throw bad("Send one or more DSL settings.", 400);
      return preview({ changes });
    });
  },

  actions: {
    // Ask the modem to retrain the line. Typed confirmation of the model and the hold button.
    retrain: {
      risk: "destructive",
      async run(ctx) {
        const r = await ctx.exec("service restart_dsl");
        return { ok: r.code === 0, at: new Date().toISOString() };
      },
    },
  },

  fakeRouter: {
    nvram: defaults(),
    handlers: [(command, router) => (command === "xdslctl info --show" ? { stdout: xdslText(router) } : undefined)],
  },
};
