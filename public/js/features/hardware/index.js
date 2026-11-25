// Hardware: live temperature and fan dials, the lights (main switch, Ethernet
// port lights, a schedule, RGB lighting on gaming models) and the button
// settings. The dials refresh every few seconds while the screen is open and are
// read only. Every setting goes through the pending-changes dock, so every
// change gets a preview, the safety net and undo.

const label = { en: "Hardware", yue: "硬件" };
const lede = { en: "How hot the router is running, the lights, the colour lighting on gaming models, and what the front button does.", yue: "路由器幾熱、燈號、電競型號嘅彩色燈效，同埋前面個掣做咩。" };
const REFRESH_MS = 3000;
const HISTORY = 40;
const ARC = 270; // degrees of the dial that carry the value

// Where on the dial a reading sits, as degrees of the 270 degree arc, and how worried to be about it.
export function gaugeState(value, warnAt, maxAt) {
  if (value === null || value === undefined) return { deg: 0, tone: "", word: "unavailable" };
  const share = Math.max(0, Math.min(1, value / maxAt));
  const hot = value >= maxAt * 0.95;
  return { deg: Math.round(share * ARC), tone: hot ? "bad" : value >= warnAt ? "warn" : "good", word: hot ? "hot" : value >= warnAt ? "warm" : "normal" };
}

// "79,91,213" <-> "#4f5bd5". Anything that is not three whole numbers from 0 to 255 is refused with null.
export function rgbToHex(text) {
  const m = String(text).match(/^(\d{1,3}),(\d{1,3}),(\d{1,3})$/);
  if (!m || [m[1], m[2], m[3]].some((n) => Number(n) > 255)) return null;
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
}
export function hexToRgb(hex) {
  const m = String(hex).match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? [m[1], m[2], m[3]].map((x) => parseInt(x, 16)).join(",") : null;
}

const PRESETS = [["255,45,85", "Red", "紅"], ["255,149,0", "Orange", "橙"], ["52,199,89", "Green", "綠"], ["0,122,255", "Blue", "藍"], ["175,82,222", "Purple", "紫"], ["255,255,255", "White", "白"]];

// The colour control for RGB lighting: a picker, six presets and the three numbers.
function rgbControl(entry, current, commit, locked, ctx) {
  const { h, t } = ctx;
  const readout = h("span", { class: "t2 mono" });
  const picker = h("input", { type: "color", class: "hw-picker", disabled: locked, "aria-label": ctx.tt(entry.label), onInput: (e) => change(hexToRgb(e.target.value)) });
  const swatches = PRESETS.map(([rgb, en, yue]) => {
    const b = h("button", { type: "button", class: "hw-swatch", disabled: locked, "aria-label": t(en, yue), title: t(en, yue), onClick: () => change(rgb) });
    b.style.setProperty("--c", `rgb(${rgb})`);
    return b;
  });
  const sync = () => {
    const rgb = current();
    const hex = rgbToHex(rgb);
    if (hex) picker.value = hex;
    readout.textContent = hex ? rgb.split(",").map((n, i) => `${"RGB"[i]} ${n}`).join("  ") : t("Not set", "未設定");
    swatches.forEach((b, i) => b.setAttribute("aria-pressed", String(PRESETS[i][0] === rgb)));
  };
  function change(rgb) {
    if (!rgb) return;
    commit(rgb);
    sync();
  }
  sync();
  return { el: h("div", { class: "hw-rgb" }, picker, h("div", { class: "hw-swatches" }, swatches), readout), sync };
}

