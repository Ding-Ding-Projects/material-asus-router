// Traffic priority: the Adaptive QoS priority order you drag into place, the
// traditional QoS rules, the per-device bandwidth limiter, the line speed with
// units and a measure button, and the Cake settings (Asuswrt-Merlin only).
// Every setting writes through the change dock, so it gets a preview, the safety
// net and undo. The rules and limiter use the rule-table control from the
// firewall-pro folder.
import { findSpeedTest, formatOrder, moveGroup, parseOrder, plannedSpeed, rateText, readSpeed } from "./model.js";

const label = { en: "Priority and limits", yue: "優先同限制" };
const lede = { en: "Keep calls and games smooth: choose what goes first, set rules, and cap devices that hog the line.", yue: "令通話同遊戲保持順暢：揀咩先行、定規則，同限制霸佔線路嘅裝置。" };

// The priority order: a list of traffic groups you drag, or move with the arrow
// buttons, into the order that matters. The top group is served first.
function priorityOrder(entry, current, commit, locked, ctx) {
  const { h, icon, t, tt } = ctx;
  const names = new Map((entry.options ?? []).map(([ids, text]) => [ids, text]));
  const list = h("ol", { class: "qp-tiers", "aria-label": tt(entry.label) });
  const status = h("div", { class: "sr", role: "status" });
  let dragging = -1;
  const groups = () => parseOrder(current());
  const move = (from, to) => {
    const next = moveGroup(groups(), from, to);
    commit(formatOrder(next));
    draw();
    const at = list.children[to]?.querySelector("button.qp-up, button.qp-down");
    status.textContent = t(`Moved to position ${to + 1}.`, `已移到第 ${to + 1} 位。`);
    at?.focus();
  };
  function draw() {
    const all = groups();
    list.replaceChildren(...all.map((ids, i) => {
      const name = names.get(ids.join(","));
      return h("li", { class: "qp-tier", draggable: locked ? "false" : "true",
        onDragstart(e) { dragging = i; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); },
        onDragover(e) { if (dragging >= 0) { e.preventDefault(); e.currentTarget.classList.add("over"); } },
        onDragleave(e) { e.currentTarget.classList.remove("over"); },
        onDrop(e) { e.preventDefault(); e.currentTarget.classList.remove("over"); if (dragging >= 0) move(dragging, i); dragging = -1; },
        onDragend() { dragging = -1; } },
        icon("drag_indicator"),
        h("span", { class: "qp-rank" }, String(i + 1)),
        h("div", { class: "grow" }, h("div", { class: "t1" }, name ? tt(name) : t("Custom group", "自訂群組")), h("div", { class: "t2 mono" }, ids.join(", "))),
        locked ? null : h("div", { class: "qp-moves" },
          h("button", { class: "btn t icon qp-up", type: "button", disabled: i === 0, "aria-label": `${t("Move earlier", "排前啲")}: ${name ? tt(name) : ids.join(",")}`, onClick: () => move(i, i - 1) }, icon("arrow_upward", "sm")),
          h("button", { class: "btn t icon qp-down", type: "button", disabled: i === all.length - 1, "aria-label": `${t("Move later", "排後啲")}: ${name ? tt(name) : ids.join(",")}`, onClick: () => move(i, i + 1) }, icon("arrow_downward", "sm"))));
    }));
  }
  draw();
  return { el: h("div", { class: "qp-order" }, h("div", { class: "muted" }, t("Most important first. Drag a group, or use the arrows.", "最重要嘅放最前。拖動群組，或者用箭咀。")), list, status), sync: draw };
}

