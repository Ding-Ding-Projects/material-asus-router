// The unlock ladder: dim sum, ten sums, whack-a-mole and a clock. Winning clears
// the WAITING time on a lock; it never clears or reveals the credential. Every
// step is graded by the server with a single-use nonce. Other features open it
// with ctx.bus.emit("ladder:open", { lockKey, respond(result) }).
const NS = "http://www.w3.org/2000/svg";
const label = { en: "Unlock ladder", yue: "解鎖階梯" };
const group = { en: "Safety", yue: "安全" };

function clockFace(hour, minute) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", "ul-clock");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Analog clock");
  const add = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    svg.append(el);
    return el;
  };
  add("circle", { cx: 50, cy: 50, r: 46, class: "ul-face" });
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    add("line", { x1: 50 + 40 * Math.sin(a), y1: 50 - 40 * Math.cos(a), x2: 50 + 45 * Math.sin(a), y2: 50 - 45 * Math.cos(a), class: "ul-tick" });
  }
  const hand = (angle, length, cls) => add("line", { x1: 50, y1: 50, x2: 50 + length * Math.sin(angle), y2: 50 - length * Math.cos(angle), class: cls });
  hand((((hour % 12) + minute / 60) * Math.PI) / 6, 24, "ul-hour");
  hand((minute * Math.PI) / 30, 36, "ul-minute");
  return svg;
}

export function runLadder(ctx, { lockKey = "", respond = () => {} } = {}) {
  const { api, h, icon, t, openDialog } = ctx;
  let ladder = null;
  let started = 0;
  const timers = [];
  const stopTimers = () => timers.splice(0).forEach(clearTimeout);

  const dialog = openDialog((close, render) => {
    const body = h("div", { class: "ul-body" });
    const rungLabel = { "dim-sum": t("Dim sum", "點心"), sums: t("Ten sums", "十條數"), moles: t("Whack-a-mole", "打地鼠"), clock: t("The clock", "睇時鐘") };
    const finishWith = (result) => {
      stopTimers();
      respond(result);
      close(result);
    };
    const send = async (answer) => {
      try {
        const out = await api.post("/api/x/unlock-ladder/answer", { ladderId: ladder.ladderId, nonce: ladder.nonce, answer });
        if (out.finished) {
          return void body.replaceChildren(
            h("div", { class: `note ${out.cleared ? "" : "bad"}` }, icon(out.cleared ? "check_circle" : "cancel"), out.cleared ? t("The wait on this lock is cleared. Your PIN or password still works exactly as before, and nobody has been signed in.", "呢個鎖嘅等候時間已清除。你嘅 PIN 或密碼照舊，亦冇人被登入。") : t("That did not work, and the ladder ends. Tries are not given back.", "唔成功，階梯到此為止。嘗試次數唔會退返。")),
            h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => finishWith(out) }, t("Close", "關閉"))));
        }
        ladder = { ...ladder, ...out };
        draw();
      } catch (error) {
        body.replaceChildren(h("div", { class: "note bad" }, icon("error"), error.message), h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => finishWith({ cleared: false, error: error.message }) }, t("Close", "關閉"))));
      }
    };

    function draw() {
      stopTimers();
      const c = ladder.challenge;
      const head = h("div", { class: "steps" }, ladder.rungs.map((name, i) => h("div", { class: `step ${i === ladder.rung ? "on" : i < ladder.rung ? "done" : ""}` }, icon(i < ladder.rung ? "check" : "circle", "sm"), rungLabel[name])));
      body.replaceChildren(head);
      if (ladder.name === "dim-sum") {
        body.append(h("h3", { class: "h2" }, t(c.question.en, c.question.yue)), h("div", { class: "grid" }, c.options.map((o) => h("button", { class: "btn t ul-dish", onClick: () => send(o.id) }, h("span", { class: "ul-emoji", "aria-hidden": "true" }, o.emoji), t(o.en, o.yue)))));
      } else if (ladder.name === "sums") {
        const inputs = c.questions.map((q) => h("label", { class: "ul-sum" }, `${q} =`, h("input", { class: "field", type: "number", inputmode: "numeric", "aria-label": q })));
        body.append(h("div", { class: "grid2" }, inputs), h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => send(inputs.map((l) => Number(l.querySelector("input").value))) }, t("Check my sums", "核對答案"))));
      } else if (ladder.name === "moles") {
        const hits = [];
        const holes = Array.from({ length: c.holes }, (_, i) => h("button", { class: "ul-hole", "aria-label": `${t("Hole", "洞")} ${i + 1}`, "data-hole": String(i), disabled: true }, icon("pest_control_rodent")));
        const t0 = performance.now();
        const status = h("p", { role: "status" }, t(`Whack at least ${c.need} of 5 moles when they pop up.`, `5 隻地鼠入面至少打中 ${c.need} 隻。`));
        for (const mole of c.moles) {
          timers.push(setTimeout(() => {
            const el = holes[mole.hole];
            el.disabled = false;
            el.classList.add("up");
            el.dataset.mole = String(mole.index);
          }, mole.showAt));
          timers.push(setTimeout(() => {
            const el = holes[mole.hole];
            el.classList.remove("up");
            el.disabled = true;
            delete el.dataset.mole;
          }, mole.showAt + mole.window));
        }
        holes.forEach((el) => el.addEventListener("click", () => {
          if (el.dataset.mole === undefined) return;
          hits.push({ index: Number(el.dataset.mole), t: Math.round(performance.now() - t0) });
          el.classList.remove("up");
          el.disabled = true;
          delete el.dataset.mole;
          status.textContent = t(`${hits.length} hit.`, `打中 ${hits.length} 隻。`);
        }));
        const last = c.moles[c.moles.length - 1];
        timers.push(setTimeout(() => send(hits), last.showAt + last.window + 300));
        body.append(status, h("div", { class: "ul-holes" }, holes));
      } else {
        body.append(h("h3", { class: "h2" }, t("What time does the clock show?", "時鐘顯示幾點？")), h("div", { class: "ul-clockwrap" }, clockFace(c.hour, c.minute)), h("div", { class: "grid" }, c.options.map((o) => h("button", { class: "btn t", onClick: () => send(o) }, o))));
      }
      body.append(h("p", { class: "muted ul-note" }, t("This only clears the waiting time on a lock. It never reveals or clears the PIN or password.", "呢個只係清除鎖嘅等候時間，唔會顯示或者清除 PIN 或密碼。")));
    }

    if (!ladder && !started) {
      started = 1;
      api.post("/api/x/unlock-ladder/start", { lockKey }).then((out) => {
        ladder = out;
        draw();
      }, (error) => {
        body.replaceChildren(h("div", { class: "note bad" }, icon("hourglass_bottom"), error.message), h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => finishWith({ cleared: false, error: error.message }) }, t("Close", "關閉"))));
      });
    }
    return [h("h2", { class: "h2" }, icon("stairs"), " ", t("Unlock ladder", "解鎖階梯")), body, h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => finishWith({ cleared: false, cancelled: true }) }, t("Give up", "放棄")))];
  }, { label: t("Unlock ladder", "解鎖階梯") });
  dialog.closed.then((value) => {
    stopTimers();
    if (value === undefined) respond({ cleared: false, cancelled: true });
  });
  return dialog;
}

