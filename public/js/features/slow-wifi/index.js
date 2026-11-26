// "My Wi-Fi is slow": reads the router, lists what is slowing Wi-Fi down and
// offers a fix for each one. A fix never writes to the router from here: it
// queues the settings in the pending-changes dock, so the person reviews them
// and the change engine previews, confirms, applies, verifies and can undo them.
// "Fix everything" queues every fix at once, for one review.
//
// This file imports nothing shared: everything arrives in ctx.

const label = { en: "My Wi-Fi is slow", yue: "我部 Wi-Fi 好慢" };
const lede = { en: "Checks the router for what slows Wi-Fi down and fixes it, with a review before anything changes.", yue: "檢查路由器有咩拖慢 Wi-Fi 並且修正，改任何嘢之前都會俾你檢查。" };

// Queue a finding's changes in the dock. Returns how many were queued and which settings were missing.
export function queueFix(ctx, finding) {
  const entries = ctx.state.catalog?.entries ?? [];
  const missing = [];
  let queued = 0;
  for (const change of finding.fix?.changes ?? []) {
    const entry = entries.find((e) => e.id === change.id);
    if (!entry || entry.disabled) {
      missing.push(change.id);
      continue;
    }
    ctx.dock.setEntry(entry, change.value);
    queued += 1;
  }
  return { queued, missing };
}

const fmt = (v, unit) => (v === null || v === undefined ? "—" : `${v}${unit}`);

function bandCard(ctx, b) {
  const { h, icon, t } = ctx;
  const level = !b.on ? "bad" : (b.busy ?? 0) >= 70 ? "bad" : (b.busy ?? 0) >= 50 ? "warn" : "good";
  return h("div", { class: `sw-band ${level}` },
    h("div", { class: "sw-band-head" }, icon(b.on ? "wifi" : "wifi_off", "sm"), h("b", {}, b.band), h("span", { class: "t2 sw-ssid" }, b.ssid)),
    b.on
      ? h("dl", { class: "sw-stats" },
          h("dt", {}, t("Air busy", "空中繁忙")), h("dd", {}, fmt(b.busy, "%")),
          h("dt", {}, t("Devices", "裝置")), h("dd", {}, String(b.devices)),
          h("dt", {}, t("Weak signal", "訊號弱")), h("dd", {}, String(b.weak)),
          h("dt", {}, t("Noise", "噪音")), h("dd", {}, fmt(b.noise, " dBm")),
          h("dt", {}, t("Radio", "無線電")), h("dd", {}, fmt(b.temperature, " °C")))
      : h("div", { class: "t2" }, t("Switched off", "已關閉")));
}

function findingCard(ctx, f, after) {
  const { h, icon, t, tt } = ctx;
  const problem = f.kind === "problem";
  const actions = h("div", { class: "sw-acts" });
  const locked = !ctx.state.canWrite;
  if (f.fix?.changes) {
    const btn = h("button", {
      class: "btn f sm",
      disabled: locked,
      title: locked ? t("Viewers cannot change the router.", "檢視者唔可以改路由器。") : undefined,
      onClick() {
        const { queued, missing } = queueFix(ctx, f);
        if (queued) {
          btn.disabled = true;
          btn.replaceChildren(icon("pending_actions", "sm"), t("Waiting in pending changes", "喺待處理變更度等緊"));
          ctx.toast(t(`${queued} setting${queued === 1 ? "" : "s"} sent to the pending changes bar.`, `已將 ${queued} 個設定送去待處理變更列。`), "good");
        }
        if (missing.length) ctx.toast(t(`This router could not take: ${missing.join(", ")}.`, `呢部路由器用唔到：${missing.join("、")}。`), "bad");
      },
    }, icon("build", "sm"), t("Fix on the router", "喺路由器修正"));
    actions.append(btn);
  } else if (f.fix?.action) {
    const a = f.fix.action;
    const btn = h("button", {
      class: "btn f sm",
      disabled: locked,
      async onClick() {
        const ok = await ctx.confirmDialog({
          title: tt(a.label),
          body: t("The radio listens to its neighbours and may move to a quieter channel. Wi-Fi on this band can drop for up to a minute; devices rejoin by themselves.", "電台會聽吓鄰居，可能轉去較靜嘅頻道。呢個頻段嘅 Wi-Fi 最多可能斷一分鐘，裝置會自動重連。"),
          confirm: t("Search now", "即時搵"),
        });
        if (!ok) return;
        btn.disabled = true;
        try {
          const done = await ctx.api.post(`/api/actions/${a.name}`, a.body);
          ctx.toast(done.moved ? t(`Moved from channel ${done.before} to ${done.after}.`, `由頻道 ${done.before} 轉到 ${done.after}。`) : t("The radio searched and is already on the quietest channel.", "電台搵過，而家已經係最靜嘅頻道。"), "good");
          after();
        } catch (error) {
          ctx.toast(error.message, "bad");
          btn.disabled = false;
        }
      },
    }, icon("travel_explore", "sm"), tt(a.label));
    actions.append(btn);
  }
  if (f.open) actions.append(h("button", { class: "btn o sm", onClick: () => ctx.navigate(f.open) }, icon("open_in_new", "sm"), t("Open the screen", "打開畫面")));
  return h("article", { class: `sw-finding ${problem ? "problem" : "tip"} s${f.severity}`, "data-finding": f.id },
    h("div", { class: "sw-f-head" },
      icon(problem ? "report" : "lightbulb", "sm"),
      h("b", { class: "grow" }, tt(f.title)),
      f.band ? h("span", { class: "tag" }, f.band) : null,
      h("span", { class: `tag ${problem ? "bad" : "warn"}` }, problem ? t("Fix this", "要修正") : t("Worth trying", "值得試吓"))),
    h("p", { class: "sw-why" }, tt(f.why)),
    f.evidence ? h("p", { class: "t2 sw-evidence" }, icon("monitoring", "sm"), " ", tt(f.evidence)) : null,
    f.steps ? h("p", { class: "note sw-steps" }, tt(f.steps)) : null,
    f.fixBlocked ? h("p", { class: "note warn" }, icon("block", "sm"), " ", t("Cannot be fixed from here: ", "呢度修正唔到："), tt(f.fixBlocked)) : null,
    actions.childNodes.length ? actions : null);
}

