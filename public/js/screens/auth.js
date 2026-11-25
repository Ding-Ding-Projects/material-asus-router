// First-run setup (owner, router, host key) and sign-in.
import { api, auth, copyText, getLang, h, icon, setLang, t, toast } from "../core.js";

function frame(content, step) {
  const names = [[t("Create the owner", "建立擁有者")], [t("Connect the router", "連接路由器")], [t("Approve its host key", "核准主機金鑰")]];
  return h("div", { class: "center" }, h("div", { class: "panel" },
    h("div", { class: "langbar" }, langSwitch()),
    step ? h("div", { class: "steps", "aria-label": t("Setup progress", "設定進度") }, names.map(([n], i) => h("span", { class: `step ${i + 1 === step ? "on" : i + 1 < step ? "done" : ""}`, "aria-current": i + 1 === step ? "step" : null }, h("span", { class: "num" }, i + 1 < step ? icon("check", "sm") : i + 1), n))) : null,
    content));
}

export function langSwitch() {
  return h("div", { class: "seg", role: "radiogroup", "aria-label": t("Language", "語言") }, [["en", "English"], ["yue", "廣東話"], ["both", "EN + 粵"]].map(([id, label]) =>
    h("button", { role: "radio", class: getLang() === id ? "on" : "", "aria-checked": String(getLang() === id), onClick: () => setLang(id) }, label)));
}

function errorBox() {
  return h("div", { class: "err", role: "alert" });
}

export function setupScreen(root, done) {
  const v = { name: "", username: "", password: "" };
  const err = errorBox();
  const submit = async (e) => {
    e.preventDefault();
    err.textContent = "";
    try {
      const res = await api.post("/api/setup", v);
      auth.csrf = res.csrf;
      done();
    } catch (error) {
      err.textContent = error.message;
      if (error.data?.signIn) done();
    }
  };
  root.replaceChildren(frame(h("form", { class: "card", onSubmit: submit },
    h("h1", { class: "disp" }, t("Welcome. Make the owner account.", "歡迎。建立擁有者帳戶。")),
    h("p", { class: "lede" }, t("The first account made on a fresh install becomes the owner. Later you can add operators, who can change settings, and viewers, who can only look.", "全新安裝嘅第一個帳戶會成為擁有者。之後可以新增操作員（可以改設定）同檢視者（只可以睇）。")),
    h("div", { class: "two" },
      h("label", { class: "lbl" }, t("Your name", "你嘅名稱"), h("input", { class: "field", autocomplete: "name", required: true, onInput: (e) => (v.name = e.target.value) })),
      h("label", { class: "lbl" }, t("User name", "用戶名稱"), h("input", { class: "field", autocomplete: "username", required: true, onInput: (e) => (v.username = e.target.value) }))),
    h("label", { class: "lbl" }, t("Password (12 characters or more)", "密碼（12 個字元或以上）"), h("input", { class: "field", type: "password", autocomplete: "new-password", minlength: "12", required: true, onInput: (e) => (v.password = e.target.value) })),
    err,
    h("div", { class: "actions" }, h("button", { class: "btn f", type: "submit" }, t("Create owner and continue", "建立擁有者並繼續")))), 1));
}

export function signInScreen(root, done) {
  const v = { username: "", password: "" };
  const err = errorBox();
  root.replaceChildren(frame(h("form", { class: "card", onSubmit: async (e) => {
    e.preventDefault();
    err.textContent = "";
    const button = e.target.querySelector("button[type=submit]");
    if (button) { button.disabled = true; button.textContent = t("Signing in...", "登入緊..."); }
    try {
      const res = await api.post("/api/login", v);
      auth.csrf = res.csrf;
      done();
    } catch (error) {
      err.textContent = error.message;
      if (button) { button.disabled = false; button.textContent = t("Sign in", "登入"); }
    }
  } },
    h("h1", { class: "disp" }, t("Sign in", "登入")),
    h("p", { class: "lede" }, t("Use your account for this app. It is not the router's password.", "用你喺呢個程式嘅帳戶，唔係路由器密碼。")),
    h("label", { class: "lbl" }, t("User name", "用戶名稱"), h("input", { class: "field", autocomplete: "username", required: true, autofocus: true, onInput: (e) => (v.username = e.target.value) })),
    h("label", { class: "lbl" }, t("Password", "密碼"), h("input", { class: "field", type: "password", autocomplete: "current-password", required: true, onInput: (e) => (v.password = e.target.value) })),
    err,
    h("div", { class: "actions" }, h("button", { class: "btn f", type: "submit" }, t("Sign in", "登入"))))));
}

