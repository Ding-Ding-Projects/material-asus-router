// Workflow navigation. The workspace is split into destinations (router
// status, devices, firewall, logs and so on) and every navigable-looking
// element does what its label says. This screen is the map of all of them,
// and the audit below is what the tests run to prove each destination has an
// icon, a bilingual label and a screen behind it.
//
// Not applicable to the web app: the frameless desktop title bar belongs to
// the planned desktop companion, which does not exist yet. The documentation
// site stays a separate surface.

// Returns a list of problems; an empty list means every destination is real.
export function auditDestinations(destinations, screenIds) {
  const problems = [];
  const seen = new Set();
  for (const d of destinations) {
    if (!d?.id) { problems.push("a destination has no id"); continue; }
    if (seen.has(d.id)) problems.push(`${d.id} is listed twice`);
    seen.add(d.id);
    if (!d.icon) problems.push(`${d.id} has no icon`);
    if (!d.label?.en || !d.label?.yue) problems.push(`${d.id} has no bilingual label`);
    if (!screenIds.has(d.id)) problems.push(`${d.id} has no screen behind it`);
  }
  return problems;
}

function map(ctx) {
  const { h, icon, t, tt } = ctx;
  const catl = ctx.state.catalog;
  const all = [...catl.domains, ...Object.values(ctx.state.featureScreens ?? {})];
  const seen = new Set();
  const groups = new Map();
  for (const d of all) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    const g = d.group ? tt(d.group) : t("Features", "功能");
    groups.set(g, [...(groups.get(g) ?? []), d]);
  }
  ctx.root.append(ctx.page({ en: "Workspace map", yue: "工作區地圖" }, { en: "Every destination in the app, grouped by task. Each button opens exactly the screen it names.", yue: "程式入面所有目的地，按任務分組。每個按鈕都會打開佢寫明嘅畫面。" },
    h("div", { class: "grid2" }, [...groups].map(([name, list]) => h("section", { class: "card rise" }, h("h2", { class: "h2" }, name), list.map((d) => h("button", { type: "button", class: "row navi", onClick: () => ctx.navigate(d.id) }, icon(d.icon ?? "chevron_right", "sm"), h("span", { class: "grow" }, tt(d.label)), icon("chevron_right", "sm")))))),
    h("section", { class: "card tone" }, h("div", { class: "note" }, icon("history", "sm"), t("The browser's Back and Forward buttons move between the screens you opened, and the address always names the screen you are on.", "瀏覽器嘅返回同前進掣會喺你開過嘅畫面之間移動，網址永遠寫明你喺邊個畫面。")),
      h("div", { class: "note warn" }, icon("construction", "sm"), h("div", {}, h("b", {}, t("Not applicable: ", "不適用：")), t("the frameless desktop title bar belongs to a desktop companion app, which does not exist yet. This is a web app, so the browser draws the window.", "無邊框桌面標題列屬於桌面伴侶程式，暫時未有。呢個係網頁程式，所以視窗由瀏覽器繪製。"))))));
}

export default {
  id: "workflow-navigation",
  screens: [{ id: "map", group: { en: "Monitor", yue: "監察" }, icon: "map", label: { en: "Workspace map", yue: "工作區地圖" }, render: map }],
  commands: [{ id: "workflow-navigation.open", icon: "map", label: { en: "Open the workspace map", yue: "打開工作區地圖" }, keywords: "destinations navigate screens", run: (ctx) => ctx.navigate("map") }],
};
