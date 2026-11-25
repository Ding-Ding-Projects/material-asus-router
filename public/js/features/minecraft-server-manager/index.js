// Minecraft server creator and manager (a tool tab, unrelated to routing).
// Pick a target (Docker or a Java process, on this computer or over SSH), find
// any version from the official sources, create the server, then run it: a
// console, players, plugins and a typed properties editor. Anything that
// cannot work on the chosen target says why instead of pretending.
import { settingControl } from "./props-ui.js";
import { makeUi } from "./ui.js";
import { load, save } from "./store.js";

const label = { en: "Minecraft servers", yue: "Minecraft 伺服器" };
const A = (name) => `/api/actions/minecraft-server-manager.${name}`;
const BASE = "/api/x/minecraft-server-manager";
const CHANNELS = [["release", { en: "Releases", yue: "正式版" }], ["development", { en: "Development", yue: "開發版" }], ["historic", { en: "Historic", yue: "歷史版" }]];

function render(ctx) {
  const { h, icon, t, tt, api, toast, confirmDialog } = ctx;
  const ui = makeUi(ctx);
  const state = { target: "local-docker", flavour: "vanilla", channel: "release", version: "", search: "", name: "my-server", port: 25565, memoryMb: 2048, eula: false, selected: "", ...load("state", {}) };
  const persist = () => save("state", state);
  const canWrite = ctx.state.canWrite;
  let targets = [];
  let flavours = [];
  let versions = null;
  let servers = [];
  let timer = null;

  const targetBox = h("div", {});
  const createBox = h("div", {});
  const serversBox = h("div", {});
  const detailBox = h("div", {});
  const say = (box, kind, text) => box.prepend(h("div", { class: `note ${kind}`, role: kind === "bad" ? "alert" : "status" }, icon(kind === "bad" ? "error" : "info", "sm"), text));

  async function call(name, extra = {}) {
    return api.post(A(name), { target: state.target, ...extra });
  }

  // ---- target --------------------------------------------------------------
  async function drawTarget(check) {
    const info = targets.find((x) => x.id === state.target);
    targetBox.replaceChildren(
      ui.row({ en: "Where the server lives", yue: "伺服器放喺邊" }, info ? info.note : null, ui.select(targets.map((x) => [x.id, x.name]), state.target, (v) => { state.target = v; persist(); drawTarget(); refreshServers(); }, { en: "Target", yue: "目標" }).el),
      h("div", { class: "chips" }, h("button", { class: "btn t", type: "button", onClick: () => drawTarget(true) }, icon("fact_check", "sm"), t("Check this target", "檢查呢個目標"))),
      check ? await (async () => {
        try {
          const r = await call("check", { version: state.version || undefined });
          return h("div", { class: `note ${r.available ? "" : "warn"}`, role: "status" }, icon(r.available ? "check_circle" : "warning", "sm"), r.available ? t(`Ready: ${r.runtime}.`, `可用：${r.runtime}。`) : r.reason);
        } catch (error) {
          return h("div", { class: "note bad", role: "alert" }, icon("error", "sm"), error.message);
        }
      })() : null);
  }

  // ---- versions and creating ------------------------------------------------
  async function loadVersions() {
    versions = null;
    drawCreate();
    try {
      versions = await api.get(`${BASE}/versions?flavour=${state.flavour}`);
    } catch (error) {
      versions = { available: false, reason: error.message };
    }
    const list = versions.available ? versions.versions : [];
    if (list.length && !list.some((v) => v.id === state.version)) state.version = (list.find((v) => v.channel === "release") ?? list[0]).id;
    drawCreate();
  }

  function drawCreate() {
    const flavour = flavours.find((f) => f.id === state.flavour);
    const edition = state.flavour === "bedrock" ? "bedrock" : "java";
    const channelCounts = Object.fromEntries(CHANNELS.map(([id]) => [id, versions?.available ? versions.versions.filter((v) => v.channel === id).length : 0]));
    const list = h("select", { class: "field", size: "8", "aria-label": t("Versions", "版本"), onChange(e) { state.version = e.target.value; persist(); } });
    const fillList = () => {
      const wanted = state.search.toLowerCase();
      const rows = (versions?.available ? versions.versions : []).filter((v) => v.channel === state.channel && (!wanted || v.id.toLowerCase().includes(wanted)));
      list.replaceChildren(...rows.map((v) => h("option", { value: v.id, selected: v.id === state.version }, `${v.id}${v.releaseTime ? ` · ${v.releaseTime.slice(0, 10)}` : ""}${v.forge ? ` · Forge ${v.forge.recommended ?? v.forge.latest}` : ""}`)));
    };
    fillList();
    const versionPicker = versions === null ? h("div", { class: "t2" }, t("Reading the official version list…", "讀取緊官方版本清單…")) : !versions.available
      ? h("div", { class: "note warn", role: "status" }, icon("cloud_off", "sm"), h("div", {}, versions.reason, versions.error ? h("div", { class: "t2" }, versions.error) : null))
      : h("div", {}, h("div", { class: "t2" }, t(`${versions.versions.length} versions from ${versions.source}.`, `共 ${versions.versions.length} 個版本，來源：${versions.source}。`)),
        versions.gaps.map((g) => h("div", { class: "t2" }, icon("info", "sm"), " ", g)),
        ui.seg(CHANNELS.map(([id, l]) => [id, { en: `${l.en} (${channelCounts[id]})`, yue: `${l.yue}（${channelCounts[id]}）` }]), state.channel, (v) => { state.channel = v; persist(); drawCreate(); }, { en: "Version kind", yue: "版本類別" }).el,
        h("input", { class: "field", type: "search", value: state.search, placeholder: t("Search versions", "搜尋版本"), "aria-label": t("Search versions", "搜尋版本"), onInput(e) { state.search = e.target.value; fillList(); } }), list);
    createBox.replaceChildren(
      ui.row({ en: "Flavour", yue: "類型" }, flavour ? flavour.about : null, ui.seg(flavours.map((f) => [f.id, f.name]), state.flavour, (v) => { state.flavour = v; state.version = ""; persist(); loadVersions(); }, { en: "Flavour", yue: "類型" }).el),
      versionPicker,
      ui.row({ en: "Server name", yue: "伺服器名稱" }, { en: "Lowercase letters, digits and dashes. It is the folder and container name.", yue: "小寫字母、數字同橫線。會用作資料夾同容器名稱。" }, ui.text(state.name, { maxLength: 31, aria: { en: "Server name", yue: "伺服器名稱" }, hint: { en: "For example my-server", yue: "例如 my-server" }, onChange(v) { state.name = v.toLowerCase().replace(/[^a-z0-9-]/g, ""); persist(); } }).el),
      ui.row({ en: "Port", yue: "埠" }, { en: edition === "bedrock" ? "The UDP port players connect to (default 19132)." : "The port players connect to (default 25565).", yue: edition === "bedrock" ? "玩家連接用嘅 UDP 埠（預設 19132）。" : "玩家連接用嘅埠（預設 25565）。" }, settingControl(ctx, ui, { control: "port", min: 1024, max: 65535, presets: [[edition === "bedrock" ? 19132 : 25565, { en: "Default", yue: "預設" }]], label: { en: "Port", yue: "埠" } }, String(state.port), (v) => { state.port = Number(v); persist(); })),
      ui.row({ en: "Memory", yue: "記憶體" }, { en: "How much memory the Java server may use.", yue: "Java 伺服器可以用幾多記憶體。" }, ui.slider(512, 16384, 512, " MB", state.memoryMb, (v) => { state.memoryMb = v; persist(); }, { en: "Memory", yue: "記憶體" }).el),
      ui.row({ en: "I accept the Minecraft EULA", yue: "我接受 Minecraft EULA" }, { en: "The server will not run unless you accept Mojang's end user licence agreement.", yue: "唔接受 Mojang 嘅最終使用者授權協議，伺服器就唔會運行。" }, ui.sw(state.eula, (v) => { state.eula = v; persist(); }, { en: "I accept the Minecraft EULA", yue: "我接受 Minecraft EULA" }).el),
      h("div", { class: "chips" }, h("button", { class: "btn f", type: "button", disabled: !canWrite || !state.version, async onClick(e) {
        const button = e.currentTarget;
        button.disabled = true;
        try {
          const r = await call("create", { name: state.name, edition, flavour: state.flavour, version: state.version, port: state.port, memoryMb: state.memoryMb, eula: state.eula });
          toast(t(`Created ${r.name}.`, `已建立 ${r.name}。`));
          if (r.note) say(createBox, "", r.note);
          state.selected = r.name;
          persist();
          refreshServers();
        } catch (error) {
          say(createBox, "bad", error.message);
        } finally {
          button.disabled = !canWrite;
        }
      } }, icon("add_circle", "sm"), t("Create the server", "建立伺服器"))));
  }

  // ---- servers ----------------------------------------------------------------
  async function refreshServers() {
    try {
      servers = (await call("list")).servers;
    } catch (error) {
      servers = [];
      serversBox.replaceChildren(h("div", { class: "note warn", role: "status" }, icon("warning", "sm"), error.message));
      detailBox.replaceChildren();
      return;
    }
    if (!servers.some((s) => s.name === state.selected)) state.selected = servers[0]?.name ?? "";
    drawServers();
    drawDetail();
  }

  function drawServers() {
    serversBox.replaceChildren(servers.length ? servers.map((s) => h("div", { class: `row ${s.name === state.selected ? "tone" : ""}` },
      h("span", { class: `dot ${s.running ? "" : "off"}`, "aria-hidden": "true" }), h("button", { class: "btn t sm", type: "button", "aria-pressed": String(s.name === state.selected), onClick() { state.selected = s.name; persist(); drawServers(); drawDetail(); } }, s.name),
      h("span", { class: "grow t2" }, `${s.flavour} ${s.version} · ${t("port", "埠")} ${s.port} · ${s.running ? t("running", "運行中") : t("stopped", "已停止")}`),
      h("button", { class: "btn o sm", type: "button", disabled: !canWrite, onClick: () => run(s.running ? "stop" : "start", { name: s.name }) }, icon(s.running ? "stop" : "play_arrow", "sm"), s.running ? t("Stop", "停止") : t("Start", "啟動")),
      h("button", { class: "btn o sm", type: "button", disabled: !canWrite || ctx.state.me?.role === "viewer", onClick: () => remove(s) }, icon("delete", "sm"), t("Remove", "移除"))))
      : h("div", { class: "t2" }, t("No servers on this target yet. Create one above.", "呢個目標未有伺服器。喺上面建立一個。")));
  }

  async function run(name, extra) {
    try {
      await call(name, extra);
      toast(t("Done.", "完成。"));
    } catch (error) {
      toast(error.message, "bad");
    }
    refreshServers();
  }
  async function remove(s) {
    if (!(await confirmDialog({ title: t(`Remove ${s.name}?`, `移除 ${s.name}？`), body: t("The server is removed. Its world data is kept unless you remove that too from the next step.", "會移除伺服器。世界資料除非喺下一步一齊移除，否則會保留。"), confirm: t("Remove", "移除"), danger: true }))) return;
    const data = await confirmDialog({ title: t("Delete the world data as well?", "連世界資料一齊刪除？"), body: t("This cannot be undone. Choose Keep to remove only the server.", "呢個操作無法還原。揀「保留」就只移除伺服器。"), confirm: t("Delete the world too", "連世界一齊刪除"), danger: true });
    run("remove", { name: s.name, removeData: data, hold: true });
  }

  // ---- the selected server -----------------------------------------------------------
  async function drawDetail() {
    clearInterval(timer);
    const s = servers.find((x) => x.name === state.selected);
    if (!s) return detailBox.replaceChildren();
    const log = h("pre", { class: "fp", tabindex: "0", role: "log", "aria-label": t("Server log", "伺服器記錄"), "aria-live": "off" });
    const input = h("input", { class: "field", type: "text", maxlength: "256", placeholder: t("A console command, for example list", "控制台命令，例如 list"), "aria-label": t("Console command", "控制台命令") });
    const players = h("div", { class: "t2" });
    const out = h("div", {});
    const pull = async () => { try { log.textContent = (await call("logs", { name: s.name, lines: 120 })).text; log.scrollTop = log.scrollHeight; } catch (error) { log.textContent = error.message; } };
    const send = async () => {
      const command = input.value.trim();
      if (!command) return;
      input.value = "";
      try { const r = await call("command", { name: s.name, command }); log.textContent += `\n> ${command}\n${r.output ?? ""}`; } catch (error) { toast(error.message, "bad"); }
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    const refreshPlayers = async () => { try { const r = (await call("players", { name: s.name })); players.textContent = r.players ? t(`${r.players.online} online${r.players.names.length ? `: ${r.players.names.join(", ")}` : ""}`, `${r.players.online} 個上線${r.players.names.length ? `：${r.players.names.join("、")}` : ""}`) : (r.note ?? t("The player list is not available.", "未能取得玩家名單。")); } catch (error) { players.textContent = error.message; } };

    const url = { value: "" };
    const plugins = s.flavour === "paper"
      ? h("div", {}, ui.row({ en: "Plugin address", yue: "插件網址" }, { en: "An https address of a .jar file. It is downloaded by the server's own machine, never replaced if it exists, and takes effect after a restart.", yue: "指向 .jar 檔嘅 https 網址。由伺服器所在機器下載，已存在就唔會取代，重新啟動後生效。" }, ui.text("", { maxLength: 300, aria: { en: "Plugin address", yue: "插件網址" }, hint: { en: "Must be a public host name over https.", yue: "要係 https 嘅公開網址。" }, onChange(v) { url.value = v.trim(); } }).el),
        h("div", { class: "chips" }, h("button", { class: "btn t", type: "button", disabled: !canWrite, async onClick() { try { const r = await call("plugin", { name: s.name, url: url.value }); out.replaceChildren(h("div", { class: "note" }, icon("check_circle", "sm"), t(`Installed ${r.installed}. Restart the server to load it.`, `已安裝 ${r.installed}。重新啟動伺服器就會載入。`))); } catch (error) { out.replaceChildren(h("div", { class: "note bad", role: "alert" }, icon("error", "sm"), error.message)); } } }, icon("extension", "sm"), t("Install the plugin", "安裝插件"))))
      : h("div", { class: "t2" }, t("Plugins need a Paper server. Installing mods for Fabric or Forge is not built yet.", "插件需要 Paper 伺服器。為 Fabric 或 Forge 安裝模組未做。"));

    const propsBox = h("div", {});
    const edits = {};
    try {
      const p = await call("properties", { name: s.name });
      propsBox.replaceChildren(p.settings.map((def) => {
        const row = ui.row(def.label, def.disabled ? def.disabled : def.help, settingControl(ctx, ui, def, p.values[def.key] ?? String(def.default ?? ""), (v) => { edits[def.key] = v; }));
        return row;
      }));
    } catch (error) {
      propsBox.replaceChildren(h("div", { class: "note warn" }, icon("warning", "sm"), error.message));
    }
    const saveBtn = h("button", { class: "btn f", type: "button", disabled: !canWrite, async onClick() {
      if (!Object.keys(edits).length) return toast(t("Nothing changed.", "冇改動。"));
      try { const r = await call("save-properties", { name: s.name, changes: edits }); toast(t(`Saved ${r.changed.length} setting(s). Restart the server to apply them.`, `已儲存 ${r.changed.length} 項設定。重新啟動伺服器就會生效。`)); Object.keys(edits).forEach((k) => delete edits[k]); } catch (error) { toast(error.message, "bad"); }
    } }, icon("save", "sm"), t("Save the settings", "儲存設定"));

    detailBox.replaceChildren(
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("terminal"), " ", t(`Console: ${s.name}`, `控制台：${s.name}`)), log, h("div", { class: "ctl" }, input, h("button", { class: "btn f", type: "button", disabled: !canWrite, onClick: send }, icon("send", "sm"), t("Send", "傳送")), h("button", { class: "btn o", type: "button", onClick: pull }, icon("refresh", "sm"), t("Refresh", "重新整理")))),
      h("div", { class: "grid2" },
        h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("group"), " ", t("Players", "玩家")), players, h("button", { class: "btn t sm", type: "button", onClick: refreshPlayers }, icon("refresh", "sm"), t("Refresh", "重新整理"))),
        h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("extension"), " ", t("Plugins", "插件")), plugins, out)),
      h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("tune"), " ", t("Settings (server.properties)", "設定（server.properties）")), propsBox, saveBtn));
    pull();
    refreshPlayers();
    timer = setInterval(() => { if (!log.isConnected) return clearInterval(timer); pull(); }, 4000);
  }

  const progress = h("div", { class: "note warn" }, icon("construction", "sm"),
    t("In progress: SSH machines other than the router (only the app's own SSH connection is used), installing Forge on a Java process (Forge needs its installer run; Docker works), Bedrock as a Java-style process (Docker works), Fabric and Forge mods, custom plugin upload from a file, and running the exact server version to verify generated worlds. Versions come from the official sources whenever they can be reached; when they cannot, the list says so and nothing is guessed.", "進行中：路由器以外嘅 SSH 機器（只用程式自己嘅 SSH 連線）、喺 Java 程序安裝 Forge（Forge 要行安裝程式；Docker 就得）、以 Java 程序運行 Bedrock（Docker 就得）、Fabric 同 Forge 模組、由檔案上載自訂插件，同用確切版本伺服器驗證生成嘅世界。版本盡可能來自官方來源；連唔到就會講明，唔會估。"));

  ctx.root.append(ctx.page(label, { en: "Create and manage Minecraft servers. This is a separate tool, not part of routing.", yue: "建立同管理 Minecraft 伺服器。呢個係獨立工具，同路由無關。" }));
  ctx.root.firstChild.append(h("div", { class: "grid2" }, h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Target", "目標")), targetBox, h("h2", { class: "h2" }, t("Servers on this target", "呢個目標嘅伺服器")), serversBox), h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Create a server", "建立伺服器")), createBox)), detailBox, progress);

  (async () => {
    try {
      [targets, flavours] = await Promise.all([api.get(`${BASE}/targets`).then((r) => r.targets), api.get(`${BASE}/flavours`).then((r) => r.flavours)]);
    } catch (error) {
      ctx.root.firstChild.prepend(h("div", { class: "note bad", role: "alert" }, icon("error", "sm"), error.message));
      return;
    }
    await drawTarget();
    refreshServers();
    loadVersions();
  })();
  return () => clearInterval(timer);
}

export default {
  id: "minecraft-server-manager",
  screens: [{ id: "minecraft-server-manager", group: { en: "Tools", yue: "工具" }, icon: "dns", label, render }],
  commands: [{ id: "minecraft-server-manager.open", icon: "dns", label: { en: "Open Minecraft servers", yue: "開啟 Minecraft 伺服器" }, keywords: "minecraft server paper fabric forge bedrock docker java", run: (ctx) => ctx.navigate("minecraft-server-manager") }],
  settings: [{ id: "minecraft-server-manager", icon: "dns", label, render: (ctx) => ctx.h("div", { class: "t2" }, ctx.t("Your last target and server choices are kept in this browser and set on the Minecraft servers screen.", "你最近揀嘅目標同伺服器記住喺呢個瀏覽器，喺 Minecraft 伺服器畫面設定。")) }],
};
