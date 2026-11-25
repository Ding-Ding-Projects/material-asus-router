// Rule canvas: port forwarding and firewall rules as three lanes. The internet
// is on the left, the router in the middle and the devices on the right. Rule
// cards drag from one device to another; port and protocol chips edit in place;
// rules that fight over a port are outlined and explained. Every edit waits in
// the pending-changes dock, so it is previewed, guarded and undoable.
import { draggable } from "./drag.js";
import { conflictedRules, findConflicts, laneRows, parsePort, portText, problemsOf } from "./model.js";

const label = { en: "Rule canvas", yue: "規則畫布" };
const lede = { en: "See who can reach what. Drag a rule card onto another device to point it there, or click a port to change it.", yue: "睇清楚邊個可以連去邊。將規則卡拖去另一部裝置就改咗目標，撳個端口就可以改。" };
const PROTOS = ["TCP", "UDP", "BOTH"];
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const REFRESH_MS = 10000;

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const canWrite = ctx.state.canWrite;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  let data = await api.get("/api/domain/rule-canvas");
  let rules = data.forwarding.rules.map((r) => ({ ...r }));
  let fw = data.firewall.rules.map((r) => ({ ...r }));
  const entry = (id) => ctx.state.catalog.entries.find((e) => e.id === id);
  const lanes = h("div", { class: "rc-lanes" });
  const banner = h("div", { class: "rc-banner", role: "status", "aria-live": "polite" });
  const head = h("div", { class: "chips rc-head" });
  const zones = () => [...lanes.querySelectorAll("[data-ip]")];

  const stage = (op, summary) => {
    if (!canWrite) return ctx.toast(t("Your role can only look.", "你嘅角色只可以睇。"), "warn"), false;
    ctx.dock.addOp(op, summary);
    return true;
  };
  const body = (r) => ({ name: r.name, extPort: r.extPort, ip: r.ip, intPort: r.intPort, proto: r.proto, srcIp: r.srcIp });
  const update = (r, change, summary) => {
    const next = { ...r, ...change };
    if (!stage({ op: "forward-update", index: rules.indexOf(r), ...body(next) }, summary)) return;
    Object.assign(r, change, { pending: true });
    draw();
  };
  const remove = (r) => {
    if (!stage({ op: "forward-remove", index: rules.indexOf(r) }, `${t("Remove forwarding rule", "移除轉發規則")} ${r.name}`)) return;
    rules = rules.filter((x) => x !== r);
    draw();
  };
  const add = (r) => {
    if (!stage({ op: "forward-add", ...body(r) }, `${t("Forward", "轉發")} ${r.proto} ${r.extPort} → ${r.ip}:${r.intPort}`)) return false;
    rules.push({ ...r, index: rules.length, pending: true });
    draw();
    return true;
  };
  const setFirewall = (rows, summary) => {
    const e = entry("firewall-pro.services.rules");
    if (!e || e.disabled) return ctx.toast(e?.disabled ? tt(e.disabled) : t("The firewall rule list is not available on this router.", "呢部路由器冇防火牆規則清單。"), "warn");
    if (!canWrite) return ctx.toast(t("Your role can only look.", "你嘅角色只可以睇。"), "warn");
    ctx.dock.setEntry(e, rows.map((r) => `<${[r.srcIp, r.srcPort, r.dstIp, r.dstPort, r.proto].join(">")}`).join(""));
    fw = rows;
    ctx.toast(summary);
    draw();
  };

  // A chip that turns into a small box on click, checks the port and commits on Enter.
  function portChip(text, name, commit) {
    const chip = h("button", { type: "button", class: "rc-port", disabled: !canWrite, "aria-label": `${name}: ${text}`, onClick() {
      const input = h("input", { class: "field rc-edit", value: text, maxlength: "11", "aria-label": name, inputmode: "numeric" });
      const done = () => {
        const range = parsePort(input.value);
        if (!range) return ctx.toast(t("Use a port from 1 to 65535, or a range such as 8000:8010.", "請用 1 至 65535 嘅端口，或者好似 8000:8010 嘅範圍。"), "warn");
        if (portText(range) !== text) commit(portText(range));
        else draw();
      };
      input.addEventListener("keydown", (e) => (e.key === "Enter" ? done() : e.key === "Escape" ? draw() : null));
      input.addEventListener("blur", () => setTimeout(() => input.isConnected && draw(), 150));
      chip.replaceWith(input);
      input.focus();
      input.select();
    } }, text);
    return chip;
  }

  const protoChip = (r) => h("button", { type: "button", class: "rc-proto", disabled: !canWrite, "aria-label": t(`Protocol ${r.proto}. Press to change.`, `協定 ${r.proto}。撳一下轉。`), onClick: () => {
    const next = PROTOS[(PROTOS.indexOf(r.proto) + 1) % PROTOS.length];
    update(r, { proto: next }, `${r.name}: ${next}`);
  } }, r.proto === "BOTH" ? t("TCP + UDP", "TCP 加 UDP") : r.proto);

  function internetCard(r, i, bad) {
    return h("div", { class: `rc-card${bad.has(i) ? " conflict" : ""}${r.pending ? " waiting" : ""}` },
      h("span", { class: "rc-num" }, `#${i + 1}`),
      h("div", { class: "rc-line" }, icon("public", "sm"), portChip(r.extPort, t("Outside port", "外面端口"), (v) => update(r, { extPort: v }, `${r.name}: ${t("outside port", "外面端口")} ${v}`)), protoChip(r), r.srcIp ? h("span", { class: "tag" }, `${t("only from", "只限來自")} ${r.srcIp}`) : null),
      bad.has(i) ? h("div", { class: "tag bad" }, icon("warning", "sm"), t("Port in conflict", "端口衝突")) : null);
  }

  function deviceCard(r, i, bad, rows) {
    const el = h("div", { class: `rc-card movable${bad.has(i) ? " conflict" : ""}${r.pending ? " waiting" : ""}`, "data-rule": String(i) },
      h("span", { class: "rc-num" }, `#${i + 1}`),
      h("div", { class: "rc-line" }, icon("drag_indicator", "sm"), h("b", {}, r.name || t("(no name)", "（冇名）")), portChip(r.intPort, t("Device port", "裝置端口"), (v) => update(r, { intPort: v }, `${r.name}: ${t("device port", "裝置端口")} ${v}`))),
      h("div", { class: "rc-line" },
        h("label", { class: "visually-hidden", for: `rc-move-${i}` }, t("Send this rule to", "將呢條規則送去")),
        h("select", { id: `rc-move-${i}`, class: "field rc-move", disabled: !canWrite, onChange: (e) => e.target.value !== r.ip && update(r, { ip: e.target.value }, `${r.name} → ${e.target.value}`) }, rows.map((row) => h("option", { value: row.ip, selected: row.ip === r.ip }, `${row.name}${row.known ? "" : ` (${t("unknown", "唔認識")})`}`))),
        h("button", { type: "button", class: "btn o sm icon", disabled: !canWrite, "aria-label": `${t("Remove", "移除")} ${r.name}`, onClick: () => remove(r) }, icon("delete", "sm"))));
    if (canWrite) draggable(el, { zones, enabled: () => canWrite, onDrop: (zone) => zone.dataset.ip !== r.ip && update(r, { ip: zone.dataset.ip }, `${r.name} → ${zone.dataset.ip}`) });
    return el;
  }

  function draw() {
    const conflicts = findConflicts(rules, data.services);
    const bad = conflictedRules(conflicts);
    const rows = laneRows(data.devices, rules);
    const fwEntry = entry("firewall-pro.services.rules");
    ctx.clear(head).append(
      toggle("fw.forwarding", t("Port forwarding", "端口轉發"), data.forwarding.enabled),
      data.firewall.present ? toggle("firewall-pro.services.enable", t("Service rules", "服務規則"), data.firewall.enabled) : null,
      h("button", { type: "button", class: "btn f sm", disabled: !canWrite || rules.length >= 64, onClick: () => newRule() }, icon("add", "sm"), t("New rule", "新增規則")));
    ctx.clear(banner).append(...conflicts.map((c) => h("div", { class: "note warn" }, icon("warning"), c.kind === "forward-forward"
      ? t(`Rules #${c.a + 1} and #${c.b + 1} both take port ${rules[c.a].extPort} from the internet. Only one can win.`, `規則 #${c.a + 1} 同 #${c.b + 1} 都要攞外面嘅 ${rules[c.a].extPort} 端口，只有一條會生效。`)
      : t(`Rule #${c.rule + 1} uses port ${rules[c.rule].extPort}, which the router itself offers to the internet (${tt(data.services.find((s) => s.id === c.service).name)}).`, `規則 #${c.rule + 1} 用 ${rules[c.rule].extPort} 端口，但路由器自己都開放呢個端口俾互聯網（${tt(data.services.find((s) => s.id === c.service).name)}）。`))),
      ...rules.flatMap((r, i) => problemsOf(r, data.devices).includes("unknown-device") ? [h("div", { class: "note" }, icon("help"), t(`Rule #${i + 1} points at ${r.ip}, which no known device uses right now.`, `規則 #${i + 1} 指向 ${r.ip}，而家冇已知裝置用呢個地址。`))] : []));

    const internet = h("section", { class: "rc-lane" }, h("h2", { class: "h2" }, icon("public"), t("Internet", "互聯網")), h("div", { class: "t2" }, t("Who may knock, and on which port", "邊個可以敲門，喺邊個端口")),
      rules.length ? rules.map((r, i) => internetCard(r, i, bad)) : h("div", { class: "empty" }, icon("lock", "lg"), t("Nothing is forwarded. The internet cannot start a connection to your devices.", "冇轉發任何嘢。互聯網唔可以主動連去你嘅裝置。")));
    const router = h("section", { class: "rc-lane" }, h("h2", { class: "h2" }, icon("router"), t("Router", "路由器")), h("div", { class: "t2" }, t("What the router answers itself, and its own rules", "路由器自己回應嘅嘢，同佢自己嘅規則")),
      data.services.map((s) => h("div", { class: `rc-card${s.wan ? " exposed" : ""}` }, h("div", { class: "rc-line" }, icon(s.wan ? "public" : "home", "sm"), h("b", {}, tt(s.name)), h("span", { class: "rc-port static" }, `${s.port}/${s.proto}`)), h("span", { class: `tag ${s.wan ? "warn" : "good"}` }, s.wan ? t("Reachable from the internet", "互聯網連得到") : t("Home network only", "只限屋企網絡")))),
      data.firewall.present ? h("div", { class: "rc-fw" }, h("h3", { class: "k" }, t("Outgoing service rules", "對外服務規則")), fw.length ? fw.map((r) => h("div", { class: "rc-card" }, h("div", { class: "rc-line" }, icon("shield", "sm"), h("b", {}, `${r.proto} ${r.dstPort || t("any port", "任何端口")}`), r.dstIp ? h("span", { class: "tag" }, `→ ${r.dstIp}`) : null, r.srcIp ? h("span", { class: "tag" }, `${t("from", "來自")} ${r.srcIp}`) : null, h("button", { type: "button", class: "btn o sm icon", disabled: !canWrite || !fwEntry || Boolean(fwEntry.disabled), "aria-label": t("Remove this rule", "移除呢條規則"), onClick: () => setFirewall(fw.filter((x) => x !== r), t("Rule removed from the pending changes.", "規則已加入待套用變更。")) }, icon("delete", "sm"))))) : h("div", { class: "muted" }, t("No outgoing service rules.", "冇對外服務規則。")),
        h("button", { type: "button", class: "btn t sm", disabled: !canWrite || !fwEntry || Boolean(fwEntry.disabled) || fw.length >= 32, onClick: () => newFirewall() }, icon("add", "sm"), t("Add a rule", "加一條規則"))) : null);
    const devicesLane = h("section", { class: "rc-lane" }, h("h2", { class: "h2" }, icon("devices"), t("Devices", "裝置")), h("div", { class: "t2" }, t("Drop a rule card on a device to point it there", "將規則卡放喺裝置上就改咗目標")),
      rows.map((row) => h("div", { class: `rc-device${row.known ? "" : " unknown"}`, "data-ip": row.ip }, h("div", { class: "rc-devhead" }, icon(row.known ? "devices_other" : "help", "sm"), h("b", {}, row.name), h("span", { class: "t2 mono" }, row.ip)),
        rules.map((r, i) => (r.ip === row.ip ? deviceCard(r, i, bad, rows) : null)))));
    ctx.clear(lanes).append(internet, router, devicesLane);
  }

  function toggle(id, text, on) {
    const e = entry(id);
    const pendingOn = e && ctx.dock.has(id) ? ctx.dock.value(id) === e.values.on : on;
    return h("button", { type: "button", class: `chip${pendingOn ? " on" : ""}`, role: "switch", "aria-checked": String(pendingOn), disabled: !canWrite || !e || Boolean(e.disabled), onClick() {
      ctx.dock.setEntry(e, pendingOn ? e.values.off : e.values.on);
      draw();
    } }, icon(pendingOn ? "toggle_on" : "toggle_off", "sm"), `${text}: ${pendingOn ? t("on", "開") : t("off", "關")}`);
  }

  function field(text, input) {
    return h("label", { class: "me-field" }, h("span", {}, text), input);
  }

  function newRule() {
    const rows = data.devices.length ? data.devices : [];
    ctx.openDialog((close) => {
      const name = h("input", { class: "field", maxlength: "32", "aria-label": t("Rule name", "規則名稱"), placeholder: t("Game server", "遊戲伺服器") });
      const device = h("select", { class: "field", "aria-label": t("Send to device", "送去裝置") }, rows.map((d) => h("option", { value: d.ip }, `${d.name} · ${d.ip}`)));
      const ext = h("input", { class: "field", maxlength: "11", inputmode: "numeric", placeholder: "25565", "aria-label": t("Outside port", "外面端口") });
      const int = h("input", { class: "field", maxlength: "11", inputmode: "numeric", placeholder: t("same as outside", "同外面一樣"), "aria-label": t("Device port", "裝置端口") });
      const src = h("input", { class: "field", maxlength: "15", placeholder: t("anyone", "任何人"), "aria-label": t("Only from this address", "只限呢個地址") });
      let proto = "TCP";
      const seg = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Protocol", "協定") });
      const drawSeg = () => ctx.clear(seg).append(...PROTOS.map((p) => h("button", { type: "button", role: "radio", class: p === proto ? "on" : "", "aria-checked": String(p === proto), onClick: () => { proto = p; drawSeg(); } }, p === "BOTH" ? t("TCP + UDP", "TCP 加 UDP") : p)));
      drawSeg();
      const error = h("div", { class: "note bad", hidden: true, role: "alert" });
      const fail = (en, yue) => { error.hidden = false; error.textContent = t(en, yue); };
      return [h("h2", { class: "h2" }, t("New forwarding rule", "新增轉發規則")),
        field(t("Name", "名稱"), name), field(t("Send to", "送去"), device), field(t("Outside port", "外面端口"), ext), field(t("Device port", "裝置端口"), int), field(t("Protocol", "協定"), seg), field(t("Only from this address (optional)", "只限呢個地址（可選）"), src), error,
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { type: "button", class: "btn f", onClick() {
          const extRange = parsePort(ext.value);
          const intRange = int.value.trim() ? parsePort(int.value) : extRange;
          if (!name.value.trim()) return fail("Give the rule a name.", "請畀條規則一個名。");
          if (!device.value) return fail("There is no device to send it to yet.", "暫時未有裝置可以送去。");
          if (!extRange || !intRange) return fail("Use ports from 1 to 65535, or a range such as 8000:8010.", "請用 1 至 65535 嘅端口，或者好似 8000:8010 嘅範圍。");
          if (src.value.trim() && !IPV4.test(src.value.trim())) return fail("The source address must be an IPv4 address, or empty for anyone.", "來源地址要係 IPv4 地址，留空即係任何人。");
          if (add({ name: name.value.trim(), extPort: portText(extRange), ip: device.value, intPort: portText(intRange), proto, srcIp: src.value.trim() })) close(true);
        } }, icon("add", "sm"), t("Add to pending changes", "加入待套用變更")))];
      }, { label: t("New forwarding rule", "新增轉發規則") });
  }

  function newFirewall() {
    ctx.openDialog((close) => {
      const dst = h("input", { class: "field", maxlength: "11", inputmode: "numeric", "aria-label": t("To port", "目的端口"), placeholder: "443" });
      const src = h("input", { class: "field", maxlength: "15", "aria-label": t("From address (optional)", "來源地址（可選）"), placeholder: t("any device", "任何裝置") });
      let proto = "TCP";
      const seg = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Protocol", "協定") });
      const drawSeg = () => ctx.clear(seg).append(...["TCP", "UDP"].map((p) => h("button", { type: "button", role: "radio", class: p === proto ? "on" : "", "aria-checked": String(p === proto), onClick: () => { proto = p; drawSeg(); } }, p)));
      drawSeg();
      const error = h("div", { class: "note bad", hidden: true, role: "alert" });
      return [h("h2", { class: "h2" }, t("New service rule", "新增服務規則")), field(t("To port", "目的端口"), dst), field(t("Protocol", "協定"), seg), field(t("From address (optional)", "來源地址（可選）"), src), error,
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { type: "button", class: "btn f", onClick() {
          const range = parsePort(dst.value);
          if (!range) return (error.hidden = false, void (error.textContent = t("Use a port from 1 to 65535, or a range such as 8000:8010.", "請用 1 至 65535 嘅端口，或者好似 8000:8010 嘅範圍。")));
          if (src.value.trim() && !IPV4.test(src.value.trim())) return (error.hidden = false, void (error.textContent = t("The address must be an IPv4 address, or empty.", "地址要係 IPv4 地址，或者留空。")));
          setFirewall([...fw, { srcIp: src.value.trim(), srcPort: "", dstIp: "", dstPort: portText(range), proto }], t("Rule added to the pending changes.", "規則已加入待套用變更。"));
          close(true);
        } }, icon("add", "sm"), t("Add to pending changes", "加入待套用變更")))];
    }, { label: t("New service rule", "新增服務規則") });
  }

  page.append(h("section", { class: "card rise" }, head, banner), lanes);
  draw();

  const refresh = async () => {
    if (ctx.dock.count() > 0 || document.hidden) return;
    try {
      data = await api.get("/api/domain/rule-canvas");
      rules = data.forwarding.rules.map((r) => ({ ...r }));
      fw = data.firewall.rules.map((r) => ({ ...r }));
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
  id: "rule-canvas",
  screens: [{ id: "rule-canvas", group: { en: "Network", yue: "網絡" }, icon: "swap_horiz", label, render: screen }],
  commands: [{ id: "rule-canvas.open", icon: "swap_horiz", label: { en: "Open the rule canvas", yue: "開啟規則畫布" }, keywords: "port forwarding firewall rule conflict lane 端口 轉發 防火牆 規則", run: (ctx) => ctx.navigate("rule-canvas") }],
};
