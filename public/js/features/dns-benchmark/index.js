// DNS benchmark screen: runs the benchmark one name server at a time (so the
// ranking grows while it works) and can queue the winner as the router's DNS in
// the pending-changes dock.
import { barChart } from "./chart.js";

const label = { en: "DNS benchmark", yue: "DNS 測速" };

export const ms = (n) => (n === null || n === undefined ? "—" : `${Math.round(n * 10) / 10} ms`);

// Fastest median first; a name server that answered nothing goes last.
export function rank(results) {
  return [...results].sort((a, b) => (a.median === null) - (b.median === null) || a.failed - b.failed || a.median - b.median || a.ip.localeCompare(b.ip));
}

async function screen(ctx) {
  const { api, h, icon, t } = ctx;
  let data = await api.get("/api/domain/dns-benchmark");
  const page = ctx.page(label, { en: "Asks several name servers for the same names from the router and ranks how fast they answer.", yue: "由路由器向幾個域名伺服器查同一批名，再按回應速度排名。" });
  ctx.root.append(page);
  const results = new Map();
  let running = false;
  let current = "";
  const out = h("div", {});
  const status = h("div", { class: "muted", role: "status" });

  function useDns(ip) {
    const auto = ctx.state.catalog.entries.find((e) => e.id === "wan.dnsauto");
    const first = ctx.state.catalog.entries.find((e) => e.id === "wan.dns1");
    if (!auto || !first) return void ctx.toast(t("This router has no DNS setting to change here.", "呢部路由器冇可以喺度改嘅 DNS 設定。"), "warn");
    ctx.dock.setEntry(auto, "0");
    ctx.dock.setEntry(first, ip);
    ctx.toast(t(`${ip} is waiting in your pending changes.`, `${ip} 已加入待套用改動。`));
  }

  function draw() {
    ctx.clear(out);
    if (!results.size && !running) return void out.append(h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("dns", "lg"), t("Press Start to test the name servers below.", "撳「開始」測試下面嘅域名伺服器。"))));
    const done = rank([...results.values()]);
    const best = done.find((r) => r.median !== null);
    out.append(
      h("div", { class: "grid2" },
        h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Fastest first", "最快排頭")),
          done.length ? barChart({ bars: done.map((r) => ({ label: r.label.slice(0, 18), value: r.median ?? 0, cls: r === best ? "s2" : r.median === null ? "s4" : "s0", title: `${r.ip}: ${r.median === null ? "no answer" : ms(r.median)}` })), unit: " ms", label: t("Median answer time", "回應時間中位數") }) : null,
          running ? h("div", { class: "muted" }, t(`Testing ${current}…`, `測試緊 ${current}…`)) : null),
        best ? h("section", { class: "card sec rise" }, h("div", { class: "k" }, t("Fastest", "最快")), h("div", { class: "big" }, best.label), h("div", { class: "t2 mono" }, `${best.ip} · ${t("median", "中位數")} ${ms(best.median)}`),
          best.router ? h("div", { class: "t2" }, t("Your router already uses this one.", "你部路由器已經用緊呢個。")) : null,
          h("button", { class: "btn f", disabled: !ctx.state.canWrite || best.router, onClick: () => useDns(best.ip) }, icon("dns", "sm"), t("Use as my router's DNS", "設為路由器嘅 DNS"))) : null),
      done.length ? h("div", { class: "tbl" }, h("table", {}, h("thead", {}, h("tr", {}, ["#", t("Name server", "域名伺服器"), t("Median", "中位數"), t("Average", "平均"), t("Fastest", "最快"), t("Slowest", "最慢"), t("No answer", "冇回應")].map((x) => h("th", {}, x)))),
        h("tbody", {}, done.map((r, i) => h("tr", {}, h("td", {}, String(i + 1)), h("td", {}, h("div", { class: "t1" }, r.label), h("div", { class: "t2 mono" }, r.ip), r.router ? h("span", { class: "tag" }, t("Router uses it", "路由器用緊")) : null), h("td", {}, ms(r.median)), h("td", {}, ms(r.mean)), h("td", {}, ms(r.min)), h("td", {}, ms(r.max)), h("td", {}, `${r.failed} / ${r.asked}`)))))) : null);
  }

  const summary = h("span", { class: "muted" });
  const drawSummary = () => { summary.textContent = t(`${data.plan.length} name servers · ${data.names.length} names · ${data.rounds} rounds`, `${data.plan.length} 個伺服器 · ${data.names.length} 個域名 · ${data.rounds} 回合`); };
  const start = h("button", { class: "btn f", onClick: async () => {
    if (running) return;
    if (!data.plan.length || !data.names.length) return void ctx.toast(t("Choose name servers and names in the settings first.", "請先喺設定揀域名伺服器同域名。"), "warn");
    running = true;
    start.disabled = true;
    results.clear();
    for (const [i, server] of data.plan.entries()) {
      current = `${server.label} (${server.ip})`;
      status.textContent = t(`Server ${i + 1} of ${data.plan.length}`, `第 ${i + 1} / ${data.plan.length} 個伺服器`);
      draw();
      try {
        results.set(server.ip, await api.post("/api/x/dns-benchmark/bench", { ip: server.ip }));
      } catch (error) {
        ctx.toast(error.message, "bad");
        break;
      }
    }
    running = false;
    start.disabled = false;
    status.textContent = t("Finished.", "完成。");
    draw();
  } }, icon("play_arrow", "sm"), t("Start", "開始"));

  page.append(h("section", { class: "card rise" }, h("div", { class: "chips" }, start, summary), status), out,
    ...ctx.controls.appGroupCards("dns-benchmark", data.entries, async () => { data = await api.get("/api/domain/dns-benchmark"); drawSummary(); }));
  drawSummary();
  draw();
}

export default {
  id: "dns-benchmark",
  screens: [{ id: "dns-benchmark", group: { en: "Network", yue: "網絡" }, icon: "dns", label, render: screen }],
  settings: [{ id: "dns-benchmark", icon: "dns", label, async render(ctx) { const data = await ctx.api.get("/api/domain/dns-benchmark"); return ctx.controls.appGroupCards("dns-benchmark", data.entries); } }],
  commands: [{ id: "dns-benchmark.open", icon: "dns", label: { en: "Benchmark DNS servers", yue: "測試 DNS 伺服器速度" }, keywords: "dns benchmark resolver speed lookup 域名 速度", run: (ctx) => ctx.navigate("dns-benchmark") }],
};
