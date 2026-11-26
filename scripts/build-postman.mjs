// Builds the Postman collection for the app's HTTP API from the source, so it cannot drift:
//   docs/api/material-asus-router.postman_collection.json
// It reads the core routes (server/app.mjs, server/changes/routes.mjs), every feature folder's
// routes (under /api/x/<id>), screen data (/api/domain/<id>) and feature actions
// (/api/actions/<id>.<name>). Run: node scripts/build-postman.mjs   (--check fails when stale)
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "api", "material-asus-router.postman_collection.json");

export async function collectRoutes() {
  const routes = [];
  for (const file of ["server/app.mjs", "server/changes/routes.mjs"]) {
    const src = await readFile(path.join(ROOT, file), "utf8");
    for (const m of src.matchAll(/route\("(GET|POST|PUT|PATCH|DELETE)", "([^"]+)"/g)) routes.push({ method: m[1], path: m[2], group: groupOf(m[2]), source: file });
  }
  const featureDir = path.join(ROOT, "server", "features");
  for (const entry of (await readdir(featureDir, { withFileTypes: true })).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const id = entry.name;
    const src = await readFile(path.join(featureDir, id, "index.mjs"), "utf8").catch(() => "");
    for (const m of src.matchAll(/api\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g)) routes.push({ method: m[1].toUpperCase(), path: `/api/x/${id}${m[2]}`, group: `Features / ${id}`, source: `server/features/${id}/index.mjs` });
    // App preferences come from the kit's appPrefs helper, which adds GET and PUT /prefs.
    if (/\.routes\(api\)/.test(src) && /appPrefs\(/.test(src)) for (const method of ["GET", "PUT"]) routes.push({ method, path: `/api/x/${id}/prefs`, group: `Features / ${id}`, source: `server/features/${id}/index.mjs` });
    const domains = src.match(/domainMeta:\s*\[([\s\S]*?)\]\s*,\s*\n/);
    if (domains) for (const d of domains[1].matchAll(/id:\s*"([a-z0-9-]+)"/g)) routes.push({ method: "GET", path: `/api/domain/${d[1]}`, group: `Features / ${id}`, source: `server/features/${id}/index.mjs` });
    const actions = src.match(/\n  actions:\s*\{([\s\S]*?)\n  \},?\n/);
    if (actions) for (const a of actions[1].matchAll(/\n    "?([a-z][a-z0-9-]*)"?:\s*\{/g)) routes.push({ method: "POST", path: `/api/actions/${id}.${a[1]}`, group: `Features / ${id}`, source: `server/features/${id}/index.mjs` });
  }
  const seen = new Set();
  return routes.filter((r) => (seen.has(`${r.method} ${r.path}`) ? false : seen.add(`${r.method} ${r.path}`)));
}

function groupOf(p) {
  if (p === "/health" || /^\/api\/(setup|login|logout|session)/.test(p)) return "Sign-in and session";
  if (/^\/api\/(router|routers|unkick)/.test(p)) return "Router connection";
  if (/^\/api\/(changes|safety|household|history)/.test(p)) return "Changes and safety";
  if (/^\/api\/users/.test(p)) return "People";
  if (/^\/api\/(backup|restore)/.test(p)) return "Backup and restore";
  return "App";
}

const BODIES = {
  "POST /api/setup": { name: "Pat", username: "pat", password: "a long enough password" },
  "POST /api/login": { username: "pat", password: "a long enough password" },
  "POST /api/router/connect": { host: "198.51.100.1", port: 22, username: "admin", authType: "key" },
  "POST /api/changes/preview": { changes: [{ id: "wl0.ssid", value: "Harbour Home" }] },
  "POST /api/changes/apply": { previewId: "{{previewId}}" },
  "POST /api/x/bandwidth-control/hold": { mac: "AC:5A:F0:01:02:03", method: "pause", minutes: 30, note: "Homework first" },
  "POST /api/routers": { name: "Living room", role: "main" },
};

function item(r) {
  const url = r.path.replace(/:([a-z]+)/gi, "{{$1}}");
  const body = BODIES[`${r.method} ${r.path}`];
  const write = r.method !== "GET";
  return {
    name: `${r.method} ${r.path}`,
    request: {
      method: r.method,
      header: [...(write ? [{ key: "x-csrf", value: "{{csrf}}", description: "The token from the sign-in answer; every write needs it." }] : []), ...(body ? [{ key: "Content-Type", value: "application/json" }] : []), ...(r.path === "/api/unkick" && write ? [{ key: "x-unkick", value: "1" }] : [])],
      url: { raw: `{{baseUrl}}${url}`, host: ["{{baseUrl}}"], path: url.split("/").filter(Boolean) },
      ...(body ? { body: { mode: "raw", raw: JSON.stringify(body, null, 2) } } : {}),
      description: `Source: ${r.source}`,
    },
  };
}

export async function buildCollection() {
  const routes = await collectRoutes();
  const groups = new Map();
  for (const r of routes) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
  const order = ["Sign-in and session", "Router connection", "Changes and safety", "People", "Backup and restore", "App"];
  const names = [...groups.keys()].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b));
  return {
    info: {
      name: "Material Asus Router",
      description: "Every HTTP route of the app, generated from the source by scripts/build-postman.mjs. Set baseUrl (for example http://198.51.100.2:8790), sign in with POST /api/login, then copy the csrf value from the answer into the csrf variable. The session cookie is kept by Postman. Router passwords and keys are never returned by any route.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [{ key: "baseUrl", value: "http://198.51.100.2:8790" }, { key: "csrf", value: "" }, { key: "previewId", value: "" }, { key: "id", value: "" }],
    item: names.map((name) => ({ name, item: groups.get(name).map(item) })),
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/").replace(/^\//, "")}` || process.argv[1]?.endsWith("build-postman.mjs")) {
  const text = `${JSON.stringify(await buildCollection(), null, 2)}\n`;
  if (process.argv.includes("--check")) {
    const current = await readFile(OUT, "utf8").catch(() => "");
    if (current.replace(/\r\n/g, "\n") !== text) {
      console.error("docs/api/material-asus-router.postman_collection.json is out of date. Run: node scripts/build-postman.mjs");
      process.exit(1);
    }
    console.log("The Postman collection is up to date.");
  } else {
    await mkdir(path.dirname(OUT), { recursive: true });
    await writeFile(OUT, text);
    const count = JSON.parse(text).item.reduce((n, g) => n + g.item.length, 0);
    console.log(`Wrote ${path.relative(ROOT, OUT)} with ${count} requests.`);
  }
}
