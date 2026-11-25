// The terminal screen: raw shell access for the owner, drawn by xterm.js.
// Keystrokes go to the server in small ordered batches and the shell's output
// comes back by long polling, so typing feels immediate on a home network.
import { installStyleShim } from "./styleshim.js";

const BASE = "/api/x/owner-terminal";

const loaded = new Map();
function loadScript(h, url) {
  if (!loaded.has(url)) loaded.set(url, new Promise((resolve, reject) => document.head.append(h("script", { src: url, onLoad: resolve, onError: () => (loaded.delete(url), reject(new Error("The terminal files could not be loaded."))) }))));
  return loaded.get(url);
}
function loadStyle(h, url) {
  if (!document.querySelector(`link[href="${url}"]`)) document.head.append(h("link", { rel: "stylesheet", href: url }));
}

export async function drawTerminal(ctx, root, { title, lede }) {
  const { api, h, icon, t, state, toast } = ctx;
  const owner = state.me?.role === "owner";
  const warning = h("section", { class: "card ot-warn" },
    h("div", { class: "row" }, icon("warning", "lg"), h("h2", { class: "h2 grow" }, t("Raw access to the router", "直接進入路由器"))),
    h("p", {}, t("Everything you type here runs on the router with full rights. Nothing is checked, previewed or undone, and one wrong line can lock you out or erase settings. Use the action catalogue when a card does the job.", "你喺呢度打嘅所有嘢都會以完整權限喺路由器執行。冇檢查、冇預覽、冇得還原，一行打錯可能令你鎖死自己或者清走設定。如果動作目錄有卡做到，請用佢。")),
    h("p", { class: "t2" }, t("Each session is written to Change history: who opened it, when, for how long and how much was typed. The text you type is not kept, because it can include passwords. Only the owner can open a terminal.", "每次連線都會寫入變更記錄：邊個開、幾時、幾耐、打咗幾多。你打嘅內容唔會保存，因為可能包含密碼。只有擁有者可以開終端機。")));
  const page = ctx.page(title, lede, warning);
  root.replaceChildren(page);
  if (!owner) {
    page.append(h("section", { class: "card" }, h("div", { class: "note" }, icon("lock"), h("div", {}, t("Your account cannot open the terminal. Ask the owner.", "你嘅帳戶開唔到終端機，請問擁有者。")))));
    return () => {};
  }

  const status = h("div", { class: "t2", role: "status", "aria-live": "polite" });
  const host = h("div", { class: "ot-term", role: "group", "aria-label": t("Terminal. Shift and Escape leave it.", "終端機。按 Shift 加 Esc 離開。"), hidden: true });
  const open = h("button", { class: "btn d" }, icon("terminal", "sm"), t("Open the terminal", "開啟終端機"));
  const bar = h("div", { class: "row ot-bar", hidden: true });
  page.append(h("section", { class: "card" }, h("div", { class: "actions ot-left" }, open), status, bar, host));

  let term = null;
  let fit = null;
  let sessionId = null;
  let alive = false;
  let unshim = null;
  let observer = null;
  let sendQueue = Promise.resolve();
  let pending = "";
  let flushTimer = null;
  let size = 14;

  const flush = () => {
    const data = pending;
    pending = "";
    flushTimer = null;
    if (!data || !sessionId) return;
    const id = sessionId;
    sendQueue = sendQueue.then(() => api.post(`${BASE}/sessions/${id}/input`, { data }).catch((error) => { if (alive) status.textContent = error.message; }));
  };

  async function pump(id) {
    let from = 0;
    let failures = 0;
    while (alive && sessionId === id) {
      try {
        const r = await api.get(`${BASE}/sessions/${id}?from=${from}&wait=10000`);
        failures = 0;
        from = r.next;
        if (r.text) term.write(r.text);
        if (r.closed) {
          term.write(`\r\n\x1b[33m[${t("Session ended", "連線已結束")}: ${r.closedReason ?? ""}]\x1b[0m\r\n`);
          return finished();
        }
      } catch (error) {
        failures += 1;
        status.textContent = error.message;
        if (error.status === 404 || failures > 20) return finished();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  function finished() {
    alive = false;
    sessionId = null;
    open.hidden = false;
    open.disabled = false;
    bar.hidden = true;
    status.textContent = t("The session has ended. Open the terminal again to start a new one.", "連線已結束。要再開就重新開啟終端機。");
  }

  async function start() {
    open.disabled = true;
    status.textContent = t("Loading the terminal…", "載入緊終端機…");
    try {
      loadStyle(h, `${BASE}/assets/xterm.css`);
      unshim ??= installStyleShim(document);
      await loadScript(h, `${BASE}/assets/xterm.js`);
      await loadScript(h, `${BASE}/assets/addon-fit.js`);
      host.hidden = false;
      term = new globalThis.Terminal({ cursorBlink: true, fontSize: size, fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace", scrollback: 5000, allowProposedApi: false, screenReaderMode: false, theme: { background: "#12141f", foreground: "#e8eaf6", cursor: "#9fa8ff", selectionBackground: "#3949ab99" } });
      fit = new globalThis.FitAddon.FitAddon();
      term.loadAddon(fit);
      term.open(host);
      fit.fit();
      term.attachCustomKeyEventHandler((e) => {
        if (e.type === "keydown" && e.key === "Escape" && e.shiftKey) { term.blur(); bar.querySelector("button")?.focus(); return false; }
        return true;
      });
      const started = await api.post(`${BASE}/sessions`, { cols: term.cols, rows: term.rows });
      sessionId = started.id;
      alive = true;
      open.hidden = true;
      bar.hidden = false;
      status.textContent = t("Connected. Shift and Escape leave the terminal without closing it.", "已連線。按 Shift 加 Esc 可以離開終端機（唔會關閉連線）。");
      term.onData((d) => { pending += d; if (!flushTimer) flushTimer = setTimeout(flush, 10); });
      let resizeTimer = null;
      term.onResize(({ cols, rows }) => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => sessionId && api.post(`${BASE}/sessions/${sessionId}/resize`, { cols, rows }).catch(() => {}), 150); });
      observer = new ResizeObserver(() => { try { fit.fit(); } catch {} });
      observer.observe(host);
      term.focus();
      pump(started.id);
    } catch (error) {
      toast(error.message, "bad");
      status.textContent = error.message;
      open.disabled = false;
    }
  }
  async function closeSession() {
    const id = sessionId;
    alive = false;
    sessionId = null;
    if (id) await api.del(`${BASE}/sessions/${id}`).catch(() => {});
  }

  bar.append(
    h("button", { class: "btn o sm", onClick: async () => { await closeSession(); term?.write(`\r\n\x1b[33m[${t("Closed", "已關閉")}]\x1b[0m\r\n`); finished(); } }, icon("power_settings_new", "sm"), t("Close the session", "關閉連線")),
    h("button", { class: "btn t sm", onClick: () => { const s = term.getSelection(); if (s) navigator.clipboard?.writeText(s).then(() => toast(t("Copied.", "已複製。"))).catch(() => toast(t("Could not copy.", "複製唔到。"), "bad")); } }, icon("content_copy", "sm"), t("Copy selection", "複製選取")),
    h("button", { class: "btn t sm", onClick: () => term.clear() }, icon("clear_all", "sm"), t("Clear screen", "清除畫面")),
    h("button", { class: "btn t sm", "aria-label": t("Smaller text", "細啲字"), onClick: () => { size = Math.max(10, size - 1); term.options.fontSize = size; fit.fit(); } }, icon("text_decrease", "sm")),
    h("button", { class: "btn t sm", "aria-label": t("Bigger text", "大啲字"), onClick: () => { size = Math.min(28, size + 1); term.options.fontSize = size; fit.fit(); } }, icon("text_increase", "sm")),
    h("label", { class: "ot-sr" }, h("input", { type: "checkbox", onChange: (e) => { term.options.screenReaderMode = e.target.checked; } }), t("Screen reader mode", "螢幕閱讀器模式")));
  open.addEventListener("click", start);

  // Leaving the screen closes the session: a shell nobody is watching is not left open.
  return () => {
    closeSession();
    clearTimeout(flushTimer);
    observer?.disconnect();
    term?.dispose();
    unshim?.();
  };
}