async function screen(ctx) {
  const { h, icon, t, tt } = ctx;
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  const body = h("div", { class: "sw-body", "aria-live": "polite" });
  page.append(body);

  async function run() {
    body.replaceChildren(h("section", { class: "card sw-wait" }, icon("radar", "lg"), h("div", {}, t("Checking the router's Wi-Fi…", "檢查緊路由器嘅 Wi-Fi…"))));
    let data;
    try {
      data = await ctx.api.get("/api/domain/slow-wifi");
    } catch (error) {
      body.replaceChildren(h("section", { class: "card bad" }, h("div", { class: "t1" }, t("The router could not be checked.", "檢查唔到路由器。")), h("div", { class: "t2" }, error.message), h("button", { class: "btn o sm", onClick: run }, icon("refresh", "sm"), t("Try again", "再試"))));
      return;
    }
    const problems = data.findings.filter((f) => f.kind === "problem");
    const tips = data.findings.filter((f) => f.kind === "tip");
    const fixable = data.findings.filter((f) => f.fix?.changes);
    const fixAll = h("button", {
      class: "btn f",
      disabled: !ctx.state.canWrite || !fixable.length,
      onClick() {
        let queued = 0;
        const missing = [];
        for (const f of fixable) {
          const out = queueFix(ctx, f);
          queued += out.queued;
          missing.push(...out.missing);
        }
        fixAll.disabled = true;
        for (const b of body.querySelectorAll(".sw-finding .btn.f")) if (fixable.some((f) => b.closest(`[data-finding="${f.id}"]`))) b.disabled = true;
        ctx.toast(t(`${queued} setting${queued === 1 ? "" : "s"} sent to the pending changes bar together.`, `已將 ${queued} 個設定一次過送去待處理變更列。`), "good");
        if (missing.length) ctx.toast(t(`This router could not take: ${missing.join(", ")}.`, `呢部路由器用唔到：${missing.join("、")}。`), "bad");
      },
    }, icon("auto_fix_high", "sm"), t(`Fix everything I can (${fixable.length})`, `修正所有做得到嘅（${fixable.length}）`));
    const when = new Date(data.checkedAt);
    const summary = h("section", { class: `card rise sw-summary ${problems.length ? "warn" : "tone"}` },
      h("div", { class: "sw-score" },
        h("div", { class: "big" }, String(problems.length)),
        h("div", {}, h("div", { class: "t1" }, problems.length ? t(problems.length === 1 ? "thing is slowing your Wi-Fi" : "things are slowing your Wi-Fi", "樣嘢拖慢緊你嘅 Wi-Fi") : t("Nothing on the router is slowing your Wi-Fi", "路由器冇嘢拖慢你嘅 Wi-Fi")),
          h("div", { class: "t2" }, t(`${tips.length} more worth trying · checked at ${when.toLocaleTimeString()}`, `仲有 ${tips.length} 樣值得試 · ${when.toLocaleTimeString()} 檢查`)))),
      h("div", { class: "sw-acts" }, fixAll, h("button", { class: "btn o", onClick: run }, icon("refresh", "sm"), t("Check again", "再檢查"))),
      h("div", { class: "sw-bands" }, ...data.bands.map((b) => bandCard(ctx, b))));
    const section = (title, items, empty) => h("section", { class: "card sw-list" }, h("h2", { class: "h2" }, title), items.length ? items.map((f) => findingCard(ctx, f, run)) : h("p", { class: "t2" }, empty));
    body.replaceChildren(
      summary,
      section(t("Problems to fix on the router", "路由器上要修正嘅問題"), problems, t("No setting or reading on the router points to a problem.", "路由器嘅設定同讀數都冇顯示問題。")),
      section(t("Recommendations", "建議"), tips, t("No further recommendations for this router right now.", "暫時冇其他建議。")),
      h("section", { class: "card sw-list" }, h("h2", { class: "h2" }, t("Also worth knowing", "仲值得知")),
        h("div", { class: "sw-always" }, ...data.always.map((a) => h("div", { class: "sw-tip" },
          h("b", {}, tt(a.title)), h("p", { class: "t2" }, tt(a.why)),
          a.open ? h("button", { class: "btn t sm", onClick: () => ctx.navigate(a.open) }, icon("arrow_forward", "sm"), t("Go there", "去嗰度")) : null)))));
  }

  await run();
}

export default {
  id: "slow-wifi",
  screens: [{ id: "slow-wifi", group: { en: "Network", yue: "網絡" }, icon: "signal_wifi_bad", label, render: screen }],
  commands: [
    { id: "slow-wifi.open", icon: "signal_wifi_bad", label: { en: "My Wi-Fi is slow: find and fix the cause", yue: "我部 Wi-Fi 好慢：搵出原因同修正" }, keywords: "slow wifi speed fix troubleshoot lag buffering 慢 速度 修正", run: (ctx) => ctx.navigate("slow-wifi") },
  ],
};
