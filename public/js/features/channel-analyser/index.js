// Channel analyser screen: scan a band, see the neighbours drawn over the
// channels they use, and queue the recommended channel in the pending-changes
// dock (so it gets a preview, the safety net and undo like every other edit).
import { barChart, svg } from "./chart.js";

const label = { en: "Channel analyser", yue: "頻道分析" };

// Where a network sits on the chart: 2.4 GHz channels are 5 MHz apart, so a 20 MHz network spans four channel numbers.
// Wider 5 GHz networks are drawn around their main channel number (the number is 20 MHz wide, 4 steps apart).
export function spanOf(band, network) {
  const half = band === "2.4" ? 2 : (network.width ?? 20) / 20 * 2;
  return { from: network.channel - half, to: network.channel + half };
}

export function spectrum(ctx, band, scan) {
  const { t } = ctx;
  const width = 640;
  const height = 240;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const nets = scan.networks;
  const axis = [...new Set([...scan.channels.map((c) => c.channel), ...(scan.ownChannel ? [scan.ownChannel] : [])])].sort((a, b) => a - b);
  if (!axis.length) return ctx.h("div", { class: "muted" }, t("No networks heard on this band.", "呢個頻段聽唔到網絡。"));
  const lo = band === "2.4" ? Math.min(1, axis[0]) - 2 : axis[0] - 4;
  const hi = band === "2.4" ? Math.max(11, axis.at(-1)) + 2 : axis.at(-1) + 4;
  const x = (c) => pad.l + ((width - pad.l - pad.r) * (c - lo)) / (hi - lo);
  const y = (rssi) => pad.t + (height - pad.t - pad.b) * (1 - Math.min(1, Math.max(0, (rssi + 100) / 60)));
  const base = height - pad.b;
  const root = svg("svg", { class: "mchart", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": t("Neighbouring networks by channel", "鄰近網絡按頻道分佈"), preserveAspectRatio: "xMidYMid meet" });
  for (const dbm of [-100, -85, -70, -55, -40]) root.append(svg("line", { class: "grid", x1: pad.l, x2: width - pad.r, y1: y(dbm), y2: y(dbm) }), svg("text", { class: "axis", x: pad.l - 6, y: y(dbm) + 4, "text-anchor": "end" }, String(dbm)));
  for (const c of axis) root.append(svg("text", { class: `axis ${c === scan.ownChannel ? "own" : ""}`, x: x(c), y: height - 8, "text-anchor": "middle" }, String(c)));
  if (scan.ownChannel) root.append(svg("line", { class: "own-line", x1: x(scan.ownChannel), x2: x(scan.ownChannel), y1: pad.t, y2: base }));
  nets.forEach((n, i) => {
    const s = spanOf(band, n);
    const peak = y(n.rssi);
    const mid = x(n.channel);
    root.append(svg("path", { class: `net s${i % 5}`, d: `M${x(s.from)} ${base} Q${x(s.from)} ${peak} ${mid} ${peak} Q${x(s.to)} ${peak} ${x(s.to)} ${base} Z` }, svg("title", {}, `${n.ssid || "(hidden)"} · ch ${n.channel} · ${n.rssi} dBm`)));
    root.append(svg("text", { class: "axis name", x: mid, y: peak - 4, "text-anchor": "middle" }, n.ssid || "(hidden)"));
  });
  return root;
}

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const data = await api.get("/api/domain/channel-analyser");
  const page = ctx.page(label, { en: "See which channels your neighbours use, and pick a quiet one for your own Wi-Fi.", yue: "睇吓鄰居用邊啲頻道，再幫你嘅 Wi-Fi 揀個靜啲嘅。" });
  ctx.root.append(page);
  let current = data.bands[0]?.index ?? 0;
  let scanning = false;
  const last = new Map();
  const body = h("div", {});
  const tabs = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Wi-Fi band", "Wi-Fi 頻段") });

  const drawTabs = () => {
    ctx.clear(tabs).append(...data.bands.map((b) => h("button", { role: "radio", "aria-checked": String(b.index === current), class: b.index === current ? "on" : "", onClick: () => { current = b.index; drawTabs(); draw(); } }, `${b.band} GHz`)));
  };

  function recommendation(scan) {
    const r = scan.recommendation;
    if (!r) return h("div", { class: "muted" }, t("This router offers no fixed channels to choose from.", "呢部路由器冇固定頻道可揀。"));
    const entry = ctx.state.catalog.entries.find((e) => e.id === scan.entryId);
    const use = h("button", { class: "btn f", disabled: !ctx.state.canWrite || !entry || r.keep, onClick: () => { ctx.dock.setEntry(entry, String(r.channel)); ctx.toast(t(`Channel ${r.channel} is waiting in your pending changes.`, `頻道 ${r.channel} 已加入待套用改動。`)); } }, icon("tune", "sm"), t(`Use channel ${r.channel}`, `用頻道 ${r.channel}`));
    return h("div", { class: `card ${r.keep ? "ter" : "sec"}` },
      h("div", { class: "k" }, t("Recommendation", "建議")),
      h("div", { class: "big" }, r.keep ? t("Keep it", "唔使改") : `${t("Channel", "頻道")} ${r.channel}`),
      h("div", { class: "t2" }, r.keep ? t(`Your channel${r.current ? ` (${r.current})` : ""} is already among the quietest.`, `你而家${r.current ? `（${r.current}）` : ""}已經係最靜嘅幾個之一。`)
        : r.improvement === null ? t(`The router chooses automatically. Channel ${r.channel} is the quietest one it offers.`, `路由器而家自動揀。頻道 ${r.channel} 係佢提供最靜嘅一個。`)
        : t(`About ${r.improvement}% less interference than channel ${r.current}.`, `干擾比頻道 ${r.current} 少大約 ${r.improvement}%。`)),
      use);
  }

  function draw() {
    ctx.clear(body);
    const b = data.bands.find((x) => x.index === current);
    if (!b) return void body.append(h("div", { class: "card tone" }, h("div", { class: "empty" }, t("This router reports no Wi-Fi bands.", "呢部路由器冇報告 Wi-Fi 頻段。"))));
    const scan = last.get(current);
    const run = h("button", { class: "btn f", disabled: scanning || !b.radio, onClick: async () => {
      scanning = true;
      draw();
      try {
        last.set(current, await api.get(`/api/x/channel-analyser/scan?band=${current}`));
      } catch (error) {
        ctx.toast(error.message, "bad");
      }
      scanning = false;
      draw();
    } }, icon(scanning ? "hourglass_top" : "wifi_find", "sm"), scanning ? t("Listening…", "聆聽緊…") : t("Scan this band", "掃描呢個頻段"));
    body.append(h("div", { class: "chips" }, run, b.radio ? null : h("span", { class: "pill t" }, icon("wifi_off", "sm"), t("This band's radio is off.", "呢個頻段電台未開。"))),
      h("div", { class: "muted" }, t("While scanning, devices on this band can pause for a moment.", "掃描嗰陣，呢個頻段連住嘅裝置可能會停頓一陣。")));
    if (!scan) return void body.append(h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("wifi_find", "lg"), t("Press scan to listen to the air around the router.", "撳掃描，聽吓路由器周圍嘅無線電。"))));
    body.append(
      h("div", { class: "grid2" },
        h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Networks by channel", "網絡按頻道")), spectrum(ctx, b.band, scan),
          h("div", { class: "muted" }, t(`${scan.counted} of ${scan.scanned} networks counted. Your own channel is marked.`, `${scan.scanned} 個網絡中計入 ${scan.counted} 個。你自己嘅頻道有標記。`))),
        recommendation(scan)),
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Interference by channel", "各頻道干擾")),
        barChart({ bars: scan.channels.filter((c) => c.count || scan.candidates.includes(c.channel)).map((c) => ({ label: `${t("Ch", "頻道")} ${c.channel}`, value: Math.max(0, 10 * Math.log10(c.interference || 1e-13) + 100), cls: c.channel === scan.ownChannel ? "s3" : "s0", title: `${c.count} · ${c.networks.join(", ")}` })), unit: "", max: 70, label: t("Interference by channel", "各頻道干擾") }),
        h("div", { class: "muted" }, t("Longer bar means more interference (the bar is the combined signal power, in dB above the noise floor).", "愈長代表干擾愈大（合計訊號功率，高過底噪幾多 dB）。"))),
      h("div", { class: "tbl" }, h("table", {}, h("thead", {}, h("tr", {}, [t("Network", "網絡"), t("Channel", "頻道"), t("Signal", "訊號"), t("Security", "保安"), "BSSID"].map((x) => h("th", {}, x)))),
        h("tbody", {}, scan.networks.map((n) => h("tr", {}, h("td", {}, n.ssid || h("i", {}, t("(hidden)", "（隱藏）"))), h("td", {}, `${n.channel}${n.width > 20 ? ` / ${n.width}` : ""}`), h("td", {}, `${n.rssi} dBm`), h("td", {}, n.secured ? t("Secured", "有加密") : t("Open", "開放")), h("td", { class: "mono" }, n.bssid)))))));
  }

  drawTabs();
  page.append(h("section", { class: "card rise" }, tabs, body), ...ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)));
  draw();
}

export default {
  id: "channel-analyser",
  screens: [{ id: "channel-analyser", group: { en: "Network", yue: "網絡" }, icon: "wifi_find", label, render: screen }],
  settings: [{ id: "channel-analyser", icon: "wifi_find", label, async render(ctx) { const data = await ctx.api.get("/api/domain/channel-analyser"); return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)); } }],
  commands: [{ id: "channel-analyser.open", icon: "wifi_find", label: { en: "Analyse Wi-Fi channels", yue: "分析 Wi-Fi 頻道" }, keywords: "wifi channel scan neighbour interference 頻道 掃描 干擾", run: (ctx) => ctx.navigate("channel-analyser") }],
};
