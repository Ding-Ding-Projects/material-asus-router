// Two-key super confirmation. Another feature asks for it with
//   ctx.bus.emit("superconfirm:ask", { action, title, affects: [text], respond(token | null) })
// and gets a single-use token only after: key 1 pressed, key 2 held, and the
// slider dragged the whole way. Escape and "Emergency exit" always cancel, and
// nothing happens until every step has finished. If this feature is missing the
// ask is left unclaimed and the caller must treat that as "no".
const HOLD_MS = 700;

function ask(ctx, detail) {
  const { api, h, icon, t, openDialog } = ctx;
  detail.claimed = true;
  const opener = document.activeElement;
  const state = { id: null, key1: false, key2: false, slider: false, done: false, busy: false };
  let release = null;

  const dialog = openDialog((close, render) => {
    const status = h("p", { class: "sc-status", role: "status" });
    const bar = h("div", { class: "meter" }, h("i", { class: "sc-bar" }));
    const setProgress = () => bar.firstChild.style.setProperty("--w", `${[state.key1, state.key2, state.slider].filter(Boolean).length * 33.4}%`);

    const key1 = h("button", { class: `btn ${state.key1 ? "f" : "o"} sc-key`, disabled: !state.id || state.key1 || state.busy || state.done, "aria-pressed": String(state.key1), onClick: () => step(1) }, icon("key", "sm"), state.key1 ? t("Key 1 turned", "鑰匙 1 已轉") : t("Turn key 1", "轉鑰匙 1"));
    const holdFill = h("i", {});
    const key2 = h("button", { class: `btn ${state.key2 ? "f" : "o"} sc-key hold`, disabled: state.key2 || !state.id || state.done, "aria-pressed": String(state.key2) },
      holdFill, icon("key", "sm"), state.key2 ? t("Key 2 turned", "鑰匙 2 已轉") : t("Hold key 2", "撳住鑰匙 2"));
    let timer = null;
    const startHold = (event) => {
      if (state.key2 || state.busy || (event.type === "keydown" && (event.repeat || ![" ", "Enter"].includes(event.key)))) return;
      if (event.type === "keydown") event.preventDefault();
      holdFill.style.setProperty("--w", "100%");
      holdFill.classList.add("filling");
      timer = setTimeout(() => step(2), HOLD_MS);
    };
    const stopHold = () => {
      clearTimeout(timer);
      holdFill.classList.remove("filling");
      holdFill.style.setProperty("--w", "0%");
    };
    key2.addEventListener("pointerdown", startHold);
    key2.addEventListener("keydown", startHold);
    for (const name of ["pointerup", "pointerleave", "keyup", "blur"]) key2.addEventListener(name, stopHold);

    const slider = h("input", { type: "range", min: "0", max: "100", value: "0", class: "sc-slider", disabled: !(state.key1 && state.key2) || state.done || state.busy, "aria-label": t("Slide all the way to confirm", "拉到盡頭確認") });
    slider.addEventListener("input", () => slider.style.setProperty("--p", `${slider.value}%`));
    const finishSlide = async () => {
      if (Number(slider.value) < 100) {
        slider.value = "0";
        slider.style.setProperty("--p", "0%");
        state.slider = false;
        return void api.post("/api/x/super-confirmation/slide", { id: state.id, value: Number(slider.value) }).catch(() => {});
      }
      await step("slider");
    };
    slider.addEventListener("change", finishSlide);
    slider.addEventListener("pointerup", () => Number(slider.value) < 100 && finishSlide());

    status.textContent = state.done
      ? t("Confirmed. The action is running now.", "已確認。動作而家執行。")
      : state.key1 && state.key2
        ? t("Both keys turned. Slide all the way to the right. Nothing has happened yet.", "兩條鑰匙都轉咗。拉到最右。仲未有任何動作。")
        : t("Nothing has happened yet. Turn both keys, then slide.", "仲未有任何動作。先轉兩條鑰匙，再拉掣。");
    setProgress();

    async function step(which) {
      if (state.busy) return;
      state.busy = true;
      try {
        if (!state.id) throw Object.assign(new Error(t("Not ready yet. Try again in a moment.", "未準備好，請稍後再試。")), { status: 0 });
        if (which === 1) state.key1 = (await api.post("/api/x/super-confirmation/key", { id: state.id, key: 1 })).key1;
        if (which === 2) state.key2 = (await api.post("/api/x/super-confirmation/key", { id: state.id, key: 2 })).key2;
        if (which === "slider") {
          await api.post("/api/x/super-confirmation/slide", { id: state.id, value: 100 });
          const out = await api.post("/api/x/super-confirmation/finish", { id: state.id });
          state.slider = true;
          state.done = true;
          release = out.token;
          state.busy = false;
          render();
          setTimeout(() => close(out.token), 900);
          return;
        }
      } catch (error) {
        status.textContent = error.message;
        if (error.status === 410) {
          state.id = null;
          state.key1 = state.key2 = state.slider = false;
          begin();
        }
      }
      state.busy = false;
      render();
    }

    return [
      h("h2", { class: "h2" }, icon("shield_lock"), " ", detail.title ?? t("Confirm a destructive action", "確認破壞性動作")),
      h("div", { class: "note bad" }, icon("warning"), h("div", {}, h("strong", {}, t("This will:", "呢個動作會：")), h("ul", { class: "sc-list" }, (detail.affects ?? []).map((line) => h("li", {}, line))))),
      h("p", { class: "muted" }, t("Two separate keys and a full slide stop this from happening by accident.", "兩條獨立鑰匙加上拉盡掣，防止誤撳。")),
      h("div", { class: "sc-keys" }, key1, key2),
      h("div", { class: "sc-slide" }, slider),
      bar,
      state.done ? h("div", { class: "sc-done", "aria-hidden": "true" }, icon("check_circle", "lg")) : null,
      status,
      h("div", { class: "actions" }, h("button", { class: "btn o sc-exit", disabled: state.done, onClick: () => close(null) }, icon("emergency_home", "sm"), t("Emergency exit", "緊急退出"))),
    ];
  }, { label: detail.title ?? "Confirm" });

  // The confirmation is begun as soon as the dialog opens, so the first key press is never "too fast".
  function begin() {
    return api.post("/api/x/super-confirmation/begin", { action: detail.action, summary: (detail.affects ?? []).join("; ") }).then((out) => {
      state.id = out.id;
      dialog.render();
    }, () => {});
  }
  begin();

  dialog.closed.then(async (token) => {
    if (!token && state.id) await api.post("/api/x/super-confirmation/cancel", { id: state.id }).catch(() => {});
    opener?.focus?.();
    detail.respond(typeof token === "string" ? token : null);
  });
  return release;
}

export default {
  id: "super-confirmation",
  overlays: [{ id: "super-confirmation.listener", mount: (ctx) => ctx.bus.on("superconfirm:ask", (detail) => ask(ctx, detail)) }],
  commands: [{ id: "super-confirmation.try", icon: "shield_lock", label: { en: "Try the two-key confirmation", yue: "試用雙鑰確認" }, keywords: "confirm destructive keys slider", run: (ctx) => ask(ctx, { action: "super-confirmation.demo", title: ctx.t("Practice confirmation", "練習確認"), affects: [ctx.t("Nothing. This is practice and changes no setting.", "冇嘢會改變。呢個係練習，唔會改任何設定。")], respond: (token) => ctx.toast(token ? ctx.t("Practice finished.", "練習完成。") : ctx.t("Cancelled. Nothing happened.", "已取消，冇任何動作。")) }) }],
};