export default {
  id: "unlock-ladder",
  screens: [{
    id: "unlock-ladder",
    group,
    icon: "stairs",
    label,
    async render(ctx) {
      const { api, h, icon, t } = ctx;
      const budget = await api.get("/api/x/unlock-ladder/budget");
      ctx.root.append(ctx.page(label, { en: "Four small challenges that clear the waiting time after too many wrong lock attempts. They never reveal or clear a PIN or password.", yue: "四個小挑戰，喺鎖嘅嘗試次數太多之後清除等候時間。唔會顯示或清除 PIN 或密碼。" },
        h("section", { class: "card" },
          h("div", { class: "k" }, t("This hour", "呢一個鐘")),
          h("p", {}, t(`Ladders left to start: ${budget.startsLeft} of ${budget.startBudget}. Waits that can still be cleared: ${budget.clearsLeft} of ${budget.clearBudget}. Wrong answers do not give tries back.`, `仲可以開始嘅階梯：${budget.startBudget} 之中剩 ${budget.startsLeft}。仲可以清除嘅等候：${budget.clearBudget} 之中剩 ${budget.clearsLeft}。答錯唔會退返次數。`)),
          h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => runLadder(ctx, { respond: (r) => ctx.toast(r?.cleared ? t("Practice ladder cleared.", "練習階梯完成。") : t("The ladder ended.", "階梯完結。")) }) }, icon("stairs", "sm"), t("Practise the ladder", "練習階梯"))))));
    },
  }],
  overlays: [{ id: "unlock-ladder.listener", mount: (ctx) => ctx.bus.on("ladder:open", (detail) => { detail.claimed = true; runLadder(ctx, detail); }) }],
  commands: [{ id: "unlock-ladder.open", icon: "stairs", label: { en: "Open the unlock ladder", yue: "開啟解鎖階梯" }, keywords: "lock wait dim sum", run: (ctx) => ctx.navigate("unlock-ladder") }],
};
