// Wi-Fi diagnostics screen. Five tabs: every connected device with its signal
// and speed, the busiest devices (who is uploading or downloading the most),
// a gauge card for each radio, a site survey of the neighbours, and the
// settings. The live tabs keep reading the router while the screen is open and
// stop the moment it is left. Nothing here follows where anyone is.
import { gauge, sparkline } from "./charts.js";
import { duration, fraction, size, sortClients, speed, tone } from "./format.js";
import { timeline } from "./timeline.js";

const label = { en: "Wi-Fi diagnostics", yue: "Wi-Fi 診斷" };
const API = "/api/x/wifi-diagnostics";
let lastTab = "clients";

const TABS = [
  { id: "clients", icon: "devices", label: { en: "Devices", yue: "裝置" } },
  { id: "busiest", icon: "leaderboard", label: { en: "Busiest", yue: "最忙" } },
  { id: "radios", icon: "speed", label: { en: "Radios", yue: "電台" } },
  { id: "survey", icon: "wifi_find", label: { en: "Survey", yue: "掃描周圍" } },
  { id: "settings", icon: "tune", label: { en: "Settings", yue: "設定" } },
];

const stagger = (node, i) => (node.style.setProperty("--i", String(Math.min(i, 12))), node);
const frame = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));
// A thin bar. The first value is applied a moment after the bar is on screen so it grows in from empty.
const bar = (h, cls = "") => {
  const fill = h("i", {});
  let first = true;
  let latest = 0;
  const apply = () => fill.style.setProperty("--w", `${latest}%`);
  return {
    el: h("div", { class: `meter wd-bar ${cls}`, role: "presentation" }, fill),
    set(percent) {
      latest = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
      if (first) {
        first = false;
        frame(apply);
      } else apply();
    },
  };
};
// An entering row stops animating once it has arrived, so moving it in the list never replays the entrance.
const settle = (node) => (node.addEventListener("animationend", () => node.classList.remove("wd-enter"), { once: true }), node);

// ---------------------------------------------------------------- devices ----

