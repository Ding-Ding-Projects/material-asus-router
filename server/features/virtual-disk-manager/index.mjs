// Windows virtual disk manager. On the Windows desktop app it creates,
// attaches, detaches, resizes, compacts and converts VHD and VHDX files with
// the Hyper-V and storage cmdlets, each through a hold-to-confirm action.
// Anywhere else it says plainly that it needs the Windows desktop app.
import { OPERATIONS, buildScript, current } from "./vhd.mjs";

const writes = Object.entries(OPERATIONS).filter(([, o]) => o.write).map(([name]) => name);

// Each writing operation is a destructive action: it needs the hold button
// (the router model is not involved, so only "hold" is asked for).
const actions = Object.fromEntries(writes.map((name) => [name, { risk: "destructive", confirm: ["hold"], run: ({ body }) => current().run(name, body) }]));

export default {
  id: "virtual-disk-manager",
  actions,

  routes(api) {
    api.get("/status", () => {
      const m = current();
      return { available: m.available, reason: m.reason, operations: Object.entries(OPERATIONS).map(([id, o]) => ({ id, route: o.route, write: o.write })) };
    });
    // Reading is allowed for viewers; it changes nothing.
    api.get("/list", async ({ bad }) => {
      try {
        return await current().run("list");
      } catch (error) {
        throw bad(error.message, error.status ?? 500);
      }
    });
    api.post("/info", async ({ body, bad }) => {
      try {
        return await current().run("info", body);
      } catch (error) {
        throw bad(error.message, error.status ?? 500);
      }
    });
    // The script an operation would run, without running it: so a person can
    // review it, or run it themselves.
    api.post("/preview", ({ body, bad }) => {
      try {
        return { script: buildScript(String(body.operation ?? ""), body), route: OPERATIONS[body.operation]?.route };
      } catch (error) {
        throw bad(error.message, error.status ?? 400);
      }
    });
  },
};
