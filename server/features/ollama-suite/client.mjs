// Talks to an Ollama server's HTTP API. The address is whatever the person set;
// every request is built from a validated scheme, host and port, has a time
// limit, and an unreachable server is a normal answer, never a crash.
import { randomUUID } from "node:crypto";
import { hostTarget } from "../kit.mjs";

export const DEFAULT_PORT = 11434;

const bad = (message) => Object.assign(new Error(message), { status: 400 });

// { scheme, host, port } from what the browser sent (either an object or "host:port").
export function parseEndpoint(input) {
  let scheme = "http";
  let host;
  let port = DEFAULT_PORT;
  if (typeof input === "string") {
    const m = /^(?:(https?):\/\/)?([^/:\s]+)(?::(\d{1,5}))?\/?$/.exec(input.trim());
    if (!m) throw bad("Write the address as host or host:port, for example localhost:11434.");
    [, scheme = "http", host] = m;
    if (m[3]) port = Number(m[3]);
  } else if (input && typeof input === "object") {
    scheme = input.scheme ?? "http";
    host = input.host;
    port = input.port === undefined || input.port === "" ? DEFAULT_PORT : Number(input.port);
  } else throw bad("Set the Ollama address first.");
  if (scheme !== "http" && scheme !== "https") throw bad("The address must use http or https.");
  host = hostTarget(host);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw bad("The port must be a whole number from 1 to 65535.");
  // The cloud metadata address is never a model server.
  if (/^169\.254\./.test(host)) throw bad("That address is a link-local address and cannot be an Ollama server.");
  return { scheme, host, port };
}

export const endpointUrl = ({ scheme, host, port }) => `${scheme}://${host.includes(":") ? `[${host}]` : host}:${port}`;

function classify(error) {
  const code = error?.cause?.code ?? error?.code ?? "";
  if (error?.name === "TimeoutError" || error?.name === "AbortError" || code === "UND_ERR_CONNECT_TIMEOUT") return { kind: "timeout", reason: "The server did not answer in time." };
  if (code === "ECONNREFUSED") return { kind: "refused", reason: "Nothing is listening at that address and port." };
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return { kind: "dns", reason: "That host name could not be found." };
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") return { kind: "reset", reason: "The connection was closed by the other side." };
  return { kind: "other", reason: error?.message ?? "The request failed." };
}

// The offline troubleshooter: what to check, in order, for each kind of failure.
export function troubleshoot(kind) {
  const steps = {
    refused: ["Start Ollama on that computer (run `ollama serve`, or open the Ollama app).", "Check the port. The default is 11434.", "If Ollama is on another computer, it listens on that computer only by default. Set OLLAMA_HOST there so it listens on its network address, then restart it."],
    timeout: ["Check that the computer is on and on the same network.", "A firewall may be dropping the port; allow it for your local network only.", "Try again; a model that is loading can make the first answer slow."],
    dns: ["Check the spelling of the host name.", "Try the address of the computer instead of its name."],
    reset: ["The server may have restarted; try again.", "If you use https, check that the server really speaks https on that port."],
    other: ["Check the address and port, then try again."],
  };
  return steps[kind] ?? steps.other;
}

export async function call(endpoint, path, { method = "GET", body, timeoutMs = 8000, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${endpointUrl(endpoint)}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error",
  });
  return response;
}

const describeModel = (m) => ({ name: m.name, size: m.size ?? 0, modified: m.modified_at ?? null, family: m.details?.family ?? "", parameters: m.details?.parameter_size ?? "", quantization: m.details?.quantization_level ?? "" });

export async function status(endpoint, options = {}) {
  try {
    const version = await (await call(endpoint, "/api/version", options)).json();
    const tags = await (await call(endpoint, "/api/tags", options)).json();
    let running = [];
    try {
      running = ((await (await call(endpoint, "/api/ps", options)).json()).models ?? []).map((m) => ({ name: m.name, size: m.size ?? 0, vram: m.size_vram ?? 0 }));
    } catch {
      // Older servers have no /api/ps; running models are simply not listed.
    }
    return { reachable: true, version: version.version ?? "unknown", models: (tags.models ?? []).map(describeModel), running };
  } catch (error) {
    const { kind, reason } = classify(error);
    return { reachable: false, kind, reason, steps: troubleshoot(kind) };
  }
}

export async function remove(endpoint, model, options = {}) {
  const response = await call(endpoint, "/api/delete", { ...options, method: "DELETE", body: { name: model } });
  if (!response.ok) throw bad(`Ollama refused to delete ${model}: ${(await response.text()).slice(0, 200)}`);
  return { ok: true };
}

export async function chat(endpoint, { model, messages }, options = {}) {
  const response = await call(endpoint, "/api/chat", { ...options, method: "POST", timeoutMs: options.timeoutMs ?? 120000, body: { model, messages, stream: false } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw bad(data.error ?? `Ollama answered ${response.status}.`);
  return { message: data.message ?? { role: "assistant", content: "" }, totalDuration: data.total_duration ?? null, evalCount: data.eval_count ?? null };
}

// ---- pulling models: one background job per model, run one after another ---------

const jobs = new Map();
const MAX_JOBS = 40;

export const listJobs = () => [...jobs.values()].map(({ controller, ...job }) => job).sort((a, b) => b.startedAt - a.startedAt);
export const clearJobs = () => jobs.clear();

async function pullOne(endpoint, job, options) {
  job.status = "pulling";
  try {
    const response = await call(endpoint, "/api/pull", { ...options, method: "POST", timeoutMs: 6 * 3600 * 1000, body: { name: job.model, stream: true } });
    if (!response.ok) throw new Error((await response.text()).slice(0, 200) || `Ollama answered ${response.status}.`);
    const decoder = new TextDecoder();
    let pending = "";
    for await (const chunk of response.body) {
      if (job.cancelled) throw new Error("Cancelled.");
      pending += decoder.decode(chunk, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop();
      for (const line of lines.filter(Boolean)) {
        const update = JSON.parse(line);
        if (update.error) throw new Error(update.error);
        job.detail = update.status ?? job.detail;
        if (update.total) { job.total = update.total; job.completed = update.completed ?? 0; }
        if (update.status === "success") job.status = "done";
      }
    }
    if (job.status !== "done") throw new Error("The download ended before Ollama said it was finished.");
  } catch (error) {
    job.status = job.cancelled ? "cancelled" : "failed";
    job.error = error.message;
  }
  job.finishedAt = Date.now();
}

// A batch pulls its models strictly one after another, and each model keeps
// its own outcome, so one failure never hides the others.
export function startPulls(endpoint, models, options = {}) {
  const created = models.map((model) => {
    const job = { id: randomUUID(), model, status: "queued", detail: "", completed: 0, total: 0, error: null, startedAt: Date.now(), finishedAt: null, cancelled: false };
    jobs.set(job.id, job);
    return job;
  });
  while (jobs.size > MAX_JOBS) {
    const finished = [...jobs.values()].find((j) => j.finishedAt);
    if (!finished) break;
    jobs.delete(finished.id);
  }
  const done = (async () => {
    for (const job of created) {
      if (job.cancelled) { job.status = "cancelled"; job.finishedAt = Date.now(); continue; }
      await pullOne(endpoint, job, options);
    }
  })();
  return { jobs: created.map(({ controller, ...j }) => j), done };
}

export function cancelJob(id) {
  const job = jobs.get(id);
  if (!job || job.finishedAt) return false;
  job.cancelled = true;
  return true;
}
