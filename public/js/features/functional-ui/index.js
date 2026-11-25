// Functional UI and truthful empty states. Anything you were about to apply
// and then discarded (or left the page with) is recorded in a local history
// before it is dropped, and can be restored. The history never contains a
// secret value, and it never leaves this browser.
import { createJsonStore, safeStorage } from "../material-design/prefs.js";
import { widgets } from "../material-design/ui.js";

const label = { en: "Discarded changes", yue: "放棄咗嘅改動" };
const MAX_ITEMS = 20;
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

export function sanitizeDiscards(raw) {
  const out = [];
  for (const it of Array.isArray(raw?.items) ? raw.items : []) {
    if (!it || typeof it.at !== "number") continue;
    const changes = (Array.isArray(it.changes) ? it.changes : []).slice(0, 200).map((c) => ({
      id: typeof c?.id === "string" ? str(c.id, 80) : "",
      key: typeof c?.key === "string" ? str(c.key, 80) : "",
      label: { en: str(c?.label?.en, 120), yue: str(c?.label?.yue, 120) },
      value: c?.secret ? "" : str(c?.value, 2000),
      secret: Boolean(c?.secret),
    })).filter((c) => c.id || c.key);
    const ops = (Array.isArray(it.ops) ? it.ops : []).slice(0, 50).filter((o) => o && typeof o.op === "object" && o.op !== null && JSON.stringify(o.op).length <= 4000).map((o) => ({ op: o.op, summary: typeof o.summary === "string" ? str(o.summary, 200) : (o.summary && typeof o.summary === "object" ? { en: str(o.summary.en, 200), yue: str(o.summary.yue, 200) } : "") }));
    if (!changes.length && !ops.length) continue;
    out.push({ id: typeof it.id === "string" ? it.id.slice(0, 30) : `d${it.at}`, at: it.at, reason: ["discard", "closed"].includes(it.reason) ? it.reason : "discard", changes, ops });
  }
  return { items: out.slice(-MAX_ITEMS) };
}
export const discards = createJsonStore(safeStorage(), "mar.appearance.discards", sanitizeDiscards, () => ({ items: [] }));

// A snapshot of the pending-changes bar, with secret values left out.
export function snapshot(dock) {
  const changes = [...dock.changes.values()].map((c) => {
    const secret = typeof c.shown === "string" && c.shown !== c.value && /^•+$/.test(c.shown);
    return { id: c.id ?? "", key: c.key ?? "", label: c.label ?? { en: c.key ?? c.id ?? "", yue: c.key ?? c.id ?? "" }, value: secret ? "" : String(c.value ?? ""), secret };
  });
  return { changes, ops: dock.ops.map((o) => ({ op: o.op, summary: o.summary })) };
}
export function record(snap, reason, store = discards) {
  if (!snap.changes.length && !snap.ops.length) return false;
  store.update((d) => { d.items.push({ id: `d${Date.now().toString(36)}`, at: Date.now(), reason, changes: snap.changes, ops: snap.ops }); });
  return true;
}

// A truthful empty state: says what is missing and offers a real way to start.
export function emptyState(ctx, { icon, title, body, action }) {
  const { h } = ctx;
  return h("div", { class: "empty" }, ctx.icon(icon ?? "inbox", "lg"), h("div", { class: "t1" }, ctx.tt(title)), body ? h("div", { class: "t2" }, ctx.tt(body)) : null, action ? h("button", { type: "button", class: "btn t sm", onClick: action.onClick }, ctx.tt(action.label)) : null);
}

export function restore(ctx, item) {
  let restored = 0;
  let skipped = 0;
  for (const c of item.changes) {
    if (c.secret) { skipped += 1; continue; }
    const entry = c.id ? ctx.state.catalog?.entries?.find((e) => e.id === c.id) : null;
    if (entry) { ctx.dock.setEntry(entry, c.value); restored += 1; }
    else if (c.key) { ctx.dock.setRaw(c.key, c.value, undefined, c.label); restored += 1; }
    else skipped += 1;
  }
  for (const o of item.ops) { ctx.dock.addOp(o.op, o.summary); restored += 1; }
  return { restored, skipped };
}

