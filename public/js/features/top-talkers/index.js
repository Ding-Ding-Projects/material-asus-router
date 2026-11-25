// "Who's using the most": two live leaderboards (downloading and uploading) with a live chart per device and
// today and this-week totals. It reads /api/x/top-talkers/sample every few seconds while the page is open.
// Only byte counters per device are used: no websites, no apps, nothing anyone visited.
import { meterBar, sparkline } from "./spark.js";

const label = { en: "Who's using the most", yue: "邊個用得最多" };

export const speedText = (bytesPerSecond, unit = "bits") => {
  const value = unit === "bytes" ? bytesPerSecond / 1e6 : (bytesPerSecond * 8) / 1e6;
  const shown = value >= 100 ? Math.round(value) : value >= 10 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
  return `${shown} ${unit === "bytes" ? "MB/s" : "Mbit/s"}`;
};
export const sizeText = (bytes) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : bytes >= 1e3 ? `${Math.round(bytes / 1e3)} kB` : `${Math.round(bytes)} B`);

// The household member preset is "Your brother"; any other owner name is shown as it was written.
export function ownerLabel(owner) {
  const text = String(owner ?? "").trim();
  if (!text) return null;
  return /^(your )?brother$/i.test(text) ? { en: "Your brother", yue: "你兄弟" } : { en: text, yue: text };
}

// The number a device is ranked by for one direction ("down" or "up") and one ranking ("rate", "today", "week").
export const metricOf = (device, kind, rank) => (rank === "rate" ? device[kind] : device[`${rank}${kind === "down" ? "Down" : "Up"}`]);

export function rankDevices(devices, kind, rank, { hideIdle = true, shown = 8 } = {}) {
  return [...devices]
    .filter((d) => !hideIdle || metricOf(d, kind, rank) > 0)
    .sort((a, b) => metricOf(b, kind, rank) - metricOf(a, kind, rank) || a.ip.localeCompare(b.ip, undefined, { numeric: true }))
    .slice(0, shown);
}

const RANKS = [["rate", { en: "Speed now", yue: "而家速度" }], ["today", { en: "Today", yue: "今日" }], ["week", { en: "This week", yue: "本星期" }]];
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

