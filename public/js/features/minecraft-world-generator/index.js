// Minecraft world generator. Pick a version, set the world with typed
// controls, choose the area (100 x 100 chunks by default, or draw any shape on
// the map), and see the exact batches and commands. It can write the settings
// folder and pack a finished world into one ZIP. Running the exact server and
// verifying the world are not built yet, and the screen says so.
import { VIEW, clampRect, coverage, defaultSquare, pixelsPerChunk, rectFromDrag } from "./area.js";
import { makeUi } from "./ui.js";
import { load, save } from "./store.js";

const label = { en: "World generator", yue: "世界生成器" };
const BASE = "/api/x/minecraft-world-generator";
const FALLBACK = ["1.21.4", "1.21", "1.20.4", "1.19.4", "1.18.2", "1.17.1", "1.16.5", "1.12.2"];
const SIZE = 560;

function render(ctx) {
  const { h, icon, t, tt, api, toast } = ctx;
  const ui = makeUi(ctx);
  const state = { version: "1.21", shape: "square", size: 100, rects: [], settings: {}, outKind: "folder", outName: "generated-world", eula: false, ...load("state", {}) };
  const persist = () => save("state", state);
  let schema = [];
  let plan = null;
  let versions = FALLBACK;

  const canvas = h("canvas", { width: String(SIZE), height: String(SIZE), class: "mcmap", role: "img", "aria-label": t("Chunk map. Drag to draw a rectangle.", "區塊地圖。拖動畫一個長方形。"), tabindex: "0" });
  const g = canvas.getContext("2d");
  const planBox = h("div", {});
  const settingsBox = h("div", {});
  const areaInfo = h("div", { class: "t2", role: "status" });

  const rects = () => (state.shape === "square" ? [defaultSquare(state.size)] : state.rects);

  function paint(drag) {
    const k = pixelsPerChunk(SIZE);
    g.fillStyle = "#f4f6f0";
    g.fillRect(0, 0, SIZE, SIZE);
    g.strokeStyle = "#d6dbd0";
    g.lineWidth = 1;
    for (let c = 0; c <= VIEW; c += 16) {
      g.beginPath();
      g.moveTo(c * k + 0.5, 0);
      g.lineTo(c * k + 0.5, SIZE);
      g.moveTo(0, c * k + 0.5);
      g.lineTo(SIZE, c * k + 0.5);
      g.stroke();
    }
    g.strokeStyle = "#8a9380";
    g.beginPath();
    g.moveTo(SIZE / 2 + 0.5, 0);
    g.lineTo(SIZE / 2 + 0.5, SIZE);
    g.moveTo(0, SIZE / 2 + 0.5);
    g.lineTo(SIZE, SIZE / 2 + 0.5);
    g.stroke();
    g.fillStyle = "rgba(30, 136, 229, 0.35)";
    g.strokeStyle = "#1e88e5";
    for (const r of [...rects(), ...(drag ? [drag] : [])]) {
      const x = (r.x0 + VIEW / 2) * k;
      const y = (r.z0 + VIEW / 2) * k;
      g.fillRect(x, y, (r.x1 - r.x0 + 1) * k, (r.z1 - r.z0 + 1) * k);
      g.strokeRect(x + 0.5, y + 0.5, (r.x1 - r.x0 + 1) * k - 1, (r.z1 - r.z0 + 1) * k - 1);
    }
  }

  function describeArea() {
    const { chunks, over } = coverage(rects());
    areaInfo.textContent = over ? t("That area is larger than a plan can hold (40,000 chunks).", "呢個範圍超過一個計劃可以載入嘅上限（40,000 個區塊）。") : t(`${chunks} chunks (${chunks * 256} blocks square in total).`, `${chunks} 個區塊（合共 ${chunks * 256} 格方塊）。`);
    areaInfo.className = over ? "err" : "t2";
  }

  let down = null;
  const at = (e) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE }; };
  canvas.addEventListener("pointerdown", (e) => { if (state.shape !== "rects") return; canvas.setPointerCapture(e.pointerId); down = at(e); });
  canvas.addEventListener("pointermove", (e) => { if (down) paint(clampRect(rectFromDrag(down, at(e), SIZE))); });
  canvas.addEventListener("pointerup", (e) => {
    if (!down) return;
    state.rects = [...state.rects, clampRect(rectFromDrag(down, at(e), SIZE))].slice(-200);
    down = null;
    persist();
    paint();
    describeArea();
  });

  async function loadSchema() {
    try {
      schema = (await api.get(`${BASE}/schema?version=${encodeURIComponent(state.version)}`)).settings;
    } catch (error) {
      settingsBox.replaceChildren(h("div", { class: "note bad" }, icon("error", "sm"), error.message));
      return;
    }
    for (const def of schema) if (state.settings[def.key] === undefined || (def.options && !def.options.some(([v]) => v === state.settings[def.key]))) state.settings[def.key] = String(def.default);
    settingsBox.replaceChildren(...schema.map((def) => {
      const value = state.settings[def.key];
      const on = (v) => { state.settings[def.key] = String(v); persist(); };
      let control;
      if (def.control === "switch") control = ui.sw(value === "true", (v) => on(v), def.label).el;
      else if (def.control === "select") control = (def.options.length <= 4 ? ui.seg(def.options.map(([v, l, about]) => [v, l, about]), value, on, def.label) : ui.select(def.options, value, on, def.label)).el;
      else if (def.control === "slider") control = ui.slider(def.min, def.max, def.step, def.unit, Number(value), on, def.label).el;
      else control = ui.text(value, { maxLength: def.maxLength, hint: def.hint, aria: def.label, onChange: on }).el;
      return ui.row(def.label, def.disabled ? def.disabled : def.help, control);
    }));
  }

  const body = () => ({ version: state.version, settings: state.settings, area: state.shape === "square" ? { kind: "square", size: state.size } : { kind: "rects", rects: state.rects }, output: { kind: state.outKind, name: state.outName }, eula: state.eula });

  async function makePlan() {
    try {
      plan = await api.post(`${BASE}/plan`, body());
    } catch (error) {
      plan = null;
      planBox.replaceChildren(h("div", { class: "note bad", role: "alert" }, icon("error", "sm"), error.message));
      return;
    }
    planBox.replaceChildren(
      h("div", { class: "note" }, icon("map", "sm"), t(`${plan.area.chunks} chunks in ${plan.batches.length} batch(es) of up to 256.`, `${plan.area.chunks} 個區塊，分 ${plan.batches.length} 批，每批最多 256 個。`)),
      plan.blocker ? h("div", { class: "note warn" }, icon("gavel", "sm"), plan.blocker) : null,
      h("div", { class: "list" }, plan.steps.map((s) => h("div", { class: `row ${s.state === "ready" ? "" : "off"}` }, icon(s.state === "ready" ? "check_circle" : "construction", "sm"), h("span", { class: "grow" }, tt(s.label), s.why ? h("div", { class: "t2" }, s.why) : null), h("span", { class: `tag ${s.state === "ready" ? "good" : "warn"}` }, s.state === "ready" ? t("Ready", "可用") : t("In progress", "進行中"))))),
      h("details", {}, h("summary", {}, t("The server.properties lines", "server.properties 內容")), h("pre", { class: "fp" }, plan.properties)),
      h("details", {}, h("summary", {}, t(`The first ${Math.min(8, plan.batches.length)} load commands`, `首 ${Math.min(8, plan.batches.length)} 條載入命令`)), h("pre", { class: "fp" }, plan.batches.slice(0, 8).map((b) => `${b.load}\n${b.release}`).join("\n"))));
  }

  const actionButton = (name, text, ic, extra) => h("button", { class: "btn f", type: "button", disabled: !ctx.state.canWrite, async onClick() {
    try {
      const r = await api.post(`/api/actions/minecraft-world-generator.${name}`, extra());
      toast(name === "prepare" ? t(`Wrote ${r.files.length} files to ${r.folder}.`, `已寫入 ${r.files.length} 個檔案到 ${r.folder}。`) : t(`Packed ${r.files} file(s) into ${r.zip}.`, `已將 ${r.files} 個檔案打包到 ${r.zip}。`));
    } catch (error) {
      toast(error.message, "bad");
    }
  } }, icon(ic, "sm"), text);

  const controls = h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Version and area", "版本同範圍")),
    ui.row({ en: "Minecraft version", yue: "Minecraft 版本" }, { en: "World settings depend on the version. Release versions only.", yue: "世界設定跟版本而定。只限正式版。" }, ui.select(versions.map((v) => [v, v]), state.version, (v) => { state.version = v; persist(); loadSchema(); }, { en: "Version", yue: "版本" }).el),
    ui.row({ en: "Area", yue: "範圍" }, { en: "Square is centred on the middle of the world. Custom lets you draw any shape on the map.", yue: "正方形以世界中心為中心。自訂可以喺地圖上畫任何形狀。" }, ui.seg([["square", { en: "Square", yue: "正方形" }], ["rects", { en: "Draw my own", yue: "自己畫" }]], state.shape, (v) => { state.shape = v; persist(); paint(); describeArea(); }, { en: "Area", yue: "範圍" }).el),
    ui.row({ en: "Square size", yue: "正方形大小" }, { en: "Chunks on each side. The default is 100 by 100.", yue: "每邊幾多個區塊。預設 100 乘 100。" }, ui.stepper(1, 200, 1, t("chunks", "個區塊"), state.size, (v) => { state.size = v; persist(); paint(); describeArea(); }, { en: "Square size", yue: "正方形大小" }).el),
    h("div", { class: "chips" }, h("button", { class: "btn o sm", type: "button", onClick() { state.rects = state.rects.slice(0, -1); persist(); paint(); describeArea(); } }, icon("undo", "sm"), t("Remove the last rectangle", "移除最後一個長方形")), h("button", { class: "btn o sm", type: "button", onClick() { state.rects = []; persist(); paint(); describeArea(); } }, icon("delete", "sm"), t("Clear the drawing", "清除圖畫"))),
    canvas, areaInfo);

  const output = h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("Output and EULA", "輸出同 EULA")),
    ui.row({ en: "Keep the world as", yue: "世界保存為" }, { en: "A folder, or one ZIP file.", yue: "資料夾，或者一個 ZIP 檔。" }, ui.seg([["folder", { en: "Folder", yue: "資料夾" }], ["zip", "ZIP"]], state.outKind, (v) => { state.outKind = v; persist(); }, { en: "Output", yue: "輸出" }).el),
    ui.row({ en: "Name", yue: "名稱" }, { en: "Created under the app's worlds folder. A folder or ZIP that already exists is never replaced. Choosing any other place with a Browse window needs the desktop app.", yue: "會建立喺程式嘅 worlds 資料夾入面。已存在嘅資料夾或 ZIP 永不覆蓋。用瀏覽視窗揀其他位置需要桌面版程式。" }, ui.text(state.outName, { maxLength: 60, aria: { en: "Output name", yue: "輸出名稱" }, hint: { en: "Letters, digits, spaces, dots, dashes and underscores.", yue: "字母、數字、空格、點、橫線同底線。" }, onChange(v) { state.outName = v; persist(); } }).el),
    ui.row({ en: "I accept the Minecraft EULA", yue: "我接受 Minecraft EULA" }, { en: "Nothing is written or run until you accept Mojang's end user licence agreement here.", yue: "喺呢度接受 Mojang 嘅最終使用者授權協議之前，唔會寫入或運行任何嘢。" }, ui.sw(state.eula, (v) => { state.eula = v; persist(); }, { en: "I accept the Minecraft EULA", yue: "我接受 Minecraft EULA" }).el),
    h("div", { class: "chips" }, h("button", { class: "btn t", type: "button", onClick: makePlan }, icon("preview", "sm"), t("Show the plan", "顯示計劃")), actionButton("prepare", t("Write the settings folder", "寫入設定資料夾"), "folder", body), actionButton("pack", t("Pack a finished world into a ZIP", "將完成嘅世界打包成 ZIP"), "folder_zip", () => ({ name: state.outName }))),
    planBox);

  const note = h("div", { class: "note warn" }, icon("construction", "sm"), t("In progress: extracting each version's world-generation data from its own server jar, running that exact server (after the EULA above) in bounded batches, reopening the finished world with the same version to verify it, a Browse window for the output place (desktop app), and the flat-world layers beyond three presets. The settings, area, batches, load commands, folder writing and ZIP packing are real and tested.", "進行中：由每個版本自己嘅伺服器 jar 取出世界生成資料、用確切版本伺服器（接受上面嘅 EULA 後）分批運行、用同一版本重開完成嘅世界驗證、輸出位置嘅瀏覽視窗（桌面版程式），同三個預設以外嘅超平坦層次。設定、範圍、分批、載入命令、寫入資料夾同 ZIP 打包係真實而且有測試嘅。"));

  ctx.root.append(ctx.page(label, { en: "Plan a Minecraft world with typed settings and a bounded area, then write it out.", yue: "用有類型嘅設定同有上限嘅範圍計劃 Minecraft 世界，然後寫出嚟。" }));
  ctx.root.firstChild.append(h("div", { class: "grid2" }, controls, h("section", { class: "card rise" }, h("h2", { class: "h2" }, t("World settings", "世界設定")), settingsBox)), output, note);
  paint();
  describeArea();
  loadSchema();
  api.get("/api/x/minecraft-server-manager/versions?flavour=vanilla").then((r) => { if (r.available) { const rel = r.versions.filter((v) => v.channel === "release" && /^\d+\.\d+(\.\d+)?$/.test(v.id)).map((v) => v.id); if (rel.length) { versions = rel; ctx.clear(controls.querySelector("select")); controls.querySelector("select").append(...versions.map((v) => h("option", { value: v, selected: v === state.version }, v))); } } }).catch(() => {});
}

export default {
  id: "minecraft-world-generator",
  screens: [{ id: "minecraft-world-generator", group: { en: "Tools", yue: "工具" }, icon: "public", label, render }],
  commands: [{ id: "minecraft-world-generator.open", icon: "public", label: { en: "Open the Minecraft world generator", yue: "開啟 Minecraft 世界生成器" }, keywords: "minecraft world generator seed chunks forceload zip", run: (ctx) => ctx.navigate("minecraft-world-generator") }],
};
