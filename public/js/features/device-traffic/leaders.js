// The "who is uploading or downloading the most" tab of the Device traffic
// screen: two ranked lists, top downloaders and top uploaders, over three views:
// right now, the last few minutes (worked out from the readings kept while the
// screen is open) and the bytes of the connections the router is tracking now.
// The lists update in place every reading, so a keyboard user keeps their place.

const SHOWN = 10;

// Ranks devices by one direction ("down" or "up") for one view ("now", "window" or "total").
// Returns the ranked rows, the sum over every device, and how many seconds the window covers.
export function rank(view, key, mode) {
  const value = new Map();
  let seconds = 0;
  if (mode === "now") for (const d of view.devices) value.set(d.ip, d[key]);
  else if (mode === "total") for (const d of view.devices) value.set(d.ip, key === "down" ? d.totalDown : d.totalUp);
  else {
    const h = view.history ?? [];
    for (let i = 1; i < h.length; i += 1) {
      const dt = Math.max(0, (h[i].at - h[i - 1].at) / 1000);
      seconds += dt;
      for (const [ip, rate] of Object.entries(h[i].devices ?? {})) value.set(ip, (value.get(ip) ?? 0) + (rate[key] ?? 0) * dt);
    }
  }
  const names = new Map(view.devices.map((d) => [d.ip, d]));
  const all = [...value].filter(([, v]) => v > 0).map(([ip, v]) => ({ ip, name: names.get(ip)?.name ?? ip, mac: names.get(ip)?.mac ?? "", value: v }));
  const sum = all.reduce((s, r) => s + r.value, 0);
  const rows = all.sort((a, b) => b.value - a.value || a.ip.localeCompare(b.ip, undefined, { numeric: true })).slice(0, SHOWN).map((r) => ({ ...r, share: sum > 0 ? r.value / sum : 0 }));
  return { rows, sum, seconds };
}

export function createLeaders(ctx, { unit, speedText, sizeText }) {
  const { h, icon, t, tt } = ctx;
  const MODES = [
    ["now", { en: "Right now", yue: "而家" }],
    ["window", { en: "Last few minutes", yue: "最近幾分鐘" }],
    ["total", { en: "Since connections began", yue: "連線開始至今" }],
  ];
  let mode = "now";
  const explain = h("div", { class: "t2", "aria-live": "polite" });
  const status = h("div", { class: "note", hidden: true });
  const lists = { down: h("ol", { class: "ld-list" }), up: h("ol", { class: "ld-list" }) };
  const nodes = { down: new Map(), up: new Map() };
  const blanks = { down: h("div", { class: "muted", hidden: true }), up: h("div", { class: "muted", hidden: true }) };
  let latest = null;
  let seen = false;

  const modeButtons = MODES.map(([id, text]) => h("button", { type: "button", class: "ld-mode", "aria-pressed": String(id === mode), onClick: () => { mode = id; modeButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(MODES[i][0] === mode))); if (latest) update(latest); } }, tt(text)));

  const format = (key, row) => (mode === "now" ? speedText(row.value, unit) : sizeText(row.value));

  function paintList(key, view) {
    const { rows, seconds } = rank(view, key, mode);
    const list = lists[key];
    const store = nodes[key];
    const keep = new Set(rows.map((r) => r.ip));
    for (const [ip, item] of store) if (!keep.has(ip)) { item.el.remove(); store.delete(ip); }
    const top = rows[0]?.value || 1;
    rows.forEach((row, index) => {
      let item = store.get(row.ip);
      if (!item) {
        const fill = h("i", {});
        const rankEl = h("span", { class: "ld-rank" });
        const nameEl = h("div", { class: "t1" });
        const idEl = h("div", { class: "t2 mono" });
        const valueEl = h("b", { class: "ld-value" });
        const shareEl = h("span", { class: "t2" });
        item = { fill, rankEl, nameEl, idEl, valueEl, shareEl, el: h("li", { class: "ld-row" }, rankEl, h("div", { class: "ld-who" }, nameEl, idEl, h("div", { class: "ld-bar", "aria-hidden": "true" }, fill)), h("div", { class: "ld-num" }, valueEl, shareEl)) };
        item.fill.style.setProperty("--w", "0%");
        store.set(row.ip, item);
        const grow = () => item.fill.style.setProperty("--w", `${Math.max(3, Math.round((item.last / item.top) * 100))}%`);
        item.grow = grow;
      }
      item.last = row.value;
      item.top = top;
      item.rankEl.textContent = String(index + 1);
      item.rankEl.dataset.rank = String(index + 1);
      item.nameEl.textContent = row.name;
      item.idEl.textContent = `${row.ip}${row.mac ? ` · ${row.mac}` : ""}`;
      item.valueEl.textContent = format(key, row);
      item.shareEl.textContent = `${Math.round(row.share * 100)}%`;
      item.el.setAttribute("aria-label", `${index + 1}. ${row.name}, ${format(key, row)}, ${Math.round(row.share * 100)}%`);
      item.el.style.setProperty("--i", String(index));
      list.append(item.el);
      if (seen) item.grow();
      else requestAnimationFrame(() => requestAnimationFrame(item.grow));
    });
    blanks[key].hidden = rows.length > 0;
    blanks[key].textContent = view.warm && mode !== "total" ? t("Reading the router… the first numbers come after one more reading.", "讀緊路由器…再讀多一次就有數字。")
      : mode === "window" && seconds === 0 ? t("Keep this page open for a minute and the last few minutes will fill in.", "開住呢頁一陣，最近幾分鐘嘅數字就會出現。")
        : t("Nobody moved data in this view.", "呢個時段冇人傳輸資料。");
    return seconds;
  }

  function update(view) {
    latest = view;
    status.hidden = view.accounting !== false;
    status.textContent = view.accounting === false ? t("The router does not count the bytes of each connection, so nobody can be ranked. See the note on the first tab.", "路由器冇計每條連線嘅位元組，所以排唔到名。睇第一個分頁嘅說明。") : "";
    const seconds = Math.max(paintList("down", view), paintList("up", view));
    seen = true;
    explain.textContent = mode === "now" ? t("Speed in this moment, from the last two readings.", "而家嘅速度，由最近兩次讀數計出嚟。")
      : mode === "window" ? t(`Data moved while this page has been open, about ${Math.max(1, Math.round(seconds / 60))} min of readings (up to the last few minutes).`, `開住呢頁期間傳輸嘅資料，大約 ${Math.max(1, Math.round(seconds / 60))} 分鐘讀數（最多係最近幾分鐘）。`)
        : t("Bytes of the connections the router is tracking now. Connections that already ended are not counted.", "路由器而家追蹤緊嘅連線嘅位元組。已經結束嘅連線唔計。");
  }

  const card = (key, title, glyph) => h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon(glyph, "sm"), " ", title), lists[key], blanks[key]);
  const el = h("div", { class: "ld" },
    h("div", { class: "chips ld-modes", role: "group", "aria-label": t("What to rank by", "用咩排名") }, modeButtons),
    explain, status,
    h("div", { class: "grid2" }, card("down", t("Top downloaders", "下載最多"), "south"), card("up", t("Top uploaders", "上傳最多"), "north")));
  return { el, update };
}