async function screen(ctx) {
  const w = widgets(ctx);
  const { h, t, icon } = ctx;
  const list = h("div", {});
  const message = h("div", { role: "status" });
  const draw = () => {
    const items = [...discards.get().items].reverse();
    list.replaceChildren(...(items.length ? items.map((it) => h("div", { class: "row" },
      icon(it.reason === "closed" ? "tab_close" : "delete_sweep"),
      h("div", { class: "grow" }, h("div", { class: "t1" }, t(`${it.changes.length + it.ops.length} change${it.changes.length + it.ops.length === 1 ? "" : "s"}`, `${it.changes.length + it.ops.length} 個改動`)), h("div", { class: "t2" }, `${new Date(it.at).toLocaleString([], { hour12: false })} · ${it.reason === "closed" ? t("page closed with changes waiting", "帶住未套用嘅改動關閉頁面") : t("discarded", "已放棄")}${it.changes.some((c) => c.secret) ? ` · ${t("a secret value was not kept", "機密值冇保留")}` : ""}`), h("div", { class: "t2" }, it.changes.slice(0, 4).map((c) => ctx.tt(c.label) || c.key).join(", "))),
      w.button({ en: "Restore", yue: "還原" }, "restore", () => { const r = restore(ctx, it); message.replaceChildren(w.note(r.restored ? "" : "warn", t(`Put ${r.restored} change${r.restored === 1 ? "" : "s"} back in the waiting list.${r.skipped ? ` ${r.skipped} could not be restored.` : ""}`, `已將 ${r.restored} 個改動放返待處理列。${r.skipped ? `有 ${r.skipped} 個還原唔到。` : ""}`))); }, "t sm"),
      h("button", { type: "button", class: "info", "aria-label": t("Delete this record", "刪除呢條記錄"), onClick: () => discards.update((d) => { d.items = d.items.filter((x) => x.id !== it.id); }) }, icon("delete", "sm"))))
      : [emptyState(ctx, { icon: "history", title: { en: "Nothing has been discarded", yue: "未有放棄過任何改動" }, body: { en: "When you press Discard on the waiting changes, or leave the page with changes waiting, they are kept here so you can get them back.", yue: "當你喺待處理改動撳「放棄」，或者帶住未套用嘅改動離開頁面，改動會保留喺呢度，等你可以攞返。" } })]));
  };
  const off = discards.subscribe(() => (list.isConnected ? draw() : off()));
  draw();
  ctx.root.append(ctx.page(label, { en: "A safety net for changes you were about to apply. Secret values are never kept.", yue: "你本來準備套用嘅改動嘅安全網。機密值唔會被保留。" },
    w.card(null, list, message, h("div", { class: "actions" }, w.button({ en: "Clear this history", yue: "清除呢份記錄" }, "delete_forever", async () => { if (!discards.get().items.length) return; if (await ctx.confirmDialog({ title: t("Clear the history of discarded changes?", "清除放棄咗嘅改動記錄？"), body: t("They cannot be restored afterwards.", "清除之後就還原唔到。"), confirm: t("Clear", "清除"), danger: true })) discards.reset(); })))));
  return off;
}

export default {
  id: "functional-ui",
  screens: [{ id: "functional-ui", group: { en: "Appearance", yue: "外觀" }, icon: "history", label, render: screen }],
  overlays: [{
    id: "functional-ui.watch",
    mount(ctx) {
      let last = { changes: [], ops: [] };
      let applied = false;
      const offChanged = ctx.bus.on("changed", () => { applied = true; });
      const offDock = ctx.bus.on("dock", () => {
        const now = snapshot(ctx.dock);
        if (now.changes.length || now.ops.length) { last = now; return; }
        // The bar emptied. A change that was applied emits "changed" straight after, so wait a moment.
        const before = last;
        last = { changes: [], ops: [] };
        applied = false;
        setTimeout(() => { if (!applied) record(before, "discard"); }, 0);
      });
      // Leaving the page with changes waiting is recorded before the page goes.
      const onHide = () => { const now = snapshot(ctx.dock); if (now.changes.length || now.ops.length) record(now, "closed"); };
      globalThis.addEventListener?.("pagehide", onHide);
      return () => { offChanged(); offDock(); globalThis.removeEventListener?.("pagehide", onHide); };
    },
  }],
  commands: [{ id: "functional-ui.open", icon: "history", label: { en: "Open discarded changes", yue: "開啟放棄咗嘅改動" }, keywords: "restore undo discard history recover", run: (ctx) => ctx.navigate("functional-ui") }],
  settings: [{ id: "functional-ui", icon: "history", label, render: (ctx) => { const w = widgets(ctx); return w.row({ en: "Discarded changes", yue: "放棄咗嘅改動" }, { en: `${discards.get().items.length} saved in this browser.`, yue: `呢個瀏覽器已儲存 ${discards.get().items.length} 項。` }, w.button({ en: "Open", yue: "開啟" }, "history", () => ctx.navigate("functional-ui"), "t sm")); } }],
};
