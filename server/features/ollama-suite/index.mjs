// Local Ollama suite manager: connect to an Ollama server the person names,
// list, pull and delete models, test a chat, and see an honest unreachable
// state with offline troubleshooting steps. The address is kept in the
// browser and sent with each request; this server only relays it.
import { RECOMMENDED, fitVerdict, modelName } from "./models.mjs";
import { cancelJob, chat, listJobs, parseEndpoint, remove, startPulls, status } from "./client.mjs";

const need = (who, bad, roles, message) => {
  if (!roles.includes(who.role)) throw bad(message, 403);
};
const OPERATORS = ["owner", "operator"];

export default {
  id: "ollama-suite",

  routes(api) {
    api.get("/recommended", () => ({ models: RECOMMENDED, note: "A starting list, not the full official catalogue. Sizes are approximate." }));
    api.get("/jobs", () => ({ jobs: listJobs() }));

    // The endpoint is always in the request body, never in the address.
    api.post("/status", async ({ body, who, bad }) => {
      need(who, bad, OPERATORS, "Your account cannot contact other servers.");
      return status(parseEndpoint(body.endpoint));
    });

    api.post("/fit", ({ body }) => {
      const hardware = { ramGb: body.ramGb ?? null, vramGb: body.vramGb ?? null };
      const models = Array.isArray(body.models) && body.models.length ? body.models.slice(0, 100).map((m) => ({ name: String(m.name), sizeGb: Number(m.sizeGb) })) : RECOMMENDED;
      return { verdicts: models.map((m) => ({ name: m.name, sizeGb: m.sizeGb, verdict: fitVerdict(m.sizeGb, hardware) })) };
    });

    // A batch of models, pulled one after another. Returns at once; progress is in /jobs.
    api.post("/pull", async ({ body, who, bad }) => {
      need(who, bad, OPERATORS, "Your account cannot download models.");
      const models = [...new Set((Array.isArray(body.models) ? body.models : [body.model]).map(modelName))];
      if (!models.length) throw bad("Choose at least one model to download.");
      if (models.length > 20) throw bad("A batch holds at most 20 models.");
      const { jobs } = startPulls(parseEndpoint(body.endpoint), models);
      return { jobs };
    });

    api.post("/cancel", ({ body, who, bad }) => {
      need(who, bad, OPERATORS, "Your account cannot cancel downloads.");
      return { cancelled: cancelJob(String(body.id ?? "")) };
    });

    // Deleting a model cannot be undone, so only the owner may do it.
    api.post("/delete", async ({ body, who, bad }) => {
      need(who, bad, ["owner"], "Only the owner can delete models.");
      return remove(parseEndpoint(body.endpoint), modelName(body.model));
    });

    api.post("/chat", async ({ body, who, bad }) => {
      need(who, bad, OPERATORS, "Your account cannot chat with models.");
      const messages = Array.isArray(body.messages) ? body.messages.slice(-40) : [];
      if (!messages.length) throw bad("Write a message first.");
      const clean = messages.map((m) => {
        if (!["user", "assistant", "system"].includes(m.role) || typeof m.content !== "string" || m.content.length > 20000) throw bad("Each message needs a role and text of at most 20,000 characters.");
        return { role: m.role, content: m.content };
      });
      return chat(parseEndpoint(body.endpoint), { model: modelName(body.model), messages: clean });
    });
  },

  // This feature changes no router setting, so the pretend router needs
  // nothing from it.
};
