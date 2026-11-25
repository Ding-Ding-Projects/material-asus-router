// A complete, tiny frontend feature using every registry hook. Copy this
// folder to start a new feature, then delete what you do not need.
//
// This file imports nothing: everything it needs arrives in ctx, so the module
// loads fast and the same file can be checked from Node tests.

const label = { en: "Uptime (example)", yue: "運行時間（範例）" };

const duration = (seconds) => {
  const d = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  return d ? `${d}d ${hrs}h` : `${hrs}h ${Math.floor((seconds % 3600) / 60)}m`;
};

async function card(ctx, root) {
  const { api, h, icon, t } = ctx;
  const data = await api.get("/api/domain/example-uptime");
  const warn = data.days >= data.warnDays;
  const mark = h("button", {
    class: "btn o sm",
    async onClick() {
      try {
        const out = await api.post("/api/actions/example-uptime.mark");
        ctx.toast(out.message || t("Marked.", "已標記。"));
      } catch (error) {
        ctx.toast(error.message, "bad");
      }
    },
  }, icon("flag", "sm"), t("Mark this moment", "標記而家"));
  root.append(
    h("section", { class: `card rise ${warn ? "warn" : "tone"}` },
      h("div", { class: "k" }, t("Router uptime", "路由器運行時間")),
      h("div", { class: "big" }, duration(data.seconds)),
      h("div", { class: "t2" }, warn ? t(`Longer than ${data.warnDays} days. A restart may help.`, `超過 ${data.warnDays} 日，可以考慮重啟。`) : t(`Restart reminder after ${data.warnDays} days.`, `${data.warnDays} 日後提醒重啟。`)),
      mark),
    ...ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)),
  );
}

export default {
  id: "example-uptime",

  // A screen in the rail. render(ctx) draws into ctx.root and may return a
  // cleanup function.
  screens: [
    {
      id: "example-uptime",
      group: { en: "Monitor", yue: "監察" },
      icon: "timer",
      label,
      async render(ctx) {
        ctx.root.append(ctx.page(label, { en: "A template feature: one card, one action and its settings.", yue: "範本功能：一張卡、一個動作同佢嘅設定。" }));
        await card(ctx, ctx.root.firstChild);
      },
    },
  ],

  // A section on the Feature settings screen.
  settings: [
    {
      id: "example-uptime",
      icon: "timer",
      label,
      async render(ctx) {
        const data = await ctx.api.get("/api/domain/example-uptime");
        return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries));
      },
    },
  ],

  // An entry in the command palette (Ctrl+K).
  commands: [
    { id: "example-uptime.open", icon: "timer", label: { en: "Open the uptime example", yue: "開啟運行時間範例" }, keywords: "uptime restart", run: (ctx) => ctx.navigate("example-uptime") },
  ],
};
