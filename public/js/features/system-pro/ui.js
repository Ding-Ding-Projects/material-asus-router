// Small building blocks for this feature's screen. Everything arrives in ctx;
// this file imports nothing, so it can be loaded from Node tests too.
// (The same helper is kept next to every feature screen that lists and edits
// things, because a feature folder may not import another folder.)

const clip = (value, size = 160) => (value.length > size ? `${value.slice(0, size)}…` : value);

export function createUi(ctx) {
  const { api, h, icon, t, tt, openDialog, toast } = ctx;

  const statusText = {
    applied: ["check_circle", "good", "Applied", "已套用"],
    "reverted-by-guard": ["history", "warn", "Put back by the safety net", "安全機制已還原"],
    failed: ["error", "bad", "Failed", "失敗"],
    unreachable: ["wifi_off", "bad", "Router not reachable", "路由器連唔到"],
  };

  // Shows a preview built by the server, applies it on request and waits for
  // the result. Resolves true when the router now has the new settings.
  // In Live mode a change that needs no keys and that the household allows applies at once and
  // closes by itself when it worked (ctx.oneClick decides).
  function review(preview, { title } = {}) {
    const direct = ctx.oneClick?.(preview) === true;
    let phase = direct ? "applying" : "review";
    let closeSheet = null;
    let record = null;
    let error = null;
    const show = (value, item) => (item.secret ? "••••••••" : value === null ? t("not set", "未設定") : value === "" ? t("empty", "空") : clip(String(value)));
    const rows = () => preview.items.map((item) =>
      h("div", { class: "diff" },
        h("div", {}, h("div", { class: "t1" }, tt(item.label)), h("div", { class: "t2 mono" }, item.key)),
        h("div", { class: "was" }, show(item.old, item)),
        h("div", { class: "arrow" }, icon("arrow_forward", "sm")),
        h("div", { class: "now" }, show(item.new, item))));

    const apply = async (render) => {
      phase = "applying";
      render();
      try {
        record = await api.post("/api/changes/apply", { previewId: preview.id });
        while (record.status === "guarded" || record.status === "applying") {
          phase = "waiting";
          render();
          await new Promise((resolve) => setTimeout(resolve, 1500));
          record = await api.get(`/api/changes/history/${record.id}`);
        }
        phase = "done";
        ctx.bus.emit("changed");
        if (direct && record.status === "applied") {
          toast(t("Applied. Undo it from Change history.", "已套用，可以喺「變更記錄」還原。"));
          return void closeSheet?.(true);
        }
      } catch (caught) {
        error = caught;
        phase = "error";
      }
      render();
    };

    const dialog = openDialog((close, render) => {
      closeSheet = close;
      const heading = h("h2", { class: "h2" }, title ?? t("Review changes", "檢查改動"));
      if (phase === "review")
        return [
          heading,
          h("div", {}, rows()),
          preview.restarts?.length ? h("div", { class: "muted" }, t("The router will restart: ", "路由器會重啟："), preview.restarts.join(", ")) : null,
          preview.guard?.armed
            ? h("div", { class: "note" }, icon("shield"), h("div", {}, t(`Safety net on. If this app cannot reach the router ${preview.guard.seconds} seconds after the change, the router puts the old settings back by itself.`, `已開啟安全機制。改動後 ${preview.guard.seconds} 秒內連唔到路由器，路由器會自動還原舊設定。`)))
            : h("div", { class: "note" }, icon("bolt"), h("div", {}, t("Low risk. It applies straight away and can be undone from Change history.", "風險低。會即時套用，亦可以喺「變更記錄」還原。"))),
          h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: () => apply(render) }, icon("check", "sm"), t("Apply", "套用"))),
        ];
      if (phase === "applying" || phase === "waiting")
        return [heading, h("div", { class: "row" }, h("div", { class: "spin" }), h("div", { class: "grow" }, phase === "waiting" ? t("The router is not answering yet. Its safety timer will put the old settings back if needed. Still checking…", "路由器未有回應。有需要時，佢嘅安全計時器會還原舊設定。繼續檢查中…") : t("Writing the settings and checking the router still answers…", "寫入設定，確認路由器仍然有回應…")))];
      if (phase === "error") return [heading, h("div", { class: "note bad" }, icon("error"), h("div", {}, error.message)), h("div", { class: "actions" }, h("button", { class: "btn f", onClick: () => close(false) }, t("Close", "關閉")))];
      const [ic, tone, en, yue] = statusText[record.status] ?? ["help", "", record.status, record.status];
      return [
        h("h2", { class: "h2" }, h("span", { class: `tag ${tone}` }, icon(ic, "sm"), t(en, yue))),
        record.note ? h("div", { class: `note ${tone === "good" ? "" : tone}` }, icon(ic), h("div", {}, record.note)) : null,
        h("div", {}, rows()),
        h("div", { class: "actions" },
          record.canUndo ? h("button", { class: "btn t", onClick: async () => { close(true); try { await review(await api.post(`/api/changes/${record.id}/undo`), { title: t("Undo this change", "還原呢項改動") }).closed; } catch (caught) { toast(caught.message, "bad"); } } }, icon("undo", "sm"), t("Undo", "還原")) : null,
          h("button", { class: "btn f", onClick: () => close(record.status === "applied") }, t("Done", "完成"))),
      ];
    }, { label: t("Review changes", "檢查改動") });
    if (direct) apply(dialog.render);
    return dialog;
  }

  // Asks the server for a preview, then shows it. Resolves true once applied.
  async function plan(request) {
    try {
      const preview = await request();
      return (await review(preview).closed) === true;
    } catch (caught) {
      toast(caught.message, "bad");
      return false;
    }
  }

  // A form in a dialog. fields: [{ name, label, type, options, value, hint, placeholder, maxlength, rows }].
  // submit(values) returns a promise; throwing keeps the dialog open with the message.
  function form({ title, intro, fields, submitLabel, submit }) {
    const values = Object.fromEntries(fields.map((f) => [f.name, f.value ?? ""]));
    const message = h("div", { class: "note bad", hidden: true });
    const control = (f) => {
      const common = { "aria-label": tt(f.label), onInput: (e) => (values[f.name] = e.target.value), onChange: (e) => (values[f.name] = e.target.value) };
      if (f.type === "select") return h("select", { class: "field", ...common }, f.options.map(([value, text]) => h("option", { value, selected: value === values[f.name] }, tt(text))));
      if (f.type === "textarea") return h("textarea", { class: "field mono", rows: String(f.rows ?? 5), maxlength: String(f.maxlength ?? 4096), spellcheck: "false", ...common }, values[f.name]);
      return h("input", { class: "field", type: f.type ?? "text", value: values[f.name], placeholder: f.placeholder ?? "", maxlength: String(f.maxlength ?? 128), autocomplete: "off", spellcheck: "false", ...common });
    };
    return openDialog((close) => [
      h("h2", { class: "h2" }, title),
      intro ? h("p", { class: "muted" }, intro) : null,
      fields.map((f) => h("label", { class: "lbl" }, tt(f.label), control(f), f.hint ? h("span", { class: "t2" }, tt(f.hint)) : null)),
      message,
      h("div", { class: "actions" },
        h("button", { class: "btn o", onClick: () => close(null) }, t("Cancel", "取消")),
        h("button", { class: "btn f", onClick: async (e) => {
          e.currentTarget.disabled = true;
          try {
            await submit(values);
            close(values);
          } catch (caught) {
            message.hidden = false;
            message.replaceChildren(icon("error"), h("div", {}, caught.message));
            e.currentTarget.disabled = false;
          }
        } }, submitLabel ?? t("Continue", "繼續"))),
    ], { label: title });
  }

  // The two keys every destructive action needs: the router model typed
  // exactly, and a button held down for a moment. Resolves { confirm, hold } or null.
  function superConfirm({ title, body, action, typeModel = true }) {
    const model = typeModel ? (ctx.state.catalog?.info?.model ?? "") : "";
    let typed = "";
    let held = false;
    let timer = null;
    const dialog = openDialog((close) => {
      const bar = h("i", {});
      const go = h("button", { class: "btn d", disabled: true, onClick: () => close({ confirm: typeModel ? typed : undefined, hold: true }) }, icon("check", "sm"), action ?? t("Confirm", "確認"));
      const ready = () => (go.disabled = !(held && typed === model));
      if (!typeModel) typed = "";
      const start = () => {
        if (timer) return;
        const begun = Date.now();
        timer = setInterval(() => {
          const share = Math.min(1, (Date.now() - begun) / 1500);
          bar.style.setProperty("--w", `${share * 100}%`);
          if (share >= 1) {
            held = true;
            ready();
          }
        }, 60);
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
        h("div", { class: "note warn" }, icon("warning"), h("div", {}, typeModel ? t(`Type the router model, ${model}, then press and hold the button.`, `輸入路由器型號 ${model}，然後撳住個掣。`) : t("Press and hold the button to confirm.", "撳住個掣確認。"))),
        typeModel ? h("input", { class: "field", "aria-label": t("Router model", "路由器型號"), placeholder: model, autocomplete: "off", spellcheck: "false", onInput: (e) => { typed = e.target.value.trim(); ready(); } }) : null,
        h("button", { class: "btn t hold", type: "button", "aria-label": t("Press and hold to unlock", "撳住解鎖"), onPointerdown: start, onPointerup: stop, onPointerleave: stop, onKeydown: key(start), onKeyup: key(stop) }, bar, icon("touch_app", "sm"), t("Press and hold", "撳住")),
        h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(null) }, t("Cancel", "取消")), go),
      ];
    }, { label: title });
    return dialog.closed.then((value) => {
      clearInterval(timer);
      return value ?? null;
    });
  }

  const card = (...kids) => h("section", { class: "card rise" }, ...kids);
  const headRow = (title, ...actions) => h("div", { class: "row" }, h("h2", { class: "h2 grow" }, title), ...actions);
  const empty = (text) => h("div", { class: "empty" }, icon("inbox"), text);

  return { review, plan, form, superConfirm, card, headRow, empty };
}
