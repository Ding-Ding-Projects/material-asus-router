// Latency monitor: live charts of latency and packet loss for the targets you
// choose, loss and latency statistics, the alert history, and an always-on
// overlay that turns new alerts into notifications in the bell.
import { lineChart } from "./chart.js";

const label = { en: "Latency monitor", yue: "延遲監察" };
const INTERVALS = [[10, "10 s"], [30, "30 s"], [60, "1 min"], [300, "5 min"], [900, "15 min"]];
const SEEN = "mar.latency-monitor.alert";
const COLORS = ["s0", "s1", "s2", "s3", "s4"];

const lastSeen = () => {
  try {
    return Number(localStorage.getItem(SEEN) ?? 0) || 0;
  } catch {
    return 0;
  }
};
const markSeen = (id) => {
  try {
    localStorage.setItem(SEEN, String(id));
  } catch {}
};

async function screen(ctx) {
  const { api, h, icon, t } = ctx;
  const page = ctx.page(label, { en: "The router pings the places you care about and the app keeps the history, so you can see when the connection got worse.", yue: "路由器 ping 你關心嘅地方，程式保存記錄，等你睇到連線幾時變差。" });
  ctx.root.append(page);
  let data = await api.get("/api/x/latency-monitor/status");
  let draft = null;
  let busy = false;
  const body = h("div", {});
  let timer = null;

  const status = (target) => {
    const s = data.stats[target.id];
    if (!s?.count) return ["muted", t("No data yet", "未有資料")];
    if (s.active) return ["bad", s.active === "down" ? t("Not answering", "無回應") : s.active === "lossy" ? t("Losing packets", "跌包") : t("Slow", "慢")];
    return ["good", t("Healthy", "正常")];
  };

  async function probe() {
    busy = true;
    draw();
    try {
      data = await api.post("/api/x/latency-monitor/probe");
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
    busy = false;
    draw();
  }

  async function saveConfig(config) {
    try {
      data = await api.put("/api/x/latency-monitor/config", config);
      draft = null;
      ctx.toast(t("Saved.", "已儲存。"));
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
    draw();
  }

  function editor() {
    const c = draft;
    const rows = h("div", {});
    const paintRows = () => ctx.clear(rows).append(...c.targets.map((target, i) => h("div", { class: "row" },
      h("input", { class: "field", value: target.label, maxlength: "32", "aria-label": t("Name", "名稱"), placeholder: t("Name", "名稱"), onInput: (e) => { target.label = e.target.value; } }),
      h("input", { class: "field", value: target.host, spellcheck: "false", "aria-label": t("Address or host name", "地址或主機名"), placeholder: "1.1.1.1", onInput: (e) => { target.host = e.target.value.trim(); } }),
      h("button", { class: "btn o icon", disabled: c.targets.length <= 1, title: t("Remove", "移除"), "aria-label": `${t("Remove", "移除")} ${target.label || target.host}`, onClick: () => { c.targets.splice(i, 1); paintRows(); } }, icon("close", "sm")))));
    paintRows();
    const range = (name, key, min, max, step, unit) => {
      const out = h("output", {}, `${c[key]}${unit}`);
      return h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t1" }, name)),
        h("div", { class: "slider" }, h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(c[key]), "aria-label": name, onInput: (e) => { c[key] = Number(e.target.value); out.textContent = `${c[key]}${unit}`; } }), out));
    };
    return h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Targets and alerts", "目標同警報")), rows,
      h("div", { class: "chips" }, h("button", { class: "btn t sm", disabled: c.targets.length >= 8, onClick: () => { c.targets.push({ id: `t${Date.now() % 900 + 100}`, host: "", label: "" }); paintRows(); } }, icon("add", "sm"), t("Add a target", "加目標"))),
      h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t1" }, t("Ping every", "每隔幾耐 ping"))), h("div", { class: "seg", role: "radiogroup", "aria-label": t("Ping every", "每隔幾耐 ping") }, INTERVALS.map(([s, text]) => h("button", { role: "radio", "aria-checked": String(c.intervalSec === s), class: c.intervalSec === s ? "on" : "", onClick: (e) => { c.intervalSec = s; e.target.parentElement.querySelectorAll("button").forEach((b) => { const on = b === e.target; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); }); } }, text)))),
      range(t("Alert when loss reaches", "損失達到就警報"), "lossAlertPct", 5, 100, 5, "%"),
      range(t("Alert when slower than", "慢過就警報"), "latencyAlertMs", 50, 1000, 50, " ms"),
      h("div", { class: "chips" }, h("button", { class: "btn f", onClick: () => saveConfig(c) }, icon("check", "sm"), t("Save", "儲存")), h("button", { class: "btn o", onClick: () => { draft = null; draw(); } }, t("Cancel", "取消"))));
  }

  function draw() {
    ctx.clear(body);
    const cfg = data.config;
    const times = (data.series[cfg.targets[0]?.id] ?? []).map((s) => s.at);
    const longest = Math.max(0, ...cfg.targets.map((t2) => (data.series[t2.id] ?? []).length));
    body.append(
      h("div", { class: "chips" },
        h("button", { class: `btn ${cfg.enabled ? "o" : "f"}`, disabled: !ctx.state.canWrite, onClick: () => saveConfig({ ...cfg, enabled: !cfg.enabled }) }, icon(cfg.enabled ? "pause" : "play_arrow", "sm"), cfg.enabled ? t("Stop monitoring", "停止監察") : t("Start monitoring", "開始監察")),
        h("button", { class: "btn t", disabled: busy || !ctx.state.canWrite, onClick: probe }, icon("network_ping", "sm"), busy ? t("Pinging…", "Ping 緊…") : t("Ping now", "即刻 ping")),
        h("button", { class: "btn o", disabled: !ctx.state.canWrite, onClick: () => { draft = structuredClone(cfg); draw(); } }, icon("tune", "sm"), t("Targets and alerts", "目標同警報")),
        h("span", { class: `pill ${cfg.enabled ? "p" : "t"}` }, icon(cfg.enabled ? "monitor_heart" : "pause_circle", "sm"), cfg.enabled ? t(`Every ${cfg.intervalSec} s`, `每 ${cfg.intervalSec} 秒`) : t("Monitoring is off", "監察已關"))),
      draft ? editor() : null,
      h("div", { class: "grid2" }, ...cfg.targets.map((target) => {
        const s = data.stats[target.id] ?? {};
        const [tone, text] = status(target);
        return h("section", { class: "card rise" }, h("div", { class: "k" }, target.label || target.host), h("div", { class: "t2 mono" }, target.host),
          h("div", { class: "big" }, s.avg === null || s.avg === undefined ? "—" : s.avg, h("small", {}, " ms")),
          h("span", { class: `tag ${tone}` }, text),
          h("div", { class: "t2" }, s.count ? t(`Loss ${s.loss}% · best ${s.min ?? "—"} ms · worst ${s.max ?? "—"} ms · jitter ${s.jitter ?? "—"} ms (last ${s.count} checks)`, `損失 ${s.loss}% · 最快 ${s.min ?? "—"} ms · 最慢 ${s.max ?? "—"} ms · 抖動 ${s.jitter ?? "—"} ms（最近 ${s.count} 次）`) : t("Press Ping now or Start monitoring.", "撳「即刻 ping」或者「開始監察」。")));
      })),
      longest >= 2 ? h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Latency", "延遲")),
        lineChart({ series: cfg.targets.map((target, i) => ({ name: target.label || target.host, cls: COLORS[i % COLORS.length], values: (data.series[target.id] ?? []).map((s) => (s.avg === null ? null : s.avg)) })), unit: " ms", label: t("Latency over time", "延遲變化") }),
        h("div", { class: "lm-legend" }, cfg.targets.map((target, i) => h("span", { class: "chip" }, h("i", { class: `lm-dot ${COLORS[i % COLORS.length]}` }), target.label || target.host))),
        h("div", { class: "muted" }, times.length ? t(`${new Date(times[0]).toLocaleTimeString()} to ${new Date(times.at(-1)).toLocaleTimeString()}. Dots on the bottom line mean no answer.`, `${new Date(times[0]).toLocaleTimeString()} 至 ${new Date(times.at(-1)).toLocaleTimeString()}。底線上面嘅點代表冇回應。`) : "")) : h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("monitoring", "lg"), t("The chart appears after two checks.", "兩次檢查之後就會出圖。"))),
      longest >= 2 ? h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Packet loss", "跌包")),
        lineChart({ series: cfg.targets.map((target, i) => ({ name: target.label || target.host, cls: COLORS[i % COLORS.length], values: (data.series[target.id] ?? []).map((s) => s.loss) })), unit: "%", fixedMax: 100, label: t("Packet loss over time", "跌包變化") })) : null,
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Alerts", "警報")),
        data.alerts.length ? data.alerts.map((a) => h("div", { class: "row" }, h("span", { class: `tag ${a.level === "good" ? "good" : "bad"}` }, icon(a.level === "good" ? "check_circle" : "warning", "sm"), a.kind === "recovered" ? t("Recovered", "已恢復") : a.kind === "down" ? t("Down", "無回應") : a.kind === "lossy" ? t("Loss", "跌包") : t("Slow", "慢")), h("div", { class: "grow" }, h("div", { class: "t1" }, t(a.text, a.textYue)), h("div", { class: "t2" }, new Date(a.at).toLocaleString()))))
          : h("div", { class: "empty" }, icon("notifications_none", "lg"), t("No alerts yet. An alert is raised after two bad checks in a row.", "未有警報。連續兩次檢查唔正常就會警報。")),
        h("div", { class: "chips" }, h("button", { class: "btn o sm", disabled: !ctx.state.canWrite, onClick: async () => { if (await ctx.confirmDialog({ title: t("Clear the history and alerts?", "清除記錄同警報？"), body: t("The charts and alert list start again.", "圖表同警報清單會重新開始。"), confirm: t("Clear", "清除"), danger: true })) { await api.del("/api/x/latency-monitor/history"); data = await api.get("/api/x/latency-monitor/status"); draw(); } } }, icon("delete", "sm"), t("Clear history", "清除記錄")))),
      h("div", { class: "muted" }, t("Monitoring runs while this app runs. After a restart it starts again the next time someone opens the app.", "監察喺程式運行期間進行。程式重啟之後，下次有人打開程式就會再開始。")));
  }

  page.append(body);
  draw();
  timer = setInterval(async () => {
    if (busy || draft) return;
    try {
      data = await api.get("/api/x/latency-monitor/status");
      draw();
    } catch {
      // The next check tries again.
    }
  }, 5000);
  return () => clearInterval(timer);
}

