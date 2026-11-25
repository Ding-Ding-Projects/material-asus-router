// Devices: a searchable table of everything connected, with rename,
// reserve-address, block and wake actions. Edits are queued in the dock.
import { api, bus, clear, h, icon, openDialog, t, toast } from "../core.js";
import { app, dock } from "../dock.js";
import { header, tableOf } from "./common.js";

const FILTERS = [
  ["all", ["All", "全部"], () => true],
  ["online", ["Online", "在線"], (d) => d.online],
  ["wifi", ["Wi-Fi", "Wi-Fi"], (d) => d.iface === "wireless"],
  ["wired", ["Wired", "有線"], (d) => d.iface === "wired"],
  ["blocked", ["Blocked", "已封鎖"], (d) => d.blocked],
];

const pendingFor = (mac) => dock.ops.filter((o) => o.op.mac?.toUpperCase() === mac);

function renameDialog(device) {
  let value = device.customName || device.name;
  return openDialog((close) => [
    h("h2", { class: "h2" }, t("Rename device", "改裝置名稱")),
    h("p", { class: "muted" }, t("This name shows in the router's own client list too.", "路由器自己嘅客戶端清單都會顯示呢個名。")),
    h("label", { class: "lbl" }, t("Name", "名稱"), h("input", { class: "field", maxlength: "32", value, autofocus: true, onInput: (e) => (value = e.target.value) })),
    h("div", { class: "actions" },
      h("button", { class: "btn o", onClick: () => close() }, t("Cancel", "取消")),
      h("button", { class: "btn f", onClick: () => { dock.addOp({ op: "rename", mac: device.mac, name: value }, `${t("Rename", "改名")} ${device.mac} → ${value}`); close(true); } }, t("Add to changes", "加入改動"))),
  ]);
}

function reserveDialog(device) {
  let ip = device.reservedIp || device.ip;
  let hostname = device.hostname;
  return openDialog((close) => [
    h("h2", { class: "h2" }, t("Always give this device the same address", "永遠俾呢部裝置同一個地址")),
    h("p", { class: "muted" }, `${device.name} · ${device.mac}`),
    h("label", { class: "lbl" }, t("Address", "地址"), h("input", { class: "field", inputmode: "decimal", value: ip, onInput: (e) => (ip = e.target.value.trim()) })),
    h("label", { class: "lbl" }, t("Host name (optional)", "主機名稱（可選）"), h("input", { class: "field", maxlength: "63", value: hostname, onInput: (e) => (hostname = e.target.value) })),
    h("div", { class: "actions" },
      h("button", { class: "btn o", onClick: () => close() }, t("Cancel", "取消")),
      h("button", { class: "btn f", onClick: () => { dock.addOp({ op: "reserve", mac: device.mac, ip, hostname }, `${t("Reserve", "留住")} ${ip} → ${device.name}`); close(true); } }, t("Add to changes", "加入改動"))),
  ]);
}

