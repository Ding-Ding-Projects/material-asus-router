// VPN Director canvas: devices on one side, ways out on the other. Drag a
// device onto "The internet directly" or onto a VPN tunnel to route it there,
// or pick the way out from the menu on its card. Edits wait in the
// pending-changes dock, so they are previewed and undoable.
import { draggable } from "./drag.js";
import { canDropOn, isTarget, laneOf, readRules, route, writeRules } from "./model.js";

const label = { en: "VPN Director canvas", yue: "VPN Director 畫布" };
const lede = { en: "Choose which way out each device uses: the internet directly, or one of your VPN tunnels.", yue: "揀每部裝置用邊條出路：直接上網，定係你其中一條 VPN 隧道。" };
const REFRESH_MS = 15000;

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const canWrite = ctx.state.canWrite;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  let data = await api.get("/api/domain/vpn-director-canvas");
  const devices = ((await api.get("/api/domain/devices").catch(() => ({ devices: [] }))).devices ?? []).filter((d) => d.ip);
  const lanes = h("div", { class: "vd-lanes" });
  const head = h("div", { class: "chips" });
  const entry = () => data.entries.find((e) => e.id === "vpn-director-canvas.rules");
  const switchEntry = () => ctx.state.catalog.entries.find((e) => e.id === data.enableEntryId);
  const valueOf = (e) => (ctx.dock.has(e.id) ? ctx.dock.value(e.id) : e.value);
  const rules = () => readRules(valueOf(entry()));
  const zones = () => [...lanes.querySelectorAll("[data-iface]")];
  const nameOf = (ip) => devices.find((d) => d.ip === ip)?.name ?? ip;
  const save = (next) => {
    if (!canWrite) return ctx.toast(t("Your role can only look.", "你嘅角色只可以睇。"), "warn");
    ctx.dock.setEntry(entry(), writeRules(next));
    draw();
  };
  const send = (device, iface) => save(route(rules(), device, iface));

  // ---- when the screen cannot be used ----
  const disabled = !data.merlin ? entry()?.disabled : !data.present ? { en: `This router does not have the setting ${data.missing.join(" or ")}.`, yue: `呢部路由器冇 ${data.missing.join(" 或者 ")} 呢個設定。` } : null;
  if (disabled || !entry()) {
    page.append(h("section", { class: "card rise" }, h("div", { class: "empty" }, icon("alt_route", "lg"), disabled ? tt(disabled) : t("This router has no VPN Director.", "呢部路由器冇 VPN Director。"))));
    return;
  }

  function deviceChip(d, lane) {
    const chip = h("div", { class: `vd-dev${lane ? " routed" : ""}`, tabindex: "-1" },
      icon("drag_indicator", "sm"),
      h("span", { class: "vd-name" }, d.name),
      h("span", { class: "t2 mono" }, d.ip),
      h("label", { class: "visually-hidden", for: `vd-${d.mac || d.ip}` }, `${t("Way out for", "出路：")} ${d.name}`),
      h("select", { id: `vd-${d.mac || d.ip}`, class: "field vd-select", disabled: !canWrite, onChange: (e) => send(d, e.target.value) },
        h("option", { value: "", selected: lane === "" }, t("Default (no rule)", "預設（冇規則）")),
        data.tunnels.map((x) => h("option", { value: x.id, selected: x.id === lane, disabled: !canDropOn(x, rules()) && x.id !== lane }, `${tt(x.name)}${x.configured ? "" : ` (${t("not set up", "未設定")})`}`))));
    if (canWrite) draggable(chip, { zones, enabled: () => canWrite, onDrop: (zone) => send(d, zone.dataset.iface) });
    return chip;
  }

  function ruleChip(r) {
    const limited = h("div", { class: `vd-dev routed${r.enabled ? "" : " off"}` },
      icon("alt_route", "sm"), h("span", { class: "vd-name" }, `${nameOf(r.local)}`), h("span", { class: "tag" }, `${t("only to", "只去")} ${r.remote}`),
      h("button", { type: "button", class: "chip", role: "switch", "aria-checked": String(r.enabled), disabled: !canWrite, onClick: () => save(rules().map((x) => (x.index === r.index ? { ...x, enabled: !x.enabled } : x))) }, r.enabled ? t("On", "開") : t("Off", "關")),
      h("button", { type: "button", class: "btn o sm icon", disabled: !canWrite, "aria-label": `${t("Remove the rule for", "移除規則：")} ${nameOf(r.local)}`, onClick: () => save(rules().filter((x) => x.index !== r.index).map((x, i) => ({ ...x, index: i }))) }, icon("delete", "sm")));
    return limited;
  }

  function laneBox(tunnel, all) {
    const here = all.filter((r) => r.iface === tunnel.id);
    const open = canDropOn(tunnel, all);
    const everywhere = devices.filter((d) => laneOf(all, d.ip) === tunnel.id);
    const limited = here.filter((r) => r.remote !== "");
    return h("section", { class: `vd-lane${open ? "" : " closed"}`, "data-iface": open ? tunnel.id : null, "aria-label": tt(tunnel.name) },
      h("div", { class: "vd-lanehead" }, icon(tunnel.kind === "wan" ? "public" : "vpn_lock"), h("b", {}, tt(tunnel.name)), h("span", { class: "t2" }, tunnel.id),
        !tunnel.configured ? h("span", { class: "tag" }, t("Not set up", "未設定")) : null,
        tunnel.kind === "openvpn" && tunnel.configured && !tunnel.followsPolicy ? h("span", { class: "tag warn", title: t("Set this connection to follow policy rules, or its rules do nothing.", "將呢條連線設為跟政策規則，否則佢嘅規則冇作用。") }, icon("warning", "sm"), t("Ignores rules", "唔跟規則")) : null),
      everywhere.map((d) => deviceChip(d, tunnel.id)), limited.map(ruleChip),
      everywhere.length || limited.length ? null : h("div", { class: "vd-none" }, open ? t("Drop a device here", "將裝置放呢度") : t("Set this tunnel up under VPN first.", "請先喺 VPN 設定呢條隧道。")));
  }

  function draw() {
    const all = rules();
    const sw = switchEntry();
    const on = sw ? (ctx.dock.has(sw.id) ? ctx.dock.value(sw.id) : sw.value) === sw.values.on : data.enabled;
    ctx.clear(head).append(sw ? h("button", { type: "button", class: `chip${on ? " on" : ""}`, role: "switch", "aria-checked": String(on), disabled: !canWrite || Boolean(sw.disabled), onClick() { ctx.dock.setEntry(sw, on ? sw.values.off : sw.values.on); draw(); } }, icon(on ? "toggle_on" : "toggle_off", "sm"), on ? t("VPN Director is on", "VPN Director 已開") : t("VPN Director is off: the rules below do nothing yet", "VPN Director 已關：下面嘅規則暫時冇作用")) : null,
      h("button", { type: "button", class: "btn t sm", disabled: !canWrite, onClick: addDestination }, icon("add_road", "sm"), t("Rule for one destination", "只針對一個目的地嘅規則")));
    const unrouted = devices.filter((d) => laneOf(all, d.ip) === "");
    ctx.clear(lanes).append(
      h("section", { class: "vd-lane tray", "data-iface": "", "aria-label": t("Devices without a rule", "冇規則嘅裝置") }, h("div", { class: "vd-lanehead" }, icon("devices"), h("b", {}, t("No rule", "冇規則")), h("span", { class: "t2" }, t("They use the router's default route", "用路由器預設路線"))), unrouted.map((d) => deviceChip(d, "")), unrouted.length ? null : h("div", { class: "vd-none" }, t("Every device has a rule.", "每部裝置都有規則。"))),
      data.tunnels.map((x) => laneBox(x, all)));
  }

  function addDestination() {
    ctx.openDialog((close) => {
      const who = h("select", { class: "field", "aria-label": t("Device", "裝置") }, devices.map((d) => h("option", { value: d.ip }, `${d.name} · ${d.ip}`)));
      const where = h("input", { class: "field", maxlength: "18", placeholder: "203.0.113.0/24", "aria-label": t("Destination address or network", "目的地地址或者網絡") });
      const via = h("select", { class: "field", "aria-label": t("Send through", "經呢條出路") }, data.tunnels.filter((x) => canDropOn(x, rules())).map((x) => h("option", { value: x.id }, tt(x.name))));
      const error = h("div", { class: "note bad", hidden: true, role: "alert" });
      return [h("h2", { class: "h2" }, t("Rule for one destination", "只針對一個目的地嘅規則")),
        h("label", { class: "me-field" }, h("span", {}, t("Device", "裝置")), who), h("label", { class: "me-field" }, h("span", {}, t("Only when going to", "只當去緊")), where), h("label", { class: "me-field" }, h("span", {}, t("Send through", "經呢條出路")), via), error,
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { type: "button", class: "btn f", onClick() {
          if (!who.value) return (error.hidden = false, void (error.textContent = t("There is no device to choose yet.", "暫時未有裝置可揀。")));
          if (!isTarget(where.value.trim())) return (error.hidden = false, void (error.textContent = t("Enter an IPv4 address such as 203.0.113.9, or a network such as 203.0.113.0/24.", "請輸入 IPv4 地址（例如 203.0.113.9）或者網絡（例如 203.0.113.0/24）。")));
          const all = rules();
          save([...all, { index: all.length, enabled: true, desc: `${nameOf(who.value)} → ${where.value.trim()}`.slice(0, 32), local: who.value, remote: where.value.trim(), iface: via.value }]);
          close(true);
        } }, icon("add", "sm"), t("Add to pending changes", "加入待套用變更")))];
    }, { label: t("Rule for one destination", "只針對一個目的地嘅規則") });
  }

  page.append(h("section", { class: "card rise" }, head), lanes);
  draw();

  const refresh = async () => {
    if (ctx.dock.count() > 0 || document.hidden) return;
    try {
      data = await api.get("/api/domain/vpn-director-canvas");
      draw();
    } catch {
      /* The next refresh tries again. */
    }
  };
  const timer = setInterval(refresh, REFRESH_MS);
  const off = ctx.bus.on("dock", () => ctx.dock.count() === 0 && refresh());
  return () => (clearInterval(timer), off());
}

