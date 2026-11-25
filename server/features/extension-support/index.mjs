// Extension support. A versioned manifest, a language-neutral JSON-lines
// protocol, permissions the person allows before anything runs, and two
// built-in extensions that use exactly the same route a third-party one would.
// Sensitive values (SSH credentials, router passwords) have no permission and
// never reach an extension.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { L } from "../kit.mjs";
import { LIMITS, runExtension } from "./host.mjs";
import { API_VERSION, PERMISSIONS, effectivePermissions, validateManifest } from "./manifest.mjs";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "builtin");

export const BUILTIN = [
  { schema: 1, id: "uptime-log", version: "1.0.0", entry: "uptime-log.mjs", name: L("Uptime log", "運行時間記錄"), description: L("Reads how long the router has been running and reports it in days.", "讀取路由器已經運行咗幾耐，用日數報告。"), permissions: ["router.status"], author: "Material Asus Router" },
  { schema: 1, id: "reboot-planner", version: "1.0.0", entry: "reboot-planner.mjs", name: L("Scheduled restart planner", "排程重啟規劃"), description: L("Suggests a weekly restart time for the Scheduled jobs screen. It never restarts anything itself.", "建議每週重啟時間，用喺排程工作畫面。佢自己唔會重啟任何嘢。"), permissions: ["nvram.read"], author: "Material Asus Router" },
];

const summarise = (m) => ({ ...m, permissionLabels: m.permissions.map((p) => ({ id: p, label: PERMISSIONS[p] })) });

export default {
  id: "extension-support",
  routes(api) {
    api.get("/list", () => ({ api: API_VERSION, limits: LIMITS, permissions: Object.entries(PERMISSIONS).map(([id, label]) => ({ id, label })), extensions: BUILTIN.map((m) => ({ ...summarise(validateManifest(m).manifest), builtin: true })) }));
    api.post("/validate", ({ body }) => validateManifest(body.manifest));
    api.post("/run", async ({ body, live, bad }) => {
      const manifest = BUILTIN.find((m) => m.id === body.id);
      if (!manifest) throw bad("That extension is not installed.", 404);
      const granted = effectivePermissions(manifest, body.allowed);
      if (granted.length < manifest.permissions.length) throw bad(`Allow every permission the extension asks for before running it. Still needed: ${manifest.permissions.filter((p) => !granted.includes(p)).join(", ")}.`, 403, { code: "CONSENT_NEEDED" });
      const ctx = await live();
      return runExtension({ manifest, dir: DIR, granted, exec: ctx.exec, nvram: ctx.nvram });
    });
  },
};