async function screen(ctx) {
  const { api, h, icon, t } = ctx;
  const config = await api.get("/api/domain/top-talkers");
  const page = ctx.page(label, { en: "A live leaderboard of who is downloading and uploading the most, from byte counts per device only.", yue: "即時排行榜，睇邊個下載同上傳得最多，只用每部裝置嘅位元組數。" });
  ctx.root.append(page);
  const state = { view: null, rank: config.rank, unit: "bits", paused: false, busy: false, open: new Set(), first: true, tops: { down: new Map(), up: new Map() } };
  const body = h("div", { class: "tt-body" });
  const pauseBtn = h("button", { class: "btn t sm", onClick: () => { state.paused = !state.paused; ctx.clear(pauseBtn).append(icon(state.paused ? "play_arrow" : "pause", "sm"), state.paused ? t("Resume", "繼續") : t("Pause", "暫停")); if (!state.paused) poll(); } }, icon("pause", "sm"), t("Pause", "暫停"));
  const seg = (items, current, pick, name) => h("div", { class: "seg", role: "group", "aria-label": name }, items.map(([id, text]) => h("button", { class: id === current ? "on" : "", "aria-pressed": id === current ? "true" : "false", onClick: () => { pick(id); drawControls(); draw(); } }, ctx.tt(text))));
  const controls = h("div", { class: "chips tt-controls" });
  function drawControls() {
    ctx.clear(controls);
    controls.append(
      seg(RANKS, state.rank, (id) => (state.rank = id), t("Rank by", "排名方式")),
      seg([["bits", { en: "Mbit/s", yue: "Mbit/s" }], ["bytes", { en: "MB/s", yue: "MB/s" }]], state.unit, (id) => (state.unit = id), t("Speed unit", "速度單位")),
      pauseBtn,
      h("span", { class: "muted" }, h("span", { class: "dot live", "aria-hidden": "true" }), " ", t(`Updates every ${config.interval} s while this page is open.`, `呢頁開住嗰陣，每 ${config.interval} 秒更新。`)));
  }

  const value = (d, kind) => (state.rank === "rate" ? speedText(d[kind], state.unit) : sizeText(metricOf(d, kind, state.rank)));
  const rowFor = (d, kind, index, top) => {
    const other = kind === "down" ? "up" : "down";
    const open = state.open.has(`${kind}:${d.ip}`);
    const owner = ownerLabel(d.owner);
    const metric = metricOf(d, kind, state.rank);
    const percent = top > 0 ? (metric / top) * 100 : 0;
    const medal = index < 3 ? ["gold", "silver", "bronze"][index] : "";
    const unitText = (v) => (state.unit === "bytes" ? `${Math.round((v / 1e6) * 100) / 100} MB/s` : `${Math.round(((v * 8) / 1e6) * 100) / 100} Mbit/s`);
    const row = h("li", { class: `tt-row ${state.first ? "rise" : ""} ${medal}`, "data-ip": d.ip },
      h("button", { class: "tt-main", "aria-expanded": open ? "true" : "false", "aria-label": t(`${d.name}, rank ${index + 1}, ${value(d, kind)}. Show the live chart.`, `${d.name}，第 ${index + 1} 名，${value(d, kind)}。顯示即時圖表。`), onClick: () => { const key = `${kind}:${d.ip}`; state.open.has(key) ? state.open.delete(key) : state.open.add(key); draw(); } },
        h("span", { class: "tt-rank" }, index < 3 ? icon("emoji_events", "sm") : null, String(index + 1)),
        h("span", { class: "tt-who" }, h("span", { class: "t1" }, d.name), h("span", { class: "t2 mono" }, d.ip), owner ? h("span", { class: "chip tt-owner" }, icon("person", "sm"), ctx.tt(owner)) : null),
        h("span", { class: "tt-value" }, h("span", { class: "big" }, value(d, kind)), meterBar(percent, kind)),
        sparkline({ series: [{ values: d.history.map((x) => x[kind]), cls: kind }], label: t(`Live ${kind === "down" ? "download" : "upload"} of ${d.name}`, `${d.name} 嘅即時${kind === "down" ? "下載" : "上傳"}`) }),
        icon(open ? "expand_less" : "expand_more", "sm")),
      h("div", { class: "tt-sub t2" },
        t(`Now ${kind === "down" ? "↓" : "↑"} ${speedText(d[kind], state.unit)}, ${other === "down" ? "↓" : "↑"} ${speedText(d[other], state.unit)}`, `而家 ${kind === "down" ? "↓" : "↑"} ${speedText(d[kind], state.unit)}，${other === "down" ? "↓" : "↑"} ${speedText(d[other], state.unit)}`),
        " · ", t(`Today ${sizeText(kind === "down" ? d.todayDown : d.todayUp)}`, `今日 ${sizeText(kind === "down" ? d.todayDown : d.todayUp)}`),
        " · ", t(`This week ${sizeText(kind === "down" ? d.weekDown : d.weekUp)}`, `本星期 ${sizeText(kind === "down" ? d.weekDown : d.weekUp)}`)),
      open ? h("div", { class: "tt-detail" },
        d.history.length < 2 ? h("div", { class: "muted" }, t("The chart appears after a few readings.", "讀幾次之後就會出圖。"))
          : sparkline({ series: [{ values: d.history.map((x) => x.down), cls: "down" }, { values: d.history.map((x) => x.up), cls: "up" }], width: 640, height: 150, grid: true, unitText, label: t(`Live download and upload of ${d.name}`, `${d.name} 嘅即時下載同上傳`) }),
        h("div", { class: "tt-legend" }, h("span", { class: "tt-key down" }), t("Download", "下載"), h("span", { class: "tt-key up" }), t("Upload", "上傳"), h("span", { class: "muted" }, d.mac ? ` · ${d.mac}` : ""))) : null);
    return row;
  };

  function leaderboard(kind, title, iconName) {
    const ranked = rankDevices(state.view.devices, kind, state.rank, { hideIdle: config.hideIdle && !state.view.warm, shown: config.shown });
    const top = ranked.length ? metricOf(ranked[0], kind, state.rank) : 0;
    const before = state.tops[kind];
    const list = h("ol", { class: "tt-list" }, ranked.map((d, i) => rowFor(d, kind, i, top)));
    const section = h("section", { class: `card tt-board ${state.first ? "rise" : ""}` }, h("div", { class: "tt-head" }, icon(iconName, "lg"), h("h2", { class: "h2" }, title)),
      ranked.length ? list : h("div", { class: "empty" }, icon("devices_off", "lg"), t("No device has any traffic in this ranking.", "呢個排名入面冇裝置有流量。")));
    // Rows glide to their new place when the order changes (a spring, skipped for reduced motion).
    queueMicrotask(() => {
      const after = new Map();
      for (const row of list.children) {
        const ip = row.getAttribute("data-ip");
        const top = row.getBoundingClientRect().top;
        after.set(ip, top);
        const was = before.get(ip);
        if (!reduced() && was !== undefined && Math.abs(was - top) > 2 && row.animate) row.animate([{ transform: `translateY(${was - top}px)` }, { transform: "translateY(0)" }], { duration: 520, easing: "cubic-bezier(.2,.9,.25,1.15)" });
      }
      state.tops[kind] = after;
    });
    return section;
  }

  function draw() {
    ctx.clear(body);
    const v = state.view;
    if (!v) return void body.append(h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("hourglass_top", "lg"), t("Reading the router…", "讀緊路由器…"))));
    if (v.accounting === false)
      body.append(h("div", { class: "card warn" }, h("div", { class: "k" }, t("Byte counting is off", "未開位元組計數")),
        h("div", { class: "t1" }, t("The router lists connections but does not count their bytes, so no ranking can be worked out.", "路由器有列出連線，但冇計位元組，所以排唔到名。")),
        h("div", { class: "t2" }, t("On Asuswrt-Merlin, turn on connection accounting (nf_conntrack_acct) in a firewall-start script, then reload this page.", "喺 Asuswrt-Merlin，可以喺 firewall-start script 開啟連線計數（nf_conntrack_acct），之後重新載入呢頁。"))));
    body.append(
      h("section", { class: `card tt-total ${state.first ? "rise" : ""}` }, h("div", { class: "k" }, t("Whole network", "成個網絡")),
        h("div", { class: "tt-totals" },
          h("div", {}, h("div", { class: "big" }, `↓ ${speedText(v.total.down, state.unit)}`), h("div", { class: "t2" }, t("download now", "而家下載"))),
          h("div", {}, h("div", { class: "big" }, `↑ ${speedText(v.total.up, state.unit)}`), h("div", { class: "t2" }, t("upload now", "而家上傳"))),
          h("div", {}, h("div", { class: "t1" }, `↓ ${sizeText(v.total.todayDown)}  ↑ ${sizeText(v.total.todayUp)}`), h("div", { class: "t2" }, t("today", "今日"))),
          h("div", {}, h("div", { class: "t1" }, `↓ ${sizeText(v.total.weekDown)}  ↑ ${sizeText(v.total.weekUp)}`), h("div", { class: "t2" }, t("this week", "本星期")))),
        h("div", { class: "t2" }, v.since ? t(`Counting since ${new Date(v.since).toLocaleString([], { hour12: false })}. Totals start again when the app restarts.`, `由 ${new Date(v.since).toLocaleString([], { hour12: false })} 開始計。程式重新啟動之後會重頭計。`) : "")),
      h("div", { class: "tt-boards" }, leaderboard("down", t("Downloading the most", "下載最多"), "south"), leaderboard("up", t("Uploading the most", "上傳最多"), "north")),
      h("div", { class: "muted" }, t("Only the byte count of each device's connections is used. Nothing about websites, apps or what anyone visited is read or kept.", "只用每部裝置連線嘅位元組數。唔會讀取或者記錄網站、應用程式或者任何人瀏覽過啲乜。")));
    state.first = false;
  }

  async function poll() {
    if (state.busy || state.paused) return;
    state.busy = true;
    try {
      state.view = await api.get("/api/x/top-talkers/sample");
      draw();
    } catch (error) {
      if (!state.view) ctx.toast(error.message, "bad");
    }
    state.busy = false;
  }

  page.append(controls, body, ...ctx.controls.settingGroups(config.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)));
  drawControls();
  draw();
  await poll();
  const timer = setInterval(poll, config.interval * 1000);
  return () => clearInterval(timer);
}

export default {
  id: "top-talkers",
  screens: [{ id: "top-talkers", group: { en: "Monitor", yue: "監察" }, icon: "leaderboard", label, render: screen }],
  settings: [{ id: "top-talkers", icon: "leaderboard", label, async render(ctx) { const data = await ctx.api.get("/api/domain/top-talkers"); return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)); } }],
  commands: [{ id: "top-talkers.open", icon: "leaderboard", label: { en: "Who is using the most?", yue: "邊個用得最多？" }, keywords: "top talkers leaderboard upload download bandwidth most usage 排行榜 上傳 下載 流量 最多", run: (ctx) => ctx.navigate("top-talkers") }],
};
