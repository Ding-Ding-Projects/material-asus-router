// Loads every feature module and merges what it offers into the app shell.
// The server lists the modules at GET /api/features/manifest (every real
// public/js/features/<id>/index.js, sorted). Each module's default export is:
//
//   { id, screens?, settings?, commands?, overlays?, toolbar?, controls? }
//
// See README.md in this folder for the exact shapes and the ctx every
// callback receives. One broken module is reported and skipped; it never
// stops the app or the other features.
import { oneClick } from "./change-safety/safety.js";
import * as core from "../core.js";
import { app, dock, notice } from "../dock.js";
import * as controls from "../controls.js";
import { registerControl } from "../control-registry.js";
import { checkFeatureModule } from "./validate.js";

const { api, bus, clear, confirmDialog, getLang, h, icon, openDialog, t, tt, toast } = core;

export const featureState = { screens: new Map(), settings: [], commands: [], overlays: [], toolbar: [], errors: [], loaded: [] };

function context(navigate) {
  // One page: a heading, a lede and children, the same look as the stock screens.
  const page = (title, lede, ...children) => h("div", { class: "page" }, h("div", { class: "rise" }, h("h1", { class: "disp" }, tt(title)), lede ? h("p", { class: "lede" }, tt(lede)) : null), children);
  return Object.freeze({ api, t, tt, h, icon, clear, toast, openDialog, confirmDialog, bus, getLang, oneClick, state: app, dock, notice, controls: { ...controls }, navigate, page, notifications: { notice, toast } });
}

export async function loadFeatures({ navigate, reserved = new Set(), onProgress = null }) {
  for (const key of ["settings", "commands", "overlays", "toolbar", "errors", "loaded"]) featureState[key] = [];
  featureState.screens = new Map();
  const ctx = context(navigate);
  featureState.ctx = ctx;
  let manifest;
  try {
    manifest = await api.get("/api/features/manifest");
  } catch (error) {
    featureState.errors.push({ url: "/api/features/manifest", message: error.message });
    return featureState;
  }
  for (const url of manifest.styles ?? []) document.head.append(h("link", { rel: "stylesheet", href: url, "data-feature": "" }));
  // Fetch every feature module at once (a slow link would otherwise pay one round trip per module in turn),
  // then register them in manifest order so the result does not depend on which arrived first.
  const urls = manifest.modules ?? [];
  let arrived = 0;
  const imports = urls.map((url) => import(url).then((mod) => { arrived += 1; onProgress?.(arrived, urls.length); return { mod }; }, (error) => { arrived += 1; onProgress?.(arrived, urls.length); return { error }; }));
  const results = await Promise.all(imports);
  urls.forEach((url, i) => {
    const folder = url.split("/").slice(-2)[0];
    try {
      if (results[i].error) throw results[i].error;
      const feature = results[i].mod.default;
      const problem = checkFeatureModule(feature, folder);
      if (problem) throw new Error(problem);
      register(feature, ctx, reserved);
      featureState.loaded.push(feature.id);
    } catch (error) {
      featureState.errors.push({ url, message: error.message });
      console.error(`[features] ${url}: ${error.message}`);
    }
  });
  const screens = {};
  for (const [id, s] of featureState.screens) screens[id] = { id, icon: s.icon, label: s.label, group: s.group };
  if (featureState.settings.length) {
    screens["feature-settings"] = { id: "feature-settings", icon: "tune", label: { en: "Feature settings", yue: "功能設定" }, group: { en: "Router", yue: "路由器" } };
    featureState.screens.set("feature-settings", { ...screens["feature-settings"], render: (root) => settingsScreen(root, ctx) });
  }
  app.featureScreens = screens;
  return featureState;
}

function register(feature, ctx, reserved) {
  for (const [type, factory] of Object.entries(feature.controls ?? {})) registerControl(type, (entry, current, commit, locked) => factory(entry, current, commit, locked, ctx));
  for (const s of feature.screens ?? []) {
    if (reserved.has(s.id) || featureState.screens.has(s.id)) throw new Error(`screen id "${s.id}" is already used`);
    featureState.screens.set(s.id, { ...s, feature: feature.id, render: (root) => s.render({ ...ctx, root, el: root }) });
  }
  for (const s of feature.settings ?? []) featureState.settings.push({ ...s, feature: feature.id });
  for (const c of feature.commands ?? []) featureState.commands.push({ ...c, feature: feature.id });
  for (const o of feature.overlays ?? []) featureState.overlays.push({ ...o, feature: feature.id });
  for (const b of feature.toolbar ?? []) featureState.toolbar.push({ ...b, feature: feature.id });
}

// The screen that lists every feature's settings sections, one card each.
async function settingsScreen(root, ctx) {
  const page = ctx.page({ en: "Feature settings", yue: "功能設定" }, { en: "Settings that belong to the add-on features.", yue: "附加功能嘅設定。" });
  root.append(page);
  for (const section of featureState.settings) {
    const body = h("div", {});
    page.append(h("section", { class: "card rise", id: `fs-${section.id}` }, h("h2", { class: "h2" }, section.icon ? icon(section.icon, "sm") : null, " ", tt(section.label)), body));
    try {
      const out = await section.render({ ...ctx, root: body, el: body });
      if (out instanceof Node || Array.isArray(out)) body.append(...[out].flat());
    } catch (error) {
      body.append(h("div", { class: "note bad" }, icon("error"), error.message));
    }
  }
}

// Calls every overlay's mount(ctx) and returns one function that undoes them.
export function mountOverlays() {
  const stops = [];
  for (const overlay of featureState.overlays) {
    try {
      const stop = overlay.mount(featureState.ctx);
      if (typeof stop === "function") stops.push(stop);
    } catch (error) {
      console.error(`[features] overlay ${overlay.id}: ${error.message}`);
    }
  }
  return () => stops.forEach((stop) => stop());
}
