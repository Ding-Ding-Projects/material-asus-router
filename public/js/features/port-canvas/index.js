// Ports and VLAN canvas: the back of the router, drawn. Drag the IPTV box role
// onto a LAN port (or pick a port with the keyboard), choose the provider's
// profile and see which VLAN ids the internet, IPTV and phone traffic carry.
// Edits wait in the pending-changes dock, so they are previewed under the safety
// net and undoable.
import { draggable } from "./drag.js";
import { LAN_PORTS, assignIptv, partnerOf, portsFor, profileIds, roleOf, togglePair, valueFor, validVlan } from "./model.js";

// Appends children, skipping empty ones and flattening lists. (The native append would print "null" for a gap.)
function add(el, ...kids) {
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}
const fill = (el, ...kids) => (el.replaceChildren(), add(el, ...kids));

const label = { en: "Ports and VLAN canvas", yue: "接口同 VLAN 畫布" };
const lede = { en: "The back of your router. Drag the IPTV box onto the port its set-top box is plugged into.", yue: "你部路由器嘅背面。將 IPTV 機頂盒拖去佢插住嗰個接口。" };
const REFRESH_MS = 15000;
const ROLES = [["internet", "Internet", "互聯網"], ["iptv", "IPTV", "IPTV"], ["voip", "Phone (VoIP)", "電話（VoIP）"]];

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const canWrite = ctx.state.canWrite;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  let data = await api.get("/api/domain/internet-pro");
  let selected = null;
  const panel = h("div", { class: "pc-panel" });
  const side = h("section", { class: "card rise pc-side", "aria-live": "polite" });
  const entry = (id) => data.entries.find((e) => e.id === `internet-pro.${id}`);
  const valueOf = (e) => (e && ctx.dock.has(e.id) ? ctx.dock.value(e.id) : e?.value);
  const zones = () => [...panel.querySelectorAll("[data-port]")];
  const guard = () => (canWrite ? true : (ctx.toast(t("Your role can only look.", "你嘅角色只可以睇。"), "warn"), false));
  const stage = (e, value) => {
    if (!e || e.disabled || value === null || !guard()) return;
    ctx.dock.setEntry(e, value);
    draw();
  };

  function socket(kind, port, stb, pending) {
    const role = kind === "wan" ? "wan" : roleOf(port, stb);
    const on = selected === (kind === "wan" ? "wan" : port);
    const el = h("button", { type: "button", class: `pc-port ${kind} ${role}${on ? " sel" : ""}${pending && role === "iptv" ? " waiting" : ""}`, "data-port": kind === "wan" ? "wan" : String(port), "aria-pressed": String(on),
      "aria-label": kind === "wan" ? t("Internet port", "互聯網接口") : `LAN ${port}: ${role === "iptv" ? t("IPTV box", "IPTV 機頂盒") : t("ordinary devices", "一般裝置")}`,
      onClick() { selected = kind === "wan" ? "wan" : port; draw(); } },
    h("span", { class: "pc-hole" }, icon(kind === "wan" ? "public" : role === "iptv" ? "tv" : "lan", "sm")),
    h("span", { class: "pc-name" }, kind === "wan" ? t("Internet", "互聯網") : `LAN ${port}`),
    role === "iptv" ? h("span", { class: "tag good" }, t("IPTV", "IPTV")) : null);
    return el;
  }

  function vlanRows(profile) {
    const manual = profile === "manual";
    const fixed = profileIds(data.profiles, profile);
    return h("div", { class: "pc-vlans" }, ROLES.map(([id, en, yue]) => {
      const idEntry = entry(`vlan-${id}`);
      const prioEntry = entry(`prio-${id}`);
      const given = fixed.find((f) => f.name === id);
      const shown = manual ? valueOf(idEntry) : given ? String(given.id) : "0";
      const field = h("input", { class: "field pc-id", inputmode: "numeric", maxlength: "4", value: shown, disabled: !canWrite || !manual || !idEntry || Boolean(idEntry.disabled), "aria-label": `${t(en, yue)} VLAN`,
        onChange(ev) {
          if (!validVlan(ev.target.value)) return (ctx.toast(t("A VLAN id is 0 for untagged, or 2 to 4094.", "VLAN 編號係 0（唔加標籤）或者 2 至 4094。"), "warn"), draw());
          stage(idEntry, String(Number(ev.target.value)));
        } });
      const prio = h("input", { class: "field pc-id", type: "number", min: "0", max: "7", value: valueOf(prioEntry) ?? "0", disabled: !canWrite || !manual || !prioEntry || Boolean(prioEntry?.disabled), "aria-label": `${t(en, yue)} ${t("priority", "優先級")}`, onChange: (ev) => stage(prioEntry, String(Math.min(7, Math.max(0, Number(ev.target.value) || 0)))) });
      return h("div", { class: "pc-vrow" }, h("b", {}, t(en, yue)), h("label", {}, h("span", { class: "t2" }, "VLAN"), field), h("label", {}, h("span", { class: "t2" }, t("Priority", "優先級")), prio),
        !manual && !given ? h("span", { class: "tag" }, t("untagged", "唔加標籤")) : null);
    }));
  }

  function drawSide(stb, profile) {
    ctx.clear(side);
    const stbEntry = entry("stb");
    if (selected === null) return void add(side, h("div", { class: "empty" }, icon("touch_app", "lg"), t("Pick a port on the router.", "喺路由器揀一個接口。")));
    if (selected === "wan") return void add(side, h("div", { class: "k" }, t("Internet port", "互聯網接口")), h("h2", { class: "h2" }, t("Where your provider plugs in", "供應商插線嘅位置")), h("div", { class: "muted" }, t("This port carries the internet. Its VLAN id (if your provider uses one) is set below.", "呢個接口接互聯網。如果供應商用 VLAN，編號喺下面設定。")));
    const ports = portsFor(stb);
    const partner = partnerOf(selected);
    const iptv = ports.includes(selected);
    add(side, h("div", { class: "k" }, `LAN ${selected}`), h("h2", { class: "h2" }, iptv ? t("IPTV box", "IPTV 機頂盒") : t("Ordinary devices", "一般裝置")),
      h("div", { class: "seg", role: "radiogroup", "aria-label": t("Role of this port", "呢個接口嘅用途") },
        h("button", { type: "button", role: "radio", "aria-checked": String(!iptv), class: iptv ? "" : "on", disabled: !canWrite || !stbEntry || Boolean(stbEntry.disabled), onClick: () => stage(stbEntry, valueFor(ports.filter((p) => p !== selected))) }, t("Ordinary devices", "一般裝置")),
        h("button", { type: "button", role: "radio", "aria-checked": String(iptv), class: iptv ? "on" : "", disabled: !canWrite || !stbEntry || Boolean(stbEntry.disabled), onClick: () => stage(stbEntry, assignIptv(stb, selected)) }, t("IPTV box", "IPTV 機頂盒"))),
      iptv && partner ? h("button", { type: "button", class: "btn t sm", disabled: !canWrite, onClick: () => stage(stbEntry, togglePair(stb, selected)) }, icon(ports.includes(partner) ? "link_off" : "add_link", "sm"), ports.includes(partner) ? t(`Stop using LAN ${partner} too`, `唔再同時用 LAN ${partner}`) : t(`Use LAN ${partner} too`, `同時用 LAN ${partner}`)) : null,
      iptv && profile === "none" ? h("div", { class: "note warn" }, icon("info"), t("No provider profile is chosen, so the router has no VLAN ids to tag the IPTV traffic with. Choose a profile below.", "未揀供應商設定檔，路由器冇 VLAN 編號俾 IPTV 流量用。請喺下面揀一個設定檔。")) : null);
  }

  function draw() {
    const stbEntry = entry("stb");
    const stb = valueOf(stbEntry) ?? "0";
    const profileEntry = entry("profile");
    const profile = valueOf(profileEntry) ?? "none";
    const pending = stbEntry && ctx.dock.has(stbEntry.id);
    const chip = h("div", { class: "pc-role", role: "note" }, icon("tv", "sm"), h("span", {}, t("IPTV box", "IPTV 機頂盒")), icon("drag_indicator", "sm"));
    if (canWrite && stbEntry && !stbEntry.disabled) draggable(chip, { zones, enabled: () => canWrite, onDrop: (zone) => zone.dataset.port !== "wan" && stage(stbEntry, assignIptv(stb, Number(zone.dataset.port))) });
    fill(panel, 
      h("div", { class: "pc-palette" }, h("span", { class: "t2" }, t("Drag onto a port:", "拖去一個接口：")), chip, h("button", { type: "button", class: "btn o sm", disabled: !canWrite || stb === "0" || !stbEntry, onClick: () => stage(stbEntry, "0") }, icon("close", "sm"), t("No IPTV port", "冇 IPTV 接口"))),
      h("div", { class: "pc-back", role: "group", "aria-label": t("Back of the router", "路由器背面") }, socket("wan", 0, stb, pending), h("span", { class: "pc-gap", "aria-hidden": "true" }), LAN_PORTS.map((p) => socket("lan", p, stb, pending))),
      h("div", { class: "pc-profile" },
        h("label", { class: "me-field" }, h("span", {}, profileEntry ? tt(profileEntry.label) : ""),
          profileEntry ? h("select", { class: "field", disabled: !canWrite || Boolean(profileEntry.disabled), onChange: (ev) => stage(profileEntry, ev.target.value) }, profileEntry.options.map(([v, l]) => h("option", { value: v, selected: v === profile }, tt(l)))) : null),
        vlanRows(profile),
        profile === "manual" ? null : h("div", { class: "t2" }, t("Pick Manual to type your own VLAN ids.", "揀「手動」就可以自己輸入 VLAN 編號。")),
        profileEntry?.meta?.note ? h("div", { class: "t2" }, tt(profileEntry.meta.note)) : null,
        h("div", { class: "note" }, icon("construction"), h("div", {}, h("b", {}, t("In progress: ", "進行中：")), t("The link speed of each port is not read yet, so the ports show their role only.", "暫時未讀每個接口嘅連線速度，所以接口只顯示用途。")))));
    drawSide(stb, profile);
  }

  add(page, h("section", { class: "card rise" }, panel), side);
  draw();

  const refresh = async () => {
    if (ctx.dock.count() > 0 || document.hidden) return;
    try {
      data = await api.get("/api/domain/internet-pro");
      draw();
    } catch {
      /* The next refresh tries again. */
    }
  };
  const timer = setInterval(refresh, REFRESH_MS);
  const off = ctx.bus.on("dock", () => ctx.dock.count() === 0 && refresh());
  return () => (clearInterval(timer), off());
}

export default {
  id: "port-canvas",
  screens: [{ id: "port-canvas", group: { en: "Network", yue: "網絡" }, icon: "settings_ethernet", label, render: screen }],
  commands: [{ id: "port-canvas.open", icon: "settings_ethernet", label: { en: "Open the ports and VLAN canvas", yue: "開啟接口同 VLAN 畫布" }, keywords: "port vlan iptv lan wan provider profile tag 接口 機頂盒 標籤", run: (ctx) => ctx.navigate("port-canvas") }],
};
