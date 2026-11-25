// Logs, network tools and scheduled jobs: read-mostly screens.
import { api, clear, copyText, h, icon, t, toast, tt } from "../core.js";
import { app } from "../dock.js";
import { header, loadDomain, tableOf, unsupported } from "./common.js";

export async function logs(root) {
  let lines = [];
  let query = "";
  let level = "all";
  let follow = true;
  const list = h("div", {});
  const count = h("span", { class: "muted" });
  const paint = () => {
    const q = query.toLowerCase();
    const shown = lines.filter((l) => (level === "all" || l.level === level) && (!q || l.raw.toLowerCase().includes(q)));
    count.textContent = t(`${shown.length} of ${lines.length} lines`, `${lines.length} 行入面有 ${shown.length} 行`);
    clear(list).append(...(shown.length ? shown.map((l) => h("div", { class: `logline ${l.level}` }, h("span", { class: "time" }, l.time), h("span", {}, l.message))) : [h("div", { class: "empty" }, icon("receipt_long", "lg"), t("No log lines match.", "冇符合嘅記錄。"))]));
  };
  const load = async () => {
    try {
      lines = (await api.get("/api/logs?lines=300")).lines;
      paint();
    } catch (e) {
      toast(e.message, "bad");
    }
  };
  await load();
  root.append(h("div", { class: "page" }, header("logs"),
    h("section", { class: "card" },
      h("div", { class: "row" },
        h("input", { class: "field", type: "search", placeholder: t("Filter the log", "篩選記錄"), "aria-label": t("Filter the log", "篩選記錄"), onInput: (e) => { query = e.target.value; paint(); } }),
        h("div", { class: "seg", role: "group" }, [["all", "All", "全部"], ["warn", "Problems", "問題"], ["info", "Normal", "一般"]].map(([id, en, yue]) => h("button", { class: level === id ? "on" : "", "aria-pressed": String(level === id), onClick: (e) => { level = id; e.currentTarget.parentNode.querySelectorAll("button").forEach((b) => b.classList.remove("on")); e.currentTarget.classList.add("on"); paint(); } }, t(en, yue)))),
        h("button", { class: "btn t sm", onClick: load }, icon("refresh", "sm"), t("Refresh", "重新整理")),
        h("button", { class: "btn t sm", onClick: () => copyText(lines.map((l) => l.raw).join("\n")) }, icon("content_copy", "sm"), t("Copy", "複製")),
        count),
      list)));
  const timer = setInterval(() => follow && !document.hidden && load(), 5000);
  return () => (follow = false, clearInterval(timer));
}

export async function tools(root) {
  const devices = (await api.get("/api/domain/devices")).devices;
  const out = h("pre", { class: "out", "aria-live": "polite", hidden: true });
  let host = "example.com";
  let busy = false;
  const run = async (name, extra = {}) => {
    if (busy) return;
    busy = true;
    out.hidden = false;
    out.textContent = t("Running…", "運行緊…");
    try {
      const res = await api.post(`/api/actions/${name}`, { host, ...extra });
      out.textContent = res.output?.trim() || (res.ok ? t("Done.", "完成。") : t("The command failed.", "指令失敗。"));
    } catch (e) {
      out.textContent = e.message;
    } finally {
      busy = false;
    }
  };
  root.append(h("div", { class: "page" }, header("tools"),
    h("section", { class: "card" },
      h("h2", { class: "h2" }, t("Network tools", "網絡工具")),
      h("div", { class: "row" },
        h("input", { class: "field", value: host, placeholder: "example.com", "aria-label": t("Host name or address", "主機名稱或地址"), onInput: (e) => (host = e.target.value.trim()) }),
        h("button", { class: "btn f sm", disabled: !app.canWrite, onClick: () => run("ping", { count: 4 }) }, icon("network_ping", "sm"), "Ping"),
        h("button", { class: "btn t sm", disabled: !app.canWrite, onClick: () => run("traceroute") }, icon("route", "sm"), t("Trace route", "追蹤路徑")),
        h("button", { class: "btn t sm", disabled: !app.canWrite, onClick: () => run("nslookup") }, icon("dns", "sm"), t("Look up name", "查域名"))),
      out),
    h("section", { class: "card" },
      h("h2", { class: "h2" }, t("Wake a device", "喚醒裝置")),
      h("div", { class: "muted" }, t("Sends a wake-on-LAN signal from the router. The device must have wake-on-LAN turned on.", "由路由器發出網絡喚醒訊號。裝置要開咗網絡喚醒先得。")),
      devices.filter((d) => !d.online).length ? null : h("div", { class: "muted" }, t("Every known device is online.", "所有已知裝置都喺線。")),
      devices.map((d) => h("div", { class: "row" }, h("span", { class: `dot ${d.online ? "" : "off"}` }), h("div", { class: "grow" }, h("div", { class: "t1" }, d.name), h("div", { class: "t2 mono" }, d.mac)),
        h("button", { class: "btn t sm", disabled: !app.canWrite, onClick: async () => { try { await api.post("/api/actions/wake", { mac: d.mac }); toast(t("Wake signal sent.", "已發出喚醒訊號。")); } catch (e) { toast(e.message, "bad"); } } }, icon("power_settings_new", "sm"), t("Wake", "喚醒")))))));
}

export async function jobs(root) {
  const data = await loadDomain("jobs");
  root.append(h("div", { class: "page" }, header("jobs"),
    !data.supported ? unsupported("jobs", data.reason)
      : data.jobs.length
        ? tableOf([t("When (minute hour day month weekday)", "幾時（分 時 日 月 星期）"), t("What runs", "運行嘅嘢"), "ID"], data.jobs.map((j) => h("tr", {}, h("td", { class: "mono" }, j.schedule), h("td", { class: "mono" }, j.command), h("td", { class: "mono" }, j.id || "—"))))
        : h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("schedule", "lg"), t("No scheduled jobs.", "冇排程工作。")))));
}
