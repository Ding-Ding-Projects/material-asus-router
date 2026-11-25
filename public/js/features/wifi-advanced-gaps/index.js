// Wi-Fi 7 and operation mode screen. Smart Connect is shown (never edited), the
// 6 GHz lock and the Wi-Fi 7 gate say what this router really has, and the
// operation mode changes only behind the model typed, a held button, a restart
// and a live timeline that runs until the router answers and its mode reads back.
import { timeline } from "./timeline.js";

const label = { en: "Wi-Fi 7 and operation mode", yue: "Wi-Fi 7 同運作模式" };
const API = "/api/x/wifi-advanced-gaps";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const HOLD_MS = 1500;

const SMART = {
  "0": [{ en: "Off", yue: "關" }, { en: "Each band keeps its own network name.", yue: "每個頻段保留自己嘅網絡名稱。" }, false],
  "1": [{ en: "All bands share one name", yue: "所有頻段共用一個名" }, { en: "Devices are steered to the band that suits them.", yue: "裝置會被引導去最適合佢哋嘅頻段。" }, true],
  "2": [{ en: "5 GHz bands share one name", yue: "5 GHz 頻段共用一個名" }, { en: "Only the 5 GHz bands are joined; 2.4 GHz stays separate.", yue: "淨係合併 5 GHz 頻段；2.4 GHz 保持獨立。" }, true],
};

const MODE_ICON = { router: "router", ap: "wifi_tethering", repeater: "cell_tower", bridge: "settings_ethernet", "aimesh-node": "hub" };
const MODE_TEXT = {
  router: [{ en: "Wireless router", yue: "無線路由器" }, { en: "The normal mode: this device connects to the internet, shares out addresses and runs the firewall.", yue: "正常模式：呢部裝置連接互聯網、分配地址同行防火牆。" }],
  ap: [{ en: "Access point", yue: "接入點" }, { en: "Joins another router by cable and only adds Wi-Fi. The other router keeps doing the routing.", yue: "用網線接去另一部路由器，淨係加 Wi-Fi。路由由另一部繼續做。" }],
  repeater: [{ en: "Repeater", yue: "中繼器" }, { en: "Joins another router over Wi-Fi and repeats it further. Speed drops by about half, so it is a last resort.", yue: "用 Wi-Fi 接去另一部路由器再擴展覆蓋。速度大約減半，所以係最後手段。" }],
  bridge: [{ en: "Media bridge", yue: "媒體橋接" }, { en: "Joins another router over Wi-Fi and hands the connection to wired devices such as a television or a console.", yue: "用 Wi-Fi 接去另一部路由器，再用網線交俾電視或遊戲機等有線裝置。" }],
  "aimesh-node": [{ en: "AiMesh node", yue: "AiMesh 節點" }, { en: "Becomes a node of another AiMesh router. You then add it from that router's own AiMesh page.", yue: "變成另一部 AiMesh 路由器嘅節點。之後要喺嗰部路由器嘅 AiMesh 頁面加入。" }],
};
const nameOf = (ctx, id) => ctx.tt(MODE_TEXT[id]?.[0] ?? { en: id, yue: id });

