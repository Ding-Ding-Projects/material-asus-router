// Quick add beside every Settings pointer. Where the app says "this only
// applies once X is on" or a secret has never been set, the matching quick
// control appears right there: an enable switch, or a password box with Save.
// It queues exactly what the Settings row would (the same entry in the
// changes bar), validated by the same rules, and a password stays masked. The
// confirmation is a small toast, never a dialog.
import { needsEnable, needsSecret, pointersFor, quickSet } from "./quick.js";

const NAV = (globalThis.marNav ??= {});

function decorate(ctx, row) {
  const entries = ctx.state.catalog?.entries ?? [];
  const entry = entries.find((e) => e.id === row.id.slice(2));
  if (!entry) return;
  const { h, icon, t, tt } = ctx;
  row.querySelector(":scope > .qa-box")?.remove();
  const parts = [];
  const pointer = pointersFor(entries).find((p) => p.dependents.includes(entry.id));
  if (pointer && needsEnable(pointer, entries, ctx.dock)) {
    const enable = entries.find((e) => e.id === pointer.enable);
    parts.push(h("div", { class: "qa-line" }, icon("info", "sm"), h("span", { class: "grow" }, `${tt(pointer.note)} ${t("Turn on", "開啟")}: ${tt(enable.label)}`), h("button", { type: "button", class: "sw", role: "switch", "aria-checked": "false", "aria-label": tt(enable.label), disabled: !ctx.state.canWrite, onClick: () => { ctx.dock.setEntry(enable, enable.values.on); ctx.toast(t("Turned on. It waits in the changes bar.", "已開啟，等緊喺改動列。")); } }, h("i"))));
  }
  if (needsSecret(entry) && !ctx.dock.has(entry.id)) {
    const input = h("input", { class: "field", type: "password", autocomplete: "new-password", maxlength: String(entry.maxLength ?? 64), "aria-label": `${t("Set", "設定")} ${tt(entry.label)}`, placeholder: t("Not set yet. Type one here.", "未設定，喺呢度輸入。") });
    const err = h("div", { class: "err", role: "alert" });
    parts.push(h("div", { class: "qa-line" }, input, h("button", { type: "button", class: "btn f sm", disabled: !ctx.state.canWrite, onClick: () => {
      const r = quickSet(ctx.dock, entry, input.value, NAV.guidance.validate);
      if (!r.ok) { err.textContent = tt(r.reason); return; }
      err.textContent = "";
      ctx.toast(t("Saved to the changes waiting. Review and apply when ready.", "已儲存到等緊嘅改動，準備好就檢視同套用。"));
    } }, icon("save", "sm"), t("Save", "儲存")), err));
  }
  if (parts.length) row.append(h("div", { class: "qa-box" }, parts));
}

export default {
  id: "settings-quick-add",
  overlays: [
    {
      id: "settings-quick-add.rows",
      mount(ctx) {
        const scan = (root) => root.querySelectorAll?.(".setting[id^='s-']").forEach((r) => decorate(ctx, r));
        scan(document);
        const observer = new MutationObserver((records) => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 && !n.classList?.contains("qa-box")) { if (n.matches?.(".setting[id^='s-']")) decorate(ctx, n); scan(n); } });
        observer.observe(document.body, { childList: true, subtree: true });
        // The note and the box follow the changes bar and applied changes.
        const redo = () => requestAnimationFrame(() => scan(document));
        const offs = [ctx.bus.on("dock", redo), ctx.bus.on("changed", redo)];
        return () => { observer.disconnect(); offs.forEach((off) => off()); };
      },
    },
  ],
};
