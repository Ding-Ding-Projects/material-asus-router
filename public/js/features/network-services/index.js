// Network services screen: NFS, printer server, USB idle timer, discovery
// toggles, and a disk health card (SMART read-out and a read-only check).
// Settings are rich controls from the app; only the disk tools are drawn here.

const label = { en: "Network services", yue: "網絡服務" };
const lede = { en: "File sharing helpers, the printer server, drive sleep and disk health.", yue: "檔案分享幫手、打印伺服器、磁碟休眠同磁碟健康。" };

export const sizeText = (kb) => (kb >= 1e9 ? `${(kb / 1e9).toFixed(1)} TB` : kb >= 1e6 ? `${(kb / 1e6).toFixed(1)} GB` : `${Math.round(kb / 1e3)} MB`);

// How worried to be about a SMART answer. Words always carry the meaning, colour only helps.
export function healthTone(result) {
  if (!result?.available) return { tone: "", word: "unavailable" };
  if (result.health === "failed" || result.pending > 0 || result.reallocated > 0) return { tone: result.health === "failed" ? "bad" : "warn", word: result.health === "failed" ? "failing" : "watch" };
  return { tone: "good", word: result.health === "passed" ? "healthy" : "unknown" };
}

function diskCard(ctx, data) {
  const { api, h, icon, t } = ctx;
  const out = h("div", { class: "ns-out", "aria-live": "polite" });
  const words = { healthy: t("Healthy", "健康"), watch: t("Keep an eye on it", "要留意"), failing: t("Failing", "快壞"), unknown: t("Not reported", "冇報告"), unavailable: t("Not available", "唔提供") };
  const show = (...nodes) => ctx.clear(out).append(h("div", { class: "ns-result rise" }, ...nodes));

  async function health(disk) {
    show(icon("hourglass_top"), t(`Asking ${disk} how it feels…`, `問緊 ${disk} 狀況…`));
    try {
      const r = await api.get(`/api/x/network-services/health/${disk}`);
      if (!r.available) return show(h("div", { class: "t1" }, t("This router cannot read disk health.", "呢部路由器讀唔到磁碟健康。")), h("div", { class: "t2" }, r.reason));
      const tone = healthTone(r);
      show(
        h("div", { class: "ns-health" }, h("span", { class: `tag ${tone.tone}` }, icon(tone.tone === "good" ? "check_circle" : tone.tone === "bad" ? "error" : "warning", "sm"), words[tone.word]),
          h("span", { class: "t2" }, `${disk}`)),
        h("div", { class: "ns-facts" },
          r.temperatureC !== null ? h("div", {}, h("div", { class: "k" }, t("Temperature", "溫度")), h("div", { class: "big" }, `${r.temperatureC} °C`)) : null,
          r.powerOnHours !== null ? h("div", {}, h("div", { class: "k" }, t("Hours switched on", "開機時數")), h("div", { class: "big" }, String(r.powerOnHours))) : null,
          r.reallocated !== null ? h("div", {}, h("div", { class: "k" }, t("Bad sectors moved", "已搬走嘅壞磁區")), h("div", { class: "big" }, String(r.reallocated))) : null),
        ...r.warnings.map((w) => h("div", { class: "t2" }, icon("warning", "sm"), " ", w)));
    } catch (error) {
      show(h("div", { class: "t1" }, error.message));
    }
  }

  async function check(partition, button) {
    button.disabled = true;
    const started = Date.now();
    const clock = setInterval(() => show(icon("hourglass_top"), t(`Checking ${partition}… ${Math.round((Date.now() - started) / 1000)} s. Nothing is repaired.`, `檢查緊 ${partition}… ${Math.round((Date.now() - started) / 1000)} 秒。唔會修復任何嘢。`)), 1000);
    show(icon("hourglass_top"), t(`Checking ${partition}… Nothing is repaired.`, `檢查緊 ${partition}… 唔會修復任何嘢。`));
    try {
      const r = await api.post("/api/x/network-services/check", { partition });
      if (!r.available) return show(h("div", { class: "t1" }, r.reason));
      show(h("span", { class: `tag ${r.clean ? "good" : "warn"}` }, icon(r.clean ? "check_circle" : "warning", "sm"), r.clean ? t("No problems found", "冇發現問題") : t("Problems found", "發現問題")),
        h("div", { class: "mono t2" }, r.summary.join("\n")),
        r.clean ? null : h("div", { class: "t2" }, t("Nothing was repaired. Copy your files off the drive, then repair it from a computer.", "冇修復任何嘢。請先將檔案複製出嚟，再用電腦修復。")));
    } catch (error) {
      show(h("div", { class: "t1" }, error.message));
    } finally {
      clearInterval(clock);
      button.disabled = false;
    }
  }

  return h("section", { class: "card rise" },
    h("h2", { class: "h2" }, t("Disk health", "磁碟健康")),
    h("div", { class: "t2" }, t("Reads what the drive reports about itself. The check only looks and never repairs, and only works on a drive that is ejected.", "讀取磁碟自己報告嘅狀況。檢查只會睇，唔會修復，而且淨係喺已退出嘅磁碟先做到。")),
    data.disks.length
      ? data.disks.map((d) => h("div", { class: "row" },
          icon("hard_drive"),
          h("div", { class: "grow" }, h("div", { class: "t1" }, `${d.name} · ${sizeText(d.sizeKb)}`),
            d.partitions.map((p) => h("div", { class: "t2" }, `${p.name} · ${sizeText(p.sizeKb)} · `, p.mountedAt ? t(`in use at ${p.mountedAt}`, `使用緊，位置 ${p.mountedAt}`) : t("ejected", "已退出")))),
          h("button", { class: "btn t sm", onClick: () => health(d.name) }, icon("monitor_heart", "sm"), t("Health", "健康")),
          ...d.partitions.filter((p) => !p.mountedAt).map((p) => { const b = h("button", { class: "btn o sm", onClick: () => check(p.name, b) }, icon("fact_check", "sm"), t(`Check ${p.name}`, `檢查 ${p.name}`)); return b; })))
      : h("div", { class: "empty" }, icon("usb_off", "lg"), t("No USB drive is connected.", "冇接駁 USB 磁碟。")),
    out);
}