function dials(ctx, root) {
  const { api, h, icon, t, tt } = ctx;
  const grid = h("div", { class: "hw-dials" });
  const stamp = h("span", { class: "t2" });
  const wording = { normal: t("Normal", "正常"), warm: t("Warm", "偏暖"), hot: t("Hot", "好熱"), unavailable: t("Not reported by this router", "呢部路由器冇提供") };
  const cards = new Map(); // gauge id -> { dial, value, word, bars, history }
  let first = true;

  function build(g) {
    const value = h("span", { class: "hw-val" });
    const unit = h("small", {});
    const dial = h("div", { class: "hw-dial", role: "meter", "aria-label": tt(g.label) }, h("div", { class: "hw-dial-in" }, value, unit));
    dial.style.setProperty("--deg", "0deg");
    const word = h("div", { class: "t2" });
    const bars = h("div", { class: "hw-spark", "aria-hidden": "true" });
    const extra = h("div", { class: "t2" });
    const el = h("div", { class: "hw-card" }, dial, h("div", { class: "k" }, icon(g.kind === "fan" ? "mode_fan" : "device_thermostat", "sm"), " ", tt(g.label)), word, extra, bars);
    return { el, dial, value, unit, word, bars, extra, history: [] };
  }

  function paint(data) {
    stamp.textContent = t(`Updated ${new Date(data.readAt).toLocaleTimeString()}`, `更新於 ${new Date(data.readAt).toLocaleTimeString()}`);
    for (const g of data.gauges) {
      let card = cards.get(g.id);
      if (!card) {
        card = build(g);
        cards.set(g.id, card);
        grid.append(card.el);
      }
      const s = gaugeState(g.value, g.warnAt, g.maxAt);
      const shown = g.value === null ? "–" : String(Math.round(g.value));
      card.value.textContent = shown;
      card.unit.textContent = g.value === null ? "" : g.unit === "C" ? "°C" : " rpm";
      card.word.textContent = wording[s.word];
      card.extra.textContent = g.value !== null && g.mode !== null && g.mode !== undefined && g.kind === "fan" ? t(`Fan mode setting: ${g.mode}`, `風扇模式設定：${g.mode}`) : "";
      card.el.dataset.tone = s.tone;
      card.dial.setAttribute("aria-valuemin", "0");
      card.dial.setAttribute("aria-valuemax", String(g.maxAt));
      card.dial.setAttribute("aria-valuenow", String(g.value ?? 0));
      card.dial.setAttribute("aria-valuetext", g.value === null ? wording.unavailable : `${shown} ${g.unit === "C" ? "°C" : "rpm"}, ${wording[s.word]}`);
      // The first reading sweeps in from zero on the next frame; later ones glide.
      const apply = () => card.dial.style.setProperty("--deg", `${s.deg}deg`);
      if (first) requestAnimationFrame(() => requestAnimationFrame(apply));
      else apply();
      if (g.value !== null) {
        card.history.push(g.value);
        if (card.history.length > HISTORY) card.history.shift();
      }
      const peak = Math.max(g.maxAt, ...card.history);
      card.bars.replaceChildren(...card.history.map((v) => {
        const bar = h("i", {});
        bar.style.setProperty("--h", `${Math.max(6, Math.round((v / peak) * 100))}%`);
        return bar;
      }));
    }
    first = false;
  }

  async function read() {
    try {
      paint(await api.get("/api/x/hardware/sensors"));
    } catch (error) {
      stamp.textContent = error.message;
    }
  }

  root.append(h("section", { class: "card rise hw-panel" },
    h("div", { class: "pt-head hw-head" }, h("h2", { class: "h2" }, t("Temperatures and fan", "溫度同風扇")), h("button", { class: "btn t sm", onClick: read }, icon("refresh", "sm"), t("Refresh", "重新整理"))),
    h("div", { class: "t2" }, t("Read from the router every few seconds while this screen is open. A dial that says it is not reported means this router does not have that sensor.", "呢個畫面開住時，每幾秒向路由器讀取。顯示「冇提供」代表呢部路由器冇嗰個感應器。")),
    grid, stamp));
  const timer = setInterval(() => !document.hidden && read(), REFRESH_MS);
  return { read, paint, stop: () => clearInterval(timer) };
}

