// Dual WAN: two ways to reach the internet. The settings come from the server
// as typed controls; this screen adds a picture of both connections with their
// live state, a plain sentence about what the chosen mode will do, and a
// button that tests the connection-check target. Fields that do not apply to
// the chosen mode are hidden, and every edit waits in the pending-changes dock.
import { buildScreen, nowValue } from "./view.js";

const F = "dual-wan";
const DUAL = ["wan lan", "lan wan", "wan usb", "usb wan"];
const WORDS = {
  connected: ["Connected", "已連線", "good"], connecting: ["Connecting", "連線緊", "warn"], starting: ["Starting", "啟動緊", "warn"],
  disconnected: ["Not connected", "未連線", "bad"], off: ["Off", "關閉", ""], unknown: ["Unknown", "未知", ""],
};
const SECOND = { "wan lan": ["LAN port", "LAN 埠"], "lan wan": ["Internet port", "上網埠"], "wan usb": ["USB modem", "USB 數據機"], "usb wan": ["Internet port", "上網埠"] };
const FIRST = { "wan lan": ["Internet port", "上網埠"], "lan wan": ["LAN port", "LAN 埠"], "wan usb": ["Internet port", "上網埠"], "usb wan": ["USB modem", "USB 數據機"] };

export default {
  id: F,

  screens: [{
    id: F,
    group: { en: "Network", yue: "網絡" },
    icon: "alt_route",
    label: { en: "Dual WAN", yue: "雙 WAN" },
    render: (ctx) => buildScreen(ctx, {
      id: F,
      title: { en: "Dual WAN", yue: "雙 WAN" },
      lede: { en: "Use two internet lines: one as a backup, or both at once. Choose how the router decides a line is down.", yue: "用兩條上網線：一條做後備，或者兩條同時用。揀路由器點樣判斷條線斷咗。" },
      before: (data, ctx2) => [lines(ctx2, data), explain(ctx2, data)],
    }),
  }],

  commands: [{
    id: `${F}.probe`,
    icon: "network_check",
    label: { en: "Dual WAN: test the connection check target", yue: "雙 WAN：測試連線檢查對象" },
    keywords: ["wan", "failover", "ping", "check", "backup", "故障"],
    run: (ctx) => probe(ctx),
  }],
};

async function probe(ctx) {
  try {
    const result = await ctx.api.post(`/api/actions/${F}.probe`, {});
    ctx.toast(result.message, result.ok ? "good" : "bad");
  } catch (error) {
    ctx.toast(error.message, "bad");
  }
}

// Both lines side by side, each with its live state.
function lines(ctx, data) {
  const { h, icon, t, tt } = ctx;
  const mode = data.mode;
  const names = [FIRST[mode] ?? ["Internet port", "上網埠"], SECOND[mode] ?? ["Not used", "未使用"]];
  const box = (wan, index) => {
    const word = WORDS[wan.state] ?? WORDS.unknown;
    const off = index === 1 && !data.enabled;
    return h("div", { class: "wanbox", "data-state": off ? "off" : wan.state },
      h("div", { class: "t1" }, `${index === 0 ? t("Line 1", "第一條") : t("Line 2", "第二條")}: ${t(names[index][0], names[index][1])}`),
      h("span", { class: `tag ${off ? "" : word[2]}` }, off ? t("Not in use", "未使用") : t(word[0], word[1])),
      h("div", { class: "t2 mono" }, off ? "—" : `${wan.ip || "—"}  ${wan.gateway ? `→ ${wan.gateway}` : ""}`));
  };
  return h("section", { class: "card tone rise" },
    h("div", { class: "row" }, h("h2", { class: "h2 grow" }, icon("alt_route", "sm"), " ", t("Your internet lines", "你嘅上網線")),
      data.enabled ? h("button", { class: "btn t sm", onClick: () => probe(ctx) }, icon("network_check", "sm"), t("Test the check target", "測試檢查對象")) : null),
    h("div", { class: "wanlines" }, data.wans.map(box)));
}

// A sentence that follows the mode the person has chosen, pending edits included.
function explain(ctx, data) {
  const { h, t } = ctx;
  const get = (suffix) => data.entries.find((e) => e.id === `${F}.${suffix}`);
  const line = h("div", { class: "note", role: "status", "aria-live": "polite" });
  const draw = () => {
    const mode = nowValue(ctx, get("mode"));
    const policy = nowValue(ctx, get("policy"));
    if (!DUAL.includes(mode)) line.textContent = t("Dual WAN is off. The router uses its one internet connection.", "雙 WAN 關閉。路由器用緊一條上網連線。");
    else if (policy === "lb") line.textContent = t(`Both lines work at once. Connections are shared ${nowValue(ctx, get("ratio"))} between line 1 and line 2.`, `兩條線同時用。連線按 ${nowValue(ctx, get("ratio"))} 分配俾第一條同第二條。`);
    else if (policy === "fb") line.textContent = t("Line 1 is used. If it stops working, line 2 takes over, and the router goes back to line 1 as soon as it recovers.", "平時用第一條。斷咗就轉去第二條，第一條一恢復就即刻轉返。");
    else line.textContent = t("Line 1 is used. If it stops working, line 2 takes over and stays until line 2 fails too.", "平時用第一條。斷咗就轉去第二條，直至第二條都出事先會轉。");
  };
  draw();
  return { nodes: line, stop: ctx.bus.on("dock", draw) };
}
