// Priority board: put the traffic that matters at the top. Drag the Adaptive QoS
// groups into order, drag traditional rules between priority lanes, and set how
// much of the line each device may use. Edits wait in the pending-changes dock.
import { draggable } from "./drag.js";
import { PRIORITIES, formatOrder, lanes, moveGroup, parseOrder, readLimits, readRules, setPriority, share, speedText, writeLimits, writeRules } from "./model.js";

// Appends children, skipping empty ones and flattening lists. (The native append would print "null" for a gap.)
function add(el, ...kids) {
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}
const fill = (el, ...kids) => (el.replaceChildren(), add(el, ...kids));

const label = { en: "Priority board", yue: "優先次序板" };
const lede = { en: "Drag what matters most to the top. When the line is busy, the top is served first.", yue: "將最重要嘅拖到最頂。線路繁忙嘅時候，最頂嘅最先處理。" };
const REFRESH_MS = 12000;

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const canWrite = ctx.state.canWrite;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  let data = await api.get("/api/domain/qos-pro");
  const names = new Map(((await api.get("/api/domain/devices").catch(() => ({ devices: [] }))).devices ?? []).map((d) => [d.ip, d.name]));
  const known = [...names].map(([ip, name]) => ({ ip, name }));
  let tab = "groups";
  const tabs = h("div", { class: "seg", role: "radiogroup", "aria-label": t("What to order", "要排嘅嘢") });
  const body = h("div", { class: "pb-body" });
  const entry = (id) => data.entries.find((e) => e.id === id);
  const valueOf = (e) => (ctx.dock.has(e.id) ? ctx.dock.value(e.id) : e.value);
  const stage = (e, value) => {
    if (!canWrite) return ctx.toast(t("Your role can only look.", "你嘅角色只可以睇。"), "warn");
    ctx.dock.setEntry(e, value);
    drawBody();
  };
  const unavailable = (e, fallback) => h("div", { class: "empty" }, icon("speed", "lg"), e?.disabled ? tt(e.disabled) : fallback);
  const methodNote = (wanted, en, yue) => (data.method === wanted ? null : h("div", { class: "note warn" }, icon("info"), t(en, yue)));

  // ---- adaptive groups ----
  function groupsView() {
    const e = entry("qos-pro.adaptive.order");
    if (!e || e.disabled) return unavailable(e, t("This router has no Adaptive QoS groups.", "呢部路由器冇自適應 QoS 群組。"));
    const groups = parseOrder(valueOf(e));
    const nameOf = (g) => {
      const option = e.options.find(([v]) => v === g.join(","));
      return option ? tt(option[1]) : g.join(", ");
    };
    const zones = () => [...body.querySelectorAll("[data-slot]")];
    const move = (from, to) => stage(e, formatOrder(moveGroup(groups, from, to)));
    const list = h("ol", { class: "pb-groups" }, groups.map((g, i) => {
      const card = h("li", { class: "pb-group", "data-slot": String(i), tabindex: "0", "aria-label": `${t("Priority", "優先級")} ${i + 1}: ${nameOf(g)}. ${t("Alt plus arrow keys move it.", "按 Alt 加方向鍵可以移動。")}`,
        onKeydown(ev) {
          if (!ev.altKey || !canWrite) return;
          if (ev.key === "ArrowUp") (ev.preventDefault(), move(i, i - 1));
          if (ev.key === "ArrowDown") (ev.preventDefault(), move(i, i + 1));
        } },
      h("span", { class: "pb-rank" }, String(i + 1)),
      icon("drag_indicator", "sm"),
      h("div", { class: "pb-gname" }, h("b", {}, nameOf(g)), h("span", { class: "t2" }, `${t("Categories", "類別")} ${g.join(", ")}`)),
      h("span", { class: "tag" }, i === 0 ? t("Served first", "最先處理") : i === groups.length - 1 ? t("Served last", "最後處理") : t("In between", "中間")),
      h("button", { type: "button", class: "btn o sm icon", disabled: !canWrite || i === 0, "aria-label": `${t("Move up", "上移")}: ${nameOf(g)}`, onClick: () => move(i, i - 1) }, icon("arrow_upward", "sm")),
      h("button", { type: "button", class: "btn o sm icon", disabled: !canWrite || i === groups.length - 1, "aria-label": `${t("Move down", "下移")}: ${nameOf(g)}`, onClick: () => move(i, i + 1) }, icon("arrow_downward", "sm")));
      if (canWrite) draggable(card, { zones, enabled: () => canWrite, onDrop: (zone) => move(i, Number(zone.dataset.slot)) });
      return card;
    }));
    return h("div", { class: "pb-main" },
      methodNote("adaptive", "Adaptive QoS is not the method in use right now, so this order has no effect until it is.", "而家用緊嘅唔係自適應 QoS，所以呢個次序要等改用佢先生效。"),
      list,
      e.meta?.note ? h("div", { class: "t2" }, tt(e.meta.note)) : null);
  }

  // ---- traditional rules in priority lanes ----
  function rulesView() {
    const e = entry("qos-pro.rules");
    if (!e || e.disabled) return unavailable(e, t("This router has no traditional QoS rules.", "呢部路由器冇傳統 QoS 規則。"));
    const rules = readRules(valueOf(e));
    const zones = () => [...body.querySelectorAll("[data-lane]")];
    const put = (rule, priority) => rule.priority !== priority && stage(e, writeRules(setPriority(rules, rule.index, priority)));
    const lane = ({ value, rules: inLane }) => h("section", { class: "pb-lane", "data-lane": value, "aria-label": tt(PRIORITIES.find(([v]) => v === value)[1]) },
      h("div", { class: "k" }, tt(PRIORITIES.find(([v]) => v === value)[1])),
      inLane.length ? inLane.map((r) => {
        const card = h("div", { class: "pb-rule" },
          h("div", { class: "pb-rline" }, icon("drag_indicator", "sm"), h("b", {}, r.name || t("(no name)", "（冇名）"))),
          h("div", { class: "chips" }, h("span", { class: "tag" }, r.proto.toUpperCase()), h("span", { class: "tag" }, r.port ? `${t("port", "端口")} ${r.port}` : t("any port", "任何端口")), r.source ? h("span", { class: "tag" }, names.get(r.source) ?? r.source) : null, r.size ? h("span", { class: "tag" }, `${t("size", "大小")} ${r.size}`) : null),
          h("label", { class: "visually-hidden", for: `pb-p-${r.index}` }, t("Priority", "優先級")),
          h("select", { id: `pb-p-${r.index}`, class: "field pb-select", disabled: !canWrite, onChange: (ev) => put(r, ev.target.value) }, PRIORITIES.map(([v, l]) => h("option", { value: v, selected: v === r.priority }, tt(l)))));
        if (canWrite) draggable(card, { zones, enabled: () => canWrite, onDrop: (zone) => put(r, zone.dataset.lane) });
        return card;
      }) : h("div", { class: "pb-none" }, t("Drop a rule here", "將規則放呢度")));
    return h("div", { class: "pb-main" },
      methodNote("traditional", "Traditional QoS is not the method in use right now, so these rules have no effect until it is.", "而家用緊嘅唔係傳統 QoS，所以呢啲規則要等改用佢先生效。"),
      rules.length ? h("div", { class: "pb-lanes" }, lanes(rules).map(lane)) : h("div", { class: "empty" }, icon("rule", "lg"), t("There are no traditional QoS rules yet.", "未有傳統 QoS 規則。")),
      h("div", { class: "t2" }, t("Rules are still checked from the top of the list; a lane only sets how much each one matters.", "規則照舊由清單頂部開始檢查；通道只係決定每條規則幾重要。")));
  }

  // ---- per-device limits ----
  function limitsView() {
    const e = entry("qos-pro.limiter.rules");
    if (!e || e.disabled) return unavailable(e, t("This router has no bandwidth limiter.", "呢部路由器冇頻寬限制。"));
    const limits = readLimits(valueOf(e));
    const line = { down: data.speed.down, up: data.speed.up };
    const save = (next) => stage(e, writeLimits(next));
    const replace = (l, change) => save(limits.map((x) => (x.index === l.index ? { ...x, ...change } : x)));
    const slider = (l, dir, text) => {
      const max = Math.max(line[dir] || 1000000, l[dir]);
      const out = h("output", { class: "pb-out" }, speedText(l[dir], t("no limit", "冇限制")));
      const input = h("input", { type: "range", min: "0", max: String(max), step: String(Math.max(100, Math.round(max / 200))), value: String(l[dir]), disabled: !canWrite || !l.on, "aria-label": `${nameOf(l.device)}: ${text}`,
        onInput: (ev) => (out.textContent = speedText(Number(ev.target.value), t("no limit", "冇限制"))),
        onChange: (ev) => replace(l, { [dir]: Number(ev.target.value) }) });
      return h("label", { class: "pb-slider" }, h("span", {}, text), input, out, h("span", { class: "pb-bar", "aria-hidden": "true" }, h("i", { "data-share": String(Math.round(share(l[dir], line[dir]) * 100)) })));
    };
    const nameOf = (ip) => names.get(ip) ?? ip;
    const free = known.filter((k) => !limits.some((l) => l.device === k.ip));
    const addPick = h("select", { class: "field", "aria-label": t("Limit another device", "限制另一部裝置"), disabled: !canWrite || !free.length || limits.length >= e.maxItems }, h("option", { value: "" }, t("Limit a device…", "限制一部裝置…")), free.map((k) => h("option", { value: k.ip }, `${k.name} · ${k.ip}`)));
    addPick.addEventListener("change", () => addPick.value && save([...limits, { index: limits.length, on: true, device: addPick.value, down: Math.round((line.down || 20000) / 2), up: Math.round((line.up || 10000) / 2) }]));
    const view = h("div", { class: "pb-main" },
      methodNote("limiter", "The bandwidth limiter is not the method in use right now, so these limits have no effect until it is.", "而家用緊嘅唔係頻寬限制，所以呢啲限制要等改用佢先生效。"),
      limits.length ? limits.map((l) => h("div", { class: `pb-limit${l.on ? "" : " off"}` },
        h("div", { class: "pb-rline" }, icon("devices_other", "sm"), h("b", {}, nameOf(l.device)), h("span", { class: "t2 mono" }, l.device),
          h("button", { type: "button", class: `chip${l.on ? " on" : ""}`, role: "switch", "aria-checked": String(l.on), disabled: !canWrite, onClick: () => replace(l, { on: !l.on }) }, l.on ? t("On", "開") : t("Off", "關")),
          h("button", { type: "button", class: "btn o sm icon", disabled: !canWrite, "aria-label": `${t("Remove the limit for", "移除限制：")} ${nameOf(l.device)}`, onClick: () => save(limits.filter((x) => x.index !== l.index)) }, icon("delete", "sm"))),
        slider(l, "down", t("Download", "下載")), slider(l, "up", t("Upload", "上載")))) : h("div", { class: "empty" }, icon("speed", "lg"), t("No device is limited.", "冇裝置受限制。")),
      addPick,
      line.down || line.up ? h("div", { class: "t2" }, t(`Your line: ${speedText(line.down, "?")} down, ${speedText(line.up, "?")} up.`, `你條線：下載 ${speedText(line.down, "?")}，上載 ${speedText(line.up, "?")}。`)) : h("div", { class: "note warn" }, icon("info"), t("The line speed is not set, so the sliders use a generous top end. Set it under Traffic priority.", "未設定線路速度，所以滑桿用咗一個闊啲嘅上限。請去「流量優先」設定。")));
    return view;
  }

  function drawTabs() {
    fill(tabs, ...[["groups", "Adaptive groups", "自適應群組"], ["rules", "Priority lanes", "優先通道"], ["limits", "Device limits", "裝置限制"]].map(([id, en, yue]) => h("button", { type: "button", role: "radio", "aria-checked": String(tab === id), class: tab === id ? "on" : "", onClick() { tab = id; drawTabs(); drawBody(); } }, t(en, yue))));
  }
  function drawBody() {
    fill(body, tab === "groups" ? groupsView() : tab === "rules" ? rulesView() : limitsView());
    for (const el of body.querySelectorAll("[data-share]")) el.style.setProperty("width", `${el.dataset.share}%`);
  }
  add(page, h("section", { class: "card rise" }, tabs, body));
  drawTabs();
  drawBody();

  const refresh = async () => {
    if (ctx.dock.count() > 0 || document.hidden) return;
    try {
      data = await api.get("/api/domain/qos-pro");
      drawBody();
    } catch {
      /* The next refresh tries again. */
    }
  };
  const timer = setInterval(refresh, REFRESH_MS);
  const off = ctx.bus.on("dock", () => ctx.dock.count() === 0 && refresh());
  return () => (clearInterval(timer), off());
}

export default {
  id: "priority-board",
  screens: [{ id: "priority-board", group: { en: "Network", yue: "網絡" }, icon: "low_priority", label, render: screen }],
  commands: [{ id: "priority-board.open", icon: "low_priority", label: { en: "Open the priority board", yue: "開啟優先次序板" }, keywords: "priority qos order drag limit bandwidth traffic 優先 流量 頻寬", run: (ctx) => ctx.navigate("priority-board") }],
};
