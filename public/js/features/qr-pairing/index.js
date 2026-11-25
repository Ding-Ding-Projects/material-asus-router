// Account two-factor pairing: a QR code drawn in this page (no online service)
// beside the secret, algorithm, digits and period. The secret is revealed only
// when the person asks, and the factor arms only after a current code is typed.
import { drawQr } from "./qr-view.js";

const label = { en: "Account two-factor", yue: "帳戶雙重驗證" };
const group = { en: "Safety", yue: "安全" };

async function render(ctx) {
  const { api, h, icon, t, toast } = ctx;
  const root = ctx.root;
  const body = h("div", { class: "pair" });
  root.append(ctx.page(label, { en: "Pair an authenticator app so signing in needs a code from your phone. The secret is made here and shown only when you ask.", yue: "配對驗證器程式，登入就要用手機嘅驗證碼。密碼喺呢度產生，要你主動去睇先會顯示。" }, body));
  let session = null;

  async function draw() {
    const status = await api.get("/api/x/qr-pairing/status");
    body.replaceChildren();
    if (status.armed) {
      body.append(
        h("section", { class: "card sec" },
          h("div", { class: "k" }, t("Two-factor is armed", "雙重驗證已啟用")),
          h("p", {}, t(`Armed ${status.armedAt}. ${status.algorithm}, ${status.digits} digits, ${status.period} seconds.`, `啟用於 ${status.armedAt}。${status.algorithm}，${status.digits} 位，${status.period} 秒。`)),
          h("div", { class: "note warn" }, icon("info"), t("In progress: the sign-in page does not ask for this code yet, because that needs a change to the shared sign-in route. The factor is stored and verified, not yet enforced.", "進行中：登入頁暫時未會問呢個驗證碼，因為要改動共用嘅登入路由。驗證因素已儲存同驗證，但未強制執行。")),
          h("div", { class: "actions" }, h("button", { class: "btn o", onClick: disarm }, icon("lock_open", "sm"), t("Turn off with a current code", "用現時驗證碼關閉")))),
      );
      return;
    }
    if (!session) {
      const algorithm = h("select", { class: "field", "aria-label": t("Algorithm", "演算法") }, ["SHA1", "SHA256", "SHA512"].map((a) => h("option", { value: a }, a)));
      const digits = h("select", { class: "field", "aria-label": t("Digits", "位數") }, [6, 7, 8].map((d) => h("option", { value: String(d) }, String(d))));
      const period = h("input", { class: "field", type: "number", min: "1", max: "3600", value: "30", "aria-label": t("Period in seconds", "更新間隔（秒）") });
      body.append(h("section", { class: "card" },
        h("div", { class: "k" }, t("Step 1: choose the code style", "第 1 步：揀驗證碼格式")),
        h("div", { class: "grid2" }, h("label", {}, t("Algorithm", "演算法"), algorithm), h("label", {}, t("Digits", "位數"), digits), h("label", {}, t("Period (seconds)", "間隔（秒）"), period)),
        h("p", { class: "muted" }, t("Most authenticator apps use SHA1, 6 digits and 30 seconds.", "大部分驗證器程式用 SHA1、6 位、30 秒。")),
        h("div", { class: "actions" }, h("button", { class: "btn f", onClick: async () => {
          try {
            session = await api.post("/api/x/qr-pairing/begin", { algorithm: algorithm.value, digits: Number(digits.value), period: Number(period.value) });
            draw();
          } catch (error) {
            toast(error.message, "bad");
          }
        } }, icon("qr_code_2", "sm"), t("Make a secret", "產生密碼")))));
      return;
    }
    const reveal = h("div", {});
    const code = h("input", { class: "field", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "8", "aria-label": t("Code from your authenticator", "驗證器顯示嘅驗證碼") });
    const showSecret = async () => {
      try {
        const out = await api.post("/api/x/qr-pairing/reveal", { id: session.id });
        reveal.replaceChildren(
          h("div", { class: "qrwrap" }, drawQr(ctx, out.qr, t("QR code to scan with your authenticator app", "用驗證器程式掃描嘅二維碼"))),
          h("div", { class: "mono secret", "aria-label": t("Secret", "密碼") }, out.secret),
          h("div", { class: "chips" }, h("span", { class: "chip" }, out.algorithm), h("span", { class: "chip" }, `${out.digits} ${t("digits", "位")}`), h("span", { class: "chip" }, `${out.period} s`)),
          h("div", { class: "actions" }, h("button", { class: "btn t sm", onClick: () => ctx.copy?.(out.secret) ?? navigator.clipboard?.writeText(out.secret).then(() => toast(t("Copied.", "已複製。")), () => {}) }, icon("content_copy", "sm"), t("Copy secret", "複製密碼"))),
        );
      } catch (error) {
        toast(error.message, "bad");
      }
    };
    body.append(h("section", { class: "card" },
      h("div", { class: "k" }, t("Step 2: add it to your authenticator", "第 2 步：加入驗證器")),
      h("p", {}, t("Nothing is shown until you press the button. Nothing is stored until you finish step 3.", "撳掣之前唔會顯示任何嘢；做完第 3 步之前唔會儲存任何嘢。")),
      h("div", { class: "actions" }, h("button", { class: "btn t", onClick: showSecret }, icon("visibility", "sm"), t("Reveal the secret and QR code", "顯示密碼同二維碼"))),
      reveal,
      h("div", { class: "k" }, t("Step 3: type a current code", "第 3 步：輸入現時驗證碼")),
      code,
      h("div", { class: "actions" },
        h("button", { class: "btn o", onClick: async () => { await api.post("/api/x/qr-pairing/cancel").catch(() => {}); session = null; draw(); } }, t("Cancel", "取消")),
        h("button", { class: "btn f", onClick: async () => {
          try {
            await api.post("/api/x/qr-pairing/confirm", { id: session.id, code: code.value });
            session = null;
            toast(t("Two-factor armed.", "雙重驗證已啟用。"));
            draw();
          } catch (error) {
            toast(error.message, "bad");
            code.select();
          }
        } }, icon("verified", "sm"), t("Check the code and arm", "核對驗證碼並啟用")))));
  }

  async function disarm() {
    const input = h("input", { class: "field", inputmode: "numeric", maxlength: "8", "aria-label": t("Current code", "現時驗證碼") });
    const ok = await ctx.openDialog((close) => [h("h2", { class: "h2" }, t("Turn off two-factor", "關閉雙重驗證")), h("p", {}, t("Type a current code to prove it is you.", "輸入現時驗證碼證明係你。")), input, h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")), h("button", { class: "btn d", onClick: () => close(true) }, t("Turn off", "關閉")))], { label: t("Turn off two-factor", "關閉雙重驗證") }).closed;
    if (!ok) return;
    try {
      await api.post("/api/x/qr-pairing/disarm", { code: input.value });
      toast(t("Two-factor is off.", "雙重驗證已關閉。"));
    } catch (error) {
      toast(error.message, "bad");
    }
    draw();
  }

  await draw();
}

export default {
  id: "qr-pairing",
  screens: [{ id: "qr-pairing", group, icon: "qr_code_2", label, render }],
  settings: [{ id: "qr-pairing", icon: "qr_code_2", label, async render(ctx) {
    const status = await ctx.api.get("/api/x/qr-pairing/status");
    return ctx.h("div", {}, ctx.h("p", {}, status.armed ? ctx.t("Two-factor is armed for your account.", "你嘅帳戶已啟用雙重驗證。") : ctx.t("Two-factor is not set up.", "未設定雙重驗證。")), ctx.h("button", { class: "btn t", onClick: () => ctx.navigate("qr-pairing") }, ctx.t("Open pairing", "開啟配對")));
  } }],
  commands: [{ id: "qr-pairing.open", icon: "qr_code_2", label: { en: "Pair account two-factor", yue: "配對帳戶雙重驗證" }, keywords: "2fa totp qr authenticator", run: (ctx) => ctx.navigate("qr-pairing") }],
};
