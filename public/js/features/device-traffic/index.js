// Device traffic screen: a sortable live table, a total chart and the busiest
// devices. It reads /api/x/device-traffic/sample every few seconds while the
// screen is open and stops when it is left.
import { barChart, lineChart } from "./chart.js";
import { createLeaders } from "./leaders.js";

const label = { en: "Device traffic", yue: "裝置流量" };

export function speedText(bytesPerSecond, unit) {
  const value = unit === "bytes" ? bytesPerSecond / 1e6 : (bytesPerSecond * 8) / 1e6;
  const shown = value >= 100 ? Math.round(value) : value >= 10 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
  return `${shown} ${unit === "bytes" ? "MB/s" : "Mbit/s"}`;
}
export const sizeText = (bytes) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} kB`);

export function sortRows(rows, key, direction) {
  const sign = direction === "asc" ? 1 : -1;
  const value = (r) => (key === "name" ? r.name.toLowerCase() : r[key]);
  return [...rows].sort((a, b) => (value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0) * sign || a.ip.localeCompare(b.ip, undefined, { numeric: true }));
}

async function screen(ctx) {
  const { api, h, icon, t } = ctx;
  const config = await api.get("/api/domain/device-traffic");
  const page = ctx.page(label, { en: "Who is using the internet right now, worked out from the router's connection table.", yue: "而家邊個喺度用緊網絡，由路由器嘅連線表計出嚟。" });
  ctx.root.append(page);
  let view = null;
  let paused = false;
  let sort = { key: "down", direction: "desc" };
  let timer = null;
  let busy = false;
  const body = h("div", {});
  let tab = "live";
  try {
    if (localStorage.getItem("mar.traffic.tab") === "leaders") tab = "leaders";
  } catch {}
  const leaders = createLeaders(ctx, { unit: config.unit, speedText, sizeText });

  const heads = [["name", t("Device", "裝置")], ["down", t("Download", "下載")], ["up", t("Upload", "上傳")], ["flows", t("Connections", "連線數")], ["totalDown", t("Down total", "累計下載")], ["totalUp", t("Up total", "累計上傳")]];

  function draw() {
    // The "who is uploading or downloading the most" tab keeps its own page and updates it in place.
    if (tab === "leaders" && view) {
      if (body.firstChild !== leaders.el) ctx.clear(body).append(leaders.el);
      return void leaders.update(view);
    }
    ctx.clear(body);
    if (!view) return void body.append(h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("hourglass_top", "lg"), t("Reading the router…", "讀緊路由器…"))));
    if (view.accounting === false)
      body.append(h("div", { class: "card warn" }, h("div", { class: "k" }, t("Byte counting is off", "未開位元組計數")),
        h("div", { class: "t1" }, t("The router lists connections but does not count their bytes, so speeds cannot be worked out.", "路由器有列出連線，但冇計位元組，所以計唔到速度。")),
        h("div", { class: "t2" }, t("On Asuswrt-Merlin, turn on connection accounting (nf_conntrack_acct) in a firewall-start script, then reload this page.", "喺 Asuswrt-Merlin，可以喺 firewall-start script 開啟連線計數（nf_conntrack_acct），之後重新載入呢頁。"))));
    const visible = view.devices.filter((r) => !config.hideIdle || r.down + r.up > 0 || view.warm);
    const rows = sortRows(visible, sort.key, sort.direction);
    const top = [...view.devices].sort((a, b) => b.down + b.up - (a.down + a.up)).slice(0, config.top);
    body.append(
      h("div", { class: "grid2" },
        h("section", { class: "card rise" }, h("div", { class: "k" }, t("Now", "而家")),
          h("div", { class: "dt-now" }, h("div", {}, h("div", { class: "big" }, speedText(view.total.down, config.unit)), h("div", { class: "t2" }, t("download", "下載"))), h("div", {}, h("div", { class: "big" }, speedText(view.total.up, config.unit)), h("div", { class: "t2" }, t("upload", "上傳")))),
          view.history.length < 2 ? h("div", { class: "muted" }, t("The chart appears after a few readings.", "讀幾次之後就會出圖。"))
            : lineChart({ series: [{ name: t("Download", "下載"), cls: "s0", values: view.history.map((x) => (config.unit === "bytes" ? x.down / 1e6 : (x.down * 8) / 1e6)) }, { name: t("Upload", "上傳"), cls: "s1", values: view.history.map((x) => (config.unit === "bytes" ? x.up / 1e6 : (x.up * 8) / 1e6)) }], unit: config.unit === "bytes" ? " MB/s" : " Mbit/s", label: t("Total traffic", "總流量"), height: 180 })),
        h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Busiest devices", "最繁忙嘅裝置")),
          top.length ? barChart({ bars: top.map((r) => ({ label: r.name.slice(0, 18), value: config.unit === "bytes" ? (r.down + r.up) / 1e6 : ((r.down + r.up) * 8) / 1e6, cls: "s0", title: `${r.name}: ↓ ${speedText(r.down, config.unit)} ↑ ${speedText(r.up, config.unit)}` })), unit: config.unit === "bytes" ? " MB/s" : " Mbit/s", label: t("Busiest devices", "最繁忙嘅裝置") }) : h("div", { class: "muted" }, t("No device is using the internet.", "冇裝置而家用緊網絡。")))),
      rows.length
        ? h("div", { class: "tbl" }, h("table", {}, h("thead", {}, h("tr", {}, heads.map(([key, text]) =>
            h("th", { "aria-sort": sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none" },
              h("button", { class: "dt-sort", onClick: () => { sort = { key, direction: sort.key === key && sort.direction === "desc" ? "asc" : "desc" }; draw(); } }, text, sort.key === key ? icon(sort.direction === "asc" ? "arrow_upward" : "arrow_downward", "sm") : null))))),
          h("tbody", {}, rows.map((r) => h("tr", {}, h("td", {}, h("div", { class: "t1" }, r.name), h("div", { class: "t2 mono" }, `${r.ip}${r.mac ? ` · ${r.mac}` : ""}`)), h("td", {}, speedText(r.down, config.unit)), h("td", {}, speedText(r.up, config.unit)), h("td", {}, String(r.flows)), h("td", {}, sizeText(r.totalDown)), h("td", {}, sizeText(r.totalUp)))))))
        : h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("devices_off", "lg"), t("No device with traffic right now.", "而家冇裝置有流量。"))),
      h("div", { class: "muted" }, t("Totals are the bytes of connections the router is tracking now; connections that already ended are not counted.", "累計數字只係路由器而家追蹤緊嘅連線；已經結束嘅連線唔計。")));
  }

  async function poll() {
    if (busy || paused) return;
    busy = true;
    try {
      view = await api.get("/api/x/device-traffic/sample");
      draw();
    } catch (error) {
      if (!view) ctx.toast(error.message, "bad");
    }
    busy = false;
  }

  const noteText = () => t(`Updates every ${config.interval} s while this page is open.`, `呢頁開住嗰陣，每 ${config.interval} 秒更新。`);
  const note = h("span", { class: "muted" }, noteText());
  const toggle = h("button", { class: "btn t sm", onClick: () => { paused = !paused; ctx.clear(toggle).append(icon(paused ? "play_arrow" : "pause", "sm"), paused ? t("Resume", "繼續") : t("Pause", "暫停")); if (!paused) poll(); } }, icon("pause", "sm"), t("Pause", "暫停"));
  const tabs = [["live", t("Live table", "即時表格"), "table_rows"], ["leaders", t("Who uses the most", "邊個用最多"), "emoji_events"]];
  const tabButtons = tabs.map(([id, text, glyph], i) => h("button", {
    type: "button", role: "tab", id: `dt-tab-${id}`, class: "dt-tab", "aria-selected": String(id === tab), tabindex: id === tab ? "0" : "-1",
    onClick: () => select(id),
    onKeydown: (event) => {
      const next = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!next) return;
      event.preventDefault();
      const target = tabs[(i + next + tabs.length) % tabs.length][0];
      select(target);
      tabButtons.find((b) => b.id === `dt-tab-${target}`).focus();
    },
  }, icon(glyph, "sm"), text));
  function select(id) {
    tab = id;
    try { localStorage.setItem("mar.traffic.tab", id); } catch {}
    tabButtons.forEach((b) => { const on = b.id === `dt-tab-${id}`; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    body.setAttribute("aria-labelledby", `dt-tab-${id}`);
    ctx.clear(body);
    draw();
  }
  body.setAttribute("role", "tabpanel");
  body.setAttribute("aria-labelledby", `dt-tab-${tab}`);
  page.append(h("div", { class: "dt-tabs", role: "tablist", "aria-label": t("Device traffic views", "裝置流量檢視") }, tabButtons), h("div", { class: "chips" }, toggle, note), body, ...ctx.controls.appGroupCards("device-traffic", config.entries, async () => {
    Object.assign(config, await api.get("/api/domain/device-traffic"));
    note.textContent = noteText();
    clearInterval(timer);
    timer = setInterval(poll, config.interval * 1000);
    draw();
  }));
  draw();
  await poll();
  timer = setInterval(poll, config.interval * 1000);
  return () => clearInterval(timer);
}

export default {
  id: "device-traffic",
  screens: [{ id: "device-traffic", group: { en: "Monitor", yue: "監察" }, icon: "monitoring", label, render: screen }],
  settings: [{ id: "device-traffic", icon: "monitoring", label, async render(ctx) { const data = await ctx.api.get("/api/domain/device-traffic"); return ctx.controls.appGroupCards("device-traffic", data.entries); } }],
  commands: [{ id: "device-traffic.open", icon: "monitoring", label: { en: "See traffic per device", yue: "睇每部裝置嘅流量" }, keywords: "traffic bandwidth devices usage download upload 流量 裝置", run: (ctx) => ctx.navigate("device-traffic") }],
};
