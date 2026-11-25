// One mode card: what the mode is, whether it is on right now (every setting the
// router can take already has its value), the exact settings it changes with
// their old and new values, its choices, and the one-tap actions.
import { paramSection } from "./params.js";

export function stateOf(mode) {
  const usable = mode.items.filter((i) => !i.unavailable);
  const inPlace = usable.filter((i) => i.matches).length;
  return { usable: usable.length, inPlace, kind: mode.active ? "on" : inPlace > 0 ? "partial" : "off" };
}

export function modeCard(ctx, mode, { index, devices, expanded, onToggle, onApply, onPreview, onUndo, onSave, onGuestCard, onEdit }) {
  const { h, icon, t, tt } = ctx;
  const state = stateOf(mode);
  const locked = !ctx.state.canWrite;
  const hidden = mode.items.filter((i) => !i.hidden);
  const why = locked ? t("Viewers can look but not change.", "檢視者只可以睇，唔可以改。")
    : mode.needsChoice ? t("Choose the devices first.", "請先揀裝置。")
    : mode.error ? mode.error
    : mode.blockedBy ? t(`This router cannot use this mode. ${mode.blockedBy.en}`, `呢部路由器用唔到呢個模式。${mode.blockedBy.yue}`)
    : state.usable === 0 ? t("This router cannot take any setting of this mode.", "呢部路由器接受唔到呢個模式嘅任何設定。")
    : mode.active ? t("Already on.", "已經開咗。") : "";

  const chip = state.kind === "on" ? h("span", { class: "tag good" }, icon("check_circle", "sm"), t("On", "開"))
    : state.kind === "partial" ? h("span", { class: "tag warn" }, t(`${state.inPlace} of ${state.usable} in place`, `${state.inPlace} / ${state.usable} 已就緒`))
    : h("span", { class: "tag" }, t("Off", "關"));

  const list = h("div", { class: "mode-items", id: `mode-items-${mode.id}`, hidden: !expanded },
    hidden.map((item) =>
      h("div", { class: `mode-item${item.unavailable ? " off" : ""}${item.matches ? " same" : ""}` },
        h("div", { class: "grow" }, h("div", { class: "t1" }, tt(item.label)),
          item.unavailable ? h("div", { class: "t2" }, icon("lock", "sm"), " ", tt(item.unavailable)) : h("div", { class: "t2 mono" }, item.key)),
        item.unavailable ? null : h("div", { class: "mode-vals" }, h("span", { class: "was" }, tt(item.now)), icon("arrow_forward", "sm"), h("span", { class: "now" }, tt(item.to)), item.matches ? icon("check", "sm") : null))));

  const params = mode.schema.length ? paramSection(ctx, mode, { devices, save: (values) => onSave(mode, values), locked }) : null;

  const card = h("section", { class: `card rise mode-card ${state.kind}`, "data-mode": mode.id, "aria-label": tt(mode.name) },
    h("div", { class: "mode-head" },
      h("span", { class: "mode-badge", "data-state": state.kind }, icon(mode.icon, "lg")),
      h("div", { class: "grow" }, h("h2", { class: "h2" }, tt(mode.name)), h("div", { class: "t2" }, tt(mode.about))),
      chip),
    params,
    h("button", { class: "btn t sm mode-more", "aria-expanded": String(Boolean(expanded)), "aria-controls": `mode-items-${mode.id}`, onClick: () => onToggle(mode) },
      icon(expanded ? "expand_less" : "expand_more", "sm"), t(`Exactly what changes (${hidden.length})`, `實際會改啲乜（${hidden.length}）`)),
    list,
    mode.active && !mode.canUndo ? h("div", { class: "t2" }, icon("info", "sm"), " ", t("These values were set outside this app, so the old values are not known and it cannot undo them.", "呢啲數值唔係由呢個程式設定，所以唔知舊數值，亦無法還原。")) : null,
    mode.canUndo ? h("div", { class: "t2" }, icon("history", "sm"), " ", t(`Applied ${new Date(mode.applied.at).toLocaleString()}. Undo puts back ${mode.applied.count} old values.`, `套用於 ${new Date(mode.applied.at).toLocaleString()}。還原會放返 ${mode.applied.count} 個舊數值。`)) : null,
    h("div", { class: "actions mode-actions" },
      mode.active
        ? null
        : h("button", { class: "btn f", disabled: Boolean(why), title: why || undefined, onClick: () => onApply(mode) }, icon("bolt", "sm"), t("Turn on", "開啟")),
      h("button", { class: "btn t", disabled: locked || mode.needsChoice || state.usable === 0 || Boolean(mode.error) || mode.active, onClick: () => onPreview(mode) }, icon("preview", "sm"), t("Preview", "預覽")),
      mode.canUndo ? h("button", { class: "btn o", disabled: locked, onClick: () => onUndo(mode) }, icon("undo", "sm"), t("Undo this mode", "還原呢個模式")) : null,
      mode.id === "guest" && mode.active ? h("button", { class: "btn t", disabled: locked, onClick: () => onGuestCard() }, icon("qr_code_2", "sm"), t("Guest card", "訪客卡")) : null,
      mode.custom ? h("button", { class: "btn o", onClick: () => onEdit(mode) }, icon("edit", "sm"), t("Edit", "編輯")) : null),
    why && !mode.active && !locked ? h("div", { class: "t2 mode-why" }, why) : null);
  card.style.setProperty("--hue", String(mode.hue));
  card.style.setProperty("--i", String(index));
  return card;
}