async function screen(ctx) {
  const { api, h, icon, t } = ctx;
  const data = await api.get("/api/domain/network-services");
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  const groups = ctx.controls.settingGroups(data.entries);
  const nfs = groups.find((g) => g.id === "nfs");
  const rest = groups.filter((g) => g.id !== "nfs");

  if (nfs) {
    page.append(ctx.controls.groupCard(nfs.label, nfs.entries));
    page.append(h("section", { class: "card tone rise" }, h("h2", { class: "h2" }, t("Folders shared over NFS", "用 NFS 分享嘅資料夾")),
      data.exports.length
        ? data.exports.map((x) => h("div", { class: "row" }, icon("folder_shared"), h("div", { class: "grow" }, h("div", { class: "t1 mono" }, x.folder), h("div", { class: "t2" }, `${x.client || t("anyone", "任何人")} · ${x.options}`))))
        : h("div", { class: "t2" }, data.merlin ? t("No folder is shared.", "冇分享任何資料夾。") : t("NFS needs Asuswrt-Merlin firmware.", "NFS 要用 Asuswrt-Merlin 韌體。"))));
  }
  for (const g of rest) page.append(ctx.controls.groupCard(g.label, g.entries));

  const link = (screenId, text) => h("button", { class: "btn o sm", onClick: () => ctx.navigate(screenId) }, icon("open_in_new", "sm"), text);
  page.append(h("section", { class: "card tone rise" }, h("h2", { class: "h2" }, t("Set somewhere else", "喺其他頁面設定")),
    h("div", { class: "row" }, icon("backup"), h("div", { class: "grow" }, h("div", { class: "t1" }, t("Time Machine", "Time Machine")),
      h("div", { class: "t2" }, data.related.timeMachine.enabled ? t(`On, limit ${data.related.timeMachine.limitGb || "none"} GB`, `已開，上限 ${data.related.timeMachine.limitGb || "冇"} GB`) : t("Off", "已關"))), link("usb-apps", t("Open USB apps", "開 USB 應用"))),
    h("div", { class: "row" }, icon("usb"), h("div", { class: "grow" }, h("div", { class: "t1" }, t("USB speed", "USB 速度")),
      h("div", { class: "t2" }, data.related.usbMode.value === "1" ? t("USB 3.0", "USB 3.0") : data.related.usbMode.value === "0" ? t("USB 2.0", "USB 2.0") : t("Not reported", "冇提供"))), link("system-pro", t("Open System tools", "開系統工具")))));
  page.append(diskCard(ctx, data));
  return undefined;
}

export default {
  id: "network-services",
  screens: [{ id: "network-services", group: { en: "Router", yue: "路由器" }, icon: "settings_ethernet", label, render: screen }],
  settings: [{ id: "network-services", icon: "settings_ethernet", label, async render(ctx) { const d = await ctx.api.get("/api/domain/network-services"); return ctx.controls.settingGroups(d.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)); } }],
  commands: [
    { id: "network-services.open", icon: "settings_ethernet", label: { en: "Open network services", yue: "開網絡服務" }, keywords: "nfs printer snmp mdns bonjour usb idle sleep 打印 磁碟", run: (ctx) => ctx.navigate("network-services") },
    { id: "network-services.health", icon: "monitor_heart", label: { en: "Check disk health", yue: "檢查磁碟健康" }, keywords: "smart disk health fsck 磁碟 健康", run: (ctx) => ctx.navigate("network-services") },
  ],
};
