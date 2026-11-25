// A live timeline of what a slow action is doing: each step is waiting, working,
// done or failed, with the seconds since it started, and the clock keeps running
// until finish() is called. Nothing here claims a step finished unless told so.
export function timeline(ctx, steps) {
  const { h, icon, t } = ctx;
  const items = steps.map((s) => h("li", { class: "wag-step wait" }, h("span", { class: "wag-mark" }, icon("radio_button_unchecked", "sm")), h("span", { class: "wag-what" }, t(s.en, s.yue)), h("span", { class: "wag-note muted" })));
  const clock = h("span", { class: "wag-clock muted", role: "timer" }, "0 s");
  const root = h("ol", { class: "wag-timeline", "aria-live": "polite" }, ...items);
  const started = Date.now();
  let stop = false;
  const timer = setInterval(() => {
    if (!stop) clock.textContent = `${Math.round((Date.now() - started) / 1000)} s`;
  }, 500);
  const marks = { wait: "radio_button_unchecked", work: "progress_activity", done: "check_circle", bad: "error" };
  return {
    el: root,
    clock,
    // state: "wait" | "work" | "done" | "bad"; note is an optional short sentence.
    set(i, state, note = "") {
      const item = items[i];
      if (!item) return;
      item.className = `wag-step ${state}`;
      const mark = item.firstChild;
      mark.replaceChildren(icon(marks[state], "sm"));
      item.lastChild.textContent = note;
    },
    finish() {
      stop = true;
      clearInterval(timer);
      clock.textContent = `${Math.round((Date.now() - started) / 1000)} s`;
    },
    destroy() {
      stop = true;
      clearInterval(timer);
    },
  };
}
