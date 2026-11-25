// Local Ollama suite manager. Connects to an Ollama server the person names
// (this computer or another on the network), lists, pulls and deletes models,
// shows hardware fit, and tests a chat. When the server cannot be reached it
// says so and shows what to check. The address is kept in this browser.
import { makeUi } from "./ui.js";
import { load, save } from "./store.js";

const label = { en: "Local models (Ollama)", yue: "本地模型（Ollama）" };
const BASE = "/api/x/ollama-suite";
const VERDICT = {
  "runs-well": ["good", { en: "Runs well", yue: "行得好順" }],
  "runs-limits": ["warn", { en: "Runs with limits", yue: "行得到但有限制" }],
  unlikely: ["bad", { en: "Unlikely", yue: "好難行到" }],
  unknown: ["", { en: "Unknown", yue: "未知" }],
};
const gb = (bytes) => `${(bytes / 1e9).toFixed(bytes > 1e10 ? 0 : 1)} GB`;

function render(ctx) {
  const { h, icon, t, tt, api, toast, confirmDialog } = ctx;
  const ui = makeUi(ctx);
  const conn = { scheme: "http", host: "localhost", port: 11434, ram: 16, vram: 0, ...load("connection", {}) };
  const persist = () => save("connection", conn);
  const endpoint = () => ({ scheme: conn.scheme, host: conn.host, port: conn.port });
  const view = { status: null, recommended: [], verdicts: new Map(), cart: new Set(), jobs: [], chat: load("chat", []), model: load("chat-model", "") };
  const readOnly = !ctx.state.canWrite;

  const statusBox = h("div", {});
  const modelsBox = h("div", {});
  const storeBox = h("div", {});
  const jobsBox = h("div", { class: "list" });
  const chatLog = h("div", { class: "list", role: "log", "aria-live": "polite" });
  const busy = (button, on) => { button.disabled = on; };

  // ---- connection ---------------------------------------------------------
  async function connect(quiet = false) {
    statusBox.replaceChildren(h("div", { class: "t2" }, t("Connecting…", "連接緊…")));
    try {
      view.status = await api.post(`${BASE}/status`, { endpoint: endpoint() });
    } catch (error) {
      view.status = null;
      statusBox.replaceChildren(h("div", { class: "note bad", role: "alert" }, icon("error", "sm"), error.message));
      return;
    }
    drawStatus();
    drawModels();
    drawStore();
    drawChatModels();
    if (!quiet && view.status.reachable) toast(t("Connected to Ollama.", "已連接 Ollama。"));
  }

  function drawStatus() {
    const s = view.status;
    if (!s) return;
    statusBox.replaceChildren(s.reachable
      ? h("div", { class: "note" }, icon("check_circle", "sm"), t(`Connected. Ollama ${s.version}, ${s.models.length} model(s) installed, ${s.running.length} running.`, `已連接。Ollama ${s.version}，已安裝 ${s.models.length} 個模型，${s.running.length} 個運行中。`))
      : h("div", { class: "note bad", role: "alert" }, icon("link_off", "sm"), h("div", {}, h("div", { class: "t1" }, t("Cannot reach Ollama", "連唔到 Ollama")), h("div", {}, s.reason),
        h("div", { class: "t2" }, t("Things to check, in order:", "按次序檢查：")), h("ol", {}, s.steps.map((step) => h("li", {}, step))))));
  }

  const portField = ui.stepper(1, 65535, 1, "", conn.port, (v) => { conn.port = v; persist(); }, { en: "Port", yue: "埠" });
  const connection = h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Connection", "連線")),
    ui.row({ en: "Protocol", yue: "協定" }, { en: "Plain http is normal for a server on your own network.", yue: "自己網絡入面嘅伺服器通常用 http。" }, ui.seg([["http", "http"], ["https", "https"]], conn.scheme, (v) => { conn.scheme = v; persist(); }, { en: "Protocol", yue: "協定" }).el),
    ui.row({ en: "Host", yue: "主機" }, { en: "A host name or an address. Use localhost for this computer.", yue: "主機名或地址。呢部電腦用 localhost。" }, ui.text(conn.host, { maxLength: 100, aria: { en: "Host", yue: "主機" }, hint: { en: "For example localhost or ollama.local", yue: "例如 localhost 或 ollama.local" }, onChange(v) { conn.host = v.trim(); persist(); } }).el),
    ui.row({ en: "Port", yue: "埠" }, { en: "Ollama's default is 11434.", yue: "Ollama 預設係 11434。" }, h("div", { class: "portpick" }, portField.el, h("div", { class: "chips" }, h("button", { class: "chip", type: "button", onClick() { conn.port = 11434; portField.set(11434); persist(); } }, "11434")))),
    h("div", { class: "chips" }, h("button", { class: "btn f", type: "button", onClick() { connect(); } }, icon("power", "sm"), t("Connect", "連接")), h("button", { class: "btn o", type: "button", onClick() { connect(); } }, icon("refresh", "sm"), t("Refresh", "重新整理"))),
    statusBox);

  // ---- installed models ---------------------------------------------------
  function drawModels() {
    const s = view.status;
    modelsBox.replaceChildren(h("h2", { class: "h2" }, t("Installed models", "已安裝模型")),
      !s?.reachable ? h("div", { class: "t2" }, t("Connect to see the models on that server.", "連接後先見到嗰部伺服器嘅模型。")) :
        s.models.length ? s.models.map((m) => h("div", { class: "row" }, icon("neurology", "sm"), h("span", { class: "grow" }, h("div", { class: "t1" }, m.name), h("div", { class: "t2" }, [m.family, m.parameters, m.quantization].filter(Boolean).join(" · "))),
          s.running.some((r) => r.name === m.name) ? h("span", { class: "tag good" }, t("Running", "運行中")) : null, h("span", { class: "tag" }, gb(m.size)),
          h("button", { class: "btn o sm", type: "button", disabled: ctx.state.me?.role !== "owner", title: ctx.state.me?.role !== "owner" ? t("Only the owner can delete models.", "只有擁有者可以刪除模型。") : undefined, async onClick() {
            if (!(await confirmDialog({ title: t(`Delete ${m.name}?`, `刪除 ${m.name}？`), body: t("The model is removed from that server. You can download it again later.", "模型會由嗰部伺服器移除。之後可以再下載。"), confirm: t("Delete", "刪除"), danger: true }))) return;
            try { await api.post(`${BASE}/delete`, { endpoint: endpoint(), model: m.name }); toast(t("Deleted.", "已刪除。")); connect(true); } catch (error) { toast(error.message, "bad"); }
          } }, icon("delete", "sm"), t("Delete", "刪除")))) : h("div", { class: "t2" }, t("No models installed yet. Pick some below.", "未有安裝模型。喺下面揀。")));
  }

  // ---- store, fit and the batch cart -----------------------------------------
  async function drawStore() {
    try {
      if (!view.recommended.length) view.recommended = (await api.get(`${BASE}/recommended`)).models;
      const fit = await api.post(`${BASE}/fit`, { ramGb: conn.ram, vramGb: conn.vram });
      view.verdicts = new Map(fit.verdicts.map((v) => [v.name, v.verdict]));
    } catch (error) {
      storeBox.replaceChildren(h("div", { class: "note bad" }, icon("error", "sm"), error.message));
      return;
    }
    const installed = new Set(view.status?.models?.map((m) => m.name) ?? []);
    const pull = h("button", { class: "btn f", type: "button", disabled: !view.cart.size || readOnly, async onClick() {
      busy(pull, true);
      try { view.jobs = (await api.post(`${BASE}/pull`, { endpoint: endpoint(), models: [...view.cart] })).jobs; view.cart.clear(); poll(); drawStore(); } catch (error) { toast(error.message, "bad"); }
    } }, icon("download", "sm"), t(`Download ${view.cart.size} selected`, `下載已選嘅 ${view.cart.size} 個`));
    storeBox.replaceChildren(h("h2", { class: "h2" }, t("Model store (starter list)", "模型庫（起步清單）")),
      h("div", { class: "t2" }, t("A short list of well-known models, not the whole official catalogue. Sizes are approximate downloads. The cart downloads the chosen models one after another and nothing else.", "著名模型嘅短清單，唔係完整官方目錄。大小係約數。購物車只會逐個下載揀咗嘅模型，唔會做其他嘢。")),
      ui.row({ en: "Memory of the server computer", yue: "伺服器電腦嘅記憶體" }, { en: "Used only to judge which models fit. It is not sent anywhere else.", yue: "只用嚟判斷邊啲模型合適，唔會傳去其他地方。" }, h("div", { class: "ctl" }, ui.stepper(0, 2048, 1, "GB RAM", conn.ram, (v) => { conn.ram = v; persist(); drawStore(); }, { en: "RAM in gigabytes", yue: "記憶體（GB）" }).el, ui.stepper(0, 512, 1, "GB VRAM", conn.vram, (v) => { conn.vram = v; persist(); drawStore(); }, { en: "Video memory in gigabytes", yue: "顯示記憶體（GB）" }).el)),
      view.recommended.map((m) => {
        const [kind, text] = VERDICT[view.verdicts.get(m.name) ?? "unknown"];
        const have = installed.has(m.name);
        return h("div", { class: "row" }, h("input", { type: "checkbox", disabled: have || readOnly, checked: view.cart.has(m.name), "aria-label": m.name, onChange(e) { e.target.checked ? view.cart.add(m.name) : view.cart.delete(m.name); drawStore(); } }),
          h("span", { class: "grow" }, h("div", { class: "t1" }, m.name), h("div", { class: "t2" }, t(m.about, m.aboutYue))), h("span", { class: "tag" }, `${m.sizeGb} GB`), h("span", { class: `tag ${kind}` }, tt(text)), have ? h("span", { class: "tag good" }, t("Installed", "已安裝")) : null);
      }),
      h("div", { class: "chips" }, pull));
  }

  let polling = false;
  async function poll() {
    if (polling) return;
    polling = true;
    try {
      for (let i = 0; i < 4000; i += 1) {
        const { jobs } = await api.get(`${BASE}/jobs`);
        view.jobs = jobs;
        jobsBox.replaceChildren(jobs.slice(0, 12).map((j) => h("div", { class: "row" }, h("span", { class: `tag ${j.status === "done" ? "good" : j.status === "failed" ? "bad" : ""}` }, j.status), h("span", { class: "grow" }, j.model, j.detail ? ` · ${j.detail}` : ""),
          j.total ? h("progress", { max: String(j.total), value: String(j.completed), "aria-label": j.model }) : null, j.error ? h("span", { class: "err" }, j.error) : null,
          ["queued", "pulling"].includes(j.status) ? h("button", { class: "btn o sm", type: "button", onClick: () => api.post(`${BASE}/cancel`, { id: j.id }) }, t("Cancel", "取消")) : null)));
        if (!jobs.some((j) => ["queued", "pulling"].includes(j.status))) { connect(true); break; }
        await new Promise((r) => setTimeout(r, 1500));
        if (!jobsBox.isConnected) break;
      }
    } catch { /* the screen was closed or the server went away; the next visit starts again */ } finally { polling = false; }
  }

  // ---- chat -------------------------------------------------------------------
  const modelSelect = h("select", { class: "field", "aria-label": t("Model for the chat", "傾偈用嘅模型"), onChange(e) { view.model = e.target.value; save("chat-model", view.model); } });
  function drawChatModels() {
    const names = view.status?.models?.map((m) => m.name) ?? [];
    modelSelect.replaceChildren(...(names.length ? names : [""]).map((n) => h("option", { value: n, selected: n === view.model }, n || t("No models", "冇模型"))));
    if (names.length && !names.includes(view.model)) { view.model = names[0]; modelSelect.value = view.model; }
  }
  function drawChat() {
    chatLog.replaceChildren(view.chat.slice(-30).map((m) => h("div", { class: `row ${m.role === "user" ? "" : "tone"}` }, h("span", { class: "tag" }, m.role === "user" ? t("You", "你") : "Ollama"), h("span", { class: "grow" }, m.content))));
  }
  const input = h("textarea", { class: "field", rows: "3", "aria-label": t("Message", "訊息"), placeholder: t("Say something to the model", "同模型講啲嘢") });
  const send = h("button", { class: "btn f", type: "button", disabled: readOnly, async onClick() {
    const text = input.value.trim();
    if (!text) return;
    if (!view.model) return toast(t("Connect and pick a model first.", "請先連接並揀模型。"), "bad");
    view.chat.push({ role: "user", content: text });
    input.value = "";
    drawChat();
    busy(send, true);
    try {
      const out = await api.post(`${BASE}/chat`, { endpoint: endpoint(), model: view.model, messages: view.chat });
      view.chat.push({ role: "assistant", content: out.message.content });
    } catch (error) {
      view.chat.push({ role: "assistant", content: t(`Could not answer: ${error.message}`, `答唔到：${error.message}`) });
    } finally {
      busy(send, false);
      save("chat", view.chat.slice(-40));
      drawChat();
    }
  } }, icon("send", "sm"), t("Send", "傳送"));
  const chatCard = h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Chat test", "傾偈測試")), modelSelect, chatLog, input,
    h("div", { class: "chips" }, send, h("button", { class: "btn o", type: "button", async onClick() { if (await confirmDialog({ title: t("Clear the chat?", "清除對話？"), body: t("This only clears what is kept in this browser.", "只會清除呢個瀏覽器入面嘅記錄。"), confirm: t("Clear", "清除"), danger: true })) { view.chat = []; save("chat", []); drawChat(); } } }, icon("delete", "sm"), t("Clear", "清除"))));

  const progress = h("div", { class: "note warn" }, icon("construction", "sm"),
    t("In progress: the one-click Ollama installer and missing-runtime recovery, the complete official model catalogue with every tag, image and file attachments in chat, and the allowlisted profile launch with snapshots and automatic rollback. Connecting, listing, downloading in a batch, deleting, the hardware fit check and the chat test work now.", "進行中：一鍵 Ollama 安裝同缺少執行環境嘅修復、完整官方模型目錄同每個標籤、傾偈入面嘅圖片同檔案附件，同有白名單、快照同自動回復嘅設定檔啟動。而家可以用嘅有：連接、列出、批次下載、刪除、硬件配合度檢查同傾偈測試。"));

  ctx.root.append(ctx.page(label, { en: "Manage the models of an Ollama server you choose, from this app.", yue: "喺呢個程式管理你揀嘅 Ollama 伺服器嘅模型。" }));
  const page = ctx.root.firstChild;
  page.append(connection, h("div", { class: "grid2" }, h("section", { class: "card rise" }, modelsBox), h("section", { class: "card rise" }, storeBox, jobsBox)), chatCard, progress);
  drawChat();
  connect(true);
  poll();
}

export default {
  id: "ollama-suite",
  screens: [{ id: "ollama-suite", group: { en: "Tools", yue: "工具" }, icon: "neurology", label, render }],
  commands: [{ id: "ollama-suite.open", icon: "neurology", label: { en: "Open local models (Ollama)", yue: "開啟本地模型（Ollama）" }, keywords: "ollama llm models chat pull", run: (ctx) => ctx.navigate("ollama-suite") }],
  settings: [{ id: "ollama-suite", icon: "neurology", label, render: (ctx) => ctx.h("div", { class: "t2" }, ctx.t("The Ollama address is kept in this browser and set on the Ollama screen.", "Ollama 地址儲喺呢個瀏覽器，喺 Ollama 畫面設定。")) }],
};
