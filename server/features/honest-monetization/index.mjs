// An honest statement of how this app is paid for: it is free. The four
// categories that must never sit behind a payment are listed with the screen
// where each one can be reached, and the test for this feature checks that
// every named screen exists. No part of the app asks for money, reviews or an
// upgrade.
export const PROTECTED = [
  { id: "accessibility", label: { en: "Accessibility and language modes", yue: "無障礙同語言模式" }, screen: "feature-settings" },
  { id: "school-mode", label: { en: "School mode", yue: "學校模式" }, screen: "feature-settings" },
  { id: "unlock-ladder", label: { en: "The unlock ladder", yue: "解鎖階梯" }, screen: "unlock-ladder" },
  { id: "data-export", label: { en: "Exporting and importing data", yue: "資料匯出同匯入" }, screen: "exports" },
];

export const UPSTREAM = [
  { name: "Asuswrt-Merlin", url: "https://www.asuswrt-merlin.net/", en: "The firmware add-on this app understands.", yue: "呢個程式支援嘅韌體附加版本。" },
  { name: "ssh2", url: "https://github.com/mscdex/ssh2", en: "The SSH library that talks to the router.", yue: "同路由器溝通嘅 SSH 程式庫。" },
];

export default {
  id: "honest-monetization",
  domainMeta: [],
  routes(api) {
    api.get("/statement", () => ({
      free: true,
      paid: false,
      prompts: { payments: false, donations: false, reviews: false, upgrades: false },
      protectedCategories: PROTECTED,
      upstream: UPSTREAM,
      text: "Material Asus Router is free. Nothing in it is behind a payment, and it never asks for money, a donation, a review or an upgrade.",
    }));
  },
};
