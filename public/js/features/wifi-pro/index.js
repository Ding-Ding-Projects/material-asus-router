// Wi-Fi Pro screen: one tab per band, each with a status strip, quick profiles
// and a card for every group of radio settings. The basic controls come from the
// stock catalogue and the advanced ones from this feature; both are drawn by the
// same rich controls and both go through the pending-changes dock.
//
// This file imports nothing: everything it needs arrives in ctx.

const label = { en: "Wi-Fi Pro", yue: "Wi-Fi 進階" };
const lede = {
  en: "Every radio setting for each band: standards, streams, roaming, channels, timing, security extras and a schedule.",
  yue: "每個頻段嘅所有電台設定：標準、串流、漫遊、頻道、時序、保安補充同時間表。",
};

// Quick profiles: a few settings set together. Each pair is [setting, value].
const PROFILES = [
  { id: "balanced", icon: "balance", label: { en: "Balanced", yue: "平衡" }, about: { en: "Wi-Fi 6, OFDMA and airtime fairness on, roaming at -70 dBm.", yue: "開 Wi-Fi 6、OFDMA 同公平空中時間，漫遊門檻 -70 dBm。" },
    set: [["ax", "1"], ["ofdma", "3"], ["atf", "1"], ["rssi", "-70"], ["rrm", "1"], ["wnm", "1"], ["mfp", "1"]] },
  { id: "speed", icon: "bolt", label: { en: "Speed", yue: "速度" }, about: { en: "Everything that raises throughput: MU-MIMO, beamforming and OFDMA.", yue: "所有提升速度嘅設定：MU-MIMO、波束成形同 OFDMA。" },
    set: [["ax", "1"], ["ofdma", "3"], ["mumimo", "1"], ["txbf", "1"], ["itxbf", "1"], ["atf", "0"], ["bcn", "100"]] },
  { id: "range", icon: "wifi_tethering", label: { en: "Range and battery", yue: "距離同慳電" }, about: { en: "Beamforming on, quick roaming hints and a longer sleep interval for phones.", yue: "開波束成形同快速漫遊提示，手機休眠間隔加長。" },
    set: [["txbf", "1"], ["itxbf", "1"], ["rrm", "1"], ["wnm", "1"], ["rssi", "-75"], ["dtim", "3"]] },
];

const readBand = () => {
  try {
    return localStorage.getItem("wifi-pro.band");
  } catch {
    return null;
  }
};
const saveBand = (value) => {
  try {
    localStorage.setItem("wifi-pro.band", value);
  } catch {
    // Private windows may refuse storage; the screen works without it.
  }
};

const cards = (ctx, entries) => ctx.controls.settingGroups(entries).map((g) => ctx.controls.groupCard(g.label, g.entries));

