// ollama-suite talks to an Ollama server. The tests start a small stand-in for
// one on the loopback address, so nothing real is contacted.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { checkFeatureModule } from "../../public/js/features/validate.js";
import feature from "../../public/js/features/ollama-suite/index.js";
import { clearJobs, endpointUrl, parseEndpoint, troubleshoot } from "../../server/features/ollama-suite/client.mjs";
import { RECOMMENDED, VERDICTS, fitVerdict, modelName } from "../../server/features/ollama-suite/models.mjs";
import { startApp, waitFor } from "../helpers.mjs";

async function standIn() {
  const state = { models: [{ name: "llama3.2:3b", size: 2e9, modified_at: "2026-11-25T00:00:00Z", details: { family: "llama", parameter_size: "3B", quantization_level: "Q4_K_M" } }], deleted: [], chats: [], pulls: [] };
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    const json = (data, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (req.url === "/api/version") return json({ version: "0.5.0" });
    if (req.url === "/api/tags") return json({ models: state.models });
    if (req.url === "/api/ps") return json({ models: [{ name: "llama3.2:3b", size: 2e9, size_vram: 1e9 }] });
    if (req.url === "/api/delete" && req.method === "DELETE") { state.deleted.push(body.name); state.models = state.models.filter((m) => m.name !== body.name); return json({}); }
    if (req.url === "/api/chat") { state.chats.push(body); return json({ message: { role: "assistant", content: `echo: ${body.messages.at(-1).content}` }, eval_count: 3 }); }
    if (req.url === "/api/pull") {
      state.pulls.push(body.name);
      if (body.name === "broken:1b") { res.writeHead(200); res.write(`${JSON.stringify({ error: "pull model manifest: file does not exist" })}\n`); return res.end(); }
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      res.write(`${JSON.stringify({ status: "pulling manifest" })}\n`);
      res.write(`${JSON.stringify({ status: "downloading", total: 100, completed: 40 })}\n`);
      res.write(`${JSON.stringify({ status: "downloading", total: 100, completed: 100 })}\n`);
      state.models.push({ name: body.name, size: 1e9, details: {} });
      res.write(`${JSON.stringify({ status: "success" })}\n`);
      return res.end();
    }
    json({ error: "not found" }, 404);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { state, port: server.address().port, close: () => new Promise((r) => server.close(r)) };
}

test("ollama: addresses are validated and built from parts", () => {
  assert.deepEqual(parseEndpoint("localhost"), { scheme: "http", host: "localhost", port: 11434 });
  assert.deepEqual(parseEndpoint("https://ollama.example.test:8443/"), { scheme: "https", host: "ollama.example.test", port: 8443 });
  assert.deepEqual(parseEndpoint({ host: "198.51.100.20", port: "11500" }), { scheme: "http", host: "198.51.100.20", port: 11500 });
  assert.equal(endpointUrl(parseEndpoint("198.51.100.20:9")), "http://198.51.100.20:9");
  for (const wrong of ["", "a b", "host:99999", { host: "bad host!" }, { host: "x", scheme: "ftp" }, "169.254.169.254", { host: "x", port: 0 }, 5, null]) assert.throws(() => parseEndpoint(wrong), (e) => e.status === 400, JSON.stringify(wrong));
  assert.equal(modelName("llama3.2:3b"), "llama3.2:3b");
  assert.equal(modelName("library/qwen2.5:7b"), "library/qwen2.5:7b");
  for (const wrong of ["", "a b", "x;rm", "../x", "a".repeat(200)]) assert.throws(() => modelName(wrong), /not a model name/);
  assert.ok(troubleshoot("refused").length >= 3 && troubleshoot("nonsense").length >= 1);
});

test("ollama: the hardware fit check gives all four verdicts", () => {
  assert.equal(fitVerdict(2, { vramGb: 8 }), "runs-well");
  assert.equal(fitVerdict(5, { ramGb: 16, vramGb: 2 }), "runs-limits");
  assert.equal(fitVerdict(40, { ramGb: 16, vramGb: 8 }), "unlikely");
  assert.equal(fitVerdict(4, {}), "unknown");
  assert.equal(fitVerdict(0, { ramGb: 8 }), "unknown");
  assert.equal(fitVerdict(2, { ramGb: 8, vramGb: null }), "runs-limits");
  const seen = new Set(RECOMMENDED.map((m) => fitVerdict(m.sizeGb, { ramGb: 16, vramGb: 6 })));
  for (const verdict of ["runs-well", "runs-limits", "unlikely"]) assert.ok(seen.has(verdict), `the starter list covers ${verdict}`);
  assert.deepEqual(VERDICTS, ["runs-well", "runs-limits", "unlikely", "unknown"]);
});

test("ollama: connect, list, chat, batch pull with partial outcomes, and delete work end to end", async () => {
  const ollama = await standIn();
  const t = await startApp();
  clearJobs();
  try {
    const endpoint = { host: "127.0.0.1", port: ollama.port };
    const status = (await t.owner.post("/api/x/ollama-suite/status", { endpoint })).data;
    assert.equal(status.reachable, true);
    assert.equal(status.version, "0.5.0");
    assert.deepEqual(status.models.map((m) => [m.name, m.family, m.parameters]), [["llama3.2:3b", "llama", "3B"]]);
    assert.deepEqual(status.running.map((m) => m.name), ["llama3.2:3b"]);

    const chat = await t.owner.post("/api/x/ollama-suite/chat", { endpoint, model: "llama3.2:3b", messages: [{ role: "user", content: "hello" }] });
    assert.equal(chat.status, 200, chat.text);
    assert.equal(chat.data.message.content, "echo: hello");
    assert.equal(ollama.state.chats[0].stream, false);
    assert.equal((await t.owner.post("/api/x/ollama-suite/chat", { endpoint, model: "llama3.2:3b", messages: [] })).status, 400);
    assert.equal((await t.owner.post("/api/x/ollama-suite/chat", { endpoint, model: "llama3.2:3b", messages: [{ role: "robot", content: "x" }] })).status, 400);

    const pull = await t.owner.post("/api/x/ollama-suite/pull", { endpoint, models: ["qwen2.5:0.5b", "broken:1b", "gemma2:2b"] });
    assert.equal(pull.status, 200, pull.text);
    assert.equal(pull.data.jobs.length, 3);
    const finished = await waitFor(async () => {
      const { jobs } = (await t.owner.get("/api/x/ollama-suite/jobs")).data;
      return jobs.length === 3 && jobs.every((j) => j.finishedAt) ? jobs : null;
    });
    const outcome = Object.fromEntries(finished.map((j) => [j.model, [j.status, j.error]]));
    assert.deepEqual(outcome["qwen2.5:0.5b"], ["done", null]);
    assert.equal(outcome["broken:1b"][0], "failed");
    assert.match(outcome["broken:1b"][1], /does not exist/);
    assert.deepEqual(outcome["gemma2:2b"], ["done", null], "one failure does not stop the rest");
    assert.deepEqual(ollama.state.pulls, ["qwen2.5:0.5b", "broken:1b", "gemma2:2b"], "pulled in order, one at a time");
    assert.equal(finished.find((j) => j.model === "qwen2.5:0.5b").completed, 100);
    assert.equal((await t.owner.post("/api/x/ollama-suite/pull", { endpoint, models: [] })).status, 400);
    assert.equal((await t.owner.post("/api/x/ollama-suite/pull", { endpoint, models: ["bad name"] })).status, 400);

    assert.equal((await t.owner.post("/api/x/ollama-suite/delete", { endpoint, model: "gemma2:2b" })).status, 200);
    assert.deepEqual(ollama.state.deleted, ["gemma2:2b"]);

    const fit = (await t.owner.post("/api/x/ollama-suite/fit", { ramGb: 16, vramGb: 6 })).data.verdicts;
    assert.equal(fit.length, RECOMMENDED.length);
    assert.ok(new Set(fit.map((v) => v.verdict)).size >= 3);
    assert.ok((await t.owner.get("/api/x/ollama-suite/recommended")).data.models.length >= 10);
  } finally {
    await t.stop();
    await ollama.close();
  }
});

test("ollama: an unreachable server is a normal answer with troubleshooting steps, never a crash", async () => {
  const t = await startApp();
  try {
    const closed = await standIn(); // a port that was open a moment ago and is closed now
    await closed.close();
    const res = await t.owner.post("/api/x/ollama-suite/status", { endpoint: { host: "127.0.0.1", port: closed.port } });
    assert.equal(res.status, 200);
    assert.equal(res.data.reachable, false);
    assert.equal(res.data.kind, "refused");
    assert.match(res.data.reason, /Nothing is listening/);
    assert.ok(res.data.steps.length >= 3);
    assert.equal((await t.owner.post("/api/x/ollama-suite/status", { endpoint: "bad host" })).status, 400);
    assert.equal((await t.owner.post("/api/x/ollama-suite/status", {})).status, 400);
  } finally {
    await t.stop();
  }
});

test("ollama: roles are respected and deleting is owner-only", async () => {
  const ollama = await standIn();
  const t = await startApp();
  try {
    const endpoint = { host: "127.0.0.1", port: ollama.port };
    for (const [name, role] of [["op", "operator"], ["vi", "viewer"]]) assert.equal((await t.owner.post("/api/users", { name, username: name, password: `${name} password 123`, role })).status, 201);
    const operator = t.client();
    await operator.signIn("op", "op password 123");
    assert.equal((await operator.post("/api/x/ollama-suite/status", { endpoint })).status, 200);
    assert.equal((await operator.post("/api/x/ollama-suite/delete", { endpoint, model: "llama3.2:3b" })).status, 403);
    assert.deepEqual(ollama.state.deleted, []);
    const viewer = t.client();
    await viewer.signIn("vi", "vi password 123");
    assert.equal((await viewer.post("/api/x/ollama-suite/status", { endpoint })).status, 403);
    assert.equal((await viewer.get("/api/x/ollama-suite/recommended")).status, 200);
    assert.equal((await t.client().post("/api/x/ollama-suite/status", { endpoint })).status, 401);
  } finally {
    await t.stop();
    await ollama.close();
  }
});

test("ollama: the browser module is well formed and served", async () => {
  assert.equal(checkFeatureModule(feature, "ollama-suite"), null);
  const t = await startApp();
  try {
    assert.ok((await t.owner.get("/api/features/manifest")).data.modules.includes("/js/features/ollama-suite/index.js"));
  } finally {
    await t.stop();
  }
});
