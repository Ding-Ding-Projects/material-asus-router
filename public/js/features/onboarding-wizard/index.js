// A setup checklist for the signed-in workspace: real checks and real
// settings, with progress, Back and Next, optional steps you can skip, saved
// progress you can resume, and keyboard use throughout. Completing it opens
// the overview.
//
// What this is not: the very first sign-up and router connection happen on
// screens that load before any feature can, so this checklist cannot replace
// them. See the "In progress" note on the screen.
import { STEPS, complete, emptyProgress, guardValid, percent, sanitize, skip } from "./steps.js";

const KEY = "mar.nav.setup";
const kv = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

async function wizard(ctx) {
  const { h, icon, t, tt } = ctx;
  let p = sanitize(kv.get(KEY, emptyProgress()));
  const save = () => kv.set(KEY, p);
  const body = h("div", { class: "ob-body" });
  const router = await ctx.api.get("/api/router").catch(() => null);
  let timing = null;
  let guard = null;
  let users = null;

  async function draw() {
    const s = STEPS[p.step];
    const bar = h("div", { class: "meter", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(percent(p)), "aria-label": t("Setup progress", "設定進度") }, h("i"));
    bar.firstChild.style.setProperty("--w", `${percent(p)}%`);
    const steps = h("div", { class: "steps", role: "list" }, STEPS.map((x, i) => h("button", { type: "button", role: "listitem", class: `step${i === p.step ? " on" : p.done.includes(x.id) || p.skipped.includes(x.id) ? " done" : ""}`, "aria-current": i === p.step ? "step" : undefined, onClick: () => { p.step = i; save(); draw(); } }, h("span", { class: "num" }, String(i + 1)), tt(x.title), x.optional ? h("span", { class: "t2" }, ` (${t("optional", "可選")})`) : null)));
    const panel = h("section", { class: "card" }, h("h2", { class: "h2" }, tt(s.title)), h("p", { class: "muted" }, tt(s.about)));
    if (s.id === "router") {
      panel.append(router ? h("div", {}, h("div", { class: "row" }, icon(router.connected ? "check_circle" : "error", "sm"), h("div", { class: "grow" }, h("div", { class: "t1" }, `${router.username ?? ""}@${router.host ?? "?"}:${router.port ?? 22}`.replace(/^@/, "")), h("div", { class: "t2" }, router.authType === "key" ? t("Signs in with the app's key", "用程式嘅金鑰登入") : t("Signs in with a password", "用密碼登入")))), router.demo ? h("div", { class: "note" }, icon("info", "sm"), t("This is the built-in practice router, not a real one.", "呢部係內置嘅練習路由器，唔係真實路由器。")) : null) : h("div", { class: "note bad" }, t("The connection details could not be read.", "讀取唔到連線資料。")),
        h("button", { class: "btn t", onClick: async () => { const start = performance.now(); try { await ctx.api.get("/api/catalog"); timing = { ok: true, ms: Math.round(performance.now() - start) }; } catch (e) { timing = { ok: false, error: e.message }; } draw(); } }, icon("network_check", "sm"), t("Test the connection", "測試連線")),
        timing ? h("div", { class: `note${timing.ok ? "" : " bad"}`, role: "status" }, timing.ok ? t(`Read the router's settings in ${timing.ms} ms.`, `用咗 ${timing.ms} 毫秒讀取路由器設定。`) : timing.error) : null);
    } else if (s.id === "guard") {
      guard ??= (await ctx.api.get("/api/settings").catch(() => ({ guardSeconds: 60 }))).guardSeconds;
      const num = h("input", { class: "field num", type: "number", min: "20", max: "600", value: String(guard), "aria-label": t("Safety timer in seconds", "安全計時器（秒）"), disabled: ctx.state.me?.role !== "owner" });
      panel.append(h("div", { class: "ctl" }, num, h("span", { class: "muted" }, t("seconds (20 to 600)", "秒（20 至 600）")), h("button", { class: "btn f sm", disabled: ctx.state.me?.role !== "owner", onClick: async () => { const n = Number(num.value); if (!guardValid(n)) return ctx.toast(t("Enter a whole number from 20 to 600.", "輸入 20 至 600 嘅整數。"), "bad"); try { await ctx.api.post("/api/settings", { guardSeconds: n }); guard = n; p = complete(p, "guard"); save(); ctx.toast(t("Safety timer saved.", "已儲存安全計時器。")); draw(); } catch (e) { ctx.toast(e.message, "bad"); } } }, icon("save", "sm"), t("Save", "儲存"))), ctx.state.me?.role === "owner" ? null : h("div", { class: "t2" }, t("Only the owner can change this.", "只有擁有者可以更改。")));
    } else if (s.id === "people") {
      users ??= await ctx.api.get("/api/users").catch(() => null);
      panel.append(users ? h("div", {}, h("div", { class: "row" }, icon("person", "sm"), h("div", { class: "grow" }, `${users.owner.name} (${t("owner", "擁有者")})`)), users.users.map((u) => h("div", { class: "row" }, icon("person", "sm"), h("div", { class: "grow" }, `${u.name} (${u.role})`)))) : h("div", { class: "t2" }, t("Only the owner can see the account list.", "只有擁有者睇到帳戶清單。")), h("button", { class: "btn t sm", onClick: () => ctx.navigate("system") }, icon("settings_applications", "sm"), t("Open System to add people", "去「系統」加人")));
    } else {
      panel.append(h("div", { class: "note" }, icon("celebration", "sm"), t("That is the setup. You can come back to this checklist any time.", "設定完成。隨時可以返嚟呢個清單。")), h("button", { class: "btn f", onClick: () => { p = complete(p, "finish"); save(); ctx.navigate("overview"); } }, icon("dashboard", "sm"), t("Open the overview", "打開概覽")));
    }
    const nav = h("div", { class: "actions" },
      h("button", { class: "btn o", disabled: p.step === 0, onClick: () => { p.step -= 1; save(); draw(); } }, icon("arrow_back", "sm"), t("Back", "上一步")),
      s.optional ? h("button", { class: "btn t", onClick: () => { p = skip(p, s.id); p.step = Math.min(STEPS.length - 1, p.step + 1); save(); draw(); } }, t("Skip this step", "跳過呢步")) : null,
      p.step < STEPS.length - 1 ? h("button", { class: "btn f", onClick: () => { p = complete(p, s.id); p.step += 1; save(); draw(); } }, t("Next", "下一步"), icon("arrow_forward", "sm")) : null,
      h("button", { class: "btn o", onClick: () => { p = emptyProgress(); save(); draw(); } }, icon("restart_alt", "sm"), t("Start again", "由頭開始")));
    body.replaceChildren(bar, steps, panel, nav, h("div", { class: "note warn" }, icon("construction", "sm"), h("div", {}, h("b", {}, t("In progress: ", "未完成：")), t("The first sign-up and the first router connection run before the workspace exists, so they are not part of this checklist and have no saved progress or skip. Creating the owner and entering the SSH details are on those earlier screens.", "第一次註冊同第一次連接路由器喺工作區出現之前進行，所以唔屬於呢個清單，亦冇儲存進度或者跳過。建立擁有者同輸入 SSH 資料喺嗰啲較早嘅畫面。"))));
  }
  await draw();
  ctx.root.append(ctx.page({ en: "Setup checklist", yue: "設定清單" }, { en: "Check the connection, choose the safety timer and see who can sign in. Your progress is saved, so you can leave and come back.", yue: "檢查連線、揀安全計時器、睇邊個可以登入。進度會儲存，可以離開再返嚟。" }, body));
}

export default {
  id: "onboarding-wizard",
  screens: [{ id: "setup", group: { en: "Router", yue: "路由器" }, icon: "checklist", label: { en: "Setup checklist", yue: "設定清單" }, render: wizard }],
  commands: [{ id: "onboarding-wizard.open", icon: "checklist", label: { en: "Open the setup checklist", yue: "打開設定清單" }, keywords: "wizard first run onboarding", run: (ctx) => ctx.navigate("setup") }],
};
