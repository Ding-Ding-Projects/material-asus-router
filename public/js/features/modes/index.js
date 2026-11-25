// Modes: change the whole house in one tap. Every mode is a real bundle of router
// changes that goes through the change engine, shows its exact old and new
// values first, and can be undone as one step. The seven ready-made modes and the
// modes built in the mode builder look and behave the same.
import { modeCard, stateOf } from "./cards.js";
import { showGuestCard } from "./guest-card.js";
import { reviewMode } from "./review.js";

const label = { en: "Modes", yue: "模式" };
const REFRESH_MS = 20000;

async function screen(ctx) {
  const { api, h, icon, t, tt } = ctx;
  const page = ctx.page(label, { en: "A mode is a bundle of router changes you turn on with one tap and undo with one tap. Each one lists exactly what it changes before anything is written.", yue: "模式即係一組路由器變更，㩒一下就開，再㩒一下就還原。寫入之前每個模式都會列明改乜。" });
  ctx.root.append(page);
  let data = { modes: [], active: 0 };
  let devices = [];
  const expanded = new Set();
  const heroNumber = h("span", { class: "mode-num", "aria-live": "polite" }, "0");
  const heroText = h("div", { class: "t2" });
  const grid = h("div", { class: "mode-grid" });
  const busy = h("div", { class: "mode-busy", hidden: true, role: "status" }, h("span", { class: "mode-spin", "aria-hidden": "true" }), t("Reading the router", "讀緊路由器"));

  page.append(
    h("section", { class: "card hero rise mode-hero" },
      h("div", { class: "mode-hero-glow", "aria-hidden": "true" }),
      h("div", { class: "k" }, icon("bolt", "sm"), " ", t("One tap, fully undoable", "㩒一下，隨時還原")),
      h("div", { class: "mode-hero-row" }, heroNumber, h("div", { class: "grow" }, h("div", { class: "h2" }, t("modes on now", "個模式開緊")), heroText)),
      h("div", { class: "actions" }, h("button", { class: "btn t", onClick: () => ctx.navigate("mode-builder") }, icon("add", "sm"), t("Build your own mode", "砌個自己嘅模式")))),
    busy,
    grid,
  );

  const handlers = {
    onToggle(mode) {
      if (expanded.has(mode.id)) expanded.delete(mode.id);
      else expanded.add(mode.id);
      redrawCard(mode);
    },
    async onSave(mode, params) {
      try {
        await api.post(`/api/x/modes/params/${encodeURIComponent(mode.id)}`, { params });
        await load({ quiet: true });
      } catch (error) {
        ctx.toast(error.message, "bad");
      }
    },
    onApply: (mode) => start(mode, "apply", true),
    onPreview: (mode) => start(mode, "apply", false),
    onUndo: (mode) => start(mode, "undo", false),
    onGuestCard: () => showGuestCard(ctx),
    onEdit: () => ctx.navigate("mode-builder"),
  };

  // Previews the mode through the change engine. A refusal (a stale preview, an impact check, a setting
  // that changed on the router) is shown as the engine worded it.
  async function start(mode, action, quick) {
    let result;
    try {
      result = await api.post("/api/x/modes/preview", { id: mode.id, action, params: mode.params });
    } catch (error) {
      ctx.toast(error.message, "bad");
      await load({ quiet: true });
      return;
    }
    // A low-risk mode applies on the first tap, because its exact values are already on the card.
    reviewMode(ctx, { mode, action, result, startNow: quick && !result.preview.guard.armed && action === "apply", onDone: () => load({ quiet: true }) });
  }

  const cardFor = (mode, index) => modeCard(ctx, mode, { index, devices, expanded: expanded.has(mode.id), ...handlers });

  function redrawCard(mode) {
    const old = grid.querySelector(`[data-mode="${mode.id}"]`);
    const next = cardFor(mode, data.modes.indexOf(mode));
    next.classList.remove("rise");
    old?.replaceWith(next);
    next.querySelector(".mode-more")?.focus();
  }

  function paint(animate) {
    ctx.clear(grid);
    data.modes.forEach((mode, index) => grid.append(cardFor(mode, index)));
    if (!animate) for (const card of grid.children) card.classList.remove("rise");
    heroNumber.textContent = String(data.active);
    const partial = data.modes.filter((m) => stateOf(m).kind === "partial").length;
    heroText.textContent = data.active
      ? data.modes.filter((m) => m.active).map((m) => tt(m.name)).join(", ")
      : partial ? t(`${partial} modes are partly in place.`, `有 ${partial} 個模式做咗一部分。`) : t("No mode is on. Pick one below.", "冇模式開住。喺下面揀一個。");
  }

  let first = true;
  async function load({ quiet = false } = {}) {
    if (!quiet) busy.hidden = false;
    try {
      data = await api.get("/api/x/modes/list");
      paint(first);
      first = false;
    } catch (error) {
      ctx.toast(error.message, "bad");
    } finally {
      busy.hidden = true;
    }
  }

  try {
    devices = (await api.get("/api/domain/devices")).devices ?? [];
  } catch {
    devices = [];
  }
  await load();
  const off = ctx.bus.on("changed", () => load({ quiet: true }));
  const timer = setInterval(() => load({ quiet: true }), REFRESH_MS);
  return () => {
    clearInterval(timer);
    off?.();
  };
}

export default {
  id: "modes",
  screens: [{ id: "modes", group: { en: "Router", yue: "路由器" }, icon: "bolt", label, render: screen }],
  commands: [{ id: "modes.open", icon: "bolt", label: { en: "Open modes: Gaming, Bedtime, Guest party and more", yue: "開啟模式：打機、瞓覺、請客等" }, keywords: "modes gaming bedtime guest party privacy lock away work 模式 打機 瞓覺 請客", run: (ctx) => ctx.navigate("modes") }],
};