export function connectScreen(root, done, { owner = true, warning = null, setup = false } = {}) {
  const v = { host: "", port: "22", username: "", authType: "password", password: "" };
  const err = errorBox();
  let pending = null;
  let publicKey = null;
  let busy = false;

  const draw = () => {
    const authSeg = h("div", { class: "seg", role: "radiogroup", "aria-label": t("How to sign in to the router", "點樣登入路由器") }, [["password", t("Router password", "路由器密碼")], ["key", t("This app's SSH key", "程式嘅 SSH 金鑰")]].map(([id, label]) =>
      h("button", { type: "button", role: "radio", class: v.authType === id ? "on" : "", "aria-checked": String(v.authType === id), onClick: () => { v.authType = id; draw(); } }, label)));
    const form = h("form", { class: "card", onSubmit: connect },
      h("h1", { class: "disp" }, t("Connect your Asus router", "連接你嘅 Asus 路由器")),
      h("p", { class: "lede" }, t("This app manages the router over SSH. Turn SSH on first: in the router's own page, open Administration, then System, then set Enable SSH to LAN only.", "呢個程式經 SSH 管理路由器。請先開啟 SSH：喺路由器網頁入面，去「管理」→「系統」，將「啟用 SSH」設為「只限 LAN」。")),
      warning ? h("div", { class: "note bad" }, icon("warning"), warning) : null,
      owner ? null : h("div", { class: "note warn" }, icon("lock"), t("Only the owner can connect a router.", "只有擁有者可以連接路由器。")),
      h("div", { class: "two" },
        h("label", { class: "lbl" }, t("Router address", "路由器地址"), h("input", { class: "field", required: true, placeholder: "router.asus.com", autocomplete: "off", value: v.host, onInput: (e) => (v.host = e.target.value.trim()) })),
        h("label", { class: "lbl" }, t("SSH port", "SSH 端口"), h("input", { class: "field", inputmode: "numeric", value: v.port, onInput: (e) => (v.port = e.target.value.trim()) }))),
      h("label", { class: "lbl" }, t("Router user name", "路由器用戶名稱"), h("input", { class: "field", autocomplete: "off", required: true, value: v.username, onInput: (e) => (v.username = e.target.value.trim()) })),
      authSeg,
      v.authType === "password"
        ? h("label", { class: "lbl" }, t("Router password", "路由器密碼"), h("input", { class: "field", type: "password", autocomplete: "off", value: v.password, onInput: (e) => (v.password = e.target.value) }))
        : h("div", { class: "card tone" },
            h("div", { class: "t2" }, t("Create a key here, then paste its public half into the router: Administration, System, Authorized Keys.", "喺度建立金鑰，再將公開部分貼入路由器：「管理」→「系統」→「Authorized Keys」。")),
            publicKey ? h("div", { class: "fp" }, publicKey) : null,
            h("div", { class: "actions" },
              h("button", { class: "btn t sm", type: "button", onClick: async () => { try { publicKey = (await api.post("/api/router/key", { replace: true })).publicKey; draw(); } catch (e) { err.textContent = e.message; } } }, icon("key", "sm"), publicKey ? t("Make a new key", "重新建立金鑰") : t("Create a key", "建立金鑰")),
              publicKey ? h("button", { class: "btn t sm", type: "button", onClick: () => copyText(publicKey) }, icon("content_copy", "sm"), t("Copy", "複製")) : null)),
      err,
      h("div", { class: "actions" }, h("button", { class: "btn f", type: "submit", disabled: busy || !owner }, busy ? t("Connecting…", "連接緊…") : t("Connect", "連接"))));
    const hostCard = pending
      ? h("section", { class: "card" },
          h("h1", { class: "disp" }, pending.changed ? t("The router's key changed", "路由器嘅金鑰變咗") : t("Approve the router's host key", "核准路由器嘅主機金鑰")),
          h("p", { class: "lede" }, pending.changed
            ? t("This router showed a different key than the one you approved before. That can mean it was reset, or that something else is pretending to be it. Only approve if you reset the router yourself.", "呢部路由器出示嘅金鑰同你之前核准嘅唔同。可能係重設過，亦可能有其他裝置扮緊佢。除非你自己重設過路由器，否則唔好核准。")
            : t("The first time, the router introduces itself with a key. Compare this fingerprint with the one on the router if you can, then approve. After that, any other key is refused, so a look-alike cannot get your password.", "第一次連線，路由器會用一條金鑰自我介紹。可以嘅話，對比路由器上面嘅指紋，然後核准。之後任何其他金鑰都會被拒絕，所以假冒嘅裝置攞唔到你嘅密碼。")),
          h("div", { class: "fp" }, pending.fingerprint),
          h("p", { class: "lede" }, t("Check how the app signs in before approving. The user name is the exact SSH user name from the router's Administration, System page, and it is case-sensitive.", "核准之前，睇清楚程式點樣登入。用戶名稱要同路由器「系統管理 > 系統」頁面嘅 SSH 用戶名稱一模一樣，大小寫都要啱。")),
          h("label", { class: "lbl" }, t("Router user name", "路由器用戶名稱"), h("input", { class: "field", autocomplete: "off", autocapitalize: "off", spellcheck: "false", required: true, value: v.username, onInput: (e) => (v.username = e.target.value.trim()) })),
          authSeg,
          v.authType === "password" ? h("label", { class: "lbl" }, t("Router password", "路由器密碼"), h("input", { class: "field", type: "password", autocomplete: "current-password", value: v.password, onInput: (e) => (v.password = e.target.value) })) : null,
          err,
          h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => { pending = null; draw(); } }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: approve }, icon("verified_user", "sm"), t("Approve and connect", "核准並連接"))))
      : form;
    root.replaceChildren(frame(hostCard, setup ? (pending ? 3 : 2) : 0));
  };

  async function connect(e) {
    e.preventDefault();
    err.textContent = "";
    busy = true;
    draw();
    try {
      await api.post("/api/router/connect", { host: v.host, port: v.port, username: v.username, authType: v.authType, password: v.authType === "password" ? v.password : undefined });
      done();
    } catch (error) {
      busy = false;
      if (error.code === "HOST_KEY_UNKNOWN" || error.code === "HOST_KEY_CHANGED") pending = { fingerprint: error.data.fingerprint, changed: error.code === "HOST_KEY_CHANGED" };
      else err.textContent = error.message;
      draw();
    }
  }

  async function approve() {
    err.textContent = "";
    try {
      await api.post("/api/router/approve-host-key", { fingerprint: pending.fingerprint, username: v.username, authType: v.authType, password: v.authType === "password" ? v.password : undefined });
      toast(t("Router connected.", "已連接路由器。"));
      done();
    } catch (error) {
      err.textContent = error.message;
      draw();
    }
  }

  draw();
  // Start from the host's suggested router address and user name, when the app was given them.
  api.get("/api/router").then((info) => {
    const hint = info?.suggested;
    if (!hint) return;
    if (!v.host && hint.host) v.host = hint.host;
    if (!v.username && hint.username) v.username = hint.username;
    draw();
  }).catch(() => {});
}
