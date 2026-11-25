// The Firmware screen: the version now running, a check for the latest one,
// the auto-update settings and a plain explanation of why nothing is flashed.
import { createUi } from "./ui.js";

const label = { en: "Firmware updates", yue: "韌體更新" };
const lede = { en: "See what the router runs, look for a newer version and set how updates are handled.", yue: "睇路由器而家用邊個版本、搵新版本，同設定更新方式。" };

// What each state means in words, so colour is never the only signal.
export const stateCopy = {
  current: { icon: "check_circle", tone: "good", en: "You are on the latest version.", yue: "你用緊最新版本。" },
  newer: { icon: "new_releases", tone: "warn", en: "A newer version is available.", yue: "有較新嘅版本。" },
  ahead: { icon: "science", tone: "", en: "This router runs a version newer than the latest release (a test build).", yue: "路由器用緊比最新正式版更新嘅版本（測試版）。" },
  unchecked: { icon: "help", tone: "", en: "The router has not looked for updates yet. Press Check now.", yue: "路由器未搵過更新，請撳「立即檢查」。" },
  offline: { icon: "cloud_off", tone: "warn", en: "Could not look up the latest version from here.", yue: "喺呢度搵唔到最新版本。" },
  unknown: { icon: "help", tone: "", en: "The version could not be compared.", yue: "比較唔到版本。" },
};

function link(h, url, text) {
  return h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "btn t sm" }, text);
}

async function draw(ctx, root) {
  const ui = createUi(ctx);
  const { api, h, t, tt, icon, toast } = ctx;
  const data = await api.get("/api/domain/firmware-pro");
  const page = ctx.page(label, lede);
  root.replaceChildren(page);

  const result = h("div", { class: "fwresult", "aria-live": "polite" });
  const show = (r) => {
    const copy = stateCopy[r.state] ?? stateCopy.unknown;
    result.replaceChildren(
      h("div", { class: `note ${copy.tone}` }, icon(copy.icon), h("div", {}, t(copy.en, copy.yue), r.reason ? ` ${r.reason}` : "")),
      r.latest ? h("div", { class: "row" }, h("div", { class: "grow" }, h("div", { class: "k" }, t("Latest version", "最新版本")), h("div", { class: "t1 mono" }, r.latest, r.name ? ` · ${r.name}` : "")), r.publishedAt ? h("div", { class: "t2" }, new Date(r.publishedAt).toLocaleDateString()) : null) : null,
      r.notes ? h("details", { class: "fwnotes" }, h("summary", {}, t("Release notes", "更新內容")), h("pre", { class: "mono" }, r.notes)) : null,
      r.url ? h("div", { class: "actions" }, link(h, r.url, t("Open the download page", "開啟下載頁"))) : null);
  };
  const checkNow = h("button", { class: "btn f", onClick: async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    try {
      const asks = data.current.family === "stock" && ctx.state.canWrite;
      let out = asks ? await api.post("/api/x/firmware-pro/check") : await api.get("/api/x/firmware-pro/latest");
      for (let i = 0; asks && out.state === "unchecked" && i < 5; i += 1) {
        show({ state: "unchecked" });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        out = await api.get("/api/x/firmware-pro/latest");
      }
      show(out);
    } catch (error) {
      toast(error.message, "bad");
    } finally {
      button.disabled = false;
    }
  } }, icon("refresh", "sm"), t("Check now", "立即檢查"));

  page.append(
    ui.card(
      h("div", { class: "k" }, data.current.family === "merlin" ? t("Asuswrt-Merlin", "Asuswrt-Merlin") : t("Original ASUS firmware", "原廠 ASUS 韌體")),
      h("div", { class: "big mono" }, data.current.display || "?"),
      h("div", { class: "t2" }, data.model),
      h("div", { class: "actions" }, checkNow),
      result),
    ...ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)),
    ui.card(
      ui.headRow(t("Why this app does not flash firmware", "點解呢個程式唔會刷韌體")),
      data.flashing.reasons.map((r) => h("div", { class: "row" }, icon(r.icon), h("div", { class: "grow" }, t(r.en, r.yue)))),
      h("div", { class: "note" }, icon("info"), h("div", {}, tt(data.flashing.where)))));
  if (data.known && data.known.state !== "unchecked") show(data.known);
  else if (data.current.family === "stock") show({ state: "unchecked", url: data.known?.url });
}

export default {
  id: "firmware-pro",
  screens: [
    {
      id: "firmware-pro",
      group: { en: "Router", yue: "路由器" },
      icon: "system_update_alt",
      label,
      async render(ctx) {
        await draw(ctx, ctx.root);
        return ctx.bus.on("changed", () => draw(ctx, ctx.root));
      },
    },
  ],
  settings: [
    {
      id: "firmware-pro",
      icon: "system_update_alt",
      label,
      async render(ctx) {
        const data = await ctx.api.get("/api/domain/firmware-pro");
        return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries));
      },
    },
  ],
  commands: [
    { id: "firmware-pro.open", icon: "system_update_alt", label: { en: "Open firmware updates", yue: "開啟韌體更新" }, keywords: "firmware version update merlin release", run: (ctx) => ctx.navigate("firmware-pro") },
  ],
};