// The two keys every destructive action needs: the router model typed exactly and a button held down.
// Resolves { confirm, hold } or null. (Each feature keeps its own copy: a folder may not import another.)
function superConfirm(ctx, { title, body, action, model }) {
  const { h, icon, t, openDialog } = ctx;
  let typed = "";
  let held = false;
  let timer = null;
  const dialog = openDialog((close) => {
    const bar = h("i", {});
    const go = h("button", { class: "btn d", disabled: true, onClick: () => close({ confirm: typed, hold: true }) }, icon("restart_alt", "sm"), action);
    const ready = () => (go.disabled = !(held && typed === model));
    const start = () => {
      if (timer || held) return;
      const begun = Date.now();
      timer = setInterval(() => {
        const share = Math.min(1, (Date.now() - begun) / HOLD_MS);
        bar.style.setProperty("--w", `${share * 100}%`);
        if (share >= 1) {
          held = true;
          clearInterval(timer);
          timer = null;
          ready();
        }
      }, 50);
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
      if (!held) bar.style.setProperty("--w", "0%");
    };
    const key = (fn) => (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        fn();
      }
    };
    return [
      h("h2", { class: "h2" }, title),
      h("p", { class: "muted" }, body),
      h("div", { class: "note warn" }, icon("warning"), h("div", {}, t(`Type the router model, ${model}, then press and hold the button. The router restarts.`, `輸入路由器型號 ${model}，然後撳住個掣。路由器會重啟。`))),
      h("input", { class: "field", "aria-label": t("Router model", "路由器型號"), placeholder: model, autocomplete: "off", spellcheck: "false", onInput: (e) => { typed = e.target.value.trim(); ready(); } }),
      h("button", { class: "btn t hold", type: "button", "aria-label": t("Press and hold to unlock", "撳住解鎖"), onPointerdown: start, onPointerup: stop, onPointerleave: stop, onKeydown: key(start), onKeyup: key(stop) }, bar, icon("touch_app", "sm"), t("Press and hold", "撳住")),
      h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(null) }, t("Cancel", "取消")), go),
    ];
  }, { label: title });
  return dialog.closed.then((value) => {
    clearInterval(timer);
    return value ?? null;
  });
}

// Shows what will change, applies it, and keeps a live timeline going until the router answers
// again and the mode reads back (or the safety timer has put the old mode back).
function applyWithTimeline(ctx, { preview, target, targetValue, from }) {
  const { api, h, icon, t, openDialog } = ctx;
  let phase = "review";
  let result = null;
  let tl = null;
  const diff = () => preview.items.map((i) => h("div", { class: "diff" }, h("div", {}, h("div", { class: "t1" }, i.key)), h("div", { class: "was" }, String(i.old ?? "")), h("div", { class: "arrow" }, icon("arrow_forward", "sm")), h("div", { class: "now" }, String(i.new ?? ""))));

  async function run(render) {
    phase = "running";
    tl = timeline(ctx, [{ en: "Saved on the router", yue: "已儲存喺路由器" }, { en: "Router restarting", yue: "路由器重啟緊" }, { en: "Waiting for the router to answer", yue: "等路由器回應" }, { en: "Reading the mode back", yue: "讀返而家個模式" }]);
    render();
    tl.set(0, "work");
    try {
      let record = await api.post("/api/changes/apply", { previewId: preview.id });
      tl.set(0, "done");
      tl.set(1, "work");
      let offline = false;
      const deadline = Date.now() + (preview.guard?.seconds ?? 90) * 1500 + 60000;
      while ((record.status === "guarded" || record.status === "applying") && Date.now() < deadline) {
        await sleep(1500);
        const live = await api.get(`${API}/mode`).catch(() => null);
        if (!live && !offline) {
          offline = true;
          tl.set(1, "done", t("The router went quiet.", "路由器靜咗。").toString());
          tl.set(2, "work", t("Still waiting. The safety timer restores the old mode if it never returns.", "仲等緊。如果佢一直唔返嚟，安全計時器會還原舊模式。").toString());
        }
        record = await api.get(`/api/changes/history/${record.id}`).catch(() => record);
      }
      tl.set(1, "done");
      tl.set(2, record.status === "unreachable" ? "bad" : "done", record.status === "unreachable" ? t("The router did not come back in time.", "路由器喺限時內冇返嚟。").toString() : "");
      tl.set(3, "work");
      const live = await api.get(`${API}/mode`).catch(() => null);
      if (record.status === "applied" && live?.value === targetValue) tl.set(3, "done", t(`The router reports ${nameOf(ctx, target)}.`, `路由器報告：${nameOf(ctx, target)}。`).toString());
      else tl.set(3, "bad", record.status === "reverted-by-guard" ? t("The safety net put the old mode back.", "安全機制已經還原舊模式。").toString() : t("The mode could not be read back as expected.", "讀返個模式同預期唔同。").toString());
      result = { record, live, ok: record.status === "applied" && live?.value === targetValue };
      if (result.ok) ctx.bus.emit("changed");
    } catch (error) {
      tl.set(0, "bad", error.message);
      result = { error, ok: false };
    }
    tl.finish();
    phase = "done";
    render();
  }

  return openDialog((close, render) => {
    const heading = h("h2", { class: "h2" }, t(`Switch to ${nameOf(ctx, target)}`, `轉做${nameOf(ctx, target)}`));
    if (phase === "review")
      return [
        heading,
        h("div", {}, diff()),
        h("div", { class: "note warn" }, icon("shield"), h("div", {}, t(`The router restarts. If this app cannot reach it ${preview.guard?.seconds ?? 90} seconds after it comes back, the safety timer puts ${nameOf(ctx, from)} mode back by itself. Switching often changes the router address, so the safety timer may undo it; note the new address first.`, `路由器會重啟。佢返嚟之後 ${preview.guard?.seconds ?? 90} 秒內，如果呢個程式連唔到，安全計時器會自動還原做${nameOf(ctx, from)}。轉模式通常會改變路由器地址，所以安全計時器可能會還原；請先記低新地址。`))),
        h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: "btn d", onClick: () => run(render) }, icon("restart_alt", "sm"), t("Restart and switch", "重啟並轉模式"))),
      ];
    return [
      heading,
      h("div", { class: "wag-live" }, h("div", { class: "wag-pulse", "aria-hidden": "true" }, h("i", {}), h("i", {}), h("i", {})), tl.el),
      h("div", { class: "t2" }, t("Time so far: ", "已用時間："), tl.clock),
      phase === "done" && result?.ok ? h("div", { class: "note" }, icon("check_circle"), h("div", {}, t("Done. The router is back and reports the new mode.", "完成。路由器已返嚟，並報告新模式。"))) : null,
      phase === "done" && !result?.ok ? h("div", { class: "note bad" }, icon("error"), h("div", {}, result?.error?.message ?? t("The new mode is not in place. Check the router, then refresh this screen.", "新模式未生效。請檢查路由器，再重新整理呢個畫面。"))) : null,
      h("div", { class: "actions" }, h("button", { class: "btn f", disabled: phase !== "done", onClick: () => close(Boolean(result?.ok)) }, t("Done", "完成"))),
    ];
  }, { label: t("Switch operation mode", "轉運作模式") });
}

