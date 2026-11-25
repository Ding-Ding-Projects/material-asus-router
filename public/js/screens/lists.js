// List-shaped screens: port forwarding rules, reserved addresses and the
// internet block list. Each edit is queued in the dock as an operation.
import { api, bus, clear, h, icon, openDialog, t } from "../core.js";
import { app, dock } from "../dock.js";
import { groupCard, settingGroups } from "../controls.js";
import { header, loadDomain, tableOf } from "./common.js";

const pending = (kind) => dock.ops.filter((o) => o.op.op.startsWith(kind));
const waiting = () => h("span", { class: "tag warn" }, icon("edit_note", "sm"), t("Edit waiting", "有改動等緊"));

function form(title, fields, onSave) {
  const values = Object.fromEntries(fields.map((f) => [f.name, f.value ?? ""]));
  return openDialog((close) => [
    h("h2", { class: "h2" }, title),
    h("div", { class: "two" }, fields.map((f) =>
      h("label", { class: "lbl" }, f.label,
        f.options
          ? h("select", { class: "field", onChange: (e) => (values[f.name] = e.target.value) }, f.options.map((o) => h("option", { value: o, selected: o === f.value }, o)))
          : h("input", { class: "field", value: f.value ?? "", placeholder: f.placeholder ?? "", maxlength: String(f.max ?? 64), inputmode: f.mode, readOnly: f.readOnly, onInput: (e) => (values[f.name] = e.target.value.trim()) })))),
    h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close() }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: () => { onSave(values); close(true); } }, t("Add to changes", "加入改動"))),
  ]);
}

// ---- port forwarding ----------------------------------------------------------

export async function forwarding(root) {
  let data = await loadDomain("forwarding");
  const lanDevices = (await api.get("/api/domain/devices")).devices.filter((d) => d.ip);
  const list = h("div", {});
  const ruleForm = (rule = {}) =>
    form(rule.name ? t("Edit forwarding rule", "改轉發規則") : t("New forwarding rule", "新增轉發規則"), [
      { name: "name", label: t("Name", "名稱"), value: rule.name, max: 32 },
      { name: "extPort", label: t("Outside port or range", "外部端口或範圍"), value: rule.extPort, placeholder: "8080 / 8000:8010", mode: "numeric" },
      { name: "ip", label: t("Send to this address", "轉發去呢個地址"), value: rule.ip, placeholder: lanDevices[0]?.ip ?? "198.51.100.20", mode: "decimal" },
      { name: "intPort", label: t("Device port", "裝置端口"), value: rule.intPort, mode: "numeric" },
      { name: "proto", label: t("Protocol", "協定"), value: rule.proto ?? "TCP", options: ["TCP", "UDP", "BOTH"] },
      { name: "srcIp", label: t("Only from (optional)", "只限來自（可選）"), value: rule.srcIp, mode: "decimal" },
    ], (v) => dock.addOp({ op: rule.name ? "forward-update" : "forward-add", index: rule.index, ...v, intPort: v.intPort || v.extPort }, `${rule.name ? t("Edit rule", "改規則") : t("Add rule", "加規則")} ${v.name}: ${v.extPort} → ${v.ip}:${v.intPort || v.extPort}`));
  function paint() {
    clear(list).append(
      data.rules.length
        ? tableOf([t("Name", "名稱"), t("Outside port", "外部端口"), t("Sends to", "轉發去"), t("Protocol", "協定"), t("Only from", "只限來自"), ""], data.rules.map((r) => h("tr", {},
            h("td", {}, h("div", { class: "t1" }, r.name)),
            h("td", { class: "mono" }, r.extPort),
            h("td", { class: "mono" }, `${r.ip}:${r.intPort}`),
            h("td", {}, r.proto),
            h("td", { class: "mono" }, r.srcIp || t("anyone", "任何人")),
            h("td", {}, app.canWrite ? h("div", { class: "chips" },
              h("button", { class: "btn t icon", "aria-label": `${t("Edit", "編輯")} ${r.name}`, onClick: () => ruleForm(r) }, icon("edit", "sm")),
              h("button", { class: "btn t icon", "aria-label": `${t("Remove", "移除")} ${r.name}`, onClick: () => dock.addOp({ op: "forward-remove", index: r.index }, `${t("Remove rule", "移除規則")} ${r.name}`) }, icon("delete", "sm"))) : null))))
        : h("div", { class: "empty" }, icon("swap_horiz", "lg"), t("No forwarding rules. The internet cannot reach anything inside your network.", "冇轉發規則。互聯網連唔到你網絡入面嘅任何嘢。")),
      pending("forward").length ? waiting() : null,
    );
  }
  paint();
  const cards = settingGroups(data.entries).map((g) => groupCard(g.label, g.entries));
  root.append(h("div", { class: "page" }, header("forwarding"), h("div", { class: "grid2" }, cards),
    h("section", { class: "card" }, h("div", { class: "row" }, h("h2", { class: "h2 grow" }, t("Rules", "規則")), app.canWrite ? h("button", { class: "btn f sm", onClick: () => ruleForm() }, icon("add", "sm"), t("New rule", "新增規則")) : null), list)));
  const off = [bus.on("dock", paint), bus.on("changed", async () => { data = await loadDomain("forwarding"); paint(); })];
  return () => off.forEach((f) => f());
}

