// Non-blocking notifications and a notification centre. Toasts appear in the
// bottom-right corner and stack without overlapping. Errors and warnings stay
// until dismissed; the rest leave by themselves. Toasts may carry actions
// (Retry, Undo) and a progress bar that starts where the work started and
// turns into a Retry error where it broke. Everything is also kept in a
// searchable, filterable history with bulk actions and a jump to its source.
// Only a real decision (clearing the whole history) opens a modal.
import { addEntry, filterHistory, makeEntry, markRead, removeEntries, sanitize, toastTtl, unreadCount } from "./notify-model.js";

const NAV = (globalThis.marNav ??= {});
const KEY = "mar.nt.history";
const kv = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const def = NAV.defineShortcut ?? ((d) => (NAV.shortcutQueue ??= []).push(d));
def({ id: "notifications.open", keys: "Alt+Shift+N", label: { en: "Open the notification centre", yue: "打開通知中心" }, run: (ctx) => ctx.navigate("notifications") });

let C = null;
let host = null;
let history = sanitize(kv.get(KEY, []));
const live = new Map(); // toast id -> { el, timer, bar }
const MAX_VISIBLE = 5;
const ICON = { good: "check_circle", warn: "warning", bad: "error", info: "info" };

const save = () => kv.set(KEY, history);
const changed = () => { save(); C?.bus.emit("nt:changed"); drawBadge(); };
function drawBadge() {
  const dot = document.querySelector(".bar .icb .dotb");
  if (!dot || !C) return;
  const n = unreadCount(history);
  C.state.unseen = n;
  dot.hidden = n === 0;
  dot.textContent = String(n);
}

// ---- toasts ----------------------------------------------------------------------------------
function dismiss(id) {
  const t = live.get(id);
  if (!t) return;
  clearTimeout(t.timer);
  t.el.classList.add("nt-out");
  live.delete(id);
  setTimeout(() => t.el.remove(), 180);
}

