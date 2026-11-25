// Minecraft world generator: typed world settings that depend on the game
// version, a bounded area of chunks (100 x 100 by default, or any shape drawn
// on the map), the batches it is cut into, and the folder or ZIP it ends up
// in. The settings, the commands and the folder are real; running the exact
// server and verifying the world are not built yet and are shown that way.
import { makePlan, packWorld, prepareFolder, settingsFor } from "./plan.mjs";

export default {
  id: "minecraft-world-generator",

  actions: {
    // Writes server.properties, eula.txt and the load commands to a new folder.
    prepare: { risk: "network", run: ({ body }) => prepareFolder(body) },
    // Packs a finished world folder into one ZIP, never replacing a ZIP.
    pack: { risk: "network", run: ({ body }) => packWorld(body.name) },
  },

  routes(api) {
    api.get("/schema", ({ query }) => ({ settings: settingsFor(String(query.version ?? "")) }));
    // A plan changes nothing: it is the settings, the batches and the steps.
    api.post("/plan", ({ body, bad }) => {
      try {
        return makePlan(body);
      } catch (error) {
        throw bad(error.message, error.status ?? 400);
      }
    });
  },
};
