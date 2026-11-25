// Firmware: the version now running, a check for the latest one and the
// auto-update setting. This app never flashes firmware, and says why.
import { L, ON_OFF } from "../kit.mjs";
import { checkMerlin, currentVersion, readStock } from "./releases.mjs";

const ID = "firmware-pro";
const GROUP = L("Updates", "更新");

const NO_FLASH = [
  { icon: "memory", en: "A failed flash can leave the router unable to start. Recovery then needs a cable, a computer and the vendor's recovery tool.", yue: "刷韌體失敗可能令路由器開唔到機，要用網線、電腦同廠商嘅還原工具先救到。" },
  { icon: "wifi_off", en: "The router restarts into the new firmware and drops this app's connection, so nothing here could confirm that it worked.", yue: "路由器會重啟入新韌體，連線會中斷，呢個程式冇辦法確認刷機成功。" },
  { icon: "fact_check", en: "The file must match your exact model and be checked against the maker's checksum. That check belongs on the router's own page.", yue: "檔案要同你嘅型號完全吻合，仲要同廠商嘅校驗碼對過。呢個步驟應該喺路由器自己嘅網頁做。" },
];

export default {
  id: ID,
  catalog: () => [
    { id: `${ID}.check`, domain: ID, group: "updates", groupLabel: GROUP, key: "firmware_check_enable", control: "switch", values: ON_OFF, risk: "low",
      label: L("Look for new firmware by itself", "自動搵新韌體"), help: L("The router asks the maker now and then whether a new version exists, and tells you on its own page. It does not install anything.", "路由器會定時問廠商有冇新版本，並喺自己嘅網頁通知你。唔會自動安裝。") },
    { id: `${ID}.auto`, domain: ID, group: "updates", groupLabel: GROUP, key: "fw_auto_upgrade", control: "switch", values: ON_OFF, risk: "low",
      label: L("Install firmware updates by itself", "自動安裝韌體更新"), help: L("The router installs new firmware at a quiet hour. Turn it off if you want to read the release notes first.", "路由器會喺清靜時段自動安裝新韌體。想先睇更新內容就關閉。") },
    { id: `${ID}.period`, domain: ID, group: "updates", groupLabel: GROUP, key: "fw_check_period", control: "stepper", min: 1, max: 30, risk: "low",
      label: L("Look for new firmware every (days)", "幾耐搵一次新韌體（日數）"), help: L("How often the router asks whether a new version exists.", "路由器幾耐問一次有冇新版本。") },
  ],
  domainMeta: [{ id: ID, icon: "system_update_alt", label: L("Firmware updates", "韌體更新"), group: { en: "Router", yue: "路由器" } }],
  domains: {
    [ID]: async (ctx) => {
      const current = currentVersion(ctx.nvram);
      return {
        entries: ctx.entries(),
        model: ctx.info.model,
        current: { family: current.family, display: current.display, firmver: current.firmver, buildno: current.buildno, extendno: current.extendno },
        known: current.family === "stock" ? readStock(current, ctx.nvram, ctx.info.model) : null,
        flashing: { allowed: false, reasons: NO_FLASH, where: L("Update from the router's own page or the maker's site, then press Refresh here.", "請喺路由器自己嘅網頁或者廠商網站更新，之後喺呢度撳「重新整理」。") },
      };
    },
  },
  routes(api) {
    // Merlin: the latest GitHub release. Stock: what the router already reports.
    api.get("/latest", async ({ live }) => {
      const ctx = await live();
      const current = currentVersion(ctx.nvram);
      const result = current.family === "merlin" ? await checkMerlin(current) : readStock(current, ctx.nvram, ctx.info.model);
      return { current: current.display, family: current.family, ...result };
    });
    // Stock: ask the router to look now, then read again a few seconds later.
    api.post("/check", async ({ live }) => {
      const ctx = await live();
      const current = currentVersion(ctx.nvram);
      if (current.family === "merlin") return { current: current.display, family: current.family, ...(await checkMerlin(current)) };
      const out = await ctx.exec("service start_webs_update");
      return { current: current.display, family: current.family, asked: out.code === 0, ...readStock(current, ctx.nvram, ctx.info.model) };
    });
  },
  // fw_auto_upgrade and fw_check_period belong to older builds; a router that lacks them shows those two controls switched off.
  fakeRouter: { nvram: { firmware_check_enable: "1", fw_auto_upgrade: "0", fw_check_period: "7", webs_state_update: "0", webs_state_info: "" } },
};