function clientsTab(ctx, data) {
  const { h, icon, t } = ctx;
  const rows = new Map();
  let sort = "name";
  let latest = null;
  const body = h("tbody", {});
  const chips = h("div", { class: "chips wd-chips" });
  const status = h("div", { class: "muted", role: "status" });
  const empty = h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("wifi_off", "lg"), t("No device is joined to Wi-Fi right now.", "而家冇裝置連住 Wi-Fi。")));

  async function kick(c) {
    const ok = await ctx.confirmDialog({
      title: t(`Disconnect ${c.name || c.mac}?`, `斷開 ${c.name || c.mac}？`),
      body: t(`It is joined to ${c.network} (${c.band}). Most devices join again within a few seconds, so this is a nudge, not a ban. To keep a device out, use the Wi-Fi MAC filter.`, `佢連住 ${c.network}（${c.band}）。大部分裝置幾秒內會再連返，所以呢個只係推一推，唔係封鎖。想長期擋住，請用 Wi-Fi MAC 過濾。`),
      confirm: t("Disconnect", "斷開"),
      danger: true,
    });
    if (!ok) return;
    try {
      const out = await ctx.api.post("/api/actions/wifi-diagnostics.kick", { mac: c.mac, hold: true });
      ctx.toast(out.gone ? t(`${c.name || c.mac} was disconnected.`, `已斷開 ${c.name || c.mac}。`) : t("The radio accepted it, but the device still shows. Refreshing.", "電台接受咗，但裝置仍然顯示。重新整理緊。"), out.gone ? "good" : "warn");
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
    await refresh(true);
  }

  function makeRow(c) {
    const r = {};
    r.name = h("div", { class: "wd-name" });
    r.mac = h("div", { class: "mono muted wd-mac" });
    r.net = h("div", {});
    r.band = h("span", { class: "pill p wd-band" });
    r.meter = bar(h);
    r.dbm = h("span", { class: "wd-dbm" });
    r.weak = h("span", { class: "pill t wd-weak", hidden: true }, icon("signal_wifi_bad", "sm"), t("Weak", "弱"));
    r.rate = h("div", { class: "wd-rate" });
    r.now = h("div", { class: "wd-now" });
    r.joined = h("div", { class: "muted" });
    r.btn = h("button", { class: "btn o sm", disabled: !ctx.state.canWrite, onClick: () => kick(r.client) }, icon("link_off", "sm"), t("Disconnect", "斷開"));
    r.tr = settle(h("tr", { class: "wd-enter" },
      h("td", {}, r.name, r.mac),
      h("td", {}, r.net, r.band),
      h("td", {}, r.meter.el, h("div", { class: "wd-sig" }, r.dbm, r.weak)),
      h("td", {}, r.rate),
      h("td", {}, r.now),
      h("td", {}, r.joined),
      h("td", {}, r.btn)));
    return r;
  }

  function fill(r, c) {
    r.client = c;
    r.name.textContent = c.name || t("Unnamed device", "未命名裝置").toString();
    r.mac.textContent = `${c.mac}${c.ip ? ` · ${c.ip}` : ""}`;
    r.net.textContent = `${c.network || "…"}${c.guest ? ` · ${t("guest", "訪客")}` : ""}`;
    r.band.textContent = c.band;
    r.meter.set(c.quality ?? 0);
    r.meter.el.classList.toggle("warn", c.weak);
    r.dbm.textContent = c.rssi === null ? "…" : `${c.rssi} dBm`;
    r.weak.hidden = !c.weak;
    r.rate.textContent = `↓ ${c.txMbps ?? "…"} · ↑ ${c.rxMbps ?? "…"} Mbps`;
    r.now.textContent = c.downBps === null && c.upBps === null ? t("measuring…", "量度緊…").toString() : `↓ ${speed(c.downBps)} · ↑ ${speed(c.upBps)}`;
    r.joined.textContent = duration(c.connected);
  }

  function draw() {
    if (!latest) return;
    const list = sortClients(latest.clients, sort);
    const seen = new Set();
    list.forEach((c, i) => {
      seen.add(c.mac);
      let r = rows.get(c.mac);
      if (!r) {
        r = makeRow(c);
        stagger(r.tr, i);
        rows.set(c.mac, r);
      }
      fill(r, c);
      body.append(r.tr);
    });
    for (const [mac, r] of rows) {
      if (seen.has(mac)) continue;
      rows.delete(mac);
      r.tr.classList.add("wd-leave");
      setTimeout(() => r.tr.remove(), 480);
    }
    ctx.clear(chips).append(...latest.networks.map((n) => h("span", { class: `pill ${n.supported ? "" : "t"}` }, icon(n.supported ? "wifi" : "warning", "sm"), `${n.ssid || n.ifname} · ${n.band} · `, n.supported ? t(`${n.clients} devices`, `${n.clients} 部裝置`) : t("radio not answering", "電台冇回應"))));
    empty.hidden = list.length > 0;
    status.textContent = latest.warming ? t("Speeds appear after the second reading.", "第二次讀取之後先有速度。").toString() : t(`Updated ${new Date(latest.at).toLocaleTimeString()}. Weak means under ${latest.weakBelow} dBm.`, `更新於 ${new Date(latest.at).toLocaleTimeString()}。低過 ${latest.weakBelow} dBm 就係弱。`).toString();
  }

  async function refresh(force = false) {
    latest = await ctx.api.get(`${API}/clients${force ? "?force=1" : ""}`);
    draw();
  }

  const sorter = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Sort devices by", "裝置排序") },
    ...[["name", t("Name", "名稱")], ["signal", t("Signal", "訊號")], ["speed", t("Busiest first", "最忙優先")]].map(([id, text]) =>
      h("button", { role: "radio", "aria-checked": String(id === sort), class: id === sort ? "on" : "", onClick: (e) => { sort = id; for (const b of sorter.children) { b.className = ""; b.setAttribute("aria-checked", "false"); } e.currentTarget.className = "on"; e.currentTarget.setAttribute("aria-checked", "true"); draw(); } }, text)));

  const el = h("div", { class: "wd-tab" },
    h("div", { class: "chips wd-bar-row" }, sorter, h("span", { class: "pill live-pill" }, h("i", { class: "dot live" }), t("Live", "即時"))),
    chips,
    h("div", { class: "tbl" }, h("table", {}, h("thead", {}, h("tr", {}, [t("Device", "裝置"), t("Network", "網絡"), t("Signal", "訊號"), t("Link rate", "連線速率"), t("Right now", "而家"), t("Joined for", "連咗幾耐"), ""].map((x) => h("th", {}, x)))), body)),
    empty, status);
  return { el, refresh, initial: () => refresh(true) };
}

