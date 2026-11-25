// The browser half of modes and the mode builder, run in Node against the real
// server and the pretend router with a very small DOM stand-in. It draws the real
// screens with the app's own element builder and dialogs, then taps the real
// buttons: turn a mode on, follow the review dialog to the end, undo it, choose a
// device, and build and save a custom mode. It proves the browser code and the
// server agree; it is not a layout or visual check.
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { startApp, waitFor } from "../helpers.mjs";

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});
beforeEach(async () => {
  document.body.children = [];
  process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "mar-modes-ui-"));
});

import { document, install } from "../dom-stub.mjs";

install();
const core = await import("../../public/js/core.js");
const modes = (await import("../../public/js/features/modes/index.js")).default;
const builder = (await import("../../public/js/features/mode-builder/index.js")).default;

// ---- helpers -------------------------------------------------------------------
const byText = (root, tag, text) => root.all(tag).find((el) => el.textContent.includes(text));
const dialogs = () => document.body.children.filter((c) => c.tag === "dialog" && c.open);
const lastDialog = () => dialogs().at(-1);

async function boot(t) {
  const real = globalThis.fetch;
  globalThis.fetch = (url, init = {}) => real(url.startsWith("/") ? t.base + url : url, { ...init, headers: { ...(init.headers ?? {}), Cookie: t.owner.cookie } });
  core.auth.csrf = t.owner.csrf;
  const navigated = [];
  const ctx = {
    api: core.api, t: core.t, tt: core.tt, h: core.h, icon: core.icon, clear: core.clear, toast: core.toast,
    openDialog: core.openDialog, confirmDialog: core.confirmDialog, bus: core.bus, getLang: core.getLang,
    state: { canWrite: true }, navigate: (id) => navigated.push(id), notifications: { toast() {} }, dock: {},
    page: (title, lede) => core.h("div", { class: "page" }, core.h("h1", {}, core.tt(title))),
  };
  return { ctx, navigated, restore: () => (globalThis.fetch = real) };
}

async function draw(ctx, feature) {
  const root = core.h("div", {});
  const screen = feature.screens[0];
  const cleanup = await screen.render({ ...ctx, root });
  cleanups.push(cleanup);
  return { root, cleanup };
}

const cardOf = (root, id) => root.querySelector(`[data-mode="${id}"]`);
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));

test("modes screen: turn a mode on with one tap, see the verified result, and undo it", async () => {
  const t = await startApp();
  const { ctx, restore } = await boot(t);
  try {
    const { root, cleanup } = await draw(ctx, modes);
    assert.equal(root.all(".mode-card").length, 7);
    assert.equal(root.querySelector(".mode-num").textContent, "0");

    // Guest party is low risk: one tap writes it, no second confirmation.
    const guest = cardOf(root, "guest");
    assert.ok(!guest.classList.contains("on"));
    byText(guest, "button", "Turn on").click();
    await waitFor(() => (lastDialog() && lastDialog().querySelector(".mode-result") ? true : null), { timeoutMs: 8000 }).catch((e) => { throw new Error(`${e.message} :: ${lastDialog()?.textContent} :: ${document.body.children.map((c) => c.tag + c.open)}`); });
    assert.ok(lastDialog().querySelector(".mode-result.ok"), "the dialog reports the verified success");
    assert.equal(t.router.nvram["wl0.1_bss_enabled"], "1");
    assert.equal(t.router.nvram["wl1.1_expire"], "14400");
    byText(lastDialog(), "button", "Close").click();
    await waitFor(() => (cardOf(root, "guest").classList.contains("on") ? true : null));
    assert.equal(root.querySelector(".mode-num").textContent, "1");
    assert.ok(byText(cardOf(root, "guest"), "button", "Guest card"), "a guest card button appears once the mode is on");

    // Undo reviews the old values, then puts them back.
    byText(cardOf(root, "guest"), "button", "Undo this mode").click();
    await waitFor(() => (lastDialog() ? true : null));
    assert.ok(lastDialog().querySelector(".mode-diff"), "the undo shows exactly what goes back");
    byText(lastDialog(), "button", "Undo").click();
    await waitFor(() => (lastDialog().querySelector(".mode-result.ok") ? true : null), { timeoutMs: 8000 });
    assert.equal(t.router.nvram["wl0.1_bss_enabled"], "0");
    byText(lastDialog(), "button", "Close").click();
    await waitFor(() => (!cardOf(root, "guest").classList.contains("on") ? true : null));
    cleanup();
  } finally {
    restore();
    await t.stop();
  }
});

