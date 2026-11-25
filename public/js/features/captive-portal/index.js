// Guest welcome page (captive portal): a switch, a picker for which guest
// network shows it and how long visitors stay signed in, with a phone preview
// that follows the changes waiting in the dock. The preview is a labelled
// illustration of the idea, not the router's real page. Stock ASUS firmware
// only; on Merlin the controls are shown switched off with the reason.
import { effective, sessionWords, visitorStory } from "./model.js";

const label = { en: "Guest welcome page", yue: "訪客歡迎頁" };
const lede = { en: "Greet visitors with a welcome page before they get online, and choose how long they stay signed in.", yue: "訪客上網前先見到歡迎頁，仲可以揀佢哋保持登入幾耐。" };

export default {
  id: "captive-portal",

  screens: [
    {
      id: "captive-portal",
      group: { en: "Network", yue: "網絡" },
      icon: "waving_hand",
      label,
      async render(ctx) {
        const { h, icon, t, tt } = ctx;
        const page = ctx.page(label, lede);
        ctx.root.append(page);
        const data = await ctx.api.get("/api/domain/captive-portal");
        const offs = [];
        if (data.reason) page.append(h("div", { class: "note warn" }, icon("info"), tt(data.reason)));

        const phone = h("div", { class: "cp-phone", role: "img", "aria-label": t("Illustration of the welcome page a visitor would see", "訪客會見到嘅歡迎頁示意圖") });
        const story = h("div", { class: "cp-story", role: "status", "aria-live": "polite" });
        const draw = () => {
          const pending = new Map(data.entries.filter((e) => ctx.dock.has(e.id)).map((e) => [e.id, ctx.dock.value(e.id)]));
          const now = effective(data, pending);
          const s = visitorStory(now);
          ctx.clear(phone);
          phone.className = `cp-phone ${s.id}`;
          phone.append(h("div", { class: "cp-bar" }, icon("wifi", "sm"), h("span", {}, s.ssid || t("Guest Wi-Fi", "訪客 Wi-Fi"))),
            h("div", { class: "cp-card" }, icon(s.id === "on" ? "waving_hand" : "public", "lg"),
              h("div", { class: "t1" }, s.id === "on" ? t("Welcome!", "歡迎！") : t("You are online", "你已經上到網")),
              h("div", { class: "t2" }, s.id === "on" ? t("Tap to start browsing.", "撳一下就可以開始上網。") : t("No welcome page.", "冇歡迎頁。")),
              s.id === "on" ? h("span", { class: "cp-go" }, t("Continue", "繼續")) : null),
            h("div", { class: "cp-note" }, t("Illustration only", "示意圖")));
          ctx.clear(story);
          story.append(h("div", { class: "t1" }, s.id === "off" ? t("Visitors go straight online.", "訪客直接上網。") : s.id === "network-off" ? t("Nobody will see the page yet.", "暫時冇人見到歡迎頁。") : t("Visitors see the page first.", "訪客會先見到歡迎頁。")),
            h("div", { class: "t2" }, s.id === "off" ? t("The welcome page is off.", "歡迎頁已關閉。")
              : s.id === "network-off" ? t(`The guest network you picked (${s.network}) is switched off, so no visitor can join it. Turn it on in Guest networks.`, `你揀嘅訪客網絡（${s.network}）關住，冇訪客連到。請喺訪客網絡開啟佢。`)
              : t(`On ${s.ssid || s.network}. Visitors stay signed in ${sessionWords(s.session).en}${s.idle ? `, or until idle for ${s.idle} minutes` : ""}.`, `喺「${s.ssid || s.network}」。訪客保持登入${sessionWords(s.session).yue}${s.idle ? `，或者閒置 ${s.idle} 分鐘就登出` : ""}。`)));
        };
        draw();
        offs.push(ctx.bus.on("dock", draw));
        page.append(h("section", { class: "card rise cp-hero" }, phone, story));

        for (const group of ctx.controls.settingGroups(data.entries)) {
          const card = ctx.controls.groupCard(group.label, group.entries);
          card.classList.add("rise");
          page.append(card);
        }
        return () => offs.forEach((off) => off());
      },
    },
  ],

  commands: [
    { id: "captive-portal.open", icon: "waving_hand", label: { en: "Open the guest welcome page", yue: "開啟訪客歡迎頁" }, keywords: "captive portal welcome page guest wifi login 歡迎 訪客", run: (ctx) => ctx.navigate("captive-portal") },
  ],
};
