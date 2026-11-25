// The practical setup guide. Each step does something real: it shows the owner
// account, saves the router address, signs in over SSH (password or this app's
// key), tests the connection through the app's own connect route (including
// approving the router's host key), sets the safety timer, lists who can sign
// in and lets the person choose how often to check the router. A progress bar,
// Back and Next, saved progress, optional-step skipping and keyboard use all
// work; finishing opens the workspace. It is separate from the documentation
// site.
import { STEPS, guardValid, percent, sanitize } from "./steps.js";

const label = { en: "Setup guide", yue: "設定指南" };
const group = { en: "Help", yue: "幫助" };
async function render(ctx) {
  const { api, h, icon, t, tt, toast } = ctx;
  const progress = await api.get("/api/x/onboarding-wizard/progress");
  const isOwner = ctx.state.me?.role === "owner";
  const form = { host: progress.values?.host ?? progress.router?.host ?? progress.suggested?.host ?? "", port: String(progress.values?.port ?? progress.router?.port ?? 22), username: progress.values?.username ?? progress.router?.username ?? progress.suggested?.username ?? "", authType: progress.values?.authType ?? progress.router?.authType ?? "password", password: "", pollSeconds: String(progress.values?.pollSeconds ?? 5) };
  const extras = { guard: null, users: undefined, router: undefined, timing: null };
  const run = { step: Math.min(progress.step ?? 0, progress.steps.length - 1), connected: progress.routerConfigured, result: null, pending: null, publicKey: null, busy: false };
  const root = h("div", { class: "ob" });
  ctx.root.append(ctx.page(label, { en: "Set up in a few steps. You can stop at any point and pick up where you left off.", yue: "幾個步驟就設定好。隨時可以停低，下次由停低嗰度繼續。" }, root));

  const save = (extra = {}) => api.post("/api/x/onboarding-wizard/progress", { step: run.step, values: { host: form.host, port: form.port, username: form.username, authType: form.authType, pollSeconds: form.pollSeconds }, ...extra }).then((saved) => {
    if (Array.isArray(saved?.done)) progress.done = saved.done;
    if (Array.isArray(saved?.skipped)) progress.skipped = saved.skipped;
    return saved;
  }).catch((error) => toast(error.message, "bad"));
  const go = async (to, extra = {}) => {
    run.step = Math.max(0, Math.min(progress.steps.length - 1, to));
    await save({ finished: extra.finished, skipped: extra.skipped });
    draw();
  };

  async function timeRead() {
    const start = performance.now();
    try {
      await api.get("/api/catalog");
      extras.timing = { ok: true, ms: Math.round(performance.now() - start) };
    } catch (error) {
      extras.timing = { ok: false, error: error.message };
    }
  }

  async function connect() {
    run.busy = true;
    run.result = null;
    draw();
    try {
      await api.post("/api/router/connect", { host: form.host, port: form.port ? Number(form.port) : undefined, username: form.username, authType: form.authType, password: form.authType === "password" ? form.password : undefined });
      form.password = "";
      run.connected = true;
      run.pending = null;
      run.result = { ok: true, text: t("Connected. The router answered and its host key is trusted.", "已連接。路由器有回應，主機金鑰已信任。") };
      await timeRead();
    } catch (error) {
      if (error.code === "HOST_KEY_UNKNOWN" || error.code === "HOST_KEY_CHANGED") run.pending = { fingerprint: error.data.fingerprint, changed: error.code === "HOST_KEY_CHANGED" };
      else run.result = { ok: false, text: error.message };
    }
    run.busy = false;
    draw();
  }

  async function approve() {
    run.busy = true;
    draw();
    try {
      await api.post("/api/router/approve-host-key", { fingerprint: run.pending.fingerprint, username: form.username, authType: form.authType, password: form.authType === "password" ? form.password : undefined });
      form.password = "";
      run.pending = null;
      run.connected = true;
      run.result = { ok: true, text: t("Host key approved and connected.", "已核准主機金鑰並連接。") };
      await timeRead();
    } catch (error) {
      run.result = { ok: false, text: error.message };
    }
    run.busy = false;
    draw();
  }

  const stepName = (id) => { const x = STEPS.find((step) => step.id === id); return t(x.title.en, x.title.yue); };
  const field = (name, key, extra = {}) => h("label", { class: "lbl" }, name, h("input", { class: "field", value: form[key], onInput: (e) => (form[key] = e.target.value), onKeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }, ...extra }));

  async function loadExtras(id) {
    if (id === "guard" && extras.guard === null) extras.guard = String((await api.get("/api/settings").catch(() => ({ guardSeconds: 60 }))).guardSeconds ?? 60);
    if (id === "router" && extras.router === undefined) extras.router = await api.get("/api/router").catch(() => null);
    if (id === "people" && extras.users === undefined) extras.users = await api.get("/api/users").catch(() => null);
  }

  function routerSummary() {
    const r = extras.router;
    if (!r || !(r.host || r.connected)) return null;
    const who = `${r.username ?? ""}@${r.host ?? "?"}:${r.port ?? 22}`.replace(/^@/, "");
    return h("div", {}, h("div", { class: "row" }, icon(r.connected ? "check_circle" : "error", "sm"), h("div", { class: "grow" }, h("div", { class: "t1" }, who), h("div", { class: "t2" }, r.authType === "key" ? t("Signs in with the app's key", "用程式嘅金鑰登入") : t("Signs in with a password", "用密碼登入")))), r.demo ? h("div", { class: "note" }, icon("info", "sm"), t("This is the built-in practice router, not a real one.", "呢部係內置嘅練習路由器，唔係真實路由器。")) : null);
  }

  function body() {
    const id = progress.steps[run.step];
    if (id === "owner") return [h("p", {}, t(`You are signed in as ${ctx.state.me?.name} (${ctx.state.me?.role}). The first account on a fresh install becomes the owner, and there is no setup code.`, `你以 ${ctx.state.me?.name}（${ctx.state.me?.role}）身份登入。全新安裝嘅第一個帳戶會成為擁有者，冇設定碼。`)), h("div", { class: "note" }, icon("verified_user"), t("Done: the owner account exists.", "完成：擁有者帳戶已存在。"))];
    if (!isOwner && ["router", "login", "test"].includes(id)) return [h("div", { class: "note warn" }, icon("lock"), t("Only the owner can change the router connection. You can skip ahead.", "只有擁有者可以更改路由器連線，你可以跳到下一步。"))];
    if (id === "router") return [routerSummary(), field(t("Router address", "路由器地址"), "host", { placeholder: "198.51.100.1", autocomplete: "off" }), field(t("SSH port", "SSH 連接埠"), "port", { inputmode: "numeric", maxlength: "5" }), h("p", { class: "muted" }, t("Use the address you open the router's own page with. SSH must be switched on in the router (Administration, System).", "用你開路由器本身網頁嘅地址。路由器入面要開咗 SSH（管理、系統）。"))];
    if (id === "login") return [
      field(t("SSH user name", "SSH 用戶名稱"), "username", { autocomplete: "off" }),
      h("div", { class: "seg", role: "radiogroup", "aria-label": t("How to sign in", "點樣登入") }, [["password", t("Password", "密碼")], ["key", t("This app's key", "呢個程式嘅金鑰")]].map(([v, l]) => h("button", { role: "radio", "aria-checked": String(form.authType === v), class: form.authType === v ? "on" : "", onClick: () => { form.authType = v; draw(); } }, l))),
      form.authType === "password" ? h("label", { class: "lbl" }, t("SSH password (used for the test, never saved here)", "SSH 密碼（只用嚟測試，唔會喺度儲存）"), h("input", { class: "field", type: "password", autocomplete: "off", value: form.password, onInput: (e) => (form.password = e.target.value) })) : h("div", {}, h("button", { class: "btn t", onClick: async () => { try { run.publicKey = (await api.post("/api/router/key", {})).publicKey; draw(); } catch (error) { toast(error.message, "bad"); } } }, icon("key", "sm"), t("Make or show this app's key", "產生或顯示呢個程式嘅金鑰")), run.publicKey ? h("div", {}, h("p", { class: "muted" }, t("Add this public key to the router's authorized keys, then test the connection.", "將呢條公開金鑰加入路由器嘅授權金鑰，然後測試連線。")), h("pre", { class: "mono ob-key" }, run.publicKey)) : null),
    ];
    if (id === "test") return [
      h("p", {}, t(`Connect to ${form.host || "(no address yet)"}:${form.port || 22} as ${form.username || "(no user yet)"}.`, `以 ${form.username || "（未有用戶）"} 連接 ${form.host || "（未有地址）"}:${form.port || 22}。`)),
      run.pending ? h("div", { class: "note warn" }, icon("fingerprint"), h("div", {}, run.pending.changed ? t("The router's key changed. Only approve if you reset it yourself.", "路由器嘅金鑰變咗。除非你自己重設過，否則唔好核准。") : t("First time: compare this fingerprint with the router, then approve.", "第一次：對比路由器上面嘅指紋，然後核准。"), h("div", { class: "mono" }, run.pending.fingerprint))) : null,
      run.result ? h("div", { class: `note ${run.result.ok ? "" : "bad"}`, role: "status" }, icon(run.result.ok ? "check_circle" : "error"), run.result.text) : null,
      run.result?.ok && extras.timing ? h("div", { class: `note${extras.timing.ok ? "" : " bad"}`, role: "status" }, icon(extras.timing.ok ? "network_check" : "error"), extras.timing.ok ? t(`Read the router's settings in ${extras.timing.ms} ms.`, `用咗 ${extras.timing.ms} 毫秒讀取路由器設定。`) : extras.timing.error) : null,
      h("div", { class: "actions" }, run.pending ? h("button", { class: "btn f", disabled: run.busy, onClick: approve }, icon("verified_user", "sm"), t("Approve and connect", "核准並連接")) : h("button", { class: "btn f", disabled: run.busy || !form.host || !form.username, onClick: connect }, icon("lan", "sm"), run.busy ? t("Testing...", "測試緊...") : t("Test the connection", "測試連線"))),
    ];
    if (id === "guard") {
      const num = h("input", { class: "field num", type: "number", min: "20", max: "600", value: extras.guard ?? "60", "aria-label": t("Safety timer in seconds", "安全計時器（秒）"), disabled: !isOwner, onInput: (e) => (extras.guard = e.target.value) });
      return [h("div", { class: "ctl" }, num, h("span", { class: "muted" }, t("seconds (20 to 600)", "秒（20 至 600）")), h("button", { class: "btn f sm", disabled: !isOwner, onClick: async () => { const n = Number(num.value); if (!guardValid(n)) return toast(t("Enter a whole number from 20 to 600.", "輸入 20 至 600 嘅整數。"), "bad"); try { await api.post("/api/settings", { guardSeconds: n }); extras.guard = String(n); toast(t("Safety timer saved.", "已儲存安全計時器。")); } catch (error) { toast(error.message, "bad"); } } }, icon("save", "sm"), t("Save", "儲存"))), isOwner ? null : h("div", { class: "t2" }, t("Only the owner can change this.", "只有擁有者可以更改。"))];
    }
    if (id === "people") return [extras.users ? h("div", {}, h("div", { class: "row" }, icon("person", "sm"), h("div", { class: "grow" }, `${extras.users.owner.name} (${t("owner", "擁有者")})`)), extras.users.users.map((u) => h("div", { class: "row" }, icon("person", "sm"), h("div", { class: "grow" }, `${u.name} (${u.role})`)))) : h("div", { class: "t2" }, t("Only the owner can see the account list.", "只有擁有者睇到帳戶清單。")), h("button", { class: "btn t sm", onClick: () => ctx.navigate("system") }, icon("settings_applications", "sm"), t("Open System to add people", "去「系統」加人"))];
    if (id === "polling") return [h("p", {}, t("How often should the app ask the router for fresh numbers? This step is optional.", "程式幾耐問路由器攞一次最新數字？呢步係可選嘅。")), h("div", { class: "stepper" }, h("button", { class: "btn o icon", "aria-label": t("Less often", "少啲"), onClick: () => { form.pollSeconds = String(Math.min(60, Number(form.pollSeconds) + 1)); draw(); } }, icon("remove", "sm")), h("input", { class: "field num", inputmode: "numeric", "aria-label": t("Seconds between checks", "每次檢查相隔秒數"), value: form.pollSeconds, onInput: (e) => (form.pollSeconds = e.target.value) }), h("span", {}, t("seconds", "秒")), h("button", { class: "btn o icon", "aria-label": t("More often", "多啲"), onClick: () => { form.pollSeconds = String(Math.max(2, Number(form.pollSeconds) - 1)); draw(); } }, icon("add", "sm"))), h("div", { class: "note warn" }, icon("construction"), t("In progress: the choice is saved, but the Overview screen does not read it yet, because that screen belongs to the app's core files.", "進行中：選擇已儲存，但概覽畫面仲未讀取，因為嗰個畫面屬於程式核心檔案。"))];
    return [
      h("p", {}, t("Everything is ready. Review what you set up:", "一切就緒。檢視你設定咗嘅嘢：")),
      h("div", { class: "row" }, icon("person"), t(`Owner account: ${ctx.state.me?.name}`, `擁有者帳戶：${ctx.state.me?.name}`)),
      h("div", { class: "row" }, icon("router"), run.connected ? t(`Router: ${form.host || progress.router?.host}`, `路由器：${form.host || progress.router?.host}`) : t("Router: not connected", "路由器：未連接")),
      h("div", { class: "row" }, icon("schedule"), progress.skipped.includes("polling") ? t("Check interval: skipped", "檢查頻率：已跳過") : t(`Check every ${form.pollSeconds} seconds`, `每 ${form.pollSeconds} 秒檢查一次`)),
      h("div", { class: "note" }, icon("celebration", "sm"), t("That is the setup. You can open this guide again any time.", "設定完成。隨時可以再打開呢個指南。")),
      h("div", { class: "actions" }, h("button", { class: "btn f", disabled: !run.connected, onClick: finish }, icon("dashboard", "sm"), t("Open the workspace", "開啟工作區"))),
    ];
  }

  async function finish() {
    try {
      await api.post("/api/x/onboarding-wizard/complete");
      toast(t("Setup finished.", "設定完成。"));
      ctx.navigate("overview");
    } catch (error) {
      toast(error.message, "bad");
    }
  }

  async function next() {
    const id = progress.steps[run.step];
    if (id === "test" && !run.connected && isOwner) return toast(t("Test the connection first, or go back.", "請先測試連線，或者返回。"), "bad");
    await go(run.step + 1, { finished: run.step });
  }

  async function draw() {
    const id = progress.steps[run.step];
    const optional = progress.optional.includes(id);
    await loadExtras(id);
    if (id !== progress.steps[run.step]) return;
    const pct = percent(sanitize({ step: run.step, done: progress.done, skipped: progress.skipped }));
    const bar = h("div", { class: "meter", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct), "aria-label": t("Setup progress", "設定進度") }, h("i"));
    bar.firstChild.style.setProperty("--w", `${pct}%`);
    root.replaceChildren(bar,
      h("div", { class: "steps", role: "list", "aria-label": t("Progress", "進度") }, progress.steps.map((s, i) => { const finished = progress.done.includes(s) || progress.skipped.includes(s) || i < run.step; return h("button", { role: "listitem", class: `step ${i === run.step ? "on" : finished ? "done" : ""}`, "aria-current": i === run.step ? "step" : "false", onClick: () => go(i) }, icon(finished ? "check" : "circle", "sm"), stepName(s), progress.optional.includes(s) ? h("span", { class: "t2" }, ` (${t("optional", "可選")}${progress.skipped.includes(s) ? `, ${t("skipped", "已跳過")}` : ""})`) : null); })),
      h("section", { class: "card" }, h("h2", { class: "h2", tabindex: "-1", id: "ob-title" }, `${run.step + 1}/${progress.steps.length} ${stepName(id)}`), h("p", { class: "muted" }, tt(STEPS.find((x) => x.id === id).about)), ...body(),
        id === "finish" ? null : h("div", { class: "actions" },
          h("button", { class: "btn o", disabled: run.step === 0 || run.busy, onClick: () => go(run.step - 1) }, icon("arrow_back", "sm"), t("Back", "上一步")),
          optional ? h("button", { class: "btn o", onClick: () => go(run.step + 1, { skipped: id }) }, t("Skip this step", "跳過呢步")) : null,
          h("button", { class: "btn f", disabled: run.busy, onClick: next }, t("Next", "下一步"), icon("arrow_forward", "sm")))),
      h("div", { class: "actions" }, h("button", { class: "btn o sm", onClick: async () => { await api.post("/api/x/onboarding-wizard/dismiss"); ctx.navigate("overview"); } }, t("Close the guide for now", "暫時閂咗指南")), h("button", { class: "btn o sm", onClick: async () => { await api.post("/api/x/onboarding-wizard/restart"); run.step = 0; draw(); } }, icon("restart_alt", "sm"), t("Start over", "由頭開始"))));
    document.getElementById("ob-title")?.focus({ preventScroll: true });
  }
  draw();
}

let offered = false;

export default {
  id: "onboarding-wizard",
  screens: [{ id: "setup", group, icon: "rocket_launch", label, render }],
  overlays: [{
    id: "onboarding-wizard.first-run",
    mount(ctx) {
      if (offered) return;
      offered = true;
      ctx.api.get("/api/x/onboarding-wizard/progress").then((p) => {
        if (!p.completed && !p.dismissed && ctx.state.route !== "setup") ctx.navigate("setup");
      }, () => {});
    },
  }],
  commands: [{ id: "onboarding-wizard.open", icon: "rocket_launch", label: { en: "Open the setup guide", yue: "開啟設定指南" }, keywords: "setup first run wizard connect router", run: (ctx) => ctx.navigate("setup") }],
};
