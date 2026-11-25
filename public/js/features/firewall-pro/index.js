// Firewall and filters: logging, the website and keyword filters, the network
// services filter with a week grid showing when it is active, and the IPv6
// firewall rules. Every setting is a real control that writes through the
// pending-changes dock, so each change gets a preview, the safety net and undo.
import { ruleTable } from "./rule-table.js";
import { DAY_NAMES, activeGrid, timerange, weekdays } from "./time-controls.js";

const label = { en: "Firewall and filters", yue: "防火牆同過濾" };
const lede = { en: "What the firewall logs and blocks: websites, keywords, services and IPv6 connections.", yue: "防火牆記錄同封鎖啲咩：網站、關鍵字、服務同 IPv6 連線。" };

// A read-only week grid: the hours the services filter is active, from its days
// and its two time windows, including edits still waiting in the dock.
export function scheduleGrid(ctx, entries) {
  const { h, t } = ctx;
  const value = (id) => {
    const entry = entries.find((e) => e.id === id);
    return entry ? (ctx.dock.has(id) ? ctx.dock.value(id) : entry.value) : "";
  };
  const grid = h("div", { class: "schedule fp-preview", role: "img" });
  grid.style.setProperty("--cols", "24");
  const note = h("div", { class: "muted" });
  const draw = () => {
    const rows = activeGrid(value("firewall-pro.services.days"), [value("firewall-pro.services.time"), value("firewall-pro.services.time2")]);
    grid.replaceChildren(...rows.flatMap((row, d) => [h("span", { class: "dayname" }, t(...DAY_NAMES[d])), ...row.map((on) => h("span", { class: `slot ${on ? "on" : ""}`, "aria-hidden": "true" }))]));
    const hours = rows.flat().filter(Boolean).length;
    note.textContent = hours ? t(`Active ${hours} hours a week.`, `每個星期有 ${hours} 個鐘生效。`) : t("Not active at any time.", "任何時間都唔生效。");
    grid.setAttribute("aria-label", note.textContent);
  };
  draw();
  const off = ctx.bus.on("dock", draw);
  return { el: h("div", { class: "fp-schedule" }, h("div", { class: "k" }, t("When the services filter is active", "服務過濾幾時生效")), grid, note), off };
}

function summaryCard(ctx, data) {
  const { h, icon, t } = ctx;
  const s = data.summary;
  const state = (on) => h("span", { class: `tag ${on ? "good" : ""}` }, on ? t("On", "開") : t("Off", "關"));
  const line = (name, on, extra) => h("div", { class: "row" }, h("span", { class: "grow" }, name), extra ? h("span", { class: "muted" }, extra) : null, state(on));
  return h("section", { class: "card rise" },
    h("h2", { class: "h2" }, icon("shield", "sm"), " ", t("What is on now", "而家開咗啲咩")),
    line(t("Firewall", "防火牆"), s.firewall),
    line(t("IPv6 firewall", "IPv6 防火牆"), s.ipv6Firewall, t(`${s.ipv6.rules} rules`, `${s.ipv6.rules} 條規則`)),
    line(t("Website filter", "網站過濾"), s.url.enabled, t(`${s.url.rules} websites`, `${s.url.rules} 個網站`)),
    line(t("Keyword filter", "關鍵字過濾"), s.keyword.enabled, t(`${s.keyword.rules} keywords`, `${s.keyword.rules} 個關鍵字`)),
    line(t("Network services filter", "網絡服務過濾"), s.services.enabled, t(`${s.services.rules} rules`, `${s.services.rules} 條規則`)));
}

function heldCard(ctx, held) {
  const { h, icon, t, tt } = ctx;
  return h("section", { class: "card rise" },
    h("h2", { class: "h2" }, icon("construction", "sm"), " ", t("In progress", "進行中")),
    h("div", { class: "t2" }, tt(held[0].meta.note)),
    h("div", { class: "chips" }, held.map((e) => h("span", { class: "chip" }, tt(e.label)))));
}

function testCard(ctx) {
  const { api, h, icon, t } = ctx;
  const out = h("div", { class: "note", role: "status", hidden: true });
  const input = h("input", { class: "field", type: "text", autocomplete: "off", spellcheck: "false", maxlength: "200", placeholder: "shop.example.test/page", "aria-label": t("An address to test", "要測試嘅地址"), onKeydown: (e) => { if (e.key === "Enter") run(); } });
  async function run() {
    out.hidden = false;
    out.className = "note";
    try {
      const r = await api.get(`/api/x/firewall-pro/test-url?url=${encodeURIComponent(input.value)}`);
      out.className = `note ${r.blocked ? "bad" : ""}`;
      out.textContent = r.blocked
        ? t(`Blocked by the ${r.byUrlFilter ? `website filter (${r.matchedSite})` : `keyword filter (${r.matchedKeyword})`}.`, `${r.byUrlFilter ? `被網站過濾（${r.matchedSite}）` : `被關鍵字過濾（${r.matchedKeyword}）`}封鎖。`)
        : t("Not blocked by the website or keyword filter.", "冇被網站或關鍵字過濾封鎖。");
    } catch (error) {
      out.className = "note bad";
      out.textContent = error.message;
    }
  }
  return h("section", { class: "card rise" },
    h("h2", { class: "h2" }, icon("travel_explore", "sm"), " ", t("Test an address", "測試地址")),
    h("p", { class: "muted" }, t("See whether the filters above would block an address, without visiting it.", "唔使真係去嗰個地址，就睇到上面嘅過濾會唔會封鎖佢。")),
    h("div", { class: "ctl" }, input, h("button", { class: "btn o", type: "button", onClick: run }, icon("search", "sm"), t("Check", "檢查"))), out);
}

export default {
  id: "firewall-pro",

  // The control types this folder adds; qos-pro uses rule-table too.
  controls: { "rule-table": ruleTable, weekdays, timerange },

  screens: [
    {
      id: "firewall-pro",
      group: { en: "Network", yue: "網絡" },
      icon: "local_fire_department",
      label,
      async render(ctx) {
        const page = ctx.page(label, lede);
        ctx.root.append(page);
        const data = await ctx.api.get("/api/domain/firewall-pro");
        const offs = [];
        page.append(summaryCard(ctx, data));
        const stock = ctx.controls.groupCard({ en: "Firewall", yue: "防火牆" }, data.stock);
        if (stock) page.append(stock);
        // Read-only entries are held back with their reason instead of drawn as editable.
        const held = data.entries.filter((e) => e.readOnly);
        for (const group of ctx.controls.settingGroups(data.entries.filter((e) => !e.readOnly))) {
          const card = ctx.controls.groupCard(group.label, group.entries);
          if (group.id === "services") {
            const preview = scheduleGrid(ctx, data.entries);
            offs.push(preview.off);
            card.append(preview.el);
          }
          page.append(card);
        }
        if (held.length) page.append(heldCard(ctx, held));
        page.append(testCard(ctx));
        return () => offs.forEach((off) => off());
      },
    },
  ],

  commands: [
    { id: "firewall-pro.open", icon: "local_fire_department", label: { en: "Open firewall and filters", yue: "開啟防火牆同過濾" }, keywords: "firewall url keyword filter ipv6 log services dos ping", run: (ctx) => ctx.navigate("firewall-pro") },
  ],
};
