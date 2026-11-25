// Port checker screen: your forwarding rules with a Check button each, a box for
// any other port, and an honest message when no check service is chosen or the
// router's internet address cannot be reached from outside at all.

const label = { en: "Port checker", yue: "端口檢查" };
const PRESETS = [[22, "SSH"], [80, "Web"], [443, "HTTPS"], [3389, "Remote desktop"], [25565, "Game server"]];

export const REASONS = {
  "no-service": ["No check service is chosen. Pick one in the settings below; none is built in.", "未揀檢查服務。喺下面嘅設定揀一個；本程式冇內置。"],
  "unreachable-service": ["The check service could not be reached from the router.", "路由器連唔到檢查服務。"],
  "service-error": ["The check service gave an error.", "檢查服務回報錯誤。"],
  "unreadable-reply": ["The service answered, but the answer was not what the settings expect.", "服務有回答，但答案同設定預期嘅唔一樣。"],
};

async function screen(ctx) {
  const { api, h, icon, t } = ctx;
  let data = await api.get("/api/domain/port-checker");
  const page = ctx.page(label, { en: "Find out whether a port you opened can really be reached from the internet.", yue: "睇吓你開咗嘅端口，喺互聯網真係連到未。" });
  ctx.root.append(page);
  const results = new Map();
  const rows = h("div", {});

  const outcome = (r) => {
    if (!r) return h("span", { class: "muted" }, "—");
    if (r.state === "open") return h("span", { class: "tag good" }, icon("check_circle", "sm"), t("Open", "已開"));
    if (r.state === "closed") return h("span", { class: "tag bad" }, icon("block", "sm"), t("Closed", "未開"));
    const [en, yue] = REASONS[r.reason] ?? ["Could not check.", "檢查唔到。"];
    return h("span", { class: "tag warn", title: r.detail ?? "" }, icon("help", "sm"), t(en, yue));
  };

  async function check(port) {
    results.set(port, null);
    draw();
    try {
      results.set(port, await api.post("/api/x/port-checker/check", { port, protocol: "tcp" }));
    } catch (error) {
      results.delete(port);
      ctx.toast(error.message, "bad");
    }
    draw();
  }

  function draw() {
    ctx.clear(rows);
    const rules = data.rules;
    rows.append(rules.length
      ? h("div", { class: "tbl" }, h("table", {}, h("thead", {}, h("tr", {}, [t("Rule", "規則"), t("Outside port", "外部端口"), t("Goes to", "轉去"), t("Type", "類型"), t("Result", "結果"), ""].map((x) => h("th", {}, x)))),
        h("tbody", {}, rules.map((r) => h("tr", {}, h("td", {}, r.name || "—"), h("td", {}, r.external), h("td", { class: "mono" }, `${r.ip}:${r.internal}`), h("td", {}, r.proto),
          h("td", {}, r.checkable ? (results.has(Number(r.external)) && results.get(Number(r.external)) === null ? h("span", { class: "muted" }, t("Checking…", "檢查緊…")) : outcome(results.get(Number(r.external)))) : h("span", { class: "muted" }, r.why === "udp" ? t("UDP cannot be checked from outside", "UDP 冇辦法由外面檢查") : t("A range: check one port by hand below", "端口範圍：喺下面逐個檢查"))),
          h("td", {}, r.checkable ? h("button", { class: "btn t sm", disabled: !ctx.state.canWrite, onClick: () => check(Number(r.external)) }, icon("travel_explore", "sm"), t("Check", "檢查")) : null))))))
      : h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("swap_horiz", "lg"), t("No port forwarding rules yet.", "未有端口轉發規則。"))));
    manualDraw();
  }

  const input = h("input", { class: "field num", type: "number", min: "1", max: "65535", inputmode: "numeric", "aria-label": t("Port to check", "要檢查嘅端口"), value: "443" });
  const manual = h("div", { class: "chips" }, input, h("button", { class: "btn f", disabled: !ctx.state.canWrite, onClick: () => { const port = Number(input.value); if (Number.isInteger(port) && port >= 1 && port <= 65535) check(port); else ctx.toast(t("Enter a port from 1 to 65535.", "請輸入 1 至 65535 嘅端口。"), "warn"); } }, icon("travel_explore", "sm"), t("Check this port", "檢查呢個端口")),
    ...PRESETS.map(([port, name]) => h("button", { class: "chip", onClick: () => { input.value = String(port); } }, `${port} · ${name}`)));
  const manualResult = h("div", {});
  const manualDraw = () => ctx.clear(manualResult).append(...[...results].filter(([port]) => !data.rules.some((r) => Number(r.external) === port)).map(([port, r]) => h("div", { class: "row" }, h("div", { class: "t1" }, `${t("Port", "端口")} ${port}`), r === null ? h("span", { class: "muted" }, t("Checking…", "檢查緊…")) : outcome(r))));

  const notices = [];
  if (!data.configured) notices.push(h("div", { class: "card warn" }, h("div", { class: "k" }, t("No check service chosen", "未揀檢查服務")), h("div", { class: "t1" }, t(REASONS["no-service"][0], REASONS["no-service"][1])), h("div", { class: "t2" }, t("Checks stay unavailable until you choose a service you trust. The service learns your internet address when you check.", "揀咗你信得過嘅服務先可以檢查。檢查時，服務會知道你嘅互聯網地址。"))));
  if (data.behindSharedAddress) notices.push(h("div", { class: "card warn" }, h("div", { class: "k" }, t("Address cannot be reached from outside", "地址由外面連唔到")), h("div", { class: "t1" }, t(`Your router's internet address is ${data.wanIp}, which is a private or shared address.`, `你路由器嘅互聯網地址係 ${data.wanIp}，屬於私人或者共用地址。`)),
    h("div", { class: "t2" }, t("Port forwarding cannot work from the internet until your provider gives you a public address.", "要等供應商俾你公共地址，端口轉發先可以由互聯網用到。"))));
  page.append(...notices, h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Your forwarding rules", "你嘅轉發規則")), rows), h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Any other port", "其他端口")), manual, manualResult),
    ...ctx.controls.appGroupCards("port-checker", data.entries, async () => { data = await api.get("/api/domain/port-checker"); }));
  draw();
}

export default {
  id: "port-checker",
  screens: [{ id: "port-checker", group: { en: "Network", yue: "網絡" }, icon: "travel_explore", label, render: screen }],
  settings: [{ id: "port-checker", icon: "travel_explore", label, async render(ctx) { const data = await ctx.api.get("/api/domain/port-checker"); return ctx.controls.appGroupCards("port-checker", data.entries); } }],
  commands: [{ id: "port-checker.open", icon: "travel_explore", label: { en: "Check an open port", yue: "檢查開咗嘅端口" }, keywords: "port open forwarding reachable check 端口 轉發", run: (ctx) => ctx.navigate("port-checker") }],
};