// A strip of lamps that shows what the light settings do: dark when the lights are off, the RGB colour when it is on.
function strip(ctx, data) {
  const { h, t } = ctx;
  const all = [...data.lights, ...data.entries];
  const byId = (id) => all.find((e) => e.id === id);
  const now = (id) => {
    const entry = byId(id);
    return entry ? (ctx.dock.has(id) ? ctx.dock.value(id) : entry.value) : null;
  };
  const lamps = Array.from({ length: 5 }, (_, i) => {
    const lamp = h("i", { class: "hw-lamp" });
    lamp.style.setProperty("--i", String(i));
    return lamp;
  });
  const note = h("div", { class: "t2", "aria-live": "polite" });
  const el = h("div", { class: "hw-strip", role: "img" }, lamps);
  const paint = () => {
    const lightsOff = now("sys.led") === "1";
    const aura = byId("hardware.aura") && !byId("hardware.aura").disabled && now("hardware.aura") === "1";
    const colour = aura ? rgbToHex(now("hardware.aura-colour") ?? "") : null;
    el.dataset.state = lightsOff ? "off" : "on";
    el.style.setProperty("--glow", colour ?? "var(--good)");
    const text = lightsOff ? t("The lights are off.", "燈已經關咗。") : colour ? t("The lights are on, with the RGB colour.", "燈開住，用緊 RGB 顏色。") : t("The lights are on.", "燈開住。");
    el.setAttribute("aria-label", text);
    note.textContent = text;
  };
  paint();
  return { nodes: h("div", { class: "hw-stripbox" }, el, note), off: ctx.bus.on("dock", paint) };
}

async function draw(ctx) {
  const { h, icon, t } = ctx;
  const data = await ctx.api.get("/api/domain/hardware");
  const page = ctx.page(label, lede);
  ctx.root.append(page);
  if (!ctx.state.canWrite) page.append(h("div", { class: "pill t" }, icon("visibility", "sm"), t("View only. Your account cannot change settings.", "只可以睇。你嘅帳戶唔可以改設定。")));
  const view = dials(ctx, page);
  view.paint(data);
  const lamps = strip(ctx, data);
  const lightsCard = h("section", { class: "card rise" }, h("h2", { class: "h2" }, icon("lightbulb", "sm"), " ", t("Lights", "燈號")), lamps.nodes);
  const groups = ctx.controls.settingGroups(data.entries);
  const lights = ctx.controls.settingGroups(data.lights.map((e) => ({ ...e, group: "lights", groupLabel: { en: "Light switches", yue: "燈掣" } })));
  const buttons = ctx.controls.settingGroups(data.buttons.map((e) => ({ ...e, group: "buttons", groupLabel: { en: "Front button", yue: "前面個掣" } })));
  const grid = h("div", { class: "grid2" });
  grid.append(...[...lights, ...groups, ...buttons].map((g) => ctx.controls.groupCard(g.label, g.entries)).filter(Boolean));
  page.append(lightsCard, grid);
  if (!data.entries.some((e) => !e.disabled)) page.append(h("div", { class: "note" }, icon("info"), h("div", {}, t("This router does not list the light schedule or RGB settings, so those controls are switched off with the reason.", "呢部路由器冇列出燈號時間表或 RGB 設定，所以相關控制已停用，並寫明原因。"))));
  return () => {
    view.stop();
    lamps.off();
  };
}

export default {
  id: "hardware",
  controls: { rgb: rgbControl },
  screens: [{ id: "hardware", group: { en: "Router", yue: "路由器" }, icon: "memory", label, render: (ctx) => draw(ctx) }],
  settings: [{
    id: "hardware",
    icon: "memory",
    label,
    async render(ctx) {
      const data = await ctx.api.get("/api/domain/hardware");
      return ctx.controls.settingGroups(data.entries).map((g) => ctx.controls.groupCard(g.label, g.entries));
    },
  }],
  commands: [
    { id: "hardware.open", icon: "memory", label: { en: "Open hardware", yue: "開啟硬件" }, keywords: "led lights aura rgb colour fan temperature cpu button schedule night", run: (ctx) => ctx.navigate("hardware") },
    { id: "hardware.temperatures", icon: "device_thermostat", label: { en: "Show the temperature dials", yue: "睇溫度錶" }, keywords: "cpu radio heat fan gauge dial", run: (ctx) => ctx.navigate("hardware") },
  ],
};
