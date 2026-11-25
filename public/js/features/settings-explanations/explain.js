// The full explanation of one setting, built from the entry itself. No imports.
// Every explanation names the setting's own label, group, router key, limits
// and consequences, so no two settings share the same text, and it includes a
// provenance line saying whether the value is written on the router or the
// firmware's built-in default applies.

const pair = (en, yue) => ({ en, yue });

const SERVICES = {
  restart_wireless: pair("the Wi-Fi radios", "Wi-Fi 無線電"),
  restart_dnsmasq: pair("address handout and DNS", "派地址同 DNS"),
  restart_firewall: pair("the firewall", "防火牆"),
  restart_httpd: pair("the router web page", "路由器網頁"),
  restart_time: pair("the clock", "時鐘"),
};

// limits: the pair of sentences that describe the allowed values (from the guidance engine).
export function explainEntry(entry, limits = null) {
  const L = entry.label;
  const where = entry.groupLabel ? pair(` in ${entry.groupLabel.en}`, `（${entry.groupLabel.yue}）`) : pair("", "");
  const summary = pair(`${L.en}${where.en}: ${entry.help.en}`, `${L.yue}${where.yue}：${entry.help.yue}`);
  const details = [];
  if (limits) details.push(pair(`What you can enter: ${limits.en}`, `可以輸入：${limits.yue}`));
  if (entry.optional) details.push(pair("This setting is optional and can be left empty.", "呢項設定係可選，可以留空。"));
  if (entry.secret) details.push(pair("This is a secret. It is masked everywhere and never appears in a preview or the change history.", "呢項係機密，所有地方都會遮住，預覽同變更記錄都唔會顯示。"));
  if (entry.risk === "network") details.push(pair("Changing it can interrupt connections for a moment, so it is applied with the safety net and rolls back by itself if you lose the router.", "改呢項可能短暫中斷連線，所以會用安全機制套用，連唔返路由器就會自動還原。"));
  if (entry.risk === "destructive") details.push(pair("Changing it is destructive and needs a typed confirmation and a held button.", "改呢項有破壞性，要輸入確認同長按按鈕。"));
  if (entry.restart) {
    const s = SERVICES[entry.restart];
    details.push(pair(`After you apply it, ${s ? s.en : entry.restart} restarts so the change takes effect.`, `套用之後，${s ? s.yue : entry.restart}會重啟，改動先會生效。`));
  }
  if (entry.disabled) details.push(pair(`Unavailable here: ${entry.disabled.en}`, `呢度用唔到：${entry.disabled.yue}`));
  if (entry.readOnly) details.push(pair("This value is shown for reference and is never written.", "呢個值只作參考，唔會被寫入。"));
  details.push(pair("Every change waits in the changes bar, shows a before-and-after preview, and can be undone from the change history.", "每項改動都會等喺改動列，有前後對比預覽，仲可以喺變更記錄還原。"));
  const written = entry.secret ? Boolean(entry.hasValue) : String(entry.value ?? "") !== "";
  const provenance = written
    ? pair(`Source: written on the router as ${entry.key} (kept in its nvram and saved to flash when applied).${entry.secret ? "" : ` Current value: ${entry.value}.`}`, `來源：已經寫入路由器嘅 ${entry.key}（存喺 nvram，套用時存入快閃記憶體）。${entry.secret ? "" : ` 目前值：${entry.value}。`}`)
    : pair(`Source: ${entry.key} is not written on this router, so the firmware's built-in default applies. This app cannot read that default until a value is saved.`, `來源：呢部路由器未寫入 ${entry.key}，所以用緊韌體內置預設值。儲存咗數值之前，本程式讀唔到呢個預設值。`);
  return { summary, details, provenance };
}

// The whole text of one explanation, used by the inventory test to prove that
// every setting has one and that none repeats another.
export const flatten = (x) => [x.summary.en, ...x.details.map((d) => d.en), x.provenance.en, `[${x.key ?? ""}]`].join(" ");
