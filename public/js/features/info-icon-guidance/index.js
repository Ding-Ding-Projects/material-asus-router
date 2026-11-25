// A compact info icon on every setting's control. It opens that setting's own
// explanation, steps, worked example and an isolated practice area. It never
// starts a real operation and never copies the setting's current value (a
// secret stays masked): the practice area starts from a made-up example.
const NAV = (globalThis.marNav ??= {});

// The hand-written list of what the icon offers, checked by the tests.
export const INFO_PANEL_PARTS = ["explanation", "steps", "example", "practice"];

function decorate(ctx, row) {
  if (row.dataset.iiDone) return;
  row.dataset.iiDone = "1";
  const entry = ctx.state.catalog?.entries?.find((e) => e.id === row.id.slice(2));
  const ctl = row.querySelector(".top .ctl");
  if (!entry || !ctl) return;
  const { h, icon, t, tt } = ctx;
  const btn = h("button", { type: "button", class: "info nt-info", "aria-haspopup": "dialog", "aria-label": `${t("Guide for", "指南：")} ${tt(entry.label)}`, title: t("How this control works", "呢個控制項點用"), onClick: () => {
    if (NAV.guidance) NAV.guidance.open(ctx, entry, { wizard: false });
    else ctx.toast(t("The guide is not available.", "指南用唔到。"), "bad");
  } }, icon("help", "sm"));
  ctl.prepend(btn);
}

export default {
  id: "info-icon-guidance",
  overlays: [
    {
      id: "info-icon-guidance.rows",
      mount(ctx) {
        const scan = (root) => root.querySelectorAll?.(".setting[id^='s-']").forEach((r) => decorate(ctx, r));
        scan(document);
        const observer = new MutationObserver((records) => { for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) { if (n.matches?.(".setting[id^='s-']")) decorate(ctx, n); scan(n); } });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
      },
    },
  ],
};
