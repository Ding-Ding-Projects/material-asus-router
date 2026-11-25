// Live overview: link status, uptime, load, memory, temperatures and
// traffic charts, refreshed every two seconds while the screen is open.
import { api, formatRate, formatUptime, h, icon, t, tt } from "../core.js";
import { header } from "./common.js";

const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

function chart() {
  const el = svg("svg", { class: "chart", viewBox: "0 0 600 150", preserveAspectRatio: "none", role: "img", "aria-label": t("Internet traffic over the last two minutes", "最近兩分鐘嘅上網流量") });
  for (const y of [37, 75, 112]) el.append(svg("line", { class: "grid-line", x1: 0, x2: 600, y1: y, y2: y }));
  const rx = svg("path", { class: "rx" });
  const tx = svg("path", { class: "tx" });
  el.append(rx, tx);
  return {
    el,
    draw(rxSeries, txSeries) {
      const max = Math.max(1e6, ...rxSeries, ...txSeries) * 1.15;
      const path = (series) => {
        if (series.length < 2) return "";
        const step = 600 / 59;
        const points = series.map((v, i) => `${((59 - (series.length - 1 - i)) * step).toFixed(1)},${(148 - (v / max) * 140).toFixed(1)}`);
        return `M${points.join("L")}`;
      };
      const area = (series) => (series.length < 2 ? "" : `${path(series)}L600,150L${(((59 - (series.length - 1)) * 600) / 59).toFixed(1)},150Z`);
      rx.setAttribute("d", area(rxSeries));
      tx.setAttribute("d", area(txSeries));
    },
  };
}

export async function overview(root) {
  const rxSeries = [];
  const txSeries = [];
  const ui = {
    wanTag: h("span", { class: "tag" }),
    wanIp: h("div", { class: "big" }),
    wanMeta: h("div", {}),
    uptime: h("div", { class: "big" }),
    load: h("div", { class: "big" }),
    memText: h("div", { class: "t1" }),
    memBar: h("div", { class: "meter" }, h("i")),
    cpu: h("div", { class: "big" }),
    radios: h("div", {}),
    rx: h("div", { class: "big" }),
    tx: h("div", { class: "big" }),
    devices: h("div", { class: "big" }),
    devicesMeta: h("div", { class: "t2" }),
    stale: h("div", { class: "note warn", hidden: true }, icon("wifi_off"), t("Live data paused. Trying again…", "即時資料暫停，重試緊…")),
    model: h("div", { class: "t2 mono" }),
  };
  const traffic = chart();
  root.append(
    h("div", { class: "page" },
      header("overview"),
      ui.stale,
      h("div", { class: "grid2" },
        h("section", { class: "card hero rise" }, h("div", { class: "k" }, t("Internet", "互聯網")), ui.wanTag, ui.wanIp, ui.wanMeta, ui.model),
        h("section", { class: "card rise" }, h("div", { class: "k" }, t("Traffic now", "而家流量")),
          h("div", { class: "grid" }, h("div", {}, h("div", { class: "t2" }, t("Download", "下載")), ui.rx), h("div", {}, h("div", { class: "t2" }, t("Upload", "上載")), ui.tx)),
          traffic.el,
          h("div", { class: "legend" }, h("span", {}, h("i", { class: "lg-rx" }), t("Download", "下載")), h("span", {}, h("i", { class: "lg-tx" }), t("Upload", "上載"))))),
      h("div", { class: "grid" },
        h("section", { class: "card sec rise" }, h("div", { class: "k" }, t("Devices online", "在線裝置")), ui.devices, ui.devicesMeta),
        h("section", { class: "card rise" }, h("div", { class: "k" }, t("Running for", "已運行")), ui.uptime),
        h("section", { class: "card rise" }, h("div", { class: "k" }, t("Load (1, 5, 15 min)", "負載（1、5、15 分鐘）")), ui.load),
        h("section", { class: "card rise" }, h("div", { class: "k" }, t("Memory", "記憶體")), ui.memText, ui.memBar),
        h("section", { class: "card ter rise" }, h("div", { class: "k" }, t("Processor temperature", "處理器溫度")), ui.cpu),
        h("section", { class: "card rise" }, h("div", { class: "k" }, t("Wi-Fi radios", "Wi-Fi 無線電")), ui.radios))),
  );
  for (const [selector, color] of [[".lg-rx", "var(--primary)"], [".lg-tx", "var(--tertiary)"]]) root.querySelector(selector).style.setProperty("background", color);

  const paint = (d) => {
    ui.stale.hidden = true;
    ui.wanTag.className = `tag ${d.wan.connected ? "good" : "bad"}`;
    ui.wanTag.replaceChildren(icon(d.wan.connected ? "check_circle" : "error", "sm"), d.wan.connected ? t("Connected", "已連線") : t("Not connected", "未連線"));
    ui.wanIp.textContent = d.wan.ip || "—";
    ui.wanMeta.textContent = `${t("Gateway", "閘道")} ${d.wan.gateway || "—"} · ${d.wan.proto || "—"} · DNS ${d.wan.dns.join(", ") || "—"}`;
    ui.model.textContent = `${d.info.model} · ${d.info.firmware}${d.info.merlin ? " · Merlin" : ""}`;
    ui.uptime.textContent = formatUptime(d.uptimeSeconds);
    ui.load.textContent = d.load.map((n) => n.toFixed(2)).join("  ");
    ui.memText.textContent = `${Math.round(d.memory.usedKb / 1024)} MB / ${Math.round(d.memory.totalKb / 1024)} MB · ${d.memory.usedPct}%`;
    ui.memBar.firstChild.style.setProperty("--w", `${d.memory.usedPct}%`);
    ui.memBar.className = `meter ${d.memory.usedPct > 90 ? "bad" : d.memory.usedPct > 75 ? "warn" : ""}`;
    ui.cpu.textContent = d.cpuTempC === null ? "—" : `${d.cpuTempC} °C`;
    ui.radios.replaceChildren(...d.radios.map((r) => h("div", { class: "row" }, h("span", { class: `dot ${r.on ? "" : "off"}` }), h("div", { class: "grow t1" }, r.band), h("span", { class: "muted" }, r.tempC === null ? "—" : `${r.tempC} °C`))));
    const [rxv, rxu] = formatRate(d.traffic.rxBitsPerSecond);
    const [txv, txu] = formatRate(d.traffic.txBitsPerSecond);
    ui.rx.replaceChildren(rxv, h("small", {}, rxu));
    ui.tx.replaceChildren(txv, h("small", {}, txu));
    rxSeries.push(d.traffic.rxBitsPerSecond);
    txSeries.push(d.traffic.txBitsPerSecond);
    if (rxSeries.length > 60) (rxSeries.shift(), txSeries.shift());
    traffic.draw(rxSeries, txSeries);
  };

  let alive = true;
  let busy = false;
  const poll = async () => {
    if (!alive || busy || document.hidden) return;
    busy = true;
    try {
      paint(await api.get("/api/domain/overview"));
    } catch {
      ui.stale.hidden = false;
    } finally {
      busy = false;
    }
  };
  api.get("/api/domain/devices").then((d) => {
    ui.devices.textContent = String(d.summary.online);
    ui.devicesMeta.textContent = t(`${d.summary.wireless} on Wi-Fi, ${d.summary.total} known`, `${d.summary.wireless} 部用 Wi-Fi，已知 ${d.summary.total} 部`);
  }).catch(() => {});
  await poll();
  const timer = setInterval(poll, 2000);
  return () => {
    alive = false;
    clearInterval(timer);
  };
}
