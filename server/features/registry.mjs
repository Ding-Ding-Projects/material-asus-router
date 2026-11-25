// Finds and loads feature folders: every server/features/<id>/index.mjs whose
// default export describes one feature (settings, screen data, routes,
// actions, fake router behaviour and new control types). Everything here is
// plain data merged into the rest of the server, so a feature never has to
// edit a shared file.
//
// The folders load once, with a top-level await, so the rest of the server can
// read the result synchronously. This file therefore imports nothing from
// server/router, server/ssh or server/changes.
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const RISKS = new Set(["low", "network", "destructive"]);
const CONFIRMS = new Set(["model", "hold"]);
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export const features = [];
// Anything wrong with a feature lands here instead of stopping the server.
// tests/real-controls.test.mjs requires this list to be empty.
export const featureErrors = [];
export const reportFeatureError = (id, message) => featureErrors.push(`${id}: ${message}`);

const domainReaders = new Map(); // domain id -> { feature, read }
const domainMeta = [];
const actions = new Map(); // "<feature>.<name>" -> definition
const controls = new Map(); // control type -> { validate, sample, invalid }
const nvramDefaults = []; // (options) => object
const fakeHandlers = [];

function check(feature, id) {
  if (!isObject(feature)) return "the default export is not an object";
  if (feature.id !== id) return `id "${feature.id}" must equal the folder name "${id}"`;
  if (feature.catalog !== undefined && typeof feature.catalog !== "function") return "catalog must be a function";
  if (feature.routes !== undefined && typeof feature.routes !== "function") return "routes must be a function";
  for (const [name, reader] of Object.entries(feature.domains ?? {})) if (typeof reader !== "function") return `domains.${name} must be a function`;
  for (const meta of feature.domainMeta ?? []) {
    if (!isObject(meta) || !ID.test(String(meta.id)) || !meta.icon || !isObject(meta.label) || !meta.label.en || !meta.label.yue) return "every domainMeta item needs id, icon and a label with en and yue";
  }
  for (const name of Object.keys(feature.domains ?? {}))
    if (!(feature.domainMeta ?? []).some((m) => m.id === name)) return `domains.${name} has no matching domainMeta item`;
  for (const [name, action] of Object.entries(feature.actions ?? {})) {
    if (!ID.test(name)) return `action name "${name}" must be lowercase letters, digits and dashes`;
    if (!isObject(action) || typeof action.run !== "function") return `action ${name} needs a run function`;
    if (!RISKS.has(action.risk)) return `action ${name} needs a risk of low, network or destructive`;
    if (action.confirm !== undefined && (!Array.isArray(action.confirm) || action.confirm.some((c) => !CONFIRMS.has(c)))) return `action ${name}: confirm must list model and/or hold`;
  }
  for (const [type, control] of Object.entries(feature.controls ?? {}))
    if (!isObject(control) || typeof control.validate !== "function" || typeof control.sample !== "function") return `controls.${type} needs validate and sample functions`;
  if (feature.fakeRouter !== undefined) {
    const fake = feature.fakeRouter;
    if (!isObject(fake)) return "fakeRouter must be an object";
    if (fake.nvram !== undefined && !isObject(fake.nvram) && typeof fake.nvram !== "function") return "fakeRouter.nvram must be an object or a function";
    if (fake.handlers !== undefined && (!Array.isArray(fake.handlers) || fake.handlers.some((fn) => typeof fn !== "function"))) return "fakeRouter.handlers must be a list of functions";
  }
  return null;
}

function register(feature) {
  features.push(feature);
  for (const [name, read] of Object.entries(feature.domains ?? {})) domainReaders.set(name, { feature: feature.id, read });
  for (const meta of feature.domainMeta ?? []) domainMeta.push({ ...meta, feature: feature.id });
  for (const [name, action] of Object.entries(feature.actions ?? {})) actions.set(`${feature.id}.${name}`, { ...action, feature: feature.id, name });
  for (const [type, control] of Object.entries(feature.controls ?? {})) {
    if (controls.has(type)) reportFeatureError(feature.id, `control type "${type}" is already provided by another feature`);
    else controls.set(type, control);
  }
  const fake = feature.fakeRouter;
  if (fake?.nvram) nvramDefaults.push(typeof fake.nvram === "function" ? fake.nvram : () => fake.nvram);
  fakeHandlers.push(...(fake?.handlers ?? []));
}

async function discover() {
  const folders = (await readdir(DIR, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  for (const id of folders) {
    const file = path.join(DIR, id, "index.mjs");
    if (!(await stat(file).catch(() => null))?.isFile()) continue;
    try {
      const feature = (await import(pathToFileURL(file).href)).default;
      const problem = check(feature, id);
      if (problem) reportFeatureError(id, problem);
      else register(feature);
    } catch (error) {
      reportFeatureError(id, `could not load: ${error.message}`);
    }
  }
  for (const message of featureErrors) console.error(`[features] ${message}`);
}
await discover();

// ---- read by the rest of the server --------------------------------------

// The extra catalogue entries every feature adds for one router.
export function featureCatalog(info) {
  const out = [];
  for (const feature of features) {
    if (!feature.catalog) continue;
    let entries;
    try {
      entries = feature.catalog(info);
    } catch (error) {
      reportFeatureError(feature.id, `catalog failed: ${error.message}`);
      continue;
    }
    for (const entry of entries ?? []) {
      if (!isObject(entry) || !entry.id || !entry.key || !entry.control || !entry.label || !entry.help) {
        reportFeatureError(feature.id, `a catalogue entry is missing id, key, control, label or help (${entry?.id ?? "no id"})`);
        continue;
      }
      if (!String(entry.id).startsWith(`${feature.id}.`)) {
        reportFeatureError(feature.id, `entry id "${entry.id}" must start with "${feature.id}."`);
        continue;
      }
      out.push({ domain: feature.id, group: feature.id, groupLabel: entry.label, restart: "", risk: "low", ...entry, feature: feature.id });
    }
  }
  return out;
}

export const featureDomainMeta = () => domainMeta;
export const featureDomain = (id) => domainReaders.get(id) ?? null;
export const featureAction = (name) => actions.get(name) ?? null;
export const featureActionNames = () => [...actions.keys()];
export const featureControl = (type) => controls.get(type) ?? null;
export const featureControlTypes = () => [...controls.keys()];
export const featureNvram = (options) => Object.assign({}, ...nvramDefaults.map((fn) => fn(options) ?? {}));
export const featureFakeHandlers = () => fakeHandlers;

// Registers every feature's HTTP routes. add(featureId, METHOD, subPath,
// handler, flags) is called once per route; the subPath is relative to
// /api/x/<id>.
export function mountFeatureRoutes(add) {
  for (const feature of features) {
    if (!feature.routes) continue;
    const api = {};
    for (const method of ["get", "post", "patch", "put", "delete"]) api[method] = (sub, handler, flags) => add(feature.id, method.toUpperCase(), sub, handler, flags);
    try {
      feature.routes(api);
    } catch (error) {
      reportFeatureError(feature.id, `routes failed: ${error.message}`);
    }
  }
}
