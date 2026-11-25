// DHCP address map: every address of the home network as a cell. Cells show the
// router, reserved addresses, leased ones and free ones; the pool the router
// hands out from is outlined, and its two end handles drag to resize it. Drag a
// device's cell onto a free cell to keep that address for it. Everything waits in
// the pending-changes dock, so it is previewed and undoable.
import { draggable } from "./drag.js";
import { applyPool, ipNumber, leaseLeft, movePool, releaseAt, reserveAt, rowsOf, stepIp, warnings } from "./model.js";

// Appends children, skipping empty ones and flattening lists. (The native append would print "null" for a gap.)
function add(el, ...kids) {
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}
const fill = (el, ...kids) => (el.replaceChildren(), add(el, ...kids));

const label = { en: "DHCP address map", yue: "DHCP 地址地圖" };
const lede = { en: "Every address of your home network. Drag the pool's ends to resize it, or drag a device onto a free address to keep it.", yue: "屋企網絡嘅每個地址。拖動地址池兩端就可以改大細，將裝置拖去空閒地址就可以留住佢。" };
const COLUMNS = 16;
const REFRESH_MS = 8000;

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const canWrite = ctx.state.canWrite;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  let data = await api.get("/api/domain/dhcp-map");
  let cells = data.cells;
  let selected = null;
  const grid = h("div", { class: "dm-grid", role: "group", "aria-label": t("Addresses", "地址") });
  const summary = h("div", { class: "chips", "aria-live": "polite" });
  const poolBar = h("div", { class: "dm-pool" });
  const warn = h("div", { class: "dm-warn" });
  const panel = h("section", { class: "card rise dm-panel", "aria-live": "polite" });
  const cellZones = () => [...grid.querySelectorAll(".dm-cell:not(.edge)")];
  const releaseZones = () => [...page.querySelectorAll("[data-release]")];
  const entry = (id) => data.entries.find((e) => e.id === id);
  const valueOf = (e) => (ctx.dock.has(e.id) ? ctx.dock.value(e.id) : e.value);
  const pool = () => ({ start: valueOf(entry(data.pool.startEntryId)), end: valueOf(entry(data.pool.endEntryId)) });
  const guard = () => (canWrite ? true : (ctx.toast(t("Your role can only look.", "你嘅角色只可以睇。"), "warn"), false));
  const cellOf = (ip) => cells.find((c) => c.ip === ip);

  function setPool(edge, ip) {
    if (!guard()) return;
    const next = movePool(cells, pool(), edge, ip);
    if (!next) return ctx.toast(t("The first and last address of a network cannot be handed out.", "網絡嘅第一個同最後一個地址派唔到俾裝置。"), "warn");
    ctx.dock.setEntry(entry(data.pool.startEntryId), next.start);
    ctx.dock.setEntry(entry(data.pool.endEntryId), next.end);
    draw();
  }
  function keep(cell, ip) {
    if (!guard()) return;
    const target = cellOf(ip);
    if (!target || (target.kind !== "free" && target.mac !== cell.mac)) return ctx.toast(t("That address is not free.", "嗰個地址唔係空閒。"), "warn");
    ctx.dock.addOp({ op: "reserve", mac: cell.mac, ip, hostname: cell.name ?? "" }, `${t("Keep", "留住")} ${ip} ${t("for", "俾")} ${cell.name || cell.mac}`);
    cells = reserveAt(cells, cell.mac, ip, cell.name);
    selected = ip;
    draw();
  }
  function release(cell) {
    if (!guard()) return;
    ctx.dock.addOp({ op: "unreserve", mac: cell.mac }, `${t("Release", "放開")} ${cell.ip}`);
    cells = releaseAt(cells, cell.ip);
    draw();
  }

  function cellButton(c, state) {
    const kindWord = { free: t("free", "空閒"), leased: t("leased", "借出"), reserved: t("kept", "留住"), router: t("router", "路由器"), edge: t("not usable", "唔可用") }[c.kind];
    const el = h("button", { type: "button", class: `dm-cell ${c.kind}${c.inPool ? " pool" : ""}${selected === c.ip ? " sel" : ""}${c.pending ? " waiting" : ""}${c.ip === state.start ? " pool-start" : ""}${c.ip === state.end ? " pool-end" : ""}`, "data-ip": c.ip, disabled: c.kind === "edge",
      "aria-label": `${c.ip}, ${kindWord}${c.name ? `, ${c.name}` : ""}${c.inPool ? `, ${t("in the pool", "喺地址池入面")}` : ""}`,
      onClick() { selected = c.ip; draw(); } }, h("span", { class: "dm-num" }, c.kind === "router" ? "R" : String(c.ip.split(".")[3])));
    if (canWrite && (c.kind === "leased" || c.kind === "reserved") && c.mac) draggable(el, { zones: () => [...cellZones().filter((z) => cellOf(z.dataset.ip)?.kind === "free"), ...releaseZones()], enabled: () => canWrite, onDrop: (zone) => (zone.dataset.release ? (c.kind === "reserved" ? release(c) : ctx.toast(t("Only a kept address can be released.", "淨係留住咗嘅地址先可以放開。"), "warn")) : keep(c, zone.dataset.ip)) });
    if (c.ip === state.start || c.ip === state.end) {
      const edge = c.ip === state.start ? "start" : "end";
      const handle = h("span", { class: `dm-handle ${edge}`, role: "presentation", title: edge === "start" ? t("Drag to move the first address of the pool", "拖動可以移動地址池第一個地址") : t("Drag to move the last address of the pool", "拖動可以移動地址池最後一個地址") });
      el.append(handle);
      if (canWrite) draggable(handle, { zones: cellZones, enabled: () => canWrite, onDrop: (zone) => setPool(edge, zone.dataset.ip) });
      handle.addEventListener("pointerdown", (e) => e.stopPropagation());
    }
    return el;
  }

  function drawPanel() {
    ctx.clear(panel);
    const c = selected ? cellOf(selected) : null;
    if (!c) return void add(panel, h("div", { class: "empty" }, icon("touch_app", "lg"), t("Pick an address on the map.", "喺地圖揀一個地址。")));
    const free = cells.filter((x) => x.kind === "free" && x.n > 0).slice(0, 60);
    const kind = { free: t("Free", "空閒"), leased: t("Leased to a device", "借咗俾裝置"), reserved: t("Kept for a device", "留咗俾裝置"), router: t("The router", "路由器"), edge: "" }[c.kind];
    const left = c.kind === "leased" ? leaseLeft(c.ends, data.now) : null;
    const move = h("select", { class: "field", "aria-label": t("Move to another address", "搬去另一個地址"), disabled: !canWrite }, h("option", { value: "" }, t("Keep at another address…", "留喺另一個地址…")), free.map((x) => h("option", { value: x.ip }, x.ip)));
    move.addEventListener("change", () => move.value && keep(c, move.value));
    add(panel, h("div", { class: "k" }, c.ip), h("h2", { class: "h2" }, c.name || kind), h("div", { class: "t2" }, `${kind}${c.mac ? ` · ${c.mac}` : ""}${c.inPool ? ` · ${t("in the pool", "喺地址池入面")}` : ""}`),
      left ? h("div", { class: "t2" }, t(`The lease ends in ${left.hours} h ${left.minutes} min.`, `租約仲有 ${left.hours} 小時 ${left.minutes} 分鐘。`)) : null,
      c.kind === "leased" ? h("button", { type: "button", class: "btn t sm", disabled: !canWrite, onClick: () => keep(c, c.ip) }, icon("push_pin", "sm"), t("Keep this address", "留住呢個地址")) : null,
      c.kind === "reserved" ? h("button", { type: "button", class: "btn o sm", disabled: !canWrite, onClick: () => release(c) }, icon("link_off", "sm"), t("Release this address", "放開呢個地址")) : null,
      c.mac && (c.kind === "leased" || c.kind === "reserved") ? move : null,
      h("div", { class: "chips" }, [["start", "Make this the first address", "設做第一個地址"], ["end", "Make this the last address", "設做最後一個地址"]].map(([edge, en, yue]) => h("button", { type: "button", class: "btn o sm", disabled: !canWrite || c.kind === "edge", onClick: () => setPool(edge, c.ip) }, t(en, yue)))),
      c.pending ? h("div", { class: "note" }, icon("schedule"), t("The device takes this address the next time it renews its lease or reconnects.", "裝置下次續租或者重新連線嗰陣就會用呢個地址。")) : null);
  }

  function stepper(edge, text) {
    const state = pool();
    const move = (steps) => {
      const to = stepIp(cells, state[edge], steps);
      if (to) setPool(edge, to);
    };
    return h("div", { class: "dm-step", role: "group", "aria-label": text },
      h("span", { class: "t2" }, text),
      h("button", { type: "button", class: "btn o sm icon", disabled: !canWrite, "aria-label": `${text}: −16`, onClick: () => move(-16) }, icon("keyboard_double_arrow_left", "sm")),
      h("button", { type: "button", class: "btn o sm icon", disabled: !canWrite, "aria-label": `${text}: −1`, onClick: () => move(-1) }, icon("chevron_left", "sm")),
      h("b", { class: "mono dm-ip" }, state[edge]),
      h("button", { type: "button", class: "btn o sm icon", disabled: !canWrite, "aria-label": `${text}: +1`, onClick: () => move(1) }, icon("chevron_right", "sm")),
      h("button", { type: "button", class: "btn o sm icon", disabled: !canWrite, "aria-label": `${text}: +16`, onClick: () => move(16) }, icon("keyboard_double_arrow_right", "sm")));
  }

  function draw() {
    const state = pool();
    cells = applyPool(cells, state.start, state.end);
    const count = (k) => cells.filter((c) => c.kind === k).length;
    const poolSize = Math.max(0, ipNumber(state.end) - ipNumber(state.start) + 1);
    fill(summary, h("span", { class: "tag" }, icon("router", "sm"), `${t("Router", "路由器")} 1`), h("span", { class: "tag good" }, icon("push_pin", "sm"), `${t("Kept", "留住")} ${count("reserved")}`), h("span", { class: "tag" }, icon("devices", "sm"), `${t("Leased", "借出")} ${count("leased")}`), h("span", { class: "tag" }, icon("check_box_outline_blank", "sm"), `${t("Free", "空閒")} ${count("free")}`), h("span", { class: "tag warn" }, icon("grid_view", "sm"), `${t("Pool", "地址池")} ${poolSize}`));
    fill(poolBar, stepper("start", t("First address", "第一個地址")), stepper("end", t("Last address", "最後一個地址")));
    const notes = warnings(cells, state);
    fill(warn, ...notes.map((w) => h("div", { class: "note warn" }, icon("warning"), {
      "empty-pool": t("The last address is before the first, so the router has nothing to hand out.", "最後地址喺第一個地址之前，路由器冇地址可派。"),
      "small-pool": t("The pool has fewer addresses than there are devices holding one now. Some devices will not get an address.", "地址池嘅地址少過而家有地址嘅裝置，部分裝置會攞唔到地址。"),
      "router-in-pool": t("The router's own address is inside the pool. Move the pool's ends so it is outside.", "路由器自己嘅地址喺地址池入面。請移動地址池兩端，令佢喺外面。"),
    }[w])));
    fill(grid, ...rowsOf(cells, COLUMNS).map((row) => h("div", { class: "dm-row", role: "presentation" }, row.map((c) => cellButton(c, state)))));
    if (!data.block.whole) add(grid, h("div", { class: "t2" }, t(`This network has ${data.block.networkSize} addresses, so the map shows the block of 256 around the router.`, `呢個網絡有 ${data.block.networkSize} 個地址，所以地圖顯示路由器周圍嗰 256 個。`)));
    drawPanel();
  }

  add(page, 
    h("section", { class: "card rise" }, summary, poolBar, warn, grid,
      h("div", { class: "dm-trays" }, h("div", { class: "dm-release", "data-release": "1", role: "note" }, icon("link_off"), t("Drop a kept address here to release it", "將留住咗嘅地址拖到呢度放開"))),
      h("div", { class: "dm-legend t2" }, t("Outlined cells are inside the pool. Numbers are the last part of each address.", "有框嘅格仔喺地址池入面。數字係每個地址嘅最後一組。"))),
    panel);
  draw();

  const refresh = async () => {
    if (ctx.dock.count() > 0 || document.hidden) return;
    try {
      data = await api.get("/api/domain/dhcp-map");
      cells = data.cells;
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
  id: "dhcp-map",
  screens: [{ id: "dhcp-map", group: { en: "Network", yue: "網絡" }, icon: "grid_view", label, render: screen }],
  commands: [{ id: "dhcp-map.open", icon: "grid_view", label: { en: "Open the DHCP address map", yue: "開啟 DHCP 地址地圖" }, keywords: "dhcp address pool reserve lease free range map 地址 地址池 留住 租約", run: (ctx) => ctx.navigate("dhcp-map") }],
};
