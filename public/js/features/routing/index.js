// Routing and NAT: static routes, NAT passthrough, UPnP and NAT-PMP, port
// triggering and the DMZ host. The settings come from the server as typed
// controls, including two list editors (routes and trigger rules) and a device
// address picker for the DMZ host. This screen adds what the router is doing
// right now: the routes it uses and the ports other devices asked it to open.
// Every edit waits in the pending-changes dock for a preview, the safety net
// and undo.
import { buildScreen, facts } from "./view.js";
import { tableEditor } from "./table.js";

const F = "routing";
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

let devicesLoad = null;
const knownDevices = (api) => (devicesLoad ??= api.get("/api/domain/devices").then((d) => (d.devices ?? []).filter((x) => x.ip)).catch(() => []));

export default {
  id: F,

  controls: {
    routetable: tableEditor,
    triggertable: tableEditor,
    // An address, picked from the known devices or typed. Empty means off.
    deviceip(entry, current, commit, locked, ctx) {
      const { h, icon, t, tt } = ctx;
      const input = h("input", {
        class: "field mono", value: current(), disabled: locked, autocomplete: "off", spellcheck: "false", inputmode: "decimal", maxlength: "15", "aria-label": tt(entry.label),
        placeholder: entry.optional ? t("Empty means off", "留空即係關閉") : "198.51.100.20",
        onInput(e) { const v = e.target.value.trim(); input.setAttribute("aria-invalid", String(v !== "" && !IPV4.test(v))); warn.hidden = v === ""; commit(v); },
      });
      const pick = h("select", { class: "field", disabled: locked, "aria-label": t("Choose a known device", "揀一部已知裝置"), onChange(e) {
        if (!e.target.value) return;
        input.value = e.target.value;
        input.setAttribute("aria-invalid", "false");
        warn.hidden = false;
        commit(e.target.value);
        e.target.value = "";
      } }, h("option", { value: "" }, t("Pick a device…", "揀裝置…")));
      knownDevices(ctx.api).then((list) => pick.append(...list.map((d) => h("option", { value: d.ip }, `${d.name ?? d.mac} · ${d.ip}`))));
      const clear = h("button", { class: "btn t sm", type: "button", disabled: locked, onClick() { input.value = ""; warn.hidden = true; commit(""); } }, icon("block", "sm"), t("Turn off", "關閉"));
      const warn = h("div", { class: "note", hidden: current() === "" }, icon("warning"), t("Every unrequested connection from the internet now reaches this device. Only use a device that protects itself.", "而家所有互聯網嚟、冇人要求嘅連線，都會去呢部裝置。請只用有自我防護嘅裝置。"));
      return { el: h("div", { class: "edtable-wrap" }, input, pick, locked ? null : clear, warn), sync() { input.value = current(); warn.hidden = current() === ""; } };
    },
  },

  screens: [{
    id: F,
    group: { en: "Network", yue: "網絡" },
    icon: "route",
    label: { en: "Routing and NAT", yue: "路由同 NAT" },
    render: (ctx) => buildScreen(ctx, {
      id: F,
      title: { en: "Routing and NAT", yue: "路由同 NAT" },
      lede: { en: "Send traffic for other networks the right way, let VPNs and calls through, and decide which ports devices may open.", yue: "將去其他網絡嘅流量送去啱嘅路，等 VPN 同通話通過，同埋決定裝置可以開邊啲端口。" },
      before: (data, ctx2) => overview(ctx2, data),
    }),
  }],
};

function overview(ctx, data) {
  const { h, icon, t } = ctx;
  const routes = data.kernel.length
    ? data.kernel.map((r) => h("div", { class: "row" }, icon("route", "sm"),
      h("div", { class: "grow mono" }, `${r.network}/${r.prefix}`, r.gateway ? ` → ${r.gateway}` : ` (${t("directly connected", "直接連接")})`),
      h("span", { class: "t2" }, `${r.iface} · ${t("metric", "成本")} ${r.metric}`)))
    : [h("div", { class: "t2" }, t("The router did not report its routes.", "路由器冇回報路由。"))];
  const mappings = data.mappings.length
    ? data.mappings.map((m) => h("div", { class: "row" }, icon("lock_open", "sm"),
      h("div", { class: "grow mono" }, `${m.proto} ${m.outsidePort} → ${m.device}:${m.devicePort}`),
      h("span", { class: "t2" }, m.description || "")))
    : [h("div", { class: "t2" }, t("No device has asked the router to open a port.", "冇裝置要求路由器開端口。"))];
  return h("section", { class: "card tone rise" },
    h("h2", { class: "h2" }, icon("monitoring", "sm"), " ", t("What the router is doing now", "路由器而家嘅狀況")),
    facts(ctx, [
      { label: { en: "Static routes", yue: "靜態路由" }, value: data.staticRoutes },
      { label: { en: "Routes in use", yue: "使用中路由" }, value: data.kernel.length },
      { label: { en: "Ports opened by devices", yue: "裝置開咗嘅端口" }, value: data.mappings.length },
      { label: { en: "DMZ host", yue: "DMZ 主機" }, value: data.dmz || t("off", "關閉"), tone: data.dmz ? "warn" : "" },
    ]),
    h("h3", { class: "t1" }, t("Routes in use", "使用中路由")), routes,
    h("h3", { class: "t1" }, t("Ports opened by UPnP", "UPnP 開咗嘅端口")), mappings);
}
