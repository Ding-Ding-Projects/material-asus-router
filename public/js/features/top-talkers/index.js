// Top talkers screen: a ranking of who is uploading or downloading the most,
// with tabs for downloading, uploading and both, and a choice between the
// speed right now and the total since counting started. It reads
// /api/x/top-talkers/sample while the screen is open and stops when it is left.
import { MODES, WINDOWS, percentText, rankDevices, valueText } from "./rank.js";

const label = { en: "Top talkers", yue: "邊個用得最多" };
const lede = { en: "Who is downloading and uploading the most, worked out from the router's connection table.", yue: "邊個下載同上傳最多，由路由器嘅連線表計出嚟。" };

async function screen(ctx) {
  const { api, h, icon, t } = ctx;
  const config = await api.get("/api/domain/top-talkers");
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  let view = null;
  let mode = MODES.includes(config.view) ? config.view : "down";
  let measure = WINDOWS.includes(config.window) ? config.window : "now";
  let paused = false;
  let busy = false;
  let lastOrder = "";
  const body = h("div", { class: "tt-body", "aria-live": "off" });

  const modeNames = { down: t("Downloading most", "下載最多"), up: t("Uploading most", "上傳最多"), both: t("Both together", "上傳加下載") };
  const windowNames = { now: t("Right now", "而家"), since: t("Since counting started", "由開始計數起") };
  const verb = { down: t("is downloading the most", "下載最多"), up: t("is uploading the most", "上傳最多"), both: t("is moving the most data", "搬動最多資料") };

  // Radio-style buttons: arrow keys move between them, like a tab bar.
  function group(names, current, set, name) {
    const wrap = h("div", { class: "seg tt-seg", role: "radiogroup", "aria-label": name });
    const keys = Object.keys(names);
    const buttons = keys.map((key) => h("button", { type: "button", role: "radio", "aria-checked": String(key === current()), tabindex: key === current() ? "0" : "-1", class: key === current() ? "on" : "",
      onClick() { set(key); redrawControls(); draw(); },
      onKeydown(e) {
        const at = keys.indexOf(current());
        const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? keys[(at + 1) % keys.length] : e.key === "ArrowLeft" || e.key === "ArrowUp" ? keys[(at + keys.length - 1) % keys.length] : null;
        if (!next) return;
        e.preventDefault();
        set(next);
        redrawControls();
        draw();
        wrap.querySelector('[aria-checked="true"]')?.focus();
      } }, names[key]));
    wrap.append(...buttons);
    return wrap;
  }
  const controls = h("div", { class: "tt-controls" });
  function redrawControls() {
    ctx.clear(controls).append(
      group(modeNames, () => mode, (v) => (mode = v), t("Ranking", "排名")),
      group(windowNames, () => measure, (v) => (measure = v), t("Measure", "計算方式")),
      h("button", { class: "btn t sm", onClick: () => { paused = !paused; redrawControls(); if (!paused) poll(); } }, icon(paused ? "play_arrow" : "pause", "sm"), paused ? t("Resume", "繼續") : t("Pause", "暫停")),
      h("button", { class: "btn o sm", onClick: async () => { try { await api.post("/api/x/top-talkers/reset"); view = null; lastOrder = ""; draw(); poll(); } catch (error) { ctx.toast(error.message, "bad"); } } }, icon("restart_alt", "sm"), t("Count from zero", "重新由零計")));
  }

  function draw() {
    ctx.clear(body);
    if (!view) return void body.append(h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("hourglass_top", "lg"), t("Reading the router…", "讀緊路由器…"))));
    if (view.accounting === false)
      return void body.append(h("div", { class: "card warn" }, h("div", { class: "k" }, t("Byte counting is off", "未開位元組計數")),
        h("div", { class: "t1" }, t("The router lists connections but does not count their bytes, so nobody can be ranked.", "路由器有列出連線，但冇計位元組，所以排唔到名。")),
        h("div", { class: "t2" }, t("On Asuswrt-Merlin, turn on connection accounting (nf_conntrack_acct) in a firewall-start script, then reload this page.", "喺 Asuswrt-Merlin，可以喺 firewall-start script 開啟連線計數（nf_conntrack_acct），之後重新載入呢頁。"))));
    const ranked = rankDevices(view.devices, { mode, window: measure, count: config.count, hideIdle: config.hideIdle });
    const order = ranked.map((r) => r.ip).join(",");
    const changed = order !== lastOrder;
    lastOrder = order;
    if (!ranked.length)
      return void body.append(h("div", { class: "card tone" }, h("div", { class: "empty" }, icon(view.warm ? "hourglass_top" : "devices_off", "lg"), view.warm ? t("Warming up. The first ranking appears after the second reading.", "預熱緊。第二次讀取之後就會有排名。") : t("Nobody has moved anything yet.", "暫時冇人有流量。"))));
    const first = ranked[0];
    body.append(
      h("section", { class: `card hero rise tt-leader${changed ? " tt-new" : ""}` },
        h("div", { class: "tt-crown", "aria-hidden": "true" }, icon("emoji_events", "lg")),
        h("div", { class: "k" }, measure === "now" ? t("Right now", "而家") : t("Since counting started", "由開始計數起")),
        h("div", { class: "big" }, first.name),
        h("div", { class: "t1" }, `${verb[mode]}: ${valueText(first.value, measure, config.unit)}`),
        h("div", { class: "t2" }, t(`${percentText(first.share)} of everything moved in this measure`, `佔呢個計算方式入面全部流量嘅 ${percentText(first.share)}`))),
      h("ol", { class: "tt-list", "aria-label": modeNames[mode] },
        ranked.map((r) => {
          const bar = h("i", {});
          bar.style.setProperty("--w", `${Math.max(2, Math.round(r.rel * 100))}%`);
          return h("li", { class: `tt-row${changed ? " tt-new" : ""}` },
            h("span", { class: `tt-pos p${Math.min(r.position, 4)}`, "aria-label": t(`Number ${r.position}`, `第 ${r.position} 名`) }, String(r.position)),
            h("div", { class: "tt-who" }, h("div", { class: "t1" }, r.name), h("div", { class: "t2 tt-mono" }, `${r.ip}${r.mac ? ` · ${r.mac}` : ""}`),
              h("div", { class: "meter", role: "meter", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(r.rel * 100)), "aria-label": r.name, "aria-valuetext": `${percentText(r.share)}` }, bar)),
            h("div", { class: "tt-num" }, h("div", { class: "tt-val" }, valueText(r.value, measure, config.unit)),
              mode === "both" ? h("div", { class: "t2" }, `↓ ${valueText(r.down, measure, config.unit)} · ↑ ${valueText(r.up, measure, config.unit)}`) : h("div", { class: "t2" }, percentText(r.share))));
        })),
      h("div", { class: "muted" }, measure === "since"
        ? t(`Counting since ${new Date(view.since).toLocaleTimeString()}. Totals follow each connection, so they are close but not exact.`, `由 ${new Date(view.since).toLocaleTimeString()} 開始計。總量係跟住每條連線計，所以好接近但唔係完全準確。`)
        : t("Speed is measured between two readings, a few seconds apart.", "速度係用相隔幾秒嘅兩次讀取計出嚟。")));
  }

  async function poll() {
    if (busy || paused || document.hidden) return;
    busy = true;
    try {
      view = await api.get("/api/x/top-talkers/sample");
      draw();
    } catch (error) {
      if (!view) ctx.toast(error.message, "bad");
    }
    busy = false;
  }

  redrawControls();
  page.append(controls, body, ...ctx.controls.settingGroups(config.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)));
  draw();
  await poll();
  const timer = setInterval(poll, Math.max(1, config.interval) * 1000);
  return () => clearInterval(timer);
}

export default {
  id: "top-talkers",
  screens: [{ id: "top-talkers", group: { en: "Monitor", yue: "監察" }, icon: "leaderboard", label, render: screen }],
  settings: [{ id: "top-talkers", icon: "leaderboard", label, async render(ctx) { const d = await ctx.api.get("/api/domain/top-talkers"); return ctx.controls.settingGroups(d.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)); } }],
  commands: [
    { id: "top-talkers.open", icon: "leaderboard", label: { en: "Who is using the most?", yue: "邊個用得最多？" }, keywords: "top talkers uploading downloading most bandwidth hog heavy user 流量 上傳 下載 最多", run: (ctx) => ctx.navigate("top-talkers") },
  ],
};