// ---------------------------------------------------------------- busiest ----

function busiestTab(ctx, data) {
  const { h, icon, t } = ctx;
  let by = data.rank;
  let view = null;
  const heads = {
    down: h("div", { class: "big" }, "…"),
    up: h("div", { class: "big" }, "…"),
    count: h("div", { class: "big" }, "…"),
  };
  const list = h("ol", { class: "wd-rank" });
  const nets = h("div", { class: "wd-nets" });
  const note = h("div", { class: "muted", role: "status" });
  const warming = h("div", { class: "note" }, icon("hourglass_top"), h("div", {}, t("Measuring… the first speeds appear after the second reading, a few seconds from now.", "量度緊…第二次讀取之後先有第一批速度，幾秒鐘後就有。")));
  const medal = ["emoji_events", "military_tech", "workspace_premium"];
  const rowEls = new Map();

  function rowFor(r, rank, max) {
    let e = rowEls.get(r.mac);
    if (!e) {
      e = { li: settle(h("li", { class: "wd-r card" })), down: bar(h), up: bar(h, "t"), spark: h("span", { class: "wd-sparkbox" }) };
      e.badge = h("span", { class: "wd-badge" });
      e.title = h("div", { class: "wd-rt" });
      e.sub = h("div", { class: "t2" });
      e.dText = h("span", {});
      e.uText = h("span", {});
      e.share = h("span", { class: "pill p" });
      e.tot = h("div", { class: "t2" });
      e.li.append(e.badge, h("div", { class: "wd-rmain" }, e.title, e.sub,
        h("div", { class: "wd-lanes" },
          h("div", { class: "wd-lane" }, h("span", { class: "wd-dir" }, icon("arrow_downward", "sm"), t("Down", "下載")), e.down.el, e.dText),
          h("div", { class: "wd-lane" }, h("span", { class: "wd-dir" }, icon("arrow_upward", "sm"), t("Up", "上載")), e.up.el, e.uText)),
        e.tot), h("div", { class: "wd-rside" }, e.share, e.spark));
      rowEls.set(r.mac, e);
      e.li.classList.add("wd-enter");
    }
    stagger(e.li, rank);
    e.li.classList.toggle("first", rank === 0);
    e.badge.replaceChildren(rank < 3 ? icon(medal[rank], "lg") : h("span", { class: "wd-num" }, String(rank + 1)));
    e.title.textContent = r.name || r.mac;
    e.sub.textContent = `${r.network || r.ifname} · ${r.band}${r.guest ? ` · ${t("guest", "訪客")}` : ""}`;
    e.down.set((100 * (r.downBps ?? 0)) / max.down);
    e.up.set((100 * (r.upBps ?? 0)) / max.up);
    e.dText.textContent = `${speed(r.downBps)} · ${r.shareDown}%`;
    e.uText.textContent = `${speed(r.upBps)} · ${r.shareUp}%`;
    e.tot.textContent = t(`Since this screen started watching: ${size(r.downTotal)} down, ${size(r.upTotal)} up`, `由呢個畫面開始睇：下載 ${size(r.downTotal)}，上載 ${size(r.upTotal)}`).toString();
    e.spark.replaceChildren(sparkline(r.trail));
    return e.li;
  }

  function draw() {
    if (!view) return;
    heads.down.textContent = speed(view.totals.downBps);
    heads.up.textContent = speed(view.totals.upBps);
    heads.count.textContent = String(view.totals.clients);
    warming.hidden = !view.warming;
    const max = { down: Math.max(1, ...view.rows.map((r) => r.downBps ?? 0)), up: Math.max(1, ...view.rows.map((r) => r.upBps ?? 0)) };
    const live = new Set(view.rows.map((r) => r.mac));
    for (const [mac, e] of rowEls) if (!live.has(mac)) { e.li.remove(); rowEls.delete(mac); }
    view.rows.forEach((r, i) => list.append(rowFor(r, i, max)));
    list.hidden = view.rows.length === 0;
    ctx.clear(nets).append(...view.networks.map((n) => {
      const total = Math.max(1, ...view.networks.map((x) => x.downBps + x.upBps));
      const m = bar(h);
      frame(() => m.set((100 * (n.downBps + n.upBps)) / total));
      return h("div", { class: "wd-net" }, h("div", {}, h("strong", {}, n.ssid || t("(no name)", "（冇名）")), ` · ${n.band}${n.guest ? ` · ${t("guest", "訪客")}` : ""} · `, t(`${n.clients} devices`, `${n.clients} 部裝置`)), m.el, h("div", { class: "t2" }, `↓ ${speed(n.downBps)} · ↑ ${speed(n.upBps)}`));
    }));
    note.textContent = view.rows.length ? t(`Only devices joined to Wi-Fi are counted, and the numbers start from when this screen began watching at ${new Date(view.since).toLocaleTimeString()}.`, `只計連住 Wi-Fi 嘅裝置，數字由呢個畫面開始睇嗰刻（${new Date(view.since).toLocaleTimeString()}）起計。`).toString() : t("Nothing is joined to Wi-Fi right now.", "而家冇裝置連住 Wi-Fi。").toString();
  }

  async function refresh(force = false) {
    view = await ctx.api.get(`${API}/top?by=${by}${force ? "&force=1" : ""}`);
    draw();
  }

  const picker = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Rank by", "排名按") },
    ...[["total", "swap_vert", t("Both", "上載加下載")], ["down", "arrow_downward", t("Downloading", "下載")], ["up", "arrow_upward", t("Uploading", "上載")]].map(([id, ic, text]) =>
      h("button", { role: "radio", "aria-checked": String(id === by), class: id === by ? "on" : "", onClick: async (e) => { by = id; for (const b of picker.children) { b.className = ""; b.setAttribute("aria-checked", "false"); } e.currentTarget.className = "on"; e.currentTarget.setAttribute("aria-checked", "true"); await refresh(); } }, icon(ic, "sm"), text)));

  const wired = h("button", { class: "btn o sm", onClick: () => ctx.navigate("device-traffic") }, icon("lan", "sm"), t("Wired devices are on Device traffic", "有線裝置喺「裝置流量」睇"));
  const el = h("div", { class: "wd-tab" },
    h("div", { class: "chips wd-bar-row" }, picker, h("span", { class: "pill live-pill" }, h("i", { class: "dot live" }), t("Live", "即時")), wired),
    h("div", { class: "grid2 wd-heads" },
      h("section", { class: "card rise" }, h("div", { class: "k" }, t("Everyone downloading", "全屋下載")), heads.down, h("div", { class: "t2" }, t("Wi-Fi devices combined, right now", "所有 Wi-Fi 裝置合計，即時"))),
      h("section", { class: "card rise sec" }, h("div", { class: "k" }, t("Everyone uploading", "全屋上載")), heads.up, h("div", { class: "t2" }, t("Backups, cloud photos and video calls show up here", "備份、雲端相片同視像通話會喺度出現"))),
      h("section", { class: "card rise ter" }, h("div", { class: "k" }, t("Devices counted", "計入裝置")), heads.count, h("div", { class: "t2" }, t("Joined to Wi-Fi now", "而家連住 Wi-Fi")))),
    warming, list,
    h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("By network", "按網絡")), nets),
    note);
  return { el, refresh, initial: () => refresh(true) };
}