export async function devices(root) {
  let data = await api.get("/api/domain/devices");
  let filter = "all";
  let query = "";
  const selected = new Set();
  const body = h("div", {});
  const bulk = h("div", { class: "chips" });
  const summary = h("div", { class: "muted" });
  const search = h("input", { class: "field", type: "search", placeholder: t("Filter by name, address or MAC", "按名稱、地址或 MAC 篩選"), "aria-label": t("Filter devices", "篩選裝置"), onInput: (e) => { query = e.target.value.toLowerCase(); paint(); } });
  const chips = h("div", { class: "chips", role: "group" });

  const visible = () => {
    const keep = FILTERS.find((f) => f[0] === filter)[2];
    return data.devices.filter((d) => keep(d) && (!query || `${d.name} ${d.ip} ${d.mac} ${d.hostname}`.toLowerCase().includes(query)));
  };

  const toggleBlock = (d, blocked) => dock.addOp({ op: "block", mac: d.mac, name: d.name, blocked }, `${blocked ? t("Block", "封鎖") : t("Unblock", "解除封鎖")} ${d.name}`);

  function paint() {
    clear(chips).append(...FILTERS.map(([id, [en, yue]]) => h("button", { class: `chip ${filter === id ? "on" : ""}`, "aria-pressed": String(filter === id), onClick: () => { filter = id; paint(); } }, t(en, yue))));
    const list = visible();
    summary.textContent = t(`${data.summary.online} online · ${data.summary.total} known · showing ${list.length}`, `${data.summary.online} 部在線 · 已知 ${data.summary.total} 部 · 顯示 ${list.length} 部`);
    const chosen = data.devices.filter((d) => selected.has(d.mac));
    clear(bulk);
    if (chosen.length && app.canWrite)
      bulk.append(
        h("span", { class: "pill p" }, icon("checklist", "sm"), t(`${chosen.length} selected`, `已選 ${chosen.length} 部`)),
        h("button", { class: "btn t sm", onClick: () => { chosen.forEach((d) => !d.blocked && toggleBlock(d, true)); selected.clear(); paint(); } }, icon("block", "sm"), t("Block", "封鎖")),
        h("button", { class: "btn t sm", onClick: () => { chosen.forEach((d) => d.blocked && toggleBlock(d, false)); selected.clear(); paint(); } }, icon("lock_open", "sm"), t("Unblock", "解除封鎖")),
        h("button", { class: "btn t sm", onClick: () => { chosen.filter((d) => d.ip).forEach((d) => dock.addOp({ op: "reserve", mac: d.mac, ip: d.reservedIp || d.ip, hostname: d.hostname }, `${t("Reserve", "留住")} ${d.ip} → ${d.name}`)); selected.clear(); paint(); } }, icon("push_pin", "sm"), t("Keep current addresses", "留住而家地址")),
        h("button", { class: "btn t sm", onClick: async () => { for (const d of chosen) await api.post("/api/actions/wake", { mac: d.mac }).catch(() => {}); toast(t("Wake signals sent.", "已發出喚醒訊號。")); } }, icon("power_settings_new", "sm"), t("Wake", "喚醒")),
        h("button", { class: "btn o sm", onClick: () => { selected.clear(); paint(); } }, t("Clear", "清除")));
    const all = h("input", { type: "checkbox", "aria-label": t("Select all shown", "全選顯示嘅裝置"), checked: list.length > 0 && list.every((d) => selected.has(d.mac)), disabled: !app.canWrite, onChange: (e) => { list.forEach((d) => (e.target.checked ? selected.add(d.mac) : selected.delete(d.mac))); paint(); } });
    const rows = list.map((d) => {
      const pend = pendingFor(d.mac);
      return h("tr", { class: selected.has(d.mac) ? "sel" : "" },
        h("td", {}, h("input", { type: "checkbox", "aria-label": `${t("Select", "選取")} ${d.name}`, checked: selected.has(d.mac), disabled: !app.canWrite, onChange: (e) => { e.target.checked ? selected.add(d.mac) : selected.delete(d.mac); paint(); } })),
        h("td", {}, h("div", { class: "t1" }, d.name), h("div", { class: "t2 mono" }, d.hostname && d.hostname !== d.name ? d.hostname : ""), pend.length ? h("span", { class: "tag warn" }, icon("edit_note", "sm"), t("Edit waiting", "有改動等緊")) : null),
        h("td", {}, h("span", { class: `dot ${d.online ? "" : "off"}`, title: d.online ? "online" : "offline" }), " ", d.blocked ? h("span", { class: "tag bad" }, t("Blocked", "已封鎖")) : d.scheduled ? h("span", { class: "tag warn" }, t("Scheduled", "有時間表")) : d.online ? t("Online", "在線") : t("Offline", "離線")),
        h("td", { class: "mono" }, d.ip || "—", d.reservedIp ? h("span", { class: "tag", title: t("Reserved", "已留住") }, icon("push_pin", "sm")) : null),
        h("td", { class: "mono" }, d.mac),
        h("td", {}, d.iface === "wireless" ? `${d.band} · ${d.rssi ?? "?"} dBm` : t("Wired", "有線")),
        h("td", {}, app.canWrite ? h("div", { class: "chips" },
          h("button", { class: "btn t icon", title: t("Rename", "改名"), "aria-label": `${t("Rename", "改名")} ${d.name}`, onClick: async () => { if (await renameDialog(d).closed) paint(); } }, icon("edit", "sm")),
          h("button", { class: "btn t icon", title: t("Reserve address", "留住地址"), "aria-label": `${t("Reserve address for", "留住地址俾")} ${d.name}`, onClick: async () => { if (await reserveDialog(d).closed) paint(); } }, icon("push_pin", "sm")),
          h("button", { class: "btn t icon", title: d.blocked ? t("Unblock", "解除封鎖") : t("Block", "封鎖"), "aria-label": `${d.blocked ? t("Unblock", "解除封鎖") : t("Block", "封鎖")} ${d.name}`, onClick: () => { toggleBlock(d, !d.blocked); paint(); } }, icon(d.blocked ? "lock_open" : "block", "sm")),
          h("button", { class: "btn t icon", title: t("Wake", "喚醒"), "aria-label": `${t("Wake", "喚醒")} ${d.name}`, onClick: async () => { try { await api.post("/api/actions/wake", { mac: d.mac }); toast(t("Wake signal sent.", "已發出喚醒訊號。")); } catch (e) { toast(e.message, "bad"); } } }, icon("power_settings_new", "sm"))) : null));
    });
    clear(body).append(list.length ? tableOf([all, t("Device", "裝置"), t("Status", "狀態"), t("Address", "地址"), "MAC", t("Connection", "連線"), ""], rows) : h("div", { class: "card tone" }, h("div", { class: "empty" }, icon("devices_off", "lg"), t("No devices match.", "冇符合嘅裝置。"))));
  }

  root.append(h("div", { class: "page" }, header("devices"), h("div", { class: "card" }, search, chips, summary, bulk), body));
  paint();
  const off = [bus.on("dock", paint), bus.on("changed", async () => { data = await api.get("/api/domain/devices"); paint(); })];
  return () => off.forEach((f) => f());
}
