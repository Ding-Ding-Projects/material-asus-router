// Firewall internals screen: live read-only viewers for the firewall tables, address lists, the
// connection table, traffic shaping and kernel hardening, plus the tuning settings as rich controls.
// The open pane refreshes by itself every few seconds and stops when the screen is left.
const label = { en: "Firewall internals", yue: "防火牆內部" };
const NS = "http://www.w3.org/2000/svg";

export const barPercent = (value, max) => (max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0);
export const bytesText = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} kB` : `${n} B`);
export const ruleSearch = (query, text) => !query || String(text).toLowerCase().includes(String(query).toLowerCase());

const PANES = [
  ["tables", "shield", { en: "Rules", yue: "規則" }],
  ["ipsets", "list_alt", { en: "Address lists", yue: "地址清單" }],
  ["connections", "swap_horiz", { en: "Connections", yue: "連線" }],
  ["shaping", "speed", { en: "Traffic shaping", yue: "流量整形" }],
  ["hardening", "verified_user", { en: "Hardening", yue: "加固" }],
  ["tuning", "tune", { en: "Tuning", yue: "調校" }],
];
const TABLES = [["filter", { en: "Filter", yue: "過濾" }], ["nat", { en: "NAT", yue: "NAT" }], ["mangle", { en: "Mangle", yue: "Mangle" }], ["ip6", { en: "IPv6", yue: "IPv6" }]];
const REFRESH_MS = 3000;

function bar(percent, cls) {
  const root = document.createElementNS(NS, "svg");
  root.setAttribute("class", `fi-bar ${cls ?? ""}`);
  root.setAttribute("viewBox", "0 0 100 6");
  root.setAttribute("preserveAspectRatio", "none");
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", `${percent}%`);
  for (const [name, width] of [["track", 100], ["fill", percent]]) {
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("class", name);
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("height", "6");
    rect.setAttribute("rx", "3");
    rect.setAttribute("width", String(width));
    root.append(rect);
  }
  return root;
}

// The control for a setting that is several whole numbers in one value, such as ct_tcp_timeout.
function timeoutsControl(entry, current, commit, locked, ctx) {
  const { h } = ctx;
  const fields = entry.meta?.fields ?? [];
  const inputs = fields.map((f, i) => {
    const input = h("input", {
      class: "field num", type: "number", inputmode: "numeric", min: String(f.min), max: String(f.max), disabled: locked || f.max === f.min,
      "aria-label": ctx.tt(f.label), onInput: () => commit(inputs.map((x) => x.value || "0").join(" ")),
    });
    input.value = String(current().trim().split(/\s+/)[i] ?? "");
    return input;
  });
  const cells = fields.map((f, i) => (f.max === f.min ? null : h("label", { class: "fi-cell" }, h("span", { class: "t2" }, ctx.tt(f.label)), h("span", { class: "fi-cellrow" }, inputs[i], h("span", { class: "muted" }, f.unit)))));
  const el = h("div", { class: "fi-timeouts" }, cells);
  return { el, sync: () => inputs.forEach((input, i) => (input.value = String(current().trim().split(/\s+/)[i] ?? ""))) };
}

async function screen(ctx) {
  const { api, h, icon, t } = ctx;
  const config = await api.get("/api/domain/firewall-internals");
  const page = ctx.page(label, { en: "Look inside the firewall and the connection table as they are right now, and tune how connections are tracked.", yue: "睇住防火牆同連線表而家嘅真實狀況，亦可以調校連線點樣被追蹤。" });
  ctx.root.append(page);
  const state = { pane: "tables", table: "filter", query: "", timer: null, busy: false, token: 0 };
  const nav = h("div", { class: "seg", role: "tablist", "aria-label": ctx.tt(label) });
  const body = h("div", { class: "fi-body", "aria-live": "off" });
  const stamp = h("span", { class: "muted" });
  page.append(nav, body, h("div", { class: "muted fi-note" }, t("These views only read from the router. Nothing here changes a rule.", "呢啲顯示只係讀取路由器，唔會改任何規則。")));

  const empty = (iconName, text) => h("div", { class: "card tone" }, h("div", { class: "empty" }, icon(iconName, "lg"), text));
  const unavailable = (data) => h("div", { class: "card warn rise" }, h("div", { class: "k" }, t("Not available on this router", "呢部路由器用唔到")), h("div", { class: "t1" }, ctx.tt(data.reason)));
  const live = () => h("span", { class: "dot live", "aria-hidden": "true" });

  const draw = {
    tables(data) {
      if (!data.available) return [unavailable(data)];
      const q = state.query.trim();
      const search = h("input", { class: "field", type: "search", placeholder: t("Search these rules", "搜尋呢啲規則"), "aria-label": t("Search these rules", "搜尋呢啲規則"), onInput: (e) => { state.query = e.target.value; refresh(); } });
      search.value = state.query;
      const cards = data.chains.map((chain) => {
        const rules = chain.rules.filter((r) => ruleSearch(q, `${chain.name} ${r.text}`));
        if (q && !rules.length) return null;
        return h("details", { class: "card rise fi-chain", open: Boolean(chain.builtin || q) },
          h("summary", {}, h("span", { class: "t1" }, chain.name), chain.policy ? h("span", { class: `pill ${chain.policy === "DROP" ? "" : "p"}` }, t("Default", "預設"), " ", chain.policy) : h("span", { class: "pill" }, t("Your chain", "自訂鏈")), h("span", { class: "muted" }, t(`${rules.length} rules`, `${rules.length} 條規則`))),
          rules.length ? h("div", { class: "fi-rules" }, rules.map((r) => h("div", { class: "fi-rule mono" }, h("span", {}, r.text), r.target ? h("span", { class: `chip fi-target fi-${["DROP", "REJECT"].includes(r.target) ? "bad" : r.target === "ACCEPT" ? "good" : "plain"}` }, r.target) : null))) : h("div", { class: "muted" }, t("No rules in this chain.", "呢條鏈冇規則。")));
      }).filter(Boolean);
      return [
        h("div", { class: "chips" }, h("div", { class: "seg" }, TABLES.map(([id, text]) => h("button", { class: id === state.table ? "on" : "", onClick: () => { state.table = id; refresh(true); } }, ctx.tt(text)))), search),
        data.truncated ? h("div", { class: "card warn" }, t(`Showing the first 1500 of ${data.total} rules.`, `顯示頭 1500 條，共 ${data.total} 條規則。`)) : null,
        ...(cards.length ? cards : [empty("search_off", t("No rule matches.", "冇規則符合。"))]),
      ];
    },
    ipsets(data) {
      if (!data.available) return [unavailable(data)];
      if (!data.sets.length) return [empty("list_alt", t("There are no address lists on this router.", "呢部路由器冇地址清單。"))];
      return data.sets.map((s) => h("section", { class: "card rise" },
        h("div", { class: "fi-head" }, h("h2", { class: "h2" }, s.name), h("span", { class: "pill" }, s.type)),
        h("div", { class: "t2" }, t(`${s.entries} entries`, `${s.entries} 項`), s.maxelem ? t(` of at most ${s.maxelem}`, `，最多 ${s.maxelem}`) : "", s.memory ? ` · ${bytesText(s.memory)}` : "", t(` · used by ${s.references} rule(s)`, ` · 有 ${s.references} 條規則使用`)),
        s.maxelem ? bar(barPercent(s.entries, s.maxelem), s.entries / s.maxelem > 0.9 ? "bad" : "") : null,
        s.members.length ? h("div", { class: "chiplist fi-members" }, s.members.map((m) => h("span", { class: "chip mono" }, m)), s.moreMembers ? h("span", { class: "muted" }, t(`and ${s.moreMembers} more`, `仲有 ${s.moreMembers} 項`)) : null) : h("div", { class: "muted" }, t("Empty.", "空嘅。"))));
    },
    connections(data) {
      if (!data.available) return [empty("swap_horiz", t("The router does not show a connection count.", "路由器冇顯示連線數。"))];
      const near = data.percent >= 80;
      const protos = Object.entries(data.protocols).sort((a, b) => b[1] - a[1]);
      const states = Object.entries(data.states).sort((a, b) => b[1] - a[1]);
      return [
        h("section", { class: `card rise ${near ? "warn" : ""}` }, h("div", { class: "k" }, live(), t("Tracked connections", "追蹤緊嘅連線")),
          h("div", { class: "big" }, `${data.count} / ${data.max ?? "?"}`), data.percent !== null ? bar(Math.round(data.percent), near ? "bad" : "") : null,
          h("div", { class: "t2" }, data.percent === null ? "" : near ? t(`The table is ${data.percent}% full. New connections will be dropped when it fills; raise the limit in Tuning.`, `表已經用咗 ${data.percent}%。滿咗就會丟棄新連線；可以喺「調校」加大上限。`) : t(`${data.percent}% of the limit is in use.`, `已用 ${data.percent}% 上限。`))),
        h("div", { class: "grid2" },
          h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("By protocol", "按協定")), protos.length ? protos.map(([name, n]) => h("div", { class: "fi-row" }, h("span", { class: "t1" }, name.toUpperCase()), bar(barPercent(n, data.lines)), h("span", { class: "muted" }, String(n)))) : h("div", { class: "muted" }, t("None.", "冇。"))),
          h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("TCP states", "TCP 狀態")), states.length ? states.map(([name, n]) => h("div", { class: "fi-row" }, h("span", { class: "t1" }, name), bar(barPercent(n, data.lines)), h("span", { class: "muted" }, String(n)))) : h("div", { class: "muted" }, t("None.", "冇。")))),
        h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Timeouts the router is using now", "路由器而家用緊嘅逾時")),
          h("div", { class: "fi-grid" }, [["tcp_timeout_established", "Established", "已建立"], ["tcp_timeout_syn_sent", "SYN sent", "已發 SYN"], ["tcp_timeout_syn_recv", "SYN received", "已收 SYN"], ["tcp_timeout_fin_wait", "FIN wait", "FIN 等待"], ["tcp_timeout_time_wait", "Time wait", "Time wait"], ["tcp_timeout_close_wait", "Close wait", "Close wait"], ["tcp_timeout_last_ack", "Last ACK", "最後 ACK"], ["udp_timeout", "UDP, no reply yet", "UDP 未有回覆"], ["udp_timeout_stream", "UDP stream", "UDP 串流"]].map(([key, en, yue]) =>
            h("div", { class: "fi-stat" }, h("div", { class: "t2" }, t(en, yue)), h("div", { class: "t1" }, data.effective[key] === null ? "–" : `${data.effective[key]} s`))))),
      ];
    },
    shaping(data) {
      if (!data.available) return [unavailable(data)];
      const rows = (items, title) => h("section", { class: "card rise" }, h("h2", { class: "h2" }, title),
        items.length ? h("div", { class: "tbl fi-table" }, h("table", {}, h("thead", {}, h("tr", {}, [t("Name", "名稱"), t("Interface", "介面"), t("Sent", "已傳送"), t("Dropped", "已丟棄"), t("Overlimits", "超限"), t("Queued", "排隊")].map((x) => h("th", {}, x)))),
          h("tbody", {}, items.map((i) => h("tr", { class: i.dropped > 0 ? "fi-drop" : "" }, h("td", {}, h("div", { class: "t1" }, `${i.type} ${i.handle}`), h("div", { class: "t2 mono" }, [i.parent && `parent ${i.parent}`, i.detail].filter(Boolean).join(" · "))), h("td", {}, i.device || "–"), h("td", {}, `${bytesText(i.bytes)} · ${i.packets} pkt`), h("td", {}, String(i.dropped)), h("td", {}, String(i.overlimits)), h("td", {}, i.backlogPackets ? `${bytesText(i.backlogBytes)} · ${i.backlogPackets} pkt` : "0")))))) : h("div", { class: "muted" }, t("None.", "冇。")));
      return [rows(data.qdiscs, t("Queues (qdisc)", "佇列（qdisc）")), rows(data.classes, t("Classes", "類別")), h("div", { class: "muted" }, t("Counters are totals since the queue was created. A non-zero Dropped means that queue held packets back.", "數字係由佇列建立以來嘅總數。「已丟棄」唔係零，代表佇列曾經擋住封包。"))];
    },
    hardening(data) {
      if (!data.available) return [empty("verified_user", t("The router did not answer these read-outs.", "路由器冇回應呢啲讀數。"))];
      return [
        h("section", { class: `card rise ${data.warn ? "warn" : ""}` }, h("div", { class: "k" }, t("Kernel hardening", "內核加固")), h("div", { class: "big" }, t(`${data.ok} of ${data.items.length} look good`, `${data.items.length} 項入面 ${data.ok} 項正常`)),
          h("div", { class: "t2" }, data.warn ? t(`${data.warn} read-out(s) differ from the safer choice. They are shown, not changed: the router sets them itself.`, `有 ${data.warn} 項同較安全嘅設定唔同。只係顯示，唔會改：路由器自己會設定。`) : t("Every read-out is on the safer choice.", "所有讀數都係較安全嘅選擇。"))),
        ...data.items.map((i) => h("div", { class: `card rise fi-hard ${i.status}` }, icon(i.status === "ok" ? "check_circle" : i.status === "warn" ? "warning" : "help", "lg"),
          h("div", { class: "fi-hard-text" }, h("div", { class: "t1" }, ctx.tt(i.label)), h("div", { class: "t2" }, ctx.tt(i.about))),
          h("div", { class: "fi-hard-val" }, h("div", { class: "big" }, i.value ?? "–"), h("div", { class: "t2" }, t("Safer: ", "較安全："), ctx.tt(i.expected))))),
      ];
    },
  };

  function drawTuning() {
    ctx.clear(body);
    body.append(h("div", { class: "muted" }, t("Changes here wait in the pending-changes dock. Review them, then apply; a safety net can put them back.", "呢度嘅改動會先放喺待處理改動，睇完先套用；安全網可以還原。")), ...ctx.controls.settingGroups(config.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)));
  }

  function drawTabs() {
    ctx.clear(nav);
    for (const [id, iconName, text] of PANES) nav.append(h("button", { role: "tab", class: id === state.pane ? "on" : "", "aria-selected": id === state.pane ? "true" : "false", onClick: () => { state.pane = id; state.query = ""; drawTabs(); refresh(true); } }, icon(iconName, "sm"), ctx.tt(text)));
    nav.append(stamp);
  }

  async function refresh(reset = false) {
    if (state.pane === "tuning") {
      drawTuning();
      return;
    }
    if (state.busy && !reset) return;
    const token = (state.token += 1);
    state.busy = true;
    const url = state.pane === "tables" ? `rules?table=${state.table}` : state.pane;
    if (reset) {
      ctx.clear(body);
      body.append(empty("hourglass_top", t("Reading the router…", "讀緊路由器…")));
    }
    try {
      const data = await api.get(`/api/x/firewall-internals/${url}`);
      if (token !== state.token) return;
      const keep = body.querySelector("input[type=search]") === document.activeElement;
      ctx.clear(body);
      body.append(...draw[state.pane](data).filter(Boolean));
      if (keep) body.querySelector("input[type=search]")?.focus();
      stamp.textContent = ` ${new Date(data.at).toLocaleTimeString([], { hour12: false })}`;
    } catch (error) {
      if (token === state.token) {
        ctx.clear(body);
        body.append(h("div", { class: "card bad" }, error.message));
      }
    } finally {
      if (token === state.token) state.busy = false;
    }
  }

  drawTabs();
  await refresh(true);
  state.timer = setInterval(() => refresh(false), REFRESH_MS);
  return () => clearInterval(state.timer);
}

export default {
  id: "firewall-internals",
  screens: [{ id: "firewall-internals", group: { en: "Network", yue: "網絡" }, icon: "security", label, render: screen }],
  controls: { timeouts: timeoutsControl },
  settings: [{ id: "firewall-internals", icon: "security", label, async render(ctx) { const data = await ctx.api.get("/api/domain/firewall-internals"); return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)); } }],
  commands: [
    { id: "firewall-internals.open", icon: "security", label: { en: "Look inside the firewall", yue: "睇防火牆內部" }, keywords: "iptables ipset conntrack nat firewall rules tc shaping hardening 防火牆 規則 連線", run: (ctx) => ctx.navigate("firewall-internals") },
  ],
};