// ----------------------------------------------------------------- radios ----

function radiosTab(ctx, data) {
  const { h, icon, t } = ctx;
  const cards = new Map();
  const out = h("div", { class: "grid2" });
  const status = h("div", { class: "muted", role: "status" });

  async function search(c, r) {
    const ok = await ctx.confirmDialog({
      title: t(`Search for a better channel on ${r.band}?`, `喺 ${r.band} 搵過更好嘅頻道？`),
      body: t("The radio listens to its neighbours and may move to a quieter channel. Wi-Fi on this band can drop for up to a minute while it does. Devices rejoin by themselves.", "電台會聽吓鄰居，可能轉去較靜嘅頻道。期間呢個頻段嘅 Wi-Fi 最多可能斷成一分鐘，裝置會自動重連。"),
      confirm: t("Search now", "即時搵"),
    });
    if (!ok) return;
    c.slot.replaceChildren();
    const tl = timeline(ctx, [{ en: "Asked the radio to search", yue: "叫電台去搵" }, { en: "Waiting for the radio to settle", yue: "等電台穩定" }, { en: "Reading the channel back", yue: "讀返而家個頻道" }]);
    c.slot.append(tl.el, h("div", { class: "t2" }, t("Time so far: ", "已用時間："), tl.clock));
    tl.set(0, "work");
    c.button.disabled = true;
    try {
      const done = await ctx.api.post("/api/actions/wifi-diagnostics.acs", { band: r.index, hold: true });
      tl.set(0, "done", done.method === "autochannel" ? t("search started", "已開始搵").toString() : t("by restarting Wi-Fi", "用重啟 Wi-Fi").toString());
      tl.set(1, "work");
      let seen = null;
      for (let i = 0; i < 10; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const now = (await ctx.api.get(`${API}/radios`)).radios.find((x) => x.index === r.index);
        seen = now?.channel ?? null;
        if (seen !== null) break;
      }
      tl.set(1, "done");
      tl.set(2, seen === null ? "bad" : "done", seen === null ? t("The radio did not report a channel yet.", "電台未報告頻道。").toString() : done.before && String(done.before) !== String(seen) ? t(`Moved from ${done.before} to ${seen}.`, `由 ${done.before} 轉到 ${seen}。`).toString() : t(`Staying on ${seen}: it is still the quietest.`, `留喺 ${seen}：仍然係最靜嗰個。`).toString());
    } catch (error) {
      tl.set(0, "bad", error.message);
    }
    tl.finish();
    c.button.disabled = !ctx.state.canWrite || !r.autoChannel;
    await refresh();
  }

  function card(r) {
    const c = { gauges: {} };
    c.title = h("h2", { class: "h2" });
    c.sub = h("div", { class: "t2" });
    for (const [id, text, unit] of [["air", t("Busy air", "空氣繁忙度"), "%"], ["noise", t("Noise", "底噪"), "dBm"], ["heat", t("Radio temperature", "電台溫度"), "°C"]]) {
      const g = gauge({ label: text.toString(), unit });
      c.gauges[id] = { g, caption: h("div", { class: "wd-cap" }, text), why: h("div", { class: "t2" }) };
    }
    c.dfs = h("div", { class: "wd-dfs" });
    c.mix = h("div", { class: "wd-mix" });
    c.legend = h("div", { class: "legend" });
    c.slot = h("div", { class: "wd-slot" });
    c.hint = h("div", { class: "t2" });
    c.button = h("button", { class: "btn t sm", disabled: true }, icon("auto_mode", "sm"), t("Search for a better channel", "搵過更好嘅頻道"));
    c.el = h("section", { class: "card rise" }, c.title, c.sub,
      h("div", { class: "wd-gauges" }, ...Object.values(c.gauges).map((x) => h("div", { class: "wd-gwrap" }, x.g.el, x.caption, x.why))),
      c.dfs, c.mix, c.legend, h("div", { class: "chips" }, c.button), c.hint, c.slot);
    return c;
  }

  function show(c, r) {
    c.title.textContent = `${r.band} · ${r.ssid || r.ifname}`;
    c.sub.textContent = r.on ? t(`Channel ${r.channel ?? "…"}${r.autoChannel ? " (automatic)" : " (fixed)"}`, `頻道 ${r.channel ?? "…"}${r.autoChannel ? "（自動）" : "（固定）"}`).toString() : t("This radio is off.", "呢個電台關咗。").toString();
    const set = (id, value, kind, shown, why) => {
      const x = c.gauges[id];
      x.g.set(value === null ? { percent: 0, shown: "n/a", tone: "off" } : { percent: fraction(value, kind.min, kind.max), shown, tone: tone(kind.tone, value) });
      x.why.textContent = value === null ? t("Not available on this radio.", "呢個電台冇呢個讀數。").toString() : why;
    };
    set("air", r.air?.busy ?? null, { min: 0, max: 100, tone: "air" }, `${r.air?.busy}`, r.air ? t(`Neighbours ${r.air.otherNetworks}%, non Wi-Fi ${r.air.nonWifi}%`, `鄰居 ${r.air.otherNetworks}%，非 Wi-Fi ${r.air.nonWifi}%`).toString() : "");
    set("noise", r.noise, { min: -100, max: -60, tone: "noise" }, `${r.noise}`, t("Lower is better. Below -85 is quiet.", "越低越好。低過 -85 就算靜。").toString());
    set("heat", r.temperature, { min: 20, max: 100, tone: "heat" }, `${r.temperature}`, t("As the radio reports it.", "照電台自己報告。").toString());
    c.dfs.replaceChildren();
    if (r.dfsApplies) {
      c.dfs.append(r.dfs
        ? h("span", { class: `pill ${r.dfs.idle ? "" : "t"}` }, icon(r.dfs.idle ? "radar" : "warning", "sm"), t("Radar check: ", "雷達檢查："), r.dfs.state, r.dfs.radarChannel ? t(` · last radar on channel ${r.dfs.radarChannel}`, ` · 上次喺頻道 ${r.dfs.radarChannel} 見到雷達`) : "")
        : h("span", { class: "pill t" }, icon("radar", "sm"), t("Radar status not available on this radio.", "呢個電台冇雷達狀態。")));
    }
    c.mix.replaceChildren();
    c.legend.replaceChildren();
    if (r.air) {
      const parts = [["own", t("Your radio", "你嘅電台"), r.air.own], ["bss", t("Your devices", "你嘅裝置"), r.air.inBss], ["other", t("Neighbours", "鄰居"), r.air.otherNetworks], ["non", t("Not Wi-Fi", "非 Wi-Fi"), r.air.nonWifi]];
      for (const [cls, text, v] of parts) {
        const seg = h("i", { class: `wd-seg ${cls}`, title: `${text}: ${v ?? 0}%` });
        seg.style.setProperty("--w", "0%");
        c.mix.append(seg);
        frame(() => seg.style.setProperty("--w", `${Math.min(100, v ?? 0)}%`));
        c.legend.append(h("span", {}, h("i", { class: `wd-swatch ${cls}` }), `${text} ${v ?? 0}%`));
      }
    }
    c.button.onclick = () => search(c, r);
    c.button.disabled = !ctx.state.canWrite || !r.on || !r.autoChannel;
    c.hint.textContent = !r.autoChannel ? t("This band has a fixed channel. Set the channel to Auto first.", "呢個頻段用固定頻道。請先將頻道設做自動。").toString() : "";
  }

  async function refresh() {
    const { radios, at } = await ctx.api.get(`${API}/radios`);
    for (const r of radios) {
      let c = cards.get(r.index);
      if (!c) {
        c = card(r);
        cards.set(r.index, c);
        out.append(c.el);
        stagger(c.el, cards.size);
      }
      show(c, r);
    }
    status.textContent = t(`Read at ${new Date(at).toLocaleTimeString()}. A reading the radio does not give shows as n/a.`, `${new Date(at).toLocaleTimeString()} 讀取。電台唔提供嘅讀數會顯示 n/a。`).toString();
  }

  return { el: h("div", { class: "wd-tab" }, out, status), refresh, initial: refresh };
}

