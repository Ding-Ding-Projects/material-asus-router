// "Update coming soon": the build number, every stage's state, the 24-hour start
// time, the elapsed time, a labelled estimate and what the build holds, while a
// newer build is made and not yet published. Once published it is the ordinary
// update offer. This screen never installs anything and never invents progress.
const label = { en: "Updates", yue: "更新" };
const group = { en: "Help", yue: "幫助" };

const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-");
const clockDate = (iso) => (iso ? new Date(iso).toLocaleDateString([], { year: "numeric", month: "2-digit", day: "2-digit" }) : "");
const span = (seconds) => `${Math.floor(seconds / 3600) ? `${Math.floor(seconds / 3600)} h ` : ""}${Math.floor((seconds % 3600) / 60)} min ${seconds % 60} s`;
const STATE_ICON = { done: "check_circle", running: "autorenew", waiting: "schedule", failed: "error", skipped: "skip_next", cancelled: "cancel" };

async function render(ctx) {
  const { api, h, icon, t, toast } = ctx;
  const body = h("div", { class: "uc" });
  ctx.root.append(ctx.page(label, { en: "When a newer build is on its way, you can watch it here. Nothing is ever installed for you.", yue: "有新版本整緊嘅時候，可以喺度睇住。程式唔會自動幫你安裝任何嘢。" }, body));
  let timer = null;
  let loadedAt = 0;
  let data = null;

  const stateText = {
    waiting: t("Waiting", "等緊"), running: t("Running", "進行中"), done: t("Done", "完成"), failed: t("Failed", "失敗"), skipped: t("Skipped", "跳過"), cancelled: t("Cancelled", "已取消"),
  };

  function draw() {
    body.replaceChildren();
    const put = (...nodes) => body.append(...nodes.flat().filter(Boolean));
    const s = data;
    const checked = h("p", { class: "muted" }, `${t("Checked", "檢查於")} ${clockDate(s.checkedAt)} ${clock(s.checkedAt)} · ${t("Running version", "運行版本")} ${s.version ?? t("unknown", "未知")}`);
    if (s.state === "offline" || s.state === "unknown") return put(h("section", { class: "card warn" }, icon("cloud_off", "lg"), h("h2", { class: "h2" }, s.state === "offline" ? t("Cannot reach GitHub", "連唔到 GitHub") : t("GitHub could not tell", "GitHub 答唔到")), h("p", {}, s.note), checked, retry()));
    if (s.state === "available") return put(h("section", { class: "card hero" }, icon("system_update", "lg"), h("h2", { class: "h2" }, t(`Version ${s.release.tag} is out`, `版本 ${s.release.tag} 已發佈`)), h("p", {}, t("Published, so this is a normal update. It is not installed for you.", "已經發佈，所以係一般更新。唔會幫你自動安裝。")), h("a", { class: "btn t", href: s.release.url, target: "_blank", rel: "noopener noreferrer" }, icon("open_in_new", "sm"), t("Open the release page", "開啟發佈頁面"))), s.release.notes ? h("section", { class: "card" }, h("div", { class: "k" }, t("What it holds", "內容")), h("pre", { class: "uc-notes" }, s.release.notes)) : null, checked);
    if (s.state === "building") {
      const b = s.build;
      const elapsed = h("span", { class: "uc-elapsed" }, span(b.elapsedSeconds));
      const done = s.stages.filter((x) => x.state === "done").length;
      put(
        h("section", { class: "card tone" }, h("div", { class: "k" }, t("Update coming soon", "更新即將推出")), h("div", { class: "big" }, `#${b.number}`),
          h("p", {}, b.title || b.name), h("p", { class: "muted" }, s.note),
          h("div", { class: "uc-facts" }, h("div", {}, h("div", { class: "k" }, t("Started", "開始時間")), `${clockDate(b.startedAt)} ${clock(b.startedAt)}`), h("div", {}, h("div", { class: "k" }, t("Elapsed", "已用時間")), elapsed), h("div", {}, h("div", { class: "k" }, t("Estimate", "預計")), s.estimate ? t(`about ${span(s.estimate.seconds)} (${s.estimate.label}; ${s.estimate.basis})`, `約 ${span(s.estimate.seconds)}（預計，唔係保證；${s.estimate.basis}）`) : t("unknown: there is no earlier run to compare with", "未知：冇更早嘅運行可以比較"))),
          s.stages.length ? h("div", { class: "meter" }, h("i", { class: "uc-bar" })) : null),
        h("section", { class: "card" }, h("div", { class: "k" }, t("Stages", "階段")), s.stages.length ? s.stages.map((st) => h("div", { class: "row" }, icon(STATE_ICON[st.state], "sm"), h("div", { class: "grow" }, h("strong", {}, st.name), h("div", { class: "muted" }, st.startedAt ? `${clock(st.startedAt)}${st.completedAt ? ` - ${clock(st.completedAt)}` : ""}` : "")), h("span", { class: `tag ${st.state === "done" ? "good" : st.state === "failed" ? "bad" : st.state === "running" ? "warn" : ""}` }, stateText[st.state]))) : h("div", { class: "empty" }, t("GitHub has not listed the stages yet.", "GitHub 未列出階段。"))),
        h("section", { class: "card" }, h("div", { class: "k" }, t("What the build holds", "呢個版本包含")), h("p", {}, b.title || t("No description was given.", "冇提供描述。")), b.commit ? h("a", { href: `https://github.com/${s.repo}/commit/${b.commit}`, target: "_blank", rel: "noopener noreferrer", class: "mono" }, b.commit) : null, h("p", { class: "muted" }, t("It will become a normal update offer once it is published. Nothing installs by itself.", "發佈之後會變成一般更新通知。冇任何嘢會自動安裝。"))), checked);
      const bar = body.querySelector(".uc-bar");
      bar?.style.setProperty("--w", `${s.stages.length ? (done / s.stages.length) * 100 : 0}%`);
      loadedAt = performance.now();
      timer = setInterval(() => (elapsed.textContent = span(b.elapsedSeconds + Math.round((performance.now() - loadedAt) / 1000))), 1000);
      return;
    }
    if (s.state === "failed" || s.state === "replaced") return put(h("section", { class: `card ${s.state === "failed" ? "bad" : "warn"}` }, icon(s.state === "failed" ? "error" : "published_with_changes", "lg"), h("h2", { class: "h2" }, s.state === "failed" ? t("The last build failed", "上一個版本整失敗") : t("The last build was replaced", "上一個版本已被取代")), h("p", {}, s.note), s.build?.url ? h("a", { href: s.build.url, target: "_blank", rel: "noopener noreferrer" }, `#${s.build.number}`) : null), checked, retry());
    put(h("section", { class: "card" }, icon("verified", "lg"), h("h2", { class: "h2" }, t("You are up to date", "你用緊最新版本")), h("p", {}, s.note), checked, retry()));
  }

  const retry = () => h("div", { class: "actions" }, h("button", { class: "btn t sm", onClick: () => load(true) }, icon("refresh", "sm"), t("Check again", "再檢查")));

  async function load(fresh = false) {
    clearInterval(timer);
    try {
      data = await api.get(`/api/x/update-coming-soon/status${fresh ? "?fresh=1" : ""}`);
      draw();
    } catch (error) {
      toast(error.message, "bad");
    }
  }
  await load();
  const poll = setInterval(() => load(), 60000);
  return () => {
    clearInterval(timer);
    clearInterval(poll);
  };
}

export default {
  id: "update-coming-soon",
  screens: [{ id: "update-coming-soon", group, icon: "system_update", label, render }],
  commands: [{ id: "update-coming-soon.open", icon: "system_update", label: { en: "Check for updates (coming soon)", yue: "檢查更新（即將推出）" }, keywords: "version build release new", run: (ctx) => ctx.navigate("update-coming-soon") }],
};
