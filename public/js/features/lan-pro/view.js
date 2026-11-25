// Page pieces shared by this feature's screens: it loads the screen's data,
// draws one card of rich controls per group, hides fields that do not apply to
// the chosen connection type, and lists anything still in progress.
// (Each feature folder keeps its own copy; a feature imports only its own files.)

// An entry may say `meta.showWhen`: one rule { id, in: [values] }, or a list of
// alternatives where each alternative is a list of rules that must all hold.
// `id` is another entry on the same screen, read as the person has it now
// (a pending edit included).
const alternatives = (rule) => (Array.isArray(rule) ? rule : [[rule]]);

// Hides rows whose rule does not hold, and cards with nothing left to show.
// Returns a function that stops listening.
export function visibility(ctx, scope, entries) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const value = (id) => (ctx.dock.has(id) ? ctx.dock.value(id) : byId.get(id)?.value ?? "");
  const run = () => {
    for (const entry of entries) {
      if (!entry.meta?.showWhen) continue;
      const row = scope.querySelector(`[id="s-${entry.id}"]`);
      if (row) row.hidden = !alternatives(entry.meta.showWhen).some((all) => all.every((rule) => rule.in.includes(value(rule.id))));
    }
    for (const card of scope.querySelectorAll("section[data-g]")) card.hidden = ![...card.querySelectorAll(".setting")].some((row) => !row.hidden);
  };
  run();
  return ctx.bus.on("dock", run);
}

// The value of an entry as the person has it now, pending edit included.
export const nowValue = (ctx, entry) => (ctx.dock.has(entry.id) ? ctx.dock.value(entry.id) : entry.value);

// A short row of facts: [{ label: {en,yue}, value, tone? }].
export function facts(ctx, items) {
  const { h, tt } = ctx;
  return h("div", { class: "chips factrow" }, items.map((item) => h("span", { class: `tag ${item.tone ?? ""}` }, `${tt(item.label)}: `, h("b", {}, String(item.value)))));
}

// "Not finished yet" notes, shown honestly instead of a fake control.
export function unfinished(ctx, list) {
  const { h, icon, t, tt } = ctx;
  if (!list?.length) return null;
  return h("section", { class: "card tone rise" },
    h("h2", { class: "h2" }, icon("construction", "sm"), " ", t("In progress", "進行中")),
    list.map((item) => h("div", { class: "note" }, icon("info"), h("div", {}, h("b", {}, tt(item.label)), h("div", {}, tt(item.detail))))));
}

// Loads `GET /api/domain/<id>` and draws the page. Callbacks may return a node,
// a list of nodes or { nodes, stop }:
//   spec.before(data, ctx, view)   above the cards
//   spec.after(data, ctx, view)    below the cards
//   spec.entries(data)             the entries to draw (default data.entries)
// `view.redraw()` draws the cards again, for example after a preset filled
// several settings; the cards always show the pending values.
export async function buildScreen(ctx, spec) {
  const { h, icon, t } = ctx;
  const data = await ctx.api.get(`/api/domain/${spec.id}`);
  const entries = spec.entries ? spec.entries(data) : data.entries ?? [];
  const page = ctx.page(spec.title, spec.lede);
  const stops = [];
  const grid = h("div", { class: "grid2" });
  let stopVisibility = null;
  const view = {
    redraw() {
      grid.replaceChildren(...ctx.controls.settingGroups(entries).map((g) => {
        const card = ctx.controls.groupCard(g.label, g.entries);
        card?.setAttribute("data-g", g.id);
        return card;
      }).filter(Boolean));
      stopVisibility?.();
      stopVisibility = visibility(ctx, grid, entries);
    },
  };
  const add = (made) => {
    if (!made) return;
    if (Array.isArray(made)) return void made.forEach(add);
    if (made instanceof Node) return void page.append(made);
    add(made.nodes);
    if (typeof made.stop === "function") stops.push(made.stop);
  };
  if (!ctx.state.canWrite) page.append(h("div", { class: "pill t" }, icon("visibility", "sm"), t("View only. Your account cannot change settings.", "只可以睇。你嘅帳戶唔可以改設定。")));
  add(await spec.before?.(data, ctx, view));
  view.redraw();
  page.append(grid);
  add(await spec.after?.(data, ctx, view));
  add(unfinished(ctx, data.inProgress));
  ctx.root.append(page);
  return () => {
    stopVisibility?.();
    stops.forEach((stop) => stop());
  };
}