// Wherever the rule list shows up as a setting, show it decoded and send the person to the canvas.
function rulesControl(entry, current, _commit, _locked, ctx) {
  const { h, icon, t } = ctx;
  const list = h("ol", { class: "vd-column" });
  const draw = () => {
    ctx.clear(list).append(...readRules(current()).map((r) => h("li", {}, `${r.enabled ? "" : `${t("off", "關")}: `}${r.desc} (${r.local}${r.remote ? ` → ${r.remote}` : ""} → ${r.iface})`)));
    if (!list.children.length) list.append(h("li", { class: "muted" }, t("No rules", "冇規則")));
  };
  draw();
  return { el: h("div", {}, list, h("button", { class: "btn t sm", type: "button", onClick: () => ctx.navigate("vpn-director-canvas") }, icon("open_in_new", "sm"), t("Edit on the VPN Director canvas", "喺 VPN Director 畫布編輯"))), sync: draw };
}

export default {
  id: "vpn-director-canvas",
  controls: { "director-rules": rulesControl },
  screens: [{ id: "vpn-director-canvas", group: { en: "Network", yue: "網絡" }, icon: "alt_route", label, render: screen }],
  commands: [{ id: "vpn-director-canvas.open", icon: "alt_route", label: { en: "Open the VPN Director canvas", yue: "開啟 VPN Director 畫布" }, keywords: "vpn director route device tunnel wireguard openvpn policy 隧道 路由 裝置", run: (ctx) => ctx.navigate("vpn-director-canvas") }],
};