// ----------------------------------------------------------------- survey ----

function surveyTab(ctx, data) {
  const { h, icon, t } = ctx;
  let band = data.bands[0]?.index ?? 0;
  let running = false;
  const result = h("div", {});
  const bands = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Wi-Fi band", "Wi-Fi 頻段") });
  const go = h("button", { class: "btn f" }, icon("wifi_find", "sm"), t("Scan the neighbours", "掃描鄰居"));
  const slot = h("div", {});

  const drawBands = () => ctx.clear(bands).append(...data.bands.map((b) => h("button", { role: "radio", "aria-checked": String(b.index === band), class: b.index === band ? "on" : "", disabled: running, onClick: () => { band = b.index; drawBands(); } }, b.band)));

  async function scan() {
    const b = data.bands.find((x) => x.index === band);
    if (!b?.on) return ctx.toast(t("That band's radio is off.", "嗰個頻段嘅電台關咗。"), "warn");
    const ok = await ctx.confirmDialog({
      title: t(`Scan around ${b.band}?`, `掃描 ${b.band} 周圍？`),
      body: t("To listen to the neighbours the radio steps off your channel for a moment. Devices on this band can pause for a second or two.", "要聽鄰居，電台會暫時離開你個頻道。呢個頻段嘅裝置可能停頓一兩秒。"),
      confirm: t("Scan", "掃描"),
    });
    if (!ok) return;
    running = true;
    go.disabled = true;
    drawBands();
    ctx.clear(slot);
    const tl = timeline(ctx, [{ en: "Radio steps aside to listen", yue: "電台暫時離開去聽" }, { en: "Collecting the neighbours", yue: "收集鄰居" }, { en: "Drawing the chart", yue: "畫圖" }]);
    slot.append(h("div", { class: "card rise" }, h("div", { class: "wd-radar", "aria-hidden": "true" }, h("i", {}), h("i", {}), h("i", {})), tl.el, h("div", { class: "t2" }, t("Time so far: ", "已用時間："), tl.clock)));
    tl.set(0, "work");
    try {
      tl.set(0, "done");
      tl.set(1, "work");
      const scanResult = await ctx.api.get(`/api/x/channel-analyser/scan?band=${band}`);
      tl.set(1, "done", t(`${scanResult.scanned} networks heard`, `聽到 ${scanResult.scanned} 個網絡`).toString());
      tl.set(2, "work");
      ctx.clear(result).append(chart(scanResult));
      tl.set(2, "done");
    } catch (error) {
      tl.set(1, "bad", error.status === 404 ? t("The channel analyser is not available on this router.", "呢部路由器冇頻道分析。").toString() : error.message);
    }
    tl.finish();
    running = false;
    go.disabled = false;
    drawBands();
  }

  function chart(scan) {
    const nets = scan.networks.slice(0, 14);
    const rows = nets.map((n, i) => {
      const clash = scan.ownChannel && n.channel === scan.ownChannel;
      const m = bar(h, clash ? "bad" : "");
      frame(() => m.set(Math.max(2, ((n.rssi + 100) / 60) * 100)));
      return stagger(h("div", { class: "wd-srow wd-enter" }, h("div", { class: "wd-sname" }, n.ssid || t("(hidden)", "（隱藏）"), h("span", { class: "muted" }, ` · ${t("channel", "頻道")} ${n.channel}${clash ? ` · ${t("same as yours", "同你一樣")}` : ""}`)), m.el, h("div", { class: "wd-sdb" }, `${n.rssi} dBm`)), i);
    });
    const r = scan.recommendation;
    return h("section", { class: "card rise" },
      h("h2", { class: "h2" }, t("Neighbours by signal", "鄰居按訊號強度")),
      h("div", { class: "t2" }, t(`${scan.counted} of ${scan.scanned} networks counted. Your channel is ${scan.ownChannel ?? "automatic"}. A red bar shares your channel.`, `${scan.scanned} 個網絡計入 ${scan.counted} 個。你嘅頻道係 ${scan.ownChannel ?? "自動"}。紅色代表同你一個頻道。`)),
      ...rows,
      r ? h("div", { class: "note" }, icon("lightbulb"), h("div", {}, r.keep ? t("Your channel is already among the quietest.", "你而家個頻道已經係最靜嘅幾個之一。") : t(`Channel ${r.channel} looks quietest. Set it on the Channel analyser screen, or ask the radio to choose again on the Radios tab.`, `頻道 ${r.channel} 似乎最靜。可以喺「頻道分析」設定，或者喺「電台」分頁叫電台重新揀。`))) : null,
      h("button", { class: "btn o sm", onClick: () => ctx.navigate("channel-analyser") }, icon("analytics", "sm"), t("Open the full channel analyser", "打開完整頻道分析")));
  }

  go.onclick = scan;
  drawBands();
  const el = h("div", { class: "wd-tab" }, h("div", { class: "chips wd-bar-row" }, bands, go), h("div", { class: "muted" }, t("Scanning makes the radio step off its channel for a moment, so devices on that band can pause briefly.", "掃描時電台會暫時離開頻道，呢個頻段嘅裝置可能短暫停頓。")), slot, result);
  return { el };
}

