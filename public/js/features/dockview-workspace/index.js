// Workspaces use dockview: NOT DELIVERED. This card says so plainly.
//
// The requirement is to bundle a pinned release of the dockview library from the
// private fork, for tabs, splits, docking, floating groups and saved layouts. That
// fork is not reachable from this build, so nothing is bundled and no other
// docking library or hand-made splitter is used in its place (the tests fail if
// one appears). What exists instead is the tab strip in the tabs feature, which
// docks to any edge but does not split the page into panes.
export const STATUS = {
  state: "in-progress",
  missing: ["the pinned dockview bundle", "split panes", "floating groups", "saved layouts with reset", "phone collapse of panes"],
  instead: "the workspace tab strip (tabs feature)",
};

export default {
  id: "dockview-workspace",
  settings: [
    {
      id: "dockview-workspace",
      icon: "view_quilt",
      label: { en: "Split panes (dockview)", yue: "分割窗格（dockview）" },
      render(ctx) {
        const { h, icon, t } = ctx;
        return h("div", { class: "note warn" }, icon("construction", "sm"), h("div", {},
          h("b", {}, t("In progress: not available yet.", "未完成：暫時未有。")),
          h("div", {}, t("Split panes, floating groups and saved layouts need the pinned dockview bundle, which is not part of this build. No substitute was made. The workspace tab strip is what you have now: it docks to any edge, reorders, pins and groups tabs.", "分割窗格、浮動群組同儲存版面需要固定版本嘅 dockview 套件，今次建置冇包含。冇用其他方案代替。而家用嘅係工作區分頁列：可以停靠任何邊、排序、固定同分組分頁。"))));
      },
    },
  ],
};