function smartCard(ctx, data) {
  const { h, icon, t } = ctx;
  const s = data.smartConnect;
  const [name, about, merged] = SMART[s.value] ?? SMART["0"];
  return h("section", { class: "card rise" },
    h("div", { class: "row" }, icon("alt_route"), h("h2", { class: "h2 grow" }, t("Smart Connect", "Smart Connect"))),
    !s.supported
      ? h("div", { class: "note" }, icon("info"), h("div", {}, t("This router does not support Smart Connect.", "呢部路由器唔支援 Smart Connect。")))
      : h("div", { class: "wag-sc" },
          h("div", { class: `wag-bands ${merged ? "merged" : ""}`, "aria-hidden": "true" }, ...s.bands.map((b) => h("span", { class: "pill p wag-chip" }, icon("wifi", "sm"), b.band))),
          h("div", { class: "big wag-name" }, ctx.tt(name)),
          h("div", { class: "t2" }, ctx.tt(about)),
          h("div", { class: "t2" }, s.triBand ? t("This router has three bands, so steering can use all of them.", "呢部路由器有三個頻段，引導可以用晒。") : t("This router has two bands.", "呢部路由器有兩個頻段。")),
          h("div", { class: "chips" }, h("button", { class: "btn t sm", onClick: () => ctx.navigate("wifi-pro") }, icon("tune", "sm"), t("Change it in Wi-Fi Pro", "喺 Wi-Fi 進階更改"))),
          s.details.length
            ? h("details", { class: "wag-details" },
                h("summary", {}, t("Steering details (read only)", "引導細節（只讀）")),
                h("div", { class: "t2" }, t("These rules belong to the router's own steering daemon. They are shown for reference and cannot be edited here.", "呢啲規則屬於路由器自己嘅引導程式。只供參考，呢度改唔到。")),
                h("dl", { class: "wag-dl" }, s.details.flatMap(([k, v]) => [h("dt", { class: "mono" }, k), h("dd", { class: "mono" }, v || "—")])))
            : null));
}

