// Network map editor. The router, its AiMesh nodes and every device are drawn as
// a map. Pick a device (or drag it) to rename it, keep its address or cut it off
// the internet. Nothing reaches the router from here: each edit is staged as a
// list edit in the pending-changes dock, then previewed, guarded and undoable.
import { draggable } from "./drag.js";
import { gradeCopy, shortName } from "./model.js";

// Appends children, skipping empty ones and flattening lists. (The native append would print "null" for a gap.)
function add(el, ...kids) {
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}
const fill = (el, ...kids) => (el.replaceChildren(), add(el, ...kids));

const label = { en: "Network map editor", yue: "網絡地圖編輯器" };
const lede = { en: "Pick a device to rename it, keep its address or block it. Drag a device onto Block or Keep address to do the same.", yue: "揀一部裝置就可以改名、留住地址或者封鎖。將裝置拖去「封鎖」或者「留住地址」都得。" };
const REFRESH_MS = 8000;

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const canWrite = ctx.state.canWrite;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  let data = await api.get("/api/domain/map-editor");
  let selected = null;
  let timer = null;
  const layers = { links: true, signal: true, quality: true };
  const pending = new Set();

  const host = h("div", { class: "me-stage" });
  const panel = h("section", { class: "card rise me-panel", "aria-live": "polite" });
  const trays = h("div", { class: "me-trays" });
  const layerBar = h("div", { class: "chips", role: "group", "aria-label": t("Map layers", "地圖圖層") });
  const zones = () => [...page.querySelectorAll("[data-zone]")];
  const deviceOf = (mac) => data.devices.find((d) => d.mac === mac);

  function stage(op, summary, apply) {
    if (!canWrite) return ctx.toast(t("Your role can only look. Ask the owner for operator access to change things.", "你嘅角色只可以睇。要改嘢請搵擁有者俾你操作員權限。"), "warn");
    ctx.dock.addOp(op, summary);
    apply();
    pending.add(op.mac);
    draw();
  }

  const rename = (d, name) => stage({ op: "rename", mac: d.mac, name }, `${t("Rename", "改名")} ${d.name} → ${name || t("(its own name)", "（原本嘅名）")}`, () => {
    d.customName = name;
    d.name = name || d.host || d.ip;
  });
  const reserve = (d, ip) => stage({ op: "reserve", mac: d.mac, ip, hostname: d.host }, `${t("Keep address", "留住地址")} ${d.name} → ${ip}`, () => (d.reserved = ip));
  const unreserve = (d) => stage({ op: "unreserve", mac: d.mac }, `${t("Release address of", "放開地址：")} ${d.name}`, () => (d.reserved = ""));
  const block = (d, blocked) => stage({ op: "block", mac: d.mac, name: d.name, blocked }, `${blocked ? t("Block", "封鎖") : t("Let back online", "解除封鎖")} ${d.name}`, () => (d.blocked = blocked));

  function deviceChip(d) {
    const chip = h("button", {
      type: "button",
      class: `me-dev${selected === d.mac ? " sel" : ""}${d.blocked ? " blocked" : ""}${pending.has(d.mac) ? " waiting" : ""}`,
      "data-mac": d.mac,
      "aria-pressed": String(selected === d.mac),
      onClick() {
        selected = d.mac;
        draw();
      },
    },
    icon(d.via === "wired" ? "settings_ethernet" : "wifi", "sm"),
    h("span", { class: "me-name" }, shortName(d.name, 22)),
    layers.signal && d.rssi !== null ? h("span", { class: "me-rssi" }, `${d.rssi} dBm`) : null,
    d.reserved ? h("span", { class: "me-mark", title: t("Keeps its address", "留住地址") }, icon("push_pin", "sm")) : null,
    d.blocked ? h("span", { class: "me-mark", title: t("Blocked", "已封鎖") }, icon("block", "sm")) : null);
    if (canWrite) draggable(chip, { zones, enabled: () => canWrite, onDrop: (zone) => dropOn(d, zone.dataset.zone) });
    return chip;
  }

  function dropOn(d, zone) {
    selected = d.mac;
    if (zone === "block") block(d, true);
    else if (zone === "unblock") block(d, false);
    else if (zone === "reserve") reserve(d, d.reserved || d.ip);
    else if (zone === "rename") panel.querySelector("input")?.focus();
    draw();
  }

  function nodeCard(node, kind) {
    const members = data.devices.filter((d) => d.node === node.mac);
    const q = node.quality ? gradeCopy(node.quality.grade) : null;
    return h("div", { class: `me-node ${kind}` },
      h("div", { class: "me-nodehead" },
        icon(kind === "main" ? "router" : "hub"),
        h("div", {}, h("div", { class: "t1" }, node.name || node.ip || node.mac), h("div", { class: "t2" }, `${node.ip || node.mac} · ${members.length} ${t("devices", "部裝置")}`))),
      kind === "node" && layers.links
        ? h("div", { class: "me-link" },
          icon(node.backhaul === "wired" ? "cable" : "wifi_tethering", "sm"),
          h("span", {}, node.backhaul ? (node.backhaul === "wired" ? t("Cable", "網線") : node.backhaul) : t("Link type not reported", "冇報告連線類型")),
          layers.quality && q ? h("span", { class: `tag ${q.tag}` }, icon(q.icon, "sm"), tt(q.label), node.quality.ms !== null && node.quality.ms !== undefined ? ` · ${node.quality.ms} ms` : "", node.quality.loss ? ` · ${node.quality.loss}% ${t("lost", "遺失")}` : "") : null)
        : null,
      h("div", { class: "me-devs" }, members.length ? members.map(deviceChip) : h("div", { class: "muted" }, t("No devices here right now.", "而家呢度冇裝置。"))));
  }

  function drawPanel() {
    const d = selected ? deviceOf(selected) : null;
    ctx.clear(panel);
    if (!d) return void add(panel, h("div", { class: "empty" }, icon("touch_app", "lg"), t("Pick a device on the map.", "喺地圖揀一部裝置。")));
    const name = h("input", { class: "field", maxlength: "32", value: d.customName, placeholder: d.host || d.ip, "aria-label": t("Device name", "裝置名稱"), disabled: !canWrite });
    const free = [d.ip, ...data.free.filter((ip) => ip !== d.ip)];
    const pick = h("select", { class: "field", "aria-label": t("Address to keep", "要留住嘅地址"), disabled: !canWrite }, free.map((ip) => h("option", { value: ip, selected: ip === (d.reserved || d.ip) }, ip === d.ip ? `${ip} (${t("now", "而家")})` : ip)));
    add(panel, 
      h("div", { class: "k" }, t("Picked device", "揀咗嘅裝置")),
      h("h2", { class: "h2" }, d.name),
      h("div", { class: "t2 mono" }, `${d.mac} · ${d.ip} · ${d.via === "wired" ? t("cable", "網線") : d.via}`),
      h("label", { class: "me-field" }, h("span", {}, t("Name", "名稱")), name),
      h("button", { class: "btn t sm", type: "button", disabled: !canWrite, onClick: () => rename(d, name.value.trim()) }, icon("edit", "sm"), t("Rename", "改名")),
      h("label", { class: "me-field" }, h("span", {}, t("Keep this address", "留住呢個地址")), pick),
      h("div", { class: "chips" },
        h("button", { class: "btn t sm", type: "button", disabled: !canWrite, onClick: () => reserve(d, pick.value) }, icon("push_pin", "sm"), d.reserved ? t("Keep the chosen address", "留住所揀地址") : t("Keep address", "留住地址")),
        d.reserved ? h("button", { class: "btn o sm", type: "button", disabled: !canWrite, onClick: () => unreserve(d) }, icon("link_off", "sm"), t("Release", "放開")) : null),
      h("button", { class: `btn ${d.blocked ? "o" : "d"} sm`, type: "button", disabled: !canWrite, onClick: () => block(d, !d.blocked) }, icon(d.blocked ? "check_circle" : "block", "sm"), d.blocked ? t("Let back online", "解除封鎖") : t("Block from the internet", "封鎖上網")),
      d.scheduled ? h("div", { class: "note" }, icon("schedule"), t("This device also has a schedule. Open Time limits to see it.", "呢部裝置亦有時間表。去「時間限制」睇。")) : null,
      !canWrite ? h("div", { class: "note warn" }, icon("lock"), t("Your role can only look.", "你嘅角色只可以睇。")) : null);
  }

  function drawTrays() {
    const tray = (zone, ic, en, yue) => h("div", { class: "me-tray", "data-zone": zone, role: "note" }, icon(ic), h("span", {}, t(en, yue)));
    fill(trays, tray("block", "block", "Drop here to block", "拖到呢度封鎖"), tray("unblock", "check_circle", "Drop here to unblock", "拖到呢度解除封鎖"), tray("reserve", "push_pin", "Drop here to keep address", "拖到呢度留住地址"));
  }

  function drawLayers() {
    fill(layerBar, ...[["links", "Links", "連線"], ["signal", "Signal", "訊號"], ["quality", "Link quality", "連線質素"]].map(([id, en, yue]) =>
      h("button", { type: "button", class: `chip${layers[id] ? " on" : ""}`, "aria-pressed": String(layers[id]), onClick() { layers[id] = !layers[id]; draw(); } }, t(en, yue))));
  }

  function draw() {
    drawLayers();
    drawTrays();
    fill(host, 
      nodeCard({ ...data.main, name: data.main.name, quality: null }, "main"),
      data.nodes.length ? h("div", { class: "me-nodes" }, data.nodes.map((n) => nodeCard(n, "node"))) : null,
      !data.mesh ? h("div", { class: "note" }, icon("info"), t("This router has no AiMesh nodes, so every device hangs off the router itself.", "呢部路由器冇 AiMesh 節點，所以所有裝置都連住路由器本身。")) : null,
      data.devices.length ? null : h("div", { class: "empty" }, icon("devices", "lg"), t("The router has not reported a device yet.", "路由器暫時未報告任何裝置。")));
    drawPanel();
  }

  add(page, h("section", { class: "card rise" }, layerBar, host, trays), panel);
  draw();

  const refresh = async () => {
    if (ctx.dock.count() > 0 || document.hidden) return;
    try {
      data = await api.get("/api/domain/map-editor");
      pending.clear();
      draw();
    } catch {
      /* The next refresh tries again. */
    }
  };
  timer = setInterval(refresh, REFRESH_MS);
  const off = ctx.bus.on("dock", () => ctx.dock.count() === 0 && pending.size && refresh());
  return () => {
    clearInterval(timer);
    off();
  };
}

export default {
  id: "map-editor",
  screens: [{ id: "map-editor", group: { en: "Network", yue: "網絡" }, icon: "lan", label, render: screen }],
  commands: [{ id: "map-editor.open", icon: "lan", label: { en: "Open the network map editor", yue: "開啟網絡地圖編輯器" }, keywords: "map network device rename block reserve address mesh node 地圖 裝置 封鎖", run: (ctx) => ctx.navigate("map-editor") }],
};
