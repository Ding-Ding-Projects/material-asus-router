// WPS and MAC filter screen. Per band: the filter mode and list with a lock-out
// warning that follows the queued edits, and the band's WPS switch. Router wide:
// the WPS master switch, the hidden device PIN and the push-button action.
import { maclistControl, parseList } from "./maclist.js";

const label = { en: "WPS and MAC filter", yue: "WPS 同 MAC 過濾" };
const lede = {
  en: "Choose which devices may join each band, and control the WPS button and PIN.",
  yue: "揀邊啲裝置可以連入每個頻段，同埋管理 WPS 按掣同 PIN。",
};

const bandText = (nband) => ({ 2: "2.4 GHz", 1: "5 GHz", 4: "6 GHz" })[nband] ?? "Wi-Fi";
const WINDOW_SECONDS = 120;

async function render(ctx) {
  const { h, icon, t } = ctx;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  const body = h("div", { class: "wm-body" });
  page.append(body);
  let data;
  let timer = null;
  const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

  const load = async () => { data = await ctx.api.get("/api/domain/wifi-wps-macfilter"); };
  const entry = (id) => data.entries.find((e) => e.id === id);
  const pending = (e) => (ctx.dock.has(e.id) ? ctx.dock.value(e.id) : e.value);

  // The warning follows what is queued, not just what the router has now.
  const warning = (b) => {
    const mode = entry(`wifi-wps-macfilter.wl${b.index}.macmode`);
    const list = entry(`wifi-wps-macfilter.wl${b.index}.maclist`);
    const box = h("div", { class: "note warn", hidden: true }, icon("warning"), h("span", {}));
    const update = () => {
      const m = pending(mode);
      const items = parseList(pending(list));
      const text = m === "allow" && items.length === 0
        ? t("Allow-only with an empty list refuses every device, including this one. Add a device first.", "「淨係容許名單」配空名單會拒絕所有裝置，包括你呢部。請先加入裝置。")
        : m === "allow" ? t(`Only the ${items.length} listed devices can join. Make sure the device you are using is on the list.`, `淨係名單上嘅 ${items.length} 部裝置連到。請確認你而家用緊嘅裝置喺名單入面。`)
        : m === "deny" && items.length ? t(`${items.length} devices on the list will be refused.`, `名單上嘅 ${items.length} 部裝置會被拒絕。`) : "";
      box.hidden = !text;
      box.lastChild.textContent = text;
    };
    update();
    return { box, update };
  };

  const bandCard = (b) => {
    const mode = entry(`wifi-wps-macfilter.wl${b.index}.macmode`);
    const list = entry(`wifi-wps-macfilter.wl${b.index}.maclist`);
    const wps = entry(`wifi-wps-macfilter.wl${b.index}.wps`);
    const warn = warning(b);
    const card = ctx.controls.groupCard({ en: `${bandText(b.nband)}: MAC filter`, yue: `${bandText(b.nband)}：MAC 過濾` }, [mode, list]);
    card.insertBefore(warn.box, card.children[1] ?? null);
    const off = ctx.bus.on("dock", warn.update);
    cleanups.push(off);
    return [card, ...(wps ? [ctx.controls.groupCard({ en: `${bandText(b.nband)}: WPS`, yue: `${bandText(b.nband)}：WPS` }, [wps])] : [])];
  };

  const wpsCard = () => {
    const enable = entry("wifi-wps-macfilter.enable");
    const pin = entry("wifi-wps-macfilter.pin");
    const countdown = h("div", { class: "wm-count", role: "status", "aria-live": "polite" });
    const start = h("button", { class: "btn f", type: "button", disabled: !ctx.state.canWrite || !data.wps.enabled, async onClick() {
      start.disabled = true;
      try {
        const out = await ctx.api.post("/api/actions/wifi-wps-macfilter.push-button");
        ctx.toast(out.message || t("WPS pairing started.", "WPS 配對已啟動。"), out.ok ? "good" : "warn");
        if (out.ok) {
          let left = WINDOW_SECONDS;
          stopTimer();
          const tick = () => { countdown.textContent = left > 0 ? t(`Pairing window open: ${left} s left.`, `配對時間仲開住：剩 ${left} 秒。`) : t("The pairing window has closed.", "配對時間已經完結。"); if (left-- <= 0) { stopTimer(); start.disabled = !data.wps.enabled; } };
          tick();
          timer = setInterval(tick, 1000);
          return;
        }
      } catch (error) {
        ctx.toast(error.message, "bad");
      }
      start.disabled = !data.wps.enabled;
    } }, icon("touch_app", "sm"), t("Start WPS pairing", "開始 WPS 配對"));
    const card = ctx.controls.groupCard({ en: "WPS", yue: "WPS" }, [enable, pin]);
    card.append(
      h("div", { class: "wm-push" }, start, h("span", { class: "tag warn", title: t("The start command is proved against the pretend router only.", "啟動指令只喺模擬路由器證實過。") }, icon("construction", "sm"), t("Confirm on your model", "請喺你部型號確認"))),
      data.wps.enabled ? null : h("div", { class: "t2" }, t("WPS is switched off, so pairing cannot start.", "WPS 已關閉，配對唔能開始。")),
      countdown);
    return card;
  };

  const progress = () =>
    h("section", { class: "card rise tone" },
      h("h2", { class: "h2" }, icon("construction", "sm"), " ", t("In progress", "仲未完成")),
      h("ul", { class: "wm-list" },
        h("li", {}, t("The WPS start command and the per-band WPS setting name are proved against the pretend router only. Confirm them on your model before relying on them.", "WPS 啟動指令同每個頻段嘅 WPS 設定名稱只喺模擬路由器證實過。請喺你部型號確認先好依賴。")),
        h("li", {}, t("WPS pairing results (which device joined) are not reported back here yet. Check the Devices screen afterwards.", "WPS 配對結果（邊部裝置連咗入）暫時未回報。之後請睇「裝置」畫面。"))));

  const cleanups = [];
  const draw = () => {
    cleanups.splice(0).forEach((fn) => fn());
    ctx.clear(body);
    body.append(...data.bands.flatMap(bandCard), wpsCard(), progress());
  };

  try {
    await load();
    draw();
  } catch (error) {
    body.append(h("div", { class: "note bad" }, icon("error"), error.message));
    return undefined;
  }
  const off = ctx.bus.on("changed", async () => {
    try {
      await load();
      draw();
    } catch {
      // The next navigation will show the problem.
    }
  });
  return () => { off(); stopTimer(); cleanups.splice(0).forEach((fn) => fn()); };
}

export default {
  id: "wifi-wps-macfilter",

  screens: [{ id: "wifi-wps-macfilter", group: { en: "Network", yue: "網絡" }, icon: "filter_alt", label, render }],

  // The router's MAC list as a control of its own.
  controls: { "wifi-maclist": maclistControl },

  settings: [
    {
      id: "wifi-wps-macfilter",
      icon: "filter_alt",
      label,
      async render(ctx) {
        const data = await ctx.api.get("/api/domain/wifi-wps-macfilter");
        return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries));
      },
    },
  ],

  commands: [
    { id: "wifi-wps-macfilter.open", icon: "filter_alt", label: { en: "Open WPS and MAC filter", yue: "開啟 WPS 同 MAC 過濾" }, keywords: "wps mac filter allow block whitelist blacklist device", run: (ctx) => ctx.navigate("wifi-wps-macfilter") },
    { id: "wifi-wps-macfilter.pair", icon: "touch_app", label: { en: "Start WPS pairing", yue: "開始 WPS 配對" }, keywords: "wps button pair push", run: (ctx) => ctx.navigate("wifi-wps-macfilter") },
  ],
};