async function render(ctx) {
  const { h, icon, t, tt } = ctx;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  const body = h("div", { class: "wp-body" });
  page.append(body);

  let data;
  let band = null;

  const load = async () => {
    data = await ctx.api.get("/api/domain/wifi-pro");
    if (!data.bands.some((b) => String(b.index) === band)) band = data.bands.some((b) => String(b.index) === readBand()) ? readBand() : String(data.bands[0]?.index ?? 0);
  };

  const status = (b) =>
    h("div", { class: "wp-tiles" },
      tile(t("Radio", "電台"), b.on ? t("On", "開") : t("Off", "關"), b.on ? "good" : "warn"),
      tile(t("Network name", "網絡名稱"), b.ssid || "—"),
      tile(t("Devices connected", "已連接裝置"), b.clients === null ? t("Unknown", "未知") : String(b.clients)),
      tile(t("Region", "地區"), b.region || t("Not reported", "冇回報")));

  const tile = (name, value, tone = "") => h("div", { class: `wp-tile ${tone}` }, h("div", { class: "k" }, name), h("div", { class: "wp-val" }, value));

  const profileRow = (b) =>
    h("section", { class: "card rise tone" },
      h("h2", { class: "h2" }, t("Quick profiles", "快速設定檔")),
      h("p", { class: "muted" }, t("A profile queues several changes at once. Nothing reaches the router until you review and apply them.", "設定檔會一次排好幾項改動。要你檢視同套用之後先會改到路由器。")),
      h("div", { class: "chips" },
        PROFILES.map((profile) =>
          h("button", { class: "chip", type: "button", disabled: !ctx.state.canWrite, title: tt(profile.about), onClick() {
            let queued = 0;
            for (const [name, value] of profile.set) {
              const entry = data.entries.find((e) => e.id === `wifi-pro.wl${b.index}.${name}`);
              if (!entry || entry.disabled || entry.readOnly) continue;
              ctx.dock.setEntry(entry, value);
              queued += 1;
            }
            ctx.toast(queued ? t(`${queued} changes queued. Review them in the changes bar.`, `已排咗 ${queued} 項改動。請喺改動列檢視。`) : t("Nothing to change on this band.", "呢個頻段冇嘢要改。"));
            draw();
          } }, icon(profile.icon, "sm"), tt(profile.label))),
      ));

  const progress = () => {
    const noted = data.entries.filter((e) => e.meta?.note);
    return h("section", { class: "card rise tone wp-progress" },
      h("h2", { class: "h2" }, icon("construction", "sm"), " ", t("In progress", "仲未完成")),
      h("p", { class: "muted" }, t("These are not finished or not yet proved on real hardware. They are marked here so nothing looks more certain than it is.", "以下項目未完成，或者未喺真機證實過。特登標示出嚟，免得睇落比實際更肯定。")),
      h("ul", { class: "wp-list" },
        h("li", {}, h("strong", {}, t("WPA Enterprise sign-in", "WPA 企業登入")), " ", t("The RADIUS address, port and secret can be set above, but choosing Enterprise as the security mode is not available yet, so it cannot lock you out.", "上面可以設 RADIUS 地址、連接埠同密碼，但暫時未能揀企業模式做保安模式，所以唔會鎖死你。")),
        h("li", {}, h("strong", {}, t("Smart Connect steering rules", "Smart Connect 引導規則")), " ", t("You can switch the mode, but the signal and load thresholds behind it are not editable yet.", "可以轉模式，但背後嘅訊號同負載門檻暫時未能編輯。")),
        h("li", {}, h("strong", {}, t("Regulatory region", "法規地區")), " ", t("Shown for reference only. The firmware decides it.", "只供參考，由韌體決定。")),
        h("li", {}, h("strong", {}, t(`Settings to confirm on your model: ${noted.length}`, `要喺你部型號確認嘅設定：${noted.length}`)),
          h("details", {}, h("summary", {}, t("Show which ones", "睇邊啲")),
            h("ul", { class: "wp-list" }, noted.map((e) => h("li", {}, tt(e.label), " ", h("span", { class: "mono t2" }, e.key), " ", h("span", { class: "t2" }, tt(e.meta.note)))))))));
  };

  const draw = () => {
    ctx.clear(body);
    const smart = data.entries.filter((e) => e.id === "wifi-pro.smart-connect");
    const tabs = h("div", { class: "seg", role: "radiogroup", "aria-label": t("Choose a band", "揀頻段") },
      data.bands.map((b) =>
        h("button", { role: "radio", "aria-checked": String(String(b.index) === band), class: String(b.index) === band ? "on" : "", onClick() { band = String(b.index); saveBand(band); draw(); } }, tt(b.label))));
    body.append(tabs);
    const b = data.bands.find((x) => String(x.index) === band);
    if (!b) return body.append(h("div", { class: "note warn" }, icon("wifi_off"), t("This router reports no Wi-Fi bands.", "呢部路由器冇回報任何 Wi-Fi 頻段。")));
    const prefix = `band${b.index}-`;
    const basic = data.stock.filter((e) => e.id.startsWith(`wl${b.index}.`));
    body.append(
      status(b),
      profileRow(b),
      ...(basic.length ? [ctx.controls.groupCard({ en: `${tt0(b.label)}: basics`, yue: `${b.label.yue}：基本` }, basic)] : []),
      ...cards(ctx, data.entries.filter((e) => e.group.startsWith(prefix))),
      ...(smart.length ? cards(ctx, smart) : []),
      progress(),
    );
  };
  const tt0 = (pair) => pair.en;

  try {
    await load();
    draw();
  } catch (error) {
    body.append(h("div", { class: "note bad" }, icon("error"), error.message));
    return undefined;
  }
  // After a change is applied the values on screen must be the router's again.
  return ctx.bus.on("changed", async () => {
    try {
      await load();
      draw();
    } catch {
      // The next navigation will show the problem.
    }
  });
}

export default {
  id: "wifi-pro",

  screens: [{ id: "wifi-pro", group: { en: "Network", yue: "網絡" }, icon: "tune", label, render }],

  settings: [
    {
      id: "wifi-pro",
      icon: "tune",
      label,
      async render(ctx) {
        const data = await ctx.api.get("/api/domain/wifi-pro");
        return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries));
      },
    },
  ],

  commands: [
    { id: "wifi-pro.open", icon: "tune", label: { en: "Open Wi-Fi Pro", yue: "開啟 Wi-Fi 進階" }, keywords: "wifi wireless radio ofdma beamforming roaming dfs beacon dtim channel", run: (ctx) => ctx.navigate("wifi-pro") },
    { id: "wifi-pro.schedule", icon: "schedule", label: { en: "Wi-Fi schedule", yue: "Wi-Fi 時間表" }, keywords: "wifi schedule timer off night", run: (ctx) => ctx.navigate("wifi-pro") },
  ],
};
