// A collapsible section for search bars, filter rows and statistics. The open
// or closed state is kept per section id, it can be changed from the
// keyboard, the button announces its state, and a collapsed section never
// hides an active filter without saying so.
import { prefs } from "../material-design/prefs.js";

export const isCollapsed = (id, defaultCollapsed = false, store = prefs) => store.get().collapsed[id] ?? defaultCollapsed;
export const setCollapsed = (id, value, store = prefs) => store.update((d) => { d.collapsed[id] = Boolean(value); });
export const resetCollapsed = (store = prefs) => store.update((d) => { d.collapsed = {}; });

// opts: { id, title: {en,yue}, defaultCollapsed, activeCount(): number, descriptive }
// Descriptive sections (long explanations, statistics) start collapsed unless told otherwise.
export function collapsible(ctx, opts, ...children) {
  const { h, icon, t, tt } = ctx;
  const { id, title, activeCount = () => 0, descriptive = false } = opts;
  const startCollapsed = opts.defaultCollapsed ?? descriptive;
  const body = h("div", { class: "cf-body", id: `cf-${id}` }, ...children);
  const badge = h("span", { class: "tag warn cf-badge", role: "status", hidden: true });
  const chev = icon("expand_more", "sm");
  const button = h("button", { type: "button", class: "cf-head", "aria-controls": `cf-${id}`, onClick: () => setCollapsed(id, !isCollapsed(id, startCollapsed)) }, chev, h("span", { class: "cf-title" }, tt(title)), badge);
  const el = h("section", { class: "cf" }, button, body);
  let seen = false;
  const draw = () => {
    // Stop listening once the section has been removed from the page.
    if (el.isConnected) seen = true;
    else if (seen) return el.off();
    const collapsed = isCollapsed(id, startCollapsed);
    button.setAttribute("aria-expanded", String(!collapsed));
    body.hidden = collapsed;
    el.classList.toggle("collapsed", collapsed);
    const active = collapsed ? activeCount() : 0;
    badge.hidden = active === 0;
    badge.textContent = active ? t(`${active} active, hidden`, `${active} 個篩選生效中，已收埋`) : "";
  };
  el.refresh = draw;
  el.off = prefs.subscribe(draw);
  draw();
  return el;
}
