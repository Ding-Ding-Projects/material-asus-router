// The live output panel: a log that grows as the router prints, a state tag, a
// timeline of the safety net, the exact command, an elapsed clock, copy, and a
// filter once the output is complete. Everything arrives in ctx.
import { ENDING, followJob } from "./follow.js";

const BASE = "/api/x/flash-backup";

export function openOutput(ctx, { job, title, command, risk, view = "text" }) {
  const { api, h, icon, t, tt, openDialog, toast } = ctx;
  const log = h("pre", { class: "fb-log mono", role: "log", "aria-live": "polite", tabindex: "0", "aria-label": t("Live output", "即時輸出") });
  const stateTag = h("span", { class: "tag" });
  const clock = h("span", { class: "t2 mono" });
  const timeline = h("ol", { class: "fb-timeline", "aria-label": t("What is happening", "進行緊乜嘢") });
  const filter = h("input", { class: "field", type: "search", hidden: true, placeholder: t("Filter the output", "篩選輸出"), "aria-label": t("Filter the output", "篩選輸出") });
  const all = [];
  const started = Date.now();
  let finished = false;
  let follower = null;
  const tick = setInterval(() => !finished && (clock.textContent = `${Math.round((Date.now() - started) / 1000)} s`), 500);

  const addPieces = (chunks) => {
    const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 24;
    for (const c of chunks) {
      all.push(c);
      const span = h("span", { class: `fb-${c.stream}` }, c.text);
      log.append(span);
      if (c.stream === "note") addStep(c.text.trim());
    }
    if (stick) log.scrollTop = log.scrollHeight;
  };
  const steps = new Set();
  function addStep(text) {
    const first = text.split(/[.:]/)[0].slice(0, 90);
    if (!first || steps.has(first) || first.startsWith("$")) return;
    steps.add(first);
    timeline.append(h("li", { class: "fb-step" }, icon("radio_button_checked", "sm"), h("span", {}, first)));
  }
  const showState = (r) => {
    const s = ENDING[r.status] ?? ENDING.running;
    stateTag.className = `tag ${s.tone}`;
    stateTag.replaceChildren(icon(s.icon, "sm"), t(s.en, s.yue));
    stateTag.classList.toggle("fb-spin", r.status === "running" || r.status === "waiting");
  };
  showState({ status: "running" });

  const dialog = openDialog((close) => [
    h("div", { class: "row" }, h("h2", { class: "h2 grow" }, title), stateTag, clock),
    h("div", { class: "fb-cmd mono", title: t("The exact command sent to the router", "傳去路由器嘅確實命令") }, icon("terminal", "sm"), command),
    risk === "network" ? h("div", { class: "note" }, icon("shield"), h("div", {}, t("Safety net on: if the router stops answering, it puts this back by itself.", "安全機制已開啟：如果路由器停止回應，會自動還原。"))) : null,
    timeline,
    filter,
    log,
    h("div", { class: "actions" },
      h("button", { class: "btn t", onClick: async () => { try { await navigator.clipboard.writeText(all.map((c) => c.text).join("")); toast(t("Copied.", "已複製。")); } catch { toast(t("Could not copy.", "複製唔到。"), "bad"); } } }, icon("content_copy", "sm"), t("Copy output", "複製輸出")),
      h("button", { class: "btn f", onClick: () => close() }, t("Close", "關閉"))),
  ], { label: title });

  follower = followJob({
    api,
    base: BASE,
    id: job,
    onChunks: addPieces,
    onState: (r) => {
      showState(r);
      if (r.status === "waiting") addStep("Waiting for the app to reach the router");
    },
  });
  follower.done.then((r) => {
    finished = true;
    clearInterval(tick);
    if (r) showState(r);
    if (r && r.status !== "lost") {
      clock.textContent = r.finishedAt ? `${Math.max(0, Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 1000))} s` : clock.textContent;
      if (view === "text" && all.length > 8) filter.hidden = false;
    }
  });
  // A filter shows only the lines that contain the text; clearing it brings everything back.
  filter.addEventListener("input", () => {
    const q = filter.value.trim().toLowerCase();
    log.replaceChildren();
    if (!q) return void all.forEach((c) => log.append(h("span", { class: `fb-${c.stream}` }, c.text)));
    const lines = all.map((c) => c.text).join("").split(/\r?\n/).filter((line) => line.toLowerCase().includes(q));
    log.append(h("span", { class: "fb-out" }, lines.length ? lines.join("\n") : t("No line matches.", "冇行符合。")));
  });
  dialog.closed.then(() => {
    follower.stop();
    clearInterval(tick);
  });
  return { dialog, done: follower.done };
}