function sixCard(ctx, data) {
  const { h, icon, t } = ctx;
  const six = data.sixGhz;
  const mlo = data.entries.filter((e) => e.group === "wifi7");
  return h("section", { class: "card rise" },
    h("div", { class: "row" }, icon("lock"), h("h2", { class: "h2 grow" }, t("6 GHz and Wi-Fi 7", "6 GHz 同 Wi-Fi 7"))),
    !six.present
      ? h("div", { class: "note" }, icon("info"), h("div", {}, t("This router has no 6 GHz radio, so there is nothing to lock. 6 GHz only allows WPA3.", "呢部路由器冇 6 GHz 電台，所以冇嘢需要鎖。6 GHz 淨係准用 WPA3。")))
      : h("div", { class: "wag-locks" }, ...six.bands.map((b, i) =>
          h("div", { class: `wag-lock ${b.wpa3 ? "ok" : "warn"}`, },
            h("span", { class: "wag-lockicon" }, icon(b.wpa3 ? "lock" : "lock_open", "lg")),
            h("div", { class: "grow" },
              h("div", { class: "t1" }, `${b.ssid || "6 GHz"} · 6 GHz`),
              h("div", { class: "t2" }, b.wpa3 ? t("WPA3-Personal is set. This is the only security 6 GHz accepts.", "已設定 WPA3-Personal。6 GHz 淨係接受呢種保安。") : t(`This band is set to ${b.auth || "unknown"}. 6 GHz needs WPA3-Personal, so devices cannot join until it is changed.`, `呢個頻段而家係 ${b.auth || "未知"}。6 GHz 需要 WPA3-Personal，改咗之前裝置連唔到。`))),
            b.wpa3 ? null : h("button", { class: "btn t sm", onClick: () => ctx.navigate("wifi") }, icon("wifi", "sm"), t("Fix on the Wi-Fi screen", "去 Wi-Fi 畫面改"))))),
    h("div", { class: `note ${data.wifi7.capable ? "" : "warn"}` }, icon(data.wifi7.capable ? "bolt" : "block"), h("div", {}, data.wifi7.capable ? t("This router reports Wi-Fi 7.", "呢部路由器報告有 Wi-Fi 7。") : t("This router does not report Wi-Fi 7, so the Wi-Fi 7 setting below stays off.", "呢部路由器冇報告 Wi-Fi 7，所以下面嘅 Wi-Fi 7 設定保持停用。"))),
    ...ctx.controls.settingGroups(mlo).map((g) => ctx.controls.groupCard(g.label, g.entries)));
}

