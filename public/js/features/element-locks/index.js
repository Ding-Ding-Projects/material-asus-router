// Toy locks on every card. A small lock button sits on each card of the open
// screen. A locked card is truly disabled (its contents are inert) and shows
// its own unlock prompt; there is no shortcut or palette entry that opens it.
// The locks are just for fun: they stop accidents, not people.
const MIX_LABEL = {
  pin: { en: "PIN", yue: "PIN" },
  password: { en: "Password", yue: "密碼" },
  "pin+password": { en: "PIN and password", yue: "PIN 加密碼" },
  "password+totp": { en: "Password and one-time code", yue: "密碼加一次性驗證碼" },
  "pin+totp": { en: "PIN and one-time code", yue: "PIN 加一次性驗證碼" },
  "pin+password+totp": { en: "PIN, password and one-time code", yue: "PIN、密碼加一次性驗證碼" },
};
const NS = "http://www.w3.org/2000/svg";

function drawQr(qr, description) {
  const total = qr.size + 8;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${total} ${total}`);
  svg.setAttribute("class", "el-qr");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", description);
  const back = document.createElementNS(NS, "rect");
  back.setAttribute("width", String(total));
  back.setAttribute("height", String(total));
  back.setAttribute("fill", "#fff");
  svg.append(back);
  const path = document.createElementNS(NS, "path");
  let d = "";
  qr.rows.forEach((row, y) => [...row].forEach((c, x) => c === "1" && (d += `M${x + 4} ${y + 4}h1v1h-1z`)));
  path.setAttribute("d", d);
  path.setAttribute("fill", "#000");
  svg.append(path);
  return svg;
}

// A PIN box with an on-screen keypad. Typing and the keypad edit the same value.
function pinField(ctx, label) {
  const { h, icon, t } = ctx;
  const input = h("input", { class: "field el-pin", type: "password", inputmode: "numeric", autocomplete: "off", maxlength: "8", "aria-label": label });
  input.addEventListener("input", () => (input.value = input.value.replace(/\D/g, "").slice(0, 8)));
  const press = (d) => {
    if (input.value.length < 8) input.value += d;
    input.focus();
  };
  const keys = [..."123456789", "back", "0", "clear"].map((k) => h("button", { type: "button", class: "btn t el-key", "aria-label": k === "back" ? t("Delete last digit", "刪除最後一個數字") : k === "clear" ? t("Clear", "清除") : k, onClick: () => (k === "back" ? ((input.value = input.value.slice(0, -1)), input.focus()) : k === "clear" ? ((input.value = ""), input.focus()) : press(k)) }, k === "back" ? icon("backspace", "sm") : k === "clear" ? icon("close", "sm") : k));
  return { el: h("div", { class: "el-pinbox" }, input, h("div", { class: "el-keypad", role: "group", "aria-label": t("Keypad", "數字鍵盤") }, keys)), value: () => input.value, focus: () => input.focus() };
}

function credentialInputs(ctx, mix) {
  const { h, t } = ctx;
  const need = { pin: mix.includes("pin"), password: mix.includes("password"), totp: mix.includes("totp") };
  const pin = need.pin ? pinField(ctx, t("PIN", "PIN")) : null;
  const password = need.password ? h("input", { class: "field", type: "password", autocomplete: "off", "aria-label": t("Password", "密碼") }) : null;
  const code = need.totp ? h("input", { class: "field", inputmode: "numeric", maxlength: "8", autocomplete: "one-time-code", "aria-label": t("One-time code", "一次性驗證碼") }) : null;
  return { nodes: [pin && h("label", {}, t("PIN", "PIN"), pin.el), password && h("label", {}, t("Password", "密碼"), password), code && h("label", {}, t("One-time code", "一次性驗證碼"), code)], values: () => ({ pin: pin?.value(), password: password?.value, code: code?.value }), focus: () => (pin?.focus() ?? password?.focus() ?? code?.focus()) };
}

export default {
  id: "element-locks",
  overlays: [{
    id: "element-locks.cards",
    mount(ctx) {
      const { api, h, icon, t, openDialog, bus, state } = ctx;
      let locks = new Map();
      let disclosure = "";
      let scheduled = false;

      async function refresh() {
        try {
          const out = await api.get("/api/x/element-locks/state");
          locks = new Map(out.locks.map((l) => [l.key, l]));
          disclosure = out.disclosure;
        } catch {
          locks = new Map();
        }
        paint();
      }

      const cardKey = (card, index, used) => {
        const title = card.querySelector("h2,h3,.k")?.textContent?.trim().replace(/\s+/g, " ").slice(0, 60) || `card ${index + 1}`;
        let key = `${state.route}: ${title}`.replace(/[^A-Za-z0-9:._ /-]/g, "-");
        while (used.has(key)) key += "+";
        used.add(key);
        return key;
      };

      function paint() {
        scheduled = false;
        const content = document.getElementById("content");
        if (!content) return;
        const used = new Set();
        content.querySelectorAll(".card").forEach((card, index) => {
          if (card.closest("dialog")) return;
          const key = card.dataset.lockKey ?? (card.dataset.lockKey = cardKey(card, index, used));
          used.add(key);
          const lock = locks.get(key);
          const isLocked = Boolean(lock?.locked);
          let button = card.querySelector(":scope > .el-lockbtn");
          if (!button) {
            button = h("button", { class: "icb el-lockbtn", type: "button" });
            card.append(button);
          }
          button.replaceChildren(icon(isLocked ? "lock" : lock ? "lock_open" : "lock_open_right", "sm"));
          button.setAttribute("aria-label", lock ? t(isLocked ? "Unlock this card" : "Lock this card again", isLocked ? "解鎖呢張卡" : "再鎖呢張卡") : t("Lock this card", "鎖住呢張卡"));
          button.onclick = () => (lock ? (isLocked ? unlockPrompt(key, lock) : relock(key)) : wizard(key));
          let cover = card.querySelector(":scope > .el-cover");
          if (isLocked) {
            if (!cover) {
              cover = h("button", { class: "el-cover", type: "button" }, icon("lock", "lg"), h("span", {}, t("Locked. Press to unlock.", "已鎖住。撳一下解鎖。")));
              card.append(cover);
            }
            cover.onclick = () => unlockPrompt(key, lock);
            card.classList.add("el-locked");
            for (const child of card.children) if (child !== cover && child !== button) child.setAttribute("inert", "");
            card.setAttribute("aria-disabled", "true");
          } else {
            cover?.remove();
            card.classList.remove("el-locked");
            for (const child of card.children) child.removeAttribute("inert");
            card.removeAttribute("aria-disabled");
          }
        });
      }

      async function relock(key) {
        await api.post("/api/x/element-locks/relock", { key });
        await refresh();
      }

      function support() {
        const detail = { claimed: false };
        bus.emit("support:open", detail);
        if (!detail.claimed) ctx.toast(t("The Support Tickets desk is not available.", "支援票務處用唔到。"), "bad");
      }

      function unlockPrompt(key, lock) {
        let lastMessage = "";
        openDialog((close, render) => {
          const form = credentialInputs(ctx, lock.mix);
          const msg = h("p", { class: "el-msg", role: "alert" }, lastMessage);
          const go = async () => {
            try {
              await api.post("/api/x/element-locks/unlock", { key, ...form.values() });
              close(true);
              await refresh();
            } catch (error) {
              lastMessage = error.message;
              await refresh();
              lock.waitSeconds = locks.get(key)?.waitSeconds ?? 0;
              render();
            }
          };
          return [
            h("h2", { class: "h2" }, icon("lock"), " ", t("Unlock this card", "解鎖呢張卡")),
            h("p", { class: "muted" }, t(MIX_LABEL[lock.mix].en, MIX_LABEL[lock.mix].yue)),
            ...form.nodes,
            msg,
            lock.waitSeconds > 0 ? h("div", { class: "note warn" }, icon("hourglass_bottom"), t(`Waiting about ${lock.waitSeconds} seconds after too many wrong tries. The unlock ladder can clear the wait, but never the PIN or password.`, `嘗試錯誤太多，要等大約 ${lock.waitSeconds} 秒。解鎖階梯可以清除等候時間，但唔會清除 PIN 或密碼。`)) : null,
            h("p", { class: "muted el-fun" }, t("This lock is just for fun. It stops accidents; it is not a safe.", "呢個鎖只係好玩。佢防止誤撳，唔係保險箱。")),
            h("div", { class: "actions" },
              h("button", { class: "btn o sm", onClick: support }, icon("support_agent", "sm"), t("I forgot it", "我唔記得")),
              h("button", { class: "btn o sm", onClick: () => { const detail = { lockKey: key, claimed: false, respond: () => refresh() }; bus.emit("ladder:open", detail); if (!detail.claimed) ctx.toast(t("The unlock ladder is not available.", "解鎖階梯用唔到。"), "bad"); } }, icon("stairs", "sm"), t("Clear the wait", "清除等候")),
              h("button", { class: "btn o", onClick: () => close(false) }, t("Cancel", "取消")),
              h("button", { class: "btn f", onClick: go }, icon("lock_open", "sm"), t("Unlock", "解鎖"))),
          ];
        }, { label: t("Unlock this card", "解鎖呢張卡") });
      }

      function wizard(key) {
        const wiz = { step: 0, mix: "pin" };
        openDialog((close, render) => {
          const msg = h("p", { class: "el-msg", role: "alert" });
          const needTotp = () => wiz.mix.includes("totp");
          if (wiz.step === 0)
            return [
              h("h2", { class: "h2" }, icon("lock"), " ", t("Lock this card", "鎖住呢張卡")),
              h("p", {}, t("Choose what unlocking needs. Each lock has its own credentials and there is no master one.", "揀解鎖需要咩。每個鎖有自己嘅憑證，冇萬能憑證。")),
              h("div", { class: "el-mixes", role: "radiogroup", "aria-label": t("Credential mix", "憑證組合") }, Object.entries(MIX_LABEL).map(([id, l]) => h("button", { class: `btn ${wiz.mix === id ? "f" : "o"}`, role: "radio", "aria-checked": String(wiz.mix === id), onClick: () => { wiz.mix = id; render(); } }, t(l.en, l.yue)))),
              h("div", { class: "note warn" }, icon("sentiment_satisfied"), disclosure || t("This lock is just for fun. If you forget it, clearing this app's local data is the way back.", "呢個鎖只係好玩。如果唔記得，清除呢個程式嘅本機資料就可以返轉頭。")),
              h("div", { class: "actions" }, h("button", { class: "btn o sm", onClick: support }, icon("support_agent", "sm"), t("How recovery works", "點樣復原")), h("button", { class: "btn o", onClick: () => close() }, t("Cancel", "取消")), h("button", { class: "btn f", onClick: () => { wiz.step = 1; render(); } }, t("Next", "下一步"))),
            ];
          if (wiz.step === 1) {
            wiz.form ??= credentialInputs(ctx, wiz.mix.replace("+totp", ""));
            return [
              h("h2", { class: "h2" }, t("Set the credentials", "設定憑證")),
              ...wiz.form.nodes,
              msg,
              h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => { wiz.form = null; wiz.step = 0; render(); } }, t("Back", "上一步")), h("button", { class: "btn f", onClick: async () => {
                wiz.values = wiz.form.values();
                if (!needTotp()) return void (await finish(wiz.values));
                try {
                  wiz.totp = await api.post("/api/x/element-locks/prepare-totp", { key });
                  try { wiz.qr = await api.post("/api/x/qr-pairing/qr", { text: wiz.totp.uri }); } catch { wiz.qr = null; }
                  wiz.step = 2;
                  render();
                } catch (error) {
                  msg.textContent = error.message;
                }
              } }, needTotp() ? t("Next", "下一步") : t("Lock it", "鎖住"))),
            ];
          }
          const code = h("input", { class: "field", inputmode: "numeric", maxlength: "8", autocomplete: "one-time-code", "aria-label": t("Code from your authenticator", "驗證器顯示嘅驗證碼") });
          return [
            h("h2", { class: "h2" }, t("Add the one-time code", "加入一次性驗證碼")),
            wiz.qr ? h("div", { class: "el-qrwrap" }, drawQr(wiz.qr, t("QR code for this lock", "呢個鎖嘅二維碼"))) : null,
            h("div", { class: "mono" }, wiz.totp.secret),
            h("p", { class: "muted" }, t("Add it to an authenticator app, then type the code it shows.", "加入驗證器程式，然後輸入佢顯示嘅驗證碼。")),
            code,
            msg,
            h("div", { class: "actions" }, h("button", { class: "btn o", onClick: () => { wiz.step = 1; wiz.form = null; render(); } }, t("Back", "上一步")), h("button", { class: "btn f", onClick: () => finish({ ...wiz.values, code: code.value }) }, t("Check and lock", "核對並鎖住"))),
          ];

          async function finish(values) {
            try {
              await api.post("/api/x/element-locks/lock", { key, mix: wiz.mix, ...values });
              close(true);
              ctx.toast(t("Locked. Remember: it is just for fun.", "已鎖住。記住：只係好玩。"));
              await refresh();
            } catch (error) {
              msg.textContent = error.message;
            }
          }
        }, { label: t("Lock this card", "鎖住呢張卡") });
      }

      const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(paint);
      };
      const content = document.getElementById("content");
      const observer = new MutationObserver((records) => {
        const ours = (n) => n.nodeType === 1 && (n.classList.contains("el-lockbtn") || n.classList.contains("el-cover") || n.closest?.(".el-lockbtn,.el-cover"));
        if (records.some((r) => !ours(r.target) && [...r.addedNodes].some((n) => n.nodeType === 1 && !ours(n)))) schedule();
      });
      if (content) observer.observe(content, { childList: true, subtree: true });
      const off = bus.on("lang", () => refresh());
      refresh();
      return () => {
        observer.disconnect();
        off();
      };
    },
  }],
};