// --------------------------------------------------------------- the page ----

async function screen(ctx) {
  const { api, h, icon, t } = ctx;
  const data = await api.get("/api/domain/wifi-diagnostics");
  const page = ctx.page(label, { en: "See who is on each Wi-Fi network and how well, who is using the most, and how healthy each radio is.", yue: "睇吓每個 Wi-Fi 網絡有邊個連住同連得幾好、邊個用得最多，以及每個電台健唔健康。" });
  ctx.root.append(page);
  const tabs = {
    clients: clientsTab(ctx, data),
    busiest: busiestTab(ctx, data),
    radios: radiosTab(ctx, data),
    survey: surveyTab(ctx, data),
    settings: { el: h("div", { class: "wd-tab" }, ...ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries))) },
  };
  const panel = h("div", { class: "wd-panel", role: "tabpanel" });
  const strip = h("div", { class: "seg wd-tabs", role: "tablist", "aria-label": t("Diagnostics sections", "診斷分頁") });
  let current = null;
  let busy = false;
  let alive = true;

  async function tick() {
    const tab = tabs[current];
    if (!tab?.refresh || busy || document.hidden || !alive) return;
    busy = true;
    try {
      await tab.refresh();
    } catch (error) {
      if (alive) ctx.toast(error.message, "bad");
    }
    busy = false;
  }

  async function open(id) {
    current = id;
    lastTab = id;
    for (const b of strip.children) {
      const on = b.dataset.tab === id;
      b.className = on ? "on" : "";
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    panel.replaceChildren(tabs[id].el);
    panel.classList.remove("wd-swap");
    void panel.offsetWidth;
    panel.classList.add("wd-swap");
    busy = true;
    try {
      await tabs[id].initial?.();
    } catch (error) {
      ctx.toast(error.message, "bad");
    }
    busy = false;
  }

  strip.append(...TABS.map((x) => h("button", {
    role: "tab",
    "data-tab": x.id,
    "aria-selected": "false",
    onClick: () => open(x.id),
    onKeydown: (e) => {
      const at = TABS.findIndex((y) => y.id === x.id);
      const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: TABS.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      const to = TABS[(next + TABS.length) % TABS.length];
      open(to.id);
      strip.querySelector(`[data-tab="${to.id}"]`)?.focus();
    },
  }, icon(x.icon, "sm"), t(x.label.en, x.label.yue))));
  page.append(h("section", { class: "card rise wd-shell" }, strip, panel));
  await open(TABS.some((x) => x.id === lastTab) ? lastTab : "clients");
  const timer = setInterval(tick, Math.max(2, data.refresh) * 1000);
  return () => {
    alive = false;
    clearInterval(timer);
  };
}

export default {
  id: "wifi-diagnostics",
  screens: [{ id: "wifi-diagnostics", group: { en: "Network", yue: "網絡" }, icon: "network_check", label, render: screen }],
  settings: [{ id: "wifi-diagnostics", icon: "network_check", label, async render(ctx) { const data = await ctx.api.get("/api/domain/wifi-diagnostics"); return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)); } }],
  commands: [
    { id: "wifi-diagnostics.open", icon: "network_check", label: { en: "Open Wi-Fi diagnostics", yue: "打開 Wi-Fi 診斷" }, keywords: "wifi signal clients rssi noise radar temperature disconnect kick 訊號 客戶端 診斷", run: (ctx) => ctx.navigate("wifi-diagnostics") },
    { id: "wifi-diagnostics.busiest", icon: "leaderboard", label: { en: "Who is uploading or downloading the most", yue: "邊個上載或者下載最多" }, keywords: "busiest top talkers upload download bandwidth hog 最忙 流量 上載 下載", run: (ctx) => { lastTab = "busiest"; ctx.navigate("wifi-diagnostics"); } },
  ],
};