// ---- local network: settings plus reserved addresses ---------------------------

export async function lan(root) {
  let data = await loadDomain("lan");
  const devices = (await api.get("/api/domain/devices")).devices;
  const list = h("div", {});
  const add = () =>
    form(t("Reserve an address", "留住一個地址"), [
      { name: "mac", label: "MAC", placeholder: "AA:BB:CC:DD:EE:FF", max: 17 },
      { name: "ip", label: t("Address", "地址"), placeholder: "198.51.100.150", mode: "decimal" },
      { name: "hostname", label: t("Host name (optional)", "主機名稱（可選）"), max: 63 },
    ], (v) => dock.addOp({ op: "reserve", ...v }, `${t("Reserve", "留住")} ${v.ip} → ${v.mac}`));
  function paint() {
    clear(list).append(
      data.reservations.length
        ? tableOf([t("Device", "裝置"), "MAC", t("Reserved address", "留住嘅地址"), t("Host name", "主機名稱"), ""], data.reservations.map((r) => h("tr", {},
            h("td", {}, devices.find((d) => d.mac === r.mac)?.name ?? "—"),
            h("td", { class: "mono" }, r.mac),
            h("td", { class: "mono" }, r.ip),
            h("td", {}, r.hostname || "—"),
            h("td", {}, app.canWrite ? h("button", { class: "btn t icon", "aria-label": `${t("Remove reservation for", "移除留住嘅地址")} ${r.mac}`, onClick: () => dock.addOp({ op: "unreserve", mac: r.mac }, `${t("Release", "釋放")} ${r.ip}`) }, icon("delete", "sm")) : null))))
        : h("div", { class: "empty" }, icon("push_pin", "lg"), t("No reserved addresses yet.", "未有留住嘅地址。")),
      pending("reserve").length || pending("unreserve").length ? waiting() : null,
    );
  }
  paint();
  root.append(h("div", { class: "page" }, header("lan"), h("div", { class: "grid2" }, settingGroups(data.entries).map((g) => groupCard(g.label, g.entries))),
    h("section", { class: "card" }, h("div", { class: "row" }, h("div", { class: "grow" }, h("h2", { class: "h2" }, t("Reserved addresses", "留住嘅地址")), h("div", { class: "t2" }, t("A reserved device always gets the same address when it joins.", "留住咗地址嘅裝置，每次連線都會攞到同一個地址。"))), app.canWrite ? h("button", { class: "btn f sm", onClick: add }, icon("add", "sm"), t("Reserve", "留住")) : null), list)));
  const off = [bus.on("dock", paint), bus.on("changed", async () => { data = await loadDomain("lan"); paint(); })];
  return () => off.forEach((f) => f());
}

// ---- parental controls ---------------------------------------------------------

export async function parental(root) {
  let data = await loadDomain("parental");
  let devices = (await api.get("/api/domain/devices")).devices;
  const list = h("div", {});
  const picker = () =>
    openDialog((close) => [
      h("h2", { class: "h2" }, t("Block a device from the internet", "封鎖裝置上網")),
      h("div", {}, devices.filter((d) => !d.blocked).map((d) => h("button", { class: "row navi", onClick: () => { dock.addOp({ op: "block", mac: d.mac, name: d.name, blocked: true }, `${t("Block", "封鎖")} ${d.name}`); close(true); } }, icon("block"), h("span", { class: "grow" }, d.name, h("span", { class: "t2" }, `  ${d.ip} · ${d.mac}`))))),
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close() }, t("Close", "關閉"))),
    ]);
  function paint() {
    clear(list).append(
      data.blocks.length
        ? tableOf([t("Device", "裝置"), "MAC", t("Rule", "規則"), ""], data.blocks.map((b) => h("tr", {},
            h("td", {}, b.name || "—"), h("td", { class: "mono" }, b.mac),
            h("td", {}, b.blocked ? h("span", { class: "tag bad" }, t("Blocked always", "一直封鎖")) : h("span", { class: "tag warn" }, t("Time schedule (set on the router)", "時間表（喺路由器設定）"))),
            h("td", {}, app.canWrite ? h("button", { class: "btn t sm", onClick: () => dock.addOp({ op: "block", mac: b.mac, blocked: false }, `${t("Unblock", "解除封鎖")} ${b.name || b.mac}`) }, icon("lock_open", "sm"), t("Unblock", "解除封鎖")) : null))))
        : h("div", { class: "empty" }, icon("family_restroom", "lg"), t("Nobody is blocked.", "冇人被封鎖。")),
      pending("block").length ? waiting() : null,
    );
  }
  paint();
  root.append(h("div", { class: "page" }, header("parental"), h("div", { class: "grid2" }, settingGroups(data.entries).map((g) => groupCard(g.label, g.entries))),
    h("section", { class: "card" }, h("div", { class: "row" }, h("h2", { class: "h2 grow" }, t("Blocked devices", "被封鎖嘅裝置")), app.canWrite ? h("button", { class: "btn f sm", onClick: picker }, icon("add", "sm"), t("Block a device", "封鎖裝置")) : null), list)));
  const off = [bus.on("dock", paint), bus.on("changed", async () => { [data, devices] = [await loadDomain("parental"), (await api.get("/api/domain/devices")).devices]; paint(); })];
  return () => off.forEach((f) => f());
}
