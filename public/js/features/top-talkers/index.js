// Top talkers: who is downloading or uploading the most right now. Tabs switch
// between the biggest downloaders, the biggest uploaders and the two together.
// The numbers come from the router's connection tracking table, read every few
// seconds, so the list moves while you watch. Blocking or renaming a device waits
// in the pending-changes dock like every other change.
import { METRICS, accumulate, bytesText, rank, rateText, sparkline } from "./model.js";

// Appends children, skipping empty ones and flattening lists. (The native append would print "null" for a gap.)
function add(el, ...kids) {
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}
const fill = (el, ...kids) => (el.replaceChildren(), add(el, ...kids));

const label = { en: "Top talkers", yue: "邊個用得最多" };
const lede = { en: "Who is downloading and uploading the most, live.", yue: "邊個下載同上載得最多，即時睇。" };
const NS = "http://www.w3.org/2000/svg";
const TAB = { down: { en: "Downloading the most", yue: "下載最多", icon: "download" }, up: { en: "Uploading the most", yue: "上載最多", icon: "upload" }, both: { en: "Busiest overall", yue: "整體最繁忙", icon: "swap_vert" } };

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const canWrite = ctx.state.canWrite;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  const settings = await api.get("/api/domain/device-traffic");
  let metric = "down";
  let view = null;
  let seen = {};
  let last = null;
  let timer = null;
  let failure = null;
  let selected = null;
  const tabs = h("div", { class: "seg", role: "radiogroup", "aria-label": t("What to rank by", "按咩排名") });
  const list = h("ol", { class: "tt-list", "aria-live": "off" });
  const status = h("div", { class: "tt-status", role: "status", "aria-live": "polite" });
  const detail = h("section", { class: "card rise tt-detail" });
  const unit = settings.unit;

  const stage = (op, summary) => {
    if (!canWrite) return ctx.toast(t("Your role can only look.", "你嘅角色只可以睇。"), "warn");
    ctx.dock.addOp(op, summary);
    ctx.toast(t("Waiting in your pending changes.", "已加入待套用變更。"));
  };

  function spark(history, ip) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 120 28");
    svg.setAttribute("class", "tt-spark");
    svg.setAttribute("aria-hidden", "true");
    const line = document.createElementNS(NS, "polyline");
    line.setAttribute("points", sparkline(history, ip, metric, 120, 28));
    line.setAttribute("fill", "none");
    svg.append(line);
    return svg;
  }

  function drawTabs() {
    fill(tabs, ...METRICS.map((m) => h("button", { type: "button", role: "radio", "aria-checked": String(metric === m), class: metric === m ? "on" : "", onClick() { metric = m; drawTabs(); draw(); } }, icon(TAB[m].icon, "sm"), tt(TAB[m]))));
  }

  function draw() {
    if (failure) return void fill(status, h("div", { class: "note bad" }, icon("error"), failure));
    if (!view) return void fill(status, h("div", { class: "note" }, icon("hourglass_top"), t("Reading the router…", "讀緊路由器…")));
    const rows = rank(view.devices, metric, { hideIdle: settings.hideIdle, top: Math.max(settings.top, 10) });
    const total = view.total;
    fill(status, 
      view.warm ? h("div", { class: "note" }, icon("hourglass_top"), t("Warming up. The first reading only starts the clock; speeds appear after the next one.", "預熱緊。第一次讀取只係開始計時，下一次先會見到速度。")) : null,
      view.accounting === false ? h("div", { class: "note warn" }, icon("info"), t("This router is not counting bytes for each connection, so speeds cannot be worked out. Turn on connection accounting on the router.", "呢部路由器冇計算每條連線嘅位元組，所以計唔到速度。請喺路由器開啟連線計數。")) : null,
      h("div", { class: "chips" },
        h("span", { class: "tag good" }, icon("download", "sm"), `${t("Everyone down", "全部下載")} ${rateText(total.down, unit)}`),
        h("span", { class: "tag" }, icon("upload", "sm"), `${t("Everyone up", "全部上載")} ${rateText(total.up, unit)}`),
        h("span", { class: "tag" }, icon("devices", "sm"), `${rows.length} ${t("busy", "部繁忙")}`)));
    const top = rows[0]?.value || 1;
    fill(list, ...(rows.length ? rows.map((r) => {
      const li = h("li", { class: `tt-row${selected === r.ip ? " sel" : ""}${r.rank === 1 ? " first" : ""}` },
        h("button", { type: "button", class: "tt-pick", "aria-pressed": String(selected === r.ip), onClick() { selected = selected === r.ip ? null : r.ip; draw(); } },
          h("span", { class: "tt-rank" }, String(r.rank)),
          h("span", { class: "tt-who" }, h("b", {}, r.name), h("span", { class: "t2 mono" }, r.ip)),
          h("span", { class: "tt-bar", "aria-hidden": "true" }, h("i", { "data-w": String(Math.max(2, Math.round((r.value / top) * 100))) })),
          spark(view.history, r.ip),
          h("span", { class: "tt-val" }, h("b", {}, rateText(r.value, unit)), h("span", { class: "t2" }, `${Math.round(r.share * 100)}% ${t("of the total", "佔總數")}`))));
      return li;
    }) : [h("li", { class: "empty" }, icon("hotel", "lg"), view.warm ? t("Nothing to rank yet.", "暫時未有嘢排名。") : t("No device is moving data right now.", "而家冇裝置喺度傳輸資料。"))]));
    for (const el of list.querySelectorAll("i[data-w]")) el.style.setProperty("width", `${el.dataset.w}%`);
    drawDetail(rows);
  }

  function drawDetail(rows) {
    const r = rows.find((x) => x.ip === selected);
    ctx.clear(detail);
    detail.hidden = !r;
    if (!r) return;
    const totals = seen[r.ip] ?? { up: 0, down: 0 };
    const blockable = Boolean(r.mac);
    add(detail, h("div", { class: "k" }, `#${r.rank}`), h("h2", { class: "h2" }, r.name), h("div", { class: "t2 mono" }, `${r.ip}${r.mac ? ` · ${r.mac}` : ""}`),
      h("div", { class: "chips" },
        h("span", { class: "tag good" }, icon("download", "sm"), `${t("Down now", "而家下載")} ${rateText(r.down, unit)}`), h("span", { class: "tag" }, icon("upload", "sm"), `${t("Up now", "而家上載")} ${rateText(r.up, unit)}`),
        h("span", { class: "tag" }, `${r.flows} ${t("connections", "條連線")}`)),
      h("div", { class: "t2" }, t(`Since you opened this page: ${bytesText(totals.down)} down, ${bytesText(totals.up)} up.`, `由你打開呢頁開始：下載 ${bytesText(totals.down)}，上載 ${bytesText(totals.up)}。`)),
      h("div", { class: "chips" },
        h("button", { type: "button", class: "btn d sm", disabled: !canWrite || !blockable, onClick: () => stage({ op: "block", mac: r.mac, name: r.name, blocked: true }, `${t("Block", "封鎖")} ${r.name}`) }, icon("block", "sm"), t("Block from the internet", "封鎖上網")),
        h("button", { type: "button", class: "btn t sm", disabled: !canWrite || !blockable, onClick: () => ctx.openDialog((close) => {
          const name = h("input", { class: "field", maxlength: "32", value: r.name === r.ip ? "" : r.name, "aria-label": t("Device name", "裝置名稱") });
          return [h("h2", { class: "h2" }, t("Rename this device", "幫呢部裝置改名")), name, h("div", { class: "actions" }, h("button", { type: "button", class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { type: "button", class: "btn f", onClick() { stage({ op: "rename", mac: r.mac, name: name.value.trim() }, `${t("Rename", "改名")} ${r.name} → ${name.value.trim()}`); close(true); } }, t("Add to pending changes", "加入待套用變更")))];
        }, { label: t("Rename this device", "幫呢部裝置改名") }) }, icon("edit", "sm"), t("Rename", "改名")),
        h("button", { type: "button", class: "btn o sm", onClick: () => ctx.navigate("map-editor") }, icon("lan", "sm"), t("Find it on the map", "喺地圖搵佢"))),
      blockable ? null : h("div", { class: "note" }, icon("info"), t("The router did not tell this device's address apart from its list of leases, so it cannot be blocked by name from here.", "路由器租約清單入面冇呢個地址，所以唔可以喺度按名封鎖。")));
  }

  async function poll() {
    if (document.hidden) return;
    try {
      const next = await api.get("/api/x/device-traffic/sample");
      const now = Date.now();
      if (last && !next.warm) seen = accumulate(seen, next.devices, (now - last) / 1000);
      last = now;
      view = next;
      failure = null;
    } catch (error) {
      failure = error.message;
    }
    draw();
  }

  add(page, h("section", { class: "card rise" }, tabs, status, list), detail);
  detail.hidden = true;
  drawTabs();
  draw();
  await poll();
  timer = setInterval(poll, Math.max(1, settings.interval) * 1000);
  return () => clearInterval(timer);
}

export default {
  id: "top-talkers",
  screens: [{ id: "top-talkers", group: { en: "Monitor", yue: "監察" }, icon: "leaderboard", label, render: screen }],
  commands: [{ id: "top-talkers.open", icon: "leaderboard", label: { en: "Who is using the most", yue: "邊個用得最多" }, keywords: "top talkers upload download bandwidth who busiest traffic hog 上載 下載 流量 邊個", run: (ctx) => ctx.navigate("top-talkers") }],
};