test("modes screen: a risky mode is reviewed first and runs under the guard; a refusal shows the engine's words", async () => {
  const t = await startApp();
  const { ctx, restore } = await boot(t);
  try {
    const { root, cleanup } = await draw(ctx, modes);
    byText(cardOf(root, "lockdown"), "button", "Turn on").click();
    await waitFor(() => (lastDialog() ? true : null));
    const review = lastDialog();
    assert.ok(review.querySelector(".mode-note"), `the guard note is shown: ${review.textContent}`);
    assert.equal(t.router.nvram.wps_enable, "1", "nothing is written before the review is accepted");
    assert.ok(review.all(".mode-diff-row").length >= 4);
    byText(review, "button", "under guard").click();
    await waitFor(() => (lastDialog().querySelector(".mode-result") ? true : null), { timeoutMs: 15000 });
    assert.ok(lastDialog().querySelector(".mode-result.ok"), lastDialog().textContent);
    assert.equal(t.router.nvram.wps_enable, "0");
    byText(lastDialog(), "button", "Close").click();

    // A preview that went stale because the router changed underneath is refused by the engine, and the person reads why.
    byText(cardOf(root, "gaming"), "button", "Preview").click();
    await waitFor(() => (lastDialog()?.querySelector(".mode-diff") ? true : null));
    t.router.nvram.qos_enable = "1";
    byText(lastDialog(), "button", "Apply").click();
    await waitFor(() => (lastDialog().querySelector(".mode-result.no") ? true : null));
    assert.match(lastDialog().textContent, /changed on the router since the preview/);
    assert.equal(t.router.nvram.qos_type, "1", "nothing was written");
    byText(lastDialog(), "button", "Close").click();
    cleanup();
  } finally {
    restore();
    await t.stop();
  }
});

test("modes screen: choosing a device is remembered and used by the mode", async () => {
  const t = await startApp();
  const { ctx, restore } = await boot(t);
  try {
    const { root, cleanup } = await draw(ctx, modes);
    const gaming = cardOf(root, "gaming");
    const select = gaming.querySelector("select");
    assert.ok(select, "the console is picked from a real list of devices");
    const devices = select.children.filter((o) => o.value);
    assert.ok(devices.length > 0, "the router's devices are offered");
    select.value = devices[0].value;
    select.fire("change");
    await waitFor(async () => ((await t.owner.get("/api/x/modes/list")).data.modes.find((m) => m.id === "gaming").params.console === select.value ? true : null));
    await waitFor(() => (cardOf(root, "gaming").all(".mode-item").length > 0 ? true : null));
    byText(cardOf(root, "gaming"), "button", "Exactly what changes").click();
    await waitFor(() => (cardOf(root, "gaming").all(".mode-item").some((i) => i.textContent.includes("Traditional")) ? true : null));
    cleanup();
  } finally {
    restore();
    await t.stop();
  }
});

test("mode builder: add a setting with its real control, name the mode, save it, and see it on the Modes screen", async () => {
  const t = await startApp();
  const { ctx, restore } = await boot(t);
  try {
    const { root, cleanup } = await draw(ctx, builder);
    assert.ok(root.all(".mb-entry").length > 20, `the palette lists the catalogue: ${root.textContent.slice(0, 300)}`);
    assert.ok(root.querySelector(".mb-empty"), "an empty mode explains what to do");
    const search = root.querySelector("input");
    search.value = "upnp";
    search.fire("input");
    const entry = root.all(".mb-entry").find((e) => e.textContent.includes("UPnP"));
    assert.ok(entry, "searching finds a setting by name");
    byText(entry, "button", "Add").click();
    const control = root.querySelector(".mb-item").querySelector(".sw");
    assert.ok(control, "a switch setting is edited with a switch");
    assert.equal(control.getAttribute("aria-checked"), "true");
    control.click();
    assert.equal(control.getAttribute("aria-checked"), "false");

    const name = root.all("input").find((i) => i.getAttribute("aria-label") === "Mode name");
    name.value = "No ports";
    name.fire("input");
    await waitFor(() => (!byText(root, "button", "Save mode").disabled ? true : null));
    byText(root, "button", "Save mode").click();
    await waitFor(async () => ((await t.owner.get("/api/x/mode-builder/modes")).data.modes.length === 1 ? true : null));
    const saved = (await t.owner.get("/api/x/mode-builder/modes")).data.modes[0];
    assert.deepEqual([saved.name, saved.items], ["No ports", [{ id: "routing.upnp", value: "0" }]]);
    assert.equal(t.router.nvram.upnp_enable, "1", "saving writes nothing");
    cleanup();

    const screen = await draw(ctx, modes);
    assert.equal(screen.root.all(".mode-card").length, 8);
    const card = screen.root.all(".mode-card").at(-1);
    assert.ok(card.textContent.includes("No ports"));
    screen.cleanup();
  } finally {
    restore();
    await t.stop();
  }
});