// Always on: asks for new alerts and shows each one in the notification bell and as a toast.
const overlay = {
  id: "latency-alerts",
  mount(ctx) {
    let seen = lastSeen();
    let first = true;
    const check = async () => {
      try {
        const out = await ctx.api.get(`/api/x/latency-monitor/alerts?since=${seen}`);
        // On the first look after sign-in, show only the newest alert, not a backlog.
        const fresh = first ? out.alerts.slice(-1) : out.alerts;
        first = false;
        for (const a of fresh) {
          const text = ctx.t(a.text, a.textYue);
          ctx.notifications.notice(a.level === "good" ? "good" : "bad", text);
          ctx.notifications.toast(text, a.level === "good" ? "good" : "bad");
        }
        seen = Math.max(seen, out.lastAlertId);
        markSeen(seen);
      } catch {
        // Signed out or the router is away: try again next time.
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  },
};

export default {
  id: "latency-monitor",
  screens: [{ id: "latency-monitor", group: { en: "Monitor", yue: "監察" }, icon: "network_ping", label, render: screen }],
  overlays: [overlay],
  commands: [{ id: "latency-monitor.open", icon: "network_ping", label: { en: "Watch latency and packet loss", yue: "監察延遲同跌包" }, keywords: "latency ping loss monitor jitter alert 延遲 跌包 監察", run: (ctx) => ctx.navigate("latency-monitor") }],
};
