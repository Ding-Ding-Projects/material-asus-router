// AiProtection: the protection switches (on models that have the
// traffic-inspection engine) and a router security scan with a real result for
// every item. A fix is queued in the change dock, so it still gets a preview,
// the safety net and undo; nothing is changed by the scan itself.
const label = { en: "AiProtection", yue: "AiProtection" };
const lede = { en: "Block dangerous sites and attacks, and check how exposed the router is.", yue: "擋住危險網站同攻擊，並檢查路由器有幾暴露。" };

const STATUS = {
  pass: { icon: "check_circle", tag: "good", en: "Good", yue: "良好" },
  warn: { icon: "warning", tag: "warn", en: "Could be better", yue: "可以改善" },
  fail: { icon: "error", tag: "bad", en: "Needs fixing", yue: "需要修正" },
  unknown: { icon: "help", tag: "", en: "Not checked", yue: "未檢查" },
};

// Queues one fix in the dock; returns true when it was queued.
export function queueFix(ctx, fix) {
  const entry = ctx.state.catalog?.entries?.find((e) => e.key === fix.key);
  if (entry && !entry.disabled) {
    ctx.dock.setEntry(entry, fix.value);
    return true;
  }
  ctx.dock.setRaw(fix.key, fix.value, fix.current ?? "", fix.label);
  return true;
}

function scanCard(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const body = h("div", { class: "ap-results", "aria-live": "polite" });
  const head = h("div", { class: "muted" }, t("Run the scan to see how the router is set up.", "執行掃描，睇路由器點樣設定。"));
  let last = null;

  const draw = () => {
    body.replaceChildren();
    if (!last) return;
    const { counts, score, items } = last;
    head.textContent = t(`Score ${score ?? "—"} out of 100. ${counts.pass} good, ${counts.warn} could be better, ${counts.fail} need fixing, ${counts.unknown} not checked.`, `得分 ${score ?? "—"} / 100。${counts.pass} 項良好，${counts.warn} 項可以改善，${counts.fail} 項需要修正，${counts.unknown} 項未檢查。`);
    const fixable = items.filter((i) => i.fix && i.status !== "pass");
    if (fixable.length && ctx.state.canWrite)
      body.append(h("button", { class: "btn f sm", type: "button", onClick() { fixable.forEach((i) => queueFix(ctx, i.fix)); ctx.toast(t(`${fixable.length} fixes are waiting in the change dock.`, `${fixable.length} 項修正已放入改動欄等緊。`)); } }, icon("build", "sm"), t(`Queue all ${fixable.length} fixes`, `將 ${fixable.length} 項修正全部加入`)));
    for (const item of items) {
      const s = STATUS[item.status];
      body.append(h("div", { class: `row ap-item ${item.status}` },
        h("span", { class: `tag ${s.tag}` }, icon(s.icon, "sm"), " ", t(s.en, s.yue)),
        h("div", { class: "grow" }, h("div", { class: "t1" }, tt(item.title)), h("div", { class: "t2" }, tt(item.detail)), h("div", { class: "t2 mono" }, item.evidence)),
        item.fix && item.status !== "pass" && ctx.state.canWrite
          ? h("button", { class: "btn o sm", type: "button", onClick() { queueFix(ctx, item.fix); ctx.toast(`${tt(item.fix.label)}: ${t("waiting in the change dock.", "已放入改動欄等緊。")}`); } }, icon("build", "sm"), tt(item.fix.label))
          : null));
    }
  };

  const run = h("button", { class: "btn f", type: "button", async onClick() {
    run.disabled = true;
    head.textContent = t("Scanning…", "掃描緊…");
    try {
      last = await api.get("/api/x/aiprotection/scan");
      draw();
    } catch (error) {
      head.textContent = error.message;
    } finally {
      run.disabled = false;
    }
  } }, icon("security", "sm"), t("Run security scan", "執行安全掃描"));

  return h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("fact_check", "sm"), " ", t("Router security scan", "路由器安全掃描")), h("div", { class: "ctl" }, run), head, body);
}

export default {
  id: "aiprotection",

  screens: [
    {
      id: "aiprotection",
      group: { en: "Network", yue: "網絡" },
      icon: "gpp_good",
      label,
      async render(ctx) {
        const page = ctx.page(label, lede);
        ctx.root.append(page);
        const data = await ctx.api.get("/api/domain/aiprotection");
        if (!data.supported) page.append(ctx.h("div", { class: "note warn" }, ctx.icon("lock"), ctx.tt(data.reason)));
        for (const group of ctx.controls.settingGroups(data.entries)) page.append(ctx.controls.groupCard(group.label, group.entries));
        page.append(scanCard(ctx));
      },
    },
  ],

  commands: [
    { id: "aiprotection.open", icon: "gpp_good", label: { en: "Open AiProtection", yue: "開啟 AiProtection" }, keywords: "aiprotection security scan malicious ips infected", run: (ctx) => ctx.navigate("aiprotection") },
    { id: "aiprotection.scan", icon: "security", label: { en: "Run the router security scan", yue: "執行路由器安全掃描" }, keywords: "scan security check exposed", run: (ctx) => ctx.navigate("aiprotection") },
  ],
};
