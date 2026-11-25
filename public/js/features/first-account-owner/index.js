// A settings card that states the first-account rule and shows its live status.
// Opening it also asks the server to remove any old setup-code file.
export default {
  id: "first-account-owner",
  settings: [{
    id: "first-account-owner",
    icon: "admin_panel_settings",
    label: { en: "Who owns this app", yue: "邊個係擁有者" },
    async render(ctx) {
      const { api, h, icon, t } = ctx;
      const status = await api.get("/api/x/first-account-owner/status");
      return h("div", {},
        h("p", {}, t("The first account that registered became the owner. There is no setup code, and any later attempt to register is refused and pointed at sign-in.", "第一個註冊嘅帳戶成為擁有者。冇設定碼，之後再有人嘗試註冊會被拒絕，並指向登入頁。")),
        h("div", { class: "note" }, icon(status.hasOwner ? "verified_user" : "warning"), status.hasOwner ? t(`Owner: ${status.ownerUsername}.`, `擁有者：${status.ownerUsername}。`) : t("No owner yet. The next account to register becomes the owner.", "仲未有擁有者。下一個註冊嘅帳戶會成為擁有者。")),
        status.removedSetupCodeFiles.length ? h("div", { class: "note warn" }, icon("delete"), t(`Removed old setup-code files: ${status.removedSetupCodeFiles.join(", ")}.`, `已移除舊嘅設定碼檔案：${status.removedSetupCodeFiles.join("、")}。`)) : null);
    },
  }],
};
