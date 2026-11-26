// "My Wi-Fi is slow": one screen that reads the router, runs every check in
// checks.mjs and lists what is slowing Wi-Fi down, with a fix for each one
// that can be fixed on the router. This feature never writes anything itself:
// the browser puts each fix in the pending-changes dock, and the change engine
// previews, confirms, applies, verifies and can undo it like any other change.
import { L, parseRows } from "../kit.mjs";
import { ALWAYS, LIMITS, diagnose } from "./checks.mjs";
import { readRouter } from "./read.mjs";

// The setting as a fix can use it, or the reason it cannot.
function usableFor(ctx) {
  return (id) => {
    if (String(id).startsWith("action:")) return null; // the action checks its own conditions when it runs
    const entry = ctx.catalog.find((e) => e.id === id);
    if (!entry) return L("This router does not have that setting.", "呢部路由器冇呢個設定。");
    if (entry.disabled) return entry.disabled;
    if (entry.readOnly) return L("This setting is read only.", "呢個設定淨係可以睇。");
    if (!ctx.nvram.has(entry.key)) return L(`This router does not have the setting ${entry.key}`, `呢部路由器冇「${entry.key}」呢個設定`);
    return null;
  };
}

export async function check(ctx) {
  const reading = await readRouter(ctx, { parseRows });
  const findings = diagnose({ reading, get: (key) => ctx.nvram.get(key), usable: usableFor(ctx) });
  return {
    checkedAt: new Date().toISOString(),
    bands: reading.bands.map((b) => ({
      index: b.index,
      band: b.band,
      ssid: b.ssid,
      on: b.on,
      busy: b.air?.busy ?? null,
      otherNetworks: b.air?.otherNetworks ?? null,
      noise: b.noise,
      temperature: b.temperature,
      devices: b.devices.length,
      weak: b.devices.filter((d) => d.rssi !== null && d.rssi < LIMITS.weak).length,
    })),
    uptimeDays: reading.uptimeDays,
    findings,
    counts: { problems: findings.filter((f) => f.kind === "problem").length, tips: findings.filter((f) => f.kind === "tip").length, fixable: findings.filter((f) => f.fix).length },
    always: ALWAYS,
  };
}

export default {
  id: "slow-wifi",
  domainMeta: [{ id: "slow-wifi", icon: "signal_wifi_bad", label: L("My Wi-Fi is slow", "我部 Wi-Fi 好慢"), group: { en: "Network", yue: "網絡" }, live: true }],
  domains: { "slow-wifi": check },
};
