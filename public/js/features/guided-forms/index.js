// Guided forms. Every setting with a complex control (a schedule, a network, a
// port, a device address, a list, a password) gets a "Guide me" button that
// opens a step-by-step wizard with a worked example and an isolated practice
// area. The practice area uses the same value rules as the real control and
// never touches the router; only the final "Use this value" step queues the
// value in the changes bar, the same place a typed edit goes. Simple settings
// get one contextual step. The guidance is built from each setting's own
// label, limits and options. The same engine feeds the per-control info icon.
import { buildGuide, isComplex } from "./guide.js";
import { validateValue } from "./validators.js";

const NAV = (globalThis.marNav ??= {});
let devicesCache = null;

function practice(ctx, entry, start) {
  const { h, icon, t, tt } = ctx;
  let value = String(start);
  const out = h("div", { class: "gf-result", role: "status" });
  const holder = h("div", { class: "gf-practice" });
  const check = () => {
    const r = validateValue(entry, value);
    out.className = `gf-result ${r.ok ? "ok" : "bad"}`;
    out.replaceChildren(icon(r.ok ? "check_circle" : "error", "sm"), " ", r.ok ? t(`Valid: ${r.value === "" ? "(empty)" : r.value}`, `有效：${r.value === "" ? "（空）" : r.value}`) : tt(r.reason));
  };
  const set = (v) => { value = String(v); draw(); };
  function draw() {
    let control;
    if (entry.control === "switch") control = h("button", { type: "button", class: "sw", role: "switch", "aria-checked": String(value === entry.values.on), "aria-label": tt(entry.label), onClick: () => set(value === entry.values.on ? entry.values.off : entry.values.on) }, h("i"));
    else if (entry.control === "select" || entry.control === "segmented") control = h("div", { class: "seg", role: "radiogroup", "aria-label": tt(entry.label) }, entry.options.map(([v, l, about]) => h("button", { type: "button", role: "radio", class: v === value ? "on" : "", "aria-checked": String(v === value), title: about ? tt(about) : undefined, onClick: () => set(v) }, tt(l))));
    else if (["slider", "number", "stepper"].includes(entry.control)) control = h("div", { class: "ctl" }, h("input", { type: "range", min: String(entry.min), max: String(entry.max), step: String(entry.step ?? 1), value, "aria-label": tt(entry.label), onInput: (e) => { value = e.target.value; check(); num.value = value; } }), (num = h("input", { class: "field num", type: "number", value, "aria-label": tt(entry.label), onInput: (e) => { value = e.target.value; check(); } })), entry.unit ? h("span", { class: "muted" }, entry.unit) : null);
    else if (entry.control === "color") control = h("input", { type: "color", class: "swatch", value: /^#[0-9a-f]{6}$/i.test(value) ? value : "#3366cc", "aria-label": tt(entry.label), onInput: (e) => { value = e.target.value; check(); } });
    else control = h("input", { class: "field", type: entry.control === "password" ? "text" : "text", value, maxlength: String(entry.maxLength ?? 300), spellcheck: "false", autocomplete: "off", "aria-label": tt(entry.label), onInput: (e) => { value = e.target.value; check(); } });
    holder.replaceChildren(control);
    check();
  }
  let num;
  draw();
  const picker = h("div", { class: "chips" });
  if (["ipv4", "mac", "device"].includes(entry.control)) {
    (devicesCache ??= ctx.api.get("/api/domain/devices").then((d) => d.devices ?? []).catch(() => [])).then((devices) => {
      picker.replaceChildren(...devices.slice(0, 8).map((d) => h("button", { type: "button", class: "chip", onClick: () => set(entry.control === "ipv4" ? d.ip : d.mac) }, icon("devices", "sm"), `${d.name} · ${entry.control === "ipv4" ? d.ip : d.mac}`)));
    });
  }
  const el = h("div", { class: "gf-box" },
    h("div", { class: "k" }, t("Practice area. Nothing here changes your router.", "練習區。呢度唔會改你嘅路由器。")),
    ["ipv4", "mac", "device"].includes(entry.control) ? h("div", { class: "t2" }, t("Pick one of your connected devices:", "揀其中一部已連線裝置：")) : null, picker, holder, out,
    h("button", { type: "button", class: "btn o sm", onClick: () => set(start) }, icon("restart_alt", "sm"), t("Reset", "重設")));
  return { el, value: () => value, valid: () => validateValue(entry, value).ok };
}

// open(ctx, entry, { wizard }): the guide for one setting in a dialog.
export function openGuide(ctx, entry, { wizard = false } = {}) {
  const { h, icon, t, tt } = ctx;
  const guide = buildGuide(entry);
  let step = 0;
  const play = practice(ctx, entry, guide.sample);
  const last = guide.steps.length;
  return ctx.openDialog((close, render) => {
    const body = [];
    if (wizard) {
      const s = guide.steps[step];
      body.push(h("div", { class: "steps", role: "list" }, [...guide.steps, { title: { en: "Try it", yue: "試下" } }].map((x, i) => h("div", { class: `step${i === step ? " on" : i < step ? " done" : ""}`, role: "listitem", "aria-current": i === step ? "step" : undefined }, h("span", { class: "num" }, String(i + 1)), tt(x.title)))));
      if (step < last) body.push(h("div", { class: "gf-step" }, h("h3", { class: "t1" }, tt(s.title)), h("p", { class: "muted" }, tt(s.body))));
      else body.push(h("div", { class: "gf-step" }, h("p", { class: "muted" }, tt(guide.example)), play.el));
      body.push(h("div", { class: "actions" },
        h("button", { class: "btn o", onClick: () => close() }, t("Close", "關閉")),
        step > 0 ? h("button", { class: "btn t", onClick: () => { step -= 1; render(); } }, icon("arrow_back", "sm"), t("Back", "上一步")) : null,
        step < last ? h("button", { class: "btn f", onClick: () => { step += 1; render(); } }, t("Next", "下一步"), icon("arrow_forward", "sm"))
          : h("button", { class: "btn f", disabled: !ctx.state.canWrite || Boolean(entry.disabled), onClick: () => { const r = validateValue(entry, play.value()); if (!r.ok) return ctx.toast(tt(r.reason), "bad"); ctx.dock.setEntry(entry, r.value); close(true); ctx.toast(t("Added to the changes waiting. Review and apply them when you are ready.", "已加入等緊嘅改動。準備好就檢視同套用。")); } }, icon("edit_note", "sm"), t("Use this value", "用呢個值"))));
    } else {
      body.push(h("ol", { class: "gf-steps" }, guide.steps.map((s) => h("li", {}, h("b", {}, tt(s.title)), h("div", { class: "muted" }, tt(s.body))))), h("p", { class: "muted" }, tt(guide.example)), play.el, h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close() }, t("Close", "關閉"))));
    }
    return [h("h2", { class: "h2" }, tt(guide.title)), ...body];
  }, { label: tt(guide.title) });
}