function speedCard(ctx, data, byId) {
  const { api, h, icon, t } = ctx;
  const up = byId.get("qos.up");
  const down = byId.get("qos.down");
  const value = (entry) => Number(ctx.dock.has(entry.id) ? ctx.dock.value(entry.id) : entry.value) || 0;
  const line = h("div", { class: "qp-speed", role: "status" });
  const result = h("div", { class: "note", hidden: true });
  const draw = () => { line.textContent = t(`Download ${rateText(value(down))}, upload ${rateText(value(up))}.`, `下載 ${rateText(value(down))}，上載 ${rateText(value(up))}。`); };
  draw();
  const off = ctx.bus.on("dock", draw);
  const measure = h("button", { class: "btn o", type: "button", disabled: true, onClick: async () => {
    measure.disabled = true;
    result.hidden = false;
    result.className = "note";
    result.textContent = t("Measuring…", "量度緊…");
    try {
      const out = await api.post(`/api/actions/${measure.dataset.id}.run`);
      const speed = readSpeed(out);
      if (!speed) { result.textContent = t("The speed test finished, but its result is in a form this screen cannot read yet.", "速度測試完成，但結果嘅格式呢個畫面未讀得到。"); return; }
      result.textContent = t(`Measured ${rateText(speed.down)} down and ${rateText(speed.up)} up.`, `量度到下載 ${rateText(speed.down)}，上載 ${rateText(speed.up)}。`);
      if (ctx.state.canWrite) result.append(" ", h("button", { class: "btn f sm", type: "button", onClick() { ctx.dock.setEntry(down, String(plannedSpeed(speed.down))); ctx.dock.setEntry(up, String(plannedSpeed(speed.up))); ctx.toast(t("Line speed is waiting in the change dock.", "線路速度已放入改動欄等緊。")); } }, t("Use 90 percent of this", "用呢個速度嘅 90%")));
    } catch (error) {
      result.className = "note bad";
      result.textContent = error.message;
    } finally {
      measure.disabled = false;
    }
  } }, icon("speed", "sm"), t("Measure my speed", "量度我嘅速度"));
  const reason = h("div", { class: "t2" });
  api.get("/api/features/manifest").then((manifest) => {
    const id = findSpeedTest(manifest);
    if (id) { measure.dataset.id = id; measure.disabled = false; }
    else reason.textContent = t("In progress: measuring needs the Speed test feature, which is not part of this build yet. Enter the speeds by hand for now.", "進行中：量度需要速度測試功能，呢個版本未有。暫時請手動輸入速度。");
  }).catch(() => { reason.textContent = t("The speed test could not be looked up.", "搵唔到速度測試。"); });
  return { el: h("div", { class: "qp-speedcard" }, line, h("div", { class: "ctl" }, measure), reason, result), off };
}

export default {
  id: "qos-pro",

  controls: { "priority-order": priorityOrder },

  screens: [
    {
      id: "qos-pro",
      group: { en: "Network", yue: "網絡" },
      icon: "speed",
      label,
      async render(ctx) {
        const { h, icon, t, tt } = ctx;
        const page = ctx.page(label, lede);
        ctx.root.append(page);
        const data = await ctx.api.get("/api/domain/qos-pro");
        const byId = new Map(data.stock.map((e) => [e.id, e]));
        const offs = [];

        const methodText = { adaptive: t("Adaptive", "自適應"), traditional: t("Traditional", "傳統"), limiter: t("Bandwidth limiter", "頻寬限制"), other: t("Another method", "其他方式") }[data.method];
        page.append(h("div", { class: `note ${data.enabled ? "" : "warn"}` }, icon(data.enabled ? "check_circle" : "info"),
          data.enabled ? t(`Traffic priority is on. Method: ${methodText}.`, `流量優先已開啟。方式：${methodText}。`) : t("Traffic priority is off. The settings below are kept but do nothing until it is on.", "流量優先關閉中。下面嘅設定會保留，但開咗先生效。")));

        const stock = ctx.controls.groupCard({ en: "Traffic priority", yue: "流量優先" }, data.stock);
        const speed = speedCard(ctx, data, byId);
        offs.push(speed.off);
        stock.append(h("div", { class: "qp-speedwrap" }, h("div", { class: "k" }, t("Line speed", "線路速度")), speed.el));
        page.append(stock);

        const groups = ctx.controls.settingGroups(data.entries);
        for (const group of groups) {
          const card = ctx.controls.groupCard(group.label, group.entries);
          if (group.id === "cake") card.append(h("div", { class: "note warn" }, icon("construction"), t("In progress: choosing Cake as the method is not offered yet, because the Method setting above does not list it. The two settings here are ready for when it is.", "進行中：暫時未能將 Cake 揀做方式，因為上面嘅「方式」未列出佢。呢兩個設定已經準備好。")));
          page.append(card);
        }

        const notes = data.entries.filter((e) => e.meta?.note);
        if (notes.length) page.append(h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("construction", "sm"), " ", t("In progress", "進行中")), notes.map((e) => h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "t1" }, tt(e.label)), h("div", { class: "t2" }, tt(e.meta.note)))))));
        return () => offs.forEach((off) => off());
      },
    },
  ],

  commands: [
    { id: "qos-pro.open", icon: "speed", label: { en: "Open traffic priority", yue: "開啟流量優先" }, keywords: "qos priority bandwidth limiter speed cake adaptive games", run: (ctx) => ctx.navigate("qos-pro") },
  ],
};