function modeCard(ctx, data, refresh) {
  const { h, icon, t } = ctx;
  const view = data.mode;
  let picked = view.modes.find((m) => m.available)?.id ?? view.current;
  const tiles = h("div", { class: "wag-modes", role: "radiogroup", "aria-label": t("Operation mode", "運作模式") });
  const detail = h("div", { class: "wag-detail", "aria-live": "polite" });

  function draw() {
    ctx.clear(tiles);
    view.modes.forEach((m, i) => {
      const on = m.id === picked;
      const here = m.id === view.current;
      const tile = h("button", { class: `wag-tile ${on ? "on" : ""} ${here ? "here" : ""} ${m.available || here ? "" : "off"}`, role: "radio", "aria-checked": String(on), onClick: () => { picked = m.id; draw(); } },
        icon(MODE_ICON[m.id] ?? "router", "lg"),
        h("span", { class: "wag-tname" }, nameOf(ctx, m.id)),
        here ? h("span", { class: "pill p wag-tag" }, icon("check", "sm"), t("Now", "而家")) : m.available ? null : h("span", { class: "pill t wag-tag" }, icon("block", "sm"), t("Unavailable", "用唔到")));
      tile.style.setProperty("--i", String(i));
      tiles.append(tile);
    });
    const m = view.modes.find((x) => x.id === picked);
    ctx.clear(detail);
    if (!m) return;
    detail.append(
      h("div", { class: "t1" }, nameOf(ctx, m.id)),
      h("div", { class: "t2" }, ctx.tt(MODE_TEXT[m.id]?.[1] ?? { en: "", yue: "" })),
      m.available ? null : h("div", { class: "note warn" }, icon(m.already ? "check_circle" : "block"), h("div", {}, ctx.tt(m.reason))),
      ...(m.available ? m.warnings.map((w) => h("div", { class: "note warn wag-warn" }, icon("warning"), h("div", {}, ctx.tt(w)))) : []),
      h("div", { class: "chips" },
        h("button", { class: "btn d", disabled: !m.available || !ctx.state.canWrite, onClick: () => start(m) }, icon("restart_alt", "sm"), t(`Switch to ${nameOf(ctx, m.id)}`, `轉做${nameOf(ctx, m.id)}`)),
        ctx.state.canWrite ? null : h("span", { class: "muted" }, t("Only the owner and editors can change the mode.", "淨係擁有者同編輯者先可以轉模式。"))));
  }

  async function start(m) {
    const keys = await superConfirm(ctx, {
      title: t(`Switch to ${nameOf(ctx, m.id)}?`, `轉做${nameOf(ctx, m.id)}？`),
      body: t("This restarts the router and changes how it works. Everything connected loses its connection for a few minutes, and the router may get a new address.", "呢個動作會重啟路由器並改變佢嘅運作方式。所有連住嘅裝置會斷線幾分鐘，而路由器可能會有新地址。"),
      action: t("Continue", "繼續"),
      model: view.model,
    });
    if (!keys) return;
    let preview;
    try {
      preview = await ctx.api.post("/api/actions/wifi-advanced-gaps.set-mode", { mode: m.id, ...keys });
    } catch (error) {
      return ctx.toast(error.message, "bad");
    }
    const value = preview.items.find((i) => i.key === "sw_mode")?.new ?? "";
    await applyWithTimeline(ctx, { preview, target: m.id, targetValue: value, from: view.current }).closed;
    refresh();
  }

  draw();
  return h("section", { class: "card rise wag-mode" },
    h("div", { class: "row" }, icon("swap_horiz"), h("h2", { class: "h2 grow" }, t("Operation mode", "運作模式"))),
    h("div", { class: "note bad" }, icon("warning"), h("div", {}, t("Changing the operation mode restarts the router and can make it unreachable at its old address. It needs the router model typed and a held button, and a safety timer puts the old mode back if the router does not answer.", "轉運作模式會重啟路由器，亦可能令舊地址連唔到。需要輸入路由器型號同撳住個掣，而如果路由器冇回應，安全計時器會還原舊模式。"))),
    tiles, detail);
}

async function screen(ctx) {
  const { api, h, t } = ctx;
  const page = ctx.page(label, { en: "Smart Connect, the 6 GHz and Wi-Fi 7 rules, and the router's operation mode.", yue: "Smart Connect、6 GHz 同 Wi-Fi 7 嘅規則，仲有路由器嘅運作模式。" });
  ctx.root.append(page);
  const holder = h("div", { class: "wag-stack" });
  page.append(holder);
  let alive = true;
  async function load() {
    const data = await api.get("/api/domain/wifi-advanced-gaps");
    if (!alive) return;
    ctx.clear(holder).append(smartCard(ctx, data), sixCard(ctx, data), modeCard(ctx, data, load));
  }
  await load();
  const off = ctx.bus.on("changed", () => alive && load().catch(() => {}));
  return () => {
    alive = false;
    off?.();
  };
}

export default {
  id: "wifi-advanced-gaps",
  screens: [{ id: "wifi-advanced-gaps", group: { en: "Network", yue: "網絡" }, icon: "settings_input_antenna", label, render: screen }],
  settings: [{ id: "wifi-advanced-gaps", icon: "settings_input_antenna", label, async render(ctx) { const data = await ctx.api.get("/api/domain/wifi-advanced-gaps"); return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries)); } }],
  commands: [
    { id: "wifi-advanced-gaps.open", icon: "settings_input_antenna", label: { en: "Open Wi-Fi 7 and operation mode", yue: "打開 Wi-Fi 7 同運作模式" }, keywords: "smart connect 6ghz wifi7 mlo mode access point repeater bridge mesh node 運作模式 接入點 中繼", run: (ctx) => ctx.navigate("wifi-advanced-gaps") },
  ],
};