NAV.guidance = { build: buildGuide, open: openGuide, practice, validate: validateValue, isComplex };

function decorate(ctx, row) {
  if (row.dataset.gfDone) return;
  row.dataset.gfDone = "1";
  const entry = ctx.state.catalog?.entries?.find((e) => e.id === row.id.slice(2));
  if (!entry || !isComplex(entry)) return;
  const grow = row.querySelector(".top .grow");
  if (!grow) return;
  const { h, icon, t } = ctx;
  grow.append(h("button", { type: "button", class: "btn t sm gf-guide", "aria-label": `${t("Guide me through", "引導我設定")} ${ctx.tt(entry.label)}`, onClick: () => openGuide(ctx, entry, { wizard: true }) }, icon("route", "sm"), t("Guide me", "引導我")));
}

export default {
  id: "guided-forms",
  overlays: [
    {
      id: "guided-forms.rows",
      mount(ctx) {
        const scan = (root) => root.querySelectorAll?.(".setting[id^='s-']").forEach((r) => decorate(ctx, r));
        scan(document);
        const observer = new MutationObserver((records) => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) { if (n.matches?.(".setting[id^='s-']")) decorate(ctx, n); scan(n); } });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => { observer.disconnect(); devicesCache = null; };
      },
    },
  ],
};