// show({ kind, text, actions:[{label, run}], route, source, id, progress }) -> id
export function show(opts) {
  if (!C || !host) return null;
  const entry = makeEntry({ ...opts, route: opts.route ?? C.state.route });
  const id = opts.id ?? entry.id;
  entry.id = id;
  if (opts.history !== false) { history = addEntry(history, entry); changed(); }
  const existing = live.get(id);
  if (existing) dismiss(id);
  const { h, icon, t } = C;
  const actions = (opts.actions ?? []).map((a) => h("button", { type: "button", class: "btn t sm", onClick: () => { dismiss(id); a.run?.(); } }, a.label));
  const bar = opts.progress !== undefined ? h("div", { class: `meter nt-progress${opts.progress === null ? " nt-indeterminate" : ""}`, role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": opts.progress === null ? undefined : String(Math.round(opts.progress * 100)), "aria-label": entry.text }, h("i")) : null;
  if (bar && opts.progress !== null) bar.firstChild.style.setProperty("--w", `${Math.round(opts.progress * 100)}%`);
  const el = h("div", { class: `nt-toast ${entry.kind}`, role: entry.kind === "bad" ? "alert" : "status", "data-nt": id },
    h("div", { class: "nt-row" }, icon(ICON[entry.kind], "sm"), h("div", { class: "grow" }, entry.text), h("button", { type: "button", class: "nt-x", "aria-label": t("Dismiss notification", "關閉通知"), onClick: () => dismiss(id) }, icon("close", "sm"))),
    bar, actions.length ? h("div", { class: "nt-actions" }, actions) : null);
  host.append(el);
  const ttl = opts.sticky ? 0 : toastTtl(entry.kind);
  const rec = { el, bar, timer: 0, kind: entry.kind };
  live.set(id, rec);
  if (ttl) {
    const arm = () => { rec.timer = setTimeout(() => dismiss(id), ttl); };
    arm();
    el.addEventListener("pointerenter", () => clearTimeout(rec.timer));
    el.addEventListener("pointerleave", arm);
    el.addEventListener("focusin", () => clearTimeout(rec.timer));
  }
  // Never more than a handful on screen: the oldest calm ones go first.
  const calm = [...live.entries()].filter(([, v]) => v.kind !== "bad" && v.kind !== "warn" && !v.bar);
  while (live.size > MAX_VISIBLE && calm.length) dismiss(calm.shift()[0]);
  return id;
}

// Progress that starts where the work starts: progress(id, { text, value }) with
// value 0 to 1, or null when the length is unknown. finish and fail end it.
export const progress = (id, { text, value = null }) => show({ id, kind: "info", text, progress: value, sticky: true, history: false });
export function finish(id, text) {
  dismiss(id);
  return show({ kind: "good", text });
}
// Where it broke: an error that stays until dismissed and offers to retry.
export function fail(id, text, retry) {
  dismiss(id);
  return show({ kind: "bad", text, actions: retry ? [{ label: C.t("Retry", "再試"), run: retry }] : [] });
}

// ---- stock toasts and notices become ours ------------------------------------------------------------
function adoptStock(node) {
  if (!node.classList?.contains("toast")) return;
  const kind = node.classList.contains("bad") ? "bad" : "good";
  const copy = node.cloneNode(true);
  copy.querySelector(".ms")?.remove();
  const text = copy.textContent.trim();
  node.remove();
  if (text) show({ kind, text, source: "toast" });
}

let seenNotice = null;
function adoptNotice() {
  const n = C.state.notices?.[0];
  if (!n || n === seenNotice) return;
  seenNotice = n;
  const kind = n.kind === "good" ? "good" : n.kind === "bad" ? "bad" : n.kind === "warn" ? "warn" : "info";
  history = addEntry(history, makeEntry({ kind, text: n.text, route: C.state.route, source: "notice" }, n.at instanceof Date ? n.at.getTime() : Date.now()));
  changed();
}

// ---- connection loss ------------------------------------------------------------------------------------
let offline = false;
async function ping() {
  try {
    await C.api.get("/health");
    if (offline) { offline = false; dismiss("nt-offline"); show({ kind: "good", text: C.t("Connected again.", "已重新連線。") }); }
  } catch (e) {
    if (e.code === "OFFLINE" && !offline) {
      offline = true;
      show({ id: "nt-offline", kind: "bad", text: C.t("Lost the connection to the app. Changes cannot be saved until it is back.", "同程式失去連線。連線返嚟之前改動儲存唔到。"), actions: [{ label: C.t("Try again", "再試"), run: ping }] });
    }
  }
}

// ---- the centre ----------------------------------------------------------------------------------------------
function centre(ctx) {
  const { h, icon, t, tt } = ctx;
  const state = { kind: "all", read: "all", picked: new Set() };
  const input = h("input", { type: "search", class: "field", "data-search-id": "notifications", "aria-label": t("Search notifications", "搜尋通知"), placeholder: t("Search notifications", "搜尋通知") });
  const list = h("div", { class: "nt-list" });
  const count = h("div", { class: "t2", role: "status" });
  const kinds = [["all", t("All", "全部")], ["bad", t("Errors", "錯誤")], ["warn", t("Warnings", "警告")], ["good", t("Done", "完成")], ["info", t("Info", "資訊")]];
  const reads = [["all", t("All", "全部")], ["unread", t("Unread", "未讀")], ["read", t("Read", "已讀")]];
  const seg = (name, opts, key) => {
    const wrap = h("div", { class: "seg", role: "radiogroup", "aria-label": name }, opts.map(([v, label]) => h("button", { type: "button", role: "radio", "aria-checked": String(state[key] === v), class: state[key] === v ? "on" : "", onClick: () => { state[key] = v; wrap.querySelectorAll("button").forEach((b, i) => { b.classList.toggle("on", opts[i][0] === v); b.setAttribute("aria-checked", String(opts[i][0] === v)); }); draw(); } }, label)));
    return wrap;
  };
  const visible = () => {
    const rx = NAV.regex?.stateOf(input);
    const m = rx?.mode === "regex" ? NAV.regex.matcherFor(input) : null;
    const q = input.value.trim().toLowerCase();
    return { items: filterHistory(history, { kind: state.kind, read: state.read, test: m ? m.test : (s) => !q || s.toLowerCase().includes(q) }), error: m?.error };
  };
  function draw() {
    const { items, error } = visible();
    list.replaceChildren(...items.map((n) => h("div", { class: `nt-item ${n.kind}${n.read ? " read" : ""}`, "data-nt-id": n.id },
      h("input", { type: "checkbox", checked: state.picked.has(n.id), "aria-label": `${t("Select", "揀")} ${n.text.slice(0, 40)}`, onChange: (e) => { e.target.checked ? state.picked.add(n.id) : state.picked.delete(n.id); drawBulk(); } }),
      icon(ICON[n.kind], "sm"),
      h("div", { class: "grow" }, h("div", { class: n.read ? "t2" : "t1" }, n.text), h("div", { class: "t2" }, `${new Date(n.at).toLocaleString()}${n.route ? ` · ${n.route}` : ""}`)),
      n.route && ctx.state.catalog ? h("button", { type: "button", class: "btn t sm", onClick: () => { history = markRead(history, [n.id]); changed(); ctx.navigate(n.route); } }, icon("north_east", "sm"), t("Go to source", "去來源")) : null,
      h("button", { type: "button", class: "btn o sm", "aria-label": n.read ? t("Mark unread", "標為未讀") : t("Mark read", "標為已讀"), onClick: () => { history = markRead(history, [n.id], !n.read); changed(); draw(); } }, icon(n.read ? "mark_email_unread" : "drafts", "sm")))));
    if (!items.length) list.append(h("div", { class: "empty" }, icon("notifications_off", "lg"), history.length ? t("No notification matches.", "冇通知配對。") : t("Nothing here yet. Notifications from the app are kept here.", "暫時冇嘢。程式嘅通知會喺呢度保存。")));
    count.textContent = error ? tt(error) : t(`${items.length} of ${history.length} shown, ${unreadCount(history)} unread`, `顯示 ${items.length} / ${history.length}，${unreadCount(history)} 個未讀`);
    drawBulk();
  }
  const bulk = h("div", { class: "chips" });
  function drawBulk() {
    const ids = [...state.picked].filter((id) => history.some((n) => n.id === id));
    const shownIds = visible().items.map((n) => n.id);
    bulk.replaceChildren(
      h("button", { type: "button", class: "btn t sm", onClick: () => { state.picked = new Set(state.picked.size ? [] : shownIds); draw(); } }, icon("select_all", "sm"), state.picked.size ? t("Select none", "取消全選") : t("Select shown", "全選顯示嘅")),
      h("button", { type: "button", class: "btn t sm", disabled: !ids.length, onClick: () => { history = markRead(history, ids); changed(); draw(); } }, icon("drafts", "sm"), t("Mark selected read", "標記已讀")),
      h("button", { type: "button", class: "btn t sm", onClick: () => { history = markRead(history, history.map((n) => n.id)); changed(); draw(); } }, icon("done_all", "sm"), t("Mark all read", "全部標為已讀")),
      h("button", { type: "button", class: "btn o sm", disabled: !ids.length, onClick: () => { history = removeEntries(history, ids); state.picked.clear(); changed(); draw(); } }, icon("delete", "sm"), t("Dismiss selected", "移除已揀")),
      h("button", { type: "button", class: "btn d sm", disabled: !history.length, onClick: async () => { if (await ctx.confirmDialog({ title: t("Clear the whole history?", "清空成個記錄？"), body: t("Every notification is removed from this browser. This cannot be undone.", "所有通知會喺呢個瀏覽器移除，唔可以還原。"), confirm: t("Clear history", "清空記錄"), danger: true })) { history = []; state.picked.clear(); changed(); draw(); } } }, icon("delete_forever", "sm"), t("Clear all", "全部清除")));
  }
  input.addEventListener("input", draw);
  const off = ctx.bus.on("nt:changed", () => draw());
  draw();
  return { el: h("div", { class: "nt-centre" }, h("section", { class: "card" }, input, h("div", { class: "chips" }, seg(t("Kind", "類別"), kinds, "kind"), seg(t("Read state", "已讀狀態"), reads, "read")), bulk, count), h("section", { class: "card" }, list)), off };
}

export default {
  id: "notifications",
  overlays: [
    {
      id: "notifications.toasts",
      mount(ctx) {
        C = ctx;
        host = ctx.h("div", { class: "nt-host", "aria-label": ctx.t("Notifications", "通知") });
        document.body.append(host);
        const stock = document.getElementById("toasts");
        const observer = new MutationObserver((records) => { for (const r of records) for (const n of r.addedNodes) adoptStock(n); });
        if (stock) { observer.observe(stock, { childList: true }); for (const n of [...stock.children]) adoptStock(n); }
        const stopNotices = ctx.bus.on("notices", adoptNotice);
        seenNotice = ctx.state.notices?.[0] ?? null;
        const onBell = (e) => {
          const btn = e.target.closest?.(".bar .icb");
          if (!btn || btn.querySelector(".ms")?.textContent !== "notifications") return;
          e.preventDefault();
          e.stopImmediatePropagation();
          ctx.navigate("notifications");
        };
        document.addEventListener("click", onBell, true);
        const timer = setInterval(ping, 20000);
        const goOffline = () => ping();
        window.addEventListener("offline", goOffline);
        window.addEventListener("online", goOffline);
        const stopCtx = ctx.bus.on("context:collect", ({ target, add }) => {
          const row = target.closest?.(".nt-item");
          if (!row) return;
          const id = row.dataset.ntId;
          const n = history.find((x) => x.id === id);
          if (!n) return;
          add({ id: "nt-read", icon: n.read ? "mark_email_unread" : "drafts", label: n.read ? { en: "Mark this notification unread", yue: "標為未讀" } : { en: "Mark this notification read", yue: "標為已讀" }, run: () => { history = markRead(history, [id], !n.read); changed(); } });
          add({ id: "nt-remove", icon: "delete", label: { en: "Dismiss this notification", yue: "移除呢個通知" }, run: () => { history = removeEntries(history, [id]); changed(); } });
        });
        ctx.bus.on("palette:collect", ({ add }) => add({ id: "notifications.clear-read", icon: "mark_email_read", label: { en: "Mark every notification read", yue: "全部通知標為已讀" }, run: () => { history = markRead(history, history.map((n) => n.id)); changed(); } }));
        NAV.notify = { show, progress, finish, fail, dismiss, history: () => history };
        drawBadge();
        return () => { observer.disconnect(); stopNotices(); stopCtx(); document.removeEventListener("click", onBell, true); clearInterval(timer); window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOffline); for (const id of [...live.keys()]) dismiss(id); host?.remove(); host = null; };
      },
    },
  ],
  screens: [
    {
      id: "notifications",
      group: { en: "Monitor", yue: "監察" },
      icon: "notifications",
      label: { en: "Notification centre", yue: "通知中心" },
      render(ctx) {
        const view = centre(ctx);
        ctx.root.append(ctx.page({ en: "Notification centre", yue: "通知中心" }, { en: "Everything the app has told you, with search, filters and one-click jumps to the source.", yue: "程式通知過你嘅所有嘢，可以搜尋、篩選，一撳就去到來源。" }, view.el));
        return view.off;
      },
    },
  ],
  commands: [{ id: "notifications.open", icon: "notifications", label: { en: "Open the notification centre", yue: "打開通知中心" }, keywords: "bell alerts history toasts", run: (ctx) => ctx.navigate("notifications") }],
};
